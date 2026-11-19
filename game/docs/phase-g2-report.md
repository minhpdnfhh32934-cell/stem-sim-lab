# Phase G2 report — Ultra, the next level

Contract: `docs/phase-g2-ultra-next-contract.md` (accepted 2026-11-14: D1 a WebGPU, D2 a 60 fps with
temporal upscaling, D3 a realistic CC0 people, D4 a G2-1 to G2-5 in order).

## G2-1: Ultra on WebGPU (in progress, 2026-11-14/15)

**Opt-in until Phú accepts its parity:** Ultra draws with WebGPU only where the browser preference
`simlab.dev.ultraRenderer` is `webgpu` (quality.ts `webgpu`, `WorldRenderer.wantsGpu`). Without it
every preset, Ultra included, draws exactly as before on WebGL.

What is there:

- **The device, changed in place** (`WorldRenderer.syncDevice`, `toGpu`, `toWebgl`): choosing Ultra
  starts three's `WebGPURenderer` (`render/gpu/GpuDevice.ts`, a chunk of its own) on a fresh canvas
  put where the old one was (a canvas keeps its first kind of context); the scene, its views and
  the game are untouched, the WebGL device's targets and context freed. Leaving Ultra goes back the
  same way. WebGPU only: where three would fall back to WebGL 2 under the same name it is refused,
  warned of, and Ultra stays on WebGL that session. The first world load waits for the device.
- **Post-processing** (`gpu/pipeline.ts`, same look values as WebGL's, `postLook.ts`): GTAO from the
  frame's depth (normals rebuilt from it), denoised, bloom, tone mapping and sRGB, SMAA. Two other
  layouts were measured and dropped: a pass of the opaque scene for the occlusion (24.4 ms a frame
  against 11.6), and normals written beside the colour (a see-through puff's whole square shaded the
  occlusion, and pipelines made ahead were built for one output and drawn into two).
- **The materials' own shaders** (WebGPU has no GLSL): each module that patches a material for WebGL
  names the same look in `nodeLooks.ts`; `gpu/looks.ts` builds it from nodes as three converts the
  material for drawing (glass edge, the liquids' filter and rim, the outline shells, the bodies'
  cloth and outline, the city's lit windows, the photographed surfaces laid in world space). The
  ShaderMaterials get a node material of the same look (the water's column and splash, the lens
  image). Particle pools (fire, smoke, dust, sparks) are drawn as instanced sprites
  (`gpu/particles.ts`): WebGPU points are one pixel. As WebGL draws points, none whose centre is
  behind the near plane and none wider than 1024 px.
- **Outlines** without a stencil (three cannot read a depth that has one): the mask writes depth
  and the shells draw their far side only (`Outlines.useStencil`).
- **The city under the hub's glass**: its own pass, the world's background node; the glass lies over
  it as under WebGL.
- **Pipelines made ahead** (`GpuDevice.compile`, in the background, for the frame's target): what a
  load shows and hides, a neighbour scene's parts, a waking room, the water, the squad and the
  breach; hidden objects and those out of view too; again when Ultra's surfaces are laid on.
- **Every pipeline made in the background** (`GpuDevice.inBackground`, 2026-11-15). A Chrome trace
  of the app showed where WebGPU's load stalls came from: three makes a pipeline a draw needs
  synchronously, and Chrome compiles those (WGSL → HLSL → DXC) on its GPU thread, every frame
  waiting behind them — ~130 at a world's first frames, batches of 0.3–0.9 s, frames of up to 4 s.
  Made with `createRenderPipelineAsync` they compile on Chrome's worker threads and no frame waits;
  what one is not ready for is not drawn until it is (three's own `isReady`), a moment later, the
  first time only. The shadow maps are drawn again once all are made (the shadow cache would keep
  a map drawn without them), and a room's capture waits while any is being made (a face missing
  something would stay so). FXC instead of DXC was tried: a 12 s frame.
- **Built where the frame draws**: three keeps what a material's build makes (its WGSL) per render
  context, and a context per call depth; the frame draws the world nested (inside SMAA's pass:
  depth 3, taken as it draws, `GpuPipeline.depth`). Compiles ahead and a room's capture are put at
  that depth, so what they build is the frame's (they built everything again before).
- **Mirrors** (`gpu/mirror.ts`): three's reflector node, its reflection drawn for the glass's part
  of the view only, as WebGL's (`Mirrors` gives it the crop, `GlassSpec`). One sample, not WebGL's
  four: its target then like the frame's, it draws with the frame's pipelines (41 of its own
  otherwise); the frame's SMAA smooths it.
- **Each room's own reflections**: captured as under WebGL, into one kept cube with the frame's
  formats (`GpuDevice.cubeTarget`, `drawFace`), prefiltered once (`prefilter`; the prefilter itself
  run once in the menu). They are copied into one reflection map the materials keep
  (`GpuDevice.reflection`): a material whose reflection texture changes is built again under
  WebGPU (1.8 s entering the preparation room), one whose map's content changes is not.
- The desktop app is where it is tested (probes in `e2e/*.app.ts`, real GPU).

Measured (RTX 5070 Laptop through the 300 Hz panel the AMD 610M drives; the desktop app, a
1280×720 window at the display's pixel ratio, production build, vsync and frame-rate limit off;
Physics Lab spawn, after 14 s):

| Ultra on                         | Mean frame | p99     |
| -------------------------------- | ---------- | ------- |
| WebGL (as committed)             | 11.33 ms   | 14.7 ms |
| WebGPU, 2026-11-14               | 12.90 ms   | 30.3 ms |
| WebGPU, occlusion pass (dropped) | 24.38 ms   | 30.2 ms |
| WebGL, 2026-11-15                | 11.72 ms   | 15.0 ms |
| WebGPU, 2026-11-15               | 13.73 ms   | 32.5 ms |

(2026-11-15's runs vary by about a millisecond from one to the next: the computer was in use.)

The blast in the hub (the app in dev mode, vsync off; 9 s from the breach; worst frames): WebGL
46.7 ms; WebGPU 507.7 ms before the pipelines were made ahead, 120.2 ms after (dev-server numbers:
not the production build's). 2026-11-15, all pipelines in the background: WebGPU 49.6 ms, WebGL
53.4 ms in the same session.

The first seconds of play (the app in dev mode, vsync on; the preparation room, its mirror in
view; frames over 30 ms after Continue): WebGL none. WebGPU at the start of the day: 4.2 s, 1.1 s,
0.9 s, 0.7 s and a tail of 30–120 ms; at the end: none over 114 ms, and frames of 30–47 ms for
about 2 s (compiles ahead still building materials, ~25 ms each, on the page's thread). Ultra's
WebGPU builds most of a world's materials in the menu, before Continue.

Pictures (`scratchpad/g2/*.png`, side by side): the Physics Lab (surfaces, AO, bloom), the blast
(dust curtain and ring, motes, debris, the helicopter), the city under the glass, the preparation
room's mirror (in the middle of the view and at its edge) — WebGPU as WebGL.

Checks:

| Command                                                                                                                                                                                                                       | Result                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `npm run check`                                                                                                                                                                                                               | PASS — tsc, eslint, prettier, 327 files / 4173 tests |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts --project=dev --workers=1` (SwiftShader: the WebGL path) | PASS — 14                                            |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                                          | PASS (12.3 s)                                        |

2026-11-15 (mirrors, room captures, pipelines in the background):

| Command                                                                                                                                                                                         | Result                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                                                                                 | FAIL twice, timeouts only (2 tests, then 6 others: "Test timed out in 5000ms", the computer in use); tsc, eslint and prettier pass; the 5 files that timed out PASS alone (`npx vitest run` on them: 93 tests) |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts --project=dev --workers=1` | PASS — 14                                                                                                                                                                                                      |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/mirror.spec.ts --project=dev --workers=1`                                                                                       | PASS — 2                                                                                                                                                                                                       |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                            | PASS (11.6 s)                                                                                                                                                                                                  |

**Where WebGPU's lab frame goes** (2026-11-15, Phú: "làm tiếp tốc độ"; the app, dev server,
uncapped, Physics Lab spawn, while played — a paused game draws a fraction and is no measure):
the frame is the page's own work (CPU-bound), and it is the world's pass: ~770 meshes drawn a
frame (52 instanced, 9 skinned), most of them the parts of the lab's apparatus and benches. Per
draw three's WebGPU path does more than its WebGL one: the object's uniforms refreshed (~550 ms in
a 3 s profile), its material compared with the last frame (~300 ms), the draw encoded through
Chrome's WebGPU (~330 ms). Not the shadows: the shadow cache asked for 2 maps in 4 s, and three's
WebGPU drew just those. Looked at and set aside:

- three's `object.static` skips the comparison, but then a change to the material (a ceiling lit
  by its switch, a highlight, a dark room) is no longer sent: wrong pictures.
- Render bundles (`BundleGroup`) save the encoding only (~13 % of the pass) and keep what was in view
  when recorded: a turned head would miss objects until recorded again.
- What is left is fewer draws. Phú: "Gộp, mọi mức" (every preset). Done for what never changes:
  - **An apparatus frame's fixed parts** (`mergeStill.ts`: BenchFrame, launcher, pendulum, spring
    and tower frames; their contract says fixed) merged per material and shadow settings — the
    force board's 36 ticks, ring and mark one draw. Named parts (found by name), textured ones,
    anything skinned, instanced or with children stay. Each piece keeps its kind and turn
    (`MergedPiece.linear`), so Ultra's detail still bevels and rounds it at any angle.
  - **The controls' trims** (the same on every desk, button and display, never lit on their own)
    drawn per room and shape with `DecorBatches.addPart`, with the room's light and sleep as decor;
    hidden and shown with their view (`showView`, the four places a view is hidden).
  - Each entity's own body: batched after the merge (below).

Physics Lab spawn, the app on the RTX 5070 Laptop, production build, uncapped (2026-11-15, the
computer in use; runs with a paused game or a probe's per-draw hooks thrown out — the earlier 13–14 ms WebGPU figures
had those hooks on):

| Draws a frame | Before | After |
| ------------- | ------ | ----- |
| meshes        | 768    | 598   |
| instanced     | 52     | 48    |

| Mean frame, rounds 1 / 2 | Not merged          | Merged         |
| ------------------------ | ------------------- | -------------- |
| WebGPU                   | 11.04 / 11.08 ms    | 9.99 / 9.31 ms |
| WebGL                    | (runs paused: void) | 9.71 / 8.78 ms |

Pictures: merged and not, the same round, WebGPU: 288 of 921 600 pixels differ (0.03 %).

Also: the background-pipeline hook no longer makes an array a draw; entity views are named by their
entity id (three's tools, frame breakdowns).

Checks (2026-11-15, after the merge):

| Command                                                                                                                                                                                                                                        | Result                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                                                                                                                                                                                                                | tsc, eslint, prettier PASS; vitest FAIL twice on workers that died or timed out (the computer short of memory: 13, then 3 failures, 14 and 61 files not run) |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                | PASS — 328 files / 4176 tests                                                                                                                                |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts e2e/physics-benches.spec.ts --project=dev --workers=1` | PASS — 50 (37.9 min)                                                                                                                                         |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                                                           | PASS (14.1 s)                                                                                                                                                |

**The entities' own bodies** (Phú: "làm tiếp phần thân", "nhớ làm phải tối ưu Three.js"): ~400
single draws in the Physics Lab (82 knobs, 66 buttons, desks, monitors, displays). A body whose
material is its room's shared one is a copy in an `InstancedMesh` per room, shape, material and
shadow setting (`DecorBatches.addPart`, key `body:<geometry>:<material>:<casts>`; its matrix is the
entity's pose). A body that shows something of its own — focused, lit, charred (its material is no
longer the shared one) or outlined — is drawn by its own mesh and its copy is scaled to nothing
until it is plain again (`WorldRenderer.placeBody`, after each repaint and outline change): no
colour per copy, no material of its own in a batch, nothing allocated a frame. Not batched: bodies
moved by physics or with children, props, reveals, containers, circuit parts, hinged parts, doors,
sliders and the apparatus with moving parts (launcher, pendulum, spring stand, drop tower, bench).
A despawned entity leaves its batches.

Physics Lab spawn, the app on the RTX 5070 Laptop, production build, uncapped (2026-11-15, the
computer in use; paused runs thrown out by comparing screenshots):

| Draws a frame | Before | Frames merged | + bodies |
| ------------- | ------ | ------------- | -------- |
| meshes        | 768    | 598           | 375      |
| instanced     | 52     | 48            | ~60      |

| Mean frame, rounds 1 / 2 | Merged         | + bodies        |
| ------------------------ | -------------- | --------------- |
| WebGPU                   | 9.99 / 9.31 ms | 9.18 / 9.47 ms  |
| WebGL                    | 9.71 / 8.78 ms | 10.10 / 8.39 ms |

The two renderers now spend about the same; the difference between rounds (~1 ms) is the computer
in use, larger than what the bodies gained. The frame is still ~97 % the page's own JavaScript: what
is left is the long tail of single parts (rigs' moving parts, glassware, bench parts), and three's
own work for each object.

**Screens under WebGPU** were too light: their picture is uploaded as plain RGBA8 and WebGL decodes
it from sRGB by three's `DECODE_VIDEO_TEXTURE` define, which WebGPU does not read. The screen now
names a node look (`decoded-map`: the texture decoded by `sRGBTransferEOTF`), so both draw it the
same.

Looked at on screen, WebGPU beside WebGL (the app, the Physics Lab): the RUN button focused, an
outline, the water column and splash, the station screens — the same. That a focused body is drawn
by its own mesh with its copy hidden, and by its copy again after, is a test
(`propsWiring.test.ts`).

Checks (2026-11-15, after the bodies):

| Command                                                                                                                                                                                                                                        | Result                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run check`                                                                                                                                                                                                                                | PASS — 328 files / 4177 tests                     |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                                                | PASS — 4177 tests                                 |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts e2e/physics-benches.spec.ts --project=dev --workers=1` | PASS — 50 (30.1 min, SwiftShader: the WebGL path) |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                                                           | PASS (11.9 s)                                     |

Left for G2-1 (before Phú's look on the 300 Hz display): the 30–47 ms frames of the first seconds
(the compiles ahead build their nodes on the page's thread); a mirror's first sight builds its own
(its draw is one call deeper: ~0.1 s); the lens image not yet looked at (it needs a run on the
optical bench); one `CopyExternalImageToTexture` warning now and then (a texture of no size, its
source not found); a warning for a draw of no vertices, there before G2-1. The ~80 WebGL
`glDrawElements: Mismatch between texture format and sampler type` warnings once seen in the hub
did not come again. Fewer draws beyond this means the moving parts (one draw each, by design).

## G2-2: Light (in progress, 2026-11-15)

Phú: "Bắt đầu G2-2". Ultra on WebGPU only (still opt-in, `simlab.dev.ultraRenderer`); Low, Medium,
High and WebGL's Ultra unchanged. Scope taken (ponytail ultra, said to Phú): the bounce light, the
light in dust, smoke and steam, a grade per place. Planned, not done: the probe grid per room (each
room's captured reflection already gives its light from off screen, one probe a room) and god rays
through windows and doorways (the labs have no windows; the blast's hole keeps its drawn shaft).

- **Bounce light** (`gpu/pipeline.ts`): three's SSGI in place of GTAO — light bounced from what is
  in view, and its occlusion where things meet; denoised (no TRAA before G2-3); 2 slices × 8 steps,
  radius 1.5 m, bounce ×8, occlusion ^0.7 (`POST.gi`). The bounce lights each pixel's own colour,
  so the world's pass writes it beside the frame (`mrt`: output + diffuseColor, 8 bits). Three
  places had to draw with the same outputs, or pipelines failed ("Color target has no
  corresponding fragment stage output"): the compiles ahead (`GpuDevice.compile` sets the frame's
  MRT; three's compileAsync builds its items across awaits, each for the target and outputs the
  renderer has as it starts — `builtForFrame` starts them with the frame's), a room's capture
  (`drawFace`, its cube two textures, the second a cube too: three makes only the first one).
- **Light in the air** (`gpu/air.ts`): where dust, smoke or steam hang (particle pools with
  `look.air`: the blast's dust, a fire's smoke, the extinguisher's cloud, the steam; each pool sums
  its particles into a cloud, `Particles.cloud`, nothing allocated), a box round them is marched by
  three's VolumeNodeMaterial, lit by the room lamps (their shadows cut it) and a fire's glow — the
  lights on `AIR_LAYER`. Its own pass, a quarter of the frame, blurred, added before bloom; no
  pass while the air is clear. Strength 0.06: at 1 the blast's dust was a white-out.
- **A grade per place**: rooms say theirs (`grade`, `neutral` by default; the hub `hall`);
  `postLook.ts gradeOf`: a hall warmer by day, cooler at night (the clock's daylight); white
  balance, saturation and contrast on the picture as shown, eased over ~0.8 s through a door.

Looked at (the app, WebGPU beside WebGL, Physics Lab and hub; the blast at 0.3/1.2/3/6 s): the
benches' shaded sides lit by the floor's bounce, more contact shadow under them; the hub warmer and
a little darker in its corners (occlusion); the blast's dust lit by the hub's lamps. Not looked at:
a fire's smoke, the hub at night, the full-resolution cost.

Physics Lab spawn, the app on the RTX 5070 Laptop, production build, uncapped, 1280×720 (the
computer in use; no run paused, screenshots checked):

| Mean frame, rounds 1 / 2 | G2-2           |
| ------------------------ | -------------- |
| WebGPU                   | 9.94 / 8.60 ms |
| WebGL                    | 7.71 / 7.74 ms |

(After G2-1's merge the two were about even, 9.2–9.5 / 8.4–10.1 ms, another load on the computer.)

Checks (2026-11-15, in D:\SimLab 3D — the project moved there with Phú's Desktop):

| Command                                                                                                                                                                                                            | Result                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `npx tsc --noEmit -p .`, `npx eslint src/platform/render src/world`, `npx prettier --check src docs`                                                                                                               | PASS                                             |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                    | PASS — 329 files / 4181 tests                    |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts --project=dev --workers=1` | PASS — 15 (9.1 min, SwiftShader: the WebGL path) |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                               | PASS (12.3 s)                                    |

Left for G2-2 (before Phú's look on the 300 Hz display): how strong the bounce, occlusion, air and
grade read on the real display; a fire's smoke and the hub at night on screen; the cost at the
display's full resolution; the probe grid and window rays (Planned, above).

## G2-3: The picture over time (in progress, 2026-11-15)

Phú: "Làm tiếp G2-3". Ultra on WebGPU only (opt-in). Scope taken (ponytail ultra): TRAA. Planned,
not done, and why:

- **Reflections of what is in view (SSR)**: tried (three's SSRNode, stochastic GGX rays, metalness
  and roughness written beside the frame, normals rebuilt from depth). The labs' floors and benches
  are rough (0.3–0.6), so little showed, and the glossy screens' reflections were noisy before
  TRAA; each room's captured reflection stays. Its output is the weighed reflection in rgb and the
  ray's length in alpha: added, never blended by its alpha (that turned the frame white).
- **Motion blur, depth of field when inspecting, lens flare, TAAU**: not started. At this game's
  frame rates a frame's motion is small; the labs' light strips would flare everywhere; TAAU only
  if the frame becomes the GPU's (it is the page's).

What is there:

- **TRAA in place of SMAA** (`gpu/pipeline.ts`): every frame jittered by a fraction of a pixel and
  blended with the last, reprojected by each pixel's motion (`velocity`, a third output beside the
  colour and the albedo; `OUTPUTS`, and a room's capture cube built from it). No shimmer on grout,
  wires and ropes; the bounce light's noise averaged over frames (SSGI's own temporal mode, no
  denoise passes).
- **The compiles ahead build for the frame's nesting again**: three keeps a material's build per
  render call depth; TRAA draws the world at depth 2 (SMAA's at 3). The first frame measures it,
  but every compile before it used the old guess: all the load's compiles ahead went to a context
  the frame never drew, and the frame built everything again (17–50 ms frames, measured with a
  build log). The guess is now TRAA's (`GpuPipeline.depth`, a `shortcut:` comment).

Looked at (the app, WebGPU, Physics Lab and hub, the camera still): as G2-2, edges a little softer
(TRAA), no new artefact. Not looked at: the camera moving (ghosting behind moving parts), the hub's
city under the glass (not jittered with the world), the blast.

Physics Lab spawn, the app on the RTX 5070 Laptop, production build, uncapped, 1280×720 (GPU idle
before the runs; no run paused):

| Mean frame, rounds 1 / 2 | G2-3 (TRAA)      | G2-2 (SMAA), earlier |
| ------------------------ | ---------------- | -------------------- |
| WebGPU                   | 11.49 / 11.49 ms | 9.94 / 8.60 ms       |
| WebGL                    | 8.52 / 8.00 ms   | 7.71 / 7.74 ms       |

WebGPU is about 3 ms behind WebGL now (1–2 ms after G2-2): the motion written for each object
every frame and the TRAA passes. Measured in the afternoon with Roblox and Wallpaper Engine using
the GPU, every run was 50–100 % slower and some ran out of GPU memory; those runs are not counted.

Checks (2026-11-15):

| Command                                                                                                                                                                                                            | Result                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                                                                                                                                  | PASS                                             |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                    | PASS — 329 files / 4181 tests                    |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts --project=dev --workers=1` | PASS — 15 (8.8 min, SwiftShader: the WebGL path) |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                               | PASS (21.7 s)                                    |

Left for G2-3 (before Phú's look on the 300 Hz display): TRAA while moving (ghosting, softness);
the hub's city and the blast under TRAA; the cost at the display's full resolution; the Planned
parts above, if Phú wants them.

## G2-4: Effects (in progress, 2026-11-15)

Phú: "Làm tiếp G2-4". Scope taken (ponytail ultra): soft particles and dust settling on the floor.
Not done, and why:

- **Heat haze over fires**: tried (sprites drawing the frame behind them bent, three's
  `viewportSharedTexture`); they showed as dark discs round the fire on WebGPU. Taken out.
- **Rubble as physics bodies**: the G2 rules keep Ultra presentation only (colliders the same at
  every preset); the blast's debris is already drawn falling, lying still and swept by the repair.
- **Lit smoke and dust flipbooks**: need texture downloads (each asked first); the procedural puffs
  stay, lit in the air by G2-2.

What is there:

- **Soft particles** (`gpu/particles.ts`, WebGPU): every sprite (dust, smoke, steam, flames, the
  extinguisher's cloud) fades within 0.35 m of what stands behind it (the frame's depth against
  its own), not cut along a line where it meets a floor, a wall or a bench.
- **Dust settling on the floor** (`emergency/breach.ts`, Ultra): after the blast a layer of dust
  (lit as the floor) thickens under the hole from 2 to 12 s, and goes as the hole is mended.

Looked at (the app, WebGPU): the blast's dust softer against the ceiling (0.3–6 s); the floor
under the hole at 3, 8 and 14 s, the layer thickening; the circuit fire with soft flames (TRAA on
and off). The flames are still separate tongues, as before G2-4: not changed here.

Checks (2026-11-15):

| Command                                                                                                                                                                                                            | Result                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                                                                                                                                  | PASS                                              |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                    | PASS — 329 files / 4181 tests                     |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts --project=dev --workers=1` | PASS — 15 (13.6 min, SwiftShader: the WebGL path) |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                               | PASS (28.8 s)                                     |

Left for G2-4 (before Phú's look on the 300 Hz display): the flames' look (separate tongues), the
frame time during a fire and the blast (not measured), the Planned parts above if Phú wants them.

## G2-5: People and wear (in progress, 2026-11-15)

Phú: "Làm tiếp G2-5". D3 (a), realistic CC0 people, was asked again with what it takes: no CC0
police or firefighter model is ready to load; the sure CC0 way is MakeHuman (its exports are CC0),
FBX converted to glTF, then fitted to the game's own skeleton, gait, gestures and seats, and the
cleanroom's coat, gloves and goggles, the photo faces and hair made again for it — days, and risky
for the dressing procedure. Phú chose to upgrade the people there are (no download).

The people are drawn in the anime style of Phase C (toon light in steps, outlines), so the upgrade
keeps it (Ultra on WebGPU only; WebGL and the other presets draw them as before):

- **A soft rim of light** round every part (cloth, skin, hair): their own colour, lightened, where
  the surface turns from the eye (`gpu/looks.ts`, looks `body-cloth`, `body-skin`, `body-hair`).
- **Warm skin shadows**: a little red where the skin is darker, as light comes through it.
- **Hair's ring of sheen** where it faces up and to the eye. `skinMaterial`, `hairMaterial`
  (`body/BodyModel.ts`) carry these looks for the people (`actor.ts`) and the player (`BodyView`).

And wear, in the photographed surfaces' look (no decals, no extra draws): patches on floors and
tops a little darker and smoother where walked or worked, grime at the foot of walls (up to 6 and
9 %: a used lab, still bright).

Not done: realistic people (above); per-role clothing beyond the figures' own.

Looked at (the app, WebGPU beside WebGL): the teacher from behind, the jacket's lighter rim; the
Physics Lab, the wear barely there by design. Not looked at: faces close up (the warm shadow, the
hair's ring from the front), the squad. Seen: the people's outlines look dotted under TRAA (since
G2-3: thin shells jittered).

Checks (2026-11-15):

| Command                                                                                                                                                                                                            | Result                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                                                                                                                                  | PASS                                                                                              |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                    | PASS — 329 files / 4181 tests                                                                     |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts --project=dev --workers=1` | FAIL — 14 passed, 1 failed: the 113 police test, its page reloaded mid-test (no cause in the log) |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/emergency.spec.ts --project=dev --workers=1`                                                                                                       | PASS — 3 (4.4 min); the failure above not repeated: flaky, not counted as a pass                  |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                               | PASS (12.6 s)                                                                                     |

Left for G2-5 (before Phú's look on the 300 Hz display): the faces close up; the dotted outlines
under TRAA; how strong the rim and wear read on the real display.

## Ultra's minimum and how it plays here (2026-11-16)

Phú: the graphics settings give Ultra a minimum; turning Ultra on shows it against this computer;
below it, a second warning about frame rate and experience; with Ultra on, how it plays here
(Good / Playable / Not advised). Layout chosen: A, a spec table; then "in the settings' own look".

- **The minimum** (`platform/ultraCheck.ts`, `ULTRA_MINIMUM`): an RTX 4060 / RX 7600 class card,
  8 GB of video memory, 8 threads, 8 GB of memory. It is our estimate from the RTX 5070 Laptop's
  frame times (above); no other card was tried.
- **Against this computer**, as far as a browser tells: the card's name (WEBGL_debug_renderer_info;
  from the main menu, before the renderer loads, read on a canvas of its own and released), the
  threads (`hardwareConcurrency`) and the memory (`deviceMemory`, which browsers cap at 8 GB: shown
  as "8 GB or more"). Video memory is never readable in a browser: listed, marked "?", not checked.
  Cards are sorted by name (`gpuClass`): RTX 4060 class or better, a smaller card, graphics in the
  processor, software, unknown. Expected: Good (strong card, threads, memory), Not advised (no card
  or processor graphics), Playable otherwise.
- **The second warning** (an alertdialog, red) when the expected is not Good: what is short, what
  that means, "Keep the current level" first and focused, "Turn on anyway".
- **While Ultra is on**, a line under the preset: the median frame rate of play (`QualityWatch`,
  5 s windows, `game.ultraFps`), rated Good ≥ 55, Playable ≥ 30, Not advised below; a frame cap
  reached counts as the cap (no more is known). Until measured: "measured while you play…".
- **Look**: the settings' own (the shell's edge and corners, the heading over its line, the parts
  as rows under thin rules, the verdict in a description box, the buttons as its selector); the
  graphics violet, red for the warning; one solid colour per verdict.

Looked at (screenshots, 1280×800): the dialog in the desktop app on the RTX 5070 Laptop (Good, every
part met but video memory "?"), in Vietnamese; under SwiftShader (Not advised, the card ✘, the second
warning "No graphics card is drawing the game"); the measured line after turning on. Not looked at:
the measured badge after a few seconds' play on the real display; a computer below the minimum
with a real card.

Checks (2026-11-16):

| Command                                                                                                                                                                                                            | Result                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint .`, `npx prettier --check .`                                                                                                                                                  | PASS                          |
| `npx vitest run --maxWorkers=4`                                                                                                                                                                                    | PASS — 331 files / 4187 tests |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/canvas.spec.ts e2e/settings.spec.ts e2e/world.spec.ts e2e/emergency.spec.ts e2e/circuit-fire.spec.ts e2e/mirror.spec.ts --project=dev --workers=1` | PASS — 15 (11.5 min)          |
| `npx playwright test -c playwright.app.config.ts e2e/desktop.app.ts`                                                                                                                                               | PASS (12.1 s)                 |

Left: Phú's look on the 300 Hz display; nothing committed.

## A mirror's head under WebGPU (2026-11-17)

Phú, from the promo's preparation-room shot: the player's reflection had no head. Under WebGPU,
TRAA jitters the frame's camera by a view offset while the scene is drawn; `Mirrors.cropped`
gave a camera with a view back as it was, so three's reflector cloned the frame's own camera,
whose layers lack `SELF_LAYER` (the head and the arms, seen only in mirrors), and drew the
reflection uncropped. Now a camera with a view is cropped like any other (its jitter dropped: the
frame's TRAA still smooths the glass), so the reflection sees the head. WebGL never jitters its
camera and was not affected.

Looked at: the promo's mirror shot recorded again in the desktop app on WebGPU (RTX 5070 Laptop):
the head, hair and goggles are in the glass. Not looked at: Phú on the 300 Hz display.

Checks (2026-11-17):

| Command                                                                                                   | Result                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `npx tsc --noEmit -p .`, `npx eslint` and `npx prettier --check` on the changed files                     | PASS                          |
| `npx vitest run --maxWorkers=4`                                                                           | PASS — 331 files / 4187 tests |
| `SIMLAB_DEV_PORT=5197 SIMLAB_DEV_ONLY=1 npx playwright test e2e/mirror.spec.ts --project=dev --workers=1` | PASS — 2 (SwiftShader: WebGL) |

Committed with Phú's OK after the promo (2026-11-17). Left: the look on the 300 Hz display.
