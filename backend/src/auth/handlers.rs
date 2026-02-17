use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::google;
use super::jwt::{create_token, Claims};
use crate::config::Config;

const COOKIE_NAME: &str = "im_token";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct GoogleSignInRequest {
    id_token: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    id: Uuid,
    username: String,
    email: Option<String>,
    display_name: Option<String>,
    auth_provider: String,
    avatar_url: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    user: UserResponse,
    #[serde(skip_serializing_if = "Option::is_none")]
    founding_player: Option<bool>,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<(PgPool, Config)> {
    Router::new()
        .route("/google", post(google_sign_in))
        .route("/logout", post(logout))
        .route("/me", get(me))
}

// ---------------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------------

async fn google_sign_in(
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<GoogleSignInRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), (StatusCode, String)> {
    if config.google_client_id.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "Google sign-in not configured".into(),
        ));
    }

    let info = google::verify_google_token(&body.id_token, &config.google_client_id)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

    // Look up existing user by google_id
    let existing = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url
         FROM users WHERE google_id = $1",
    )
    .bind(&info.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    if let Some(row) = existing {
        // Existing user — issue token
        let user_id: Uuid = row.get("id");
        let username: String = row.get("username");
        let token = create_token(user_id, &username, &config.jwt_secret)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
        let jar = CookieJar::new().add(build_cookie(token));
        return Ok((jar, Json(AuthResponse { user: row_to_user(&row), founding_player: None })));
    }

    // New user — create from Google profile
    let username = generate_username_from_email(&info.email);
    let unique_username = ensure_unique_username(&pool, &username).await?;

    let row = sqlx::query(
        "INSERT INTO users (username, email, display_name, google_id, google_email, avatar_url, auth_provider)
         VALUES ($1, $2, $3, $4, $5, $6, 'google')
         RETURNING id, username, email, display_name, auth_provider, avatar_url",
    )
    .bind(&unique_username)
    .bind(&info.email)
    .bind(&info.name)
    .bind(&info.sub)
    .bind(&info.email)
    .bind(&info.picture)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    let user_id: Uuid = row.get("id");

    // Initialize player stats
    sqlx::query("INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to init stats: {e}")))?;

    let token = create_token(user_id, &unique_username, &config.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let jar = CookieJar::new().add(build_cookie(token));

    Ok((jar, Json(AuthResponse { user: row_to_user(&row), founding_player: None })))
}

// ---------------------------------------------------------------------------
// Logout + Me
// ---------------------------------------------------------------------------

async fn logout() -> CookieJar {
    let cookie = Cookie::build((COOKIE_NAME, ""))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::ZERO)
        .build();
    CookieJar::new().add(cookie)
}

async fn me(
    Extension(claims): Extension<Claims>,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let row = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url, created_at
         FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".into()))?;

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

    Ok(Json(AuthResponse { user: row_to_user(&row), founding_player: founding }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn row_to_user(row: &sqlx::postgres::PgRow) -> UserResponse {
    UserResponse {
        id: row.get("id"),
        username: row.get("username"),
        email: row.get("email"),
        display_name: row.get("display_name"),
        auth_provider: row.get("auth_provider"),
        avatar_url: row.get("avatar_url"),
    }
}

fn generate_username_from_email(email: &str) -> String {
    email
        .split('@')
        .next()
        .unwrap_or("user")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .take(32)
        .collect()
}

async fn ensure_unique_username(
    pool: &PgPool,
    base: &str,
) -> Result<String, (StatusCode, String)> {
    let base = if base.len() < 3 {
        format!("{base}user")
    } else {
        base.to_string()
    };

    // Check if base username is available
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
        .bind(&base)
        .fetch_one(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;

    if !exists {
        return Ok(base);
    }

    // Append random suffix
    for _ in 0..10 {
        let suffix: u16 = rand::random();
        let candidate = format!("{}{}", &base[..base.len().min(28)], suffix);
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
                .bind(&candidate)
                .fetch_one(pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}")))?;
        if !exists {
            return Ok(candidate);
        }
    }

    Err((
        StatusCode::CONFLICT,
        "Could not generate unique username".into(),
    ))
}

fn build_cookie(token: String) -> Cookie<'static> {
    Cookie::build((COOKIE_NAME, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build()
}
