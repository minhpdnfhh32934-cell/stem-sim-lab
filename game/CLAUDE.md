# CLAUDE.md — SIMLAB 3D

> **Inside the SimLab repository** (since 13/11/2026, user decision): the root `CLAUDE.md` wins over
> this file wherever they differ. Claude never merges or pushes to `main` (the user merges every PR),
> never runs `npm run dev:lan` / `preview:lan` (they open the game to the network), and rebuilds what
> SimLab ships only with `npm run build:game` at the repository root (`docs/GAME.md`).

Stable rules for AI coding sessions. Status and history: `docs/phase-1-report.md` (one report
per phase in `docs/`). Architecture: `docs/architecture.md`.

## Start of a session

Read this file and the latest phase report, then check them against the code (`git log`,
`git status`, `npm run check`). If they disagree, trust the code and fix the report. Work only on
the requested task; report out-of-scope problems before large changes. When several agents work at
once, roles, file ownership, branches and the one-e2e-at-a-time rule are in `docs/agents/README.md`.

## Honesty

- Never claim a feature or test result that was not verified by running it. Report test results
  as PASS / FAIL / NOT RUN with the exact command.
- Unimplemented features are labelled Planned and disabled — no fake UI, never fake simulation
  results. Simulation models are verified against analytic/reference solutions.
- Every performance number names its WebGL renderer. E2E runs on SwiftShader (software): never
  present those numbers as GPU results.

## Architecture rules

- Layers: `core` (generic) ← `gameplay` / `world` / `physics` / `simulation` / `persistence` ←
  `game` (composition root) ← `platform` (browser, three.js) ← `main.ts`. ESLint enforces that
  only `src/platform` and `src/main.ts` use three.js or DOM globals, only `src/physics` imports
  Rapier, and `src/core` imports no game module.
- Physics is authoritative for motion: input produces `player.moveIntent`; only
  `PhysicsSystem` moves the capsule and dynamic bodies, on a fixed step (`docs/physics.md`).
  Game physics never replaces the deterministic experiment models.
- Holding: the interaction system decides what is held (`Hands`); the physics system moves it
  (`ObjectHolder`). Gameplay never moves bodies or meshes directly.
- Procedures (cleanroom entry) are data (`procedures.json`); `ProcedureSystem` is their only
  rule authority and plugs into interaction as an action guard. Refused actions do nothing and
  give a reason (`ActionBlocked`). HUD/visuals only read `procedures.view()` and equipment.
  The entry sequence is an illustrative teaching sequence — never present it as a certified
  protocol.
- Experiments: definition (data) + pure deterministic model (`src/simulation/models`, no three.js,
  DOM or Rapier); `ExperimentSession` holds parameters, state and runs; `ExperimentSystem` ticks
  them. `StationSystem` is the only rule authority for an apparatus in the world (an action
  guard, like procedures) and the only code that moves a projectile — through the `PoseDriver`
  port, which takes the body out of Rapier while the model drives it. The pendulum's bob and the
  free-fall ball have no physics body: the renderer draws them at the run's angle and height
  (`swingAngle`, `dropHeight`). Views (renderer, HUD,
  results panel) only read `stations.view()` and the run's buffers; ball, trail, graphs and
  results share one mapping (`toWorld`). Measured values are never adjusted, smoothed or
  invented; a run the room cannot show is refused with its reason. A run that ends is frozen
  into its session's history (`RunRecord`: copies of its inputs, theory, results and samples; at
  most 20 per station); run lists, comparisons and CSV read records, never rebuild them from
  current settings or theory. Runs and history are never in the save; a station's configuration
  is (entity states). Ended runs are kept in their own IndexedDB store (`persistence/runHistory.ts`,
  own version), written on `RunRecorded`; its failures are reported and never fail the
  progression save. Instrument readings (`simulation/measurement.ts`) are derived from a completed
  run's own result and recorded resolution d: reading = nearest multiple of d, u = d/√12 (the
  resolution alone, never presented as the total uncertainty), d/2 reported separately; the
  simulated value is never rounded or overwritten, no noise is added, and a resolution is never a
  model input. Worked examples (an experiment's `examples`, the teacher's board) take their
  answers from the model's predictions and check every step against them (`workedExample.ts`);
  no number on the board is typed in. Question banks (`content/questions/<id>.json`) do the same:
  their numbers are the model's and checks make each right option right; a hidden input is never
  used, only a supposed value. Details: `docs/experiments.md`.
- LAN rooms (`src/multiplayer`, Phase M) are served by the server that serves the game
  (`roomHttp.ts`: plain HTTP at `/simlab-rooms`, Server-Sent Events down, POSTs up, no
  dependency), mounted on the Vite dev and preview servers (`npm run dev:lan`,
  `npm run preview:lan`); every message is checked with Zod both ways.
  Each player's game, objects and save are their own. Shared: poses (with what is worn, held,
  resting, acted), station commands, room events (`RoomEventSchema`: hits, throws, the entity
  states in `SHARED_STATE_KEYS`, the teacher). One player works a station (`Peers.holder` →
  `StationSystem` refuses the others); their commands reach the others' copies as
  `ExperimentCommand` with `from` and their settings (`params`), never `load`/`unload` (hands are
  local). One game drives a person of the world at a time (lock `npc:<id>`); the others draw him
  from its snapshots (`NpcSystem.mirror`) and refuse talking until he is free. A state set because
  another player set it is never sent back. Other players stand in physics as agents. Chat lines
  are relayed to the whole room and shown as text, never markup. Voice is WebRTC between the
  browsers; the room server only relays its set-up (`signal`). The game servers find each other
  over UDP (`lanDiscovery.ts`). A page reaches a room on another computer only through its own
  server (`/simlab-rooms/via/<at>/`, only for discovered servers), so it stays on localhost, a
  secure page where the microphone works. Details: `docs/phase-m-report.md`,
  `docs/phase-f-report.md`.
- Scene-change doors name their `arrival` door; the player is placed by `arrivalPose`
  (`src/world/arrival.ts`). The developer scene jump uses the scene spawn and bypasses doors and
  gates — never use it as evidence that a normal transition works.
- No singletons or service locator: systems are built in `src/game/Game.ts` with explicit deps.
- Cross-system reactions go through events declared in `src/game/GameEvents.ts`; every
  subscription is released in `dispose()` via `Disposables`.
- Content is data (`src/content/*.json`, one file per experiment in `experiments/`), validated with
  Zod and cross-checked before use: the core content at boot, the lab pack's (experiments, topics,
  models: `game/labPack.ts`) when it loads; tests check all bundled content. Code never branches on
  content ids; behaviour comes from registered behaviours/models.
- Languages: player-facing text goes through `Texts` (`game.texts`, passed to systems and views
  as a dependency), never `if (language === …)`. Interface text:
  `texts.ui('key', 'English', params)` with key and English as literals, Vietnamese in
  `src/content/strings.json`; content text: `texts.of(object, 'field')`, translated beside its
  English (`"vi": {…}`, `localized(...)` in its schema). Tests require a translation for every key
  and content text. English is the default and the fallback. Formulas, units, symbols, measured
  values, ids, logs, the debug panel and CSV are not translated. The language is a browser
  preference (`simlab.settings.language`), never part of the save. Details: `docs/game-core.md`.
- SI units everywhere, except chemistry and biology wet-lab experiments, which use mL, mol/L and
  g as such a lab does (pH has no unit; time stays in seconds), and microscopy, which states
  lengths in µm and mm; entity ids are `<room id>/<placement id>`.
- Experiment definitions (data) are separate from simulation models (pure, deterministic code).
- Topics (`topics.json`) group experiments by subject (`category`) for learning; a topic is
  neither a room nor a station. Every experiment is in a topic of its subject, and a topic needs
  an existing experiment (checked when the lab pack loads). Details: `docs/data-model.md`.
- Save format change: bump `SAVE_VERSION`, add a migration and its test.
- No per-frame allocation or logging in hot paths.

## Commands

- `npm run check` — typecheck + lint + format check + unit tests
- `npm run build` — production build
- `npm run test:e2e` — Playwright on the real app in Microsoft Edge (software WebGL)
- `npm run bench` — frame times per lab (Physics, Chemistry, Biology, hub), production build, real GPU
  (visible window)
- `scripts/desktop-app.ps1` — the "SimLab 3D" desktop app for manual testing (`-Install` makes the
  Desktop shortcut): a vite build in `dist-app/` (rebuilt when sources changed) served on port
  5190, in its own Edge app window and profile; closing the window stops the server

## End of a task

Run the relevant commands, write the real results, known limitations and next step into the
phase report, and commit in logical commits. Do not push unless asked.
