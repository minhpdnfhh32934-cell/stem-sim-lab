# Phase 6G report — Vietnamese / English interface, and a measured render check

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Nothing committed.

## 1. Baseline

- **HEAD:** `e8f7332` "phase 6f: add free-fall station", unchanged. One worktree, no stash, no
  remote. The working tree held only this session's uncommitted 6G.1 work (the language setting,
  20 files); this phase continues it.
- **On `e8f7332`** (Phase 6F, same machine): `npm run check` PASS 320/320 in 28 files;
  `npm run test:e2e` PASS 22/22; `npm run bench` (gpu-headless, software) PASS.
- **On the 6G.1 state:** `npm run check` PASS 328/328 in 29 files; `npm run test:e2e` PASS 23/23.

## 2. Scope

P1: a real Vietnamese / English setting — a structured catalog with checks, no language branches,
the choice stored and restored, safe fallbacks, the main flows translated, tests through the real
Settings UI, the free-fall station working in both languages. P2: render optimization only with
convincing evidence. P3: final validation.

## 3. Bilingual interface (P1)

**Design** (`docs/game-core.md`, Languages):

- `core/i18n.ts`: `Texts` with `ui(key, english, params)` and `of(content, field)`;
  `createTexts` reads the current language at every call, so one instance (`game.texts`) follows a
  change at once; `ENGLISH` for code run without a game; `localized(...)` for schemas.
- Interface text is written in English where it is shown, under a structured key; Vietnamese is
  in `src/content/strings.json` (141 keys). English output is byte for byte what it was: every
  existing English assertion passes unchanged.
- Content carries its own translations beside its English (`"vi": { "label": "…" }`, 254 texts in
  seven files), validated by the schemas (strict: no unknown field, no empty text). A placement
  translates its `label` parameter in its own `vi` (parameters hold only plain values).
- Systems get `texts` as a dependency: interaction (labels are getters, so a prompt is always in
  the current language), procedures, stations, physics and saves (their menu-visible errors).
  `LanguageChanged` re-renders the main menu, HUD, results panel and station screens.
- Storage: `simlab.settings.language`, outside the save (`SAVE_VERSION` stays 2). Unknown value →
  English and a warning; unreadable or unwritable storage → English / the choice for this visit.

**Translated:** main menu and Settings; HUD (controls hint, prompts and action labels, holding,
notices, objective panel, inspect texts, refusals); cleanroom entry (procedure name, stages, the
15 steps, conditions, refusals, entry block); every item, room, scene and laboratory name,
description and sign; door and control labels (RUN/STOP/RESET → CHẠY/DỪNG/ĐẶT LẠI); the three
Physics Lab experiments (names, parameters and presets, measurements, results, graphs, instruments,
notes, checklists); station refusals; desk and monitor screens; the results panel and run history
(tables, readings, uncertainty notes, comparison, badges, hints); save and physics-loading errors
shown in the menu.

**Not translated, on purpose:** formulas, symbols, units and every number ("." kept as the decimal
separator); ids; logs; the debug panel; CSV exports; a model's own failure details; the boot error
screen (shown before any language is available). The simulation layer's refusal reasons stay
English: no player sees them (the station's guard refuses first, translated).

## 4. Render check (P2) — measured, not kept

**Hypothesis, confirmed in code:** the Physics Lab's shadow camera covers all three rooms
(`WorldRenderer.setLighting`), and three.js draws every shadow caster inside it, so the shadow pass
draws objects in rooms the player cannot see.

**Tried:** fixed objects cast shadows only in the player's room and the rooms its doorways lead
into; moving objects always; shadow map unchanged. Measured with `npm run bench --
--project=gpu-headless --project=software`, three runs (before 6G code, before the change, after):

| Scenario (room)             | Draws before → after | GPU ms, RTX 5070 Laptop (ANGLE D3D11)\* | GPU ms, SwiftShader   |
| --------------------------- | -------------------- | --------------------------------------- | --------------------- |
| idle, down the lane (range) | 104 → 85             | 2.03 / 2.01 → 2.01                      | 17.54 / 17.74 → 17.06 |
| interacting (range)         | 80 → 61              | 1.84 / 1.89 → 2.05                      | 20.73 / 20.23 → 20.04 |
| ball in flight (range)      | 105 → 86             | 2.07 / 2.04 → 2.14                      | 23.95 / 23.37 → 22.83 |
| after landing (range)       | 107 → 88             | 2.03 / 2.07 → 2.47                      | 18.20 / 17.79 → 17.67 |
| pendulum idle (bay)         | 98 → 82              | 2.39 / 2.41 → 2.05                      | 16.50 / 15.75 → 15.84 |
| pendulum swinging (bay)     | 98 → 82              | 2.31 / 2.30 → 2.11                      | 18.52 / 17.88 → 17.50 |
| history closed (bay)        | 78 → 62              | 1.87 / 1.94 → 2.04                      | 16.27 / 15.36 → 15.22 |

\* Headless, the real GPU at 1280 × 720; every GPU frame took 3.33 ms (300 fps, the display cap)
before and after. Run-to-run spread without any change: up to ~5 % (GPU) and ~6 % (SwiftShader).

**Decision:** draws fell as predicted (−19 in the range, −16 in the bay), but the frame time could
not improve (capped), the real GPU's time moved both ways beyond its spread, and SwiftShader gained
1–5 %, within its spread — the final run of the unchanged renderer moved as much (idle 17.74 →
17.19 ms). The benefit is not clear and the change hides far shadows seen through two doorways, so
it was reverted; the renderer is unchanged. Worth revisiting with a GPU-bound scene (more rooms or
casters, or a weaker GPU), measured the same way.

## 5. Tests

- **Unit (16 new):** `core/i18n.test.ts` (5: fallback, live language, placeholders in each
  language's order, content translations, schema strictness); `game/strings.test.ts` (4: every
  `texts.ui` call written as literals, one English per key, every key in Vietnamese with the same
  placeholders, no unused translation); `content.test.ts` (2: every content text has Vietnamese and
  keeps it through validation; empty or unknown translations rejected); `Game.test.ts` (5: default
  English, stored and restored outside the save, unknown values, throwing storage, play in
  Vietnamese — labels, refusals, procedure, station, door labels — switched back at once, a
  Vietnamese Continue error).
- **E2E (3 new):** `settings.spec.ts` (the menu in both languages through Settings, reload,
  unknown stored value, 430 px); `vietnamese.spec.ts` (free fall chosen in Settings and played
  through in Vietnamese — objective, prompts, notice, results panel — with the same numbers as
  `free-fall.spec.ts`; the cleanroom entry's objective, prompt and refusal in Vietnamese).
- **No existing assertion changed.** The two 6G.1 tests replaced in `content.test.ts` and the
  6G.1 `Game.test.ts` calls were this phase's own, uncommitted.

## 6. Verification

Final runs, after the last code change (the P2 revert):

| Check                                                        | Result                                                                     | Duration |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | -------- |
| `npm run check`                                              | **PASS**: 336/336 unit tests (320 + 16), 30 files; typecheck, lint, format | 17 s     |
| `npm run build`                                              | **PASS** (main chunk 858 kB, Rapier chunk loaded on demand)                | 4 s      |
| `npm run test:e2e`                                           | **PASS**: 25/25 (22 + 3 new), first run, no flaky retry                    | 353 s    |
| `npm run bench -- --project=gpu-headless --project=software` | **PASS**: 7 passed, 1 skipped by design (frame-rate sweep is GPU only)     | 253 s    |
| bench `gpu`, `gpu-native`                                    | **NOT RUN**: visible windows that take the mouse                           | —        |

Earlier in the phase: `npm run test:e2e` 25/25 after P1 (361 s); the bench three times for P2
(254 s each). E2E runs on SwiftShader (software WebGL); no frame rate from it is a GPU result.

**Visual check** (reviewed): `test-results/vietnamese-1-desk.png` (desk screen, monitor and board
in Vietnamese), `vietnamese-2-monitor.png`, `vietnamese-3-results.png` (results panel, the same
numbers as in English), `vietnamese-4-entry-blocked.png` (cleanroom objective and refusal),
`settings-menu-vi.png` and `settings-menu-vi-430x860.png`.

## 7. Known limitations

- The Vietnamese text was written by the assistant; a native speaker should review it.
- The language is chosen in the main menu only (there is no pause menu); signs are drawn at scene
  load, so a future in-game switch would need them redrawn.
- A model's failure details, the boot error screen, logs, the debug panel and CSV stay English.
- At 1280 px the Vietnamese character names wrap onto two lines in their labels; the menu fits a
  430 px window.

## 8. Next step

A native review of `strings.json` and the content `vi` texts; then, if wanted, Settings in an
in-game pause menu (it would also redraw signs on `LanguageChanged`).
