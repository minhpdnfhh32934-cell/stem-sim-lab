# Phase W0 — World Expansion baseline and guards

W0 adds tests, measurements and documentation before the world grows. It changes no product file:
the production build is byte-identical to `a1ca48c`. Scope approved by the user: W0a, W0b.1,
W0c-A, W0c-B, W0-doc and A5; A1, A2, A3, A4, A6 and L1 not approved.

## 1. Verdict

**PASS**, with one recorded flaky failure in the baseline (§3). Every required check ran: unit
tests, build, the two new specs three times, and the full e2e suite. Nothing is committed (W0
rule: nothing is committed until the user says so).

## 2. What W0 added

| Card   | Files (all new)                                                                                                                         | Tests   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| W0a    | `src/world/layout.ts`, `src/world/layout.test.ts`, `src/physics/layoutSweep.test.ts`                                                    | 81 unit |
| W0b.1  | `src/platform/render/WorldRenderer.test.ts`, `src/platform/render/apparatusExtents.test.ts`                                             | 8 unit  |
| W0c-A  | `e2e/webgl.ts`, `e2e/resources.spec.ts`                                                                                                 | 1 e2e   |
| W0c-B  | `e2e/saves.ts`, `e2e/draw-calls.spec.ts`                                                                                                | 14 e2e  |
| W0-doc | `docs/agents/README.md`, `docs/phase-c2-report.md` (erratum §10), `docs/development-guide.md`, this report, `docs/agents/TASK_BOARD.md` | —       |

- **W0a, layout predicates** (test-only module): P1 rooms of a scene at least one wall apart (doorway
  pairs exactly 0.25 m), P2 openings passable (0.8 m wide, tallest character + 0.1 m high, 0.8 m
  deep behind), P3a solids inside their rooms (1 mm), P3b wall and ceiling fixtures inside or
  embedded at most 0.125 m, P3c apparatus anchors inside, P4 dynamic bodies starting free of
  solids and walls, P5 no solid in a doorway passage, P8 every room reachable; P6 (scenes
  reachable and back) and P7 (every travel door names an arrival) are checked in the test with
  `routeBetween`. Tightest margins on the shipped content: P1 0, P2 width 0.2 m, height 0.25 m,
  depth 1.2 m, P3a −3.3 µm (flush lockers), P3b 0, P3c 0, P4 0 (resting contacts) and 0.37 m
  from walls, P5 0.0999993 m. A real-Rapier sweep walks every spawn (6), every doorway both ways
  (8), the wall beside each doorway (12), and checks every scene's body/collider count against
  rooms + solids + 1 / room slabs + solids + 1 (14/28, 9/23, 6/11, 20/43, 5/10, 5/10).
- **W0b.1, rendering characterization** (no render code change): the sun and fill poses, shadow
  box and projection for every scene and quality, and, as facts, exactly five room corners
  outside the sun's shadow box: the range floor (−5, 0, 12.25) and (21, 0, 12.25), the bay floor
  (−5, 0, −12.25) (the three known floor gaps), plus two ceiling corners. Every drawn apparatus
  stays inside its room (the launcher over its 19 drawable angles).
- **W0c, GPU resources in the real app**: a per-context WebGL counter, a real-door lab ⇄ hub
  probe requiring every count after the warm-up trip to repeat exactly, and draw-call baselines at
  14 named views. No absolute threshold is asserted; the baselines are below.

## 3. Baseline (before any W0 file existed in `main`)

| Step                            | Command                                                                    | Result                                                                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1                              | `git status`, `git log -1`, `git worktree list`, ports 5197-5199           | PASS: clean `a1ca48c`                                                                                                                                                                  |
| B2                              | `npm run check`                                                            | PASS: 919 tests                                                                                                                                                                        |
| B3                              | `npm run build`                                                            | PASS: menu 384,416 B, no three.js in it; renderer chunk 588,464 B                                                                                                                      |
| B4 run 1                        | `npx playwright test --reporter=list,json`                                 | **FAIL**: 47 passed, 1 failed, 4 did not run (8.7 min): `e2e/experiment.spec.ts:183`, the known projectile STOP race (the 3.3 s Moon flight ended before STOP registered at 17-21 fps) |
| B4 run 2                        | the same command, once, unchanged                                          | PASS: 52/52 (10.0 min)                                                                                                                                                                 |
| Worktrees, isolation, ownership | detached at `a1ca48c`, tools from `main`'s `node_modules`, disjoint matrix | PASS                                                                                                                                                                                   |
| B7                              | `npm run check`, `--list`, `canvas.spec.ts` from `w0c`                     | PASS                                                                                                                                                                                   |

The user accepted the baseline as PASS WITH A RECORDED FLAKY FAILURE. The STOP race is not fixed
(it needs an existing spec changed).

## 4. Measurements (SwiftShader counts, not timings and not GPU numbers)

Renderer for every number: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
(0x0000C0DE)), SwiftShader driver)`, 1280×720, dev build. Counts are what three.js creates and
draws; they repeated exactly in every run.

**Probe** (`e2e/resources.spec.ts`, arrival views, trips 1-3; identical in 6 runs: P1 ×3, F4 ×3):

| View        | Buffer | Texture | Program | VertexArray | Framebuffer | draws | bodies | colliders | listeners |
| ----------- | -----: | ------: | ------: | ----------: | ----------: | ----: | -----: | --------: | --------: |
| hub arrival |    121 |       7 |       8 |          86 |           4 |    14 |      6 |        11 |        80 |
| lab arrival |    531 |      22 |      14 |         273 |           4 |   265 |     20 |        43 |        80 |

Shaders 0, renderbuffers 0 and other contexts 0 in both. 531 buffers and 22 textures equal the
historical P3.10/P3.11 probes.

**Named views** (`e2e/draw-calls.spec.ts`; identical in 5 runs: P2 ×2, F4 ×3):

| Scene / view            | Quality             |          draws |          Buffer |      Texture |     Program |    VertexArray | Framebuffer | Renderbuffer |
| ----------------------- | ------------------- | -------------: | --------------: | -----------: | ----------: | -------------: | ----------: | -----------: |
| preparation-room spawn  | medium              |             36 |             140 |            5 |           1 |             35 |           3 |            0 |
| teacher-room spawn      | medium              |             18 |              72 |            6 |           2 |             18 |           3 |            0 |
| simlab-hub spawn        | medium              |             13 |              44 |            5 |           1 |             11 |           3 |            0 |
| physics-lab spawn       | medium              |            265 |             531 |           22 |          11 |            250 |           4 |            0 |
| chemistry-lab spawn     | medium              |             15 |              60 |            6 |           2 |             15 |           3 |            0 |
| biology-lab spawn       | medium              |             15 |              60 |            6 |           2 |             15 |           3 |            0 |
| physics-lab range lane  | low / medium / high | 71 / 185 / 185 | 228 / 429 / 430 | 14 / 16 / 17 | 7 / 11 / 11 | 60 / 204 / 204 |   3 / 4 / 5 |    0 / 0 / 1 |
| physics-lab pendulum    | medium              |            168 |             399 |           12 |          12 |            196 |           4 |            0 |
| physics-lab lab ceiling | low / high          |      124 / 238 |       362 / 477 |      15 / 18 |      7 / 11 |       94 / 238 |       3 / 5 |        0 / 1 |
| physics-lab bay wall    | low / high          |       43 / 157 |       158 / 369 |       8 / 11 |      7 / 11 |       41 / 185 |       3 / 5 |        0 / 1 |

Low has no shadow pass (fewer draws); High adds the environment map (one more texture,
framebuffer and renderbuffer) without more draws.

## 5. Final validation (integrated tree)

| Step  | Command                                                                                                      | Result                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| F1    | `git diff --check` + trailing-space scan of the 10 new files                                                 | PASS                                                                                         |
| F2    | `npm run check`                                                                                              | PASS: 54 files, 1008 tests (919 + 81 + 8)                                                    |
| F3    | `npm run build`; `ls -l dist/assets/`; `grep -c __THREE__`                                                   | PASS: byte-identical chunks (`index-BiClB9ha.js` 384,416 B, no three.js; renderer 588,464 B) |
| F4    | `npx playwright test e2e/resources.spec.ts e2e/draw-calls.spec.ts --project=dev --workers=1 --repeat-each=3` | PASS: 45/45 (3.0 min), every reading repeated                                                |
| F5    | `npx playwright test --reporter=list,json` (`npm run test:e2e`)                                              | PASS: 67/67 (52 + 15), 10.3 min, no retries                                                  |
| Bench | `npm run bench`                                                                                              | NOT RUN: recorder defect E14 (§6)                                                            |

Acceptance: G1 the tree holds exactly the listed files (3 modified docs, 10 new files); G2 `git
diff --exit-code a1ca48c` over content, persistence, game, world, physics, simulation, gameplay,
core, e2e, configs, package files, `index.html` and `CLAUDE.md`: no change; G3 no existing test
file modified; G4 no three.js in the menu, the canvas and production specs pass; G5 the menu chunk
is exactly the baseline; G6 1008 unit and 67 e2e tests pass; G7 probe counts identical before and
after integration; G8 every step reported. Stop conditions S1-S7: none triggered.

## 6. Findings and limitations

- **E14, bench recorder broken since C2** (not fixed, A3 not approved): `e2e/physics-lab.bench.ts:118`
  binds the first `webgl2` context, which since `a8ab246` is the renderer host's released boot
  check, so no draw is counted and no frame recorded. There is no GPU timing in W0.
- **Shadow coverage**: three floor corners of the range and bay are outside the sun's shadow box
  (recorded, not fixed).
- The character schema allows heights up to 2.2 m, but the shipped 2.1 m and 2.2 m doorways cannot
  pass a character that tall (found by W0a; out of scope).
- All numbers are SwiftShader counts in a dev build at 1280×720; GPU and production counts are
  inferred to match, not measured.

## 7. Git

Not committed. `main` is at `a1ca48c`; W0 is unstaged: 3 modified docs and 10 new files. The
worker patches and a docs patch are kept outside the repository for rollback (`git apply -R`).
Worktrees `.claude/worktrees/w0a`, `w0b`, `w0c` remain for diagnosis.

## 8. Next step

The overnight World Expansion milestone starts from this guarded baseline: every content change
must keep W0's predicates passing (or update the pinned numbers deliberately, with the reason) and
keep the probe free of leaks.
