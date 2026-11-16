//! Passkeys (WebAuthn discoverable credentials): the primary way to sign in.
//!
//! Sign-up needs nothing but a passkey: no email, no personal data. The account-to-be
//! waits in the challenge and reaches `users` only when the passkey verifies.
//! Registration needs a session (you add a passkey to an account you are already in) AND
//! a fresh proof that the person at the browser is the account's owner (`verify`, below,
//! or a sign-in in the last few minutes); so does removing a passkey.
//! Sign-in needs nothing: the authenticator names the account through the user handle.
//! Ceremony state lives in `auth_challenges`, is taken out on first use and expires fast.
//!
//! Sign-up is the one unauthenticated request that writes rows for good, so it is the one
//! that could fill the database. Four things bound it:
//!   1. per network (IPv4 /24, IPv6 /64), `MAX_SIGNUPS_PER_NETWORK` accounts an hour;
//!   2. per network, `MAX_SIGNUP_BEGINS_PER_NETWORK` begun ceremonies an hour (a looser
//!      cap: a class that cancels and retries the prompt must not lock its school out);
//!   3. over all visitors, `SIGNUP_GLOBAL_PER_HOUR` accounts an hour, with a loud log line
//!      when it is hit, because that means either an attack or a very good day;
//!   4. accounts that never played are deleted after `UNUSED_ACCOUNT_PURGE_DAYS`
//!      (`purge_unused_accounts`).
//! 1 and 3 count accounts actually created and are checked under a lock in the same
//! transaction that creates the account, so a burst of parallel requests cannot pass them.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicI64, Ordering};

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
    AuthenticationResult, DiscoverableAuthentication, Passkey, PasskeyAuthentication,
    PasskeyRegistration, PublicKeyCredential, RegisterPublicKeyCredential,
};

use super::client_ip::client_addr;
use super::error::ApiError;
use super::handlers::{
    age_tier_from, passkey_count, row_to_user, session, unused_username, AuthResponse, Ctx,
};
use super::sessions::{self, Proof, FRESH_AUTH_MINUTES};
use crate::config::Config;

/// How long a begun ceremony may take to finish. Matches the WebAuthn timeout webauthn-rs
/// puts in the options (five minutes).
const CHALLENGE_TTL_MINUTES: i64 = 5;
/// A sane ceiling on passkeys per account.
const MAX_PASSKEYS_PER_USER: i64 = 20;
/// Accounts one network (IPv4 /24, IPv6 /64) may create inside `SIGNUP_WINDOW_MINUTES`.
/// Roomy enough for a class signing up from one school address, small enough to blunt a
/// script. Counts finished sign-ups, not begun ones.
pub const MAX_SIGNUPS_PER_NETWORK: i64 = 40;
/// Sign-up ceremonies one network may begin in the window. Each costs a challenge row that
/// lives five minutes; the cap is five tries per allowed account.
pub const MAX_SIGNUP_BEGINS_PER_NETWORK: i64 = 200;
pub const SIGNUP_WINDOW_MINUTES: i64 = 60;
/// Advisory-lock key that serialises the "count, then create" step of every sign-up.
const SIGNUP_LOCK: i64 = 0x494d_5349_474e_5550; // "IMSIGNUP"

/// Sign-ups in the window, as the limits see them.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SignupCounts {
    /// Ceremonies this network has begun.
    pub begun_by_network: i64,
    /// Accounts this network has created.
    pub created_by_network: i64,
    /// Accounts created by everyone.
    pub created_by_everyone: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SignupVerdict {
    Allowed,
    /// This network has created its share of accounts.
    NetworkLimited,
    /// This network keeps starting sign-ups without finishing them.
    BeginsLimited,
    /// The site-wide ceiling is reached: nobody may sign up until the hour moves on.
    GlobalLimited,
}

/// Whether one more sign-up may go ahead. `ceiling` is `SIGNUP_GLOBAL_PER_HOUR`.
pub fn signup_verdict(counts: SignupCounts, ceiling: i64) -> SignupVerdict {
    if counts.created_by_everyone >= ceiling {
        SignupVerdict::GlobalLimited
    } else if counts.created_by_network >= MAX_SIGNUPS_PER_NETWORK {
        SignupVerdict::NetworkLimited
    } else if counts.begun_by_network >= MAX_SIGNUP_BEGINS_PER_NETWORK {
        SignupVerdict::BeginsLimited
    } else {
        SignupVerdict::Allowed
    }
}

async fn signup_counts(conn: &mut sqlx::PgConnection, network: &str) -> Result<SignupCounts, ApiError> {
    let row = sqlx::query(
        "SELECT COUNT(*) FILTER (WHERE ip = $1 AND NOT completed) AS begun,
                COUNT(*) FILTER (WHERE ip = $1 AND completed) AS created,
                COUNT(*) FILTER (WHERE completed) AS everyone
         FROM signup_attempts
         WHERE created_at > NOW() - make_interval(mins => $2)",
    )
    .bind(network)
    .bind(SIGNUP_WINDOW_MINUTES as i32)
    .fetch_one(conn)
    .await?;
    Ok(SignupCounts {
        begun_by_network: row.get("begun"),
        created_by_network: row.get("created"),
        created_by_everyone: row.get("everyone"),
    })
}

/// The refusal for a verdict, or `Ok` when the sign-up may go ahead. Hitting the global
/// ceiling is logged loudly (at most once a minute): it should never happen in normal use.
fn signup_refusal(verdict: SignupVerdict, counts: SignupCounts, ceiling: i64) -> Result<(), ApiError> {
    let message = match verdict {
        SignupVerdict::Allowed => return Ok(()),
        SignupVerdict::GlobalLimited => {
            static LAST: AtomicI64 = AtomicI64::new(0);
            let now = Utc::now().timestamp();
            let last = LAST.load(Ordering::Relaxed);
            if now - last >= 60
                && LAST.compare_exchange(last, now, Ordering::Relaxed, Ordering::Relaxed).is_ok()
            {
                let bar = "!".repeat(72);
                eprintln!(
                    "\n{bar}\nSIGN-UP CEILING HIT: {} accounts were created in the last {SIGNUP_WINDOW_MINUTES} \
                     minutes (SIGNUP_GLOBAL_PER_HOUR = {ceiling}). New passkey sign-ups are being REFUSED \
                     for everyone until the count falls. Either the site is under a sign-up flood or it \
                     is unusually busy: look at signup_attempts before raising the ceiling.\n{bar}\n",
                    counts.created_by_everyone
                );
                tracing::error!(
                    created_last_hour = counts.created_by_everyone,
                    ceiling,
                    "SIGN-UP CEILING HIT: passkey sign-ups are refused for everyone"
                );
            }
            "Too many accounts are being created right now. Please try again in a little while."
        }
        SignupVerdict::NetworkLimited | SignupVerdict::BeginsLimited => {
            "Too many accounts started from this network. Wait a while and try again."
        }
    };
    Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS, "too_many_requests", message))
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
pub struct VerifiedResponse {
    ok: bool,
    /// How long the proof counts for the steps that need it.
    fresh_for_seconds: i64,
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
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<SignupBeginBody>,
) -> Result<Json<BeginResponse>, ApiError> {
    let age_tier = age_tier_from(body.age_tier.as_deref())?;

    // All three limits are looked at here, so a visitor is refused before the passkey
    // prompt rather than after it. The two that count accounts are checked again, for
    // real, when the account is created. Count and insert happen under one lock, so
    // parallel begins cannot all read "one below the cap".
    let network = client_addr(&headers, Some(peer), &config.trusted_proxies).signup_key();
    {
        let mut tx = pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(&network)
            .execute(&mut *tx)
            .await?;
        let counts = signup_counts(&mut *tx, &network).await?;
        signup_refusal(
            signup_verdict(counts, config.signup_global_per_hour),
            counts,
            config.signup_global_per_hour,
        )?;
        sqlx::query("INSERT INTO signup_attempts (ip, completed) VALUES ($1, FALSE)")
            .bind(&network)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
    }

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
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
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

    // The account and its passkey are made together or not at all, and only if the limits
    // on created accounts still hold. One lock for every sign-up: the count and the insert
    // that it permits cannot interleave with another sign-up's.
    let network = client_addr(&headers, Some(peer), &config.trusted_proxies).signup_key();
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(SIGNUP_LOCK)
        .execute(&mut *tx)
        .await?;
    let counts = SignupCounts { begun_by_network: 0, ..signup_counts(&mut *tx, &network).await? };
    signup_refusal(
        signup_verdict(counts, config.signup_global_per_hour),
        counts,
        config.signup_global_per_hour,
    )?;
    sqlx::query("INSERT INTO signup_attempts (ip, completed) VALUES ($1, TRUE)")
        .bind(&network)
        .execute(&mut *tx)
        .await?;
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
    // Creating a passkey is itself a user-verified ceremony: the new session starts fresh.
    let jar = sessions::start(&pool, &config, user.id, &user.username, Proof::Passkey).await?;
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
    let session = session(&jar, &pool, &config).await?;
    // A session cookie alone must not be enough to attach a new passkey: whoever sits down
    // at a browser left signed in could then take the account over for good.
    session.require_fresh()?;
    let claims = session.claims;
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
    // Freshness was required to begin; the challenge is single use, bound to the account
    // and gone in five minutes, so finishing needs only the live session.
    let claims = session(&jar, &pool, &config).await?.claims;
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
    require_user_verified(&result)?;
    record_use(&pool, row_id, &mut passkey, &result).await?;

    let user_row = sqlx::query(
        "SELECT id, username, email, display_name, auth_provider, avatar_url
         FROM users WHERE id = $1",
    )
    .bind(user_id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(passkey_failed)?;
    let user = row_to_user(&user_row);
    let jar = sessions::start(&pool, &config, user.id, &user.username, Proof::Passkey).await?;
    let passkey_count = passkey_count(&pool, user.id).await?;
    Ok((jar, Json(AuthResponse { user, founding_player: None, passkey_count, is_new_user: None })))
}

/// The library asks for user verification and refuses an assertion without it; this is the
/// same rule stated where it matters, so it cannot be lost to a change of policy upstream.
fn require_user_verified(result: &AuthenticationResult) -> Result<(), ApiError> {
    if result.user_verified() {
        Ok(())
    } else {
        tracing::warn!("passkey assertion without user verification refused");
        Err(passkey_failed())
    }
}

/// Keep the signature counter and backup flags current (clone detection relies on it).
async fn record_use(
    pool: &PgPool,
    row_id: Uuid,
    passkey: &mut Passkey,
    result: &AuthenticationResult,
) -> Result<(), ApiError> {
    if passkey.update_credential(result) == Some(true) {
        sqlx::query("UPDATE webauthn_credentials SET passkey = $2, last_used_at = NOW() WHERE id = $1")
            .bind(row_id)
            .bind(Db(&*passkey))
            .execute(pool)
            .await?;
    } else {
        sqlx::query("UPDATE webauthn_credentials SET last_used_at = NOW() WHERE id = $1")
            .bind(row_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Fresh verification (a signed-in user proves again that it is them)
// ---------------------------------------------------------------------------

/// Begin proving, with a passkey of the signed-in account, that the account's owner is at
/// the browser now. Needed before adding or removing a passkey or adding an email when the
/// last proof (the sign-in, usually) is more than `FRESH_AUTH_MINUTES` old.
pub async fn verify_begin(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
) -> Result<Json<BeginResponse>, ApiError> {
    let claims = session(&jar, &pool, &config).await?.claims;
    let passkeys: Vec<Passkey> =
        sqlx::query_scalar::<_, Db<Passkey>>("SELECT passkey FROM webauthn_credentials WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_all(&pool)
            .await?
            .into_iter()
            .map(|Db(passkey)| passkey)
            .collect();
    if passkeys.is_empty() {
        // An account that signs in by emailed code only: its proof is a new code.
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "reauth_unavailable",
            "This account has no passkey to confirm with. Sign out and sign in again with an emailed code.",
        ));
    }
    // Only this account's passkeys are offered, and user verification is required.
    let (challenge, state) = ctx
        .webauthn
        .start_passkey_authentication(&passkeys)
        .map_err(|e| ApiError::internal("start_passkey_authentication", e))?;
    let options = serde_json::to_value(&challenge.public_key)
        .map_err(|e| ApiError::internal("serialise verification options", e))?;
    let state = serde_json::to_value(&state)
        .map_err(|e| ApiError::internal("serialise verification state", e))?;
    let challenge_id = store_challenge(&pool, "verify", Some(claims.sub), state).await?;
    Ok(Json(BeginResponse { challenge_id, options }))
}

pub async fn verify_finish(
    jar: CookieJar,
    State((pool, config)): State<(PgPool, Config)>,
    ctx: Ctx,
    Json(body): Json<LoginFinishBody>,
) -> Result<Json<VerifiedResponse>, ApiError> {
    let claims = session(&jar, &pool, &config).await?.claims;
    let (owner, state) = take_challenge(&pool, body.challenge_id, "verify").await?;
    if owner != Some(claims.sub) {
        return Err(challenge_gone());
    }
    let state: PasskeyAuthentication = serde_json::from_value(state)
        .map_err(|e| ApiError::internal("stored verification state", e))?;
    let result = ctx
        .webauthn
        .finish_passkey_authentication(&body.credential, &state)
        .map_err(|e| {
            tracing::warn!(user_id = %claims.sub, "passkey verification refused: {e}");
            passkey_failed()
        })?;
    require_user_verified(&result)?;

    let credential_id: &[u8] = result.cred_id().as_ref();
    let row = sqlx::query(
        "SELECT id, passkey FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2",
    )
    .bind(credential_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(passkey_failed)?;
    let row_id: Uuid = row.get("id");
    let Db(mut passkey): Db<Passkey> = row.get("passkey");
    record_use(&pool, row_id, &mut passkey, &result).await?;

    sessions::mark_verified(&pool, claims.sid, Proof::Passkey).await?;
    Ok(Json(VerifiedResponse { ok: true, fresh_for_seconds: FRESH_AUTH_MINUTES * 60 }))
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
    let claims = session(&jar, &pool, &config).await?.claims;
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
    let session = session(&jar, &pool, &config).await?;
    // As for adding one: a cookie alone must not be able to take a way in away.
    session.require_fresh()?;
    let claims = session.claims;

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
    // A passkey is removed because its device is lost, sold or no longer trusted: whatever
    // that device (or anyone else) is still signed in with ends now. This browser stays.
    sessions::revoke_all(&mut *tx, claims.sub, Some(claims.sid)).await?;
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
    // Kept two days: the daily caps look back one.
    if let Err(e) =
        sqlx::query("DELETE FROM email_code_failures WHERE created_at < NOW() - INTERVAL '2 days'")
            .execute(pool)
            .await
    {
        tracing::warn!("could not purge old email-code failures: {e}");
    }
    sessions::purge(pool).await;
}

// Which accounts `purge_unused_accounts` removes. `$1` is the age in days. (A macro, not a
// constant, so the two statements that use it are still string literals.)
//
// All of these must hold:
//   - made by passkey sign-up and never given an email (the only kind a script can mass
//     produce: an email account costs a working mailbox each);
//   - created more than `$1` days ago, and no passkey of it used in the last `$1` days
//     (a sign-in or a fresh verification stamps `last_used_at`);
//   - never played and never did anything that leaves a trace: every counter in
//     `player_stats` is still zero, no credits, no cards, variants or achievements, no
//     credit transaction, no classroom, season, referral, tournament or migration row, no
//     house, no wallet.
// Tables that reference `users` without `ON DELETE CASCADE` (battles, trades, reports and
// whatever is added later) are a second guard: the delete of an account they mention
// fails, and the account stays.
macro_rules! unused_account {
    () => {
        "
    u.auth_provider = 'passkey' AND u.email IS NULL
    AND u.house_allegiance IS NULL AND u.wallet_address IS NULL
    AND u.created_at < NOW() - make_interval(days => $1)
    AND NOT EXISTS (SELECT 1 FROM webauthn_credentials c WHERE c.user_id = u.id
        AND COALESCE(c.last_used_at, c.created_at) > NOW() - make_interval(days => $1))
    AND NOT EXISTS (SELECT 1 FROM player_stats p WHERE p.user_id = u.id AND (
        p.battle_wins <> 0 OR p.total_battles <> 0 OR p.total_rounds <> 0 OR p.highest_score <> 0
        OR p.trivia_correct <> 0 OR p.trivia_perfect <> 0 OR p.challenges_completed <> 0
        OR p.unique_cards <> 0 OR p.total_cards <> 0 OR p.packs_opened <> 0
        OR p.variants_unlocked <> 0 OR p.unique_cities <> 0
        OR p.mp_wins <> 0 OR p.mp_losses <> 0 OR p.credits <> 0))
    AND NOT EXISTS (SELECT 1 FROM owned_cards x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM owned_variants x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM unlocked_achievements x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM credit_transactions x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM classroom_members x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM classrooms x WHERE x.teacher_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM migration_log x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM season_progress x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM referral_codes x WHERE x.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM referral_redemptions x WHERE x.redeemed_by = u.id)
    AND NOT EXISTS (SELECT 1 FROM tournament_entries x WHERE x.user_id = u.id)"
    };
}

/// Delete passkey-only accounts that were created, never used and left alone for `days`
/// days (`UNUSED_ACCOUNT_PURGE_DAYS`, default 30; 0 turns this off). See `unused_account!`
/// for exactly which. The owner of such an account loses a generated name and nothing
/// else; their passkey then answers "not accepted" and they can sign up again.
pub async fn purge_unused_accounts(pool: &PgPool, days: i64) {
    if days <= 0 {
        return;
    }
    let days = days.min(i64::from(i32::MAX)) as i32;
    let candidates: Vec<Uuid> = match sqlx::query_scalar(concat!(
        "SELECT u.id FROM users u WHERE ",
        unused_account!(),
        " ORDER BY u.created_at LIMIT 1000"
    ))
    .bind(days)
    .fetch_all(pool)
    .await
    {
        Ok(ids) => ids,
        Err(e) => {
            tracing::warn!("could not look for unused accounts: {e}");
            return;
        }
    };
    let mut removed = 0u64;
    for id in candidates {
        // The conditions are checked again by the statement that deletes, so an account
        // that came alive since the list was made is left alone.
        match sqlx::query(concat!("DELETE FROM users u WHERE u.id = $2 AND ", unused_account!()))
            .bind(days)
            .bind(id)
            .execute(pool)
            .await
        {
            Ok(done) => removed += done.rows_affected(),
            // Some table without a cascade still mentions the account: it did something.
            Err(e) => tracing::debug!(user_id = %id, "unused-account purge skipped an account: {e}"),
        }
    }
    if removed > 0 {
        tracing::info!(removed, days, "purged passkey-only accounts that never played");
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

    fn counts(begun: i64, created: i64, everyone: i64) -> SignupCounts {
        SignupCounts { begun_by_network: begun, created_by_network: created, created_by_everyone: everyone }
    }

    #[test]
    fn a_network_may_create_forty_accounts_an_hour() {
        assert_eq!(signup_verdict(counts(0, 0, 0), 300), SignupVerdict::Allowed);
        assert_eq!(signup_verdict(counts(0, MAX_SIGNUPS_PER_NETWORK - 1, 39), 300), SignupVerdict::Allowed);
        assert_eq!(signup_verdict(counts(0, MAX_SIGNUPS_PER_NETWORK, 40), 300), SignupVerdict::NetworkLimited);
        assert_eq!(signup_verdict(counts(0, MAX_SIGNUPS_PER_NETWORK + 100, 140), 300), SignupVerdict::NetworkLimited);
        assert_eq!(MAX_SIGNUPS_PER_NETWORK, 40);
    }

    #[test]
    fn begun_sign_ups_do_not_use_up_the_account_budget() {
        // A class of 30 where everyone cancels the prompt once and tries again: 60 begins,
        // and before that the 41st begin locked the whole school out for an hour.
        assert_eq!(signup_verdict(counts(60, 0, 0), 300), SignupVerdict::Allowed);
        assert_eq!(signup_verdict(counts(60, 30, 30), 300), SignupVerdict::Allowed);
        assert_eq!(
            signup_verdict(counts(MAX_SIGNUP_BEGINS_PER_NETWORK - 1, 0, 0), 300),
            SignupVerdict::Allowed
        );
        // Begins are still bounded, more loosely.
        assert_eq!(
            signup_verdict(counts(MAX_SIGNUP_BEGINS_PER_NETWORK, 0, 0), 300),
            SignupVerdict::BeginsLimited
        );
        assert!(MAX_SIGNUP_BEGINS_PER_NETWORK > MAX_SIGNUPS_PER_NETWORK);
    }

    #[test]
    fn the_global_ceiling_stops_everyone() {
        // A network that has done nothing is refused once the whole site is at the ceiling.
        assert_eq!(signup_verdict(counts(0, 0, 299), 300), SignupVerdict::Allowed);
        assert_eq!(signup_verdict(counts(0, 0, 300), 300), SignupVerdict::GlobalLimited);
        assert_eq!(signup_verdict(counts(0, 0, 5000), 300), SignupVerdict::GlobalLimited);
        // The ceiling is the configured one.
        assert_eq!(signup_verdict(counts(0, 0, 50), 50), SignupVerdict::GlobalLimited);
        // And it is reported in preference to the network's own limit.
        assert_eq!(signup_verdict(counts(500, 500, 300), 300), SignupVerdict::GlobalLimited);
    }

    #[test]
    fn the_refusal_is_a_429_and_allowed_is_not_a_refusal() {
        assert!(signup_refusal(SignupVerdict::Allowed, counts(0, 0, 0), 300).is_ok());
        for verdict in [SignupVerdict::NetworkLimited, SignupVerdict::BeginsLimited, SignupVerdict::GlobalLimited] {
            let err = signup_refusal(verdict, counts(0, 0, 300), 300).expect_err("refused");
            assert_eq!(err.status, StatusCode::TOO_MANY_REQUESTS);
            assert_eq!(err.code, "too_many_requests");
        }
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
