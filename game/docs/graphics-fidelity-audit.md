# Graphics fidelity audit — equipment recognition, markings, glass, lighting (2026-11-02)

Scope: the user's "GRAPHICS QUALITY + 3D ASSET FIDELITY + LABORATORY VISIBILITY" task. The
rendering path itself was audited the day before (`render-quality-audit.md`, findings F1–F14, A/B
tables in §12); this audit starts from it and looks at what that audit did not: **the models**.
Evidence is the source (file:line) and screenshots taken in the running app (built-in browser,
High, dev build). The physical dilution slice (`phase-labs-report.md` §11) is the baseline and is
not to change behaviour.

## 1. Rendering state (from the code, confirmed against render-quality-audit §2, §12)

| Item              | State                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Render resolution | Medium/High: CSS size × devicePixelRatio (no cap below 2, `quality.ts` `maxPixelRatio`); Low: ratio 1       |
| Colour / tone     | sRGB output, ACES Filmic, exposure 1.05 (enhanced scenes)                                                   |
| Anti-aliasing     | MSAA on the default framebuffer, every tier; no post-processing, no sharpening, no dynamic resolution       |
| Filtering         | mipmaps; anisotropy floor 4 / 8 / 16 (Low / Medium / High)                                                  |
| Shadows           | PCF spot shadows, 4 key slots, 1024² (Medium) / 2048² (High); glass never casts; contact shadows Medium+    |
| Lights            | per-room spots from content (`rooms.json` `lights`, 10-slot pool) over a hemisphere; High adds a PMREM room |
| Glass             | Low/Medium: 35 %-opaque paint; High: a near-clear multiply filter plus an additive sheen pass               |
| Frame pacing      | no FPS cap by default; the browser's vsync (300 Hz on the target panel) is the only limit                   |

The renderer is not the reason the lab looks primitive. Its remaining limits (glass below High is
paint; no view-dependent edge on any tier) are covered in §4.

## 2. Benchmark truthfulness

The previous phase measured a **maximized window**: 2549×1403 device px (1699×935 CSS at DPR 1.5),
taskbar and title bar excluded, vsync on. That is not the 2560×1600 panel, and "300 fps" there means
"never missed a 300 Hz refresh", not "can render 300+". This phase adds a fullscreen project
(2560×1600) and an uncapped mode (vsync and the frame-rate limit off), and reports both separately.

## 3. Asset fidelity

Glassware of the physical lab is drawn by `ContainerView` as a lathe of the item's `container.profile`
(the inner wall + 1.5 mm), with a white ring at a volumetric mark and a cylinder plug as stopper. Those
profiles were written for bookkeeping (volume ↔ level), not for recognition. Bench apparatus are
procedural builders (`render/bench/*.ts`), several of them detailed already.

| Asset                          | Current problem (evidence)                                                                                                                                                                 | Importance | Proposed fix                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volumetric pipette (4)         | A straight 4.9 mm tube with a pointed foot (`items.json` `dil-pipette-*` profile: 2 radii). No bulb, no suction stem, no mark, no print: it reads as a glass rod                           |   Critical | A real bulb pipette profile: tapered tip, lower stem, bulb, upper stem; the calibration ring on the upper stem at exactly V; capacity printed on the bulb. Same length (pick box unchanged); mark still holds exactly V |
| Wash bottle                    | A glass-looking bottle (`material: plastic` ignored: ContainerView draws every profile with the glass material), no cap, no delivery tube; the "nozzle" the pour uses is the neck's centre |   Critical | Translucent white polyethylene body, screw cap, delivery tube rising from the cap and bending down; the pour's spout moved to the tube's tip (data), the bottle held with its nozzle ahead                              |
| Reagent (stock) bottle (4)     | Clear glass bottle without cap or label: the four concentrations are told apart only by the hover name. The definition says "a stock bottle whose label shows C₁"                          |   Critical | Screw cap (drawn when closed, instead of a plug), a wrap-around paper label printed with the item's own name (its C₁), amber-free clear glass kept                                                                      |
| Volumetric flask (4)           | Bulb and neck right (`FLASKS` profiles); calibration ring white and thin; no printed capacity; stopper a plain cylinder                                                                    |   Critical | Capacity and "20 °C" printed on the bulb; a darker, crisper calibration ring; an octagonal-head stopper                                                                                                                 |
| Cuvette (dilution colorimeter) | A round tube (lathe of radius 4.5 mm) in a square slot                                                                                                                                     |       High | Drawn square (4-segment lathe scaled so its cross-section area equals the profile's circle: the level mapping stays exact), turned to the slot                                                                          |
| Dilution colorimeter           | Case in the item colour `#dfe3e6`, nearly the bench top's colour: in the lab it reads as a flat slab with dots                                                                             |       High | A darker instrument-grey case so the housing, sloped panel and readouts separate from the bench                                                                                                                         |
| Burette (titration stand)      | 50 mL burette with stopcock barrel and key, graduations every 0.1 mL wrapped on the front (`titration-stand.ts:44-98, 432`)                                                                |       High | Adequate geometry; benefits from the glass edge (§4). No change planned                                                                                                                                                 |
| Thermometer (heating bench)    | Spirit thermometer with bulb, stem, back strip and marks every 10 °C (`hot-plate.ts:53-62, 185-219`)                                                                                       |       High | Adequate; no change planned                                                                                                                                                                                             |
| Beaker (heating bench)         | Rolled rim, foot, pinched spout, graduations (`hot-plate.ts:151`)                                                                                                                          |     Medium | Adequate; no change planned                                                                                                                                                                                             |
| Microscope (biology props)     | Compound microscope builder (`props/labs.ts:459`): foot, arm, stage, nosepiece                                                                                                             |   Critical | Not in this phase's slice (Biology migration is out of scope); not changed                                                                                                                                              |
| Light switch                   | **None exists.** Room lights are always on (`roomLights.ts`)                                                                                                                               |       High | A wall switch item in the Chemistry Lab; E toggles its room's lights (entity state, saved); the renderer dims that room's spots and fixtures                                                                            |
| Graduated cylinder, balance    | No graduated cylinder in the 3D labs; a balance only inside the osmosis/buoyancy rigs                                                                                                      |        Low | Not in the slice; not changed                                                                                                                                                                                           |

Dimensions the definitions do not give (pipette bulb and stems, cap and nozzle sizes, label size) are
**implementation assumptions**, labelled as such in the data and code; none is a model input.

## 4. Materials, liquid, lighting

- **Glass** has no view-dependent response on any tier: paint (Low/Medium) or a flat filter (High)
  has the same opacity face-on and at the silhouette, so a vessel's outline and wall thickness are
  weak cues and thin glass (pipettes) nearly vanishes. Fix: a Fresnel term on the glassware
  material (more opaque and brighter towards grazing angles) on every tier — a shader change, no
  extra draw.
- **Plastic** containers are drawn with the glass material (wash bottle). Fix: ContainerView honours
  the item's `visual.material` for the body.
- **Metal** is half-metallic below High by design (no environment map there; full metal renders
  black). Not changed.
- **Liquid** is a multiply filter clipped at the level from the authoritative µL, with a surface
  disc. Not changed; the glass edge makes the container/liquid boundary clearer.
- **Lighting**: the Chemistry Lab is lit by one key and one fill spot over a hemisphere, exposure
  1.05. Brightness is adequate in the screenshots; the missing piece is the physical switch.

## 5. Plan (order of work)

1. Benchmark: fullscreen project, uncapped mode, 1 % low and the display/window facts in the header;
   baseline before any visual change.
2. Glassware geometry and print: pipette, wash bottle (+ spout data and held heading), stock bottle
   cap and label, flask print and stopper, square cuvette, colorimeter case colour.
3. Glass Fresnel edge on every tier; plastic body for plastic containers.
4. Physical light switch (Chemistry Lab).
5. `npm run check`, `npm run build`, `npm run test:e2e`; benchmark after; self-review; report.

Out of scope (the task says so): Chemistry/Biology migration, room redesign, spatial guidance, new
experiments, an Ultra tier, sharpening.

## 6. What was done (2026-11-02)

- **Pipettes**: bulb profiles (`items.json` `dil-pipette-*`), the mark on the upper stem at exactly
  V (`levelIn`), "V mL / 20 °C" printed lengthwise on the bulb; capacities 1.2 / 2.3 / 5.6 / 10.9 mL
  (the profiles' brims).
- **Stock bottles**: a ribbed screw cap shown only while `closed`, a paper label printed with the
  item's display name (its C₁, translated with the item).
- **Volumetric flasks**: "V mL / 20 °C" printed on the bulb, the calibration ring in dark blue
  enamel, an octagonal-head stopper while `closed`.
- **Wash bottle**: polyethylene (translucent white, not the glass material), a screw cap and a
  delivery tube whose tip is the pour's `spout` ([0, 0.075, −0.034], moved from the neck's centre);
  the body shortened so the tip stays inside the item box (brim 550 mL, fill 500 mL unchanged). A
  spout off its item's axis is held ahead of the view (`PhysicsSystem.grab`), so the player sees
  where the water will fall.
- **Cuvette**: square (4-segment lathe of equal area: the level mapping is unchanged).
- **Dilution colorimeter**: its case was hidden whenever ContainerView drew the cuvette (the bench
  body is the entity's mesh); now kept, in instrument grey.
- **Glass**: a Fresnel edge on every glassware material on every preset (`finishes.ts` `glassEdge`):
  paint is clearer face-on and more opaque at the rim, the High filter darkens towards the rim. No
  draw added.
- **Liquid**: a meniscus line at the level (a child of the surface, so it moves only with the
  volume), the body's constant dimming `LIQUID_BODY` so clear water is visible, and the liquid's
  floor 0.3 mm off the glass's (a z-fight saw-tooth through the bottle).
- **Light switch**: `lab-light-switch` beside the Chemistry Lab door (behaviour `room-lights`,
  entity state `lightsOff`, saved). Off: the room's spots leave the light pool, its ceiling glow and
  fixtures go dark, and the ambient where the player stands drops to 12 % (daylight through the
  door). Every room can have one; only the Chemistry Lab has one so far.
- **Benchmark**: `gpu-fullscreen` project and `BENCH_UNCAPPED=1` (vsync and frame-rate limit off);
  every run prints the display, viewport, fullscreen or windowed, vsync and the 1 % low.

Not changed: room brightness (readable in the screenshots, on and off), shadows, texture filtering,
the burette, thermometer, beaker and microscope (adequate or out of scope), Low's cost (only the
shader edge, no pass, draw or texture added on Low except the fittings' own few draws).

## 7. Performance after the changes (2026-11-02)

Measured on the RTX 5070 Laptop (ANGLE D3D11), fullscreen at the panel's native 2560×1600, High,
against `labs-13` with the same bench files: table and conditions in `phase-labs-report.md` §12.
With vsync on, every lab holds 300 fps as before. Uncapped, the Chemistry Lab's frame is 0.06–0.17 ms
longer (the fittings' extra draws, on the CPU side), still above 1000 fps; other labs are unchanged
within run-to-run noise. The first fullscreen attempt was not fullscreen (Edge ignores
`--start-fullscreen` and `--kiosk` under Playwright: a 1542×1362 window); those runs were discarded
and the bench now goes fullscreen through CDP (`e2e/support.ts` `fullscreenWindow`).
