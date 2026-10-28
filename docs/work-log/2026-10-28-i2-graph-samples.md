# (i2) #70 — nhóm S, PR-C: đồ thị đủ mẫu (UI-22)

- **Goal:** UI-22 of the 1366×768 audit: oscillation graphs drawn from too few samples
  (angular peaks; ~4 points per period for the standing wave).
- **Date/time:** 2026-10-28 (after PR-A #98 and PR-B #101)
- **Status:** PASS (results below)
- **Branch / base:** `fix/70-graph-samples` from `main` db2abbb.

## Cause and change

- `History` kept a sample only every 1/120 s of **simulated** time. At ×0,1 a 25 Hz wave
  (T = 0,04 s) got ~5 samples per period although 24 frames were drawn. Now the spacing is 1/120 s
  of **screen** time: 1/120 s × playback speed (`setTimeScale`, set by the runtime on every frame);
  decimation still doubles it when the buffer is full. ×1 behaves as before.
- `graphData` keeps up to 4000 points (was 1500): a minute of a 0,314 s oscillation at ×1 keeps
  ≥ 15 points per period instead of ~6.
- Numbers are unchanged: the history holds only states the engine computed (no interpolation),
  so the Số liệu table and the CSV still show engine values; only how many are kept changes.

## Tests

- `history.test.ts`: ×0,1 keeps every frame (61 of 61, ≥ 20 per period, values exactly as
  pushed); ×1 keeps 1/120 s; ×10 ten times wider; a bad speed is ignored.
- `graphData.test.ts`: a minute at ×1 keeps ≥ 15 recorded points per period, each equal to the
  recorded state.
- The 3 tests fail on the old `history.ts` / `data.ts` (checked by restoring them: 3 failed).

## Results (real)

| Check                                                                                | Result                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier on every file that differs from `main`, `npm run lint`, `npm run typecheck` | PASS                                                                                                                                            |
| `npx vitest run --maxWorkers=2` (on `main` db2abbb)                                  | PASS — 328 files, 4418 tests (1 skipped, existing)                                                                                              |
| `npx playwright test` full, project `chromium`                                       | 95 passed, 2 failed: `chemistry.spec` "every chemistry topic opens…" and `lesson-flow` — FLAKY under load: both specs alone, 1 worker, 8/8 PASS |
| `chromium-3d` + `chromium-3d-perf` (`--no-deps`, skipped by the failures above)      | PASS — 36/36 (1 worker)                                                                                                                         |
| After merging `main` with #98: `src/app/sim` + `src/ui` unit tests, typecheck        | PASS — 149 tests                                                                                                                                |

## Review fix (#102)

- 🔴 The runtime set the history spacing from the speed chosen in the toolbar, not the speed the
  frame ran at: a Step (always ×1) at ×4 kept 4 rows of 25 steps, at ×100 one; a frame capped by the
  substep limit (×1000 chosen, ~×128 reached) kept one row in four. Now
  `history.setTimeScale(f.stats.effectiveSpeed)` (1 for a Step, the reached speed when throttled,
  0 while paused — ignored). Tests in `runtime.test.ts` (both fail on ecf52f3).
