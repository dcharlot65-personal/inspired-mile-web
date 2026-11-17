use std::env;

use url::Url;

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

fn is_truthy(value: &str) -> bool {
    matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on")
}

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
    pub cors_origin: String,
    pub db_max_connections: u32,
    pub launch_date: String,
    /// WebAuthn relying-party ID. Passkeys are bound to it for good: changing it orphans
    /// every registered passkey.
    pub webauthn_rp_id: String,
    /// Origins a passkey ceremony may come from. The first is the primary one.
    pub webauthn_origins: Vec<Url>,
    pub email_mode: EmailMode,
    pub email_from: String,
    /// Requests per minute allowed to one client address.
    pub rate_limit_per_minute: u32,
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
        let (email_mode, warnings) = EmailMode::resolve(
            get("RESEND_API_KEY").as_deref(),
            get("DEV_EMAIL_LOG").as_deref(),
        );

        let config = Self {
            database_url: get("DATABASE_URL")
                .unwrap_or_else(|| "postgres://localhost/inspired_mile".into()),
            jwt_secret: get("JWT_SECRET")
                .unwrap_or_else(|| "dev-secret-change-in-production".into()),
            port: get("PORT").and_then(|p| p.parse().ok()).unwrap_or(3849),
            cors_origin: get("CORS_ORIGIN").unwrap_or_else(|| "http://localhost:4321".into()),
            db_max_connections: get("DB_MAX_CONNECTIONS")
                .and_then(|v| v.parse().ok())
                .unwrap_or(25),
            launch_date: get("LAUNCH_DATE").unwrap_or_else(|| "2026-04-01".into()),
            webauthn_rp_id,
            webauthn_origins,
            email_mode,
            email_from: non_empty("EMAIL_FROM").unwrap_or_else(|| DEFAULT_EMAIL_FROM.into()),
            rate_limit_per_minute: get("RATE_LIMIT_PER_MINUTE")
                .and_then(|v| v.parse().ok())
                .filter(|n| *n > 0)
                .unwrap_or(crate::rate_limit::DEFAULT_PER_MINUTE),
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

    fn config_from(pairs: &[(&str, &str)]) -> Result<(Config, Vec<String>), String> {
        let map: HashMap<String, String> =
            pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        Config::from_lookup(|name| map.get(name).cloned())
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
