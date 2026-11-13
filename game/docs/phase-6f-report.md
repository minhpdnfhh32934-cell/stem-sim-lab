# Phase 6F report — free-fall station

Date: 2026-10-22 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Baseline

- **Start:** `619e9b2` "phase 6e: add teacher bathroom". Clean tree, one worktree, no remote.
- **Checks on that commit** (Phase 6E, same tree): `npm run check` PASS, 310/310 tests in 26
  files; `npm run test:e2e` PASS, 22/22.

## 2. Scope

Free fall is the roadmap's own example of the experiment engine (§7) and the first topic of
§8A P1. It was still the Phase 1 proof of concept: a console that ran the model once with its
default values, with no dials, no visible fall, no theory, graphs, results panel or history.

Approved design: a station in the Physics Lab's main room, on the 6B engine; the ball drawn from
the model like the pendulum's bob; the proof-of-concept console replaced; no mass dial (without
air resistance the mass does not enter).

Not in scope: air resistance, a mass dial, a steel ball the player loads, drawing only the rooms
near the player.

## 3. Change

**Model** (`simulation/models/freeFall.ts`): `predict` gives the theory, t = (v₀ + √(v₀² + 2gh))/g
and v = −√(v₀² + 2gh); from rest, t = √(2h/g) and v = −√(2gh).

**A third kind of apparatus** — what `experiments.md` says a new kind needs, and nothing else:

- **Geometry:** `dropTower { landing, ballRadius }` on the item (`gameplay/item.ts`). The item's
  box is the column, so the column is solid and inspectable.
- **Behaviour:** `drop-tower`, no actions, like `pendulum`; the content check accepts it as a
  station.
- **`StationSystem`:** the `drop` kind is ready at once (nothing to load), supplies no inputs and
  refuses a release higher than the room and the column allow:
  min(room height − 0.3 m, column) − 2r, 3.15 m here. `dropHeight` and `releaseHeight` give what
  views draw: the run's height, else the dial's.
- **`ExperimentView`:** the tower's rig in its own frame — base plate, a scale reading heights from
  the floor, a landing pad, the release clamp and the 50 mm ball — posed every frame from the
  session, with no allocation. The ball has no physics body.

**Definition** (`experiments.json`, same id, ids, sampling and defaults as before):

- dials h 0.2–3 m (0.1 m steps, default 1.5 m), g through Moon, Mars, Earth and Jupiter, the
  timer's resolution d (0.001, 0.01, 0.1 s); v₀ = 0 as an initial condition, shown as an input;
- measurements y, v, a; results fall time and impact velocity, each with its theory;
- graphs y–t (the monitor's, with the theory's fall time marked), v–t and a–t; y–t and v–t
  compared across runs;
- an instrument, "Timer (light gates)", reading the fall time to d; a note; a five-step checklist.

**World** (south-east of the Physics Lab's main room): the tower, a control desk with the h, g and
d dials, RUN, STOP and RESET, the desk screen, a results monitor on the east wall and an
instruction board on the south wall. It keeps clear of the bench, both openings, the grab test's
throwing lane (z ≈ −1.3) and the Continue test's standing point (2, 0, 1).

**Removed:** the proof-of-concept console — its placement, the `experiment-console` item, the
`experiment-station` behaviour, the `ExperimentRequested` event and `ExperimentSystem`'s one-shot
path. Nothing else used them.

**Docs:** `experiments.md` (a Free fall section, playing it, what is saved, adding an
experiment), `interaction.md`, `data-model.md`, `architecture.md`, `game-core.md`, the README
status and `CLAUDE.md` (the ball, like the bob, has no physics body).

## 4. Tests

- **New:**
  - `models/freeFall.test.ts` (3): the theory is the textbook release from rest and the upward
    throw; the stepped run equals the theory (10⁻¹² for t, 10⁻¹⁰ for v) at h = 0.2, 1.5, 3 m and
    every g preset.
  - `FreeFallStation.test.ts` (7): ready at once; the dials' grid, limits and presets, mirrored
    into entity states; refusals while running and before RESET; a run drawn from the model every
    frame with no physics body, results equal to the theory, progression and the timer's reading
    (text, u = d/√12, d/2); STOP freezes the ball, RESET puts it back in the clamp; a release too
    high for a 2.7 m ceiling refused with the reason; Continue restores h and g.
  - `e2e/free-fall.spec.ts`: from Continue, no developer jump — the objective, the board, h to
    2.5 m, RUN, the desk line and HUD (t, v), the monitor, the results panel (theory, simulated
    and difference for both results; the timer's 0.71 s, d, u, d/2; the note; three graphs),
    RESET, the Moon's g, RUN again; no console errors; five screenshots.
- **Updated, and why:**
  - `Game.test.ts`: the console test runs the same check through the station's RUN button (same
    assertions); the dispose test no longer lists the removed event.
  - `ExperimentRuntime.test.ts`: its fixture opens h to 0.1–100 m again — the shipped range is now
    the tower's; every assertion unchanged.
  - `ExperimentSession.test.ts`: no `init()` (the system subscribes to nothing now).
  - `content.test.ts`: the shipped instruments include free fall's timer.
  - `PendulumStation.test.ts`: in the lab's main room the active station is now its own (the
    tower); the fallback to the scene's first station is checked in a doorway instead.
  - The lab's counts, from its new contents (−console, +tower, +desk, +controls): `hold.test.ts`
    46 → 56 entities; `PhysicsSystem.test.ts`, `game.spec.ts` and `grab.spec.ts` 17 → 18 bodies,
    40 → 41 colliders. The check that counts stay stable across scene changes is unchanged.
  - `experiment.spec.ts`: the launcher's first state and its settings after leaving the lab are
    checked in the range, where the HUD and debug panel follow it now; same expected values.
  - `game.spec.ts`: the console's e2e test is removed with the console; `free-fall.spec.ts` covers
    running an experiment.

## 5. Verification

| Check                                        | Result                                                                         | Duration |
| -------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| `npm run check`                              | **PASS**: 320/320 unit tests (310 + 10 new), 28 files; typecheck, lint, format | 19 s     |
| `npm run test:e2e`                           | **PASS**: 22/22 in the final run, 3 workers; includes the production build     | 356 s    |
| `npm run bench` (`gpu-headless`, `software`) | **PASS**: 7 passed, 1 skipped by design (the frame-rate sweep is GPU only)     | 256 s    |
| bench `gpu`, `gpu-native`                    | **NOT RUN**: visible windows that capture the physical mouse                   | —        |
| `npm run build`                              | **NOT RUN** separately: the e2e and bench web servers build it                 | —        |

**E2E, all four runs:**

1. `experiment.spec` failed: it read the launcher's state in the lab's main room, which now shows
   the tower's. Fixed by reading it in the range.
2. `grab.spec` failed: its lab count, 17 bodies and 40 colliders, is now 18 and 41. Fixed.
3. `experiment.spec` failed at its STOP step: the 3.3 s flight ended before STOP arrived, at 21–27
   fps (SwiftShader, three workers). The four `dev-timed` tests did not run.
4. 22/22 PASS, with that test unchanged.

**Visual check** (software WebGL; reviewed): `test-results/free-fall-1-tower.png` …
`free-fall-5-results.png` from the e2e run, and two close-ups from a throwaway walk-through
outside the repository (same browser setup, dev server): `phase-6f-verify/ff-close-1-ball-in-
clamp.png` (the ball under the clamp at the 1.5 m mark) and `ff-close-2-ball-on-pad.png` (on the
pad after the run).

## 6. Performance

`npm run bench -- --project=gpu-headless --project=software`.

**GPU** (`gpu-headless`, RTX 5070 Laptop, D3D11, 1280×720):

| Scenario                                     | fps                     | CPU mean (ms)             | GPU mean (ms)             | Draws (6C.5)                             |
| -------------------------------------------- | ----------------------- | ------------------------- | ------------------------- | ---------------------------------------- |
| range: idle / interacting / running / landed | 300 / 299.7 / 296 / 300 | 0.51 / 0.43 / 0.60 / 0.59 | 2.38 / 2.12 / 2.19 / 2.25 | 104 / 80 / 105 / 107 (73 / 66 / 74 / 76) |
| pendulum: idle / swinging / after            | 299 / 300 / 300         | 0.54 / 0.57 / 0.48        | 2.36 / 2.13 / 2.39        | 98 (84)                                  |
| history: closed / 2 / 4 runs compared        | 300                     | 0.38 / 0.39 / 0.41        | 1.96 / 1.96 / 2.01        | 78 (64)                                  |

**Software** (`software`, SwiftShader), fps: range 41.9 / 38.2 / 30.7 / 40.2 (6C.5: 43.5 / 38.0 /
34.6 / 43.5); pendulum 44.5 / 38.0 / 44.8 (46.1 / 39.7 / 46.6); history 45.6 / 43.1 / 43.7 (46.5 /
44.6 / 45.8). Those are from another day; 6C.5 found its machine's state moving them by more.

**Where the draws come from.** The station adds 14 draws everywhere in the Physics Lab scene: its
shadow casters, drawn into the enhanced lighting's shadow map wherever the player stands. In the
range views it adds 31, because the camera's frustum reaches it through the wall; three.js does
not cull what walls hide. On the GPU that costs 0.1–0.35 ms of a 3.3 ms frame, and it still
reaches the 300 fps cap. Under SwiftShader the range scenarios lose 2–4 fps.

## 7. Invariants

Unchanged: `SAVE_VERSION` and `src/persistence` (the tower's settings are entity states like
every station's; the console had none, so no save needs a migration), the projectile and pendulum
models, `RunRecord`, the CSV, `measurement.ts`, the `PoseDriver` (the ball never has a body) and
`package.json`.

## 8. Limitations

1. **Draw cost in the other rooms.** See §6. Under SwiftShader the range's timing-sensitive STOP
   step in `experiment.spec` failed once in four runs, plausibly made more fragile by the extra
   draws. A follow-up could draw (and shadow) only the player's room and its neighbours.
2. **Physics left out by design:** no air resistance, and no mass parameter.
3. **The ball is drawn, not an object:** it cannot be picked up; only the column is solid.
4. **A 3 m drop at most,** set by the room's 3.5 m ceiling.
5. **Visual checks on software WebGL only;** the GPU figures are from the bench, with no
   visible-window screenshots.
6. **Runs and history are not saved,** as at every station.

## 9. Commit

Not committed: waiting for the user's approval. Nothing pushed (the repository has no remote).
