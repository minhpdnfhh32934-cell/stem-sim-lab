# Phase R2 report — the emblem moves, science glyphs cross the sky

Date: 2026-10-24 · Branch: `main` · HEAD `3dee252` (phase r1) · Location:
`C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase r2.

## Verdict

**PASS WITH LIMITATIONS** — implemented as scoped; `npm run check`, build, the menu spec and a
full e2e run pass (an earlier full run failed under load, §6). On the real GPU only the renderer
and the animation set-up were verified: the live smoothness check needs the desktop app's browser
pane to be visible, and it was hidden (§7).

## Scope

R2 changes the main menu only:

1. **The emblem** above SIMLAB is now inline SVG (it was a CSS `::before` with an SVG data URI,
   shown only from 960 px). Same drawing — dial, floor tape, dashed trajectory, strobed balls, the
   warm ball at the top — plus three slow motions, and it is shown at every width.
2. **Science "meteors"**: four thin-line glyphs (flask, DNA helix, Newton's apple, pendulum) that
   now and then cross the sky far behind the panel.

Not touched: the cursor trail (R3), pause/settings, design tokens, the Physics Lab, equipment,
experiments, the topics section, the save. No string added, no dependency, no canvas.

## Files changed

| File                              | Change                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/platform/ui/menuArt.ts`      | new: `emblem()` (the inline SVG) and `meteors()` (the four glyphs)                                                    |
| `src/platform/ui/MainMenu.ts`     | puts the emblem before the heading and the glyphs in the R1 sky                                                       |
| `src/platform/ui/styles.css`      | emblem size at every width, its three motions, the glyph paths, one reduced-motion block; the data-URI emblem removed |
| `src/platform/ui/dom.ts`          | `svg(tag, attrs)` and `Attrs`, moved from `ResultsPanel.ts` to be shared                                              |
| `src/platform/ui/ResultsPanel.ts` | imports `svg`/`Attrs` from `dom.ts` (no behaviour change)                                                             |
| `e2e/menu.spec.ts`                | extended (§6)                                                                                                         |
| `docs/phase-r2-report.md`         | this report                                                                                                           |

## Design

- **Emblem** (`.menu-emblem`, 96–132 px wide below 960 px, 200–300 px above, as before):
  - a small pale satellite with a faint halo rounds the outer ring once in 18 s (the slow orbit;
    the group rotates about the centre — the rest of the emblem does not turn);
  - the trajectory's dashes flow towards the landing point, one dash and gap (11 units) per 4 s:
    the loop has no seam;
  - the warm glow around the ball breathes, opacity 0.55–1 and scale 0.9–1.12, in 4 s each way.
  - It sits before the `<h1>`, not in it: the heading's accessible name stays "SIMLAB".
- **Meteors** (`.menu-meteor`, in the R1 `.menu-sky`, behind the panel): 24-unit line glyphs,
  stroke 1.1 in the emblem's pale cyan `#cdeefa`, a faint cyan drop shadow, 28–34 px, peak
  opacity 0.26–0.32. A fixed pool of four elements, created once with the menu; nothing is created
  while they run.
  - Cycles of 137, 163, 181 and 211 s (no two alike, so the order changes every round), first
    appearances 7, 52, 96 and 141 s after the menu opens.
  - In view for 14–19 % of its cycle (23–31 s per crossing); about 0.65 glyphs in view on average,
    rarely two at once.
  - Four different paths: left to right drifting down (flask), right to left rising (helix), from
    the top falling steeply (apple), bottom left up to the right (pendulum); each with its own
    slight rotation and scale. Each starts past one edge, fades in, crosses, fades out past another
    edge and waits hidden. Verified positions at 1280×720 (paused, §7): e.g. the flask at −105 px
    (opacity 0), 158, 596, 1033 px (0.32), then 1381 px (0).
- All motion is CSS (transform, opacity, and the dash offset of one SVG path); no script loop.

## Accessibility

- The sky (stars and glyphs) and the emblem are `aria-hidden="true"`, the SVGs
  `focusable="false"`; the sky takes no pointer events. Tab never reaches them (tested over 8
  presses). No visible text was added.
- `prefers-reduced-motion: reduce` stops all motion: the star drift (R1), the emblem's orbit, flow
  and glow, and the glyphs' crossing. The emblem stays drawn, still; the glyphs, hidden at rest
  (opacity 0), stay away. The selector `.menu-sky .menu-meteor` is needed: the per-glyph
  `.menu-meteor.flask` rules name the animation and outranked a plain `.menu-meteor` — the new test
  caught that, and the CSS was fixed.
- The menu is hidden (`display: none`) when a world scene loads, which stops every R2 animation;
  `dispose` removes the elements with the menu. No timer, listener or loop is added.

## Performance

- Build: JS entry **918.75 kB** (R1: 916.46 kB, +2.29 kB for `menuArt.ts`); CSS 14.46 kB (R1:
  13.77 kB). `production.spec`'s 1,000,000-byte menu budget passes.
- In-game cost, SwiftShader, one worker, the Physics Lab entered by Continue (6 one-second
  readings of the debug FPS each): as shipped 19–21 fps; with the R2 elements removed before
  Continue 13–20; with the whole sky removed 16–19; as shipped again 15–19. The menu itself: 60
  fps in every case. No measurable cost in the game — the menu is not displayed there. These are
  software-rendering figures, not GPU results.

## Tests

`e2e/menu.spec.ts` extended (one test): one canvas; the heading named exactly "SIMLAB" with no SVG
inside it; the emblem visible and `aria-hidden`; four glyphs in the sky, taking no pointer events;
animations `menu-drift` ×3, `emblem-orbit`, `emblem-flight`, `emblem-breathe`, `meteor-flask`,
`-helix`, `-apple`, `-pendulum`; the stars and the satellite move within a second; 8 Tab presses
never focus the art; Settings still opens; at 1280, 430 and 360 px no horizontal overflow of the
page or the menu and the emblem whole inside the window; under emulated reduced motion every star,
emblem and glyph animation is `none` and the glyphs' opacity 0, the emblem still visible; after New
game the sky and the emblem are hidden; no console error.

| Command                                                                 | Result                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `npm run check`                                                         | **PASS**: 411/411, 35 files                              |
| `npm run build`                                                         | **PASS**; JS 918.75 kB, CSS 14.46 kB                     |
| `npx playwright test menu.spec settings.spec topics.spec --project=dev` | 6 passed, **menu.spec FAIL** (reduced motion, see above) |
| `npx playwright test history.spec --project=dev -g "menu at 430"`       | **PASS** 1/1                                             |
| `npx playwright test production.spec --project=production`              | **PASS** 1/1                                             |
| `npx playwright test menu.spec --project=dev`, after the CSS fix        | **PASS** 1/1                                             |
| `npm run test:e2e` (first)                                              | **FAIL**: 19 passed, 11 failed, 4 did not run (7.7 min)  |
| `npx playwright test history.spec --project=dev -g "two runs listed"`   | **PASS** 1/1 (1.1 min)                                   |
| `npm run test:e2e` (second)                                             | **PASS**: 34/34, no retry (7.3 min)                      |
| `git diff --check`                                                      | clean                                                    |

**The first full run.** All 11 failures were in Physics Lab specs (history ×4, hooke,
measurement ×2, oscillation, pendulum, results-view, vietnamese), none in a menu spec; each timed
out waiting for the debug text after dial presses or runs, and the debug panel read **FPS 10**
throughout (232 of 265 readings), so key presses were lost. The four timed specs did not run
because they depend on that project. Classified as load on the machine, not R2: R2 elements are
not displayed in the game, removing them does not raise the lab's FPS (above), one failed spec
passed alone, and the whole suite passed on the next run with the same code. The cause of the load
was not found: no stray browser or server process; CPU load 3 % afterwards. The lab now runs at
about 15–21 fps on SwiftShader with one worker, below the 30–46 fps of phase 6F, so the existing
timing sensitivity (phase reports 6C.1, 6F, 14A–14D) is larger than before.

## GPU validation

Renderer of the desktop app's browser pane: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU
(0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)`. With it, the dev build showed one canvas and the
ten animations running with the designed durations and delays (3 × 240 s, 137/163/181/211 s with
7/52/96/141 s, 18 s, 4 s, 4 s).

**Not done**: the pane was hidden, so the page ran as a background page with a 0×0 window — no
frames to time, no meaningful screenshot. Smoothness, frame pacing, the look of the motion and of
a crossing glyph on the GPU, and the absence of a visible seam in motion are **not verified** on
the GPU. The static look (emblem at 1280, 430 and 360 px; the four glyphs enlarged; all four
paused mid-crossing at once for inspection, which never happens in use) was checked in headless
SwiftShader screenshots only.

## Limitations

- The live GPU check above is outstanding.
- The trajectory flow animates `stroke-dashoffset`, so the emblem's SVG repaints every frame
  while the menu shows (small: one 132–300 px SVG); the orbit and glow are transforms and opacity.
- The pendulum glyph is drawn mid-swing, so its dashed arc shows mostly on one side of the bob.
- The world renderer still draws an empty scene under the menu every frame (from the audit; out of
  scope).
- The lab's SwiftShader frame rate has dropped since phase 6F (cause unknown); it makes the e2e
  suite's timing races more likely, as the first full run showed.

## Next phase

R2 is complete pending the GPU look. R3 is the cursor light trail (a fixed pool of dots, no
allocation per event, off for coarse pointers and reduced motion, the real cursor never hidden) —
not implemented here.
