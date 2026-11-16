use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::num::NonZeroU32;
use std::sync::Arc;

pub type GlobalLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

/// Global rate limiter shared by every client: `per_minute` requests a minute
/// (`RATE_LIMIT_PER_MINUTE`, default 60).
pub fn create_rate_limiter(per_minute: u32) -> GlobalLimiter {
    let per_minute = NonZeroU32::new(per_minute).unwrap_or(NonZeroU32::new(60).unwrap());
    Arc::new(RateLimiter::direct(Quota::per_minute(per_minute)))
}
