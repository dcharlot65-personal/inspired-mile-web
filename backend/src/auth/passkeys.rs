//! Passkeys (WebAuthn discoverable credentials): the primary way to sign in.
//!
//! Sign-up needs nothing but a passkey: no email, no personal data. The account-to-be
//! waits in the challenge and reaches `users` only when the passkey verifies.
//! Registration needs a session (you add a passkey to an account you are already in).
//! Sign-in needs nothing: the authenticator names the account through the user handle.
//! Ceremony state lives in `auth_challenges`, is taken out on first use and expires fast.

use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::types::Json as Db;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use webauthn_rs::prelude::{
    DiscoverableAuthentication, Passkey, PasskeyRegistration, PublicKeyCredential,
    RegisterPublicKeyCredential,
};

use super::client_ip::client_ip;
use super::error::ApiError;
use super::handlers::{
    age_tier_from, passkey_count, row_to_user, session, session_cookie, unused_username,
    AuthResponse, Ctx,
};
use crate::config::Config;

/// How long a begun ceremony may take to finish. Matches the WebAuthn timeout webauthn-rs
/// puts in the options (five minutes).
const CHALLENGE_TTL_MINUTES: i64 = 5;
/// A sane ceiling on passkeys per account.
const MAX_PASSKEYS_PER_USER: i64 = 20;
/// Passkey sign-ups one client address may begin inside `SIGNUP_WINDOW_MINUTES`. Roomy
/// enough for a class signing up from one school address, small enough to blunt a script.
pub const MAX_SIGNUPS_PER_IP: i64 = 40;
pub const SIGNUP_WINDOW_MINUTES: i64 = 60;

/// Whether an address that has begun `recent` sign-ups in the window may begin another.
pub fn signup_allowed(recent: i64) -> bool {
    recent < MAX_SIGNUPS_PER_IP
}

#[derive(Deserialize)]
pub struct SignupBeginBody {
    /// The age gate's answer: "adult" or "teen". Required, as for email.
    #[serde(default)]
    age_tier: Option<String>,
}

/// The account a sign-up will create, held in the challenge until the passkey verifies.
#[derive(Serialize, Deserialize)]
struct PendingSignup {
    user_id: Uuid,
    username: String,
    age_tier: String,
    registration: PasskeyRegistration,
}

#[derive(Serialize)]
pub struct BeginResponse {
    challenge_id: Uuid,
    /// `PublicKeyCredentialCreationOptions` / `...RequestOptions` in the WebAuthn JSON form.
    options: Value,
}

#[derive(Deserialize)]
pub struct RegisterFinishBody {
    challenge_id: Uuid,
    credential: RegisterPublicKeyCredential,
    /// A label the user will recognise, such as "Chrome on macOS".
    #[serde(default)]
    name: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginFinishBody {
    challenge_id: Uuid,
    credential: PublicKeyCredential,
}

#[derive(Serialize)]
pub struct PasskeyInfo {
    id: Uuid,
    name: String,
    created_at: DateTime<Utc>,
    last_used_at: Option<DateTime<Utc>>,
}

fn passkey_failed() -> ApiError {
    // One answer for every way a sign-in assertion can fail.
    ApiError::new(
        StatusCode::UNAUTHORIZED,
        "passkey_not_accepted",
        "That passkey was not accepted.",
    )
}

fn challenge_gone() -> ApiError {
    ApiError::bad_request(
        "challenge_expired",
        "That took too long, or was already used. Please start again.",
    )
}

/// Labels come from the client: keep them short and printable.
pub fn clean_passkey_name(raw: Option<&str>) -> String {
    let cleaned: String = raw
        .unwrap_or("")
        .chars()
        .map(|c| if c.is_whitespace() { ' ' } else { c })
        .filter(|c| !c.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(64)
        .collect();
    if cleaned.is_empty() { "Passkey".to_string() } else { cleaned }
}

/// Ask the authenticator for a discoverable credential ("resident key").
///
/// webauthn-rs' passkey registration leaves discoverability to the authenticator
/// (`requireResidentKey: false`), which suits passkeys used after a username. Sign-in here
/// has no username step, so a credential the authenticator cannot find by itself would be
/// useless: require one.
pub fn require_discoverable(options: &mut Value) {
    let selection = &mut options["authenticatorSelection"];
    if !selection.is_object() {
        *selection = json!({});
    }
    selection["residentKey"] = json!("required");
    selection["requireResidentKey"] = json!(true);
    if selection.get("userVerification").is_none() {
        selection["userVerification"] = json!("required");
    }
}

async fn store_challenge(
    pool: &PgPool,
    kind: &str,
    user_id: Option<Uuid>,
    state: Value,
) -> Result<Uuid, ApiError> {
    Ok(sqlx::query_scalar(
        "INSERT INTO auth_challenges (kind, user_id, state, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(kind)
    .bind(user_id)
    .bind(Db(state))
    .bind(Utc::now() + Duration::minutes(CHALLENGE_TTL_MINUTES))
    .fetch_one(pool)
    .await?)
}

/// Take a challenge out of the table. Deleting it as it is read is what makes it single
/// use: a replayed finish finds nothing.
async fn take_challenge(
    pool: &PgPool,
    id: Uuid,
    kind: &str,
) -> Result<(Option<Uuid>, Value), ApiError> {
    let row = sqlx::query(
        "DELETE FROM auth_challenges WHERE id = $1 AND kind = $2
         RETURNING user_id, state, expires_at",
    )
    .bind(id)
    .bind(kind)
    .fetch_optional(pool)
    .await?
    .ok_or_else(challenge_gone)?;
    let expires_at: DateTime<Utc> = row.get("expires_at");
    if Utc::now() >= expires_at {
        return Err(challenge_gone());
    }
    let Db(state): Db<Value> = row.get("state");
    Ok((row.get("user_id"), state))
}

// ---------------------------------------------------------------------------
// Sign-up (a visitor creates an account with a passkey and nothing else)
// ---------------------------------------------------------------------------

pub async fn signup_begin(
    State((pool, _)): State<(PgPool, Config)>,
    ctx: Ctx,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<SignupBeginBody>,
) -> Result<Json<BeginResponse>, ApiError> {
    let age_tier = age_tier_from(body.age_tier.as_deref())?;

    let ip = client_ip(&headers, Some(peer));
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM signup_attempts
         WHERE ip = $1 AND created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(&ip)
    .bind(SIGNUP_WINDOW_MINUTES as i32)
    .fetch_one(&pool)
    .await?;
    if !signup_allowed(recent) {
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "too_many_requests",
            "Too many accounts started from this network. Wait a while and try again.",
        ));
    }
    sqlx::query("INSERT INTO signup_attempts (ip) VALUES ($1)")
        .bind(&ip)
        .execute(&pool)
        .await?;

    // A fresh random user handle and a generated name. Neither says anything about the
    // person, and nothing is written to `users` here.
    let user_id = Uuid::new_v4();
    let username = {
        let mut conn = pool.acquire().await?;
        unused_username(&mut conn).await?
    };
    let (challenge, registration) = ctx
        .webauthn
        .start_passkey_registration(user_id, &username, &username, None)
        .map_err(|e| ApiError::internal("start_passkey_registration", e))?;

    let mut options = serde_json::to_value(&challenge.public_key)
        .map_err(|e| ApiError::internal("serialise registration options", e))?;
    require_discoverable(&mut options);

    let pending = PendingSignup { user_id, username, age_tier: age_tier.to_string(), registration };
    let state = serde_json::to_value(&pending)
        .map_err(|e| ApiError::internal("serialise sign-up state", e))?;
    let challenge_id = store_challenge(&pool, "signup", None, state).await?;
    Ok(Json(BeginResponse { challenge_id, options }))
}

pub async fn signup_finish(
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    Json(body): Json<RegisterFinishBody>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let (_, state) = take_challenge(&pool, body.challenge_id, "signup").await?;
    let pending: PendingSignup = serde_json::from_value(state)
        .map_err(|e| ApiError::internal("stored sign-up state", e))?;

    // Nothing reaches `users` unless the passkey verifies.
    let passkey = ctx
        .webauthn
        .finish_passkey_registration(&body.credential, &pending.registration)
        .map_err(|e| {
            tracing::warn!("passkey sign-up refused: {e}");
            ApiError::bad_request("passkey_not_registered", "That passkey could not be registered.")
        })?;

    // The account and its passkey are made together or not at all.
    let mut tx = pool.begin().await?;
    let user_row = sqlx::query(
        "INSERT INTO users (id, username, auth_provider, age_tier)
         VALUES ($1, $2, 'passkey', $3)
         ON CONFLICT DO NOTHING
         RETURNING id, username, email, display_name, auth_provider, avatar_url",
    )
    .bind(pending.user_id)
    .bind(&pending.username)
    .bind(&pending.age_tier)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        // The generated name was taken in the minutes since begin. Vanishingly rare.
        ApiError::new(
            StatusCode::CONFLICT,
            "signup_retry",
            "That did not go through. Please try again.",
        )
    })?;
    sqlx::query("INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(pending.user_id)
        .execute(&mut *tx)
        .await?;
    let credential_id: &[u8] = passkey.cred_id().as_ref();
    sqlx::query(
        "INSERT INTO webauthn_credentials (user_id, credential_id, passkey, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (credential_id) DO NOTHING
         RETURNING id",
    )
    .bind(pending.user_id)
    .bind(credential_id)
    .bind(Db(&passkey))
    .bind(clean_passkey_name(body.name.as_deref()))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ApiError::new(
            StatusCode::CONFLICT,
            "passkey_already_registered",
            "That passkey is already registered.",
        )
    })?;
    tx.commit().await?;

    let user = row_to_user(&user_row);
    let jar = session_cookie(user.id, &user.username, &config)?;
    Ok((
        jar,
        Json(AuthResponse { user, founding_player: None, passkey_count: 1, is_new_user: Some(true) }),
    ))
}

// ---------------------------------------------------------------------------
// Registration (signed-in user adds a passkey)
// ---------------------------------------------------------------------------

pub async fn register_begin(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
) -> Result<Json<BeginResponse>, ApiError> {
    let claims = session(&jar, &config)?;
    let user = sqlx::query("SELECT username, email, display_name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(ApiError::unauthorized)?;
    let username: String = user.get("username");
    let email: Option<String> = user.get("email");
    let display_name: Option<String> = user.get("display_name");

    let existing: Vec<Vec<u8>> =
        sqlx::query_scalar("SELECT credential_id FROM webauthn_credentials WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_all(&pool)
            .await?;
    if existing.len() as i64 >= MAX_PASSKEYS_PER_USER {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "too_many_passkeys",
            "This account already has the most passkeys it can hold. Remove one first.",
        ));
    }
    // Already-registered credentials are excluded so one authenticator is not added twice.
    let exclude = existing.into_iter().map(Into::into).collect::<Vec<_>>();

    // The account name the authenticator shows in its passkey picker.
    let account_name = email.as_deref().unwrap_or(&username);
    let shown_name = display_name.as_deref().unwrap_or(&username);
    let (challenge, state) = ctx
        .webauthn
        .start_passkey_registration(claims.sub, account_name, shown_name, Some(exclude))
        .map_err(|e| ApiError::internal("start_passkey_registration", e))?;

    let mut options = serde_json::to_value(&challenge.public_key)
        .map_err(|e| ApiError::internal("serialise registration options", e))?;
    require_discoverable(&mut options);

    let state = serde_json::to_value(&state)
        .map_err(|e| ApiError::internal("serialise registration state", e))?;
    let challenge_id = store_challenge(&pool, "register", Some(claims.sub), state).await?;
    Ok(Json(BeginResponse { challenge_id, options }))
}

pub async fn register_finish(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    Json(body): Json<RegisterFinishBody>,
) -> Result<Json<PasskeyInfo>, ApiError> {
    let claims = session(&jar, &config)?;
    let (owner, state) = take_challenge(&pool, body.challenge_id, "register").await?;
    // A challenge begun by one account cannot be finished by another.
    if owner != Some(claims.sub) {
        return Err(challenge_gone());
    }
    let state: PasskeyRegistration = serde_json::from_value(state)
        .map_err(|e| ApiError::internal("stored registration state", e))?;

    let passkey = ctx
        .webauthn
        .finish_passkey_registration(&body.credential, &state)
        .map_err(|e| {
            tracing::warn!(user_id = %claims.sub, "passkey registration refused: {e}");
            ApiError::bad_request("passkey_not_registered", "That passkey could not be registered.")
        })?;

    let name = clean_passkey_name(body.name.as_deref());
    let credential_id: &[u8] = passkey.cred_id().as_ref();
    let inserted = sqlx::query(
        "INSERT INTO webauthn_credentials (user_id, credential_id, passkey, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (credential_id) DO NOTHING
         RETURNING id, name, created_at, last_used_at",
    )
    .bind(claims.sub)
    .bind(credential_id)
    .bind(Db(&passkey))
    .bind(&name)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| {
        // The credential ID already belongs to some account; never attach it to a second.
        ApiError::new(
            StatusCode::CONFLICT,
            "passkey_already_registered",
            "That passkey is already registered.",
        )
    })?;

    Ok(Json(row_to_info(&inserted)))
}

// ---------------------------------------------------------------------------
// Sign-in (no username)
// ---------------------------------------------------------------------------

pub async fn login_begin(
    State((pool, _)): State<(PgPool, Config)>,
    ctx: Ctx,
) -> Result<Json<BeginResponse>, ApiError> {
    let (challenge, state) = ctx
        .webauthn
        .start_discoverable_authentication()
        .map_err(|e| ApiError::internal("start_discoverable_authentication", e))?;
    // Only the `publicKey` member is sent. webauthn-rs also sets `mediation: conditional`;
    // whether the request is modal or autofill is the page's choice, made per call.
    let options = serde_json::to_value(&challenge.public_key)
        .map_err(|e| ApiError::internal("serialise authentication options", e))?;
    let state = serde_json::to_value(&state)
        .map_err(|e| ApiError::internal("serialise authentication state", e))?;
    let challenge_id = store_challenge(&pool, "login", None, state).await?;
    Ok(Json(BeginResponse { challenge_id, options }))
}

pub async fn login_finish(
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    Json(body): Json<LoginFinishBody>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let (_, state) = take_challenge(&pool, body.challenge_id, "login").await?;
    let state: DiscoverableAuthentication = serde_json::from_value(state)
        .map_err(|e| ApiError::internal("stored authentication state", e))?;

    // The authenticator says who is signing in (user handle) and with which credential.
    let (user_id, credential_id) = ctx
        .webauthn
        .identify_discoverable_authentication(&body.credential)
        .map_err(|_| passkey_failed())?;

    let row = sqlx::query(
        "SELECT id, passkey FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2",
    )
    .bind(credential_id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(passkey_failed)?;
    let row_id: Uuid = row.get("id");
    let Db(mut passkey): Db<Passkey> = row.get("passkey");

    let result = ctx
        .webauthn
        .finish_discoverable_authentication_v2(&body.credential, state, &passkey)
        .map_err(|e| {
            tracing::warn!(%user_id, "passkey sign-in refused: {e}");
            passkey_failed()
        })?;

    // Keep the signature counter and backup flags current (clone detection relies on it).
    if passkey.update_credential(&result) == Some(true) {
        sqlx::query("UPDATE webauthn_credentials SET passkey = $2, last_used_at = NOW() WHERE id = $1")
            .bind(row_id)
            .bind(Db(&passkey))
            .execute(&pool)
            .await?;
    } else {
        sqlx::query("UPDATE webauthn_credentials SET last_used_at = NOW() WHERE id = $1")
            .bind(row_id)
            .execute(&pool)
            .await?;
    }

    let user_row = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url
         FROM users WHERE id = $1",
    )
    .bind(user_id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(passkey_failed)?;
    let user = row_to_user(&user_row);
    let jar = session_cookie(user.id, &user.username, &config)?;
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok((jar, Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: None })))
}

// ---------------------------------------------------------------------------
// Management
// ---------------------------------------------------------------------------

fn row_to_info(row: &sqlx::postgres::PgRow) -> PasskeyInfo {
    PasskeyInfo {
        id: row.get("id"),
        name: row.get("name"),
        created_at: row.get("created_at"),
        last_used_at: row.get("last_used_at"),
    }
}

pub async fn list(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
) -> Result<Json<Vec<PasskeyInfo>>, ApiError> {
    let claims = session(&jar, &config)?;
    let rows = sqlx::query(
        "SELECT id, name, created_at, last_used_at FROM webauthn_credentials
         WHERE user_id = $1 ORDER BY created_at ASC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;
    Ok(Json(rows.iter().map(row_to_info).collect()))
}

pub async fn remove(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let claims = session(&jar, &config)?;

    // Removing the last passkey is fine while email can still get the user back in.
    // Without that way back it would lock the account for good.
    let has_email: bool =
        sqlx::query_scalar("SELECT email IS NOT NULL FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&pool)
            .await?
            .ok_or_else(ApiError::unauthorized)?;
    let can_recover = has_email && config.email_mode.is_available();

    let mut tx = pool.begin().await?;
    // Lock the account's passkeys so two removals cannot both see "one will remain".
    let ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM webauthn_credentials WHERE user_id = $1 FOR UPDATE")
            .bind(claims.sub)
            .fetch_all(&mut *tx)
            .await?;
    if !ids.contains(&id) {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "passkey_not_found", "No such passkey."));
    }
    if ids.len() == 1 && !can_recover {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "last_sign_in_method",
            "This is your only way to sign in. Add another passkey before removing it.",
        ));
    }
    sqlx::query("DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Drop ceremonies nobody finished and codes too old to matter for any limit.
pub async fn purge_expired(pool: &PgPool) {
    if let Err(e) = sqlx::query("DELETE FROM auth_challenges WHERE expires_at < NOW()")
        .execute(pool)
        .await
    {
        tracing::warn!("could not purge expired auth challenges: {e}");
    }
    if let Err(e) =
        sqlx::query("DELETE FROM signup_attempts WHERE created_at < NOW() - INTERVAL '1 day'")
            .execute(pool)
            .await
    {
        tracing::warn!("could not purge old sign-up attempts: {e}");
    }
    if let Err(e) =
        sqlx::query("DELETE FROM email_login_codes WHERE created_at < NOW() - INTERVAL '1 day'")
            .execute(pool)
            .await
    {
        tracing::warn!("could not purge old email codes: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registration_options_demand_a_discoverable_credential() {
        // The shape webauthn-rs produces for start_passkey_registration.
        let mut options = json!({
            "rp": { "name": "Sonnet Man", "id": "inspiredmile.com" },
            "authenticatorSelection": { "requireResidentKey": false, "userVerification": "required" }
        });
        require_discoverable(&mut options);
        assert_eq!(options["authenticatorSelection"]["residentKey"], "required");
        assert_eq!(options["authenticatorSelection"]["requireResidentKey"], true);
        assert_eq!(options["authenticatorSelection"]["userVerification"], "required");
    }

    #[test]
    fn discoverable_is_required_even_without_a_selection_block() {
        let mut options = json!({ "rp": { "name": "Sonnet Man", "id": "inspiredmile.com" } });
        require_discoverable(&mut options);
        assert_eq!(options["authenticatorSelection"]["residentKey"], "required");
        assert_eq!(options["authenticatorSelection"]["userVerification"], "required");
    }

    #[test]
    fn sign_ups_per_address_stop_at_the_limit() {
        assert!(signup_allowed(0));
        assert!(signup_allowed(MAX_SIGNUPS_PER_IP - 1));
        assert!(!signup_allowed(MAX_SIGNUPS_PER_IP));
        assert!(!signup_allowed(MAX_SIGNUPS_PER_IP + 100));
        assert_eq!(MAX_SIGNUPS_PER_IP, 40);
    }

    #[test]
    fn passkey_names_are_cleaned() {
        assert_eq!(clean_passkey_name(None), "Passkey");
        assert_eq!(clean_passkey_name(Some("   ")), "Passkey");
        assert_eq!(clean_passkey_name(Some("  Chrome   on\tmacOS \n")), "Chrome on macOS");
        assert_eq!(clean_passkey_name(Some("a\u{0}b\u{7}c")), "abc");
        assert_eq!(clean_passkey_name(Some(&"x".repeat(200))).chars().count(), 64);
    }
}
