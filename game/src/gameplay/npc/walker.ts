import type { EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameEvents } from '../../game/GameEvents';
import { arrivalPose } from '../../world/arrival';
import type { DoorPair } from '../../world/campus';
import type { RoomDefinition } from '../../world/definitions';
import { findPath, type NavGrid, nearestFree } from '../../world/navGrid';
import type { WorldEntity } from '../../world/World';
import { handPoint } from '../action/handPoint';
import type { DoorState } from '../door/DoorSystem';
import { Gait } from '../player/gait';
import type { NpcView } from './NpcSystem';

/** A path is planned again when its goal has moved this far (m), or after this long (s). */
const REPLAN_M = 0.8;
const REPLAN_S = 1;
/** Close enough (m) to a point walked to. */
export const ARRIVED_M = 0.12;
/** Seconds a person waits at a door that is opening; then they go through anyway. */
const DOOR_WAIT_S = 4;
/** Seconds to walk through a doorway, from one side's standing point to the other's. */
const CROSS_S = 1.3;
/** How far (m) from the wall a person stands to tap their card on a door's reader. */
const READER_STAND_M = 0.5;
/**
 * Tapping a card on a reader, as the player's own `door-open` action does it: 1.5 s, the card in
 * the hand from 0.2 s to 1.3 s, the hand at the reader from 0.35 s to 1.15 s, taken at 0.85 s.
 */
const SWIPE_S = 1.5;
const CARD_FROM = 0.2;
const CARD_TO = 1.3;
const REACH_FROM = 0.35;
const REACH_TO = 1.15;
const TAP_AT = 0.85;
/** Taps that leave a door shut before a person goes through anyway (a scene that would not come). */
const TAPS = 3;
const TURN_RATE = 10;

/** What a person's walk needs of the world. */
export interface WalkWorld {
  readonly events: EventBus<GameEvents>;
  /** Where a resident scene's own coordinates start in the session frame, or null. */
  offsetOf(sceneId: string): Readonly<Vec3> | null;
  /** A scene's walkable floor. */
  grid(sceneId: string): NavGrid | null;
  readonly doorPairs: readonly DoorPair[];
  readonly doors?: DoorState | undefined;
  readonly world?:
    | {
        entity(id: string): WorldEntity | undefined;
        roomAt(x: number, z: number): RoomDefinition | null;
      }
    | undefined;
  /** Doors people never take (a procedure's entrance: the player's own way in, by its steps). */
  readonly barred: ReadonlySet<string>;
}

/** Where a person's scene is (the NpcSystem keeps it current). */
export interface Placement {
  readonly resident: boolean;
  readonly ox: number;
  readonly oz: number;
}

/** The way through one door pair towards a scene, worked out once. */
interface Route {
  readonly from: string;
  readonly to: string;
  readonly pair: DoorPair | null;
  /** Standing points before the door on each side (each side's own coordinates). */
  readonly sx: number;
  readonly sz: number;
  readonly tx: number;
  readonly tz: number;
  readonly yaw: number;
  /** Where to stand to tap the reader, and the reader (near side's coordinates); null: not yet. */
  reader: { x: number; z: number; rx: number; ry: number; rz: number } | null;
}

/**
 * A person's walk (Phase Y-2): along a path on their scene's free floor to a point, and through
 * the doors between scenes on the way, as the player goes through them (Phú, 2026-11-09): a door
 * already open, they walk through; a shut one, they go to its reader first and tap their card on
 * it — the door opens as the player's does, with its beep and its sliding — then go through once
 * it is open. Doors whose far side is not drawn are gone through at once (nobody sees it). Their
 * feet come down as the player's do (`Gait`): `NpcFootstep` each time, heard where they are.
 * Writes where the person is into their view; reads nothing of the player.
 */
export class Walker {
  /** The walk under way (x, z pairs in `pathScene`'s coordinates) and the point reached. */
  private readonly path: number[] = [];
  private pathAt = 0;
  private pathScene = '';
  private goalX = NaN;
  private goalZ = NaN;
  private replan = 0;
  private route: Route | null = null;
  /** Going through a doorway: from where to where (session frame), how far (0–1). */
  private cross: {
    fx: number;
    fz: number;
    tx: number;
    tz: number;
    lx: number;
    lz: number;
    yaw: number;
    to: string;
    f: number;
  } | null = null;
  /** A card being tapped on a reader: how far into it (s), and whether it has been taken. */
  private swipe = -1;
  private tapped = false;
  private taps = 0;
  private doorWait = 0;
  private readonly gait = new Gait();
  private readonly free: [number, number] = [0, 0];
  private readonly reader: Vec3 = [0, 0, 0];
  private readonly feet: Vec3 = [0, 0, 0];

  constructor(
    private readonly id: string,
    private readonly view: NpcView,
    private readonly at: Placement,
    private readonly w: WalkWorld,
  ) {}

  /** Going through a doorway or tapping a card: it is finished first (`go`). */
  get busy(): boolean {
    return this.cross !== null || this.swipe >= 0;
  }

  /** On with what is under way (`busy`): the doorway walked through, the card tapped. */
  go(dt: number): void {
    if (this.cross) this.crossing(dt);
    else if (this.swipe >= 0) this.tapping(dt);
  }

  /**
   * One step towards (x, z) in scene `sceneId`, stopping `keep` m short, at `speed` (m/s); true
   * when there. Through the doors between on the way; with no way they may take, they wait.
   */
  to(sceneId: string, x: number, z: number, speed: number, dt: number, keep: number): boolean {
    const { view } = this;
    if (view.sit > 0) return false;
    if (view.sceneId === sceneId) return this.approach(sceneId, x, z, speed, dt, keep);
    const route = this.routeTo(sceneId);
    if (!route.pair) {
      view.speed = 0; // no way they may take (a procedure's entrance): they wait
      return false;
    }
    if (!this.at.resident) {
      this.arrive(route.to, route.tx, route.tz, route.yaw);
      return false;
    }
    const near = route.pair.a.sceneId === view.sceneId ? route.pair.a : route.pair.b;
    const doors = this.w.doors;
    const state = doors?.state(near.entityId) ?? null;
    const shut = state === 'closed' || state === 'closing';
    if (shut && this.taps < TAPS) {
      // Shut: to its reader, and the card on it.
      const reader = this.readerOf(route, near.entityId);
      if (reader && this.approach(view.sceneId, reader.x, reader.z, speed, dt, 0)) {
        this.swipe = 0;
        this.tapped = false;
        this.taps++;
      }
      return false;
    }
    if (!this.approach(view.sceneId, route.sx, route.sz, speed, dt, 0)) return false;
    // Before the door: through it once it is open (or opening for too long, or never to open).
    view.speed = 0;
    this.doorWait += dt;
    const open = !doors || state === null || doors.fraction(near.entityId) > 0.9;
    if (!open && !shut && this.doorWait <= DOOR_WAIT_S) return false;
    this.doorWait = 0;
    this.taps = 0;
    const far = this.w.offsetOf(route.to);
    if (!far) {
      this.arrive(route.to, route.tx, route.tz, route.yaw);
      return false;
    }
    this.cross = {
      fx: view.x + this.at.ox,
      fz: view.z + this.at.oz,
      tx: route.tx + far[0],
      tz: route.tz + far[2],
      lx: route.tx,
      lz: route.tz,
      yaw: route.yaw,
      to: route.to,
      f: 0,
    };
    return false;
  }

  /** Standing still (the walk planned again when it goes on). */
  stop(): void {
    this.view.speed = 0;
  }

  /**
   * After a jump (at home again, a scene left out of sight): nothing under way, the feet where
   * they now are.
   */
  forget(): void {
    this.path.length = 0;
    this.goalX = NaN;
    this.cross = null;
    this.swipe = -1;
    this.view.card = false;
    this.view.reaching = false;
    this.doorWait = 0;
    this.taps = 0;
    this.route = null;
    this.gait.reset();
  }

  /** Their feet this frame, where they now are: a footstep heard as a foot comes down. */
  steps(dt: number): void {
    const { view, at } = this;
    if (!at.resident || view.sit > 0.05) {
      this.gait.reset();
      view.stride = this.gait.phase;
      return;
    }
    const foot = this.gait.step(dt, view.x + at.ox, view.z + at.oz);
    view.stride = this.gait.phase;
    if (foot === 0) return;
    this.feet[0] = view.x + at.ox;
    this.feet[1] = 0;
    this.feet[2] = view.z + at.oz;
    this.w.events.publish('NpcFootstep', {
      npcId: this.id,
      foot: foot === 1 ? 'left' : 'right',
      speed: this.gait.speed,
      position: this.feet,
    });
  }

  /** One step along a path on their scene's floor to (x, z), planned again as the goal moves. */
  private approach(
    sceneId: string,
    x: number,
    z: number,
    speed: number,
    dt: number,
    keep: number,
  ): boolean {
    if (
      this.pathScene !== sceneId ||
      Number.isNaN(this.goalX) ||
      ((this.goalX !== x || this.goalZ !== z) &&
        (Math.hypot(this.goalX - x, this.goalZ - z) > REPLAN_M || this.replan <= 0))
    ) {
      this.plan(sceneId, x, z);
    }
    this.replan -= dt;
    return this.walk(x, z, speed, dt, keep);
  }

  private plan(sceneId: string, x: number, z: number): void {
    const grid = this.w.grid(sceneId);
    this.pathScene = sceneId;
    this.goalX = x;
    this.goalZ = z;
    this.replan = REPLAN_S;
    this.pathAt = 1;
    this.path.length = 0;
    if (!grid) return;
    let gx = x;
    let gz = z;
    if (nearestFree(grid, x, z, 1.5, this.free)) [gx, gz] = this.free;
    if (findPath(grid, this.view.x, this.view.z, gx, gz, this.path) === 0) this.path.length = 0;
  }

  /** Along the planned path (straight without one) towards (x, z), `keep` m short; true there. */
  private walk(x: number, z: number, speed: number, dt: number, keep: number): boolean {
    const { view } = this;
    const left = Math.hypot(x - view.x, z - view.z);
    if (left <= Math.max(keep, ARRIVED_M)) {
      view.speed = 0;
      return true;
    }
    let tx = x;
    let tz = z;
    while (this.pathAt < this.path.length / 2) {
      const px = this.path[2 * this.pathAt] ?? x;
      const pz = this.path[2 * this.pathAt + 1] ?? z;
      if (Math.hypot(px - view.x, pz - view.z) > ARRIVED_M) {
        tx = px;
        tz = pz;
        break;
      }
      this.pathAt++;
    }
    const dx = tx - view.x;
    const dz = tz - view.z;
    const d = Math.hypot(dx, dz);
    const stepM = Math.min(d, speed * dt, Math.max(0, left - keep));
    if (d > 1e-6) {
      view.x += (dx / d) * stepM;
      view.z += (dz / d) * stepM;
      this.turn(Math.atan2(-dx, -dz), dt);
    }
    view.speed = stepM > 0 ? speed : 0;
    return false;
  }

  /** The card on the reader: the hand to it, the door asked to open as it touches. */
  private tapping(dt: number): void {
    const { view } = this;
    const route = this.route;
    const reader = route?.reader;
    const near = route?.pair
      ? route.pair.a.sceneId === view.sceneId
        ? route.pair.a
        : route.pair.b
      : null;
    if (!route || !reader || !near) {
      this.swipe = -1;
      return;
    }
    view.speed = 0;
    this.turn(Math.atan2(-(reader.rx - view.x), -(reader.rz - view.z)), dt);
    this.swipe += dt;
    const t = this.swipe;
    view.card = t >= CARD_FROM && t <= CARD_TO;
    view.reaching = t >= REACH_FROM && t <= REACH_TO;
    view.reachX = reader.rx;
    view.reachY = reader.ry;
    view.reachZ = reader.rz;
    if (!this.tapped && t >= TAP_AT) {
      this.tapped = true;
      const state = this.w.doors?.state(near.entityId) ?? null;
      // Shut still (nobody opened it meanwhile): the card opens it, as the player's does.
      if (state === 'closed' || state === 'closing') {
        this.w.events.publish('DoorRequested', { entityId: near.entityId });
      }
    }
    if (t >= SWIPE_S) {
      this.swipe = -1;
      view.card = false;
      view.reaching = false;
    }
  }

  /** Through a doorway: along the line from one side's standing point to the other's. */
  private crossing(dt: number): void {
    const c = this.cross;
    if (!c) return;
    const { view } = this;
    c.f = Math.min(1, c.f + dt / CROSS_S);
    const offset = this.w.offsetOf(c.to);
    view.heading = Math.atan2(-(c.tx - c.fx), -(c.tz - c.fz));
    view.speed = Math.hypot(c.tx - c.fx, c.tz - c.fz) / CROSS_S;
    if (!offset) {
      this.arrive(c.to, c.lx, c.lz, c.yaw);
      return;
    }
    view.sceneId = c.to;
    view.x = c.fx + (c.tx - c.fx) * c.f - offset[0];
    view.z = c.fz + (c.tz - c.fz) * c.f - offset[2];
    if (c.f >= 1) {
      this.cross = null;
      this.route = null;
      this.path.length = 0;
      this.goalX = NaN;
    }
  }

  /** In scene `sceneId` at (x, z), facing `heading`: through a door nobody sees. */
  private arrive(sceneId: string, x: number, z: number, heading: number): void {
    const { view } = this;
    view.sceneId = sceneId;
    view.x = x;
    view.z = z;
    view.heading = heading;
    view.speed = 0;
    this.forget();
  }

  private turn(heading: number, dt: number): void {
    const d = heading - this.view.heading;
    this.view.heading += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * TURN_RATE);
  }

  /** The way from the scene they are in towards `sceneId` (worked out once per change). */
  private routeTo(sceneId: string): Route {
    const from = this.view.sceneId;
    const known = this.route;
    if (known && known.from === from && known.to === sceneId) return known;
    // The first pair on the way (breadth first over the pairs they may take).
    const pair = this.firstPair(from, sceneId);
    const near = pair ? (pair.a.sceneId === from ? pair.a : pair.b) : null;
    const far = pair ? (near === pair.a ? pair.b : pair.a) : null;
    const s = near ? arrivalPose(near.room, near.door) : null;
    const t = far ? arrivalPose(far.room, far.door) : null;
    const usable = typeof s === 'object' && s !== null && typeof t === 'object' && t !== null;
    this.route = {
      from,
      to: far?.sceneId ?? sceneId,
      pair: usable ? pair : null,
      sx: usable ? s.position[0] : 0,
      sz: usable ? s.position[2] : 0,
      tx: usable ? t.position[0] : 0,
      tz: usable ? t.position[2] : 0,
      yaw: usable ? t.yaw : 0,
      reader: null,
    };
    this.taps = 0;
    return this.route;
  }

  private firstPair(from: string, to: string): DoorPair | null {
    const pairs = this.w.doorPairs;
    const first = new Map<string, DoorPair>();
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
      const scene = queue.shift() as string;
      for (const pair of pairs) {
        if (this.w.barred.has(pair.a.entityId) || this.w.barred.has(pair.b.entityId)) continue;
        const other =
          pair.a.sceneId === scene
            ? pair.b.sceneId
            : pair.b.sceneId === scene
              ? pair.a.sceneId
              : null;
        if (!other || seen.has(other)) continue;
        seen.add(other);
        first.set(other, scene === from ? pair : (first.get(scene) as DoorPair));
        if (other === to) return first.get(other) ?? null;
        queue.push(other);
      }
    }
    return null;
  }

  /**
   * The near door's reader (`handPoint`, where the player taps theirs) and where to stand before
   * it: READER_STAND_M out from the wall on the room's side; null while the door is not there.
   */
  private readerOf(route: Route, doorId: string): Route['reader'] {
    if (route.reader) return route.reader;
    const world = this.w.world;
    const entity = world?.entity(doorId);
    if (!world || !entity) return null;
    handPoint(entity, world, this.reader);
    const ox = this.at.ox;
    const oz = this.at.oz;
    const rx = this.reader[0] - ox;
    const rz = this.reader[2] - oz;
    // Out from the wall: towards the door's standing point, which is on the room's side.
    const dx = entity.pose.position[0] - ox;
    const dz = entity.pose.position[2] - oz;
    const nx = route.sx - dx;
    const nz = route.sz - dz;
    const n = Math.hypot(nx, nz) || 1;
    route.reader = {
      x: rx + (nx / n) * READER_STAND_M,
      z: rz + (nz / n) * READER_STAND_M,
      rx,
      ry: this.reader[1],
      rz,
    };
    return route.reader;
  }
}
