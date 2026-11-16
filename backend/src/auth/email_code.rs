//! One-time email sign-in codes: the rules, kept free of I/O so they can be tested directly.
//!
//! What bounds guessing, and what keeps one party out of another's way:
//!
//!   - A code is tied to the browser that asked for it (a random cookie, `requester`).
//!     A guess is only ever compared with the code that the guessing browser itself
//!     requested. So a stranger can neither use up the attempts of your code nor withdraw
//!     it by asking for another: their requests and guesses touch only their own codes.
//!   - Wrong guesses are counted per address guessed at: `MAX_FAILED_PER_NETWORK_PER_DAY`
//!     from one network (IPv4 address or IPv6 /64) and `MAX_FAILED_PER_EMAIL_PER_DAY` from
//!     everyone together. The second is the hard bound on online guessing against one
//!     account: 50 guesses a day at one in a million each, whatever the attacker's means.
//!     It used to be 1,440 a day, for ever.
//!   - The request limits are per address and network (`MAX_REQUESTS_PER_EMAIL`), with a
//!     wider cap over all networks (`MAX_REQUESTS_PER_EMAIL_ALL`) so an inbox cannot be
//!     flooded.
//!
//! What this cannot do, said plainly: somebody with several networks who is set on it can
//! still stop one address from signing in BY EMAIL for a while, either by using up the
//! all-network request cap (ten an hour) or the all-network failure cap (fifty a day).
//! They cannot get in, and a passkey sign-in is not affected. Any limit that protects an
//! account from guessing can be spent by the guesser; the caps are set so that it takes
//! more than one machine to do it.

use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

/// Digits in a code.
pub const CODE_DIGITS: usize = 6;
/// A code is good for this long.
pub const CODE_TTL_MINUTES: i64 = 10;
/// Wrong guesses allowed against one code. The guess that reaches the limit kills the code.
pub const MAX_ATTEMPTS: i32 = 5;
/// Codes one network may ask for, for one address, inside `EMAIL_WINDOW_MINUTES`.
pub const MAX_REQUESTS_PER_EMAIL: i64 = 3;
pub const EMAIL_WINDOW_MINUTES: i64 = 15;
/// Codes that may be sent to one address inside `IP_WINDOW_MINUTES`, whoever asks.
pub const MAX_REQUESTS_PER_EMAIL_ALL: i64 = 10;
/// Codes one network (IPv4 address, IPv6 /64) may ask for inside `IP_WINDOW_MINUTES`.
pub const MAX_REQUESTS_PER_IP: i64 = 10;
pub const IP_WINDOW_MINUTES: i64 = 60;
/// Wrong guesses one network may make at one address's codes inside `FAILURE_WINDOW_HOURS`.
pub const MAX_FAILED_PER_NETWORK_PER_DAY: i64 = 10;
/// Wrong guesses everyone together may make at one address's codes in the same window.
pub const MAX_FAILED_PER_EMAIL_PER_DAY: i64 = 50;
pub const FAILURE_WINDOW_HOURS: i64 = 24;
/// How long the cookie that names the requesting browser lives: a code's life and a bit.
pub const REQUESTER_COOKIE_MINUTES: i64 = 15;

/// Trim and lower-case an address, or `None` when it cannot be one.
///
/// This is a shape check, not validation: the proof that an address works is that the
/// code sent to it comes back.
pub fn normalize_email(raw: &str) -> Option<String> {
    let email = raw.trim().to_lowercase();
    if email.is_empty() || email.len() > 255 {
        return None;
    }
    if email.chars().any(|c| c.is_whitespace() || c.is_control() || matches!(c, '<' | '>' | ',' | ';' | '"')) {
        return None;
    }
    let (local, domain) = email.split_once('@')?;
    if local.is_empty() || local.len() > 64 || domain.contains('@') {
        return None;
    }
    if !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
        || domain.contains("..")
        || domain.starts_with('-')
    {
        return None;
    }
    Some(email)
}

/// A uniformly random code of `CODE_DIGITS` digits, leading zeros kept.
pub fn generate_code() -> String {
    const RANGE: u32 = 1_000_000;
    // Reject the top of the u32 range so every code is equally likely.
    const LIMIT: u32 = u32::MAX - (u32::MAX % RANGE);
    loop {
        let value: u32 = rand::random();
        if value < LIMIT {
            return format!("{:0width$}", value % RANGE, width = CODE_DIGITS);
        }
    }
}

/// A fresh random value for the cookie that names the browser asking for a code.
pub fn new_requester_token() -> String {
    format!("{:032x}", rand::random::<u128>())
}

/// Only a value this server could have issued is worth looking up.
pub fn is_requester_token(value: &str) -> bool {
    value.len() == 32 && value.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// What is stored of the requester cookie: an HMAC, so the database does not hold values
/// that would pass as the cookie.
pub fn hash_requester(key: &str, token: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(key.as_bytes())
        .expect("HMAC accepts a key of any length");
    mac.update(b"inspired-mile:email-code-requester:v1\0");
    mac.update(token.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Whether one more guess at an address's code may be judged, from the wrong guesses
/// already made in the window by this network and by everyone.
pub fn guessing_allowed(failed_by_network: i64, failed_by_everyone: i64) -> bool {
    failed_by_network < MAX_FAILED_PER_NETWORK_PER_DAY && failed_by_everyone < MAX_FAILED_PER_EMAIL_PER_DAY
}

fn mac_for(secret: &str, email: &str, code: &str) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .expect("HMAC accepts a key of any length");
    mac.update(b"inspired-mile:email-code:v1\0");
    mac.update(email.as_bytes());
    mac.update(b"\0");
    mac.update(code.as_bytes());
    mac
}

/// What is stored instead of the code: an HMAC keyed by the email-code key (derived from
/// the server secret, never the session-signing secret itself) and bound to the address. A six-digit code has too little entropy for a bare hash to protect it, and a
/// code issued to one address must not verify for another.
pub fn hash_code(secret: &str, email: &str, code: &str) -> String {
    hex::encode(mac_for(secret, email, code).finalize().into_bytes())
}

/// Constant-time check of a submitted code against a stored hash.
pub fn code_matches(secret: &str, email: &str, code: &str, stored_hash: &str) -> bool {
    let Ok(expected) = hex::decode(stored_hash.trim()) else {
        return false;
    };
    mac_for(secret, email, code).verify_slice(&expected).is_ok()
}

/// A submitted code is only worth hashing when it has the right shape.
pub fn is_code_shaped(code: &str) -> bool {
    code.len() == CODE_DIGITS && code.bytes().all(|b| b.is_ascii_digit())
}

/// The state of the newest code issued to an address.
#[derive(Clone, Debug)]
pub struct CodeRecord {
    pub code_hash: String,
    pub attempts: i32,
    pub expires_at: DateTime<Utc>,
    pub consumed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CodeCheck {
    /// Right code, in time, first use: sign in, and mark the code used.
    Accepted,
    /// Wrong code: count the attempt.
    Wrong,
    /// Past its expiry.
    Expired,
    /// Already used once, or withdrawn.
    Consumed,
    /// Too many wrong guesses: the code is dead even if this guess is right.
    TooManyAttempts,
}

/// Judge a submitted code against the record. Order matters: a used, expired or exhausted
/// code is refused before the guess is even compared.
pub fn check_code(
    record: &CodeRecord,
    secret: &str,
    email: &str,
    submitted: &str,
    now: DateTime<Utc>,
) -> CodeCheck {
    if record.consumed_at.is_some() {
        return CodeCheck::Consumed;
    }
    if now >= record.expires_at {
        return CodeCheck::Expired;
    }
    if record.attempts >= MAX_ATTEMPTS {
        return CodeCheck::TooManyAttempts;
    }
    if is_code_shaped(submitted) && code_matches(secret, email, submitted, &record.code_hash) {
        CodeCheck::Accepted
    } else {
        CodeCheck::Wrong
    }
}

pub fn expiry_from(now: DateTime<Utc>) -> DateTime<Utc> {
    now + Duration::minutes(CODE_TTL_MINUTES)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RateLimit {
    Allowed,
    /// Too many codes for this address: from this network, or from everyone together.
    EmailLimited,
    /// This client asked too often.
    IpLimited,
}

/// Decide from the number of codes already issued inside each window:
/// `recent_for_email` to this address from this network, `recent_for_email_all` to this
/// address from anyone, `recent_for_ip` to any address from this network.
pub fn check_rate(recent_for_email: i64, recent_for_email_all: i64, recent_for_ip: i64) -> RateLimit {
    if recent_for_email >= MAX_REQUESTS_PER_EMAIL || recent_for_email_all >= MAX_REQUESTS_PER_EMAIL_ALL {
        RateLimit::EmailLimited
    } else if recent_for_ip >= MAX_REQUESTS_PER_IP {
        RateLimit::IpLimited
    } else {
        RateLimit::Allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret";
    const EMAIL: &str = "viola@example.com";

    fn record(code: &str, now: DateTime<Utc>) -> CodeRecord {
        CodeRecord {
            code_hash: hash_code(SECRET, EMAIL, code),
            attempts: 0,
            expires_at: expiry_from(now),
            consumed_at: None,
        }
    }

    #[test]
    fn emails_are_trimmed_and_lower_cased() {
        assert_eq!(normalize_email("  Viola@Example.COM "), Some("viola@example.com".into()));
        assert_eq!(normalize_email("a.b+tag@mail.example.org"), Some("a.b+tag@mail.example.org".into()));
    }

    #[test]
    fn things_that_are_not_addresses_are_refused() {
        for bad in [
            "", " ", "viola", "viola@", "@example.com", "viola@example", "viola@@example.com",
            "vi ola@example.com", "viola@exa mple.com", "viola@.example.com", "viola@example.com.",
            "viola@example..com", "a@b.com,c@d.com", "Viola <viola@example.com>", "viola@example.com\r\nBcc: x@y.z",
        ] {
            assert_eq!(normalize_email(bad), None, "{bad:?} should be refused");
        }
        let long = format!("{}@example.com", "a".repeat(65));
        assert_eq!(normalize_email(&long), None);
    }

    #[test]
    fn codes_are_six_digits() {
        for _ in 0..2000 {
            let code = generate_code();
            assert!(is_code_shaped(&code), "{code:?}");
        }
    }

    #[test]
    fn codes_vary() {
        let codes: std::collections::HashSet<String> = (0..200).map(|_| generate_code()).collect();
        assert!(codes.len() > 150, "only {} distinct codes in 200", codes.len());
    }

    #[test]
    fn the_stored_hash_is_not_the_code_and_is_keyed() {
        let hash = hash_code(SECRET, EMAIL, "123456");
        assert_eq!(hash.len(), 64);
        assert!(!hash.contains("123456"));
        assert_eq!(hash, hash_code(SECRET, EMAIL, "123456"), "hashing is deterministic");
        assert_ne!(hash, hash_code("other-secret", EMAIL, "123456"), "bound to the server secret");
        assert_ne!(hash, hash_code(SECRET, "other@example.com", "123456"), "bound to the address");
        assert_ne!(hash, hash_code(SECRET, EMAIL, "123457"));
    }

    #[test]
    fn a_code_matches_only_itself() {
        let hash = hash_code(SECRET, EMAIL, "042917");
        assert!(code_matches(SECRET, EMAIL, "042917", &hash));
        assert!(!code_matches(SECRET, EMAIL, "042918", &hash));
        assert!(!code_matches(SECRET, "other@example.com", "042917", &hash));
        assert!(!code_matches("other-secret", EMAIL, "042917", &hash));
        assert!(!code_matches(SECRET, EMAIL, "042917", "not-hex"));
        assert!(!code_matches(SECRET, EMAIL, "042917", ""));
    }

    #[test]
    fn the_right_code_in_time_is_accepted() {
        let now = Utc::now();
        let rec = record("111222", now);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", now), CodeCheck::Accepted);
        let almost = now + Duration::minutes(CODE_TTL_MINUTES) - Duration::seconds(1);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", almost), CodeCheck::Accepted);
    }

    #[test]
    fn a_wrong_or_misshapen_code_is_wrong() {
        let now = Utc::now();
        let rec = record("111222", now);
        for guess in ["111223", "", "11122", "1112222", "abcdef", " 111222", "１１１２２２"] {
            assert_eq!(check_code(&rec, SECRET, EMAIL, guess, now), CodeCheck::Wrong, "{guess:?}");
        }
    }

    #[test]
    fn a_code_expires_after_ten_minutes() {
        let now = Utc::now();
        let rec = record("111222", now);
        assert_eq!(rec.expires_at - now, Duration::minutes(10));
        let at_expiry = now + Duration::minutes(10);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", at_expiry), CodeCheck::Expired);
        let later = now + Duration::hours(3);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", later), CodeCheck::Expired);
    }

    #[test]
    fn a_code_works_once() {
        let now = Utc::now();
        let mut rec = record("111222", now);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", now), CodeCheck::Accepted);
        rec.consumed_at = Some(now);
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", now), CodeCheck::Consumed);
    }

    #[test]
    fn five_wrong_guesses_kill_the_code() {
        let now = Utc::now();
        let mut rec = record("111222", now);
        for attempt in 0..MAX_ATTEMPTS {
            assert_eq!(
                check_code(&rec, SECRET, EMAIL, "000000", now),
                CodeCheck::Wrong,
                "guess {attempt} is still judged"
            );
            rec.attempts += 1;
        }
        assert_eq!(MAX_ATTEMPTS, 5);
        // The right code no longer helps.
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", now), CodeCheck::TooManyAttempts);
    }

    #[test]
    fn the_right_code_still_works_on_the_last_allowed_attempt() {
        let now = Utc::now();
        let mut rec = record("111222", now);
        rec.attempts = MAX_ATTEMPTS - 1;
        assert_eq!(check_code(&rec, SECRET, EMAIL, "111222", now), CodeCheck::Accepted);
    }

    #[test]
    fn rate_limits_trip_at_their_thresholds() {
        assert_eq!(check_rate(0, 0, 0), RateLimit::Allowed);
        assert_eq!(
            check_rate(MAX_REQUESTS_PER_EMAIL - 1, MAX_REQUESTS_PER_EMAIL_ALL - 1, MAX_REQUESTS_PER_IP - 1),
            RateLimit::Allowed
        );
        assert_eq!(check_rate(MAX_REQUESTS_PER_EMAIL, MAX_REQUESTS_PER_EMAIL, 0), RateLimit::EmailLimited);
        assert_eq!(check_rate(0, 0, MAX_REQUESTS_PER_IP), RateLimit::IpLimited);
        assert_eq!(
            check_rate(MAX_REQUESTS_PER_EMAIL + 5, MAX_REQUESTS_PER_EMAIL + 5, MAX_REQUESTS_PER_IP + 5),
            RateLimit::EmailLimited
        );
        assert_eq!(MAX_REQUESTS_PER_EMAIL, 3);
        assert_eq!(MAX_REQUESTS_PER_IP, 10);
    }

    #[test]
    fn a_stranger_asking_for_codes_does_not_use_up_your_allowance() {
        // Three codes were sent to this address at someone else's request. A request from
        // another network is still served...
        assert_eq!(check_rate(0, MAX_REQUESTS_PER_EMAIL, 0), RateLimit::Allowed);
        assert_eq!(check_rate(0, MAX_REQUESTS_PER_EMAIL_ALL - 1, 0), RateLimit::Allowed);
        // ...until the cap that keeps an inbox from being flooded.
        assert_eq!(check_rate(0, MAX_REQUESTS_PER_EMAIL_ALL, 0), RateLimit::EmailLimited);
        assert_eq!(MAX_REQUESTS_PER_EMAIL_ALL, 10);
    }

    #[test]
    fn guessing_at_one_address_is_capped_per_network_and_overall() {
        assert!(guessing_allowed(0, 0));
        assert!(guessing_allowed(MAX_FAILED_PER_NETWORK_PER_DAY - 1, MAX_FAILED_PER_EMAIL_PER_DAY - 1));
        // One network: ten wrong guesses a day.
        assert!(!guessing_allowed(MAX_FAILED_PER_NETWORK_PER_DAY, MAX_FAILED_PER_NETWORK_PER_DAY));
        // Someone else's ten wrong guesses do not stop a network that made none...
        assert!(guessing_allowed(0, MAX_FAILED_PER_NETWORK_PER_DAY));
        assert!(guessing_allowed(0, MAX_FAILED_PER_EMAIL_PER_DAY - 1));
        // ...but fifty from everyone is the ceiling for the account, however many networks.
        assert!(!guessing_allowed(0, MAX_FAILED_PER_EMAIL_PER_DAY));
        assert_eq!(MAX_FAILED_PER_NETWORK_PER_DAY, 10);
        assert_eq!(MAX_FAILED_PER_EMAIL_PER_DAY, 50);
    }

    #[test]
    fn requester_tokens_are_random_well_formed_and_stored_hashed() {
        let a = new_requester_token();
        let b = new_requester_token();
        assert_ne!(a, b);
        assert!(is_requester_token(&a), "{a}");
        for bad in ["", "abc", &a[..31], &format!("{a}0"), &a.to_uppercase().replace(char::is_numeric, "A"), "g".repeat(32).as_str()] {
            assert!(!is_requester_token(bad), "{bad:?}");
        }
        let hash = hash_requester(SECRET, &a);
        assert_eq!(hash.len(), 64);
        assert!(!hash.contains(&a));
        assert_eq!(hash, hash_requester(SECRET, &a));
        assert_ne!(hash, hash_requester(SECRET, &b));
        assert_ne!(hash, hash_requester("other-key", &a));
    }
}
