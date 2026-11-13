import { Disposables, type EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import { type Quat, rayBox, rotate, type Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { ContainerAction, ExperimentCommandName, GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type {
  ExperimentDefinition,
  ExperimentMilestone,
  SetupStep,
} from '../../simulation/experiment';
import type { ExperimentSession, RunCheck, SessionState } from '../../simulation/ExperimentSession';
import type { ExperimentSystem } from '../../simulation/ExperimentSystem';
import {
  type ContainerState,
  containerOf,
  toUl,
  totalUl,
  transfer,
  UL_PER_ML,
} from '../../simulation/liquid';
import type { EntityStates, EntityStateValue } from '../../world/EntityStates';
import type { RoomDefinition } from '../../world/definitions';
import type { World, WorldEntity } from '../../world/World';
import type { PoseDriver, SetDownRule } from '../interaction/hold';
import type { ActionGuard } from '../interaction/InteractionSystem';
import type { ContainerDefinition, ItemDefinition } from '../item';
import { pointOf } from '../lab/pour';
import type { LiquidRules } from '../lab/LiquidSystem';
import { pendingBeforeRun, setupRefusal, stepApplies } from './setupGate';

/** What `StationSystem.refusal` answers for: a station command, or opening its workspace. */
export type StationCommand = ExperimentCommandName | 'open-workspace';

/** What a station needs from the player's hands (implemented by the interaction system). */
export interface StationHands {
  readonly heldEntity: WorldEntity | null;
  place(): WorldEntity | null;
  grab(entity: WorldEntity): boolean;
}

export interface StationSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  entityStates: EntityStates;
  experiments: ExperimentSystem;
  hands: StationHands;
  /** Physics side: takes a projectile out of the simulation while the experiment moves it. */
  driver: PoseDriver;
  guards: {
    addGuard(guard: ActionGuard): () => void;
    /** Where the physical lab's set-down rule plugs in (the interaction system). */
    setSetDownRule?(rule: SetDownRule): () => void;
  };
  texts: Texts;
  log: Logger;
  /** Where a container's placement puts it (session frame): `clear` and a carry out of the lab. */
  homes?: { home(entityId: string, position: Vec3, rotation: Quat): boolean };
  /** Whether a body is at rest (physics): a seated container knocked off is noticed when it is. */
  bodies?: { body(entityId: string): { readonly sleeping: boolean } | null };
  /**
   * The name of another player in the room who works a station (Phase M, `game.peers`), or null:
   * this player's own commands to it are refused while they do.
   */
  lockedBy?: (stationId: string) => string | null;
}

/** Clearance (m) a predicted motion must keep from walls, floor and ceiling. */
const MARGIN = 0.3;
/** Clearance (m) a pendulum bob keeps above the floor at the bottom of its swing. */
const FLOOR_GAP = 0.05;
const X_AXIS: Vec3 = [1, 0, 0];
const DEG = Math.PI / 180;

interface StationBase {
  readonly id: string; // the apparatus entity id, also its session id
  readonly entity: WorldEntity;
  readonly session: ExperimentSession;
}

/** A projectile launcher: a ball is loaded, launched, flown by the model, handed back on landing. */
interface LauncherStation extends StationBase {
  readonly kind: 'launcher';
  /** Where the ball's centre is at launch (world). */
  readonly launch: Vec3;
  /** Horizontal unit vector of the model's x axis (world). */
  readonly direction: Vec3;
  readonly floor: number;
  /** Horizontal distance from the launch point to the far wall, less the margin (m). */
  readonly lane: number;
  /** Highest point the ball may reach above the floor (m). */
  readonly ceiling: number;
  /** The ball in the launcher, in flight, or launched by the current run. */
  projectile: WorldEntity | null;
  /** The projectile is out of the physics simulation (loaded, flying or frozen by STOP). */
  driven: boolean;
  /** Its pose follows the running model. */
  flying: boolean;
}

/**
 * A pendulum stand: always ready. Its bob is part of the apparatus — no physics body, nothing to
 * load; views draw it from the session (`swingAngle`, `swingLength`), the model is its only state.
 */
interface PendulumStation extends StationBase {
  readonly kind: 'pendulum';
  /** Pivot height above the floor (m). */
  readonly pivotHeight: number;
  /** Free horizontal room on either side of the pivot in the swing plane, less the margin (m). */
  readonly reach: number;
  readonly bobRadius: number;
  readonly bobMass: number;
}

/**
 * A free-fall tower: always ready. Like the bob, its ball is part of the apparatus — no physics
 * body, nothing to load; views draw it from the session (`dropHeight`, `releaseHeight`).
 */
interface DropStation extends StationBase {
  readonly kind: 'drop';
  readonly ballRadius: number;
  /** Highest release height of the ball's lowest point: the column, or the room, less the ball. */
  readonly highest: number;
}

/**
 * A spring stand: always ready. The spring and the weight hanging from it are part of the
 * apparatus — no physics body, nothing to load; views draw them from the session
 * (`springExtension`).
 */
interface SpringStation extends StationBase {
  readonly kind: 'spring';
  readonly naturalLength: number;
  /** The most extension (m) the spring takes and stays elastic: a run swinging past it is refused. */
  readonly elasticLimit: number;
}

/**
 * A bench: any body-less apparatus (a circuit board, a burette, a lamp and pondweed), always
 * ready, drawn by the renderer's bench model `model` from `pose`. No limits beyond the parameter
 * ranges: content keeps those inside what the model covers.
 */
interface BenchStation extends StationBase {
  readonly kind: 'bench';
  readonly model: string;
  readonly pose: BenchPose;
}

type Station = LauncherStation | PendulumStation | DropStation | SpringStation | BenchStation;

/**
 * A container of a `physical-lab` station: its placement names the station (or it is the
 * apparatus), its `piece` (the step vocabulary) and its `material` (what it is or holds: a
 * glassware choice or a solution, each maybe setting a parameter).
 */
interface Bound {
  readonly entity: WorldEntity;
  readonly container: ContainerDefinition;
  readonly station: Station;
  readonly piece: string;
  readonly material: string | null;
}

/** What a container step is done by (`SetupStep.by`, or what its `onto` piece is). */
type PhysicalAction = 'set-down' | 'transfer' | 'invert' | 'clamp' | 'raise';

/** An open burette tap: the rate (mL/s, its model's input) and the µL owed but not yet whole. */
interface Tap {
  readonly rate: number;
  owed: number;
}

/** How often (s) seated containers are looked at, in case one was knocked off its seat. */
const SEAT_CHECK_S = 1;

export interface ChecklistStep {
  readonly instruction: string;
  readonly done: boolean;
}

interface StationViewBase {
  readonly id: string;
  readonly definition: ExperimentDefinition;
  readonly session: ExperimentSession;
  readonly checklist: readonly ChecklistStep[];
  /** Index of the first step not done (= checklist length when all are). */
  readonly next: number;
  /** Why RUN would be refused now, or null. */
  readonly runBlock: string | null;
  /** The workspace's setup steps (none without a workspace), in order, and which are done. */
  readonly setup: readonly SetupProgress[];
}

export interface SetupProgress {
  readonly step: SetupStep;
  readonly done: boolean;
}

export interface LauncherView extends StationViewBase {
  readonly kind: 'launcher';
  readonly launch: Readonly<Vec3>;
  readonly direction: Readonly<Vec3>;
  readonly floor: number;
  readonly lane: number;
  /** Radius of the current or last projectile (m), 0 if none. */
  readonly radius: number;
  readonly loaded: boolean;
  /**
   * Model coordinates (x along the launch direction, y the ball's lowest point above the floor)
   * to the world position of the ball's centre — the mapping that places the ball itself, so a
   * trajectory drawn with it is the path the ball took.
   */
  readonly toWorld: (x: number, y: number, out: Vec3) => Vec3;
}

export interface PendulumView extends StationViewBase {
  readonly kind: 'pendulum';
  readonly bobRadius: number;
}

export interface DropView extends StationViewBase {
  readonly kind: 'drop';
  readonly ballRadius: number;
}

export interface SpringView extends StationViewBase {
  readonly kind: 'spring';
  readonly naturalLength: number;
  readonly elasticLimit: number;
  /** Where the mass is held before RUN: its extension (m) at y₀ from rest, by the theory. */
  readonly held: number;
}

/**
 * What a bench is drawn from: one live object per station — each read is the session's now, the
 * sample refilled in place, so nothing is allocated per frame. `status`: the session's state;
 * `parameters`: the settings drawn — the run's own inputs while a run exists, else the dials;
 * `sample`: every model variable by name — the run's current value, NaN without a run.
 */
export interface BenchPose {
  readonly status: SessionState;
  readonly parameters: Readonly<Record<string, number>>;
  readonly sample: Readonly<Record<string, number>>;
  /** The apparatus's own entity state (a clamp raised): what its rig draws, read-only. */
  state?(key: string): EntityStateValue | undefined;
}

export interface BenchView extends StationViewBase {
  readonly kind: 'bench';
  /** The render key of its bench model (the item's `bench.model`). */
  readonly model: string;
  readonly pose: BenchPose;
}

/** Everything instruments and the HUD show about a station, derived from authoritative state. */
export type StationView = LauncherView | PendulumView | DropView | SpringView | BenchView;

/** The angle (rad) a pendulum is drawn at: the run's state, else held at its release angle. */
export function swingAngle(session: ExperimentSession): number {
  const run = session.run;
  return run ? run.value('theta') : (session.parameters.angle ?? 0) * DEG;
}

/** The rod length (m) a pendulum is drawn with: the run's, else the dial's. */
export function swingLength(session: ExperimentSession): number {
  return session.run?.inputs.length ?? session.parameters.length ?? 1;
}

/** Height (m) of a free-fall ball's lowest point above the floor: the run's, else the dial's h. */
export function dropHeight(session: ExperimentSession): number {
  const run = session.run;
  return run ? run.value('y') : (session.parameters.height ?? 0);
}

/** The release height (m) a tower's clamp is drawn at: the run's, else the dial's. */
export function releaseHeight(session: ExperimentSession): number {
  return session.run?.inputs.height ?? session.parameters.height ?? 0;
}

/** A spring's extension (m) from its natural length during or after a run; 0 without one. */
export function springExtension(session: ExperimentSession): number {
  return session.run?.value('extension') ?? 0;
}

const milestoneKey = (m: ExperimentMilestone) =>
  m.kind === 'inspected'
    ? `inspected:${m.item}`
    : m.kind === 'adjusted' && m.parameter !== undefined
      ? `adjusted:${m.parameter}`
      : m.kind === 'setup'
        ? `setup:${m.step}`
        : m.kind;

const setupKey = (step: string) => `setup.${step}`;
const stepsOf = (station: StationBase) => station.session.definition.workspace?.setup ?? [];
/** The steps the gate asks for: those that apply to the material chosen now (`when`). */
const applying = (station: StationBase) =>
  stepsOf(station).filter((step) => stepApplies(step, station.session.parameters));

/** Something for the results monitor to show: the current run, or a run kept in the history. */
const hasResults = (session: ExperimentSession) =>
  session.run !== null || session.history.length > 0;

/** Distance from p along d to the box [lo, hi] it is inside (∞ when d does not move along it). */
const toWall = (lo: number, hi: number, p: number, d: number) =>
  d > 1e-9 ? (hi - p) / d : d < -1e-9 ? (lo - p) / d : Infinity;

/**
 * Experiment stations at their apparatus: items with `launcher`, `pendulum`, `dropTower`,
 * `springStand` or `bench` geometry whose placement names the experiment. The single authority
 * for station rules, whatever the apparatus: it executes station commands, refuses the ones that
 * cannot happen now with a reason (an action guard), and keeps the guided checklist. Per kind of
 * apparatus: a launcher's ball is loaded, moved along the running model — the scientific model,
 * not Rapier, is where the ball is during a run — and handed back to physics when it lands; a
 * pendulum's bob, a free-fall tower's ball, a spring stand's spring and weight and a bench's rig
 * have no body at all and are drawn from the session. It mirrors what instruments show into
 * entity states (`state`, `loaded`, `param.<id>`): the configuration is saved with the world and
 * restored. A workspace's setup progress is configuration too (`setup.<step>`): its before-run
 * steps gate RUN (`setupGate.ts`), RESET keeps them, `clear` starts them again.
 */
/** How far (m) round an apparatus its bench reaches, for what is looked at (`stationAlong`). */
const BENCH_MARGIN_M = 0.15;
/** An apparatus is taken to stand at least this high (m) over the floor, for what is looked at. */
const APPARATUS_TOP_M = 2.2;

export class StationSystem implements GameSystem, LiquidRules {
  /** A ray test's box (`stationAlong`), reused. */
  private readonly boxCenter: Vec3 = [0, 0, 0];
  private readonly boxHalf: Vec3 = [0, 0, 0];
  readonly id = 'stations';
  private readonly stations = new Map<string, Station>();
  /** Checklist milestones per station, for this playthrough (survives leaving the room). */
  private readonly progress = new Map<string, Set<string>>();
  private readonly subscriptions = new Disposables();
  /** Physical-lab containers of the attached stations, by entity id. */
  private readonly bound = new Map<string, Bound>();
  /** Per container, a number that grows on every write to it (views poll it). */
  private readonly versions = new Map<string, number>();
  /** The container a station's driven run fills (its run's vessel), while it has one. */
  private readonly vessels = new Map<string, string>();
  /** The pour pair last found allowed: its next steps re-check only what a pour can change. */
  private approvedFrom: string | null = null;
  private approvedTo: string | null = null;
  /** Open taps by the burette's entity id. */
  private readonly taps = new Map<string, Tap>();
  /** µL a station's driven run has added from its source so far (`drive.feed` `added`). */
  private readonly added = new Map<string, number>();
  private readonly tapPair = { from: '', to: '' };
  private readonly clampedIds: string[] = [];
  private seatClock = 0;
  private readonly home: Vec3 = [0, 0, 0];
  private readonly homeTurn: Quat = [0, 0, 0, 1];
  private readonly seatAt: Vec3 = [0, 0, 0];

  constructor(private readonly deps: StationSystemDeps) {}

  init(): void {
    const { events, guards } = this.deps;
    const s = this.subscriptions;
    s.add(guards.addGuard((...asked) => this.guard(...asked)));
    const rule = guards.setSetDownRule?.((held, surface, seat) =>
      this.setDown(held, surface, seat),
    );
    if (rule) s.add(rule);
    s.add(events.subscribe('ContainerRequested', (request) => this.request(request)));
    s.add(
      events.subscribe('ObjectGrabbed', ({ entityId }) => {
        this.approvedFrom = null;
        if (this.bound.has(entityId)) this.deps.entityStates.set(entityId, 'seat', '');
      }),
    );
    // A container carried out of its lab (walking into the next scene lets go) goes back home.
    s.add(
      events.subscribe('ObjectReleased', ({ entityId, reason }) => {
        const b = reason === 'scene-change' ? this.bound.get(entityId) : undefined;
        if (b) this.returnHome(b.entity);
      }),
    );
    s.add(
      events.subscribe('SceneLoaded', ({ kind, sceneId }) => {
        if (kind !== 'world') return;
        this.stations.clear();
        this.bound.clear();
        this.vessels.clear();
        this.attach(sceneId);
      }),
    );
    s.add(events.subscribe('SceneLoading', () => this.detach()));
    // A neighbour's stations come with it and go with it; the current scene's stay.
    s.add(events.subscribe('SceneAttached', ({ sceneId }) => this.attach(sceneId)));
    s.add(events.subscribe('SceneDetached', ({ sceneId }) => this.detach(sceneId)));
    s.add(events.subscribe('ExperimentCommand', (command) => this.command(command)));
    s.add(
      events.subscribe('ItemInspected', ({ itemId }) => {
        for (const station of this.stations.values()) this.mark(station, `inspected:${itemId}`);
      }),
    );
    // Working at the apparatus is looking at it: its `inspected` milestone.
    s.add(
      events.subscribe('WorkspaceOpened', ({ stationId }) => {
        const station = this.stations.get(stationId);
        if (station) this.mark(station, `inspected:${station.entity.item.id}`);
      }),
    );
    s.add(
      events.subscribe('ExperimentCompleted', ({ sessionId }) => {
        const station = this.stations.get(sessionId);
        if (station) this.mark(station, 'completed');
      }),
    );
    for (const type of ['ExperimentStateChanged', 'ExperimentParameterChanged'] as const) {
      s.add(
        events.subscribe(type, ({ sessionId }) => {
          const station = this.stations.get(sessionId);
          if (station) this.changed(station);
        }),
      );
    }
  }

  /** Moves flying projectiles along their run; a landed one goes back to physics. */
  update(dt = 0): void {
    for (const [id, tap] of this.taps) this.flow(id, tap, dt);
    this.seatClock += dt;
    if (this.seatClock >= SEAT_CHECK_S) {
      this.seatClock = 0;
      this.checkSeats();
    }
    for (const station of this.stations.values()) {
      if (station.kind !== 'launcher' || !station.flying) continue;
      const run = station.session.run;
      const ball = station.projectile;
      if (!run || !ball) {
        station.flying = false;
        continue;
      }
      this.placeAt(station, ball, run.value('x'), run.value('y'));
      const state = station.session.state;
      if (state === 'running') continue;
      station.flying = false;
      if (state === 'completed') {
        // Landed: from here on Rapier owns it (it rests where it landed and can be picked up).
        this.deps.driver.stopDriving(ball.id);
        station.driven = false;
      } // stopped: it stays where the measurement stopped until RESET
      this.changed(station);
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.stations.clear();
    this.bound.clear();
  }

  /** Forgets checklist progress (a new playthrough starts). */
  clear(): void {
    this.progress.clear();
  }

  /** The station an entity belongs to (its apparatus, or one of its pieces), or null. */
  stationOf(entityId: string): StationView | null {
    const entity = this.deps.world.entity(entityId);
    const station = entity ? this.stationFor(entity) : undefined;
    return station ? this.describe(station) : null;
  }

  /**
   * The station of the active rooms whose apparatus — the column over its footprint, from the floor
   * (its bench) to at least APPARATUS_TOP_M — the ray from `eye` along `dir` meets first within `max` (m), and how far; or null.
   */
  stationAlong(
    eye: Readonly<Vec3>,
    dir: Readonly<Vec3>,
    max: number,
  ): { readonly station: StationView; readonly distance: number } | null {
    const rooms = this.deps.world.activeRooms;
    let nearest: Station | null = null;
    let best = max;
    for (const station of this.stations.values()) {
      if (!inRooms(rooms, station.entity.roomId)) continue;
      const { pose, item } = station.entity;
      const [sx, sy, sz] = item.visual.size;
      // Its item box can be only its base (a stand drawn by the renderer): up to a head's height.
      const top = Math.max(pose.position[1] + sy / 2, APPARATUS_TOP_M);
      this.boxCenter[0] = pose.position[0];
      this.boxCenter[1] = top / 2;
      this.boxCenter[2] = pose.position[2];
      this.boxHalf[0] = sx / 2 + BENCH_MARGIN_M;
      this.boxHalf[1] = top / 2;
      this.boxHalf[2] = sz / 2 + BENCH_MARGIN_M;
      const distance = rayBox(eye, dir, this.boxCenter, this.boxHalf, pose.rotation);
      if (distance !== null && distance < best) [best, nearest] = [distance, station];
    }
    return nearest ? { station: this.describe(nearest), distance: best } : null;
  }

  /** The station of the active rooms whose apparatus stands nearest (x, z), within `radius` (m). */
  stationNear(x: number, z: number, radius: number): StationView | null {
    const rooms = this.deps.world.activeRooms;
    let nearest: Station | null = null;
    let best = radius * radius;
    for (const station of this.stations.values()) {
      if (!inRooms(rooms, station.entity.roomId)) continue;
      const [sx, , sz] = station.entity.pose.position;
      const distance = (sx - x) ** 2 + (sz - z) ** 2;
      if (distance <= best) [best, nearest] = [distance, station];
    }
    return nearest ? this.describe(nearest) : null;
  }

  /**
   * The nearest station in the player's room (a room can hold several), else the current scene's
   * first (HUD objective, debug) — never a neighbour's.
   */
  activeStation(): StationView | null {
    const [x, , z] = this.deps.state.player.position;
    const room = this.deps.world.roomAt(x, z)?.id;
    const current = this.deps.world.activeRooms;
    let first: Station | null = null;
    let nearest: Station | null = null;
    let best = Infinity;
    for (const station of this.stations.values()) {
      if (!first && inRooms(current, station.entity.roomId)) first = station;
      if (station.entity.roomId !== room) continue;
      const [sx, , sz] = station.entity.pose.position;
      const distance = (sx - x) ** 2 + (sz - z) ** 2;
      if (distance < best) [best, nearest] = [distance, station];
    }
    const station = nearest ?? first;
    return station ? this.describe(station) : null;
  }

  view(stationId: string): StationView | null {
    const station = this.stations.get(stationId);
    return station ? this.describe(station) : null;
  }

  // ---- scene lifecycle ----------------------------------------------------------------------

  /** Attaches the stations of scene `sceneId`: its apparatus entities. */
  private attach(sceneId: string): void {
    const { world, entityStates, experiments } = this.deps;
    const rooms = world.roomsOf(sceneId);
    for (const entity of world.allEntities()) {
      if (!inRooms(rooms, entity.roomId)) continue;
      const { launcher, pendulum, dropTower, springStand, bench } = entity.item;
      const experimentId = entity.params.experimentId;
      const room = world.roomAt(entity.pose.position[0], entity.pose.position[2]);
      const geometry = launcher ?? pendulum ?? dropTower ?? springStand ?? bench;
      if (!geometry || typeof experimentId !== 'string' || !room) continue;
      const session = experiments.session(entity.id, experimentId);
      // The configuration is world state: restore it (a save, an earlier visit), then mirror it.
      for (const p of session.definition.parameters) {
        const saved = entityStates.get(entity.id, `param.${p.id}`);
        if (typeof saved === 'number') session.setParameter(p.id, saved);
        entityStates.set(entity.id, `param.${p.id}`, session.parameters[p.id] ?? p.default);
      }
      for (const step of session.definition.workspace?.setup ?? []) {
        const key = setupKey(step.id);
        // An after-run step read a run: runs are never saved, so it stays done only with its run.
        const kept = step.phase === 'before-run' || session.state === 'completed';
        entityStates.set(entity.id, key, kept && entityStates.get(entity.id, key) === true);
      }
      if (launcher) {
        const station = this.launcherStation(entity, session, room, launcher);
        this.stations.set(entity.id, station);
        const loaded = entityStates.get(entity.id, 'loaded');
        const ball = typeof loaded === 'string' && loaded !== '' ? world.entity(loaded) : undefined;
        if (ball) this.mount(station, ball);
        else {
          entityStates.set(entity.id, 'loaded', '');
          experiments.setReady(entity.id, false);
        }
        this.changed(station);
      } else if (pendulum) {
        this.attachReady(this.pendulumStation(entity, session, room, pendulum));
      } else if (dropTower) {
        this.attachReady(this.dropStation(entity, session, room, dropTower));
      } else if (springStand) {
        this.attachReady({
          kind: 'spring',
          id: entity.id,
          entity,
          session,
          naturalLength: springStand.naturalLength,
          elasticLimit: springStand.elasticLimit,
        });
      } else if (bench) {
        const sample: Record<string, number> = {};
        const pose: BenchPose = {
          get status() {
            return session.state;
          },
          get parameters() {
            return session.run?.inputs ?? session.parameters;
          },
          get sample() {
            session.sample(sample);
            return sample;
          },
          state: (key) => entityStates.get(entity.id, key),
        };
        this.attachReady({
          kind: 'bench',
          id: entity.id,
          entity,
          session,
          model: bench.model,
          pose,
        });
      }
    }
    for (const entity of world.allEntities()) {
      if (inRooms(rooms, entity.roomId)) this.bind(entity);
    }
  }

  /**
   * Binds a container of a `physical-lab` station (its placement's `piece`, `material`, `fill`
   * checked against the station's workspace), making its state from the placement on first use.
   */
  private bind(entity: WorldEntity): void {
    const container = entity.item.container;
    const station = container && this.stationFor(entity);
    const workspace = station?.session.definition.workspace;
    if (!container || !station || !workspace || !this.physical(station)) return;
    const { piece, material, fill } = entity.params;
    const problem =
      typeof piece !== 'string' || !workspace.pieces.some((p) => p.id === piece)
        ? `names no piece of "${station.session.definition.id}"`
        : material !== undefined &&
            (typeof material !== 'string' || !workspace.materials.some((m) => m.id === material))
          ? `names no material of "${station.session.definition.id}"`
          : fill !== undefined && (typeof fill !== 'number' || typeof material !== 'string')
            ? 'has a fill (mL) without a material'
            : null;
    if (problem || typeof piece !== 'string') {
      this.deps.log.warn(`Container "${entity.id}" ${problem ?? ''}: not part of its station`);
      return;
    }
    const b: Bound = {
      entity,
      container,
      station,
      piece,
      material: typeof material === 'string' ? material : null,
    };
    this.bound.set(entity.id, b);
    this.deps.state.world.containers[entity.id] ??= this.initial(b);
    this.wrote(b);
    // A run is never saved: a tap comes back closed. A clamped vessel is held again where it was.
    if (container.tap) {
      this.deps.entityStates.set(entity.id, 'tapOpen', false);
      this.deps.entityStates.set(entity.id, 'run', false);
    }
    const at = this.clampOf(entity.id);
    if (at && !this.hold(b.entity, at.holder, at.clamp)) {
      this.deps.entityStates.set(entity.id, 'clamp', '');
    }
  }

  /** A container as its placement fills it (`fill` mL of its material, an AFFORDANCE volume). */
  private initial(b: Bound): ContainerState {
    const fill = b.entity.params.fill;
    return containerOf(b.material, toUl(typeof fill === 'number' ? fill : 0));
  }

  /**
   * A station with nothing to load: the bob always hangs there, the ball waits in its clamp — ready
   * once its workspace's before-run setup steps (if any) are done.
   */
  private attachReady(station: Station): void {
    this.stations.set(station.id, station);
    this.deps.experiments.setReady(station.id, this.pendingSetup(station) === null);
    this.changed(station);
  }

  private launcherStation(
    entity: WorldEntity,
    session: ExperimentSession,
    room: RoomDefinition,
    geometry: NonNullable<ItemDefinition['launcher']>,
  ): LauncherStation {
    const launch = this.onApparatus(entity, geometry.muzzle);
    const direction = rotate(entity.pose.rotation, X_AXIS, [0, 0, 0]);
    const { min, max } = room.bounds;
    return {
      kind: 'launcher',
      id: entity.id,
      entity,
      session,
      launch,
      direction,
      floor: min[1],
      lane:
        Math.min(
          toWall(min[0], max[0], launch[0], direction[0]),
          toWall(min[2], max[2], launch[2], direction[2]),
        ) - MARGIN,
      ceiling: max[1] - min[1] - MARGIN,
      projectile: null,
      driven: false,
      flying: false,
    };
  }

  private pendulumStation(
    entity: WorldEntity,
    session: ExperimentSession,
    room: RoomDefinition,
    geometry: NonNullable<ItemDefinition['pendulum']>,
  ): PendulumStation {
    const pivot = this.onApparatus(entity, geometry.pivot);
    const [dx, , dz] = rotate(entity.pose.rotation, X_AXIS, [0, 0, 0]);
    const { min, max } = room.bounds;
    const side = (sign: number) =>
      Math.min(
        toWall(min[0], max[0], pivot[0], sign * dx),
        toWall(min[2], max[2], pivot[2], sign * dz),
      );
    return {
      kind: 'pendulum',
      id: entity.id,
      entity,
      session,
      pivotHeight: pivot[1] - min[1],
      reach: Math.min(side(1), side(-1)) - MARGIN,
      bobRadius: geometry.bobRadius,
      bobMass: geometry.bobMass,
    };
  }

  private dropStation(
    entity: WorldEntity,
    session: ExperimentSession,
    room: RoomDefinition,
    geometry: NonNullable<ItemDefinition['dropTower']>,
  ): DropStation {
    const { min, max } = room.bounds;
    const column = entity.item.visual.size[1];
    return {
      kind: 'drop',
      id: entity.id,
      entity,
      session,
      ballRadius: geometry.ballRadius,
      highest: Math.min(max[1] - min[1] - MARGIN, column) - 2 * geometry.ballRadius,
    };
  }

  /** A point given from the apparatus' base centre in its own frame, in world coordinates. */
  private onApparatus(entity: WorldEntity, local: Readonly<Vec3>): Vec3 {
    const { position, rotation } = entity.pose;
    const offset = rotate(rotation, local, [0, 0, 0]);
    const baseY = position[1] - entity.item.visual.size[1] / 2;
    return [position[0] + offset[0], baseY + offset[1], position[2] + offset[2]];
  }

  /**
   * Leaving the scene stops a run (its data is kept); the apparatus goes with the scene. With
   * `sceneId`, only that scene's stations (a neighbour going away), else every one.
   */
  private detach(sceneId?: string): void {
    const rooms = sceneId === undefined ? null : this.deps.world.roomsOf(sceneId);
    const leaving = [...this.stations.values()].filter(
      (station) => !rooms || inRooms(rooms, station.entity.roomId),
    );
    for (const station of leaving) {
      if (station.session.state === 'running') this.deps.experiments.stop(station.id);
    }
    for (const station of leaving) {
      this.stations.delete(station.id);
      this.vessels.delete(station.id);
    }
    for (const b of [...this.bound.values()]) {
      if (leaving.includes(b.station)) this.bound.delete(b.entity.id);
    }
  }

  // ---- commands -----------------------------------------------------------------------------

  /**
   * Why `command` would be refused at station `stationId` now, or null: the same text its 3D
   * control's guard gives (a workspace shows it beside the disabled control). `parameter` for
   * adjust (`value` > 0 raises, else lowers) and set (`value` the new value); `parameter` names
   * the step for setup. Changes nothing and logs nothing.
   */
  refusal(
    stationId: string,
    command: StationCommand,
    parameter?: string,
    value?: number,
  ): string | null {
    const station = this.stations.get(stationId);
    if (!station) {
      return this.deps.texts.ui('station.unknown', 'There is no apparatus here.');
    }
    return (
      this.lockOf(station.id, command) ?? this.refusalAt(station, command, parameter, value, false)
    );
  }

  /** Why the player may not change station `stationId` now: another player in the room works it. */
  private lockOf(stationId: string, command: StationCommand): string | null {
    if (command === 'view' || command === 'open-workspace') return null;
    const name = this.deps.lockedBy?.(stationId) ?? null;
    return name === null
      ? null
      : this.deps.texts.ui('room.stationTaken', '{name} is working this apparatus.', { name });
  }

  private refusalAt(
    station: Station,
    command: StationCommand,
    parameter: string | undefined,
    value: number | undefined,
    pressed: boolean,
  ): string | null {
    const { texts } = this.deps;
    const session = station.session;
    switch (command) {
      case 'load':
        return session.state === 'running'
          ? texts.ui('station.waitForRun', 'Wait until the run has finished.')
          : null;
      case 'unload':
        return null;
      case 'run':
        // A driven run starts with its first accepted drop (`transfer`), never from a button.
        return (
          this.runBlock(station, pressed) ??
          (session.driven
            ? texts.ui('station.runByHand', 'This run starts when you add the first drop by hand.')
            : null)
        );
      case 'stop':
        return session.state === 'running'
          ? null
          : texts.ui('station.nothingRunning', 'Nothing is running.');
      case 'reset':
        return session.run ? null : texts.ui('station.nothingToReset', 'There is no run to reset.');
      case 'adjust':
        return this.dialBlock(station, parameter, value === undefined || value > 0 ? 1 : -1);
      // A physical lab's steps and material settings are done by hand, never asked for by a
      // command (no second input path into its session); its dials still `adjust`.
      case 'set':
        return this.physical(station)
          ? this.byHand()
          : this.setBlock(station, parameter, value ?? Number.NaN);
      case 'setup':
        return this.physical(station) ? this.byHand() : this.setupBlock(station, parameter ?? '');
      case 'clear':
        if (!session.definition.workspace) return this.noWorkspace();
        return session.state === 'running'
          ? texts.ui('station.stopBeforeClear', 'Stop the run before clearing the bench.')
          : null;
      case 'view':
        return hasResults(session)
          ? null
          : texts.ui('station.noResults', 'No results yet: run the experiment first.');
      case 'open-workspace':
        return session.definition.presentation === 'physical-3d' || this.physical(station)
          ? this.noWorkspace()
          : null;
    }
  }

  private command({
    stationId,
    command,
    parameter,
    direction,
    value,
    step,
    from,
    params,
  }: GameEvents['ExperimentCommand']): void {
    const station = this.stations.get(stationId);
    if (!station) return;
    const { experiments, events } = this.deps;
    if (from !== undefined) {
      // Another player's command (Phase M): their settings first, as they have them now (a dial
      // stepped from another value would drift), then what they did; never what needs a hand.
      for (const [id, to] of Object.entries(params ?? {})) {
        if (station.session.parameters[id] === to) continue;
        if (experiments.set(station.id, id, to) === null) this.adjusted(station, id);
      }
      if (command === 'adjust' || command === 'set' || command === 'load' || command === 'unload') {
        this.changed(station);
        return;
      }
    }
    const asked =
      command === 'setup'
        ? step
        : command === 'set' || command === 'adjust'
          ? parameter
          : undefined;
    const reason =
      (from === undefined ? this.lockOf(stationId, command) : null) ??
      this.refusalAt(station, command, asked, command === 'adjust' ? direction : value, false);
    if (reason !== null) {
      // Refused: nothing changes; the player reads why (a 3D control's guard said so already).
      // Another player's, refused here (this copy differs: no ball loaded…): only logged.
      if (from === undefined) {
        events.publish('ActionBlocked', { entityId: stationId, actionId: command, reason });
      } else {
        this.deps.log.info(`${from}'s ${command} at ${stationId} not followed: ${reason}`);
      }
      return;
    }
    switch (command) {
      case 'load':
        if (station.kind === 'launcher') this.load(station);
        break;
      case 'unload':
        if (station.kind === 'launcher') this.unload(station);
        break;
      case 'run':
        this.run(station);
        break;
      case 'stop':
        experiments.stop(station.id);
        break;
      case 'reset':
        this.reset(station);
        break;
      case 'adjust':
        if (parameter !== undefined && direction !== undefined) {
          this.adjust(station, parameter, direction);
        }
        break;
      case 'set':
        if (parameter !== undefined && value !== undefined) this.set(station, parameter, value);
        break;
      case 'setup':
        if (step !== undefined) this.setup(station, step);
        break;
      case 'clear':
        this.clearSetup(station);
        break;
      case 'view':
        if (!hasResults(station.session)) return;
        if (station.session.state === 'completed') this.mark(station, 'viewed');
        events.publish('ExperimentResultsViewed', { stationId });
        break;
    }
    this.changed(station);
  }

  private load(station: LauncherStation): void {
    const { hands } = this.deps;
    const held = hands.heldEntity;
    if (this.loadedBall(station) || station.session.state === 'running' || !held) return;
    if (!held.item.tags.includes(this.accepts(station)) || !hands.place()) return;
    this.mount(station, held);
    this.mark(station, 'loaded');
  }

  private unload(station: LauncherStation): void {
    const ball = this.loadedBall(station);
    if (!ball || station.session.state === 'running') return;
    this.deps.driver.stopDriving(ball.id);
    station.driven = false;
    station.projectile = null;
    this.deps.entityStates.set(station.id, 'loaded', '');
    this.deps.experiments.setReady(station.id, false);
    if (!this.deps.hands.heldEntity) this.deps.hands.grab(ball);
  }

  private run(station: Station): void {
    if (station.kind !== 'launcher') {
      // Nothing to launch: from here on the model is where the bob or the ball is.
      if (this.runBlock(station)) return;
      this.deps.experiments.start(station.id, this.apparatus(station), this.limits(station));
      return;
    }
    const ball = this.loadedBall(station);
    if (!ball || this.runBlock(station)) return;
    const problem = this.deps.experiments.start(
      station.id,
      this.apparatus(station),
      this.limits(station),
    );
    if (problem) return;
    // The ball leaves the launcher: the launcher is empty, the model now places the ball.
    this.deps.entityStates.set(station.id, 'loaded', '');
    this.deps.experiments.setReady(station.id, false);
    station.flying = true;
  }

  /** RESET: the run discarded, after-run steps to do again; the before-run setup stays. */
  private reset(station: Station): void {
    if (this.discardRun(station)) {
      this.mark(station, 'reset');
      // After-run steps read the run that is gone: the next run is read anew.
      for (const step of stepsOf(station)) {
        if (step.phase === 'after-run') {
          this.deps.entityStates.set(station.id, setupKey(step.id), false);
        }
      }
    }
  }

  /** Discards the run (true if it did); a launched ball goes back unless the player has it. */
  private discardRun(station: Station): boolean {
    if (station.kind === 'launcher') {
      // The ball as the world has it now: one put away and taken out again is a new entity.
      const ball = station.projectile && this.deps.world.entity(station.projectile.id);
      station.flying = false;
      if (ball && this.deps.hands.heldEntity !== ball) {
        this.mount(station, ball);
      } else {
        station.projectile = null;
      }
    }
    return this.deps.experiments.reset(station.id) === null;
  }

  private adjust(station: Station, parameter: string, direction: 1 | -1): void {
    if (this.deps.experiments.adjust(station.id, parameter, direction) !== null) return;
    this.adjusted(station, parameter);
  }

  private set(station: Station, parameter: string, value: number): void {
    // Choosing the current setting again changes nothing, so it adjusts nothing.
    if (station.session.settingFor(parameter, value) === station.session.parameters[parameter]) {
      return;
    }
    if (this.deps.experiments.set(station.id, parameter, value) !== null) return;
    this.adjusted(station, parameter);
  }

  /** A parameter changed: mirrored into its entity state, the `adjusted` milestones marked. */
  private adjusted(station: Station, parameter: string): void {
    this.deps.entityStates.set(
      station.id,
      `param.${parameter}`,
      station.session.parameters[parameter] ?? Number.NaN,
    );
    this.mark(station, 'adjusted');
    this.mark(station, `adjusted:${parameter}`);
    // Another material may need other setup steps (`when`): RUN waits for them.
    if (station.session.definition.workspace) this.syncSetupReady(station);
  }

  /** Marks a setup step done (the gate allowed it); the last before-run step makes it ready. */
  private setup(station: Station, step: string): void {
    this.deps.entityStates.set(station.id, setupKey(step), true);
    this.syncSetupReady(station);
    this.mark(station, `setup:${step}`);
  }

  /** Empties the workspace bench: the run (if any) is discarded, setup back to its first step. */
  private clearSetup(station: Station): void {
    if (station.session.run) this.discardRun(station);
    for (const step of stepsOf(station)) {
      this.deps.entityStates.set(station.id, setupKey(step.id), false);
    }
    if (this.physical(station)) this.restock(station);
    this.syncSetupReady(station);
  }

  /**
   * A physical lab's bench cleared: its containers filled again as placed (their AFFORDANCE fill),
   * open, unmixed, off their seats, and back where they were placed (through the pose driver).
   */
  private restock(station: Station): void {
    const { hands, entityStates, state } = this.deps;
    this.vessels.delete(station.id);
    this.approvedFrom = null;
    const held = hands.heldEntity && this.bound.get(hands.heldEntity.id);
    if (held && held.station === station) hands.place();
    for (const b of this.bound.values()) {
      if (b.station !== station) continue;
      this.unclamp(b);
      state.world.containers[b.entity.id] = this.initial(b);
      entityStates.set(b.entity.id, 'seat', '');
      this.wrote(b);
      this.returnHome(b.entity);
    }
    for (const entity of this.deps.world.allEntities()) {
      if (this.stationFor(entity) === station && this.sliding(entity)) {
        this.deps.entityStates.set(entity.id, 'clampRaised', false);
      }
    }
  }

  /** Puts a carried container back at its placement, at rest (the pose driver: no teleport in physics). */
  private returnHome(entity: WorldEntity): void {
    const { homes, driver } = this.deps;
    if (!homes?.home(entity.id, this.home, this.homeTurn) || !driver.drive(entity.id)) return;
    const { position, rotation } = entity.pose;
    for (let i = 0; i < 3; i++) position[i] = this.home[i] ?? 0;
    for (let i = 0; i < 4; i++) rotation[i] = this.homeTurn[i] ?? 0;
    driver.stopDriving(entity.id);
  }

  /** Ready when nothing is left to load (only launchers load) and the setup gate is open. */
  private syncSetupReady(station: Station): void {
    const loaded = station.kind !== 'launcher' || this.loadedBall(station) !== null;
    this.deps.experiments.setReady(station.id, loaded && this.pendingSetup(station) === null);
  }

  private pendingSetup(station: Station): SetupStep | null {
    return pendingBeforeRun(applying(station), (id) => this.setupDone(station, id));
  }

  private setupDone(station: Station, step: string): boolean {
    return this.deps.entityStates.get(station.id, setupKey(step)) === true;
  }

  /** Puts a ball into the launcher: out of physics, at the launch point, the session ready. */
  private mount(station: LauncherStation, ball: WorldEntity): void {
    this.deps.driver.drive(ball.id);
    station.projectile = ball;
    station.driven = true;
    this.placeAt(station, ball, 0, this.launchHeight(station, this.radiusOf(ball)));
    this.deps.entityStates.set(station.id, 'loaded', ball.id);
    this.deps.experiments.setReady(station.id, true);
  }

  // ---- physical lab: containers (`docs/physical-lab-architecture.md` §2.4–2.10) --------------

  container(entityId: string): Readonly<ContainerState> | null {
    return this.deps.state.world.containers[entityId] ?? null;
  }

  /** A number that grows on every write to a container's state (views redraw when it moves). */
  containerVersion(entityId: string): number {
    return this.versions.get(entityId) ?? 0;
  }

  pourRefusal(sourceId: string, receiverId: string): string | null {
    const reason = this.pourBlock(sourceId, receiverId);
    [this.approvedFrom, this.approvedTo] = reason ? [null, null] : [sourceId, receiverId];
    return reason;
  }

  /** Why `sourceId` may not pour into `receiverId` now, or null: the rule alone, nothing kept. */
  pourBlock(sourceId: string, receiverId: string): string | null {
    const src = this.bound.get(sourceId);
    const dst = this.bound.get(receiverId);
    return src && dst ? this.transferBlock(src, dst, 'pour') : this.notThisStep();
  }

  transfer(sourceId: string, receiverId: string, wantUl: number): number {
    const src = this.bound.get(sourceId);
    const dst = this.bound.get(receiverId);
    if (!src || !dst) return 0;
    // The pair was found allowed; a pour itself changes only the volumes (and starts its run).
    const known =
      this.approvedFrom === sourceId &&
      this.approvedTo === receiverId &&
      !(this.isDrive(src, dst) && src.station.session.state !== 'running');
    if (!known && this.pourRefusal(sourceId, receiverId)) return 0;
    if (this.container(sourceId)?.closed || this.container(receiverId)?.closed) return 0;
    return this.commit(src, dst, wantUl);
  }

  invert(entityId: string): string | null {
    const b = this.bound.get(entityId);
    const state = this.deps.state.world.containers[entityId];
    if (!b || !state?.closed) return null;
    const station = b.station;
    const step = this.stepFor(station, b, b.piece, 'invert');
    const done = step ? this.setupDone(station, step.id) : true;
    const block = done || !step ? null : this.setupBlock(station, step.id);
    if (block) return block;
    state.mixed = true;
    this.wrote(b);
    if (step && !done) this.setup(station, step.id);
    this.changed(station);
    return null;
  }

  /**
   * The set-down rule (InteractionSystem asks it once per press, before the body moves): onto a
   * seat that is a piece of the held container's station, the step that puts it there must be the
   * next (its parameter set from the container's material and locked); a free spot is always fine.
   */
  private setDown(held: WorldEntity, surfaceId: string | null, seat: string | null): string | null {
    this.approvedFrom = null;
    const block = this.setDownBlock(held, surfaceId, seat);
    if (block) return block;
    const b = this.bound.get(held.id);
    const onto = this.seatPiece(held, surfaceId, seat);
    const step = b && onto !== null ? this.stepFor(b.station, b, onto, 'set-down') : undefined;
    if (b && step) {
      this.applyMaterial(b);
      if (!this.setupDone(b.station, step.id)) this.setup(b.station, step.id);
    }
    if (b) {
      this.deps.entityStates.set(held.id, 'seat', onto === null ? '' : `${surfaceId}/${onto}`);
    }
    this.deps.events.publish('ObjectSetDown', { entityId: held.id, surfaceId, seat });
    return null;
  }

  /**
   * Why `held` may not be set down on `seat` of `surfaceId` now, or null: onto a seat that is a
   * piece of the held container's station, the step that puts it there must be the next and its
   * material allowed; a free spot is always fine. The rule alone: nothing is committed or kept.
   */
  setDownBlock(held: WorldEntity, surfaceId: string | null, seat: string | null): string | null {
    const b = this.bound.get(held.id);
    const onto = this.seatPiece(held, surfaceId, seat);
    if (!b || onto === null) return null;
    const step = this.stepFor(b.station, b, onto, 'set-down');
    if (!step) return this.notThisStep();
    const done = this.setupDone(b.station, step.id);
    return (done ? null : this.setupBlock(b.station, step.id)) ?? this.materialBlock(b);
  }

  /** The piece a seat is, when it is one of the held container's station's pieces; else null. */
  private seatPiece(
    held: WorldEntity,
    surfaceId: string | null,
    seat: string | null,
  ): string | null {
    const station = this.bound.get(held.id)?.station;
    const surface = surfaceId === null ? undefined : this.deps.world.entity(surfaceId);
    if (!station || !surface || seat === null || this.stationFor(surface) !== station) return null;
    return this.pieceOf(station, seat) ? seat : null;
  }

  /**
   * Why a container control is refused, or null: fill or deliver the held pipette, drops from the
   * held dropper bottle, a stopper, the held vessel into a clamp of `entity` (or out of one), a
   * burette's tap and its reading.
   */
  private containerBlock(entity: WorldEntity, action: ContainerAction): string | null {
    const heldEntity = this.deps.hands.heldEntity;
    const held = heldEntity ? this.bound.get(heldEntity.id) : undefined;
    if (action === 'clamp') return held ? this.clampBlock(entity, held) : this.notThisStep();
    if (action === 'raise-clamp') return this.raiseBlock(entity);
    if (action === 'lower-clamp') return this.lowerBlock(entity);
    const target = this.bound.get(entity.id) ?? this.vesselIn(entity);
    if (!target) return this.notThisStep();
    switch (action) {
      case 'stopper':
      case 'unstopper':
        return null;
      case 'unclamp':
        return this.clampOf(target.entity.id) === null ? this.notThisStep() : this.runFrom(target);
      case 'open-tap':
        return this.tapBlock(target);
      case 'close-tap':
        return this.taps.has(target.entity.id) ? null : this.notThisStep();
      case 'record':
        return this.recordBlock(target);
      case 'drops':
        return held?.container.drops
          ? this.transferBlock(held, target, 'pour')
          : this.notThisStep();
      case 'fill':
        return held ? this.transferBlock(target, held, 'fill') : this.notThisStep();
      case 'deliver':
        return held ? this.transferBlock(held, target, 'deliver') : this.notThisStep();
    }
  }

  /** A container control the guard allowed: committed here (fill, deliver, stopper). */
  private request({ entityId, action }: GameEvents['ContainerRequested']): void {
    const entity = this.deps.world.entity(entityId);
    const reason = entity ? this.containerBlock(entity, action) : this.notThisStep();
    if (reason !== null) {
      this.deps.events.publish('ActionBlocked', { entityId, actionId: action, reason });
      return;
    }
    this.approvedFrom = null;
    const heldId = this.deps.hands.heldEntity?.id;
    const held = heldId === undefined ? undefined : this.bound.get(heldId);
    if (action === 'clamp') {
      if (held && entity) this.clampIn(entity, held);
      return;
    }
    if (action === 'raise-clamp' || action === 'lower-clamp') {
      if (entity) this.slide(entity, action === 'raise-clamp');
      return;
    }
    const target = this.bound.get(entityId);
    const state = this.deps.state.world.containers[entityId];
    if (!target || !state) return;
    switch (action) {
      case 'stopper':
      case 'unstopper':
        state.closed = action === 'stopper';
        this.wrote(target);
        break;
      case 'unclamp':
        this.unclamp(target);
        if (!this.deps.hands.heldEntity) this.deps.hands.grab(target.entity);
        break;
      case 'open-tap':
        this.openTap(target);
        break;
      case 'close-tap':
        this.taps.delete(entityId);
        this.deps.entityStates.set(entityId, 'tapOpen', false);
        break;
      case 'record':
        this.taps.delete(entityId);
        this.deps.entityStates.set(entityId, 'tapOpen', false);
        target.station.session.finish();
        break;
      case 'drops': {
        const drops = held?.container.drops;
        if (held && drops) this.commit(held, target, drops.count * toUl(drops.volumeMl));
        break;
      }
      default:
        if (held) {
          const [src, dst] = action === 'fill' ? [target, held] : [held, target];
          const from = this.deps.state.world.containers[src.entity.id];
          const want = action === 'fill' ? this.limitUl(dst) : totalUl(from?.contents ?? {});
          this.commit(src, dst, want);
        }
    }
    this.changed(target.station);
  }

  /**
   * Why `src` may not go into `dst` now, or null. `pour` (a held source tipped over a mouth), `fill`
   * (a pipette drawn from `src`) or `deliver` (a pipette emptied into `dst`). Volumes and stoppers
   * first, then the run this is (`drive`), else the step it is — whose own refusal is the reason —
   * and the materials' settings, and a seat the receiver must stand on.
   */
  private transferBlock(src: Bound, dst: Bound, kind: 'pour' | 'fill' | 'deliver'): string | null {
    const { texts } = this.deps;
    const station = src.station;
    const s = this.deps.state.world.containers[src.entity.id];
    const d = this.deps.state.world.containers[dst.entity.id];
    if (dst.station !== station || !s || !d || src === dst) return this.notThisStep();
    if (s.closed || d.closed) {
      return texts.ui('station.openFirst', 'Take the stopper or cap off first.');
    }
    if (kind === 'fill' && totalUl(d.contents) > 0) {
      return texts.ui('station.emptyFirst', 'Empty the pipette first.');
    }
    const room = this.limitUl(dst) - totalUl(d.contents);
    if (room <= 0 || (kind === 'deliver' && totalUl(s.contents) > room)) return this.full(dst);
    if (kind === 'fill' && totalUl(s.contents) < this.limitUl(dst)) {
      return texts.ui('station.notEnough', 'There is not enough left in it.');
    }
    if (this.isDrive(src, dst)) return this.driveBlock(src, dst, d);
    const step = this.stepFor(station, src, dst.piece, 'transfer');
    if (!step) return this.notThisStep();
    // A pour goes on into a step it has done (the same pour); a pipette does a step once.
    const goesOn = kind === 'pour' && this.setupDone(station, step.id);
    return (
      (goesOn ? null : this.setupBlock(station, step.id)) ??
      this.materialBlock(src) ??
      this.materialBlock(dst) ??
      this.seatBlock(dst)
    );
  }

  /** Why the pour that is the station's driven run may not go now, or null. */
  private driveBlock(src: Bound, dst: Bound, d: Readonly<ContainerState>): string | null {
    const station = src.station;
    if (station.session.state === 'running') {
      return this.vessels.get(station.id) === dst.entity.id
        ? null
        : this.deps.texts.ui('station.running', 'The run is in progress.');
    }
    const state = this.deps.state.world.containers[src.entity.id];
    // What it already holds of the source's liquid went in without a run that could be read
    // (a run is never saved, nor kept by RESET): only a clear starts it again.
    for (const material in state?.contents) {
      if ((d.contents[material] ?? 0) > 0) {
        return this.deps.texts.ui(
          'station.clearToRestart',
          'What is in it was not added in a run: clear the bench to start again.',
        );
      }
    }
    return (
      this.runBlock(station) ??
      this.materialBlock(src) ??
      this.materialBlock(dst) ??
      this.seatBlock(dst)
    );
  }

  /**
   * One transfer, committed in one call: a driven run started by its first drop, the materials'
   * parameters set, the µL moved, the step marked, the run fed. Returns the µL moved.
   */
  private commit(src: Bound, dst: Bound, wantUl: number): number {
    const station = src.station;
    const s = this.deps.state.world.containers[src.entity.id];
    const d = this.deps.state.world.containers[dst.entity.id];
    if (!s || !d) return 0;
    const drive = this.isDrive(src, dst);
    if (drive && station.session.state !== 'running') {
      this.added.set(station.id, 0);
      const problem = this.deps.experiments.start(
        station.id,
        this.apparatus(station),
        this.limits(station),
      );
      if (problem) {
        this.deps.log.warn(`${station.id}: the run did not start: ${problem}`);
        return 0;
      }
      this.vessels.set(station.id, dst.entity.id);
    }
    this.applyMaterial(src);
    this.applyMaterial(dst);
    const moved = transfer(s.contents, d.contents, wantUl, this.limitUl(dst));
    if (moved > 0) {
      d.mixed = false;
      this.wrote(src);
      this.wrote(dst);
    }
    if (drive) {
      const added = (this.added.get(station.id) ?? 0) + moved;
      this.added.set(station.id, added);
      const feed = station.session.definition.workspace?.drive?.feed;
      station.session.feed((feed === 'added' ? added : totalUl(d.contents)) / UL_PER_ML);
    } else {
      const step = this.stepFor(station, src, dst.piece, 'transfer');
      if (moved > 0 && step && !this.setupDone(station, step.id)) this.setup(station, step.id);
    }
    return moved;
  }

  /** The step putting `place` onto piece `onto` by `action` that applies now, if any (allocation-free). */
  private stepFor(
    station: Station,
    place: Bound,
    onto: string,
    action: PhysicalAction,
  ): SetupStep | undefined {
    const parameters = station.session.parameters;
    for (const step of stepsOf(station)) {
      if (step.onto !== onto || (step.place !== place.piece && step.place !== place.material)) {
        continue;
      }
      if (stepApplies(step, parameters) && this.actionOf(station, step) === action) return step;
    }
    return undefined;
  }

  /** What does a step: its `by`, else a transfer onto a container's piece, a set-down onto any other. */
  private actionOf(station: Station, step: SetupStep): PhysicalAction {
    if (step.by) return step.by;
    for (const b of this.bound.values()) {
      if (b.station === station && b.piece === step.onto) return 'transfer';
    }
    return 'set-down';
  }

  private isDrive(src: Bound, dst: Bound): boolean {
    const drive = src.station.session.definition.workspace?.drive;
    return (
      drive !== undefined &&
      (drive.place === src.piece || drive.place === src.material) &&
      drive.onto === dst.piece
    );
  }

  /** Why a container's material may not set its parameter now (a run, a locked step), or null. */
  private materialBlock(b: Bound): string | null {
    const sets = this.setsOf(b);
    if (!sets || b.station.session.parameters[sets.parameter] === sets.value) return null;
    return this.setBlock(b.station, sets.parameter, sets.value);
  }

  /** A container's material sets its parameter (a glassware choice, a stock), mirrored as a dial. */
  private applyMaterial(b: Bound): void {
    const sets = this.setsOf(b);
    if (sets && b.station.session.parameters[sets.parameter] !== sets.value) {
      this.set(b.station, sets.parameter, sets.value);
    }
  }

  private setsOf(b: Bound) {
    const materials = b.station.session.definition.workspace?.materials ?? [];
    for (const m of materials) if (m.id === b.material) return m.sets;
    return undefined;
  }

  /**
   * A receiver whose set-down step is done must stand on its seat (knocked off or picked up, it
   * is refused with that step's own reason until it is set back).
   */
  private seatBlock(dst: Bound): string | null {
    const station = dst.station;
    const parameters = station.session.parameters;
    for (const step of stepsOf(station)) {
      if (step.place !== dst.piece && step.place !== dst.material) continue;
      if (!stepApplies(step, parameters) || this.actionOf(station, step) !== 'set-down') continue;
      const seat = this.deps.entityStates.get(dst.entity.id, 'seat');
      if (this.setupDone(station, step.id) && (typeof seat !== 'string' || seat === '')) {
        return this.deps.texts.of(step, 'refusal');
      }
    }
    return null;
  }

  /** Seated containers knocked off their seat (at rest elsewhere) are no longer seated. */
  private checkSeats(): void {
    const { entityStates, world, bodies } = this.deps;
    if (!bodies) return;
    for (const b of this.bound.values()) {
      const seat = entityStates.get(b.entity.id, 'seat');
      if (typeof seat !== 'string' || seat === '') continue;
      // shortcut: once a second, a snapshot and a split per seated container; fine for a bench.
      if (!bodies.body(b.entity.id)?.sleeping) continue;
      const cut = seat.lastIndexOf('/');
      const surface = world.entity(seat.slice(0, cut));
      const spot = surface?.item.seats?.find((s) => s.id === seat.slice(cut + 1));
      if (surface && spot) {
        pointOf(surface.pose.position, surface.pose.rotation, spot.center, this.seatAt);
        const [x, , z] = b.entity.pose.position;
        if ((x - this.seatAt[0]) ** 2 + (z - this.seatAt[2]) ** 2 <= spot.radius ** 2) continue;
      }
      entityStates.set(b.entity.id, 'seat', '');
      this.approvedFrom = null; // an approved pour re-checks its seats on its next drop
      this.changed(b.station);
    }
  }

  private physical(station: Station): boolean {
    return station.session.definition.presentation === 'physical-lab';
  }

  private pieceOf(station: Station, id: string): boolean {
    return station.session.definition.workspace?.pieces.some((p) => p.id === id) ?? false;
  }

  /** µL a container takes: a pipette's measure, a flask's mark, else its brim. */
  private limitUl(b: Bound): number {
    const { measured, fillLimitMl, capacityMl } = b.container;
    return toUl(measured?.volumeMl ?? fillLimitMl ?? capacityMl);
  }

  private full(b: Bound): string {
    return b.container.measured || b.container.fillLimitMl !== undefined
      ? this.deps.texts.ui('station.fullToMark', 'It is full to the mark.')
      : this.deps.texts.ui('station.full', 'It is full.');
  }

  private notThisStep(): string {
    return this.deps.texts.ui('station.notThisStep', 'That is not part of this experiment.');
  }

  private byHand(): string {
    return this.deps.texts.ui('station.byHand', 'Do this with the apparatus itself.');
  }

  /** A container's state was written: its version moves on, its stopper and fill are mirrored. */
  private wrote(b: Bound): void {
    const id = b.entity.id;
    const state = this.deps.state.world.containers[id];
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    if (!state) return;
    if (b.container.closable) this.deps.entityStates.set(id, 'closed', state.closed);
    if (b.container.measured) {
      this.deps.entityStates.set(id, 'filled', totalUl(state.contents) > 0);
    }
  }

  // ---- physical lab: clamps and burette taps ------------------------------------------------

  /** The clamp holding `entityId` now (entity state `clamp`: "<holder id>/<clamp id>"), or null. */
  private clampOf(entityId: string): { holder: WorldEntity; clamp: string } | null {
    const at = this.deps.entityStates.get(entityId, 'clamp');
    if (typeof at !== 'string' || at === '') return null;
    const cut = at.lastIndexOf('/');
    const holder = this.deps.world.entity(at.slice(0, cut));
    return holder ? { holder, clamp: at.slice(cut + 1) } : null;
  }

  /** The vessel `holder` holds in a clamp (its entity state `holding`), or undefined. */
  private vesselIn(holder: WorldEntity): Bound | undefined {
    const id = this.deps.entityStates.get(holder.id, 'holding');
    return typeof id === 'string' && id !== '' ? this.bound.get(id) : undefined;
  }

  /** The clamp of `holder` that takes `b` (one of its tags), or undefined. */
  private clampFor(holder: WorldEntity, b: Bound) {
    const tags = b.entity.item.tags;
    return holder.item.clamps?.find((c) => c.accepts.some((t) => tags.includes(t)));
  }

  /**
   * Why the held `b` may not go into a clamp of `holder` now, or null: a clamp of its station
   * that is one of its pieces and takes it, empty, and the step that puts it there the next.
   */
  private clampBlock(holder: WorldEntity, b: Bound): string | null {
    const station = b.station;
    const clamp = this.clampFor(holder, b);
    if (this.stationFor(holder) !== station || !clamp || !this.pieceOf(station, clamp.id)) {
      return this.notThisStep();
    }
    const at = `${holder.id}/${clamp.id}`;
    for (const other of this.bound.values()) {
      if (other !== b && this.deps.entityStates.get(other.entity.id, 'clamp') === at) {
        return this.deps.texts.ui('station.clampTaken', 'The clamp already holds one.');
      }
    }
    const step = this.stepFor(station, b, clamp.id, 'clamp');
    if (!step) return this.notThisStep();
    const done = this.setupDone(station, step.id);
    return (done ? null : this.setupBlock(station, step.id)) ?? this.materialBlock(b);
  }

  /** The held `b` into the clamp of `holder` (the guard allowed it): out of the hand, held there. */
  private clampIn(holder: WorldEntity, b: Bound): void {
    const clamp = this.clampFor(holder, b);
    if (!clamp || this.clampBlock(holder, b) !== null || !this.deps.hands.place()) return;
    if (!this.hold(b.entity, holder, clamp.id)) return;
    this.deps.entityStates.set(b.entity.id, 'clamp', `${holder.id}/${clamp.id}`);
    this.applyMaterial(b);
    const step = this.stepFor(b.station, b, clamp.id, 'clamp');
    if (step && !this.setupDone(b.station, step.id)) this.setup(b.station, step.id);
    this.changed(b.station);
  }

  /**
   * Holds `entity` in clamp `clampId` of `holder`: out of the physics simulation (the pose
   * driver), upright as the holder stands, its centre on the clamp's. False if it cannot.
   */
  private hold(entity: WorldEntity, holder: WorldEntity, clampId: string): boolean {
    const clamp = holder.item.clamps?.find((c) => c.id === clampId);
    if (!clamp) return false;
    const driven = this.deps.entityStates.get(holder.id, 'holding') === entity.id;
    if (!driven && !this.deps.driver.drive(entity.id)) return false;
    const { position, rotation } = entity.pose;
    const centre = clamp.lowered && !this.raised(holder) ? clamp.lowered : clamp.center;
    pointOf(holder.pose.position, holder.pose.rotation, centre, this.seatAt);
    for (let i = 0; i < 3; i++) position[i] = this.seatAt[i] ?? 0;
    for (let i = 0; i < 4; i++) rotation[i] = holder.pose.rotation[i] ?? 0;
    this.deps.entityStates.set(holder.id, 'holding', entity.id);
    return true;
  }

  /** Whether `holder`'s clamp is raised to its working height (entity state `clampRaised`). */
  private raised(holder: WorldEntity): boolean {
    return this.deps.entityStates.get(holder.id, 'clampRaised') === true;
  }

  /** The clamp of `holder` that slides on its rod, or undefined. */
  private sliding(holder: WorldEntity) {
    return holder.item.clamps?.find((c) => c.lowered !== undefined);
  }

  /**
   * Why `holder`'s clamp may not be raised now, or null: lowered, no run in progress, and with a
   * vessel in it, the step that raises it the next (the burette filled first, below the eye).
   */
  private raiseBlock(holder: WorldEntity): string | null {
    const station = this.stationFor(holder);
    const clamp = this.sliding(holder);
    if (!station || !clamp || this.raised(holder)) return this.notThisStep();
    if (station.session.state === 'running') {
      return this.deps.texts.ui('station.running', 'The run is in progress.');
    }
    const b = this.vesselIn(holder);
    const step = b ? this.stepFor(station, b, clamp.id, 'raise') : undefined;
    return step && !this.setupDone(station, step.id) ? this.setupBlock(station, step.id) : null;
  }

  /** Why `holder`'s clamp may not be lowered now, or null: raised, no run, nothing under it. */
  private lowerBlock(holder: WorldEntity): string | null {
    const station = this.stationFor(holder);
    if (!station || !this.sliding(holder) || !this.raised(holder)) return this.notThisStep();
    if (station.session.state === 'running') {
      return this.deps.texts.ui('station.running', 'The run is in progress.');
    }
    for (const b of this.bound.values()) {
      const seat = this.deps.entityStates.get(b.entity.id, 'seat');
      if (typeof seat === 'string' && seat.startsWith(`${holder.id}/`)) {
        return this.deps.texts.ui('station.clearUnderClamp', 'Take the flask off the tile first.');
      }
    }
    return null;
  }

  /**
   * The clamp slid up (or down) its rod, the vessel in it with it; raised with a vessel, its step
   * is done, lowered again it is to do again (nothing stood under it: `lowerBlock`).
   */
  private slide(holder: WorldEntity, up: boolean): void {
    const station = this.stationFor(holder);
    const clamp = this.sliding(holder);
    if (!station || !clamp || (up ? this.raiseBlock(holder) : this.lowerBlock(holder)) !== null) {
      return;
    }
    this.deps.entityStates.set(holder.id, 'clampRaised', up);
    const b = this.vesselIn(holder);
    if (b) this.hold(b.entity, holder, clamp.id);
    const step = b ? this.stepFor(station, b, clamp.id, 'raise') : undefined;
    if (step && up && !this.setupDone(station, step.id)) this.setup(station, step.id);
    if (step && !up) {
      this.deps.entityStates.set(station.id, `setup.${step.id}`, false);
      this.syncSetupReady(station);
    }
    this.changed(station);
  }

  /** Out of its clamp, back to physics where it is (its tap closed); nothing if it was not in one. */
  private unclamp(b: Bound): void {
    const at = this.clampOf(b.entity.id);
    if (at === null) return;
    this.deps.entityStates.set(at.holder.id, 'holding', '');
    this.taps.delete(b.entity.id);
    this.deps.entityStates.set(b.entity.id, 'tapOpen', false);
    this.deps.entityStates.set(b.entity.id, 'clamp', '');
    this.deps.driver.stopDriving(b.entity.id);
  }

  /** Why `b` may not be moved now: its run is in progress (refused with the run's reason), or null. */
  private runFrom(b: Bound): string | null {
    const station = b.station;
    return station.session.state === 'running' && this.isDriveSource(b)
      ? this.deps.texts.ui('station.waitForRun', 'Wait until the run has finished.')
      : null;
  }

  /** Whether `b` is its station's drive source (the burette whose tap is the run). */
  private isDriveSource(b: Bound): boolean {
    const drive = b.station.session.definition.workspace?.drive;
    return drive !== undefined && (drive.place === b.piece || drive.place === b.material);
  }

  /**
   * Where `b`'s tap runs: its station's drive receiver standing on its seat (under the tip by the
   * stand's own layout), else any of them (for its refusal), else null.
   */
  private tapReceiver(b: Bound): Bound | null {
    const onto = b.station.session.definition.workspace?.drive?.onto;
    let any: Bound | null = null;
    for (const other of this.bound.values()) {
      if (other.station !== b.station || other.piece !== onto) continue;
      const seat = this.deps.entityStates.get(other.entity.id, 'seat');
      if (typeof seat === 'string' && seat !== '') return other;
      any ??= other;
    }
    return any;
  }

  /** Why `b`'s tap may not be opened now, or null: clamped, not empty, and its run may go. */
  private tapBlock(b: Bound): string | null {
    const { texts } = this.deps;
    if (!b.container.tap || !this.isDriveSource(b)) return this.notThisStep();
    if (this.clampOf(b.entity.id) === null) {
      return texts.ui('station.clampFirst', 'Clamp it on the stand first.');
    }
    if (this.taps.has(b.entity.id)) return null;
    const dst = this.tapReceiver(b);
    if (!dst) return this.notThisStep();
    if (b.station.session.state === 'running' && this.vessels.get(b.station.id) !== dst.entity.id) {
      return texts.ui('station.running', 'The run is in progress.');
    }
    // The step the bench waits for first (fill the burette…), then an empty burette.
    const block = this.transferBlock(b, dst, 'pour');
    if (block) return block;
    if (totalUl(this.deps.state.world.containers[b.entity.id]?.contents ?? {}) <= 0) {
      return texts.ui('station.empty', 'It is empty.');
    }
    return this.rateOf(b.station) > 0 ? null : this.notThisStep();
  }

  /** The tap's rate (mL/s): the model input the definition's `drive.rate` names, 0 without one. */
  private rateOf(station: Station): number {
    const rate = station.session.definition.workspace?.drive?.rate;
    if (rate === undefined) return 0;
    const inputs = station.session.run?.inputs ?? station.session.inputs(this.apparatus(station));
    const value = inputs[rate];
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** The vessels in a clamp now (entity ids, a reused list): a pour looks for their mouths. */
  clamped(): readonly string[] {
    const out = this.clampedIds;
    out.length = 0;
    for (const id of this.bound.keys()) if (this.clampOf(id) !== null) out.push(id);
    return out;
  }

  /** Whether the burette `entityId`'s tap is open (views draw its key). */
  tapOpen(entityId: string): boolean {
    return this.taps.has(entityId);
  }

  /** The open tap now, from which burette into which vessel (reused object), or null. */
  tapping(): { readonly from: string; readonly to: string } | null {
    for (const id of this.taps.keys()) {
      const b = this.bound.get(id);
      const dst = b ? this.tapReceiver(b) : null;
      if (dst) {
        this.tapPair.from = id;
        this.tapPair.to = dst.entity.id;
        return this.tapPair;
      }
    }
    return null;
  }

  /** Why the reading may not be recorded (the player ending the run) now, or null. */
  private recordBlock(b: Bound): string | null {
    const { texts } = this.deps;
    if (!b.container.tap || !this.isDriveSource(b)) return this.notThisStep();
    if (b.station.session.state !== 'running' || !this.vessels.has(b.station.id)) {
      return texts.ui('station.nothingToRecord', 'Open the tap first: nothing has run yet.');
    }
    return this.taps.has(b.entity.id)
      ? texts.ui('station.closeTapFirst', 'Close the tap first.')
      : null;
  }

  private openTap(b: Bound): void {
    if (this.taps.has(b.entity.id)) return;
    this.taps.set(b.entity.id, { rate: this.rateOf(b.station), owed: 0 });
    this.deps.entityStates.set(b.entity.id, 'tapOpen', true);
  }

  /**
   * One tick of an open tap: rate·dt of liquid, in whole µL (the rest owed to the next tick), from
   * the burette into the vessel under it, committed as a pour is — the first µL starts the driven
   * run, each one feeds it. Refused (STOP, RESET, the vessel taken away) or empty, it closes.
   */
  private flow(id: string, tap: Tap, dt: number): void {
    const b = this.bound.get(id);
    const dst = b ? this.tapReceiver(b) : null;
    if (!b || !dst || this.clampOf(id) === null || this.transferBlock(b, dst, 'pour') !== null) {
      this.taps.delete(id);
      this.deps.entityStates.set(id, 'tapOpen', false);
      return;
    }
    tap.owed += tap.rate * dt * UL_PER_ML;
    const want = Math.floor(tap.owed);
    if (want <= 0) return;
    tap.owed -= want;
    const moved = this.commit(b, dst, want);
    if (moved < want) tap.owed = 0; // empty: nothing more runs out of it
    if (moved > 0) this.changed(b.station);
  }

  // ---- rules --------------------------------------------------------------------------------

  private guard(entity: WorldEntity | null, actionId: string, pressed: boolean): string | null {
    if (!entity) return null;
    const { texts } = this.deps;
    if (actionId === 'grab') {
      for (const station of this.stations.values()) {
        if (station.kind !== 'launcher' || station.projectile !== entity || !station.driven) {
          continue;
        }
        if (station.flying) return texts.ui('station.inFlight', 'It is in flight.');
        return this.loadedBall(station) === entity
          ? texts.ui('station.loaded', 'It is loaded: take it out of the launcher first.')
          : texts.ui('station.resetToReload', 'Press RESET to put it back into the launcher.');
      }
      if (this.clampOf(entity.id) !== null) {
        return texts.ui('station.unclampFirst', 'Take it out of the clamp first.');
      }
      // The vessel a run is filling stays where it is until the run has ended.
      const b = this.bound.get(entity.id);
      return b &&
        this.vessels.get(b.station.id) === entity.id &&
        b.station.session.state === 'running'
        ? texts.ui('station.waitForRun', 'Wait until the run has finished.')
        : null;
    }
    switch (actionId) {
      case 'fill':
      case 'deliver':
      case 'drops':
      case 'stopper':
      case 'unstopper':
      case 'clamp':
      case 'raise-clamp':
      case 'lower-clamp':
      case 'unclamp':
      case 'open-tap':
      case 'close-tap':
      case 'record':
        return this.containerBlock(entity, actionId);
    }
    const station = this.stationFor(entity);
    if (!station) return null;
    switch (actionId) {
      case 'load':
      case 'run':
      case 'stop':
      case 'reset':
      case 'clear':
      case 'open-workspace':
        return (
          this.lockOf(station.id, actionId) ??
          this.refusalAt(station, actionId, undefined, undefined, pressed)
        );
      case 'raise':
      case 'lower':
        return (
          this.lockOf(station.id, 'adjust') ??
          this.refusalAt(
            station,
            'adjust',
            String(entity.params.parameter),
            actionId === 'raise' ? 1 : -1,
            pressed,
          )
        );
      case 'view-results':
        return this.refusalAt(station, 'view', undefined, undefined, pressed);
      default:
        return null;
    }
  }

  /**
   * Why RUN is refused now, or null; `pressed`: by the player (`perform`), not a prompt or view.
   * A workspace's setup comes first: RUN waits for the next before-run step.
   */
  private runBlock(station: Station, pressed = false): string | null {
    const { texts } = this.deps;
    const state = station.session.state;
    const pending = state === 'idle' || state === 'configured' ? this.pendingSetup(station) : null;
    if (pending) return texts.of(pending, 'refusal');
    switch (state) {
      case 'idle':
        return station.kind === 'launcher'
          ? texts.ui('station.loadFirst', 'Load a projectile ball into the launcher first.')
          : texts.ui('station.notReady', 'The apparatus is not ready.');
      case 'running':
        return texts.ui('station.running', 'The run is in progress.');
      case 'stopped':
      case 'completed':
        return texts.ui('station.resetFirst', 'Press RESET before the next run.');
      case 'configured': {
        const apparatus = this.apparatus(station);
        const theory = station.session.prediction(apparatus);
        if (theory.ok) {
          return this.limits(station)(station.session.inputs(apparatus), theory.value ?? {});
        }
        // The player reads why; the log keeps the model's own words, once per RUN pressed.
        if (pressed) this.deps.log.warn(`${station.id}: ${theory.error}`);
        return texts.ui(
          'station.cannotRun',
          'The model does not cover these settings: change a dial.',
        );
      }
    }
  }

  /** Why one dial click on parameter `id` is refused now, or null. */
  private dialBlock(station: Station, id: string | undefined, direction: 1 | -1): string | null {
    const session = station.session;
    const { texts } = this.deps;
    if (session.state === 'running') {
      return texts.ui('station.stopFirst', 'Stop the run before changing its parameters.');
    }
    const p = id === undefined ? undefined : session.parameter(id);
    const value = p && session.parameters[p.id];
    if (!p || value === undefined) return this.noSetting();
    if (session.nextValue(p.id, direction) !== value) return null;
    const at = { quantity: p.symbol ?? texts.of(p, 'label'), value, unit: p.unit };
    return direction > 0
      ? texts.ui('station.atMaximum', '{quantity} is already at its maximum: {value} {unit}.', at)
      : texts.ui('station.atMinimum', '{quantity} is already at its minimum: {value} {unit}.', at);
  }

  /** Why setting parameter `id` to `value` is refused now: only presets or step-grid values. */
  private setBlock(station: Station, id: string | undefined, value: number): string | null {
    const session = station.session;
    const { texts } = this.deps;
    if (session.state === 'running') {
      return texts.ui('station.stopFirst', 'Stop the run before changing its parameters.');
    }
    const p = id === undefined ? undefined : session.parameter(id);
    if (!p) return this.noSetting();
    if (session.accepts(p.id, value) && !this.locked(station, p.id, value)) return null;
    if (session.accepts(p.id, value)) {
      return texts.ui(
        'station.settingLocked',
        '{quantity} is already fixed by a finished step: clear the bench to change it.',
        { quantity: p.symbol ?? texts.of(p, 'label') },
      );
    }
    return texts.ui('station.notASetting', '{quantity} cannot be set to {value}.', {
      quantity: p.symbol ?? texts.of(p, 'label'),
      value: `${value} ${p.unit}`.trim(),
    });
  }

  /**
   * Whether a finished step that still applies named parameter `id` in its `locks` (and `value`
   * would change it). `clear` starts the steps over, so it unlocks them.
   */
  private locked(station: Station, id: string, value: number): boolean {
    if (station.session.parameters[id] === value) return false;
    return applying(station).some(
      (step) => step.locks?.includes(id) && this.setupDone(station, step.id),
    );
  }

  /** Why setup step `id` cannot be done now (`setupGate.ts`), or null. */
  private setupBlock(station: Station, id: string): string | null {
    const { texts } = this.deps;
    const refusal = setupRefusal(
      applying(station),
      id,
      (step) => this.setupDone(station, step),
      station.session.state === 'completed',
    );
    switch (refusal?.kind) {
      case undefined:
        return null;
      case 'unknown':
        return texts.ui('station.noSuchStep', 'There is no such step at this apparatus.');
      case 'done':
        return texts.ui('station.stepDone', 'That step is already done.');
      case 'waits':
        return texts.of(refusal.step, 'refusal');
      case 'needs-run':
        return texts.ui('station.runFirst', 'Complete a run first.');
    }
  }

  private noSetting(): string {
    return this.deps.texts.ui('station.noSetting', 'This apparatus has no such setting.');
  }

  private noWorkspace(): string {
    return this.deps.texts.ui('station.noWorkspace', 'This apparatus has no workspace.');
  }

  /**
   * What the room and the apparatus allow beyond the parameter ranges, with the reason: a shot
   * must land inside the lane and stay below the ceiling; a pendulum must swing, clear the floor
   * and stay clear of the walls; a dropped ball starts no higher than its tower's clamp reaches —
   * the ideal models have no walls, so such runs are refused.
   */
  private limits(station: Station): RunCheck {
    const { texts } = this.deps;
    if (station.kind === 'bench') return () => null;
    if (station.kind === 'spring') {
      // Hooke's law holds only while the spring stays elastic and stretched: no run whose swing
      // could pass the elastic limit or take the spring shorter than its natural length.
      return (_inputs, theory) => {
        const peak = theory.peak ?? 0;
        const lowest = theory.lowest ?? 0;
        if (peak > station.elasticLimit) {
          return texts.ui(
            'station.beyondElastic',
            'This load is beyond the elastic limit of the spring: let go, the mass could stretch it to {peak} m ({extension} m at rest), more than the {limit} m it can take. Lower m or y₀, or use a stiffer spring.',
            {
              peak: peak.toFixed(2),
              extension: (theory.extension ?? 0).toFixed(2),
              limit: station.elasticLimit.toFixed(2),
            },
          );
        }
        return lowest < 0
          ? texts.ui(
              'station.springSlack',
              'Too far for this load: at rest the spring stretches {extension} m, so a swing of {swing} m could take it shorter than its natural length, which this model does not cover. Choose a smaller y₀ or a heavier mass.',
              {
                extension: (theory.extension ?? 0).toFixed(3),
                swing: ((theory.peak ?? 0) - (theory.extension ?? 0)).toFixed(3),
              },
            )
          : null;
      };
    }
    if (station.kind === 'drop') {
      return (inputs) =>
        (inputs.height ?? 0) > station.highest
          ? texts.ui(
              'station.towerTooHigh',
              'Too high: this tower releases from up to {highest} m. Lower h.',
              { highest: station.highest.toFixed(2) },
            )
          : null;
    }
    if (station.kind === 'launcher') {
      const radius = this.radiusOf(this.loadedBall(station) ?? station.projectile);
      return (_inputs, theory) => {
        const range = theory.range ?? 0;
        const top = (theory.maxHeight ?? 0) + 2 * radius;
        if (range > station.lane) {
          return texts.ui(
            'station.outOfRange',
            'Out of range: it would land {range} m away, beyond the {lane} m lane. Lower v₀, or change θ or g.',
            { range: range.toFixed(1), lane: station.lane.toFixed(1) },
          );
        }
        if (top > station.ceiling) {
          return texts.ui(
            'station.shotTooHigh',
            'Too high: it would rise to {top} m, above the {ceiling} m the hall allows. Lower v₀ or θ.',
            { top: top.toFixed(1), ceiling: station.ceiling.toFixed(1) },
          );
        }
        return null;
      };
    }
    return (inputs, theory) => {
      const amplitude = theory.amplitude ?? 0;
      const length = inputs.length ?? 0;
      const r = station.bobRadius;
      if (amplitude < 1e-6) {
        return texts.ui(
          'station.noAngle',
          'Set a release angle: at 0° the pendulum just hangs there.',
        );
      }
      if (!Number.isFinite(theory.period ?? NaN)) {
        return texts.ui('station.overTheTop', 'It would swing over the top: lower θ₀.');
      }
      const longest = station.pivotHeight - FLOOR_GAP - r;
      if (length > longest) {
        return texts.ui(
          'station.tooLong',
          'Too long: the bob would hit the floor. This stand takes L up to {longest} m.',
          { longest: longest.toFixed(2) },
        );
      }
      const out = length * Math.sin(Math.min(amplitude, Math.PI / 2)) + r;
      if (out > station.reach) {
        return texts.ui(
          'station.tooWide',
          'Too wide: the bob would swing {out} m out, beyond the {reach} m free on each side. Shorten L or lower θ₀.',
          { out: out.toFixed(1), reach: station.reach.toFixed(1) },
        );
      }
      return null;
    };
  }

  // ---- helpers ------------------------------------------------------------------------------

  /**
   * Inputs the apparatus supplies: the launch height, the bob's mass, or the spring's natural
   * length (a tower, a bench: none).
   */
  private apparatus(station: Station): Record<string, number> {
    if (station.kind === 'drop' || station.kind === 'bench') return {};
    if (station.kind === 'spring') return { naturalLength: station.naturalLength };
    if (station.kind === 'pendulum') return { mass: station.bobMass };
    const ball = this.loadedBall(station) ?? station.projectile;
    return { height: this.launchHeight(station, this.radiusOf(ball)) };
  }

  /** Launch height of the ball's lowest point above the floor. */
  private launchHeight(station: LauncherStation, radius: number): number {
    return station.launch[1] - radius - station.floor;
  }

  /** Model coordinates → world: x along the launch direction, y above the floor (lowest point). */
  private placeAt(station: LauncherStation, ball: WorldEntity, x: number, y: number): void {
    toWorld(station, this.radiusOf(ball), x, y, ball.pose.position);
  }

  private radiusOf(ball: WorldEntity | null): number {
    return ball ? ball.item.visual.size[1] / 2 : 0;
  }

  private accepts(station: LauncherStation): string {
    const accepts = station.entity.params.accepts;
    return typeof accepts === 'string' ? accepts : 'projectile';
  }

  private loadedBall(station: LauncherStation): WorldEntity | null {
    const id = this.deps.entityStates.get(station.id, 'loaded');
    return typeof id === 'string' && id !== '' && station.projectile?.id === id
      ? station.projectile
      : null;
  }

  /** The station an entity belongs to: the apparatus itself, or a control naming it. */
  private stationFor(entity: WorldEntity): Station | undefined {
    const own = this.stations.get(entity.id);
    if (own) return own;
    const placement = entity.params.station;
    return typeof placement === 'string'
      ? this.stations.get(`${entity.roomId}/${placement}`)
      : undefined;
  }

  private mark(station: Station, milestone: string): void {
    let done = this.progress.get(station.id);
    if (!done) this.progress.set(station.id, (done = new Set()));
    if (done.has(milestone)) return;
    done.add(milestone);
    this.changed(station);
  }

  /** Mirrors the state for instruments (entity state) and tells views to refresh. */
  private changed(station: Station): void {
    // A burette's tap runs the run: the reading can be recorded while that run is in progress.
    const running = station.session.state === 'running' && this.vessels.has(station.id);
    for (const b of this.bound.values()) {
      if (b.station === station && b.container.tap) {
        this.deps.entityStates.set(b.entity.id, 'run', running);
      }
    }
    this.deps.entityStates.set(station.id, 'state', station.session.state);
    this.deps.events.publish('ExperimentStationChanged', { stationId: station.id });
  }

  private describe(station: Station): StationView {
    const done = this.progress.get(station.id);
    const checklist = station.session.definition.procedure.map((step) => ({
      instruction: this.deps.texts.of(step, 'instruction'),
      done: done?.has(milestoneKey(step.done)) ?? false,
    }));
    const next = checklist.findIndex((step) => !step.done);
    const base = {
      id: station.id,
      definition: station.session.definition,
      session: station.session,
      checklist,
      next: next < 0 ? checklist.length : next,
      runBlock: this.runBlock(station),
      setup: applying(station).map((step) => ({ step, done: this.setupDone(station, step.id) })),
    };
    if (station.kind === 'pendulum') {
      return { ...base, kind: 'pendulum', bobRadius: station.bobRadius };
    }
    if (station.kind === 'drop') return { ...base, kind: 'drop', ballRadius: station.ballRadius };
    if (station.kind === 'bench') {
      return { ...base, kind: 'bench', model: station.model, pose: station.pose };
    }
    if (station.kind === 'spring') {
      const { naturalLength, elasticLimit, session } = station;
      const held = session.predict(this.apparatus(station))?.start ?? 0;
      return { ...base, kind: 'spring', naturalLength, elasticLimit, held };
    }
    const radius = this.radiusOf(station.projectile);
    return {
      ...base,
      kind: 'launcher',
      launch: station.launch,
      direction: station.direction,
      floor: station.floor,
      lane: station.lane,
      radius,
      loaded: this.loadedBall(station) !== null,
      toWorld: (x, y, out) => toWorld(station, radius, x, y, out),
    };
  }
}

/** Whether room `roomId` is one of `rooms` (allocation-free). */
function inRooms(rooms: readonly RoomDefinition[], roomId: string): boolean {
  for (let i = 0; i < rooms.length; i++) if (rooms[i]?.id === roomId) return true;
  return false;
}

function toWorld(station: LauncherStation, radius: number, x: number, y: number, out: Vec3): Vec3 {
  out[0] = station.launch[0] + station.direction[0] * x;
  out[1] = station.floor + radius + y;
  out[2] = station.launch[2] + station.direction[2] * x;
  return out;
}
