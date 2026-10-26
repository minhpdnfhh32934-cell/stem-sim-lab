# (b) — Sóng dừng trên dây (VL11 Bài 13), issue #75

- **Goal:** new physics topic `standingWave` (chapter `waves`), plan #37 item 12, trap 5 (8.2),
  physics conventions 8.3.
- **Date/time:** 2026-10-26 19:13 +07:00
- **Status:** PASS — phase 1 and phase 2 done; see "2026-10-27 — phase 2" at the end (PR opened).
- **Branch / base:** `feat/75-standing-wave` from `main` d6f9fec (Máy A takes the issue: only
  Máy A works now, see #37).

## Files

- `src/physics/wave/model.ts` (+ `model.test.ts`): y₁, y₂, y; λ = v/f; v = √(F/μ); f_n = n·v/(2L);
  m = 2Lf/v, `isWhole` (|m − round(m)| ≤ 1e-9·max(1, m)), `nearestResonances`, nodes, antinodes.
- `src/physics/wave/engine.ts` (+ `engine.test.ts`): `standingInput` (three modes, v typed or from
  F and μ), `StandingWaveEngine` (closed form at t = k·Δt, Δt ≤ T/200, 20 periods per run, nothing
  draggable), DOPRI5 cross-checks `latticeAt` and `latticeFrequency`.
- `src/physics/wave/scenes.ts` (+ `scenes.test.ts`): params (mode choice first), `validate()`,
  step-by-step solution, Science Card, graph y₁/y₂/y at the probe, probe body (not draggable).
- `src/physics/wave/draw.ts`: 241-point string, dashed component waves (toggle), envelope, N/B
  marks, clamps, probe P, labelled vertical stretch (1/2/5 × 10ⁿ).

## Key decisions

- Trap 5: a non-whole 2Lf/v stops the run (`validate`) with the resonances below/above; f is never
  changed; the picture shows a flat string and "Không có sóng dừng (2Lf/v = …)".
- DOPRI5 check: wave equation on a fixed-end lattice (method of lines). Displacement agrees with
  2A·sin(kx)·sin(ωt) within the O(Δx²) bound, halving Δx cuts the error ~4×; the mode frequency
  measured from zero crossings, with the lattice dispersion (2v/Δx)·sin(kΔx/2) inverted, equals
  n·v/(2L) to 1e-9 and is the solution's `check` (≈ 6–10 ms per solve).
- Tension symbol F (T is the period). Picture and graph sampling: one sample per frame, so above
  60 Hz the solution notes a possible stroboscopic look (numbers unaffected).

## Tests

- `npx vitest run src/physics/wave --maxWorkers=1`: 3 files, 28 tests PASS (a first run with the
  default pool timed out starting workers while the machine was busy; not a test failure).
- `npx eslint src/physics/wave`, `npx prettier --check src/physics/wave/*.ts`, `npm run typecheck`:
  PASS.

## Next steps and limits

- **Where it stopped (2026-10-26, project moving to `D:\Projects\stem-sim-lab`):** phase 1 and the
  science-review fixes are committed and pushed on `origin/feat/75-standing-wave`; no PR yet; no
  E2E lock or dev server held. Phase 2 waits for PR (a) #74 on `main` (not opened yet).
- **Resume:** in a worktree of the new checkout, `git fetch origin`,
  `git switch feat/75-standing-wave` (tracks `origin/feat/75-standing-wave`), `npm ci`, then
  `npx vitest run src/physics/wave --maxWorkers=1` (expect 3 files, 32 tests PASS). When (a) is
  on `main`: `git merge origin/main` (no rebase) and do phase 2.
- Phase 2 (after PR (a) is on `main`): `git merge origin/main`; units kg/m, g/m (+ `dim` on `muL`,
  `texQty` for μ instead of the hand-written kg/m); SGK source into `common/sources.ts` (remove the
  local `SGK11_WAVES` and both `TODO(phase 2)`); register scene/engine; catalog, i18n,
  `TOPIC_HINTS`; challenge + POE (tension ×4 → f ×2); golden problems; `physics.spec.ts`;
  DATA_REVIEW `SWV-*`; SCIENCE_ACCURACY, USER_GUIDE, CLAUDE.md, PROGRESS.
- Curriculum row: `scripts/data/gen_curriculum_kntt.py` is on `main` since PR #82 — append to
  `PLACEMENTS`: `("standingWave", "VL11", [13], "Tên Bài 13: sóng dừng (cảnh chỉ có dây hai đầu cố
định).")`, rerun the script and commit the generated files (else `src/app/curriculum.test.ts`
  fails).

## 2026-10-26 — independent science review (science-reviewer agent)

- No blocker. Fixed (commits d48ee9b, 83b6576): default A = 0,5 cm (slope 2A·k ≈ 0,08; above 0,1
  the card is `approx` and the solution notes it); m = 2Lf/v shown with enough digits never to look
  whole (`ratioDigits`), the "ratio" answer removed; stroboscopic rule "f × tốc độ phát < ~30 Hz" on
  the card, solution note only from 300 Hz; m ≈ 0 no longer gives n = 0; source names KNTT; tests
  use a real round-off case (L = 1,1 m, f = 50 Hz, v = 11 m/s → m = 10,000000000000002), compare
  the lattice with its exact discrete mode (< 1e-8·2A) and tighten the lower bound to 0,9×.
- Tests after the fixes: `npx vitest run src/physics/wave --maxWorkers=1` 32 PASS; eslint,
  prettier, `npm run typecheck` PASS.
- For DATA_REVIEW `SWV-*` (phase 2, pending, teacher): the 0,1 slope limit (heuristic, no source);
  KNTT Bài 13 notation (ℓ = kλ/2 vs L = nλ/2, k = 2π/λ); whether v = √(F/μ) is in KNTT (else
  Halliday only); convention "A = biên độ mỗi sóng, bụng 2A"; all new learner-facing text.
- Known before registration: `g/m` and `kg/m` are not registered units yet (phase 2).

## 2026-10-27 — phase 2 (registration, learning, golden, docs)

- **Date/time:** 2026-10-27 02:31 +07:00, worktree `D:\Projects\stem-sim-lab\.claude\worktrees\75-phase2`.
- **Base:** merged `origin/main` with #87 (a) and #88 (Sinh (a)); conflicts in `docs/PROGRESS.md`
  (both rows kept) and `docs/CURRICULUM_KNTT.md` (regenerated by the script, not hand-edited).
- **Added:** units kg/m, g/m (`DIM.linearDensity`); sources `sgk11knttWaves`, `hallidayWaves`;
  scene/engine registration, chapter `waves` ("Sóng"), i18n, `TOPIC_HINTS.standingWave`;
  challenge `standingWave.f50` (start mode 0 + v from F, μ; F = 8 N → 50 Hz) and POE
  `standingWave.tension` (F ×4 → f ×2); golden swv-01 … swv-04 (swv-04 free end, unsupported);
  `tests/e2e/physics.spec.ts` row; curriculum row VL11 Bài 13 (39/189 theory lessons with (a) and
  Sinh (a)); DATA_REVIEW SWV-1 … SWV-8 + notes; SCIENCE_ACCURACY, USER_GUIDE, CLAUDE.md, PROGRESS.
- **Independent review (science-reviewer ×2, code agent ×1), confirmed and fixed:** `required` per
  mode (no silent default n or v); f, v, n are answers in every mode (questions can be marked);
  n ≤ 20 with a message (picture + lattice check); default probe at the first antinode L/(2n);
  f = ∞ no longer gives Δt = 0; unknown mode reads as "find f"; lattice check cached per n in units
  of L and L/v (exact rescaling) so `solve()` is cheap; AI labels/hint: both ends fixed only,
  n = antinodes (nodes n + 1), A per component wave; view fits a large amplitude; SCIENCE_ACCURACY
  wording; engine A fallback 0,5 cm. Not changed: f_below/f_above stay as answers (shown in the
  validation message too).

### Tests (real results)

| Check                                                                                                     | Result                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `npx prettier --check --ignore-unknown $(git diff --name-only origin/main...HEAD)`                        | PASS                                               |
| `npm run lint`                                                                                            | PASS                                               |
| `npm run typecheck`                                                                                       | PASS                                               |
| `npx vitest run` (after merging #88)                                                                      | PASS — 318 files, 4321 tests (1 skipped, existing) |
| `src/physics/wave`                                                                                        | PASS — 40 tests                                    |
| Generators rerun (`make_physics_golden.py` "wrote 39", `gen_curriculum_kntt.py`) → `git diff --exit-code` | PASS (no change)                                   |
| `npx playwright test` full, before merging #88                                                            | PASS — 129/129 (9,9 min)                           |
| `physics.spec.ts` + `layout.spec.ts` after merging #88                                                    | PASS — 17/17                                       |

- Not run: Gemma / local-model "Phân tích đề" on the new golden problems (Máy A, discrete NVIDIA
  only, plan §16); real Gemini golden run; native build.

## 2026-10-27 — PR #90 review round (2 🔴, 🟡)

- 🔴1 fixed: optional `PhysicsScene.yStretch(p)` (the wave scene returns its vertical stretch S);
  `StageCanvas` divides it out in the ruler/protractor (`src/app/sim/measure.ts`
  `measureSegment`) and `drawGrid` y labels. Scenes without it: S = 1, unchanged.
- 🔴2 fixed: suggested resonances printed with 10 significant digits (typing one back gives a
  whole 2Lf/v) and kept within 20 loops (above: f₂₀).
- 🟡 done: mode inferred in `autoDefaults` from stated values; stroboscopic and lattice-comparison
  wording; `checkedFrequency` refuses a non-whole n; picture uses the model's y₁, y₂, y; legend;
  English "A" for antinode; USER_GUIDE (Basic "Thêm thông số", real metres); tests for the coarse
  lattice dispersion, POE ratio 2 with its start, Basic five params per mode. Not done: x_P slider
  range per L (static `ParamDef`), graph axis in cm (graph values are SI).
- Both 🔴 tests fail on the previous source (checked by restoring the old files, keeping the new
  tests: 2 failed) and pass now.
- Results: Prettier, `npm run lint`, `npm run typecheck` PASS; `npx vitest run` PASS — 319 files,
  4329 tests (1 skipped, existing); `physics.spec.ts` + `layout.spec.ts` PASS 17/17.
