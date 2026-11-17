//! Sessions, kept on the server.
//!
//! The cookie holds a signed token, but the token is only a pointer: every request looks
//! its `auth_sessions` row up, and a row that is revoked, expired or gone means signed out.
//! That is what lets "sign out" and "sign out everywhere" end a session for real, also for
//! a copy of the cookie held somewhere else.
//!
//! A session also remembers when its user last proved who they are (`verified_at`): a
//! user-verified passkey assertion, or an emailed code. The steps that can take an account
//! away from its owner (adding a passkey, removing one, adding a recovery email) need that
//! proof to be a few minutes old at most, so a browser left signed in on a shared computer
//! cannot be used to swap the passkeys.

use axum::http::{header, HeaderMap, StatusCode};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::error::ApiError;
use super::jwt::{create_token, verify_token, Claims, SESSION_DAYS};
use crate::config::Config;

/// How recent the last proof of identity must be for the sensitive steps.
pub const FRESH_AUTH_MINUTES: i64 = 5;

/// How a session's user proved who they are.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Proof {
    /// A passkey assertion with user verification (fingerprint, face, PIN).
    Passkey,
    /// A code sent to the account's email address.
    Email,
}

impl Proof {
    fn as_str(self) -> &'static str {
        match self {
            Proof::Passkey => "passkey",
            Proof::Email => "email",
        }
    }
}

/// A live session: who, which row, and when they last proved it.
#[derive(Clone, Debug)]
pub struct Session {
    pub claims: Claims,
    pub verified_at: DateTime<Utc>,
}

/// Whether a proof made at `verified_at` still counts at `now`.
pub fn is_fresh(verified_at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    let age = now - verified_at;
    // A proof from the future is a clock fault or a tampered row, not a fresh proof.
    age >= Duration::seconds(-5) && age < Duration::minutes(FRESH_AUTH_MINUTES)
}

/// The refusal for a step that needs a fresh proof; the page answers it with a passkey check.
pub fn reauth_required() -> ApiError {
    ApiError::new(StatusCode::FORBIDDEN, "reauth_required", "Confirm it is you with your passkey first.")
}

impl Session {
    /// Refuse unless the user proved who they are in the last few minutes.
    pub fn require_fresh(&self) -> Result<(), ApiError> {
        if is_fresh(self.verified_at, Utc::now()) { Ok(()) } else { Err(reauth_required()) }
    }
}

fn session_cookie(name: &'static str, value: String, max_age: time::Duration) -> Cookie<'static> {
    // SameSite=Strict: the cookie is only ever needed by the page's own requests to /api,
    // so it is never sent on a request another site started. No Domain: host-only.
    Cookie::build((name, value))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(max_age)
        .build()
}

/// Start a session for a user who has just proved who they are, and return its cookie.
pub async fn start(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    username: &str,
    proof: Proof,
) -> Result<CookieJar, ApiError> {
    let session_id: Uuid = sqlx::query_scalar(
        "INSERT INTO auth_sessions (user_id, expires_at, verified_by)
         VALUES ($1, NOW() + make_interval(days => $2), $3) RETURNING id",
    )
    .bind(user_id)
    .bind(SESSION_DAYS as i32)
    .bind(proof.as_str())
    .fetch_one(pool)
    .await?;
    let token = create_token(user_id, username, session_id, &config.jwt_secret)
        .map_err(|e| ApiError::internal("could not create session token", e))?;
    let cookie = session_cookie(config.session_cookie_name(), token, time::Duration::days(SESSION_DAYS));
    Ok(CookieJar::new().add(cookie))
}

/// The claims in the request's session cookie, if it carries a correctly signed token.
/// This says nothing about whether the session is still live.
pub fn claims_from(jar: &CookieJar, config: &Config) -> Option<Claims> {
    // Only the configured name is read. In production that is the `__Host-` cookie, and a
    // plain `im_token` set by another inspiredmile.com host is ignored.
    let token = jar.get(config.session_cookie_name())?;
    verify_token(token.value(), &config.jwt_secret).ok()
}

/// The signed-in user of a request, or `not_signed_in`. Checks the token and then its row.
pub async fn authenticate(pool: &PgPool, config: &Config, jar: &CookieJar) -> Result<Session, ApiError> {
    let claims = claims_from(jar, config).ok_or_else(ApiError::unauthorized)?;
    let row = sqlx::query(
        "SELECT verified_at FROM auth_sessions
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()",
    )
    .bind(claims.sid)
    .bind(claims.sub)
    .fetch_optional(pool)
    .await?
    .ok_or_else(ApiError::unauthorized)?;
    Ok(Session { claims, verified_at: row.get("verified_at") })
}

/// Whether the session a token names is still live: not signed out (here or "everywhere"),
/// not expired, and its user not deleted. The same condition as `authenticate`, for a
/// connection that outlives the request that opened it (the game's WebSocket).
pub async fn is_live(pool: &PgPool, claims: &Claims) -> Result<bool, sqlx::Error> {
    let live: Option<i32> = sqlx::query_scalar(
        "SELECT 1 FROM auth_sessions
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()",
    )
    .bind(claims.sid)
    .bind(claims.sub)
    .fetch_optional(pool)
    .await?;
    Ok(live.is_some())
}

/// Record a new proof of identity on a session.
pub async fn mark_verified(pool: &PgPool, session_id: Uuid, proof: Proof) -> Result<(), ApiError> {
    sqlx::query("UPDATE auth_sessions SET verified_at = NOW(), verified_by = $2 WHERE id = $1")
        .bind(session_id)
        .bind(proof.as_str())
        .execute(pool)
        .await?;
    Ok(())
}

/// End one session.
pub async fn revoke(pool: &PgPool, session_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL")
        .bind(session_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// End every session of a user, except `keep` when one is given. Returns how many ended.
pub async fn revoke_all<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    user_id: Uuid,
    keep: Option<Uuid>,
) -> Result<u64, ApiError> {
    let done = sqlx::query(
        "UPDATE auth_sessions SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL AND id IS DISTINCT FROM $2",
    )
    .bind(user_id)
    .bind(keep)
    .execute(executor)
    .await?;
    Ok(done.rows_affected())
}

/// Cookies that remove the session from the browser: the configured name, and the name
/// used before host-locking, in case one is still there.
pub fn clearing_cookies(config: &Config) -> CookieJar {
    let mut jar = CookieJar::new();
    let mut names = vec![config.session_cookie_name()];
    if !names.contains(&"im_token") {
        names.push("im_token");
    }
    for name in names {
        jar = jar.add(session_cookie(name, String::new(), time::Duration::ZERO));
    }
    jar
}

/// Whether a state-changing request with no JSON body could have been started by another
/// site. A cross-site page can make a browser send a form POST, but it cannot make it send
/// `Content-Type: application/json` (that needs a CORS preflight, which only the site's own
/// origin passes), and browsers label cross-site requests in `Sec-Fetch-Site`.
pub fn is_same_site_json(headers: &HeaderMap) -> bool {
    let json = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap_or("").trim().eq_ignore_ascii_case("application/json"))
        .unwrap_or(false);
    let cross_site = headers
        .get("sec-fetch-site")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.trim().eq_ignore_ascii_case("cross-site"));
    json && !cross_site
}

pub fn cross_site_refused() -> ApiError {
    ApiError::new(
        StatusCode::FORBIDDEN,
        "cross_site_request",
        "This request must come from the site itself.",
    )
}

/// Drop sessions that ended more than a day ago.
pub async fn purge(pool: &PgPool) {
    if let Err(e) = sqlx::query(
        "DELETE FROM auth_sessions
         WHERE expires_at < NOW() - INTERVAL '1 day' OR revoked_at < NOW() - INTERVAL '1 day'",
    )
    .execute(pool)
    .await
    {
        tracing::warn!("could not purge ended sessions: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn a_proof_is_fresh_for_five_minutes() {
        let now = Utc::now();
        assert!(is_fresh(now, now));
        assert!(is_fresh(now - Duration::minutes(4) - Duration::seconds(59), now));
        assert!(!is_fresh(now - Duration::minutes(5), now));
        assert!(!is_fresh(now - Duration::hours(3), now));
        assert!(!is_fresh(now - Duration::days(6), now), "a week-old sign-in is not a fresh proof");
        assert!(!is_fresh(now + Duration::minutes(1), now), "nor is one from the future");
        assert_eq!(FRESH_AUTH_MINUTES, 5);
    }

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (k, v) in pairs {
            map.insert(*k, HeaderValue::from_static(v));
        }
        map
    }

    #[test]
    fn a_form_post_from_another_site_is_told_apart_from_the_page() {
        // What the site's own fetch sends.
        assert!(is_same_site_json(&headers(&[("content-type", "application/json")])));
        assert!(is_same_site_json(&headers(&[
            ("content-type", "application/json; charset=utf-8"),
            ("sec-fetch-site", "same-origin"),
        ])));
        // What a form on another site can send.
        assert!(!is_same_site_json(&headers(&[])));
        assert!(!is_same_site_json(&headers(&[("content-type", "application/x-www-form-urlencoded")])));
        assert!(!is_same_site_json(&headers(&[("content-type", "text/plain")])));
        assert!(!is_same_site_json(&headers(&[("content-type", "multipart/form-data; boundary=x")])));
        // And a cross-site request is refused even if it somehow carries the JSON type.
        assert!(!is_same_site_json(&headers(&[
            ("content-type", "application/json"),
            ("sec-fetch-site", "cross-site"),
        ])));
    }
}
