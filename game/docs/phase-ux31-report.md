# Phase UX3.1 report: washroom trim, sequential doors, hinged colliders, PPE models, water

Date: 2026-10-29.

- **Base:** `main` at `a1ca48c` plus the uncommitted phases W0, WX, UX1, UX2 and UX3
  ([phase-ux3-report.md](phase-ux3-report.md)). Before any change, the whole uncommitted tree was
  backed up outside the repository (a tracked patch and an archive of the untracked files).
- **State:** branch `main`, HEAD `a1ca48c`, nothing committed or pushed (manual QA pending).
- **Who did what:**
  - A read-only multi-agent audit mapped each area first.
  - The Lead built the door sequence and aiming, the hinge system (gameplay, physics, renderer,
    layout, arrival), the trim fix and the first-open work.
  - Three workers built the PPE models, the water, and the washroom door's prop and sign. They
    worked in worktrees seeded with the current tree (`.claude/worktrees/ux31-*`), and the Lead
    merged their work file by file.
  - A subagent adapted the door tests.
  - A second multi-agent review checked each finding with two skeptics. It confirmed 7 defects, all
    fixed.

## Verdict

**PARTIAL.** Every automated check passes (see Verification).

- The manual visual and route QA on the user's display is NOT RUN: RTX 5070 Laptop,
  2560 × 1600, 300 Hz. The stills below were taken by the Lead, headless at 1280 × 720, and are not
  that QA.
- One requirement is met only in part. The first time a door is opened, frames of 20–33 ms still
  occur while the door is closed (see 7).

## 1. Black tile trim in the washroom (z-fighting)

- **Root cause** (geometry, verified by computing every face):
  - The room shell's dark skirting (`roomShell.ts`) stands 12 mm off the wall and 0.10 m high.
  - The front faces of the UX3 tile wainscot also stood 12 mm off the wall, and its bottom row
    covered 0.0015–0.1985 m.
  - So two coplanar faces, one white and one black, shared y 0–0.1 on every wall. Rotations of
    3.14159 and 1.5708 (not exactly π and π/2) tilt one plane by a few µm, so the winning face changed
    in bands with view angle and distance.
  - The doorway reveals had the same clash between the grout ends and the skirting ends.
- **Fix (geometry only):** the wainscot now starts on top of the skirting.
  - Its 5 placements are at y 0.1, and `wall-tiles` and `wall-tiles-narrow` are now 1.1 m high.
  - No surface shares the skirting's volume any more. The skirting stays continuous round the
    corners and stops at the reveals, as before.
  - Wall thickness, collisions, the neighbouring room and depth settings are unchanged. There is no
    polygon offset.
- **Other rooms:** the lobby wainscot is 40 mm proud of the wall and covers the skirting, so it has
  no clash.
- **Guard:** a new test checks that no tile wainscot starts below `BASEBOARD_H`.

## 2. Two layers of door, one after the other

- **Before:** a walk-through pair is two leaves back to back through the wall, one per scene. It
  had one fraction, so both leaves slid together.
- **Now (`DoorSystem`):** each leaf has its own fraction, and only one ever moves.
  - The leaf on the player's side opens first. Near and far come from the player's position against
    the pair's two closed centres.
  - It slides over `openS` = 0.6 s. Then `LEAF_GAP_S` = 0.2 s passes, then the far leaf opens:
    1.4 s in all.
  - Closing runs the same way, the player's side first.
- **Requests:** repeated E presses only flip the goal, so sequences never pile up.
  - A press during travel reverses the moving leaf.
  - A leaf already mid-travel always finishes first.
- **Leaving mid-sequence:** the sequence completes, and the later auto-close starts on the player's
  new side.
- **SceneUnloaded:** both leaves close. With dt 0, nothing moves.
- **Pair states keep their meaning:** `open` means both leaves are at 1, `closed` means both are at 0.
  So these are unchanged:
  - the clean-area interlock (`state(entrance) !== 'closed'`);
  - the autosave;
  - scene residency.
- **Airlock:** no rule forbade both leaves being open. The two leaves are only 0.27 m apart, so a
  player can only pass with both open.
- **Collider sync:** unchanged. Physics moves each leaf's body from its own fraction in the fixed
  step.
- **Review fix:** a player standing in the tunnel no longer keeps the far leaf shut. Opening now
  sweeps only the moving leaf's own pocket.

## 3. Aiming at doors

- **Before:** a door was aimed at only by its closed leaf box. Once the leaf slid away, only the empty
  doorway answered.
- **Now:** the aim box covers the leaf, the 1 m pocket it slides into, its jamb (0.1 m) and its header
  (0.175 m).
  - So the leaf, its pull or its frame all answer, whether the door is closed, sliding or open.
  - Neighbouring pairs are at least 10 m apart; the two leaves of a pair are told apart by distance
    and by the wall.
- **Prompts:**
  - closed: the door's own label ("Go to …");
  - preparing: "Opening…";
  - opening or open: "Close the door";
  - refused: the reason, as before.
- **The washroom door** is aimed at by its open leaf once it is open (review fix).
- **The debug panel** now shows both leaf fractions (`… open 1.00 1.00`).

## 4. Hinged leaves with colliders (PPE cabinet) and the washroom door

- **Root cause:** the UX3 cabinet's swing lived only in the renderer, so physics could not know where
  a leaf was. The open "collider" was a stand-in box at the cabinet's back.
- **New design:**
  - **Item data, `hinged`:** `angleDeg`, `swingS`, the leaves (each with its hinge and `opens`) and the
    carcass boxes.
  - **Geometry, `world/hinge.ts` (pure):** the eased angle, a leaf's pose, and the swept test against
    the player.
  - **`HingeSystem`:** the only authority on how far each leaf has swung. It is runtime only; a load
    or a save snaps it to the saved `open` state.
  - **Physics:** each leaf is a kinematic body, turned in the fixed step like a sliding leaf. The
    carcass is a fixed body with one collider per box.
  - **Renderer:** draws each leaf from the same fraction.
- **Cabinet colliders:**
  - Closed: the leaves are solid, the seam included.
  - Open: the mouth is truly open, with no invisible wall. The sides, back, top and floor stay solid.
- **Never into the player:**
  - Open and Close are refused while the whole swing would meet the player ("Step back to open
    it." / "… close it.").
  - A leaf that meets the player mid-swing waits where it is and goes on once they are clear.
- **Washroom door** (`teacher-room/door`, item `wc-door`):
  - A solid leaf hinged on the west jamb. It swings 90° out into the Teacher Room in 1 s.
  - The washroom side is never swept, and it does not reach the basin or the WC.
  - Parts: a painted casing; a flush leaf with no vision panel, unlike the sliding lab doors; steel
    knuckle hinges; a lever on a rose; an emergency release; a steel kick plate. The kick plate was
    first black, but in the stills it read as a gap.
  - A "WC / Toilet" sign ("WC / Nhà vệ sinh").
  - It uses the existing `openable` behaviour, with no airlock sequence.
- **Layout and Continue:**
  - The layout rules check the leaves wide open. A closed hinged door may close its own passage
    (P5); a fixture tests that a door moved along its wall is reported.
  - Continue checks a hinged item's leaves both closed and open (review fix).
- **Persistence:** the swing fraction is runtime only, and `open` stays the saved entity state.
  `SAVE_VERSION` is unchanged.

## 5. PPE models in the cabinet (worker `ux31-ppe`)

The models are built from the prop system's shapes and lofts. They are recognisable, not
photorealistic.

- **Lab coat** (660 triangles), matte, in the coat's colour:
  - a steel-wire hanger whose hook curls over the rail;
  - a shaped torso with sloping shoulders;
  - two sleeves with cuffs, a collar and lapels;
  - a placket with four press studs;
  - two patch pockets, a breast pocket and a hem band.
- **Safety goggles** (364 triangles):
  - two eye cups with skirts;
  - see-through lenses (glass finish);
  - a bridge, vents, buckles and a strap behind.
- **Face shield** (512 triangles), clearly different from the goggles:
  - a curved visor, 0.25 × 0.24 m, translucent, in the item's colour;
  - a dark brow frame and an edge binding;
  - a headband with side arms, a crown strap and a ratchet knob.
- **Cabinet interior**, fixed to match the placements (a placement's y is the item's bottom, which the
  UX3 interior had mixed up):
  - the goggles' shelf is now at 1.20 m;
  - a new upper shelf at 1.45 m holds the shield;
  - the rail is at 1.735 m.
  - A test ties these heights to `rooms.json`.
- **Unchanged:** item ids, colours, the coat's and goggles' boxes, the e2e aim points, `taken`, and the
  equipment and inventory behaviour.
- **Changed:** the face shield's box is deeper (0.05 → 0.18 m, x −2.68) to hold a curved visor. It
  stays in front of the open box and behind the closed doors (tested).
- **Cost:** about +1,550 triangles and +4 draws in the changing room.

## 6. Faucet water (worker `ux31-water`)

- **Root cause:** the water was a static, capped cylinder in one matte colour. It ended 15 cm above
  the bowl.
- **Now (`render/water.ts`):**
  - **Shape:** a tapered open column from the spout's mouth to 2 mm above the bowl floor (tested
    against the basin's geometry).
  - **Look:** streaks scroll down at about 1.2 m/s, the edges are more opaque, and there is a highlight
    and a slight width variation. A small ripple disc sits where it lands.
  - **On / off:** the water falls in from the mouth in about 0.12 s. When turned off, its tail falls
    away and nothing is left. A save with the water running shows it at once.
  - **Implementation:**
    - one shared geometry;
    - one unlit `ShaderMaterial` pair, with tone mapping and colour space included;
    - one time uniform;
    - no particles and no per-frame allocation;
    - its programs are compiled ahead.
- **Cost** (RTX 5070, headless):

  | Faucet  | Frame rate | GPU time | Draws |
  | ------- | ---------- | -------- | ----- |
  | off     | 300 fps    | 2.39 ms  | 138   |
  | running | 299.3 fps  | 2.45 ms  | 140   |

## 7. First door open: the stall before the leaves move

**Measured breakdown before the change** (RTX 5070 headless, dev build; the temporary timers have been
removed):

| Part of the attach                        | First open | Re-open |
| ----------------------------------------- | ---------- | ------- |
| Spawn (label canvases, first prop builds) | 34.7 ms    | 6.8 ms  |
| SceneAttached                             | 15.5 ms    | 2.9 ms  |
| Synchronous `compile()`                   | 11.6 ms    | 4.4 ms  |

**What changed:**

- **Neighbour pre-build:** the neighbouring scenes' prop geometry and labels are built ahead of the
  attach.
  - During a load, before its first frame.
  - After a walk-through, in idle moments, one task per callback.
  - Bounded to the 2–4 scenes a door joins; nothing else is preloaded.
- **Compile:** runs one frame after the attach, not inside it, and only over the attached scene's
  objects.
- **Warm-up:**
  - It draws only one object per geometry, program and texture.
  - Its batch adapts to spikes over the usual frame time. Review fix: it no longer drops to 1 object
    below 165 Hz.
  - The shadow pass runs only for a caster kind not yet drawn.
- **Programs:** kept for the session, as in UX3.

**Results** (RTX 5070 Laptop, ANGLE D3D11, headless Edge, dev build, 1280 × 720, 300 fps cap; idle
worst frame 6.7 ms):

|                                        | UX3.1 baseline       | UX3.1 final                  |
| -------------------------------------- | -------------------- | ---------------------------- |
| First open: E → motion                 | 360 ms               | 203 ms                       |
| First open: worst frame, still closed  | 66.6 ms (68 ms task) | 33.3 ms (no long task)       |
| First open: worst frame moving         | 3.5 ms               | 6.7 ms (one double interval) |
| Repeat open: E → motion                | 107 ms               | 97–107 ms                    |
| Repeat open: worst frame, still closed | 20 ms                | 20 ms                        |
| Repeat open: worst frame moving        | 3.5 ms               | 3.5–3.7 ms                   |

**Left:** the 20–33 ms frames on a first open are GPU-process work done at an object's first draw, per
program and vertex layout.

- It can be spread out, but not removed without a new WebGL context or preloading every scene.
- It all happens while the door is closed and "Opening…" shows. The motion itself is smooth.

## Verification

| Check                               | Result                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| `npm run check`                     | PASS: 84 files, 1856/1856                                        |
| E2E `npx playwright test` (1st run) | FAIL: 68 passed, 2 failed, 4 did not run (SwiftShader, 13.4 min) |
| E2E `npx playwright test` (2nd run) | PASS: 74/74 (SwiftShader, 13.7 min)                              |
| `npm run build`                     | PASS                                                             |
| Menu budget                         | PASS: `index-*.js` 498,083 B < 500,000 B (1,917 B left)          |
| three.js in menu                    | PASS: none; `WorldRenderer-*.js` 686,900 B                       |
| GPU bench `--project gpu-headless`  | PASS 4/4 (see below)                                             |
| Door pacing (GPU probe)             | Motion PASS; a first open has 20–33 ms frames while closed       |
| Visual / route QA                   | NOT RUN (Lead stills only)                                       |

- **GPU bench:** 296.8–300 fps, GPU 2.34–2.54 ms. Draws are unchanged (334 / 288 / 335 / 337).
- **First e2e run, 2 failures:**
  - `world.spec` expected the old preparation physics counts: 15/33, now 17/39 because of the
    cabinet's carcass and leaves.
  - `experiment.spec` failed a timing-sensitive projectile STOP. The 3.3 s flight ended first, at about
    20 fps, while review agents were loading the machine. It passed in the 2nd run and in both UX3
    runs.
  - The 4 that did not run were the dependent dev-timed specs. One of them walks the washroom
    doorway, and the review found it must open the new door first; that is now fixed.
- **Menu budget:** the UX3.1 code and content first pushed the menu chunk to 501,857 B.
  - The dev-only debug panel is now built only under `import.meta.env.DEV`, so production no longer
    ships its dead code.
  - The guard itself is unchanged.
  - Headroom is now small (1,917 B).

### Assertions changed (behaviour changed on purpose)

- **Door timing:**
  - `content.test`: shipped `openS` / `closeS` 0.8 → 0.6.
  - `DoorSystem.test`: assertions that both leaves move together became per-leaf; all 30 existing
    tests kept, 15 added.
  - `Game.test`: open wait 60 → 90 frames.
  - `residency.test`: 50 → 90 frames.
  - `doorLeaves.test`: 24 → 18 frames (half of one 0.6 s leaf).
  - e2e `walkThrough`: waits for `open 1.00 1.00`.
- **Cabinet and hinges:**
  - `PhysicsSystem.test`: checks the real leaves and carcass (closed 1.428 m, open 1.982 m); counts
    15/33 → 17/39.
  - `layoutSweep`:
    - counts (prep 17/39, teacher 14/29);
    - a formula that counts hinged bodies;
    - the doorway walk opens hinged doors first.
  - `InteractionSystem.test`: waits for the swing; the "step back" spot moved outside the swing.
  - `WorldRenderer.test`: the renderer reads the hinge system.
  - `Game.test`:
    - the washroom walk opens the door first;
    - the system list gains `hinges`;
    - interactables 29 → 30 and 8 → 9.
  - e2e `game.spec`: entities 33 → 35, and the door is opened before the walk.
  - e2e `world.spec`: 15/33 → 17/39.
  - `layout.test`: a P5 fixture for an open leaf.
- **Trim:** `washroom.test`: the shipped wainscot height 1.2 → 1.1.

## Files changed

- **Docs:** `docs/architecture.md`, `data-model.md`, `interaction.md`, `physics.md`.
- **e2e:** `e2e/game.spec.ts`, `support.ts`, `world.spec.ts`.
- **Content:** `src/content/items.json`, `rooms.json`, `strings.json`.
- **Game:** `src/game/Game.ts`, `Game.test.ts`, `content.ts`, `content.test.ts`.
- **Doors:** `src/gameplay/door/DoorSystem.ts` (+ test), `HingeSystem.ts` (new, + test).
- **Interaction:** `src/gameplay/interaction/InteractionSystem.ts` (+ test), `behaviors.ts`.
- **Items:** `src/gameplay/item.ts`, `props.ts`.
- **Entry point:** `src/main.ts`.
- **Physics:** `src/physics/PhysicsSystem.ts` (+ test), `layoutSweep.test.ts`.
- **Renderer:**
  - `src/platform/render/WorldRenderer.ts` (+ test), `decorBatches.ts`, `roomShell.ts`,
    `doorLeaves.test.ts`;
  - `water.ts` (new, + test);
  - `props/preparation.ts` (+ test), `props/washroom.ts` (+ test), `props/content.test.ts`.
- **UI:** `src/platform/ui/DebugPanel.ts`.
- **World:** `src/world/hinge.ts` (new, + test), `arrival.ts` (+ test), `layout.ts` (+ test),
  `residency.test.ts`.

## Remaining limitations

- **Visual and route QA on the real 300 Hz display: NOT RUN.** It covers:
  - the trim from several angles, in motion;
  - the doors opening one after the other;
  - aiming and prompts;
  - the PPE models;
  - the water on and off;
  - collisions with the cabinet and the washroom door;
  - z-fighting and clipping.
- **First open:** the first time a door is opened there are still 20–33 ms frames while it is closed
  (GPU-process work at first draw). Repeat opens stay at or below 20 ms.
- **Menu budget:** 1,917 B left. The next content addition needs a real split (for example, content
  loaded with the world).
- **Held leaves:** a leaf the player holds mid-swing stays where it is until they step away. This is by
  design (it never pushes them), but no notice is shown.
- **Glass:** the see-through lenses and visor are pale over the pale cabinet; judge them on the real
  display.
- **Worktrees:** `.claude/worktrees/ux31-*` and the older ones remain. Nothing in them is needed now.

## Next step

The user's visual and route QA on the real display. Then commit in logical commits: doors, hinges and
washroom door, PPE models, water, trim, first-open, docs.
