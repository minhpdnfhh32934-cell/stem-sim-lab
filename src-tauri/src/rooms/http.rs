//! The room server over HTTP (#339), a port of the game's `roomHttp.ts` on axum: Server-Sent
//! Events down, POSTs up, under ROOM_PATH.
//!
//! - `GET  hello`: `{"rooms":true}`, so a page tells a room server from a file server.
//! - `GET  events`: a connection's stream; its first event, `hello`, names it. Closed (the page
//!   closed or reloaded), it leaves its room. A comment line every 20 s keeps it open.
//! - `POST send`: messages (one, or up to BATCH_MAX in an array), the connection named by
//!   ROOM_CLIENT_HEADER; over MESSAGE_MAX_CHARS the body is dropped unread. The hub checks the rest.
//! - `GET  lan`: the room servers heard on the LAN (`discovery.rs`), not this one.
//! - `via/<at>/(hello|events|send)`: the same on the server `at` (IP:port), passed on so the page
//!   stays on this computer. Only to a server heard now: never an open proxy.
//!
//! SimLab's rules on top of the game's:
//! - The server listens on 127.0.0.1 only. It also listens on this computer's private network
//!   addresses (and announces itself) only while one of this computer's pages is in a room here,
//!   and closes them again when none is: a LAN request then gets 403 and a LAN stream ends.
//! - From the LAN: only senders on a private network; `lan` and `via` are for this computer's
//!   pages only (another computer never uses this one as a relay).
//! - A request with an `Origin` other than the app's pages is refused (403); the app's pages get
//!   CORS headers (`x-room-client` and `content-type` allowed on POSTs).

use std::collections::HashMap;
use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::extract::{ConnectInfo, Path, Request, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::serve::ListenerExt;
use axum::Router;
use serde_json::{json, Value};
use tauri::async_runtime::JoinHandle;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, watch};

use super::discovery::{
    is_private_or_loopback, now_ms, private_networks, Discovery, DiscoveryConfig,
};
use super::hub::{ClientId, Outbox, RoomHub};
use super::protocol::{js_len, BATCH_MAX, MESSAGE_MAX_CHARS, ROOM_CLIENT_HEADER, ROOM_PATH};

/// The room server's fixed port (the one address SimLab's CSP lists for it).
pub const HTTP_PORT: u16 = 5189;
/// A comment line keeps an idle stream open through anything that times connections out.
const KEEP_ALIVE: Duration = Duration::from_secs(20);
/// Longer than the stream's keep-alive: another server gone quiet this long is gone.
const PROXY_IDLE: Duration = Duration::from_secs(45);
/// Messages waiting for one connection; a page this far behind is disconnected.
const QUEUE: usize = 1024;
/// Open event streams, at most (8 players in each of a few rooms, and their reloads).
pub const MAX_STREAMS: usize = 64;
/// Open event streams from the LAN, at most: the rest is kept for this computer's pages.
pub const MAX_LAN_STREAMS: usize = 48;
/// Open event streams from one LAN address, at most.
pub const MAX_STREAMS_PER_LAN_IP: usize = 16;
// The LAN never takes the share kept for this computer's pages.
const _: () = assert!(MAX_LAN_STREAMS + MAX_STREAMS_PER_LAN_IP <= MAX_STREAMS);
/// Bytes a POST may have: MESSAGE_MAX_CHARS UTF-16 units are at most 3 bytes each in UTF-8.
const BODY_MAX_BYTES: usize = MESSAGE_MAX_CHARS * 3;
/// The app's pages: the packaged app (both schemes WebView2 may use) and the dev server.
pub const ALLOWED_ORIGINS: [&str; 3] = [
    "http://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
];

/// Where to listen; injectable for tests (port 0, loopback stand-ins for the LAN).
#[derive(Clone)]
pub struct ServerConfig {
    /// 127.0.0.1:5189 in the app.
    pub loopback: SocketAddr,
    /// This computer's private network addresses, listened on while a room is hosted here.
    pub lan_ips: Arc<dyn Fn() -> Vec<IpAddr> + Send + Sync>,
    pub discovery: DiscoveryConfig,
    pub log: Arc<dyn Fn(&str) + Send + Sync>,
}

impl ServerConfig {
    pub fn app() -> Self {
        ServerConfig {
            loopback: SocketAddr::from((Ipv4Addr::LOCALHOST, HTTP_PORT)),
            lan_ips: Arc::new(|| {
                private_networks()
                    .into_iter()
                    .map(|n| IpAddr::V4(n.address))
                    .collect()
            }),
            discovery: DiscoveryConfig::app(HTTP_PORT),
            log: Arc::new(|m| eprintln!("{m}")),
        }
    }
}

/// Which listener a request came in on.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Side {
    /// 127.0.0.1: this computer's own pages.
    Loopback,
    /// A private network address: another computer of the LAN.
    Lan,
}

struct Conn {
    key: String,
    tx: mpsc::Sender<Arc<str>>,
    /// The sender's address when it came from the LAN.
    lan_ip: Option<IpAddr>,
}

struct Inner {
    hub: RoomHub,
    conns: HashMap<ClientId, Conn>,
    keys: HashMap<String, ClientId>,
    next: ClientId,
}

struct Shared {
    inner: Mutex<Inner>,
    /// Whether a page of this computer is in a room here (the LAN should be open).
    want_lan: watch::Sender<bool>,
    /// Whether the LAN listeners are open.
    lan_open: watch::Sender<bool>,
    discovery: OnceLock<Arc<Discovery>>,
    proxy: reqwest::Client,
}

/// 128 random bits as hex (a connection's name: its POSTs are trusted by it).
fn random_name() -> Option<String> {
    crate::ai::builtin::server::random_key().map(|k| k[..32].to_string())
}

/// In [0, 1), for room IDs.
fn random_unit() -> f64 {
    random_name()
        .and_then(|k| u8::from_str_radix(&k[..2], 16).ok())
        .map_or_else(|| (now_ms() % 256) as f64 / 256.0, |b| f64::from(b) / 256.0)
}

impl Shared {
    fn discovery(&self) -> Option<&Arc<Discovery>> {
        self.discovery.get()
    }

    /// A new connection: its name, number and queue; 503 past MAX_STREAMS (in all),
    /// MAX_LAN_STREAMS (from the LAN) or MAX_STREAMS_PER_LAN_IP (from one LAN address).
    fn connect(
        &self,
        lan_ip: Option<IpAddr>,
    ) -> Result<(String, ClientId, mpsc::Receiver<Arc<str>>), StatusCode> {
        let key = random_name().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
        let (tx, rx) = mpsc::channel(QUEUE);
        let mut inner = self.inner.lock().expect("rooms");
        let from_ip = |ip| {
            inner
                .conns
                .values()
                .filter(|c| c.lan_ip == Some(ip))
                .count()
        };
        let from_lan = inner.conns.values().filter(|c| c.lan_ip.is_some()).count();
        let crowded = lan_ip
            .is_some_and(|ip| from_lan >= MAX_LAN_STREAMS || from_ip(ip) >= MAX_STREAMS_PER_LAN_IP);
        if inner.conns.len() >= MAX_STREAMS || crowded {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        let id = inner.next;
        inner.next += 1;
        inner.keys.insert(key.clone(), id);
        inner.conns.insert(
            id,
            Conn {
                key: key.clone(),
                tx,
                lan_ip,
            },
        );
        inner.hub.connect(id, lan_ip.is_none());
        Ok((key, id, rx))
    }

    fn disconnect(&self, id: ClientId) {
        let mut inner = self.inner.lock().expect("rooms");
        if let Some(conn) = inner.conns.remove(&id) {
            inner.keys.remove(&conn.key);
        }
        let mut out = Outbox::new();
        inner.hub.disconnect(id, &mut out);
        self.dispatch(&mut inner, out);
    }

    fn knows(&self, key: &str) -> bool {
        self.inner.lock().expect("rooms").keys.contains_key(key)
    }

    /// Messages from the connection named `key`; false when there is none.
    fn receive(&self, key: &str, messages: &[Value]) -> bool {
        let mut inner = self.inner.lock().expect("rooms");
        let Some(&id) = inner.keys.get(key) else {
            return false;
        };
        let mut out = Outbox::new();
        for m in messages {
            inner.hub.receive(id, m, &mut out);
        }
        self.dispatch(&mut inner, out);
        true
    }

    /// Sends what the hub answered. A connection whose queue is full is disconnected (its page
    /// stopped reading), and what that changes is sent too. Then the LAN follows the rooms.
    fn dispatch(&self, inner: &mut Inner, mut out: Outbox) {
        loop {
            let mut stuck = Vec::new();
            for (to, text) in out.drain(..) {
                if let Some(conn) = inner.conns.get(&to) {
                    if conn.tx.try_send(text).is_err() && !stuck.contains(&to) {
                        stuck.push(to);
                    }
                }
            }
            if stuck.is_empty() {
                break;
            }
            for id in stuck {
                if let Some(conn) = inner.conns.remove(&id) {
                    inner.keys.remove(&conn.key);
                }
                inner.hub.disconnect(id, &mut out);
            }
        }
        let want = inner.hub.has_local_member();
        self.want_lan.send_if_modified(|w| {
            let changed = *w != want;
            *w = want;
            changed
        });
    }

    /// Ends every stream (their queues close) and forgets every connection.
    fn drop_all(&self) {
        let mut inner = self.inner.lock().expect("rooms");
        inner.conns.clear();
        inner.keys.clear();
    }
}

/// A running room server.
pub struct RoomServer {
    shared: Arc<Shared>,
    #[cfg_attr(not(test), allow(dead_code))]
    port: u16,
    stop: watch::Sender<bool>,
    tasks: Mutex<Vec<JoinHandle<()>>>,
}

impl RoomServer {
    /// Listens on the loopback address (an error when it is taken) and on UDP for beacons.
    pub async fn start(config: ServerConfig) -> std::io::Result<RoomServer> {
        let listener = TcpListener::bind(config.loopback).await?;
        let port = listener.local_addr()?.port();
        let proxy = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(2))
            .read_timeout(PROXY_IDLE)
            .build()
            .map_err(std::io::Error::other)?;
        let (want_lan, want_rx) = watch::channel(false);
        let shared = Arc::new(Shared {
            inner: Mutex::new(Inner {
                hub: RoomHub::new(random_unit, now_ms),
                conns: HashMap::new(),
                keys: HashMap::new(),
                next: 1,
            }),
            want_lan,
            lan_open: watch::channel(false).0,
            discovery: OnceLock::new(),
            proxy,
        });
        let weak = Arc::downgrade(&shared);
        let rooms = Arc::new(move || {
            weak.upgrade()
                .map(|s| s.inner.lock().expect("rooms").hub.list())
                .unwrap_or_default()
        });
        let mut discovery_config = config.discovery.clone();
        discovery_config.http_port = port;
        let discovery = Discovery::start(discovery_config, rooms).await;
        let _ = shared.discovery.set(discovery);
        let (stop, stop_rx) = watch::channel(false);
        let loopback = serve(
            listener,
            router(
                shared.clone(),
                Side::Loopback,
                vec![format!("127.0.0.1:{port}"), format!("localhost:{port}")],
            ),
            stop_rx.clone(),
        );
        let lan = tauri::async_runtime::spawn(follow_rooms(
            shared.clone(),
            want_rx,
            stop_rx,
            port,
            config.lan_ips.clone(),
            config.log.clone(),
        ));
        Ok(RoomServer {
            shared,
            port,
            stop,
            tasks: Mutex::new(vec![loopback, lan]),
        })
    }

    #[cfg(test)]
    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn lan_open(&self) -> bool {
        *self.shared.lan_open.borrow()
    }

    pub fn room_count(&self) -> usize {
        self.shared.inner.lock().expect("rooms").hub.room_count()
    }

    /// Everything off: listeners closed, streams ended, no more beacons.
    pub fn stop(&self) {
        self.shared.lan_open.send_replace(false);
        let _ = self.stop.send(true);
        self.shared.drop_all();
        if let Some(d) = self.shared.discovery() {
            d.set_announce(false);
            d.stop();
        }
        // The listeners close as they shut down (their streams have ended); the LAN task ends.
        for task in self.tasks.lock().expect("tasks").drain(..) {
            drop(task);
        }
    }

    #[cfg(test)]
    fn discovery(&self) -> Arc<Discovery> {
        self.shared.discovery().expect("discovery").clone()
    }
}

/// One listener served until `stop` turns true (open streams end on their own first).
fn serve(listener: TcpListener, app: Router, mut stop: watch::Receiver<bool>) -> JoinHandle<()> {
    let listener = listener.tap_io(|tcp| {
        // Each small message out at once, not held back to fill a packet (Nagle's algorithm).
        let _ = tcp.set_nodelay(true);
    });
    tauri::async_runtime::spawn(async move {
        let service = app.into_make_service_with_connect_info::<SocketAddr>();
        let _ = axum::serve(listener, service)
            .with_graceful_shutdown(async move {
                let _ = stop.wait_for(|s| *s).await;
            })
            .await;
    })
}

/// Opens the LAN listeners (and the beacon) while a page of this computer is in a room here,
/// and closes them when none is.
async fn follow_rooms(
    shared: Arc<Shared>,
    mut want: watch::Receiver<bool>,
    mut stop: watch::Receiver<bool>,
    port: u16,
    lan_ips: Arc<dyn Fn() -> Vec<IpAddr> + Send + Sync>,
    log: Arc<dyn Fn(&str) + Send + Sync>,
) {
    let mut open: Option<watch::Sender<bool>> = None;
    loop {
        tokio::select! {
            changed = want.changed() => if changed.is_err() { break },
            _ = stop.wait_for(|s| *s) => break,
        }
        let wanted = *want.borrow_and_update();
        if wanted && open.is_none() {
            let (close, close_rx) = watch::channel(false);
            let mut listening = 0;
            for ip in lan_ips() {
                match TcpListener::bind((ip, port)).await {
                    Ok(listener) => {
                        // Detached: it ends when `close` turns true.
                        drop(serve(
                            listener,
                            router(shared.clone(), Side::Lan, vec![format!("{ip}:{port}")]),
                            close_rx.clone(),
                        ));
                        listening += 1;
                    }
                    Err(e) => log(&format!("LAN rooms: cannot listen on {ip}:{port} ({e})")),
                }
            }
            if listening == 0 {
                log("LAN rooms: no private network; the room stays on this computer");
                continue;
            }
            shared.lan_open.send_replace(true);
            if let Some(d) = shared.discovery() {
                d.set_announce(true);
            }
            open = Some(close);
        } else if !wanted {
            if let Some(close) = open.take() {
                shut_lan(&shared, &close);
            }
        }
    }
    if let Some(close) = open.take() {
        shut_lan(&shared, &close);
    }
}

fn shut_lan(shared: &Shared, close: &watch::Sender<bool>) {
    // First: LAN requests refused and LAN streams ended; then the listeners close.
    shared.lan_open.send_replace(false);
    if let Some(d) = shared.discovery() {
        d.set_announce(false);
    }
    let _ = close.send(true);
}

#[derive(Clone)]
struct App {
    shared: Arc<Shared>,
    side: Side,
    /// The `Host` values this listener answers (its own address): a page that reached it under
    /// another name (DNS rebinding) is refused.
    hosts: Arc<Vec<String>>,
}

fn router(shared: Arc<Shared>, side: Side, hosts: Vec<String>) -> Router {
    let app = App {
        shared,
        side,
        hosts: Arc::new(hosts),
    };
    Router::new()
        .route(&format!("{ROOM_PATH}/hello"), get(hello))
        .route(&format!("{ROOM_PATH}/events"), get(events))
        .route(&format!("{ROOM_PATH}/send"), post(send))
        .route(&format!("{ROOM_PATH}/lan"), get(lan))
        .route(
            &format!("{ROOM_PATH}/via/{{at}}/{{what}}"),
            get(via).post(via),
        )
        .fallback(|| async { StatusCode::NOT_FOUND })
        .layer(middleware::from_fn_with_state(app.clone(), guard))
        .with_state(app)
}

/// Host, LAN rules, origins and CORS, before any route.
async fn guard(State(app): State<App>, req: Request, next: Next) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok());
    if !host.is_some_and(|h| app.hosts.iter().any(|ok| ok.eq_ignore_ascii_case(h))) {
        return StatusCode::FORBIDDEN.into_response();
    }
    if app.side == Side::Lan {
        let peer = req.extensions().get::<ConnectInfo<SocketAddr>>();
        let peer_ok = peer.is_some_and(|c| is_private_or_loopback(c.0.ip()));
        if !peer_ok || !*app.shared.lan_open.borrow() {
            return StatusCode::FORBIDDEN.into_response();
        }
    }
    let origin = req.headers().get(header::ORIGIN).cloned();
    if let Some(o) = &origin {
        if !o.to_str().is_ok_and(|o| ALLOWED_ORIGINS.contains(&o)) {
            return StatusCode::FORBIDDEN.into_response();
        }
    }
    let preflight = req.method() == Method::OPTIONS;
    let private_network = req
        .headers()
        .get("access-control-request-private-network")
        .is_some_and(|v| v == "true");
    let mut res = if preflight {
        StatusCode::NO_CONTENT.into_response()
    } else {
        next.run(req).await
    };
    // Never read as anything but what it says it is (JSON, an event stream).
    res.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    if let Some(o) = origin {
        let h = res.headers_mut();
        h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, o);
        h.insert(header::VARY, HeaderValue::from_static("origin"));
        if preflight {
            h.insert(
                header::ACCESS_CONTROL_ALLOW_METHODS,
                HeaderValue::from_static("GET, POST"),
            );
            h.insert(
                header::ACCESS_CONTROL_ALLOW_HEADERS,
                HeaderValue::from_static("content-type, x-room-client"),
            );
            h.insert(
                header::ACCESS_CONTROL_MAX_AGE,
                HeaderValue::from_static("600"),
            );
            if private_network {
                h.insert(
                    "access-control-allow-private-network",
                    HeaderValue::from_static("true"),
                );
            }
        }
    }
    res
}

fn json_response(body: String) -> Response {
    ([(header::CONTENT_TYPE, "application/json")], body).into_response()
}

async fn hello() -> Response {
    json_response(r#"{"rooms":true}"#.to_string())
}

async fn lan(State(app): State<App>) -> Response {
    if app.side != Side::Loopback {
        return StatusCode::NOT_FOUND.into_response();
    }
    let servers = app
        .shared
        .discovery()
        .map(|d| d.servers())
        .unwrap_or_default();
    json_response(json!({ "servers": servers }).to_string())
}

/// Leaves the hub when the stream is dropped (the page closed, or the server stopped).
struct Leave {
    shared: Arc<Shared>,
    id: ClientId,
}

impl Drop for Leave {
    fn drop(&mut self) {
        self.shared.disconnect(self.id);
    }
}

struct Stream {
    rx: mpsc::Receiver<Arc<str>>,
    hello: Option<String>,
    /// A LAN connection's stream ends when the LAN closes.
    lan: Option<watch::Receiver<bool>>,
    _leave: Leave,
}

async fn events(State(app): State<App>, ConnectInfo(peer): ConnectInfo<SocketAddr>) -> Response {
    let lan = app.side == Side::Lan;
    let (key, id, rx) = match app.shared.connect(lan.then_some(peer.ip())) {
        Ok(c) => c,
        Err(status) => return status.into_response(),
    };
    let state = Stream {
        rx,
        hello: Some(key),
        lan: lan.then(|| app.shared.lan_open.subscribe()),
        _leave: Leave {
            shared: app.shared.clone(),
            id,
        },
    };
    let stream = futures_util::stream::unfold(state, |mut s| async move {
        if let Some(key) = s.hello.take() {
            let hello = Event::default()
                .event("hello")
                .data(json!({ "id": key }).to_string());
            return Some((Ok::<Event, Infallible>(hello), s));
        }
        let next = match s.lan.as_mut() {
            Some(lan) => tokio::select! {
                m = s.rx.recv() => m,
                _ = lan.wait_for(|open| !*open) => None,
            },
            None => s.rx.recv().await,
        };
        next.map(|text| (Ok(Event::default().data(&*text)), s))
    });
    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(KEEP_ALIVE))
        .into_response()
}

/// A POST's body as text, at most MESSAGE_MAX_CHARS characters; Err: the status to answer.
async fn body_text(body: Body) -> Result<String, StatusCode> {
    let bytes = to_bytes(body, BODY_MAX_BYTES)
        .await
        .map_err(|_| StatusCode::PAYLOAD_TOO_LARGE)?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    if js_len(&text) > MESSAGE_MAX_CHARS {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }
    Ok(text)
}

async fn send(State(app): State<App>, headers: HeaderMap, body: Body) -> StatusCode {
    let key = headers
        .get(ROOM_CLIENT_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    if !app.shared.knows(&key) {
        return StatusCode::FORBIDDEN;
    }
    let text = match body_text(body).await {
        Ok(t) => t,
        Err(status) => return status,
    };
    // Read, and dropped when it is not JSON: nothing is answered.
    let Ok(data) = serde_json::from_str::<Value>(&text) else {
        return StatusCode::NO_CONTENT;
    };
    // Several messages in one POST (sent together while the one before was on its way).
    let messages = match data {
        Value::Array(list) => list.into_iter().take(BATCH_MAX).collect(),
        one => vec![one],
    };
    if app.shared.receive(&key, &messages) {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::FORBIDDEN
    }
}

/// One request to the room server `at`, its answer passed back as it comes (SSE unbuffered).
async fn via(
    State(app): State<App>,
    Path((at, what)): Path<(String, String)>,
    method: Method,
    headers: HeaderMap,
    body: Body,
) -> Response {
    let not_found = || StatusCode::NOT_FOUND.into_response();
    if app.side != Side::Loopback || !["hello", "events", "send"].contains(&what.as_str()) {
        return not_found();
    }
    let heard = app
        .shared
        .discovery()
        .is_some_and(|d| d.servers().iter().any(|s| s.at == at));
    let Some(addr) = at
        .parse::<SocketAddr>()
        .ok()
        .filter(|a| heard && is_private_or_loopback(a.ip()))
    else {
        return not_found();
    };
    let url = format!("http://{addr}{ROOM_PATH}/{what}");
    let Ok(method) = reqwest::Method::from_bytes(method.as_str().as_bytes()) else {
        return not_found();
    };
    let post = method == reqwest::Method::POST;
    let mut request = app.shared.proxy.request(method, url);
    for name in ["content-type", "accept", ROOM_CLIENT_HEADER] {
        if let Some(value) = headers.get(name).and_then(|v| v.to_str().ok()) {
            request = request.header(name, value);
        }
    }
    if post {
        match body_text(body).await {
            Ok(text) => request = request.body(text),
            Err(status) => return status.into_response(),
        }
    }
    let Ok(answer) = request.send().await else {
        return StatusCode::BAD_GATEWAY.into_response();
    };
    let status = answer.status().as_u16();
    // Only what a room server sends is passed back, under its own type: JSON for `hello`, an
    // event stream for `events`, a bare status otherwise (another server's page never runs here).
    let expected = match what.as_str() {
        "hello" => "application/json",
        "events" => "text/event-stream",
        _ => "",
    };
    // The type's essence, exactly ("text/event-stream; charset=utf-8" is one; a list is not).
    let essence = answer
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(';').next())
        .map(|v| v.trim().to_ascii_lowercase())
        .unwrap_or_default();
    if !(200..300).contains(&status) || expected.is_empty() {
        return StatusCode::from_u16(status)
            .unwrap_or(StatusCode::BAD_GATEWAY)
            .into_response();
    }
    if essence != expected {
        return StatusCode::BAD_GATEWAY.into_response();
    }
    // Our own headers, never the other server's.
    Response::builder()
        .status(status)
        .header("content-type", expected)
        .header("cache-control", "no-cache")
        .header("content-security-policy", "sandbox; default-src 'none'")
        .body(Body::from_stream(answer.bytes_stream()))
        .unwrap_or_else(|_| StatusCode::BAD_GATEWAY.into_response())
}

#[cfg(test)]
mod tests {
    //! The game's `roomHttp.test.ts` on real loopback sockets, and SimLab's LAN rules: two
    //! players, each a stream of events and POSTs. 127.0.0.2 stands in for a LAN address.
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    fn config() -> ServerConfig {
        ServerConfig {
            loopback: SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
            lan_ips: Arc::new(|| vec![IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2))]),
            discovery: DiscoveryConfig {
                http_port: 0,
                bind: SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
                every: Duration::from_millis(50),
                targets: Arc::new(Vec::new),
                now_ms: Arc::new(now_ms),
                log: Arc::new(|_| {}),
            },
            log: Arc::new(|_| {}),
        }
    }

    fn http() -> reqwest::Client {
        reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("client")
    }

    fn base(ip: &str, port: u16) -> String {
        format!("http://{ip}:{port}{ROOM_PATH}")
    }

    async fn eventually(check: impl Fn() -> bool) -> bool {
        for _ in 0..150 {
            if check() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        check()
    }

    fn character() -> Value {
        json!({ "id": "an", "appearance": { "hair": "short" } })
    }

    fn pose() -> Value {
        json!({ "scene": "simlab-hub", "x": 1, "y": 0, "z": 2, "yaw": 0.5, "speed": 1 })
    }

    /// A player: its stream read as it comes, its name from `hello`, and its POSTs.
    struct Player {
        base: String,
        id: Arc<Mutex<String>>,
        got: Arc<Mutex<Vec<Value>>>,
        ended: Arc<AtomicBool>,
        reader: JoinHandle<()>,
    }

    impl Player {
        async fn join(base: &str) -> Player {
            Self::join_with(base, None).await.expect("stream")
        }

        async fn join_with(base: &str, origin: Option<&str>) -> Option<Player> {
            let mut request = http().get(format!("{base}/events"));
            if let Some(o) = origin {
                request = request.header("origin", o);
            }
            let mut answer = request.send().await.ok()?;
            if answer.status() != 200 {
                return None;
            }
            let id = Arc::new(Mutex::new(String::new()));
            let got = Arc::new(Mutex::new(Vec::new()));
            let ended = Arc::new(AtomicBool::new(false));
            let (id2, got2, ended2) = (id.clone(), got.clone(), ended.clone());
            let reader = tauri::async_runtime::spawn(async move {
                let mut buffer = String::new();
                while let Ok(Some(chunk)) = answer.chunk().await {
                    buffer.push_str(&String::from_utf8_lossy(&chunk));
                    while let Some(end) = buffer.find("\n\n") {
                        let event: String = buffer.drain(..end + 2).collect();
                        let data = event.lines().find_map(|l| {
                            l.strip_prefix("data:").map(|d| d.trim_start().to_string())
                        });
                        let Some(data) = data else { continue };
                        let value: Value = serde_json::from_str(&data).expect("JSON event");
                        if event.starts_with("event: hello") || event.starts_with("event:hello") {
                            *id2.lock().unwrap() = value["id"].as_str().unwrap().to_string();
                        } else {
                            got2.lock().unwrap().push(value);
                        }
                    }
                }
                ended2.store(true, Ordering::SeqCst);
            });
            let player = Player {
                base: base.to_string(),
                id,
                got,
                ended,
                reader,
            };
            assert!(eventually(|| !player.id().is_empty()).await);
            Some(player)
        }

        fn id(&self) -> String {
            self.id.lock().unwrap().clone()
        }

        async fn send(&self, body: impl Into<String>) -> u16 {
            self.send_as(body, &self.id()).await
        }

        async fn send_as(&self, body: impl Into<String>, as_id: &str) -> u16 {
            http()
                .post(format!("{}/send", self.base))
                .header("content-type", "application/json")
                .header(ROOM_CLIENT_HEADER, as_id)
                .body(body.into())
                .send()
                .await
                .map_or(0, |r| r.status().as_u16())
        }

        fn last(&self, t: &str) -> Option<Value> {
            self.got
                .lock()
                .unwrap()
                .iter()
                .rev()
                .find(|m| m["t"] == t)
                .cloned()
        }

        fn ended(&self) -> bool {
            self.ended.load(Ordering::SeqCst)
        }

        fn close(self) {
            self.reader.abort();
        }
    }

    fn create(room: &str, player: &str) -> String {
        json!({ "t": "create", "room": room, "player": player, "character": character() })
            .to_string()
    }

    fn join(id: &str, player: &str) -> String {
        json!({ "t": "join", "roomId": id, "player": player, "character": character() }).to_string()
    }

    fn room_id(p: &Player) -> String {
        p.last("joined").expect("joined")["room"]["id"]
            .as_str()
            .expect("id")
            .to_string()
    }

    #[test]
    fn says_it_is_one_so_a_page_tells_it_from_a_file_server() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let b = base("127.0.0.1", server.port());
            let hello = http()
                .get(format!("{b}/hello"))
                .send()
                .await
                .expect("hello");
            let kind = hello.headers()["content-type"]
                .to_str()
                .unwrap()
                .to_string();
            assert!(kind.contains("application/json"));
            assert_eq!(
                hello.json::<Value>().await.unwrap(),
                json!({ "rooms": true })
            );
            let nothing = http().get(format!("{b}/nothing")).send().await.unwrap();
            assert_eq!(nothing.status(), 404);
            server.stop();
        });
    }

    #[test]
    fn two_players_create_list_join_relay_a_pose_and_one_closes() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let b = base("127.0.0.1", server.port());
            let a = Player::join(&b).await;
            let p = Player::join(&b).await;
            assert_eq!(a.send(create("Lớp 11A", "An")).await, 204);
            assert!(eventually(|| a.last("joined").is_some()).await);
            assert_eq!(a.last("joined").unwrap()["room"]["name"], "Lớp 11A");
            let id = room_id(&a);
            assert!(
                eventually(|| p.last("rooms").is_some_and(|r| r["rooms"][0]["id"] == id)).await
            );
            p.send(join(&id, "Bình")).await;
            assert!(
                eventually(|| p
                    .last("joined")
                    .is_some_and(|j| j["peers"][0]["name"] == "An"))
                .await
            );
            assert!(
                eventually(|| a.last("peer").is_some_and(|m| m["peer"]["name"] == "Bình")).await
            );
            a.send(json!({ "t": "pose", "pose": pose() }).to_string())
                .await;
            assert!(eventually(|| p.last("pose").is_some_and(|m| m["pose"] == pose())).await);
            // B's page closes: its stream ends, and A hears B is gone (the room counts one again).
            p.close();
            assert!(eventually(|| a.last("gone").is_some()).await);
            assert!(
                eventually(|| a
                    .last("rooms")
                    .is_some_and(|r| r["rooms"][0]["players"] == 1))
                .await
            );
            a.close();
            server.stop();
        });
    }

    #[test]
    fn takes_several_messages_in_one_post_in_order() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let a = Player::join(&base("127.0.0.1", server.port())).await;
            let batch = json!([
                { "t": "create", "room": "Lớp 11B", "player": "An", "character": character() },
                { "t": "pose", "pose": pose() },
                { "t": "chat", "text": "xin chào" },
            ]);
            assert_eq!(a.send(batch.to_string()).await, 204);
            assert!(eventually(|| a.last("joined").is_some()).await);
            // After the create: in the room.
            assert!(eventually(|| a.last("chat").is_some_and(|c| c["text"] == "xin chào")).await);
            a.close();
            server.stop();
        });
    }

    #[test]
    fn drops_a_stranger_a_broken_body_and_an_over_long_one() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let a = Player::join(&base("127.0.0.1", server.port())).await;
            let list = json!({ "t": "list" }).to_string();
            assert_eq!(a.send_as(list.clone(), "not-a-player").await, 403);
            assert_eq!(a.send("{not json").await, 204); // read, dropped: nothing answered
            let long =
                json!({ "t": "create", "room": "x".repeat(MESSAGE_MAX_CHARS), "player": "A" });
            assert_eq!(a.send(long.to_string()).await, 413);
            a.send(list).await;
            assert!(eventually(|| a.last("rooms").is_some_and(|r| r["rooms"] == json!([]))).await);
            assert!(a.last("joined").is_none());
            a.close();
            server.stop();
        });
    }

    #[test]
    fn answers_the_apps_pages_with_cors_and_refuses_other_origins() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let b = base("127.0.0.1", server.port());
            for origin in ALLOWED_ORIGINS {
                let r = http()
                    .get(format!("{b}/hello"))
                    .header("origin", origin)
                    .send()
                    .await
                    .unwrap();
                assert_eq!(r.status(), 200);
                assert_eq!(r.headers()["access-control-allow-origin"], origin);
            }
            let preflight = http()
                .request(reqwest::Method::OPTIONS, format!("{b}/send"))
                .header("origin", "http://tauri.localhost")
                .header("access-control-request-method", "POST")
                .header(
                    "access-control-request-headers",
                    "content-type, x-room-client",
                )
                .send()
                .await
                .unwrap();
            assert_eq!(preflight.status(), 204);
            let allowed = preflight.headers()["access-control-allow-headers"]
                .to_str()
                .unwrap()
                .to_string();
            assert!(allowed.contains("x-room-client") && allowed.contains("content-type"));
            for stranger in ["https://example.com", "null", "http://localhost:1421"] {
                let r = http()
                    .get(format!("{b}/hello"))
                    .header("origin", stranger)
                    .send()
                    .await
                    .unwrap();
                assert_eq!(r.status(), 403, "{stranger}");
            }
            // The app's page reads its stream across origins (no credentials).
            let page = Player::join_with(&b, Some("http://tauri.localhost")).await;
            assert!(page.is_some());
            assert!(Player::join_with(&b, Some("https://example.com"))
                .await
                .is_none());
            page.unwrap().close();
            server.stop();
        });
    }

    #[test]
    fn opens_to_the_lan_only_while_a_page_here_is_in_a_room() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let port = server.port();
            let here = base("127.0.0.1", port);
            let lan = base("127.0.0.2", port);
            // No room here: nothing listens on the LAN, nothing is announced.
            assert!(!server.lan_open());
            assert!(http().get(format!("{lan}/hello")).send().await.is_err());
            assert!(!server.discovery().announcing());

            let host = Player::join(&here).await;
            host.send(create("Lớp 11A", "An")).await;
            assert!(eventually(|| server.lan_open()).await);
            assert!(server.discovery().announcing());
            let guest = Player::join(&lan).await;
            // A new connection hears the list when it changes, or when it asks (as in the game).
            guest.send(json!({ "t": "list" }).to_string()).await;
            assert!(
                eventually(|| guest
                    .last("rooms")
                    .is_some_and(|r| r["rooms"][0]["host"] == "An"))
                .await
            );
            guest.send(join(&room_id(&host), "Bình")).await;
            assert!(
                eventually(|| host
                    .last("peer")
                    .is_some_and(|m| m["peer"]["name"] == "Bình"))
                .await
            );
            // From the LAN: no list of servers, no relay through this computer.
            let refused = http().get(format!("{lan}/lan")).send().await.unwrap();
            assert_eq!(refused.status(), 404);
            let relay = http()
                .get(format!("{lan}/via/127.0.0.1:{port}/hello"))
                .send()
                .await
                .unwrap();
            assert_eq!(relay.status(), 404);

            // The page here leaves its room: the LAN closes, the guest's stream ends.
            host.send(json!({ "t": "leave" }).to_string()).await;
            assert!(eventually(|| !server.lan_open()).await);
            assert!(!server.discovery().announcing());
            assert!(eventually(|| guest.ended()).await);
            let late = http().get(format!("{lan}/hello")).send().await;
            assert!(late.is_err() || late.unwrap().status() == 403);
            assert!(eventually(|| server.room_count() == 0).await);
            host.close();
            guest.close();
            server.stop();
        });
    }

    #[test]
    fn a_room_made_from_the_lan_does_not_keep_it_open() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let port = server.port();
            let host = Player::join(&base("127.0.0.1", port)).await;
            host.send(create("Here", "An")).await;
            assert!(eventually(|| server.lan_open()).await);
            let guest = Player::join(&base("127.0.0.2", port)).await;
            guest.send(create("There", "Bình")).await;
            assert!(eventually(|| server.room_count() == 2).await);
            host.close(); // the page here closes
            assert!(eventually(|| !server.lan_open()).await);
            assert!(eventually(|| guest.ended()).await);
            assert!(eventually(|| server.room_count() == 0).await);
            guest.close();
            server.stop();
        });
    }

    #[test]
    fn lists_lan_servers_and_a_player_here_joins_a_room_there_and_leaves() {
        tauri::async_runtime::block_on(async {
            let there = RoomServer::start(config()).await.expect("there");
            let here = RoomServer::start(config()).await.expect("here");
            let at = format!("127.0.0.1:{}", there.port());
            here.discovery()
                .note(at.parse().unwrap(), "PC-B".into(), vec![]);
            let h = base("127.0.0.1", here.port());
            let listed: Value = http()
                .get(format!("{h}/lan"))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            assert_eq!(
                listed,
                json!({ "servers": [{ "at": at, "name": "PC-B", "rooms": [] }] })
            );
            let encoded = at.replace(':', "%3A");
            let hello: Value = http()
                .get(format!("{h}/via/{encoded}/hello"))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            assert_eq!(hello, json!({ "rooms": true }));

            let host = Player::join(&base("127.0.0.1", there.port())).await;
            host.send(create("Lớp 11A", "An")).await;
            assert!(eventually(|| host.last("joined").is_some()).await);
            let id = room_id(&host);
            // POSTs go there and its stream comes back as it is written.
            let guest = Player::join(&format!("{h}/via/{at}")).await;
            assert_eq!(guest.send(json!({ "t": "list" }).to_string()).await, 204);
            assert!(
                eventually(|| guest
                    .last("rooms")
                    .is_some_and(|r| r["rooms"][0]["id"] == id))
                .await
            );
            assert_eq!(guest.send(join(&id, "Bình")).await, 204);
            assert!(
                eventually(|| guest
                    .last("joined")
                    .is_some_and(|j| j["peers"][0]["name"] == "An"))
                .await
            );
            assert!(
                eventually(|| host
                    .last("peer")
                    .is_some_and(|m| m["peer"]["name"] == "Bình"))
                .await
            );
            guest
                .send(json!({ "t": "pose", "pose": pose() }).to_string())
                .await;
            assert!(eventually(|| host.last("pose").is_some_and(|m| m["pose"] == pose())).await);
            // The guest's page closes here: the stream there closes too, so it leaves the room.
            guest.close();
            assert!(eventually(|| host.last("gone").is_some()).await);
            host.close();
            here.stop();
            there.stop();
        });
    }

    #[test]
    fn is_no_open_proxy() {
        tauri::async_runtime::block_on(async {
            let there = RoomServer::start(config()).await.expect("there");
            let at = format!("127.0.0.1:{}", there.port());
            let here = RoomServer::start(config()).await.expect("here");
            let h = base("127.0.0.1", here.port());
            let listed: Value = http()
                .get(format!("{h}/lan"))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            assert_eq!(listed, json!({ "servers": [] }));
            let not_heard = http()
                .get(format!("{h}/via/{at}/hello"))
                .send()
                .await
                .unwrap();
            assert_eq!(not_heard.status(), 404);
            let post = http()
                .post(format!("{h}/via/{at}/send"))
                .body("{}")
                .send()
                .await
                .unwrap();
            assert_eq!(post.status(), 404);
            here.discovery()
                .note(at.parse().unwrap(), "B".into(), vec![]);
            let other = http()
                .get(format!("{h}/via/{at}/other"))
                .send()
                .await
                .unwrap();
            assert_eq!(other.status(), 404);
            // An answer of the other server is passed back as it is (a stranger's POST: 403).
            let stranger = http()
                .post(format!("{h}/via/{at}/send"))
                .body("{}")
                .send()
                .await
                .unwrap();
            assert_eq!(stranger.status(), 403);
            // A heard address outside private networks is never reached.
            here.discovery()
                .note("8.8.8.8:5189".parse().unwrap(), "X".into(), vec![]);
            let public = http()
                .get(format!("{h}/via/8.8.8.8:5189/hello"))
                .send()
                .await
                .unwrap();
            assert_eq!(public.status(), 404);
            here.stop();
            there.stop();
        });
    }

    #[test]
    fn answers_only_under_its_own_address_no_dns_rebinding() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let port = server.port();
            let hello = |ip: &'static str, host: String| {
                http()
                    .get(format!("http://{ip}:{port}{ROOM_PATH}/hello"))
                    .header("host", host)
                    .send()
            };
            for ok in [format!("127.0.0.1:{port}"), format!("localhost:{port}")] {
                assert_eq!(
                    hello("127.0.0.1", ok.clone()).await.unwrap().status(),
                    200,
                    "{ok}"
                );
            }
            for bad in [
                format!("evil.example:{port}"),
                format!("127.0.0.1:{}", port.wrapping_add(1)),
                "127.0.0.1".to_string(),
                format!("127.0.0.2:{port}"),
            ] {
                assert_eq!(
                    hello("127.0.0.1", bad.clone()).await.unwrap().status(),
                    403,
                    "{bad}"
                );
            }
            let a = Player::join(&base("127.0.0.1", port)).await;
            a.send(create("R", "A")).await;
            assert!(eventually(|| server.lan_open()).await);
            let lan_ok = hello("127.0.0.2", format!("127.0.0.2:{port}"))
                .await
                .unwrap();
            assert_eq!(lan_ok.status(), 200);
            for bad in [format!("127.0.0.1:{port}"), format!("localhost:{port}")] {
                assert_eq!(
                    hello("127.0.0.2", bad.clone()).await.unwrap().status(),
                    403,
                    "{bad}"
                );
            }
            let nosniff = hello("127.0.0.1", format!("127.0.0.1:{port}"))
                .await
                .unwrap();
            assert_eq!(nosniff.headers()["x-content-type-options"], "nosniff");
            a.close();
            server.stop();
        });
    }

    #[test]
    fn caps_the_streams_in_all_and_per_lan_address() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let port = server.port();
            let here = base("127.0.0.1", port);
            let host = Player::join(&here).await;
            host.send(create("R", "A")).await;
            assert!(eventually(|| server.lan_open()).await);
            let mut lan = Vec::new();
            for _ in 0..MAX_STREAMS_PER_LAN_IP {
                lan.push(Player::join(&base("127.0.0.2", port)).await);
            }
            let one_more = http()
                .get(format!("{}/events", base("127.0.0.2", port)))
                .send()
                .await
                .unwrap();
            assert_eq!(one_more.status(), 503);
            let mut local = Vec::new();
            while 1 + lan.len() + local.len() < MAX_STREAMS {
                local.push(Player::join(&here).await);
            }
            let past = http().get(format!("{here}/events")).send().await.unwrap();
            assert_eq!(past.status(), 503);
            // A closed stream makes room again.
            local.pop().unwrap().close();
            let mut again = None;
            for _ in 0..50 {
                if let Some(p) = Player::join_with(&here, None).await {
                    again = Some(p);
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(again.is_some());
            for p in lan.into_iter().chain(local).chain(again).chain([host]) {
                p.close();
            }
            server.stop();
        });
    }

    #[test]
    fn passes_back_only_a_room_servers_own_kind_of_answer() {
        tauri::async_runtime::block_on(async {
            // A "server" that answers its hello with a web page.
            let fake = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
            let fake_port = fake.local_addr().unwrap().port();
            let page = Router::new()
                .route(
                    &format!("{ROOM_PATH}/hello"),
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "text/html")],
                            "<script>alert(1)</script>",
                        )
                    }),
                )
                .route(
                    &format!("{ROOM_PATH}/events"),
                    get(|| async {
                        (
                            [(header::CONTENT_TYPE, "text/event-stream, text/html")],
                            "<script>alert(1)</script>",
                        )
                    }),
                );
            let fake_task = tauri::async_runtime::spawn(async move {
                let _ = axum::serve(fake, page).await;
            });
            let here = RoomServer::start(config()).await.expect("here");
            let at = format!("127.0.0.1:{fake_port}");
            here.discovery()
                .note(at.parse().unwrap(), "X".into(), vec![]);
            let h = base("127.0.0.1", here.port());
            let answer = http()
                .get(format!("{h}/via/{at}/hello"))
                .send()
                .await
                .unwrap();
            assert_eq!(answer.status(), 502);
            // A list of types is no event stream either.
            let events = http()
                .get(format!("{h}/via/{at}/events"))
                .send()
                .await
                .unwrap();
            assert_eq!(events.status(), 502);
            fake_task.abort();
            here.stop();
        });
    }

    #[test]
    fn stops_all_streams_and_frees_its_port() {
        tauri::async_runtime::block_on(async {
            let server = RoomServer::start(config()).await.expect("start");
            let port = server.port();
            let a = Player::join(&base("127.0.0.1", port)).await;
            a.send(create("R", "A")).await;
            assert!(eventually(|| server.lan_open()).await);
            server.stop();
            assert!(eventually(|| a.ended()).await);
            assert!(!server.lan_open());
            let mut again = config();
            again.loopback = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
            let mut restarted = None;
            for _ in 0..50 {
                if let Ok(s) = RoomServer::start(again.clone()).await {
                    restarted = Some(s);
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            restarted.expect("port free again").stop();
            a.close();
        });
    }
}
