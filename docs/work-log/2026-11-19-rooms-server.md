# 339-1 — Rust room server for LAN play in SimLab 3D (part 1 of #339)

- **Goal:** the SimLab 3D game's LAN room server, in Rust inside SimLab
  (`http://127.0.0.1:5189/simlab-rooms`), matching the game's `game/src/multiplayer/` contract.
  Part 1 of #339; the game embed and SimLab side are #340 (laptop).
- **Date/time:** 2026-11-19 17:04 +0700 (desktop, Builder)
- **Status:** PASS (Rust checks). The real two-player test (step 4) is not in this record.
- **Branch / base:** `feat/339-rooms-server` from `origin/main` 3557e10f

## Files

- `src-tauri/src/rooms/`:
  - `protocol.rs`: every client message checked like the game's zod schemas (unknown keys
    dropped, names cleaned, lengths in UTF-16 units, finite numbers, safe integers);
  - `hub.rs`: port of `RoomHub.ts`;
  - `http.rs`: axum server with `hello`, `events` (SSE), `send`, `lan`, `via`, CORS and the
    LAN open/close;
  - `discovery.rs`: UDP 5188 beacons, a port of `lanDiscovery.ts`;
  - `mod.rs`: the commands `rooms_start`, `rooms_stop` and `rooms_status`
    (`{running, lan_open, rooms}`).
- `src-tauri/src/lib.rs`: module, state, the three commands, stop on exit.
- `src-tauri/Cargo.toml` and `Cargo.lock`:
  - new crates: axum 0.8 (`tokio` and `http1` features only; brings in axum-core, matchit,
    httpdate) and futures-util 0.3 (already in the dependency tree);
  - new features on existing crates: tokio `net`, reqwest `stream`, windows
    `Win32_NetworkManagement_IpHelper`.
- `docs/THIRD_PARTY.md`: the axum line.

## Key decisions

The laptop approved these on 19/11/2026.

- **When the LAN opens.** It opens only while a connection from this computer's own loopback
  listener is in a room on this hub. It closes when none is. The server then refuses LAN
  requests (403), ends LAN streams (keep-alive connections included), stops the beacon and
  closes the LAN listeners.
- **Where it listens.** Instead of `0.0.0.0:5189`, it listens on each private IPv4 address of
  the computer (`GetAdaptersInfo`). Reasons: a wildcard bind clashes with the open
  `127.0.0.1:5189`, and only private networks should ever be reachable. On non-Windows
  systems it uses the address the system would route from (no packet is sent), with beacons
  to 255.255.255.255.
- **Voice is off.** `signal` messages are checked but never relayed (user decision
  19/11/2026: no voice in SimLab).
- **Rules beyond the game's server:**
  - only loopback and private or link-local senders (TCP and UDP);
  - an `Origin` not in `http://tauri.localhost`, `tauri://localhost` or
    `http://localhost:1420` gets 403;
  - `lan` and `via` work only for this computer's pages;
  - `via` reaches only a server heard now, at a private address.
- **Beacon name.** It is `"SimLab"`, never the computer's name.
- **Busy UDP port.** There is no SO_REUSEADDR (it would need socket2). If UDP 5188 is busy,
  LAN discovery is off and this is logged once; the room server keeps working.
- **Slow pages.** A page that stops reading (1024 messages queued) is disconnected rather than
  silently losing messages.

## Commands run (real results, summary lines only)

- `cargo fmt --check`: OK
- `cargo clippy --all-targets -- -D warnings`: no warnings
- `cargo test`: 288 passed, 0 failed (38 of them in `rooms`)
- `cargo test --lib rooms`, run 3 more times: 38 passed each time

## Tests

- `hub.rs`: every case of `RoomHub.test.ts`, plus:
  - voice set-up reaches no one;
  - `has_local_member`;
  - an unknown connection is ignored.
- `protocol.rs`: names and room IDs; UTF-16 lengths; the bad shapes the game drops; pose keys
  (null vs missing, unknown dropped); every `RoomEvent` kind; commands and signals; beacon room
  summaries.
- `discovery.rs`: every case of `lanDiscovery.test.ts` on loopback, plus:
  - it announces only when told to;
  - private-network filter.
- `http.rs`: every case of `roomHttp.test.ts` on loopback, plus:
  - CORS for the app's three origins, the preflight and the 403 for other origins;
  - the LAN opens and closes with a local room, using 127.0.0.2 as the LAN address;
  - `lan` and `via` are refused from the LAN;
  - a LAN-made room does not keep the LAN open;
  - a public address is never proxied;
  - stop ends every stream and frees the port.
- Every test uses loopback only: nothing was opened on this machine's network and the firewall
  was not touched.

## Errors and fixes

- `GetAdaptersAddresses` needs the `Win32_NetworkManagement_Ndis` feature, which was not
  approved. Switched to `GetAdaptersInfo` (IpHelper only); the WinSock feature was dropped.
- One test was wrong: a new connection hears the room list only when it changes or when it asks
  (same in the game). The LAN test now sends `list` first.

## Next steps and limits

- Step 4: try two players for real with #340 merged locally: see each other, chat, the filter,
  report, `lan_open`, port closed on exit. The laptop asked for this after the PR.
- Not run here: the Linux CI job (only `#[cfg(not(windows))]` code differs: std only), and a real
  second computer (the LAN path is tested with 127.0.0.2 standing in for a LAN address).

## 2026-11-19 (later): review fixes

The laptop's review of #341 and an automated security review asked for these. All of them are
now in #341.

- **Host header.** Each listener answers only under its own address: loopback accepts
  `127.0.0.1:<port>` or `localhost:<port>`, and a LAN listener accepts `<its IP>:<port>`.
  Any other Host gets 403, which stops DNS rebinding.
- **`nosniff`.** Every answer carries `X-Content-Type-Options: nosniff`.
- **Stream caps.** At most 64 event streams in all, and 16 per LAN address; past that the
  server answers 503.
- **`via` answers.** `via` passes back only what a room server sends: JSON for `hello`, an event
  stream for `events`, a bare status otherwise. Any other type of content gets 502, so another
  computer's web page never runs under 127.0.0.1:5189.
- **Beacons.** A beacon must name a port of 1024 or above. One sender counts for at most 2
  servers, and a full list drops the server heard longest ago, so a flood cannot keep new
  servers out.
- **Checks:**
  - `cargo fmt --check`: OK.
  - `cargo clippy --all-targets -- -D warnings`: no warnings.
  - `cargo test`: 293 passed (43 in `rooms`, run 4 times).
- **Second automated security review, fixed the same day:**
  - LAN streams may hold at most 48 of the 64 places, so this computer's pages always have
    room (checked at compile time).
  - `via` sends its own `Content-Type` (`application/json` or `text/event-stream`), never the
    other server's, and only when the other server's type is exactly that. It also sends
    `Content-Security-Policy: sandbox; default-src 'none'`.
  - A full LAN list drops only a server that missed two beacons. Servers still heard are never
    pushed out by newcomers.
- **Linux CI fix:** `broadcast_of` is used only by the Windows code outside tests. Clippy on
  Ubuntu failed on dead code; the function is now marked for that case.
