# Phase UX1 report: controls reference, preparation protocol UI, lighting across doors

Date: 2026-10-28. Base: `main` at `a1ca48c` plus the uncommitted phase WX work
([phase-wx-report.md](phase-wx-report.md)). Everything here is **uncommitted** and nothing is pushed.

## 1. Verdict

**PARTIAL.** Every automated check passes (section 6). The user has not yet looked at the result on
their own display (RTX 5070 Laptop, 2560 × 1600, 300 Hz). The visual QA below was done on headless
real-GPU stills and in the in-app browser.

## 2. Main menu: Controls

**Key audit.** These are the bindings in `src/core/config.ts` (`input.bindings`), plus the keys that
other code listens to directly:

| Action                                      | Key                             | Where it is handled                        |
| ------------------------------------------- | ------------------------------- | ------------------------------------------ |
| Walk                                        | W A S D, or the arrow keys      | bindings, `PlayerSystem`                   |
| Run (held)                                  | Shift                           | bindings                                   |
| Look                                        | mouse, once the view is clicked | `BrowserInput`                             |
| Interact: the action shown at the crosshair | E                               | `InteractionSystem`                        |
| The other action shown                      | F                               | `InteractionSystem`                        |
| Throw what is held                          | left mouse button               | bindings, only while the mouse is captured |
| Put away / take out                         | Q                               | `InventorySystem`                          |
| Hotbar slot                                 | 1–9                             | `InventorySystem`                          |
| Next or previous slot                       | mouse wheel                     | `Hud`                                      |
| Inventory                                   | I                               | `InventoryView`                            |
| Pause, or close a panel                     | Esc                             | `PauseMenu`, `InventoryView`               |
| Developer panel (dev build only)            | F3                              | `DebugPanel`                               |

There is no jump key and no Space binding, so neither is listed.

**Button and dialog.**

- A "Controls" button sits in the menu panel, below "Experiment catalog". Its Vietnamese label is
  "Phím điều khiển".
- It opens a native modal `<dialog>`:
  - Esc, the Close button or a click on the backdrop closes it, and focus returns to the button;
  - focus stays inside while it is open;
  - no scene change, no reload, no state lost.
- Content: four groups — Movement, Interaction, Inventory, System — plus Development in dev builds.
  Keycaps are on the left, what each key does on the right.
- The keys are read from the bindings (`ControlsPanel.ts`), so they follow the configuration.
  `keyLabel` now shows "Shift" and arrow symbols instead of raw code names.
- Layout: two columns where they fit and one column otherwise. It was checked at 1280 × 720,
  1024 × 640 (Vietnamese) and 2560 × 1600: no clipping, no horizontal scroll.

**Files:**

- new `src/platform/ui/ControlsPanel.ts`;
- `MainMenu.ts`, `dom.ts`, `styles.css`, `strings.json` (22 + 4 Vietnamese keys).

## 3. Preparation progress UI

**Concept: a protocol list.** The old plate had a thick coloured left border and stacked "name /
Step n of 15 · stage / instruction". The new one shows the procedure as a vertical stepper of its
stages, like a lab's safety protocol card:

```
CLEANROOM ENTRY                    5/15
 ✓ 01 Briefing
 ✓ 02 Gowning
 ● 03 Hand washing                 3/10
      Take soap from the dispenser.
 ○ 04 Hand disinfection
 ○ 05 Gloves
 🔒 06 Enter the clean area (SIMLAB Hub)
```

- **Why this concept.** The procedure is a sequence of named stages (`procedures.json`). A list
  shows at a glance:
  - what is done;
  - where the player is now, and how far into the current stage;
  - what is left;
  - that the door stays locked until the end.

  A progress bar shows only one number.

- **States, never shown by colour alone.**

  | State                             | Marker          | Text                                |
  | --------------------------------- | --------------- | ----------------------------------- |
  | done                              | check           | dimmed                              |
  | current                           | ring with a dot | bold, with the instruction under it |
  | pending                           | empty ring      | —                                   |
  | locked (the entrance until ready) | padlock         | —                                   |

  Each row also names its state for screen readers. A screen-reader line keeps the old sentence
  ("Step 4 of 15 · Hand washing").

- **Other outcomes.**
  - When the entrance is open, it becomes the current row ("Ready: …").
  - Entry blocked because PPE was removed: the reason shows under the locked entrance, in the
    caution colour.
  - "Entered": every row is done.
- **The timer.** A timed step's timer is a thin line under the instruction. It is the same element,
  updated each frame without allocation.
- **Interaction.**
  - The current row's detail fades in once (0.2 s).
  - A stage that has just been completed settles in once (0.24 s).
  - Nothing loops or pulses, and both animations are off under `prefers-reduced-motion`.
- **Experiment checklists** (the stations) use the same plate: name and count, a segmented rail
  with one segment per step, "Step n of N", then the instruction.
- **Size and placement.** Top left, `clamp(280px, 21vw, 340px)` wide. It still steps aside for the
  results panel. Checked at 1280 × 720 and 2560 × 1600.
- **Files:** new `src/platform/ui/protocolView.ts`; `Hud.ts`, `styles.css`, `strings.json`.

## 4. Lighting: Preparation Room ⇄ hub

### Root cause

Lighting is global: one hemisphere, one sun and one fill light, the renderer's tone mapping, the
scene's environment, and one shadow box. `WorldRenderer.setLighting` chooses all of it from the
lighting preset of the scene the player is in, and switches on `SceneEntered`.

Two problems follow:

1. **Two presets visible at once.** The preparation scene (Preparation Room and clean corridor) and
   the teacher room were `basic`; the hub was `enhanced`.
   - With the corridor door open, the hub was drawn under the corridor's basic lighting: no tone
     mapping, no environment light, no shadows. It looked flat and washed out.
   - At the threshold the whole rig flipped in one frame, and it flipped back on the way out.
2. **The shadow box covered only the current scene**, while the neighbour seen through the open door
   was outside it. This applied to every door, including hub ⇄ labs.

### Reproduction

- **In the app.** Continue a save with the procedure done, stand before the corridor door, press E,
  and walk through. Screenshots before the threshold show the hub without shadows; after it,
  shadows and tone mapping appear.
- **Measured.** A temporary probe (real GPU, headless) walked through in small steps with the HUD
  hidden. At each step it recorded the scene and the mean brightness of the whole view and of its
  middle (the doorway).

| Direction      | Before the fix: jump at the threshold (whole / middle) | After the fix | Largest change from one walking step |
| -------------- | ------------------------------------------------------ | ------------- | ------------------------------------ |
| Corridor → hub | +14.1 / +15.8                                          | −0.7 / −0.4   | 8.8–9.7                              |
| Hub → corridor | −19.6 / −31.7                                          | −0.1 / 0.0    | 6.0–7.3                              |

- The hub is the same after the fix whether it is walked into or loaded directly: both were
  compared at the same pose.

### Fix

- **Content.** `preparation-room` and `teacher-room` are `enhanced`, like the rest of the campus.
- **A boot check (`content.ts`) keeps it so.** Two scenes joined by a walk-through door must share
  their lighting; otherwise it reports "need the same lighting: one is seen through the door while
  the other lights the view".
- **Renderer.** `WorldRenderer.fitLights` fits the sun, the fill and the shadow box to the rooms of
  every resident scene, and refits on `SceneAttached` and `SceneDetached`. Walking through then
  changes nothing.
  - While a door is open, the shadow box is larger, so the shadow map covers more ground at lower
    resolution: 1024 px over about 37 m instead of about 18 m in the corridor.
  - It goes back to the current scene's fit when the door has closed behind the player.
- **Not changed.** No intensities, exposure or new lights; no per-frame work; the shadow pipeline,
  quality presets and renderer lifecycle are untouched.

### Verification

- Unit tests:
  - new `content.test.ts` "needs the scenes a door joins lit alike";
  - `WorldRenderer.test.ts` asserts that every world scene is enhanced;
  - `residencyRooms.test.ts` and `doorLeaves.test.ts` assert the fit over both resident scenes, the
    same fit after walking in, and the current scene's own fit once the other is released.
- The probe numbers above.
- Stills of the Preparation Room, corridor and Teacher Room in their new lighting.

**Changed assertions**, each encoding the replaced behaviour:

- `residencyRooms.test.ts` ("attaching changes no lighting"; "lights the scene walked into: the
  Physics Lab's fit");
- `doorLeaves.test.ts` (the lab's fit right after walking in);
- `WorldRenderer.test.ts`: the two basic-preset characterization tests now apply the basic preset
  explicitly, because no shipped scene uses it any more.

## 5. PlayerSystem wall-slide

PASS. It was investigated in phase WX (H.1 there).

- Cause: a Rapier character-controller artifact (a dropped slide step) that happens on continuous
  walls too.
- The test checks every step and allows at most one fully dropped step. It was mutation-checked.
- Nothing about it changed in this phase.

## 6. Verification

| Check                                                       | Result                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                             | PASS, 1429/1429, 77 files (an earlier run with the dev preview server still running: one `frameCap.test.ts` 5 s timeout; that file alone PASS 3/3, and the full rerun PASS)                                                                             |
| Playwright E2E (`npx playwright test --reporter=list,json`) | PASS 73/73 (13.7 min, SwiftShader; none flaky or skipped); then the new `e2e/controls.spec.ts` with `preparation`, `vietnamese` and `menu` specs: PASS 8/8                                                                                              |
| `npm run build`                                             | PASS                                                                                                                                                                                                                                                    |
| Menu JS budget                                              | 458,542 B < 500,000 (+7,317 B over phase WX)                                                                                                                                                                                                            |
| Three.js in the menu chunk                                  | none (`__THREE__` 0)                                                                                                                                                                                                                                    |
| GPU / performance                                           | lighting probe and stills on ANGLE NVIDIA RTX 5070 Laptop, D3D11, headless; no frame-time regression measured: `npx playwright test -c playwright.bench.config.ts --project=gpu-headless` PASS 4/4, the Physics Lab at the 300 fps cap, GPU 2.1–2.36 ms |
| Manual visual review on the user's display                  | NOT RUN                                                                                                                                                                                                                                                 |

## 7. Files changed

- New:
  - `src/platform/ui/ControlsPanel.ts`
  - `src/platform/ui/protocolView.ts`, `src/platform/ui/protocolView.test.ts`
  - `e2e/controls.spec.ts`
  - `docs/phase-ux1-report.md`
- Modified:
  - `src/platform/ui/MainMenu.ts`, `Hud.ts`, `dom.ts`, `styles.css`
  - `src/content/strings.json`, `scenes.json`
  - `src/game/content.ts`, `content.test.ts`
  - `src/platform/render/WorldRenderer.ts`, `WorldRenderer.test.ts`, `residencyRooms.test.ts`,
    `doorLeaves.test.ts`
  - docs (architecture, data-model, physics, interaction)

## 8. Remaining limitations

- Not yet seen on the user's display. To check there:
  - the lighting of the Preparation Room and the corridor (now enhanced, with shadows);
  - walking corridor ⇄ hub both ways;
  - the protocol plate and the Controls dialog at the user's Windows scale.
- Shadows of the current scene are coarser while a door is open: one shadow map covers both scenes.
- The in-app browser pane ran at about 1 fps while hidden, so motion was checked with the headless
  real-GPU probe instead.

## 9. Git state

HEAD `a1ca48c` on `main`, no new commits, nothing pushed. The working tree is dirty: phase WX and
this phase, both uncommitted.
