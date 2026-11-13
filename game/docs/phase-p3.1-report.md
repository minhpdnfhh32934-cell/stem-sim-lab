# Phase P3.1 report — pause menu visual polish

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p3.1.

**Verdict: PASS WITH LIMITATIONS.** The pause menu is now a centred dialog, and the full e2e run is
green (43/43). Not verified:

- the real-browser path, played by hand with a real mouse and a real Esc;
- a hardware GPU.

## 1. Repository audit and baseline

HEAD was `b26016a` (phase p2b) on branch `main`, with a clean working tree. The baseline before
any edit:

- `npm run check`: PASS, 441/441.
- `npm run build`: PASS, JS 936.66 kB and CSS 17.45 kB.

There was no full e2e run on the baseline in this phase; the last one, at P2b, was 42/42.

## 2. Design and files

- **Layout.**
  - The `.pause` overlay centres the dialog both ways, with a 16 px gutter.
  - The dim is `rgb(4 8 14 / 62%)` with `backdrop-filter: blur(2px)`, a light blur with no
    animation.
  - The dim still takes no clicks (`pointer-events: none`), so a click on the scene around the
    dialog resumes the game, as before.
  - The dialog is `min(420px, 100%)` wide and at most the window's height, and scrolls inside
    itself in a short window.
- **Look.**
  - A navy panel with a thin border, a 2 px cyan top edge, a soft shadow and a 10 px radius.
  - On the menu view the title is in capitals with wide spacing ("PAUSED" / "TẠM DỪNG", through
    `data-view='menu'`).
  - The note is set apart from the buttons by a rule.
- **Hierarchy.**
  - Resume is the primary button: solid cyan-blue.
  - Settings is a quiet secondary button.
  - Back to the main menu is a transparent "caution" button with a warm edge, a little apart from
    the others. The confirmation's leave button uses the same style.
  - No icons: the project has no icon system, and none was added.
- **States.**
  - Hover, active (darker) and keyboard focus: a 2 px light outline plus a 5 px halo, warm on the
    caution buttons.
  - Disabled keeps the existing `.menu-button:disabled` style.
  - Under `prefers-reduced-motion: reduce` the buttons change without a transition.
- **Files.**
  - `src/platform/ui/styles.css`: the pause block, scoped to `.pause` and `.pause-panel`. The main
    menu's buttons are untouched.
  - `src/platform/ui/PauseMenu.ts`, 3 lines: `data-view` on the panel, and `caution` on the leave
    buttons.
  - `docs/interaction.md`, `docs/development-guide.md` and this report.
  - The e2e files are covered in §3.

## 3. Behaviour preserved, and the e2e harness

No game code changed apart from those 3 lines: pause, resume, Settings, the save before leaving,
the leave confirmation, pointer lock, `SAVE_VERSION`, the run history and completions are as they
were.

The e2e harness did need changes:

- **Why the first run failed.** The helpers freed the mouse (which pauses the game, P1) and then
  clicked the exact centre of the view to capture it again. The centre is now the dialog, so those
  clicks were intercepted. This was the cause of 8 failures in the first related run, then 4, then 2.
- **What changed.** A new `captureAt` helper in `e2e/support.ts`, used by `Aim.to`, by `grab.spec`'s
  own `Aim`, by `game.spec` and by `production.spec`. When the dialog shows, it:
  1. moves the mouse to the point;
  2. presses Enter on the focused primary button (a key press counts as the user gesture pointer
     lock needs, and the button is found by class, so it works in Vietnamese too);
  3. puts Tab's starting point back on the scene, as a click there would.
     Otherwise it clicks the view as before.
- **Why Enter rather than a click beside the dialog.** The mouse must stay at the point the moves
  start from. The headed bench reads its deltas from the window's centre, and a click elsewhere
  would break that.
- **Why the Tab step.** Without it, Tab started from the Resume button near the end of the page,
  left the page, and the browser released the pointer. That reproduced `history.spec:305`.
- **The Esc-and-click test.** `history.spec`'s keys test now clicks the scene beside the dialog,
  at (24, 360). That still tests "a click on the scene resumes" as a player does it.
- No timeout or retry was raised.

## 4. Tests

| Command                                                                 | Result                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| `npm run check`                                                         | **PASS** 441/441, 39 files                    |
| `npm run build`                                                         | **PASS**                                      |
| `npx playwright test pause.spec --project=dev`                          | **PASS** 2/2                                  |
| `npx playwright test game.spec grab.spec --project=dev-timed --no-deps` | **PASS** 4/4                                  |
| `npx playwright test production.spec --project=production`              | **PASS** 1/1                                  |
| `npm run test:e2e` (3 workers, no retry)                                | **PASS** 43/43, 0 failed, 0 skipped (8.7 min) |
| `git diff --check`                                                      | clean                                         |

The new test in `pause.spec` covers:

- the dialog centred within 1 px, inside a 16 px gutter, with no sideways scroll on the page or
  in the panel, at 1280×720, 430×932 and 360×640;
- a 360×300 window, where the dialog stays inside and its last button can be scrolled to;
- the button order and their roles (primary, then caution);
- the focus outline on Resume and, after Tab, on Settings;
- the Settings view centred, with Back returning focus to Settings;
- the leave confirmation centred, Cancel going back, and a `0s` transition under reduced motion;
- Resume resuming the game.

The earlier full runs in this phase failed on the harness (§3), not on the game.

## 5. Visual check

- Headless screenshots, reviewed: `test-results/pause-menu-1280.png`, `pause-menu-360.png`,
  `pause-confirm-430.png` and `pause-settings-1280.png`.
- In the desktop app's browser pane, the new dialog was seen centred over the Physics Lab. That
  pane ran at about 1 FPS, so the flows were not clicked through there.
- Seen there, and also before the change: the first Esc after Continue did not open the pause
  menu, and a second one did. This is not investigated (out of scope).

## 6. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 936.66 kB | 936.70 kB | +0.04 kB |
| CSS   | 17.45 kB  | 19.13 kB  | +1.68 kB |

The JS stays under the 1,000,000-byte budget, and `production.spec` passes.

## 7. Limitations

- Every number above comes from SwiftShader (software WebGL). No GPU, the RTX 5070 included, was
  validated.
- Nothing was played by hand in a real browser: a real Esc with the pointer captured, a real mouse
  hover, or zoom.
- The `backdrop-filter` blur is not measured on a GPU.
- The first Esc after Continue sometimes does nothing (§5). This was seen before the change too.

## 8. Git

- Base `b26016a`; committed as phase p3.1, not pushed.
- `git diff --stat`: 10 files, +291 −37, plus this report (new).
