//! LAN rooms of the SimLab 3D game (#339): the room server the game reaches at
//! `http://127.0.0.1:5189/simlab-rooms`, in Rust (the standalone game runs it in Vite).
//! Players on the same Wi-Fi see each other move and chat in text; no voice, no Internet.
//!
//! - `protocol.rs`: the game's messages, checked one by one;
//! - `hub.rs`: rooms, members, host, station locks (the game's `RoomHub.ts`);
//! - `http.rs`: the HTTP server (SSE down, POSTs up, `lan`, `via`), loopback until a page of this
//!   computer is in a room here, then also on its private network addresses;
//! - `discovery.rs`: UDP beacons on port 5188 (heard always, sent only while hosting).
//!
//! Commands: `rooms_start` (the game opened), `rooms_stop` (it closed), `rooms_status`. The app
//! stops the server on exit too.

pub mod discovery;
pub mod http;
pub mod hub;
pub mod protocol;

use serde::Serialize;
use tokio::sync::Mutex;

use http::{RoomServer, ServerConfig};

/// Refused: something else on this computer already uses the room server's port.
pub const PORT_BUSY: &str = "rooms-port-busy";

#[derive(Default)]
pub struct RoomsState(Mutex<Option<RoomServer>>);

impl RoomsState {
    /// On exit: everything off at once.
    pub fn stop_now(&self) {
        if let Ok(mut server) = self.0.try_lock() {
            if let Some(s) = server.take() {
                s.stop();
            }
        }
    }
}

/// What the game page needs to know.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct RoomsStatus {
    pub running: bool,
    /// Listening on the LAN and announcing (a page of this computer is in a room here).
    pub lan_open: bool,
    /// Rooms open on this computer.
    pub rooms: usize,
}

fn status_of(server: Option<&RoomServer>) -> RoomsStatus {
    RoomsStatus {
        running: server.is_some(),
        lan_open: server.is_some_and(RoomServer::lan_open),
        rooms: server.map_or(0, RoomServer::room_count),
    }
}

/// The game opened: the room server on 127.0.0.1:5189, and listening for LAN beacons.
#[tauri::command]
pub async fn rooms_start(state: tauri::State<'_, RoomsState>) -> Result<RoomsStatus, String> {
    let mut server = state.0.lock().await;
    if server.is_none() {
        let started = RoomServer::start(ServerConfig::app()).await.map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                PORT_BUSY.to_string()
            } else {
                format!("rooms-start-failed: {e}")
            }
        })?;
        *server = Some(started);
    }
    Ok(status_of(server.as_ref()))
}

/// The game closed: every listener, stream and beacon off.
#[tauri::command]
pub async fn rooms_stop(state: tauri::State<'_, RoomsState>) -> Result<RoomsStatus, String> {
    let mut server = state.0.lock().await;
    if let Some(s) = server.take() {
        s.stop();
    }
    Ok(status_of(None))
}

#[tauri::command]
pub async fn rooms_status(state: tauri::State<'_, RoomsState>) -> Result<RoomsStatus, String> {
    Ok(status_of(state.0.lock().await.as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_reads_snake_case_for_the_game() {
        let s = status_of(None);
        assert_eq!(
            serde_json::to_value(s).unwrap(),
            serde_json::json!({ "running": false, "lan_open": false, "rooms": 0 })
        );
    }

    #[test]
    fn the_app_listens_on_loopback_port_5189_and_beacons_on_5188() {
        let config = ServerConfig::app();
        assert_eq!(config.loopback.to_string(), "127.0.0.1:5189");
        assert_eq!(config.discovery.bind.port(), discovery::DISCOVERY_PORT);
        assert_eq!(config.discovery.http_port, http::HTTP_PORT);
        // Whatever the LAN addresses are, they are private ones.
        for ip in (config.lan_ips)() {
            assert!(discovery::is_private_or_loopback(ip) && !ip.is_loopback());
        }
    }
}
