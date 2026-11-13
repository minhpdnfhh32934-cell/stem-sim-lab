# Phase U report — doors between a subject's rooms, larger labs, each subject its own look

Contract: `docs/phase-u-rooms-contract.md` (approved, D1–D4 all (a)).

## 1. U-1 — the starship door (2026-11-05)

### What changed

- **Item kind `slider`** (`gameplay/item.ts`): a kinematic leaf that slides `travel` m along its
  own +x as it opens (`openS`) and back (`closeS`), opening by itself within `near` m of the
  doorway's middle (its −x edge). A door is two leaves facing each other (one turned by π), so
  they part from the middle into the wall; both share the middle, so they always agree.
- **`SlidingSystem`** (`gameplay/door/SlidingSystem.ts`): the only authority on how far each leaf
  is open (runtime only, never saved). Opens while the player is within 2.2 m; closes 1.5 s
  (`HOLD_S`, as the hub doors) after they are 2.6 m away; never shuts on the player or a dynamic
  body in the whole doorway (+ 0.1 m), and goes back open if one comes in while it shuts; spawned
  with the player at it, it stands open. Physics slides the leaf bodies (the walk-through doors'
  own leaf machinery, `door ?? slider`); the renderer draws them from `fraction`.
- **Look** (`platform/render/props/starship.ts`): the leaf a white hull panel with dark seams, a
  raised aluminium inset with a narrow window, a dark kick band and, at the meeting edge, a dark
  recessed groove with a cyan light strip — the two strips make the door's lit seam; the frame two
  jambs and a header through the wall, a cyan light bar under the header on both faces, steel
  plates, and a dark sill with the leaves' track groove. New finish `glow-cyan`.
- **Sound:** `DoorSlid` → `slide-open` / `slide-close`, a pneumatic hiss with a soft thunk (made in
  code), once per door (its two leaves start in the same frame).
- **Where:** the Physics Lab's three ways — to the pendulum bay, the projectile range and the
  optics room (now really dark behind its door). The room signs above them raised to 3.05 m (the
  frame's header covered them).
- **Rules:** a placement may stand in a room's opening, no deeper than the middle of the wall
  (content); the layout rules check a slider's open pose for the passage (P5) and let its leaves
  and frame stand in the wall (P3).

### Tests

- New: `SlidingSystem.test.ts` (shut until near, parts from the middle, into the wall pockets,
  shuts after the hold; a player walking up is never stopped — at the doorway's mouth the leaves
  are more than 90 % open — and walks through; holds open while something is in the doorway; goes
  back open if the player steps in while it shuts; spawned with the player at it, open), the hiss
  once per door (`cues.test.ts`). Updated: counts (Physics wing 79 bodies, 113 colliders, 278
  entities), the systems list, the range walk zone (through the door), the decor rule (a leaf
  moves: an entity, not batched decor).
- `npm run check`: **PASS** — 197 files, 3210 passed, 1 skipped.
- `npm run test:e2e` (full, 2 workers, SwiftShader): **FAIL** — 95 passed, 1 failed:
  `production.spec.ts`, the known cold-start wait for the first toast (Phase T report §1). Alone,
  `--repeat-each=3 --workers=1`: PASS (3/3). Every spec walking through the wing's doorways
  (pendulum, projectile, refraction, optics, grab, game) passed.

### Limitations

- Chemistry and Biology have no rooms of their own yet: their doors come with them (T-5, T-6);
  Biology's in wood and glass (D2).
- The leaves are lit by the rooms' lights only; the cyan strips glow but light nothing.

### Next step

Committed `5e01d04` after Phú checked the doors on the 300 Hz display. Then U-2: the three
labs larger (plans drawn to scale and approved first).

## 2. U-2 — the three labs larger (2026-11-05)

### What changed

- **Sizes** (plans drawn to scale, approved by Phú): the Physics Lab 18 × 11.4 × 4 m → 24 × 15 × 5 m
  (x −5 … 19, z −7.5 … 7.5); the Chemistry Lab 14 × 11.4 × 3.5 → 20 × 15 × 4.5 m (x −10 … 10,
  z −11 … 4); the Biology Lab 14 × 11.4 × 3.5 → 20 × 15 × 4.5 m (x −15 … 5, z −7.5 … 7.5). The wall
  with each lab's hub door stays where it was, so the hub, its doors and the scenes' spawns do not
  move. The Physics Lab's neighbours move with its walls: the pendulum bay 1.8 m north, the
  projectile range 1.8 m south, the optics room 6 m east (their doors and lights with them).
- **SPEC DEVIATION — the Physics Lab's ceiling is 5 m, not 4.5 m.** The contract asks for 4.5 m
  ceilings _and_ for the key light to reach every corner at 75° at most (§3); in a 24 × 15 m room
  with one key over its middle, 4.5 m gives 76° at the corners (`lighting.test.ts` fails), 5 m
  meets it. Chemistry and Biology (20 × 15) meet it at 4.5 m. **Accepted by Phú (2026-11-06):**
  the Physics Lab keeps 5 m (contract §8, D3 amended).
- **Layout:** every placement moved by the plans' rule (`u2-layout.cjs`, kept with the plans):
  furniture spreads with the room, keeping its wall; desks, panels, monitors and what stands on a
  bench move with their bench or apparatus; wall items keep their wall; ceiling items rise with the
  ceiling. Aisles wider, as drawn in the plans (contract: 1.8 m → 2.6 m). Lights: each lab's key over its middle and its fills, as
  before, at their new places.
- **Save v8** (`persistence/saveData.ts`): a player in a lab scene stands at its hub door (its
  spawn); a moved object in one of the six rooms goes home (its old pose would stand elsewhere);
  station settings and entity states are kept (ids did not change). Test: a v7 save upgraded.
- **Set-down fix** (`PhysicsSystem.ts`): the overlap test for a set-down no longer counts the
  surface it is set on. Rapier's tolerance grows with the other shape, and the larger labs' floor
  box refused a glass a hair above it ("No room").
- **Tests:** every coordinate in the unit tests and e2e specs moved by the same rule
  (`u2-convert.cjs`), the doubtful ones by hand (routes round benches, walk thresholds through the
  wing's doorways, the dilution bench's front).

### Tests

- `npm run check`: **PASS** — 198 files, 3215 passed, 1 skipped.
- e2e (SwiftShader, dev server; no single clean full run — the suite ran in parts, two at a time at
  first): every spec PASSED in its last run.
  - First runs, two shards in parallel (4 browsers; one shard run by a second agent): three runs,
    104 tests, 75 passed, 29 failed. 18 were load: a page stuck on the menu at 0–9 fps, a catalog
    entry not found, a route not reached in time, a 1.5 m step through a door at a few fps; each
    passed alone (FLAKY, not PASS). 11 were real, in five specs, all coordinates the conversion had
    missed — fixed: the dilution bench's front (`physical-lab`), the save version (`preparation`,
    7 → 8), the projectile route back to the hub door (`experiment`), the restored position
    (`pause`), and the seven physics benches' stands, written as [x, z] pairs (`physics-benches`).
  - Then, alone: the eight files that had failed — 35 passed; `game` and `grab` (dev-timed,
    `--no-deps`) — 4 passed. `production` and `renderer.production` passed in the first runs.
  - `npm run bench` (real GPU): NOT RUN.

### Limitations

- The rooms look as before, only larger (plain walls, white benches): the styles are U-3 … U-5.
- Light and frame times in the larger rooms are not measured on a GPU yet (`npm run bench`).

### Next step

Phú checks the larger labs on the 300 Hz display and decides the Physics ceiling (5 m, or 4.5 m
and a second key). Then U-3, the Physics Lab's starship look.

## 3. U-3 … U-5 — each subject its own look (2026-11-05, night)

Built overnight on Phú's word ("cứ thay đổi và làm tiếp"), not yet seen on the 300 Hz display.

### What changed

- **Room styles** (`world/definitions.ts`): a room's `style` — `plain` (default), `starship-deck`,
  `orbital-module`, `greenhouse` — drawn by the renderer's dresser of that name
  (`platform/render/dress/`). Decoration only: nothing in it blocks, is aimed at or moves. Each
  style is one merged geometry per finish in the shared palette, so a draw per finish per room
  (5–9 per room), built with the room's shell and freed with it; no light of its own, no shadow cast.
- **Shared rules** (`dress/frame.ts`): a wall is seen from inside its room (along, up, out). Flat
  cladding (≤ 14 mm off the wall) lies behind everything and is cut only at openings; anything that
  stands out (strips, ledges, ribs, pipes, motifs, plants) is cut or left out where something stands
  within 0.35 m of the wall (a board, a monitor, a sign, a bench, a fixture) and kept clear of
  doorways. Unit tests check, for every styled room: inside its bounds, nothing in a doorway, nothing
  standing out into what stands at a wall, a draw per finish, under 60 000 triangles.
- **U-3 Physics — starship engineering deck** (physics lab, pendulum bay, projectile range): white
  hull panels in three rows over a dark kick band, dark seams (the wall's paint), a cyan light strip
  at waist height and under the ceiling, a steel ledge, aluminium ribs every 2.4 m rising from above
  what stands in front of them, vents and two conduits on brackets near the ceiling, motifs etched in
  cyan on free panels (an atom's orbits, a wave, field lines); on the floor a cyan guide line 0.75 m
  from the walls, open at doorways, and hatches where the floor is free. The optics room stays plain
  and dark (its experiments need the dark; the glowing strips would light it).
- **U-4 Chemistry — orbital-station science module**: a honeycomb of rounded white hexagons (the
  benzene ring) across the middle of the walls, rounded panels below and above, an amber hazard band
  with dark diagonal stripes at the floor, a teal trim line, three service pipes (teal, amber, steel)
  with valves and gauges, a fume duct along the north wall under the ceiling; motif panels (ethanol in
  balls and sticks; the periodic table's outline, its s, p and d blocks coloured); hexagon inlays
  with a benzene circle on the floor. Teal and amber, apart from Physics' cyan and steel.
- **U-5 Biology — greenhouse**: light wooden boards up the walls to a wooden beam, wooden panels
  above with leaves cut in, a living moss wall in a wooden frame on each wall's longest free stretch,
  trellises with a climbing plant over a fern in its planter where the wall is free, a glazed ceiling
  (bright panes, as if lit by the sky — they light nothing) between wooden beams and mullions, cut
  round the light fixtures, and wooden decking 0.9 m wide round the floor, open at the doorway. Its
  floor sounds as stone. Biology's future small rooms (T-6) take the same style.
- Walls lightened where the look darkened a lab (Phú: labs stay bright): Chemistry's wall paint
  #a7b8b5 under the honeycomb, the greenhouse's wood light (#ead6b4).
- New finishes: `hull`, `amber`, `pipe-teal`, `inlay-teal`, `wood-light`, `moss`, `sky` (a light
  finish, like the lamps).

### Tests

- `npm run check`: **PASS** — 199 files, 3233 passed, 1 skipped (before the experiments of §4).
- e2e, full (2 workers, SwiftShader): **FAIL** — 91 passed, 1 failed, 4 did not run (the timed
  specs wait for the rest). The failure was real: `titration-physical.spec.ts` failed again alone,
  and passed alone with Chemistry's style off — the first style (about 60 000 triangles) slowed the
  frames enough that the spec's timed key taps ended elsewhere. Fixed by drawing less: the panels'
  corners cut once (not curved and bevelled), fewer segments in pipes, gauges, valves and the
  Physics motifs' lines (Physics 37 000 → 15 000 triangles, Chemistry 60 000 → 38 000, Biology
  45 000). Then `titration-physical` alone: PASS (once); `game` and `grab` alone: PASS, 4/4.
  The full suite ran again with the next experiments (Phase T report §4, Tests).
- Looked at in probe screenshots (SwiftShader, High and Low), not on a GPU or the 300 Hz display.

### Limitations

- Frame times with the styles are not measured on a GPU (`npm run bench`): about 5–9 more draws and
  15 000–45 000 triangles per lab; to be measured. The titration spec is sensitive to frame rate
  under SwiftShader: a heavier style can break it again.
- The ceiling keeps its one shared colour: the greenhouse's sky is its panes, not the ceiling.
- Stripes, leaves and motifs on walls that run the other way are mirrored (they run along the wall).

### Next step

Phú looks at the three styles on the 300 Hz display (the Physics ceiling: 5 m, Phú 2026-11-06). Nothing
is committed: U-2, the styles and the new experiments are separate steps, each to be committed on
Phú's word (checkpoint patches of each step are kept outside the repository).
