# Phase R1 report — the menu's stars drift

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase r1.

First phase of the redesign roadmap (the pre-redesign audit of the same date): the main menu's
star field drifts slowly and seamlessly; nothing moves under `prefers-reduced-motion: reduce`, and
nothing animates once a game starts. CSS only — no JavaScript loop, no canvas, no new text.

## 1. Starting state

HEAD `004dff5` (phase 14d), clean working tree. Before: the menu's five star gradients were part
of `.menu`'s own background, "drawn once: no animation" (`styles.css`), and no reduced-motion
handling existed anywhere in `src`.

## 2. Change

- `MainMenu.init` appends one decorative `.menu-sky` (`aria-hidden="true"`) holding three
  `.menu-stars` layers (`near`, `mid`, `far`), first in the menu root; `dispose` removes it with
  the root.
- `styles.css`: the star gradients moved from `.menu` into the three layers, one per tile size
  (211, 293, 389 px), unchanged positions and colours; the two glows and the base gradient stay on
  `.menu`.
  - Each layer starts one tile to the left and translates by exactly its own tile in 240 s,
    linear, infinite: the end is the same picture as the start (no seam), and the larger tiles
    move faster (0.88, 1.22, 1.62 px/s — a little parallax). Transform only, so the compositor
    animates it.
  - `.menu-sky` is `position: fixed`, `overflow: hidden`, `pointer-events: none`, `z-index: −1`;
    `.menu` gets `isolation: isolate`, so the sky lies over the menu's background and under the
    panel, never scrolls, never widens the page and never takes a click.
  - `@media (prefers-reduced-motion: reduce)`: no animation.
  - The menu is hidden (`display: none`) once a world scene loads, which stops the animation.

Untouched: world, physics, gameplay, simulation, persistence, content, the renderer, HUD, results
panel, input, the topics section. No string added (the layer is decorative).

## 3. Tests

New `e2e/menu.spec.ts`: one canvas only; the sky is `aria-hidden` and lets clicks through; three
layers run `menu-drift` and their transforms change over a second; the Settings summary still
opens (the panel is above the sky); no horizontal overflow of the page or the menu at 430×860 and
360×640; with reduced motion emulated every layer has `animation: none` and no transform; after
New game the sky is hidden; no console error.

| Check                                                | Result                               | Duration |
| ---------------------------------------------------- | ------------------------------------ | -------- |
| `npm run check`                                      | **PASS**: 411/411, 35 files          | —        |
| `npm run build`                                      | **PASS**; JS 916.46 kB, CSS 13.77 kB | —        |
| `npx playwright test e2e/menu.spec.ts --project=dev` | **PASS** 1/1                         | 12 s     |
| `npm run test:e2e`                                   | **PASS**: 34/34, first run, no retry | 7.3 min  |
| `git diff --check`                                   | clean                                | —        |

A first combined run of menu, game, topics, settings and production specs ran 33 tests without
the new spec (the file filter did not apply as intended); all 33 passed. The new spec was then
run alone and in the full suite. The JS entry grew by 0.17 kB; `production.spec`'s 1,000,000-byte
menu budget still passes. The "chunks larger than 500 kB" build warning predates this phase.

## 4. Real GPU

In the desktop app's browser pane, renderer `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU
(0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)`, the dev build:

- the layers moved 2.64, 3.67 and 4.87 px in 3 s (0.88, 1.22, 1.62 px/s), as designed;
- over those 3 s on the menu, 451 frames: median 6.7 ms, 99th percentile 6.9 ms, max 7.1 ms (the
  pane's display rate) — no long frame;
- at 239.999 s each layer is translated by its tile (211, 293, 389 px), the start picture again;
- the stars, glows and panel render as before, the panel above the stars (screenshot looked at).

Not done on the GPU: reduced motion (the pane cannot emulate it; covered by the e2e emulation),
narrow widths (covered by e2e), a production-build bench (`npm run bench` has no menu scenario).
The SwiftShader e2e numbers are software rendering, not GPU results.

## 5. Limitations and next step

- The drift is horizontal only; the 240 s cycle is a choice, not tuned with users.
- `will-change: transform` keeps three window-sized compositor layers while the menu shows.
- The world renderer still draws an empty scene under the menu every frame (found in the audit,
  out of scope here).

Next: R2 — the orbital logo (inline SVG beside the title, also at narrow widths) and a small fixed
pool of science "meteors", on the same reduced-motion and hide-with-the-menu rules.
