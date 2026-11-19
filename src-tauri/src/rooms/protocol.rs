//! The messages of the LAN rooms (#339), exactly as the SimLab 3D game defines them
//! (`game/src/multiplayer/protocol.ts`, zod). Every message from a page is checked here before the
//! hub reads it: unknown keys are dropped (zod's default), names are cleaned (control characters
//! out, trimmed) and lengths count UTF-16 units like JavaScript's `length`. A message that fails
//! anywhere is dropped whole. What the hub relays is the checked copy, never the page's own text.

use serde_json::{json, Map, Value};

/// Under this path on the room server (`roomHttp.ts` ROOM_PATH).
pub const ROOM_PATH: &str = "/simlab-rooms";
/// The header a page names its connection by in its POSTs (given in the stream's `hello`).
pub const ROOM_CLIENT_HEADER: &str = "x-room-client";

/// Players in one room, at most.
pub const MAX_PLAYERS: usize = 8;
/// Rooms open on one server, at most.
pub const MAX_ROOMS: usize = 32;
pub const PLAYER_NAME_MAX: usize = 20;
pub const ROOM_NAME_MAX: usize = 32;
/// A chat line, at most (characters).
pub const CHAT_MAX: usize = 200;
/// Messages one POST may carry (sent together while the one before is on its way).
pub const BATCH_MAX: usize = 64;
/// A message longer than this (JSON characters) is dropped unread.
pub const MESSAGE_MAX_CHARS: usize = 16_000;
/// Messages a connection may send per second; past it, the rest of that second's are dropped.
pub const MESSAGES_PER_S: u32 = 80;
/// A room ID: 6 letters and digits, none that read alike (no I, O, 0, 1).
pub const ROOM_ID_CHARS: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
pub const ROOM_ID_LEN: usize = 6;

/// Station commands followed on the others' copies (`COMMANDS`).
const COMMANDS: [&str; 7] = ["run", "stop", "reset", "adjust", "set", "setup", "clear"];
/// Entity states kept alike in every game of the room (`SHARED_STATE_KEYS`).
const SHARED_STATE_KEYS: [&str; 9] = [
    "open",
    "running",
    "active",
    "lightsOff",
    "circuit",
    "burning",
    "burningAt",
    "charred",
    "broken",
];
const EMERGENCY_PHASES: [&str; 9] = [
    "idle", "inbound", "breach", "rappel", "mission", "regroup", "ascend", "outbound", "repair",
];
const RESPONDER_MOVES: [&str; 9] = [
    "none", "rappel", "land", "walk", "look", "spray", "talk", "hit", "climb",
];
const RESPONDER_MODES: [&str; 7] = ["idle", "read", "drink", "wait", "talk", "listen", "write"];
/// zod 4's `.int()` accepts safe integers only.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// A message from a page, checked. Relayed parts stay JSON (already checked and cleaned).
#[derive(Debug, Clone, PartialEq)]
pub enum ClientMessage {
    List,
    Ping(Value),
    Create {
        room: String,
        player: String,
        character: Value,
    },
    Join {
        room_id: String,
        player: String,
        character: Value,
    },
    Leave,
    /// A pose, or null (not in a world).
    Pose(Value),
    Claim(String),
    Release(String),
    Command {
        station_id: String,
        command: Value,
    },
    Look(Value),
    Event(Value),
    Chat(String),
    /// Voice set-up: checked, never relayed (voice is off in SimLab, user decision 19/11/2026).
    Signal,
}

/// The length JavaScript gives a string (UTF-16 units): every limit of the game counts these.
pub fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// JavaScript's `trim()`: Rust's whitespace plus U+FEFF.
fn js_trim(s: &str) -> &str {
    s.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
}

/// Parses one message from a page (`ClientMessageSchema`); None when anything fails.
pub fn parse_client(v: &Value) -> Option<ClientMessage> {
    let o = v.as_object()?;
    let field = |k: &str| o.get(k);
    Some(match o.get("t")?.as_str()? {
        "list" => ClientMessage::List,
        "ping" => ClientMessage::Ping(int_in(field("n")?, 0.0, 1e9)?),
        "create" => ClientMessage::Create {
            room: name(field("room")?, ROOM_NAME_MAX)?,
            player: name(field("player")?, PLAYER_NAME_MAX)?,
            character: character(field("character")?)?,
        },
        "join" => ClientMessage::Join {
            room_id: room_id(field("roomId")?)?,
            player: name(field("player")?, PLAYER_NAME_MAX)?,
            character: character(field("character")?)?,
        },
        "leave" => ClientMessage::Leave,
        "pose" => ClientMessage::Pose(nullable(pose)(field("pose")?)?),
        "claim" => ClientMessage::Claim(id_str(field("stationId")?)?),
        "release" => ClientMessage::Release(id_str(field("stationId")?)?),
        "command" => {
            let command = command(field("command")?)?;
            let station_id = command["stationId"].as_str()?.to_string();
            ClientMessage::Command {
                station_id,
                command,
            }
        }
        "look" => ClientMessage::Look(character(field("character")?)?),
        "event" => ClientMessage::Event(event(field("event")?)?),
        "chat" => ClientMessage::Chat(name(field("text")?, CHAT_MAX)?),
        "signal" => {
            text_max(field("to")?, 32)?;
            signal(field("signal")?)?;
            ClientMessage::Signal
        }
        _ => return None,
    })
}

// --- What the server sends (`ServerMessageSchema`) ---

/// A room as listed (`RoomSummarySchema`).
pub fn summary(id: &str, name: &str, host: &str, players: usize) -> Value {
    json!({ "id": id, "name": name, "host": host, "players": players, "max": MAX_PLAYERS })
}

/// A player as the others see them (`PeerSchema`).
pub fn peer(id: &str, name: &str, character: &Value) -> Value {
    json!({ "id": id, "name": name, "character": character })
}

// --- Checks, one per schema of the game ---

/// An object built from the checked keys only (unknown keys dropped, like zod).
struct Out<'a> {
    src: &'a Map<String, Value>,
    out: Map<String, Value>,
}

impl<'a> Out<'a> {
    fn of(v: &'a Value) -> Option<Self> {
        Some(Out {
            src: v.as_object()?,
            out: Map::new(),
        })
    }

    /// A key that must be there and pass `check`.
    fn req(mut self, key: &str, check: impl Fn(&Value) -> Option<Value>) -> Option<Self> {
        let v = check(self.src.get(key)?)?;
        self.out.insert(key.to_string(), v);
        Some(self)
    }

    /// A key that may be missing; when there, it must pass `check`.
    fn opt(mut self, key: &str, check: impl Fn(&Value) -> Option<Value>) -> Option<Self> {
        if let Some(v) = self.src.get(key) {
            let v = check(v)?;
            self.out.insert(key.to_string(), v);
        }
        Some(self)
    }

    fn done(self) -> Value {
        Value::Object(self.out)
    }
}

/// `z.string().max(max)`.
fn text_max(v: &Value, max: usize) -> Option<Value> {
    let s = v.as_str()?;
    (js_len(s) <= max).then(|| v.clone())
}

/// `id`: a string of 1 to 128 characters.
fn id(v: &Value) -> Option<Value> {
    let s = v.as_str()?;
    (1..=128).contains(&js_len(s)).then(|| v.clone())
}

fn id_str(v: &Value) -> Option<String> {
    id(v).and_then(|v| v.as_str().map(str::to_string))
}

/// `z.number()`: finite (JSON cannot carry NaN; a huge exponent fails to parse already).
fn finite(v: &Value) -> Option<Value> {
    v.as_f64().filter(|x| x.is_finite()).map(|_| v.clone())
}

fn num_in(v: &Value, lo: f64, hi: f64) -> Option<Value> {
    let x = v.as_f64()?;
    (x.is_finite() && x >= lo && x <= hi).then(|| v.clone())
}

/// `z.number().int().min(lo).max(hi)`, written back as an integer.
fn int_in(v: &Value, lo: f64, hi: f64) -> Option<Value> {
    let x = v.as_f64()?;
    let ok = x.is_finite() && x.fract() == 0.0 && x.abs() <= MAX_SAFE_INTEGER && x >= lo;
    (ok && x <= hi).then(|| Value::from(x as i64))
}

fn one_of(v: &Value, values: &[&str]) -> Option<Value> {
    values.contains(&v.as_str()?).then(|| v.clone())
}

fn nullable(check: impl Fn(&Value) -> Option<Value>) -> impl Fn(&Value) -> Option<Value> {
    move |v| {
        if v.is_null() {
            Some(Value::Null)
        } else {
            check(v)
        }
    }
}

/// `z.array(item).max(max)`.
fn array_max(v: &Value, max: usize, item: impl Fn(&Value) -> Option<Value>) -> Option<Value> {
    let a = v.as_array()?;
    if a.len() > max {
        return None;
    }
    a.iter()
        .map(item)
        .collect::<Option<Vec<_>>>()
        .map(Value::Array)
}

/// A check on one value: the cleaned copy, or None.
type Check<'a> = &'a dyn Fn(&Value) -> Option<Value>;

/// `z.tuple([...])`: exactly these items.
fn tuple(v: &Value, items: &[Check]) -> Option<Value> {
    let a = v.as_array()?;
    if a.len() != items.len() {
        return None;
    }
    a.iter()
        .zip(items)
        .map(|(v, check)| check(v))
        .collect::<Option<Vec<_>>>()
        .map(Value::Array)
}

/// `z.record(id, value)`: every key an id, every value passing `value`.
fn record(v: &Value, value: impl Fn(&Value) -> Option<Value>) -> Option<Value> {
    let o = v.as_object()?;
    let mut out = Map::new();
    for (k, v) in o {
        if !(1..=128).contains(&js_len(k)) {
            return None;
        }
        out.insert(k.clone(), value(v)?);
    }
    Some(Value::Object(out))
}

/// Names and chat lines: control characters out, trimmed, 1 to `max` characters.
fn name(v: &Value, max: usize) -> Option<String> {
    let clean: String = v.as_str()?.chars().filter(|c| !c.is_control()).collect();
    let s = js_trim(&clean);
    (1..=max).contains(&js_len(s)).then(|| s.to_string())
}

/// A room ID as typed: trimmed, upper case, then 6 of ROOM_ID_CHARS.
fn room_id(v: &Value) -> Option<String> {
    let s = js_trim(v.as_str()?).to_uppercase();
    let ok = s.len() == ROOM_ID_LEN && s.bytes().all(|b| ROOM_ID_CHARS.contains(&b));
    ok.then_some(s)
}

/// A player's character: any object, relayed as it is (each page checks it in full).
fn character(v: &Value) -> Option<Value> {
    v.is_object().then(|| v.clone())
}

fn coord(v: &Value) -> Option<Value> {
    num_in(v, -1000.0, 1000.0)
}

fn vec3(v: &Value) -> Option<Value> {
    tuple(v, &[&coord, &coord, &coord])
}

/// `PoseSchema`.
fn pose(v: &Value) -> Option<Value> {
    Some(
        Out::of(v)?
            .req("scene", id)?
            .req("x", coord)?
            .req("y", coord)?
            .req("z", coord)?
            .req("yaw", finite)?
            .req("speed", |v| num_in(v, 0.0, 20.0))?
            .opt("pitch", |v| num_in(v, -2.0, 2.0))?
            .opt("gear", |v| array_max(v, 8, id))?
            .opt("held", nullable(id))?
            .opt("rest", nullable(|v| one_of(v, &["sit", "lie", "asleep"])))?
            .opt("restAt", |v| {
                tuple(v, &[&finite, &finite, &finite, &finite])
            })?
            .opt("act", nullable(id))?
            .opt(
                "doing",
                nullable(|v| one_of(v, &["paper", "talk", "work", "call", "dial", "hands"])),
            )?
            .done(),
    )
}

/// `CommandSchema`.
fn command(v: &Value) -> Option<Value> {
    Some(
        Out::of(v)?
            .req("stationId", id)?
            .req("command", |v| one_of(v, &COMMANDS))?
            .opt("parameter", id)?
            .opt("direction", |v| {
                let d = v.as_f64()?;
                (d == 1.0 || d == -1.0).then(|| Value::from(d as i64))
            })?
            .opt("value", finite)?
            .opt("step", id)?
            .opt("params", |v| record(v, finite))?
            .done(),
    )
}

/// A value an entity state may take: a boolean, a number or a short text.
fn state_value(v: &Value) -> Option<Value> {
    match v {
        Value::Bool(_) => Some(v.clone()),
        Value::Number(_) => finite(v),
        Value::String(_) => text_max(v, 8000),
        _ => None,
    }
}

/// What a person of the world shows: booleans, numbers, short texts, nulls.
fn view(v: &Value) -> Option<Value> {
    record(v, |v| match v {
        Value::Null | Value::Bool(_) => Some(v.clone()),
        Value::Number(_) => finite(v),
        Value::String(_) => text_max(v, 200),
        _ => None,
    })
}

fn board(v: &Value) -> Option<Value> {
    Some(
        Out::of(v)?
            .req("boardId", nullable(id))?
            .req("lines", |v| array_max(v, 40, |l| text_max(l, 400)))?
            .req("shown", |v| array_max(v, 40, |n| int_in(n, 0.0, 400.0)))?
            .req("title", |v| int_in(v, -1.0, 40.0))?
            .req("answer", |v| int_in(v, -1.0, 40.0))?
            .done(),
    )
}

/// One responder of an emergency, as a 12-item tuple.
fn responder(v: &Value) -> Option<Value> {
    let moves = |v: &Value| one_of(v, &RESPONDER_MOVES);
    let modes = |v: &Value| one_of(v, &RESPONDER_MODES);
    let flag = |v: &Value| v.is_boolean().then(|| v.clone());
    tuple(
        v,
        &[
            &id, &finite, &finite, &finite, &finite, &finite, &moves, &flag, &finite, &finite,
            &finite, &modes,
        ],
    )
}

fn emergency_line(v: &Value) -> Option<Value> {
    Some(
        Out::of(v)?
            .req("who", |v| text_max(v, 80))?
            .req("text", |v| text_max(v, 400))?
            .req("n", |v| int_in(v, 0.0, 1e9))?
            .req("sceneId", id)?
            .req("x", finite)?
            .req("z", finite)?
            .done(),
    )
}

/// `RoomEventSchema`, by its `k`.
fn event(v: &Value) -> Option<Value> {
    let k = v.as_object()?.get("k")?.as_str()?;
    let out = Out::of(v)?.req("k", |v| Some(v.clone()))?;
    let out = match k {
        "hit" => out
            .req("target", id)?
            .req("speed", |v| num_in(v, 0.0, 100.0))?,
        "throw" => out
            .req("item", id)?
            .req("scene", id)?
            .req("from", vec3)?
            .req("v", vec3)?,
        "state" => out
            .req("entityId", id)?
            .req("key", |v| one_of(v, &SHARED_STATE_KEYS))?
            .req("value", state_value)?,
        "npc" => out
            .req("npc", id)?
            .req("view", view)?
            .req("say", nullable(|v| text_max(v, 600)))?
            .req("board", nullable(board))?,
        "npcFree" => out.req("npc", id)?,
        "emergency" => out
            .req("squad", id)?
            .req("phase", |v| one_of(v, &EMERGENCY_PHASES))?
            .req("t", |v| num_in(v, 0.0, 1e4))?
            .req("breach", |v| num_in(v, 0.0, 1.0))?
            .req("blast", |v| num_in(v, -1.0, 1e4))?
            .req("ropes", |v| num_in(v, 0.0, 1.0))?
            .req("shake", |v| num_in(v, 0.0, 1.0))?
            .req("heli", |v| {
                tuple(
                    v,
                    &[
                        &finite, &finite, &finite, &finite, &finite, &finite, &finite,
                    ],
                )
            })?
            .req("people", |v| array_max(v, 8, responder))?
            .req("line", nullable(emergency_line))?,
        "npcDay" => out.req("npc", id)?.req("view", view)?,
        _ => return None,
    };
    Some(out.done())
}

/// `SignalSchema` (voice set-up): checked so a bad one is dropped like any other message.
fn signal(v: &Value) -> Option<Value> {
    let k = v.as_object()?.get("k")?.as_str()?;
    let out = Out::of(v)?.req("k", |v| Some(v.clone()))?;
    let out = match k {
        "offer" | "answer" => out.req("sdp", |v| text_max(v, 12_000))?,
        "ice" => out
            .req("candidate", |v| text_max(v, 2000))?
            .req("mid", nullable(|v| text_max(v, 64)))?
            .req("index", nullable(|v| int_in(v, 0.0, 64.0)))?,
        _ => return None,
    };
    Some(out.done())
}

/// `RoomSummarySchema` (a room another server lists in its beacon).
pub fn room_summary(v: &Value) -> Option<Value> {
    let string = |v: &Value| v.is_string().then(|| v.clone());
    Some(
        Out::of(v)?
            .req("id", |v| {
                let s = v.as_str()?;
                let ok = s.len() == ROOM_ID_LEN && s.bytes().all(|b| ROOM_ID_CHARS.contains(&b));
                ok.then(|| v.clone())
            })?
            .req("name", string)?
            .req("host", string)?
            .req("players", |v| int_in(v, 0.0, MAX_SAFE_INTEGER))?
            .req("max", |v| int_in(v, 1.0, MAX_SAFE_INTEGER))?
            .done(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn character() -> Value {
        json!({ "id": "an", "appearance": { "hair": "short" } })
    }

    fn pose_sample() -> Value {
        json!({ "scene": "simlab-hub", "x": 1, "y": 0, "z": 2, "yaw": 0.5, "speed": 1.2 })
    }

    #[test]
    fn names_are_cleaned_and_room_ids_read_in_any_case() {
        let m = parse_client(&json!({
            "t": "create", "room": "  Lớp 12A1 ", "player": "\u{7}Phú\u{feff}", "character": character()
        }));
        assert_eq!(
            m,
            Some(ClientMessage::Create {
                room: "Lớp 12A1".into(),
                player: "Phú".into(),
                character: character()
            })
        );
        let join = parse_client(&json!({
            "t": "join", "roomId": " abcdef ", "player": "An", "character": character()
        }));
        assert!(matches!(join, Some(ClientMessage::Join { room_id, .. }) if room_id == "ABCDEF"));
        // I, O, 0 and 1 read alike: never in an ID.
        for bad in ["ABCDE1", "ABCDEO", "ABCDE", "ABCDEFG"] {
            let m = json!({ "t": "join", "roomId": bad, "player": "An", "character": character() });
            assert_eq!(parse_client(&m), None, "{bad}");
        }
    }

    #[test]
    fn lengths_count_like_javascript() {
        // 20 characters is the most a player name may have; "𝒜" is two UTF-16 units.
        let ok = json!({ "t": "create", "room": "R", "player": "x".repeat(20), "character": {} });
        assert!(parse_client(&ok).is_some());
        let long = json!({ "t": "create", "room": "R", "player": "x".repeat(21), "character": {} });
        assert_eq!(parse_client(&long), None);
        let wide = json!({ "t": "create", "room": "R", "player": "𝒜".repeat(11), "character": {} });
        assert_eq!(parse_client(&wide), None);
        assert_eq!(js_len("𝒜"), 2);
    }

    #[test]
    fn drops_what_the_game_drops() {
        for bad in [
            json!(null),
            json!("create"),
            json!({ "t": "create", "room": "", "player": "A", "character": {} }),
            json!({ "t": "create", "room": "R", "player": "\u{7}", "character": {} }),
            json!({ "t": "create", "room": "R", "player": "A", "character": "x" }),
            json!({ "t": "pose", "pose": { "scene": "s", "x": 1, "y": 0, "z": 2, "yaw": 0, "speed": 21 } }),
            json!({ "t": "pose" }),
            json!({ "t": "nope" }),
            json!({ "t": "chat", "text": "   " }),
            json!({ "t": "chat", "text": "x".repeat(201) }),
            json!({ "t": "ping", "n": 1.5 }),
            json!({ "t": "ping", "n": -1 }),
            json!({ "t": "claim", "stationId": "" }),
            json!({ "t": "command", "command": { "stationId": "s", "command": "view" } }),
            json!({ "t": "command", "command": { "stationId": "s", "command": "run", "direction": 2 } }),
            json!({ "t": "event", "event": { "k": "hit", "target": "p1", "speed": 101 } }),
            json!({ "t": "event", "event": { "k": "unknown" } }),
            json!({ "t": "signal", "to": "x".repeat(33), "signal": { "k": "offer", "sdp": "v=0" } }),
        ] {
            assert_eq!(parse_client(&bad), None, "{bad}");
        }
    }

    #[test]
    fn a_pose_keeps_its_keys_drops_unknown_ones_and_tells_null_from_missing() {
        let mut sent = pose_sample();
        sent["held"] = Value::Null;
        sent["gear"] = json!(["coat", "goggles"]);
        sent["restAt"] = json!([1, 2, 3, 0.5]);
        sent["secret"] = json!("dropped");
        let Some(ClientMessage::Pose(p)) = parse_client(&json!({ "t": "pose", "pose": sent }))
        else {
            panic!("pose refused");
        };
        assert_eq!(p["held"], Value::Null);
        assert!(p.get("act").is_none());
        assert!(p.get("secret").is_none());
        assert_eq!(p["gear"], json!(["coat", "goggles"]));
        assert_eq!(
            parse_client(&json!({ "t": "pose", "pose": null })),
            Some(ClientMessage::Pose(Value::Null))
        );
        let mut short = pose_sample();
        short["restAt"] = json!([1, 2, 3]);
        assert_eq!(parse_client(&json!({ "t": "pose", "pose": short })), None);
    }

    #[test]
    fn every_event_of_the_game_passes_when_well_formed() {
        let board =
            json!({ "boardId": null, "lines": ["F = ma"], "shown": [1], "title": 0, "answer": -1 });
        let person = json!(["p", 1, 2, 3, 0, 1, "walk", true, 0, 0, 0, "talk"]);
        for event in [
            json!({ "k": "hit", "target": "p2", "speed": 3 }),
            json!({ "k": "throw", "item": "ball", "scene": "s", "from": [0, 1, 2], "v": [1, 0, 0] }),
            json!({ "k": "state", "entityId": "door-1", "key": "open", "value": true }),
            json!({ "k": "npc", "npc": "teacher", "view": { "x": 1, "talking": false, "line": null }, "say": "Xin chào", "board": board }),
            json!({ "k": "npc", "npc": "teacher", "view": {}, "say": null, "board": null }),
            json!({ "k": "npcFree", "npc": "teacher" }),
            json!({ "k": "npcDay", "npc": "guard", "view": { "x": 2 } }),
            json!({
                "k": "emergency", "squad": "fire", "phase": "inbound", "t": 1, "breach": 0, "blast": -1,
                "ropes": 0, "shake": 0, "heli": [0, 0, 0, 0, 0, 0, 0], "people": [person],
                "line": { "who": "Đội trưởng", "text": "Đi!", "n": 1, "sceneId": "s", "x": 0, "z": 0 }
            }),
        ] {
            let m = parse_client(&json!({ "t": "event", "event": event }));
            assert_eq!(m, Some(ClientMessage::Event(event.clone())), "{event}");
        }
        // A key the event does not have is dropped; a missing required one fails it.
        let extra = json!({ "t": "event", "event": { "k": "npcFree", "npc": "t", "x": 1 } });
        assert_eq!(
            parse_client(&extra),
            Some(ClientMessage::Event(json!({ "k": "npcFree", "npc": "t" })))
        );
        let no_say =
            json!({ "t": "event", "event": { "k": "npc", "npc": "t", "view": {}, "board": null } });
        assert_eq!(parse_client(&no_say), None);
    }

    #[test]
    fn commands_and_signals() {
        let command = json!({ "stationId": "physics-lab/pendulum", "command": "adjust", "parameter": "L", "direction": -1, "params": { "L": 1.2 } });
        assert_eq!(
            parse_client(&json!({ "t": "command", "command": command })),
            Some(ClientMessage::Command {
                station_id: "physics-lab/pendulum".into(),
                command: command.clone()
            })
        );
        for s in [
            json!({ "k": "offer", "sdp": "v=0" }),
            json!({ "k": "ice", "candidate": "c", "mid": null, "index": 0 }),
        ] {
            let m = json!({ "t": "signal", "to": "p2", "signal": s });
            assert_eq!(parse_client(&m), Some(ClientMessage::Signal));
        }
    }

    #[test]
    fn a_summary_from_a_beacon() {
        let room =
            json!({ "id": "ABCDEF", "name": "Lớp 11A", "host": "An", "players": 1, "max": 8 });
        assert_eq!(room_summary(&room), Some(room.clone()));
        let mut bad = room.clone();
        bad["id"] = json!("bad");
        assert_eq!(room_summary(&bad), None);
        let mut empty = room;
        empty["max"] = json!(0);
        assert_eq!(room_summary(&empty), None);
    }
}
