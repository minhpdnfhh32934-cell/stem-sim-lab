//! Addresses of local runtimes: only this computer, never the network.
//!
//! An address is accepted only when ALL of these hold (checked on every call, in Rust):
//! - scheme `http` (runtimes on this computer do not use TLS);
//! - host written exactly `127.0.0.1`, `[::1]` or `localhost` (no other spelling of loopback,
//!   no `0.0.0.0`, no LAN or internet address, no `localhost.evil`, no `[::ffff:127.0.0.1]`);
//! - an explicit port 1–65535 (no leading zero);
//! - path empty, `/`, `/v1` or `/v1/` (normalised away);
//! - no user info, query or fragment.
//!
//! The same table of cases is used by the web side (tests/fixtures/local-ai/endpoints.json).
//!
//! The HTTP client for these addresses never uses a proxy (reqwest reads proxy settings from the
//! environment by default, which could send a prompt off the computer), never follows a
//! redirect (a 307 would resend the prompt elsewhere), and resolves `localhost` itself to the
//! loopback addresses (no DNS, no hosts file).

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use tauri::Url;

use super::runtime::RuntimeKind;
use super::NOT_LOOPBACK;
use crate::ai::reasoning::js_trim;
use crate::ai::AiError;

/// Longest address accepted.
const MAX_URL_LEN: usize = 200;

/// How the loopback host was written (kept, so the address shown is the one the user typed).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoopHost {
    V4,
    V6,
    Localhost,
}

/// A checked runtime address on this computer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Loopback {
    pub host: LoopHost,
    pub port: u16,
}

impl Loopback {
    pub fn v4(port: u16) -> Loopback {
        Loopback {
            host: LoopHost::V4,
            port,
        }
    }

    /// `http://127.0.0.1:11434` (no trailing slash).
    pub fn base(&self) -> String {
        let host = match self.host {
            LoopHost::V4 => "127.0.0.1",
            LoopHost::V6 => "[::1]",
            LoopHost::Localhost => "localhost",
        };
        format!("http://{host}:{}", self.port)
    }

    /// The base plus a fixed path of this module (`/api/tags`, `/v1/models`, …).
    pub fn url(&self, path: &str) -> String {
        format!("{}{path}", self.base())
    }
}

/// The usual address of each runtime. Detection only looks here: no other port is tried, no
/// file is read and no process is listed.
pub const DEFAULTS: [(RuntimeKind, u16); 3] = [
    (RuntimeKind::Ollama, 11434),
    (RuntimeKind::LmStudio, 1234),
    (RuntimeKind::LlamaCpp, 8080),
];

fn refuse() -> AiError {
    AiError::NotAllowed(NOT_LOOPBACK.into())
}

/// Checks a runtime address typed by the user or stored by the page.
pub fn parse_loopback(input: &str) -> Result<Loopback, AiError> {
    // Trimmed as JavaScript trims, so the page's mirror of this check agrees (U+0085, U+FEFF).
    let s = js_trim(input);
    if s.is_empty() || s.len() > MAX_URL_LEN || s.chars().any(|c| c.is_control() || c == ' ') {
        return Err(refuse());
    }
    let rest = match s.get(..7) {
        Some(p) if p.eq_ignore_ascii_case("http://") => &s[7..],
        _ => return Err(refuse()),
    };
    // The authority as written, up to the first '/', '\', '?' or '#'.
    let end = rest.find(['/', '\\', '?', '#']).unwrap_or(rest.len());
    let (authority, tail) = rest.split_at(end);
    if authority.contains('@') {
        return Err(refuse());
    }
    let (host_text, port_text) = if authority.starts_with('[') {
        let close = authority.find(']').ok_or_else(refuse)?;
        let after = &authority[close + 1..];
        (
            &authority[..=close],
            after.strip_prefix(':').ok_or_else(refuse)?,
        )
    } else {
        authority.rsplit_once(':').ok_or_else(refuse)?
    };
    let host = match host_text.to_ascii_lowercase().as_str() {
        "127.0.0.1" => LoopHost::V4,
        "[::1]" => LoopHost::V6,
        "localhost" => LoopHost::Localhost,
        _ => return Err(refuse()),
    };
    let port_ok = !port_text.is_empty()
        && port_text.len() <= 5
        && !port_text.starts_with('0')
        && port_text.bytes().all(|b| b.is_ascii_digit());
    let port: u16 = port_text
        .parse()
        .ok()
        .filter(|_| port_ok)
        .ok_or_else(refuse)?;
    if !matches!(tail, "" | "/" | "/v1" | "/v1/") {
        return Err(refuse());
    }
    // The URL parser must read the same thing (defense in depth against parser differences).
    let url = Url::parse(s).map_err(|_| refuse())?;
    let same_host = url.host_str()
        == Some(match host {
            LoopHost::V4 => "127.0.0.1",
            LoopHost::V6 => "[::1]",
            LoopHost::Localhost => "localhost",
        });
    if url.scheme() != "http"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !same_host
        || url.port_or_known_default() != Some(port)
    {
        return Err(refuse());
    }
    Ok(Loopback { host, port })
}

/// The only HTTP client used for local runtimes.
pub fn loopback_client() -> Result<reqwest::Client, AiError> {
    let any_port = |ip: IpAddr| SocketAddr::new(ip, 0);
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(2))
        .resolve_to_addrs(
            "localhost",
            &[
                any_port(IpAddr::V4(Ipv4Addr::LOCALHOST)),
                any_port(IpAddr::V6(Ipv6Addr::LOCALHOST)),
            ],
        )
        .build()
        .map_err(|e| AiError::Network(format!("{}: {e}", super::UNREACHABLE)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const FIXTURE: &str = include_str!("../../../tests/fixtures/local-ai/endpoints.json");

    #[test]
    fn the_shared_address_table_holds() {
        let v: Value = serde_json::from_str(FIXTURE).unwrap();
        let accept = v["accept"].as_array().unwrap();
        let reject = v["reject"].as_array().unwrap();
        assert!(accept.len() >= 8 && reject.len() >= 20, "table lost cases");
        for c in accept {
            let input = c["input"].as_str().unwrap();
            let got = parse_loopback(input).unwrap_or_else(|e| panic!("{input} refused: {e}"));
            assert_eq!(got.base(), c["base"].as_str().unwrap(), "{input}");
        }
        for c in reject {
            let input = c.as_str().unwrap();
            assert!(
                matches!(parse_loopback(input), Err(AiError::NotAllowed(ref t)) if t == NOT_LOOPBACK),
                "{input} must be refused"
            );
        }
    }

    #[test]
    fn defaults_are_the_three_known_ports_on_ipv4_loopback() {
        let ports: Vec<u16> = DEFAULTS.iter().map(|d| d.1).collect();
        assert_eq!(ports, vec![11434, 1234, 8080]);
        for (_, port) in DEFAULTS {
            assert_eq!(
                parse_loopback(&Loopback::v4(port).base()).unwrap(),
                Loopback::v4(port)
            );
        }
        assert_eq!(
            Loopback::v4(1234).url("/v1/models"),
            "http://127.0.0.1:1234/v1/models"
        );
    }

    #[test]
    fn the_client_has_no_proxy_and_no_redirects() {
        // The builder cannot be inspected, so check its wiring in the source.
        let code = include_str!("endpoint.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap_or_default();
        let client = code
            .split("pub fn loopback_client()")
            .nth(1)
            .expect("loopback_client");
        assert!(client.contains(".no_proxy()"));
        assert!(client.contains(".redirect(reqwest::redirect::Policy::none())"));
        assert!(client.contains(".connect_timeout(Duration::from_secs(2))"));
        assert!(client.contains(".resolve_to_addrs("));
        assert!(loopback_client().is_ok());
    }
}
