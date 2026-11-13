# Phase V report — the hub over a city

Contract: `docs/phase-v-hub-city-contract.md`. Steps V-1 … V-3.

## 1. V-1: the clock and the sky (2026-11-07 — not committed)

### Built

- `world/clock.ts`: the time of day — a day is 900 s of play (15 minutes), a new game starts at
  08:00; `ClockSystem` moves it on while the game is played (not paused, not in the menu). Pure
  functions for the hour, daylight (smooth through a 1.5 h dawn and dusk), the warm twilight share
  and the sun's direction (rising east, south at noon, setting west, 62° high at noon). No
  simulation reads it.
- Saved: `SAVE_VERSION` 9, `world.clockS`; a v8 save continues at 08:00 (its migration and tests).
- The debug panel shows `Clock: hh:mm`.
- The hub's clerestories show the sky by the time of day (`render/sky.ts`): the pale day sky they
  always had, warm at dawn and dusk, deep blue and dimmer at night — one shared material
  (`outside-sky`), repainted once a game minute. Their frames are now the items' own colour (the
  dark frame grey they had). The oculus stays as it was: it is the hall's key-light fixture, and the
  rooms stay evenly lit at every hour (labs-bright rule).

### Tests

- `npm run check`: **PASS** — 242 files, 3533 tests (`world/clock.test.ts`: the day and its start,
  day/night/dawn/dusk, the sun's path, moving only while played, a save continuing the same hour;
  `render/sky.test.ts`; the save versioning tests upgraded to v9).
- Stills on the GPU (High, RTX 5070 Laptop) at 08:00, 18:00 and 23:00: the clerestories pale,
  warm, deep blue; the hall's light the same.
- e2e (SwiftShader), `npx playwright test --workers=1`: **FAIL** — 120 passed, 1 failed, 4 did
  not run: `preparation.spec.ts` checked the save's version (8; it is 9 now), and the production
  project waits for the dev one. Fixed in the test; then `npx playwright test e2e/preparation.spec.ts
e2e/production.spec.ts e2e/renderer.production.spec.ts --workers=1`: **PASS**, 6.

### Not done, limitations

- Not seen on Phú's display.
- The night sky has no stars yet (V-3); the clock is shown in the debug panel only (D3).

## 2. V-2: the glass floor and the city by day (2026-11-07 — not committed)

### Built

- Rooms may have a `glassFloor` (its x and z ranges; checked inside the room when the content
  loads). The hub has one: x −9 … 9, z −8 … 2 (18 × 10 m), between the column rows.
- `render/glassFloor.ts`: under High and Ultra the floor slab is laid round the glass (its tiles'
  joints where the whole slab's are), the glass (laminated, faintly green, its room reflection
  faint: looked down through, it shows what is under it) in a steel grid of 1.2 m, flush with the
  floor. Physics walks on the whole slab as before; Low and Medium draw the floor as it was and
  fetch nothing of the city (e2e).
- `render/city`: the city 120 m below, from the CC0 Downtown City MegaKit (Quaternius): three
  prebuilt buildings, 4-lane streets, intersections and sidewalks on a 66.6 m grid
  (`city/layout.ts`, pure and deterministic: an intersection straight under the glass, four
  buildings a block facing the streets). Its own pass, drawn first when the glass is in view
  (before the world, or as the composer's first pass under Ultra): its own sun, sky light and haze
  by the time of day, so nothing of it lights the rooms. A draw per model part (instanced).
  - High: 3 rings of blocks (6 × 6), every building simple (walls, windows, roof: no cornices,
    glass or interiors), no shadows.
  - Ultra: 5 rings (10 × 10), the 2 × 2 blocks round the tower in full detail, sun shadows (4096²,
    drawn again once a game minute, cast by the walls only).
  - The kit's vertex colours are its source shader's wear masks: turned off (they tinted the
    sidewalks red). Its textures 1024 px JPEG (from 2048 px PNG): `public/hub-city` is 9.9 MB, its
    chunk 48.5 kB (14.9 kB gzip), fetched under High and Ultra only, with the hub.

### On the GPU

`BENCH_GRAPHICS=<q> npx playwright test -c playwright.bench.config.ts --project=gpu-fullscreen
e2e/labs.bench.ts -g hub`, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, 2561×1601, the hub
from its spawn (the glass in view):

| Preset | fps                 | draws | triangles | GPU ms |
| ------ | ------------------- | ----- | --------- | ------ |
| High   | 300 (the display's) | 221   | 1.99 M    | 1.8    |
| Ultra  | 129                 | 443   | 5.95 M    | 7.1    |

Ultra's hub ran 149 fps before the city (G-6). First tries: Ultra 104 fps at 12.8 M triangles (the
sun's shadows of every part, every frame), then a 423 ms first frame (7 programs linked: compiled
for the canvas, drawn into the composer's target). Now: one frame of ~150–220 ms when the city
arrives a few seconds after the hub is entered (the models parsed, their buffers uploaded), none
after.

### Tests

- `npm run check`: **PASS** — 244 files, 3539 tests (`city/layout.test.ts`: the same city every
  time, an intersection under the glass, four buildings a block, every building on a block;
  `glassFloor.test.ts`: the slab round the glass covers it exactly, the glass flush; content: the
  glass inside its room).
- `npx playwright test e2e/draw-calls.spec.ts e2e/resources.spec.ts e2e/settings.spec.ts
e2e/production.spec.ts e2e/world.spec.ts e2e/transitions.spec.ts --workers=1`: **PASS**, 25.
- `e2e/settings.spec.ts` "the hub over the city": nothing of it fetched under Medium, fetched
  when High is chosen: **PASS**.
- Stills on the GPU at High and Ultra (looking down through the glass at 08:00 and 18:00, and
  across the hall): the city under the glass, sun shadows at Ultra.

### Not done, limitations

- Not seen on Phú's display.
- The city's first frame (~150–220 ms) a few seconds after entering the hub; it could be loaded
  with the world's preparation instead.
- Night (lit windows, street lights), traffic and stars: V-3. No street lights, cars or trees in
  the kit: they will be modelled.
- A scene built again (re-entered, its preset changed) loads its city again (the browser keeps the
  files).

## 3. V-3: night, street lights and traffic (2026-11-07, Phú: "Go on to V-3" — not committed)

### Built

- Windows by night: the buildings' interior pictures (the kit's "fake interiors") glow warm from
  dusk to dawn, fading through the twilight; each building as much as a fixed share of its rooms
  lit (25–100 %, from where it stands), so the blocks differ.
- Street lights (`city/street.ts`, modelled: the kit has none): a pole, an arm over the road and a
  lit head, along both sidewalks — one to a block's side under High, three under Ultra — each with
  a soft pool of light on the road by night (additive, a generated glow).
- Ultra's traffic: plain cars (body and cabin, six paints), four to each lane, two lanes each way,
  driven on the right at 40 km/h along every street (passing through the crossings, no signals),
  white headlights and red tail lights brighter by night. Moved every frame without allocating.
- Dawn and dusk: the warm haze and low sun of V-2, the lights fading in and out with the daylight.

### On the GPU

Same command as §2, the hub from its spawn: High 300 fps (the display's), 223 draws, 2.00 M
triangles, GPU 3.2 ms; Ultra 129 fps, 447 draws, 6.05 M triangles, GPU 7.1 ms (as before V-3: the
lamps and cars add 4 draws and 0.1 M triangles). The same ~220 ms frame when the city arrives.

### Tests

- `npm run check`: **PASS** — 244 files, 3541 tests (`city/layout.test.ts`: lamps on the sidewalks
  only, four lanes a street inside the road, two each way).
- Stills on the GPU at High and Ultra, 18:30 and 22:00, looking down and across the hall.
- e2e: NOT RUN for V-3 alone (only the city, under High and Ultra, changed since §2's run).

### Not done, limitations

- Not seen on Phú's display.
- No stars: the clerestories are a plain lit pane, and looking down through the glass shows the
  ground, not the sky.
- The lit windows are fixed per building (the contract's slowly changing pattern is not done);
  cars do not stop at crossings; the street lights light only their pools (no real lights: the
  city has hundreds).

### Found by Phú and fixed (2026-11-07): no glass after walking into the hub

Phú walked from the Preparation Room into the hub at Ultra and saw no glass. A scene reached
through a door is placed in campus coordinates (`world/campus.ts` `translateRoom`), which moved a
room's bounds, openings, placements and lights but copied its `glassFloor` as it was: the hole was
cut and the city's view box set in the wrong place (my stills had started in the hub, offset 0).
Fixed: the glass floor moves with its room (a test in `campus.test.ts`). Found with it: the city
was drawn whenever its glass was in the camera's frustum, walls or not — from the corridor too (4
fps on SwiftShader at High). Now it is drawn only while the player stands in the glass floor's room.

- Walked in through the corridor door (Low), High chosen in the hub, looking down: the glass and
  the city where they belong (a temporary e2e, SwiftShader).
- `npm run check`: **PASS** — 3542 tests. `npx playwright test e2e/doors.spec.ts
e2e/settings.spec.ts e2e/transitions.spec.ts e2e/room-sleep.spec.ts --workers=1`: **PASS**, 17.

## 4. The city lighter, and loaded only in the hub; the F3 frame readout (2026-11-08 — not committed)

Phú (2026-11-08): the city under the lab must be optimised — his RTX 5070 runs at 100 % — and it
must not stay loaded once he walks on to the other rooms. Then: F3 shows 60 FPS; capped at 60 the
game sometimes runs faster.

### Measured first

`BENCH_GRAPHICS=ultra BENCH_UNCAPPED=1 npx playwright test -c playwright.bench.config.ts
e2e/labs.bench.ts --project=gpu -g hub` (production build, ANGLE NVIDIA GeForce RTX 5070 Laptop
GPU, Direct3D11, 1920×1080 render, vsync off), new scenario "hub: the city under the glass":

| Ultra                         |   fps | GPU ms/frame | triangles | draws |
| ----------------------------- | ----: | -----------: | --------: | ----: |
| city in view, before          | 200.6 |         4.74 |    6.12 M |   327 |
| city in view, after           | 229.1 |         4.23 |    3.76 M |   327 |
| glass behind (no city), after | 270.0 |         3.90 |    0.64 M |   232 |

High after (same command, `BENCH_GRAPHICS=high`): city in view 767 fps, GPU 1.28 ms, 1.09 M
triangles (V-2 measured 2.0 M); glass behind 1545 fps.

The city now costs about 0.3 ms of a 4.2 ms Ultra frame. With no frame-rate cap the browser draws
every frame the display offers (300 Hz on Phú's display), and without vsync as many as it can: the
GPU is then busy all the time in any room — 1545 fps with the city out of view. The frame-rate cap
(Settings: 30, 60, 90, 120) is what lowers the load.

### Built

- **The city follows the player** (`WorldRenderer.syncCity`): loaded when they stand in the
  glass-floored room, freed two seconds after they leave it (`CITY_LINGER`, a step back through
  the doorway keeps it). It no longer loads with the hub scene (a neighbour attached when a door
  opens brought it before, from the Preparation Room) and is no longer kept in memory after the
  hub is left (`spareCity` removed). Seen in the dev app (High): no `hub-city` request in the
  Preparation Room nor in the Physics Lab; the hub's city requested again on return (81 → 162
  requests): it had been freed.
- **Lighter buildings** (`CityView` `SIMPLE_DROPS`): outside Ultra's inner ring (and under High)
  a building leaves out its window trims — `MI_Trim` (17 k of the medium building's 26 k
  triangles; it was kept) besides the metal trim already left out.
- **Shadows redrawn when the sun has moved** 0.8° (about every 2 s of play) instead of twice a
  second: each redraw draws every building into the 4096² map.

### The F3 frame readout

- The developer panel (F3) is in development builds only: the desktop app (a production build)
  had no frame readout at all. A production build now has its own F3 overlay (`PerfOverlay`):
  frames run a second, mean and slowest frame time, the display frames the browser offers a
  second, the cap, the preset and the GPU drawing (`game.gpuName`). The developer panel shows the
  same lines (`FrameMeter`), its FPS line unchanged for the e2e suite. "Display" tells a game held
  at 60 by the browser (a battery saver, a background window: the built-in browser pane, hidden,
  offered 3 Hz) from one held by its cap.
- **The cap was not kept everywhere**: the character page's room and the customiser's picture
  drew in loops of their own, every display frame, whatever the cap. Both now keep to it (a
  `FrameClock` each, the game's cap).
- `FrameClock` counts offered and run frames and the longest interval; a first frame's timestamp
  before the clock began no longer gives a negative step.
- Seen in a production build (built to the scratchpad, served on port 5196): F3 shows the overlay
  at the right, above the key hints, with the RTX 5070 named.

### Tests

- `npm run check`: one run with Phú's own app and dev server running failed three timing-bound
  tests (`frameCap.test.ts` 6.8 s, `quality.test.ts` 6.4 s, `body.test.ts` 5.1 s, over the 5 s
  limit); the three files alone: **PASS**, 62 tests. The rest: 3612 PASS. New: `FrameMeter.test.ts`
  (frames run against offered, 300 Hz capped at 60; the slowest frame; the FPS line kept).
- The full e2e suite before the F3 work (the playwright file filter did not match on Windows and
  ran all 127): 122 PASS, 2 FAIL — `history.spec.ts` (the cast's order, now by seat) and
  `preparation.spec.ts` (the save is version 10). Both updated.
- After the F3 work, `npx playwright test history.spec preparation.spec settings.spec
character-page.spec game.spec --workers=1` (the filter again ran the whole suite, 124):
  122 PASS — `history` and `preparation` among them — 2 FAIL: `titration-physical.spec.ts` and
  `room-sleep.spec.ts` "four wakes and sleeps". Alone (`npx playwright test room-sleep
titration-physical --workers=1`): titration **PASS** (flaky in the long run); the room-sleep
  cycles test FAIL again (cycle 4: 986 buffers against 974). Repeated
  (`npx playwright test room-sleep -g "four wakes" --repeat-each=3 --workers=1`): 2 PASS, 1 FAIL.
  The buffers climb to 1005 asleep / 1154 awake and stay there: objects first drawn in a later
  cycle when the walk stops at another spot (the test's own note), not a leak. It is **flaky**,
  not PASS; the Physics Lab has no city, so the city work does not touch it. Not fixed: the test
  could walk an extra warm-up cycle before comparing.

### Not done, limitations

- The city's first draw still links its two shadow-depth programs in that frame (38 ms on the
  bench); its other programs are compiled before.
- No frame cap is set by default: that is Phú's choice (Settings).
- Not seen on Phú's display.

## 5. Shadow maps drawn only when what they show changes (2026-11-08 — not committed)

Phú: "less load on the machine, all four presets, without lowering quality — look at what known
games do". Engines cache the shadows of what stands still (Unity's on-demand shadow updates,
Unreal 5's cached virtual shadow pages). Here every lit key light (up to four, Medium and up)
drew its map every frame: the whole room again, four times a frame, while a lab mostly stands still.

### Built

- `render/shadowCache.ts`: lights no longer `autoUpdate`. Once a frame, from the scene's
  `onBeforeRender` (after three's matrix update, before its shadow pass; armed for the frame's own
  draw only, not a mirror's, a room reflection's or the AO's), every caster three would draw
  (visible, `castShadow`, on a shadow camera's layer) is compared with the last frame: world matrix,
  geometry and material, position/index versions, draw range, an instanced mesh's matrices and
  count, morph influences, a skinned mesh's bones (once per skeleton). A caster that changed,
  appeared or went away marks the lit lights whose shadow frustum held it, where it was and where it
  is; a light that moved or changed (position, target, angle, range, map size, layers, lit) marks
  itself. Changes under 0.1 mm (or 1e-4 of a rotation) are not drawn — Ultra's texel is 1.5 mm —
  and are kept against the value last drawn, so a slow drift still draws. A dark slot is drawn when
  it goes dark (the shaders sample it), never for its casters.
- The warm-up's draws write their batch into the maps: the cache draws every lit map again after.
- `RoomLightPool.assign` no longer turns `autoUpdate` on.
- Debug panel (dev, F3): `Shadow maps: N · last: <what made the last one draw>`.
- Found on the way: standing still, the player's body moved by float noise every frame (the
  tolerance); `drawRange.count` is Infinity (Infinity − Infinity is NaN: compared equal first);
  a room waking recomputed every caster's bounds (153 ms wake frame on SwiftShader against the
  test's 150; now each geometry's own bounds, recomputed only when its vertices change: 90–97 ms).

### On the GPU

`BENCH_GRAPHICS=<preset> BENCH_UNCAPPED=1 npx playwright test -c playwright.bench.config.ts
--project=gpu-fullscreen -g "physics lab frame times|biology lab"`: RTX 5070 Laptop (ANGLE
D3D11), 2561×1601 fullscreen, vsync off, no game cap. Before: the same build with the cache
patched to every lit map every frame (as before), reverted after.

| Preset, scenario                     | fps before → after | GPU ms before → after | draws before → after |
| ------------------------------------ | ------------------ | --------------------- | -------------------- |
| High, Physics Lab idle               | 224 → 350          | 4.26 → 2.59           | 1433 → 538           |
| High, ball in flight                 | 210 → 229          | 4.49 → 4.07           | 1432 → 1186          |
| High, after landing                  | 231 → 355          | 4.15 → 2.57           | 1436 → 541           |
| High, Biology Lab at the microscope  | 862 → 1045         | 1.14 → 0.94           | 170 → 35             |
| Ultra, Physics Lab idle              | 135 → 156          | 7.20 → 6.36           | 1971 → 1076          |
| Ultra, after landing                 | 137 → 160          | 7.14 → 6.22           | 1977 → 1082          |
| Ultra, Biology Lab at the microscope | 116 → 123          | 8.53 → 8.41           | 223 → 88             |

Interacting (the θ dial) is unchanged: the hand moves, its light draws. Ultra's Biology Lab gains
little: its frame is the post-processing (GTAO at full resolution, bloom), the next step.

### Tests

- `npm run check`: 3619 PASS, 1 FAIL — `frameCap.test.ts` over 5 s under load (Phú's app running);
  alone: **PASS** (3). New: `shadowCache.test.ts` (5: drawn once then only on change, in and out of
  the cone; hidden/removed/added/reshaped/material; bones; light moved, map size, dark and lit
  again; invalidate).
- `npx playwright test shadows draw-calls settings mirror room-sleep world physical-lab
--workers=1`: 29 PASS, 1 FAIL (the room-sleep wake frame, 153 ms against 150 — fixed above).
  Then `npx playwright test room-sleep -g "far from its doors" --repeat-each=3 --workers=1`:
  **PASS** ×3 (longest 97, 93, 90 ms). New `e2e/shadows.spec.ts` (Medium): standing still no map is
  drawn for 3 s; walking draws them — **PASS**.

### Not done, limitations

- Not seen on Phú's display. Shadows should look the same; a stale shadow (an object moved, its
  shadow not) would be a bug of this cache.
- A vertex shader that moves geometry by time alone would not be seen (none casts shadows here).
- An instanced mesh that changes marks every light (shortcut: none changes while a lab is used).
- The CPU check walks the scene once a frame; its cost is inside the bench's cpu column, not
  measured apart.

## 6. Ultra's AO at a lower resolution: tried, not kept (2026-11-08)

Phú: "go on with GTAO". Games draw GTAO at half resolution (Activision's, for Call of Duty).
Tried by sizing the AO pass (its normals pass, AO and denoise) at a share of the frame, the
blend reading it back filtered. Same bench as §5, Ultra, 2561×1601, RTX 5070 Laptop (ANGLE D3D11),
uncapped:

| Scenario                     | full: GPU ms | ¾: GPU ms | ½: GPU ms |
| ---------------------------- | ------------ | --------- | --------- |
| Chemistry, bench in view     | 7.24         | 4.72      | 3.31      |
| Chemistry, titration flowing | 7.55         | 5.03      | 3.74      |
| Biology, room from the door  | 6.81         | 4.69      | 3.51      |
| Biology, at the microscope   | 8.40         | 5.65      | 3.69      |

The stills (the bench's own screenshots, compared 1:1): the Chemistry Lab's bench, floor and
cabinet are the same to the eye (0.5 % of pixels differ by more than 12/255); the Biology Lab's
board wall is not — the bright seams between boards turn into broken dark dashes at ½ and are
softened at ¾. That is a loss of quality, against Phú's "without lowering quality": the AO is back
at full resolution (no change left in `post.ts`). Next, if Phú wants it: half resolution with a
depth-aware upsample (each full pixel takes the AO of the nearby half-resolution samples at its own
depth), as engines do, judged by the same wall.

## 7. Paused or in the main menu: drawn 20 times a second (2026-11-08 — not committed)

Phú: "skip the AO, the next step". Paused, every system runs with dt 0 and the picture stands
still, yet it was drawn at the display's rate (300 a second on Phú's display, uncapped); the main
menu's world canvas the same. Games lower the rate of a static screen (menus, pause).

- `WorldRenderer.update`: paused, or in the main menu, and no world being warmed (its warm-up
  draws batches every frame), a frame is drawn at most 20 times a second (`IDLE_HZ`); the first
  idle frame is drawn at once, and play draws every frame again. The game's systems still run at
  the frame rate (input, menus): only the 3D drawing waits. A settings change while paused shows
  within 50 ms.
- On a 300 Hz display that is 20 drawn frames a second instead of 300 while the pause menu is up;
  not measured on the GPU (arithmetic, not a bench).

### Tests

- `npm run check`: 3619 PASS, 1 FAIL — `frameCap.test.ts` 5.03 s over the 5 s limit under load;
  alone: **PASS** (3).
- `npx playwright test pause menu settings character-page --workers=1`: **PASS** 15, with the new
  pause test: paused, 27 of the 85 display frames the page was given in 2 s were drawn (SwiftShader;
  the test asks for more than 10 and at most 42).

### Not done

- Not seen by Phú. A slider dragged in the pause menu's settings moves the world behind at 20
  frames a second.

## 8. Mirrors and room reflections: already drawn only when seen (2026-11-08)

Checked in the code, nothing changed: a washroom mirror renders its reflection only from its own
`onBeforeRender` (so only when three draws it: in the view frustum), not when the eye is behind
it (three's `Reflector`), not beyond 6 m (`mirrors.ts` RANGE), not in a sleeping room, and only
the part of the view its glass covers (`cropped`, `screenRect`). Ultra's room reflections are
captured once per room, a cube face a frame, not every frame. Drawing a far mirror less often would
make its reflection jerk: not done (Phú: the same quality).

What is left of the proposals needs Phú's choice, as each lowers quality somewhere: a dynamic
resolution (sharpness drops when the GPU is late), a default frame cap, or Ultra's AO at half
resolution with a depth-aware upsample (§6). On Ultra the AO is now most of the frame (the ½ trial
took 7.2 ms down to 3.3 in the Chemistry Lab).

## 9. Low and Medium on a weaker machine: the preset fitted to it (Phú, 2026-11-10)

Phú: on a friend's computer the game lags and stutters; is there more to optimise under Low and
Medium?

**Measured first** (`BENCH_GRAPHICS=low|medium npx playwright test -c playwright.bench.config.ts
--project=gpu-headless e2e/labs.bench.ts e2e/physics-lab.bench.ts`, production build,
**ANGLE D3D11 on the RTX 5070 Laptop GPU**, 1280×720, vsync on; 8 scenarios each, all PASS):

- Low: every scenario at 60 fps; main thread 1.1–5.0 ms a frame (mean), GPU 0.6–3.9 ms. One
  long frame each in the hub on arrival (229 ms, 49 ms of it script; not in the Medium run) and
  on opening the microscope's workspace (110 ms, no script).
- Medium: also 60 fps here, but whatever moves redraws the shadow maps (`shadowCache.ts`): in the
  Physics Lab 943 draw calls while turning the angle dial (Low: 48) and 1253 with the ball in
  flight (Low: 556); main thread 5.7 and 8.5 ms (Low: 2.9 and 4.7). On a laptop CPU two to four
  times slower, and its graphics built into the processor at up to 2× the pixels (Medium draws at
  the screen's pixel ratio; Low at 1), that is the lag.
- The cause on such a machine: **every graphics card got Medium by default**; only a software
  renderer got Low.

**Done** (`render/qualityWatch.ts`, used by `WorldRenderer`; none of it when the player has ever
picked a preset — their choice wins, as before):

- Graphics built into the processor (Intel HD/UHD/Iris, AMD Radeon(TM) Graphics / Vega, Mali,
  Adreno, PowerVR; not Intel Arc nor Radeon 680M/780M) get **Low by default**, as a software
  renderer does.
- **Frames too slow, one preset lower**: while playing (not paused, not on the menu, not while a
  scene is being prepared), after 3 s to settle, when the median frame interval over 5 s is under
  40 fps, the game takes the next lower preset and the HUD says: "Graphics set to Low so the game
  runs smoothly on this computer (Settings to change it)." (Vietnamese too). A median, so a door's
  hitch alone never counts; not when the player capped the frame rate under 40 themselves. Not
  remembered: the next visit starts from the default again (and steps down again if needed).
- Then (Phú: "Hạ luôn Medium") Medium itself made lighter, below.

| Check                                      | Command                                                                                                          | Result                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck, lint, format, unit              | `npm run check`                                                                                                  | PASS — 293 files, 3876 tests (new: `qualityWatch.test.ts`, the GPU names, one step at a time, a median not hitches; `Game.test.ts`: `lowered`)                     |
| Settings, canvas, production (SwiftShader) | `npx playwright test e2e/settings.spec.ts e2e/canvas.spec.ts e2e/production.spec.ts --workers=1 --reporter=line` | PASS — 11 tests                                                                                                                                                    |
| A slow machine, real GPU (headless)        | a temporary `e2e/_autoquality.bench.ts` with every frame made 30 ms slower, `--project=gpu-headless` (deleted)   | PASS — production build, no preset picked: "Graphics quality low by default: under 40 fps for 5 s" logged and the notice shown (`auto-quality.png`), 26.7 s in all |

**Not tested on a real weak machine**: the friend's computer (its GPU name is shown in the F3
overlay: worth reading there).

### 9.1 Medium lighter (Phú, 2026-11-10: "Hạ luôn Medium")

- **At most 1.5 pixels per CSS pixel** (`quality.ts` `maxPixelRatio`, was the screen's, up to the
  config's 2): on a 2× screen 56 % of the pixels; on a 1–1.5× screen nothing changes.
- **Shadow maps at most 30 times a second while what they show moves** (`quality.ts`
  `shadowRateHz`, `ShadowCache.minInterval`): a map asked for sooner than 1/30 s after its last
  draw is kept back and drawn as soon as that time is up, with what it then shows — never left
  out, so a caster that stops between two draws still has its shadow where it stopped. A warm-up's
  invalidation draws at once whatever the interval. Standing still nothing is drawn, as before.
  High and Ultra draw every frame as before. Found while testing: a map asked for but not drawn
  by three (its light outside the render) was counted and kept back again every frame —
  `shadows.spec.ts` caught it; only a map asked for in the frame, or one kept back, is paced now.

GPU bench, same conditions before and after (**ANGLE D3D11 on the RTX 5070 Laptop GPU**, headless,
1280×720, the display's refresh — about 300 fps; `BENCH_GRAPHICS=medium npx playwright test -c
playwright.bench.config.ts --project=gpu-headless e2e/physics-lab.bench.ts e2e/labs.bench.ts`,
"before" with `shadowRateHz` set back to every frame for the run, then restored; 8 PASS each):

| Scenario (Medium)             | Draw calls before → after | Main thread mean (ms) | fps       |
| ----------------------------- | ------------------------- | --------------------- | --------- |
| Physics Lab, turning the dial | 943 → 141                 | 3.2 → 1.7             | 290 → 299 |
| Ball in flight                | 1220 → 654                | 5.2 → 3.9             | 185 → 248 |
| Pendulum swinging             | 481 → 225                 | 3.0 → 2.2             | 283 → 300 |
| Titration tap flowing         | 377 → 282                 | 3.1 → 2.9             | 270 → 282 |
| Standing still (lane, hub)    | unchanged (555, 133)      | unchanged             | unchanged |

At 300 fps the cap leaves one frame in ten drawing the moving shadows; at 60 fps one in two, so
the saving there is about half the extra draws. The 1.5× cap is not in these numbers (the bench's
window is 1×).

| Check                                      | Command                                                                                                                       | Result                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit              | `npm run check`                                                                                                               | PASS — 293 files, 3877 tests (new: the 30 Hz cap, a stop between draws, an invalidation at once); one earlier run FAIL on `world/residency.test.ts` timing out at 5 s under load, PASS twice alone and in the next full run |
| Shadows, draw calls, mirrors (SwiftShader) | `npx playwright test e2e/shadows.spec.ts e2e/draw-calls.spec.ts e2e/mirror.spec.ts --project=dev --workers=1 --reporter=line` | PASS — 17 tests (after the counting fix; before it `shadows.spec.ts` FAILED, standing still never settled)                                                                                                                  |

**Not seen yet on Phú's 300 Hz display**: a moving shadow under Medium at 30 Hz.
