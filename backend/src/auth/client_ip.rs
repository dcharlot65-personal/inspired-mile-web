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
//!
//! A proxy missing from the list is not an error the API can detect: it simply sees every
//! visitor as that proxy, and then the whole site shares one client's allowance. So the
//! API says, whatever `RUST_LOG` is (`crate::notice`): at start-up, which peers it trusts;
//! and, rate-limited, which peer sent a forwarding header it did not believe.

use std::collections::HashMap;
use std::fmt;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::{LazyLock, Mutex};

use axum::http::HeaderMap;

/// The peers trusted when `TRUSTED_PROXIES` is not set:
///   - `127.0.0.1`, `::1`: a proxy or tunnel on the API's own host;
///   - `10.10.10.1`: the LAN address of the MacBook Pro M4 whose Caddy fronts the site;
///   - `100.64.224.0`: prod's own Tailscale address (the API's host);
///   - `100.98.101.113`: the Tailscale address of that same MacBook Pro M4 (10.10.10.1).
///     Its Caddy reaches the API on prod at `100.64.224.0:3849` over the tailnet, so this is
///     the peer the production API sees for every visitor (checked on prod, 2026-11-16).
///     Without it every visitor was counted as one client.
///
/// If the site's proxy ever moves, its new address must be added (the start-up notice
/// lists what is trusted; an ignored-header notice names the peer that is not).
pub const DEFAULT_TRUSTED_PROXIES: &str = "127.0.0.1,::1,10.10.10.1,100.64.224.0,100.98.101.113";

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

/// An address as itself, a network in CIDR form.
impl fmt::Display for TrustedProxy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let max = if self.network.is_ipv4() { 32 } else { 128 };
        if self.prefix == max {
            write!(f, "{}", self.network)
        } else {
            write!(f, "{}/{}", self.network, self.prefix)
        }
    }
}

/// The start-up notice that says which peers are trusted.
pub fn trusted_proxies_notice(trusted: &[TrustedProxy]) -> String {
    if trusted.is_empty() {
        return "TRUSTED_PROXIES is empty: forwarding headers are never believed, and every \
                client is counted by its socket address"
            .to_string();
    }
    let list = trusted.iter().map(ToString::to_string).collect::<Vec<_>>().join(", ");
    format!(
        "TRUSTED_PROXIES: CF-Connecting-IP / X-Forwarded-For are believed only from {list}; \
         from any other peer the socket address is the client"
    )
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

/// One peer's ignored-header notice is repeated at most this often.
pub const IGNORED_NOTICE_EVERY_SECONDS: i64 = 600;
/// At most this many ignored-header notices in any clock minute, over all peers.
pub const IGNORED_NOTICES_PER_MINUTE: u32 = 10;
/// Peers remembered for the per-peer interval. Past this the memory starts again, which can
/// only make the notices more frequent, never hide the first one about a peer.
const IGNORED_PEERS_REMEMBERED: usize = 1024;

/// Which ignored-header notices to write. A notice tells an operator that a peer sent a
/// forwarding header that was not believed. If that peer is really the site's proxy, every
/// visitor is being counted as it and the request limit throttles the whole site; the fix
/// is to add it to `TRUSTED_PROXIES`.
///
/// The bounds keep a peer that sends the header on every request (the misconfigured proxy
/// itself, or anyone on the LAN) from flooding the log: each peer at most once every
/// `IGNORED_NOTICE_EVERY_SECONDS`, and at most `IGNORED_NOTICES_PER_MINUTE` lines a minute.
/// The first request from a new peer is always reported unless that minute's lines are
/// already used, in which case its next request after the minute is.
#[derive(Debug, Default)]
pub struct IgnoredHeaderNotices {
    /// Per peer: when it was last reported, and how many requests since were not.
    peers: HashMap<IpAddr, (i64, u64)>,
    minute: i64,
    lines_this_minute: u32,
    /// Reports left out because of the per-minute bound, said with the next line.
    left_out: u64,
}

impl IgnoredHeaderNotices {
    /// The line to write for an ignored header from `peer` at `now` (seconds), if any.
    pub fn note(&mut self, peer: IpAddr, now: i64) -> Option<String> {
        if let Some((last, since)) = self.peers.get_mut(&peer) {
            if now - *last < IGNORED_NOTICE_EVERY_SECONDS {
                *since += 1;
                return None;
            }
        }
        let minute = now.div_euclid(60);
        if minute != self.minute {
            self.minute = minute;
            self.lines_this_minute = 0;
        }
        if self.lines_this_minute >= IGNORED_NOTICES_PER_MINUTE {
            self.left_out += 1;
            return None;
        }
        self.lines_this_minute += 1;
        if self.peers.len() >= IGNORED_PEERS_REMEMBERED && !self.peers.contains_key(&peer) {
            self.peers.clear();
        }
        let since = self.peers.insert(peer, (now, 0)).map(|(_, since)| since).unwrap_or(0);
        let mut line = format!(
            "ignored CF-Connecting-IP / X-Forwarded-For from {peer}, which is not in TRUSTED_PROXIES; \
             requests from it are counted as {peer}. If {peer} is the site's reverse proxy, add it to \
             TRUSTED_PROXIES."
        );
        if since > 0 {
            line.push_str(&format!(" {since} more such requests from it since the last notice."));
        }
        if self.left_out > 0 {
            line.push_str(&format!(
                " ({} notices about other peers were left out: at most {IGNORED_NOTICES_PER_MINUTE} a minute.)",
                self.left_out
            ));
            self.left_out = 0;
        }
        Some(line)
    }
}

/// Report an ignored forwarding header, within the bounds of `IgnoredHeaderNotices`, as an
/// operator notice (written whatever `RUST_LOG` says).
fn note_ignored_header(peer: IpAddr) {
    static NOTICES: LazyLock<Mutex<IgnoredHeaderNotices>> = LazyLock::new(Default::default);
    let line = {
        let mut notices = NOTICES.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        notices.note(peer, chrono::Utc::now().timestamp())
    };
    if let Some(line) = line {
        tracing::warn!(target: crate::notice::TARGET, "{line}");
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
    fn the_default_list_is_loopback_the_fleet_hosts_and_the_proxys_tailnet_address() {
        let trusted = defaults();
        // 100.98.101.113 is the peer the production API sees: the Caddy on 10.10.10.1
        // reaches it over the tailnet.
        for inside in ["127.0.0.1", "::1", "10.10.10.1", "100.64.224.0", "100.98.101.113", "::ffff:127.0.0.1"] {
            assert!(is_trusted(inside.parse().unwrap(), &trusted), "{inside}");
        }
        for outside in [
            "10.10.10.2", "10.10.10.4", "100.64.224.1", "100.98.101.112", "100.98.101.114",
            "100.100.141.123", "192.168.4.37", "203.0.113.7", "::2",
        ] {
            assert!(!is_trusted(outside.parse().unwrap(), &trusted), "{outside}");
        }
        // Through the proxy's tailnet address, the visitor's address is the client.
        let h = headers(&[("cf-connecting-ip", "203.0.113.7")]);
        assert_eq!(client_addr(&h, peer("100.98.101.113:51000"), &trusted).limit_key(), "203.0.113.7");
    }

    #[test]
    fn the_start_up_notice_lists_every_trusted_peer() {
        let notice = trusted_proxies_notice(&defaults());
        assert!(
            notice.contains("127.0.0.1, ::1, 10.10.10.1, 100.64.224.0, 100.98.101.113"),
            "{notice}"
        );
        let nets = parse_trusted_proxies("100.64.0.0/10,fd7a:115c:a1e0::/48").unwrap();
        assert!(trusted_proxies_notice(&nets).contains("100.64.0.0/10, fd7a:115c:a1e0::/48"));
        assert!(trusted_proxies_notice(&[]).contains("never believed"));
    }

    #[test]
    fn an_ignored_header_is_reported_once_per_peer_per_ten_minutes() {
        let mut notices = IgnoredHeaderNotices::default();
        let proxy: IpAddr = "100.98.101.200".parse().unwrap();
        let t0 = 1_800_000_000;
        let first = notices.note(proxy, t0).expect("the first ignored header is reported");
        assert!(first.contains("ignored CF-Connecting-IP / X-Forwarded-For from 100.98.101.200"), "{first}");
        assert!(first.contains("not in TRUSTED_PROXIES"));
        // Every request after it, for ten minutes: nothing.
        for s in 1..IGNORED_NOTICE_EVERY_SECONDS {
            assert_eq!(notices.note(proxy, t0 + s), None, "second {s}");
        }
        // Then once more, with the count of what was not reported.
        let again = notices.note(proxy, t0 + IGNORED_NOTICE_EVERY_SECONDS).expect("reported again");
        assert!(again.contains(&format!("{} more such requests", IGNORED_NOTICE_EVERY_SECONDS - 1)), "{again}");
        assert_eq!(IGNORED_NOTICE_EVERY_SECONDS, 600);
    }

    #[test]
    fn another_peer_is_still_reported_but_never_more_than_ten_lines_a_minute() {
        let mut notices = IgnoredHeaderNotices::default();
        let t0 = 1_800_000_020; // twenty seconds into a minute
        let peers: Vec<IpAddr> = (1..=30).map(|i| format!("192.168.4.{i}").parse().unwrap()).collect();
        // A second peer is not hidden by the first one's interval.
        assert!(notices.note(peers[0], t0).is_some());
        assert!(notices.note(peers[1], t0).is_some());
        // Thirty peers in one minute: ten lines.
        let lines = peers.iter().filter_map(|p| notices.note(*p, t0 + 1)).count();
        assert_eq!(lines, (IGNORED_NOTICES_PER_MINUTE - 2) as usize);
        // The next minute, a peer left out is reported, and the line says how many were.
        let later = notices.note(peers[29], t0 + 60).expect("reported in the next minute");
        assert!(later.contains("notices about other peers were left out"), "{later}");
        assert_eq!(IGNORED_NOTICES_PER_MINUTE, 10);
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
