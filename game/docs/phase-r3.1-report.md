# Phase R3.1 report — home motion polish

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase r3.1.

## 1. Verdict

**PASS WITH LIMITATIONS** — the three effects are reworked as briefed; check, build, the menu spec
and a full e2e run (36/36, first run) pass. Not verified: the live look on the GPU (the browser
pane was hidden), so whether the result reads as intended to a viewer is not established —
only its measured motion and still frames (software rendering).

## 2. Baseline commit and working tree

HEAD `57652a7` (phase r3), in history; clean working tree, nothing of the user's pending.

| Baseline           | Result                                                 |
| ------------------ | ------------------------------------------------------ |
| `npm run check`    | **PASS**: 414/414, 36 files                            |
| `npm run build`    | **PASS**; JS entry 920.26 kB, CSS 14.80 kB             |
| `npm run test:e2e` | **FAIL**: 27 passed, 5 failed, 4 did not run (6.6 min) |

The baseline failures (no R3.1 code involved): four Physics Lab specs (experiment, history,
hooke, measurement) timed out on dial or run steps with the debug panel at **FPS 10–12** (101
readings), the load pattern of the R2 and R3 runs; and `menu.spec.ts:21`, whose star layer read
the same transform (0.0879 px) before and after its 1 s wait — no animation frame in that second,
same load. The four timed specs did not run because they depend on the failed project.

## 3. Root causes

- **Emblem:** its own motion was too small to see. The trajectory's dashes flowed 11 units per
  4 s — 1.5 px/s at the 132 px narrow size, 3.4 px/s at 300 px; the "breathing" changed a halo
  drawn at 18 % fill by a factor 0.55–1. Only the satellite dot moved visibly, so the icon read
  as still.
- **Cursor trail:** each of the 10 dots lagged the one ahead by a fixed fraction per frame, so
  their spacing grew with speed (about v/30 per link): a fast stroke drew a long string of separate
  beads (about 0.33 s × v — 330 px at 1000 px/s), a slow one a blob; solid round dots with a glow
  read as beads, not light.
- **Star drift:** the layers moved at 0.88, 1.22 and 1.62 px/s — 3 to 5 px in three seconds, below
  what reads as motion; 1 px dots moving by fractions of a pixel are drawn alternately on one pixel
  and two, so they shimmer in place rather than travel (inferred from how a composited layer is
  sampled, not observed); and the nearest-looking stars (the brightest, in the 293 px tile) were
  not the fastest, so depth was not conveyed.

## 4. Files changed

| File                                  | Change                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `src/platform/ui/menuArt.ts`          | the emblem's four strobe images get a class, rest opacity and timing      |
| `src/platform/ui/cursorTrail.ts`      | a tapering line of segments with a head; rope length cap in `followChain` |
| `src/platform/ui/cursorTrail.test.ts` | the existing tests kept; one for the length cap; the no-movement result   |
| `src/platform/ui/styles.css`          | star layers; emblem sweep, flare, flow; trail head and segments           |
| `e2e/menu.spec.ts`                    | updated and extended (§9)                                                 |
| `docs/phase-r3.1-report.md`           | this report                                                               |

## 5. Emblem animation

The drawing is unchanged (same elements, colours, size and place). It now runs like the
instrument it draws — a strobe photograph of a flight:

- **Strobe sweep** (the main motion): every 3.6 s the four images of the ball on the trajectory
  light in turn from launch to landing (at 0, 0.25, 0.75 and 1 s): each goes to full opacity and
  swells to 1.4 × in 0.2 s, then settles back to its own opacity (0.4 or 0.65) by 1.1 s.
- **Flare at the top**: the warm glow around the ball, at rest at 0.6 opacity, flares (opacity 1,
  scale 1.3) as the sweep passes the top (0.5 s), and settles. It replaces the independent 4 s
  breathing, so the whole icon pulses as one.
- **Trajectory flow**: the dashes flow towards the landing point 2.2 × faster than before (11 units
  per 1.8 s), the same way as the sweep.
- **Satellite**: unchanged, 18 s per turn — five sweeps.

No rotation of the logo, no new rings, nothing on the wordmark. All CSS (`fill-opacity`, opacity,
transform of SVG elements and the dash offset); no script. Still frames at three points of the
cycle (headless, software rendering) show the two left images and then the glow visibly brighter
and larger than at rest.

## 6. Cursor trail

- **What it is now:** one thin line of light from the cursor back through 11 points, drawn as 11
  segments joined end to end — each a 1 px box stretched (`scaleX`) and turned (`rotate`) into
  place, with a pale core and accent edges across its width — plus a soft 10 px glow at the cursor
  tip. It tapers from about 2.4 px to 0.9 px and fades faster than it thins (segment opacity
  0.55 · (1 − 0.92u)^1.6, u = 0 at the cursor, 1 at the tail): the head clear, the tail dissolving.
- **Motion:** each point still follows the one ahead by exponential smoothing (rate 26/s), now
  with a rope limit: no link longer than 10 px, so the whole line is at most 110 px. Slow, it is
  short and soft (29 px at about 140 px/s); fast, it is pulled along like a rope at most 110 px long
  instead of stretching into a string (105 px at both 530 and 1640 px/s, measured with the game
  loop frozen mid-stroke); a curving stroke draws a smooth arc. It fades out in about 1 s once the
  mouse stops (rate 6/s).
- **Kept from R3:** the fixed pool (made once with the menu; 12 elements instead of 10);
  `pointermove` only stores the position and distance; driven by `MainMenu.update` from the game's
  one loop, which returns while the menu is hidden; off under reduced motion and for a coarse or
  missing pointer; the real cursor untouched.
- **Performance changes:** the per-element opacities are set once; the fade is one `opacity` on
  the layer per frame, instead of ten. Transforms are written only when the chain or the pointer
  moved (`followChain` now returns how far it moved); when out, nothing is written. Per lit frame:
  12 transform strings and 1 opacity string. The colours are the existing accent `#4fb3d9` and the
  emblem's pale `#cdeefa`; no box shadow (it would be stretched with the box).

Not profiled: no profiling set-up exists for the menu, so the cost is established from the code
and the e2e checks (§9), not measured.

## 7. Star drift

- **Direction:** all three layers to the right, each by exactly its own tile per cycle — the end of
  a cycle is the same picture as its start, so there is no seam.
- **Speeds and cycles:** far — tile 211 px, 53 s, about 4 px/s, the faintest stars (1.2 px, 45–55 %
  alpha); middle — tile 293 px, 42 s, about 7 px/s (1.3 px, 50–60 %); near — tile 389 px, 35 s,
  about 11 px/s, the brightest (1.4–1.6 px, 60–75 %). Measured in the page against each animation's
  own clock: **11.2, 7.0 and 4.0 px/s**. About 70 stars in a 1280×720 window, as before.
- **Shimmer:** the stars are slightly larger and softer, so a sub-pixel position spreads their
  light smoothly between pixels.
- The 3:1 speed ratio gives depth without a strong parallax; the layout is unchanged.

## 8. Reduced motion and coarse pointer

- `prefers-reduced-motion: reduce` sets `animation: none` on the stars, the glyphs and every emblem
  part, the new strobe images included; still, the emblem is drawn exactly as before (strobe images
  at 0.4 and 0.65, glow at full opacity — the flare's rest level applies only while it runs).
- The trail is hidden in CSS under reduced motion and for `(pointer: coarse)` and
  `(pointer: none)`, and `update` turns it out and stops.

## 9. Tests

`cursorTrail.test.ts` (4): the three R3 tests (order, frame-rate independence, no time) — the last
now also checks the "nothing moved" result — and a new one for the rope limit: a 2000 px/s stroke
with a sharp turn never makes a link longer than 10 px nor the line longer than 110 px.

`e2e/menu.spec.ts`:

- _sky and emblem_: animation names include four `emblem-strobe` and `emblem-flare`; the strobe
  delays run launch to landing (0, 0.25, 0.75, 1 s); **the stars' speed**, measured against each
  animation's own clock over at least 1.5 s — near 9–13, middle 5.5–8.5, far 3–5 px/s, all to the
  right; the satellite moves (polled rather than a fixed 1 s wait — the baseline failure was that
  wait under load); under reduced motion every part's animation `none` and the emblem's static
  opacities as before. Unchanged: one canvas, aria-hidden, no pointer events, no focus, no overflow
  at 1280/430/360 px, hidden in the game, no console error.
- _cursor trail_: one head and 11 segments; layer opacity 0 before the mouse moves; after a fast
  stroke the head and the first segment at the pointer (within 1 px), the line at most 110.5 px,
  each segment fainter than the one ahead; out when still; no element added while it ran; clicks
  pass; under reduced motion hidden and out; in the game frozen. _Touch screen_: hidden and out.

| Command                                       | Result                                         |
| --------------------------------------------- | ---------------------------------------------- |
| `npm run check`                               | **PASS**: 415/415, 36 files                    |
| `npm run build`                               | **PASS**                                       |
| `npx playwright test menu.spec --project=dev` | **PASS** 3/3                                   |
| `npm run test:e2e`                            | **PASS**: 36/36, first run, no retry (7.5 min) |
| `git diff --check`                            | clean                                          |

Static audit: `requestAnimationFrame` only at `src/main.ts:46, 48` (the existing loop); in
`cursorTrail.ts` the typed arrays, element creation and size writes are in the constructor only;
`pointermove` and `update` have no timer, layout read or DOM creation. No new canvas.

## 10. Build size

| Asset    | R3 baseline | R3.1      | Delta    |
| -------- | ----------- | --------- | -------- |
| JS entry | 920.26 kB   | 920.63 kB | +0.37 kB |
| CSS      | 14.80 kB    | 15.42 kB  | +0.62 kB |

`production.spec`'s 1,000,000-byte menu budget passes.

## 11. GPU and live visual validation

Live visual verification skipped: the browser pane was hidden in the desktop app (0×0 window). Not
seen live on the RTX 5070: the emblem's sweep in motion, the star drift, the trail under real
mouse strokes (slow, fast, circles, sudden turns), hover and click with the trail, the narrow
widths, reduced motion. What was checked instead, headless Edge on SwiftShader (software): the
measured star speeds; the trail frozen mid-stroke with Playwright's clock at four speeds (lengths
above; screenshots looked at); the emblem paused at four points of its cycle.

## 12. Limitations

- The live look is not verified (§11); the tuning (speeds, opacities, lengths) is from
  measurements and still frames, not from watching it.
- The trail builds 13 small strings per lit frame for its style writes; not profiled.
- The emblem's strobe and flow animate SVG properties (`fill-opacity`, `stroke-dashoffset`), so
  its SVG repaints while the menu shows (one 132–300 px SVG).
- The lab's SwiftShader frame rate keeps varying between runs (10–22 fps), which makes the e2e
  timing races more likely (baseline §2).

## 13. Git status

Not committed, not pushed; see the end of this phase's summary.
