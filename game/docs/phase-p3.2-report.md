# Phase P3.2 report — UI foundation

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.2.

**Verdict: PASS WITH LIMITATIONS.** A central token set and shared buttons are in place and used by
Pause, Settings, the leave confirmation, the main menu and the catalog. Check, build, the related
e2e and the full e2e run (43/43) pass. Not verified:

- the real-browser path played by hand (real mouse, real Esc, zoom);
- a hardware GPU.

## 1. Repository audit and baseline

HEAD was `0f716c1` (phase p3.1) on `main`, with a clean working tree. The baseline:

- `npm run check` PASS, 441/441.
- `npm run build` PASS (JS 936.70 kB, CSS 19.13 kB).
- No baseline failure.

What the audit found:

- **One stylesheet.** All interface styles are in `src/platform/ui/styles.css`, which had 1,463
  lines.
- **Few tokens.** It had 5 tokens (`--ink`, `--ink-dim`, `--panel`, `--accent`, `--error`), and
  many repeated literal values. The accent at 28 % was written out 5 times, `#f2f8fc` 3 times, and
  the warn and success colours 3 times each.
- **Two button styles.** The main menu's buttons glowed on hover. The pause dialog's (P3.1) had
  their own scoped copy: flat, 46 px, with a halo on focus.
- **Focus rules in two places**, with different looks.
- **Where `.menu-button` is used:** only the main menu, the catalog and the pause dialog.
- **Areas with their own identity:**
  - the results panel: green instrument text, tabular figures, dense tables;
  - the HUD plates over the scene;
  - the menu art (R1–R3).

## 2. Tokens and shared components

Everything is in `:root` at the top of `styles.css`, as plain CSS custom properties.

| Group            | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours          | `--bg`; surfaces `--surface-top-rgb` / `--surface-bottom-rgb` (gradient channels), `--surface-raised`, `--surface-hover`, `--surface-pressed`; `--panel` (HUD plates); text `--ink-strong`, `--ink`, `--ink-dim`; accent `--accent-rgb`, `--accent`, `--accent-bright`; lines `--line`, `--line-frame`, `--line-strong`; primary `--primary-top`, `--primary-bottom`, `--primary-border`; `--caution-rgb`, `--caution-ink`; status `--warn`, `--error`, `--success` |
| Type             | `--font-sans` (system face, Vietnamese included), `--font-mono`, `--text-xs` … `--text-xl` (12–22 px), `--leading`, `--label-tracking` (short capitalised labels only)                                                                                                                                                                                                                                                                                              |
| Spacing          | `--space-1` … `--space-7` (4–28 px)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Shape and depth  | `--radius-frame` (the menu's instrument frames), `--radius-sm` … `--radius-xl`, `--shadow-dialog`, `--glow-frame`, `--control-height`                                                                                                                                                                                                                                                                                                                               |
| Focus and motion | `--focus-ring`, `--focus-offset`, `--focus-halo`, `--duration-fast`                                                                                                                                                                                                                                                                                                                                                                                                 |

Shared components:

- **Buttons (`menu-button`)**, one style in every menu:
  - secondary by default; `primary` for a view's main action; `caution` for leaving or losing
    something (quieter, with a warm edge);
  - hover, active, `:focus-visible` (outline and halo, warm on caution) and disabled (opacity 0.5,
    still legible, no hover);
  - no transition under `prefers-reduced-motion`.
    The pause dialog's scoped copy was folded into this.
- **`menu-back`**: a compact secondary button for a page header.
- **Fields (`menu-choice`)**: a labelled fieldset that wraps when narrow; its radios take the accent
  and the shared focus.
- **Focus**: one rule for menu buttons, radios, disclosure summaries (Settings, catalog) and the
  developer panel's buttons.
- **Titles**: the catalog's title and the pause dialog's share a style (`--text-xl`, 600,
  `--ink-strong`). Section labels are short capitalised labels over a rule.

## 3. Areas

- **Applied:**
  - the pause dialog (surface, title, note);
  - Settings, in both places it is shown;
  - the leave confirmation;
  - the main menu: buttons, the instrument frame and the character choice;
  - the catalog: frame, header, titles, text sizes, item rule;
  - the HUD status colours (warn and success, same values);
  - the developer panel's font.
- **Kept as they are, on purpose:**
  - the results panel and its analysis: an instrument look and dense numeric tables, which carry
    risk and have a different purpose;
  - the HUD's layout and plates, which stay light over the scene;
  - the menu art and its motion;
  - the 3D scene, whose colours are its materials, never these tokens.
- **Visible changes**, the rest renders as before:
  - the main menu's buttons now match the pause dialog's: flat, 46 px, with no glow;
  - radios take the accent colour;
  - focus has an outline and a halo everywhere;
  - the catalog's back button is compact and its title is 600 weight.

## 4. Files

- `src/platform/ui/styles.css`: the tokens, the shared buttons, field and focus styles, and the
  token values put into the menu, catalog, pause and HUD rules. Other colours were rewritten
  through `--accent-rgb` with the same values.
- `docs/development-guide.md`: a convention for interface styles.
- This report.
- No TypeScript, DOM, test or content change.

## 5. Tests

| Command                                                                                                       | Result                                        |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                                                               | **PASS** 441/441, 39 files                    |
| `npm run build`                                                                                               | **PASS**                                      |
| `npx playwright test menu.spec pause.spec settings.spec topics.spec world.spec vietnamese.spec --project=dev` | **PASS** 14/14                                |
| `npx playwright test production.spec --project=production`                                                    | **PASS** 1/1                                  |
| `npm run test:e2e` (3 workers, no retry)                                                                      | **PASS** 43/43, 0 failed, 0 skipped (8.7 min) |
| `git diff --check`                                                                                            | clean                                         |

The existing tests cover the parts this phase touches:

- `pause.spec`: the dialog at 1280, 430 and 360 px, focus outlines, reduced motion.
- `history.spec`: the menu at 430 px.
- `menu.spec`, `settings.spec`, `topics.spec`, `vietnamese.spec`.

All of them pass unchanged.

## 6. Visual check

- Before and after screenshots were taken with a temporary spec, now deleted, in headless Edge at
  1280×720 and 360×640:
  - main menu, in English and Vietnamese;
  - catalog;
  - pause;
  - pause Settings;
  - the leave confirmation.
- They were saved to the session's scratchpad (`before/`, `after/`). The after shots were
  reviewed.
- What the shots show:
  - Vietnamese text wraps cleanly at 360 px;
  - nothing scrolls sideways;
  - the instrument frames and the catalog's layout are unchanged apart from the buttons.
- Not done:
  - no hands-on check in a real browser;
  - no GPU check: everything ran on SwiftShader, and no hardware GPU was validated.

## 7. Bundle and dependencies

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 936.70 kB | 936.70 kB | 0        |
| CSS   | 19.13 kB  | 21.00 kB  | +1.87 kB |

No dependency was added. The JS stays under the 1,000,000-byte budget.

## 8. Limitations

- The results panel, analysis and HUD layout were not brought onto the shared components (§3). A
  later pass can do it panel by panel.
- The tokens are used by the areas above only. Literal sizes remain elsewhere: results, HUD and
  menu art.
- Contrast was judged by eye, not measured. `--ink-dim` on the panel surfaces is the value used
  before.
- No hands-on check in a real browser. No GPU validation.

## 9. Git

- Base `0f716c1`; committed as phase p3.2, not pushed.
- `git diff --stat`: 2 files, +239 −174, plus this report (new).

## 10. Next

- Bring the results panel's controls (run list, analysis selects, buttons) onto the shared button,
  field and focus styles while keeping its instrument look.
- Then the HUD plates.
- A hands-on check in Edge on the real GPU.
