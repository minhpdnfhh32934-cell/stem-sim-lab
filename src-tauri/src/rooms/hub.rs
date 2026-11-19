//! The room server's state (#339), a port of the game's `RoomHub.ts`: rooms, who is in each,
//! where they are, who works which station. Pure: the HTTP layer feeds it each message and sends
//! what it answers (an outbox of JSON texts per connection). A room lives while someone is in it;
//! whoever is left becomes its host. A member's stations are free again when they leave or their
//! connection closes. Every message is checked first (rate, size, schema); a bad one is dropped.
//!
//! Two differences from the game's hub, both decided for SimLab: voice set-up (`signal`) is
//! checked but never relayed (voice is off in SimLab, 19/11/2026), and the hub knows which
//! connections are this computer's own (`connect(.., local)`), so the server opens to the LAN
//! only while one of them is in a room (`has_local_member`).

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use serde_json::{json, Value};

use super::protocol::{
    js_len, parse_client, peer, summary, ClientMessage, MAX_PLAYERS, MAX_ROOMS, MESSAGES_PER_S,
    MESSAGE_MAX_CHARS, ROOM_ID_CHARS, ROOM_ID_LEN,
};

/// A connection, as the HTTP layer numbers them.
pub type ClientId = u64;

/// Messages to send: each a JSON text for one connection (shared when several get the same).
pub type Outbox = Vec<(ClientId, Arc<str>)>;

struct Member {
    id: String,
    name: String,
    character: Value,
    client: ClientId,
    /// Their last pose, or null.
    pose: Value,
}

struct Room {
    id: String,
    name: String,
    host_id: String,
    /// In the order they came (the first one left hosts the room).
    members: Vec<Member>,
    /// Station id → the member who works it; the others only watch.
    locks: BTreeMap<String, String>,
}

impl Room {
    fn summary(&self) -> Value {
        let host = self.members.iter().find(|m| m.id == self.host_id);
        summary(
            &self.id,
            &self.name,
            host.map_or("", |m| m.name.as_str()),
            self.members.len(),
        )
    }

    fn locks_message(&self) -> Value {
        json!({ "t": "locks", "locks": self.locks })
    }
}

pub struct RoomHub {
    /// In the order they were created (the list shows them so).
    rooms: Vec<Room>,
    /// Connection → the room it is in.
    room_of: HashMap<ClientId, String>,
    /// Every connection, in order: each hears the room list when it changes.
    clients: Vec<ClientId>,
    /// This computer's own connections (its pages, on the loopback listener).
    local: HashSet<ClientId>,
    /// Connection → (second, messages counted in it).
    rate: HashMap<ClientId, (u64, u32)>,
    next: u64,
    random: Box<dyn FnMut() -> f64 + Send>,
    now_ms: Box<dyn Fn() -> u64 + Send>,
}

fn push(out: &mut Outbox, to: ClientId, message: &Value) {
    out.push((to, Arc::from(message.to_string())));
}

impl RoomHub {
    /// `random`: in [0, 1), for room IDs; `now_ms`: the clock of the rate limit.
    pub fn new(
        random: impl FnMut() -> f64 + Send + 'static,
        now_ms: impl Fn() -> u64 + Send + 'static,
    ) -> Self {
        RoomHub {
            rooms: Vec::new(),
            room_of: HashMap::new(),
            clients: Vec::new(),
            local: HashSet::new(),
            rate: HashMap::new(),
            next: 1,
            random: Box::new(random),
            now_ms: Box::new(now_ms),
        }
    }

    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// Whether one of this computer's own connections is in a room here.
    pub fn has_local_member(&self) -> bool {
        self.room_of.keys().any(|c| self.local.contains(c))
    }

    pub fn connect(&mut self, client: ClientId, local: bool) {
        if !self.clients.contains(&client) {
            self.clients.push(client);
        }
        if local {
            self.local.insert(client);
        }
    }

    pub fn disconnect(&mut self, client: ClientId, out: &mut Outbox) {
        self.leave(client, out);
        self.clients.retain(|c| *c != client);
        self.local.remove(&client);
        self.rate.remove(&client);
    }

    /// One message from a connection: counted, measured, checked, then handled.
    pub fn receive(&mut self, client: ClientId, data: &Value, out: &mut Outbox) {
        if !self.clients.contains(&client) || !self.allowed(client) {
            return;
        }
        if js_len(&data.to_string()) > MESSAGE_MAX_CHARS {
            return;
        }
        if let Some(message) = parse_client(data) {
            self.handle(client, message, out);
        }
    }

    /// The open rooms, for the list and the LAN beacon.
    pub fn list(&self) -> Vec<Value> {
        self.rooms.iter().map(Room::summary).collect()
    }

    fn handle(&mut self, client: ClientId, message: ClientMessage, out: &mut Outbox) {
        match message {
            ClientMessage::List => {
                push(out, client, &json!({ "t": "rooms", "rooms": self.list() }));
                return;
            }
            ClientMessage::Ping(n) => {
                push(out, client, &json!({ "t": "pong", "n": n }));
                return;
            }
            ClientMessage::Create {
                room,
                player,
                character,
            } => {
                if self.rooms.len() >= MAX_ROOMS {
                    let refused = json!({ "t": "refused", "reason": "too-many-rooms" });
                    push(out, client, &refused);
                    return;
                }
                self.leave(client, out);
                let id = self.room_id();
                self.rooms.push(Room {
                    id: id.clone(),
                    name: room,
                    host_id: String::new(),
                    members: Vec::new(),
                    locks: BTreeMap::new(),
                });
                self.enter(client, &id, player, character, out);
                return;
            }
            ClientMessage::Join {
                room_id,
                player,
                character,
            } => {
                let Some(room) = self.rooms.iter().find(|r| r.id == room_id) else {
                    let refused = json!({ "t": "refused", "reason": "unknown-room" });
                    push(out, client, &refused);
                    return;
                };
                if self.room_of.get(&client) == Some(&room_id) {
                    return;
                }
                if room.members.len() >= MAX_PLAYERS {
                    push(out, client, &json!({ "t": "refused", "reason": "full" }));
                    return;
                }
                self.leave(client, out);
                self.enter(client, &room_id, player, character, out);
                return;
            }
            ClientMessage::Leave => {
                if self.leave(client, out) {
                    push(out, client, &json!({ "t": "left" }));
                }
                return;
            }
            _ => {}
        }
        let Some((r, me)) = self.member_index(client) else {
            push(
                out,
                client,
                &json!({ "t": "refused", "reason": "not-in-room" }),
            );
            return;
        };
        let member_id = self.rooms[r].members[me].id.clone();
        match message {
            ClientMessage::Pose(pose) => {
                self.rooms[r].members[me].pose = pose.clone();
                let m = json!({ "t": "pose", "id": member_id, "pose": pose });
                self.others(r, client, &m, out);
            }
            ClientMessage::Look(character) => {
                self.rooms[r].members[me].character = character.clone();
                let m = json!({ "t": "look", "id": member_id, "character": character });
                self.others(r, client, &m, out);
            }
            ClientMessage::Claim(station) => {
                self.claim(r, me, &station, out);
            }
            ClientMessage::Event(event) => {
                // Relayed as it is; a person of the world is driven only by who holds their lock
                // (claimed when they began to drive them).
                let k = event["k"].as_str().unwrap_or_default();
                let npc = event["npc"].as_str().unwrap_or_default();
                if k == "npc" && !self.claim(r, me, &format!("npc:{npc}"), out) {
                    return;
                }
                if k == "npcFree" {
                    let lock = format!("npc:{npc}");
                    if self.rooms[r].locks.get(&lock) != Some(&member_id) {
                        return;
                    }
                    self.rooms[r].locks.remove(&lock);
                    self.locks(r, out);
                }
                let m = json!({ "t": "event", "id": member_id, "event": event });
                self.others(r, client, &m, out);
            }
            ClientMessage::Release(station) => {
                if self.rooms[r].locks.get(&station) == Some(&member_id) {
                    self.rooms[r].locks.remove(&station);
                    self.locks(r, out);
                }
            }
            ClientMessage::Chat(text) => {
                let name = self.rooms[r].members[me].name.clone();
                let line: Arc<str> = Arc::from(
                    json!({ "t": "chat", "id": member_id, "name": name, "text": text }).to_string(),
                );
                for m in &self.rooms[r].members {
                    out.push((m.client, line.clone()));
                }
            }
            ClientMessage::Command {
                station_id,
                command,
            } => {
                // Only who works a station shows changes to it (a free one is theirs from now on).
                if !self.claim(r, me, &station_id, out) {
                    return;
                }
                let m = json!({ "t": "command", "id": member_id, "command": command });
                self.others(r, client, &m, out);
            }
            // Voice is off in SimLab: a set-up message reaches no one.
            ClientMessage::Signal => {}
            ClientMessage::List
            | ClientMessage::Ping(_)
            | ClientMessage::Create { .. }
            | ClientMessage::Join { .. }
            | ClientMessage::Leave => {}
        }
    }

    /// (room index, member index) of a connection that is in a room.
    fn member_index(&self, client: ClientId) -> Option<(usize, usize)> {
        let room_id = self.room_of.get(&client)?;
        let r = self.rooms.iter().position(|room| &room.id == room_id)?;
        let m = self.rooms[r]
            .members
            .iter()
            .position(|m| m.client == client)?;
        Some((r, m))
    }

    /// The station is the member's (it was, or was free); else refused, with who has it.
    fn claim(&mut self, r: usize, me: usize, station: &str, out: &mut Outbox) -> bool {
        let room = &mut self.rooms[r];
        let member = &room.members[me];
        match room.locks.get(station) {
            Some(holder) if *holder == member.id => true,
            Some(_) => {
                let refused = json!({ "t": "refused", "reason": "taken", "stationId": station });
                push(out, member.client, &refused);
                push(out, member.client, &room.locks_message());
                false
            }
            None => {
                room.locks.insert(station.to_string(), member.id.clone());
                self.locks(r, out);
                true
            }
        }
    }

    fn enter(
        &mut self,
        client: ClientId,
        room_id: &str,
        name: String,
        character: Value,
        out: &mut Outbox,
    ) {
        let Some(r) = self.rooms.iter().position(|room| room.id == room_id) else {
            return;
        };
        let id = format!("p{}", self.next);
        self.next += 1;
        let room = &mut self.rooms[r];
        if room.members.is_empty() {
            room.host_id = id.clone();
        }
        room.members.push(Member {
            id: id.clone(),
            name,
            character,
            client,
            pose: Value::Null,
        });
        self.room_of.insert(client, room_id.to_string());
        let room = &self.rooms[r];
        let me = room.members.last().expect("just added");
        let peers: Vec<Value> = room
            .members
            .iter()
            .filter(|m| m.client != client)
            .map(|m| peer(&m.id, &m.name, &m.character))
            .collect();
        let joined = json!({ "t": "joined", "room": room.summary(), "you": id, "peers": peers });
        push(out, client, &joined);
        for other in room.members.iter().filter(|m| m.client != client) {
            if !other.pose.is_null() {
                let pose = json!({ "t": "pose", "id": other.id, "pose": other.pose });
                push(out, client, &pose);
            }
        }
        if !room.locks.is_empty() {
            push(out, client, &room.locks_message());
        }
        let arrived = json!({ "t": "peer", "peer": peer(&me.id, &me.name, &me.character) });
        self.others(r, client, &arrived, out);
        self.list_changed(out);
    }

    /// Out of their room, if in one: their stations free, the others told; an empty room closes.
    fn leave(&mut self, client: ClientId, out: &mut Outbox) -> bool {
        let Some((r, me)) = self.member_index(client) else {
            self.room_of.remove(&client);
            return false;
        };
        self.room_of.remove(&client);
        let member = self.rooms[r].members.remove(me);
        let room = &mut self.rooms[r];
        let before = room.locks.len();
        room.locks.retain(|_, holder| *holder != member.id);
        let freed = room.locks.len() != before;
        if room.members.is_empty() {
            self.rooms.remove(r);
        } else {
            if room.host_id == member.id {
                room.host_id = room.members[0].id.clone();
            }
            let gone = json!({ "t": "gone", "id": member.id });
            self.others(r, client, &gone, out);
            if freed {
                self.locks(r, out);
            }
        }
        self.list_changed(out);
        true
    }

    fn others(&self, r: usize, client: ClientId, message: &Value, out: &mut Outbox) {
        let text: Arc<str> = Arc::from(message.to_string());
        for m in self.rooms[r].members.iter().filter(|m| m.client != client) {
            out.push((m.client, text.clone()));
        }
    }

    fn locks(&self, r: usize, out: &mut Outbox) {
        let text: Arc<str> = Arc::from(self.rooms[r].locks_message().to_string());
        for m in &self.rooms[r].members {
            out.push((m.client, text.clone()));
        }
    }

    fn list_changed(&self, out: &mut Outbox) {
        let text: Arc<str> = Arc::from(json!({ "t": "rooms", "rooms": self.list() }).to_string());
        for c in &self.clients {
            out.push((*c, text.clone()));
        }
    }

    /// At most MESSAGES_PER_S messages a second from one connection.
    fn allowed(&mut self, client: ClientId) -> bool {
        let second = (self.now_ms)() / 1000;
        let rate = self.rate.entry(client).or_insert((second, 0));
        if rate.0 != second {
            *rate = (second, 0);
        }
        rate.1 += 1;
        rate.1 <= MESSAGES_PER_S
    }

    fn room_id(&mut self) -> String {
        loop {
            let id: String = (0..ROOM_ID_LEN)
                .map(|_| {
                    let i = ((self.random)() * ROOM_ID_CHARS.len() as f64) as usize;
                    char::from(ROOM_ID_CHARS[i.min(ROOM_ID_CHARS.len() - 1)])
                })
                .collect();
            if !self.rooms.iter().any(|r| r.id == id) {
                return id;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    //! The game's `RoomHub.test.ts`, case by case.
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    struct Harness {
        hub: RoomHub,
        time: Arc<AtomicU64>,
        got: HashMap<ClientId, Vec<Value>>,
        next: ClientId,
    }

    impl Harness {
        fn new() -> Self {
            let time = Arc::new(AtomicU64::new(0));
            let clock = time.clone();
            // A different ID for each room (a constant would never find a free one).
            let mut n = 0u32;
            let hub = RoomHub::new(
                move || {
                    let r = (f64::from(n) * 0.137) % 1.0;
                    n += 1;
                    r
                },
                move || clock.load(Ordering::SeqCst),
            );
            Harness {
                hub,
                time,
                got: HashMap::new(),
                next: 1,
            }
        }

        fn tick(&self) {
            self.time.fetch_add(1000, Ordering::SeqCst);
        }

        fn connect(&mut self) -> ClientId {
            let c = self.next;
            self.next += 1;
            self.hub.connect(c, false);
            self.got.insert(c, Vec::new());
            c
        }

        fn deliver(&mut self, out: Outbox) {
            for (to, text) in out {
                let v: Value = serde_json::from_str(&text).expect("JSON");
                self.got.entry(to).or_default().push(v);
            }
        }

        fn receive(&mut self, c: ClientId, message: Value) {
            let mut out = Outbox::new();
            self.hub.receive(c, &message, &mut out);
            self.deliver(out);
        }

        fn disconnect(&mut self, c: ClientId) {
            let mut out = Outbox::new();
            self.hub.disconnect(c, &mut out);
            self.deliver(out);
        }

        fn last(&self, c: ClientId, t: &str) -> Option<Value> {
            self.got[&c].iter().rev().find(|m| m["t"] == t).cloned()
        }

        fn clear(&mut self, c: ClientId) {
            self.got.insert(c, Vec::new());
        }

        fn room_id(&self, c: ClientId) -> String {
            self.last(c, "joined").expect("joined")["room"]["id"]
                .as_str()
                .expect("id")
                .to_string()
        }

        fn you(&self, c: ClientId) -> Value {
            self.last(c, "joined").expect("joined")["you"].clone()
        }
    }

    fn character() -> Value {
        json!({ "id": "an", "name": "An", "appearance": { "hair": "short" } })
    }

    fn pose() -> Value {
        json!({ "scene": "simlab-hub", "x": 1, "y": 0, "z": 2, "yaw": 0.5, "speed": 1.2 })
    }

    fn create(room: &str, player: &str) -> Value {
        json!({ "t": "create", "room": room, "player": player, "character": character() })
    }

    fn join(id: &str, player: &str) -> Value {
        json!({ "t": "join", "roomId": id, "player": player, "character": character() })
    }

    #[test]
    fn creates_a_room_lists_it_and_another_joins_by_its_id() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        h.receive(a, create("  Lớp 12A1 ", "Phú"));
        let joined = h.last(a, "joined").expect("joined");
        assert_eq!(joined["room"]["name"], "Lớp 12A1");
        let id = h.room_id(a);
        assert!(id.len() == 6 && id.bytes().all(|b| ROOM_ID_CHARS.contains(&b)));
        assert_eq!(
            h.last(b, "rooms").expect("rooms")["rooms"],
            json!([{ "id": id, "name": "Lớp 12A1", "host": "Phú", "players": 1, "max": MAX_PLAYERS }])
        );
        h.receive(b, join(&id.to_lowercase(), "An"));
        assert_eq!(
            h.last(b, "joined").expect("joined")["peers"][0]["name"],
            "Phú"
        );
        assert_eq!(h.last(a, "peer").expect("peer")["peer"]["name"], "An");
        assert_eq!(h.last(a, "rooms").expect("rooms")["rooms"][0]["players"], 2);
    }

    #[test]
    fn takes_a_large_character_to_the_others() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        let prefix = "data:image/jpeg;base64,";
        let photo = format!("{prefix}{}", "A".repeat(10_000 - prefix.len()));
        let mut with_photo = character();
        with_photo["appearance"]["facePhoto"] = json!(photo);
        h.receive(
            a,
            json!({ "t": "create", "room": "Lab", "player": "Phú", "character": with_photo }),
        );
        let id = h.room_id(a);
        h.receive(b, join(&id, "An"));
        let seen = h.last(b, "joined").expect("joined")["peers"][0]["character"].clone();
        assert_eq!(seen["appearance"]["facePhoto"], json!(photo));
    }

    #[test]
    fn relays_poses_to_the_others_only_and_a_late_joiner_gets_the_last_ones() {
        let mut h = Harness::new();
        let (a, b, c) = (h.connect(), h.connect(), h.connect());
        h.receive(a, create("R", "A"));
        let id = h.room_id(a);
        h.receive(b, join(&id, "B"));
        h.receive(a, json!({ "t": "pose", "pose": pose() }));
        assert_eq!(
            h.last(b, "pose"),
            Some(json!({ "t": "pose", "id": h.you(a), "pose": pose() }))
        );
        assert_eq!(h.last(a, "pose"), None);
        h.receive(c, join(&id, "C"));
        assert_eq!(h.last(c, "pose").expect("pose")["pose"], pose());
    }

    #[test]
    fn one_player_works_a_station_and_it_is_freed_when_they_leave() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        h.receive(a, create("R", "A"));
        let id = h.room_id(a);
        h.receive(b, join(&id, "B"));
        let command = json!({ "stationId": "physics-lab/pendulum", "command": "run" });
        h.receive(a, json!({ "t": "command", "command": command }));
        let a_id = h.you(a);
        assert_eq!(
            h.last(b, "locks").expect("locks")["locks"],
            json!({ "physics-lab/pendulum": a_id })
        );
        assert_eq!(
            h.last(b, "command"),
            Some(json!({ "t": "command", "id": a_id, "command": command }))
        );
        h.clear(b);
        h.receive(b, json!({ "t": "command", "command": command }));
        assert_eq!(
            h.last(b, "refused"),
            Some(json!({ "t": "refused", "reason": "taken", "stationId": "physics-lab/pendulum" }))
        );
        assert_eq!(h.last(a, "command"), None);
        h.disconnect(a);
        assert_eq!(h.last(b, "gone").expect("gone")["id"], a_id);
        assert_eq!(h.last(b, "locks").expect("locks")["locks"], json!({}));
        // Whoever is left hosts it.
        assert_eq!(h.last(b, "rooms").expect("rooms")["rooms"][0]["host"], "B");
    }

    #[test]
    fn relays_events_and_one_player_drives_the_teacher_until_freed() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        h.receive(a, create("R", "A"));
        let id = h.room_id(a);
        h.receive(b, join(&id, "B"));
        let a_id = h.you(a);
        let hit = json!({ "k": "hit", "target": h.you(b), "speed": 3 });
        h.receive(a, json!({ "t": "event", "event": hit }));
        assert_eq!(
            h.last(b, "event"),
            Some(json!({ "t": "event", "id": a_id, "event": hit }))
        );
        let npc = json!({ "k": "npc", "npc": "teacher", "view": { "x": 1 }, "say": "Xin chào", "board": null });
        h.receive(a, json!({ "t": "event", "event": npc }));
        assert_eq!(
            h.last(b, "locks").expect("locks")["locks"],
            json!({ "npc:teacher": a_id })
        );
        assert_eq!(h.last(b, "event").expect("event")["event"], npc);
        h.clear(b);
        h.receive(b, json!({ "t": "event", "event": npc })); // he is A's now
        assert_eq!(
            h.last(b, "refused").expect("refused")["stationId"],
            "npc:teacher"
        );
        assert!(!h.got[&a].iter().any(|m| m["t"] == "event"));
        let free = json!({ "k": "npcFree", "npc": "teacher" });
        h.receive(b, json!({ "t": "event", "event": free })); // not B's to free
        assert_eq!(h.last(b, "event"), None);
        h.receive(a, json!({ "t": "event", "event": free }));
        assert_eq!(h.last(b, "locks").expect("locks")["locks"], json!({}));
        assert_eq!(h.last(b, "event").expect("event")["event"], free);
    }

    #[test]
    fn a_room_closes_with_its_last_player_and_full_or_unknown_rooms_are_refused() {
        let mut h = Harness::new();
        let a = h.connect();
        h.receive(a, create("R", "A"));
        let id = h.room_id(a);
        for i in 1..MAX_PLAYERS {
            let c = h.connect();
            h.receive(c, join(&id, &format!("P{i}")));
        }
        let late = h.connect();
        h.receive(late, join(&id, "Late"));
        assert_eq!(h.last(late, "refused").expect("refused")["reason"], "full");
        h.receive(late, join("ZZZZZZ", "Late"));
        assert_eq!(
            h.last(late, "refused").expect("refused")["reason"],
            "unknown-room"
        );
        h.receive(a, json!({ "t": "leave" }));
        assert!(h.last(a, "left").is_some());
        assert_eq!(h.hub.list()[0]["players"], MAX_PLAYERS - 1);
        let solo = h.connect();
        h.receive(solo, create("S", "S"));
        h.disconnect(solo);
        let names: Vec<Value> = h.hub.list().iter().map(|r| r["name"].clone()).collect();
        assert_eq!(names, vec![json!("R")]);
    }

    #[test]
    fn drops_bad_shapes_huge_messages_and_floods() {
        let mut h = Harness::new();
        let a = h.connect();
        for bad in [
            json!(null),
            json!("create"),
            create("", "A"),
            create("R", &"x".repeat(21)),
            create("R", "\u{7}"),
            json!({ "t": "create", "room": "R", "player": "A", "character": "x" }),
            json!({ "t": "nope" }),
            json!({
                "t": "create", "room": "R", "player": "A", "character": character(),
                "pad": "x".repeat(MESSAGE_MAX_CHARS)
            }),
        ] {
            h.receive(a, bad);
        }
        assert_eq!(h.hub.room_count(), 0);
        assert!(h.got[&a].iter().all(|m| m["t"] == "refused"));
        h.tick();
        for _ in 0..MESSAGES_PER_S {
            h.receive(a, json!({ "t": "list" }));
        }
        h.receive(a, create("R", "A"));
        assert_eq!(h.hub.room_count(), 0); // over the rate this second
        h.tick();
        h.receive(a, create("R", "A"));
        assert_eq!(h.hub.room_count(), 1);
    }

    #[test]
    fn a_pose_from_someone_in_no_room_is_refused() {
        let mut h = Harness::new();
        let a = h.connect();
        h.receive(a, json!({ "t": "pose", "pose": pose() }));
        assert_eq!(
            h.last(a, "refused").expect("refused")["reason"],
            "not-in-room"
        );
    }

    #[test]
    fn chat_reaches_everyone_in_the_room_and_its_sender_cleaned() {
        let mut h = Harness::new();
        let (a, b, c) = (h.connect(), h.connect(), h.connect());
        h.receive(a, create("Chat", "An"));
        let id = h.room_id(a);
        h.receive(b, join(&id, "Bình"));
        h.receive(b, json!({ "t": "chat", "text": "  xin chào " }));
        let line = json!({ "t": "chat", "id": h.you(b), "name": "Bình", "text": "xin chào" });
        assert_eq!(h.last(a, "chat"), Some(line.clone()));
        assert_eq!(h.last(b, "chat"), Some(line));
        assert_eq!(h.last(c, "chat"), None);
        let before = h.got[&a].len();
        h.receive(b, json!({ "t": "chat", "text": "   " })); // nothing to say
        h.receive(b, json!({ "t": "chat", "text": "x".repeat(201) })); // too long
        assert_eq!(h.got[&a].len(), before);
        h.receive(c, json!({ "t": "chat", "text": "hi" }));
        assert_eq!(
            h.last(c, "refused").expect("refused")["reason"],
            "not-in-room"
        );
    }

    #[test]
    fn voice_set_up_reaches_no_one_in_simlab() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        h.receive(a, create("Voice", "An"));
        let id = h.room_id(a);
        h.receive(b, join(&id, "Bình"));
        let offer = json!({ "k": "offer", "sdp": "v=0" });
        h.receive(a, json!({ "t": "signal", "to": h.you(b), "signal": offer }));
        assert_eq!(h.last(b, "signal"), None);
        assert_eq!(h.last(a, "refused"), None);
    }

    #[test]
    fn answers_a_probe_to_its_sender_only() {
        let mut h = Harness::new();
        let (a, b) = (h.connect(), h.connect());
        h.receive(a, json!({ "t": "ping", "n": 7 }));
        assert_eq!(h.last(a, "pong"), Some(json!({ "t": "pong", "n": 7 })));
        assert_eq!(h.last(b, "pong"), None);
    }

    #[test]
    fn knows_when_one_of_this_computers_pages_is_in_a_room() {
        let mut h = Harness::new();
        let lan = h.connect();
        let here = 99;
        h.hub.connect(here, true);
        h.got.insert(here, Vec::new());
        h.receive(lan, create("LAN", "B"));
        assert!(!h.hub.has_local_member());
        h.receive(here, create("Here", "A"));
        assert!(h.hub.has_local_member());
        h.receive(here, json!({ "t": "leave" }));
        assert!(!h.hub.has_local_member());
        let id = h.room_id(lan);
        h.receive(here, join(&id, "A"));
        assert!(h.hub.has_local_member());
        h.disconnect(here);
        assert!(!h.hub.has_local_member());
    }

    #[test]
    fn a_message_from_a_connection_it_does_not_know_is_ignored() {
        let mut h = Harness::new();
        let mut out = Outbox::new();
        h.hub.receive(42, &create("R", "A"), &mut out);
        assert!(out.is_empty());
        assert_eq!(h.hub.room_count(), 0);
    }
}
