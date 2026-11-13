import type {
  Collider,
  ColliderDesc,
  Cuboid,
  KinematicCharacterController,
  Ray,
  RigidBody,
  World as RapierWorld,
} from '@dimforge/rapier3d-compat';
import type { GameConfig } from '../core/config';
import { Disposables, type EventBus } from '../core/EventBus';
import { ENGLISH, type Texts } from '../core/i18n';
import type { Logger } from '../core/Logger';
import {
  clamp,
  directionFromYawPitch,
  lerp3,
  nlerpQuat,
  type Quat,
  rotate,
  turnView,
  type Vec3,
} from '../core/math';
import { describeError, type GameSystem } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';
import type { DoorDriver } from '../gameplay/door/DoorSystem';
import type { HingeDriver } from '../gameplay/door/HingeSystem';
import {
  headingOf,
  heldClearance,
  holdPoint,
  holdRotation,
  type LineOfSight,
  mulQuat,
  type ObjectHolder,
  type RayHit,
  type SetDownPlan,
  tiltOf,
  turnYaw,
} from '../gameplay/interaction/hold';
import type { ItemDefinition } from '../gameplay/item';
import type { RoomDefinition } from '../world/definitions';
import type { EntityStates } from '../world/EntityStates';
import { leafPose, swingAngle } from '../world/hinge';
import { roomSlabs } from '../world/roomGeometry';
import type { World, WorldEntity } from '../world/World';
import { loadRapier, type Rapier } from './rapier';

/** Gap (m) the character controller keeps from surfaces; subtracted so feet read y = floor. */
const SKIN = 0.01;
const MAX_FALL_SPEED = 50; // m/s
/** Distance (m) over which a grounded capsule is pulled back onto the floor. */
const SNAP_DISTANCE = 0.1;
const EPS = 1e-9;
/**
 * A step's change of velocity (m/s), beyond gravity's, that is an impact: a ball dropped from 3 cm
 * (0.77 m/s) knocks; rolling, sliding and damping change it by far less per step.
 */
const IMPACT_MIN = 0.7;
/** After an impact a body is quiet this long (s): a bounce train knocks, a jitter does not. */
const IMPACT_QUIET_S = 0.08;
/** A pour spout further than this (m) from its item's axis is held ahead of the view (grab). */
const SPOUT_OFF_AXIS = 0.005;

// Collision groups are (membership << 16) | filter. Everything else stays in every group; the
// player capsule and a held object exclude each other, so a carried object can neither block
// nor shove the player, and the character controller ignores it.
const ALL = 0xffff;
const PLAYER = 0x0002;
const HELD = 0x0004;
/** People who are not the player (Phase Y): obstacles, never in the way of an aim ray. */
const AGENT = 0x0008;
const groups = (member: number, filter: number) => ((member << 16) | filter) >>> 0;
const DEFAULT_GROUPS = groups(ALL, ALL);
const PLAYER_GROUPS = groups(PLAYER, ALL & ~HELD);
const HELD_GROUPS = groups(HELD, ALL & ~PLAYER);
const AGENT_GROUPS = groups(AGENT, ALL);
/** What an aim ray meets: everything but people (one is looked at by the box around them). */
const RAY_GROUPS = groups(ALL, ALL & ~AGENT);
/** A person's capsule (m). */
const AGENT_RADIUS = 0.28;
/** Time constant (s) of the hold drive: a held body closes its gap exponentially at this rate. */
const HOLD_RESPONSE = 0.08;
/** Top speed (m/s) of a held body chasing the hold point, so a fast turn cannot fling it. */
const MAX_HOLD_SPEED = 8;
/** Gap (m) a held body keeps from static surfaces it is swept against. */
const HOLD_CLEARANCE = 0.002;
/** Top turning speed (rad/s) of a driven orientation: a 1/60 s step turns at most 0.067 rad. */
const MAX_TURN_SPEED = 4;
/** A set-down surface faces up: its normal is within 10° of +y. */
const LEVEL_COS = Math.cos((10 * Math.PI) / 180);
/** How far (m) above the spot a set-down's resting height is probed from (shape cast down). */
const PROBE_HEIGHT = 0.05;
/** A set-down rests on a surface no higher (m) than the aimed spot plus this, or it is no room. */
const STEP_TOLERANCE = 0.01;
/** Gap (m) a set-down is driven to above its surface; it is let go there and settles onto it. */
const SET_DOWN_GAP = 0.001;
/** A set-down is let go once this close (m, rad) to its rest pose, or after SETTLE_S anyway. */
const SETTLE_DISTANCE = 0.001;
const SETTLE_ANGLE = 0.01;
const SETTLE_S = 1;
/** An upright item let go tipped less than this (2°) is locked as it is; more: stood up first. */
const UPRIGHT_TILT = (2 * Math.PI) / 180;
const UPRIGHT: Readonly<Quat> = [0, 0, 0, 1];
/** A let-go glass is at rest once slower than this (m/s, and 1 rad/s) for REST_STEPS steps. */
const REST_SPEED = 0.05;
const REST_STEPS = 15;
const ZERO: Readonly<Vec3> = [0, 0, 0];

type Seat = NonNullable<ItemDefinition['seats']>[number];

interface EntityBody {
  readonly body: RigidBody;
  readonly entity: WorldEntity;
  readonly dynamic: boolean;
  /** Its item's `physical.handling` is not "free": held upright, set down, never dropped. */
  readonly oriented: boolean;
  /** Its pose one step before the last (drawing only: see `renderPose`). */
  readonly previousPosition: Vec3;
  readonly previousRotation: Quat;
  /** Its velocity just before the last step (m/s): an impact is a change gravity does not explain. */
  readonly previousVelocity: Vec3;
  /** The physics clock (s) before which it makes no new impact (one knock, not a rattle). */
  quietUntil: number;
}

/** A set-down on its way to its rest pose (weightless and passing the player, as when held). */
interface Settle {
  readonly position: Vec3;
  readonly rotation: Quat;
  seconds: number;
}

interface PlayerBody {
  readonly body: RigidBody;
  readonly collider: Collider;
  /** Half the capsule's total height (m): body origin = feet + halfHeight + SKIN. */
  readonly halfHeight: number;
}

/** A walk-through door's leaf: a kinematic body the door system slides along its own +x. */
interface Leaf {
  readonly body: RigidBody;
  /** Where its box centre stands closed (its entity pose, which never moves). */
  readonly closed: Readonly<Vec3>;
  /** Its full slide (m), along the world direction its local +x points. */
  readonly slide: Readonly<Vec3>;
  /** The opening fraction asked for, and the one its body was last sent to. */
  f: number;
  applied: number;
}

/** An item's hinged leaves: a kinematic body each, turned about its hinge by the hinge system. */
interface Swing {
  readonly entity: WorldEntity;
  readonly bodies: readonly RigidBody[];
  /** The opening fraction asked for, and the one its bodies were last sent to. */
  f: number;
  applied: number;
}

/**
 * idle: booted, Rapier not downloaded (menu) · loading: Rapier downloading/initializing ·
 * ready: world exists · failed: last load failed (a new load() retries) · disposed: shut down.
 */
export type PhysicsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'disposed';

export interface PhysicsStats {
  status: PhysicsStatus;
  /** True once the world exists (status ready). */
  active: boolean;
  /** How long the last successful load took, download included (ms). */
  loadMs: number | null;
  /** Entity whose body is currently held by the player, or null. */
  heldId: string | null;
  /** Bodies taken out of the simulation by a pose driver (a loaded or flying projectile). */
  driven: number;
  bodies: number;
  colliders: number;
  stepsLastFrame: number;
  /** Average wall-clock time of one step during the last frame that stepped (ms). */
  stepMs: number;
  grounded: boolean;
}

export interface BodySnapshot {
  id: string;
  position: Vec3;
  speed: number;
  sleeping: boolean;
  massKg: number;
  /** Out of the simulation (a pose driver owns it): position and speed are not current. */
  driven: boolean;
}

export interface PhysicsSystemDeps {
  state: GameState;
  world: World;
  entityStates: EntityStates;
  events: EventBus<GameEvents>;
  config: GameConfig;
  log: Logger;
  /** The language of the reason a failed load gives (English without it). */
  texts?: Texts;
}

/**
 * Owns the Rapier world: static colliders for rooms and items, dynamic bodies for items whose
 * `physical.body` is "dynamic", kinematic door leaves it slides for the door system (DoorDriver),
 * and the player's kinematic capsule driven by a character controller. It is the only module that
 * knows Rapier exists.
 *
 * Loading is lazy: `init()` (boot) only subscribes; `load()` downloads Rapier and creates the
 * world, and SceneManager awaits it before building the first world scene, so the menu never
 * downloads Rapier and no world scene exists without physics.
 *
 * Ownership follows the World's events: EntitySpawned/Despawned create/remove item bodies,
 * SceneLoaded/Unloaded build/remove room slabs and the player capsule, SceneAttached/Detached a
 * neighbour scene's room slabs (the capsule stays). Physics steps on a fixed timestep, only while
 * playing, and writes results back to GameState (player feet position, grounded) and to each
 * dynamic entity's Pose, which rendering and interaction read.
 */
export class PhysicsSystem
  implements GameSystem, ObjectHolder, LineOfSight, DoorDriver, HingeDriver
{
  readonly id = 'physics';
  private status: PhysicsStatus = 'idle';
  private loading: Promise<void> | null = null;
  private loadMs: number | null = null;
  private rapier: Rapier | null = null;
  private world: RapierWorld | null = null;
  private controller: KinematicCharacterController | null = null;
  private player: PlayerBody | null = null;
  /** One fixed body per room (the current scene's and resident neighbours'), by room id. */
  private readonly roomBodies = new Map<string, RigidBody>();
  /** Free bodies of a neighbour scene still coming in, disabled until its floors are built. */
  private readonly waiting = new Map<string, EntityBody[]>();
  private readonly bodies = new Map<string, EntityBody>();
  /** The dynamic subset, so per-step work scales with moving objects, not furniture. */
  private readonly dynamics = new Set<EntityBody>();
  /** Body handle → entity id, to name what a ray hit. */
  private readonly entityByBody = new Map<number, string>();
  /** The dynamic body the player holds; stays dynamic, driven towards the hold point. */
  private held: EntityBody | null = null;
  /** A held oriented body's tilt asked for, and its heading kept relative to the view (rad). */
  private holdTilt = 0;
  /** Where the held object's spout is held instead of the hold point (`setSpoutAt`), or null. */
  private spoutAt: Vec3 | null = null;
  private readonly spoutGoal: Vec3 = [0, 0, 0];
  private readonly spoutOffset: Vec3 = [0, 0, 0];
  private holdHeading = 0;
  /** The accepted set-down `planSetDown` found last, for `setDown` (the same frame). */
  private plan: { entry: EntityBody; position: Vec3; rotation: Quat } | null = null;
  /** Set-downs being driven to their rest pose. */
  private readonly settling = new Map<EntityBody, Settle>();
  /** Upright items let go tipped, by the steps they have been slow for (coming to rest). */
  private readonly uprighting = new Map<EntityBody, number>();
  private readonly rayHit: RayHit = { distance: 0, entityId: null, normal: [0, 0, 0] };
  private readonly targetRotation: Quat = [0, 0, 0, 1];
  private readonly scratchRotation: Quat = [0, 0, 0, 1];
  private readonly turnError: Quat = [0, 0, 0, 1];
  private readonly previousRelative: Quat = [0, 0, 0, 1];
  private readonly angular = { x: 0, y: 0, z: 0 };
  private readonly aim: Vec3 = [0, 0, 0];
  private readonly down = { x: 0, y: -1, z: 0 };
  private readonly driven = new Set<EntityBody>();
  /** Door leaves by entity id (kinematic bodies): moved inside the step, never written back. */
  private readonly leaves = new Map<string, Leaf>();
  /** People who are not the player, by id: a kinematic capsule each, moved inside the step. */
  private readonly agents = new Map<
    string,
    { body: RigidBody; halfHeight: number; x: number; z: number; applied: boolean }
  >();
  /** Hinged leaves by their item's entity id: turned inside the step, like door leaves. */
  private readonly swings = new Map<string, Swing>();
  private readonly leafTurn = { x: 0, y: 0, z: 0, w: 1 };
  private readonly leafCentre: Vec3 = [0, 0, 0];
  /** A box reused for doorway queries (its half extents are set before each). */
  private doorway: Cuboid | null = null;
  private ray: Ray | null = null;
  private readonly holdTarget: Vec3 = [0, 0, 0];
  private readonly velocity = { x: 0, y: 0, z: 0 };
  private readonly sweep = { x: 0, y: 0, z: 0 };
  private readonly zero = { x: 0, y: 0, z: 0 };
  private readonly subscriptions = new Disposables();
  private accumulator = 0;
  /** Seconds of physics stepped (impacts' quiet times). */
  private clock = 0;
  private verticalSpeed = 0;
  private grounded = false;
  private stepsLastFrame = 0;
  private stepMs = 0;
  /** Player feet position as last written by physics; any other value means a teleport. */
  private readonly synced: Vec3 = [NaN, NaN, NaN];
  /** The player's feet one step before the last (drawing only: see `renderPlayer`). */
  private readonly previousPlayer: Vec3 = [0, 0, 0];
  /** How far the time not yet stepped reaches into the next step (0–1). */
  private alpha = 0;
  /** The views (rad) the last step and the one before held towards, for drawing what is held. */
  private stepYaw = 0;
  private stepPitch = 0;
  private previousStepYaw = 0;
  private previousStepPitch = 0;
  private readonly drawnEye: Vec3 = [0, 0, 0];
  private readonly heldOffset: Vec3 = [0, 0, 0];
  private readonly previousHeldOffset: Vec3 = [0, 0, 0];
  // Reused Rapier vectors so stepping does not allocate.
  private readonly desired = { x: 0, y: 0, z: 0 };
  private readonly movement = { x: 0, y: 0, z: 0 };
  private readonly next = { x: 0, y: 0, z: 0 };
  private readonly t = { x: 0, y: 0, z: 0 };
  private readonly q = { x: 0, y: 0, z: 0, w: 1 };
  private readonly leafAt = { x: 0, y: 0, z: 0 };
  private readonly queryAt = { x: 0, y: 0, z: 0 };
  private readonly queryTurn = { x: 0, y: 0, z: 0, w: 1 };

  constructor(private readonly deps: PhysicsSystemDeps) {}

  /** Boot: subscribe only. Rapier is not downloaded until a world scene calls `load()`. */
  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.addEntity(entity)));
    s.add(events.subscribe('EntityDespawned', ({ entityId }) => this.removeEntity(entityId)));
    s.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        if (kind === 'world') this.buildScene();
      }),
    );
    s.add(events.subscribe('SceneUnloaded', () => this.clearScene()));
    s.add(events.subscribe('SceneAttached', ({ sceneId }) => this.attachRooms(sceneId)));
    s.add(events.subscribe('SceneDetached', ({ sceneId }) => this.detachRooms(sceneId)));
  }

  /**
   * Downloads and initializes Rapier and creates the world. Concurrent and repeated calls share
   * one load (the world is never created twice); after a failure the next call retries.
   */
  load(): Promise<void> {
    if (this.status === 'disposed') return Promise.reject(new Error('Physics has been disposed'));
    this.loading ??= this.createWorld().catch((error: unknown) => {
      this.loading = null;
      if (this.status !== 'disposed') this.status = 'failed';
      this.deps.log.error('Physics engine could not be loaded', error);
      const texts = this.deps.texts ?? ENGLISH;
      const reason = describeError(error);
      throw new Error(
        texts.ui('physics.loadFailed', 'Physics engine could not be loaded: {reason}', { reason }),
        { cause: error },
      );
    });
    return this.loading;
  }

  private async createWorld(): Promise<void> {
    this.status = 'loading';
    const started = performance.now();
    const rapier = await loadRapier();
    if (this.disposed) return; // the game shut down while Rapier was loading
    const { config, log } = this.deps;
    this.rapier = rapier;
    this.world = new rapier.World({ x: 0, y: -config.physics.gravity, z: 0 });
    this.world.timestep = config.physics.fixedStep;
    // Rapier 0.21 panics ("unreachable") in a world whose first step was zero-length (see
    // buildScene) when a body is disabled before the next real step, e.g. Continue into the
    // Physics Lab with a ball in the launcher. One real step of the still-empty world avoids it.
    this.world.step();
    const controller = this.world.createCharacterController(SKIN);
    controller.setSlideEnabled(true);
    // Keeps a grounded capsule on the floor without pushing into it every step (see moveCharacter).
    controller.enableSnapToGround(SNAP_DISTANCE);
    // Objects are obstacles for now; pushing them belongs with grab/throw handling (Phase 3).
    controller.setApplyImpulsesToDynamicBodies(false);
    // shortcut: no autostep — every floor is flat; enable it when stairs or thresholds exist.
    this.controller = controller;
    this.status = 'ready';
    this.loadMs = performance.now() - started;
    for (const entity of this.deps.world.allEntities()) this.addEntity(entity);
    log.info(`Physics ready in ${this.loadMs.toFixed(0)} ms (Rapier ${rapier.version()})`);
  }

  update(dt: number): void {
    const world = this.world;
    this.stepsLastFrame = 0;
    if (!world || this.deps.state.session.phase !== 'playing') {
      this.accumulator = 0; // a pause must not turn into a burst of catch-up steps
      this.snapDrawn(); // nothing steps: draw what is (a scene load may have moved the player)
      return;
    }
    const { fixedStep, maxSubSteps } = this.deps.config.physics;
    this.applyTeleport();
    this.accumulator = Math.min(this.accumulator + dt, fixedStep * maxSubSteps);
    const start = performance.now();
    while (this.accumulator >= fixedStep - EPS) {
      this.accumulator -= fixedStep;
      this.moveCharacter(fixedStep);
      this.driveHeld();
      this.settle(fixedStep);
      this.standUp();
      this.moveLeaves();
      this.moveAgents();
      this.rememberPrevious();
      world.step();
      this.detectImpacts(fixedStep);
      this.stepYaw = this.deps.state.player.yaw; // the view driveHeld held towards this step
      this.stepPitch = this.deps.state.player.pitch;
      this.stepsLastFrame++;
    }
    this.alpha = clamp(this.accumulator / fixedStep, 0, 1);
    if (this.stepsLastFrame > 0) {
      this.stepMs = (performance.now() - start) / this.stepsLastFrame;
      this.writeBack();
    }
  }

  // ---- Drawing between steps -------------------------------------------------------------------
  // Physics steps at a fixed rate; the screen may refresh faster (300 Hz). Drawn as last
  // stepped, bodies and the player's position would move in 1/60 s jumps under a view that
  // turns every frame: what is drawn is instead the last two steps blended by the time not yet
  // stepped — the world one step ago, moving evenly. Drawing only: the poses physics writes to
  // the game state (what gameplay, aiming and experiments read) are untouched.

  /** The player's feet (m) as drawn this frame. */
  renderPlayer(out: Vec3): Vec3 {
    const position = this.deps.state.player.position;
    if (!this.player) return lerp3(position, position, 0, out);
    return lerp3(this.previousPlayer, position, this.alpha, out);
  }

  /**
   * A dynamic body's pose as drawn this frame, or false: not a dynamic body here, or driven (its
   * driver poses it every frame; blending it again would lag it).
   */
  renderPose(entityId: string, position: Vec3, rotation: Quat): boolean {
    const entry = this.bodies.get(entityId);
    if (!entry?.dynamic || this.driven.has(entry)) return false;
    const pose = entry.entity.pose;
    if (entry === this.held) {
      // What is held follows the view, which turns every frame. Blended in the world it would
      // lag the view by a varying part of a step and wander; instead its place as seen from the
      // eye at each of the last two steps is blended, then shown in the view as it is now.
      const player = this.deps.state.player;
      const eye = player.eyeHeight;
      const prev = this.previousHeldOffset;
      const curr = this.heldOffset;
      for (let i = 0; i < 3; i++) {
        prev[i] = (entry.previousPosition[i] ?? 0) - (this.previousPlayer[i] ?? 0);
        curr[i] = (pose.position[i] ?? 0) - (player.position[i] ?? 0);
      }
      prev[1] -= eye;
      curr[1] -= eye;
      turnView(prev, this.previousStepYaw, this.previousStepPitch, 0, 0, prev);
      turnView(curr, this.stepYaw, this.stepPitch, 0, 0, curr);
      lerp3(prev, curr, this.alpha, curr);
      turnView(curr, 0, 0, player.yaw, player.pitch, curr);
      this.renderPlayer(this.drawnEye);
      for (let i = 0; i < 3; i++) position[i] = (this.drawnEye[i] ?? 0) + (curr[i] ?? 0);
      position[1] += eye;
      if (entry.oriented) {
        // Turned with the view too: its rotation relative to each step's view yaw is blended,
        // then turned by the view as it is now — so it never turns in 1/60 s jumps.
        const before = turnYaw(
          entry.previousRotation,
          -this.previousStepYaw,
          this.previousRelative,
        );
        turnYaw(pose.rotation, -this.stepYaw, rotation);
        nlerpQuat(before, rotation, this.alpha, rotation);
        turnYaw(rotation, player.yaw, rotation);
      } else {
        for (let i = 0; i < 4; i++) rotation[i] = pose.rotation[i] ?? 0; // held steady: not turned
      }
      return true;
    }
    lerp3(entry.previousPosition, pose.position, this.alpha, position);
    nlerpQuat(entry.previousRotation, pose.rotation, this.alpha, rotation);
    return true;
  }

  /** Before a step: where things are now becomes "one step before" once it has run. */
  private rememberPrevious(): void {
    this.previousStepYaw = this.stepYaw;
    this.previousStepPitch = this.stepPitch;
    const player = this.player;
    if (player) {
      const t = player.body.translation(this.t);
      this.previousPlayer[0] = t.x;
      this.previousPlayer[1] = t.y - player.halfHeight - SKIN;
      this.previousPlayer[2] = t.z;
    }
    for (const entry of this.dynamics) {
      if (this.driven.has(entry)) continue;
      const t = entry.body.translation(this.t);
      const q = entry.body.rotation(this.q);
      const p = entry.previousPosition;
      const r = entry.previousRotation;
      p[0] = t.x;
      p[1] = t.y;
      p[2] = t.z;
      r[0] = q.x;
      r[1] = q.y;
      r[2] = q.z;
      r[3] = q.w;
      const v = entry.body.linvel(this.t);
      entry.previousVelocity[0] = v.x;
      entry.previousVelocity[1] = v.y;
      entry.previousVelocity[2] = v.z;
    }
  }

  /**
   * After a step: each free dynamic body whose velocity changed by more than gravity explains, by
   * at least IMPACT_MIN, struck something — an `Impact` at that speed (for its sound). Held and
   * driven bodies are moved, not struck; a body that just knocked is quiet for IMPACT_QUIET_S.
   */
  private detectImpacts(dt: number): void {
    this.clock += dt;
    const fall = this.deps.config.physics.gravity * dt;
    for (const entry of this.dynamics) {
      const { body } = entry;
      if (entry === this.held || this.driven.has(entry) || body.isSleeping()) continue;
      const v = body.linvel(this.t);
      const p = entry.previousVelocity;
      const change = Math.hypot(v.x - p[0], v.y - p[1] + fall, v.z - p[2]);
      if (change < IMPACT_MIN || this.clock < entry.quietUntil) continue;
      entry.quietUntil = this.clock + IMPACT_QUIET_S;
      const t = body.translation(this.t);
      this.deps.events.publish('Impact', {
        entityId: entry.entity.id,
        speed: change,
        position: [t.x, t.y, t.z],
      });
    }
  }

  /** No blend: drawn where they are (after a teleport, a scene load, the end of driving). */
  private snapDrawn(): void {
    this.snapPlayer();
    for (const entry of this.dynamics) this.snapBody(entry);
  }

  private snapPlayer(): void {
    const { position, yaw, pitch } = this.deps.state.player;
    this.stepYaw = this.previousStepYaw = yaw;
    this.stepPitch = this.previousStepPitch = pitch;
    this.previousPlayer[0] = position[0];
    this.previousPlayer[1] = position[1];
    this.previousPlayer[2] = position[2];
  }

  private snapBody(entry: EntityBody): void {
    const { position, rotation } = entry.entity.pose;
    for (let i = 0; i < 3; i++) entry.previousPosition[i] = position[i] ?? 0;
    for (let i = 0; i < 4; i++) entry.previousRotation[i] = rotation[i] ?? 0;
  }

  dispose(): void {
    this.status = 'disposed';
    this.subscriptions.dispose();
    this.bodies.clear();
    this.dynamics.clear();
    this.leaves.clear();
    this.agents.clear();
    this.entityByBody.clear();
    this.held = null;
    this.plan = null;
    this.settling.clear();
    this.uprighting.clear();
    this.ray = null;
    this.doorway = null;
    this.roomBodies.clear();
    this.player = null;
    this.controller = null;
    this.world?.free(); // frees every body, collider and controller it owns
    this.world = null;
    this.rapier = null;
  }

  /** Fixed steps taken in the last frame (allocation-free, unlike `stats()`). */
  get stepsThisFrame(): number {
    return this.stepsLastFrame;
  }

  stats(): PhysicsStats {
    const world = this.world;
    return {
      status: this.status,
      active: world !== null,
      loadMs: this.loadMs,
      heldId: this.held?.entity.id ?? null,
      driven: this.driven.size,
      bodies: world?.bodies.len() ?? 0,
      colliders: world?.colliders.len() ?? 0,
      stepsLastFrame: this.stepsLastFrame,
      stepMs: this.stepMs,
      grounded: this.grounded,
    };
  }

  /** Live state of an entity's body, or null if it has none (debug panel, tests). */
  body(entityId: string): BodySnapshot | null {
    const entry = this.bodies.get(entityId);
    if (!entry) return null;
    const { body } = entry;
    const t = body.translation();
    const v = body.linvel();
    return {
      id: entityId,
      position: [t.x, t.y, t.z],
      speed: Math.hypot(v.x, v.y, v.z),
      sleeping: body.isSleeping(),
      massKg: body.mass(),
      driven: this.driven.has(entry),
    };
  }

  // ---- Holding (ObjectHolder) ----------------------------------------------------------------

  /**
   * Holds a dynamic body: it stays dynamic — so walls, the bench and other objects still stop
   * it through the contact solver — with gravity off, CCD on, and a velocity drive towards the
   * hold point each step. Its mass and materials are untouched.
   */
  grab(entityId: string): boolean {
    const entry = this.bodies.get(entityId);
    if (!entry?.dynamic || this.held || this.driven.has(entry)) return false;
    const { body } = entry;
    body.setGravityScale(0, true);
    body.enableCcd(true);
    body.collider(0).setCollisionGroups(HELD_GROUPS);
    this.settling.delete(entry); // grabbed again on its way down: held from where it is
    this.uprighting.delete(entry);
    if (entry.oriented) {
      // Held upright, keeping the heading it had relative to the view as the view turns; a spout
      // off its axis (a wash bottle's nozzle) is turned ahead, where the player looks.
      body.setEnabledRotations(true, true, true, true);
      const spout = entry.entity.item.container?.pour?.spout;
      this.holdHeading =
        spout && Math.hypot(spout[0], spout[2]) > SPOUT_OFF_AXIS
          ? -Math.atan2(-spout[0], -spout[2])
          : headingOf(this.rotationOf(body)) - this.deps.state.player.yaw;
    }
    this.holdTilt = 0;
    this.spoutAt = null;
    this.held = entry;
    return true;
  }

  /** Back to an ordinary dynamic body where it is now, moving at `velocity` (m/s). */
  release(velocity: Readonly<Vec3>): void {
    const entry = this.held;
    if (!entry) return;
    this.held = null;
    this.plan = null;
    this.holdTilt = 0;
    this.spoutAt = null;
    this.letGo(entry, velocity);
  }

  setHoldTilt(rad: number): void {
    this.holdTilt = rad;
  }

  setSpoutAt(point: Readonly<Vec3> | null): void {
    if (!point) this.spoutAt = null;
    else {
      this.spoutAt = this.spoutGoal;
      for (let i = 0; i < 3; i++) this.spoutGoal[i] = point[i] ?? 0;
    }
  }

  /**
   * The aim ray (fixed and kinematic bodies only: glass is never stacked on dynamic objects) must
   * meet a surface within reach that faces up. A seat of that surface's item within its radius
   * takes the spot, if its `accepts` names one of the held item's tags. The held shape, upright
   * with its heading, is cast down onto the spot for its resting height (it must rest on the
   * spot's surface, not on something higher), and must overlap nothing there — the player's
   * capsule included, which a set-down no longer passes once let go.
   */
  planSetDown(): SetDownPlan {
    this.plan = null;
    const { held: entry, world, rapier } = this;
    if (!entry || !world || !rapier) return { ok: false, reason: 'no-surface' };
    const { player: state } = this.deps.state;
    const { reach } = this.deps.config.player;
    const Q = rapier.QueryFilterFlags;
    const ray = (this.ray ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }));
    directionFromYawPitch(state.yaw, state.pitch, this.aim);
    ray.origin.x = state.position[0];
    ray.origin.y = state.position[1] + state.eyeHeight;
    ray.origin.z = state.position[2];
    ray.dir.x = this.aim[0];
    ray.dir.y = this.aim[1];
    ray.dir.z = this.aim[2];
    const { body } = entry;
    const hit = world.castRayAndGetNormal(
      ray,
      reach + 1,
      true,
      Q.EXCLUDE_DYNAMIC | Q.EXCLUDE_SENSORS, // glass is never stacked on dynamic objects
      undefined,
      this.player?.collider,
      body,
    );
    if (!hit) return { ok: false, reason: 'no-surface' };
    if (hit.timeOfImpact > reach) return { ok: false, reason: 'too-far' };
    if (hit.normal.y < LEVEL_COS) return { ok: false, reason: 'not-level' };
    const spot: Vec3 = [
      ray.origin.x + ray.dir.x * hit.timeOfImpact,
      ray.origin.y + ray.dir.y * hit.timeOfImpact,
      ray.origin.z + ray.dir.z * hit.timeOfImpact,
    ];
    const surfaceId = this.entityOf(hit.collider);
    const seat = this.seatAt(surfaceId, spot);
    if (seat && !seat.accepts.some((tag) => entry.entity.item.tags.includes(tag))) {
      return { ok: false, reason: 'wrong-seat' };
    }
    const rotation = turnYaw([0, 0, 0, 1], headingOf(this.rotationOf(body)), [0, 0, 0, 1]);
    const bottom = entry.entity.item.visual.size[1] / 2; // the upright shape's lowest point
    const shape = body.collider(0).shape;
    const turn = { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] };
    const top = spot[1] + bottom + PROBE_HEIGHT;
    const y = this.restHeight(body, spot[0], top, spot[2], turn, 2 * PROBE_HEIGHT);
    if (y === null || Math.abs(y - bottom - spot[1]) > STEP_TOLERANCE) {
      return { ok: false, reason: 'no-room' };
    }
    const at = { x: spot[0], y, z: spot[2] };
    // Tested a hair above its rest, and never against the surface it is set on: the overlap test's
    // tolerance grows with the other shape, and the floor (one box for the whole room) took a
    // cylinder 0.5 mm above it as touching — in the larger labs of Phase U-2 even a hair above it.
    const above = { x: at.x, y: at.y + 2 * SET_DOWN_GAP, z: at.z };
    if (
      world.intersectionWithShape(
        above,
        turn,
        shape,
        Q.EXCLUDE_SENSORS,
        undefined,
        hit.collider,
        body,
      )
    ) {
      return { ok: false, reason: 'no-room' };
    }
    this.plan = { entry, position: [at.x, at.y, at.z], rotation };
    return { ok: true, surfaceId, seat: seat?.id ?? null };
  }

  /**
   * The height (m) of the body's centre resting, turned by `turn`, on the first fixed or
   * kinematic surface below (x, top, z) within `drop` m (SET_DOWN_GAP left), or null if none.
   */
  private restHeight(
    body: RigidBody,
    x: number,
    top: number,
    z: number,
    turn: { x: number; y: number; z: number; w: number },
    drop: number,
  ): number | null {
    const { world, rapier } = this.required();
    const Q = rapier.QueryFilterFlags;
    this.queryAt.x = x;
    this.queryAt.y = top;
    this.queryAt.z = z;
    const cast = world.castShape(
      this.queryAt,
      turn,
      this.down,
      body.collider(0).shape,
      SET_DOWN_GAP,
      drop,
      false,
      Q.EXCLUDE_DYNAMIC | Q.EXCLUDE_SENSORS,
      undefined,
      this.player?.collider,
      body,
    );
    return cast ? top - cast.time_of_impact : null;
  }

  setDown(): boolean {
    const plan = this.plan;
    this.plan = null;
    if (!plan || plan.entry !== this.held) return false;
    this.held = null;
    this.holdTilt = 0;
    this.settling.set(plan.entry, { position: plan.position, rotation: plan.rotation, seconds: 0 });
    return true;
  }

  /**
   * The seat of the surface entity's item nearest the spot within its radius, or null; `spot`
   * is then moved to that seat's centre (a set-down snaps into its seat).
   */
  private seatAt(surfaceId: string | null, spot: Vec3): Seat | null {
    const surface = surfaceId === null ? undefined : this.deps.world.entity(surfaceId);
    if (!surface?.item.seats) return null;
    const { position, rotation } = surface.pose;
    let best: Seat | null = null;
    let bestDistance = Infinity;
    const at: Vec3 = [0, 0, 0];
    for (const seat of surface.item.seats) {
      rotate(rotation, seat.center, at);
      const d = Math.hypot(position[0] + at[0] - spot[0], position[2] + at[2] - spot[2]);
      if (d <= seat.radius && d < bestDistance) {
        best = seat;
        bestDistance = d;
      }
    }
    if (!best) return null;
    rotate(rotation, best.center, at);
    for (let i = 0; i < 3; i++) spot[i] = (position[i] ?? 0) + (at[i] ?? 0);
    return best;
  }

  /** Lets a body go as an ordinary dynamic body, moving at `velocity`; upright items stay so. */
  private letGo(entry: EntityBody, velocity: Readonly<Vec3>): void {
    const { body, entity } = entry;
    body.setGravityScale(1, true);
    body.enableCcd(entity.item.physical.ccd);
    body.collider(0).setCollisionGroups(DEFAULT_GROUPS);
    this.velocity.x = velocity[0];
    this.velocity.y = velocity[1];
    this.velocity.z = velocity[2];
    body.setLinvel(this.velocity, true);
    body.setAngvel(this.zero, true);
    if (entity.item.physical.handling !== 'upright') return;
    // Tipped (let go mid-pour): free to fall as it will, then stood up once at rest (standUp).
    if (tiltOf(this.rotationOf(body)) < UPRIGHT_TILT)
      body.setEnabledRotations(false, true, false, true);
    else this.uprighting.set(entry, 0);
  }

  /** A body's rotation as a Quat (a reused array: read it at once). */
  private rotationOf(body: RigidBody): Quat {
    const q = body.rotation(this.q);
    const r = this.scratchRotation;
    r[0] = q.x;
    r[1] = q.y;
    r[2] = q.z;
    r[3] = q.w;
    return r;
  }

  /**
   * Turns a body towards `target` (angular velocity along the shortest turn, angle / the hold
   * time constant, at most MAX_TURN_SPEED); returns the angle (rad) still to go.
   */
  private turnTowards(body: RigidBody, target: Readonly<Quat>): number {
    const r = this.rotationOf(body);
    r[0] = -r[0]; // its inverse
    r[1] = -r[1];
    r[2] = -r[2];
    const e = mulQuat(target, r, this.turnError);
    const sinHalf = Math.hypot(e[0], e[1], e[2]);
    const angle = 2 * Math.atan2(sinHalf, Math.abs(e[3]));
    let k = sinHalf > 1e-9 ? (Math.sign(e[3]) || 1) * (angle / HOLD_RESPONSE / sinHalf) : 0;
    const speed = angle / HOLD_RESPONSE;
    if (speed > MAX_TURN_SPEED) k *= MAX_TURN_SPEED / speed;
    this.angular.x = e[0] * k;
    this.angular.y = e[1] * k;
    this.angular.z = e[2] * k;
    body.setAngvel(this.angular, true);
    return angle;
  }

  /** Each step: set-downs are driven to their rest pose, and let go there at rest. */
  private settle(h: number): void {
    for (const [entry, s] of this.settling) {
      const { body } = entry;
      const t = body.translation(this.t);
      const dx = s.position[0] - t.x;
      const dy = s.position[1] - t.y;
      const dz = s.position[2] - t.z;
      const angle = this.turnTowards(body, s.rotation);
      s.seconds += h;
      if (
        (Math.hypot(dx, dy, dz) < SETTLE_DISTANCE && angle < SETTLE_ANGLE) ||
        s.seconds >= SETTLE_S
      ) {
        this.settling.delete(entry);
        this.letGo(entry, ZERO);
        continue;
      }
      this.chase(body, dx, dy, dz);
    }
  }

  /**
   * Each step: an upright item let go tipped is stood up once it has come to rest (asleep, or
   * slow for a while: a glass lying on its side may roll for ever), then locked by `settle`.
   */
  private standUp(): void {
    for (const [entry, slow] of this.uprighting) {
      const { body } = entry;
      const v = body.linvel(this.t);
      const fast = Math.hypot(v.x, v.y, v.z) >= REST_SPEED;
      const w = body.angvel(this.t);
      const still = !fast && Math.hypot(w.x, w.y, w.z) < 1;
      const steps = still ? slow + 1 : 0;
      if (!body.isSleeping() && steps < REST_STEPS) {
        this.uprighting.set(entry, steps);
        continue;
      }
      // Stood up where it lies, lifted onto its base as it turns (turned in place, its edge
      // would press into the surface and stick): a set-down onto the surface below it.
      this.uprighting.delete(entry);
      const rotation: Quat = turnYaw(UPRIGHT, headingOf(this.rotationOf(body)), [0, 0, 0, 1]);
      const turn = { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] };
      const reach = Math.hypot(...entry.entity.item.visual.size) / 2; // its bounding sphere
      const t = body.translation(this.t);
      const y = this.restHeight(body, t.x, t.y + reach, t.z, turn, 2 * reach + PROBE_HEIGHT);
      if (y === null) continue; // nothing under it (it fell through?): left as it lies
      body.setGravityScale(0, true);
      this.settling.set(entry, { position: [t.x, y, t.z], rotation, seconds: 0 });
    }
  }

  /** Sets a body's velocity closing the gap (dx, dy, dz) at the hold drive's rate, capped. */
  /** A velocity that closes the gap (dx, dy, dz) in HOLD_RESPONSE, plus a carried one (m/s). */
  private chase(body: RigidBody, dx: number, dy: number, dz: number, cx = 0, cz = 0): void {
    let vx = cx + dx / HOLD_RESPONSE;
    let vy = dy / HOLD_RESPONSE;
    let vz = cz + dz / HOLD_RESPONSE;
    const speed = Math.hypot(vx, vy, vz);
    if (speed > MAX_HOLD_SPEED) {
      const k = MAX_HOLD_SPEED / speed;
      vx *= k;
      vy *= k;
      vz *= k;
    }
    this.velocity.x = vx;
    this.velocity.y = vy;
    this.velocity.z = vz;
    body.setLinvel(this.velocity, true);
  }

  private entityOf(collider: Collider): string | null {
    const parent = collider.parent();
    return parent ? (this.entityByBody.get(parent.handle) ?? null) : null;
  }

  // ---- Pose driver ---------------------------------------------------------------------------

  /**
   * Disables the body: Rapier neither simulates nor collides it (scene queries skip it too), and
   * write-back leaves its entity pose alone, so the driver's pose is what is drawn and targeted.
   */
  drive(entityId: string): boolean {
    const entry = this.bodies.get(entityId);
    if (!entry?.dynamic || this.held === entry) return false;
    entry.body.setEnabled(false);
    this.driven.add(entry);
    // The driver owns its pose now: a set-down or stand-up in progress must not pull it back.
    if (this.plan?.entry === entry) this.plan = null;
    this.settling.delete(entry);
    this.uprighting.delete(entry);
    return true;
  }

  /**
   * Re-enables the body at the entity's current pose with no velocity, as an ordinary dynamic
   * body (gravity, collision groups, CCD and the upright lock restored, as a let-go does).
   */
  stopDriving(entityId: string): void {
    const entry = this.bodies.get(entityId);
    if (!entry || !this.driven.delete(entry)) return;
    const { body, entity } = entry;
    const [x, y, z] = entity.pose.position;
    const [qx, qy, qz, qw] = entity.pose.rotation;
    this.next.x = x;
    this.next.y = y;
    this.next.z = z;
    body.setTranslation(this.next, false);
    this.q.x = qx;
    this.q.y = qy;
    this.q.z = qz;
    this.q.w = qw;
    body.setRotation(this.q, false);
    body.setEnabled(true);
    this.letGo(entry, ZERO); // zero velocity; undoes a set-down's weightless held state
    body.wakeUp();
    this.snapBody(entry); // drawn from where the driver left it, not from before it drove
  }

  // ---- Door driver ---------------------------------------------------------------------------

  /** Slides a door leaf to opening fraction f in the coming steps; anything else is ignored. */
  setDoorOpening(entityId: string, f: number): void {
    const leaf = this.leaves.get(entityId);
    if (leaf) leaf.f = f;
  }

  setSwing(entityId: string, f: number): void {
    const swing = this.swings.get(entityId);
    if (swing) swing.f = f;
  }

  /**
   * Whether a dynamic body's collider overlaps the box (centre, half extents, turned by rotationY
   * about +y), as of the last step: what a closing door must not slide into. Fixed, kinematic
   * (the player, the leaves) and sensor colliders are left out.
   */
  dynamicBodyIn(center: Readonly<Vec3>, halfExtents: Readonly<Vec3>, rotationY: number): boolean {
    const { world, rapier } = this;
    if (!world || !rapier) return false;
    const box = (this.doorway ??= new rapier.Cuboid(1, 1, 1));
    box.halfExtents.x = halfExtents[0];
    box.halfExtents.y = halfExtents[1];
    box.halfExtents.z = halfExtents[2];
    this.queryAt.x = center[0];
    this.queryAt.y = center[1];
    this.queryAt.z = center[2];
    this.queryTurn.y = Math.sin(rotationY / 2);
    this.queryTurn.w = Math.cos(rotationY / 2);
    const { QueryFilterFlags: Q } = rapier;
    return (
      world.intersectionWithShape(
        this.queryAt,
        this.queryTurn,
        box,
        Q.EXCLUDE_FIXED | Q.EXCLUDE_KINEMATIC | Q.EXCLUDE_SENSORS,
      ) !== null
    );
  }

  /** Before a step: a leaf whose fraction changed is sent there, and Rapier moves it in the step. */
  private moveLeaves(): void {
    for (const leaf of this.leaves.values()) {
      if (leaf.f === leaf.applied) continue;
      leaf.applied = leaf.f;
      this.leafAt.x = leaf.closed[0] + leaf.slide[0] * leaf.f;
      this.leafAt.y = leaf.closed[1] + leaf.slide[1] * leaf.f;
      this.leafAt.z = leaf.closed[2] + leaf.slide[2] * leaf.f;
      leaf.body.setNextKinematicTranslation(this.leafAt);
    }
    for (const swing of this.swings.values()) {
      if (swing.f === swing.applied) continue;
      swing.applied = swing.f;
      this.turnLeaves(swing, true);
    }
  }

  /**
   * Puts person `id`'s capsule (their `height`, m) standing at (x, z) in the current scene's
   * coordinates: made the first time, moved inside the next step after (Phase Y). It blocks the
   * player like a wall; aim rays pass it.
   */
  placeAgent(id: string, x: number, z: number, height: number): void {
    const { world, rapier } = this;
    if (!world || !rapier) return;
    let agent = this.agents.get(id);
    if (!agent) {
      const halfHeight = Math.max(height / 2, AGENT_RADIUS + 0.05);
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(x, halfHeight, z),
      );
      world.createCollider(
        rapier.ColliderDesc.capsule(halfHeight - AGENT_RADIUS, AGENT_RADIUS).setCollisionGroups(
          AGENT_GROUPS,
        ),
        body,
      );
      agent = { body, halfHeight, x, z, applied: true };
      this.agents.set(id, agent);
      return;
    }
    if (agent.x === x && agent.z === z) return;
    agent.x = x;
    agent.z = z;
    agent.applied = false;
  }

  /** Takes person `id`'s capsule away (they left the scene); nothing if there is none. */
  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.agents.delete(id);
    this.world?.removeRigidBody(agent.body);
  }

  private moveAgents(): void {
    for (const agent of this.agents.values()) {
      if (agent.applied) continue;
      agent.applied = true;
      this.leafAt.x = agent.x;
      this.leafAt.y = agent.halfHeight;
      this.leafAt.z = agent.z;
      agent.body.setNextKinematicTranslation(this.leafAt);
    }
  }

  /** Puts each of an item's hinged leaf bodies where its swing has turned it (next step, or now). */
  private turnLeaves(swing: Swing, next: boolean): void {
    const { entity } = swing;
    const hinged = entity.item.hinged;
    if (!hinged) return;
    const q = entity.pose.rotation;
    const yaw = 2 * Math.atan2(q[1], q[3]); // a placement turns about +y only
    const angle = swingAngle(swing.f, (hinged.angleDeg * Math.PI) / 180);
    for (let i = 0; i < hinged.leaves.length; i++) {
      const leaf = hinged.leaves[i];
      const body = swing.bodies[i];
      if (!leaf || !body) continue;
      const r = leafPose(entity.pose.position, yaw, leaf, leaf.opens * angle, this.leafCentre);
      this.leafAt.x = this.leafCentre[0];
      this.leafAt.y = this.leafCentre[1];
      this.leafAt.z = this.leafCentre[2];
      this.leafTurn.y = Math.sin(r / 2);
      this.leafTurn.w = Math.cos(r / 2);
      if (next) {
        body.setNextKinematicTranslation(this.leafAt);
        body.setNextKinematicRotation(this.leafTurn);
      } else {
        body.setTranslation(this.leafAt, true);
        body.setRotation(this.leafTurn, true);
      }
    }
  }

  // ---- Ray queries (LineOfSight) ------------------------------------------------------------

  /** First solid collider along the ray, ignoring the player capsule and the held object. */
  castRay(origin: Readonly<Vec3>, dir: Readonly<Vec3>, maxDistance: number): RayHit | null {
    const { world, rapier } = this;
    if (!world || !rapier) return null;
    const ray = (this.ray ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }));
    ray.origin.x = origin[0];
    ray.origin.y = origin[1];
    ray.origin.z = origin[2];
    ray.dir.x = dir[0];
    ray.dir.y = dir[1];
    ray.dir.z = dir[2];
    const hit = world.castRayAndGetNormal(
      ray,
      maxDistance,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      RAY_GROUPS,
      this.player?.collider,
      this.held?.body,
    );
    if (!hit) return null;
    const out = this.rayHit;
    out.distance = hit.timeOfImpact;
    out.entityId = this.entityOf(hit.collider);
    out.normal[0] = hit.normal.x;
    out.normal[1] = hit.normal.y;
    out.normal[2] = hit.normal.z;
    return out;
  }

  dynamicBodyIds(): string[] {
    return [...this.dynamics].map((b) => b.entity.id);
  }

  private buildScene(): void {
    const world = this.world;
    if (!world) return;
    this.clearScene();
    for (const room of this.deps.world.activeRooms) {
      this.roomBodies.set(room.id, this.createRoom(room));
    }
    this.createPlayer();
    this.registerColliders(world);
    this.accumulator = 0;
  }

  /**
   * A neighbour scene came beside the current one: its rooms' bodies (its entities came through
   * EntitySpawned). The player, the time not yet stepped and grounding go on as they were.
   */
  private attachRooms(sceneId: string): void {
    const world = this.world;
    if (!world) return;
    for (const room of this.deps.world.roomsOf(sceneId)) {
      if (!this.roomBodies.has(room.id)) this.roomBodies.set(room.id, this.createRoom(room));
    }
    this.registerColliders(world);
    // Its floors and furniture are all there now: its free bodies fall no further than them.
    for (const room of this.deps.world.roomsOf(sceneId)) {
      for (const entry of this.waiting.get(room.id) ?? []) {
        if (this.bodies.get(entry.entity.id) !== entry) continue; // despawned meanwhile
        entry.body.setEnabled(true);
        entry.body.wakeUp();
      }
      this.waiting.delete(room.id);
    }
  }

  /** A neighbour scene went: its rooms' bodies (its entities went through EntityDespawned). */
  private detachRooms(sceneId: string): void {
    const world = this.world;
    if (!world) return;
    for (const room of this.deps.world.roomsOf(sceneId)) {
      const body = this.roomBodies.get(room.id);
      if (!body) continue;
      world.removeRigidBody(body);
      this.roomBodies.delete(room.id);
    }
  }

  /**
   * New colliders are only seen by scene queries (the character controller) after a step; a
   * zero-length step registers them without advancing the simulation.
   */
  private registerColliders(world: RapierWorld): void {
    world.timestep = 0;
    world.step();
    world.timestep = this.deps.config.physics.fixedStep;
  }

  private clearScene(): void {
    const world = this.world;
    if (!world) return;
    for (const body of this.roomBodies.values()) world.removeRigidBody(body);
    this.roomBodies.clear();
    this.waiting.clear();
    if (this.player) world.removeRigidBody(this.player.body);
    this.player = null;
    for (const agent of this.agents.values()) world.removeRigidBody(agent.body);
    this.agents.clear();
  }

  /** Floor, ceiling and walls just outside the room bounds, openings left out (`roomSlabs`). */
  private createRoom(room: RoomDefinition): RigidBody {
    const { rapier, world } = this.required();
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    for (const { center, halfExtents: h } of roomSlabs(room)) {
      world.createCollider(rapier.ColliderDesc.cuboid(...h).setTranslation(...center), body);
    }
    return body;
  }

  private createPlayer(): void {
    const { rapier, world } = this.required();
    const { state, config } = this.deps;
    const radius = config.player.radius;
    const halfHeight = Math.max(state.player.height / 2, radius + 0.05);
    const [x, y, z] = state.player.position;
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + halfHeight + SKIN, z),
    );
    const collider = world.createCollider(
      rapier.ColliderDesc.capsule(halfHeight - radius, radius).setCollisionGroups(PLAYER_GROUPS),
      body,
    );
    this.player = { body, collider, halfHeight };
    this.verticalSpeed = 0;
    this.grounded = false;
    this.synced[0] = x;
    this.synced[1] = y;
    this.synced[2] = z;
    this.snapPlayer();
  }

  private addEntity(entity: WorldEntity): void {
    const { rapier, world } = this;
    const physical = entity.item.physical;
    if (!rapier || !world || physical.body === 'none') return;
    if (this.bodies.has(entity.id)) {
      this.deps.log.warn(`Physics body for "${entity.id}" already exists`);
      return;
    }
    const dynamic = physical.body === 'dynamic';
    // A walk-through door's leaf, or a sliding door's between two rooms: the same slide.
    const door =
      physical.body === 'kinematic' ? (entity.item.door ?? entity.item.slider) : undefined;
    const [x, y, z] = entity.pose.position;
    const [qx, qy, qz, qw] = entity.pose.rotation;
    const { RigidBodyDesc } = rapier;
    const desc = (
      dynamic
        ? RigidBodyDesc.dynamic()
        : door
          ? RigidBodyDesc.kinematicPositionBased()
          : RigidBodyDesc.fixed()
    )
      .setTranslation(x, y, z)
      .setRotation({ x: qx, y: qy, z: qz, w: qw });
    if (dynamic) {
      desc
        .setLinearDamping(physical.linearDamping)
        .setAngularDamping(physical.angularDamping)
        .setCcdEnabled(physical.ccd);
    }
    const body = world.createRigidBody(desc);
    const { hinged } = entity.item;
    // A hinged item is its carcass (none: only its leaves are solid), an item with colliders
    // those boxes, each box a collider.
    const boxes = hinged?.carcass ?? entity.item.colliders;
    const shapes = boxes
      ? boxes.map(({ center, size }) =>
          rapier.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(
            center[0],
            center[1],
            center[2],
          ),
        )
      : [this.shapeOf(rapier, entity.item)];
    for (const shape of shapes) {
      world.createCollider(
        shape
          .setFriction(physical.friction)
          .setRestitution(physical.restitution)
          // Mass is authoritative; Rapier derives density and inertia from it and the shape.
          .setMass(physical.massKg / shapes.length),
        body,
      );
    }
    const entry: EntityBody = {
      body,
      entity,
      dynamic,
      oriented: dynamic && physical.handling !== 'free',
      previousPosition: [x, y, z],
      previousRotation: [qx, qy, qz, qw],
      previousVelocity: [0, 0, 0],
      quietUntil: 0,
    };
    // Placements are turned about +y only: an upright item spawns upright, and is kept so. One
    // saved tipped (let go mid-pour, saved before it stood up) stands up as a let-go one does.
    if (dynamic && physical.handling === 'upright') {
      if (tiltOf(entity.pose.rotation) < UPRIGHT_TILT)
        body.setEnabledRotations(false, true, false, false);
      else this.uprighting.set(entry, 0);
    }
    this.bodies.set(entity.id, entry);
    this.entityByBody.set(body.handle, entity.id);
    if (hinged) this.addSwing(entity);
    if (dynamic) this.dynamics.add(entry);
    // A neighbour scene comes in a few placements a frame and its rooms' floors only at
    // SceneAttached: until then a free body would fall through them (the Physics Lab's lamp, beside
    // the hub, fell for ever). It waits, disabled, where it was placed. (Not one carried out of a
    // scene since released: its room is no longer in the world, and it is where the player is.)
    const room = entity.roomId;
    if (
      dynamic &&
      this.player !== null &&
      !this.roomBodies.has(room) &&
      this.deps.world.hasRoom(room)
    ) {
      body.setEnabled(false);
      const waiting = this.waiting.get(entity.roomId) ?? [];
      waiting.push(entry);
      this.waiting.set(entity.roomId, waiting);
    }
    // A leaf spawns closed (doors open only between scenes already resident) and slides along its
    // own +x; its entity pose stays where it stands closed.
    if (door) {
      const slide = rotate(entity.pose.rotation, [door.travel, 0, 0], [0, 0, 0]);
      this.leaves.set(entity.id, { body, closed: entity.pose.position, slide, f: 0, applied: 0 });
    }
  }

  /**
   * A kinematic body per hinged leaf, standing where the item's `open` state puts it (a save:
   * the hinge system starts there too), named by the item's id for rays.
   */
  private addSwing(entity: WorldEntity): void {
    const { rapier, world } = this;
    const hinged = entity.item.hinged;
    if (!rapier || !world || !hinged) return;
    const bodies = hinged.leaves.map(({ size }) => {
      const body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased());
      world.createCollider(
        rapier.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setFriction(
          entity.item.physical.friction,
        ),
        body,
      );
      this.entityByBody.set(body.handle, entity.id);
      return body;
    });
    const f = this.deps.entityStates.get(entity.id, 'open') === true ? 1 : 0;
    const swing: Swing = { entity, bodies, f, applied: f };
    this.swings.set(entity.id, swing);
    this.turnLeaves(swing, false);
  }

  private removeEntity(entityId: string): void {
    const swing = this.swings.get(entityId);
    if (swing) {
      for (const body of swing.bodies) {
        this.entityByBody.delete(body.handle);
        this.world?.removeRigidBody(body);
      }
      this.swings.delete(entityId);
    }
    const entry = this.bodies.get(entityId);
    if (!entry) return;
    if (this.held === entry) this.held = null;
    if (this.plan?.entry === entry) this.plan = null;
    this.settling.delete(entry);
    this.uprighting.delete(entry);
    this.driven.delete(entry);
    this.leaves.delete(entityId);
    this.entityByBody.delete(entry.body.handle);
    this.world?.removeRigidBody(entry.body); // also removes its colliders
    this.bodies.delete(entityId);
    this.dynamics.delete(entry);
  }

  /** Collider matching the item's visual primitive, centred on the entity pose. */
  private shapeOf(rapier: Rapier, item: ItemDefinition): ColliderDesc {
    const [w, h, d] = item.visual.size;
    switch (item.visual.shape) {
      case 'sphere':
        return rapier.ColliderDesc.ball(w / 2);
      case 'cylinder':
        return rapier.ColliderDesc.cylinder(h / 2, w / 2);
      case 'box':
        return rapier.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    }
  }

  /** Something other than physics moved the player (spawn, save restore, tool): follow it. */
  private applyTeleport(): void {
    const { player, world } = this;
    const position = this.deps.state.player.position;
    if (!player || !world) return;
    if (
      position[0] === this.synced[0] &&
      position[1] === this.synced[1] &&
      position[2] === this.synced[2]
    ) {
      return;
    }
    this.next.x = position[0];
    this.next.y = position[1] + player.halfHeight + SKIN;
    this.next.z = position[2];
    player.body.setTranslation(this.next, true);
    player.body.setNextKinematicTranslation(this.next);
    world.propagateModifiedBodyPositionsToColliders();
    this.verticalSpeed = 0;
    this.grounded = false;
    this.synced[0] = position[0];
    this.synced[1] = position[1];
    this.synced[2] = position[2];
    this.snapPlayer(); // a teleport is drawn at once, never slid to
  }

  private moveCharacter(h: number): void {
    const { player, controller, rapier } = this;
    if (!player || !controller || !rapier) return;
    const intent = this.deps.state.player.moveIntent;
    // Gravity only while airborne: pushing into the floor every step made the controller lose
    // 1–6 % of horizontal speed in measurements; snap-to-ground keeps the capsule down instead.
    this.verticalSpeed = this.grounded
      ? 0
      : Math.max(this.verticalSpeed - this.deps.config.physics.gravity * h, -MAX_FALL_SPEED);
    this.desired.x = intent[0] * h;
    this.desired.y = this.verticalSpeed * h;
    this.desired.z = intent[2] * h;
    controller.computeColliderMovement(
      player.collider,
      this.desired,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      PLAYER_GROUPS, // the held object is not an obstacle for its carrier
    );
    controller.computedMovement(this.movement);
    this.grounded = controller.computedGrounded();
    const t = player.body.translation(this.t);
    this.next.x = t.x + this.movement.x;
    this.next.y = t.y + this.movement.y;
    this.next.z = t.z + this.movement.z;
    player.body.setNextKinematicTranslation(this.next);
  }

  /**
   * Velocity drive of the held body towards the hold point (no forces, no teleport). The target
   * is first clamped at the first static surface on the way, found by sweeping the body's own
   * shape: a hold point inside a wall or the bench is never chased, so the body rests against
   * the surface instead of being pressed into it every step. Dynamic objects are not swept;
   * the held body meets those through normal contacts.
   */
  private driveHeld(): void {
    const { held: entry, world, rapier } = this;
    if (!entry || !world || !rapier) return;
    // shortcut: uses the player position written back after the previous frame's steps, so the
    // hold point lags the player by at most one frame.
    const { player } = this.deps.config;
    const spout = entry.entity.item.container?.pour?.spout;
    if (this.spoutAt && spout) {
      // The spout at its goal, the body turned as it is now: its centre that far back from it.
      rotate(entry.entity.pose.rotation, spout, this.spoutOffset);
      for (let i = 0; i < 3; i++) {
        this.holdTarget[i] = (this.spoutAt[i] ?? 0) - (this.spoutOffset[i] ?? 0);
      }
      // Not yet tipped, it would stand on what it pours into: its centre stays over the goal by
      // its half width, so it tips above the mouth and only the spout comes down to it.
      const [w, , d] = entry.entity.item.visual.size;
      this.holdTarget[1] = Math.max(this.holdTarget[1], this.spoutAt[1] + Math.max(w, d) / 2);
    } else {
      const clear = heldClearance(player.radius, entry.entity.item);
      holdPoint(
        this.deps.state.player,
        player.holdDistance,
        this.holdTarget,
        clear,
        entry.entity.item.heldAside,
      );
    }
    const { body } = entry;
    const t = body.translation(this.t);
    let dx = this.holdTarget[0] - t.x;
    let dy = this.holdTarget[1] - t.y;
    let dz = this.holdTarget[2] - t.z;
    const gap = Math.hypot(dx, dy, dz);
    if (gap > 1e-6) {
      this.sweep.x = dx / gap;
      this.sweep.y = dy / gap;
      this.sweep.z = dz / gap;
      const hit = world.castShape(
        t,
        body.rotation(this.q),
        this.sweep,
        body.collider(0).shape,
        HOLD_CLEARANCE,
        gap,
        false,
        rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        this.player?.collider, // its carrier is no obstacle (held objects pass the capsule)
        body,
      );
      if (hit) {
        const k = hit.time_of_impact / gap;
        dx *= k;
        dy *= k;
        dz *= k;
      }
    }
    // Carried along at the player's own speed, chasing only what is left: a 0.08 s chase alone
    // left it 0.36 m behind a running player (4.5 m/s) — at an arm's reach, in the player's face.
    const h = this.deps.config.physics.fixedStep;
    this.chase(
      body,
      dx,
      dy,
      dz,
      this.spoutAt ? 0 : this.movement.x / h,
      this.spoutAt ? 0 : this.movement.z / h,
    );
    if (!entry.oriented) {
      body.setAngvel(this.zero, true); // keep its orientation steady while carried
      return;
    }
    // shortcut: rotation is not swept (only the hold point is); the turn-rate cap and contacts
    // keep glass out of surfaces — sweep the turn if thin glass is seen passing into the bench.
    holdRotation(this.deps.state.player.yaw, this.holdTilt, this.holdHeading, this.targetRotation);
    this.turnTowards(body, this.targetRotation);
  }

  private writeBack(): void {
    const { state } = this.deps;
    const player = this.player;
    if (player) {
      const t = player.body.translation(this.t);
      const position = state.player.position;
      position[0] = t.x;
      position[1] = t.y - player.halfHeight - SKIN;
      position[2] = t.z;
      this.synced[0] = position[0];
      this.synced[1] = position[1];
      this.synced[2] = position[2];
    }
    state.player.grounded = this.grounded;
    for (const entry of this.dynamics) {
      const { body, entity } = entry;
      if (body.isSleeping() || this.driven.has(entry)) continue;
      const t = body.translation(this.t);
      const q = body.rotation(this.q);
      const { position, rotation } = entity.pose;
      position[0] = t.x;
      position[1] = t.y;
      position[2] = t.z;
      rotation[0] = q.x;
      rotation[1] = q.y;
      rotation[2] = q.z;
      rotation[3] = q.w;
    }
  }

  // A getter, so checks after an await re-read status (dispose() may run meanwhile).
  private get disposed(): boolean {
    return this.status === 'disposed';
  }

  private required(): { rapier: Rapier; world: RapierWorld } {
    if (!this.rapier || !this.world) throw new Error('Physics is not initialized');
    return { rapier: this.rapier, world: this.world };
  }
}
