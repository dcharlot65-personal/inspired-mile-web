//! Email one-time-code sign-in: creates an account, signs in where there is no passkey,
//! and recovers an account.
//!
//! Nothing here says whether an address already has an account: a code is issued to any
//! well-formed address, and the account is created when the code comes back.

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
use super::handlers::{passkey_count, row_to_user, session_cookie, AuthResponse, Ctx};
use super::mailer::send_code;
use crate::config::Config;

#[derive(Deserialize)]
pub struct RequestCodeBody {
    email: String,
    /// The age gate's answer: "adult" or "teen". Anything else, or nothing, is refused,
    /// so an address from a visitor of unknown age or under 13 is never stored or mailed.
    #[serde(default)]
    age_tier: Option<String>,
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
        "Email sign-in is not available yet.",
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

    let age_tier = match body.age_tier.as_deref() {
        Some(tier @ ("adult" | "teen")) => tier,
        _ => {
            return Err(ApiError::new(
                StatusCode::FORBIDDEN,
                "age_required",
                "Confirm your age before signing in with email.",
            ));
        }
    };

    let email = normalize_email(&body.email)
        .ok_or_else(|| ApiError::bad_request("invalid_email", "Enter a valid email address."))?;
    let ip = client_ip(&headers, Some(peer));

    let recent_for_email: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE email = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(&email)
    .bind(EMAIL_WINDOW_MINUTES as i32)
    .fetch_one(&pool)
    .await?;
    let recent_for_ip: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE ip = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(&ip)
    .bind(IP_WINDOW_MINUTES as i32)
    .fetch_one(&pool)
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

    // Only the newest code for an address is live.
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE email_login_codes SET consumed_at = $2 WHERE email = $1 AND consumed_at IS NULL")
        .bind(&email)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    let code_id: Uuid = sqlx::query_scalar(
        "INSERT INTO email_login_codes (email, code_hash, ip, age_tier, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(&email)
    .bind(hash_code(&config.jwt_secret, &email, &code))
    .bind(&ip)
    .bind(age_tier)
    .bind(now)
    .bind(expiry_from(now))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    if let Err(e) = send_code(&ctx.http, &config, &email, &code).await {
        tracing::error!("sign-in email was not sent: {e}");
        // The code can never arrive, so it must not stay live.
        sqlx::query("UPDATE email_login_codes SET consumed_at = NOW() WHERE id = $1")
            .bind(code_id)
            .execute(&pool)
            .await?;
        return Err(ApiError::new(
            StatusCode::BAD_GATEWAY,
            "email_send_failed",
            "We could not send the email. Please try again in a moment.",
        ));
    }

    Ok(Json(RequestCodeResponse { ok: true, expires_in_seconds: CODE_TTL_MINUTES * 60 }))
}

pub async fn verify_code(
    State((pool, config)): State<(PgPool, Config)>,
    Json(body): Json<VerifyCodeBody>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let email = normalize_email(&body.email).ok_or_else(invalid_code)?;
    let submitted = body.code.trim();
    let now = Utc::now();

    // The row lock makes "check, then mark used or count the miss" atomic: two requests
    // racing with the same code cannot both be accepted.
    let mut tx = pool.begin().await?;
    let Some(row) = sqlx::query(
        "SELECT id, code_hash, age_tier, attempts, expires_at, consumed_at
         FROM email_login_codes WHERE email = $1
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(&email)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Err(invalid_code());
    };

    let code_id: Uuid = row.get("id");
    let record = CodeRecord {
        code_hash: row.get::<String, _>("code_hash"),
        attempts: row.get("attempts"),
        expires_at: row.get("expires_at"),
        consumed_at: row.get("consumed_at"),
    };

    match check_code(&record, &config.jwt_secret, &email, submitted, now) {
        CodeCheck::Accepted => {}
        CodeCheck::Wrong => {
            sqlx::query("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = $1")
                .bind(code_id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return Err(invalid_code());
        }
        CodeCheck::Expired | CodeCheck::Consumed | CodeCheck::TooManyAttempts => {
            return Err(invalid_code());
        }
    }

    sqlx::query("UPDATE email_login_codes SET consumed_at = $2 WHERE id = $1")
        .bind(code_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

    let age_tier: String = row.get("age_tier");
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

    let username = unused_username(tx).await?;
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

/// A neutral public name such as `bard-4f2a9c`. Usernames show on the public leaderboard,
/// so they are not derived from the email address.
async fn unused_username(tx: &mut Transaction<'_, Postgres>) -> Result<String, ApiError> {
    for _ in 0..10 {
        let candidate = format!("bard-{:06x}", rand::random::<u32>() & 0x00ff_ffff);
        let taken: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
            .bind(&candidate)
            .fetch_one(&mut **tx)
            .await?;
        if !taken {
            return Ok(candidate);
        }
    }
    Err(ApiError::internal("username generation", "no free username after 10 tries"))
}
