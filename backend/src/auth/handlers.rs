use std::sync::Arc;

use axum::{
    extract::State,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use webauthn_rs::prelude::{Webauthn, WebauthnBuilder};

use super::error::ApiError;
use super::jwt::{create_token, verify_token, Claims};
use super::{email, passkeys};
use crate::config::Config;

pub const COOKIE_NAME: &str = "im_token";

/// What the auth handlers share besides the database: the WebAuthn relying party and an
/// HTTP client for the mail API.
pub struct AuthContext {
    pub webauthn: Webauthn,
    pub http: reqwest::Client,
}

impl AuthContext {
    pub fn new(config: &Config) -> Result<Self, String> {
        let primary = config
            .webauthn_origins
            .first()
            .ok_or("no WebAuthn origin configured")?;
        let mut builder = WebauthnBuilder::new(&config.webauthn_rp_id, primary)
            .map_err(|e| format!("WebAuthn configuration is invalid: {e}"))?
            .rp_name("Sonnet Man");
        for origin in config.webauthn_origins.iter().skip(1) {
            builder = builder.append_allowed_origin(origin);
        }
        let webauthn = builder
            .build()
            .map_err(|e| format!("WebAuthn configuration is invalid: {e}"))?;
        Ok(Self { webauthn, http: reqwest::Client::new() })
    }
}

pub type Ctx = Extension<Arc<AuthContext>>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub auth_provider: String,
    pub avatar_url: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub founding_player: Option<bool>,
    /// How many passkeys the account has; 0 is the cue to offer adding one.
    pub passkey_count: i64,
    /// True only on the email sign-in that created the account.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_new_user: Option<bool>,
}

#[derive(Serialize)]
pub struct MethodsResponse {
    /// Passkey sign-in is always offered by the server; the browser decides if it can.
    passkey: bool,
    /// False until a mail key is configured: the UI hides email sign-in.
    email: bool,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router(ctx: Arc<AuthContext>) -> Router<(PgPool, Config)> {
    Router::new()
        .route("/methods", get(methods))
        .route("/passkey/register/begin", post(passkeys::register_begin))
        .route("/passkey/register/finish", post(passkeys::register_finish))
        .route("/passkey/login/begin", post(passkeys::login_begin))
        .route("/passkey/login/finish", post(passkeys::login_finish))
        .route("/passkeys", get(passkeys::list))
        .route("/passkeys/{id}", delete(passkeys::remove))
        .route("/email/request", post(email::request_code))
        .route("/email/verify", post(email::verify_code))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .layer(Extension(ctx))
}

// ---------------------------------------------------------------------------
// Methods, logout, me
// ---------------------------------------------------------------------------

async fn methods(State((_, config)): State<(PgPool, Config)>) -> Json<MethodsResponse> {
    Json(MethodsResponse { passkey: true, email: config.email_mode.is_available() })
}

async fn logout() -> CookieJar {
    let cookie = Cookie::build((COOKIE_NAME, ""))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::ZERO)
        .build();
    CookieJar::new().add(cookie)
}

async fn me(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<Json<AuthResponse>, ApiError> {
    let claims = session(&jar, &config)?;
    let row = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url, created_at
         FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(ApiError::unauthorized)?;

    // Check founding player status
    let founding = if let Ok(launch) = chrono::NaiveDate::parse_from_str(&config.launch_date, "%Y-%m-%d") {
        let created: chrono::DateTime<chrono::Utc> = row.get("created_at");
        if created.date_naive() < launch {
            // Grant founding player rewards (idempotent)
            sqlx::query(
                "UPDATE player_stats SET credits = GREATEST(credits, 500) WHERE user_id = $1 AND credits < 500",
            )
            .bind(claims.sub)
            .execute(&pool)
            .await
            .ok();
            Some(true)
        } else {
            Some(false)
        }
    } else {
        None
    };

    Ok(Json(AuthResponse {
        user: row_to_user(&row),
        founding_player: founding,
        passkey_count: passkey_count(&pool, claims.sub).await?,
        is_new_user: None,
    }))
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// The signed-in user, from the `im_token` cookie. The auth routes sit outside the
/// middleware that guards the rest of the API, so they check the session themselves.
pub fn session(jar: &CookieJar, config: &Config) -> Result<Claims, ApiError> {
    let token = jar.get(COOKIE_NAME).ok_or_else(ApiError::unauthorized)?;
    verify_token(token.value(), &config.jwt_secret).map_err(|_| ApiError::unauthorized())
}

/// Start a session: the same JWT-in-cookie every other route already reads.
pub fn session_cookie(user_id: Uuid, username: &str, config: &Config) -> Result<CookieJar, ApiError> {
    let token = create_token(user_id, username, &config.jwt_secret)
        .map_err(|e| ApiError::internal("could not create session token", e))?;
    let cookie = Cookie::build((COOKIE_NAME, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build();
    Ok(CookieJar::new().add(cookie))
}

/// Reads the columns every user query in this module selects:
/// `id, username, email, display_name, auth_provider, avatar_url`.
pub fn row_to_user(row: &sqlx::postgres::PgRow) -> UserResponse {
    UserResponse {
        id: row.get("id"),
        username: row.get("username"),
        email: row.get("email"),
        display_name: row.get("display_name"),
        auth_provider: row.get("auth_provider"),
        avatar_url: row.get("avatar_url"),
    }
}

pub async fn passkey_count(pool: &PgPool, user_id: Uuid) -> Result<i64, ApiError> {
    Ok(sqlx::query_scalar("SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?)
}
