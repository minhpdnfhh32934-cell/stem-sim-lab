# Phase G2 contract — Ultra, the next level (2026-11-14)

Status: **ACCEPTED** 2026-11-14 — Phú took the recommendations of §6: D1 a (Ultra on
`WebGPURenderer`), D2 a (60 fps or more with temporal upscaling), D3 a (realistic CC0 people, each
download asked first), D4 a (G2-1 to G2-5 in order, the Physics Lab and the hub first). Progress: `docs/phase-g2-report.md` (G2-1 to G2-5 under way, opt-in, uncommitted). Asked by Phú, 2026-11-14, with a reference
picture (a squad roping down through a blown ceiling: dust lit by shafts of daylight, debris in the
air, real materials, real people): "Tôi muốn mức ultra là một tầm cao mới luôn chứ không phải là
kiểu game thêm xí ánh sáng và chi tiết" — Ultra a new level, not the same game with a little more
light and detail.

The rules of `docs/phase-g-ultra-contract.md` §2 stay: Low, Medium and High are unchanged; Ultra is
lazy-loaded, freed when left, never chosen automatically, presentation only (the simulation,
colliders, readings and results are the same at every preset); a browser preference, not saved.

## 1. Where Ultra is today (Phase G, committed)

GTAO ambient occlusion, bloom on emissive parts, SMAA, ACES tone mapping, 4096² soft key shadows,
each room captured into its own reflection map, CC0 PBR texture sets (ambientCG) laid
triplanar, the detail tier of the models (bevels, more segments, screws, knobs, cables). All on
three.js r186's `WebGLRenderer` with its `EffectComposer`.

What still separates it from the reference picture — and why it reads as "more light and detail":

- **No bounce light.** A room is lit by its lamps and one captured reflection; nothing picks up the
  colour of the floor or the wall beside it, corners are as bright as the middle. This is most of
  the "game" look.
- **No light in the air.** Light does not show as a beam through dust, steam or a doorway.
- **Reflections are a room's average,** not what is actually next to the glossy floor or the glass.
- **The picture is not stable over time:** SMAA alone, fine detail (grout, wires, rope) shimmers as
  the camera moves; no motion blur, no depth of field.
- **Particles are flat sprites** (smoke, dust, steam, fire) cut against the floor and walls.
- **People are drawn in code** from simple shapes; next to real materials they read as figures.

## 2. The way up: Ultra on WebGPU

three.js r186 (already in the project) has a second renderer, `WebGPURenderer`, whose node
post-processing ships with what §1 lacks — checked in `node_modules/three/examples/jsm/tsl/`:
`SSGINode` (screen-space global illumination: bounce light and colour bleeding), `SSRNode`
(screen-space reflections), `TRAANode` / `TAAUNode` (temporal anti-aliasing, temporal upscaling),
`GodraysNode` (light shafts), `LightProbeGridNode` (a grid of light probes per room), `MotionBlur`,
`DepthOfFieldNode`, `LensflareNode`, `Lut3DNode` (colour grading), `DenoiseNode`. Microsoft Edge
on Windows runs WebGPU (the desktop app is Edge).

Ultra would draw with `WebGPURenderer`; Low, Medium and High keep `WebGLRenderer` byte for byte.
What must be rewritten for Ultra: the custom shaders (10 files in `src/platform`: the triplanar
surface patch, finishes and looks, particles, water, outlines, the bodies, the city, the optical
bench) as node materials, and the renderer's
WebGL-only plumbing (program warm-up, shadow cache, the reflection captures). The game, the
simulation and every view's logic stay.

## 3. What Ultra adds (in order)

| Step | What                                                                                                                                                                                                                                       | Done when                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| G2-1 | Ultra on `WebGPURenderer`: today's Ultra rebuilt on it (surfaces, AO, bloom, shadows, reflections, particles); warm-up and door stalls measured                                                                                            | Phú sees the Physics Lab on WebGPU next to today's Ultra and finds nothing lost; bench numbers |
| G2-2 | **Light:** SSGI bounce light with a probe grid per room for what is off screen; god rays through windows, doorways and the blast's hole; light in dust, steam and smoke (volumetric); colour grading per place (labs, hub, night)          | the labs and the hub have light that bounces and shows in the air                              |
| G2-3 | **The picture over time:** TRAA (or TAAU at a lower internal resolution), SSR on floors, benches and glass, motion blur (camera and moving things), depth of field when inspecting, lens flare on the sun and lamps                        | no shimmer walking past grout, wires and ropes; real reflections                               |
| G2-4 | **Effects:** soft particles (faded where they meet the scene), lit smoke and dust flipbooks, fire with heat haze, debris that lands and stays on the floor as rubble (physics bodies, swept by the repair), dust settling as a floor decal | the blast, a fire and the extinguisher look like the reference                                 |
| G2-5 | **People and wear:** the squad, the teacher and the players with realistic bodies, faces, hair and clothing at Ultra (D3); wear and dirt decals on floors, benches and walls                                                               | people read as people next to real materials                                                   |

Each step is built, tested (`npm run check`, e2e, the bench on the real GPU), shown to Phú on the
real display and committed only on his word.

## 4. Performance and honesty

- Every number names its renderer (WebGPU on the RTX 5070 Laptop, the reference; e2e on
  SwiftShader is never reported as Ultra's).
- e2e keeps running at Low, Medium and High; Ultra gets smoke tests (the switch, a reading
  identical at Ultra, no WebGPU error) without timing claims. If the browser has no WebGPU, the
  Ultra dialog says so and Ultra stays unavailable — no silent fallback to something else called
  Ultra.
- Downloads (people, smoke flipbooks, more surfaces) are asked for one by one with name, source,
  licence and size; only CC0 or equally free sources.

## 5. Risks

- WebGPU's own shader compile and pipeline creation must be warmed like WebGL's, or door and blast
  stalls come back (they were 0.25–0.45 s on WebGL before warm-up; 2026-11-14 the blast is 37 ms).
- SSGI and volumetrics at full resolution may not hold the frame rate: TAAU (a lower internal
  resolution, upscaled with history) is the way to keep it (D2).
- G2-1 is the large, invisible step: much rewriting before anything looks better. It can stop
  there, with today's Ultra kept on WebGL, if the parity check fails.

## 6. Decisions for Phú

- **D1 — the renderer.**
  (a) **Recommended:** Ultra moves to `WebGPURenderer` (§2): every effect of §3 exists for it in
  three.js already; the rewrite is of our own shaders only.
  (b) Ultra stays on `WebGLRenderer`, and each effect is written by hand (bounce light from SH
  probes, a raymarched light shaft pass, SSR, TAA): no migration, but fewer effects and more of our
  own shader code to keep.
- **D2 — the frame rate at Ultra** (RTX 5070 Laptop, the display's resolution).
  (a) **Recommended:** 60 fps or more, with temporal upscaling (an internal resolution of about
  70 %, reconstructed by TAAU).
  (b) 60 fps or more at full resolution (fewer effects at once).
  (c) 45 fps or more — Ultra as the picture mode, High for play.
- **D3 — the people.**
  (a) **Recommended:** realistic, rigged people from a CC0 source (e.g. MakeHuman's exports, CC0),
  dressed per role (police, firefighters, the teacher, the players' characters), each download
  asked first; today's figures stay at High and below.
  (b) Today's figures in code, upgraded (skin shading, hair strands, cloth folds) — no download, but
  still figures.
- **D4 — the order.** (a) **Recommended:** G2-1 to G2-5 as in §3, the Physics Lab and the hub
  first. (b) G2-4 (effects) and G2-5 (people) first on today's renderer, the renderer after.
