# Phase P3.10 — The station controls as a console

The control desk, the dials, the RUN/STOP/RESET buttons and the desk display at all four stations
(free fall, Hooke's law, projectile, pendulum) are now drawn as models instead of placeholder
primitives:

- a console desk: a top board over an inset cabinet on a dark plinth;
- push buttons in dark bezels;
- knobs on skirts;
- displays standing on a foot plate.

Interaction, colliders and experiments are unchanged. The models are selected by data, never by
item id.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- `npm run check`, `npm run build`, the desk-driven e2e specs and the full e2e suite pass (§5).
- On the real GPU the cost is within noise, and the bundle grows 1.4 kB.
- The limitations are in §10:
  - on SwiftShader the closest desk view is about 16 % slower;
  - the visual check was done on headless GPU screenshots, not by a person on a real display.

## 2. Baseline

| Item               | Result                                                              |
| ------------------ | ------------------------------------------------------------------- |
| Branch / HEAD      | `main` / `2875fad` (P3.9 closure), clean tree                       |
| `npm run check`    | **PASS** 863/863, 45 files                                          |
| `npm run test:e2e` | **PASS** 45/45, 0 failed, 0 skipped (10.3 min, 3 workers, no retry) |
| `npm run build`    | **PASS** — JS 966.96 kB (966,968 bytes), CSS 21.74 kB               |
| Power              | battery at the start; **AC** for every compared bench (§6)          |

**Before:**

- Every station control was drawn by `WorldRenderer.geometryFor` as its collider primitive:
  - the desk: a 1.8 × 0.85 × 0.7 m box;
  - each button: a 0.12 × 0.05 × 0.12 m slab;
  - each dial: a 24-segment cylinder;
  - each display: a box standing on the desk.
- The schema itself called `visual.shape` a "Placeholder primitive until real models exist".
- There are 4 desks, 16 dials, 12 buttons and 4 displays, in three rooms of the Physics Lab scene.
- The dials do not show their setting; only the launcher's barrel reads a parameter.

## 3. Implementation

**Data.**

- `gameplay/item.ts`: `visual` gains an optional `model: desk | push-button | knob | display`, "a
  station control drawn as a model inside the box". The box stays the collider and the
  interaction box.
- `content/items.json` sets it on seven items:
  - `control-desk` → desk;
  - `control-dial` → knob;
  - `run-button`, `stop-button`, `reset-button` → push-button;
  - `station-display`, `station-display-tall` → display.
- Nothing else in the items changed: sizes, colours, materials and interactions are as they were.
- Items are not saved, so the save format and `SAVE_VERSION` are untouched.

**New: `src/platform/render/consoleModel.ts`.**

- `controlShapes(model, size)` returns a `body` (the entity's own mesh) and an optional dark `trim`.
  Both are in the item's frame and inside its box.
- **Desk:**
  - the body is one lofted solid: a 35 mm top board with a 6 mm bevelled edge, its top face exactly
    the box's top (where the controls stand), over a cabinet inset 4 cm on every side;
  - the trim is a plinth 8 cm high, inset 6 cm;
  - it is the same from both long sides, because players stand on either side.
- **Push-button:**
  - the body is a round cap (radius 42 mm) rising out of the trim to the box's top, with a
    chamfered top;
  - the trim is a dark square bezel, 2 cm high, filling the box's footprint.
- **Knob:**
  - one body: a 4 cm skirt with a 28 mm knob on it and a chamfered top;
  - no trim, and no mark, because the dial shows no setting.
- **Display:**
  - the body is the screen's box, as before;
  - the trim is a dark foot plate, 65 % of the width and 8 cm deep, under its bottom.
- It uses `loft` and a new `roundRect` outline from `assembly.ts`. `slab` now uses `roundRect` too:
  a pure refactor, with the same geometry.

**Changed: `WorldRenderer`.**

- `geometryFor` returns the control's body when the item has a `model`. The shapes are built once
  per model and size (`controlFor`) and shared by every copy, like the primitive cache: 9
  geometries for 36 controls.
- The trim is a second mesh in the entity's group. All trims share one dark plastic material.
- Focus and the active glow still act on the entity's own material, which is on the body.
- The shared geometries and the trim material are freed when the renderer is disposed, like the
  primitive cache. Entities hold nothing of their own to free.
- **Docs:** `docs/data-model.md` lists `visual.model`.

## 4. Preservation

**Untouched:**

- every experiment model and result;
- `StationSystem`, the behaviours (`parameter-dial`, `experiment-control`, `instrument`) and the
  interaction ray boxes;
- RunRecord, CSV, IndexedDB and the save;
- the colliders (sizes unchanged), FrameClock, the single RAF, quality and lighting.

**On screen:** the screens on the displays are drawn exactly as before (`ExperimentView.addScreen`,
on the box's face).

## 5. Tests

| Command                                                                       | Result                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run check`                                                               | **PASS** 879/879, 46 files (+16)                           |
| `npm run build`                                                               | **PASS**                                                   |
| `npx playwright test experiment.spec free-fall.spec hooke.spec pendulum.spec` | **PASS** 4/4 (3.2 min)                                     |
| `npm run test:e2e` (3 workers, no retry)                                      | **PASS** 45/45, 0 failed, 0 flaky, 0 skipped (9.6 min, AC) |
| `git diff --check`                                                            | clean                                                      |

**Unit tests** (`consoleModel.test.ts`, 16):

- Every model is used by at least one item.
- **For each of the 7 items:**
  - every vertex is finite, every normal has unit length, and the indices are in range;
  - every part is inside the item's box, with 1 µm tolerance for float32. The display's foot is
    allowed 2 cm beyond the 4 cm screen at the front and back;
  - the lowest part stands on the box's bottom and the body reaches the box's top.
- **For all 32 controls placed on a desk** (16 knobs, 12 buttons, 4 displays):
  - each stands on a desk's top board (its base at the desk's height);
  - its turned footprint lies on the desk's top.
- **Mutation check** (temporary, reverted). Each break below fails the tests:

  | Break                    | Tests failed |
  | ------------------------ | -----------: |
  | desk top 1 cm low        |            1 |
  | knob wider than its box  |            1 |
  | button cap above its box |            3 |
  | display foot 20 cm deep  |            3 |
  | parts floating 1 cm      |            5 |

**End to end.** Every e2e spec presses these buttons and turns these dials by aiming at the item's
box, and all pass unchanged.

## 6. Performance

A temporary bench scenario (deleted) ran the production build, Edge headless, 1280×720, Medium
graphics, with two views measured for 5 s each:

- "low": from the side of the free-fall desk, with its cabinet and controls in view;
- "at desk": the player at the free-fall desk looking down at its controls.

**Power.** The first before run was on battery and the first after run on AC, so the before run was
repeated on AC from a temporary worktree of `2875fad` (removed). All numbers below are on AC.

**Draw calls**, which don't depend on power: 171 → 176 (low) and 160 → 165 (at desk). That is +5,
the one desk in view: its plinth, three bezels and the display's foot.

**RTX 5070 Laptop GPU (ANGLE D3D11), gpu-headless, AC, 300 fps.** Two rounds each:

| View    |     GPU ms before → after |     CPU ms before → after |
| ------- | ------------------------: | ------------------------: |
| low     | 2.30 / 2.32 → 2.22 / 2.26 | 0.84 / 0.84 → 0.86 / 0.85 |
| at desk | 2.23 / 2.25 → 2.15 / 2.16 | 0.83 / 0.80 → 0.82 / 0.81 |

There is no measurable cost on the GPU: GPU time is within noise and CPU is about +0.02 ms.

**SwiftShader** (software, uncapped, AC), FPS of three runs each:

| View    | Before             | After              |
| ------- | ------------------ | ------------------ |
| low     | 35.0 / 34.8 / 35.1 | 32.1 / 33.1 / 32.3 |
| at desk | 33.6 / 33.4 / 33.4 | 28.5 / 27.7 / 28.1 |

- That is about 7 % slower from the side and about 16 % slower at the desk.
- **What causes it.** Probes on the after tree (reverted), two runs each, low / at desk:
  - 16-point circles instead of 32: 32.4–33.2 / 28.4–29.0 fps — unchanged, so triangle count is
    not the cause;
  - square desk corners (the top's fan cap becomes two big triangles): 32.7 / 28.4–28.5 —
    unchanged;
  - no trims: 33.1–33.9 / 30.3–30.4;
  - only the desk and display modelled: 34.0 / 29.6–30.3.
- So the cost is spread over the new parts: the desk and display about 3 fps, the trims about 2,
  the knobs and buttons about 1. It doesn't come from triangle count or cap triangulation; the
  exact SwiftShader mechanism was not found.
- SwiftShader is the e2e renderer, not a performance target. The real GPU shows no cost.
- In practice the full e2e suite (on SwiftShader) took 9.6 min on AC, against the baseline's
  10.3 min on battery. The power state differs, so this shows no slowdown, but it doesn't measure
  one either.

**Geometry**, counted from `controlShapes` by a temporary test (deleted):

| Item         | Triangles before | After (body + trim) |
| ------------ | ---------------: | ------------------: |
| desk         |               12 |           196 + 156 |
| knob         |               96 |                 316 |
| button (×3)  |               12 |           188 + 156 |
| display (×2) |               12 |            12 + 156 |

- Over the 36 controls this is about 1.8k → 11.3k triangles.
- Geometries: 5 → 9, all shared.
- Materials: +1, the shared trim.
- Textures: none added.

## 7. Resource stability

A temporary e2e probe (deleted) counted live WebGL buffers and textures in the dev app. It started
at the free-fall desk looking at its controls, then did five Physics Lab ↔ hub round trips by
developer scene jump (used only to unload and reload).

| Tree   |            Start | After each of the 5 round trips |
| ------ | ---------------: | ------------------------------: |
| before | 371 buf / 13 tex |      522 buf / 22 tex, all five |
| after  | 377 buf / 13 tex |      531 buf / 22 tex, all five |

- There is no growth, so no leak.
- The shared control shapes add 9 buffers, which live as long as the renderer.
- No textures were added.

## 8. Bundle

| Asset | Before                | After                 | Delta               |
| ----- | --------------------- | --------------------- | ------------------- |
| JS    | 966.96 kB (966,968 B) | 968.40 kB (968,403 B) | +1.44 kB (+1,435 B) |
| CSS   | 21.74 kB              | 21.74 kB              | 0                   |

`e2e/production.spec.ts` limits the menu's JS to under 1,000,000 bytes. 31,597 bytes are left.

## 9. Visual validation

**Method.**

- Headless screenshots on the real GPU (RTX 5070, ANGLE D3D11), 1280×720, Medium graphics, through
  Continue from a save, saved in the session's scratchpad (`p310/before`, `p310/after`).
- The same 8 views before and after:
  - the four desks (free fall, Hooke, projectile, pendulum) from the player's place;
  - the free-fall desk from its side;
  - close-ups of the buttons and the dials;
  - the display from behind.

**What the after shots show:**

- Each desk reads as a console: the top board overhangs a cabinet on a dark plinth.
- The buttons are coloured caps in dark square bezels; the knobs sit on skirts.
- The displays stand on their foot plates.
- Focus lights the aimed control's cap or knob, as before (the STOP button, the g and ζ dials).
- At all four desks the controls stand on the top, with nothing floating or sunk.

**Not done:**

- Nobody looked at a real display, or at other resolutions or qualities.
- Pressing and turning were not judged in images; the e2e specs cover them functionally.

## 10. Limitations

- **SwiftShader cost.** About 7–16 % fewer frames at the closest desk views on SwiftShader (§6). The
  real GPU shows none. The exact SwiftShader cause was narrowed (not triangles, not the cap fan)
  but not found.
- **No real-display visual validation.** Only headless GPU screenshots.
- **Two displays end flush with their desk's end** (free fall and Hooke, as placed in
  `rooms.json`). They stand on the top, but their outer edge is over the top's 6 mm bevel. Their
  placement was not changed.
- **The controls show no state of their own.**
  - The knobs have no mark, because the dials don't expose their setting visually.
  - The buttons don't move when pressed.
  - Both would be new behaviour, out of scope.
- **The cabinet's long sides shade slightly curved.** `loft` smooths normals around the rounded
  outline, so the long flat faces interpolate towards the corners. This is the existing `slab`
  look.
- **Other props are still primitives:** the wall results monitors, the lab bench, the cart and the
  lamp.

## 11. Git

Committed on request as "phase p3.10", on top of `2875fad`. Not pushed (the repository has no remote).

- Modified: `src/gameplay/item.ts`, `src/content/items.json`, `src/platform/render/assembly.ts`,
  `src/platform/render/WorldRenderer.ts`, `docs/data-model.md`.
- New: `src/platform/render/consoleModel.ts`, `src/platform/render/consoleModel.test.ts`, this
  report.
- Deleted again: the temporary bench and shot spec, leak probe, count test and HEAD worktree.
