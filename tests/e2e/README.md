# End-to-end tests (Playwright)

`npm run test:e2e` starts the Vite dev server and drives the app in Chromium. LM Studio is mocked
with `page.route('http://localhost:1234/v1/**')`, so no model is needed.

First run on a new machine: `npx playwright install chromium`. To use an already installed
Chromium instead, set `PW_CHROMIUM=/path/to/chrome`.

Scenarios (`ai-flow.spec.ts`): problem → confirmation table → simulation → solution → AI
explanation; invented numbers rejected; explanation with foreign numbers hidden; unsupported
problem; LM Studio down; manual scene without any AI call.

Real model accuracy (not mocked): `npm run golden:llm` with LM Studio running.
