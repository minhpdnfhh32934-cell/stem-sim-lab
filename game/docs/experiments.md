# Experiments (Phase 6B, 6C.2, 6C.3, 6C.4, 6F, 14A, 14B, 14C)

How SIMLAB runs a scientific experiment, from a JSON definition to a ball flying in the 3D lab
and a results panel comparing theory with measurement. The first complete one is **projectile
motion** (Physics Lab → projectile range); the second, on the same engine, is the **simple
pendulum** (Physics Lab → pendulum bay, Phase 6C.2); the third is **free fall** (Physics Lab,
main room, Phase 6F).

## Two kinds of physics

| Game-world physics (Rapier, `src/physics`)       | Scientific simulation (`src/simulation`)           |
| ------------------------------------------------ | -------------------------------------------------- |
| player, furniture, objects you pick up and throw | the experiment's model: equations, measured values |
| collisions, friction, restitution                | no collisions, no air resistance unless modelled   |
| fixed 1/60 s step, 32-bit floats                 | the definition's own step (1 ms), 64-bit floats    |
| good enough to look and feel right               | deterministic: same inputs → bit-identical samples |

During a run the projectile belongs to the **scientific model**: its body is taken out of Rapier
(`PoseDriver.drive`) and its pose is the model state, frame by frame. When it lands it is handed
back to Rapier at rest (`stopDriving`) and is an ordinary object again. One source of truth:

```
model state (ExperimentRuntime) ──► ball pose (StationSystem, toWorld mapping)
          │                     └─► trail (ExperimentView, same mapping)
          └─► samples (preallocated buffers) ──► graphs, measured results ──► results panel
model.predict(inputs) ──────────────────────────────► theory column
```

The pendulum's bob never has a physics body at all: the renderer draws the rod and bob at the
model's angle every frame (`swingAngle(session)` — the run's θ, or the release angle before a
run), so there is nothing for Rapier to simulate or disagree with.

## Building blocks

| Concept                | Where                                  | What it is                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ExperimentDefinition` | `simulation/experiment.ts` + JSON      | Data: parameters (unit, range, step, presets, symbol), measurements, results (+ `theory`), graphs, procedure checklist, sampling                                                                                         |
| `SimulationModel`      | `simulation/models/*`                  | Code: deterministic `init`/`step` over a `Float64Array`, optional analytical `predict`                                                                                                                                   |
| `ExperimentRuntime`    | `simulation/ExperimentRuntime.ts`      | One run: fixed steps with an accumulator, samples, min/max/final results, never fabricates                                                                                                                               |
| `ExperimentSession`    | `simulation/ExperimentSession.ts`      | One experiment set up somewhere: parameters, readiness, states, the current run and the history of ended runs (pure, no events)                                                                                          |
| `RunRecord`            | `simulation/RunRecord.ts`              | An ended run, frozen: its inputs, theory, results (if completed) and samples; `RunData` is what views read, live or recorded                                                                                             |
| CSV export             | `simulation/csv.ts`                    | A recorded run as CSV: metadata lines, then every stored sample                                                                                                                                                          |
| measurement            | `simulation/measurement.ts`            | An instrument's reading of a completed run at resolution d, with u = d/√12 and the bound d/2 (Phase 6C.4)                                                                                                                |
| `ExperimentSystem`     | `simulation/ExperimentSystem.ts`       | Owns sessions, advances them, announces events                                                                                                                                                                           |
| `StationSystem`        | `gameplay/experiment/StationSystem.ts` | Each apparatus by kind (`launcher`, `pendulum`, `drop`): commands, rules (action guard), projectile pose, limits, checklist                                                                                              |
| behaviours             | `gameplay/experiment/behaviors.ts`     | Thin controls: `launcher`, `pendulum`, `drop-tower`, `parameter-dial`, `experiment-control`, `results-display`, `instrument`                                                                                             |
| `ExperimentView`       | `platform/render/ExperimentView.ts`    | Screens (status, monitor graph), trail, landing marker, tape; pendulum protractor, scale and swing (pendulumModel); tower scale, carriage and ball (towerModel); spring stand ruler, spring and mass hanger (hookeModel) |
| `ResultsPanel`         | `platform/ui/ResultsPanel.ts`          | Theory / simulated / difference table, instrument readings, SVG graphs (the mouse wheel scrolls it while the pointer is locked)                                                                                          |

### Session states

```
idle ──apparatus ready (ball loaded)──► configured ──RUN──► running ──lands──► completed
  ▲                                        ▲                   │                  │
  └──────── RESET (no ball) ───────────────┴──── RESET ────────┴── STOP ──► stopped
```

- **STOP** halts a run and keeps its data (samples up to that moment; no measured landing).
- **RESET** discards the run. The launched ball goes back into the launcher unless the player
  holds it. A new run needs a reset first ("Press RESET before the next run.").
- Parameters can change in any state except `running`; a stopped or completed run keeps the
  values it ran with (the results panel shows those).
- An apparatus with nothing to load (the pendulum) is ready at once: its session starts in
  `configured`, and RESET returns it there.

### Events

`ExperimentStarted`, `ExperimentStateChanged` (every transition), `ExperimentParameterChanged`,
`ExperimentCompleted` (results; progression records the experiment), `ExperimentFailed`,
`ExperimentCommand` (a control asks the station; refused, it changes nothing and is answered with
`ActionBlocked`), `ExperimentStationChanged` (anything a station shows changed),
`ExperimentResultsViewed`, `WorkspaceRequested/Opened/Closed` (below). There is no per-sample event: views read the run's
buffers when they repaint (at most 10 times a second while running).

## Projectile motion

Model `kinematics.projectile` (`simulation/models/projectile.ts`), inputs v₀ (m/s), θ (degrees),
g (m/s²) and the launch height h (m) supplied by the apparatus:

```
vx = v₀ cos θ          x(t) = vx t
vy = v₀ sin θ − g t    y(t) = h + v₀ sin θ · t − ½ g t²        (y: ball's lowest point above the floor)
T = (v₀ sin θ + √((v₀ sin θ)² + 2 g h)) / g      R = vx T
H = h + (v₀ sin θ)² / 2g (θ > 0)                  impact speed = √(v₀² + 2 g h)
```

With h = 0 these are the textbook same-height formulas T = 2v₀ sin θ / g, R = v₀² sin 2θ / g,
H = v₀² sin²θ / 2g (unit-tested). The launcher's launch point is the barrel's pivot, so h does not
change with θ: 0.62 m − 0.03 m (ball radius) = 0.59 m.

**How the launcher is drawn** (Phase P3.6, `platform/render/launcherModel.ts`): a bevelled base
plate on rubber feet; a pedestal; a fork bolted onto it, whose two gusseted cheeks carry the barrel
on stub trunnions at the launch point (a hex nut on the far side, a rubber lock knob on the near
side); a spring-launcher tube — a bored muzzle block around the pivot, the tube, the spring housing
and a cocking rod; and on the near cheek an angle scale ticked every 5° (longer every 15°, no
numbers) with a pointer turned by the barrel itself, so it reads the simulated angle. The pedestal's
top is set from how far the barrel's rear reaches below the pivot, so the barrel swings between the
cheeks over 0–90° without passing through anything. Only the look: the collider and the
interaction box are still the item's box, and the launch point and direction still come from the
item data (`launcher.muzzle`, the entity's +x). Unit-tested (`launcherModel.test.ts`): everything
it makes is freed, the barrel clears the flange and cheeks at every 5°, nothing it draws stands in
the ball's path, and the pointer lies on the tick of its angle.

**Measured vs theory.** Each 1 ms step is exact for constant acceleration and the floor contact is
solved inside the step, so flight time, range and impact speed agree with theory to floating
point; the maximum height is the highest stepped state, at most g·dt²/8 (1.2 µm on Earth) below
the true apex. The panel shows the error honestly ("< 0.01 %"), never a forced zero. No random
error is added.

**Limits.** Parameter ranges: v₀ 1–15 m/s (0.5 steps), θ 0–90° (5° steps), g 1–25 m/s² stepped
through Moon 1.62, Mars 3.71, Earth 9.81 and Jupiter 24.79. The station refuses a shot that would
land beyond its lane (21.6 m, from the room geometry) or rise above the hall (5.7 m), with the
reason — the ideal model has no walls, so such a run could not be observed.

## Simple pendulum (Phase 6C.2)

Model `mechanics.pendulum` (`simulation/models/pendulum.ts`), inputs L (m), θ₀ (degrees,
converted to radians in the model), g (m/s²), the bob's mass m (kg, supplied by the stand; only
the energies depend on it) and ω₀ (rad/s, an initial condition, 0 at this station). The ideal pendulum — a point
bob on a light rigid rod, no friction or air resistance — solved **nonlinearly**:

```
θ'' = −(g/L) sin θ                    α = θ'', ω = θ'
x = L sin θ    y = L(1 − cos θ) = 2L sin²(θ/2)        (bob from below the pivot; y ≥ 0)
Eₖ = ½ m L² ω²    Eₚ = m g y    E = Eₖ + Eₚ             (lowest point as zero)
```

**Integration.** Classical fourth-order Runge–Kutta on the definition's 1 ms step, 64-bit floats,
written into the preallocated state (no allocation per step). Zero crossings and turning points
are located inside the step where they happen by linear interpolation (accurate there: θ'' ≈ 0 at
a crossing, ω'' ≈ 0 at a turning point). The **measured period** comes from the crossings, which
are half a period apart: T = 2 (t_last − t_first) / (n − 1). The run ends exactly at the turning
point that completes three oscillations — the last step is shortened to it — so the bob ends
where it was released.

**Theory** (`predict`, closed forms, never fitted to the run):

| Result            | Theory                                               | Measured                   |
| ----------------- | ---------------------------------------------------- | -------------------------- |
| period vs T₀      | small-angle T₀ = 2π√(L/g) — **an approximation**     | period from zero crossings |
| period vs exact   | T = 4√(L/g)·K(k), k = sin(θmax/2), K by the AGM      | the same measured period   |
| amplitude θmax    | 2 asin k, with sin²(θmax/2) = sin²(θ₀/2) + ω₀²L/(4g) | largest θ of the run       |
| maximum bob speed | 2√(gL)·k                                             | largest L·\|ω\| of the run |
| energy at the end | 2mgLk²                                               | E when the run ends        |

T₀ is shown as what it is: exact only as θ₀ → 0; at 30° the pendulum takes 1.74 % longer, at
60° 7.32 % (the results table's "Difference" column, and the note under it). That difference is
the small-angle formula's, not the simulation's: against the exact period the measured one agrees
to about 10⁻⁹ (unit tests check 7 digits against tabulated values of K; energy drifts less than
10⁻⁹ of E over three periods at 60°, less than 10⁻⁸ at the extremes of the ranges).

**Station.** A steel frame with the pivot 3.6 m up, a protractor (5° ticks) and a length scale
(0.1 m marks) behind the swing plane, a 0.5 kg brass bob (r = 6 cm). Dials: L 0.25–3 m (0.25 m
steps), θ₀ −60…60° (5° steps), g through Moon 1.62, Mars 3.71, Earth 9.81, Jupiter 24.79. RUN is
refused with the reason at θ₀ = 0 ("at 0° the pendulum just hangs there"), and for a swing over
the top, a bob that would reach the floor or a swing beyond the bay (none of these three is
reachable with the shipped ranges and frame; they guard other content). The live monitor draws
θ–t with the exact period marked on the time axis; the results panel has θ–t, ω–t, the phase
portrait (ω against θ) and the energies against time. Only the base of the stand is solid: the
player can walk through the drawn frame and the swinging bob.

**How the stand is drawn** (Phase P3.7, `platform/render/pendulumModel.ts`): a gantry — a chamfered
base on four rubber pads; at each end a foot plate bolted to it, a steel post on it and a diagonal
brace from the base's edge; the beam resting on both posts with a knee gusset at each joint; under
the beam's middle two hanger plates bolted to it, round about the pivot, carrying a steel axle with
a nut at each end; a clip holding the protractor under the beam, and an arm from the beam carrying
the length scale (both used to float). What swings is a hub on the axle, a clamp holding the rod,
the rod from the pivot to the bob's centre, and the brass bob with the rod's lock nut on top and a
matching nut underneath, so it still reads as centred where the model has it. WorldRenderer draws
the frame (the base is the entity's mesh, so focus shows on the painted frame); ExperimentView
draws the scales where `scaleLayout` puts them and poses the swing from the run (`pose` only
assigns: a unit rod scaled to L, the bob at its end). Only the look: the collider is still the base
box; pivot, L and θ come from the item and the run. Unit-tested (`pendulumModel.test.ts`): all
it makes is freed; the axle, nuts, hangers and hub share the pivot's axis; and, sampled at every
5° from −60° to 60° for L = 0.25, 0.5, 1, 2 and 3 m (not continuously), the rod joins the pivot to
the bob's centre and nothing that swings meets the frame, the protractor or the length scale.

## Free fall (Phase 6F)

Model `kinematics.free-fall` (`simulation/models/freeFall.ts`), inputs h (m), g (m/s²) and v₀
(m/s, an initial condition, 0 at this station: a release from rest). One-dimensional motion under
constant gravity without air resistance: y is the height of the ball's lowest point above the
floor, v its velocity (positive upwards), a = −g. The step is exact for constant acceleration and
the floor contact is solved inside the step, so the run ends exactly at y = 0.

**Theory** (`predict`): t = (v₀ + √(v₀² + 2gh))/g and v = −√(v₀² + 2gh); from rest, t = √(2h/g)
and v = −√(2gh). The run's fall time and impact velocity agree with it to about 10⁻¹² (unit
tests: every g preset at h = 0.2, 1.5 and 3 m). The mass does not enter, so there is no mass
dial.

**Station.** In the Physics Lab's main room (south-east): a 3.3 m steel column with a scale
reading heights from the floor (0.1 m marks), a release clamp that moves to h, a 50 mm steel ball
and a pad where it lands. Like the pendulum's bob, the ball has no physics body — the renderer
draws it at the run's height (`dropHeight`) and the clamp at the release height
(`releaseHeight`) — so the station is ready at once. Dials: h 0.2–3 m (0.1 m steps), g through
the four presets, the timer's resolution d (0.001, 0.01, 0.1 s). RUN is refused with the reason
for a release above what the room and the column allow ("this tower releases from up to
3.15 m"; not reachable with the shipped range, it guards other content). The live monitor draws
y–t with the theory's fall time marked; the results panel has y–t, v–t and a–t (flat at −g) and
the timer's reading of the fall time. Only the column is solid.

**How the tower is drawn** (Phase P3.9, `platform/render/towerModel.ts`): a chamfered base on four
rubber pads behind the landing point; the column (the entity's mesh) on a foot plate bolted to it,
the scale on its face, a steel rail on its side and the drive housing on top; where the ball lands, a
2 mm rubber mat and the light gate that stops the timer — a fork whose sensors face each other
across the path. The carriage rides the column at the release height: a sleeve round the column and
the rail, with a locking knob; a tab with a red index whose line marks h on the scale; an arm out to
the release head over the path, with a lamp lit while it holds the ball; and two jaws hinged under
the head, whose rubber pads hold the ball just below its equator. WorldRenderer draws the frame
(the column is the entity's mesh, so focus shows on the painted frame); ExperimentView draws the
scale where `towerLayout` puts it and poses the carriage and the ball from the station: `pose`
puts the carriage at `releaseHeight` and the ball's lowest point at `dropHeight`, and opens the
jaws and puts the lamp out while a run exists (RESET clears it: held again) — assignments only. Only
the look: the collider is still the column's box; h, y and the run come from the station. Unit-tested
(`towerModel.test.ts`): all it makes is freed; the column stays in the item's box and the scale reads
from the floor; at 7 release heights (0.2–3 m) the held ball is on the path just under the head, the
pads' top edges on its surface, the index at h; at 6 points of each fall (held, let go, 90 %, half,
10 %, landed — sampled, not continuously) the ball is on the path and meets nothing fixed nor the
open clamp (the landed ball rests through the 2 mm mat, at most), and the carriage meets nothing
fixed but the column and rail it rides on; the jaws and the lamp follow the release; posing adds
nothing.

The Phase 1 free-fall console and its one-shot `ExperimentRequested` are gone: every experiment
runs at a station.

## Hooke's law and the spring's swing (Phases 14A, 14C)

Model `mechanics.spring` (`simulation/models/spring.ts`). Inputs: m (kg), k (N/m), the start y₀
(`offset`, m below rest), the damping ratio ζ (`damping`) — all four set at the desk — g (9.81
m/s², an initial condition) and the natural length L₀ (0.20 m, from the stand). **Coordinates**,
SI, downward positive, the spring's top end fixed: x, the extension from L₀; Δl = m·g/k, the rest
extension; y = x − Δl, the displacement from rest; v = x′. The spring's pull on the mass is −k·x
(up); its size k·x is what the force graph shows.

- **Statics (Hooke's law), the theory** (`predict`): at rest k·Δl = m·g, so Δl = m·g/k,
  L = L₀ + Δl and k = m·g/Δl; Δl is measured from L₀, never the spring's whole length.
- **Dynamics, the run:** m·x″ + c·x′ + k·x = m·g, that is m·y″ + c·y′ + k·y = 0, with viscous
  damping c = 2ζ·√(k·m). Held at y₀ and let go at rest. ω₀ = √(k/m) and T₀ = 2π√(m/k) (no
  damping); for ζ < 1 it swings with ω_d = ω₀√(1 − ζ²), T_d = 2π/ω_d, the swings shrinking as
  e^(−ζω₀t): let go from rest, the peaks (y′ = 0, at t = nπ/ω_d) lie exactly on |y₀|·e^(−ζω₀t)
  (`envelope0` = |y₀|), below the envelope |y₀|/√(1 − ζ²)·e^(−ζω₀t) that touches the curve
  between them; ζ = 1 returns without swinging (critical),
  ζ > 1 creeps back (overdamped). The energy of the swing never grows, so x stays within
  Δl ± |y₀| (`peak`, `lowest`). Semi-implicit Euler on the experiment's 1 ms step: the render
  frame rate does not enter (the same results and samples at 30 and 144 fps), and 2 ms or 0.1 ms
  steps move x(1.5 s) by under 0.1 % of the swing (unit tests).
- **End of a run:** by itself once the energy left is that of a swing below 0.1 % of Δl
  (`SPRING_SETTLED`) — at once when held at rest (y₀ = 0), a static measurement. Its results at
  rest — m·g, L, Δl, k = m·g/Δl — are within 0.1 % of the theory. Weak damping (ζ = 0.05) can take
  about half a minute; the time limit is 60 s. An undamped spring (ζ = 0) never comes to rest: the
  model handles it (unit tests), the dial does not offer it.

**Damping** is set as a ratio of critical damping, not as one c for all, so every load rings for
about as many swings; it is a simplified viscous term, not the air and metal of a real spring.
**Assumed:** a linear, massless, elastic spring, vertical motion only, uniform g.

**The swing, measured** (`simulation/oscillation.ts`, pure): from a run's recorded `displacement`
samples, every 10 ms of simulated time — never frames. y is positive downward. The period: the
time between the first and last crossing of rest from y < 0 to y > 0 (the mass moving down; each
interpolated between its two samples) over the whole swings between them, from 2 swings up, else
"not measured" with what gives more swings (a smaller ζ or a larger |y₀|). Peaks: the maxima of y
(the mass at its lowest), each refined through its three samples. Swings under 2 % of the largest are too small to read and are left
out, crossings too. The decay: ln A against t fitted with `fitLine`, σ = −slope, from 3 peaks up;
δ = σ·T is the logarithmic decrement and ζ = δ/√(4π² + δ²). The results panel shows them for an
ended run against T_d, T₀ and ζ·ω₀, with the peaks, the line fitted through them and the theory
through them, |y₀|·e^(−ζω₀t) (phase 14D: it was drawn as |y₀|/√(1 − ζ²)·e^(−ζω₀t), the touching
envelope, a curve the peaks never lie on — 2 % above them at ζ = 0.2). A run held at rest (y₀ = 0)
never swings: the panel says it is a static measurement instead of listing a swing;
a run's CSV adds them as `# Oscillation` lines. On this ideal model the measured T agrees with T_d
to within 0.2 % and σ and ζ within 2 % (unit tests): that checks the numerical model against its
own equations, not a real spring.

**Station.** In the Physics Lab's main room (north-east), across from the free-fall tower: a stand
whose arm holds the spring, a weight with a pointer, and a ruler beside it zeroed where the pointer
rests with nothing hanging, so it reads the extension (1 cm marks over 0.7 m). The spring and the
weight have no physics body: whenever the length changes, the renderer lays the coil out at
L₀ + x — 14 turns whose pitch follows the length while the wire stays round, its vertices rewritten
in place — and hangs the weight at its end. Before RUN and after RESET the mass is held at
Δl + y₀ (`SpringView.held`); STOP freezes it where it is. Five dials (presets): m 0.05, 0.1, 0.2,
0.3, 0.5, 1, 2, 3, 5 kg; k 5, 10, 20, 50, 100, 200 N/m; d 0.001, 0.005, 0.01 m; y₀ −0.1, −0.05,
−0.02, 0, 0.02, 0.05, 0.1, 0.2 m; ζ 0.05, 0.1, 0.2, 0.5, 1, 2. RUN is refused with the reason when
the swing could pass the stand's elastic limit (Δl + |y₀| > 0.60 m) or take the spring shorter than
its natural length (Δl − |y₀| < 0), which the model does not cover. The desk display is taller,
for seven rows. The monitor draws the spring's pull against Δl (slope k); the results panel adds
Δl–t, y–t (compared across runs too) and the swing.

**How the stand is drawn** (Phase P3.8, `platform/render/hookeModel.ts`): a chamfered base on four
rubber pads; a square column on a foot plate bolted to it, with a cap; a boss clamp on the column
with its thumb screw, holding the arm, braced from below; at the arm's end an eye bolt (a nut above
and below the arm). The spring's top loop hangs in that eye; the coil runs from it to the bottom
loop; on that loop hangs the mass hanger — its eye, a stem with the pointer's collar, five brass
disc masses (no slots drawn) on a steel base, as wide and tall as the item's `weight` (the stack does not follow
the mass set). The ruler sits on a scale board hung from the arm on a bar. WorldRenderer draws the
frame (the column is the entity's mesh, so focus shows on the painted frame); ExperimentView draws
the ruler where `springLayout` puts it and poses the hanging parts from the station: `pose(L)`, with
L = L₀ + the run's extension (or the held Δl + y₀), rewrites the coil's buffers in place at
L − 2R (the loops take R each) and moves the hanger to L below the hook, only when L changes. The
pointer hangs 25 mm below the bottom loop and the ruler's 0 is moved down with it, so it still
reads L − L₀. Only the look: the collider is still the column's box, and the hook, L₀, the limit
and the extension come from the item and the run. Unit-tested (`hookeModel.test.ts`): all it makes
is freed; the column stays in the item's box; the closed coil is shorter than the shortest spring
drawn; and, sampled at 12 lengths from 0.1025 m (the shortest held spring) to 1.28 m (a held load
past the limit), not continuously, the coil is finite with unit normals and joins both loops, the
hanger is at L below the hook, the pointer's tip is on the ruler's edge and reads L − L₀, nothing
that hangs meets the frame or the ruler, and posing reuses the same buffers.

The main room now holds two stations, so the HUD objective and the debug panel show the
**nearest** station in the player's room (`activeStation`). The debug panel follows the player;
the objective is redrawn on its usual events (entering a room, or a change at a station: a dial, a
run, its board read for the first time), so it switches station at the first of these there. The
stand sits east of the tower's mirror image so that at the lab's door the free-fall tower stays
the nearer one, as before.

## The range's bench stations: Ohm's law, refraction, the inclined plane

Three **bench** stations (next sections: "Adding a bench experiment") stand along the projectile
range's north wall, the Physics Lab's main room being full: from west to east refraction (desk
centre x 3.2), Ohm's law (x 7) and the inclined plane (x 11.6). Each mirrors the Hooke's law
station: a control desk (front facing the room, +z), four dials left to right, RUN, STOP, RESET,
the tall desk display at its back left (the incline's is the low one, so it hides less of the
ramp), a results monitor on the wall and an instruction board. The two boards stand on their
desk's back right, 0.6 m from the player's eyes; the ramp on a lab bench behind its desk. The
incline's desk stands 1.3 m north of the projectile lane (z ≥ 7.25), the other two 2.15 m; a ball
that lands and rolls north can still reach them (accepted, as for the range's other furniture).
`stationZones.test.ts` keeps each apparatus' box and the e2e stand points (desks at z 5.6 / 6.45,
the incline's monitor at (13.6, 5.4)) clear; the launcher stays the nearest station at its own desk
and monitor. The HUD objective and the debug Station line follow the nearest station in the room
(`StationSystem.activeStation`, unchanged): walking out to a typical landing spot (about x 5.5,
z 9), the circuit or refraction board is nearer than the launcher, so they switch to that station
until the player walks back (accepted: the same rule as between the Physics Lab's stations).

The desk display lists at most as many results as fit above its footer — 4 on the low display, 7
on the tall one — and ends with "…" when there are more; the monitor's summary line and the
results panel list them all. A parameter without a symbol (the circuit, the ray's direction, the
surfaces) shows on the desk as its preset's name alone ("Wood on wood"), from the left edge. Widths
were computed from Segoe UI text measured in headless Edge, not seen on the 3D screens yet.

### Ohm's law: series and parallel resistors (`ohms-law`)

Model `electric.dc-circuit` (`simulation/models/circuit.ts`), apparatus `circuit-board`
(`platform/render/bench/circuit-board.ts`), topic **electricity**.

- **Principle and reference solution:** Ohm's law U = I·R for each ohmic resistor and Kirchhoff's
  laws: R_eq = R1 alone, R1 + R2 in series (one current, U1 + U2 = U), R1·R2/(R1 + R2) in parallel
  (one voltage, I1 + I2 = I); I = U/R_eq, P = U·I = U²/R_eq, E = P·(t_end − t_K). The model is
  that closed form: the switch K is open until `switchTime` 0.5 s (every reading 0), closed until
  `duration` 3 s, steps shortened to land on both. No transient is modelled: with an assumed
  ~1 µH and ~10 pF of a resistor board, L/R and R·C are ≤ 20 ns over the dials' presets (R_eq
  50 Ω – 2 kΩ), ≥ 10⁴ times below the 1 ms step; the model itself accepts any R > 0.
- **Settings (presets only):** U 1.5, 3, 6, 12 V; R1 and R2 100, 220, 470, 1000 Ω; circuit R1 only,
  series, parallel. None reaches what the model refuses (missing inputs, U < 0, R ≤ 0, a
  configuration other than 0, 1, 2, `duration` ≤ `switchTime`). Every resistor stays ≤ 1.44 W.
- **Results:** U across the circuit and I in the main circuit (simulated values, not meter
  readings: no meter resolution), U/I (against R_eq), P, E and each resistor's U1, U2, I1, I2. Analysis: U
  against I over runs with the same R1, R2 and circuit, slope R_eq.
- **Board:** supply with its LED readout (the set U), knife switch K (`switch`), analog voltmeter
  (`voltage`, 15 V full scale) and autoranging ammeter LCD (`current`, mA), colour-banded R1 and
  R2, link leads per circuit. **Limits:** ideal supply and meters, leads of 0 Ω, constant R (no
  heating); no meter resolution (the four dials are taken); the graphs join samples 10 ms apart, so
  the jump at K is drawn as a 10 ms slope.

### Refraction and total internal reflection (`refraction`)

Model `optics.refraction` (`simulation/models/refraction.ts`), apparatus `ray-optics-board`
(`bench/ray-optics-board.ts`), topic **optics**.

- **Principle and reference solution:** reflection i′ = i; Snell's law n₁·sin i = n₂·sin r (air
  taken as n = 1); leaving the block, the critical angle C = asin(1/n) and total internal
  reflection beyond it; the Fresnel reflectance of unpolarised light R = (Rs + Rp)/2 (Hecht,
  Optics, §4.6), 1 under total reflection. The ray hits the centre of a semicircular block's flat
  face, so the curved face never deviates it. A run turns the ray box from 0° to i at 10 °/s
  (`sweepRate`); the state depends only on the angle reached, so each step is exact, and a step
  lands exactly on C and on i. Past C the refraction slots keep the last refracted ray, the
  grazing one at C (r = 90°), never NaN.
- **Settings (presets only):** n 1.33 (water), 1.49 (acrylic), 1.52 (crown), 1.62 (flint);
  direction air → block or block → air; i 20 (the default), 40, 60, 80°; the reading
  resolution d 0.5, 1, 2, 5°. None is refused.
- **Results:** i, i′, total reflection (classes "No" / "Yes", short to fit the desk display), the
  last refracted ray's i and r, its sines in the block and in air, R. Four protractor readings (°)
  at d. Analysis: sin(air angle) against sin(block angle), runs grouped by n only, slope n both
  ways.
- **Board:** a 1° protractor disc, the block (opacity rising with n), the ray box turning about
  the disc's centre, three rays (incident; reflected, opacity 0.9·√R; refracted, 0.9·√(1 − R),
  hidden under total reflection). **Limits:** one wavelength, an ideal narrow ray, clear
  non-absorbing media, the curved face's reflection not counted; water is drawn as a solid block,
  not a tank.

### Friction on an inclined plane (`inclined-plane`)

Model `mechanics.incline` (`simulation/models/incline.ts`), apparatus `incline-ramp`
(`bench/incline-ramp.ts`), topic **dynamics**.

- **Principle and reference solution:** along the ramp, N = m·g·cosθ; held when tanθ ≤ μs
  (friction then m·g·sinθ ≤ μs·N, the run ends at t = 0); else a = g(sinθ − μk·cosθ),
  s = ½a·t², v = a·t, at the foot t = √(2L/a), v = √(2aL); energy: m·g·L·sinθ = ½m·v² + μk·N·L.
  Constant a makes each step exact; the step that reaches the foot is cut to land on it. g =
  9.81 m/s²; μs/μk from Serway & Jewett, Table 5.1 (Teflon 0.04/0.04, lubricated metal
  0.15/0.06, wood 0.35/0.20, dry steel 0.74/0.57), approximate by that table's own word.
- **Settings (presets only):** θ 10, 20, 30, 45°; the surface pair 1–4; m 0.1, 0.5, 1, 2 kg; L 0.5,
  1, 1.5 m. None is refused (the model refuses θ outside 0–90°, a surface other than 1–4,
  m, L, g ≤ 0).
- **Results:** a, the sliding time, the final speed (first, so the low desk display shows them),
  slides (classes "Stays at rest" / "Slides"), μs, μk, F_net/(m·g), f, s, ΔEₚ, Eₖ, Q, E. Analyses
  at one θ, surface and m: Eₖ against L (slope m·a) and Q against s (slope μk·N) — checks of the
  run against the force model, which is exact, not independent measurements.
- **Ramp:** hinged at its foot on a base board, raised by a retort stand's cross rod, protractor at
  the hinge, a ruler from the light gate up, the release stop at L, the block with brass plates
  for m (`distance` only is read from the run). **Limits:** a point block (no tipping or rolling),
  Coulomb friction with constant μ, no drag, released from rest; the 2 kg stack would tip above
  ~31° on a real ramp. No timer resolution (four dials taken).

## The range's later physics benches: energy, collisions, circular motion, buoyancy, power, reflection, lens

Seven more **bench** stations in the projectile range, laid out like the three above: a control
desk (four dials at most, RUN, STOP, RESET, a desk display at its back left), a results monitor
and an instruction board on the wall. Five stand along the south wall (front −z, turned a half),
the lens and the power board on the north wall east of the inclined plane. Each runs, records and
resets through its desk as every station does (`PhysicsBenchStations.test.ts`, one closed form
written out per experiment, then every result against the model's theory);
`e2e/physics-benches.spec.ts` plays each one in the app (written, **not run** yet).

| Station (id)               | Apparatus, where                                                           | Desk / stand                   | Monitor · board (wall)                       |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| Buoyancy (`buoyancy`)      | `buoyancy-rig` on its desk's back right (6.05, 0.85, 11.95)                | (6.5, 11.75) / (6.5, 10.9)     | above the desk (x 6.5) · west of it (x 4.95) |
| Energy (`energy`)          | `energy-track` on a lab bench against the wall (8.65, 0.9, 11.8)           | (8.65, 10.9) / (8.65, 10.05)   | above the bench, y 1.6 · east (x 10.3)       |
| Collisions (`collision`)   | `air-track` on a lab bench (12.1, 0.9, 11.8)                               | (12.1, 10.9) / (12.1, 10.05)   | above the bench · east (x 13.75)             |
| Circular motion (`whirl`)  | `whirling-apparatus` on a lab bench 0.1 m off the wall (15.55, 0.9, 11.75) | (15.55, 10.9) / (15.55, 10.05) | above the bench · east (x 17.2)              |
| Reflection (`mirror`)      | `mirror-board` on its desk's back left (19.55, 0.85, 11.88)                | (18.9, 11.75) / (18.9, 10.9)   | above the desk · east (x 20.4)               |
| Converging lens (`lens`)   | `optical-bench` on a student bench (16.5, 0.9, 4.92), turned a quarter     | (16, 5.92) / (16, 6.77)        | north wall x 16.4 · x 15 (stand (14.4, 4.9)) |
| Electrical power (`power`) | `power-board` on its desk (19.01, 0.85, 4.61)                              | (18.5, 4.75) / (18.5, 5.6)     | above the desk · east (x 19.95)              |

- **Why there**: the main room is full; the range's north wall west of x 14.4 holds the first three
  benches. The south wall west of x 5.5 holds only the buoyancy board: any apparatus nearer than
  3.97 m to the projectile monitor's stand (2.2, 10.6) would take the HUD's nearest station from
  the launcher there. Nothing enters the projectile lane (z 7.25–9.25), a door band or the walk to
  the range; `stationZones.test.ts` keeps each apparatus' box and the e2e stand points clear.
- **Reach** (2.2 m): a monitor over a lab bench is out of reach from its desk; as the incline's
  beside its bench, it opens from the board's stand beside the bench: energy (10, 10.95), collisions
  (13.45, 10.95), whirl (17.2, 10.95); the lens' board and monitor from (14.4, 4.9). The wall
  between the benches holds the boards, so the monitors stay above them. Each desk and board stand,
  0.3 m either way, has its own station as the nearest (HUD, debug line, checklist):
  `PhysicsBenchStations.test.ts`. That is why the mirror board stands at its desk's east end.
- **The lens rail** runs from the lamp, nearest the desk, to the north wall, so the screen faces
  the player (quarter turns only: `stationZones.test.ts`); on a 1.2 m deep student bench, clear
  of its cup sink. The rail is 0.09 m from the north wall at full scale.
- **Full scale in `apparatusExtents.test.ts`**: a rig is drawn with each variable it `reads` at 1,
  or at its model's `fullScale` where 1 is not a pose it can take — the buoyancy rig's (a volume
  of 1 m³ would fill its cylinder 780 m high): the dials' largest, a 0.04 m copper cube lowered
  0.06 m (`registry.test.ts` checks them against `buoyancy.json`); and the air track's, where a
  glider's centre reaches 1.4 m (its layout's track less half a glider).

### Conservation of mechanical energy (`mechanical-energy`)

Model `mechanics.energy-track` (`simulation/models/energy.ts`), apparatus `energy-track`, topic
**conservation laws** (new, with collisions).

- **Principle and reference solution:** E = Eₖ + Eₚ, constant without losses (√(2gh) at gate A
  for any mass); with rolling resistance μ_r·N and quadratic drag ½ρ·C_d·A·v², ΔE is the work of
  those forces (Halliday ch. 8; Serway & Jewett ch. 8). Closed form with u = v² piece by piece
  (straight pieces and arcs), gate times by v = r·tan(θ₁ − ωt); the run is RK4 in time with steps
  cut on every joint and flag edge, losses integrated as work. μ_r 0.003, cart C_d·A 0.005 m²,
  sail C_d 1.17 are illustrative.
- **Dials:** h 0.10–0.30 m; m 0.25–1 kg; card sail none, 10, 15, 20 cm; timer d 0.1, 1, 10 ms.
  Desk rows: the 4 dials, g and the flag width w.
- **Results:** Eₚ₀, Eₖ_A, h′, kept % (classes), Δt_A, v_A = w/Δt_A, √(2gh), ΔE, Δt_B, v_B, E_B;
  both gate times read at d. Analysis: Eₖ_A against Eₚ₀. **Limits:** a point cart with massless
  wheels; constant μ_r and C_d; one pass (the run ends at the first turn on the far ramp); w/Δt at
  gate B is the mean speed over the flag (up to ~1 % low), shown as measured.

### Collisions and momentum on an air track (`collisions`)

Model `mechanics.collision`, apparatus `air-track`, topic **conservation laws**.

- **Principle and reference solution:** momentum conserved and Newton's restitution
  vB′ − vA′ = e·uA, B at rest: vA′ = uA(mA − e·mB)/(mA + mB), vB′ = uA·mA(1 + e)/(mA + mB);
  E_k′/E_k = 1 − (1 − e²)·mB/M. No friction or drag, so each step is exact; the gate timers sum
  steps landing on every card edge (= L/v). The run ends when B reaches the far buffer.
- **Dials:** m_A 0.2–0.5 kg (m_B 0.3 kg fixed); u_A 0.2–0.5 m/s; bumpers e 1, 0.9, 0.5, 0
  (Velcro); timer d. Desk rows: the 4 dials, m_B and the card length.
- **Results:** p, p′, E_k kept (classes Inelastic/Elastic), v_A′ (Bounces back / Stops / Moves
  on), v_B′, Δt₁, Δt₂ (read at d), E_k, E_k′. Analyses: p′ against p (slope 1) and E_k′ against
  E_k — the law itself, not independent measurements (their notes say so). **Limits:** instantaneous
  1-D impact, constant e, no rotation; v_A′ has no gate reading; one pass per gate.

### Uniform circular motion (`circular-motion`)

Model `mechanics.circular-motion`, apparatus `whirling-apparatus`, topic **dynamics**.

- **Principle and reference solution:** the whirling bung: tension M·g from the hanger; sin β =
  m/M, r = L·cos β, so M·g = m·ω²·L exactly, ω = √(M·g/(m·L)), T = 2π/ω (Serway & Jewett ch. 4
  and 6, the conical pendulum). Steady whirl only; the stopwatch times N = 10 turns.
- **Dials:** L 0.2–0.4 m; M 0.1–0.4 kg; m 30, 40, 50 g; stopwatch d 0.01, 0.1, 0.2 s.
- **Results:** T, ω, r, v, a, F, β (classes), t_N (read at d), M·g, T², ω². Analyses: T² against
  L and M·g against ω². **Limits:** no friction at the tube rim (a real lab's main error), drag,
  spin-up or string mass; results equal theory, only the stopwatch rounds.

### Density and buoyancy (`buoyancy`)

Model `mechanics.buoyancy`, apparatus `buoyancy-rig`, topic **fluids** (new).

- **Principle and reference solution:** Archimedes, F_b = ρ_f·g·V_sub (checked in the model's test
  by the pressure on the cube's faces); weighing in a fluid W′ = W − F_b, ρ = ρ_f·W/(W − W′)
  (Serway & Jewett ch. 14). The cube is lowered quasi-statically into an overflow can; the volume
  is also read as the overflow.
- **Dials:** cube polypropylene, nylon 6,6, aluminium, copper; liquid ethanol, water, sea water,
  salt water (CRC densities at 20 °C); a 0.02–0.04 m; force sensor d 0.01–0.1 N.
- **Results:** W and W′ (read at d), F_b, V, m, ρ, sink or float (classes). Analyses: F_b against V
  and m against V. **Limits:** no meniscus, rod volume, air buoyancy or liquid left on the cube;
  a rigid rod (floaters measured fully under); no measuring-cylinder resolution (four dials taken);
  V shows two significant figures (`formatResult`).

### Electrical power (`electrical-power`)

Model `electric.power` (composes `electric.dc-circuit`), apparatus `power-board`, topic
**electricity**.

- **Spec 12:** measure P = VI and show how changing the voltage or the current changes the power.
  Nothing else: the calorimeters first built here (water, thermometers, heat loss, Q against E)
  were removed as a spec deviation.
- **Principle and reference solution:** P = U·I = I²R = U²/R, P = P1 + P2 (Halliday ch. 26; SGK
  Vật lý 9 bài 12). The model adds no input or constant to the circuit model: it runs it
  unchanged (K closes at 0.5 s, the end at 3 s) and derives Pk = Uk·Ik, U² and the sign of
  P1 − P2 from its state; `power.test.ts` checks hand-worked values (12 V: 14.4, 4.8, 21.6 W) and
  P = U·I = P1 + P2 at every sample. R1 10 Ω, R2 20 Ω, aluminium-housed power resistors (at
  most 14.4 W each).
- **Dials:** circuit R1, series, parallel; U 3, 6, 9, 12 V; ammeter d.
- **Results:** P, I (read at d), P1, P2, the resistor that takes more power (classes), U, U².
  Analyses: P against I at one U (slope U: changing the current), P against U² for one circuit
  (slope 1/R_eq: changing the voltage). **Board:** supply, ammeter, voltmeter, switch K, R1, R2,
  link leads. **Limits:** ideal meters and supply, constant R (no heating); branch powers P1, P2 from the
  model (labelled so), not from moved meters.
- **Open:** placement `power-dial-thermometer` (lab-placements.json) dials a parameter that no
  longer exists and must be removed, with the placement counts in `stationZones.test.ts` and
  `consoleModel.test.ts`; until then content validation fails.

### Reflection from a plane mirror (`reflection`)

Model `optics.reflection`, apparatus `mirror-board`, topic **optics**.

- **Principle and reference solution:** i′ = i; the model reflects r = d − 2(d·n)n and measures
  the angles with atan2 (Hecht §4.3); turning the mirror by α turns the reflected ray by 2α (the
  optical lever). The ray box sweeps at 10 °/s.
- **Dials:** θ 15–60°; mirror α 0–15° (away from the ray box only); reading d 0.5–5°.
- **Results:** i, i′, i + i′, φ, each read at d. Analyses: i′ against i (slope 1) and φ against α
  (slope 2). **Limits:** an ideal front-surface mirror through the disc's centre; no brightness,
  ghost reflection or ray width.

### Converging lens (`converging-lens`)

Model `optics.thin-lens`, apparatus `optical-bench`, topic **optics**.

- **Principle and reference solution:** 1/u + 1/v = 1/f, k = −v/u, h′ = k·h (Hecht §5.2.3); the
  blur on a screen at s, b = A·|1 − s/v|. A run slides the screen from 0.05 m at 0.1 m/s and stops
  exactly where the image is sharp, or at the bench's end (virtual, or beyond the bench).
- **Dials:** f 0.10, 0.15, 0.20 m; u 0.08–0.60 m; scale d 1 mm–1 cm. Desk rows: 3 dials, h, L.
- **Results:** v, f, k (classes), h′, sharp (classes), s (read at d), b, 1/u, 1/v, u + v, u·v.
  Analyses: 1/v against 1/u (slope −1, intercepts 1/f) and u·v against u + v (slope f).
  **Limits:** an ideal thin lens, paraxial, one wavelength; no depth of focus of the eye.

## The Chemistry Lab's bench stations: titration, reaction rate, heating curve

The Chemistry Laboratory’s first three stations: an apparatus on its bench and an instruction
board. E at the apparatus (`open-workspace`) opens its workspace: the titration and the reaction
rate are `2d-workspace` (library, bench with pieces, notebook; setup steps gate RUN), the heating
curve `bench-embedded` (controls beside the 3D rig). They have no desk, dials, RUN / STOP / RESET
buttons, desk display or wall monitor: each control sits at the piece that owns it (design:
[experiment-workspace-design.md](experiment-workspace-design.md)). Chemistry’s units: mL, mol/L,
°C (CLAUDE.md).

| Station       | Apparatus (placement)                                                   | Where the player stands | Board                      |
| ------------- | ----------------------------------------------------------------------- | ----------------------- | -------------------------- |
| Titration     | `titration` on the west island’s south half (−2.6, 0.9, 1.3)            | (−3, 2.6)               | south wall corner (x −4.4) |
| Reaction rate | `kinetics` on a lab bench against the north wall (−2.65, 0.9, −3.5)     | (−2.65, −2.5)           | north wall (x −1.55)       |
| Heating curve | `heating` on its lab bench, in front of the fume hood (3.55, 0.9, −2.6) | (3.4, −1.6)             | east wall (z 0.1)          |

The PPE sign moved up (y 2.1); the lab's sign, its hub door and the
island benches no longer say the lab has no experiments. `stationZones.test.ts` keeps each
apparatus' box, the e2e stand points and the walk in from the hub door clear. Each board stands
where its station is the nearest (the HUD and the debug Station line follow the nearest station).
A piece's callout lists the shown inputs as fixed in the model (Q; k₂₅ and Eₐ; L_f and c_w; the
titration's c_a is `hidden`: the student works it out); every other constant is declared in
`inputs` with `"desk": false`, so the results panel and CSV show it with its symbol and unit (K_w;
T₂₅, ε, l, c_end/c₀; c_ice, L_v, T_melt, T_boil, f) and the callout does not.

### Acid–base titration (`acid-base-titration`)

Model `acid-base.titration` (`simulation/models/titration.ts`), topic **acids-and-bases**. Since
Phase B a `physical-lab` bench (`docs/phase-b-chemistry-contract.md`): the retort stand
`tit-retort-stand` (bench model `retort-stand`, its clamp and tile) at (−3, 0.9, 1.15), the
burette, the conical flask, the pipettes, the bottles and the dropper bottles as entities. The run is
driven by the tap: V is the base that has run out of the burette (`drive.feed: added`, at the
model's `flowRate`); the player closes the tap and records the reading (end reason `player`), so
overshooting shows in V_end. The 2D `titration-stand` rig and workspace stay in the code (the way
back, contract §10) and in the 2D workspace tests' fixtures. What follows describes the model.

- **Principle and reference solution:** HCl (c_a fixed, hidden: the student works it out) in the flask, NaOH
  from a burette at Q = 0.25 mL/s. Both dissociate fully, volumes add, activities are
  concentrations; the pH at V comes in closed form from the charge balance
  [H⁺] + [Na⁺] = [Cl⁻] + [OH⁻], K_w = 1.0·10⁻¹⁴ (25 °C). Equivalence V_eq = c_a·V_a/c_b
  (pH 7); the run stops exactly where the pH reaches the indicator's endpoint,
  V_end = V_a·(c_a − D)/(c_b + D), D = 10^−pH − K_w·10^pH, the station test's oracle.
- **Settings (presets only):** pipette V_a 10, 20, 25 mL; c_b 0.05, 0.1, 0.2 mol/L; indicator methyl
  orange (endpoint pH 4.4, its fully yellow end) or phenolphthalein (8.2); burette resolution d
  0.05, 0.1 mL. None is refused: every corner reaches its endpoint below 50 mL (the model refuses
  an endpoint outside the start pH and the excess-base limit).
- **Results:** V_end (the model's endpoint and V_eq theories, the indicator error −0.13 % to
  +0.005 % over the presets, are withheld while c_a is hidden), the pH at the endpoint,
  c_a = c_b·V_end/V_a (an answer: never shown, checked in the results panel). The burette reads
  V_end to d (mL). Graph: pH against V (its V_eq mark withheld likewise).
- **Stand:** retort stand, 50 mL burette (9 mm per mL), stopcock, 250 mL conical flask on a white
  tile, the flask's colour from the indicator's transmittance at the live pH, drops while running.
  **Limits:** no activity coefficients, CO₂ or temperature dependence, no drop size or
  overshoot; the tap closes itself (the player does not judge the colour); a strong acid only
  (ethanoic acid needs another model). c_a is computed from the unrounded volume.

### Reaction rate: crystal violet fading (`reaction-rate`)

Model `chemistry.first-order-kinetics` (`simulation/models/kinetics.ts`), apparatus `colorimeter`
(`bench/colorimeter.ts`), topic **reaction-kinetics**.

- **Principle and reference solution:** CV⁺ + OH⁻ → CVOH, with [OH⁻]₀ ≥ 100·c₀ pseudo-first
  order: c = c₀·e^(−k′t), k′ = k(T)·[OH⁻]₀, Arrhenius k(T) = k₂₅·exp((Eₐ/R)(1/T₂₅ − 1/T)),
  k₂₅ 0.1 L/(mol·s), Eₐ 60 kJ/mol (approximate literature values); Beer–Lambert A = ε·l·c, ε
  1.0·10⁷ L/(mol·m), l 1 cm. Closed form in t; the run ends exactly when a quarter of the dye is
  left (two half-lives).
- **Settings (presets only):** c₀ 2, 5, 10 µmol/L (A₀ 0.2–1); [OH⁻]₀ 0.1, 0.15, 0.2, 0.25 mol/L;
  bath θ 20, 25, 35, 45 °C; timer resolution d 0.1, 1, 5 s. None is refused (the model refuses
  [OH⁻]₀ < 100·c₀, A₀ > 2 and an end absorbance below 0.001); runs last 12–209 s.
- **Results:** A₀, k′ = ln(A₀/A)/t, t½ (classes Fast ≤ 20 s, Moderate ≤ 60 s, Slow; the presets
  give 6–105 s, so each class is reached), A and c at the end, ln(k/k₂₅) and 1/T₂₅ − 1/T. The timer reads t½ to d. Analyses: k′ against [OH⁻]₀ at one
  θ (slope k), ln(k/k₂₅) against 1/T₂₅ − 1/T at one [OH⁻]₀ (slope Eₐ/R). The trace is noiseless, so
  simulated and theory agree to ~1e-12: the comparison checks the pipeline, not an experiment.
- **Colorimeter:** 590 nm, cuvette tinted by its transmittance 10^−A, LED readout of A, a water
  bath showing the set θ, a timer with a half-life mark. **Limits:** ionic strength, the dye's
  purity, bath drift and colorimeter noise are not modelled.

### Heating curve of water (`heating-curve`)

Model `thermal.heating-curve` (`simulation/models/heating.ts`), apparatus `hot-plate`
(`bench/hot-plate.ts`), topic **states-of-matter**.

- **Principle and reference solution:** a constant net power P into the beaker, Q = P·t; the
  stages in closed form: ice warms (m·c_ice·ΔT/P), melts at 0 °C (m·L_f/P), water warms to
  100 °C (m·c_w·100 K/P), boils until 5 % is gone (0.05·m·L_v/P). c_ice 2100 J/(kg·K), L_f
  334 kJ/kg, c_w 4180 J/(kg·K), L_v 2257 kJ/kg (textbook values from the CRC Handbook); `step`
  stops on every corner, so each stage's stopwatch is exact.
- **Settings (presets only):** P 200, 500, 800 W; m 0.05, 0.07, 0.1 kg; T₀ −20, −10, −5, 0 °C;
  stopwatch d 0.01, 0.1, 1 s. None is refused (the model refuses T₀ below −30 °C or above the
  melting point); runs last 54–453 s.
- **Results:** the four stage times, the time to 100 °C, the end temperature, Q, the mass boiled
  away and left, the end state (classes Solid ice / Melting / Liquid water / Boiling). The
  stopwatch reads t_f and t_b to d. Analyses at one P: t_f against m (slope L_f/P), t₂ against m
  (slope c_w·100 K/P).
- **Hot plate:** a hot-plate stirrer, 250 mL beaker of crushed ice (chunks by the ice fraction),
  meltwater level, bubbles and steam while boiling, a −30…110 °C thermometer column. **Limits:**
  stirred contents at one temperature, no heat to the glass or air, no evaporation below 100 °C,
  constant heat capacities per stage: a real curve has rounded corners and tilted plateaus.

## The dilution slice: the physical lab (`dilution`)

The first experiment of the **physical lab** (`presentation: "physical-lab"`, design:
[physical-lab-architecture.md](physical-lab-architecture.md) §3): done by hand with objects in the
3D Chemistry Lab, with no workspace, no desk and no RUN button. Model `chemistry.dilution`
(`simulation/models/dilution.ts`), apparatus `dilution-colorimeter`
(`bench/dilution-colorimeter.ts`), topic **solutions**. Chemistry’s units: mL, mol/L (CLAUDE.md).
Spec §12 (line 559): “choose stock solution; choose volume; add solvent. Calculate: C₁V₁ = C₂V₂.
Show resulting concentration.”

**What the player does** (E grabs and sets down, F puts a stopper in or takes it out, the pour key R
or the right mouse button held to pour, squeeze or turn over): open the reagent cabinet; take a stock
bottle (5.00, 10.0, 20.0 or 40.0 µmol/L), a volumetric flask (25, 50, 100 or 250 mL) and a volumetric
pipette (1, 2, 5 or 10 mL) out one at a time; stand the flask on the white tile; aim the pipette at
the bottle (E: it fills to its mark) and at the flask (E: it delivers); hold the wash bottle’s nozzle
over the flask’s neck and squeeze until the mark; put the stopper in, turn the flask over, take the
stopper out, tilt a sample into the colorimeter’s cuvette; read C₂ on the results monitor; **Clear
the bench** puts everything back, full again, for the next glassware. The glassware taken _is_ the
setting: a material (`workspace.materials`) sets its parameter when it is used, and a finished step
locks it until the bench is cleared. The one dial is the colorimeter’s resolution d.

**The run is the pour.** Adding water is not a setup step (RUN would wait for it): the first accepted
µL of water into the flask starts the run, `workspace.drive: {place: "water", onto: "flask"}`. The
model runs in its _driven_ mode: the volume in the flask (whole µL, kept by `StationSystem`) is fed to
`dilutionModel.driven.set`, so at V₂ the state is the theory’s, bit for bit. A pause (letting go of
the squeeze) neither ends the run nor times it out; at the mark the flow stops and the run completes
with end reason `model` (“It is full to the mark.”). `fillTime` is not used and is shown nowhere. The
inversion is the definition’s `mix` step (`by: "invert"`): it gates the cuvette step and changes no
number — the model takes the solution as mixed at every moment. RESET discards the run (the setup
stays); _Clear the bench_ restocks every container as placed and sends it home.

| Part                    | Items and placements (`chemistry-lab`)                                                                                                                                | Notes                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Reagent cabinet         | `chem-reagent-cabinet` at (2.7, 0, −1.3), facing west: the wardrobe’s hinged pattern, `prop: "reagent-cabinet"`, copied from `reagentCabinetLayout([1.2, 1.9, 0.5])`  | holds only the 13 glass items below; `reagentCabinet.test.ts` refuses anything else                                              |
| Glass, 13 dynamic items | 4 `dil-stock-*` and the wash bottle on shelf 1, 4 `dil-flask-*` on shelf 2, 4 `dil-pipette-*` on shelf 3                                                              | `handling: "upright"`: held upright, only set down, never dropped                                                                |
| Bench apparatus         | `dilution` (`dilution-colorimeter`, −0.35, 0.9, −1.7) with the cuvette as its receiver-only container; `dilution-tile` (`dil-tile`, the seat `tile`, −0.6, 0.9, −1.7) | the tile is its own item: an apparatus’ box is its interaction box, and one over the tile would be aimed at instead of the flask |
| Pipette rack            | `pipette-rack` (`dil-pipette-rack`), four seats                                                                                                                       | a place to stand pipettes upright                                                                                                |
| Controls                | `control-dial` (`concentrationResolution`), `reset-button` (RESET), `reset-button` (`clear`: Clear the bench)                                                         | on the main bench; no desk                                                                                                       |
| Monitor and board       | `results-monitor` and `dilution-instructions` on the north wall                                                                                                       | read from behind the bench                                                                                                       |

The player stands pressed against the main bench (z −0.79): the tile is then 0.91 m and the cuvette
0.99 m away, and the hold point is 1 m along the view, so the nozzle (or a tipped flask’s lip) goes
over the mouth by the view alone, from up to about 0.3 m to the side. `src/game/dilutionSlice.test.ts`
plays exactly this with real Rapier, and the e2e spec uses the same arithmetic.

**Sources.** SPEC: §12 above (choose stock, choose volume, add solvent, C₁V₁ = C₂V₂, show the
concentration). DEF (the Chemistry agent’s draft and its NOTES): crystal violet at 5/10/20/40 µmol/L
in a 0.07 Ø × 0.14 m bottle whose label shows C₁; 1/2/5/10 mL volumetric pipettes with a filler;
25/50/100/250 mL volumetric flasks on a white tile; a wash bottle of distilled water; a colorimeter at
590 nm with a 12.5 mm cuvette; “stoppered and inverted”. The model, results, graphs, analyses and
instrument are the draft’s, unchanged; its guided procedure, `note` and instruction board are
rewritten for the physical flow (EN and VI).

**SPEC GAPs and AFFORDANCES** (labelled so in the data; none is a model input):

- _The cabinet is the user’s direction, not the spec_ (G1). It holds only what the definition lists.
- _Bookkeeping volumes_: the stock bottle’s 150 mL and the wash bottle’s 500 mL (placement `fill`,
  with `fillNote: "AFFORDANCE: bookkeeping volume, in no definition"`) and the cuvette’s 2.7 mL
  capacity. Chosen so every preset combination can be run several times (a 10 mL pipette fifteen
  times from one bottle) and the pour reaches the mark; Clear the bench restocks them.
- _Glassware sizes and masses_: IMPLEMENTATION ASSUMPTIONS (a school lab's usual proportions),
  drawn so each piece is recognised (graphics-fidelity audit, 2026-11-02). The flasks’ profiles are
  `platform/labVisuals/chemistry.ts` `FLASKS`; the stock bottle is a lathe of the draft’s size; the
  pipettes are bulb pipettes (tapered tip, lower stem, bulb, upper stem) whose profile holds V₁
  exactly at the mark on the upper stem, with a 20 mm pick box, wider than the glass, so they can be
  aimed at; the wash bottle is a 0.19 m polyethylene bottle (550 mL to its brim) whose delivery tube
  ends at the pour's spout, 34 mm ahead of its axis: picked up, it is held with the nozzle ahead
  (`PhysicsSystem.grab`). Print (capacity, 20 °C), labels, caps and stoppers are drawn from
  `container.vessel` (`render/vessels.ts`); none is a model input. The masses (`massNote`:
  “physics only”) are guesses that nothing reads; no definition gives them.
- _Pour rates_: wash bottle 15 mL/s, flasks 4 mL/s at full tilt (pacing, never a model input).
- _Capture radii_: 20 mm over a flask’s neck, 15 mm over the cuvette, 30 mm over a stock bottle:
  provisional aim help, to be set from a manual player session (time to hit a 5 mm mouth).
- _The method of sampling into the cuvette_: the definition says only “a sample is read”; a tilt pour
  is the affordance. The volume that goes in changes no reading (Decision 7).
- _One inversion_ counts as mixing; the 150°/30° thresholds are pacing (Decision 12).
- _No overflow, spill, meniscus or filling past the mark_ (G9), _no pipette technique_ (G10): a
  delivery is exact. Stirring with a rod is not in the slice (spec map: none).
- _A part-filled flask after Continue is drawn clear_: runs are never in the save, so a flask of
  stock and water has no model state to colour it (`liquidAppearance.ts` computes no concentration
  from the contents). Known limitation; Clear the bench restocks it.

**Tests.** Content: `src/game/content.test.ts` (the shipped content builds, with the physical-lab
checks of `game/content.ts`), `src/game/reagentCabinet.test.ts`, `src/world/layout.test.ts` (P4: a
cabinet is hollow, its carcass and doors are the solids), `src/world/stationZones.test.ts`,
`src/physics/layoutSweep.test.ts`. Game level with real Rapier: `src/game/dilutionSlice.test.ts` (the
glass rests on the shelves and can be aimed at only once the doors are open; two dilutions by hand,
20 µmol/L / 5 mL / 50 mL and 40 µmol/L / 10 mL / 25 mL, the second poured from 0.3 m to the side;
mixing changes no number; clearing restocks). End to end, player-like and **not yet run**:
`e2e/physical-lab.spec.ts`.

## The Biology Lab's bench stations: microscope, osmosis, enzyme activity, photosynthesis

The Biology Laboratory's first four stations: an apparatus on its bench and an instruction board.
E at the apparatus (`open-workspace`) opens its workspace; there is no desk, dial, RUN / STOP /
RESET button, desk display or results monitor in the room (design:
[experiment-workspace-design.md](experiment-workspace-design.md)). The microscope is
`microscopy`, osmosis and enzyme activity `2d-workspace`, photosynthesis `observation`. Units
(CLAUDE.md): the wet-lab ones use mL, mol/L, g, kPa and °C; the microscope states lengths in µm
and the field number in mm.

| Station         | Apparatus (placement id)                       | Run button |
| --------------- | ---------------------------------------------- | ---------- |
| Microscope      | `digital-microscope` on its own bench          | Observe    |
| Osmosis         | `osmosis` on a lab bench against the west wall | Soak       |
| Enzyme activity | `enzyme` on the wall bench                     | Start      |
| Photosynthesis  | `photosynthesis` on the lab bench's east half  | Start      |

The island stays free and so does the door's band (`doorBands.test.ts`). The lab bench's plain
`microscope` is kept as it was: the Biology Lab's one grabbable object (the hold, inventory and
inventory e2e tests pick it up), not the station's apparatus; the display microscopes stay decor.
`stationZones.test.ts` keeps each apparatus' box, the e2e stand points and the walk in from the
hub door clear. The microscope's desk was its only support, so it stands on a `microscope-bench`
(y 0.9). Every constant that is not a setting is in `inputs` (`"desk": false` where the piece
does not show it). The Vietnamese preset labels use decimal commas, as the Chemistry Lab's.

### Observing cells under the microscope (`microscope`)

Model `biology.microscope` (`simulation/models/microscope.ts`), apparatus `digital-microscope`
(`bench/digital-microscope.ts`), topic **cells**.

- **Principle and reference solution:** bright-field geometry, not image formation. M =
  M_eye·M_obj (10× with 4×, 10×, 40×); FOV = FN/M_obj (FN 18 mm: 4.5, 1.8, 0.45 mm); depth of
  field λ/NA² (λ 0.55 µm, NA 0.10, 0.25, 0.65: 55, 8.8, 1.3 µm); a sharpness index
  1/(1 + (2Δz/d)²) at the stage's offset Δz; contrast from a stated slide × stain table. A student
  counts ⌊FOV/L⌋ whole cells (L 250, 60, 80 µm) only in an image sharper than 0.1 with contrast
  above 0.25, else none; the length from the count is FOV/n. A run is the fine focus lowering the
  stage at 20 µm/s from +100 µm to Δz (at most 10 s).
- **Settings (presets only):** slide onion epidermis, cheek cells, Elodea leaf; stain none, iodine,
  methylene blue; objective 4×, 10×, 40×; Δz 0, ±1, ±2, ±5, ±10, ±20, ±50, ±100 µm (50 µm at
  first). None is refused. The onion slide is made in steps (spec 21): a clean slide on the tile,
  the onion, a stain, the coverslip (each `when` the slide is the onion), then every slide goes on
  the stage. Cheek cells and the Elodea leaf are prepared slides: only the stage step applies and
  their stain stays the player's choice (SPEC GAP: the shipped choices are kept, flagged, until the
  stain protocol per specimen is decided). The specimen step, the stain step and the stage step
  `lock` their settings (below): another slide or stain needs **Clear bench**.
- **Results:** M, FOV, the depth of field, the sharpness (Out of focus / Slightly blurred /
  Sharp), the contrast (Faint / Weak / Clear), n (None / Few / Many) and FOV/n against the true L
  — 0 against 0 when nothing is counted, never a 100 % error. No instrument, no analysis. The
  checklist starts by inspecting the microscope itself and has no reset step.
- **Microscope:** a camera on the eyepiece feeding its 7-inch monitor (the circular field, blur in
  levels, a scale bar), the nosepiece turned to the objective, the slide's tint, the fine focus
  turning. **Limits:** the picture illustrates the true scale; the count is the model's, not read
  from it; `ctx.filter` blur needs Safari 18+ (the results still class the focus).

### Osmosis in potato tissue (`osmosis`)

Model `biology.osmosis` (`simulation/models/osmosis.ts`), apparatus `osmosis-rack`
(`bench/osmosis-rack.ts`), topic **membrane-transport**.

- **Principle and reference solution:** the solution's water potential Ψ = −i·C·R·T (ideal van 't
  Hoff, i = 1 for sucrose); the tissue starts at Ψ_iso = −C_iso·R·T (C_iso 0.25 mol/L) and rises
  by E·u with its mass change u = Δm/m₀ (E 5000 kPa, an effective constant); water follows the
  difference, so u = u_eq·(1 − e^(−t/τ)), u_eq = R·T·(C_iso − C)/E, τ 2700 s, θ 20 °C. Each step
  is the exact exponential; time is compressed 240× (a 4 h soak in 60 s).
- **Settings (presets only):** C 0, 0.2, 0.5, 1 mol/L (0.4 until first turned); the soak 30 min,
  1 h, 2 h, 4 h; m₀ 2, 3, 5 g; balance resolution d 0.001, 0.01, 0.1 g. None is refused (the model
  refuses a loss over 80 % or a gain of 100 %: the dials give −36.6 % to +12.2 % at equilibrium).
- **Results:** Ψ_solution, the mass after soaking (the balance reads it to d), Δm/m₀ and the net
  flow (Loses water / No net change / Gains water). Analysis: Δm/m₀ against C over runs of one
  soak, slope −100·R·T·(1 − e^(−t/τ))/E; the line crosses 0 % at C_iso = −b/a. The theory line
  the analysis draws is the model's own line: slope `percentSlope`, intercept `percentIntercept`.
- **Rack:** boiling tubes (the labelled one shows C), a top-pan balance with its readout, the
  potato cylinder sized by its mass (floating while lighter than the solution), a timer.
  **Limits:** linear tissue; the ideal Ψ (real sucrose is 15–40 % more negative at 0.5–1 mol/L);
  temperature only through R·T; one rate for every cylinder.

### Enzyme activity (`enzyme-activity`)

Model `biology.enzyme-kinetics` (`simulation/models/enzyme.ts`), apparatus `gas-syringe-rig`
(`bench/gas-syringe-rig.ts`), topic **enzymes**.

- **Principle and reference solution:** catalase on H₂O₂, Michaelis–Menten
  v = V_max·S/(K_m + S), K_m 0.1 mol/L, V_max = a·E·f_T·f_pH (a 0.01 mol/(L·s) per mL of
  extract); f_T = g(T)/g(T_opt), g = Q₁₀^((T − Tm)/10)/(1 + e^((T − Tm)/w)), Q₁₀ 2, Tm 41 °C,
  w 3 °C (T_opt 37.0 °C); f_pH = exp(−(pH − 7)²/(2·1.5²)). Each step solves the integrated law
  K_m·ln(S₀/S) + S₀ − S = V_max·t; O₂ = ½·ΔS·V_mix·V_m (5 mL, 24.06 L/mol); the run ends on 60 s,
  the reading window on 10 s.
- **Settings (presets only):** S₀ 0.05, 0.1, 0.5, 1 mol/L; T 20, 30, 40, 50 °C; pH 4, 6, 7, 8, 10
  (pH 7 reaches Near the optimum, 0.91 at 40 °C); E 0.5, 1, 1.5, 2 mL. None is refused; even all of 1 mol/L broken down gives
  ½·1·5·24.06 = 60 mL, under the 100 mL syringe.
- **Results:** v₀ (the model's rate at t = 0, no theory), O₂ and the mean rate v̄ over the first
  10 s, O₂ and the share broken down after 60 s, the activity f_T·f_pH (Almost inactive / Low /
  Moderate / Near the optimum), 1/S₀ and 1/v̄ (for a Lineweaver–Burk plot by hand or from the CSV:
  no analysis, as its line has an intercept). Analysis: v̄ against E at one S₀, T and pH, theory
  slope v₀/E (at 30 °C, pH 6 the fitted slope is 0.7 % below it at 1 mol/L, 2.4 % at 0.5, as v̄
  lags v₀; 21 % at 0.1 and 32 % at 0.05, so the board and note say to use 0.5 or 1 mol/L). No instrument: a resolution would be one more setting.
- **Rig:** a water bath with its readout and thermometer, the boiling tube with its bung, the
  extract syringe, a 100 mL gas syringe whose plunger follows the oxygen, bubbles on the rate, a
  stopwatch. **Limits:** reversible, instant denaturation; no inhibition, no dissolved O₂; not
  fitted to real catalase data.

### Rate of photosynthesis (`photosynthesis`)

Model `biology.photosynthesis` (`simulation/models/photosynthesis.ts`), apparatus
`pondweed-lamp` (`bench/pondweed-lamp.ts`), topic **photosynthesis**.

- **Principle and reference solution:** I = 10 000 lux·(0.1 m/d)² (a point lamp);
  P = 1/(1/(α·I) + 1/P_c) (a rectangular hyperbola), α 2·10⁻⁶ mL/(s·lux),
  P_c = P_max·C/(C + K_C)·f(T), P_max 0.01 mL/s, K_C 0.005 mol/L, f(T) Q₁₀ 2 up to 30 °C, a
  straight fall to 0 at 45 °C. V = P·t over 60 s (real time), bubbles of 0.01 mL. The constants
  are the model's (`PHOTOSYNTHESIS`); only the collection time is content.
- **Settings (presets only):** d 0.05, 0.1, 0.2, 0.4 m; NaHCO₃ 0.002, 0.005, 0.01, 0.05 mol/L;
  T 10, 20, 30, 40 °C (25 °C until first turned); the capillary's δV 0.01, 0.05, 0.2 mL. None is
  refused.
- **Results:** I, d², V (the capillary reads it to δV), N, P = V/t, 1/P and the limiting factor
  (Light while α·I < P_c, else the smaller of the CO₂ and temperature factors). Analysis: 1/P
  against d² at one C and T: slope 1/(α·I_ref·d_ref²) = 5000 s/(mL·m²) exactly, intercept 1/P_c
  (`inverseRateIntercept`); the drawn theory line has both.
- **Apparatus:** the sprig under a funnel in a beaker, the graduated capillary, a heat filter, a
  thermometer, the lamp sliding along a rule to d. **Limits:** gross O₂ (no respiration), steady
  state at once, a point lamp.

## Frame rate and timing (Phase 6C.1)

The run is physical time, not frames. `ExperimentRuntime` advances in the definition's fixed step
(1 ms) through its own accumulator; a frame's length only decides how many steps run in that
frame, never their size. Samples are taken on simulated time (every 10 ms), the landing is
solved inside its step, and the ball is drawn at the model state each frame — so the same
configuration gives bit-identical samples, results, final state and landing point at any frame
rate. `main.ts` caps a frame at 0.1 s: at 10 fps and above a run takes its real flight time; below
10 fps it plays slower (a slideshow of the same run), never differently. The physics catch-up
(6 × 1/60 s per frame) is the game world's (player, loose objects); a flying ball is not Rapier's.

Checked by a game-level test (Moon example through `Game.update` at 300, 60, 30, 20, 15 and 10 fps
and a jittery mix: bit-identical, real-time pace) and in the browser on the GPU by `npm run bench`
(the game given 300 … 5 fps: identical results to three decimals, 454 samples each). Cost: about
0.05 µs per model step on the CPU — a whole 4.5 s flight is 0.2 ms.

The pendulum uses the same runtime, so the same holds (Phase 6C.2): a game-level test (L 0.5 m,
θ₀ 40°, through `Game.update` at 300, 60, 30, 20, 15 and 10 fps and a jittery mix with 0.1 s
frames) gives bit-identical samples, results and end state, each run taking its three periods of
game time.

## Playing it

Physics Lab → through the opening in the south wall → projectile range:

1. Read the board (Inspect) · 2. take a ball from the cart (E) and, holding it, look at the
   launcher: E loads it · 3. at the desk the dials set v₀, θ and g (E raises, F lowers); the barrel
   turns with θ · 4. RUN (green), STOP (red), RESET (amber) · 5. the results monitor shows the
   trajectory; E opens the full results (looking away closes them).

Physics Lab → through the opening in the north wall → pendulum bay:

1. Read the board on the west wall · 2–3. at the desk set L, θ₀ (and g) — the bob is drawn at
   the release angle · 4. RUN: three full swings · 5. the monitor on the east wall shows θ–t; E
   opens the results (the mouse wheel scrolls them) · 6. RESET, change a setting, run again.

Physics Lab, main room, south-east corner → free-fall tower:

1. Read the board on the south wall · 2. at the desk set h (and g, d): the clamp and the ball
   move to h · 3. RUN: the ball drops; STOP freezes it, RESET puts it back in the clamp · 4. the
   monitor on the east wall shows y–t; E opens the results.

The HUD objective follows the checklist (`procedure`) of the station in the player's room;
refusals appear under the prompt and as a notice.

## Run history, comparison and CSV (Phase 6C.3)

The data of a run goes one way, and nothing goes back:

```
configure ─RUN─► running ─ends─► RunRecord in the session's history ─► list · view · compare · CSV
  (dials)        (the live      (completed, stopped or failed;         (read only, from the
                  runtime)       frozen once, when it ends)             record's own data)
```

**Recording.** `ExperimentSession` freezes every run that ends into its `history` (oldest
first), once, at that moment: completed, stopped by STOP, cut short by RESET or by leaving the
scene, or failed. The `RunRecord` (`simulation/RunRecord.ts`) holds:

- the run id, station and number (`#3`), the definition;
- **the inputs that produced it** (a copy: parameters, initial conditions, apparatus inputs);
- **its theory**, evaluated once for those inputs and kept — never recomputed from later dials;
- its results (completed runs only: a stopped or failed run claims none), its status, end
  reason or error, and the simulated time it reached;
- **copies of its valid samples** (the run's own buffers are sized for the longest run).

The record, its inputs, results, theory and buffer list are frozen; JavaScript cannot freeze a
typed array's contents, so the record keeps private copies no code writes to (tests compare them
before and after new runs, dial changes, graphs, tables and exports). There is no wall-clock time
in a record: runs are identified by station and number, and exports stay deterministic.

**Current run and history.** After a run ends it is both the session's current run (what the
monitor and status screen show) and the newest record. RESET clears the current run, not the
history. A run that is still running is not in the history yet.

**Reading the results** (Phase 6C.5):

- "Read the results" opens the panel while the station has a current run **or** kept runs. After
  RESET, the panel shows "No current run…" and the run list, so kept runs can be ticked.
- With neither it is refused: "No results yet: run the experiment first." That is the case
  before the first run (after Continue too, since Phase P2b, kept runs open the panel).

**The status screen** keeps what the dials say apart from what the run shown used:

- A dial turned since that run is drawn in amber.
- The footer names the run's own settings: "The run shown used g Earth, d 0.01 m. RESET, then
  RUN with the new settings."
- The results column is laid out from measured text widths: values a gap after the widest
  label, inside the screen and clear of the settings.

**Bound.** `RUN_HISTORY_LIMIT` = 20 records per station; the oldest goes first. The current
run, once ended, is the newest record, so it is never the one dropped. Measured sizes (only the
recorded samples are kept): a pendulum run at 1 m and 30° is 44 kB (20: 0.9 MB); the longest the
dials allow (3 m, 60°, Moon, 27.5 s) is 198 kB (20: 4.0 MB); a projectile run is 6–58 kB.

**Kept, not saved** (Phase P2b). The history survives scene changes and leaving the room, and
since P2b also New game, Continue and a reload: ended runs are kept in the run history store
(IndexedDB), apart from the save, and go back to their stations; run numbers go on after them.
The save format is unchanged and holds only station settings (tested: no run data in the save).

**In the results panel** (E at the monitor): the run list beside the results, newest first —
"#3 · L 1.5 m · θ₀ 30 ° · g Earth", the first measured quantities ("T 2.5 s · θmax 0.5236 rad")
or how it ended, a `current` badge on the current run, `stopped`/`failed` on incomplete
ones. Ticking runs (completed ones only):

- **none:** the current run, live, as before;
- **one:** that run in its place, marked `recorded`, with the dials' present settings named
  for contrast;
- **two to four:** a comparison — a legend naming each run by what differs ("#1 · L 1 m"), a
  table of each run's settings and results with **its own theory**, and overlays of the graphs
  the definition lists in `compare` (projectile: trajectory, height–time; pendulum: θ–t, ω–t,
  the phase portrait, total energy). Each line is a run's own samples, in its own colour and
  dash; each run's theory value (range, exact period) is a dashed vertical line in its colour.

A fifth box is disabled (dimmed, "Compare at most 4 runs.") while four are compared. Below
760 px wide the panel stacks — run list on top, results below, each scrolling — which keeps every
control reachable down to phone widths, though the game itself needs a keyboard and mouse.

Each row has a **CSV** button. The mouse: Esc frees it; the run list takes clicks and the rest of
the panel lets them through to the view (click the view to look around again). The keyboard:
Tab, Space and Enter work on the list. The wheel scrolls the results, also while the mouse is
captured.

**CSV** (`simulation/csv.ts`, file `simlab-pendulum-run-003.csv`): `#` lines first —
experiment and model, run, status (completed after t, or stopped/failed: incomplete, no
results), each parameter and input with its unit, each theory value, each result with the theory
it is compared with, the sampling, a description of each column — then a header row and one row
per recorded sample: `time_s` and every measurement (`x_m`, `vx_m_s`, `theta_rad`,
`alpha_rad_s2`, `energy_J`, …), written as JavaScript's shortest round-trip form of the stored
doubles, so every value reads back exactly. Measurements in radians also get a degrees column
(`theta_deg`, converted on export). CRLF line ends (RFC 4180), UTF-8 without BOM; the column
names are ASCII. Nothing varies between exports of a run: no export time. The browser's own
download saves it; nothing leaves the machine. Phase 6C.4 adds the instrument readings (next
section) as more `#` lines; no column changed.

## Data analysis: a table of runs and a fitted line (Phases 14B, 14C)

An experiment whose definition has `analyses` gets, on its results monitor, **Analyse the runs**:
its completed runs in one table and a straight line fitted through them, one way per analysis,
chosen in the panel. Each run is one point, read from its own record (`RunRecord`: its inputs,
results and samples, frozen when it ended), never from the current dials; nothing is saved.

```json
"analyses": [{
  "id": "period", "title": "Period squared against mass",
  "x": "mass", "y": "oscillation.periodSquared",
  "group": ["stiffness", "damping"],
  "columns": ["mass", "offset", "oscillation.period", "oscillation.periodSquared"],
  "slope": { "label": "Slope of T² against m", "symbol": "a", "unit": "s²/kg",
             "theory": "periodSquaredSlope" },
  "derived": { "label": "Stiffness lowered by damping, 4π²/a", "symbol": "k(1 − ζ²)",
               "unit": "N/m", "numerator": 39.47841760435743, "theory": "dampedStiffness" }
}]
```

- `x`, `y`, `columns`: a result, else a parameter or shown input, else a quantity measured from
  the run's samples (`oscillation.period`, `oscillation.periodSquared`; needs `oscillation`).
- `group`: parameters; only runs with the same values are fitted together (one spring, one ζ),
  chosen in the panel. Runs of different setups are never fitted as one line.
- `slope.theory`: the model prediction the slope is compared with, drawn as the reference line
  y = slope·x through the origin, or y = slope·x + b when `slope.intercept` names the model's
  prediction of the intercept b. `derived`: a value the slope gives, `numerator`/a, against the
  prediction `derived.theory`, its standard error carried from the slope's; only from a positive
  slope (else "not defined", never a negative or infinite value). All checked when the lab pack
  loads (and by the content tests).
- `note`: what this analysis' numbers mean, under the fit.

**Which runs.** Completed runs only: a stopped run never came to an end and has no results. A run
cut off by the time limit is listed but cannot be ticked, nor can one with a non-finite value, nor
one whose swing was too short to time (`not-measured` — never an invented period). Every other run
is used until the player unticks it; the choice is kept per analysis while the scene is loaded.

**The fit** (`simulation/fit.ts`, no DOM, three.js or Rapier; `analysis.ts` builds the rows):
ordinary least squares, y = a·x + b with the intercept free, a = Σ(x − x̄)(y − ȳ)/Σ(x − x̄)²,
b = ȳ − a·x̄, from sums about the means (no cancellation far from the origin). It returns n, a
(unit of y per unit of x), b (unit of y), SSE, R² = 1 − SSE/Σ(y − ȳ)² (null when every y is the
same), the standard error of a, √(SSE/(n − 2)/Σ(x − x̄)²) (null below 3 points), and the measured x
range — the line is drawn over it only. Fewer than 2 points, or every x the same: no line, and the
panel says why. Two points always fit exactly, and the panel says R² = 1 then means nothing. The
intercept is not forced to 0: an offset in the data then shows in b instead of tilting the slope;
a b other than 0 can come from a measurement offset, a systematic error or the model's limits,
which the data alone cannot tell apart. R² says how close the points lie to a line, not that the
model is right.

**Hooke's law.** Weight against extension at rest: each run's own m·g/Δl (a result), k_exp (the
slope through the runs ticked) and k_theory (the spring's k in the model, from the runs' own
theory) are kept apart. **Period squared against mass:** T is measured from each run's swing, so
it is the damped period, T² = 4π²·m/(k(1 − ζ²)); 4π²/a therefore gives k(1 − ζ²), which is what it
is compared with — the panel says so — and only runs of one spring and one ζ share a line.

**Export.** The table and the fit as CSV (`analysisCsv`): `#` lines with the experiment, the
analysis, the group, the fit (n, a, b, SSE, R², SE(a), the range), the derived value and the
theory, then a row per listed run — `run`, `included` (1 or 0) and the columns, named as in a
run's CSV (`mass_kg`, `oscillation_period_s`…); empty cells where a value is missing, never NaN.

**For other experiments**: the same blocks with their quantities — the pendulum T² against L
(slope 4π²/g, so `derived` with numerator 4π² gives g), free fall s against t², Ohm's law U
against I (slope R).

## Measurement uncertainty (Phase 6C.4)

Four quantities are kept apart:

| Quantity                   | What it is                                                                         | Where it comes from                       |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| theory                     | the model's closed form for the run's inputs (range; exact and small-angle period) | `model.predict`, frozen in the record     |
| simulated value            | the run's result — taken as the true value of the measured quantity                | the runtime; never rounded or overwritten |
| reading                    | the simulated value as an instrument of resolution d shows it                      | `quantize(simulated, d)`                  |
| standard uncertainty **u** | from the resolution alone: u = d/√12                                               | `resolutionUncertainty(d)`                |

**What is measured.** One quantity per experiment, by an instrument the definition declares in
`instruments` (the schema takes a list):

| Experiment | Measured quantity      | Instrument          | Resolution d (dial presets)      |
| ---------- | ---------------------- | ------------------- | -------------------------------- |
| projectile | range R (m), `range`   | tape measure        | 0.001, **0.01** (default), 0.1 m |
| pendulum   | period T (s), `period` | timer (period mode) | 0.001, **0.01** (default), 0.1 s |

v₀, θ, g, L and θ₀ are inputs set on dials: nothing measures them. The pendulum's two period rows
(against the small-angle T₀ and against the exact T) share one simulated value and one reading.
The gap to T₀ is the small-angle approximation, a model error (1.7 % at 30°), not measurement
uncertainty, and it stays in its own row.

**The model** (`simulation/measurement.ts`, pure, no DOM):

- **reading** = the nearest multiple of d. A half-way value goes away from zero, so −x reads as
  minus the reading of x. Within 10⁻⁹ of a step from half-way counts as half-way, so binary
  rounding does not move a decimal tie (1.005 is stored as 1.00499…; a 0.01 scale reads 1.01).
  The reading is the double nearest the decimal shown (0.3, not 0.30000000000000004), never −0,
  and is shown in d's decimal places.
- **u = d/√12**: the rounding error lies within ±d/2; with nothing known about where, it is
  taken as uniformly distributed there (a rectangular distribution), whose standard deviation is
  d/√12 ≈ 0.29 d. Reported to two significant digits (0.0029 m at d = 0.01 m).
- **d/2**: the largest rounding error, a bound — reported separately, never as u.
- **Refused** (`RangeError`): a resolution that is zero, negative, NaN or infinite; a value that
  is NaN or infinite, or needs more steps than a double counts exactly.

**Assumptions and exclusions.** The simulated value is the true value: the simulation's own step
error is not included (zero to floating point for the range, below 10⁻⁷ s for the period). The
uncertainty is the resolution's alone, **not the total uncertainty of a real measurement**:
calibration, alignment, parallax, judging where the ball landed, a light gate's trigger or a
person's reaction time are excluded, and each instrument names its exclusions in the panel and
the CSV. No propagation (each experiment has one direct reading), no coverage factor, no error
bars, no random noise.

**Setting d.** The resolution is a parameter of the experiment (`resolution`, symbol d, in its
result's unit) on a fourth desk dial ("Raise tape resolution d", "Raise timer resolution d"). So
it is set before a run and frozen in the run's inputs, so each record keeps its own d. It is
saved as `param.resolution`; an older save without it gets the default and a value outside
0.001…0.1 is refused. It shows on the status screen, in the run list and in comparison legends.
The model never reads it: content validation refuses an instrument whose resolution is a model
input, and tests run both resolutions and get identical samples, landing, period and theory.

**Validation** (content): an instrument names an existing result, at most one per result, in a
supported unit (`READING_UNITS`: `m`, `m³`, `s`, `mL`, `g`, `kg`, `N`, `V`, `A`, `J`, `Pa`, `°C`, `°`, `pH`, `mol/L` —
each read on a linear scale whose step d is in the same unit, which u = d/√12 needs; a pH
result read by a meter writes its unit as `pH`); its resolution parameter exists, is in the
result's unit and has min > 0.

**Results panel.**

- The table's middle column is now **Simulated** (it was "Measured").
- For a completed run, below the table: "Range R, read with: Tape measure", then Reading,
  Resolution d, Standard uncertainty u = d/√12 and Largest rounding error d/2. A note follows
  with the rounding rule, the assumption and what is excluded.
- An incomplete run gets no reading.
- A comparison has a d row and a reading row: each run's own reading and u.

**CSV**: lines added after the results; nothing removed or renamed, still byte-identical for a
run:

```
# Parameter resolution (d) = 0.01 m
# Measurement range (Range R) by Tape measure: reading = 7.07 m at resolution d = 0.01 m
# Measurement range: standard uncertainty u = d/√12 = 0.002886751345948129 m; bound d/2 = 0.005 m
# Measurement range: not included: judging where the ball landed, the tape's calibration and alignment, parallax
# Measurement model: a reading is its result above (kept unrounded there) rounded to the nearest …
```

An incomplete run has `# Measurements: none (the run did not complete)`; an experiment without
instruments (free fall) has no measurement lines.

## Save, load, leaving the room

- **Saved** (entity states of the apparatus, save format unchanged): the parameters
  (`param.velocity`, `param.angle`, `param.gravity`; the pendulum's `param.length`,
  `param.angle`, `param.gravity`; the tower's `param.height`, `param.gravity`; every station's
  `param.resolution`, Phase 6C.4) and which ball is loaded. Continue restores them; a loaded ball is back in the launcher. A save without a
  parameter (e.g. from before 6C.4) gets its default.
- **Not in the save**: runs, their samples and results, the run history and checklist progress.
  Ended runs are kept in the run history store instead (Phase P2b, `docs/persistence.md`); a run
  still running when the player leaves for the main menu or closes the page is not.
- **Leaving the scene** stops a running run (its data is kept for the rest of the session; the
  flying ball returns to its cart like every moved object). Sessions survive scene changes; a new
  game or Continue starts with none.

## Worked examples on the board (Phase Y-3)

The hub's teacher works an experiment's `examples` on its lab's whiteboard after explaining it
(`docs/phase-y-report.md`). Each example is data in the experiment's file:

- `question` (and `vi.question`), with the inputs it uses as placeholders;
- `set`: the inputs it sets (parameters or initial conditions; the rest at their defaults),
  inside each parameter's range;
- `find`: what it asks for — **model predictions** (`theory`, a `predict` key), written with the
  symbol and unit of the result compared with it (or its own `symbol`, `unit`);
- `steps`: what the teacher says (`say`, `vi.say`), the formula he writes (`write`, never
  translated), and a `check` — an expression (`simulation/expression.ts`: inputs by id,
  predictions as `@id`) that must equal a prediction of the model.

Placeholders in the texts: `{id}` an input's value, `{@id}` a prediction's, `{=expr}` an
expression's, each with an optional `|n` for n significant figures (default 3; inputs 4). The
board's lines — the title, "Given", "Find", each step's formula and the answer — are made by
`workExample` (`simulation/workedExample.ts`); **the answer is the model's prediction, never a
typed number**. `checkExample`, part of content validation (`game/content.ts`, the core's and the lab pack's
experiments alike; not of running one), refuses an example whose
inputs are out of range, whose placeholders name nothing, whose answers are not predictions, or
whose step checks do not come to the model's value (relative 10⁻⁶): content with such an example
does not load, and the content tests check every bundled example. The model's own conventions
stand (free fall's velocity is negative: up is positive), and the steps say so.

## Question banks (Phase Y-4)

Each experiment has a bank of exam questions for the hub teacher's paper tests:
`content/questions/<experiment id>.json`, schema `QuestionSetSchema` (`simulation/questions.ts`).
They are a chunk of their own (`content/questions.ts`, about 2 MB of JSON), not the lab pack's —
every lab visit needs that one: `Game.loadQuestions` downloads them the first time a test is set,
after the lab pack, and `addQuestionBanks` validates them against it before anything uses them.

- **Skills**: the pieces of knowledge it tests, each with pre-written study `advice` (what a
  marked paper recommends where questions on it were missed).
- **Questions**: at least 20 (`MIN_QUESTIONS`), at least 4 of every level (`MIN_PER_LEVEL`) —
  `recognise`, `understand`, `apply`, `analyse` (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao;
  every bank now 4, 5, 6, 5: Phú 2026-11-10) — and both THPT kinds: `choice` (four options,
  exactly one `correct`) and `true-false` (four statements a–d, each `true` or not). Each names
  its skills and has an `explain` for the marked paper.
- **Numbers are the model's**: placeholders as in worked examples, the inputs a question supposes
  in `set`. A numeric option or statement carries a `check` (an expression against a prediction):
  a correct option's check must agree with the model, a wrong option's must not, and a
  statement's check makes it true or false. Options must read differently once filled.
- **Hidden inputs** (the titration's acid): a question or worked example with numbers supposes its
  own value (`inputProblems`), since every prediction is worked from all the inputs.
- `checkQuestionSet` runs in content validation; the content tests check every bundled bank,
  and that every text has its Vietnamese.

`simulation/paper.ts` draws a paper and marks it, pure and deterministic: `composePaper` takes
questions of the chosen experiments, kinds and levels from each experiment in turn (seeded),
choice questions first, then true/false; each choice question's options in their own order.
`gradePaper` marks it as THPT 2025 does — a choice question 0.25 point; a true/false one 0.1,
0.25, 0.5 or 1 for 1, 2, 3 or 4 statements right — out of 10 (points × 10 / the most), and per
skill. The papers in the world, their writing and their marking sheet are Phase Y-5.

## Adding an experiment

The definitions, their topics and the models (`BUILT_IN_MODELS`) travel in the **lab pack**
(`game/labPack.ts`, INF-1), a chunk of its own loaded with the first world scene or when the
catalog opens, then validated against the core content before anything uses it; the menu's
JavaScript (under 500,000 B, `e2e/renderer.production.spec.ts`) only carries what an experiment
adds to the items, rooms and interface strings.

1. **Model** (if no existing one fits): a `SimulationModel` with `inputs`, `variables`, `init`,
   `step` (exact or well-behaved at the chosen timestep; stop at events by returning less than
   `dt`), `isComplete`, and `predictions` + `predict` for the theory. Register it in
   `simulation/models/index.ts`. Unit-test it against closed forms.
2. **Definition** in `src/content/experiments/<id>.json` (one file each, named after its id; the
   lab pack gathers the folder; `vite.config.ts` keeps Vitest's module cache from serving
   `content/lab.ts` with an older list of files): parameters with units, ranges, steps or presets; the
   measurements and results (with `theory`); `graphs`; the `procedure` checklist; optionally
   `instruments` reading results (each with a resolution parameter and a dial for it). Content
   validation checks every reference.
3. **Apparatus** in the world: an item with apparatus geometry (`launcher`, `pendulum`,
   `dropTower`, `springStand`, or `bench` for any other body-less apparatus — next section) and
   placements for its controls (`parameter-dial`, `experiment-control`, `results-display`,
   `instrument` screens) naming it as `station`.
4. Nothing in Interaction, Physics, SceneManager, Game, saving or the HUD needs to change for a
   new experiment on an existing kind of apparatus. A new kind (inclined plane, spring) adds its
   geometry field, its case in `StationSystem` (readiness, limits, what the apparatus supplies
   as inputs) and its drawing in `ExperimentView` — the session, runtime, events, dials,
   controls, status screen, monitor, results panel, graphs, checklist and saving are shared.
   The pendulum needed exactly that, plus small generic additions to the definition: measurement
   and result `symbol`s, a graph's `yLabel` and `mark`, the `monitor` graph, display
   metadata for `inputs`, a `note`, and `adjusted{parameter}` / `reset` milestones. The
   free-fall tower (6F) needed only those three and its `drop-tower` behaviour (like
   `pendulum`, no actions).

## Adding a bench experiment

A **bench** is the station kind for any apparatus without a physics body that the four built-in
kinds do not cover: a circuit board, an optics bench, an inclined plane drawn from the session, a
burette, a heating plate, osmosis tubes, a gas syringe, pondweed under a lamp. Nothing outside the
files below changes: `StationSystem`, `behaviors.ts`, `content.ts`, `layout.ts`, the decor
batches, `WorldRenderer` and `ExperimentView` handle every bench alike.

1. **Model**: `src/simulation/models/<x>.ts` with its test against the closed form, one line in
   `BUILT_IN_MODELS`. Its `predict` may throw a plain `Error` for settings it does not cover (as the titration
   model does): the station then refuses RUN with "The model does not cover these settings: change a
   dial." (`station.cannotRun`), logs the model's own message each time RUN is
   pressed and refused (channel `Stations`; asking the guard, as the HUD prompt does, logs nothing), and its view, desk and HUD keep working. Any other throw (a `TypeError`: a bug) is not a
   refusal and propagates. Data still keeps the dial ranges inside
   what the model covers: the refusal is a safety net, not a way to set limits. A bench has no
   `limits` of its own (the room never constrains it) and supplies no apparatus inputs.
2. **Definition** in `src/content/experiments/<id>.json`, in a topic of its subject, listed in
   its laboratory. A bench's desk lists every parameter and every shown `inputs` entry in six
   rows: **at most 4 parameters and 6 in all** (both checked when the lab pack loads); an input
   with `"desk": false` shows only in the results panel and CSV and is not counted. Give each
   result that has a qualitative reading `classes` (below); instruments read any unit of
   `READING_UNITS`. A bench is never loaded (only a launcher is): its checklist uses `inspected`,
   `adjusted`, `completed`, `viewed` and `reset`, as a `loaded` step could never be ticked.
3. **Items**: the apparatus, `"interactions": ["bench", "inspect"]` and
   `"bench": { "model": "<render key>", "top": [x, y, z] }` — `top`, from the item's base centre
   in its own frame, is where its rig stands (P3c keeps it inside the room); its box stays the
   collider and the aim box, so make it the apparatus' own volume and stand the item on a bench
   or island. Plus its instruction label and its desk controls (the shared `control-desk`,
   `control-dial`, `run-`/`stop-`/`reset-button`, `station-display`, `results-monitor`).
4. **Placements**: the apparatus with `params.experimentId`, each control with `params.station`
   (and `parameter` for a dial).
5. **Render**: `src/platform/render/bench/<x>.ts` exporting a `BenchModel` — its `frame` builds
   the fixed parts, `{ body, parts, dispose }` (the entity's mesh takes `body`, painted parts
   share the entity material it is given); its optional `rig` the moving parts,
   `{ group, pose(p, dt), dispose }` — plus **one line** in `BENCH_MODELS` (`bench/registry.ts`,
   where the conventions are). `pose` gets the station's `BenchPose`: `status` (the session
   state), `parameters` (the run's own inputs while a run exists, else the dials) and `sample`
   (every model variable by name: the run's value this frame, NaN without a run); it only
   assigns. List the variables the rig reads in `reads`. `demoBoard.ts` is the template. A key without a model draws the item's plain box and
   warns once.
6. **Tests**: the model's; `<x>.test.ts` beside the render file (it fits the item, the rig stands
   where it should, poses in place — `bench/registry.test.ts` already checks that it frees all it
   made in every state, that every bench item in content has a model and that each placed bench's
   model outputs what its rig `reads`, and `apparatusExtents.test.ts` that it stays in its room,
   its rig at each variable it reads at 1, or at the model's `fullScale`, which a rig declares
   wherever 1 is not its largest pose and a part could pass its frame); a station test copied from `gameplay/experiment/BenchStation.test.ts`
   (place, dial, RUN, samples, record, RESET); the pinned counts the new placements change; an
   e2e spec when the station ships.

**What the station gives the views.** `stations.view(id)` is a `BenchView`: `kind: 'bench'`, the
render key `model`, and `pose` — one live object per station: each read is the session's now (the
sample refilled in place), so it is read, never copied, and nothing is allocated per frame. The
desk display lists the parameters (and shown inputs) on the
left; while a run is in progress, beside `t`, a bench reads out its first two measured model
variables live (`deskReadings`), replaced by the results once it completes.

**Qualitative results (`classes`).** A result may name ranges of its value:
`"classes": [{ "max": -0.5, "label": "Loses water", "vi": {…} }, { "max": 0.5, "label": "No change", … }, { "label": "Gains water", … }]`,
ascending by `max` (inclusive), only the last without one, checked with the definition.
`resultClass` (in `simulation/experiment.ts`) gives the label of a value's class in the current
language; the results table (theory and simulated), the comparison table, the desk and monitor
summaries, the run list and the completion notice show it **beside** the number, e.g.
"−4.1 % (Loses water)", never instead of it. Records, the run history store and the CSV stay
numeric (no version bump).
Labels are content text: their Vietnamese sits beside them and the translation tests cover them.

**Table values.** The results tables show three decimals, so theory and simulation line up digit
for digit, and more where three would show fewer than two significant figures: 0.0012 mol/L, not
0.001 (`formatResult`). The values the shipped experiments show are unchanged.

## Adding a workspace experiment

Chemistry and Biology experiments open a **workspace** from their apparatus instead of a desk
(design: `docs/experiment-ux-architecture.md`, `docs/experiment-workspace-design.md`). The
contract (wave 1) is data plus the station's rules; the views come with the workspace host.

1. **Definition**: `"presentation"` — `physical-3d` (default: a 3D station, unchanged),
   `bench-embedded`, `2d-workspace`, `microscopy` or `observation` — and, unless `physical-3d`, a
   `"workspace"`: `pieces` (`id`, `kind` = a registered piece view, `slot`, `label` (+vi), `owns`:
   the parameters it sets, `shows`: `{variable}` / `{result}` / `{instrument}` (the result an
   instrument reads) / `{input}` / `{parameter}`), `materials` (`id`, `kind`, `label` (+vi),
   `formula?` shown only, `sets?: {parameter, value}`), `setup` (`id`, `instruction` and `refusal`
   (+vi), `place` a material or piece `onto` a piece, `after`: earlier steps, `phase`
   `before-run` (default) or `after-run`) and `runLabel?` (+vi). Checked when the lab pack loads:
   every parameter owned by exactly one piece, every binding names something of the definition
   (model variables against the model), every `sets.value` is one of the parameter's presets,
   every setup reference exists. A result may say `"format": "integer"` (a count, a whole number
   wherever results are shown; CSV keeps the value). A setup step may say
   `"when": { "parameter", "values" }` (values among its presets): it applies to that material
   only, and the gate and `view.setup` skip it otherwise. A `procedure` step may wait for a setup
   step: `{ "kind": "setup", "step": "<id>" }`. A step may say `"locks": ["<parameter>"]`: while
   it applies and is done, `set` of that parameter to another value is refused ("clear the bench to
   change it") — a pipetted volume, a stain on the slide, a slide on the stage; `clear` unlocks.
   Choosing another material for a `when` parameter needs no lock: the steps of the old value stop
   applying and the new value's step is asked for. A `physical-3d` experiment has no workspace.
2. **Apparatus item**: add `"open-workspace"` beside its geometry behaviour (`"bench"`…): E opens
   the workspace (`WorkspaceRequested` → `WorkspaceSystem` → `WorkspaceOpened`; one at a time,
   closed by `game.workspace.close()` or a scene change, never saved; the player stands still
   while it is open). Content refuses it for a `physical-3d` experiment.
3. **Rules** (`StationSystem`, the only authority; the gate itself is `setupGate.ts`): commands
   `set` (a preset, or a step-grid value without presets; same entity state and `adjusted`
   milestones as a dial), `setup` (a step whose earlier `after` steps are done; after-run steps
   only once a run completed), `clear` (setup back to the start, the run discarded, refused while
   running). A station with before-run steps starts not ready; RUN is refused with the next
   step's `refusal`. RESET keeps the before-run setup and undoes the after-run steps (they read
   the run that is gone). Setup progress is configuration, in entity states `setup.<step>`, saved
   and restored like `param.<id>`. `stations.refusal(stationId, command, parameter?, value?)`
   gives the reason a control is disabled, the same text the 3D guard gives, and logs nothing;
   `stations.view(id).setup` lists the steps and which are done. `experiments.preview(id)` gives
   the model's t = 0 state for the settings, for visuals only (flagged, never recorded).
4. **Views**: a piece view per `kind` (`src/platform/ui/workspace/types.ts`: `mount(root, ctx)`,
   `update(view)`, `dispose()`; `ctx` has `texts`, `stationId`, `piece`, `send`, `refusal`).

### Answers the student works out, and records-only scatters

- **Hidden input**: `inputs.<id>.hidden: true` keeps an input (an unknown sample) in the model,
  the session, the run record and validation, and out of every student-facing view: desk, results
  panel, comparison, notices, CSV, workspace bindings, the normal debug line.
- **Answer**: a result with `"answer": { "proportionalTo": "<result an instrument reads>" }` is
  never shown, nor its theory. For a completed run the results panel offers a number field and
  "Check my answer" (`checkAnswer`, `measurement.ts`): incomplete (no completed run, empty, not a
  number), correct or incorrect: correct when |x − truth| ≤ |x|·(d/2)/R, R and d the run's
  reading of that instrument and its resolution. An answer worked out from R always lands inside;
  the brief's truth·(d/2)/R refused one (titration: V_a 10 mL, c_b 0.2 mol/L, phenolphthalein,
  d 0.1 mL, R rounding up past V; `answer.test.ts`). Deviation from the Lead's wording, kept to
  its stated aim; awaiting the Lead. The window is narrow ((d/2)/R, 0.1–1 %), so the hint asks for
  every digit. Feedback never shows the value or the window; the check is
  view state for that run, never saved. Loading refuses whatever would show either: a binding,
  analysis or scatter naming them, another result or a measurement on the answer's variable, a
  graph mark or another result with its theory, an instrument reading the answer.
- **No theory with a hidden input** (`theoryShown`): every theory is computed from all inputs,
  so an experiment with a hidden input shows none: no theory column values, comparison or monitor
  marks, CSV theory lines; analyses and oscillation are refused at load. The record keeps it.
  Titration: V_eq = c_a·V_a/c_b would have given c_a back. Revealing it after a correct check is
  a Lead decision.
- **Scatter** (`scatters: [{ id, title (+vi), x: parameter, y: result }]`): the station's
  completed run records as points, x the record's input, y its simulated result; no fit, no
  theory line.
