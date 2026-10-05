# Architecture — STEM Sim Lab

Status: **Phase 0** (scaffold). Sections marked _(planned)_ describe the target design from
`MASTER_PROMPT.md` and are filled in as each phase lands.

## 1. Overview

```
┌──────────────────────────── Tauri 2 window (WebView2 on Windows) ───────────────────────────┐
│  React UI (main thread): layout, panels, rendering (Canvas 2D / PixiJS / three.js)          │
│        │ state: Zustand stores               │ postMessage                                   │
│        ▼                                     ▼                                               │
│  Science Card · graphs (uPlot) · KaTeX   Web Workers: simulation engines (fixed timestep)   │
│        │ invoke()                                                                            │
└────────┼─────────────────────────────────────────────────────────────────────────────────────┘
         ▼
  Rust backend (src-tauri): AI gateway (`AIProvider`: Gemini + Claude, keys in OS keychain), SQLite,
  .stemsim files, heavy numeric kernels (planned)
```

Principles:

1. **Deterministic engines own every number.** The LLM only extracts and explains (§2 of
   MASTER_PROMPT).
2. **Physics runs separately from rendering.** Physics steps at a fixed timestep in a worker, and
   the UI interpolates between states _(Phase 1)_.
3. **Lazy loading.** Physics, Chemistry and Biology modules, RDKit.js and molecule data load only
   when needed _(Phase 1+)_.
4. **Works without AI.** The sample library and the manual scene builder never depend on the LLM.

## 2. Frontend (Phase 0: done)

| Area          | Where                             | Notes                                                                                              |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Entry         | `src/main.tsx`, `src/app/App.tsx` | Loads CSS tokens, mounts `AppShell` + global `TooltipLayer`.                                       |
| Layout        | `src/app/layout/`                 | `AppShell` = TopBar · LeftSidebar · Stage + Timeline + BottomPanel · Inspector · StatusBar.        |
| Resizing      | `Splitter.tsx`                    | Pointer + keyboard (arrows / Home / End / Enter = reset), ARIA `separator`.                        |
| Layout state  | `layoutStore.ts`                  | Sizes clamped to `LAYOUT_LIMITS`, persisted (`stemsim.layout`). Presentation flag not persisted.   |
| Settings      | `src/app/settings/`               | Theme (system/light/dark), language, font scale; persisted (`stemsim.settings`).                   |
| Workspace     | `src/app/workspaceStore.ts`       | Subject, problem text, active tool, playback. From Phase 1 it mirrors the engine worker.           |
| Theme         | `src/app/theme/`                  | CSS variables; `data-theme` on `<html>`; `--font-scale` drives rem sizes.                          |
| i18n          | `src/app/i18n/`                   | Tiny typed i18n (no dependency). `MessageKey` is a union of dotted keys, so typos fail to compile. |
| Shortcuts     | `src/app/shortcuts/`              | Pure table + matcher (unit tested) + one `keydown` listener. IME-safe (Telex/VNI).                 |
| Design system | `src/ui/`                         | IconButton, Tabs, Section, Badges, EmptyState, TooltipLayer, Logo.                                 |
| Catalog       | `src/app/catalog.ts`              | MVP topic list (names only, no scientific data).                                                   |

### Why these choices (Phase 0)

- **Own i18n instead of i18next.** Vietnamese has no plural forms, and we only need two locales.
  About 60 lines with full type safety, versus about 40 KB of dependency.
- **Own splitter instead of react-resizable-panels.** It is a small, accessible component, and we
  need only three splitters.
- **System fonts** (Segoe UI on Windows) instead of bundled web fonts. They have full Vietnamese
  support, add 0 KB to the installer, and render natively.
- **Plain CSS with tokens instead of Tailwind.** It has no build plugin and makes theming with
  variables straightforward.
- **Okabe–Ito chart palette.** It stays readable for color-blind users (`--chart-1..7`).

### Startup and rendering details

- `public/theme-boot.js` is a tiny blocking script. It reads the saved settings and sets
  `data-theme` and `--font-scale` before the bundle loads, so there is no light flash in dark mode.
- Panels are `memo` components with narrow Zustand selectors (`useShallow`). For example,
  dragging a splitter re-renders only the shell, not the panel contents.
- Global shortcuts do nothing while a modal dialog is open, and they never steal Space or Enter
  from a focused control. A key's default action is prevented only when a shortcut actually ran.

## 3. Rust backend (Phase 0: minimal)

- `src-tauri/src/lib.rs`: builder with the `app_info` command (version, OS, debug flag).
- `capabilities/default.json`: `core:default` plus `core:window:allow-set-fullscreen` /
  `allow-is-fullscreen` (presentation mode). New permissions must be added explicitly.
- `files.rs` (Phase 6): `save_file` / `open_text_file` show the native dialog (tauri-plugin-dialog,
  called from Rust only — no JS permission) and read/write only the file the user picked.
- `history.rs` (Phase 6): SQLite (`rusqlite`, bundled) in the app data folder; table `history`
  (topic, subject, title, `.stemsim` snapshot), newest 500 kept. Commands `history_add/update/
list/delete/clear`; the browser build falls back to localStorage.
- CSP in `tauri.conf.json`: `'self'` only, plus `wasm-unsafe-eval` for Rapier/RDKit WASM and
  `blob:` workers. `devCsp` also allows Vite's inline dev preamble and the HMR websocket.
- Release profile tuned for size (`lto`, `opt-level = "s"`, `strip`).

## 3b. AI gateway (Phase 3)

```
Problem text ──► src/ai/pipeline.ts ──► LlmTransport ──► Rust ai_chat ──► AIProvider (Gemini | Claude)
                   │  classify (enum of topic ids, JSON schema)
                   │  extract  (enum of param keys + units, quotes)
                   ▼
            Zod + buildDraft (code): numbers present in text, units, ranges, defaults, missing
                   ▼
    ProblemDialog "Tôi hiểu đề như sau" ──(user confirms)──► sim.open(topic, params, sources)
```

- Rust owns every network call and the API keys (OS keychain via `keyring`). Requests have an id;
  `ai_cancel` aborts them; `tokio::select!` enforces the timeout (default 30 s, retries included).
- **`AIProvider` trait** (`src-tauri/src/ai/provider.rs`): builds the chat/models requests and reads
  the answers. Implementations: `ai/gemini.rs` (`responseJsonSchema`, main edition only) and
  `ai/claude.rs` (forced tool call with `input_schema`, system prompt marked for prompt caching).
  `ai/mod.rs` sends them: retry on 429/5xx with backoff 1 s → 2 s → 4 s or `Retry-After` (max 8 s,
  at most 3 retries; a Gemini _per-day_ 429 is not retried), daily cap counted in
  `ai-usage.json` (`ai/usage.rs`, day = user's local date, cap from Settings, 0 = none).
- **Editions** (PROMPT_PHAN_2 A2): Cargo features `edition-main` (default) / `edition-pilot`, and
  `VITE_EDITION` → `__EDITION__` in the web bundle. The pilot edition does not compile
  `ai/gemini.rs` (the `Provider::Gemini` variant does not exist) and the bundle drops every
  `__EDITION__ === 'main'` branch. Checks: Rust test `pilot_edition_has_no_gemini` (looks for the
  Gemini host in the compiled test program) and `npm run build:pilot`
  (`scripts/edition-bundle.mjs`, fails if `dist/` contains the Gemini host or key header). The
  pilot uses its own keychain service ("STEM Sim Lab Pilot").
- **Kết nối AI** (`AiSettings.tsx`): `ai_test_key` sends one tiny request with the chosen model
  and classifies the answer (`classify_key_test` / `src/ai/keyTest.ts`: 2xx ok, 401/403 or
  `API_KEY_INVALID` bad key, 404 bad model, 429/402/"credit balance" quota, network error offline).
  `ai_key_hint` returns only "••••••••" + the last 4 characters.
- **Cache of confirmed readings** (`src/ai/cache.ts`, localStorage, 100 newest): when the user
  confirms the table, the AI's raw reading (topic + quoted quantities) is stored under the
  normalized problem text. The same problem is then read without any AI call; the code checks and
  the confirmation table still run. "Đọc lại bằng AI" bypasses the cache.
- The web page never sees a key. Without the desktop app (dev/E2E/golden runs) a test key is
  injected by the test runner (`__STEMSIM_TEST_GEMINI_KEY__`, `__STEMSIM_TEST_CLAUDE_KEY__`; Claude
  only from Node); E2E mocks the Gemini server.
- The explanation step (`explain.ts`) runs after the engine; its numbers are checked against the
  engine's answers and the explanation is hidden when it contains any other number.

## 3d. Safety gates (PROMPT_PHAN_2 A3, step 3b.3)

```
first run ──► AgeGate (src/safety) ──► Rust safety_* (safety.json) ──► ai_chat / ai_set_key check
problem ──► moderation.checkInput ──► (blocked: incident kind+time, crisis card) ──► AI ──► outputIsSafe
```

- **Rules in Rust** (`src-tauri/src/safety.rs`), so the page cannot open the AI by itself:
  `status_of` (pure, tested for both editions). Main: `adult_terms == TERMS_VERSION` → AI allowed;
  "under 18" → answered, AI off. Pilot: birth year (`current − year ≤ 18` counts as minor) + recorded
  consent day for minors. `ai_chat`, `ai_models`, `ai_test_key` refuse with `notAllowed` while the
  gate is closed; `ai_set_key` needs the 18+ confirmation (main) or the supervisor PIN / open
  supervisor session (pilot, `key_gate` in `ai/mod.rs`); `ai_delete_key` needs it in the pilot only.
- **Supervisor PIN:** salted SHA-256 × 100 000 rounds in `safety.json`; 5 wrong PINs → 60 s lockout,
  each wrong PIN is an incident. A correct PIN (`safety_unlock`) or setting the PIN opens a 10-minute
  supervisor session held in Rust (`SafetyState.unlocked`); `safety_lock` closes it.
- **Incident log** (`incidents.json`, newest 500): `{at, kind}` only — `inputPersonalData`,
  `inputUnsafe`, `inputCrisis`, `outputUnsafe`, `userReport`, `pinFailed`. Pilot: PIN to read/clear.
- **Web side** (`src/safety/`): `safety.ts` (types, `statusOf` mirror, `TauriSafety`, browser copy
  `BrowserSafety` in localStorage for dev/E2E), `safetyStore.ts` (status, gate visibility, session),
  `moderation.ts` (crisis → personal data → unsuitable; Unicode-aware word boundaries; NFC),
  `AgeGate`, `SafetySettings` (Settings → "An toàn & quyền riêng tư"), `AiContentBar` (AI label +
  report), `CrisisCard`, `PrivacyDialog`. `analyze.ts` runs `safetyBlock` before any AI call and the
  output filter after it; `explain.ts` returns `safe`; prompts get `SAFETY_RULES` (child-safety
  lines in the pilot). Unit tests run with an open gate (`tests/setup.ts`); E2E storage state has
  `stemsim.safety = {adultTerms: 1}`.

## 3c. Projects, undo, history (Phase 6)

- `.stemsim` = JSON `{format, version, app, savedAt, topicId, physics?{params, sources, problem},
module?{state}}` (Zod schema in `src/app/project/snapshot.ts`). Only **inputs** are stored; results
  are recomputed by the engine. Unknown topics, parameters and wrongly typed fields are ignored.
- Module inputs are exposed through `ModuleView.state` (`bindStore(store, keys, apply?)` in
  `src/modules/binding.ts`): the same binding serves files, history and undo/redo.
- Undo/redo (`src/app/project/undo.ts`): snapshots of the open topic's inputs, changes within
  500 ms grouped (slider drags), 100 steps, reset when another topic opens.
- Overload: `FrameMonitor` → `reportOverload()` lowers the drawing tier one step (`perfStore.degraded`);
  memory watchdog in `src/perf/memory.ts`. See docs/PERFORMANCE.md.

## 4. Planned modules

| Phase | Module                                                                           | Key decisions                                                                                                                       |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `core/` units, constants, integrators; `workers/`; `perf/` tier; Science Card UI | RK4, Velocity Verlet, RK45 adaptive, implicit (stiff); accumulator with max substeps.                                               |
| 2     | `physics/` 2D scenes                                                             | Own solvers for textbook problems; Rapier for free sandbox; uPlot graphs; KaTeX solutions.                                          |
| 3     | `ai/` + Rust AI gateway                                                          | Gemini `generateContent` with `responseJsonSchema` / Claude forced tool structured output; Zod; max 2 repair retries → manual form. |
| 4     | `chemistry/`                                                                     | RDKit.js, PubChem conformers bundled offline, curated reaction library with atom mapping.                                           |
| 5     | `biology/`                                                                       | Data-table-driven (NCBI table 1), Monte Carlo compared with theory.                                                                 |
| 6     | degradation ladder, watchdog                                                     | See MASTER_PROMPT §5.                                                                                                               |

## 5. Verified in Phase 0

- `npm run tauri dev` and a debug `tauri build` both open the native window with the full layout
  (checked on Linux/WebKitGTK under Xvfb). The status bar shows the version from the Rust
  `app_info` command, which proves the IPC works.
- Browser checks: tooltips on disabled buttons, Esc closes Settings, Space presses a focused
  control, splitter drag and persistence across reload, dark theme applied before React loads,
  and no horizontal overflow at the 1024×600 minimum window size.

## 6. Testing

- **Vitest + Testing Library (jsdom)**: unit tests next to the code (`*.test.ts`), app-level tests
  in `tests/`.
- **cargo test**: Rust unit tests.
- **Playwright** E2E _(Phase 3)_ and golden problem set _(Phase 2–3)_.
- CI runs format, lint, typecheck, tests and build, plus Rust fmt, clippy and tests on Linux and Windows.
