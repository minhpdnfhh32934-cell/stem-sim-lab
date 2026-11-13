# Phase 2.1 report — Rapier bundle optimization & lazy physics loading

Date: 2026-10-21 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D`

## 1. Baseline (before any change)

- Root `C:/Users/ADMIN/Desktop/SimLab 3D`, branch `main`, clean tree, HEAD `410a54b`, no remote.
- `npm run check` **PASS** (92/92), `npm run test:e2e` **PASS** (3/3), `npm run build` **PASS**.
- Build: **one** JS chunk `index-*.js` **5,017.53 kB** (gzip 1,848.43 kB); `index.html` loads it at
  startup.

## 2. Root cause

Measured in the built chunk, not taken from the Phase 2 report:

- The chunk contains one base64 run of **4,109,472 characters**; decoded, it starts with the
  WebAssembly magic `\0asm` — Rapier's 3,082,103-byte `.wasm`, inlined by the
  `@dimforge/rapier3d-compat` build (its exported `init()` always instantiates from that embedded
  string; the internal initializer that accepts a URL is not exported).
- Without that string the chunk is 908 kB (three.js, Rapier's JS glue ≈ 231 kB, game code).
- It shipped at startup because `src/physics/rapier.ts` imported Rapier statically and
  `PhysicsSystem.init()` ran during boot, before the menu.

## 3. Options investigated

| Option                                     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decision |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A. Lazy-load Rapier                        | Dynamic `import()` gives a separate chunk; physics already initialized asynchronously, so the lifecycle change is small (load on first world scene).                                                                                                                                                                                                                                                                                                                   | **Done** |
| B. Non-compat `@dimforge/rapier3d`         | Loads `rapier_wasm3d_bg.wasm` via WASM ESM integration. Probe: Vite 8 builds it natively (separate 3,082 kB `.wasm`, gzip 1,188 kB; glue 276 kB) and it **runs in production** (Edge). Dev server **fails** (`__wbindgen_export` undefined) unless the package is excluded from `optimizeDeps`; **Vitest cannot resolve it in Node** (package has no Node entry), so tests would need to alias the compat build — tests and browser would run different Rapier builds. | Deferred |
| B′. Configure compat to load a `.wasm` URL | Not possible without patching the package (see §2).                                                                                                                                                                                                                                                                                                                                                                                                                    | Rejected |
| C. Compression comparison                  | `.wasm` file: gzip 1,176 kB / brotli 852 kB; same bytes as base64 in JS: gzip 1,603 kB / brotli 1,162 kB → option B would save ≈ 27 % of the physics download and enable streaming compilation.                                                                                                                                                                                                                                                                        | Recorded |
| D. Raise `chunkSizeWarningLimit`           | Would hide the warning without fixing anything.                                                                                                                                                                                                                                                                                                                                                                                                                        | Rejected |

Option B's gain applies only to the deferred physics download, costs a dev-server workaround and a
test/browser package split, so it is not worth the risk now; revisit if physics load time on real
networks becomes a measured problem or when Vitest can load the non-compat package.

## 4. Chosen architecture

```
boot ─ PhysicsSystem.init(): subscribe only ──► menu   (status idle, Rapier not requested)
New game / Continue / any world scene
  └─ SceneManager.load ─ await prepareWorld() = physics.load()
        idle → loading: import() Rapier chunk, rapier.init() (WASM), world + character controller
        loading → ready  ─► scene built, phase "playing", physics steps
        loading → failed ─► promise rejects; current scene + phase kept; menu shows
                            "Physics engine could not be loaded: …"; next attempt retries
dispose ─► disposed (a load still in flight creates no world)
```

- One `PhysicsSystem`, one world; `load()` is shared by concurrent/repeated callers.
- No module-level Rapier singleton: the import is cached by the module system and Rapier's own
  `init()` returns early once instantiated (verified in Node).
- No world scene can exist without physics (SceneManager awaits it before tearing anything down);
  physics steps only when `ready` and playing.
- Rapier stays behind `src/physics` (ESLint rule unchanged and passing); `rapier.ts` now only
  type-imports Rapier statically.

## 5. Files changed

| File                                                                                        | Reason                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/physics/rapier.ts`                                                                     | Dynamic `import()` → separate chunk; no cache needed                                                                                      |
| `src/physics/PhysicsSystem.ts`                                                              | `init()` subscribes only; `load()` with status idle/loading/ready/failed/disposed, shared promise, load time, dispose-while-loading guard |
| `src/world/SceneManager.ts`                                                                 | `prepareWorld` hook awaited before a world scene is built; phase restored on failure                                                      |
| `src/game/Game.ts`                                                                          | Wires `prepareWorld` to `physics.load()`                                                                                                  |
| `src/platform/ui/DebugPanel.ts`                                                             | Shows physics status and load time                                                                                                        |
| `src/physics/PhysicsSystem.test.ts`                                                         | Harness calls `load()`; new lazy/shared-load test                                                                                         |
| `src/physics/physicsLoading.test.ts`                                                        | New (replaces `bootFailure.test.ts`): no Rapier at boot, single load, waiting state, failure + retry, dispose while loading               |
| `e2e/game.spec.ts`                                                                          | Menu shows physics idle, ready after New game; status text `ready`                                                                        |
| `e2e/production.spec.ts`                                                                    | New: production build — menu without Rapier, chunk fetched on New game, physics movement and door travel                                  |
| `playwright.config.ts`                                                                      | Two projects: `dev` (dev server) and `production` (`build` + `vite preview`)                                                              |
| `docs/physics.md`, `docs/architecture.md`, `docs/game-core.md`, `docs/development-guide.md` | Loading lifecycle, measurements, test setup                                                                                               |

## 6. Before / after measurements

Build sizes from `vite build`; timings: headless Microsoft Edge on `vite preview` (serves gzip),
localhost, median of 3 runs; "10 Mbit/s" = Chrome DevTools Protocol network emulation (20 ms
latency). Timing script kept outside the repo.

| Metric                                  |               Before |                                     After |
| --------------------------------------- | -------------------: | ----------------------------------------: |
| Initial JS (entry chunk)                |          5,017.53 kB |                     **686.19 kB** (−86 %) |
| Initial gzip                            |          1,848.43 kB |                     **179.31 kB** (−90 %) |
| Total JS after starting a game          |          5,017.53 kB |                               5,019.01 kB |
| Rapier chunk                            |     inside the entry | 4,332.82 kB (gzip 1,669.31 kB), on demand |
| WASM asset                              | none (base64 inline) |   none (base64 inline, in the lazy chunk) |
| JS chunks                               |                    1 |                                         2 |
| JS downloaded before the menu (browser) |           5,017.5 kB |                                  686.2 kB |
| Menu ready, unthrottled                 |               341 ms |                                **263 ms** |
| Menu ready, 10 Mbit/s                   |             1,730 ms |                                **307 ms** |
| New game → first room, unthrottled      |               155 ms |                                    344 ms |
| New game → first room, 10 Mbit/s        |               154 ms |                                  1,923 ms |
| Physics ready (production log)          |         part of boot |       181 ms after New game (unthrottled) |

Trade-off, stated plainly: the physics download moved from startup to New game. The menu is
5.6× faster at 10 Mbit/s, but the first room takes longer after clicking New game, and the total
time from opening the page to the first room rose from 1,884 ms to 2,230 ms at 10 Mbit/s (the
Rapier chunk is now a second, sequential request). Prefetching the chunk while the player is on
the menu would remove most of that; it was not done because this task requires the menu to run
without Rapier.

## 7. Physics regression verification

All Phase 2 invariants re-verified after the change (unit + dev E2E):

| Invariant                 | Evidence                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Player stops at the bench | Unit: stop at face + 0.31 m (±1e-3) and stays while held; E2E: z = −1.29, held 1.5 s longer, unchanged                 |
| Ball falls and rests      | Unit: bounce, no sinking > 5 mm, rest at 0.94 m ± 2 mm, asleep; E2E: `-0.400, 0.940, -2.000 m 0.00 m/s asleep`         |
| Scene lifecycle           | E2E: Physics Lab 7 bodies / 12 colliders → Hub 6 / 11 → Physics Lab 7 / 12, twice; unit: no accumulation over 5 cycles |
| Free-fall experiment      | Unit: analytic to 1e-12; E2E: "Fall time 0.553 s · Impact velocity −5.425 m/s"                                         |
| Physics constants         | Unchanged (fixed 1/60 s, 5 sub-steps, gravity 9.81, skin 0.01 m, snap 0.1 m, item properties)                          |

## 8. Automated tests

| Command            | Result                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `npm run check`    | **PASS** — typecheck, ESLint, Prettier, Vitest **96/96** in 10 files (was 92/92)           |
| `npm run test:e2e` | **PASS** — **4/4**: 3 `dev` (existing, updated for the status text) + 1 `production` (new) |

New/changed tests check behaviour, not file names: no Rapier load at boot (loader call count 0,
status `idle`); one shared load (`load()` returns the same promise; one loader call across New
game, scene travel and a second New game); nothing spawned or simulated while loading; failure
keeps the menu, logs, writes no save and can be retried; dispose while loading creates no world.
Mutation checks (each made the suite fail, then restored): unshared loads (4 failures), scenes not
awaiting physics (7), phase not restored on failure (1), world created after dispose (1).

## 9. Browser / E2E verification

Microsoft Edge (installed), headless, software WebGL (SwiftShader) — **no GPU**. Scenarios:

- A Menu: opens with no errors; debug panel "Physics: idle (Rapier not loaded)" (dev); production
  test confirms only 686,190 bytes of JS loaded and no "Physics ready" before New game.
- B Start game: physics becomes `ready`; production log "Physics ready in 181 ms (Rapier 0.21.0)";
  4,332,821 more bytes of JS fetched on demand (Resource Timing).
- C Bench, D Ball, E Scene transition: dev physics test (values in §7).
- F Console: dev experiment test, unchanged result.
- Production movement: walking reaches the hub door through the physics controller, E travels to
  the hub, Rapier not loaded a second time; no console or page errors.

## 10. Build verification

`npm run build` **PASS**: `index-*.js` 686.19 kB (gzip 179.31 kB), `rapier-*.js` 4,332.82 kB
(gzip 1,669.31 kB), CSS 2.85 kB. `index.html` references only the entry and CSS; the Rapier chunk
is reached solely through the dynamic import. The production E2E project builds and serves this
output with `vite preview` and runs physics from it. Vite still warns that chunks exceed 500 kB:
the entry (three.js; it was 675.6 kB before Rapier existed) and the Rapier chunk (the WASM). Not
suppressed.

## 11. Documentation

`docs/physics.md` (loading lifecycle, diagnostics, bundle table), `docs/architecture.md` (boot
without physics, scene flow), `docs/game-core.md` (failure handling), `docs/development-guide.md`
(test layout, E2E projects), this report.

## 12. Git

One focused commit on `main` per the logical-commit workflow in `CLAUDE.md`; not pushed (no
remote). Hash in the final summary.

## 13. Known limitations

- Total physics bytes are unchanged (5.0 MB uncompressed, 1.85 MB gzip once a game starts); only
  _when_ they load changed.
- New game is slower on slow networks (§6); no prefetch.
- WASM is still base64 inside JS: no streaming compilation, ≈ 27 % more compressed bytes than a
  `.wasm` file (option B).
- Entry chunk (three.js) is still above Vite's 500 kB advisory size.
- Timings are localhost/emulated in headless Edge with software WebGL, not a real network or GPU.

## 14. Verdict

**PASS.** Rapier stays behind `src/physics`; one physics system with an explicit, tested lifecycle;
startup payload reduced from 5,017.53 kB to 686.19 kB (gzip 1,848.43 → 179.31 kB) and Rapier is not
requested until a world scene; the production build loads and runs physics from the lazy chunk;
all Phase 2 physics invariants, scene lifecycle, saves and the free-fall experiment are unchanged
and verified; check, build and E2E pass.

## 15. Recommended next step

Phase 3 — grab / drop / throw on top of the physics system. Optional small follow-ups: prefetch the
Rapier chunk while the menu is idle, and re-evaluate the non-compat package when Vitest supports it.
