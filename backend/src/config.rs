use std::env;

use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use url::Url;

use crate::auth::{parse_proxy_secret, parse_trusted_proxies, ProxyTrust, DEFAULT_TRUSTED_PROXIES};

pub const DEFAULT_RP_ID: &str = "inspiredmile.com";
pub const DEFAULT_WEBAUTHN_ORIGIN: &str = "https://sonnetman.inspiredmile.com";
pub const DEFAULT_EMAIL_FROM: &str = "Sonnet Man <signin@inspiredmile.com>";

/// How sign-in emails leave the server.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EmailMode {
    /// No `RESEND_API_KEY`: the email endpoints answer 503 and the UI hides email sign-in.
    Disabled,
    /// Send through the Resend HTTP API with this key.
    Resend(String),
    /// `DEV_EMAIL_LOG=1` and no key: the code is written to the log instead of being sent.
    /// For tests only.
    DevLog,
}

impl EmailMode {
    pub fn is_available(&self) -> bool {
        !matches!(self, EmailMode::Disabled)
    }

    /// Decide the mode from the two settings, with the warnings start-up must print.
    ///
    /// A real key always wins: with both set, mail is sent and no code is ever logged.
    pub fn resolve(resend_api_key: Option<&str>, dev_email_log: Option<&str>) -> (Self, Vec<String>) {
        let key = resend_api_key.map(str::trim).filter(|k| !k.is_empty());
        let dev_log = dev_email_log.map(str::trim).is_some_and(is_truthy);
        let mut warnings = Vec::new();
        let mode = match (key, dev_log) {
            (Some(key), true) => {
                warnings.push(
                    "DEV_EMAIL_LOG is set together with RESEND_API_KEY. DEV_EMAIL_LOG IS IGNORED: \
                     sign-in codes are sent through Resend and are NOT written to the log. \
                     Remove DEV_EMAIL_LOG from this environment."
                        .to_string(),
                );
                EmailMode::Resend(key.to_string())
            }
            (Some(key), false) => EmailMode::Resend(key.to_string()),
            (None, true) => {
                warnings.push(
                    "DEV_EMAIL_LOG is on: sign-in codes are WRITTEN TO THE LOG and no email is sent. \
                     This is for tests only and must never run in production."
                        .to_string(),
                );
                EmailMode::DevLog
            }
            (None, false) => EmailMode::Disabled,
        };
        (mode, warnings)
    }
}

/// The secret every checkout used to fall back to. It is public (it was committed), so a
/// server signing sessions with it lets anyone sign in as anyone. Kept here only so that
/// start-up can refuse it.
const OLD_DEV_JWT_SECRET: &str = "dev-secret-change-in-production";
/// The shortest `JWT_SECRET` accepted: 32 bytes, the size of the HS256 key it becomes.
pub const MIN_JWT_SECRET_BYTES: usize = 32;
/// The development flag: with it set, a missing `JWT_SECRET` becomes a random one made at
/// start-up (sessions end when the process does) and a weak one is accepted, both with a
/// loud warning. Refused together with an https origin, so it cannot ride into production.
pub const DEV_SECRET_FLAG: &str = "DEV_INSECURE_JWT_SECRET";

/// A pause, in milliseconds, between a limit's check and the write it allows (sign-ups,
/// email codes, sign-in challenges). For the end-to-end tests that prove those checks are
/// atomic: with the pause, a check made without its lock lets every parallel request
/// through, so the test goes red. Refused with an https origin, so it cannot be set in
/// production; with an http localhost origin it is accepted with a loud warning.
pub const TEST_RACE_DELAY_VAR: &str = "TEST_ONLY_LIMIT_RACE_DELAY_MS";
/// The longest pause `TEST_ONLY_LIMIT_RACE_DELAY_MS` may ask for.
pub const MAX_TEST_RACE_DELAY_MS: u64 = 5000;

/// Passkey sign-ups allowed in any hour, over all visitors. See `auth/passkeys.rs`.
pub const DEFAULT_SIGNUP_GLOBAL_PER_HOUR: i64 = 300;
/// Passkey sign-ups that may be begun in any hour, over all visitors. Five tries per
/// allowed account, as for one network.
pub const DEFAULT_SIGNUP_BEGINS_GLOBAL_PER_HOUR: i64 = 1500;
/// Rows the sign-in challenge table may hold before only networks under their share are
/// served (`AUTH_CHALLENGES_MAX`; see `auth/passkeys.rs`). A row is a few hundred bytes.
pub const DEFAULT_AUTH_CHALLENGES_MAX: i64 = 50_000;
/// Days after which a passkey-only account that never played is deleted. See
/// `auth::purge_unused_accounts`.
pub const DEFAULT_UNUSED_ACCOUNT_PURGE_DAYS: i64 = 30;

/// Decide the session-signing secret, or refuse to start.
fn resolve_jwt_secret(
    stated: Option<String>,
    dev_flag: bool,
    warnings: &mut Vec<String>,
) -> Result<String, String> {
    let stated = stated.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let problem = match &stated {
        None => Some("JWT_SECRET is not set".to_string()),
        Some(s) if s == OLD_DEV_JWT_SECRET => {
            Some("JWT_SECRET is the old development constant, which is public".to_string())
        }
        // The placeholder of .env.production.template, left as it was.
        Some(s) if s.starts_with('<') || s.contains("openssl rand") => {
            Some("JWT_SECRET is still the template's placeholder".to_string())
        }
        Some(s) if s.len() < MIN_JWT_SECRET_BYTES => Some(format!(
            "JWT_SECRET is {} bytes long; at least {MIN_JWT_SECRET_BYTES} are required",
            s.len()
        )),
        Some(_) => None,
    };
    let Some(problem) = problem else {
        return Ok(stated.expect("a secret without a problem is present"));
    };
    if !dev_flag {
        return Err(format!(
            "{problem}. Sessions are signed with it, so the server will not start without a \
             strong one. Generate one with `openssl rand -base64 48` and set JWT_SECRET. \
             (For local development only, {DEV_SECRET_FLAG}=1 lifts this.)"
        ));
    }
    match stated {
        Some(weak) => {
            warnings.push(format!(
                "{DEV_SECRET_FLAG} is on and {problem}: SESSIONS CAN BE FORGED by anyone who \
                 knows or guesses the secret. Development only."
            ));
            Ok(weak)
        }
        None => {
            warnings.push(format!(
                "{DEV_SECRET_FLAG} is on and JWT_SECRET is not set: using a random secret made \
                 at start-up. Every session ends when this process stops. Development only."
            ));
            Ok(format!("{:032x}{:032x}", rand::random::<u128>(), rand::random::<u128>()))
        }
    }
}

/// Decide the test-only race delay, or refuse to start.
fn resolve_race_delay(
    stated: Option<String>,
    any_https_origin: bool,
    warnings: &mut Vec<String>,
) -> Result<Option<std::time::Duration>, String> {
    let Some(stated) = stated.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if any_https_origin {
        return Err(format!(
            "{TEST_RACE_DELAY_VAR} is set, but WEBAUTHN_ORIGIN has an https site. It is a test-only \
             setting that slows every limit check; remove it."
        ));
    }
    let ms: u64 = stated
        .parse()
        .ok()
        .filter(|ms| *ms <= MAX_TEST_RACE_DELAY_MS)
        .ok_or_else(|| {
            format!("{TEST_RACE_DELAY_VAR} must be a number of milliseconds up to {MAX_TEST_RACE_DELAY_MS}")
        })?;
    if ms == 0 {
        return Ok(None);
    }
    warnings.push(format!(
        "{TEST_RACE_DELAY_VAR} is {ms}: every sign-up, email-code and challenge limit pauses {ms} ms \
         between its check and its write. For tests only."
    ));
    Ok(Some(std::time::Duration::from_millis(ms)))
}

/// A key for one purpose, derived from the session secret: knowing one derived key, or a
/// value made with it, says nothing about the secret or about another purpose's key.
fn derive_key(secret: &str, purpose: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .expect("HMAC accepts a key of any length");
    mac.update(b"inspired-mile:derived-key:v1\0");
    mac.update(purpose.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn is_truthy(value: &str) -> bool {
    matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on")
}

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    /// Signs session tokens, and nothing else. Never absent, short or the old constant
    /// outside development (`resolve_jwt_secret`).
    pub jwt_secret: String,
    /// The HMAC key for emailed codes and the cookie that binds a code to the browser that
    /// asked for it. Derived from `jwt_secret`, so there is one secret to keep, but a
    /// separate key: a stored code hash is not a signature under the session key.
    pub email_code_key: String,
    pub port: u16,
    pub cors_origin: String,
    pub db_max_connections: u32,
    /// WebAuthn relying-party ID. Passkeys are bound to it for good: changing it orphans
    /// every registered passkey.
    pub webauthn_rp_id: String,
    /// Origins a passkey ceremony may come from. The first is the primary one.
    pub webauthn_origins: Vec<Url>,
    pub email_mode: EmailMode,
    pub email_from: String,
    /// Requests per minute allowed to one client address.
    pub rate_limit_per_minute: u32,
    /// Socket peers whose `CF-Connecting-IP` / `X-Forwarded-For` are believed
    /// (`TRUSTED_PROXIES`), and the secret they must send with them when `PROXY_SECRET` is
    /// set. From anyone else the socket address is the client address.
    pub trusted_proxies: ProxyTrust,
    /// Passkey sign-ups allowed in any hour, over all visitors (`SIGNUP_GLOBAL_PER_HOUR`).
    pub signup_global_per_hour: i64,
    /// Passkey sign-ups that may be begun in any hour, over all visitors
    /// (`SIGNUP_BEGINS_GLOBAL_PER_HOUR`).
    pub signup_begins_global_per_hour: i64,
    /// Rows `auth_challenges` may hold, live or expired (`AUTH_CHALLENGES_MAX`).
    pub auth_challenges_max: i64,
    /// `TEST_ONLY_LIMIT_RACE_DELAY_MS`: never set outside the tests (refused with https).
    pub test_race_delay: Option<std::time::Duration>,
    /// Days before an unused passkey-only account is deleted (`UNUSED_ACCOUNT_PURGE_DAYS`,
    /// 0 turns the purge off).
    pub unused_account_purge_days: i64,
    /// True when every page origin is https. Cookies then carry the `__Host-` prefix, which
    /// a browser only accepts from an https page, with `Secure`, `Path=/` and no `Domain`:
    /// another host under inspiredmile.com cannot set or overwrite them. Over plain http
    /// (localhost development and the tests) browsers refuse the prefix, so it is left off.
    pub host_locked_cookies: bool,
    /// Seconds between sweeps of expired challenges, old codes, ended sessions and unused
    /// accounts (`MAINTENANCE_INTERVAL_SECONDS`, default 600). The tests shorten it.
    pub maintenance_interval_seconds: u64,
    /// Seconds between the tournament scheduler's looks for tournaments to start
    /// (`TOURNAMENT_CHECK_SECONDS`, default 30). The tests shorten it.
    pub tournament_check_seconds: u64,
    /// `TOURNAMENT_ARRIVAL_SECONDS`: how long the first player into a tournament match's room
    /// waits for the other, when shorter than `multiplayer::game_room::TOURNAMENT_ARRIVAL` (240 s).
    /// For the tests: a longer value, or none, leaves the 240 s.
    pub tournament_arrival_seconds: Option<u64>,
}

impl Config {
    /// The session cookie's name: `__Host-im_token` in production.
    pub fn session_cookie_name(&self) -> &'static str {
        if self.host_locked_cookies { "__Host-im_token" } else { "im_token" }
    }

    /// The cookie that ties an emailed code to the browser that asked for it.
    pub fn code_cookie_name(&self) -> &'static str {
        if self.host_locked_cookies { "__Host-im_code" } else { "im_code" }
    }

    /// Called between a limit's check and the write it allows. Does nothing unless the
    /// test-only `TEST_ONLY_LIMIT_RACE_DELAY_MS` is set (see `TEST_RACE_DELAY_VAR`).
    pub async fn test_race_window(&self) {
        if let Some(pause) = self.test_race_delay {
            tokio::time::sleep(pause).await;
        }
    }
}

impl Config {
    pub fn from_env() -> Result<(Self, Vec<String>), String> {
        Self::from_lookup(|name| env::var(name).ok())
    }

    /// Build the configuration from any name-to-value lookup, so tests need not touch the
    /// process environment. Returns the configuration and the warnings to log at start-up.
    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Result<(Self, Vec<String>), String> {
        let non_empty = |name: &str| get(name).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());

        let webauthn_rp_id = non_empty("WEBAUTHN_RP_ID").unwrap_or_else(|| DEFAULT_RP_ID.into());
        let webauthn_origins = parse_webauthn_origins(
            &non_empty("WEBAUTHN_ORIGIN").unwrap_or_else(|| DEFAULT_WEBAUTHN_ORIGIN.into()),
            &webauthn_rp_id,
        )?;
        let (email_mode, mut warnings) = EmailMode::resolve(
            get("RESEND_API_KEY").as_deref(),
            get("DEV_EMAIL_LOG").as_deref(),
        );

        let host_locked_cookies = webauthn_origins.iter().all(|o| o.scheme() == "https");
        let dev_flag = get(DEV_SECRET_FLAG).as_deref().map(str::trim).is_some_and(is_truthy);
        if dev_flag && host_locked_cookies {
            return Err(format!(
                "{DEV_SECRET_FLAG} is set, but WEBAUTHN_ORIGIN is an https site. The flag is \
                 for local development over http://localhost only. Remove it and set JWT_SECRET."
            ));
        }
        let jwt_secret = resolve_jwt_secret(get("JWT_SECRET"), dev_flag, &mut warnings)?;
        let any_https_origin = webauthn_origins.iter().any(|o| o.scheme() == "https");
        let test_race_delay = resolve_race_delay(get(TEST_RACE_DELAY_VAR), any_https_origin, &mut warnings)?;
        let email_code_key = derive_key(&jwt_secret, "email-code");
        let trusted_proxies = ProxyTrust::new(
            parse_trusted_proxies(&get("TRUSTED_PROXIES").unwrap_or_else(|| DEFAULT_TRUSTED_PROXIES.into()))?,
            parse_proxy_secret(get("PROXY_SECRET").as_deref())?,
        );

        let config = Self {
            database_url: get("DATABASE_URL")
                .unwrap_or_else(|| "postgres://localhost/inspired_mile".into()),
            jwt_secret,
            email_code_key,
            port: get("PORT").and_then(|p| p.parse().ok()).unwrap_or(3849),
            cors_origin: get("CORS_ORIGIN").unwrap_or_else(|| "http://localhost:4321".into()),
            db_max_connections: get("DB_MAX_CONNECTIONS")
                .and_then(|v| v.parse().ok())
                .unwrap_or(25),
            webauthn_rp_id,
            webauthn_origins,
            email_mode,
            email_from: non_empty("EMAIL_FROM").unwrap_or_else(|| DEFAULT_EMAIL_FROM.into()),
            rate_limit_per_minute: get("RATE_LIMIT_PER_MINUTE")
                .and_then(|v| v.parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(crate::rate_limit::DEFAULT_PER_MINUTE),
            trusted_proxies,
            signup_global_per_hour: get("SIGNUP_GLOBAL_PER_HOUR")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(DEFAULT_SIGNUP_GLOBAL_PER_HOUR),
            signup_begins_global_per_hour: get("SIGNUP_BEGINS_GLOBAL_PER_HOUR")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(DEFAULT_SIGNUP_BEGINS_GLOBAL_PER_HOUR),
            auth_challenges_max: get("AUTH_CHALLENGES_MAX")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(DEFAULT_AUTH_CHALLENGES_MAX),
            test_race_delay,
            unused_account_purge_days: get("UNUSED_ACCOUNT_PURGE_DAYS")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n >= 0)
                .unwrap_or(DEFAULT_UNUSED_ACCOUNT_PURGE_DAYS),
            host_locked_cookies,
            maintenance_interval_seconds: get("MAINTENANCE_INTERVAL_SECONDS")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(600),
            tournament_check_seconds: get("TOURNAMENT_CHECK_SECONDS")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(30),
            tournament_arrival_seconds: get("TOURNAMENT_ARRIVAL_SECONDS")
                .and_then(|v| v.trim().parse().ok())
                .filter(|n| *n > 0),
        };
        Ok((config, warnings))
    }
}

/// Parse `WEBAUTHN_ORIGIN`: one origin, or several separated by commas.
///
/// Every origin must be `https`, except `http` on localhost for development, and its host
/// must be the relying-party ID or a subdomain of it. A browser refuses any other pairing,
/// so a mismatch here is a deployment mistake worth stopping for.
pub fn parse_webauthn_origins(raw: &str, rp_id: &str) -> Result<Vec<Url>, String> {
    let mut origins = Vec::new();
    for part in raw.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        let url = Url::parse(part).map_err(|e| format!("WEBAUTHN_ORIGIN '{part}' is not a URL: {e}"))?;
        let host = url
            .host_str()
            .ok_or_else(|| format!("WEBAUTHN_ORIGIN '{part}' has no host"))?
            .to_ascii_lowercase();
        let is_localhost = host == "localhost" || host.ends_with(".localhost");
        match url.scheme() {
            "https" => {}
            "http" if is_localhost => {}
            other => {
                return Err(format!(
                    "WEBAUTHN_ORIGIN '{part}' uses '{other}': only https is allowed, or http on localhost"
                ));
            }
        }
        if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
            return Err(format!(
                "WEBAUTHN_ORIGIN '{part}' must be an origin only (scheme, host and optional port)"
            ));
        }
        let rp = rp_id.to_ascii_lowercase();
        if host != rp && !host.ends_with(&format!(".{rp}")) {
            return Err(format!(
                "WEBAUTHN_ORIGIN '{part}' is not on the relying-party ID '{rp_id}' (WEBAUTHN_RP_ID)"
            ));
        }
        if !origins.contains(&url) {
            origins.push(url);
        }
    }
    if origins.is_empty() {
        return Err("WEBAUTHN_ORIGIN lists no origin".into());
    }
    Ok(origins)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    const GOOD_SECRET: &str = "0123456789abcdef0123456789abcdef-test-only";

    /// A configuration from these settings alone, with nothing added.
    fn bare_config_from(pairs: &[(&str, &str)]) -> Result<(Config, Vec<String>), String> {
        let map: HashMap<String, String> =
            pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        Config::from_lookup(|name| map.get(name).cloned())
    }

    /// The same, with a valid `JWT_SECRET` unless the settings give their own.
    fn config_from(pairs: &[(&str, &str)]) -> Result<(Config, Vec<String>), String> {
        let mut all = vec![("JWT_SECRET", GOOD_SECRET)];
        all.extend_from_slice(pairs);
        bare_config_from(&all)
    }

    const LOCALHOST: [(&str, &str); 2] =
        [("WEBAUTHN_RP_ID", "localhost"), ("WEBAUTHN_ORIGIN", "http://localhost:4321")];

    #[test]
    fn start_up_is_refused_without_a_jwt_secret() {
        let err = bare_config_from(&[]).err().expect("no secret must not start");
        assert!(err.contains("JWT_SECRET is not set"), "{err}");
        let err = bare_config_from(&[("JWT_SECRET", "   ")]).err().expect("blank is absent");
        assert!(err.contains("JWT_SECRET is not set"), "{err}");
    }

    #[test]
    fn start_up_is_refused_with_the_old_constant_or_a_short_secret() {
        let err = bare_config_from(&[("JWT_SECRET", "dev-secret-change-in-production")])
            .err()
            .expect("the public constant must not start");
        assert!(err.contains("old development constant"), "{err}");

        let short = "a".repeat(MIN_JWT_SECRET_BYTES - 1);
        let err = bare_config_from(&[("JWT_SECRET", short.as_str())]).err().expect("31 bytes is too short");
        assert!(err.contains("at least 32"), "{err}");
        let exact = "a".repeat(MIN_JWT_SECRET_BYTES);
        assert!(bare_config_from(&[("JWT_SECRET", exact.as_str())]).is_ok());

        let err = bare_config_from(&[("JWT_SECRET", "<run: openssl rand -base64 48> and then some more")])
            .err()
            .expect("the template placeholder must not start");
        assert!(err.contains("placeholder"), "{err}");
    }

    #[test]
    fn the_development_flag_lifts_the_rule_loudly_and_only_on_localhost() {
        // No secret: a random one, different every start.
        let mut pairs = LOCALHOST.to_vec();
        pairs.push((DEV_SECRET_FLAG, "1"));
        let (a, warnings) = bare_config_from(&pairs).expect("the flag allows a missing secret");
        let (b, _) = bare_config_from(&pairs).unwrap();
        assert!(a.jwt_secret.len() >= MIN_JWT_SECRET_BYTES);
        assert_ne!(a.jwt_secret, b.jwt_secret, "a made-up secret is never reused");
        assert_ne!(a.jwt_secret, OLD_DEV_JWT_SECRET);
        assert!(warnings.iter().any(|w| w.contains("random secret")), "{warnings:?}");

        // A weak secret: accepted, with a warning that says what it means.
        pairs.push(("JWT_SECRET", "short"));
        let (config, warnings) = bare_config_from(&pairs).expect("the flag allows a weak secret");
        assert_eq!(config.jwt_secret, "short");
        assert!(warnings.iter().any(|w| w.contains("SESSIONS CAN BE FORGED")), "{warnings:?}");

        // Falsey values of the flag do not count.
        let mut off = LOCALHOST.to_vec();
        off.push((DEV_SECRET_FLAG, "0"));
        assert!(bare_config_from(&off).is_err());

        // And the flag is refused outright on an https site, with or without a secret.
        let err = bare_config_from(&[(DEV_SECRET_FLAG, "1")]).err().expect("not in production");
        assert!(err.contains("local development"), "{err}");
        assert!(bare_config_from(&[(DEV_SECRET_FLAG, "1"), ("JWT_SECRET", GOOD_SECRET)]).is_err());
    }

    #[test]
    fn the_email_code_key_is_derived_and_is_not_the_session_secret() {
        let (config, _) = config_from(&[]).unwrap();
        assert_eq!(config.email_code_key.len(), 64);
        assert_ne!(config.email_code_key, config.jwt_secret);
        assert!(!config.email_code_key.contains(GOOD_SECRET));
        // Stable for one secret, different for another, different per purpose.
        let (again, _) = config_from(&[]).unwrap();
        assert_eq!(config.email_code_key, again.email_code_key);
        let (other, _) =
            bare_config_from(&[("JWT_SECRET", "another-secret-of-at-least-32-bytes!")]).unwrap();
        assert_ne!(config.email_code_key, other.email_code_key);
        assert_ne!(derive_key(GOOD_SECRET, "email-code"), derive_key(GOOD_SECRET, "something-else"));
    }

    #[test]
    fn cookies_are_host_locked_exactly_when_every_origin_is_https() {
        let (prod, _) = config_from(&[]).unwrap();
        assert!(prod.host_locked_cookies);
        assert_eq!(prod.session_cookie_name(), "__Host-im_token");
        assert_eq!(prod.code_cookie_name(), "__Host-im_code");
        let (dev, _) = config_from(&LOCALHOST).unwrap();
        assert!(!dev.host_locked_cookies);
        assert_eq!(dev.session_cookie_name(), "im_token");
        assert_eq!(dev.code_cookie_name(), "im_code");
    }

    #[test]
    fn trusted_proxies_default_to_loopback_and_the_fleet_and_can_be_set() {
        let (config, _) = config_from(&[]).unwrap();
        assert_eq!(
            config.trusted_proxies.proxies,
            parse_trusted_proxies("127.0.0.1,::1,10.10.10.1,100.64.224.0,100.98.101.113").unwrap()
        );
        assert!(!config.trusted_proxies.requires_secret(), "no PROXY_SECRET unless one is set");
        let (config, _) = config_from(&[("TRUSTED_PROXIES", "100.64.0.0/10")]).unwrap();
        assert_eq!(config.trusted_proxies.proxies.len(), 1);
        let (config, _) = config_from(&[("TRUSTED_PROXIES", "")]).unwrap();
        assert!(config.trusted_proxies.proxies.is_empty(), "an empty list trusts nobody");
        assert!(config_from(&[("TRUSTED_PROXIES", "caddy")]).is_err());
    }

    #[test]
    fn a_proxy_secret_is_optional_but_must_be_strong_when_set() {
        let secret = "0123456789abcdef0123456789abcdef";
        let (config, _) = config_from(&[("PROXY_SECRET", secret)]).unwrap();
        assert!(config.trusted_proxies.requires_secret());
        let (config, _) = config_from(&[("PROXY_SECRET", "  ")]).unwrap();
        assert!(!config.trusted_proxies.requires_secret());
        let err = config_from(&[("PROXY_SECRET", "short")]).err().expect("a short secret must not start");
        assert!(err.contains("PROXY_SECRET"), "{err}");
    }

    #[test]
    fn sign_up_ceiling_and_purge_period_have_defaults_and_can_be_set() {
        let (config, _) = config_from(&[]).unwrap();
        assert_eq!(config.signup_global_per_hour, 300);
        assert_eq!(config.unused_account_purge_days, 30);
        let (config, _) =
            config_from(&[("SIGNUP_GLOBAL_PER_HOUR", "50"), ("UNUSED_ACCOUNT_PURGE_DAYS", "0")]).unwrap();
        assert_eq!(config.signup_global_per_hour, 50);
        assert_eq!(config.unused_account_purge_days, 0);
        let (config, _) = config_from(&[("SIGNUP_GLOBAL_PER_HOUR", "0")]).unwrap();
        assert_eq!(config.signup_global_per_hour, 300, "zero would refuse everyone");
    }

    #[test]
    fn begin_and_challenge_ceilings_have_defaults_and_can_be_set() {
        let (config, _) = config_from(&[]).unwrap();
        assert_eq!(config.signup_begins_global_per_hour, 1500);
        assert_eq!(config.auth_challenges_max, 50_000);
        let (config, _) =
            config_from(&[("SIGNUP_BEGINS_GLOBAL_PER_HOUR", "20"), ("AUTH_CHALLENGES_MAX", "30")]).unwrap();
        assert_eq!(config.signup_begins_global_per_hour, 20);
        assert_eq!(config.auth_challenges_max, 30);
        let (config, _) =
            config_from(&[("SIGNUP_BEGINS_GLOBAL_PER_HOUR", "0"), ("AUTH_CHALLENGES_MAX", "-1")]).unwrap();
        assert_eq!(config.signup_begins_global_per_hour, 1500, "zero would refuse everyone");
        assert_eq!(config.auth_challenges_max, 50_000);
    }

    #[test]
    fn the_test_race_delay_is_off_by_default_and_refused_with_an_https_origin() {
        let (config, warnings) = config_from(&[]).unwrap();
        assert_eq!(config.test_race_delay, None);
        assert!(warnings.is_empty());

        // Production (the default origin is https): refused outright, whatever the value.
        for value in ["300", "1", "0"] {
            let err = config_from(&[(TEST_RACE_DELAY_VAR, value)]).err().expect("not in production");
            assert!(err.contains("test-only"), "{err}");
        }
        // One https origin among several is enough to refuse it.
        let err = config_from(&[
            ("WEBAUTHN_RP_ID", "localhost"),
            ("WEBAUTHN_ORIGIN", "http://localhost:4399,https://localhost:4400"),
            (TEST_RACE_DELAY_VAR, "300"),
        ])
        .err()
        .expect("an https origin refuses it");
        assert!(err.contains("test-only"), "{err}");

        // On http localhost: accepted, loudly.
        let mut pairs = LOCALHOST.to_vec();
        pairs.push((TEST_RACE_DELAY_VAR, "300"));
        let (config, warnings) = config_from(&pairs).unwrap();
        assert_eq!(config.test_race_delay, Some(std::time::Duration::from_millis(300)));
        assert!(warnings.iter().any(|w| w.contains("For tests only")), "{warnings:?}");

        // Zero is off; nonsense and more than five seconds are refused.
        let mut zero = LOCALHOST.to_vec();
        zero.push((TEST_RACE_DELAY_VAR, "0"));
        assert_eq!(config_from(&zero).unwrap().0.test_race_delay, None);
        for bad in ["fast", "-5", "5001"] {
            let mut pairs = LOCALHOST.to_vec();
            pairs.push((TEST_RACE_DELAY_VAR, bad));
            assert!(config_from(&pairs).is_err(), "{bad}");
        }
    }

    #[test]
    fn defaults_are_production_values_with_email_off() {
        let (config, warnings) = config_from(&[]).expect("defaults are valid");
        assert_eq!(config.webauthn_rp_id, "inspiredmile.com");
        assert_eq!(
            config.webauthn_origins,
            vec![Url::parse("https://sonnetman.inspiredmile.com").unwrap()]
        );
        assert_eq!(config.email_from, "Sonnet Man <signin@inspiredmile.com>");
        assert_eq!(config.email_mode, EmailMode::Disabled);
        assert!(!config.email_mode.is_available());
        assert_eq!(config.rate_limit_per_minute, 600);
        assert!(warnings.is_empty());
    }

    #[test]
    fn origin_list_is_split_trimmed_and_deduplicated() {
        let (config, _) = config_from(&[
            ("WEBAUTHN_RP_ID", "localhost"),
            (
                "WEBAUTHN_ORIGIN",
                " http://localhost:4399 , http://localhost:4321,http://localhost:4399 ",
            ),
        ])
        .expect("localhost http origins are allowed");
        assert_eq!(
            config.webauthn_origins,
            vec![
                Url::parse("http://localhost:4399").unwrap(),
                Url::parse("http://localhost:4321").unwrap(),
            ]
        );
    }

    #[test]
    fn subdomains_of_the_rp_id_are_accepted() {
        let origins = parse_webauthn_origins(
            "https://sonnetman.inspiredmile.com,https://inspiredmile.com",
            "inspiredmile.com",
        )
        .expect("both are on the rp id");
        assert_eq!(origins.len(), 2);
    }

    #[test]
    fn bad_origins_are_refused() {
        // Not on the relying-party ID (a look-alike suffix must not pass).
        assert!(parse_webauthn_origins("https://evilinspiredmile.com", "inspiredmile.com").is_err());
        assert!(parse_webauthn_origins("https://example.com", "inspiredmile.com").is_err());
        // Plain http off localhost.
        assert!(parse_webauthn_origins("http://sonnetman.inspiredmile.com", "inspiredmile.com").is_err());
        // localhost does not match the production rp id.
        assert!(parse_webauthn_origins("http://localhost:4399", "inspiredmile.com").is_err());
        // Not an origin.
        assert!(parse_webauthn_origins("https://inspiredmile.com/login", "inspiredmile.com").is_err());
        assert!(parse_webauthn_origins("not a url", "inspiredmile.com").is_err());
        assert!(parse_webauthn_origins(" , ", "inspiredmile.com").is_err());
        // One bad entry fails the whole list.
        assert!(config_from(&[(
            "WEBAUTHN_ORIGIN",
            "https://sonnetman.inspiredmile.com,https://example.com"
        )])
        .is_err());
    }

    #[test]
    fn a_resend_key_turns_email_on() {
        let (config, warnings) = config_from(&[("RESEND_API_KEY", " re_live_123 ")]).unwrap();
        assert_eq!(config.email_mode, EmailMode::Resend("re_live_123".into()));
        assert!(warnings.is_empty());
    }

    #[test]
    fn an_empty_resend_key_counts_as_absent() {
        let (config, _) = config_from(&[("RESEND_API_KEY", "  ")]).unwrap();
        assert_eq!(config.email_mode, EmailMode::Disabled);
    }

    #[test]
    fn dev_email_log_alone_logs_codes_and_warns() {
        let (config, warnings) = config_from(&[("DEV_EMAIL_LOG", "1")]).unwrap();
        assert_eq!(config.email_mode, EmailMode::DevLog);
        assert!(config.email_mode.is_available());
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("WRITTEN TO THE LOG"));
    }

    #[test]
    fn dev_email_log_is_off_for_falsey_values() {
        for value in ["0", "false", "", "no"] {
            let (config, warnings) = config_from(&[("DEV_EMAIL_LOG", value)]).unwrap();
            assert_eq!(config.email_mode, EmailMode::Disabled, "DEV_EMAIL_LOG={value:?}");
            assert!(warnings.is_empty());
        }
    }

    #[test]
    fn a_real_key_beats_dev_email_log_and_says_so() {
        let (config, warnings) =
            config_from(&[("RESEND_API_KEY", "re_live_123"), ("DEV_EMAIL_LOG", "1")]).unwrap();
        // Codes must never be logged where a real key is present.
        assert_eq!(config.email_mode, EmailMode::Resend("re_live_123".into()));
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("DEV_EMAIL_LOG IS IGNORED"));
    }

    #[test]
    fn rate_limit_is_configurable_and_never_zero() {
        let (config, _) = config_from(&[("RATE_LIMIT_PER_MINUTE", "5000")]).unwrap();
        assert_eq!(config.rate_limit_per_minute, 5000);
        let (config, _) = config_from(&[("RATE_LIMIT_PER_MINUTE", "0")]).unwrap();
        assert_eq!(config.rate_limit_per_minute, 600);
    }
}
