//! One-time email sign-in codes: the rules, kept free of I/O so they can be tested directly.
//!
//! "Network" below is the key `client_ip::ClientAddr::limit_key` gives, as everywhere else
//! in the API: one IPv4 address, or one IPv6 /64.
//!
//! THE GUARANTEE, for any one address and any 60 minutes (`REQUEST_WINDOW_MINUTES`):
//!
//!   1. Its inbox gets at most `MAX_CODES_PER_ADDRESS` (10) codes, whoever asks and from
//!      however many networks, for sign-in and for "add this recovery email" together.
//!   2. One network can have at most `MAX_CODES_PER_ADDRESS_PER_NETWORK` (3) of those ten.
//!      A network that asks for more is refused its own excess, and only that. So one
//!      network can never stop another from getting a code for the address, and nor can
//!      any three together (3 x 3 = 9 < 10): using up an address's codes for an hour takes
//!      at least `NETWORKS_TO_USE_UP_AN_ADDRESS` (4) networks, each spending its whole share
//!      inside the same hour. (Every network also has its own cap over all addresses,
//!      `MAX_CODES_PER_NETWORK`, which touches nobody else.)
//!   3. Wrong guesses at the address's codes, over any 24 hours (`FAILURE_WINDOW_HOURS`):
//!      at most `MAX_FAILED_PER_NETWORK_PER_DAY` (10) from one network and
//!      `MAX_FAILED_PER_EMAIL_PER_DAY` (50) from everyone together, after which no code is
//!      sent to the address and no guess is judged. Again one network cannot reach the
//!      ceiling: that takes five. 50 guesses at one in a million each is the hard bound on
//!      online guessing against one account, whatever the attacker's means.
//!   4. Over all addresses, one network may make `MAX_FAILED_BY_NETWORK_PER_DAY` (30) wrong
//!      guesses a day, so it cannot guess at a thousand accounts at ten guesses each.
//!
//! All of it holds under parallel requests: `email.rs` takes the address's advisory lock
//! and then the network's, and holds both from the first count to the insert (or to the
//! miss being recorded), in one transaction.
//!
//! What keeps one party out of another's way besides the shares: a code is tied to the
//! browser that asked for it (a random cookie, `requester`). A guess is only ever compared
//! with the code that the guessing browser itself requested. So a stranger can neither use
//! up the attempts of your code nor withdraw it by asking for another.
//!
//! What this cannot do, said plainly: somebody with four or more networks who is set on it
//! can stop one address from getting codes for an hour at a time (and with five, from
//! signing in by email for a day, through the guessing ceiling). They cannot get in, and a
//! passkey sign-in is not affected. Any limit that protects an inbox or an account from
//! guessing can be spent by the attacker; the shares make that take several networks.

use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

/// Digits in a code.
pub const CODE_DIGITS: usize = 6;
/// A code is good for this long.
pub const CODE_TTL_MINUTES: i64 = 10;
/// Wrong guesses allowed against one code. The guess that reaches the limit kills the code.
pub const MAX_ATTEMPTS: i32 = 5;
/// The window every request cap counts over.
pub const REQUEST_WINDOW_MINUTES: i64 = 60;
/// Codes sent to one address in the window, whoever asks: the bound on its inbox.
pub const MAX_CODES_PER_ADDRESS: i64 = 10;
/// Codes one network may have sent to one address in the window: its share of the above.
pub const MAX_CODES_PER_ADDRESS_PER_NETWORK: i64 = 3;
/// Codes one network may ask for in the window, to any addresses.
pub const MAX_CODES_PER_NETWORK: i64 = 10;
/// The fewest networks that can use up one address's codes in the window together.
pub const NETWORKS_TO_USE_UP_AN_ADDRESS: i64 =
    (MAX_CODES_PER_ADDRESS + MAX_CODES_PER_ADDRESS_PER_NETWORK - 1) / MAX_CODES_PER_ADDRESS_PER_NETWORK;
// The guarantee in the module comment, checked when the crate is compiled: one network's
// share is less than the address's cap, and it takes at least four networks to use it up.
const _: () = assert!(MAX_CODES_PER_ADDRESS_PER_NETWORK < MAX_CODES_PER_ADDRESS);
const _: () = assert!(NETWORKS_TO_USE_UP_AN_ADDRESS >= 4);
/// Wrong guesses one network may make at one address's codes inside `FAILURE_WINDOW_HOURS`.
pub const MAX_FAILED_PER_NETWORK_PER_DAY: i64 = 10;
/// Wrong guesses everyone together may make at one address's codes in the same window.
pub const MAX_FAILED_PER_EMAIL_PER_DAY: i64 = 50;
/// Wrong guesses one network may make at any addresses' codes in the same window.
pub const MAX_FAILED_BY_NETWORK_PER_DAY: i64 = 30;
pub const FAILURE_WINDOW_HOURS: i64 = 24;
const _: () = assert!(MAX_FAILED_PER_NETWORK_PER_DAY < MAX_FAILED_PER_EMAIL_PER_DAY);
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

/// Wrong guesses already made in the failure window.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Failures {
    /// At this address's codes, by this network.
    pub at_address_by_network: i64,
    /// At this address's codes, by everyone.
    pub at_address_by_everyone: i64,
    /// At any address's codes, by this network.
    pub by_network: i64,
}

/// Whether one more guess at an address's code may be judged (and one more code sent).
pub fn guessing_allowed(failed: Failures) -> bool {
    failed.at_address_by_network < MAX_FAILED_PER_NETWORK_PER_DAY
        && failed.at_address_by_everyone < MAX_FAILED_PER_EMAIL_PER_DAY
        && failed.by_network < MAX_FAILED_BY_NETWORK_PER_DAY
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

/// Codes already issued inside `REQUEST_WINDOW_MINUTES`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Issued {
    /// To this address, at this network's request.
    pub to_address_by_network: i64,
    /// To this address, at anyone's request.
    pub to_address: i64,
    /// To any address, at this network's request.
    pub by_network: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RateLimit {
    Allowed,
    /// This network has had its share of this address's codes.
    NetworkShareUsed,
    /// The address's inbox has had its codes for the hour, from several networks.
    AddressFull,
    /// This network has asked for its codes for the hour, to any addresses.
    NetworkLimited,
}

/// Decide whether one more code may be sent. The network's own caps are looked at first,
/// so a network that is over its share hears about its share, not about the address.
pub fn check_rate(issued: Issued) -> RateLimit {
    if issued.to_address_by_network >= MAX_CODES_PER_ADDRESS_PER_NETWORK {
        RateLimit::NetworkShareUsed
    } else if issued.by_network >= MAX_CODES_PER_NETWORK {
        RateLimit::NetworkLimited
    } else if issued.to_address >= MAX_CODES_PER_ADDRESS {
        RateLimit::AddressFull
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

    fn issued(to_address_by_network: i64, to_address: i64, by_network: i64) -> Issued {
        Issued { to_address_by_network, to_address, by_network }
    }

    #[test]
    fn rate_limits_trip_at_their_thresholds() {
        assert_eq!(check_rate(issued(0, 0, 0)), RateLimit::Allowed);
        assert_eq!(
            check_rate(issued(MAX_CODES_PER_ADDRESS_PER_NETWORK - 1, MAX_CODES_PER_ADDRESS - 1, MAX_CODES_PER_NETWORK - 1)),
            RateLimit::Allowed
        );
        assert_eq!(check_rate(issued(MAX_CODES_PER_ADDRESS_PER_NETWORK, 3, 3)), RateLimit::NetworkShareUsed);
        assert_eq!(check_rate(issued(0, 0, MAX_CODES_PER_NETWORK)), RateLimit::NetworkLimited);
        assert_eq!(check_rate(issued(0, MAX_CODES_PER_ADDRESS, 0)), RateLimit::AddressFull);
        assert_eq!(MAX_CODES_PER_ADDRESS_PER_NETWORK, 3);
        assert_eq!(MAX_CODES_PER_ADDRESS, 10);
        assert_eq!(MAX_CODES_PER_NETWORK, 10);
        assert_eq!(REQUEST_WINDOW_MINUTES, 60);
    }

    /// The guarantee of the module comment, checked by playing it out: networks take turns
    /// asking for codes to one address, five times each. No network gets more than its
    /// share, the inbox gets at most its cap, and with up to four networks every one of
    /// them gets at least one code.
    #[test]
    fn no_network_can_take_another_networks_codes_for_an_address() {
        for networks in 1..=6usize {
            let mut per_network = vec![0i64; networks];
            let mut total = 0i64;
            // Each network asks five times; the turns interleave.
            for _round in 0..5 {
                for n in 0..networks {
                    let verdict = check_rate(issued(per_network[n], total, per_network[n]));
                    if verdict == RateLimit::Allowed {
                        per_network[n] += 1;
                        total += 1;
                    }
                }
            }
            assert!(total <= MAX_CODES_PER_ADDRESS, "{networks} networks: {total} codes");
            assert!(per_network.iter().all(|&c| c <= MAX_CODES_PER_ADDRESS_PER_NETWORK), "{per_network:?}");
            if networks as i64 <= NETWORKS_TO_USE_UP_AN_ADDRESS {
                assert!(per_network.iter().all(|&c| c >= 1), "{networks} networks: {per_network:?}");
            }
        }
        // One network alone, however long it keeps asking, leaves the others seven.
        let mut mine = 0;
        for _ in 0..100 {
            if check_rate(issued(mine, mine, mine)) == RateLimit::Allowed {
                mine += 1;
            }
        }
        assert_eq!(mine, MAX_CODES_PER_ADDRESS_PER_NETWORK);
        assert_eq!(check_rate(issued(0, mine, 0)), RateLimit::Allowed, "the owner's network still gets one");
        // Three networks at their shares: the fourth still gets one, the fifth does not.
        let three = 3 * MAX_CODES_PER_ADDRESS_PER_NETWORK;
        assert_eq!(check_rate(issued(0, three, 0)), RateLimit::Allowed);
        assert_eq!(check_rate(issued(0, three + 1, 0)), RateLimit::AddressFull);
        assert_eq!(NETWORKS_TO_USE_UP_AN_ADDRESS, 4);
    }

    fn failed(at_address_by_network: i64, at_address_by_everyone: i64, by_network: i64) -> Failures {
        Failures { at_address_by_network, at_address_by_everyone, by_network }
    }

    #[test]
    fn guessing_at_one_address_is_capped_per_network_and_overall() {
        assert!(guessing_allowed(failed(0, 0, 0)));
        assert!(guessing_allowed(failed(
            MAX_FAILED_PER_NETWORK_PER_DAY - 1,
            MAX_FAILED_PER_EMAIL_PER_DAY - 1,
            MAX_FAILED_BY_NETWORK_PER_DAY - 1
        )));
        // One network: ten wrong guesses a day at one address.
        let ten = MAX_FAILED_PER_NETWORK_PER_DAY;
        assert!(!guessing_allowed(failed(ten, ten, ten)));
        // Someone else's ten wrong guesses do not stop a network that made none...
        assert!(guessing_allowed(failed(0, ten, 0)));
        assert!(guessing_allowed(failed(0, MAX_FAILED_PER_EMAIL_PER_DAY - 1, 0)));
        // ...but fifty from everyone is the ceiling for the account, however many networks.
        assert!(!guessing_allowed(failed(0, MAX_FAILED_PER_EMAIL_PER_DAY, 0)));
        assert_eq!(MAX_FAILED_PER_NETWORK_PER_DAY, 10);
        assert_eq!(MAX_FAILED_PER_EMAIL_PER_DAY, 50);
    }

    #[test]
    fn one_network_cannot_guess_at_many_addresses_for_ever() {
        // Thirty wrong guesses a day over all addresses, wherever they were made...
        assert!(guessing_allowed(failed(0, 0, MAX_FAILED_BY_NETWORK_PER_DAY - 1)));
        assert!(!guessing_allowed(failed(0, 0, MAX_FAILED_BY_NETWORK_PER_DAY)));
        // ...which stops only that network.
        assert!(guessing_allowed(failed(0, 0, 0)));
        assert_eq!(MAX_FAILED_BY_NETWORK_PER_DAY, 30);
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
