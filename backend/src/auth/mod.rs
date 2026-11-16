mod client_ip;
mod email;
mod email_code;
mod error;
mod handlers;
mod jwt;
mod mailer;
mod middleware;
mod passkeys;
mod sessions;

pub use client_ip::{client_addr, parse_trusted_proxies, TrustedProxy, DEFAULT_TRUSTED_PROXIES};
pub use handlers::{router, AuthContext};
pub use jwt::Claims;
pub use middleware::auth_middleware;
pub use passkeys::{purge_expired, purge_unused_accounts};
