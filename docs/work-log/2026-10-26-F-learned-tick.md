# F — "Đã học" tick for every subject (0.8.0, issue #57)

- **Goal:** fix the library: opening a physics topic showed no tick (only Chemistry/Biology did).
  Plan: issue #57 (from #37 §9). Every subject gets "Đã học" when a topic is opened; physics shows
  the steps left ("1/3"); all steps done → a different "complete" mark; chapter count = opened.
- **Date/time:** 2026-10-26, 12:35–13:20 +0700 (machine clock)
- **Status:** PASS
- **Branch / base:** `feat/57-learned-tick`, on `origin/main` d6f9fec

## Files

- `src/learn/progress.ts`: `topicStatus` (state `new` / `opened` / `complete`, done/total, what is
  left); `chapterProgress` counts opened topics. `topicProgress` and the badges are unchanged.
- `src/app/layout/LeftSidebar.tsx` (`TopicItem`, `topicNote`), `src/app/layout/layout.css`
  (`.tree__mark`, `.tree__steps`, tokens only; `.tree__done` removed).
- i18n `learn.topicLearned`, `topicLeft`, `leftPredict`, `leftChallenges` (end of `learn`);
  `learn.progress` now reads "Đã học {done}/{total} chủ đề".
- Tests: `src/learn/progress.test.ts`, `tests/e2e/learner.spec.ts`; comments in
  `tests/e2e/mitosis3d.spec.ts`, `tests/e2e/studio-biology.spec.ts`.
- Docs: `docs/USER_GUIDE.md` (Tiến độ và huy hiệu), `docs/PROGRESS.md`.

## Key decisions

- The status text is the topic button's accessible **description** (`aria-describedby` → an
  `.sr-only` span outside the button); the visual mark is `aria-hidden`. The button's **name**
  stays the topic title, so every E2E locator by exact topic name keeps working.
- "Opened" means `visited` only. A Science Studio lesson records the lab prediction
  (`freeFall.h0`) without opening the topic; that alone must not give the tick (review finding).
- Complete mark: Lucide `Award` (exists in lucide-react 1.58.0), label "Đã hoàn thành chủ đề".
  Tooltip (`data-tip`) on the button, so hover and keyboard focus both show what is left.

## Commands run (real results, summary lines only)

- `npm run lint && npm run typecheck && npm run test` → 307 files passed, 1 skipped;
  4211 tests passed, 1 skipped (pre-existing skip).
- `npx prettier --check` on the changed files → clean. (`npm run format:check` locally also
  flags the untracked `AGENTS.md`, not part of this branch.)
- `npx playwright test tests/e2e/learner.spec.ts --project=chromium` → 6 passed.
- `npx playwright test --project=chromium` → 74 passed (3.4 min), after the review fixes.

## Tests

- PASS: unit — old tests unchanged; new: tick in all 3 subjects, physics 1/3 + what is left,
  complete, prediction without opening stays `new`, chapter count by opened topics.
- PASS: E2E `learner.spec.ts` — "Ném ngang" opened → description
  "Đã học · tiến độ 1/3, còn: dự đoán trước, 1 thử thách", chapter "Đã học 1/5 chủ đề"; after the
  prediction and the challenge → "Đã hoàn thành chủ đề".
- SKIPPED: `chromium-3d` project locally (only comments changed in two 3D specs; CI runs it).

## Errors and fixes

- Environment: the local Playwright browser (chromium-1243) failed to start ("side-by-side
  configuration is incorrect"); installed chromium-headless-shell 1248 with
  `npx playwright install chromium`.
- Review workflow (3 angles, 2 skeptics per finding): 1 confirmed bug (tick from any finished
  step, not from opening) → fixed + test; 1 split finding (keyboard focus never showed the
  tooltip) → `data-tip` moved to the button.

## Next steps and limits

- Next 0.8.0 task on Máy A: (i1) #58, the physics graph overlap.
- Badges and `topicProgress` keep the "complete" rule on purpose (plan).
