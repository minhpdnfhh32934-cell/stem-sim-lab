# Game core

The infrastructure every system relies on. All of it is headless and covered by
`src/core/core.test.ts` and `src/game/Game.test.ts`.

## Bootstrap — `src/game/Game.ts`

`Game.boot(options)` is the only entry point. Options:

| Option            | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `storage`         | Where saves go (`SaveStorage`: localStorage in the browser, memory in tests)     |
| `config`          | Partial config overrides (validated)                                             |
| `logSink`         | Where log lines go (console by default)                                          |
| `content`         | Raw content (defaults to the bundled JSON: the core at boot, the lab pack later) |
| `models`          | Simulation models (default: the lab pack's `BUILT_IN_MODELS`)                    |
| `labPack`         | Loads the lab pack (default: its own chunk, `game/labPack.ts`; tests stand-ins)  |
| `platformSystems` | Factory for browser systems; they run after the game systems                     |

Stages: `configuration → core-services → content → game-state → systems → initial-scene`. A
failure throws `BootError` with `stage` and the cause; already-created systems are disposed. The
browser shows a readable error screen (`main.ts`). Headless tests boot the real game:
`bootTestGame()` in `src/game/testing.ts`.

Game-level commands for the UI: `newGame(characterId)`, `continueGame()`, `hasSavedGame()`,
`save()`, `update(dt)`, `dispose()`, and for text: `texts`, `language`, `setLanguage(language)`
(see Languages). `addWorldPreparation(step)` registers a step awaited, alongside physics, before
each world scene is built (the 3D renderer, loaded on demand; Phase C2). `addAttachSettle(step)`
(UX3) registers a step awaited after a neighbour scene is attached and before the door that asked
for it opens: the renderer's shader warm-up (`WorldRenderer.precompile`), so a door's first frames
never stall; a rejection is logged and the scene stays.

`loadLab()` (INF-1) loads the **lab pack** — the experiment definitions, topics and simulation
models, a chunk the menu never downloads — validates and cross-checks it against the core content
(`addLabContent`), adds it to the registries the systems already hold, then reads the run history.
Every world scene awaits it with physics; the main menu's catalog starts it when it opens, and
`savedCompletedExperiments()` (async) waits for it. Calls share one load; after a failure (nothing
added, "Experiments could not be loaded: …") the next call tries again.

## Game state — `src/game/GameState.ts`

```
GameState
├── session      phase (booting | loading | menu | playing), sceneId      — runtime only
├── player       characterId, position (m), yaw, pitch (rad), eyeHeight, roomId
├── world        entityStates: { [entityId]: { key: boolean | number | string } }
└── progression  completedExperiments
```

Systems get the root object and read their section on access. Sections are mutated in place,
never replaced, so references stay valid. To add a section (time, NPCs, health…): add it to the
interface and `createGameState()`, decide whether it is saved, and if so extend the save schema
with a version bump ([persistence.md](persistence.md)).

## Systems — `src/core/SystemRunner.ts`

```ts
interface GameSystem {
  readonly id: string;
  init?(): void | Promise<void>; // once, in order; a throw aborts boot
  update?(dt: number): void; // every frame, in order
  dispose?(): void; // once, reverse order; must release subscriptions
}
```

A system that throws in `update` is disabled and logged once; the rest keep running. Statuses are
shown in the debug panel.

**Dependency management**: there is no service locator and no singleton. `Game`'s constructor is
the composition root; each system receives exactly the dependencies it uses through a typed
`…Deps` object. This keeps dependencies visible in one place and makes systems trivially
constructible in tests.

## Events — `src/core/EventBus.ts`, catalogue in `src/game/GameEvents.ts`

```ts
const off = events.subscribe('ItemInspected', ({ itemId }) => …); // returns Unsubscribe
events.publish('ItemInspected', { entityId, itemId });
off(); // idempotent
```

Guarantees (each has a test):

- synchronous delivery in subscription order;
- a listener unsubscribed during a dispatch is not called afterwards (no dangling listeners);
- listeners added during a dispatch start with the next publish;
- a throwing listener is logged and isolated;
- `publish` does not allocate (copy-on-write listener arrays).

Lifecycle rule: every subscription a system makes goes into its `Disposables` and is released in
`dispose()`. `Game.test.ts` checks that no system leaves listeners behind, and the debug panel
shows the live listener count (constant at 21 across scene changes in the E2E run).

Current events: `SceneLoading/Loaded/Unloaded/ChangeRequested`, `EntitySpawned/Despawned/
StateChanged`, `PlayerEnteredRoom`, `InteractionFocusChanged/Performed`, `ItemInspected`,
`ExperimentStarted/Completed/Failed`, `WorkspaceRequested/Opened/Closed`, `GameSaved/Loaded`.

## Configuration — `src/core/config.ts`

One Zod schema with defaults for every tunable value, grouped as `game`, `player`, `graphics`,
`input` (sensitivity, invert Y, key bindings by `KeyboardEvent.code`) and `debug`. Overrides are
partial; invalid values fail boot with their path (`config.graphics.fov: …`). Audio settings will
be added with the audio system. The main menu's Settings holds the interface language (below);
other user settings (sensitivity, audio) are later work.

## Languages — `src/core/i18n.ts`

English (`en`, the default and the fallback) and Vietnamese (`vi`). One `Texts` object
(`game.texts`) gives every text in the current language; systems and views get it as a
dependency and read it when they show something, so a change of language reaches them at once.
Text is looked up by key or by field, never by `if (language === …)`:

- **Interface text** is written in English where it is shown, under a structured key:
  `texts.ui('station.resetFirst', 'Press RESET before the next run.')`, with `{name}`
  placeholders filled from `params` (each language orders them its own way). Its translations
  are in `src/content/strings.json` (`vi`: key → text). A key without a translation shows its
  English. Code run without a game (unit tests, tools) gets `ENGLISH`, so English output never
  depends on the catalog.
- **Content text** carries its translations beside its English, e.g. a preset
  `{ "label": "Moon", "vi": { "label": "Mặt Trăng" } }`, read with `texts.of(preset, 'label')`.
  Each schema names the fields it translates (`localized(...)`, strict: an unknown field or an
  empty text stops the boot). A placement translates its text parameters (a door's or a
  control's `label`) in its own `vi`.

Checked by tests: `src/game/strings.test.ts` reads every `texts.ui(...)` call in the source (key
and English written as literals) and requires a Vietnamese text with the same placeholders for
each, one English per key and no unused translation; `content.test.ts` requires Vietnamese for
every content text field with words in it, kept through validation.

Not translated: formulas, units, symbols and measured values (numbers keep "." as the decimal
separator), ids, logs, the debug panel, CSV exports, a model's own failure details and the boot
error screen. The simulation layer's refusal reasons stay English: no player sees them (the
station's guard refuses first, in the player's language).

The choice is a preference of the browser, not of a playthrough: `localStorage` key
`simlab.settings.language`, outside the save (`src/persistence/settings.ts`). A stored value that
is not a language (edited, or from a later version) gives English and a warning; if the browser
cannot read or store it, English or the choice lasts until the tab closes. The main menu's
Settings sets it, names each language in itself (English, Tiếng Việt) and sets `<html lang>` for
screen readers. `LanguageChanged` makes the menu, HUD, results panel and station screens render
again; signs are drawn when their scene loads (the language is only chosen in the main menu).

**Frame-rate cap** (Phase P3.3, Settings in the main and pause menus): 30, 60, 90 or 120 FPS, or no
limit (the default, the pace the browser and display give). It paces frames only. The one frame loop
(`main.ts`, `requestAnimationFrame`) asks `FrameClock` (`src/core/FrameClock.ts`) whether to run
each display frame; a skipped frame is neither updated nor drawn, and a frame that runs gets the
real time since the last one (capped at 0.1 s, as before). So physics takes its fixed steps for the
real time that passed and experiment runs end at the same simulated time with the same results
under every cap (`src/game/frameCap.test.ts`); input between frames is kept for the next one. The
cap keeps to its own beat rather than drifting up with display rounding, and after a stall starts
again from now — no burst. It applies from the next frame. "No limit" removes only the game's own
cap: the browser still paces frames to the display. The developer panel's FPS counts the frames
that run and names the cap and the graphics quality.

**Graphics quality** (Phase P3.5, Settings in the main and pause menus): Low, Medium (the default)
or High, stored under `simlab.settings.graphicsQuality` like the other settings (an unknown value
gives medium). What each preset turns on is said in one place, `platform/render/quality.ts`, and
applied by `WorldRenderer` alone, at once when the setting changes (`GraphicsQualityChanged`) and on
every scene load. It concerns enhanced scenes (every world scene since UX1). Since phase UX2:

- Medium and High light each room by its own fixtures: a key spot with shadows and fills
  ([data-model.md](data-model.md)).
- Low is the cheap path for integrated GPUs: the one-light model (hemisphere, sun and fill: three
  lights in the shaders against eleven under room lights), no shadow map at all (no light casts,
  and the player's shadow caster is not drawn), no image-based light, and at most one device pixel
  per CSS pixel (`maxPixelRatio` in `quality.ts`; Medium and High keep the config's cap, 2) — on a
  1.5–2× laptop screen a half to a quarter of the pixels. The labs stay lit through that fallback:
  the sun, the fill and a stronger hemisphere (1.25 against 0.55 under room lights).
  `src/platform/render/quality.test.ts` proves it in every world scene, on the scene `init()`
  assembles (`WorldRenderer.assemble`), with a stand-in for the room light so that its absence at
  Low and Medium is checked, not assumed. Under every preset (today's materials do not depend on
  it) whatever the scene holds, hidden parts too (rooms, decor, props, signs, apparatus, bench
  frames and rigs, the hands, a launcher's lane), uses only standard, basic and unlit shader
  materials: no physical or transmission material, no environment map on a material.
- Antialiasing (MSAA, `graphics.antialias`) is chosen when the WebGL context is made and is the
  same under every preset (a context cannot change it later). Low could start without it (the
  saved preset is known when the context is made; a switch would apply after a reload), but only
  once an integrated-GPU measurement shows the saving is worth the jagged edges at one pixel per
  CSS pixel.
- On a software renderer (SwiftShader, llvmpipe…) the game suggests Low while the player has never
  picked a preset. The suggestion is not stored, and the player's choice wins
  (`Game.preferGraphicsQuality`). There, room lights ran at half the frame rate of the one light.

Before UX2: Low dropped the sun's shadows,
Medium was the P3.4 look, High adds image-based light from a generated room (three's
`RoomEnvironment`, prefiltered once by PMREM, kept for the session) at intensity 0.08 (0.25
until the High clarity fix: it veiled distant contrast) while the hemisphere light gives way, so
steel and brass reflect a soft room. The room is turned so that its brightest panel shines from
above, as the lab's lamps do, instead of lighting every surface that faces +z from the front (the
pendulum bay's back wall and sign), and the hemisphere gives way by 4.9 times the room light's
intensity, measured so that High keeps Medium's brightness. Under every preset the
enhanced ceiling has a soft glow of its own (`CEILING_GLOW` in `WorldRenderer`, P3.11): no light
reaches a downward face there but the hemisphere's ground, so it rendered darker than the walls;
it now reads level with them and below the lamps (`e2e/settings.spec.ts` checks it on screen
pixels at Low, Medium and High). Basic scenes look the same under every preset, except Low's pixel
ratio. The simulation does not depend on it (the renderer is a platform system the simulation never
reads; `src/platform/render/quality.test.ts` runs a Hooke's law run, the renderer following, under
each preset and with the preset switched every half second: the same samples and results;
`e2e/settings.spec.ts` runs free fall under High at 30 FPS against the theory). Measurements and the
decision: `docs/phase-p3.5-report.md` (and `docs/phase-p3.11-report.md` for the ceiling,
`docs/phase-high-clarity-report.md` for the room light's turn and balance).

### Planned: the Ultra preset and quality-tiered assets (design, not implemented)

**Ultra** is for the reference machine (RTX 5070); High stays the richest look a mid-range GPU
runs. It is High plus, each item one field of `QualityConfig` and nothing else in the game:

- Key shadows at 2048², softened by `light.shadow.radius` on the `PCFShadowMap` already in use
  (three r186 removed `PCFSoftShadowMap`: it falls back to PCF with a warning). A size change at
  run time needs `shadow.map.dispose(); shadow.map = null`, or three keeps the old map.
- Contact shadows from a screen-space ambient occlusion pass (three's GTAO), the only
  post-processing, in its own chunk downloaded when Ultra is picked, never by another preset. Its
  composer draws into a render target, so: the target sets `samples` (the canvas's MSAA no longer
  applies), tone mapping moves to the final pass, the shader warm-up (`warmStep`, which draws the
  canvas's own programs) warms through the composer or the door stalls come back, and transparent
  objects (glass, liquids) are left out of the AO pass, which would draw them as solid.
- Room-true reflections: each lab's environment captured once from the room itself (a cube camera
  at the room's centre, prefiltered by PMREM when the scene is prepared, freed with it) instead of
  the generic `RoomEnvironment`, with the camera's layer (the hands) hidden while capturing. The
  hemisphere's balance (`HEMISPHERE_GIVES_WAY`, 4.9) was measured for `RoomEnvironment` only: it is
  measured again for the captured rooms.
- Glassware as physical glass (`MeshPhysicalMaterial` with transmission and thickness) through a
  bench quality hook: `BenchModel.frame(item, painted, detail)` and `rig(item, detail)`, where
  `detail` is `QUALITY[preset].bench` (`{ segments: number, glass: 'blend' | 'transmission' }`), and
  the renderer rebuilds bench views when the preset changes. `segments` multiplies each round part's
  own count (Low 0.5 with a floor, Medium and High 1, Ultra 2) — one fixed count would lower
  today's 32- and 96-segment parts (`pondweed-lamp.ts`, `titration-stand.ts`, `incline-ramp.ts`,
  `ray-optics-board.ts`) — and measuring scales keep theirs at every preset; a test per model
  checks that Medium and High geometry is today's. Transmission glass writes no depth
  (`depthWrite: false`): three draws transmissive objects before transparent ones and refracts only
  opaque ones, so depth-writing glass would hide the (transparent) liquids behind it, and with them
  the liquid level, meniscus and end-point colour. A test per bench model checks its reading
  meshes stay drawn at `'transmission'`. Every other preset keeps `LOOKS.glass` (blended), so the
  `quality.test.ts` rule (no physical material) still holds at Low, Medium and High.
- Texture filtering at the GPU's maximum anisotropy and the high texture tier below.

Constraints: the simulation, colliders, apparatus extents and every drawn reading (liquid level,
meniscus, needle, display) are the same as under every other preset — `quality.test.ts` loops over
`GRAPHICS_QUALITIES`, so adding `'ultra'` runs the same Hooke's law comparison under it. Never
suggested automatically; Medium stays the default. Accepted only with a bench run on the RTX 5070
naming its renderer (`npm run bench`), each lab at the display's resolution. The change adds
`'ultra'` to `GRAPHICS_QUALITIES` (a browser setting, not in the save: no `SAVE_VERSION` change), a
fourth radio and its strings (`menu.graphicsUltra`, help text, Vietnamese beside them), and must
change `e2e/settings.spec.ts`, which stores `"ultra"` today as its example of an invalid value.

**Quality-tiered assets.** Today every model is procedural (`Assembly`, the bench models) and every
texture is drawn at run time (floor tiles, signs, screens): nothing is downloaded per preset. When
authored assets arrive (textures, glTF models), each is data with one variant per tier, e.g.
`{ "id": "beaker-glass", "tiers": { "low": …512², "medium": …1024², "high": …2048², "ultra": …4096² } }`
(KTX2/Basis textures, meshopt-compressed glTF with fewer triangles on lower tiers), validated with
Zod like other content. A platform `AssetCache` resolves an asset for the current preset and
downloads it as part of the scene's world preparation (as Rapier and the renderer are), only for
the scenes being prepared; Low resolves Low variants only (or the procedural model, with no
download at all), so it never fetches a high-resolution file — a unit test resolves every asset of
every scene at Low and checks no other tier's URL is requested. A preset change loads the new
tier in idle time, swaps it in when ready (the old one drawn until then) and frees the old.
Colliders, aim boxes and apparatus extents come from item definitions, never from an asset, so
they are the same at every tier. So do the shapes a reading is drawn from (a vessel's inner
profile, its graduation marks): were they taken from each tier's model, a procedural Low and a
glTF High could draw the same volume at different heights. A test draws a given volume at every
tier and checks the level is the same.

## Logging — `src/core/Logger.ts`

Levels `debug < info < warn < error`; channel-tagged children (`log.child('Interaction')`) share
the level, so `setLevel` changes all of them. Dev builds log at `debug`, production at `info`.
Nothing logs per frame; repeating failures (a broken system) are logged once.

## Error handling

| Failure                                | Behaviour                                                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid config/content, WebGL missing  | Boot stops with `BootError(stage)` and an error screen                                                                                                                                                                           |
| Rapier (WebAssembly) cannot load       | New game/Continue fails with "Physics engine could not be loaded: …" in the menu; nothing is torn down; retry works                                                                                                              |
| The 3D renderer's chunk cannot load    | New game/Continue fails with "3D view could not be loaded: …" in the menu; nothing is torn down; retry works                                                                                                                     |
| The lab pack cannot load or is invalid | New game/Continue fails with "Experiments could not be loaded: …"; the catalog says so with Try again; a failed download is retried, invalid content fails the same way each time (`npm test` catches it on the bundled content) |
| The results panel's chunk cannot load  | The world plays on; asking for results says "The results could not be shown: …" and loads it again                                                                                                                               |
| A system throws in `update`            | That system is disabled, logged once; game continues                                                                                                                                                                             |
| An event listener throws               | Logged; other listeners still run                                                                                                                                                                                                |
| An interaction action throws           | Logged; `perform` returns false                                                                                                                                                                                                  |
| A simulation model throws / NaN        | Run ends `failed` with the reason; no result is reported                                                                                                                                                                         |
| Save storage blocked or damaged        | Memory fallback with a menu notice / backup slot / clear error                                                                                                                                                                   |

## Debug panel — `src/platform/ui/DebugPanel.ts`

Development builds only (`import.meta.env.DEV`), toggled with **F3**. Shows phase, scene, FPS,
character, position, look angles, room, focus, entity/interactable counts, events published and
live listeners, latest experiment run, completed experiments, system statuses, and a **scene jump**
tool (available while playing). It refreshes four times per second. The scene jump is a developer
teleport: it puts the player at the scene's spawn and bypasses doors and entry rules, so it is
never evidence that a normal door transition works.

## HUD notices — `src/platform/ui/NoticeQueue.ts`

Short messages at the top of the screen, driven by events. The policy is a DOM-free class with
its own tests; the HUD only renders it (on change, never per frame):

| Rule        | Behaviour                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One a topic | Each notice has a key: `room`, `inspect`, `blocked`, `equipment`, `procedure`, `procedure-ready`, `experiment`. A new one replaces the old (latest refusal, latest step, results replace "Running…"). |
| Coalesce    | The same text again restarts its time instead of showing twice.                                                                                                                                       |
| Bounded     | At most 4. When full, the oldest info/success notice goes; warnings/errors only when nothing else is left.                                                                                            |
| Readable    | 4 s, 6 s for warnings and errors, longer for long texts (20 characters a second, at most 12 s).                                                                                                       |
| Not stale   | A refusal is withdrawn when the procedure moves on or the scene changes; "the door is open" is withdrawn as soon as the entrance would no longer open.                                                |
