//! LAN discovery (#339), a port of the game's `lanDiscovery.ts`: each room server sends a small
//! UDP beacon every BEACON_MS and keeps the servers it hears, so a game finds the others' rooms
//! without typing an IP. The page stays on this computer: its server lists them (`/lan`) and
//! passes its requests on (`/via/<at>/…`, `http.rs`).
//!
//! SimLab's rules on top of the game's: it always listens (rooms_start) but announces only while
//! one of this computer's pages is in a room here (`set_announce`); it hears only senders on a
//! private network (or this computer); its beacon is named "SimLab", never after the computer
//! (a computer's name often holds its owner's). Errors are logged once and never stop the server.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::async_runtime::JoinHandle;
use tokio::net::UdpSocket;
use tokio::sync::Notify;

use super::protocol::{js_len, room_summary, MAX_ROOMS};

/// The UDP port every room server of the LAN announces on and listens to.
pub const DISCOVERY_PORT: u16 = 5188;
pub const BEACON_MS: u64 = 2_000;
/// A server unheard this long is forgotten (a few beacons lost in a row).
pub const FORGET_MS: u64 = 7_000;
pub const MAX_SERVERS: usize = 32;
/// A datagram longer than this is dropped unread (32 full rooms fit well under it).
const BEACON_MAX_BYTES: usize = 16_000;
const NAME_MAX: usize = 32;
/// The name in this server's beacons.
pub const BEACON_NAME: &str = "SimLab";

/// A room server heard on the LAN: `at` is the sender's own IP (never one it claims) and port.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LanServer {
    pub at: String,
    pub name: String,
    pub rooms: Vec<Value>,
}

/// Lists, clocks and targets, injectable for tests (loopback ports, a fake clock).
#[derive(Clone)]
pub struct DiscoveryConfig {
    /// This server's HTTP port, announced.
    pub http_port: u16,
    /// Where to listen (0.0.0.0:5188 in the app).
    pub bind: SocketAddr,
    pub every: Duration,
    pub targets: Arc<dyn Fn() -> Vec<SocketAddr> + Send + Sync>,
    pub now_ms: Arc<dyn Fn() -> u64 + Send + Sync>,
    pub log: Arc<dyn Fn(&str) + Send + Sync>,
}

impl DiscoveryConfig {
    /// The app's: UDP 5188 on every network, beacons to each private network's broadcast address.
    pub fn app(http_port: u16) -> Self {
        DiscoveryConfig {
            http_port,
            bind: SocketAddr::from((Ipv4Addr::UNSPECIFIED, DISCOVERY_PORT)),
            every: Duration::from_millis(BEACON_MS),
            targets: Arc::new(|| {
                private_networks()
                    .into_iter()
                    .map(|n| SocketAddr::from((n.broadcast, DISCOVERY_PORT)))
                    .collect()
            }),
            now_ms: Arc::new(now_ms),
            log: Arc::new(|m| eprintln!("{m}")),
        }
    }
}

/// Milliseconds on the system clock.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

struct Heard {
    name: String,
    rooms: Vec<Value>,
    time: u64,
}

pub struct Discovery {
    id: String,
    config: DiscoveryConfig,
    heard: Mutex<HashMap<String, Heard>>,
    socket: Option<Arc<UdpSocket>>,
    announce: AtomicBool,
    wake: Notify,
    warned: AtomicBool,
    tasks: Mutex<Vec<JoinHandle<()>>>,
}

impl Discovery {
    /// Binds and starts listening; `rooms` gives what the beacon lists. A port it cannot bind is
    /// logged once: the room server works on without the LAN list.
    pub async fn start(
        config: DiscoveryConfig,
        rooms: Arc<dyn Fn() -> Vec<Value> + Send + Sync>,
    ) -> Arc<Discovery> {
        let socket = match UdpSocket::bind(config.bind).await {
            Ok(s) => Some(Arc::new(s)),
            Err(e) => {
                (config.log)(&format!("LAN discovery off (UDP {}): {e}", config.bind));
                None
            }
        };
        let lan = Arc::new(Discovery {
            id: crate::ai::builtin::server::random_key()
                .map(|k| k[..32].to_string())
                .unwrap_or_else(|| format!("{:x}", now_ms())),
            config,
            heard: Mutex::new(HashMap::new()),
            socket,
            announce: AtomicBool::new(false),
            wake: Notify::new(),
            // A port it could not bind was logged already: once is enough.
            warned: AtomicBool::new(false),
            tasks: Mutex::new(Vec::new()),
        });
        if lan.socket.is_none() {
            lan.warned.store(true, Ordering::SeqCst);
            return lan;
        }
        let listen = {
            let lan = lan.clone();
            tauri::async_runtime::spawn(async move { lan.listen().await })
        };
        let beat = {
            let lan = lan.clone();
            tauri::async_runtime::spawn(async move { lan.beat_loop(rooms).await })
        };
        lan.tasks.lock().expect("tasks").extend([listen, beat]);
        lan
    }

    /// The UDP port it listens on (0 when not bound).
    #[cfg(test)]
    pub fn listen_port(&self) -> u16 {
        self.socket
            .as_ref()
            .and_then(|s| s.local_addr().ok())
            .map_or(0, |a| a.port())
    }

    /// Announce (a room is hosted here) or only listen.
    pub fn set_announce(&self, on: bool) {
        if self.announce.swap(on, Ordering::SeqCst) != on && on {
            self.wake.notify_one();
        }
    }

    pub fn announcing(&self) -> bool {
        self.announce.load(Ordering::SeqCst)
    }

    /// The servers heard within FORGET_MS, this one excluded.
    pub fn servers(&self) -> Vec<LanServer> {
        let now = (self.config.now_ms)();
        let mut heard = self.heard.lock().expect("heard");
        heard.retain(|_, s| now.saturating_sub(s.time) <= FORGET_MS);
        let mut found: Vec<LanServer> = heard
            .iter()
            .map(|(at, s)| LanServer {
                at: at.clone(),
                name: s.name.clone(),
                rooms: s.rooms.clone(),
            })
            .collect();
        found.sort_by(|a, b| a.at.cmp(&b.at));
        found
    }

    pub fn stop(&self) {
        for task in self.tasks.lock().expect("tasks").drain(..) {
            task.abort();
        }
        self.heard.lock().expect("heard").clear();
    }

    async fn listen(&self) {
        let Some(socket) = self.socket.clone() else {
            return;
        };
        let mut buf = vec![0u8; 65_536];
        loop {
            match socket.recv_from(&mut buf).await {
                Ok((n, from)) => self.receive(&buf[..n], from),
                // Windows reports an ICMP "port unreachable" from an earlier send as an error on
                // the next receive: logged once, and listening goes on.
                Err(e) => {
                    self.warn(&format!("LAN discovery: {e}"));
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            }
        }
    }

    async fn beat_loop(&self, rooms: Arc<dyn Fn() -> Vec<Value> + Send + Sync>) {
        let Some(socket) = self.socket.clone() else {
            return;
        };
        let mut broadcast_set = false;
        loop {
            if self.announcing() {
                if !broadcast_set {
                    if let Err(e) = socket.set_broadcast(true) {
                        self.warn(&format!("LAN discovery: cannot broadcast ({e})"));
                    }
                    broadcast_set = true;
                }
                let mut listed = rooms();
                listed.truncate(MAX_ROOMS);
                let beacon = json!({
                    "app": "simlab-rooms",
                    "v": 1,
                    "id": self.id,
                    "port": self.config.http_port,
                    "name": BEACON_NAME,
                    "rooms": listed,
                })
                .to_string();
                for to in (self.config.targets)() {
                    if let Err(e) = socket.send_to(beacon.as_bytes(), to).await {
                        self.warn(&format!("LAN discovery: cannot announce to {to} ({e})"));
                    }
                }
                tokio::select! {
                    () = tokio::time::sleep(self.config.every) => {}
                    () = self.wake.notified() => {}
                }
            } else {
                self.wake.notified().await;
            }
        }
    }

    /// One datagram: checked in full; `at` is the sender's own address and the port it gives.
    fn receive(&self, data: &[u8], from: SocketAddr) {
        if data.len() > BEACON_MAX_BYTES || !is_private_or_loopback(from.ip()) {
            return;
        }
        let Ok(json) = serde_json::from_slice::<Value>(data) else {
            return;
        };
        let Some((id, port, name, rooms)) = beacon(&json) else {
            return;
        };
        if id == self.id {
            return;
        }
        let at = format!("{}:{port}", from.ip());
        self.note(at, name, rooms);
    }

    /// Keeps a server heard now (at most MAX_SERVERS).
    pub(crate) fn note(&self, at: String, name: String, rooms: Vec<Value>) {
        let known = self.heard.lock().expect("heard").contains_key(&at);
        if !known && self.servers().len() >= MAX_SERVERS {
            return;
        }
        let time = (self.config.now_ms)();
        let mut heard = self.heard.lock().expect("heard");
        heard.insert(at, Heard { name, rooms, time });
    }

    fn warn(&self, message: &str) {
        if !self.warned.swap(true, Ordering::SeqCst) {
            (self.config.log)(message);
        }
    }
}

/// `BeaconSchema`: (id, port, name, rooms) of a well-formed beacon.
fn beacon(v: &Value) -> Option<(String, u16, String, Vec<Value>)> {
    let o = v.as_object()?;
    if o.get("app")?.as_str()? != "simlab-rooms" || o.get("v")?.as_f64()? != 1.0 {
        return None;
    }
    let id = o.get("id")?.as_str()?;
    if !(1..=64).contains(&js_len(id)) {
        return None;
    }
    let port = o.get("port")?.as_f64()?;
    if port.fract() != 0.0 || !(1.0..=65_535.0).contains(&port) {
        return None;
    }
    let name = o.get("name")?.as_str()?;
    if js_len(name) > NAME_MAX {
        return None;
    }
    let rooms = o.get("rooms")?.as_array()?;
    if rooms.len() > MAX_ROOMS {
        return None;
    }
    let rooms = rooms.iter().map(room_summary).collect::<Option<Vec<_>>>()?;
    Some((id.to_string(), port as u16, name.to_string(), rooms))
}

/// Private networks (10/8, 172.16/12, 192.168/16, link-local 169.254/16) or this computer.
pub fn is_private_or_loopback(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || is_lan_v4(v4),
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .is_some_and(|v4| v4.is_loopback() || is_lan_v4(v4)),
    }
}

fn is_lan_v4(ip: Ipv4Addr) -> bool {
    ip.is_private() || ip.is_link_local()
}

/// One IPv4 network this computer is on: its address there and its broadcast address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Network {
    pub address: Ipv4Addr,
    pub broadcast: Ipv4Addr,
}

/// 192.168.1.5 / 24 → 192.168.1.255.
pub fn broadcast_of(address: Ipv4Addr, prefix: u8) -> Ipv4Addr {
    let mask = if prefix == 0 {
        0
    } else {
        u32::MAX << (32 - u32::from(prefix.min(32)))
    };
    Ipv4Addr::from(u32::from(address) & mask | !mask)
}

/// The private IPv4 networks this computer is on (point-to-point links left out: nothing to
/// broadcast to). The server listens on these addresses only while a room is hosted here.
#[cfg(windows)]
pub fn private_networks() -> Vec<Network> {
    use windows::Win32::Foundation::{ERROR_BUFFER_OVERFLOW, ERROR_SUCCESS};
    use windows::Win32::NetworkManagement::IpHelper::{
        GetAdaptersInfo, IP_ADAPTER_INFO, IP_ADDRESS_STRING,
    };

    /// "192.168.1.5" as the adapter list writes it (a C string in 16 bytes).
    fn read(s: &IP_ADDRESS_STRING) -> Option<Ipv4Addr> {
        let bytes: Vec<u8> = s
            .String
            .iter()
            .take_while(|c| **c != 0)
            .map(|c| *c as u8)
            .collect();
        std::str::from_utf8(&bytes).ok()?.parse().ok()
    }

    let mut size: u32 = 16 * 1024;
    for _ in 0..3 {
        // u64 words: the list's structures need 8-byte alignment.
        let mut buf = vec![0u64; (size as usize).div_ceil(8)];
        let first = buf.as_mut_ptr().cast::<IP_ADAPTER_INFO>();
        // SAFETY: `buf` holds `size` bytes, aligned, and outlives every pointer read below.
        let code = unsafe { GetAdaptersInfo(Some(first), &mut size) };
        if code == ERROR_BUFFER_OVERFLOW.0 {
            continue;
        }
        if code != ERROR_SUCCESS.0 {
            return Vec::new();
        }
        let mut found = Vec::new();
        let mut adapter = first.cast_const();
        // SAFETY: a linked list written by GetAdaptersInfo inside `buf`, null-terminated.
        unsafe {
            while let Some(a) = adapter.as_ref() {
                let mut entry: *const _ = &a.IpAddressList;
                while let Some(e) = entry.as_ref() {
                    if let (Some(ip), Some(mask)) = (read(&e.IpAddress), read(&e.IpMask)) {
                        let prefix = u32::from(mask).leading_ones() as u8;
                        if is_lan_v4(ip) && prefix < 31 {
                            found.push(Network {
                                address: ip,
                                broadcast: broadcast_of(ip, prefix),
                            });
                        }
                    }
                    entry = e.Next.cast_const();
                }
                adapter = a.Next.cast_const();
            }
        }
        found.dedup();
        return found;
    }
    Vec::new()
}

/// Elsewhere: the address the system would reach the LAN from (no packet is sent), and the
/// limited broadcast address.
#[cfg(not(windows))]
pub fn private_networks() -> Vec<Network> {
    let Ok(socket) = std::net::UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)) else {
        return Vec::new();
    };
    // TEST-NET-1 (RFC 5737): never routed anywhere real.
    if socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).is_err() {
        return Vec::new();
    }
    match socket.local_addr().map(|a| a.ip()) {
        Ok(IpAddr::V4(ip)) if is_lan_v4(ip) => vec![Network {
            address: ip,
            broadcast: Ipv4Addr::BROADCAST,
        }],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    //! The game's `lanDiscovery.test.ts`: real UDP on loopback, each instance on a port of its
    //! own, beacons sent straight to the other's port (a broadcast is not testable on loopback).
    use super::*;
    use std::sync::atomic::AtomicU64;

    fn room() -> Value {
        json!({ "id": "ABCDEF", "name": "Lớp 11A", "host": "An", "players": 1, "max": 8 })
    }

    fn config(http_port: u16, to: Arc<AtomicU64>) -> DiscoveryConfig {
        DiscoveryConfig {
            http_port,
            bind: SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
            every: Duration::from_millis(30),
            targets: Arc::new(move || match to.load(Ordering::SeqCst) {
                0 => vec![],
                p => vec![SocketAddr::from((Ipv4Addr::LOCALHOST, p as u16))],
            }),
            now_ms: Arc::new(now_ms),
            log: Arc::new(|_| {}),
        }
    }

    fn no_rooms() -> Arc<dyn Fn() -> Vec<Value> + Send + Sync> {
        Arc::new(Vec::new)
    }

    async fn eventually(check: impl Fn() -> bool) -> bool {
        for _ in 0..100 {
            if check() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        check()
    }

    async fn send_raw(port: u16, data: &[u8]) {
        let s = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("bind");
        s.send_to(data, (Ipv4Addr::LOCALHOST, port))
            .await
            .expect("send");
    }

    #[test]
    fn two_servers_hear_each_other_by_sender_address_and_ignore_their_own_beacon() {
        tauri::async_runtime::block_on(async {
            let (to_b, to_a) = (Arc::new(AtomicU64::new(0)), Arc::new(AtomicU64::new(0)));
            let a = Discovery::start(config(5190, to_b.clone()), Arc::new(|| vec![room()])).await;
            let b = Discovery::start(config(5191, to_a.clone()), no_rooms()).await;
            to_b.store(u64::from(b.listen_port()), Ordering::SeqCst);
            to_a.store(u64::from(a.listen_port()), Ordering::SeqCst);
            a.set_announce(true);
            b.set_announce(true);
            assert!(eventually(|| b.servers().len() == 1).await);
            assert_eq!(
                b.servers(),
                vec![LanServer {
                    at: "127.0.0.1:5190".into(),
                    name: BEACON_NAME.into(),
                    rooms: vec![room()]
                }]
            );
            assert!(eventually(|| a.servers().len() == 1).await);
            assert_eq!(a.servers()[0].at, "127.0.0.1:5191");
            // Its own beacon, sent back to itself, is not a server.
            let to_self = Arc::new(AtomicU64::new(0));
            let me = Discovery::start(config(5192, to_self.clone()), no_rooms()).await;
            to_self.store(u64::from(me.listen_port()), Ordering::SeqCst);
            me.set_announce(true);
            tokio::time::sleep(Duration::from_millis(150)).await;
            assert_eq!(me.servers(), vec![]);
            for d in [a, b, me] {
                d.stop();
            }
        });
    }

    #[test]
    fn announces_only_when_told_to() {
        tauri::async_runtime::block_on(async {
            let to = Arc::new(AtomicU64::new(0));
            let listener =
                Discovery::start(config(5190, Arc::new(AtomicU64::new(0))), no_rooms()).await;
            to.store(u64::from(listener.listen_port()), Ordering::SeqCst);
            let quiet = Discovery::start(config(5193, to), no_rooms()).await;
            tokio::time::sleep(Duration::from_millis(150)).await;
            assert_eq!(listener.servers(), vec![]); // listening only: nothing sent
            quiet.set_announce(true);
            assert!(eventually(|| listener.servers().len() == 1).await);
            quiet.set_announce(false);
            quiet.stop();
            listener.stop();
        });
    }

    #[test]
    fn drops_what_it_cannot_trust_and_never_takes_an_address_from_the_payload() {
        tauri::async_runtime::block_on(async {
            let a = Discovery::start(config(5190, Arc::new(AtomicU64::new(0))), no_rooms()).await;
            let port = a.listen_port();
            let beacon = json!({ "app": "simlab-rooms", "v": 1, "id": "x", "port": 6000, "name": "PC", "rooms": [] });
            let with = |key: &str, value: Value| {
                let mut b = beacon.clone();
                b[key] = value;
                b.to_string()
            };
            send_raw(port, b"{not json").await;
            send_raw(port, with("app", json!("other")).as_bytes()).await;
            send_raw(port, with("port", json!(70_000)).as_bytes()).await;
            let bad_room =
                json!([{ "id": "bad", "name": "R", "host": "A", "players": 1, "max": 8 }]);
            send_raw(port, with("rooms", bad_room).as_bytes()).await;
            send_raw(port, with("name", json!("x".repeat(33))).as_bytes()).await;
            send_raw(port, &[b' '; 20_000]).await; // over the size cap
            let mut claims = beacon.clone();
            claims["port"] = json!(6001);
            claims["address"] = json!("10.0.0.9");
            send_raw(port, claims.to_string().as_bytes()).await;
            assert!(eventually(|| !a.servers().is_empty()).await);
            let at: Vec<String> = a.servers().into_iter().map(|s| s.at).collect();
            assert_eq!(at, vec!["127.0.0.1:6001".to_string()]);
            a.stop();
        });
    }

    #[test]
    fn forgets_a_server_unheard_for_forget_ms() {
        tauri::async_runtime::block_on(async {
            let now = Arc::new(AtomicU64::new(1_000));
            let clock = now.clone();
            let mut c = config(5190, Arc::new(AtomicU64::new(0)));
            c.now_ms = Arc::new(move || clock.load(Ordering::SeqCst));
            let a = Discovery::start(c, no_rooms()).await;
            let beacon = json!({ "app": "simlab-rooms", "v": 1, "id": "x", "port": 6000, "name": "PC", "rooms": [] });
            send_raw(a.listen_port(), beacon.to_string().as_bytes()).await;
            assert!(eventually(|| a.servers().len() == 1).await);
            now.fetch_add(FORGET_MS - 1, Ordering::SeqCst);
            assert_eq!(a.servers().len(), 1);
            now.fetch_add(2, Ordering::SeqCst);
            assert_eq!(a.servers(), vec![]);
            a.stop();
        });
    }

    #[test]
    fn logs_a_port_it_cannot_bind_once_and_does_not_fail() {
        tauri::async_runtime::block_on(async {
            let a = Discovery::start(config(5190, Arc::new(AtomicU64::new(0))), no_rooms()).await;
            let logs = Arc::new(Mutex::new(Vec::<String>::new()));
            let mut c = config(5190, Arc::new(AtomicU64::new(0)));
            c.bind = SocketAddr::from((Ipv4Addr::LOCALHOST, a.listen_port()));
            let sink = logs.clone();
            c.log = Arc::new(move |m| sink.lock().expect("logs").push(m.to_string()));
            let taken = Discovery::start(c, no_rooms()).await;
            assert_eq!(logs.lock().expect("logs").len(), 1);
            assert_eq!(taken.listen_port(), 0);
            taken.set_announce(true);
            assert_eq!(taken.servers(), vec![]);
            taken.stop();
            a.stop();
        });
    }

    #[test]
    fn broadcast_addresses_and_private_networks() {
        let ip = |s: &str| s.parse::<Ipv4Addr>().expect("ip");
        assert_eq!(broadcast_of(ip("192.168.1.5"), 24), ip("192.168.1.255"));
        assert_eq!(broadcast_of(ip("10.1.2.3"), 8), ip("10.255.255.255"));
        assert_eq!(broadcast_of(ip("172.16.5.4"), 22), ip("172.16.7.255"));
        for lan in [
            "10.0.0.1",
            "172.31.2.3",
            "192.168.0.9",
            "169.254.1.1",
            "127.0.0.1",
        ] {
            assert!(is_private_or_loopback(IpAddr::V4(ip(lan))), "{lan}");
        }
        for public in ["8.8.8.8", "172.32.0.1", "100.64.0.1", "1.1.1.1"] {
            assert!(!is_private_or_loopback(IpAddr::V4(ip(public))), "{public}");
        }
        // Whatever this computer is on, only private networks are listed.
        assert!(private_networks().iter().all(|n| is_lan_v4(n.address)));
    }
}
