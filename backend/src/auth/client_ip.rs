use std::net::{IpAddr, SocketAddr};

use axum::http::HeaderMap;

/// The client address used for per-IP limits.
///
/// Production traffic arrives Cloudflare -> tunnel -> Caddy -> this API, so the socket peer
/// is always a proxy. Cloudflare sets `CF-Connecting-IP` itself and overwrites whatever the
/// visitor sent, which makes it the one header worth trusting; `X-Forwarded-For` (leftmost
/// entry) is the fallback for other proxies, and the socket peer the last resort.
///
/// The API port must not be reachable except through that chain: anyone who can reach it
/// directly can set these headers and dodge the per-IP limit (the per-email limit and the
/// attempt limit do not depend on them).
pub fn client_ip(headers: &HeaderMap, peer: Option<SocketAddr>) -> String {
    let header_ip = |name: &str| -> Option<IpAddr> {
        headers
            .get(name)?
            .to_str()
            .ok()?
            .split(',')
            .next()?
            .trim()
            .parse()
            .ok()
    };
    header_ip("cf-connecting-ip")
        .or_else(|| header_ip("x-forwarded-for"))
        .or(peer.map(|p| p.ip()))
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (k, v) in pairs {
            map.insert(*k, HeaderValue::from_static(v));
        }
        map
    }

    #[test]
    fn cloudflare_header_wins() {
        let h = headers(&[("cf-connecting-ip", "203.0.113.7"), ("x-forwarded-for", "198.51.100.1")]);
        let peer = Some("127.0.0.1:5000".parse().unwrap());
        assert_eq!(client_ip(&h, peer), "203.0.113.7");
    }

    #[test]
    fn forwarded_for_uses_the_leftmost_address() {
        let h = headers(&[("x-forwarded-for", "198.51.100.1, 10.0.0.2")]);
        assert_eq!(client_ip(&h, None), "198.51.100.1");
    }

    #[test]
    fn garbage_headers_fall_back_to_the_peer() {
        let h = headers(&[("cf-connecting-ip", "not-an-ip"), ("x-forwarded-for", "")]);
        let peer = Some("192.0.2.9:4000".parse().unwrap());
        assert_eq!(client_ip(&h, peer), "192.0.2.9");
        assert_eq!(client_ip(&h, None), "unknown");
    }

    #[test]
    fn ipv6_is_accepted() {
        let h = headers(&[("cf-connecting-ip", "2001:db8::1")]);
        assert_eq!(client_ip(&h, None), "2001:db8::1");
    }
}
