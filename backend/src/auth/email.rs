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
//!
//! The limits, and why one visitor cannot turn them on another, are described at the top
//! of `email_code.rs`.
//!
//! KNOWN GAP, on purpose (2026-11-16): accounts that exist only by email. An account made
//! through the old Google or password sign-in has no passkey; the only way into it is a
//! code sent to its stored address (`find_or_create_user` matches it there). While the
//! server has no mail key (`EmailMode::Disabled`, which is how production runs today)
//! these endpoints answer 503 and such an account CANNOT BE SIGNED IN TO AT ALL; a passkey
//! sign-up by its owner makes a second, empty account, and nothing merges the two.
//! Production had no users when this was written, so no migration was built. The sign-in
//! panel says so instead of hiding it (`legacyAccountNote` in BaseLayout.astro). Before
//! relying on this, count them:
//!   SELECT COUNT(*) FROM users u WHERE NOT EXISTS
//!     (SELECT 1 FROM webauthn_credentials c WHERE c.user_id = u.id);
//! If that is ever above zero, turn email on (RESEND_API_KEY) before anything else.

use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use super::client_ip::client_addr;
use super::email_code::{
    check_code, check_rate, expiry_from, generate_code, guessing_allowed, hash_code,
    hash_requester, is_requester_token, new_requester_token, normalize_email, CodeCheck,
    CodeRecord, RateLimit, CODE_TTL_MINUTES, EMAIL_WINDOW_MINUTES, FAILURE_WINDOW_HOURS,
    IP_WINDOW_MINUTES, REQUESTER_COOKIE_MINUTES,
};
use super::error::ApiError;
use super::handlers::{
    age_tier_from, passkey_count, row_to_user, session, unused_username, AuthContext,
    AuthResponse, Ctx,
};
use super::mailer::{send_code, ADD, LOGIN};
use super::sessions::{self, Proof};
use crate::config::Config;

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

fn too_many_attempts() -> ApiError {
    // Said for any address, with or without an account: it reveals nothing.
    ApiError::new(
        StatusCode::TOO_MANY_REQUESTS,
        "too_many_attempts",
        "Too many wrong codes for this address. Try again tomorrow, or sign in with a passkey.",
    )
}

fn sent() -> Json<RequestCodeResponse> {
    Json(RequestCodeResponse { ok: true, expires_in_seconds: CODE_TTL_MINUTES * 60 })
}

/// The browser asking for, or submitting, a code: the value of its requester cookie.
fn requester_token(jar: &CookieJar, config: &Config) -> Option<String> {
    jar.get(config.code_cookie_name())
        .map(|c| c.value().to_string())
        .filter(|v| is_requester_token(v))
}

/// The requester cookie for a browser that asks for a code: the one it has, or a new one.
/// Random, short-lived, HttpOnly; it identifies nothing but "the browser that asked".
fn requester_cookie(jar: &CookieJar, config: &Config) -> (String, CookieJar) {
    let token = requester_token(jar, config).unwrap_or_else(new_requester_token);
    let cookie = Cookie::build((config.code_cookie_name(), token.clone()))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::minutes(REQUESTER_COOKIE_MINUTES))
        .build();
    (token, CookieJar::new().add(cookie))
}

/// Wrong guesses at this address's codes in the window: by this network, and by everyone.
async fn failures<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    email: &str,
    net_key: &str,
) -> Result<(i64, i64), ApiError> {
    let row = sqlx::query(
        "SELECT COUNT(*) FILTER (WHERE net_key = $2) AS by_network, COUNT(*) AS by_everyone
         FROM email_code_failures
         WHERE email = $1 AND created_at > NOW() - make_interval(hours => $3)",
    )
    .bind(email)
    .bind(net_key)
    .bind(FAILURE_WINDOW_HOURS as i32)
    .fetch_one(executor)
    .await?;
    Ok((row.get("by_network"), row.get("by_everyone")))
}

/// Apply the request limits, then issue and send a code. For one browser, only its newest
/// code for an address and purpose is live; codes other browsers asked for are untouched.
#[allow(clippy::too_many_arguments)]
async fn issue_code(
    pool: &PgPool,
    config: &Config,
    ctx: &AuthContext,
    email: &str,
    ip: &str,
    requester: &str,
    age_tier: &str,
    purpose: &str,
    user_id: Option<Uuid>,
) -> Result<(), ApiError> {
    // No mail for a code that could not be redeemed anyway.
    let (failed_by_network, failed_by_everyone) = failures(pool, email, ip).await?;
    if !guessing_allowed(failed_by_network, failed_by_everyone) {
        return Err(too_many_attempts());
    }

    // The limits count every code, whatever it was for. This network's own allowance for
    // the address is separate from everyone's, so a stranger asking for codes to this
    // address does not use it up.
    let recent_for_email: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE email = $1 AND ip = $2 AND created_at > NOW() - make_interval(mins => $3)",
    )
    .bind(email)
    .bind(ip)
    .bind(EMAIL_WINDOW_MINUTES as i32)
    .fetch_one(pool)
    .await?;
    let recent_for_email_all: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM email_login_codes
         WHERE email = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(email)
    .bind(IP_WINDOW_MINUTES as i32)
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

    match check_rate(recent_for_email, recent_for_email_all, recent_for_ip) {
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
    // Only this browser's earlier codes are withdrawn. It used to be every live code for
    // the address, which let anyone kill a code somebody else was about to type in.
    sqlx::query(
        "UPDATE email_login_codes SET consumed_at = $3
         WHERE email = $1 AND purpose = $2 AND requester = $4 AND consumed_at IS NULL",
    )
    .bind(email)
    .bind(purpose)
    .bind(now)
    .bind(requester)
    .execute(&mut *tx)
    .await?;
    let code_id: Uuid = sqlx::query_scalar(
        "INSERT INTO email_login_codes
             (email, code_hash, ip, age_tier, purpose, user_id, created_at, expires_at, requester)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(email)
    .bind(hash_code(&config.email_code_key, email, &code))
    .bind(ip)
    .bind(age_tier)
    .bind(purpose)
    .bind(user_id)
    .bind(now)
    .bind(expiry_from(now))
    .bind(requester)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    if let Err(e) = send_code(&ctx.http, config, email, &code, purpose).await {
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

/// What became of a submitted code.
enum Redeemed {
    /// Right code, in time, first use; it is now used up. Carries the code's age tier.
    Accepted(String),
    /// Refused. If it was a real wrong guess at a live code, the miss has been counted.
    Refused,
    /// Too many wrong guesses at this address already: not even judged.
    Locked,
}

/// Judge a submitted code against the newest one that THIS browser (`requester`) asked for,
/// for this address, purpose and (for `add`) account. The caller commits whatever comes back.
///
/// A lock on the address makes "count the misses, check, then mark used or count a miss"
/// atomic: two requests racing with the same code cannot both be accepted, and a burst of
/// parallel guesses cannot slip past the caps.
#[allow(clippy::too_many_arguments)]
async fn redeem_code(
    tx: &mut Transaction<'_, Postgres>,
    key: &str,
    email: &str,
    submitted: &str,
    purpose: &str,
    user_id: Option<Uuid>,
    requester: Option<&str>,
    net_key: &str,
) -> Result<Redeemed, ApiError> {
    let now = Utc::now();
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('email-code:' || $1, 0))")
        .bind(email)
        .execute(&mut **tx)
        .await?;

    let (failed_by_network, failed_by_everyone) = failures(&mut **tx, email, net_key).await?;
    if !guessing_allowed(failed_by_network, failed_by_everyone) {
        return Ok(Redeemed::Locked);
    }

    // A browser that never asked for a code has none to guess at.
    let Some(requester) = requester else {
        return Ok(Redeemed::Refused);
    };
    let Some(row) = sqlx::query(
        "SELECT id, code_hash, age_tier, attempts, expires_at, consumed_at
         FROM email_login_codes
         WHERE email = $1 AND purpose = $2 AND user_id IS NOT DISTINCT FROM $3 AND requester = $4
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(email)
    .bind(purpose)
    .bind(user_id)
    .bind(requester)
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(Redeemed::Refused);
    };

    let code_id: Uuid = row.get("id");
    let record = CodeRecord {
        code_hash: row.get::<String, _>("code_hash"),
        attempts: row.get("attempts"),
        expires_at: row.get("expires_at"),
        consumed_at: row.get("consumed_at"),
    };

    match check_code(&record, key, email, submitted, now) {
        CodeCheck::Accepted => {
            sqlx::query("UPDATE email_login_codes SET consumed_at = $2 WHERE id = $1")
                .bind(code_id)
                .bind(now)
                .execute(&mut **tx)
                .await?;
            Ok(Redeemed::Accepted(row.get("age_tier")))
        }
        CodeCheck::Wrong => {
            sqlx::query("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = $1")
                .bind(code_id)
                .execute(&mut **tx)
                .await?;
            // A real guess at a live code: it counts towards the daily caps for the address.
            sqlx::query("INSERT INTO email_code_failures (email, net_key) VALUES ($1, $2)")
                .bind(email)
                .bind(net_key)
                .execute(&mut **tx)
                .await?;
            Ok(Redeemed::Refused)
        }
        // A dead code cannot be guessed right, so a try at one is not a guess.
        CodeCheck::Expired | CodeCheck::Consumed | CodeCheck::TooManyAttempts => Ok(Redeemed::Refused),
    }
}

// ---------------------------------------------------------------------------
// Sign in (or sign up) by email
// ---------------------------------------------------------------------------

pub async fn request_code(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<RequestCodeBody>,
) -> Result<(CookieJar, Json<RequestCodeResponse>), ApiError> {
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let age_tier = age_tier_from(body.age_tier.as_deref())?;
    let email = normalize_email(&body.email)
        .ok_or_else(|| ApiError::bad_request("invalid_email", "Enter a valid email address."))?;
    let ip = client_addr(&headers, Some(peer), &config.trusted_proxies).limit_key();
    let (token, cookies) = requester_cookie(&jar, &config);
    let requester = hash_requester(&config.email_code_key, &token);
    issue_code(&pool, &config, &ctx, &email, &ip, &requester, age_tier, LOGIN, None).await?;
    Ok((cookies, sent()))
}

pub async fn verify_code(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<VerifyCodeBody>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let email = normalize_email(&body.email).ok_or_else(invalid_code)?;
    let net_key = client_addr(&headers, Some(peer), &config.trusted_proxies).limit_key();
    let requester = requester_token(&jar, &config).map(|t| hash_requester(&config.email_code_key, &t));

    let mut tx = pool.begin().await?;
    let redeemed = redeem_code(
        &mut tx,
        &config.email_code_key,
        &email,
        body.code.trim(),
        LOGIN,
        None,
        requester.as_deref(),
        &net_key,
    )
    .await?;
    let age_tier = match redeemed {
        Redeemed::Accepted(age_tier) => age_tier,
        Redeemed::Refused => {
            tx.commit().await?;
            return Err(invalid_code());
        }
        Redeemed::Locked => return Err(too_many_attempts()),
    };
    let (user_row, is_new_user) = find_or_create_user(&mut tx, &email, &age_tier).await?;
    tx.commit().await?;

    let user = row_to_user(&user_row);
    // A code that came back from the mailbox is a fresh proof: the session starts fresh.
    let jar = sessions::start(&pool, &config, user.id, &user.username, Proof::Email).await?;
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok((
        jar,
        Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: Some(is_new_user) }),
    ))
}

/// The account for a verified address, made on first sign-in. Accounts created through
/// Google are matched by their stored email, whatever its case: this is their ONLY way in
/// (see the note on accounts that exist only by email at the top of this file).
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
) -> Result<(CookieJar, Json<RequestCodeResponse>), ApiError> {
    let session = session(&jar, &pool, &config).await?;
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    // A recovery email is a way into the account. Whoever sits down at a browser left
    // signed in must not be able to add their own: the owner has to have proved, in the
    // last few minutes, that it is them. (Confirming the code afterwards needs only the
    // session: the code itself is bound to this account and this browser.)
    session.require_fresh()?;
    let claims = session.claims;
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
    let ip = client_addr(&headers, Some(peer), &config.trusted_proxies).limit_key();
    let (token, cookies) = requester_cookie(&jar, &config);
    let requester = hash_requester(&config.email_code_key, &token);
    // Sent whether or not the address is already someone's: that is only said at verify,
    // to a caller who has shown the mailbox is theirs.
    issue_code(&pool, &config, &ctx, &email, &ip, &requester, age_tier, ADD, Some(claims.sub)).await?;
    Ok((cookies, sent()))
}

pub async fn add_verify(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<VerifyCodeBody>,
) -> Result<Json<AuthResponse>, ApiError> {
    let claims = session(&jar, &pool, &config).await?.claims;
    if !config.email_mode.is_available() {
        return Err(unavailable());
    }
    let email = normalize_email(&body.email).ok_or_else(invalid_code)?;
    let net_key = client_addr(&headers, Some(peer), &config.trusted_proxies).limit_key();
    let requester = requester_token(&jar, &config).map(|t| hash_requester(&config.email_code_key, &t));

    let mut tx = pool.begin().await?;
    let redeemed = redeem_code(
        &mut tx,
        &config.email_code_key,
        &email,
        body.code.trim(),
        ADD,
        Some(claims.sub),
        requester.as_deref(),
        &net_key,
    )
    .await?;
    match redeemed {
        Redeemed::Accepted(_) => {}
        Redeemed::Refused => {
            tx.commit().await?;
            return Err(invalid_code());
        }
        Redeemed::Locked => return Err(too_many_attempts()),
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
    // The owner has just read a code from that mailbox: a fresh proof for this session.
    sessions::mark_verified(&pool, claims.sid, Proof::Email).await?;

    let user = row_to_user(&row);
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok(Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: None }))
}
