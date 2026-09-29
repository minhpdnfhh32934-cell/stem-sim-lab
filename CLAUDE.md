# CLAUDE.md — STEM Sim Lab

Offline desktop app (Tauri 2 + React + TypeScript) simulating Physics, Chemistry and Biology for
Vietnamese high-school science competitions. The full brief is in `MASTER_PROMPT.md`. Read it
before starting a new phase.

## ⚠️ Supreme rule: scientific integrity (MASTER_PROMPT §2) — never violate

1. **The LLM never computes and never invents simulations.** It only (a) extracts a problem into
   a `SceneSpec` JSON and (b) explains, in words, results the engine computed. Every number comes
   from deterministic code.
2. The LLM must not put any number into a `SceneSpec` that is not in the problem. Defaults
   (e.g. g = 9.81 m/s²) are filled in by code and marked `"source": "default"`. Unsupported parts
   go into `unsupported_parts`. Never approximate silently. Ambiguous input → ask the user.
3. **Chemistry:** mechanisms only for reactions in the curated, cited library. Unknown reactions:
   balance check only, plus the warning "chưa có trong cơ sở dữ liệu đã kiểm chứng". Electron
   configurations come from a data table (Cr, Cu, Mo, Ag … exceptions), not from Aufbau.
   Interpolated animation is labelled "Chuyển tiếp minh họa — không phải quỹ đạo nguyên tử thực".
4. **Every simulation has a Science Card:** model, KaTeX equations, assumptions and validity range,
   a confidence level (`exact` green / `approx` yellow / `qualitative` blue), and sources. When the
   user intervenes with the mouse, drop to `approx` and show "Đã có can thiệp — kết quả là mô phỏng số".
5. **Claude must not invent scientific data.** If unsure, leave a `TODO` and add an entry to
   `docs/DATA_REVIEW.md`. Every data item has `review_status: "pending" | "verified"`.
6. Overload handling: sacrifice smoothness first, **never silently reduce accuracy**.

## Commands

| Task                      | Command                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Install                   | `npm install`                                                                                  |
| Desktop app (dev)         | `npm run tauri dev`                                                                            |
| UI in browser only        | `npm run dev` → http://localhost:1420                                                          |
| Lint / types / unit tests | `npm run lint`, `npm run typecheck`, `npm test`                                                |
| All checks                | `npm run check` (+ `npm run format:check`)                                                     |
| Rust                      | `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` |
| Production build          | `npm run build` (web) / `npm run tauri build` (installer)                                      |
| E2E (mocked LM Studio)    | `npm run test:e2e` (first time: `npx playwright install chromium`, or set `PW_CHROMIUM`)       |
| Golden set vs real model  | `npm run golden:llm` (LM Studio running; `LMSTUDIO_URL`, `LMSTUDIO_MODEL` optional)            |

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

## Conventions

- TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No `any`.
- Code comments in **English**; every user-visible string goes through i18n (`src/app/i18n`),
  Vietnamese (`vi.ts`) is the source of truth, and `en.ts` must have identical keys (type-checked).
- Numbers shown to users use `formatNumber(locale, …)` (Vietnamese decimal comma: `9,81`).
- Internal units are **SI**; coordinate system is **y up**, metres.
- Styling: CSS variables in `src/app/theme/tokens.css`. Never hard-code colors in components.
  Icons: Lucide outline icons only, no colored emoji in the UI.
- State: Zustand stores. Persisted UI state uses the `stemsim.*` localStorage keys; project and
  library data will use SQLite (Phase 3+).
- Path alias `@/` → `src/`.
- Every new library needs a stated reason (prefer light solutions, few dependencies).
- **Never skip or disable a failing test** to get green. Fix the code, or report the problem.
- Small commits, one feature each, clear messages.
- The user is a beginner (knows some Python, learning Java). Explain reports simply, in Vietnamese.
- End each phase with: all tests passing, docs updated, a short report. Then **wait for approval**.

## Project map

```
src/app/          shell, layout, theme, i18n, settings, shortcuts, stores
src/ui/           shared design-system components
src/ai/           LLM client + SceneSpec pipeline (Phase 3)
src/core/         units, constants, integrators, fixed timestep (Phase 1)
src/physics/      physics engine & scenes (Phase 2)
src/chemistry/    elements, molecules, reaction library (Phase 4)
src/biology/      biology modules (Phase 5)
src/science-card/ Science Card types + UI
src/perf/         quality tier, frame monitor, degradation ladder
src/workers/      Web Workers for simulation
data/             scientific data (with sources + review_status)
src-tauri/        Rust backend (Tauri 2)
docs/             ARCHITECTURE, SCIENCE_ACCURACY, DATA_REVIEW, PERFORMANCE, USER_GUIDE, SETUP_WINDOWS
tests/            app-level tests, golden set, e2e
```

## Version notes

- TypeScript is pinned to **6.0.x**: TypeScript 7 (the native Go port) is out, but
  `typescript-eslint` does not support it yet (peer range `<6.1`). Upgrade when it does.
- Vite 8 uses Rolldown/Oxc. Do not set `build.minify: 'esbuild'` (esbuild is no longer bundled).
- Lucide is 1.x (`lucide-react`). Check that an icon name exists before using it.
- `tauri.conf.json` has a separate, looser `devCsp` (Vite's inline React-refresh preamble and the
  HMR websocket). The production `csp` stays strict. Never loosen the production CSP.
- `dangerousDisableAssetCspModification: ["style-src"]` is required: otherwise Tauri adds hashes
  to `style-src`, browsers then ignore `'unsafe-inline'`, and KaTeX's inline `style="top:…"` is
  blocked (every subscript drops below the line in the packaged app). Test:
  `tests/tauri-config.test.ts`. Always check formulas in the native build, not only the browser.
- `public/theme-boot.js` applies the saved theme before React loads (no white flash in dark mode).
  Keep its storage key and shape in sync with `settingsStore.ts` (`stemsim.settings`).
- In this repo's cloud sandbox, npm/crates/apt must go **through** the HTTPS proxy:
  `NO_PROXY=localhost,127.0.0.1 npm_config_noproxy=localhost,127.0.0.1`. This does not apply on
  the user's Windows machine.

## Autonomy note

The user asked (2026-09-28) to continue through all phases without stopping for approval
between phases, while still testing, documenting and committing at the end of each phase.
Progress log: `docs/PROGRESS.md`.

## Core APIs (Phase 1)

- Units: `src/core/units.ts` (`toSI`, `fromSI`, `convert`, `unitLabel`); SI everywhere inside.
- Constants: `src/core/constants.ts` (`constant(id)`, `C.*`), data in `data/constants.json`
  generated by `scripts/data/gen_constants.py` (CODATA 2022 via SciPy).
- ODE solvers: `src/core/ode` — `Rk4`, `dopri5` (adaptive + events), `VelocityVerlet`,
  `trbdf2` (stiff). Special functions: `src/core/math/special.ts`.
- Runtime: `SimulationEngine` (`src/core/sim/engine.ts`), `EngineRunner` (fixed step, budget,
  NaN recovery, drift, intervention), hosts in `src/workers/host.ts`; register engines in
  `src/workers/engines.ts` with lazy imports.
- Perf: `src/perf` (benchmark → tier, `usePerfStore`, `FrameMonitor`).
- Science Card: `src/science-card` (`ScienceCard`, `withIntervention`, lazy KaTeX).
- Scientific text is `LocalizedText {vi, en}` (use `useLocalized()`), UI text goes through `t()`.

## Physics scenes (Phase 2)

- A topic = `PhysicsScene` (`src/physics/types.ts`): params (SI), engine id, `solve()` with
  numeric cross-checks, `scienceCard()`, graphs, bodies (pick/drag), `view()`, `draw()`.
- Register the scene in `src/physics/registry.ts` and its engine in `src/workers/engines.ts`.
- Prefer exact updates (constant acceleration, exact linear propagators, exact event times);
  otherwise RK4 with substeps and energy monitoring. Every scene needs a test comparing the
  engine with the closed form and a DOPRI5 cross-check.
- UI runtime: `src/app/sim/runtime.ts` (`sim` singleton), `StageCanvas`, panels in `src/app/sim`.

## AI layer (Phase 3)

- Rust `src-tauri/src/ai.rs`: `ai_chat` (LM Studio/OpenAI json_schema strict, Anthropic forced tool
  call), `ai_cancel`, `ai_models`, keychain `ai_set_key/ai_has_key/ai_delete_key`. Keys never
  reach the web page. Browser dev mode uses `FetchTransport` (LM Studio only).
- `src/ai/pipeline.ts` classify → extract → `buildDraft` (`src/ai/draft.ts`): numbers must appear
  in the text (`src/ai/numbers.ts`) or be implied by a phrase in `IMPLIED` with a real quote.
  Defaults are filled in code. `explain.ts` hides explanations containing foreign numbers.
- UI in `src/app/ai/`: `analyze.ts` (controller store), `ProblemDialog` ("Tôi hiểu đề như sau",
  manual "Tự dựng cảnh", unsupported/error views), `AiSettings`, `useAiStatus` (polls LM Studio
  only), `ExplainBox`. Tests: `tests/golden`, `src/app/ai/analyze.test.ts`, `tests/e2e`.
- When a new physics scene is added, its params become extractable automatically; add golden
  problems for it in `scripts/golden/make_physics_golden.py` and regenerate `physics.json`.

## Modules (chemistry, biology — Phase 4+)

- A non-physics topic is a `ModuleView` (`src/modules/types.ts`): `Stage`, optional `Panel`
  (Inspector) and `Bottom`. Register a lazy loader in `src/modules/registry.ts`; the catalog marks
  the topic available automatically. Modules publish their Science Card with `usePublishCard`.
- Chemistry: data in `data/elements.json`, `data/molecules.json`, `data/reactions.json`, generated by
  `scripts/data/gen_*.py` (mendeleev, RDKit, SciPy). Never hand-edit the JSON; change the generator.
- Code: `src/chemistry/{data,atom,periodic,molecule,reaction,particles}`, `formula.ts` (parser),
  `balance.ts` (exact null-space balancer). three.js viewers render on demand; RDKit.js is lazy.
- Shared UI: `src/ui/charts/XYChart.tsx` (uPlot), `src/ui/canvas/useCanvas.ts`.

## Phase status

- [x] Phase 0: project scaffold, design system, layout shell, theme, i18n, CI
- [x] Phase 1: core (units, constants, integrators, fixed timestep, worker, quality tier, Science Card)
- [x] Phase 2: Physics 2D MVP (13 topics, canvas stage, tools, graphs, solutions, CSV)
- [x] Phase 3: AI layer (LM Studio/cloud via Rust, SceneSpec checks, confirmation table, golden set, E2E)
- [x] Phase 4: Chemistry MVP (atoms, 3D molecules, VSEPR, 39 reactions/10 mechanisms, balancer, particles)
- [ ] Phase 5: Biology MVP
- [ ] Phase 6: overload ladder, watchdog, presentation mode, tour
- [ ] Phase 7: Windows installer, user guide, SCIENCE_ACCURACY.md
