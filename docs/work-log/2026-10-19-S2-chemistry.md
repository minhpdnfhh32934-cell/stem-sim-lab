# S2-chemistry — Chemistry Studio bench (silver nitrate test for Cl⁻)

- **Goal:** a Chemistry Studio bench MVP on the existing reaction library, plugged into the S1
  POE flow, evidence store, Science Card and report (brief PHẦN IV, §8–11).
- **Date/time:** 2026-10-19, 11:28–11:43 (+07:00, machine clock).
- **Status:** PASS
- **Branch / base:** `feat/science-studio` in `D:\Projects\simlab-studio`, on top of the staged S1
  checkpoint. No commit, no push.

## Feature map

| Learner task       | Screen / entry                                    | Engine / data                                                                       | Expected result and error cases                                                                                                                                                                                                                                     | Change                                                                      | Evidence                                                       |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Open the lesson    | Studio → tab Hóa học                              | Scenario `chemistry.chloride-silver-nitrate` (validated)                            | Title, objectives, "chưa được kiểm duyệt"                                                                                                                                                                                                                           | `scenarios/chemistryChlorideTest.ts`, `StudioScreen` registers the plugin   | `ChemistryFlow.test.tsx`, `scenario.test.ts`                   |
| Predict            | step Dự đoán                                      | Binding `question`; choices "Xuất hiện kết tủa" / "Không thấy kết tủa"              | Choice required; locked after the first mix                                                                                                                                                                                                                         | `ChemistrySteps.Predict`                                                    | `ChemistryFlow.test.tsx`                                       |
| Use the bench      | step Thí nghiệm: rack, tube, Lắc để trộn, Rửa ống | Pure state machine `bench.ts`; log stored in `session.actions`, replayed on load    | add/add/mix/empty; errors: empty tube, same solution twice, tube full, add after mix, mix with one solution, unknown reagent; the order of addition is kept and a different order from the steps is pointed out                                                     | `bench.ts`, `benchSession.ts`, `BenchStep.tsx`, `TubeSvg.tsx`               | `bench.test.ts`, `evidence.test.ts`, `ChemistryFlow.test.tsx`  |
| Library result     | after "Lắc để trộn"                               | `data/reactions.json` via `recordsFor`/`mixOutcome` (exact reactant set, any order) | `agcl`/`baso4` → observation, conditions, equation, balance check, review status copied from the record; no record → "chưa có trong cơ sở dữ liệu đã kiểm chứng"; several records (Cu + HNO₃) → ambiguous, nothing shown; only the question's pair sets the verdict | `library.ts`, `evidence.ts`                                                 | `library.test.ts`, `evidence.test.ts`                          |
| Balanced equation  | facts + Observe                                   | `balance.ts` (`checkCoefficients` + `balance`)                                      | Conserved and minimal for `agcl`/`baso4`; a wrong coefficient is caught                                                                                                                                                                                             | `library.checkEquation`                                                     | `library.test.ts`                                              |
| Observe            | step Quan sát                                     | Session evidence (facts) + `benchCard` (= library `reactionCard` + bench limits)    | List of mixes, question pair first with the tube; Science Card with sources, "qualitative", pending badge; unsupported quantities stated                                                                                                                            | `ChemistrySteps.Observe`, `chemistry/card.ts`, `chemistry/reaction/card.ts` | `ChemistryFlow.test.tsx`                                       |
| Explain / Conclude | shared steps                                      | Verdict from the library classification (`category: precipitation`)                 | "Kết quả mô phỏng: Xuất hiện kết tủa", match/miss; library observation next to the conclusion                                                                                                                                                                       | `ChemistrySteps.Facts`, plugin `leads`/`blockers`                           | `ChemistryFlow.test.tsx`                                       |
| Report             | step Báo cáo                                      | Evidence facts, sources of every record used + library source                       | Section "Kết quả từ thư viện dữ liệu của ứng dụng", no measurement table                                                                                                                                                                                            | `report.ts` (facts), `chemistry/plugin.chemistrySources`                    | `report.test.ts`, `evidence.test.ts`, `ChemistryFlow.test.tsx` |
| Progress           | first question-pair mix with a prediction         | `progressStore.recordPrediction('studio:<scenario id>', match)`                     | Recorded once (first answer kept)                                                                                                                                                                                                                                   | `BenchStep.tsx`                                                             | `ChemistryFlow.test.tsx`                                       |

## Key decisions

- Practical chosen: AgNO₃ + NaCl → AgCl (record `agcl`, "dùng nhận biết ion Cl⁻"). Rack: NaCl,
  AgNO₃, BaCl₂, H₂SO₄ — all library reactants; BaCl₂ + H₂SO₄ is the second record (`baso4`), the
  other four pairs have no record and show the CLAUDE.md wording. CuSO₄/NaOH was not added. The
  brief's Na₂SO₄ variant is not in the library (the record is BaCl₂ + H₂SO₄).
- No "no precipitate" result is ever claimed: the library does not record absences, so that
  choice can only be wrong or unconfirmed.
- Shared core changes (small, generic): `ScenarioBindingSchema` gets a `chemistry` binding;
  `STUDIO_TOOLS` gets `bench`; session gets an `actions` operation log (`default([])`, old data
  still loads) and `withActions`; engine evidence gets optional `facts` (LocalizedText copied from
  data); the `interact` blocker now also needs a verdict (only the run that answers the
  prediction unlocks; identical behaviour for physics); `withEngine` accepts the current verdict;
  plugins may override step leads and blockers; conclusion wording became "Kết quả mô phỏng: …".
  Physics code paths narrow on `binding.kind`.
- `cardFor` moved from `ReactionStage.tsx` to `src/chemistry/reaction/card.ts` (`reactionCard`),
  reused by the bench Science Card — no copy.
- File named `BenchStep.tsx`, not `Bench.tsx`: Windows resolves `./Bench` to `bench.ts`.
- Not implemented (no engine support, so no button): heating/cooling, filtering, gas, pH /
  temperature / gas-volume measurement, concentrations or amounts.
- The reference site chemistrylab-vn.vercel.app was not opened (optional); nothing was copied.
- No new dependency.

## Commands run (summary)

- `npm run typecheck` → first run: physics code used `scenario.binding` without narrowing, then a
  `./Bench` vs `bench.ts` casing clash → fixed → pass.
- `npx vitest run src/studio/chemistry` → 3 files, 22 passed (before the component test).
- `npx vitest run src/studio` → 2 failures (S1 test expected 1 built-in scenario; Science Card is
  also an `article`) → test updated, mixes rendered as a list → 9 files, 62 passed.
- `npx eslint` → `Date.now` in a render-scope function (react-hooks/purity) and an unused
  destructured var → moved the session change into pure `benchSession.ts` → 0 problems.
- `npx prettier --write` on changed files; `npx prettier --check src/studio src/chemistry/reaction
src/app/i18n/locales docs/DATA_REVIEW.md` → clean.
- `npm run lint` → pass; `npm run typecheck` → pass.
- `npx vitest run src/studio src/chemistry` → 17 files, 116 passed.
- `npx vitest run` (full) → **196 files, 3356 tests passed** (58 s).

## Tests

New: `src/studio/chemistry/bench.test.ts`, `library.test.ts`, `evidence.test.ts`,
`ChemistryFlow.test.tsx`. Extended: `session.test.ts` (verdict-gated blocker, action log),
`report.test.ts` (facts section), `scenario.test.ts` (two built-ins), `flow/PoeFlow.test.tsx`
(chemistry no longer "Đang chuẩn bị"), `physics/comparison.test.ts` (binding narrowing only).

## Evidence

- `docs/DATA_REVIEW.md` item 21 (`review_status: "pending"`).
- Test files and the full-suite summary line above.

## Next steps and limits

- Not checked in a browser: the SVG tube drawing, the bench layout at 1366×768 / phone width and
  touch, dark theme colours of the tube. E2E specs were not run.
- One tube, two solutions per mix; no amounts. Library records are all `pending`.
- `ReportStep` reloads model sources only when `session.inputs` change; chemistry sources are read
  when the Report step opens (the bench is not reachable from there), so they are current.
- S3 (biology) can follow the same pattern: a binding kind, a `SubjectPlugin`, optional `facts`.
