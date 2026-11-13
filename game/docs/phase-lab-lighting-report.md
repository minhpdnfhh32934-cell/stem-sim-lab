# Phase report: laboratory lighting polish

Date: 2026-10-29.

- **Base:** `main` at `a1ca48c` plus the uncommitted phases W0 … UX3.1
  ([phase-ux31-report.md](phase-ux31-report.md)).
- **State:** branch `main`, HEAD `a1ca48c`, nothing committed or pushed.
- **Proposed commit:** `feat(lighting): brighten laboratory interiors`. Nothing is committed: the
  user's display check comes first, and the tree also holds earlier phases that are not committed.

## Verdict

**PARTIAL: manual real-display QA pending.**

- `npm run check` and the build pass.
- E2E and the bench each have failures that also happen without this change: timing tests on a
  throttled machine (the "Silent" power plan, SwiftShader at 6–8 fps). See Verification.
- **Decided by the user (§5):** keep `reachHeight`, at +58 shadow-pass draws per view.

## 1. Audit (before any change)

**Lighting architecture (UX2), kept as it is:**

- Each room lights itself from its own fixtures (`rooms.json` `lights`, `world/lighting.ts`).
- The renderer holds a fixed pool of spot lights (`LIGHT_SLOTS`): 4 keys with 1024² shadows and
  6 fills without shadows.
- A soft hemisphere: intensity 0.55 on Medium, and 0.55 − 4.9 × 0.08 on High, where a
  `RoomEnvironment` map stands in.
- ACES filmic tone mapping at exposure 1.05.
- Low keeps the one-light model (no room lights).

**The labs** (physics, projectile range, pendulum bay, chemistry, biology), each 10 × 8 m (the bay
and range larger), 3.5 m high:

- a key under `light-1` (x −2.5): lux 3.8, shadows on;
- a fill under `light-2` (x +2.5): lux 1.6;
- both the fixture's colour `#f6f2e6`, penumbra 0.6 (a pool constant).

**Computed with three r186's own spot-light terms** (smoothstep penumbra, distance cutoff window,
1/d², cos), at bench height (0.9 m), on a 0.5 m grid:

| Physics lab, baseline  | Illuminance          |
| ---------------------- | -------------------- |
| Under the key          | 7.33                 |
| Median                 | 1.26                 |
| Darkest 10 %           | 0.51 (ambient alone) |
| Median along the walls | 0.78                 |

## 2. Why the labs were dark

`room → key/fill → renderer → material → perceived brightness`

1. **The key's cone was sized to the floor's corners, not the benches.** At 0.9 m a lab's far
   corners sit 72.7° off the key's axis, against a 68.1° cone, so they get no key light at all.
2. **A 0.6 penumbra.** The key is at full strength only within the inner 40 % of its cone and fades
   across the rest, so the benches along the walls get a fraction of it.
3. **The fill's cone is kept inside the walls** (it has no shadows, so it must not reach the next
   room). In a lab that is a 2.5 m disc (36°) on the east side, so the fill lights little.
4. **What is left is the hemisphere ambient** (about 0.5). ACES then compresses those low values,
   and the corners read dark.

The key's lux, the tone mapping and the exposure are not the problem. Raising them would brighten
the middle (hotspots) more than the edges. The shadows were not changed.

## 3. Change: room-local data, plus the rule it drives

- **`rooms.json`, the 5 lab rooms only:**
  - key: `penumbra` 0.25, `reachHeight` 0.9;
  - fill: lux 1.6 → 3.0;
  - key lux unchanged (3.8);
  - the lobby, preparation area, corridor and teacher rooms are unchanged.
- **`world/definitions.ts`:** two optional fields on a room light:
  - `penumbra` (0–1, default 0.6, the old constant);
  - `reachHeight` (m, key only): the key's cone reaches every corner of the room at this height.
- **`world/lighting.ts`:** the key's angle uses `reachHeight`, and `RoomLight` carries `penumbra`
  (`DEFAULT_PENUMBRA` = 0.6).
- **`render/roomLights.ts`:** each slot takes its light's penumbra. It is a uniform, so no shader
  changes when a door opens.
- **`game/content.ts`:** a boot check rejects `reachHeight` on a non-key light, or at or above its
  fixture.
- **Kept as they are:**
  - no new light, no global light;
  - the same light and shadow counts;
  - no change to the hemisphere, exposure, tone mapping, shadow settings or quality presets
    (Low, which has no room lights, is untouched).

## 4. Lighting: baseline → after

**Model** (bench-height illuminance, physics lab):

|                        | Baseline | After                 |
| ---------------------- | -------- | --------------------- |
| Mean                   | 1.98     | ≈ 2.5                 |
| Median                 | 1.26     | ≈ 2.1                 |
| Median along the walls | 0.78     | ≈ 1.5                 |
| Brightest point        | 7.33     | 7.33 (no new hotspot) |

**Measured on screen:** the RTX 5070 Laptop, headless Edge, dev build, 1280 × 720. Mean luma over
the 3D view (HUD left out), Medium:

| View                     | Before | After | Change |
| ------------------------ | ------ | ----- | ------ |
| Physics, centre          | 103.9  | 115.6 | +11 %  |
| Physics, bench           | 104.4  | 124.0 | +19 %  |
| Physics, east corner     | 79.2   | 91.3  | +15 %  |
| Physics, spring corner   | 75.0   | 85.1  | +13 %  |
| Physics, under the bench | 116.8  | 135.9 | +16 %  |
| Pendulum bay             | 101.8  | 116.5 | +14 %  |
| Projectile range         | 124.9  | 141.4 | +13 %  |
| Chemistry, centre        | 104.3  | 118.5 | +14 %  |
| Chemistry, glassware     | 91.6   | 120.5 | +32 %  |
| Chemistry, fume hood     | 75.8   | 87.5  | +15 %  |
| Chemistry, corner        | 86.2   | 100.7 | +17 %  |
| Biology, microscope      | 106.8  | 130.8 | +22 %  |
| Biology, specimens       | 121.7  | 161.0 | +32 %  |
| Biology, east corner     | 71.3   | 76.6  | +7 %   |
| Lobby (control)          | 92.2   | 92.2  | 0 %    |

- **Across the 14 lab views:** median +15 %, range +7 % to +32 %. High gives the same picture.
- **Clipped pixels (≥ 250):** 0 % before and after. The brightest decile (p90) peaks at 212.
- **Crushed pixels (≤ 12):** they fall slightly. What remains is mostly content that is black by
  design: monitors, worktops, signs.

## 5. Performance (RTX 5070 Laptop, ANGLE D3D11, headless, 1280 × 720)

|                                                    | Before                          | After                         |
| -------------------------------------------------- | ------------------------------- | ----------------------------- |
| GPU bench (`--project gpu-headless`)               | 296.8–300 fps, GPU 2.34–2.54 ms | 290–300 fps, GPU 2.49–2.73 ms |
| Draws (lane idle / interacting / running / landed) | 334 / 288 / 335 / 337           | 393 / 347 / 393 / 395         |
| Room lights, physics scene                         | 3 keys (shadows) + 3 fills      | the same                      |
| Menu chunk                                         | 498,083 B                       | 498,539 B (< 500,000)         |
| Renderer chunk                                     | 686,900 B                       | 686,925 B                     |

**Why draws rose (+58 in every view, +17 %).**

- three's spot shadow camera takes its field of view from the cone (`fov = 2·angle`).
- `reachHeight` widens the key's cone from 68.1° to 72.7°.
- So each key's shadow pass takes in more objects. No light was added, and the shadow caster
  count is unchanged (3 in the physics scene).
- **Proved by a variant B** (the same change without `reachHeight`): the draws went back to
  exactly the baseline (334 / 288 / 335 / 337 / 323 / 286), at GPU 2.51–2.72 ms.

**The tradeoff, measured** (mean luma against the baseline, Medium, the same 15 views):

|                                                               | Lab median | Range      | Draws | GPU ms       |
| ------------------------------------------------------------- | ---------- | ---------- | ----- | ------------ |
| A: penumbra 0.25 + fill 3.0 + `reachHeight` 0.9 (in the tree) | +15 %      | +7 … +32 % | +58   | +0.1–0.2     |
| B: the same without `reachHeight`                             | +11 %      | +3 … +19 % | +0    | within noise |

- A reaches the requested +15–30 %; B falls short (+11 %), most in the corners and on the benches.
  For example: chemistry glassware +32 % vs +15 %; fume hood +15 % vs +6 %; biology corner
  +7 % vs +3 %.
- Per the phase rule, the regression was not accepted silently: it was put to the user, who
  **chose A** (2026-10-29) and accepts the +58 draws. Going back to B is one edit: remove
  `"reachHeight": 0.9` from the five lab rooms in `rooms.json`.
- **Not tried:** narrowing only the shadow frustum (`shadow.focus`). The unshadowed ring at the
  cone's edge could then let light through the walls into the next room.

## 6. Verification

| Check                     | Result                                              |
| ------------------------- | --------------------------------------------------- |
| `npm run check`           | PASS: 84 files, 1859/1859                           |
| E2E `npx playwright test` | FAIL: 69 passed, 1 failed, 4 did not run (16.5 min) |
| `npm run build`           | PASS: no three.js in the menu chunk                 |
| GPU bench `npm run bench` | FAIL: 1 test (see below); the frame times are in §5 |
| Real-display visual QA    | NOT RUN                                             |

- **Baseline.** The baseline check, e2e, build and bench are the UX3.1 runs of the same day, on
  exactly this code before the lighting change: 1856/1856, 74/74, 498,083 B, and the bench above.
- **The E2E failure:** `settings.spec.ts:231`, the graphics poll for `high`, timed out at 5 s.
  The 4 dev-timed specs depending on it did not run.
  - Rerun `npx playwright test --project=dev-timed --no-deps`: 2 passed, 2 failed.
  - `game.spec` (teacher room) did not reach (-1.5, 1.9). The UX3.1 test waits a fixed 1200 ms for
    the washroom door's 1 s swing, but game time runs slower at 6–8 fps.
  - `grab.spec`: a position timed out at 6–8 fps.
  - Both run at quality Low, which has no room lights, so the lighting change cannot affect them.
  - The machine runs the Windows power plan **"Silent"**. SwiftShader e2e there runs at 6–8 fps,
    against about 20 fps in earlier phases. The user is asked to switch the plan and rerun; it
    was not changed here (a system setting).
- **The bench failure:** "the same flight at every frame rate the game is given". The HUD prompt
  "Read the results" did not show within 5 s. It failed in variant B too (no `reachHeight`), so it
  is not caused by the cone.
- **One run of `npm run check` failed:** `frameCap.test`, a real-time test, timed out at 5 s while
  other work loaded the machine. Rerun alone, the full check passed.
- **New tests:**
  - the labs' keys reach every bench-top corner (this would have failed before: 72.7° against
    68.1°);
  - the penumbra per light (0.6 everywhere else);
  - the boot check for `reachHeight`;
  - the pool applies each light's penumbra, with 3 shadow casters in the physics scene, as before.

## 7. Manual QA checklist (RTX 5070 Laptop, 2560 × 1600, 300 Hz)

**Settings to check first:** Medium (the default on the GPU), then High. Low is unchanged by
design: it has no room lights. For each item, check standing still, while turning the camera, while
walking, from far and from near.

**Physics lab:**

- [ ] The middle of the room: brighter, shadows still under the bench and the desks.
- [ ] The corners near the walls: no area too dark to read.
- [ ] The far corner from the key (east): the drop tower and the spring stand are readable.
- [ ] Under the bench: a shadow, not black.
- [ ] Equipment: dials and buttons on the desks; the station screens (black by design) stay
      readable.
- [ ] The pendulum bay and the projectile range: the rig and the launcher are clearly shaped.

**Chemistry lab:**

- [ ] Benches and islands: the white tops are not blown out.
- [ ] Glassware on the shelf: the glass keeps its edges and detail.
- [ ] The fume hood and the cabinets.
- [ ] The corners.
- [ ] The titration setup: not in the room yet (the chemistry room has no apparatus); check it
      when it is placed.

**Biology lab:**

- [ ] The microscope on its bench: a readable silhouette.
- [ ] The specimen cabinet and the refrigerator.
- [ ] The benches and the island.
- [ ] The east corner (the weakest gain, +7 %): judge whether it is now acceptable.

**Everywhere:**

- [ ] No light leaking into the corridor or lobby through the doors (the hub should look exactly as
      before).
- [ ] No new artifacts: banding at the cone edge, shadow acne, flicker.
- [ ] Not "showroom": the labs still read as labs, with depth.

## 8. Remaining limitations

- **Real-display QA not run:** the visual result is judged here only on headless stills.
- **The `reachHeight` draw cost (§5):** +58 draws per view (+17 %), accepted by the user.
- **E2E and the bench must be rerun on a non-throttled power plan** before this can be called
  PASS.
- **The biology east corner gains least (+7 %).** It lies beyond the fill's disc, which must stay
  inside the walls (it has no shadows). Doing more would need another fixture or a key light there
  (a content and design change), or the key's lux raised. Neither was done; the audit does not ask
  for it.
- **The titration setup could not be checked:** the chemistry room has no titration apparatus yet.
- **Out of scope, reported:** the UX3.1 washroom-door e2e step (`e2e/game.spec.ts`) waits a fixed
  1200 ms, which is fragile at low fps. Proposed: wait on the door's state through a debug line
  instead.
- **Menu chunk:** 1,461 B of headroom left.

## Next step

1. The user checks the labs on the real display (§7).
2. Switch off "Silent", then rerun `npx playwright test` and `npm run bench`.
3. Commit `feat(lighting): brighten laboratory interiors`. Not pushed.
