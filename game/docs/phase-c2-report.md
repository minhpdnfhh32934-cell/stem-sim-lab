# Phase C2 — the 3D renderer loads with the first world scene

three.js and the world renderer are now a chunk of their own, downloaded together with Rapier just
before the first world scene; the menu no longer carries them. The menu's JavaScript fell from
971,540 to 384,416 bytes (−60 %), so the 1,000,000-byte budget has room again (erratum, §10: the
binding limit is 500,000 bytes, with 115,583 bytes of room). Validating it exposed a pointer-lock
race in the input code, fixed on the way.

## 1. Verdict

**PASS WITH LIMITATIONS.**

- Every increment passed `npm run check`, `npm run build`, the full e2e suite and
  `git diff --check` before its commit (§6).
- Measured on the GPU, the menu appears about 20 ms sooner and entering the first world takes the
  same time as before (§4).
- Limitations (§7): on SwiftShader the first world entry is about 50 ms slower; the timings are
  headless, on localhost; nobody checked the first entry on the real display.

## 2. Commits

| Increment | Commit                                                      | What                                                                                                                             |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| C2.1      | `5d2064b` feat: add world preparation hook                  | `Game.addWorldPreparation`: steps awaited, alongside physics, before each world scene is built; 6 unit tests                     |
| C2.2      | `bf0940c` refactor: let the page own the renderer canvas    | `main.ts` creates the page's one canvas; `WorldRenderer` draws on it, never adds or removes it; 2 e2e tests                      |
| Fix       | `a594e96` fix: release a pointer lock granted after pausing | `BrowserInput` gives back a lock granted after play stopped; a deterministic e2e test (§5)                                       |
| C2.3      | `a8ab246` feat: lazy-load 3d renderer                       | `RendererHost`: WebGL 2 check at boot, the renderer's dynamic import, retry; 6 unit tests, 2 production e2e tests, 1 string (vi) |
| C2.4      | not committed                                               | The timing measurements below, and the documentation                                                                             |

## 3. How it works

- **Boot.** `RendererHost` (the `renderer` system, in the menu's chunk) checks for WebGL 2 on a
  canvas outside the page and releases that context at once. Without WebGL 2 the boot still stops
  at the systems stage with "WebGL is not available in this browser". With it, the host registers
  its load as a world preparation (`Game.addWorldPreparation`).
- **The first world scene.** `SceneManager` awaits `prepareWorld`, which now runs `physics.load()`
  and the renderer's load at the same time. The host imports `WorldRenderer` (and three.js, its
  chunk), builds it on the page's canvas and starts it — its event subscriptions are in place
  before anything spawns.
- **Later world scenes** reuse it: nothing is downloaded again (checked with Resource Timing).
- **A failed download** keeps the menu and says "3D view could not be loaded: …" (logged on the
  `Renderer` channel); the next world entry tries again, without reloading the page. Edge fetches
  the chunk again after a failed `import()` (measured on Edge 156, network abort and HTTP 500).
- **Disposal** is safe at any point: nothing is created after it, even if the chunk arrives late.
- **The canvas** belongs to the page (`main.ts`): one canvas, with no WebGL context until the
  renderer loads; the renderer draws on it and never removes it.

## 4. Measurements

### Bundle (production build)

| JavaScript                                        | Before C2 (`4011abd`) | After (`a8ab246`) |
| ------------------------------------------------- | --------------------: | ----------------: |
| Menu (the official metric, `production.spec.ts`)  |               971,540 |           384,416 |
| Renderer chunk (three.js + `src/platform/render`) |                     — |           588,464 |
| Rapier chunk                                      |             4,332,821 |         4,332,821 |
| After the first world entry                       |             5,304,361 |         5,305,701 |

Along the way: 971,772 after C2.1, 971,771 after C2.2, 384,255 after C2.3, 384,416 with the
pointer-lock fix. The split was predicted at 383–385 kB from a scratch build in the design (Stage
A) and landed inside it.

### First entry, cold (C2.4)

- **Method.** Production build through `playwright.bench.config.ts`, headless Edge at 1280×720.
  Each sample is a fresh browser context (no cache), served from localhost. Times are taken in
  the page, to the frame: from navigation to the menu's title shown; from the New game click to
  the first frame after the menu gave way to the world; and Rapier's own "Physics ready" time.
- **Before / after.** "Before" is the same tree with `main.ts` from `bf0940c` (the renderer built
  at boot); "after" is `a8ab246`. Only `main.ts` was swapped, in two interleaved rounds, then put
  back (checksum verified). AC power throughout.

| Median (min–max), ms         | GPU before (n=10) | GPU after (n=10) | SwiftShader before (n=6) | SwiftShader after (n=6) |
| ---------------------------- | ----------------- | ---------------- | ------------------------ | ----------------------- |
| Navigation → menu shown      | 221 (200–238)     | 200.5 (193–228)  | 223.5 (217–235)          | 214.5 (204–230)         |
| New game → first world frame | 267 (253–290)     | 266.5 (250–278)  | 353 (337–371)            | 404.5 (329–453)         |
| Rapier ready                 | 207.5 (199–227)   | 211 (199–222)    | 226 (208–232)            | 268 (240–311)           |

GPU: ANGLE (NVIDIA GeForce RTX 5070 Laptop GPU, Direct3D11). SwiftShader: ANGLE (Google, Vulkan
1.3.0, SwiftShader Device (Subzero)). Neither is the real display: these are headless runs.

- **GPU:** the menu shows about 20 ms sooner (less JavaScript to parse, no WebGL context made on
  its canvas) and the first world entry is unchanged: the renderer arrives while Rapier's
  WebAssembly starts.
- **SwiftShader:** the menu shows about 9 ms sooner, but the first world entry is about 50 ms
  slower (median) and spreads more. Making the WebGL context and starting the renderer moved from
  the boot into the entry, where, on a software renderer, they compete with Rapier for the CPU —
  Rapier's own time rises by about 40 ms too.
- **Not measured:** a real network. On localhost the download costs almost nothing; over a network
  the menu fetching 587 kB less (about 151 kB gzipped) should matter more than these figures show.

## 5. The pointer-lock race (fix `a594e96`)

- **Seen:** the full suite failed twice in three runs during C2.3's validation, in
  `settings.spec.ts:73`: after Esc, the pause menu could not be clicked, and the camera kept
  turning while paused. Before C2.3 it had passed in about eight full runs; alone, it passed 16
  times out of 16 (C2.2 and C2.3).
- **Cause, in the input code C2.3 did not change:** `BrowserInput.lockPointer()` checked for play
  before asking, then waited for the browser's grant. A grant that arrived after Esc (or after
  leaving) was kept — `PauseMenu` gives the mouse back only if it is already captured when the
  game pauses. C2.3's different timing at world entry made the late grant more frequent under
  load.
- **Fix:** `BrowserInput` listens for the grant (`pointerlockchange`) and gives a lock back at once
  when the game is not playing. Asking and keeping follow one rule (`playing()`). A lock granted
  while playing is kept as before.
- **Test:** `e2e/pointer-lock.spec.ts` replaces the browser's pointer lock with a stand-in whose
  grant the test makes, so the race happens on purpose: grant after Esc → given back, the pause
  menu works; grant after Resume → kept. It fails on the old `BrowserInput.ts` and passes with the
  fix. The full suite then passed twice (52/52).

## 6. Tests and validation

| Commit(s)                                 | `npm run check` | Full e2e                    | Build: menu JS |
| ----------------------------------------- | --------------- | --------------------------- | -------------- |
| `5d2064b`                                 | 898/898         | 47/47                       | 971,772        |
| `bf0940c`                                 | 898/898         | 49/49                       | 971,771        |
| `a594e96` + `a8ab246`, validated together | 904/904         | 52/52 (twice, 9.8 min each) | 384,416        |

- The fix and C2.3 were validated as one tree, then committed in two commits; the fix alone (with
  898 unit tests and the renderer still built at boot) was not run as a separate tree. It does not
  depend on C2.3, and its own test fails without it and passes with it.
- `git diff --check` was clean before every commit. No retries are configured in Playwright.
- C2.4 itself changes documentation only: `npm run check` and `git diff --check` (§9).

## 7. Limitations

- **Headless only.** All timings are headless Edge on this laptop, on localhost. Nobody has felt
  the first world entry on the real display; on the GPU it measured the same as before.
- **SwiftShader entry +50 ms** (median). Starting the renderer on a CPU-bound software renderer now
  happens during the entry rather than at boot.
- **One extra WebGL context at boot:** the check makes one, on a canvas outside the page, and
  releases it at once.
- **Retry after a failed download** is verified in Edge only.
- **Small samples:** 10 cold starts per variant on the GPU, 6 on SwiftShader.
- **Pointer lock:** a grant that arrives while the results panel is open is not covered (it is a
  state `BrowserInput` does not know); nothing suggests it happens.

## 8. Next step

- The JS budget no longer blocks new content: 605,584 bytes are left under the 990,000-byte
  planning line (erratum, §10: at most 115,583 bytes can be added under the binding 500,000-byte
  limit). The Chemistry Lab's titration station (designed in Stage A) can go ahead once its units
  question (U1, mL and mol/L) is decided.
- Optional, only if real hardware shows a delay at the first entry: fetch the renderer's chunk in
  the background once the menu is idle.

## 9. Git

C2.4 is not committed. It changes `docs/architecture.md`, `docs/physics.md`, `docs/game-core.md`,
`docs/interaction.md`, `docs/development-guide.md` and `docs/agents/README.md`, and adds this
report. No source file changed in C2.4: the measurement swapped `src/main.ts` and added a
temporary bench spec, both undone (checksum verified, spec deleted).

## 10. Erratum (W0)

The introduction and §8 measured the menu's JS against `e2e/production.spec.ts`'s 1,000,000-byte
check. The binding limit is the 500,000-byte guard C2.3 added in `e2e/renderer.production.spec.ts`
(line 29, `a8ab246`): at 384,416 bytes the menu has room for at most 115,583 more bytes, not
615,584. The 990,000-byte planning line was derived from the looser check and is withdrawn. The
measurements are unchanged; 384,416 bytes was re-measured at `a1ca48c` (W0 baseline, step B3).
