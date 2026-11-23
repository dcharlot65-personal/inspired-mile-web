mod age;
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

pub use client_ip::{
    client_addr, parse_proxy_secret, parse_trusted_proxies, trusted_proxies_notice, ProxyTrust,
    DEFAULT_TRUSTED_PROXIES,
};
pub use age::{adults_only, is_adult};
pub use handlers::{router, AuthContext};
pub use jwt::Claims;
pub use middleware::auth_middleware;
pub use passkeys::{purge_expired, purge_unused_accounts};
pub use sessions::is_live as session_is_live;
