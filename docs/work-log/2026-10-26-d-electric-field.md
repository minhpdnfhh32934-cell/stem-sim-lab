# (d) #76 — Điện trường của điện tích điểm (VL11 Bài 16–18)

- **Goal:** traps 2 and 3 of #37 §8.2 (number filter, charge sign), then the electric-field scene.
- **Date/time:** 2026-10-26 19:14 +0700 (stage 1)
- **Status:** IN_PROGRESS — stage 1 done, stage 2 waits for (a) #74 and (b) #75 on `main`
- **Branch / base:** `feat/76-electric-field` from `main` d6f9fec (Máy A; claimed on #76)

## Files

- `src/ai/numbers.ts` (+ new `numbers.test.ts`): relative comparison, lone powers of ten,
  superscript runs, `writtenSign()`.
- `src/ai/draft.ts` (+ `draft.test.ts`): non-blocking `signMismatch` warning for charges.
- `src/physics/field/model.ts`, `fieldLines.ts`, `field.test.ts` (new, not registered yet).

## Key decisions

- `mentions` compares relatively (1e-9 of the larger value): the absolute 1e-9 let any invented
  charge below ~10⁻⁹ C through.
- Found while testing: `normalizeText` turned "10⁻¹⁰" into "10^-^1^0", so a superscript exponent
  with more than one character was never read, even with a mantissa. A run now gets one caret.
- A lone power of ten needs the caret ("10⁻⁸", "10^-8"): "10 cm" stays 10, "210^2" is not 100.
- Charge sign: minus/plus next to the number, else "âm"/"dương" in the same sentence up to the
  neighbouring numbers (a ", " between two numbers splits the words); "độ lớn"/"trái dấu"/both words
  → open. Open or different from the AI → warning "dấu của điện tích chưa chắc khớp với đề" (kept,
  the learner confirms). Applies to every parameter whose dimension is charge.
- Field lines: RK4 (`src/core/ode` `Rk4`) with step doubling; tolerance a fixed fraction of the
  frame (same on every tier); step budget per line (no timing). The error on the card is global:
  a coarse copy of each line (one full step per two halves) gives max |drawn − coarse|. Against a
  DOPRI5 line (rtol 1e-12), three configurations: |drawn − coarse|/15 was 0,72–0,74× the true
  distance (too low), so the undivided value used is ≈ 11× above it.
- Null points: a step that reverses or stalls (chord < h/2: symmetric RK4 stages cancel and fool
  the error estimate) is retried smaller until h ≤ tolerance, then the line ends and the point is
  marked.

## Commands run (real results, summary lines only)

- `npx vitest run src/ai tests/golden src/app/ai src/teacher` → 118 files, 2671 tests passed.
- `npx vitest run src/physics/field` → 12 passed.

## Tests

- `numbers.test.ts`: "q = 10⁻⁸ C" accepts 1e-8, blocks 2e-8; "5.10⁻¹⁰" blocks 7e-10; "10 cm" is
  10; "1,6.10-19" accepted; sign readings (minus, words, open, quote picks the place).
- `draft.test.ts`: sign flipped by the AI → `signMismatch` (non-blocking), value kept.
- `field.test.ts`: Coulomb + superposition; −∇V by central differences; F = q₀E; k = 9·10⁹ vs
  1/(4πε₀) differ by 0,14 %; plates U/d inside, 0 outside, d×2 → E/2; lone ± charge lines radial
  and in the right direction; Σqᵢcosθᵢ constant on two-charge lines; two equal + charges: no NaN,
  axis lines end at the midpoint, one null point; DOPRI5 within the reported error; step budget.

## Next steps and limits

- Stage 2 after (a) and (b) merge: `git merge origin/main`, `engine.ts`, `scenes.ts`, register,
  catalog, i18n, `TOPIC_HINTS`, units (V/m, kV/m, nC, kV, mN, µN, N·m²/C²), challenge, POE, golden
  problems, `physics.spec.ts`, docs (`EFD-*`).
- `scenes.ts` `validate()` should also refuse two charges closer than the seed circle (2 % of the
  frame), or seeds start inside the other charge's disc.
