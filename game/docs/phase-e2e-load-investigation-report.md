# E2E load investigation — why Physics Lab specs failed in full runs

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed.

## 1. Verdict

**ROOT CAUSE FOUND — FIXED** for the failures seen in full runs with the normal configuration
(3 workers): every one was a dial left one or more steps short, because the e2e helpers clicked
on a fixed 80 ms rhythm while the game counts at most one press of a key per frame, and frames
grew longer than 80 ms under software rendering. Fixed in the test harness (clicks synchronised
to game frames); no product code changed. Two things remain, not fixed: the known STOP race at
`experiment.spec.ts:51` (separate mechanism, §5) and load-time limits that appear only at far
higher contention (8 workers, §3).

## 2. Baseline

- HEAD `51caa4a` (phase r4), clean working tree, nothing staged or untracked.
- Machine: AMD Ryzen 9 8940HX, 16 cores / 32 threads, 15 GB RAM, on mains power; Windows power
  scheme **"Silent"** (an OEM power-limited profile; not changed — system settings are out of scope).
- `npm run check`: PASS 417/417 · `npm run build`: PASS (JS 924.31 kB) — both again after the fix.
- E2E before the fix (normal config: `playwright.config.ts`, 3 workers, headless Microsoft Edge,
  `--use-angle=swiftshader`): full runs from the phase reports — R2 19 passed / 11 failed, then
  34/34; R3 24/8, then 31/1 (STOP race); R3.1 baseline 27/5, then 36/36; R4 baseline 24/8; R4 24/8.
  Intermittent; failures only in Physics Lab specs of the `dev` project. With one worker the R4
  failures passed (11/11; timed 4/4).

### Configuration audit (`playwright.config.ts`)

`workers: 3`, no `fullyParallel` (files in parallel, tests in a file serial), `timeout` 60 s, no
`retries`, `expect` default 5 s (the station helper `expectDebug` uses 15 s). Projects: `dev` (all
specs but production and the timed ones), `dev-timed` (`game`, `grab`; depends on `dev`, 1 worker),
`production` (`production.spec`, preview server built before the tests start). One `vite` dev
server shared by all workers (`reuseExistingServer`). Each worker launches its own headless Edge,
hence its own GPU process running SwiftShader; viewport 1280×720.

## 3. Failure matrix and measurements

**Frame rate in the Physics Lab (projectile desk) against browsers running at once** — a scratch
Playwright probe (not in the repo), K identical tests in parallel, each sampling its own frame
intervals for 8 s and its main thread's busy time (CDP `Performance.getMetrics`):

| Browsers at once | FPS each   | Sum of FPS | Frame p50 / p90 (ms) | Main thread busy |
| ---------------: | ---------- | ---------: | -------------------- | ---------------: |
|                1 | 41.5       |       41.5 | 16.7 / 33.4          |              6 % |
|                2 | 28.1, 28.3 |         56 | 33.3 / 50.0          |              7 % |
|                3 | 20.1–20.5  |         61 | 50.0 / 50–67         |              6 % |
|                4 | 15.8–16.0  |         63 | 66.6 / 66.8          |            5–6 % |

**Sustained load** — 3 browsers for 2 minutes, FPS per 10 s window and CPU counters (`typeperf`,
`% Processor Performance` relative to nominal clock):

| Time       | 0–50 s    | 50–60 s | 60–120 s |
| ---------- | --------- | ------- | -------- |
| FPS (each) | 19.4–20.8 | 12.2    | 6.7–7.9  |
| CPU perf.  | 151–154 % | 63 %    | 51–57 %  |

**The click race, reproduced** — one browser at the projectile desk, dial v₀ clicked 3 times,
4 rounds; frames slowed by enlarging the viewport (more pixels for the software renderer, the
page itself idle):

| Viewport  | FPS | Main thread | Clicks lost, 80 ms apart (old) | Clicks lost, frame-synchronised (new `dial()`) |
| --------- | --: | ----------: | -----------------------------: | ---------------------------------------------: |
| 1280×720  |  42 |         6 % |                         0 / 12 |                                         0 / 12 |
| 3840×2160 | 5.7 |         2 % |      **4 / 12** (one per dial) |                                     **0 / 12** |

Burning the main thread instead (9.5 FPS with a busy page) lost no click: key events then wait
for the frame to end, so each lands in its own frame — the real failures happened with an idle
page and a busy GPU process.

**E2E runs**

| Scope                           | Workers | Fix | Result                         | Duration | Notes                                                    |
| ------------------------------- | ------: | --- | ------------------------------ | -------: | -------------------------------------------------------- |
| Full suite (R4 phase)           |       3 | no  | 24 passed, 8 failed, 4 not run |  6.5 min | all 8: dials short by ≥ 1 step (below)                   |
| 5 failing lab files             |       1 | no  | 11/11 PASS                     |  8.0 min | (R4 phase)                                               |
| Timed specs (`--no-deps`)       |       1 | no  | 4/4 PASS                       |  1.2 min | (R4 phase)                                               |
| Full suite                      |       3 | yes | **36/36 PASS**                 |  7.5 min | CPU unthrottled (≈ 154 %) throughout                     |
| Full suite, again               |       3 | yes | **36/36 PASS**                 |  7.6 min |                                                          |
| All lab specs (`dev`, 10 files) |       5 | yes | **18/18 PASS**                 |  5.6 min | ≈ 12–13 FPS each (from the table above); CPU unthrottled |
| All lab specs (`dev`, 10 files) |       8 | yes | 12 passed, 6 failed            |  4.8 min | 5: scene load > 15 s at start; 1: `approach` gave up     |

**The 8 failures of the last full run before the fix** (R4), expected against received
`Station:` line: velocity 5 → got 5.5; angle 30 → 35; gravity 1.62 → 3.71; angle 30 → 35;
mass 2 → 1; resolution 0.001 → 0.01; resolution 0.001 → 0.01; stiffness 200 → 100 and offset
0.02 → 0.05. Every one a dial one or more steps short of its target.

## 4. Observations

- The game's own work is small: the page's main thread is 5–7 % busy in the lab at every
  concurrency (JavaScript about 5 %, layout and style about 0 %). Physics, simulation, DOM and UI
  updates are not what limits the frame rate.
- The frame rate falls as 1/K with K browsers while their sum levels off near 60 frames/s: the
  limit is a shared resource outside the page — the SwiftShader software rasterizer in each
  browser's GPU process, which spreads its work over the CPU's cores.
- One browser renders the lab at 40–42 FPS, in line with the 30–46 FPS Phase 6F measured on
  SwiftShader: no sign of a rendering regression in the product, so an older commit was not
  rebuilt for comparison.
- Under sustained load this laptop can throttle to about a third of its boost clock (152 % → 51 %
  of nominal after ~50 s in one probe), dividing the frame rate by about three: 20 → 7 FPS with 3
  browsers. It is intermittent: during the first post-fix full run the CPU stayed at ≈ 154 % for
  all 7.5 minutes. The FPS 10–11 readings of the failed runs match a throttled episode with 3
  browsers.
- Input: `InputState.press` adds the action to a `Set` of this frame's presses, cleared once per
  frame (`endFrame`). Two presses of the same key handled before the next frame count once — by
  design, one action per key per frame. The e2e `dial()` helper (and local copies in
  `experiment.spec.ts` and `pendulum.spec.ts`) clicked, waited 80 ms and clicked again. With an
  idle page each key event is handled at once; when a frame lasts more than 80 ms (under about
  12.5 FPS) two clicks can fall between two frames, and one is lost.
- The R1–R3.1 menu effects are not involved: the menu is hidden (`display: none`) in the lab, and
  the lab's frame rate did not change with them removed (R2 measurement).

## 5. Root cause

1. **Resource contention (category D)**, confidence **high**: several headless Edge instances,
   each rendering the lab with SwiftShader on the CPU, share the machine; per-browser FPS ∝ 1/K
   (41 → 20 FPS at 3 browsers). Measured.
2. **CPU throttling under sustained load (D)**, confidence **medium**: with the "Silent" power
   scheme, the clock can fall to ~50 % of nominal and the frame rate to ~7 FPS at 3 browsers.
   Measured once; intermittent, so not tied to each failed run directly.
3. **Test-harness race (category C)**, confidence **high**: fixed-time click spacing (80 ms)
   against a game that reads one press per key per frame. Below ~12.5 FPS clicks merge; dials end
   short; the assertion on the station state times out. Shown by: all 8 failures being short
   dials; the deterministic reproduction (4/12 lost at 5.7 FPS, 0/12 at 42 FPS); 0/12 lost with
   frame synchronisation.
4. **Not a product defect (not A or B)**: simulation results do not depend on frame rate (fixed
   steps; unit tests at 30 and 144 fps), and the page itself is nearly idle. Losing a second
   press inside one frame is the input design; a person clicking twice within one frame at under
   12 FPS would see the same — noted, not changed.
5. **Separate race (category E)**, not fixed: in `experiment.spec.ts:51` the 3.3 s Moon flight can
   complete before STOP is pressed (documented since phase 6C.1). Not seen in the post-fix runs;
   independent of the click fix.

## 6. Fix

- `e2e/support.ts`: new `afterFrame(page)` — waits for two animation frames in the page, so the
  game's own frame (whose callback is already queued) has read the last input. `dial()` now waits
  for it after each click instead of 80 ms.
- `e2e/experiment.spec.ts` (4 places) and `e2e/pendulum.spec.ts` (2 places): the same 80 ms pauses
  between repeated clicks replaced by `afterFrame(page)`.

Why it is correct and changes nothing else: it waits for exactly the condition the game needs (a
frame between two presses of one key), at any frame rate; at 40 FPS it waits ~50 ms instead of 80.
No timeout raised, no retry, no product code, no physics or input change; `grab.spec.ts`'s 100 ms
pause is a polling interval, not click spacing, and stays.

## 7. Regression

```text
npm run check: PASS — 417/417, 36 files
npm run build: PASS — JS 924.31 kB (unchanged)
scratch reproduction with the new dial(): 0/12 clicks lost at 5.7 FPS and at 42 FPS
npm run test:e2e: PASS — 36/36 (7.5 min); again: PASS — 36/36 (7.6 min)
npx playwright test <10 lab specs> --project=dev --workers=5: PASS — 18/18
npx playwright test <10 lab specs> --project=dev --workers=8: 12 passed, 6 failed (see §3, §8)
git diff --check: clean
```

## 8. Limitations

- Headless Edge with SwiftShader only; no hardware-GPU run (the bench was not run). The frame-rate
  numbers are software rendering.
- The throttled state could not be produced on demand; the two post-fix full runs ran unthrottled,
  so they show the suite passing but not under the worst condition. The fix's behaviour at low
  frame rates is shown by the reproduction (5.7 FPS) and the 5-worker run (~12–13 FPS).
- At 8 workers other limits appear, not fixed: the first `Scene`/`Phase` wait (15 s) after Continue
  is too short when eight browsers load the game at once, and the walking helper `approach()` taps
  W for a fixed 120 ms, which moves the player less when frames exceed 0.1 s (the game slows time
  rather than jump). Both are time-based helpers like the one fixed; worth making state-based if
  the worker count is ever raised.
- The STOP race (§5.5) remains.
- CPU contention and throttling depend on this machine and its power scheme.

## 9. Git

Committed, not pushed. Changed: `e2e/support.ts`, `e2e/experiment.spec.ts`,
`e2e/pendulum.spec.ts`; new: this report. The scratch probes live outside the repository.
