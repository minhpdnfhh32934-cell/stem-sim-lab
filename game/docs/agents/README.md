# Working with several agents

How SimLab 3D is worked on by more than one Claude session at a time. `CLAUDE.md` stays the rule
book every session follows; this file adds who may change what, how work is split, and how it
comes back to `main`. One document on purpose: split it only when a part outgrows it.

## Roles

| Role                                               | May                                                                                                                                | May not                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Lead** (one session, on `main`)                  | write task cards, assign them, review, approve, merge into `main`, keep the task board                                             | code a worker's task itself; merge without QA's report                             |
| **Worker** (one per task, own branch and worktree) | change the files its card owns, run tests, commit on its branch                                                                    | merge, push, touch files outside its card, change another task or the architecture |
| **Reviewer** (on request)                          | read a branch: correctness, regressions, performance, resource lifecycle, architecture rules                                       | change the branch unless the Lead assigns the fix                                  |
| **QA** (one at a time)                             | run `check`, the full e2e suite, `build`, `git diff --check`, the bench and the leak probe, on a branch or on `main` after a merge | change product code (it reports, the owner fixes)                                  |

Leads of areas (Tech: rendering/performance, physics/simulation, architecture; Visual: Physics
Lab, Biology Lab, Chemistry Lab, world/environment; QA: unit, e2e, visual, performance) are task
areas, not standing sessions: a card names its area, and the Lead starts a worker for it.

## Task card

Every task starts as a card in `docs/agents/TASK_BOARD.md` (created with the first parallel task):

```text
id / title / area
goal and why (the evidence)
owned files (may change) — and read-only files it relies on
depends on (card ids)        branch: agent/<area>-<short-name>
acceptance criteria (measurable)
tests: unit / e2e / visual / performance
budget: JS bytes, draw calls, triangles, GPU resources it may add
status: proposed | approved | in progress | in review | merged | dropped
```

A worker that finds it needs a file outside its card stops and tells the Lead; the Lead changes the
card (or the order of cards) first.

## Git and worktrees

- `main` is only ever changed by the Lead, by merging a reviewed and QA-checked branch (or a
  fast-forward). No pushes: the repository has no remote.
- Each worker has one branch, `agent/<area>-<short-name>`, in its own worktree (under
  `.claude/worktrees/`, which git ignores). Never two agents in one worktree; never a worker on
  `main`.
- **Serialize by file, not by area.** Two cards that own a common file never run at once: the
  second `depends on` the first and starts from `main` after the first is merged. Files that most
  tasks touch are owned by one card at a time:
  - `src/content/items.json`, `rooms.json`, `strings.json`, `experiments/<id>.json`;
  - `src/game/Game.ts`, `src/game/GameEvents.ts`;
  - `src/platform/render/WorldRenderer.ts`, `ExperimentView.ts`, `assembly.ts`;
  - `src/platform/ui/styles.css`;
  - `src/persistence/*` (and `SAVE_VERSION`).
- A branch is rebased on (or merges) the current `main` before review; conflicts are resolved by
  its worker, not by the Lead.
- The forbidden commands of `CLAUDE.md` and the phase briefs (`reset --hard`, `clean -fd`,
  `restore .`, `checkout -- .`, `stash`) apply to every role.

## Shared machine limits

- **One e2e or bench run at a time.** The Playwright configs use fixed ports (dev 5199, preview
  5198, bench 5197), and SwiftShader and GPU timings are disturbed by any other load. Workers run
  `npm run check` and targeted unit tests freely; e2e runs, benches and leak probes are queued
  through QA (or the Lead) one at a time.
- Performance numbers say the renderer and the power state (AC or battery); before and after are
  compared in the same state only.

## Budgets

- **JS bundle:** `e2e/renderer.production.spec.ts` fails at 500,000 bytes for the menu's JS (since
  Phase C2; `e2e/production.spec.ts` keeps its older 1,000,000-byte check). three.js and the world
  renderer load with the first world scene, so the menu's JS is 384,416 bytes: the guard passes
  below 500,000, so at most 115,583 bytes can be added. Code only `WorldRenderer` reaches (its
  drawing in `src/platform/render`) goes to the renderer's chunk and does not count against it;
  code the menu or the game also imports stays in the menu's JS. The Lead gives each card a byte
  budget and keeps the running total on the board; cards in flight together must fit the
  remainder together.
- Every visual or rendering card reports: bundle delta, draw-call delta at a named view, triangle
  delta, GPU resources (geometries, materials, textures) and the leak probe's counts.

## Done

A card is done when its branch has: the acceptance criteria met with numbers, `npm run check` and
`npm run build` passing, its e2e (targeted, then the full suite through QA) passing, a phase report
or a section in one (results, limitations, next step), and the Lead's merge. Nothing is claimed that
was not run (see `CLAUDE.md`, Honesty).

## Model and effort

Default: the session's model at high thinking, UltraCode off. The Lead may turn UltraCode on for a
card that needs unusually deep reasoning — a large renderer refactor, a performance bottleneck
that measurements have not isolated, a hard merge, a deep subsystem dependency — and says why on
the card. Not for routine visual work.
