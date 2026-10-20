# S4 — Soạn bài (authoring MVP)

- **Goal:** PHẦN VII (15): create, edit, duplicate, delete, preview, import and export Science
  Studio scenarios for the three studios with the S1 schema; every choice comes from the engines,
  so an authored scenario always runs in its studio.
- **Date/time:** 2026-10-19 12:13–12:30 +0700
- **Status:** PASS
- **Branch / base:** `feat/science-studio` (uncommitted; S1–S3 already staged)

## Files

- New `src/studio/authoring/`: `choices.ts` (engine-derived choices), `check.ts` (engine check +
  `verifyScenario`), `draft.ts` (form model ↔ scenario, form issues), `bindingDraft.ts` (binding
  edits), `fileFormat.ts` (JSON envelope, parse/validate), `collection.ts` (ids, duplicate,
  storage migration), `authoringStore.ts` (Zustand persist `stemsim.studio.authored`, v1),
  `service.ts` (save/duplicate/delete/preview/import/export), `issueText.ts`, UI
  `AuthoringPane.tsx`, `ScenarioEditor.tsx`, `TextFields.tsx`, `PhysicsFields.tsx`,
  `ChemistryFields.tsx`, `BiologyFields.tsx`, `authoring.css`; tests `draft.test.ts`,
  `check.test.ts`, `fileFormat.test.ts`, `service.test.ts`, `AuthoringPane.test.tsx`.
- New `src/studio/TeacherNote.tsx`.
- Changed: `scenario.ts` (optional `author: 'teacher'`), `studioStore.ts` (`picked`,
  `openScenario`, `forget`; `picked` not persisted), `StudioScreen.tsx` (authored scenarios in
  the subject lists, store-driven picker, teacher label, Soạn bài tab = `AuthoringPane`),
  `flow/SharedSteps.tsx` and `report.ts` (teacher label), `flow/PoeFlow.test.tsx` (entry test no
  longer expects the "Đang chuẩn bị" placeholder), `vi.ts`/`en.ts` (`studio.teacher`,
  `studio.authoring.*`; removed the unused `studio.preparing.authoring`), `docs/DATA_REVIEW.md`
  (#23).

## Key decisions

- Physics: the engine reads (`measures`, graph, `tMax`) must equal a built-in scenario's binding
  ("preset"; today only Rơi tự do). Teachers change controls, start values (checked against
  `controlRange`, so run B = A × POE factor stays in the scene range) and text. `g` stays in
  Settings.
- Chemistry: targets = library records with `category: "precipitation"` (the only ones that
  confirm the POE answer); rack = their starting substances (AgNO₃, NaCl, BaCl₂, H₂SO₄);
  `targetMatchesLibrary` must hold.
- Biology: cell type, n = 1…4, parts from `componentsFor(cellType)`; `bindingProblems` must be
  empty. The stage question stays `equatorRow` (answer computed by the model).
- Teacher text: `author: 'teacher'` + `review_status: 'pending'` forced on save and import; labelled
  "Nội dung do giáo viên soạn — không phải kết quả của mô phỏng" in the header, Explain, Conclude
  and the report. English is optional and falls back to Vietnamese per line.
- Ids `teacher.<subject>.<slug>`; import never overwrites (taken or non-teacher id → new id).
- Files: existing `saveFile`/`openTextFile` (Tauri dialogs on desktop, download/file input in the
  browser). Delete is a two-step inline confirm (no `window.confirm`). No new dependency.

## Commands run (real results, summary lines only)

- `npx vitest run src/studio/authoring` → first run 1 failed (wrong expected id in my test), then
  5 files / 29 tests passed.
- `npx prettier --write <my files>` → done; `npx prettier --check src/studio src/app/i18n/locales
docs/DATA_REVIEW.md` → all formatted.
- `npx eslint src/studio src/app/i18n` → 5 errors (2× `no-dynamic-delete`, `no-base-to-string`,
  2× boolean compare) → fixed → clean. `npm run lint` → clean. `npm run typecheck` → clean.
- `npx vitest run src/studio` → 17 files / 109 tests passed.
- `npx vitest run` (full) → 204 files / 3399 tests passed (62 s).

## Tests

Schema/engine validation (`check.test.ts`, `draft.test.ts`), bad JSON / wrong format / schema
errors / smuggled measured values (`fileFormat.test.ts`), round-trip export → import of every
built-in scenario, import never overwrites, edit restarts the session (`service.test.ts`), UI:
create a biology scenario (refused while incomplete), preview opens the Biology studio with the
authored lesson selected next to the built-in one; physics preview opens the Physics studio;
duplicate and delete; out-of-range start value refused (`AuthoringPane.test.tsx`).

## Errors and fixes

- Test expected a built-in id to be re-slugged from a different title; corrected the expectation.
- Lint errors listed above, fixed without disabling rules.

## Evidence

Test summaries above. No E2E or manual run in a browser/desktop app in this step.

## Next steps and limits

- Physics authoring offers only presets that a built-in physics scenario defines (today one);
  more presets need a new built-in scenario with verified engine reads.
- The app does not check the science of teacher text; a teacher's question can disagree with the
  computed answer (the editor says how the answer is computed). DATA_REVIEW #23.
- Stored authored scenarios are schema-checked on load but the engine check runs only on save and
  import; the studios' own runtime checks still block a binding that stops matching an engine.
- No E2E spec yet for authoring (1366×768 layout not verified in a browser in this step).

---

# S4-fix-1 — Authoring: size limits and storage failures

- **Goal:** fix review finding (medium): imports had no size limit and a refused localStorage write
  escaped `useAuthoringStore.put()` after memory had already changed, so a lesson looked saved
  but vanished after a restart, with no message.
- **Date/time:** 2026-10-19 12:41 (machine local time, +07)
- **Status:** PASS
- **Branch / base:** feat/science-studio (uncommitted, staged)

## Files

- New: `src/studio/authoring/limits.ts`, `src/studio/authoring/limits.test.ts`.
- Changed: `src/studio/authoring/{service.ts,fileFormat.ts,check.ts,issueText.ts,AuthoringPane.tsx}`,
  tests `service.test.ts`, `fileFormat.test.ts`, `AuthoringPane.test.tsx`,
  `src/app/i18n/locales/{vi,en}.ts`.

## Key decisions

- Authoring-only limits (`limits.ts`), not `.max()` in the shared scenario schema, so built-in
  scenarios and stored data are unaffected: file ≤ 256 KB (checked before `JSON.parse`, code
  `tooLarge`), lesson ≤ 64 KB as compact JSON (`lessonTooLarge`), title ≤ 200 and other teacher
  text ≤ 2000 characters (`textTooLong`, names the editor field), lists ≤ 20 items
  (`listTooLong`), at most 40 authored lessons (`tooMany`; editing a stored one is still allowed).
- `service.ts` `commit()` wraps every `put`/`remove`: on a throw it puts the previous list back
  and returns `storageFull`. `duplicateScenario` now returns `SaveResult | null`,
  `deleteScenario` returns `AuthorIssue[]`. Clearing the learner session after a save is
  best-effort (the lesson is already stored). A rejected desktop/browser file read → `readFailed`.
- `AuthoringPane` shows import and row-action (duplicate/delete) problems in the same
  `role="alert"` list ("Chưa làm được việc này:" for actions).
- No new scientific text, so no DATA_REVIEW entry.

## Commands run (real results, summary lines only)

- `npx vitest run src/studio/authoring` → 6 files, 37 tests passed (one pane test first failed:
  the alert's own `<li>` was counted; fixed by counting inside the "Bài đã soạn" list).
- `npm run typecheck` → no errors. `npx eslint src/studio/authoring src/app/i18n/locales` → clean.
  `npx prettier --check` (same paths) → clean after `--write` on one test file.
- `npx vitest run` (full unit suite) → 205 files, 3407 tests passed.

## Tests

- `limits.test.ts`: built-ins fit; list/text limits name the field; whole-lesson cap.
- `fileFormat.test.ts`: valid JSON padded past 256 KB → `tooLarge`.
- `service.test.ts`: count cap (import/duplicate refused, edit allowed); `Storage.prototype.setItem`
  throwing `QuotaExceededError` → import/save/duplicate/delete return `storageFull` and the list
  is unchanged; a failing session clear does not undo a saved edit.
- `AuthoringPane.test.tsx`: duplicate with full storage → no new row, alert shown; retry works and
  clears the alert.

## Evidence

Test summaries above. No E2E or manual browser/desktop run in this fix.

## Next steps and limits

- The caps are engineering bounds (≈ 2.5 M characters worst case), not a measured quota of
  WebView2; the `storageFull` path covers the rest.
- Other app stores (settings, progress, studio sessions) can still fill localStorage; only
  authoring writes are guarded here.
