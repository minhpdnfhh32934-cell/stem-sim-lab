# STUDIO-LAB — Science Studio moves inside the lab (0.7.1, web only)

- **Goal:** one way into guided lessons. User decisions 2026-10-20: keep the name Science Studio;
  remove its card from the launch page (only Phòng thí nghiệm + AI Teacher); open the studio from
  inside the lab, from a topic's lesson, and let a lab POE that a lesson runs lead to that lesson.
- **Date/time:** 2026-10-20, 23:00–23:30 UTC (machine clock)
- **Status:** PASS for this change; FAIL for 2 pre-existing mitosis 3D E2E tests in this sandbox (see Tests)
- **Branch / base:** `claude/wizardly-galileo-k3vxcs`, on `main` 433c3a9 (v0.7.0)

## Files

- Launch: `src/app/learner/LandingScreen.tsx`, `learner.css` (two columns again), i18n
  `landing.studio*` removed.
- Lab: `src/app/layout/LeftSidebar.tsx` (+ `layout.css`), `AppShell.tsx` (studio beside the
  library), `Inspector.tsx`, `src/app/command/CommandPalette.tsx` (`go.studio`),
  `src/learn/ChallengePanel.tsx`.
- Studio: `src/studio/lessons.ts`, `TopicLessons.tsx` (new), `StudioScreen.tsx`, `studio.css`.
- Navigation: `src/app/topics.ts`, `src/app/navigationStore.ts` (comments; `'studio'` kept).
- Docs: `CLAUDE.md`, `docs/ARCHITECTURE.md` §3f, `docs/USER_GUIDE.md`, `tests/e2e/README.md`,
  `release-notes/versions.json` (0.7.1 `development`, `notesReady: false`) + generated files,
  `package.json` / `package-lock.json` root version 0.7.1 (native stays 0.7.0).

## Key decisions

- `screen === 'studio'` keeps its value: it now means "studio inside the lab", so every older
  caller of `openStudio()` lands in the new place without a redirect. The navigation store is not
  persisted, so no saved state can point at the old full page.
- `stemsim.studio` is untouched (no store version bump): tab, picks and sessions stay.
- The studio tab sets the library's subject; the top-bar subject switch stays hidden in the studio
  (one subject choice on screen).
- A lab POE is replaced only when a registered lesson's `binding.poe` names it (today
  `freeFall.h0`). The lesson records the same prediction id, so topic progress still completes.
- `learner.spec.ts`'s lab prediction + challenge flow moved from Rơi tự do to Ném ngang (the
  lab still has a POE there); its answers come from t = √(2h₀/g) and v₀ = 40 / t.

## Acceptance criteria

1. The launch page shows exactly Phòng thí nghiệm and AI Teacher, no Science Studio button.
2. The lab library has a Science Studio entry (≥ 40 px) that opens every lesson and Soạn bài.
3. An open topic with a lesson offers it (inspector); topics without one show nothing.
4. Rơi tự do's "Dự đoán trước" has no lab choices and opens the physics lesson; other topics
   keep their own POE; challenges stay.
5. Saved sessions, tab and picks survive every entry and a reload.
6. 1366×768 without horizontal scroll, no console/page errors, no AI calls.

## Tests

| Check                                                                                     | Result                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| `npm run check` (format, lint, typecheck, `vitest run`)                                   | PASS: 274 files, 3942/3942 tests          |
| `npm run format:check`                                                                    | PASS                                      |
| New unit tests `lessons.test.ts`, `labEntry.test.tsx`, `app.test.tsx` (studio in the lab) | PASS                                      |
| E2E `studio.spec.ts`, `learner.spec.ts` (chromium)                                        | PASS 13/13                                |
| E2E `studio-biology.spec.ts` (chromium-3d, with the chromium project as dependency)       | PASS (74/74 in that run)                  |
| `npm run test:e2e` (all projects)                                                         | FAIL: 100 passed, 2 failed, 1 did not run |

Failures, classified:

- `mitosis3d.spec.ts` "plays through every stage": the 3D view falls back to 2D while playing
  under software WebGL, so the stage hook returns null. Same failure on `main` 433c3a9 in this
  sandbox (worktree run) → environment, not this change. Not changed, not skipped.
- `mitosis3d.spec.ts` "boxes never overlap": failed only in the full parallel run; passed when the
  spec ran alone → load-dependent (flaky here). Not changed, not skipped.
- `chromium-3d-perf` (1 test) did not run because its dependency project failed.

## Next steps and limits

- The studio tab says "Vật lí" while the subject label says "Vật lý" (pre-existing spelling
  difference, not changed here).
- `release-notes/versions.json` still lists 0.7.0 as `in-review` although `main` has PR #32 and tag
  v0.7.0 (pre-existing; not changed here).
- Nothing pushed; no PR.
