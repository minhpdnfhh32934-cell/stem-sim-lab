# Phase U contract — doors between a subject's rooms, larger labs, each subject its own look (2026-11-05)

Status: **APPROVED** (Phú, 2026-11-05: D1–D4 all (a); §8). Asked by Phú, 2026-11-05: inside a subject's lab, the
ways into its other rooms have doors — not like the lab's entrance: two leaves that part from the
middle, a groove where they meet, as on a starship in a science-fiction film; the rooms with many
experiments larger still ("still a little cramped"); Physics and Chemistry drawn as spaceships,
each its own; Biology as nature, and its own small rooms too; a style is not a colour only:
patterns, walls modelled in 3D, decoration.

## 1. What there is today

| Scene     | Rooms (m)                                                                         | Ways between rooms                | Experiments                       |
| --------- | --------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| Physics   | lab 18 × 11.4 × 4, pendulum bay 10 × 8, projectile range 26 × 8, optics 10 × 11.4 | three openings 2 × 2.6 m, no door | 8 + 2 + 1 + 3, 19 benches planned |
| Chemistry | lab 14 × 11.4 × 3.5                                                               | — (one room)                      | 4, about 10 planned (T-5)         |
| Biology   | lab 14 × 11.4 × 3.5                                                               | — (one room)                      | 4, about 10 planned (T-6)         |

Walls, floors and ceilings are plain boxes in one colour each (a tiled floor, a panelled ceiling);
the decor is furniture and signs. Doors today: the lab's entrance from the hub (one leaf sliding
aside, a card reader, between two scenes) and hinged doors (cabinets, the washroom).

## 2. The starship door (inside a scene, between two of its rooms)

- Two leaves part from the middle into pockets in the wall, a lit groove down their meeting edges,
  a frame round the opening (a header with a light bar, two jambs). Opens by itself as the player
  comes within about 2 m, closes 1.5 s after they leave; never closes on the player or an object
  in its way (as the hub doors). A short hiss as it opens and shuts (made in code). No card.
- New item kind `sliding` (leaves and how far each slides), its own system (as the hinges): the
  system decides open or shut, physics moves the leaves (kinematic), the view draws them.
- Where: the Physics lab's three ways (to the bay, the range, the optics room — which then really
  is dark behind its door). Chemistry and Biology get them when their own rooms come (T-5, T-6);
  Biology's in its own look (wood and glass, leaf-etched), the same mechanism.

## 3. Larger labs

Only the rooms with many experiments (Phú): the Physics lab, the Chemistry lab and the Biology lab.

| Room      | Today           | Proposed (D3 a) |
| --------- | --------------- | --------------- |
| Physics   | 18 × 11.4 × 4   | 24 × 15 × 4.5   |
| Chemistry | 14 × 11.4 × 3.5 | 20 × 15 × 4.5   |
| Biology   | 14 × 11.4 × 3.5 | 20 × 15 × 4.5   |

The stations keep their order and walls; aisles widen (1.8 m → 2.6 m), islands stand further
apart. The ceiling rises with the floor so the key light still reaches the corners (75° at most).
Saves: `SAVE_VERSION` 8 (players in these rooms to their door; their stations' states kept — ids
do not change). The light pool grows if a room needs another fill (measured on Phú's GPU).

## 4. Each subject its own look

All three keep the labs bright (Phú) and drawable at High 300 fps: the decoration is modelled once
per module and repeated (instanced), lit by the rooms' own lights, with no new light sources.

- **Physics — the engineering deck of a starship.** Wall modules of white hull panels with dark
  seams, a cyan light strip at waist and ceiling height, ribs every 2.4 m, vents and conduit runs
  near the ceiling; a floor with guide lines and hatches; the doors' frames in the same. Motifs
  etched on panels: orbits, waves, field lines. Accent: cyan and steel.
- **Chemistry — the science module of an orbital station.** Rounded white panels in a hexagon
  (benzene) pattern, coloured pipes with valves and gauges along the walls, a fume duct overhead,
  amber hazard trim at the floor; a resin floor with hexagon inlays. Motifs: molecules, the
  periodic table's grid. Accent: teal and amber (distinct from Physics' cyan and steel).
- **Biology — a greenhouse.** Light wood cladding and beams, a living moss wall, planters with
  ferns and climbing plants on trellises, leaf patterns cut into wooden panels, a stone and wood
  floor, a ceiling of glazed panels (bright, as if lit by the sky; still lit by the room's own
  lights). Its future small rooms (T-6) the same: a terrarium room, a seed bank, a pond corner.

## 5. Steps (each: Phú's display QA, full e2e, a commit)

- **U-1** the starship door: item, system, model, sound; the Physics wing's three ways.
- **U-2** the three labs larger: layouts, plans drawn to scale and approved first, zones, lights,
  saves v8.
- **U-3** Physics' look. **U-4** Chemistry's look. **U-5** Biology's look.

## 6. Risks

- U-2 moves every station of three labs again: the station e2e specs move with them (as in T-1a).
- Decoration costs triangles and draws: kept instanced and measured (High 300 fps, GPU A/B).
- A door that opens by itself can trap a player only if its doorway check fails: covered by tests
  as the hub doors' are.

## 7. Decisions for Phú

- **D1 — the door opens.** (a) **Recommended:** by itself as the player comes near. (b) With E.
- **D2 — Biology's doors.** (a) **Recommended:** the same mechanism, in wood and glass. (b) The
  same starship door as the others.
- **D3 — sizes.** (a) **Recommended:** §3 (Physics 24 × 15, Chemistry and Biology 20 × 15). (b)
  Larger still (Physics 28 × 16, the others 24 × 16): more walking between stations.
- **D4 — order.** (a) **Recommended:** U-1 … U-5 now, before T-1b (the instruments by hand). (b)
  T-1b first.

## 8. Decisions (Phú, 2026-11-05)

1. D1 (a): the door opens by itself as the player comes near.
2. D2 (a): Biology's doors the same mechanism, in wood and glass.
3. D3 (a): Physics 24 × 15 m, Chemistry and Biology 20 × 15 m, ceilings 4.5 m.
4. D4 (a): U-1 … U-5 now, before T-1b.
5. D3 amended (Phú, 2026-11-06): the Physics Lab's ceiling is 5 m, not 4.5 m — at 4.5 m its one key
   light cannot reach the 24 × 15 m room's corners at 75° (§3); Chemistry and Biology keep 4.5 m.
