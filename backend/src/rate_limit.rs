use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::num::NonZeroU32;
use std::sync::Arc;

pub type GlobalLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

/// Global rate limiter: 60 requests per minute.
pub fn create_rate_limiter() -> GlobalLimiter {
    Arc::new(RateLimiter::direct(
        Quota::per_minute(NonZeroU32::new(60).unwrap()),
    ))
}
