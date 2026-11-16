//! Email one-time codes. Email is optional: an account can live on passkeys alone.
//!
//! Two uses, kept apart by `purpose`:
//!   - `login`: sign in by email, creating the account if the address is new; also the way
//!     back in for someone who lost their passkeys.
//!   - `add`: a signed-in account proves it owns an address before the address is stored
//!     as its recovery email.
//!
//! Nothing here says whether an address already has an account until the caller has
//! proved, with the code, that the address is theirs.

use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use super::client_ip::client_ip;
use super::email_code::{
    check_code, check_rate, expiry_from, generate_code, hash_code, normalize_email, CodeCheck,
    CodeRecord, RateLimit, CODE_TTL_MINUTES, EMAIL_WINDOW_MINUTES, IP_WINDOW_MINUTES,
};
use super::error::ApiError;
use super::handlers::{
    age_tier_from, passkey_count, row_to_user, session, session_cookie, unused_username,
    AuthContext, AuthResponse, Ctx,
};
use super::mailer::send_code;
use crate::config::Config;

const LOGIN: &str = "login";
const ADD: &str = "add";

#[derive(Deserialize)]
pub struct RequestCodeBody {
    email: String,
    /// The age gate's answer: "adult" or "teen". Anything else, or nothing, is refused,
    /// so an address from a visitor of unknown age or under 13 is never stored or mailed.
    #[serde(default)]
    age_tier: Option<String>,
}

#[derive(Deserialize)]
pub struct AddEmailBody {
    email: String,
}

#[derive(Serialize)]
pub struct RequestCodeResponse {
    ok: bool,
    expires_in_seconds: i64,
}

#[derive(Deserialize)]
pub struct VerifyCodeBody {
    email: String,
    code: String,
}

fn unavailable() -> ApiError {
    ApiError::new(
        StatusCode::SERVICE_UNAVAILABLE,
        "email_sign_in_unavailable",
        "Email is not available yet.",
    )
}

fn invalid_code() -> ApiError {
    // One answer for wrong, expired, used, exhausted and never-issued alike.
    ApiError::new(
        StatusCode::UNAUTHORIZED,
        "invalid_code",
        "That code is not valid. Check it, or ask for a new one.",
    )
}

fn sent() -> Json<RequestCodeResponse> {
    Json(RequestCodeResponse { ok: true, expires_in_seconds: CODE_TTL_MINUTES * 60 })
}

/// Apply the request limits, then issue and send a code. Only the newest code for an
/// address and purpose is live.
#[allow(clippy::too_many_arguments)]
async fn issue_code(
    pool: &PgPool,
    config: &Config,
    ctx: &AuthContext,
    email: &str,
    ip: &str,
    age_tier: &str,
    purpose: &str,
    user_id: Option<Uuid>,
) -> Result<(), ApiError> {
    // The limits count every code, whatever it was for.
    let recent_for_email: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE email = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(email)
    .bind(EMAIL_WINDOW_MINUTES as i32)
    .fetch_one(pool)
    .await?;
    let recent_for_ip: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE ip = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(ip)
    .bind(IP_WINDOW_MINUTES as i32)
    .fetch_one(pool)
    .await?;

    match check_rate(recent_for_email, recent_for_ip) {
        RateLimit::Allowed => {}
        RateLimit::EmailLimited | RateLimit::IpLimited => {
            return Err(ApiError::new(
                StatusCode::TOO_MANY_REQUESTS,
                "too_many_requests",
                "Too many codes requested. Wait a few minutes and try again.",
            ));
        }
    }

    let code = generate_code();
    let now = Utc::now();

    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE email_login_codes SET consumed_at = $3
         WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL",
    )
    .bind(email)
    .bind(purpose)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    let code_id: Uuid = sqlx::query_scalar(
        "INSERT INTO email_login_codes
             (email, code_hash, ip, age_tier, purpose, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(email)
    .bind(hash_code(&config.jwt_secret, email, &code))
    .bind(ip)
    .bind(age_tier)
    .bind(purpose)
    .bind(user_id)
    .bind(now)
    .bind(expiry_from(now))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    if let Err(e) = send_code(&ctx.http, config, email, &code).await {
        tracing::error!("code email was not sent: {e}");
        // The code can never arrive, so it must not stay live.
        sqlx::query("UPDATE email_login_codes SET consumed_at = NOW() WHERE id = $1")
            .bind(code_id)
            .execute(pool)
            .await?;
        return Err(ApiError::new(
            StatusCode::BAD_GATEWAY,
            "email_send_failed",
            "We could not send the email. Please try again in a moment.",
        ));
    }
    Ok(())
}

/// Judge a submitted code against the newest one issued for this address, purpose and
/// (for `add`) account. `Some(age_tier)` means accepted and now used up; `None` means
/// refused, with the miss counted. The caller commits either way.
///
/// The row lock makes "check, then mark used or count the miss" atomic: two requests
/// racing with the same code cannot both be accepted.
async fn redeem_code(
    tx: &mut Transaction<'_, Postgres>,
    secret: &str,
    email: &str,
    submitted: &str,
    purpose: &str,
    user_id: Option<Uuid>,
) -> Result<Option<String>, ApiError> {
    let now = Utc::now();
    let Some(row) = sqlx::query(
        "SELECT id, code_hash, age_tier, attempts, expires_at, consumed_at
         FROM email_login_codes
         WHERE email = $1 AND purpose = $2 AND user_id IS NOT DISTINCT FROM $3
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(email)
    .bind(purpose)
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(None);
    };

    let code_id: Uuid = row.get("id");
    let record = CodeRecord {
        code_hash: row.get::<String, _>("code_hash"),
        attempts: row.get("attempts"),
        expires_at: row.get("expires_at"),
        consumed_at: row.get("consumed_at"),
    };

    match check_code(&record, secret, email, submitted, now) {
        CodeCheck::Accepted => {
            sqlx::query("UPDATE email_login_codes SET consumed_at = $2 WHERE id = $1")
                .bind(code_id)
                .bind(now)
                .execute(&mut **tx)
                .await?;
            Ok(Some(row.get("age_tier")))
        }
        CodeCheck::Wrong => {
            sqlx::query("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = $1")
                .bind(code_id)
                .execute(&mut **tx)
                .await?;
            Ok(None)
        }
        CodeCheck::Expired | CodeCheck::Consumed | CodeCheck::TooManyAttempts => Ok(None),
    }
}

// ---------------------------------------------------------------------------
// Sign in (or sign up) by email
// ---------------------------------------------------------------------------

pub async fn request_code(
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<RequestCodeBody>,
) -> Result<Json<RequestCodeResponse>, ApiError> {
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let age_tier = age_tier_from(body.age_tier.as_deref())?;
    let email = normalize_email(&body.email)
        .ok_or_else(|| ApiError::bad_request("invalid_email", "Enter a valid email address."))?;
    let ip = client_ip(&headers, Some(peer));
    issue_code(&pool, &config, &ctx, &email, &ip, age_tier, LOGIN, None).await?;
    Ok(sent())
}

pub async fn verify_code(
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<VerifyCodeBody>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let email = normalize_email(&body.email).ok_or_else(invalid_code)?;

    let mut tx = pool.begin().await?;
    let Some(age_tier) =
        redeem_code(&mut tx, &config.jwt_secret, &email, body.code.trim(), LOGIN, None).await?
    else {
        tx.commit().await?;
        return Err(invalid_code());
    };
    let (user_row, is_new_user) = find_or_create_user(&mut tx, &email, &age_tier).await?;
    tx.commit().await?;

    let user = row_to_user(&user_row);
    let jar = session_cookie(user.id, &user.username, &config)?;
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok((
        jar,
        Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: Some(is_new_user) }),
    ))
}

/// The account for a verified address, made on first sign-in. Accounts created through
/// Google keep working: they are matched by their stored email, whatever its case.
async fn find_or_create_user(
    tx: &mut Transaction<'_, Postgres>,
    email: &str,
    age_tier: &str,
) -> Result<(sqlx::postgres::PgRow, bool), ApiError> {
    let existing = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url
         FROM users WHERE lower(email) = $1 ORDER BY created_at ASC LIMIT 1",
    )
    .bind(email)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(row) = existing {
        return Ok((row, false));
    }

    let username = unused_username(&mut **tx).await?;
    let row = sqlx::query(
        "INSERT INTO users (username, email, auth_provider, age_tier)
         VALUES ($1, $2, 'email', $3)
         RETURNING id, username, email, display_name, auth_provider, avatar_url",
    )
    .bind(&username)
    .bind(email)
    .bind(age_tier)
    .fetch_one(&mut **tx)
    .await?;

    let user_id: Uuid = row.get("id");
    sqlx::query("INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(&mut **tx)
        .await?;

    Ok((row, true))
}

// ---------------------------------------------------------------------------
// Add a recovery email to a signed-in account
// ---------------------------------------------------------------------------

pub async fn add_request(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<AddEmailBody>,
) -> Result<Json<RequestCodeResponse>, ApiError> {
    let claims = session(&jar, &config)?;
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let row = sqlx::query("SELECT email, age_tier FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
    if row.get::<Option<String>, _>("email").is_some() {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "email_already_set",
            "This account already has an email address.",
        ));
    }
    // The tier the account was created under; an account of unknown age gives no address.
    let stored_tier: String = row.get("age_tier");
    let age_tier = age_tier_from(Some(stored_tier.as_str()))?;
    let email = normalize_email(&body.email)
        .ok_or_else(|| ApiError::bad_request("invalid_email", "Enter a valid email address."))?;
    let ip = client_ip(&headers, Some(peer));
    // Sent whether or not the address is already someone's: that is only said at verify,
    // to a caller who has shown the mailbox is theirs.
    issue_code(&pool, &config, &ctx, &email, &ip, age_tier, ADD, Some(claims.sub)).await?;
    Ok(sent())
}

pub async fn add_verify(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<VerifyCodeBody>,
) -> Result<Json<AuthResponse>, ApiError> {
    let claims = session(&jar, &config)?;
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let email = normalize_email(&body.email).ok_or_else(invalid_code)?;

    let mut tx = pool.begin().await?;
    if redeem_code(&mut tx, &config.jwt_secret, &email, body.code.trim(), ADD, Some(claims.sub))
        .await?
        .is_none()
    {
        tx.commit().await?;
        return Err(invalid_code());
    }

    let taken: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = $1)")
            .bind(&email)
            .fetch_one(&mut *tx)
            .await?;
    if taken {
        tx.commit().await?;
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "email_in_use",
            "That address already belongs to another account. Sign in with it instead.",
        ));
    }
    let row = sqlx::query(
        "UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1 AND email IS NULL
         RETURNING id, username, email, display_name, auth_provider, avatar_url",
    )
    .bind(claims.sub)
    .bind(&email)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ApiError::new(
            StatusCode::CONFLICT,
            "email_already_set",
            "This account already has an email address.",
        )
    })?;
    tx.commit().await?;

    let user = row_to_user(&row);
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok(Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: None }))
}
