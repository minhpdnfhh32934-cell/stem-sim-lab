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
  Rust backend (src-tauri): AI gateway (LM Studio / cloud, keys in OS keychain), SQLite,
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
- `capabilities/default.json`: only `core:default`. New permissions must be added explicitly.
- CSP in `tauri.conf.json`: `'self'` only, plus `wasm-unsafe-eval` for Rapier/RDKit WASM and
  `blob:` workers. `devCsp` also allows Vite's inline dev preamble and the HMR websocket.
- Release profile tuned for size (`lto`, `opt-level = "s"`, `strip`).

## 4. Planned modules

| Phase | Module                                                                           | Key decisions                                                                                                                       |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `core/` units, constants, integrators; `workers/`; `perf/` tier; Science Card UI | RK4, Velocity Verlet, RK45 adaptive, implicit (stiff); accumulator with max substeps.                                               |
| 2     | `physics/` 2D scenes                                                             | Own solvers for textbook problems; Rapier for free sandbox; uPlot graphs; KaTeX solutions.                                          |
| 3     | `ai/` + Rust AI gateway                                                          | OpenAI-compatible LM Studio `http://localhost:1234/v1` with JSON-schema structured output; Zod; max 2 repair retries → manual form. |
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
