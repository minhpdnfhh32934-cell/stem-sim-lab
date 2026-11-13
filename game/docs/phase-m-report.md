# Phase M — LAN rooms (multiplayer)

Phú asked (2026-11-09): a "Multiplayer" item on the home screen; create a room with a name and get
an ID others type in; a list of the open rooms with how many players are in each; make
`npm run dev:lan` work so computers on one network play together; find what multiplayer could
break in the labs and control it. Plan agreed ("Chốt, làm đi"), then built without stopping.

## What was built

- **The room server** (`src/multiplayer/roomsPlugin.ts`, `RoomHub.ts`): a Vite plugin, serve only,
  on the dev server's own WebSocket (custom event `simlab:rooms`): no new dependency, no other
  port. `npm run dev:lan` (`vite --host`) serves the game to the network and prints
  `SimLab rooms: ready — other players open http://<LAN IP>:5173/`. `RoomHub` is pure (unit
  tested): rooms, members, host, who works which station. A room lives while someone is in it;
  when the host leaves, the next player is host; an empty room closes. A dropped connection
  (page closed or reloaded) leaves the room.
- **The protocol** (`src/multiplayer/protocol.ts`): every message both ways is checked with Zod;
  the server drops a message over 16 000 characters, past 40 a second (80 since Phase F-3) from one browser, or not
  matching. Names are trimmed, control characters removed, at most 20 (player) and 32 (room)
  letters, and are shown as text only. Room IDs: 6 letters and digits without look-alikes (no I, O,
  0, 1), typed in any case. At most 8 players a room, 32 rooms a server.
- **The Multiplayer page** (`platform/ui/MultiplayerPage.ts`), from the main menu's new button,
  in place of the panel like the catalog (Esc or Back returns): the player's name (kept in this
  browser; empty: their character's name), Create a room (its name → its ID shown), Join with a
  room ID, the list of open rooms (name, ID, host, players n/8, Join; "You are here" for one's own,
  full rooms disabled), Refresh, Leave room. Refusals have their reason (no such ID, full, too many
  rooms). Under the menu's buttons: `Room “…” · ID … · n/8`. Without the room server (a built game,
  the desktop app) everything is disabled and the page says to start `npm run dev:lan`.
  English and Vietnamese.
- **The others in the world** (`multiplayer/Peers.ts`, `platform/render/remotePlayers.ts`):
  each browser sends its pose 15 times a second (scene, feet in that scene's frame, facing, walk
  speed; not sent again unless changed, or once a second). The others are drawn in their own
  character (the same body as the NPCs) walking at their speed, eased (~0.1 s behind), placed at
  once when they change scene or jump over 3 m, with their name over their head (drawn over
  walls, so a friend is found), only while their scene is resident here. Their look follows their
  character (`look` message). Notices: "{name} joined the room." / "{name} left the room." The
  debug panel's `Players:` line gives the room, count and each one's scene and place.
- **One player works a station** (`StationSystem` dep `lockedBy`, `Peers.holder`): the first to
  give a station a command holds it; to the others its controls and commands are refused with
  "{name} is working this apparatus." (the results page and opening its workspace stay theirs).
  It is free again when that player leaves the lab, leaves the room, closes the game, or leaves
  it idle 60 s (no run, no workspace open). Two at once: the server decides, the second is refused.
- **The others' copies follow** (`LanRooms`): the holder's station commands (run, stop, reset,
  adjust, set, setup, clear) reach the others' copies as `ExperimentCommand` with `from` and the
  holder's settings after the command (`params`), applied first — a dial stepped from a different
  value would drift. So a watcher's copy shows the same settings and the same deterministic run
  (the model is the same, its inputs are the same). A command the watcher's copy cannot follow
  is only logged, never a notice.

## What multiplayer could break, and how it is controlled

| Risk                                                                           | Control                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A forged or broken message from a browser                                      | Zod on every message both ways; size and rate limits; names as text only                                                                                   |
| Two players changing one apparatus at once                                     | One holder a station (server decides), the others refused with whose it is                                                                                 |
| Copies drifting apart                                                          | The holder's settings sent with each command and applied first                                                                                             |
| `load` on another copy would put the watcher's own held object in the launcher | `load`/`unload` are never shared (objects and hands are each player's own); a launcher's run on a copy without a ball is not followed (logged)             |
| A run's results, history, progress                                             | Each game keeps its own (run history, saves, tasks are local); a watched run that the copy follows is recorded in the watcher's history as the model's run |
| A player who disappears                                                        | The dev server reports the closed socket: they leave the room, their stations are free, the others are told                                                |
| The room server gone (dev server stopped)                                      | The page says the connection was lost and to reload; the game goes on alone                                                                                |
| Saves                                                                          | Rooms and players are never saved (`Peers` is runtime only); the save format is unchanged                                                                  |
| The teacher, papers, tests                                                     | Each player's own (local NPC); another player does not see them follow you                                                                                 |

## Known limitations

- **A Vite server hosts the rooms** (see M-2): `npm run dev:lan`, or `npm run preview:lan` after
  a build; a page served by another server has no rooms (the page says so). Windows asks once to
  let Node through its firewall: allow it on private networks, or the others cannot connect.
- **Doors are not shared**: each game opens its own doors; another player is drawn walking through
  a door that is shut in your game (ghosting).
- **Objects are each player's own**: what one picks up, pours or carries is not seen by the others;
  physical-lab steps by hand (pouring, filling) are not shared, only the station's controls.
- No voice or text chat.
- A run started before a watcher arrived is not replayed for them.
- Not tested on two real computers here: the e2e runs two browsers on one machine against the dev
  server (the same WebSocket a second computer uses).

## Test results

| Check                                       | Command                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit               | `npm run check`                                                                                                                                                                                                                      | PASS — 292 files, 3870 tests                                                                                                                                                                                                                                                                                  |
| Room server and peers                       | `npx vitest run src/multiplayer`                                                                                                                                                                                                     | PASS — 9 tests (in the check): create, list, join, poses, host passed on, full, unknown ID, closing, untrusted input and floods; the others eased and placed; a station another player works refused with whose; their commands followed with their settings; a character not accepted drawn as the first one |
| The dev server with `--host`                | `npx vite --port 5197 --strictPort --host` (15 s)                                                                                                                                                                                    | PASS — `SimLab rooms: ready — other players open http://192.168.1.33:5197/` (and the Tailscale address); no config warning                                                                                                                                                                                    |
| In the real app, two browsers (SwiftShader) | `npx playwright test e2e/multiplayer.spec.ts e2e/menu.spec.ts e2e/teacher.spec.ts e2e/explain.spec.ts e2e/resources.spec.ts e2e/vietnamese.spec.ts e2e/controls.spec.ts e2e/pause.spec.ts --project=dev --workers=1 --reporter=line` | 12 passed, 3 failed: the multiplayer spec (its own regex lost a backslash), `pause.spec` (`.menu-catalog` matched the new page too: the page now has its own class, same frame), `teacher.spec` (the board now 4 lines: Y-3b). All three fixed                                                                |
| The same, after the fixes                   | `npx playwright test e2e/multiplayer.spec.ts e2e/pause.spec.ts e2e/teacher.spec.ts e2e/topics.spec.ts --project=dev --workers=1 --reporter=line`                                                                                     | 11 passed, 1 failed: `pause.spec.ts:237` (10 frames drawn in 2 s, needs more than 10); alone right after, `npx playwright test e2e/pause.spec.ts:237 --project=dev --workers=1` PASS — timing on SwiftShader, flaky (it passed in the first run)                                                              |
| For the screenshots                         | `npx playwright test e2e/multiplayer.spec.ts e2e/teacher.spec.ts --project=dev --workers=1 --reporter=line`                                                                                                                          | multiplayer PASS; `teacher.spec.ts:80` FAIL at the lecture (a line not written out within 5 s, before the board); alone, `npx playwright test e2e/teacher.spec.ts:80 --project=dev --workers=1` PASS — flaky (passed in 3 of 4 runs today)                                                                    |

`e2e/multiplayer.spec.ts` plays it as two players would: An creates "Lớp 11A" and gets its ID; Bình
sees it in the list (`ID … · host An · 1/8`), types a wrong ID (refused: "No open room has that
ID."), then the ID in small letters and is in (2/8 on both pages, each named on the other's);
both go back (the menu shows the room) and start a new game; each one's debug panel shows the other
in the preparation room; Bình walks 1.2 s and An sees them move; Bình closes the game: An reads
"Bình left the room." and the room counts 1/8; no console error. Screenshots looked at
(SwiftShader): `test-results/multiplayer-2-joined.png` (the page in a room), `multiplayer-3-seen.png`
(Bình in their character beside An, the name over their head).

**Not seen yet**: two real computers on Phú's network, the page and the name tags on his 300 Hz
display.

## Next step

Phú tries `npm run dev:lan` with a second computer (allowing Node through the firewall on a private
network), and looks at the page and the other player in the labs. Then, if wanted: doors shared
(no ghosting), a short text chat, showing a run already going to someone who joins.

## M-2 — rooms without the dev server, ready for a packaged app (Phú, 2026-11-10)

Phú: make the LAN rooms work beyond the dev server, so that packaging the game later is easy.

- **The transport is plain HTTP now** (`multiplayer/roomHttp.ts`, `roomRoutes`), on the server
  that serves the game, at `/simlab-rooms`: `GET hello` (JSON: "this server has rooms"),
  `GET events` (Server-Sent Events: a `hello` naming the connection, then every message for it;
  the stream closing is leaving), `POST send` (one message, the connection named by the
  `x-room-client` header; over 16 000 characters dropped unread). No dependency: Node's `http`
  and the browser's `fetch` and `EventSource`. Was: Vite's HMR WebSocket, so only the dev server.
- **Mounted on both Vite servers** (`roomsPlugin.ts`): the dev server and **the preview of a build**:
  `npm run preview:lan` (new script, `vite preview --host`) hosts a built game with rooms; the
  desktop app (`scripts/desktop-app.ps1`, `vite preview`) has rooms on its own computer.
- **The browser** (`platform/net/LanRooms.ts`): asks `hello` first (a plain file server answers its
  HTML: no stream, no console error, "needs the room server"); POSTs go one after another, so the
  server reads them in order; a dropped stream is not reopened (a new one would be a new player):
  the page says the connection was lost.
- **For packaging later**: a packaged app's own Node server (Electron's main process, say) mounts
  `roomRoutes` beside the static files, as the Vite plugin does. Not done yet: finding a host on the
  network without typing its address, and joining another computer's server from a packaged app
  (it would need the server's address and CORS headers).

| Check                                     | Command                                                                                                             | Result                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The room server on a real HTTP server     | `npx vitest run src/multiplayer`                                                                                    | PASS — 12 tests (new `roomHttp.test.ts`: `hello`, two players create, list, join, a pose relayed, one page closed is gone; a stranger, broken or over-long body dropped) |
| Two browsers on the dev server; the build | `npx playwright test e2e/multiplayer.spec.ts e2e/production.spec.ts e2e/canvas.spec.ts --workers=1 --reporter=line` | PASS — 5 tests (the multiplayer flow unchanged; the production build served by `vite preview`, now with rooms, boots without an error)                                   |
