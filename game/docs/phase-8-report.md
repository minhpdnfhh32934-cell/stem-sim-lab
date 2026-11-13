# Phase 8 report — subjects and topics

Date: 2026-10-23 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

## 1. Repository state

- **HEAD:** `32bb456` "phase 6g: add Vietnamese and English interface". One worktree, no stash, no
  remote.
- **Uncommitted at the start:** `src/content/strings.json`, the Vietnamese prompt labels changed
  after Phase 7 on request (Grab → Nhặt, Drop → Thả), left uncommitted as asked. Phase 7 itself
  changed no code: grab, hold, drop and throw already existed (Phase 3) and met its criteria.

## 2. Baseline

- `npm run check` PASS 336/336 in 30 files (19 s); `npm run build` PASS (3 s), both run now.
- `npm run test:e2e` not run again before the change: it passed 25/25 on the code of `32bb456`
  earlier in the session, and the only change since, two Vietnamese labels, is asserted by no
  e2e test.

## 3. Content architecture found

- **Subject** already existed: `LAB_TYPES` (physics, chemistry, biology, interdisciplinary), an
  experiment's `category` and a laboratory's `type`.
- **Room** (`rooms.json`) and **laboratory** (`laboratories.json`: its rooms, equipment and the
  experiments it offers) are places.
- **Station**: an apparatus placement in a room whose behaviour names its `experimentId`; several
  stations could offer one experiment already.
- **Experiment** (`experiments.json`): definition plus model; no code branches on its id.
- Missing: **Topic**. Players reach experiments by walking to stations; there is no catalog UI.

So the subject → topic → experiment relation needed one new kind of content, no change to rooms,
scenes, stations or the save.

## 4. Design

- `topics.json`, validated by `TopicDefinitionSchema` (`simulation/experiment.ts`): `id`,
  `subject` (from `LAB_TYPES`), `name` with its Vietnamese (`localized('name')`, enforced by the
  translation test), `experiments` (at least one).
- The topic lists its experiments rather than each experiment naming a topic: the experiment
  schema and every experiment fixture in the tests stay unchanged, a topic has many experiments,
  and an experiment may be listed in more than one topic.
- Boot checks (`game/content.ts`): every listed experiment exists and has the topic's subject;
  every experiment is in at least one topic; ids are unique; no empty topic.
- **Not added, on purpose:** a subject entity (the enum is enough while nothing displays
  subjects), planned or placeholder topics (a topic needs an experiment to play; adding one later
  is one entry), `description` and `status` fields, a primary topic, and any UI — no small,
  natural place shows it yet without changing tested HUD text. A future catalog reads
  `content.topics`.

## 5. Declared

| Topic                    | Vietnamese       | Subject | Experiments                      |
| ------------------------ | ---------------- | ------- | -------------------------------- |
| `kinematics`             | Động học         | physics | `free-fall`, `projectile-motion` |
| `oscillations-and-waves` | Dao động và sóng | physics | `pendulum`                       |

Stations, rooms and geometry are unchanged: the free-fall tower stays in the Physics Lab's main
room, the launcher in the range, the pendulum in the bay.

## 6. Files changed

New: `src/content/topics.json`, `docs/phase-8-report.md`. Changed: `src/simulation/experiment.ts`
(schema), `src/game/content.ts` (registry and checks), `src/content/index.ts`,
`src/game/content.test.ts` (2 tests; the translation test now also covers parsed topics),
`docs/data-model.md`, `docs/architecture.md`, `CLAUDE.md`, `README.md`. Already uncommitted:
`src/content/strings.json`.

## 7. Tests and build

- **New:** "puts every shipped experiment under a topic of its own subject" (and the labs still
  offer them); "rejects unknown, other-subject and unlisted experiments, empty and duplicate
  topics".
- No existing test or assertion changed; no room, placement, entity or collider count changed.

| Check                     | Result                                                        | Duration |
| ------------------------- | ------------------------------------------------------------- | -------- |
| `npm run check`           | **PASS**: 338/338 unit tests (336 + 2), 30 files; lint, types | 19 s     |
| `npm run build`           | **PASS**                                                      | 4 s      |
| `npm run test:e2e`        | **PASS**: 25/25, first run (free fall, cleanroom, grab, …)    | 365 s    |
| `npm run bench`           | **NOT RUN**: nothing in rendering or the frame loop changed   | —        |
| bench `gpu`, `gpu-native` | **NOT RUN**: visible windows                                  | —        |

## 8. Limitations

- Nothing shows topics to the player yet.
- A topic's name has no description; subjects have no display names of their own.
- `laboratories.json` and `topics.json` both list experiments, for different purposes (where they
  are offered, what they teach); nothing checks a laboratory's `type` against its experiments.

## 9. Next phase

A catalog that uses the topics: for instance a short "Topic · Experiment" line on the station's
desk screen or results panel, or an experiment list in the menu that names where each station is.
