# Phase UX2 report: room-local lighting, Preparation Room and lobby detail

Date: 2026-10-28.

- **Base:** `main` at `a1ca48c` plus the uncommitted phases W0, WX and UX1
  ([phase-ux1-report.md](phase-ux1-report.md)).
- **State:** everything here is uncommitted, and nothing is pushed.
- **Who did what:**
  - The Lead did the lighting and the room shells.
  - Two workers built the furnishing in their own worktrees (`.claude/worktrees/ux2-prep`,
    `ux2-lobby`); the Lead merged it file by file.

## Verdict

**PARTIAL.** Every automated check passes (see Verification). The manual visual review on the
user's own display — RTX 5070 Laptop, 2560 × 1600, 300 Hz, at their Windows scale — has not been
done. The only stills so far were taken on that GPU headless at 1280 × 720.

## Lighting

**Root cause of "the sun shines through the walls".** Until now an enhanced scene was lit by a
directional "sun" placed at the rooms' centre + (9, 22, 6), with one 1024² shadow box over the whole
scene, plus a second directional fill.

- The ceiling fixtures (`ceiling-light`, `hub-light-panel`, the oculus) only glowed. They lit
  nothing.
- So every shadow in every closed room fell at the same outdoor angle, from a light no room has.

**Old architecture.** One global rig: hemisphere, sun (the only shadow source), fill and tone
mapping. After UX1 the sun was fitted over every resident scene.

**New architecture (room-local).**

- **Data.** A room owns its lights (`rooms.json` `lights`). Each light hangs under one of the room's
  own glowing fixtures, with a role:
  - `key`: casts the room's shadows, one per room;
  - `fill` / `accent`: no shadows.

  Each light has a floor illuminance (`lux`); the colour is the fixture's own.

- **`world/lighting.ts`** (pure) turns a room's lights into spots:
  - just under the fixture, aimed straight down;
  - the key's cone reaches every corner of its floor;
  - a fill's cone stays inside its walls;
  - intensity = lux × height² (three's decay 2).
- **`platform/render/roomLights.ts`** keeps a fixed pool: `LIGHT_SLOTS` = 4 key spots that cast
  shadows and 6 that do not, made once.
  - Rooms fill and empty slots as scenes come and go, so a door opening changes no shader.
  - An empty slot is dark and its shadow map is not redrawn.
  - Its map is still made once: a shader samples every key's map, and WebGL refuses a draw whose
    shadow sampler has no depth texture. A black screen showed this on the first try.
- **In `WorldRenderer`:**
  - No sun in enhanced scenes (`sun.visible = false`); the basic preset keeps it, for fixtures and
    tests.
  - The hemisphere is now a soft base (`INDOOR_AMBIENT` 0.55).
  - Walls and ceilings cast shadows, so each key light stays in its room, since its cone reaches
    past them. Floors and walls receive shadows.
  - The player casts a shadow through an invisible body-sized cylinder: it writes no colour and no
    depth, but casts in the shadow pass.
- **Room lights:**

  | Room                   | Key                                                      | Fill                   |
  | ---------------------- | -------------------------------------------------------- | ---------------------- |
  | Preparation Room       | ceiling light over the PPE area                          | the second panel       |
  | Corridor               | light over the wash station                              | light over the lockers |
  | Hub                    | the oculus (the skylight, straight down onto the emblem) | two panel rows         |
  | Labs                   | one of their two fixtures                                | the other              |
  | Range, bay             | their own                                                | their own              |
  | Teacher room, bathroom | their only light                                         | —                      |

- **The hub's emblem.** It hangs inside the oculus light, and its rings threw long wedges across the
  floor, so it and the oculus no longer cast.

**Boot checks (`content.ts`):**

- a light names a placement of its room whose item glows;
- one key per room;
- every scene, and every pair of scenes joined by a door, fits the pool.

The heaviest pair is hub + Physics Lab: 4 keys and 5 others.

If a third scene is left open (for example a door held open by an object), the extra lights go dark
with one warning: the current scene keeps its slots.

**Graphics quality decides the model.**

- Medium and High: room lights.
- Low: the cheap one-light model from before UX2 (sun and fill fitted over the resident scenes),
  without shadows, so no outdoor shadows either.
- On a software renderer (the WebGL renderer name matches SwiftShader, llvmpipe, Software or Basic
  Render), the game suggests Low as long as the player has never picked a preset. It is not stored,
  and a choice of the player's always wins (`Game.preferGraphicsQuality`). The settings radios
  follow it.

The reason is measured, on SwiftShader, single page, 1280 × 720:

| Pool                               | Physics Lab | Preparation Room |
| ---------------------------------- | ----------- | ---------------- |
| Room lights, pool 4 keys + 6 fills | 5.9 fps     | 7.1 fps          |
| 4 + 2                              | 7.7 fps     | 10.0 fps         |
| 4 + 0                              | 11.1 fps    | 15.1 fps         |
| 4 + 0, no shadows                  | 13.4 fps    | 17.0 fps         |
| The one-light model before UX2     | 23.7 fps    | 28.3 fps         |

- On SwiftShader the cost grows with the number of lights each pixel evaluates. The shadow filter
  (PCF or basic) and the tile textures (about 5 %) do not change it.
- With room lights on SwiftShader the full e2e suite failed: 8 timeouts at 3–5 fps, 23.9 minutes.
  With the suggested default it passes, in 11.4 minutes.
- The room-light path is still covered on SwiftShader by the specs that choose Medium or High
  (`settings.spec.ts` ceiling and pendulum-bay brightness, `draw-calls.spec.ts`), and on the GPU by
  the bench and the probes below.

**Performance** (RTX 5070 Laptop GPU, D3D11, headless, 1280 × 720, at the 300 fps cap):

| View                                           | GPU before → after | CPU before → after | Draws before → after |
| ---------------------------------------------- | ------------------ | ------------------ | -------------------- |
| Hub spawn                                      | 2.35 → 2.48 ms     | 0.47 → 0.67 ms     | 87 → 103             |
| Physics Lab (3 key shadow passes instead of 1) | 2.08 → 2.44 ms     | 1.10 → 1.57 ms     | 266 → 404            |
| Hub with the physics door open                 | 2.08 → 2.80 ms     | 1.06 → 1.87 ms     | 252 → 564            |

Those numbers come from before the furnishing was merged.

After the merge, with everything furnished, every view still runs at the 300 fps cap:

| View             | GPU          | CPU     | Draws |
| ---------------- | ------------ | ------- | ----- |
| Hub              | 2.24–2.41 ms | 0.72 ms | 156   |
| Preparation Room | 2.58 ms      | —       | 173   |
| Corridor         | 2.53 ms      | —       | 123   |
| Physics Lab      | 2.72 ms      | 1.42 ms | 404   |
| Chemistry        | 2.66 ms      | —       | 71    |

`npx playwright test -c playwright.bench.config.ts --project=gpu-headless`: PASS 4/4, every scenario
at 300 fps, GPU 2.56–2.81 ms. That was 2.1–2.36 ms in UX1; CPU is 1.0–1.34 ms; the Physics Lab runs
271–324 draws.

**Transitions** (real GPU, Medium): mean brightness change at the threshold step, against the
largest change between two walking steps.

| Route             | At the threshold | Largest walking step |
| ----------------- | ---------------- | -------------------- |
| Corridor → hub    | −0.2             | 8.6                  |
| Hub → corridor    | 1.1              | 5.3                  |
| Hub → Physics Lab | −1.0             | 9.8                  |
| Physics Lab → hub | 0.7              | 3.2                  |

There is no pop at any door: all resident scenes' lights stay lit, and nothing changes at the
threshold.

## Room shells (all enhanced rooms)

- Floors in 0.6 m tiles: a joint and a faint per-patch variation. Ceilings in 0.6 m panels.
  - Both come from one 256 px image, drawn once and multiplied by the room's own colour.
  - Anisotropic filtering is on.
- A dark painted skirting along every wall piece, stopping at the doorways: one merged draw per room.

## Preparation Room and clean corridor (worker "prep")

Built as procedural props (`props/preparation.ts`), on the existing items and colliders, with every
id and interaction unchanged.

**Preparation Room:**

- the wardrobe as a painted-steel PPE cabinet: two doors, handles, louvres, cornice, plinth;
- the bed on a steel frame, a desk with drawer and legs, a chair on a tube frame;
- a framed notice board;
- a door casing on the doorway;
- signs on stand-offs: "CLEANROOM CORRIDOR …" and "PPE …".

**Corridor:**

- a locker bank: 8 numbered doors, vents, latches;
- a gowning bench with a shoe shelf;
- the PPE shelf with compartments and folded coats;
- a hand-wash station:
  - a vanity with a solid-surface top and an undermounted bowl under the faucet's stream;
  - a wall faucet with an elbow lever;
  - liquid, towel and glove dispensers on brackets;
  - a splashback and a "WASH HANDS · Wet · Soap · Rub · Rinse · Water off · Dry" sign, in the
    procedure's order;
- a pedal bin;
- an emergency panel;
- a "CLEAN AREA · SIMLAB HUB" sign;
- wall protection rails.

**Materials.** New finishes: aluminium (satin, apart from the stainless `steel`), linen,
glove blue, rubber.

## Lobby (worker "lobby")

- **Architecture:**
  - a floor field: a border on the column grid, 1.5 m stone joints, and a clear circle around the
    floor emblem with a steel ring and cyan door marks;
  - wainscot panels with a skirting and a stainless rail.
- **Wayfinding.** Department sign mounts behind the four door signs: a backplate, bolts, stand-offs
  and a department colour band (chemistry teal, physics blue, biology green, preparation amber).
- **Identity.** Science displays on the walls: a periodic table (118 cells by block), an atom
  model, a DNA helix, a standing wave.
- **Furniture:**
  - four benches on a ring around the emblem (the focal point);
  - lounge groups in the aisle corners, with low tables;
  - the reception desk rebuilt: counter with nosing, panels, plinth, and a "SIMLAB" plate.
- **Emblem and oculus.** Neither casts a shadow any more (the key light is inside them).

## Verification

| Check                                          | Result                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                | PASS, 1606/1606, 79 files                                                                                                                                                                                                                |
| E2E `npx playwright test --reporter=list,json` | **PASS** 74/74 (12.9 min, SwiftShader; none flaky or skipped). Earlier with room lights on SwiftShader: FAIL 62/74 (timeouts at 3–5 fps), then 69/70 plus 4 not run, with one real bug (the settings radios) fixed and rerun 5/5 and 4/4 |
| `npm run build`                                | PASS                                                                                                                                                                                                                                     |
| Menu budget                                    | 473,529 B < 500,000 (+22,304 B over UX1: the furnishing content is data in the menu chunk)                                                                                                                                               |
| Three.js in the menu chunk                     | none (`__THREE__` 0); renderer chunk 641,098 B                                                                                                                                                                                           |
| GPU benchmark                                  | PASS 4/4 (gpu-headless), 300 fps cap                                                                                                                                                                                                     |
| Visual QA                                      | headless real-GPU stills at 1280 × 720 of the Preparation Room, corridor, hub, labs and teacher room; the user's display: NOT RUN                                                                                                        |

**Changed assertions**, each encoding the replaced sun model or a deliberate content change:

- `WorldRenderer.test.ts`: the lighting characterization was rewritten for room lights; the basic
  preset is kept.
- `residencyRooms.test.ts` and `doorLeaves.test.ts`: room lights in the pool instead of the UX1
  sun fit. Shell counts include the skirting.
- Body and collider counts:

  | Scene            | Bodies / colliders                    |
  | ---------------- | ------------------------------------- |
  | Preparation Room | 14/32 → 15/33 (the pedal bin)         |
  | Hub              | 28/41 → 40/53 (12 benches and tables) |

  In `layoutSweep.test.ts`, `PhysicsSystem.test.ts`, `hold.test.ts`, `e2e/world.spec.ts`,
  `e2e/game.spec.ts`.

- `Game.test.ts`: the preparation scene's entities, 27 → 38.
- `e2e/settings.spec.ts`: SwiftShader now starts at Low.
  - The two brightness tests choose Medium beforehand, as an earlier visit would; their thresholds
    are unchanged, and they pass under room lights.
  - "medium by default" now reads "Low by default on a software renderer (Medium on a GPU)".

**New tests:**

- `world/lighting.test.ts`;
- the content checks for room lights and the pool;
- the residency pool overflow (three scenes, no light made or lost);
- the key cone covering every corner;
- the props' own tests (`props/preparation.test.ts`, `props/hub.test.ts`);
- `Game.test.ts`: the suggested preset only while none was picked, and not stored.

**Fixed along the way:** the settings radios now follow a preset changed without a click.

## Remaining issues

- Not seen on the user's display. To look at there:
  - the overall brightness (`INDOOR_AMBIENT`, the lux defaults);
  - floor joints aliasing at a distance;
  - z-fighting of the hub floor field;
  - the locker numerals;
  - the PPE cabinet's colour;
  - walking corridor ⇄ hub ⇄ labs.
- More shadow passes. The Physics Lab draws 3 shadow maps where it drew 1, and a door open to it 4. On the GPU this costs well under the 300 Hz frame.
- Machines without a GPU get the one-light model by default. Room lights there run at about half
  the old frame rate.
- Fill lights cast no shadows, so an object under a fill casts nothing from it. This is by design,
  for performance.
