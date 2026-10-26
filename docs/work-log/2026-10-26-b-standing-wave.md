# (b) — Sóng dừng trên dây (VL11 Bài 13), issue #75

- **Goal:** new physics topic `standingWave` (chapter `waves`), plan #37 item 12, trap 5 (8.2),
  physics conventions 8.3.
- **Date/time:** 2026-10-26 19:13 +07:00
- **Status:** IN_PROGRESS — phase 1 done (new files only); phase 2 waits for PR (a) #74 on `main`.
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

- Phase 2 (after PR (a) is on `main`): `git merge origin/main`; units kg/m, g/m (+ `dim` on `muL`,
  `texQty` for μ); SGK source in `common/sources.ts`; register scene/engine; catalog, i18n,
  `TOPIC_HINTS`; challenge + POE (tension ×4 → f ×2); golden problems; `physics.spec.ts`;
  DATA_REVIEW `SWV-*`; SCIENCE_ACCURACY, USER_GUIDE, CLAUDE.md, PROGRESS.
- Curriculum row only if `scripts/data/gen_curriculum_kntt.py` is on `main` (PR #82).

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
