# Phase G report — the Ultra graphics preset

Contract: `docs/phase-g-ultra-contract.md` (approved 2026-11-06, D1–D4 all (a)). Low, Medium and
High are unchanged; Ultra is a fourth preset, chosen only by the player after a dialog.

## 1. G-1: the preset, the dialog, lighting (2026-11-06)

### Built

- **The preset** `ultra` (`persistence/settings.ts`, `render/quality.ts`): High's values and 4096²
  key shadow maps blurred wider (`shadowRadius` 4, three's PCF `shadow.radius`; the other presets
  keep 1, three's default), the post-processing chain, reflections of the room the player is in.
  Three new `QualityConfig` fields: `shadowRadius`, `post`, `roomReflections`.
- **The dialog** (`ui/settings.ts`): choosing Ultra in the main menu's or the pause menu's
  Settings leaves the preset as it was and asks first — what Ultra is for (an RTX 4060 / RX 7600
  class card, 8 GB of video memory), what it costs (frame rate, heat, fan, battery), that its
  effects download the first time, that experiments and results are the same, and, on a software
  renderer, that it will be very slow there. "Turn on Ultra" switches and remembers it; Cancel and
  Esc keep the preset (Esc closes only the dialog, the pause menu stays). Each time Ultra is chosen
  from another preset (D2); not again on a visit that starts in Ultra. English and Vietnamese,
  `role="dialog"`, focus on Cancel, Tab kept between its buttons.
- **Post-processing** (`render/post.ts`, its own chunk, 49.8 kB, imported the first time Ultra is
  chosen, never by another preset, freed when the player leaves Ultra): the scene drawn into a
  half-float target with a stencil (the outlines), ambient occlusion (three's GTAO,
  radius 0.35 m, glass and liquids left out: they would darken what is behind them as if solid),
  bloom on what is brighter than the room (lamps, screens), tone mapping and sRGB, then SMAA.
  The shader warm-up and the room wake draw into the composer's target, so their programs are the
  frame's.
- **Room reflections**: entering a room under Ultra, it is captured once from its middle at eye
  height (a 256² cube, the player's hands and body hidden, prefiltered by PMREM) and becomes the
  environment of steel, glass and the walls instead of the generated room; freed with its scene and
  when the player leaves Ultra.

### On the GPU (Phú: "Chạy bench đi")

`BENCH_GRAPHICS=<preset> npx playwright test -c playwright.bench.config.ts --project=gpu-fullscreen`,
ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11, fullscreen 2561×1601 (pixel ratio 1.5),
vsync on the 300 Hz display.

- **First run at Ultra: 7.9 fps** in the Biology Lab (GPU 115 ms a frame; High 300 fps, 1.7 ms).
  One part off at a time: the post-processing off, 299.6 fps; 2048² shadows, still 7.8; room
  reflections off, 13.9 (the post-processing still on). Within it: without AO 16.7 fps, without MSAA
  83 fps. **4× MSAA on the half-float target was the cost** (60–100 ms a frame under ANGLE/D3D11):
  replaced by SMAA, last in the chain.
- **Then a 2.3 s frame** (CPU) as each lab first appeared: the chunk arrived after the load and
  every program was compiled again for its target. Now the chunk is fetched when the renderer
  starts under Ultra, the chain made during the scene's load, and the load's compile done for the
  composer's target: the first frames' longest 7 ms (Chemistry), 13.5 ms (Biology).
- **Ultra now** (frame rate, 1% low): Chemistry 131–152 fps (55–146); Biology 100–152 (18–75; the
  18 and 23 when the microscope workspace opens, as under High: 77 and 107 ms frames there);
  hub 152 (75); Physics Lab (`e2e/physics-lab.bench.ts`) 118–151 (46–121). **Every lab over
  D4's 60 fps.** High unchanged: 219–300 fps.
- The Chemistry bench had failed under every preset since U-2: the wash bottle's saved spot was the
  old bench front (z −4.6). Now on the bench left of the tile (−0.95, −7.379), clear of the
  colorimeter.

### Phú's look: distant things soft (2026-11-06)

"It is fine, but things far away look blurred, as if at a low resolution — not a haze." Measured
on a far clip (SwiftShader, the same view each time): turning bloom off, raising its threshold or
turning SMAA off each brought back the detail (a PNG of the clip 60–62 kB against 30–32 kB:
detail compresses less). Bloom's threshold was 1.1 in the target's linear units: the labs' lit
white walls passed it, and bloom's blur, made at lower and lower resolutions, was laid over the
whole room. Now **2**: the walls stay sharp, the light strips still glow. SMAA stays (the canvas's
MSAA does not reach the composer's target, and 4× MSAA there cost 60–100 ms a frame).

### Tests

- `npm run check`: **PASS** — 236 files, 3485 tests. `quality.test.ts` runs every preset, Ultra
  among them: the Hooke's law run gives the same samples and results (its own 20 s timeout now: six
  real runs took past 5 s beside the whole suite, 1.8 s alone). `Game.test.ts`: an unknown stored
  preset is now `"extreme"` (it was `"ultra"`).
- e2e (SwiftShader), `SIMLAB_DEV_ONLY=1 npx playwright test --project=warmup --project=dev --workers=1 e2e/settings.spec.ts`:
  **PASS** (7), the new "Ultra asks first": the dialog, its notes (the software warning here),
  Esc and Cancel keep High, Vietnamese, Turn on Ultra switches and is stored, a free-fall run under
  Ultra gives the theory, kept on reload without asking. `e2e/draw-calls.spec.ts` and
  `e2e/room-sleep.spec.ts`: **PASS** (19), the counts at Low, Medium and High as before. After the
  bench's changes: `settings.spec` and `room-sleep.spec` 10 of 11, the sleep cycles' second and
  third differing by 4 buffers once (passed twice alone) — FLAKY: where a walk stops decides what is
  first drawn in which cycle; it now walks four cycles and compares the last two (**PASS**).
- `npm run build`: the post-processing in `post-*.js` (49.8 kB); the menu's JS 416.6 kB.
- Screenshots High and Ultra of the same view (SwiftShader): bloom on the light strips, softer
  shadows, the room reflections; the room reads a little brighter at Ultra (the captured room is
  brighter than the generated one the hemisphere's balance was measured for).

### Not done, limitations

- Not seen on Phú's display. To look at: the brightness at Ultra (the captured room), the AO's
  strength, the bloom's.
- Fill lights do not cast shadows yet (budget to measure on the GPU).
- Capturing a room costs six small renders and a prefilter the moment the player enters it:
  measured in G-2 (below), 270 ms on the RTX 5070 once programs no longer change for it.
- G-2 (CC0 PBR surfaces, downloaded with permission) and the model detail tier (G-3 onwards) are
  next; until then Ultra's models are High's.

## 2. G-2: real surfaces (2026-11-06, autonomous — Phú away; committed 2026-11-07 after his look)

### Built

- **12 CC0 material sets** from ambientCG (2K JPG, downloaded with Phú's permission:
  `public/ultra/textures/`, 115 MB — 107 MB and 11 sets shipped since G-4, below — sources in its
  `README.md`): terrazzo and stone tiles,
  concrete, wood floor, painted plaster, brushed steel and aluminium, powder-coated metal, white and
  glossy plastic, rubber, furniture wood. Fetched **only under Ultra**; Low, Medium and High never
  load them (`surfaces.test.ts`).
- `render/surfaces.ts`: each standard material is matched to a set by its tag — the room shell's
  (floor by its kind, walls and ceilings plaster, skirting rubber), a finish's (`palette.ts` tags
  each finish material), or an entity's look. Glass, liquids, lights and anything glowing or
  already customised are left alone. The patch (`onBeforeCompile`, one program key per set) lays
  the set in world space (triplanar, no UVs needed): colour detail normalised around the
  material's own colour (a red button stays its red), roughness variation, the normal map
  (whiteout blend) and, where the set has one, ambient occlusion on indirect light. Leaving Ultra
  takes every patch off and frees the textures.
- Loading: textures decoded off the main thread (`createImageBitmap`, 2048 px floors and walls,
  1024 px props) and uploaded behind the loading screen (`initTexture`); a world load waits for
  them (and the post chunk) at most 20 s (`ultraReady`, `RendererHost`'s world preparation).

### Found by the bench and fixed

- **A 2.4–3.3 s freeze on entering a room at Ultra**: the room's reflection capture took the
  scene's environment map away for its six views, so every lit material needed another program,
  all compiled in that frame (G-1 had fewer programs; G-2's surfaces made it seconds). Now it sets
  the environment's strength to 0 instead — same programs — **270 ms** (the six views and the
  prefilter; G-1's report had called it "a few ms, not measured").
- **The surfaces reloaded after every scene load**: a scene change passes through basic lighting,
  which counted as "not Ultra" — textures freed, fetched again, the whole scene compiled again
  (frames of 65–685 ms after the lab appeared). Surfaces now follow the preset alone.
- **The run-history bench failed at Ultra** (2 of 2, then every run): the bench's aim is open loop,
  and the first pointer-lock delta after a re-capture can carry more than was sent (−853 px for
  −759 measured), more often at Ultra's frame times. `Aim.to` (`e2e/support.ts`) now counts the
  deltas the page receives and corrects the rest without capturing again (the browser refuses a
  capture that soon). Every e2e that aims goes through it.
- The first frame of the Chemistry bench: 517 ms before the upload during the load, **173 ms** now
  (CPU 127 ms: the lab's first frame, not the textures).

### On the GPU

`BENCH_GRAPHICS=ultra npx playwright test -c playwright.bench.config.ts --project=gpu-fullscreen
e2e/labs.bench.ts e2e/physics-lab.bench.ts`, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU,
Direct3D11, fullscreen 2561×1601 (pixel ratio 1.5), 300 Hz display. Frame rate (1% low):

| Place                                     | Ultra G-2       | Ultra G-1         |
| ----------------------------------------- | --------------- | ----------------- |
| Physics range (idle, dial, flight, after) | 114–123 (51–98) | 118–151           |
| Pendulum bay (idle, swinging, after)      | 149 (70–105)    | 149               |
| Run history (closed, 2 and 4 compared)    | 120 (53–99)     | — (failed, above) |
| Chemistry (7 views)                       | 127–150 (27–99) | 131–152           |
| Biology (room, microscope, workspace)     | 101–149 (16–66) | 100–152           |
| Hub                                       | 149 (68)        | 152               |

**Every place over D4's 60 fps.** Biology's 16 and 24 (1% low) are the microscope workspace
opening, as under High. High, same run of the physics bench: 217 fps lane, 300 pendulum bay, 300
run history — unchanged.

### Tests

- `npm run check`: **PASS** — 237 files, 3493 tests (`surfaces.test.ts`: 8 — every set shipped
  with its maps and README entry, the mappings, Ultra only, which material takes which surface, the
  shader patch, its removal, customised materials left alone).
- GPU bench (above): **PASS** — the labs bench 3 of 3 (with the counted aim before its last change:
  corrections without a new capture), the physics bench 3 of 3 with the final one (the frame-rate
  sweep is skipped in the fullscreen project, as before); at High the physics bench **PASS** (3).
- e2e (SwiftShader), `npx playwright test e2e/settings.spec.ts e2e/room-sleep.spec.ts
e2e/draw-calls.spec.ts`: 24 of 25 — the room-sleep cycles' fourth grew by 15 buffers once (all
  workers busy). Alone, `--repeat-each=2 --workers=1`: **PASS** 2 of 2, the four cycles equal;
  with `--repeat-each=3` (parallel) two of three never left the menu in 5 s. FLAKY under load, as
  in G-1; the code it exercises is not Ultra's.
- Full e2e: NOT RUN for G-2 alone; run with G-5's (§3 Tests).

### Not done, limitations

- Seen by Phú on his display (2026-11-07, "Looked, commit"). Looked at: the surfaces' scale and strength
  (terrazzo and stone detail 0.45–0.5), the plaster on walls, metals.
- The textures are 115 MB in `public/` (lazy, Ultra only): a first Ultra visit fetches them
  (about 1.4 s here from the local server; longer over a network).
- Shapes are still High's: the detail tier is G-3 onwards.

## 3. G-3 to G-5: model detail, the labs' look, every room (2026-11-06, autonomous; committed 2026-11-07 after Phú's look)

### Built

- **Model detail at Ultra** (`render/detail.ts`, `quality.ts` `modelDetail`, Ultra only): every
  box gets bevelled edges (a fifth of its thinnest side, 8 mm at most; none under half a
  millimetre), every round part (12 segments or more: a hex nut stays six) twice its segments, up
  to 128. Laid over what is drawn, as the surfaces are (the same adoption points in
  `WorldRenderer`), so it reaches every model at once: the Physics wing's stations and desks (G-3),
  Chemistry and Biology (G-4), the hub and every room (G-5).
  - A part is rebuilt only when its geometry is exactly what its parameters make, moved and turned
    a quarter at most — checked vertex by vertex; anything scaled, bent, merged otherwise,
    vertex-coloured, skinned, or a box with its own picture or several materials is left as it is.
    The new part has the same size and place: no reading, needle, level or scale moves.
  - Merged parts (props, decor, the rooms' dressing: `props/parts.ts` `part`) record where each
    piece lies in the merge and what made it; at Ultra the merge is rebuilt with those pieces
    detailed and the others copied as they were.
  - Each shared geometry is detailed once; freeing either the original or the detailed one frees
    both (owners free one or the other); leaving Ultra puts every original back.
- **The labs' look, tuned from the bench's stills** (G-2's sets, `surfaces.ts`): metals read as
  crumpled foil on thin rails — steel and aluminium now a light grain (detail 0.15/0.12, normal
  0.25/0.2, roughness variation 0.12); Chemistry's epoxy worktops had streaks and its terrazzo
  heavy chips (plastic and terrazzo detail and roughness variation lowered); **the Biology Lab's
  floor took Tiles074's own smaller checkerboard over the room's large tiles** — stone and tiled
  floors now keep their room's tiles with a fine stone grain over them (Concrete048, detail 0.25),
  and Tiles074 is no longer shipped (the zip is kept outside the project).
- **Glass and liquids: no refraction (transmission) at Ultra.** Glassware keeps High's filter, sheen
  and edge Fresnel, with Ultra's room reflections. Physical transmission glass refracts only opaque
  things and, as `game-core.md` notes, would hide liquid levels, menisci and end-point colours
  unless every bench model is checked: a science-readability decision left for Phú.

### On the GPU

Same command and machine as §2. Ultra with model detail (frame rate, 1% low; triangles):

| Place                                     | fps             | Triangles (G-2 → now)  |
| ----------------------------------------- | --------------- | ---------------------- |
| Physics range (idle, dial, flight, after) | 110–118 (46–82) | —                      |
| Pendulum bay                              | 149 (70–104)    | —                      |
| Run history                               | 119 (53–98)     | —                      |
| Chemistry (7 views)                       | 119–150 (27–99) | 204k → 726k (overview) |
| Biology (room, microscope, workspace)     | 117–149 (19–67) | 282k → 1.05M (room)    |
| Hub                                       | 149 (63)        | 181k → 760k            |

Draw calls unchanged; the GPU's frame time barely moved (Biology's room 6.5 ms before and after).
**Every place over D4's 60 fps.**

### Tests

- `npm run check`: **PASS** — 238 files, 3503 tests (`detail.test.ts`: 10 — boxes moved and
  turned, bevel size, round and faceted parts, what is left alone, merged parts, sharing, freeing,
  Ultra only).
- GPU bench at Ultra (above): **PASS**, 6 of 6 (the frame-rate sweep skipped in the fullscreen
  project, as before).
- Stills compared at High and Ultra (pendulum desk, launcher, Chemistry overview, Biology room):
  the bevels and rounder knobs show close up. High never runs it (unit test; not compared pixel
  by pixel).
- The e2e helper `Aim.to` (§2): a turn of nothing still takes its step — returning at once let two
  presses on one dial land in one frame (the run-history bench's L 1.25 m for 1.5 m).
- Full e2e (SwiftShader, Microsoft Edge), G-2 to G-5 together:
  - `npx playwright test` (3 workers): **FAIL** — 113 passed, 8 failed in 34.3 min. Seven of the
    eight waited on the menu or a load (draw-calls spawn and range lane, the dilution's flask focus,
    two physics-bench tests, two topics-catalog tests): each passed in the serial run below, so they
    are timeouts under three parallel software renderers, not results.
  - `npx playwright test --last-failed --workers=1` (it ran all 123): **FAIL** — 122 passed,
    1 failed: `renderer.production.spec.ts` "a failed renderer download keeps the menu…" (the menu
    stays "Loading…"). **Not from Phase G:** the same failure on a build of the committed HEAD
    (335f5c4). The renderer's import first preloads its own chunk (Vite's `modulepreload`);
    the test aborts that request, the import fetches the chunk again and succeeds, so no error ever
    reaches the menu.
  - Fixed in the test (2026-11-07, Phú: "Fix it now"): every download of the chunk fails until the
    menu has said why, then the next New game is served. The loader was right; only the test
    assumed one download per try. 10 of 10 **PASS** with
    `npx playwright test e2e/renderer.production.spec.ts --project=production --workers=1 --repeat-each=5`.

### Not done, limitations

- Seen by Phú on his display (2026-11-07, "Looked, commit"). Looked at: the bevels, the toned-down metals and
  floors, the Biology floor's grain.
- No small parts added (screws, knurled knobs, cables, maker's plates — contract §4.3) and no new
  Ultra dressing (cable trays, outlets, signage — §4.4): both are new models and need Phú's eye.
- No refraction (above). Liquids as at High.
- A part rebuilt during play (a model replacing a mesh's geometry) shows High's shape until the next
  adoption (a scene load, a preset change). The rooms' dressing follows the preset at its scene's
  next load.

## 4. G-6: Ultra's fittings (2026-11-07, Phú: "Bắt đầu làm tiếp những thứ còn lại của ultra đi"; committed after his look)

### Built

- `render/dress/fittings.ts`: what a real building has on its walls and ceilings, drawn under Ultra
  only (contract §4.4), in every room, from its definition (bounds, openings, placements) — no
  content changed, no collider, nothing to touch:
  - double sockets at the middle of the wall's modules, at most one every 2.4 m, where the wall is
    free; in a plain room over a bench or cabinet against the wall, 0.15 m above its top. On a
    style's cladding they sit on its face, in its lower row (starship 0.72 m, orbital 0.65 m); the
    greenhouse has none (planters and the moss wall stand there);
  - an exit sign (a lit green face, a white doorway and an arrow; no running figure, no text) over
    each doorway, above its door's frame; none where a name plate or anything else hangs, and none
    over a doorway into a room with no other way out (the teacher room's washroom). In the starship
    rooms it stands in front of the steel ledge its 2.6 m doorways reach;
  - a fire alarm call point beside each doorway at 1.4 m, on whichever side is free;
  - smoke detectors under the ceiling, at most 6 m apart, kept 0.6 m off the walls and 0.3 m off
    anything that hangs from the ceiling (lights, diffusers, ducts); none under the greenhouse's
    glazing.
- Two finishes in the palette: `exit-green` (lit) and `alarm-red`.
- `WorldRenderer`: a draw per finish per room, in the room's shell group (lit, darkened and put to
  sleep with its room), added when Ultra comes on (on a scene load or at once) and removed and freed
  when it goes; Ultra's model detail bevels them like every box.

### On the GPU

`BENCH_GRAPHICS=ultra npx playwright test -c playwright.bench.config.ts --project=gpu-fullscreen
e2e/labs.bench.ts e2e/physics-lab.bench.ts`, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11,
2561×1601: **PASS**, 6 of 6 — Physics range 111–117 fps, pendulum bay 149, run history 119,
Chemistry 127–150, Biology 104–149, hub 149. Chemistry's overview 391 draws / 820k triangles (G-5:
388 / 726k), the hub 392 / 885k (380 / 760k). Biology's microscope views drew exactly what they drew
in G-5 (346 draws, 743k) and ran 104–124 fps against 117–130 then: the same frames, so run-to-run
variance of a laptop GPU after a long session, not the fittings.

### Tests

- `npm run check`: **PASS** — 239 files, 3517 tests (`dress/fittings.test.ts`: every room's fittings
  inside it and out of its doorways' passage, a draw per finish, under 20k triangles; the labs and
  the teacher room fitted; no detector under glazing; detectors off what hangs; the dead-end rule).
- `npx playwright test e2e/draw-calls.spec.ts e2e/settings.spec.ts --workers=1` (SwiftShader):
  **PASS**, 21 — Low, Medium and High draw what they drew.
- Stills at Ultra (a temporary look file, not kept): the Physics and Chemistry doorways, a Physics
  wall and ceiling, the hub's and the teacher room's doors.

### Not done, limitations

- Seen by Phú on his display (2026-11-07, "Looked, commit"). Looked at: the sockets' and detectors' size, the exit sign (no
  running figure: drawing one in boxes reads poorly), the call points.
- Physics' range doorway keeps its name plate where the exit sign would go: no sign there.
- Still to do (contract §4.3): the small parts on the models (screws, knurled knobs, cables,
  maker's plates); refraction in glassware (above: readings must stay readable).

## 5. G-7: small parts, the first models (2026-11-07, Phú: "Small parts first" — not committed)

### Built

- `render/detail.ts`: `withSmallParts(geometry, make)` — a model names small parts only Ultra
  draws; `make` runs only when Ultra lays its detail, and they are merged into the part (bevelled
  or not), so no draw is added. Under every other preset the part is as made and nothing extra is
  built.
- The station controls (`consoleModel.ts`), the parts every station is worked through:
  - the knob's grip knurled: 40 fine ridges round it, inside its skirt;
  - the control desk's cabinet, on both long sides: a vent grille low on the right and a blank
    maker's plate with four screws high on the left, in the desk's dark trim.

### On the GPU

Same command as §4, ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11, 2561×1601: **PASS**, 6 of
6, every scenario 83–116 fps. Every scenario ran about 30 % slower than §4's, the hub too (103–107
fps against 149), though the hub has no desk or knob and drew exactly what it drew then (392 draws,
885k triangles), its CPU time up as well (1.8 → 2.3 ms): the laptop was in a slower state (battery
45 %, on its charger), not the change. Not compared against §4 for that reason; still over the
60 fps target everywhere.

### Tests

- `npm run check`: **PASS** — 239 files, 3520 tests (`detail.test.ts`: small parts built only when
  Ultra lays its detail, merged on a bevelled box, on a part whose shape stays, the knob and the
  desk inside their boxes).
- `npx playwright test e2e/draw-calls.spec.ts e2e/settings.spec.ts --workers=1` (SwiftShader):
  **PASS**, 21.
- Stills at High and Ultra (the free-fall desk, close and from the side): High unchanged; Ultra
  shows the plate, the vents and the knurl (fine on a dark knob).

### Not done, limitations

- Not seen on Phú's display.
- Still to come: the 3D stations' apparatus (bolts at joints, rubber feet), cables with plugs on the
  circuit boards, lab benches' fittings; refraction in glassware.

## 6. Stutter at Ultra: doors and play (2026-11-07, Phú: "Tìm cách tối ưu lại game sao cho chạy mượt nhất có thể trên ultra" — not committed)

Phú, on the RTX 5070: Ultra stutters now and then, when a door opens and in normal play. The
average frame rate was never the problem (every place over 60 fps); single long frames were. The
approach is the one large engines use for hitches: find each long frame in a profile, then move
its work out of one frame (spread over many, cached, or done before it is needed).

### Measured

A door-walk probe (temporary, not kept): the dev build at Ultra, the hub to the Physics Lab and
back through the doors, CPU profile and Chromium trace through CDP, every frame's time, WebGL
program links and texture uploads. ANGLE / NVIDIA GeForce RTX 5070 Laptop GPU, D3D11.

| Walk              | Longest frame, before → after     | p99, before → after |
| ----------------- | --------------------------------- | ------------------- |
| Hub → lab (door)  | 797 ms → 131 ms                   | 52.7 ms → 30.9 ms   |
| Lab → hub (door)  | 214 ms → 53 ms                    | —                   |
| Standing, playing | none over 25 ms, before and after |                     |

Found, in the order of their cost:

- **Asking too soon whether a shader is ready.** three's `compileAsync` polls
  `COMPLETION_STATUS`; under ANGLE/D3D11 Chromium answers only once the program has linked
  (~200 ms each), the page blocked meanwhile. Now `compileOnly` issues the compile, leaves the GPU
  process alone as long as the new programs take (230 ms per 4), then asks.
- **A neighbour scene spawned in one frame** (~225 ms for a lab). `SceneManager.attach` now spawns
  its placements 4 ms at a time, a frame between (`pause`, given by `main.ts` as a
  `requestAnimationFrame`; tests without it spawn at once). What spawns waits on a hidden layer
  (`SceneAttaching`) until its shaders are compiled, so the frames between never compile it.
- **Ultra's model detail built in one frame** (rounded boxes for every part of a lab). Now built
  2.5 ms a frame (`ModelDetail.adoptLater` / `update`), shapes cached by type and parameters, and
  the rounded box computed from a precomputed unit box instead of three's generator (the same
  vertices: a test compares them).
- **Room reflections captured in one frame** (6 cube faces + prefilter). Now one face a frame.
- **The ambient-occlusion pass re-rendered every shadow map** (its own scene render). Shadows are
  no longer updated inside it.
- **The city rebuilt on every visit to the hub.** Kept while its scene is away (freed with the
  quality or the session).

### On the GPU (steady play)

`BENCH_GRAPHICS=ultra npx playwright test -c playwright.bench.config.ts --project=gpu-fullscreen
e2e/labs.bench.ts e2e/physics-lab.bench.ts`, production build, ANGLE / NVIDIA GeForce RTX 5070
Laptop GPU, D3D11, 2561×1601 fullscreen: **PASS**, 6 passed, 1 skipped (the frame-rate sweep, as
always). Frame rate (1% low): Chemistry 89–110 (24–66), Biology 82–85 (17–26, the workspace
opening), hub with the city 97 (41), Physics lane 83–98 (38–68), pendulum bay 109–112 (43–70), run
history 88 (37–66). The same range as §5's run (laptop in its slower state); the steady frame
rate was not the target and is not claimed better. Long frames left in this run: Chemistry's
first seconds (69.7 ms; the reflection prefilter's two programs linked in a 38.7 ms frame), the
Biology workspace opening (108.9 ms, the 2D panel).

### Tests

- `npm run check`: **PASS** — 244 files, 3545 tests (`detail.test.ts`: the rounded box equals
  three's, detail built over frames and dropped; `residency.test.ts`: an attach spawned in slices,
  a load meanwhile stops it).
- `npx playwright test --workers=1` (SwiftShader): 119 passed, **3 failed**, 4 did not run:
  - `draw-calls.spec.ts` physics-lab lab-ceiling and bay-wall under Low: the shader count fell
    40 → 0 between the two readings. The load's hidden parts now finish compiling a second or two
    after the scene shows (the wait above), freeing their shaders. The test now takes its baseline
    once the counts hold for 10 frames (a leak still never settles and fails).
  - `titration-physical.spec.ts`: the NaOH pour never started (burette 0 µL after 40 s).
  - Re-run, `npx playwright test --workers=1 e2e/draw-calls.spec.ts e2e/titration-physical.spec.ts
-g "low|titration by hand"`: **PASS**, 5. The titration passed unchanged: **flaky**, not PASS
    (its pour is started by a held key after aiming; not investigated further).

### Not done, limitations

- Not felt on Phú's display; the probe ran the dev build, the bench the production one.
- Still long: the first frames in a lab (2048 px canvas textures uploaded at first draw) and one
  frame of 114–131 ms after the room's reflection is applied (a program fetched and the GPU's
  present). The reflection prefilter's programs could be compiled at start.
- Spawning in slices makes an attached scene ready a few frames later; the door waits for it, as
  before.
