# Phase R3 report — a faint light trail behind the cursor

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase r3.

## 1. Verdict

**PASS WITH LIMITATIONS** — implemented as briefed; check, build, the menu spec and every e2e
test pass (one full run had the known STOP race, §10). Not verified: the live look and feel on the
GPU (the browser pane was unavailable), and the trail after a return to the menu (no such path
exists in the game).

## 2. Baseline commit

`7377aa2` (phase r2), clean working tree. The R2 changes were committed first, at the user's
request, as that commit. On it: `npm run check` PASS 411/411 (35 files); `npm run build` PASS, JS
entry 918.75 kB, CSS 14.46 kB; `menu.spec` PASS 1/1; 34 e2e tests; one canvas.

## 3. Files changed

| File                                  | Change                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src/platform/ui/cursorTrail.ts`      | new: `CursorTrail` (the pool, the listener, `update`) and `followChain` |
| `src/platform/ui/cursorTrail.test.ts` | new: 3 unit tests of `followChain`                                      |
| `src/platform/ui/MainMenu.ts`         | creates the trail once in `init`; `visible`; `update(dt)`               |
| `src/platform/ui/styles.css`          | `.menu-trail`, `.menu-trail-dot`, and when the trail is hidden          |
| `e2e/menu.spec.ts`                    | two tests added (§10)                                                   |
| `docs/phase-r3-report.md`             | this report                                                             |

## 4. Implementation

- **Where the frame comes from:** `MainMenu` is a platform `GameSystem` registered in `main.ts`;
  `SystemRunner.update` calls `update(dt)` on every active system from the one
  `requestAnimationFrame` loop in `main.ts`. `MainMenu` had no `update`; it now has one, which
  calls the trail only while a menu scene is loaded (`visible`, set in the existing `SceneLoaded`
  handler). No other loop.
- **The pool:** ten `span.menu-trail-dot` in one `.menu-trail` layer, created once in
  `MainMenu.init`; size 6 px at the front down to 2 px at the back (set once, centred by a static
  margin).
- **`pointermove`** (on the menu root, through the existing `listen` helper, released with the
  menu's `Disposables`): ignores touch; stores `clientX`/`clientY` and adds the distance moved to a
  number. The first event places the whole chain at the pointer. Nothing else.
- **`update(dt)`:** the trail's strength rises with the distance moved (full after 60 px) and fades
  as e^(−4·t) once the mouse stops; each dot moves towards the one ahead (dot 0 towards the
  pointer) by 1 − e^(−30·dt) — exponential smoothing, nearly the same path at any frame rate
  (`followChain`). Then each dot's `transform: translate3d(x, y, 0)` and `opacity` (front to back
  0.24 … 0.015, times the strength) are written. Below a strength of 0.002 the trail is out: the
  zeros are written once, then nothing until the mouse moves.
- **Look:** the accent `--accent` (#4fb3d9) with a 4 px glow of the same colour; behind the panel
  (`z-index: −1` in the menu's stacking context, above the stars); the real cursor is untouched.

## 5. Performance architecture

Static audit of the source after the change:

- `requestAnimationFrame` appears only at `src/main.ts:46, 48`, the existing loop.
- In `cursorTrail.ts`, element creation, the two `Float64Array`s and the size and margin writes
  are in the constructor only (once per menu). `pointermove` and `update` contain no timer, no DOM
  creation, no layout read (`getBoundingClientRect`, `offset*`, `client*` of elements), and write
  only `transform` and `opacity`.
- `followChain` allocates nothing. `update` builds one transform string and one opacity string
  per dot per frame while the trail is lit (at most 20 small strings a frame); when out, it writes
  nothing.
- e2e: a `MutationObserver` on the menu counted **0** elements added while the mouse moved and the
  trail ran and faded.
- No new canvas (the e2e still finds one), no dependency.

No runtime profile was taken (no profiling set-up beyond the bench, which has no menu scenario).

## 6. Accessibility

The trail layer is `aria-hidden="true"`, takes no pointer events (computed `none`, tested) and
holds no focusable element; it adds no text. The real cursor is never hidden, replaced or locked.
The panel's controls take the clicks (Settings and the English radio clicked in the test).

## 7. Reduced-motion behavior

Under `prefers-reduced-motion: reduce` the trail is off: the layer is `display: none` (CSS) and
`update` turns it out at once (opacity 0 written once) and moves nothing. Tested with emulated
reduced motion, together with R1's stars and R2's emblem and glyphs, all `animation: none`.

The first full e2e run caught that, when reduced motion came on while the trail was still fading,
the dots kept their last inline opacity (invisible, the layer being hidden, but not cleanly out);
`update` now writes the trail out when it is turned off.

## 8. Coarse-pointer behavior

Off unless the pointer is fine: hidden in CSS for `(pointer: coarse)` and `(pointer: none)`, and
`update` checks `matchMedia('(pointer: fine)')`; touch events are ignored. Tested in Playwright
with `isMobile` and `hasTouch` (430×860): the test first checks that `(pointer: coarse)` matches
there, then that the layer is hidden and no dot lights when the mouse moves. That is Chromium's
device emulation, not a real touch device.

## 9. Lifecycle behavior

- Menu shown (`SceneLoaded` kind `menu`): the trail runs.
- New game / Continue: the menu is hidden (`display: none`) and `update` returns at once; the test
  checks that no dot moves afterwards while the mouse moves.
- The pool is made once, in `init`, and removed with the menu in `dispose`; its listener is
  released with the menu's other subscriptions.
- Back to the menu: the game has no path back to the menu after boot (the main menu is loaded once,
  `Game.boot`), so this was **not tested**; the trail would resume, with the same pool, since
  `visible` follows `SceneLoaded`.

## 10. Tests

- `cursorTrail.test.ts` (3): the front dot leads and the others follow in order, straight towards
  the pointer and never past it; on a still pointer the chain closes within 0.1 px in 2 s at 30, 60
  and 144 fps; no movement in a frame of no time.
- `e2e/menu.spec.ts`, added:
  - _menu cursor trail_: one canvas; a fine pointer; the layer `aria-hidden`, no pointer events;
    10 dots, all at opacity 0 before the mouse moves; after a move the front dot comes within 10 px
    of the pointer, lit, the others no brighter than the one ahead; when still, all at 0; no
    element added; Settings and the language radio clickable; under reduced motion the layer hidden
    and the dots out, and R1/R2 motion off; after New game the layer hidden and the dots unmoved; no
    console error.
  - _on a touch screen_: as in §8.

## 11. Build size

JS entry **920.26 kB** (R2: 918.75 kB, +1.51 kB); CSS 14.80 kB (+0.34 kB). `production.spec`'s
1,000,000-byte menu budget passes.

## 12. E2E results

| Command                                                      | Result                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `npm run check`                                              | **PASS**: 414/414, 36 files                            |
| `npm run build`                                              | **PASS**                                               |
| `npx playwright test menu.spec --project=dev`                | **PASS** 3/3                                           |
| `npm run test:e2e` (1st)                                     | **FAIL**: 24 passed, 8 failed, 4 did not run (6.5 min) |
| `npx playwright test menu.spec --project=dev`, after the fix | **PASS** 3/3                                           |
| `npm run test:e2e` (2nd)                                     | **FAIL**: 31 passed, 1 failed, 4 did not run (6.2 min) |
| `npx playwright test experiment.spec --project=dev`          | **PASS** 1/1                                           |
| `npx playwright test --project=dev-timed --no-deps`          | **PASS** 4/4                                           |
| `git diff --check`                                           | clean                                                  |

- **1st full run:** 7 Physics Lab specs (experiment, free-fall, history ×2, measurement, hooke,
  oscillation) timed out on dial steps with the debug panel at **FPS 10–11** (171 of 177
  readings) — the load pattern of R2's first full run (in the game the menu, and the trail with
  it, does not run). The eighth, the trail test, was the defect in §7, fixed.
- **2nd full run:** the lab at FPS 20–22; one failure, `experiment.spec.ts:51` at its STOP step:
  the 3.3 s Moon flight completed (t = 3.307 s) before STOP arrived — the known SwiftShader race
  (phases 6C.1, 6F, 14A, 14C). First attempt failed; run alone, it passed (one retry); the four
  timed specs that had waited on it passed. With the 31, all **36/36** tests pass.

## 13. GPU validation

Live GPU visual verification skipped because the browser pane was unavailable (hidden in the
desktop app). Not verified on the RTX 5070: the feel of the trail (fast, slow, circles, changes of
direction), the cursor's responsiveness to the eye, hover and click on the buttons with the trail.
Static and automated browser verification were done (SwiftShader, §10).

## 14. Limitations

- The live GPU check (§13) and a return to the menu (§9) are not verified.
- Coarse pointer: Chromium device emulation only.
- While lit, the trail builds two small strings per dot per frame for its style writes.
- The lab's SwiftShader frame rate varies a lot between runs (10–22 fps here), which makes the e2e
  suite's timing races, old and new, more likely; cause unknown.

## 15. Git status

Not committed, not pushed; see the final summary of this phase.
