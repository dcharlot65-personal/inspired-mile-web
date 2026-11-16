use governor::{clock::DefaultClock, state::keyed::DefaultKeyedStateStore, Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::Arc;

/// Default requests a minute for one client address.
pub const DEFAULT_PER_MINUTE: u32 = 600;

pub type IpLimiter = Arc<RateLimiter<String, DefaultKeyedStateStore<String>, DefaultClock>>;

/// Rate limiter keyed by client address: each address gets `per_minute` requests a minute
/// (`RATE_LIMIT_PER_MINUTE`).
///
/// It used to be one bucket of 60 a minute for the whole site, which a handful of players
/// would exhaust for everyone. The key comes from `auth::client_ip` (Cloudflare's header
/// first), so one visitor can only use up their own allowance. A classroom behind one
/// address shares one bucket, which is why the default is generous.
pub fn create_rate_limiter(per_minute: u32) -> IpLimiter {
    let per_minute =
        NonZeroU32::new(per_minute).unwrap_or(NonZeroU32::new(DEFAULT_PER_MINUTE).unwrap());
    Arc::new(RateLimiter::keyed(Quota::per_minute(per_minute)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_client_cannot_use_up_anothers_allowance() {
        let limiter = create_rate_limiter(3);
        let greedy = "203.0.113.7".to_string();
        let other = "198.51.100.1".to_string();
        for _ in 0..3 {
            assert!(limiter.check_key(&greedy).is_ok());
        }
        assert!(limiter.check_key(&greedy).is_err(), "the fourth request in a minute is refused");
        assert!(limiter.check_key(&other).is_ok(), "another address is unaffected");
    }

    #[test]
    fn zero_falls_back_to_the_default() {
        let limiter = create_rate_limiter(0);
        let ip = "203.0.113.7".to_string();
        for _ in 0..DEFAULT_PER_MINUTE {
            assert!(limiter.check_key(&ip).is_ok());
        }
        assert!(limiter.check_key(&ip).is_err());
    }
}
