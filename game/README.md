# SIMLAB 3D

A first-person 3D scientific laboratory simulation game. Players prepare in the Preparation
Room, walk through the SIMLAB Hub into the Physics, Chemistry and Biology laboratories, interact
with equipment and run experiments.

**Status: Phase 14C — the spring laboratory.** Phase 1 built the architecture, core
systems, grey-box rooms and a proof-of-concept experiment (free fall); Phase 2 added Rapier
physics: room and furniture colliders, a character controller and dynamic objects (2.1: physics
loads lazily); Phase 3 lets the player grab, carry, drop and throw objects; Phase 4 joins rooms
through doorways (the Preparation Room opens onto a cleanroom corridor) and adds a secondary
action key; Phase 5 makes the way into the labs a playable procedure: read the rules, put on PPE
from the wardrobe, wash hands step by step, sanitize, glove up — only then does the door to the
clean area open; Phase 6A makes every door arrive at the matching door of the next scene, adds
the way back out (de-gowning, PPE kept out of the Teacher Room, preparation reset on leaving) and
bounds the HUD notices; Phase 6B adds a reusable experiment engine (sessions, runs, theory against
measurement, graphs, checklists) and its first complete experiment: **projectile motion** in the
Physics Lab's projectile range — take a ball, load the launcher, set v₀, θ and g on the desk
dials, RUN, watch the flight, then read theory, measurement, error and the graphs on the results
monitor; Phase 6C.1 validates it on the real GPU (300 fps on an RTX 5070 Laptop), proves the
experiment independent of the frame rate, and fixes Continue with a loaded launcher; Phase 6C.2
adds the **simple pendulum** in the Physics Lab's pendulum bay — the nonlinear equation solved
with RK4, the measured period against both the small-angle formula and the exact one, θ–t, ω–t,
phase-space and energy graphs; Phase 6C.3 keeps each station's last 20 runs as frozen records
— pick one to view it, two to four to compare them (overlays from their own samples, each with
its own theory), export any as CSV; Phase 6C.4 reads the range with a tape measure and the
period with a timer at a resolution d set on a desk dial — the reading, its standard
uncertainty u = d/√12 and the bound d/2, kept apart from the theory and the unrounded simulated
value, per run; Phase 6C.5 lets the monitor open kept runs after RESET and lays the desk screens
out without overlaps; Phases 6D and 6E furnish the Teacher Room (a computer, a cabinet, a bed) and
add its bathroom; Phase 6F brings **free fall** onto the experiment engine — a tower in the
Physics Lab's main room: set h and g at the desk, RUN, watch the drop, then read the fall time and
impact velocity against t = √(2h/g) and v = −√(2gh), and the timer's reading; Phase 6G adds
Settings to the main menu — English or Tiếng Việt, remembered by the browser — and translates the
whole game into Vietnamese (formulas, units and numbers unchanged); Phase 8 groups the
experiments into topics of their subject — kinematics (free fall, projectile motion) and
oscillations and waves (the pendulum) — checked at boot; Phase 9 lists them in the main menu, each
experiment with the room its station stands in (since Phase R4 in the **Experiment catalog**, a
page of the main menu: by subject, topic and experiment, with how to run each and whether the
saved game ran it to the end); Phase 10 audited
how players find stations, and Phase 11 adds the way there from the start — the scenes through
the doors and the cleanroom entry on the way; Phase 12A audited how the game knows the player's
scene, and Phase 12B adds the way from the saved game Continue would load; Phase 13A audited the
learning journey, and Phase 13B shows what each experiment teaches in the catalog; Phase 13C marks
there the experiments the saved game has run to a natural end; Phase 14 marks the Chemistry and
Biology labs, which have no experiments yet, as planned at their doors and inside; Phase 14A adds
**Hooke's law** in the Physics Lab — let a mass of 0.05–5 kg go on a spring of 5–200 N/m, watch
it fall, bounce and come to rest (m·x″ + c·x′ + k·x = m·g), then read the extension at rest and
the stiffness k = m·g/Δl, the slope of the force–extension graph; Phase 14B gathers a station's
completed runs into one table and fits a straight line through the points the player ticks
(least squares, intercept free): for Hooke's law k_exp from the slope, against each run's m·g/Δl
and the model's k; Phase 14C completes the spring lab — start the swing y₀ from rest and pick
the damping ζ, measure the period from the run's samples against T₀ and the damped T_d, the decay
of the swings, and k again from T² against m. Reports:
[phase 1](docs/phase-1-report.md), [2](docs/phase-2-report.md),
[2.1](docs/phase-2.1-report.md), [3](docs/phase-3-report.md), [4](docs/phase-4-report.md),
[5](docs/phase-5-report.md), [6A](docs/phase-6a-report.md), [6B](docs/phase-6b-report.md),
[6C.1](docs/phase-6c1-report.md), [6C.2](docs/phase-6c2-report.md),
[6C.3](docs/phase-6c3-report.md), [6C.4](docs/phase-6c4-report.md),
[6C.5](docs/phase-6c5-report.md), [6D](docs/phase-6d-report.md), [6E](docs/phase-6e-report.md),
[6F](docs/phase-6f-report.md), [6G](docs/phase-6g-report.md), [8](docs/phase-8-report.md),
[9](docs/phase-9-report.md), [10](docs/phase-10-report.md), [11](docs/phase-11-report.md),
[12B](docs/phase-12b-report.md), [13B](docs/phase-13b-report.md),
[13C](docs/phase-13c-report.md), [14](docs/phase-14-report.md),
[14A](docs/phase-14a-report.md), [14B](docs/phase-14b-report.md), [14C](docs/phase-14c-report.md).

Stack: TypeScript · Three.js · Rapier · Zod · Vite · Vitest · Playwright.

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + format + unit tests
npm run test:e2e   # real-browser tests (Microsoft Edge)
npm run bench      # Physics Lab frame times on the real GPU (opens a browser window)
```

Controls: click to capture the mouse · WASD move · Shift run · E interact / grab / drop, or use
the held object on what you look at (load the launcher) · F secondary action (e.g. Inspect next
to Grab; lowers a dial) · left mouse button throw (while holding) · Esc pause (Resume, Settings, back to the main menu) · F3 debug.

Documentation:

- [Architecture](docs/architecture.md) — layers, systems, lifecycle, data flow, stable decisions
- [Game core](docs/game-core.md) — boot, game state, events, config, languages, logging, errors,
  debug panel
- [Interaction](docs/interaction.md) — targeting, actions, behaviours, guards, input
- [Procedures](docs/procedures.md) — cleanroom entry: steps, rules, equipment, HUD objective
- [Experiments](docs/experiments.md) — experiment engine, projectile motion, pendulum, results, run history and CSV, adding one
- [Physics](docs/physics.md) — Rapier world, fixed step, colliders, character controller, policies
- [Data model](docs/data-model.md) — content files, items, rooms, scenes, experiments/simulation
- [Persistence](docs/persistence.md) — save format, versioning, migrations
- [Development guide](docs/development-guide.md) — commands, tests, conventions, recipes
