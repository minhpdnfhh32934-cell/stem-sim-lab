# Phase Max — report

Phú (2026-11-18): raise the detail to the most the game can draw, as real as it can be, from the
people to the objects and what happens in the labs; then "make another graphics level, Max, and
work on that". Ultra stays as it is. Every upgrade below is on Max only.

**Renamed the same day (Phú, 2026-11-18): this report's "Max" is now Ultra.** Four levels: Low;
Medium (the former High); High (the former Ultra, Phase G); Ultra (the former Max). The former
Medium is gone. See "The levels renamed" below.

## Decisions (Phú, 2026-11-18)

| Question   | Answer                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| The people | Keep the game's style, at the most detail (not photoreal people)             |
| Order      | 1 light and shadow → 2 people → 3 objects, glass, liquids → 4 phenomena      |
| Downloads  | CC0 (Poly Haven, ambientCG) allowed, asked each time with name, source, size |
| Frame rate | At least 60 fps on the RTX 5070 Laptop at Max                                |
| Also       | Performance as optimised as it can be; real, not a generic "AI" look         |

Later the same day Phú changed two of these: the people are real (semi-realistic) at this level
(§5), and downloads for it no longer need asking one by one ("gì cần tải thì cứ tải": reputable
sources with a game-usable licence, each recorded with its source, size and licence).

## Max, the level

- `max` in `GRAPHICS_QUALITIES` (persistence/settings.ts), with `ultraOrMore()` for what Ultra has
  and Max keeps. `QUALITY.max` starts from Ultra's config.
- Settings › Graphics: a fifth choice, Max. It takes Ultra's dialog with its own words (title,
  intro, button, the warning's title, "Max on this computer"), in English and Vietnamese. Never
  chosen by default; the frame-rate watch steps down from Max to Ultra.
- The level tables give Max a little more: fire particles (360 flames, 60 smoke, 34 sparks), the
  breach's dust, sparks and debris ring, the firemen's water, the periodic board's texels.

## The levels renamed (2026-11-18)

Phú: "dời cái ultra xuống high, cái max hiện tại đổi tên thành ultra, medium bỏ đi"; asked what
becomes of the former High, he chose four levels with it as Medium (an integrated GPU keeps a level
between Low and the former Ultra).

| Now    | Was              | Notes                                                          |
| ------ | ---------------- | -------------------------------------------------------------- |
| Low    | Low              | unchanged                                                      |
| Medium | High             | the default (a GPU); integrated GPUs still start at Low        |
| High   | Ultra (Phase G)  | asks first (the dialog), as Ultra did                          |
| Ultra  | Max (this phase) | asks first, its own intro                                      |
| —      | Medium           | gone; a player who had it stored gets Medium (the former High) |

- `GRAPHICS_QUALITIES = ['low', 'medium', 'high', 'ultra']`, `highOrMore()` (was `ultraOrMore`),
  `QUALITY` re-keyed, every per-level table (fire, breach, water, periodic board) re-keyed, the
  frame-rate watch steps Ultra → High → Medium → Low.
- Stored under a new key, `simlab.settings.graphics`. The old key (`simlab.settings.graphicsQuality`)
  is read once when the new one is missing and renamed: low → low, medium → medium, high → medium,
  ultra → high, max → ultra (test). Benches' `BENCH_GRAPHICS` take the new names.
- Settings: four choices; one dialog for High and Ultra, its words by level (`{level}`: "Turn on
  High graphics?", "Bật đồ họa Cao?"), Ultra with its own intro. Hints rewritten for the new
  Medium, High and Ultra, English and Vietnamese.
- The live menu background draws at full size wherever it shows (the former Medium's 70 % went
  with it).
- Comments and documents written before the rename (224 "Ultra" in src alone) name the levels as
  they were; quality.ts says so above `QUALITY`. A sweep is a separate task.
- e2e: settings.spec rewritten for the four levels (High asks too; the city from Medium up); the
  pendulum-bay test that compared the former Medium with the former High is skipped (its reference
  level is gone); the others moved to the new key and names.

## 1. Light and shadow

- **The room's grade under WebGL** (post.ts): white balance, saturation and contrast by room and
  daylight, eased across a door — Ultra on WebGPU's look (postLook.ts). A pass only while the
  grade differs from neutral: a neutral lab draws none.
- **Smoother, wider shadow edges** (shadowTaps.ts): three's PCF takes five taps; a radius over 5
  now takes twelve. Max's radius is 6. Every other level keeps its five taps, drawing as before.
  The rewrite throws if a three.js upgrade changes the code it replaces (test).
- **Ambient occlusion with more samples**: 24 a pixel (3 directions × 8 steps) and its denoise.
- Not done: real PCSS (three's PCF reads its shadow map through a comparison sampler, which cannot
  give the blockers' depth a penumbra needs).

## 2. People

- **Hair and clothes follow the body** (render/body/motion.ts): the air a person walks through
  pushes their loose hair and clothes back, lagging a start and settling after a stop; standing,
  they barely stir. The wallpaper's `windOffset` (now shared: `wallpaper/look.ts` exports it and
  `markWind`), without its anime rim or ink. Every person: the world's people, other players, the
  rescue squads and the character page. A shader change only; made the first time Max is on.
- **Cloth on their clothes** (same patch): a fine weave on shirts, jackets and coats, a denim twill
  on blue trousers, as brightness only (the clothes keep their colour and the game's toon light),
  mapped on the body's bind pose so the weave moves with the cloth. One shared texture.

## Downloads (Phú's word, each)

Five ambientCG packs (CC0, 2K JPG), 2026-11-18: SurfaceImperfections003 (18.9 MB),
Fingerprints002 (17.5 MB), Scratches002 (13.4 MB), Fabric082A (26.5 MB), Fabric077 (33.3 MB).
Only five maps were kept, brought to 1024² and packed into two images' channels:
`public/max/textures/wear.png` (smudges, fingerprints, scratches) and `fabric.png` (weave, denim),
4.7 MB in all; sources in that folder's README.

## 3. Objects, glass

- **Wear on the real surfaces** (surfaces.ts): smudges at a broad scale, fingerprints in clusters
  where the smudges are (where hands go), fine scratches. They dull a glossy surface where they
  are (its roughness up) and leave a matt one alone; a scratch lightens a little. Each surface
  has its own amount (`wear`: steel, glossy plastic 1; floors 0.4–0.7; walls 0.15). Max only: the
  surfaces compile again when Max is chosen or left.
- **Fingerprints on glassware** (finishes.ts): the glass's shared reflection pass is rougher where
  prints are, so a hand's mark dulls and blurs the reflection. The glass's colour, its scales and
  what is in it are untouched.
- **Glass that bends what is behind it** (effectsPass.ts, `effects`): glassware is left out of the
  world pass and drawn again right after the ambient occlusion, from the world pass's picture
  looked up a little off where the glass leans away from the eye (up to 1.4 % of the picture,
  edge-on). Thin-walled glassware bends the view at its sides and hardly through its middle, so a
  liquid's level and a burette's scale stay where they are; liquids are in the picture it reads,
  so they bend with the rest. Its filter tint and darker edge (finishes.ts) stay, and its
  reflection pass stays in the world pass. It never bends in what stands in front of the glass
  (the opaque depth is checked at the bent point). Only glassware in view is drawn again; with
  none in view the pass does nothing for glass.

## 4. Phenomena

- **A fire's smoke** (fireView.ts): billows (a ragged edge, curls turning inside) instead of soft
  discs, lit warm and sooty by the flames under it as it leaves them, greying as it rises and
  thins. Its own pool: the circuit bench's smoke keeps the plain one.
- **Soft particles** (same pass; particles.ts `softParticles`): smoke, flames, sparks, dust and
  steam fade over the last half of their size before a surface instead of cutting it with a hard
  line, and are hidden behind what is solid. They read the depth the AO pass already draws (no
  extra scene pass), are drawn at half the resolution into their own picture (premultiplied: smoke
  laid over, flames added) and laid over the frame once. Every pool is soft from the moment Max is
  on, so the shader warm-up compiles the programs that are drawn (no hitch at the first fire).

## 5. Real people

Phú (2026-11-18): "Nhất là con người nha, phải nhìn như thật, không phải khối khối như AI nữa".
Asked, he chose real people (semi-realistic humans) at this level only, instead of the anime
bodies' style (which reverses "keep the game's style" above, for the people). Then (the same night)
"làm liên tục đến khi xong hết tất cả ở phần ultra": every person of the game, and what they wear.

- **Seventeen people** from Microsoft Rocketbox (MIT): the eight characters, the teacher, the four
  firefighters and the four police officers. `realBody` in `characters.json`, `npcs.json` and
  `responders.json` names each one's person; `QualityConfig.realPeople` (Ultra). Converted by
  scratch tools (FBX → GLB with 5 of 175 face shapes; TGA → WebP): `public/max/people/`, 89 MB
  for the seventeen (1.7 GB downloaded), their sources, sizes and the licence in its README. A
  person's files are fetched the first time they are drawn at Ultra.
- `body/realBody.ts`: the drawn skeleton still moves the body; the real one follows it each frame
  (its limbs first brought to the drawn rest, then turned as the drawn bones turn; hands and feet
  put where the drawn ones are by two-bone IK; the pelvis lowered while standing; the third finger
  joint carried on from the second), blinking. One skeleton shared by a person's meshes (the
  library splits a person by material). Everyone drawn: the world's people, other players, the
  rescue squads, the character page and its custom preview, the player's own body (its head and
  face on the self layer, the whole body cast from the shadow layer).
- **What they wear** (`body/realWear.ts`), from the drawn body's worn set, so the cleanroom's steps
  show on a real person as on a drawn one:
  - the lab coat: a shell 1.5 cm out from the person's clothes over the chest, back and arms
    (their triangles, closed, skinned to the same bones), and a skirt from the hips to above the
    knees (6 rows × 40 columns, open at the front) hung from eight bones that the drawn coat's cloth
    swings; seated, the skirt draws up (the thighs' angle) instead of spreading like a sheet;
  - goggles and a face shield on the head bone, placed by the eyes, sized by the eyes' distance;
  - gloves: the hands' share of each vertex's skin weights tints them the gloves' colour (a mask in
    the shader, no extra mesh);
  - the squads' own drawn gear (helmets, vests, the hose, the extinguisher) is hidden while they are
    real: the library's firefighters and police come dressed.
- **The gold outline** of a called person (an inverted hull on the real meshes, its width by the
  person's own scale) and the character page's choice glow.
- **No hitch when one comes**: a person's textures are uploaded one a frame and its programs
  compiled (`compileOnly`, in batches) before it is shown; until then the drawn body stays.
- Measured (bench, Ultra, the same command, back to back): biology room idle CPU 3.87 ms with Khoa
  real, 3.67 without (+0.2 ms); "at the microscope" right after a load 416.8 fps with the prepare
  against 421.7 without real people (183 fps before the prepare: the person loading while measured).
- Seen on the GPU (headless Edge, ANGLE D3D11, RTX 5070 Laptop): all eight characters on the
  character page, Khoa's glow; the coats seated at benches; the player in the preparation room's
  mirror with the whole kit (coat to the knees, blue gloves, goggles, shield); the police (113) and
  the fire brigade (114) coming down from the hub's ceiling, and the brigade hosing a fire; no
  console errors.

## 6. Liquids

- **The meniscus and ripples in the surface's reflection** (ContainerView.ts, `liquids`): the
  reflection pass on a liquid's level (its `sheen`) bends its normal where the surface curves up
  the last share of the radius to the glass, and in rings travelling out from where it was stirred.
  A define on that pass (`LIQUID_DETAIL`); other levels draw as before.
- **Ripples seen through the surface** (effectsPass.ts): measured on the GPU, the reflection alone
  changed the surface's pixels by 0.13 of 255 on average (the room's reflection on water is a few
  per cent: nothing to see). So a stirred surface is drawn again in the see-through pass: what is
  under it (the bottom, its print, the tile) looked up a little off by the rings' slope, and lighter
  and darker where the rings gather and spread the light (the bright rings real ripples throw on the
  bottom). Into the world pass's picture as well as the frame, so the glass in front bends the
  rippled view. Two trains of rings (one regular train read as a target), the same rings in both
  passes (`ripples.ts`). Only a surface still stirred is drawn: two draws each, nothing when still.
- Stirred by a stream reaching it (the burette's tap, a pour; the rings from the stream's foot) or
  by more liquid coming in (a delivery, drops); settling over about a second, no longer drawn after
  about 5 s. Drawn only: the level, the volume and the colour stay the model's.
- Seen on the GPU (headless Edge, RTX 5070 Laptop; 2560×1600 screenshots at device scale 2, drawn
  at 1280×800 — see Measured): the titration by hand at Ultra, the flask under the running tap —
  faint rings round the stream's foot; settled 3 s after the tap is closed. A probe at three times the strength showed the rings clearly (the pass draws);
  the strength kept is the faint one.

## 7. Steam

- **The hot plate's steam** (heating-curve bench): its puffs were pale balls with hard edges at
  every level. On Ultra (`effects`, finishes.ts: the puffs' material is named `steam`) each is drawn
  out upward, thins towards its rim and is torn by noise in the puff's own space, its pattern
  turning as it rises; its colour and opacity stay. Other levels unchanged.
- **The steam off a fire the brigade hoses** (EmergencyView): on Ultra, billows (the `puff` look,
  white to light grey, soft where they meet a surface) instead of round discs.
- Seen on the GPU (the same set-up as the liquids' stills): the beaker boiling at t = 49.6 s, High
  against Ultra; the brigade hosing a burning bench in the hub, High against Ultra; no console
  errors.

## 8. Glass kept thin things in it

Found with the steam stills: at Ultra the thermometer's red column disappeared. The glass pass looks
up what is behind the glass a little off where the glass leans away (up to 1.4 % of the picture):
across a thin tube that lands on the room far behind, so the column was replaced by the wall. Now
the bent point is used only when its depth is within 3 cm + 15 % of the depth straight behind;
across an edge the glass shows what is straight behind it. The column shows again; beakers and
flasks still bend at their sides.

## 9. Tried and left out

- **4096² scans of the floors' and walls' relief** (2026-11-19). The floors and walls get about 850
  texels a metre from their 2048² scans, against about 1700 on the props: the 4K packs of Tiles043,
  Concrete048, WoodFloor051 and PaintedPlaster017 were downloaded from ambientCG (CC0; 298 MB, twice: the comparison was redone) and
  their normal maps (85 MB, kept as they came: a normal map's directions are in its colour channels,
  and Windows' JPEG encoder halves those) swapped in at Ultra with no program compiled again.
  Measured with the game drawing 2560×1600 (headless, a 2560×1600 viewport at pixel ratio 1), the
  chemistry lab's floor, High (2048²) against Ultra (4096²): 0.81 of 255 average difference at the
  feet, 0.14 three metres on (a first comparison under the browser's 2× emulation drew 1280×800
  and was redone). The labs' soft light shows no finer relief, and the floor's speckle is the room's
  own map. For about 450 MB more video memory, removed: code and files gone.
- **Light bouncing.** Each room's own light already comes back off its walls and floor at High and
  Ultra: the room is captured from its middle once a visit and every lit surface takes its diffuse
  light and reflections from that capture. A screen-space bounce pass (light from what is next to
  a surface, not from the room's middle) was not built: its cost at 2560×1600 against a change the
  evenly bright labs would hardly show; it would need Phú's look first.

## Measured

Labs bench, `BENCH_GRAPHICS=max BENCH_UNCAPPED=1 npx playwright test -c
playwright.bench.config.ts --project=gpu-headless e2e/labs.bench.ts`. Production build, headless
Edge on the real GPU (ANGLE D3D11, NVIDIA GeForce RTX 5070 Laptop GPU), 1280×720, vsync off.

| Place                        | Max = Ultra (before) | Max with light and shadow |
| ---------------------------- | -------------------- | ------------------------- |
| Chemistry, idle              | 352 fps, GPU 1.47 ms | 344 fps, GPU 1.97 ms      |
| Chemistry, titration flowing | 106 fps, GPU 5.27 ms | 130 fps, GPU 4.80 ms      |
| Biology, room idle           | 289 fps, GPU 1.64 ms | 277 fps, GPU 2.45 ms      |
| Hub, idle                    | 319 fps, GPU 2.37 ms | 317 fps, GPU 2.83 ms      |

Light and shadow cost 0.3–0.8 ms of GPU a frame at 720p; frames stay CPU-bound. At the laptop's
2560×1600 (4.4× the pixels) that is about 1.5–3.5 ms more: not measured yet (a fullscreen bench
takes over the screen). The people's motion was not in these runs.

Everything on Max so far (light and shadow, motion, cloth, wear, prints, soot, glass, soft
particles), same command, 2026-11-18 evening — all four places PASS, no context lost:

| Place                        | Max, all of it                      |
| ---------------------------- | ----------------------------------- |
| Chemistry, idle              | 297.5 fps, CPU 3.23 ms, GPU 2.17 ms |
| Chemistry, titration flowing | 128.7 fps, CPU 6.95 ms, GPU 4.91 ms |
| Biology, room idle           | 242.0 fps, CPU 4.01 ms, GPU 2.70 ms |
| Hub, idle                    | 309.4 fps, CPU 3.10 ms, GPU 3.05 ms |

The see-through pass alone (chemistry, the same command with `-g chemistry`, run twice in a row:
Max with `effects` and Max without; glass culled to the view in both):

| Chemistry                   | Max without the pass          | Max with it                   |
| --------------------------- | ----------------------------- | ----------------------------- |
| Idle, bench + cabinet       | 286.7 fps, CPU 3.37, GPU 2.14 | 294.6 fps, CPU 3.27, GPU 2.15 |
| Titration bench (glassware) | 179.1 fps, CPU 5.42, GPU 2.94 | 171.2 fps, CPU 5.68, GPU 2.96 |
| Titration flowing           | 144.9 fps, CPU 6.14, GPU 4.81 | 132.0 fps, CPU 6.76, GPU 4.80 |

It costs up to 0.6 ms of CPU where glassware and flowing drops are in view (one draw call per
glass in view, one per particle pool), nothing measurable on the GPU at 720p (half-resolution
particles). Idle differences of ±0.1 ms are run-to-run noise.

### Ultra, everything (2026-11-19)

The same labs bench at Ultra with all of the above (real people, their coats, liquids, steam, the
glass fix), `BENCH_GRAPHICS=ultra BENCH_UNCAPPED=1 npx playwright test -c playwright.bench.config.ts
--project=gpu-headless e2e/labs.bench.ts`, production build, headless Edge, ANGLE D3D11, NVIDIA
GeForce RTX 5070 Laptop GPU, 1280×720 — 4 passed, no context lost:

| Place                        | Before (2026-11-18 evening)         | Now                                 |
| ---------------------------- | ----------------------------------- | ----------------------------------- |
| Chemistry, idle              | 297.5 fps, CPU 3.23 ms, GPU 2.17 ms | 349.4 fps, CPU 2.74 ms, GPU 2.11 ms |
| Chemistry, titration flowing | 128.7 fps, CPU 6.95 ms, GPU 4.91 ms | 147.1 fps, CPU 6.02 ms, GPU 4.17 ms |
| Biology, room idle           | 242.0 fps, CPU 4.01 ms, GPU 2.70 ms | 270.1 fps, CPU 3.59 ms, GPU 2.66 ms |
| Hub, idle                    | 309.4 fps, CPU 3.10 ms, GPU 3.05 ms | 321.3 fps, CPU 3.00 ms, GPU 2.95 ms |

Differences of this size between evenings are the machine, not the work: nothing here was made
cheaper. The titration's rows have the ripples drawn (the flask stirred by the tap).

**At 2560×1600** (the laptop's panel), headless with a 2560×1600 viewport at pixel ratio 1 (a
scratch config: `gpu-headless` with that viewport; the drawing buffer reads 2560×1600), Ultra
against High, the same command with `BENCH_GRAPHICS=ultra` / `high`, back to back:

| Place                        | High: fps, GPU | Ultra: fps, GPU |
| ---------------------------- | -------------- | --------------- |
| Chemistry, idle              | 152.2, 6.53 ms | 112.5, 9.35 ms  |
| Chemistry, titration flowing | 123.8, 7.94 ms | 93.5, 10.77 ms  |
| Biology, room idle           | 142.6, 6.94 ms | 108.0, 9.14 ms  |
| Biology, at the microscope   | 114.2, 8.68 ms | 102.6, 11.17 ms |
| Hub, idle                    | 153.0, 6.41 ms | 115.3, 8.53 ms  |

Ultra costs 2–3 ms of GPU a frame more than High at 2560×1600; its slowest place (11.2 ms) still
leaves room for about 90 fps. The 1 % lows at this size are poor at both levels (High 2–42 fps,
Ultra 1–36): the same spikes at High, so the headless browser's own handling of a 2560×1600 frame,
not Ultra's work — to be measured again in a real window (`gpu-fullscreen`), which takes over the
screen and was not run overnight. The biology microscope's long frames (70–1400 ms, scripts) were
there before the real people too (the run with them off: 143 and 153 ms).

A first try at 2560×1600 emulated the panel's pixel ratio (1280×800 CSS px at 2×): the game then
drew 1280×800 and the browser scaled it up (the size the page is told under emulation). Those
numbers and the 2× stills of §6 are at 1280×800 drawn, not 2560×1600.

## Checks

- `npx tsc --noEmit -p .`: PASS
- `npm run lint`: PASS
- `npx prettier --check .`: PASS
- `npx vitest run --maxWorkers=6`: PASS after fixing a test's fake game (`npcActors.test.ts`), with
  new tests `shadowTaps.test.ts` and `body/motion.test.ts`.
- Stills at Max (headless Edge, RTX 5070): the preparation room and the hub draw, no shader
  errors.
- Glass and soft particles: `effectsPass.test.ts` (pools soft and premultiplied while the pass
  lives, flames added and smoke laid over, a pool made meanwhile starts soft, `hide` hides glass
  and particles, `dispose` gives every pool and the glass back as before). Stills at Max and Ultra
  (headless Edge, ANGLE D3D11, RTX 5070, 1600×900): the titration stand's burette and flask, a
  circuit fire's smoke. The first Max run found two real faults, fixed: a GLSL reserved word as a
  variable name (`filter`: the glass program did not link) and a depth-only quad without a colour
  output (WebGL "missing fragment shader outputs"). After the fix: no WebGL errors at Max.
- `npx vitest run --maxWorkers=6`: 343 files, 4227 tests PASS (with the pass wired in).

### Checks, 2026-11-19 (everything above)

- `npx tsc --noEmit -p .`: PASS
- `npm run lint`: PASS
- `npx prettier --check .`: PASS
- `npx vitest run --maxWorkers=6`: 345 files, 4234 tests PASS. New: the real people's coat, goggles,
  shield, gloves and seated skirt, the files every content's `realBody` names (realBody.test.ts);
  the liquid surface and its stirring (ContainerView.test.ts); the steam's finish
  (finishes.test.ts).
- e2e on SwiftShader, one at a time:
  `SIMLAB_DEV_ONLY=1 npx playwright test e2e/titration-physical.spec.ts e2e/heating-curve.spec.ts
e2e/circuit-fire.spec.ts e2e/emergency.spec.ts e2e/settings.spec.ts e2e/mirror.spec.ts
e2e/shadows.spec.ts e2e/menu.spec.ts e2e/intro.spec.ts --workers=1`: 17 PASS, 1 skipped (the
  pendulum bay, its level gone), **1 FAIL: titration-physical** — the burette stays at 0 µL when the
  NaOH is poured into its mouth (the bottle still full); again alone twice: FAIL, FAIL. Not caused
  here: no gameplay file has changed since the last commit, and Phase Y recorded the same failure
  (2 of 3, "not yet understood"). On the GPU the same steps (a scratch copy at a chosen level) failed
  once at Low and passed once, and passed 4 of 5 at Ultra.
- **The titration spec's failure found and fixed (the spec, not the game).** A scratch copy with
  the debug panel and stills at each stage: the bottle tipped beside the burette, the HUD saying
  "Hold it over a vessel to pour.", the pour assist not reaching. The spec stops its taps when the
  feet are 0.4–0.65 m from the mouth; it stopped at 0.637 m, where the mouth (0.6 m up) is 1.206 m
  from the eye (1.63 m), past `POUR_REACH` (1.2 m), so the hand never reaches for it. Beyond about
  0.62 m it never pours: where the taps happen to stop decided it, which is why it failed on some
  runs and machines and passed on others since Phase H (the window and the reach came in the same
  commit, 370c365). Now the far end is worked out from `POUR_REACH` and `EYE_HEIGHT` with 3 cm
  spare (about 0.56 m). `SIMLAB_DEV_ONLY=1 npx playwright test e2e/titration-physical.spec.ts
--workers=1 --repeat-each=3`: 3/3 PASS (SwiftShader; 0/3 before the fix); `npx tsc --noEmit -p .`,
  ESLint and Prettier on the spec: PASS.
- On the GPU (headless Edge, ANGLE D3D11, RTX 5070 Laptop), scratch specs built from the e2e specs:
  the titration by hand at Ultra to its endpoint (the endpoint check passes) with stills of the
  ripples; the heating curve boiling, High and Ultra; the fire brigade hosing a burning bench, High
  and Ultra; the floor and the 4K reliefs at 2560×1600; no console errors in any.
- Benches: "Ultra, everything" above.

## Known limitations

- **This round (2026-11-19):**
  - Not yet seen on Phú's 300 Hz display or in the desktop app (everything at Ultra).
  - Custom characters keep the drawn body at Ultra (no real person is made from the customiser's
    choices; their face photo is on the drawn head only).
  - Ripples are drawn on the physical lab's glassware (ContainerView); a bench rig's own liquid (the
    hot plate's beaker) has none. Mirrors show neither ripples nor steam's wisps (the see-through
    pass, as for glass).
  - The opt-in WebGPU renderer draws no ripples and no wisps; real people were not checked there.
  - Light bouncing is the room's one capture from its middle (§9).
  - The frame rate at 2560×1600 in a real window is not measured (headless only, §Measured).
  - Once, right after loading the hub at Ultra with a fire burning, the phone's key presses were
    missed (the same steps worked after waiting 4 s): not measured or explained.

- Not yet seen on Phú's 300 Hz display or in the desktop app.
- The motion is a sway driven by walking speed, not cloth simulation: no collisions, turning does
  not swing the hair.
- The grade shows in rooms with a grade (the hub); the labs are neutral and look the same.
- Glass refraction is screen-space: it bends what the picture already shows (nothing from outside
  the screen or hidden behind another object), from the picture before the AO is added, and the
  reflection drawn on the glass bends with it near the edges. Glass behind glass shows only the
  nearer one bending. Particles are laid over glass (smoke behind a beaker is not seen through it).
- Under Max, mirrors show no glassware and no particles (both are left out of the world pass,
  where mirrors draw). Glassware hidden in the world pass casts no shadow there; the containers'
  glass had `castShadow` off already, other glassware was not checked one by one.
- Half-resolution particles can leave a one-pixel fringe where smoke passes behind the edge of
  something solid.
- An intermittent WebGL warning at Ultra ("Mismatch between texture format and sampler type") was
  seen in 3 of 9 headless runs early on, then 0 of 2 with and 0 of 2 without the shadow-tap
  rewrite: cause not found, not seen at Max.

## The squads on foot (2026-11-19)

Phú: the police and firefighters must step as far as they go (they slid along the floor following
a moving player) and doors must open for them (never through a shut one). All levels.

- **Causes.** `EmergencySystem` never stepped their legs (the stride stayed 0 while they moved) and
  drew the ordered pace (3.1 m/s) whatever they really went at; it never let a walker finish a card
  tap or a doorway (`Walker.go` was not called, so `to()` started the crossing again each frame);
  and a walker whose own scene was not drawn was put on the far side of the door at once — from a
  lab, a squad coming from the hall appeared in front of the shut door. A door still loading the
  scene behind it (`preparing`) was walked through after 4 s.
- **Legs** (`EmergencySystem.legs`): the swing goes on by the ground each one really covered, at the
  step length the body draws for that pace (`stepLength`/`runShare` in `gait.ts`, now shared with
  `Actor`); the drawn pace is the real one, eased, none at once where their job stops them. A
  caller who walks while told off is followed at talking distance, at their pace (no run in and
  stop).
- **Doors** (`walker.ts`, shared with the world's people): what is under way is finished first; a
  door loading its far scene is waited for; with `opensUnseen` (the squads only) a walk from a scene
  not drawn into one that is goes to the door and asks it open by the drawn side's leaf (the door
  brings their side in first), then through; a squad waits in a line at a door (0.8 m apart) and
  goes through one behind another (0.35 s); a doorway being crossed keeps its door open
  (`DoorPassing`, new event; `DoorSystem` reopens it if it was closing). The teacher still appears
  behind a shut door when coming from a scene not drawn (left as it was: not asked).
- Checks:
  - `npx tsc --noEmit -p .`, `npm run lint`, `npx prettier --check .`: PASS.
  - `npx vitest run --maxWorkers=6`: 4235 PASS, 1 FAIL — `circuit/consequences.test.ts` 114 test,
    which never let the hall load (now the door must open); fixed with `await flush()` in its
    loop, then that file 8/8 PASS. New tests (EmergencySystem.test.ts): legs (no frame moved
    without a step, still legs when standing, 0.75–1.35 m a step, walking beside a 1 m/s caller at
    0.8–1.3 m/s); 114 with a fire in a lab and the hall not drawn (asked by the lab's leaf, each
    comes in with the door open, never closing while they pass, the leader first, ≥ 0.25 s apart).
    NpcSystem.test.ts: the walk back to the hall flushes so the door can open.
  - e2e SwiftShader: `SIMLAB_DEV_ONLY=1 npx playwright test e2e/emergency.spec.ts
e2e/circuit-fire.spec.ts --workers=1`: 4/4 PASS (with warmup).
  - GPU (headless Edge, ANGLE D3D11, RTX 5070 Laptop; Ultra; 1600×900 at pixel ratio 1; a scratch
    spec): the brigade into the chemistry lab from the hall — Doors line preparing → opening →
    open → closing after; stills show them coming through the open door one after another, mid-
    stride; ~129 fps; no console errors. The still burst of the police beside a walking caller
    missed them (the view faced away): their walk is checked by the unit test only.
- **Then (Phú: "tiếp tục sửa"):**
  - The teacher too: from a scene not drawn into one that is he comes through the door, opened
    for him (the squads-only option removed: one rule for every walker). NpcSystem.test.ts and
    cues.test.ts: his walks let the hall load (`await flush()`), the player stands in the lab away
    from the door (at the lab's spawn, 0.95 m from it, the player kept it open).
  - The squads' footsteps (`NpcFootstep`, heard as the world's people are): one as each foot comes
    down in the swing their legs draw, none slower than 0.35 m/s; checked: about one a step.
  - A sound bug found by the teacher's test: the door cues kept a door's state by whichever leaf
    was in the world, so a scene behind it coming and going lost the card's beep; now by the pair.
  - The debug panel's Fire line names the leader's scene, place and pace (a test can look at him).
  - GPU (as above, Ultra): the police leader stepping after a caller who backs away, at 1.69 m/s,
    mid-stride, then standing with his feet together; 139 fps; no console errors.
  - `npm run check`: PASS (345 files, 4236 tests; a run right after `npm install` timed out once in
    `EnzymeActivityStation.test.ts`, 1.5 s alone, PASS again in the next full run).
  - Not resolved: `e2e/emergency.spec.ts` 113 failed once after these changes (the caption stayed
    on the scold line, never the warning), having passed before; the rerun was stopped when Phú
    paused the work. On the GPU the same call reached the warning.

## The promo video on the main menu (2026-11-19)

Phú: a small button on the home page to watch the promo; the 3-minute one, not the 1-minute.

- The finished 3-minute file was no longer on the disk (only the 1-minute). Made again, exactly as
  its build makes it, from what was kept: the 63 cut segments in `promo/nguon-capcut-3phut`
  (checked against the cut list of `make-edit3.mjs`, in order, by name), the titles drawn again
  frame by frame (`render-overlay.mjs`, 10 920 frames), the music `music4.mjs` (the same file, byte
  for byte, as the one kept with the segments): `promo/SimLab3D-QuangCao-3phut-1080p60.mp4`, 182 s,
  1080p60, 237 MB (untracked, as before).
- The game's copy: `public/video/simlab3d-gioi-thieu.mp4`, 59 MB (H.264 CRF 24, 1080p60, AAC 160
  kb/s, faststart), SSIM 0.989 against the master. Fetched only when it is played.
- `PromoVideo.ts`: a small button under the menu's subtitle ("▶ Watch the trailer" / "▶ Xem video
  giới thiệu") opens the browser's player in a dialog; it starts at once, Esc / Close / the backdrop
  close it and stop it where it was, the focus back on the button; the menu's opening and live
  background sounds are quiet while it is open; its volume follows the master volume and mute.
- Checks: `npm run check` PASS (above). `SIMLAB_DEV_ONLY=1 npx playwright test e2e/menu.spec.ts
--workers=1 --repeat-each=2`: 9/9 PASS, the new test among them (nothing fetched before the click,
  it plays past 1 s, 182 s long, Esc stops it, focus back). GPU stills (headless Edge, ANGLE D3D11,
  RTX 5070 Laptop): the button under the name, the player at 12 s with its caption, Vietnamese and
  English.
- The app is 59 MB bigger (the video); `node_modules` was deleted on Phú's word and installed again
  (`npm install`) for this work.

## Next

- Phú's look at the squads walking and at doors (any level), with the Ultra look below.
- Phú's look at Ultra on the 300 Hz display: the real people (characters, teacher, squads, the
  player in a mirror), coats and protective gear, ripples in the titration flask, steam over the
  hot plate and off a hosed fire, the thermometer behind glass. Committed only on his word.
- The frame rate at 2560×1600 in a real window (`--project=gpu-fullscreen`, takes over the screen).
- A sweep of comments and documents written before the levels were renamed.

Nothing is committed.
