//! Who is asking, for the per-address limits.
//!
//! Production traffic arrives Cloudflare -> tunnel -> Caddy -> this API, so the socket peer
//! is a proxy and the visitor's address is in a header. But the API port also answers
//! directly on the owner's LAN and tailnet, where anyone can write any header. So the
//! forwarding headers are believed only when the socket peer is one of the configured
//! proxies (`TRUSTED_PROXIES`); from any other peer they are ignored and the peer's own
//! address is used.
//!
//! Limits are keyed on a network, not a single address: an ordinary IPv6 connection owns a
//! whole /64 (2^64 addresses), so a limit per address is no limit at all.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::atomic::{AtomicI64, Ordering};

use axum::http::HeaderMap;

/// Loopback (Caddy or a tunnel on the same host) and the two fleet hosts named in
/// CLAUDE.md: the Caddy that fronts the site (10.10.10.1) and prod itself (100.64.224.0).
pub const DEFAULT_TRUSTED_PROXIES: &str = "127.0.0.1,::1,10.10.10.1,100.64.224.0";

/// One entry of `TRUSTED_PROXIES`: an address, or a network in CIDR form.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TrustedProxy {
    network: IpAddr,
    prefix: u8,
}

/// IPv4 addresses that arrive as IPv4-mapped IPv6 (`::ffff:a.b.c.d`) are IPv4.
fn canonical(ip: IpAddr) -> IpAddr {
    ip.to_canonical()
}

fn mask_v4(ip: Ipv4Addr, prefix: u8) -> Ipv4Addr {
    let bits = u32::from(ip);
    let mask = if prefix == 0 { 0 } else { u32::MAX << (32 - u32::from(prefix.min(32))) };
    Ipv4Addr::from(bits & mask)
}

fn mask_v6(ip: Ipv6Addr, prefix: u8) -> Ipv6Addr {
    let bits = u128::from(ip);
    let mask = if prefix == 0 { 0 } else { u128::MAX << (128 - u32::from(prefix.min(128))) };
    Ipv6Addr::from(bits & mask)
}

impl TrustedProxy {
    pub fn parse(entry: &str) -> Result<Self, String> {
        let entry = entry.trim();
        let (addr, prefix) = match entry.split_once('/') {
            Some((addr, prefix)) => (addr, Some(prefix)),
            None => (entry, None),
        };
        let ip: IpAddr = addr
            .trim()
            .parse()
            .map_err(|_| format!("TRUSTED_PROXIES entry '{entry}' is not an IP address or CIDR network"))?;
        let ip = canonical(ip);
        let max = if ip.is_ipv4() { 32 } else { 128 };
        let prefix = match prefix {
            None => max,
            Some(p) => p
                .trim()
                .parse::<u8>()
                .ok()
                .filter(|p| *p <= max)
                .ok_or_else(|| format!("TRUSTED_PROXIES entry '{entry}' has a bad prefix length"))?,
        };
        let network = match ip {
            IpAddr::V4(v4) => IpAddr::V4(mask_v4(v4, prefix)),
            IpAddr::V6(v6) => IpAddr::V6(mask_v6(v6, prefix)),
        };
        Ok(Self { network, prefix })
    }

    pub fn contains(&self, ip: IpAddr) -> bool {
        match (self.network, canonical(ip)) {
            (IpAddr::V4(net), IpAddr::V4(ip)) => mask_v4(ip, self.prefix) == net,
            (IpAddr::V6(net), IpAddr::V6(ip)) => mask_v6(ip, self.prefix) == net,
            _ => false,
        }
    }
}

/// Parse `TRUSTED_PROXIES`: addresses or CIDR networks separated by commas. An empty list
/// is allowed and means no header is ever believed.
pub fn parse_trusted_proxies(raw: &str) -> Result<Vec<TrustedProxy>, String> {
    raw.split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(TrustedProxy::parse)
        .collect()
}

fn is_trusted(ip: IpAddr, trusted: &[TrustedProxy]) -> bool {
    trusted.iter().any(|proxy| proxy.contains(ip))
}

/// The address a request is counted against, or none when even the socket has no address
/// (which only happens in tests that build a request by hand).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ClientAddr(Option<IpAddr>);

impl ClientAddr {
    /// The key for request limits and email-code limits: the address itself for IPv4, the
    /// /64 for IPv6.
    pub fn limit_key(&self) -> String {
        match self.0 {
            None => "unknown".to_string(),
            Some(IpAddr::V4(v4)) => v4.to_string(),
            Some(IpAddr::V6(v6)) => format!("{}/64", mask_v6(v6, 64)),
        }
    }

    /// The key for the sign-up budget, which is the one limit that guards the size of the
    /// database: the /24 for IPv4, the /64 for IPv6.
    pub fn signup_key(&self) -> String {
        match self.0 {
            None => "unknown".to_string(),
            Some(IpAddr::V4(v4)) => format!("{}/24", mask_v4(v4, 24)),
            Some(IpAddr::V6(v6)) => format!("{}/64", mask_v6(v6, 64)),
        }
    }
}

/// The client address of a request.
///
/// From a trusted proxy: `CF-Connecting-IP` (Cloudflare sets it itself and overwrites
/// whatever the visitor sent), else the rightmost `X-Forwarded-For` entry that is not
/// itself a trusted proxy (entries further left are whatever the client chose to send),
/// else the proxy's own address. From any other peer: the peer, whatever the headers say.
pub fn client_addr(
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
    trusted: &[TrustedProxy],
) -> ClientAddr {
    let Some(peer_ip) = peer.map(|p| canonical(p.ip())) else {
        return ClientAddr(None);
    };
    if !is_trusted(peer_ip, trusted) {
        if headers.contains_key("cf-connecting-ip") || headers.contains_key("x-forwarded-for") {
            note_ignored_header(peer_ip);
        }
        return ClientAddr(Some(peer_ip));
    }

    let cloudflare = headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<IpAddr>().ok())
        .map(canonical);
    if let Some(ip) = cloudflare {
        return ClientAddr(Some(ip));
    }

    let forwarded = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(','))
        .filter_map(|part| part.trim().parse::<IpAddr>().ok())
        .map(canonical)
        .collect::<Vec<_>>();
    let from_header = forwarded.into_iter().rev().find(|ip| !is_trusted(*ip, trusted));
    ClientAddr(Some(from_header.unwrap_or(peer_ip)))
}

/// Say, at most once a minute, that a forwarding header was ignored. If the peer named is
/// really the site's proxy, every visitor is being counted as that one address and the
/// request limit will throttle the whole site: add it to `TRUSTED_PROXIES`.
fn note_ignored_header(peer: IpAddr) {
    static LAST: AtomicI64 = AtomicI64::new(0);
    let now = chrono::Utc::now().timestamp();
    let last = LAST.load(Ordering::Relaxed);
    if now - last >= 60 && LAST.compare_exchange(last, now, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
        tracing::warn!(
            "ignored CF-Connecting-IP / X-Forwarded-For from {peer}, which is not in TRUSTED_PROXIES; \
             requests from it are counted as {peer}. If {peer} is the site's reverse proxy, add it."
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (k, v) in pairs {
            map.append(*k, HeaderValue::from_static(v));
        }
        map
    }

    fn defaults() -> Vec<TrustedProxy> {
        parse_trusted_proxies(DEFAULT_TRUSTED_PROXIES).unwrap()
    }

    fn peer(addr: &str) -> Option<SocketAddr> {
        Some(addr.parse().unwrap())
    }

    #[test]
    fn the_default_list_is_loopback_and_the_two_fleet_hosts() {
        let trusted = defaults();
        for inside in ["127.0.0.1", "::1", "10.10.10.1", "100.64.224.0", "::ffff:127.0.0.1"] {
            assert!(is_trusted(inside.parse().unwrap(), &trusted), "{inside}");
        }
        for outside in ["10.10.10.2", "10.10.10.4", "100.64.224.1", "192.168.4.37", "203.0.113.7", "::2"] {
            assert!(!is_trusted(outside.parse().unwrap(), &trusted), "{outside}");
        }
    }

    #[test]
    fn a_trusted_proxy_is_believed_and_cloudflare_wins() {
        let h = headers(&[("cf-connecting-ip", "203.0.113.7"), ("x-forwarded-for", "198.51.100.1")]);
        assert_eq!(client_addr(&h, peer("127.0.0.1:5000"), &defaults()).limit_key(), "203.0.113.7");
        assert_eq!(client_addr(&h, peer("10.10.10.1:5000"), &defaults()).limit_key(), "203.0.113.7");
    }

    #[test]
    fn headers_from_any_other_peer_are_ignored() {
        // A machine on the LAN or the tailnet talking to the port directly.
        let h = headers(&[("cf-connecting-ip", "203.0.113.7"), ("x-forwarded-for", "198.51.100.1")]);
        for direct in ["10.10.10.4:40000", "100.100.141.123:40000", "192.168.4.20:40000", "[fd7a:115c:a1e0::1]:40000"] {
            let addr = client_addr(&h, peer(direct), &defaults());
            assert_ne!(addr.limit_key(), "203.0.113.7", "{direct} must not choose its own address");
            assert_ne!(addr.limit_key(), "198.51.100.1", "{direct}");
        }
        assert_eq!(client_addr(&h, peer("10.10.10.4:40000"), &defaults()).limit_key(), "10.10.10.4");
        // And with an empty list nothing is believed, loopback included.
        assert_eq!(client_addr(&h, peer("127.0.0.1:5000"), &[]).limit_key(), "127.0.0.1");
    }

    #[test]
    fn forwarded_for_uses_the_rightmost_address_that_is_not_a_proxy() {
        // The leftmost entry is whatever the client sent; the proxy appended the real one.
        let h = headers(&[("x-forwarded-for", "1.2.3.4, 198.51.100.1, 10.10.10.1")]);
        assert_eq!(client_addr(&h, peer("127.0.0.1:5000"), &defaults()).limit_key(), "198.51.100.1");
        // Split over two header lines, same answer.
        let h = headers(&[("x-forwarded-for", "1.2.3.4"), ("x-forwarded-for", "198.51.100.1")]);
        assert_eq!(client_addr(&h, peer("127.0.0.1:5000"), &defaults()).limit_key(), "198.51.100.1");
    }

    #[test]
    fn garbage_headers_fall_back_to_the_peer() {
        let h = headers(&[("cf-connecting-ip", "not-an-ip"), ("x-forwarded-for", "")]);
        assert_eq!(client_addr(&h, peer("127.0.0.1:4000"), &defaults()).limit_key(), "127.0.0.1");
        assert_eq!(client_addr(&h, None, &defaults()).limit_key(), "unknown");
    }

    #[test]
    fn ipv6_is_keyed_on_its_64() {
        let trusted = defaults();
        let key = |ip: &'static str| {
            client_addr(&headers(&[("cf-connecting-ip", ip)]), peer("127.0.0.1:1"), &trusted).limit_key()
        };
        // Any address inside one /64 is the same client.
        assert_eq!(key("2001:db8:1:2::1"), "2001:db8:1:2::/64");
        assert_eq!(key("2001:db8:1:2:ffff:ffff:ffff:ffff"), "2001:db8:1:2::/64");
        assert_eq!(key("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), key("2001:db8:1:2::1"));
        // The next /64 is someone else.
        assert_ne!(key("2001:db8:1:3::1"), key("2001:db8:1:2::1"));
        // IPv4 keeps its full address for the request limit.
        assert_eq!(key("203.0.113.7"), "203.0.113.7");
        assert_ne!(key("203.0.113.8"), key("203.0.113.7"));
        // An IPv4-mapped address is the IPv4 address.
        assert_eq!(key("::ffff:203.0.113.7"), "203.0.113.7");
    }

    #[test]
    fn the_sign_up_budget_is_keyed_on_a_24_or_a_64() {
        let trusted = defaults();
        let key = |ip: &'static str| {
            client_addr(&headers(&[("cf-connecting-ip", ip)]), peer("127.0.0.1:1"), &trusted).signup_key()
        };
        assert_eq!(key("203.0.113.7"), "203.0.113.0/24");
        assert_eq!(key("203.0.113.250"), "203.0.113.0/24");
        assert_ne!(key("203.0.114.7"), key("203.0.113.7"));
        assert_eq!(key("2001:db8:1:2:aaaa::9"), "2001:db8:1:2::/64");
        assert_eq!(client_addr(&HeaderMap::new(), None, &trusted).signup_key(), "unknown");
    }

    #[test]
    fn trusted_proxies_accept_networks_and_refuse_nonsense() {
        let list = parse_trusted_proxies(" 100.64.0.0/10 , fd7a:115c:a1e0::/48 ,, 192.168.4.37 ").unwrap();
        assert_eq!(list.len(), 3);
        assert!(is_trusted("100.100.141.123".parse().unwrap(), &list));
        assert!(!is_trusted("100.128.0.1".parse().unwrap(), &list));
        assert!(is_trusted("fd7a:115c:a1e0:ab12::1".parse().unwrap(), &list));
        assert!(is_trusted("192.168.4.37".parse().unwrap(), &list));
        assert!(!is_trusted("192.168.4.38".parse().unwrap(), &list));
        assert!(parse_trusted_proxies("").unwrap().is_empty());
        for bad in ["caddy.local", "10.0.0.1/33", "::1/129", "10.0.0.1/x", "300.1.1.1"] {
            assert!(parse_trusted_proxies(bad).is_err(), "{bad}");
        }
    }
}
