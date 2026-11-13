# Phase 13B report — learning objectives in the experiment catalog

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Starting state

HEAD `412925a` (phase 12b), clean working tree, no remote. Baseline: the Phase 13A runs on this
same HEAD earlier the same day — `npm run check` PASS 353/353, `npm run build` PASS,
`npm run test:e2e` PASS 28/28 (395 s). They were not rerun before the change.

## 2. Change

- **Catalog** (`src/platform/ui/MainMenu.ts`, `topics()`): each experiment's `<li>` now holds its
  line, unchanged (`<span class="menu-experiment">`), and under it
  `<p class="menu-objective">` with `t.of(experiment, 'description')`. That is the description
  already in `experiments.json`, in the language shown, else the English (`Texts.of`). Like every
  menu text, it is drawn again on `LanguageChanged`.
- **Style** (`src/platform/ui/styles.css`):
  - `.menu-objective` is 13 px with line height 1.4, 2 px above and 8 px below. Its colour is the
    list's dim ink, so it reads as secondary to the experiment's line and wraps naturally.
  - `.menu-objective:empty` is hidden. The schema defaults a description to `''`, and such an
    experiment shows nothing under its name.
- No new text, key, content or translation. The catalog data, routes, save and models are unchanged.

## 3. Tests

- **New e2e** (`e2e/topics.spec.ts`): "menu topics: each experiment shows its learning objective
  under its name".
  - For every experiment in catalog order, the expected text comes from `experiments.json`: the
    Vietnamese if any, else the English, as `Texts.of` picks it.
  - It checks the text, that it is visible, and that it sits below the experiment's line
    (bounding boxes).
  - It runs in English, then in Vietnamese through Settings, then at 360 × 640. At that size it
    also checks that neither the menu nor any item overflows sideways.
- **Existing Phase 9 test:** two selectors and one step changed; no expected value changed.
  - The two line-text assertions now target `li > .menu-experiment` instead of `li`, because each
    item now also holds its description. The texts, their order and the `li` count assertion are
    unchanged.
  - Before the "panel starts on screen" check at 520 px, the menu is scrolled to its top. With both
    sections open the menu is now 977 px tall, so clicking Settings at 720 px scrolls it.
    Measured in Edge: `scrollTop` 257, the panel's top at 0 in the scrolled content, and on screen
    after scrolling back. The assertion itself is unchanged and still fails if the panel's top
    were cut off.
- **No unit test:** there is no new logic, only one call to the existing `texts.of`.

## 4. Verification

| Check                                  | Result                                                                 | Duration |
| -------------------------------------- | ---------------------------------------------------------------------- | -------- |
| `npm run check`                        | **PASS**: 353/353 unit tests, 31 files                                 | 21 s     |
| `npm run build`                        | **PASS**                                                               | 4 s      |
| `npm run test:e2e`, run 1              | **FAIL**: 23 passed, 2 failed, 4 did not run (`dev-timed` needs `dev`) | 384 s    |
| retry of the 2 failed tests            | **PASS**: 2/2                                                          | 114 s    |
| `npm run test:e2e`, run 2 (server log) | **PASS**: 29/29 (28 + 1)                                               | 361 s    |
| `git diff --check`                     | clean                                                                  | —        |
| `npm run bench`                        | **NOT RUN**: the menu only, nothing in rendering                       | —        |

Each command ran on its own, after the previous one finished.

Run 1's failures:

- `experiment.spec.ts:51` (projectile): a click on `.viewport` timed out because the main menu
  intercepted it.
- `free-fall.spec.ts:50`: the test expected focus on `physics-lab/button-reset`. The debug panel
  showed a freshly started game instead: phase menu, 2 events published, Rapier not loaded.

Both pages were reloaded mid-test, between 11:54:28 and 11:54:54 judging by their screenshots.
Neither test reloads, and nothing in `src` does. Neither test touches the menu. Vite's dependency
cache was not rewritten during the run.

This is the same pattern as the three failures of Phase 12A's first run. Run 2 kept the dev
server's own output, which Playwright otherwise discards: there was no reload, HMR update,
dependency rebuild or restart, and every test passed. The cause is still unknown. A failing run
should keep the server log the same way.

## 5. Limitations

- The descriptions are the content's existing text. Their Vietnamese has not been reviewed by a
  native speaker (Phase 6G).
- They appear in the menu catalog only, not at the stations.
- With the topics and Settings both open, the menu is taller than a 720 px window and scrolls.
- The intermittent mid-test reload in the e2e suite (§4) remains unexplained.

## 6. Next step

From the Phase 13A backlog: mark the Chemistry and Biology labs as planned, or show the
experiments a save has completed.
