# Phase G contract — the Ultra graphics preset (2026-11-06)

Status: **APPROVED** (Phú, 2026-11-06: D1–D4 all (a); §8). Asked by Phú, 2026-11-06: keep today's models as
they are for High and the presets below it; add an **Ultra** preset whose details are as complete as
today's AAA games — lighting, models and everything else — so no one looks at it and asks "is this
Roblox?"; turning Ultra on first shows the player what it asks of their machine, and it is turned
on only if they agree.

This extends the design already written in `docs/game-core.md` ("Planned: the Ultra preset and
quality-tiered assets"), which stays the rule for what Ultra may never change.

## 1. What there is today

- Presets Low, Medium (default), High (`render/quality.ts`): room lights with one shadowed key per
  room, 1024² or 2048² shadow maps, a generated `RoomEnvironment` for reflections (High), glass sheen
  and contact shadows, ACES tone mapping, the canvas's MSAA. No post-processing pass.
- Every model is procedural: 82 bench-model files, 22 prop files, room dressers, about 195 items —
  boxes, rounded slabs, cylinders and lathes in flat colours with roughness and metalness; textures
  are only drawn ones (floor tiles, labels, screens). Nothing is downloaded per preset.
- Why it reads as "Roblox": flat albedo with no surface variation (no wear, grain, grout, brushing),
  sharp or uniformly rounded edges, low tessellation on round parts, no ambient occlusion where
  things meet, shadows hard and few, generic reflections, no bloom on lamps and screens, little
  small clutter (cables, screws, labels on everything).

## 2. Rules Ultra keeps (unchanged from game-core.md)

- **Low, Medium and High stay exactly as they are** (Phú). Ultra is a fourth preset; every Ultra
  asset and pass is lazy-loaded when Ultra is chosen, never by another preset, and freed when the
  player leaves it.
- Presentation only: the simulation, colliders, aim boxes, apparatus extents and every drawn
  reading (liquid level, meniscus, needle, display, scale marks) are the same under every preset —
  `quality.test.ts` already loops over the presets with a Hooke's law run, and gains one per
  reading-bearing bench model.
- Never suggested or chosen automatically; Medium stays the default.
- A browser preference, not in the save.

## 3. The consent dialog

Choosing Ultra (main menu or pause menu Settings) opens a dialog before anything changes:

- What Ultra is for: a desktop or gaming laptop GPU of the RTX 4060 / RX 7600 class or better (the
  reference: RTX 5070 Laptop); at least 8 GB of video memory.
- What it costs: a lower frame rate than High; more heat, fan noise and battery use on a laptop; a
  one-time download of the Ultra textures and environment maps (its size stated, in MB) and a
  longer load into each lab the first time.
- That experiments and their results are the same at every preset.
- Buttons: **Turn on Ultra** and **Cancel** (Cancel and Esc keep the preset the player had). Only
  "Turn on Ultra" switches and remembers it; the dialog shows each time Ultra is chosen from
  another preset, not on later visits that start in Ultra.
- If the GPU reports less than the minimum the browser can tell (no WebGL2 feature it needs, a
  software renderer like SwiftShader), the dialog says so plainly and still lets the player choose.
- In English and Vietnamese like every interface text; keyboard and screen-reader usable.

## 4. What Ultra adds

### 4.1 Lighting (one post-processing chunk)

- **Ambient occlusion** (three's GTAO pass): soft darkening where objects meet the bench, the floor
  and each other — the largest single step away from the flat look. Glass and liquids are left out
  of the AO pass.
- **Soft, sharper shadows**: 4096² key shadow maps, PCF softened by `shadow.radius`; each room's
  fill lights may cast shadows too (budget measured on the RTX 5070).
- **Room-true reflections**: each room captured once by a cube camera at its centre, prefiltered
  (PMREM), instead of the generic environment; metals, glass and screens reflect the room they are in.
- **Bloom** on emissive parts only (lamps, screens, LEDs, the optics room's laser): light glows
  without washing the room.
- **Anti-aliasing** after the passes (SMAA or the composer's MSAA target) and tone mapping in the
  final pass (AgX or ACES, chosen on Phú's display).
- The shader warm-up and room sleep (`warmStep`, `roomSleep.ts`) go through the composer, or door
  stalls come back.

### 4.2 Surfaces (PBR texture sets, the "is it real" step)

Every large surface and every common material gets a full PBR set at Ultra — albedo with variation,
normal, roughness and ambient occlusion maps, 2048² or 4096² (KTX2-compressed): floor tiles with
grout and wear, painted walls with roller texture, epoxy lab benches, brushed and scratched steel,
anodised aluminium, wood grain, rubber, plastics with mould texture, glass with faint smudges.
Two ways to get them (decision D1).

### 4.3 Models (detail tier)

Each model's frame and rig take a `detail` argument (game-core.md's bench quality hook): at Ultra,
round parts twice the segments, bevelled edges on every box (no razor edges), and the small parts a
real instrument has — screws and bolts, knurled knobs, cable runs with plugs, rubber feet, printed
scales and maker's plates, glass with thickness. High and below get today's geometry, byte for byte
(a test per model checks it). Order: the parts seen most first (benches, desks, dials, glassware,
the 3D stations' apparatus), then props and decor, then the rooms' dressing.

### 4.4 Rooms

Ultra dressing: ceiling grids with real light panels, skirting and trims with depth, cable trays,
vents, outlets, wall-mounted safety equipment, signage with real typography — all decor, batched,
in the room-sleep layers.

## 5. Steps (each QA'd by Phú on the real display and benched before the next)

| Step | What                                                                                                                           | Done when                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| G-1  | The preset, the dialog, the post-processing chunk (AO, bloom, AA, tone mapping), 4096² soft shadows, room-captured reflections | Phú sees the Physics Lab at Ultra next to High; bench numbers on the RTX 5070 |
| G-2  | The PBR surface library and its loader (per tier, lazy, freed with Ultra); rooms' floors, walls, ceilings, benches, desks      | the labs' big surfaces read as real materials                                 |
| G-3  | Detail tier for the Physics wing's models (benches, desks, controls, every station's apparatus)                                | each model checked against High: same readings, more detail                   |
| G-4  | The same for Chemistry and Biology (glassware with thickness and smudges, liquids with refraction)                             | as G-3                                                                        |
| G-5  | The hub, the Teacher Room, the corridors; Ultra dressing everywhere                                                            | the whole campus at Ultra                                                     |

## 6. Performance and honesty

- Target on the RTX 5070 Laptop (the reference), at the display's resolution: **60 fps or more in
  every lab** at Ultra (High's targets unchanged). Measured with `npm run bench` (a visible window,
  the real GPU, the renderer named); SwiftShader numbers are never reported as Ultra's.
- e2e on SwiftShader still runs every test at Low, Medium and High; Ultra gets its own smoke tests
  (the dialog, the switch, a reading identical at Ultra) without timing claims.
- Nothing of Ultra loads at Low, Medium or High (a test resolves every asset at each preset).

## 7. Decisions for Phú

- **D1 — where the surface textures come from.**
  (a) **Recommended:** free CC0 PBR libraries (Poly Haven, ambientCG: free for any use, no credit
  required), chosen per material, downloaded once into the project with your permission (each
  download named with its size; total about 300–800 MB of sources, compressed to KTX2 for the
  game). Real photographed materials: the biggest step towards AAA.
  (b) Textures generated in code (noise, grain, scratches drawn at run time): no download, but they
  look procedural — closer to a good indie game than to AAA.
- **D2 — the consent dialog:** (a) **Recommended:** each time Ultra is chosen from another preset
  (§3). (b) Only the first time on this browser.
- **D3 — order:** (a) **Recommended:** G-1 to G-5 as in §5, the Physics wing first (most stations,
  the room you test most). (b) Lighting and surfaces for all three labs first (G-1, G-2 everywhere),
  model detail after.
- **D4 — frame-rate target at Ultra on the RTX 5070 Laptop:** (a) **Recommended:** 60 fps or more.
  (b) 90 fps or more (fewer effects at once). (c) 120 fps or more.

Each step is built, tested (`npm run check`, e2e, the bench on the real GPU), shown to Phú and
committed only on his word, as in every phase.

## 8. Decisions (Phú, 2026-11-06)

1. D1 (a): CC0 PBR libraries (Poly Haven, ambientCG), each download asked for with its name, source and size.
2. D2 (a): the dialog each time Ultra is chosen from another preset.
3. D3 (a): G-1 to G-5, the Physics wing first.
4. D4 (a): 60 fps or more at Ultra on the RTX 5070 Laptop.
