# CLAUDE.md — STEM Sim Lab

Desktop app (Tauri 2 + React + TypeScript) simulating Physics, Chemistry and Biology. The full
brief is `MASTER_PROMPT.md` plus its continuation **`PROMPT_PHAN_2.md`** — read both before starting
a new phase. **When `PROMPT_PHAN_2.md` conflicts with `MASTER_PROMPT.md`, `PROMPT_PHAN_2.md` wins**
(MASTER_PROMPT §2, scientific integrity, is unchanged). Migration plan and its approval status:
`docs/PLAN_PHAN_2.md`.

## PROMPT_PHAN_2 rules (summary — A1–A8, B1, B13)

- **Users:** primary = university students **18+** (bring their own Gemini key); pilot testers =
  high-school students (mostly under 18) in supervised sessions with parental/school consent.
- **No local AI of any kind** (no LM Studio/Ollama, no local TTS/ASR/LLM/VAD/vision model). All AI
  goes through the Rust `AIProvider` interface: `GeminiProvider`, `ClaudeProvider`.
  **User decision 2026-10-05 (overrides PROMPT_PHAN_2 A1/A2):** other cloud providers may be added
  as a free fallback when paid tokens run out, in both editions, but only after their terms (age,
  data use, Vietnam) are checked and recorded in `docs/LEGAL_COMPLIANCE.md` §2b. First candidate:
  Groq (no training on data, 18+ account holder, minors allowed under the customer's
  responsibility). Plan: `docs/PLAN_PHAN_2.md` §6 (step 3b.3b, approved 2026-10-05).
- **Two builds** (Cargo feature + `VITE_EDITION`): `main` (Gemini default, Claude optional, 18+
  confirmation on first run, no Gemini key may be saved before it) and `pilot` (**Claude only —
  Gemini code must never be compiled into or shipped with the pilot build**, key entered by a
  supervisor behind a PIN, full under-18 safeguards: age gate + parental consent, "AI-assisted"
  labels, two-way moderation, incident log without private content, report button, minimal data).
- Never commit API keys (`.env` is git-ignored); never embed a project key in an installer.
- AI calls: timeout, cancel, retry with backoff on 429/5xx (max 3), daily cap, cache confirmed
  problem readings; app fully usable without a key and offline (simulations, samples, manual mode).
- UI for learners (A4): one main action per screen, Basic/Advanced modes, Level → Subject → Topic →
  Lesson, predict–observe–explain, challenges, step hints, no streaks/leaderboards, 1366×768,
  targets ≥ 40 px, touch. Ask: "would a first-year student — or a high-school pilot tester — get it?"
- AI Teacher (Part B): numbers only from deterministic tools; honest that it is an AI; warm but
  bounded; crisis protocol with verified hotlines; mic/camera opt-in, no audio stored; "perform
  before brain"; third-party licences in `docs/THIRD_PARTY.md`; no cloned real voices/faces.
- Legal points are researched with citations in `docs/LEGAL_COMPLIANCE.md`; never conclude legally
  on the user's behalf — list what the user/teacher must confirm.

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

| Task                      | Command                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Install                   | `npm install`                                                                                             |
| Desktop app (dev)         | `npm run tauri dev`                                                                                       |
| UI in browser only        | `npm run dev` → http://localhost:1420                                                                     |
| Lint / types / unit tests | `npm run lint`, `npm run typecheck`, `npm test`                                                           |
| All checks                | `npm run check` (+ `npm run format:check`)                                                                |
| Rust                      | `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`            |
| Production build          | `npm run build` (web) / `npm run tauri build` (installer)                                                 |
| Pilot edition             | `npm run build:pilot`; Rust: `cargo test --no-default-features --features edition-pilot`                  |
| E2E (mocked Gemini)       | `npm run test:e2e` (first time: `npx playwright install chromium`, or set `PW_CHROMIUM`)                  |
| Golden set vs real model  | `GEMINI_API_KEY=… npm run golden:llm`; `LLM_PROVIDER=claude ANTHROPIC_API_KEY=…` / `=groq GROQ_API_KEY=…` |

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
- End each phase with: all tests passing, docs updated, a short report — then continue (see Autonomy note).

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
between phases. For PROMPT_PHAN_2 work this was first replaced by "stop after each 3b step and
T-phase and wait"; **since 2026-10-05 the user wants the opposite again: after each step, send a
short report of what was done (simple Vietnamese) and continue straight to the next step — every
step is pre-approved.** Still stop and ask for: decisions only the user can make (legal points,
money, accounts, publishing a release), anything the security rules forbid, and real blockers.
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

- Rust `src-tauri/src/ai/`: trait `AIProvider` (`provider.rs`), `gemini.rs` (`generateContent` +
  `responseJsonSchema`; **main edition only**), `claude.rs` (forced tool call, prompt caching, no
  `temperature`), `usage.rs` (daily cap); `mod.rs`: `ai_chat` (retry 429/5xx ≤ 3, timeout 30 s
  default, daily cap), `ai_cancel`, `ai_models`, `ai_usage`, `ai_edition`, `ai_test_key` (one tiny
  request → `KeyStatus` ok/noKey/badKey/quota/badModel/offline/error, same rules as
  `src/ai/keyTest.ts`), `ai_key_hint` ("••••••••abcd", the key never leaves Rust), keychain
  `ai_set_key/ai_has_key/ai_delete_key`, `open_gemini_key_page`. Keys never reach the web page.
  Without the desktop app, `FetchTransport` is used (Gemini; Claude from Node only) with test keys
  `__STEMSIM_TEST_GEMINI_KEY__` / `__STEMSIM_TEST_CLAUDE_KEY__` injected by tests — never typed in
  the UI. Two editions: `__EDITION__` (web) and Cargo features `edition-main`/`edition-pilot`;
  Gemini code only behind `__EDITION__ === 'main'` / `#[cfg(feature = "edition-main")]`.
  Confirmed readings are cached in `src/ai/cache.ts` (not the AI's numbers: the checks rerun).
- **Free fallback (3b.3b):** `groq.rs` (`GroqProvider`, both editions, default model
  `qwen/qwen3.8-27b`); `ChatRequest.fallback` + `send_with_fallback` switch only on quota/credit
  errors (`is_quota_error` ↔ `src/ai/fallback.ts`); the response's `provider`/`fallback` are shown
  in the AI label. Settings → "Dự phòng khi hết lượt" (default Groq; used only if it has a key).
  Test key `__STEMSIM_TEST_GROQ_KEY__`; `open_groq_key_page`.
- Default provider is **Gemini** (free tier, key from Google AI Studio; the key's creator must be
  18+, which the in-app guide says). Default model `DEFAULT_MODELS.gemini` in `src/ai/aiStore.ts`
  (checked 2026-10; update when Google retires it). LM Studio was removed on request (2026-10):
  it is the user's separate local tool, unrelated to this app. Do not add local providers back.
- `src/ai/pipeline.ts` classify → extract → `buildDraft` (`src/ai/draft.ts`): numbers must appear
  in the text (`src/ai/numbers.ts`) or be implied by a phrase in `IMPLIED` with a real quote.
  Defaults are filled in code. `explain.ts` hides explanations containing foreign numbers.
- UI in `src/app/ai/`: `analyze.ts` (controller store), `ProblemDialog` ("Tôi hiểu đề như sau",
  manual "Tự dựng cảnh", unsupported/error views), `AiSettings` (Settings → "Kết nối AI": show/hide
  key, masked hint, "Kiểm tra key", guide drawings in `GuideArt.tsx`), `useAiStatus` (no background
  calls; "Kiểm tra key" probes key + model + quota), `ExplainBox`. No key → the "Phân tích đề"
  button opens Kết nối AI. Tests: `tests/golden`, `src/app/ai/analyze.test.ts`, `tests/e2e`.
- When a new physics scene is added, its params become extractable automatically; add golden
  problems for it in `scripts/golden/make_physics_golden.py` and regenerate `physics.json`.

## Learner UI (3b.4, PROMPT_PHAN_2 A4)

- `src/app/learner/`: `HomeScreen` ("Hôm nay học gì?", shown by `AppShell` while `useIsHome()`;
  no stage/timeline/bottom/inspector then, and the top-bar problem box is hidden — the home box is
  the main action), `Onboarding` + `onboardingPhase.ts` (not `onboarding.ts`: Windows is case-insensitive, `Onboarding` would resolve to it) (`useOnboardingPhase`: profile → gate → connect
  (main, only when status is `noKey`) → tour; `AgeGate hold`, the Tour waits for its phase),
  `profileStore` (`stemsim.profile`: level, interests, lastTopic; users with `stemsim.tourDone`
  skip onboarding), `ModeSwitch`.
- `uiMode` in `settingsStore` (v2; v1 users migrate to `advanced`, new installs `basic`). Basic:
  `basicSplit` (`src/app/sim/basicParams.ts`, first 5 params + any from the problem/user), no data
  tab/CSV, no Object section, toolbar without protractor/stopwatch/trail. New panels must respect it.
- Levels: `src/app/levels.ts` (`foundation` available, `general` planned). Curriculum mapping is
  empty + `review_status: "pending"` (DATA_REVIEW #12) — never fill it without a teacher.
- Tokens: `--subject-*` colors, `--text-content` (≥ 15px learning text), `--target` (≥ 40px; `.btn`
  height; icon buttons grow under `any-pointer: coarse`). E2E checks 1366×768 without horizontal
  scroll (`tests/e2e/learner.spec.ts`). Confirmation table = `qty-cards` (`quantityIcon.ts`).
- Learner-facing errors speak like a study partner ("Mình chưa…"); no "JSON/engine/token/LLM".

## Learning (3b.5, `src/learn/`)

- `challenges.ts`: every physics topic has ≥ 1 challenge (`challenges.test.ts` enforces it).
  Goals are checked with the scene's own `solve()` (`evaluate`, `optimum` grid search for max/min);
  a `target` value is the only hand-written number and the test proves it reachable within the
  sliders for g = 9.8 / 9.81 / 10. A challenge starts from defaults (`sim.applyParams` with all
  sources "default"); a non-control param with a non-default source → "changed".
- `poe.ts`: one "Dự đoán trước" per physics topic; the right choice is computed from `solve()`
  before/after (`observe`). The learner writes the explanation (never stored or sent).
- `progressStore` (`stemsim.progress`, local only), `progress.ts` (topic/chapter progress, badges —
  no streaks or ranks), `breakReminder.ts` + `useBreakReminder` (~45 min of continuous use).
- SolutionPanel: a typed-in problem shows hints first (Gợi ý n → Lời giải đầy đủ, "Xem lời giải ngay").
- New physics scene → add a challenge and a POE item, or the tests fail.

## Safety (3b.3, PROMPT_PHAN_2 A3)

- Gates live in Rust `src-tauri/src/safety.rs` (`safety_*` commands, `safety.json`,
  `incidents.json`); `ai_chat`/`ai_models`/`ai_test_key` return `notAllowed` while closed, and
  `ai_set_key` needs the 18+ confirmation (main) or the supervisor PIN/session (pilot). Never move
  a gate into the web page only. Bump `TERMS_VERSION` (Rust **and** `src/safety/safety.ts`) when the
  terms change.
- Web side `src/safety/`: AgeGate, SafetySettings, AiContentBar (label + report — put it on every
  new AI output), CrisisCard, PrivacyDialog, `moderation.ts` (`checkInput` before every AI call,
  `outputIsSafe` on every AI text). The incident log stores **kind + time only**.
- Pilot pay-for key: an 18+ student or a parent owns the Anthropic account (`docs/PILOT_CONSENT.md`).
  Legal sources and open questions: `docs/LEGAL_COMPLIANCE.md` (list, never conclude).
- Unit tests run with an open gate (`tests/setup.ts`); E2E storage state pre-answers it.

## Modules (chemistry, biology — Phase 4+)

- A non-physics topic is a `ModuleView` (`src/modules/types.ts`): `Stage`, optional `Panel`
  (Inspector) and `Bottom`. Register a lazy loader in `src/modules/registry.ts`; the catalog marks
  the topic available automatically. Modules publish their Science Card with `usePublishCard`.
- Chemistry: data in `data/elements.json`, `data/molecules.json`, `data/reactions.json`, generated by
  `scripts/data/gen_*.py` (mendeleev, RDKit, SciPy). Never hand-edit the JSON; change the generator.
- Code: `src/chemistry/{data,atom,periodic,molecule,reaction,particles}`, `formula.ts` (parser),
  `balance.ts` (exact null-space balancer). three.js viewers render on demand; RDKit.js is lazy.
- Shared UI: `src/ui/charts/XYChart.tsx` (uPlot), `src/ui/canvas/useCanvas.ts`.
- Biology: `src/biology/{division,central,genetics,ecology,enzyme,transport}` — pure model files
  (`*.ts`, tested) + `*Views.tsx`; `modules.ts` lists the 11 ModuleViews. Small shared controls in
  `src/biology/ui.tsx` (`Range`, `Segmented`) and `fmt.ts` (`useFmt`, `niceStep`). Genetic code in
  `data/genetic_code.json` (`scripts/data/gen_genetic_code.py`).
- Projects (Phase 6): `src/app/project/` — `snapshot.ts` (.stemsim schema; inputs only), `undo.ts`,
  `history.ts` (Rust SQLite `src-tauri/src/history.rs`), `actions.ts` (save/open/PNG/CSV via Rust
  dialogs in `files.rs`), `FileMenu`, `SourcesDialog` (lazy), `Tour` (first run, `stemsim.tourDone`).
  **Every new module must set `ModuleView.state = bindStore(store, inputKeys)`** so files, history
  and undo work. E2E runs with `tests/e2e/storage-state.json` (tour already done).
- Overload: render loops call `reportOverload()` from a `FrameMonitor`; memory watchdog in
  `src/perf/memory.ts` (`registerCacheRelease`).
- KaTeX: never put Vietnamese words inside `\text{}` — use the equation `label` instead.

## Phase status

- [x] Phase 0: project scaffold, design system, layout shell, theme, i18n, CI
- [x] Phase 1: core (units, constants, integrators, fixed timestep, worker, quality tier, Science Card)
- [x] Phase 2: Physics 2D MVP (13 topics, canvas stage, tools, graphs, solutions, CSV)
- [x] Phase 3: AI layer (Gemini/Claude via Rust, SceneSpec checks, confirmation table, golden set, E2E)
- [x] Phase 4: Chemistry MVP (atoms, 3D molecules, VSEPR, 39 reactions/10 mechanisms, balancer, particles)
- [x] Phase 5: Biology MVP (11 topics: cell division, central dogma, genetics, ecology, enzymes, transport)
- [x] Phase 6: overload ladder, watchdog, presentation mode, tour, .stemsim files, undo/redo, history, sources page
- [x] Phase 7: Windows installer workflow (`.github/workflows/release.yml`: tag `v*` or manual run →
      NSIS `.exe` + `.msi`), final USER_GUIDE and SCIENCE_ACCURACY (§9 limitations, §10 how to verify)
- [ ] Phase 3b (PROMPT_PHAN_2 A7) — plan `docs/PLAN_PHAN_2.md` (approved 2026-10-05):
  - [x] 3b.1 AIProvider (Gemini + Claude), OpenAI removed, two editions, retry/daily cap/cache
  - [x] 3b.2 AI connection screen (PIN lock for the pilot comes with 3b.3)
  - [x] 3b.3 safety & compliance (age gate, PIN, consent, moderation, incident log, privacy page)
  - [x] 3b.4 learner UI (home, onboarding, Basic/Advanced, levels, quantity cards)
  - [x] 3b.5 learn/ (predict–observe–explain, challenges, step hints, progress/badges, break reminder)
  - [x] 3b.6 two installers + update channels, `docs/USER_TESTING.md`
- [ ] AI Teacher T0–T8 (PROMPT_PHAN_2 Part B)
  - [~] T0 specs (`docs/TEACHSCRIPT.md`, `docs/AI_TEACHER_ARCHITECTURE.md`, `docs/VOICE_BENCHMARK.md`),
    sketch route `src/teacher/` (dev builds only) — **waiting for user approval**
- [ ] Phase 8+: extensions (MASTER_PROMPT §6.2, advanced 3D/biology) — only on request

## Release

- Full procedure: `docs/RELEASE.md`. Windows installers are built by GitHub Actions on
  `windows-latest` (no cross-compiling from Linux). Actions → Release → Run workflow (publish=true)
  or a tag `v<package.json version>` → published GitHub Release (installers + signed web update).
- **Two version numbers:** `package.json` = web part (in-app update, `src-tauri/src/webupdate.rs`
  serves a downloaded, Ed25519-signed `web-bundle.zip` instead of the embedded assets);
  `tauri.conf.json` + `Cargo.toml` = native part. Frontend-only change → bump `package.json` only.
  Rust change → bump both (same number); the web update then carries `minNative` and older apps are
  told to reinstall. Never break Rust command signatures without bumping the native version.
- The signing key is the GitHub secret `WEB_UPDATE_SIGNING_KEY`; the public key is in
  `webupdate.rs`. The repo must be public for the app to download releases.
- **Two installers / two update channels (3b.6):** main (`tauri.conf.json`, `vn.stemsimlab.desktop`,
  `web-update.json`) and pilot (`tauri.pilot.conf.json` merged on top: "STEM Sim Lab THPT",
  `vn.stemsimlab.pilot`, `build:pilot`, `--features edition-pilot -- --no-default-features`,
  `web-update-pilot.json`). Pilot manifests sign an extra `edition:pilot` line; the app checks the
  manifest's `edition` and the zip's `web-edition.txt`. `web-bundle.mjs <main|pilot>` packs one
  edition. Never let the pilot config override security/CSP or the version (tested).
- **Update window / mandatory updates (0.3.0+):** the start-up check opens `UpdateDialog` when a
  version is available ("Cập nhật ngay" / "Để sau"). Release input `required` → signed
  `minRequired` (v2 signature `signed_message_v2` ≡ `scripts/release/manifest-message.mjs`, tested
  on both sides); running below it → dialog cannot be dismissed. The workflow carries the latest
  floor forward. Keep the v1 `signature` for pre-0.3.0 apps.
- User testing protocol and results: `docs/USER_TESTING.md` — record real observations only.
- Smart App Control blocks unsigned installers; in-app web updates avoid new executables.
- WebView2: `downloadBootstrapper` (small installer). Offline machines without WebView2 need the
  Evergreen Standalone Installer first (documented in USER_GUIDE). Installers are not code-signed.
