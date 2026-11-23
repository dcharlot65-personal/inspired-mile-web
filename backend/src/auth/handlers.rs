use std::sync::Arc;

use axum::{
    extract::State,
    http::HeaderMap,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use axum_extra::extract::CookieJar;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use webauthn_rs::prelude::{Webauthn, WebauthnBuilder};

use super::error::ApiError;
use super::sessions::{self, Session};
use super::{age, email, passkeys};
use crate::config::Config;

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
    /// `adult`, `teen` or `unknown` (auth/age.rs). The pages show the market and referrals only
    /// to an adult account; the server refuses the others whatever a page shows.
    pub age_tier: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub founding_player: Option<bool>,
    /// How many passkeys the account has; 0 is the cue to offer adding one.
    pub passkey_count: i64,
    /// True only on the sign-in that created the account.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_new_user: Option<bool>,
}

#[derive(Serialize)]
pub struct MethodsResponse {
    /// Passkey sign-in is always offered by the server; the browser decides if it can.
    passkey: bool,
    /// A visitor can create an account with a passkey alone: no email, no mail key needed.
    passkey_signup: bool,
    /// False until a mail key is configured: the UI then shows email nowhere.
    email: bool,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router(ctx: Arc<AuthContext>) -> Router<(PgPool, Config)> {
    Router::new()
        .route("/methods", get(methods))
        .route("/passkey/signup/begin", post(passkeys::signup_begin))
        .route("/passkey/signup/finish", post(passkeys::signup_finish))
        .route("/passkey/register/begin", post(passkeys::register_begin))
        .route("/passkey/register/finish", post(passkeys::register_finish))
        .route("/passkey/login/begin", post(passkeys::login_begin))
        .route("/passkey/login/finish", post(passkeys::login_finish))
        .route("/passkey/verify/begin", post(passkeys::verify_begin))
        .route("/passkey/verify/finish", post(passkeys::verify_finish))
        .route("/passkeys", get(passkeys::list))
        .route("/passkeys/{id}", delete(passkeys::remove))
        .route("/email/request", post(email::request_code))
        .route("/email/verify", post(email::verify_code))
        .route("/email/add/request", post(email::add_request))
        .route("/email/add/verify", post(email::add_verify))
        .route("/logout", post(logout))
        .route("/logout/all", post(logout_everywhere))
        .route("/me", get(me))
        .route("/age-tier", post(age::set_age_tier))
        .layer(Extension(ctx))
}

// ---------------------------------------------------------------------------
// Methods, logout, me
// ---------------------------------------------------------------------------

async fn methods(State((_, config)): State<(PgPool, Config)>) -> Json<MethodsResponse> {
    Json(MethodsResponse {
        passkey: true,
        passkey_signup: true,
        email: config.email_mode.is_available(),
    })
}

/// Sign out of this browser: the session is revoked on the server, so a copy of its cookie
/// stops working too, and the cookie is removed.
///
/// Another site must not be able to trigger this (a form that auto-submits here would
/// otherwise sign the visitor out): the request has to look like the page's own fetch, and
/// nothing, not even a clearing cookie, is sent back when it does not.
async fn logout(
    jar: CookieJar,
    headers: HeaderMap,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<CookieJar, ApiError> {
    if !sessions::is_same_site_json(&headers) {
        return Err(sessions::cross_site_refused());
    }
    // A signed token is enough to name the session to end, live or not.
    if let Some(claims) = sessions::claims_from(&jar, &config) {
        sessions::revoke(&pool, claims.sid).await?;
    }
    Ok(sessions::clearing_cookies(&config))
}

/// Sign out everywhere: every session of the account ends, this one included.
async fn logout_everywhere(
    jar: CookieJar,
    headers: HeaderMap,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<CookieJar, ApiError> {
    if !sessions::is_same_site_json(&headers) {
        return Err(sessions::cross_site_refused());
    }
    let session = session(&jar, &pool, &config).await?;
    let ended = sessions::revoke_all(&pool, session.claims.sub, None).await?;
    tracing::info!(user_id = %session.claims.sub, ended, "signed out everywhere");
    Ok(sessions::clearing_cookies(&config))
}

async fn me(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<Json<AuthResponse>, ApiError> {
    let claims = session(&jar, &pool, &config).await?.claims;
    let row = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url, age_tier, created_at
         FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(ApiError::unauthorized)?;

    // A founding player (an account made before `founding.created_before`, a date in
    // backend/data/economy.json) is brought up to the founding balance once, logged as a credit
    // transaction. Until 2026-11-19 every /auth/me refilled it, unlogged; until the third check of
    // that day the date was the server's LAUNCH_DATE setting, so a later date in a server's
    // environment handed every new account the credits.
    let created: chrono::DateTime<chrono::Utc> = row.get("created_at");
    let founding = if inspired_mile_api::economy::RULES.founding.applies_to(created) {
        if let Err(e) = grant_founding(&pool, claims.sub).await {
            tracing::warn!(user_id = %claims.sub, "could not grant the founding credits: {e}");
        }
        Some(true)
    } else {
        Some(false)
    };

    Ok(Json(AuthResponse {
        user: row_to_user(&row),
        founding_player: founding,
        passkey_count: passkey_count(&pool, claims.sub).await?,
        is_new_user: None,
    }))
}

/// Raise a founding player's balance to the founding amount, once per account.
async fn grant_founding(pool: &PgPool, user_id: uuid::Uuid) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    let balance = crate::ledger::lock_account(&mut tx, user_id).await?;
    let granted: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM credit_transactions WHERE user_id = $1 AND source = 'founding')",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    // Logged even when nothing is due (a balance already over the amount), so it happens once.
    if !granted {
        let top_up = (inspired_mile_api::economy::RULES.founding.credits - balance).max(0);
        crate::ledger::credit(&mut tx, user_id, top_up, "founding").await?;
    }
    tx.commit().await
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// The signed-in user, from the session cookie and its server-side row. The auth routes
/// sit outside the middleware that guards the rest of the API, so they check the session
/// themselves.
pub async fn session(jar: &CookieJar, pool: &PgPool, config: &Config) -> Result<Session, ApiError> {
    sessions::authenticate(pool, config, jar).await
}

/// Reads the columns every user query in this module selects:
/// `id, username, email, display_name, auth_provider, avatar_url, age_tier`.
pub fn row_to_user(row: &sqlx::postgres::PgRow) -> UserResponse {
    UserResponse {
        id: row.get("id"),
        username: row.get("username"),
        email: row.get("email"),
        display_name: row.get("display_name"),
        auth_provider: row.get("auth_provider"),
        avatar_url: row.get("avatar_url"),
        age_tier: row.get("age_tier"),
    }
}

pub async fn passkey_count(pool: &PgPool, user_id: Uuid) -> Result<i64, ApiError> {
    Ok(sqlx::query_scalar("SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?)
}

/// The age gate's answer, as sent by the page: only "adult" and "teen" (a teen with
/// consent) may create an account or give an email address. Unknown age and under 13 are
/// refused here whatever the page did.
///
/// This is a check of what the visitor says, nothing more. The date of birth is typed by
/// the visitor and the "my parent agrees" box is ticked by the visitor; no parent is asked
/// and no age is verified. A child who sends "adult" gets an adult account, and no code
/// here can stop that. What the server does guarantee is narrower: an account is given a
/// tier when it is created, and afterwards only its signed-in owner's explicit answer
/// changes it, by the rules in `auth/age.rs`; an account declared teen cannot lift its own
/// limits.
pub fn age_tier_from(stated: Option<&str>) -> Result<&'static str, ApiError> {
    match stated {
        Some("adult") => Ok("adult"),
        Some("teen") => Ok("teen"),
        _ => Err(ApiError::new(
            axum::http::StatusCode::FORBIDDEN,
            "age_required",
            "Confirm your age before creating an account.",
        )),
    }
}

/// A random public name such as `bard-4f2a9c01d3e7`: 48 random bits, so the space
/// (2.8 x 10^14 names) cannot be used up by sign-ups and a clash is a freak event rather
/// than a certainty after a few thousand accounts. It used to be 24 bits.
pub fn random_username() -> String {
    format!("bard-{:012x}", rand::random::<u64>() & 0x0000_ffff_ffff_ffff)
}

/// A neutral public name that is free right now. Usernames show on the public leaderboard,
/// so they are never derived from an email address.
pub async fn unused_username(conn: &mut sqlx::PgConnection) -> Result<String, ApiError> {
    for _ in 0..10 {
        let candidate = random_username();
        let taken: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
            .bind(&candidate)
            .fetch_one(&mut *conn)
            .await?;
        if !taken {
            return Ok(candidate);
        }
    }
    Err(ApiError::internal("username generation", "no free username after 10 tries"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usernames_carry_48_random_bits_and_fit_the_column() {
        let names: std::collections::HashSet<String> = (0..5000).map(|_| random_username()).collect();
        assert_eq!(names.len(), 5000);
        // The upper 24 of the 48 bits are in use: among 5000 names, some value is above
        // anything the old 24-bit names could hold. (Chance of a false alarm: 2^-120000.)
        let widest = names
            .iter()
            .map(|n| u64::from_str_radix(n.strip_prefix("bard-").expect("prefix"), 16).expect("hex"))
            .max()
            .unwrap();
        assert!(widest > 0x00ff_ffff, "names carry only 24 bits: {widest:#x}");
        assert!(widest <= 0xffff_ffff_ffff);
        for name in names.iter().take(50) {
            let hex = name.strip_prefix("bard-").expect("prefix");
            assert_eq!(hex.len(), 12, "{name}");
            assert!(hex.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()), "{name}");
            assert!(name.len() <= 32, "users.username is VARCHAR(32)");
        }
    }

    #[test]
    fn only_adult_and_consenting_teen_pass_the_age_check() {
        assert_eq!(age_tier_from(Some("adult")).unwrap(), "adult");
        assert_eq!(age_tier_from(Some("teen")).unwrap(), "teen");
        for refused in [None, Some(""), Some("unknown"), Some("blocked"), Some("child"), Some("Adult")] {
            let err = age_tier_from(refused).expect_err("must be refused");
            assert_eq!(err.code, "age_required");
            assert_eq!(err.status, axum::http::StatusCode::FORBIDDEN);
        }
    }
}
