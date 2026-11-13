# Phase UX3 report: interaction, environment and inventory polish

Date: 2026-10-28.

- **Base:** `main` at `a1ca48c` plus the uncommitted phases W0, WX, UX1 and UX2
  ([phase-ux2-report.md](phase-ux2-report.md)).
- **State:** everything here is uncommitted, and nothing is pushed.
- **Who did what:**
  - The Lead did the door stutter, the PPE cabinet, the gloves and the room lighting.
  - Three workers built door hardware (`ux3-doors`), the teacher's washroom and ceilings
    (`ux3-rooms`), and the notification strip and equipment panel (`ux3-ui`), each in its own
    worktree under `.claude/worktrees/`. The Lead merged them file by file.

## Verdict

**PARTIAL.** Every automated check passes (see Verification). The manual visual and route QA on
the user's display — RTX 5070 Laptop, 2560 × 1600, 300 Hz — has not been done. The only stills
were taken on that GPU, headless, at 1280 × 720, by the Lead.

## 1. PPE cabinet (`wardrobe`)

- **Old behaviour.** `visual.openOffset [-1.25, 0, 0]` moved the whole cabinet 1.25 m sideways,
  in three places: the renderer's mesh, the interaction box and the physics collider. The PPE
  inside became reachable because the cabinet slid away from it.
- **New mechanism.**
  - Prop parts can name a `Hinge` (`props/parts.ts`). `attachParts` hangs each leaf's parts from a
    pivot at its hinge. A leaf's body part uses the entity's own material, so focus shows on it.
  - The cabinet (`props/preparation.ts` `ppeCabinet`) is a carcass with a floor, a shelf (goggles,
    shield) and a hanging rail (coat). It has two leaves, hinged on its outer front edges.
  - `openOffset` is replaced by `visual.openBox` (`gameplay/item.ts`). While the item is open, its
    collider and its interaction box are that box; the item never moves. For the cabinet it is its
    back 0.23 m: the player can reach the PPE through the open doors and aim at the back to close
    it.
- **Animation.** Done in the renderer only (`WorldRenderer.swingLeaves`):
  - 110° in 0.5 s, smoothstep eased;
  - only while a leaf is moving (a `swinging` set, no allocation);
  - reversible mid-swing;
  - drawn open at once when a save restores an open cabinet.
- **Collider.**
  - Closed: the whole box.
  - Open: `openBox`. `collider.setHalfExtents` sizes it, and the fixed body carries it to the
    box's centre; queries see the change at once. The entity's pose never changes.
  - **Close** is refused ("Step back to close it.") while the player's capsule is inside the whole
    box, so the cabinet never closes on them.
  - The swinging leaves have no collider (see Limitations).

## 2. Doors

- **Visual redesign.**
  - New prop `door-leaf`: frame, inset panel, opaque vision panel, kick plates, flush pull.
  - Around each door: header, rail, a jamb (sealed in clean areas) and plates.
  - Area colours: white and sealed (clean areas), steel (labs), dark painted (lobby), aluminium
    (teacher room).
  - Builder: `props/doors.ts`.
- **Root cause of the stutter.** Measured on the RTX 5070 with a frame timeline, a CDP profile and a
  Chrome trace (temporary probe, removed). The state machine was not at fault: `DoorRequested` →
  `preparing` → `opening` happens at once, and the leaves move in the fixed physics step.
  1. **CPU at attach: a 131 ms frame.** The far scene is spawned in one task. Label canvases took
     27 ms of it, redrawn and uploaded on every attach.
  2. **Shader stall in the first opening frames: 136 ms.** Every new material compiled
     synchronously in the frame that first drew it (`setProgram`, `getProgramInfoLog`). Measured
     behind it:
     - Even after an async compile, the first use of a program blocked about 60 ms in
       `GetProgramiv`. On ANGLE/D3D11 the work at first draw runs in the GPU process.
     - Every re-attach recompiled: three frees a program with its last material, so a scene
       detached and attached again linked again (6 links on every re-open, a 77–107 ms frame).
  3. **The leaf then jumped.** The first opening step after the hitch used the long frame's time
     (0.1 s cap), so the leaf jumped 12.5 %.
- **Fix.**
  - `SceneManager.attach` now awaits `settleAttach` after `SceneAttached`. `Game.addAttachSettle`
    lets the renderer register its step. The door stays `preparing` until the step is done.
  - `WorldRenderer.precompile`:
    - **Hide.** Everything the attach brought — the scene's rooms, decor and entities, whatever
      their materials — waits on a layer no camera or light sees. A material already drawn may
      still need a new program for an object (instanced or not), and nothing of the scenes already
      there is touched.
    - **Compile.** `compileAsync` runs, using `KHR_parallel_shader_compile`.
    - **Keep.** Each new program is used once and kept for the session.
    - **Warm.** The objects are drawn once into one pixel of the canvas, 40 per frame, just before
      the frame clears it — the canvas's own programs, with their shadow-pass programs too.
    - **Show.** After 3 more frames they are shown.
  - Label textures are cached per item and language.
  - Immediate feedback: from the press, the prompt reads "Opening…" ("Đang mở…").
  - No dt clamp was added to the door. With the stall gone it is not needed, and the door stays
    time-true at any frame rate.
- **Performance** (RTX 5070 Laptop, ANGLE D3D11, headless Edge, dev build, 1280 × 720, 300 fps cap;
  idle worst frame 6.6 ms):

  | Open                   | Before: worst frames            | After: worst frame while moving | After: E → motion |
  | ---------------------- | ------------------------------- | ------------------------------- | ----------------- |
  | First (lab never seen) | 136.6 ms and 53 ms (131 ms CPU) | 3.5 ms                          | 443 ms            |
  | Again (re-attach)      | 106.7 ms (104.7 ms CPU)         | 3.6–3.8 ms                      | 117–127 ms        |

  The frames while preparing, with the door still closed, are not smooth:
  - first open: one attach frame of 83 ms (spawn), then 20–30 ms frames during the warm-up;
  - re-open: 13–23 ms frames.

## 3. Teacher's washroom (worker `ux3-rooms`)

- **Fixtures.**
  - Toilet: close-coupled, back to wall, seat and lid, dual flush.
  - Wall-hung basin with a lever mixer and a bottle trap. The item is now 1.0 m tall, so the tap
    is inside its box.
- **Walls and fittings.**
  - A 200 mm tile wainscot round all four walls, with an aluminium trim.
  - A deeper-tone splashback, a mirror with a lit bar above it, and a "Wash your hands" sign (in
    English and Vietnamese).
  - Soap and towel dispensers, a static bin, a toilet roll holder and a ceiling vent.
- **New finishes:** `seat-white`, `mirror` (glass, 0.85), `grout`.
- **Lighting:** its own key light, as since UX2. The mirror light only glows; it is not a light.

## 4. Gloves

- **State model.**
  - A new item flag, `disposable` (the nitrile gloves). Once worn they are used.
  - `wear` never offers **Take off** for disposable PPE, at the dispenser or anywhere.
- **Waste bin.**
  - A new behaviour, `waste-bin`, on the corridor's pedal bin (no longer decor; it can also be
    inspected).
  - It offers **Discard used nitrile gloves**. `Equipment.remove(id, true)` publishes
    `EquipmentChanged { discarded: true }`, and the HUD shows "Discarded: Nitrile gloves, used".
  - A fresh pair comes from the dispenser.
  - The clean-area interlock also refuses discarding required PPE while the entrance is not closed.
- **Persistence.** Unchanged. The save lists what is worn, and a used pair is never anywhere to take
  back. `SAVE_VERSION` is unchanged; there is no new inventory system and no new state.

## 5. Lighting

- **Lobby vs labs.** Room-local lights only (UX2), with no exposure or global change:
  - labs (physics, range, bay, chemistry, biology): key 3.8 and fill 1.6;
  - hub: oculus key 2.6 and fills 1.0;
  - preparation area and teacher rooms: the defaults (3 / 1.2).
- **Measured** (stills, mean luma, RTX 5070 headless):

  | View              | Mean luma |
  | ----------------- | --------- |
  | Physics Lab       | 108.7     |
  | Chemistry Lab     | 105.1     |
  | Biology Lab       | 99.0      |
  | Hub spawn         | 94.8      |
  | Hub, physics door | 70.1      |

  The labs read brighter and flatter, the lobby softer. All lighting tests pass, Physics Lab
  ceiling and pendulum bay included.

## 6. Notifications (worker `ux3-ui`)

- **Old problem.** Separate floating toasts, rebuilt on every change.
- **New design.**
  - One slim status strip at the top centre, in the protocol plate's surface.
  - One line per notice, with a 16 px marker as its only colour: ✓ i ↳ ! ×. The newest line is on
    top in full ink; older lines are dimmer, separated by hairlines.
  - Only a new line fades in (0.18 s). A leaving line drops its class at once and fades out (0.14 s).
  - With reduced motion there is no animation.
- **Unchanged.** Kinds, keys, expiry and `MAX_NOTICES`.

## 7. Ceilings (worker `ux3-rooms`)

- **Six shared props:**
  - `fixture-trim` (round each light; lab housings);
  - `air-diffuser`;
  - `ceiling-grille`;
  - `access-panel`;
  - `cable-tray`;
  - `coffer-ring`: in the hub, a stepped ring of 16 coffers with a cove band round the oculus, and
    two secondary ribs.
- **Reuse.** All of it is decor: instanced per scene, `body: none`, no shadow, above every station
  zone.
- **Cost.** A few draws per scene (+3 hub, +9 labs, about +40 teacher room with washroom). The
  bench shows +13 to +18 draws in the Physics Lab views (door hardware included).

## 8. Inventory (worker `ux3-ui`)

- **Character panel.** A flat SVG figure in the safety-sign style. Each worn item is drawn on it in
  its own colour: coat, gloves, goggles band, face shield.
- **Equipment slots.** Eyes, face, body and hands (`Record<WornOn, …>`), each "Not worn" or the item.
  The panel reads `game.equipment.worn` and redraws on `EquipmentChanged` and `LanguageChanged`. It
  is read-only, and there is no new WebGL context.
- **"Lấy ra" / "Take out".** A compact action with an arrow-out-of-tray icon, a 34 px accent
  outline and the menu's focus ring. Its accessible name is unchanged.
- **Note.** It now reads "put it back where you took it; used gloves go into the waste bin".

## 9. Verification

All runs were on 2026-10-28.

| Check                     | Result                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| `npm run check`           | PASS: 81 files, 1780/1780 (typecheck, lint, format, vitest)                      |
| E2E `npx playwright test` | PASS: 74/74, 13.3 min (SwiftShader, software WebGL), after the review fixes      |
| `npm run build`           | PASS                                                                             |
| Menu budget               | PASS: `index-*.js` 495,543 B < 500,000 B (UX2: 473,529)                          |
| three.js in menu          | PASS: no `__THREE__` in the menu chunk; only in `WorldRenderer-*.js` (677,167 B) |
| GPU bench                 | PASS: `playwright test -c playwright.bench.config.ts --project gpu-headless` 4/4 |
| Door frame pacing         | Motion PASS; preparing phase not smooth (see Doors)                              |
| Visual / route QA         | NOT RUN by the user (Lead stills only)                                           |

- **GPU bench detail.** RTX 5070 Laptop, ANGLE D3D11, headless, 1280 × 720, 300 fps cap:
  - Physics Lab, pendulum bay and run history: 299.5–300 fps (296 with the ball in flight).
  - GPU time 2.36–2.54 ms, against 2.56–2.81 ms in UX2.
- **Door frame pacing** (same GPU, dev build; a single 10.3 ms frame once while the first close
  releases the scene behind): worst frame once the leaf moves is 3.5–3.8 ms, against
  136.6 ms before.
- **Stills.** 18 views, 1280 × 720, same GPU (cabinet closed and open, corridor bin, doors, washroom,
  hub ceiling, labs, inventory, notice strip), taken by the Lead — not the user's visual QA.

### Assertions changed (behaviour changed on purpose)

- **Cabinet no longer slides:**
  - `PhysicsSystem.test.ts`: two wardrobe tests rewritten (the collider becomes its back while
    open; the body stays).
  - `layout.test.ts`: the "P4 … when open" case becomes a lamp inside the closed cabinet.
  - `decor.test.ts`, `decorBatches.test.ts`, `propsWiring.test.ts`: `openOffset` → `openBox`.
- **Props with hinges:** `props/testing.ts` `expectProp` now requires one body off the leaves and
  one part per finish and leaf.
- **Gloves are discarded, never taken off:**
  - `ProcedureSystem.test.ts`: four tests take the gloves off at the waste bin, not the dispenser.
  - `doors.test.ts`: the interlock case discards at the bin.
  - `e2e/preparation.spec.ts`: both glove take-offs become discards, and the notice is checked.
- **Counts:**

  | Count                                            | Old → new     | Reason                         |
  | ------------------------------------------------ | ------------- | ------------------------------ |
  | `Game.test` preparation interactables            | 20 → 21       | the bin                        |
  | `Game.test` with the teacher room attached       | 28 → 29       | the bin                        |
  | `Game.test` preparation entities                 | 38 → 55       | door hardware +7, ceiling +10  |
  | `hold.test` physics scene                        | 69 → 91       | lab 43, range 28, bay 20       |
  | `stationZones.test`                              | 69 → 91       | as `hold.test`                 |
  | `layoutSweep.test` teacher room bodies/colliders | 11/27 → 12/28 | the washroom bin               |
  | `e2e/game.spec` teacher-room entities            | 15 → 33       | door hardware +3, washroom +15 |

- **Rule change (doors worker):**
  - `doorBands.test` exempts `door-trim` pieces, with a new sweep test that they stay flush and out
    of the leaf's path.
  - `content.ts` leaf check ignores bodiless placements (only solids block a leaf).
- **New tests:**
  - the attach settle and the "Opening…" prompt;
  - the cabinet's hinged leaves (eased, reversible, open from a save);
  - reaching the PPE through the open cabinet;
  - never taking used gloves back;
  - the notice markers;
  - the door props;
  - the washroom and ceiling props.

### Independent review

A read-only multi-agent review (4 areas, each finding checked by 2 skeptics) confirmed 5 defects and
split on 1. All are fixed:

- **Variants missed (medium).** The precompile chose objects by material, so a new program variant
  of an already drawn material (instanced vs plain) still stalled. It also hid objects of the
  current scene. It now hides and warms exactly the attached scene's objects.
- **Closing on the player (medium).** Closing the cabinet with the player inside its volume left
  the capsule in the collider. Close is now refused until the player stands clear.
- **Stale collider (low).** For one step after opening or closing, the collider had its new size at
  its old place. The body now carries it, and queries see it at once.
- **Reduced motion (low).** It did not stop the notice fade-out (CSS specificity). Fixed.
- **Inventory note (low).** It still said "take it off where you put it on" for gloves. It now
  names the bin.
- **Split, kept as a limitation.** The open cabinet's sides, shelf and leaves are not solid.

## 10. Remaining limitations

- **Manual QA not done.** The user's visual and route QA (Preparation → Lobby → Physics → Chemistry
  → Biology → Lobby → Preparation, 300 Hz) has not been done. Every timing above is from a headless
  window on the dev build.
- **Preparing is not smooth.** The first time a scene is attached in a session, the door waits
  about 0.4 s (re-open about 0.12 s) with "Opening…" shown. Frames of up to 83 ms (spawn) and
  20–30 ms (warm-up) happen while it is still closed. Only the motion is spike-free.
- **Programs are kept.** Shader programs are kept for the session (a few dozen), on purpose.
- **Software renderers.** SwiftShader has no `KHR_parallel_shader_compile`; there the compile
  waits are polled.
- **Cabinet leaves.** The open doors have no collider, and a player standing in front of the
  cabinet is swept through by a leaf. While open, the player can step into the cabinet's front up
  to its back box (closing then waits until they step back).
- **Menu budget.** 4.5 kB of headroom is left; the new content JSON is in the menu chunk.
- **Labels and language.** Labels are drawn in the language they were first shown in. This was
  already so; the cache keeps it.
- **Washroom mirror.** It does not reflect (no environment map at Medium): a light grey panel.
- **Hazard plates.** They hang inside the labs, beside the door; easy to move outside.

## Next step

The user's visual and route QA on the real display. Then commit in logical commits (doors,
cabinet, gloves, lighting, washroom and ceilings, notifications and inventory, docs).
