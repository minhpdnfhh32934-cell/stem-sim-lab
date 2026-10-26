# End-to-end tests (Playwright)

`npm run test:e2e` starts the Vite dev server and drives the app in Chromium. The Gemini API is mocked
with `page.route('https://generativelanguage.googleapis.com/v1beta/**')` and a test key injected
with `addInitScript`, so no real key or network is needed.

First run on a new machine: `npx playwright install chromium`. To use an already installed
Chromium instead, set `PW_CHROMIUM=/path/to/chrome`.

Scenarios (`ai-flow.spec.ts`): problem → confirmation table → simulation → solution → AI
explanation; invented numbers rejected; explanation with foreign numbers hidden; unsupported
problem; no Internet; free quota used up (429); no key → Gemini key guide; manual scene without
any AI call.

Real model accuracy (not mocked): `GEMINI_API_KEY=… npm run golden:llm` (uses free-tier quota).

"Cách học" (Science Studio guide): `storage-state.json` records `stemsim.studio` with
`guideSeen: true`, so the guide does not cover the studio specs; `studio.spec.ts` clears it to test
the first visit.

"Có gì mới" (`whatsnew.spec.ts`): `storage-state.json` records `stemsim.whatsnew` as
`{"lastSeen": "999.0.0"}` (every version already seen), so the box never covers the other
specs once a version's notes are marked ready. The spec itself sets an older `lastSeen`.

Science Studio (`studio.spec.ts`): the launch page has two cards only; lab → Studio tabs (sidebar
entry, a topic's inspector card, Rơi tự do's "Dự đoán trước"), a session kept after going back; chemistry bench against
`data/reactions.json` (no-record pair, another record, the question's pair), POE, report sources,
reload; biology stages in the 2D picture (low quality); physics at a non-default height against
√(2h/g) and the lab's own solution; authoring a chemistry lesson → preview → reload; "Hỏi thầy"
with a fake Gemini (lesson numbers sent only when the screen is shared). Acceptance criteria:
`docs/work-log/2026-10-19-S6-tests-skills.md`. The 3D path of the biology lesson is
`studio-biology.spec.ts` (project `chromium-3d`).

Bottom-panel layout (`layout.spec.ts`, light project): at 1366×768 with the default panel sizes,
every graph of every physics topic, before and after Run: plot area (uPlot `.u-over`) at least
80 px, legend inside the panel, the "Nhấn Chạy…" note inside the plot area, the graph tab never
scrolls, no horizontal scroll, keyboard picking of a graph keeps the focus, and hovering (the live
legend fills in) never changes the plot's width. Issue #69.
