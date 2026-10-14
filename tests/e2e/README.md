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

"Có gì mới" (`whatsnew.spec.ts`): `storage-state.json` records `stemsim.whatsnew` as
`{"lastSeen": "999.0.0"}` (every version already seen), so the box never covers the other
specs once a version's notes are marked ready. The spec itself sets an older `lastSeen`.
