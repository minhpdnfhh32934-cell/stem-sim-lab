import { Disposables, type EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import type { Vec3 } from '../../core/math';
import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { DoorEnd, DoorPair as CampusPair } from '../../world/campus';
import { capsuleInBox, createYawBox, type SlidingPair, sweptBox } from '../../world/door';
import type { ItemDefinition } from '../item';

/** A pair's state: closed → preparing → opening → open → closing → closed, and blocked. */
export type DoorPhase = GameEvents['DoorChanged']['state'];

/** Horizontal distance (m) from a pair's centre beyond which the player is away from it. */
export const AWAY_M = 2;
/** Seconds an open pair waits, once the player is away, before it closes. */
export const HOLD_S = 1.5;
/**
 * The same for a procedure's entrance or exit, once the player has come near it: it closes as soon
 * as they are away again (opened from afar, it waits HOLD_S for them like any door).
 */
export const PROCEDURE_HOLD_S = 0;
/** Seconds an open pair that is due to close waits before it asks again whether its doorway is clear. */
export const RETRY_S = 0.25;
/**
 * Clearance (m) kept around the leaves' remaining path: more than one 1/60 s step of walking and
 * sliding ((2.2 + 1 / 0.6) / 60 = 0.064 m).
 */
export const MARGIN_M = 0.1;
/**
 * Seconds between the two leaves of a pair: one slides fully open (or shut), then, after this, the
 * other — the near one first, never both at once.
 */
export const LEAF_GAP_S = 0.2;
/**
 * Horizontal distance (m) from a closed pair within which the scene behind it is attached ahead of
 * a request (Phú, 2026-11-09: the door to a lab stalled as it opened): its placements spawn and
 * compile while the player walks up, and E opens the door at once.
 */
export const PREPARE_M = 5;
/** Farther than this (m) from every pair that joins it, a scene attached ahead is released again. */
export const RELEASE_M = 9;
/** Seconds before an attach ahead that failed (a load under way) is tried again. */
export const PREPARE_RETRY_S = 2;
/** Seconds beyond PREPARE_M before coming near a pair again attaches the scene behind it ahead. */
export const ARM_S = 0.5;
/** Metres the player must have come towards an armed pair before the scene behind is attached. */
export const APPROACH_M = 0.5;
/** How far (rad) the view may turn from a pair for walking towards it to count (60°). */
export const FACING_RAD = Math.PI / 3;
/** Ids of the door actions requests come from; refusals name them. */
export const OPEN_DOOR_ACTION = 'travel';
export const CLOSE_DOOR_ACTION = 'close-door';

// A fraction or timer this close to its end is there: sums of 1/60 s steps drift by ~1e-16.
const EPS = 1e-9;

/**
 * Scene residency, provided by the scene manager: the one world holds the current scene and
 * every scene behind a door that is not closed.
 */
export interface NeighbourScenes {
  /** The scene the player is in, or null. */
  readonly currentSceneId: string | null;
  isResident(sceneId: string): boolean;
  /**
   * Where a resident scene's own coordinates start in the world (m), its stored vector (no copy);
   * null when it is not resident.
   */
  offsetOf(sceneId: string): Readonly<Vec3> | null;
  /** Spawns a neighbour; resolves null once it is resident, else the reason it is not. */
  attach(sceneId: string): Promise<string | null>;
  /** Removes a resident neighbour (never the current scene). */
  release(sceneId: string): void;
}

/** The physics side of doors, implemented by the physics system (like PoseDriver). */
export interface DoorDriver {
  /** Slides a leaf to opening fraction f (0 closed … 1 open); a leaf without a body is ignored. */
  setDoorOpening(entityId: string, f: number): void;
  /** Whether a dynamic body overlaps the box (world, turned by rotationY about +y). */
  dynamicBodyIn(center: Readonly<Vec3>, halfExtents: Readonly<Vec3>, rotationY: number): boolean;
}

/** The player's collision capsule as it is now (read every frame: `position` may be replaced). */
export interface PlayerCapsule {
  /** Feet (m): the player's position. */
  readonly position: Readonly<Vec3>;
  readonly radius: number;
  /** Half the capsule's total height (m): it spans feet … feet + 2·halfHeight. */
  readonly halfHeight: number;
  /** Where they face (rad, 0 = −z); without it, every pair counts as faced (attaching ahead). */
  readonly yaw?: number;
}

/** One leaf of a walk-through door. */
export interface DoorLeaf {
  readonly entityId: string;
  readonly sceneId: string;
  /** The closed leaf's box centre (its entity pose) in its scene's own coordinates (m). */
  readonly position: Readonly<Vec3>;
  /** Its box (m): width along its slide, height, thickness. */
  readonly size: Readonly<Vec3>;
}

/** Two leaves back to back through one wall, each the other's arrival: one walk-through door. */
export interface DoorPair {
  readonly leaves: readonly [DoorLeaf, DoorLeaf];
  /** Shared by both leaves (rad): both slide along their local +x. */
  readonly rotationY: number;
  /** How far (m) the leaves slide when fully open. */
  readonly travel: number;
  readonly openS: number;
  readonly closeS: number;
  /** A procedure's entrance or exit (PROCEDURE_HOLD_S). */
  readonly procedure: boolean;
}

/**
 * The walk-through pairs among the campus' door pairs (both items have `door`; content checks
 * that they slide alike): each leaf's closed box centre in its scene's own coordinates, as its
 * entity stands. `procedural` says which doors are a procedure's entrance or exit.
 */
export function slidingPairs(
  pairs: readonly CampusPair[],
  itemOf: (id: string) => ItemDefinition | undefined,
  procedural: (entityId: string) => boolean,
): DoorPair[] {
  return pairs.flatMap(({ a, b }) => {
    const [ia, ib] = [itemOf(a.door.item), itemOf(b.door.item)];
    if (!ia?.door || !ib?.door) return [];
    const leaf = (end: DoorEnd, size: Readonly<Vec3>): DoorLeaf => {
      const [x, y, z] = end.door.position;
      return {
        entityId: end.entityId,
        sceneId: end.sceneId,
        position: [x, y + size[1] / 2, z],
        size,
      };
    };
    const { travel, openS, closeS } = ia.door;
    return [
      {
        leaves: [leaf(a, ia.visual.size), leaf(b, ib.visual.size)],
        rotationY: a.door.rotationY,
        travel,
        openS,
        closeS,
        procedure: procedural(a.entityId) || procedural(b.entityId),
      },
    ];
  });
}

/** One leaf of a pair as a pair of its own (both entries it): what it alone sweeps. */
function alone(pair: DoorPair, center: Vec3, size: Readonly<Vec3>): SlidingPair {
  const leaf = { center, size };
  return { leaves: [leaf, leaf], rotationY: pair.rotationY, travel: pair.travel };
}

/** What behaviours, procedures, the renderer and the debug panel read about doors. */
export interface DoorState {
  /** Opening, open or blocked: the leaf offers to close the door. */
  isOpen(entityId: string): boolean;
  /** The state of the leaf's pair; null for anything that is not a walk-through door leaf. */
  state(entityId: string): DoorPhase | null;
  /** The leaf's own opening fraction f (0 closed … 1 open); 0 for anything else. */
  fraction(entityId: string): number;
}

export interface DoorSystemDeps {
  pairs: readonly DoorPair[];
  scenes: NeighbourScenes;
  driver: DoorDriver;
  player: PlayerCapsule;
  events: EventBus<GameEvents>;
  texts: Texts;
  log: Logger;
  /** Attach the scene behind a closed pair as the player comes within PREPARE_M (default false). */
  prepareAhead?: boolean;
}

interface Door {
  readonly pair: DoorPair;
  readonly ids: readonly [string, string];
  /** Both leaves' closed centres in the world, refreshed before each check. */
  readonly centers: readonly [Vec3, Vec3];
  readonly geometry: SlidingPair;
  /** Each leaf alone (the opening sweep of the far leaf is its own pocket, not the tunnel). */
  readonly alone: readonly [SlidingPair, SlidingPair];
  state: DoorPhase;
  /** Each leaf's opening fraction (index as in ids): at most one is ever between 0 and 1. */
  readonly f: [number, number];
  /** Seconds left before the other leaf may start (LEAF_GAP_S after one reached its end). */
  gap: number;
  /** Seconds the player has been away while it is open. */
  away: number;
  /** The player has been within AWAY_M since it began to open: leaving now is going away. */
  near: boolean;
  /** The player asked it to close: a refusal is shown. */
  manual: boolean;
  /** The leaf of the last request (refusals are about it). */
  requestedBy: string;
  /** Counts attaches and resets: an answer to an older attach is ignored. */
  attempt: number;
  /** Seconds before the scene behind may be attached ahead again (one failed). */
  cool: number;
  /**
   * The player has been beyond PREPARE_M of it since it last opened (or since the scene loaded):
   * coming within PREPARE_M attaches the scene behind ahead. Just through it, or placed beside it,
   * the scene behind is released as it closes and not attached again at once.
   */
  armed: boolean;
  /** Seconds the player has been beyond PREPARE_M of it while it is closed. */
  far: number;
  /** The player's farthest distance (m) from it since it was armed (0: not armed). */
  mark: number;
}

/**
 * Walk-through doors: one state machine per pair of sliding leaves, runtime only (never saved),
 * the only authority on when leaves move. Physics moves them (DoorDriver), the scene manager
 * attaches and releases the scene behind (NeighbourScenes).
 *
 * - closed → preparing while the far scene is attached (the leaves stay shut, the player keeps
 *   control) → opening; if it cannot be, closed again with the reason shown.
 * - opening → open: one leaf at a time, never both moving (UX3.1). The leaf on the player's side
 *   slides open over openS, then after LEAF_GAP_S the far one; each waits (blocked) while the player
 *   stands in its remaining slide path. Closing runs the same way: the player's side first.
 * - open → closing after HOLD_S with the player farther than AWAY_M from its centre
 *   (PROCEDURE_HOLD_S for a procedure's entrance or exit) once its closing path is clear, or when
 *   asked.
 * - closing → closed as each leaf's f falls over closeS. Before each step the rest of the closing path (both
 *   leaves and the tunnel, + MARGIN_M) must be clear: of the player by a geometric test (a Rapier
 *   query misses a capsule moved without a step), of dynamic bodies by the driver. If not, it
 *   waits (blocked) and opens again, with a notice when the player asked it to close.
 * - A closed pair the player comes within PREPARE_M of, having been farther since it last opened,
 *   has the scene behind it attached ahead (one attach per scene, shared with a request), so a
 *   request opens it at once; the player beyond RELEASE_M again, it is released. Once a pair that
 *   opened has closed, each scene of it that is neither current nor wanted by another pair (not
 *   closed, or keeping it attached ahead) is released.
 *
 * A request (DoorRequested) opens a closed pair, opens a closing one again and closes one that is
 * opening, open or blocked. SceneUnloaded closes every pair at once. Paused (dt 0), nothing moves.
 */
export class DoorSystem implements GameSystem, DoorState {
  readonly id = 'doors';
  private readonly doors: Door[] = [];
  private readonly byLeaf = new Map<string, Door>();
  private readonly box = createYawBox();
  /** Scenes being attached (by a request or ahead of one): one attach each, shared. */
  private readonly attaching = new Map<string, Promise<string | null>>();
  private readonly spot: Vec3 = [0, 0, 0];
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: DoorSystemDeps) {
    for (const pair of deps.pairs) {
      const [a, b] = pair.leaves;
      const centers: [Vec3, Vec3] = [
        [a.position[0], a.position[1], a.position[2]],
        [b.position[0], b.position[1], b.position[2]],
      ];
      const door: Door = {
        pair,
        ids: [a.entityId, b.entityId],
        centers,
        geometry: {
          leaves: [
            { center: centers[0], size: a.size },
            { center: centers[1], size: b.size },
          ],
          rotationY: pair.rotationY,
          travel: pair.travel,
        },
        alone: [alone(pair, centers[0], a.size), alone(pair, centers[1], b.size)],
        state: 'closed',
        f: [0, 0],
        gap: 0,
        away: 0,
        near: false,
        manual: false,
        requestedBy: a.entityId,
        attempt: 0,
        cool: 0,
        armed: false,
        far: 0,
        mark: 0,
      };
      for (const id of door.ids) {
        if (this.byLeaf.has(id)) throw new Error(`Door leaf "${id}" belongs to two pairs`);
        this.byLeaf.set(id, door);
      }
      this.doors.push(door);
    }
  }

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(events.subscribe('DoorRequested', ({ entityId }) => this.request(entityId)));
    // Not on SceneLoading: a load that fails keeps the scene, and a leaf must not snap shut onto
    // a player standing in a doorway.
    s.add(events.subscribe('SceneUnloaded', () => this.reset()));
    // Placed by a load (spawn, arrival or save): no pair is being walked up to yet; where the
    // player stood while it loaded says nothing.
    s.add(
      events.subscribe('SceneLoaded', () => {
        for (const door of this.doors) {
          door.armed = false;
          door.far = 0;
          door.mark = 0;
        }
      }),
    );
  }

  update(dt: number): void {
    if (dt <= 0) return; // paused: nothing moves, no timer runs
    for (const door of this.doors) {
      this.step(door, dt);
      this.prepare(door, dt);
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    for (const door of this.doors) door.attempt++;
  }

  /** Every pair closed at once and pending attaches dropped (the world is being torn down). */
  reset(): void {
    this.attaching.clear(); // an attach under way is stale: a request after this asks again
    for (const door of this.doors) {
      door.attempt++;
      door.armed = false;
      door.far = 0;
      door.mark = 0;
      door.away = 0;
      this.moveLeaf(door, 0, 0);
      this.moveLeaf(door, 1, 0);
      door.gap = 0;
      this.set(door, 'closed');
    }
  }

  /** Both leaves of each pair, in content order (the debug panel; allocates). */
  get pairIds(): (readonly [string, string])[] {
    return this.doors.map((door) => door.ids);
  }

  isOpen(entityId: string): boolean {
    const state = this.byLeaf.get(entityId)?.state;
    return state === 'opening' || state === 'open' || state === 'blocked';
  }

  state(entityId: string): DoorPhase | null {
    return this.byLeaf.get(entityId)?.state ?? null;
  }

  fraction(entityId: string): number {
    const door = this.byLeaf.get(entityId);
    return door ? door.f[door.ids[0] === entityId ? 0 : 1] : 0;
  }

  private request(entityId: string): void {
    const door = this.byLeaf.get(entityId);
    if (!door) {
      this.deps.log.warn(`"${entityId}" is not a walk-through door`);
      return;
    }
    door.requestedBy = entityId;
    switch (door.state) {
      case 'closed':
        this.open(door, entityId);
        return;
      case 'preparing':
        return; // its far scene is on its way
      case 'closing':
        door.gap = 0; // a leaf just shut opens again at once
        this.set(door, 'opening');
        return;
      default:
        door.manual = true;
        door.gap = 0;
        this.set(door, 'closing');
    }
  }

  private open(door: Door, entityId: string): void {
    const [a, b] = door.pair.leaves;
    const far = entityId === a.entityId ? b.sceneId : a.sceneId;
    door.armed = false; // closed again, the scene behind goes (the player is through or turned back)
    if (this.deps.scenes.isResident(far)) {
      this.set(door, 'opening');
      return;
    }
    this.set(door, 'preparing');
    const attempt = ++door.attempt;
    this.attachOnce(far).then(
      (reason) => this.attached(door, attempt, entityId, reason),
      (error: unknown) => this.attached(door, attempt, entityId, describeError(error)),
    );
  }

  private attached(door: Door, attempt: number, entityId: string, reason: string | null): void {
    if (attempt !== door.attempt || door.state !== 'preparing') return; // dropped by a reset
    if (reason === null) {
      this.set(door, 'opening');
      return;
    }
    this.deps.log.warn(`Door "${entityId}" stays closed: ${reason}`);
    this.set(door, 'closed');
    this.refuse(
      entityId,
      OPEN_DOOR_ACTION,
      this.deps.texts.ui('door.notReady', 'The way is not ready: {reason}', { reason }),
    );
  }

  private step(door: Door, dt: number): void {
    // A pair that is not closed has both scenes resident (attached before it opened).
    if (door.state === 'closed' || door.state === 'preparing' || !this.place(door)) return;
    if (!this.playerAway(door)) door.near = true;
    switch (door.state) {
      case 'opening':
      case 'blocked': {
        const i = this.mover(door, 1);
        if (i === -1) {
          door.away = 0;
          this.set(door, 'open');
          return;
        }
        if (door.gap > EPS) {
          door.gap -= dt; // the first leaf is open; the other waits its turn
          this.set(door, 'opening');
          return;
        }
        if (this.playerIn(door, i, 1)) {
          this.set(door, 'blocked');
          return;
        }
        this.moveLeaf(door, i, door.f[i] + dt / door.pair.openS);
        if (this.mover(door, 1) >= 0) {
          this.set(door, 'opening');
          return;
        }
        door.away = 0;
        this.set(door, 'open');
        return;
      }
      case 'open': {
        if (!this.playerAway(door)) {
          door.away = 0;
          return;
        }
        door.away += dt;
        // A procedure's door shuts at once behind a player who came to it and left; opened from
        // afar (within reach of its leaf, farther than AWAY_M from its centre), it waits for them.
        const hold = door.pair.procedure && door.near ? PROCEDURE_HOLD_S : HOLD_S;
        if (door.away < hold - EPS) return;
        // Due to close: it waits, open, until the doorway is clear (an object left in it), asking
        // again every RETRY_S — never open → closing → blocked → open over and over.
        if (this.obstructed(door, this.mover(door, 0))) {
          door.away = hold - RETRY_S;
          return;
        }
        door.manual = false;
        this.set(door, 'closing');
        return;
      }
      case 'closing': {
        const i = this.mover(door, 0);
        if (i === -1) {
          this.set(door, 'closed');
          this.releaseBehind(door);
          return;
        }
        if (door.gap > EPS) {
          door.gap -= dt; // the first leaf is shut; the other waits its turn
          return;
        }
        if (this.obstructed(door, i)) {
          this.set(door, 'blocked');
          if (door.manual) {
            const reason = this.deps.texts.ui('door.notClear', 'The doorway is not clear.');
            this.refuse(door.requestedBy, CLOSE_DOOR_ACTION, reason);
          }
          return;
        }
        this.moveLeaf(door, i, door.f[i] - dt / door.pair.closeS);
        if (this.mover(door, 0) >= 0) return;
        this.set(door, 'closed');
        this.releaseBehind(door);
      }
    }
  }

  /**
   * The leaf to move towards `goal` (0 shut, 1 open), or -1 when both are there: the one already
   * on its way (never more than one is), else the only one not there, else — both at the other
   * end — the one on the player's side of the wall, so they never wait for the far leaf first.
   */
  private mover(door: Door, goal: 0 | 1): -1 | 0 | 1 {
    const [a, b] = door.f;
    if (a > 0 && a < 1) return 0;
    if (b > 0 && b < 1) return 1;
    if (a === goal && b === goal) return -1;
    if (a === goal) return 1;
    if (b === goal) return 0;
    return this.playerSide(door);
  }

  /** The leaf on the player's side of the wall (the half of the pair its closed centre is in). */
  private playerSide(door: Door): 0 | 1 {
    const p = this.deps.player.position;
    const [a, b] = door.centers;
    const nx = a[0] - b[0];
    const nz = a[2] - b[2];
    const along = (p[0] - (a[0] + b[0]) / 2) * nx + (p[2] - (a[2] + b[2]) / 2) * nz;
    return along >= 0 ? 0 : 1;
  }

  /** Puts both leaves' closed centres in the world; false if a scene of the pair is not resident. */
  private place(door: Door): boolean {
    return (
      this.placeLeaf(door.pair.leaves[0], door.centers[0]) &&
      this.placeLeaf(door.pair.leaves[1], door.centers[1])
    );
  }

  private placeLeaf(leaf: DoorLeaf, out: Vec3): boolean {
    const offset = this.deps.scenes.offsetOf(leaf.sceneId);
    if (!offset) return false;
    out[0] = leaf.position[0] + offset[0];
    out[1] = leaf.position[1] + offset[1];
    out[2] = leaf.position[2] + offset[2];
    return true;
  }

  /**
   * The player meets what leaf `i` still sweeps on its way to fraction `to` (+ the margin):
   * opening, its own pocket only — a player in the tunnel stands in front of it, never in its way;
   * closing, the pair's doorway (both leaves alike across and the tunnel between them).
   */
  private playerIn(door: Door, i: 0 | 1, to: number): boolean {
    const { player } = this.deps;
    const geometry = to > door.f[i] ? door.alone[i] : door.geometry;
    sweptBox(geometry, door.f[i], to, MARGIN_M, this.box);
    return capsuleInBox(this.box, player.position, player.radius, player.halfHeight);
  }

  /** Something is in the rest of leaf `i`'s closing path (none: -1): the player or a dynamic body. */
  private obstructed(door: Door, i: -1 | 0 | 1): boolean {
    if (i === -1) return false;
    if (this.playerIn(door, i, 0)) return true; // also leaves the closing path in this.box
    const { center, halfExtents, rotationY } = this.box;
    return this.deps.driver.dynamicBodyIn(center, halfExtents, rotationY);
  }

  private playerAway(door: Door): boolean {
    const p = this.deps.player.position;
    const a = door.centers[0];
    const b = door.centers[1];
    const dx = p[0] - (a[0] + b[0]) / 2;
    const dz = p[2] - (a[2] + b[2]) / 2;
    return dx * dx + dz * dz > AWAY_M * AWAY_M;
  }

  /**
   * Sets leaf `i` to fraction f (snapped to 0 or 1 at its ends); the driver hears changes only.
   * Reaching an end the other leaf is not at starts the gap before the other moves.
   */
  private moveLeaf(door: Door, i: 0 | 1, f: number): void {
    const next = f >= 1 - EPS ? 1 : f <= EPS ? 0 : f;
    if (next === door.f[i]) return;
    door.f[i] = next;
    this.deps.driver.setDoorOpening(door.ids[i], next);
    if ((next === 0 || next === 1) && door.f[1 - i] !== next) door.gap = LEAF_GAP_S;
  }

  private set(door: Door, state: DoorPhase): void {
    if (door.state === state) return;
    door.state = state;
    if (state === 'closed') door.near = false;
    this.deps.events.publish('DoorChanged', { doorIds: door.ids, state });
  }

  private refuse(entityId: string, actionId: string, reason: string): void {
    this.deps.events.publish('ActionBlocked', { entityId, actionId, reason });
  }

  /** Releases each scene of a closed pair that is neither current nor behind another open pair. */
  private releaseBehind(door: Door): void {
    const { scenes } = this.deps;
    for (const { sceneId } of door.pair.leaves) {
      if (sceneId === scenes.currentSceneId || this.wanted(sceneId, door)) continue;
      if (scenes.isResident(sceneId)) scenes.release(sceneId);
    }
  }

  /** Another pair joins `sceneId` that is not closed, or that keeps it attached ahead. */
  private wanted(sceneId: string, except: Door): boolean {
    for (const other of this.doors) {
      if (other === except) continue;
      const [a, b] = other.pair.leaves;
      if (a.sceneId !== sceneId && b.sceneId !== sceneId) continue;
      if (other.state !== 'closed') return true;
      if (this.deps.prepareAhead && other.armed && this.within(other, RELEASE_M)) return true;
    }
    return false;
  }

  /** The player within `m` (horizontally) of a resident leaf of the pair. */
  private within(door: Door, m: number): boolean {
    return this.distance(door) <= m;
  }

  /** The player looks within FACING_RAD of the pair's nearest resident leaf (walking at it). */
  private facing(door: Door): boolean {
    const { yaw, position: p } = this.deps.player;
    if (yaw === undefined) return true;
    let best = Infinity;
    for (const leaf of door.pair.leaves) {
      if (!this.placeLeaf(leaf, this.spot)) continue;
      const dx = this.spot[0] - p[0];
      const dz = this.spot[2] - p[2];
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) return true;
      // Forward is (−sin yaw, −cos yaw).
      const off = Math.acos(
        Math.max(-1, Math.min(1, (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / length)),
      );
      best = Math.min(best, off);
    }
    return best <= FACING_RAD;
  }

  /** Horizontal distance (m) from the player to the nearest resident leaf (Infinity: none). */
  private distance(door: Door): number {
    const p = this.deps.player.position;
    let best = Infinity;
    for (const leaf of door.pair.leaves) {
      if (!this.placeLeaf(leaf, this.spot)) continue;
      best = Math.min(best, Math.hypot(p[0] - this.spot[0], p[2] - this.spot[2]));
    }
    return best;
  }

  /** One attach of `sceneId` at a time, shared by whoever asks meanwhile (a throw: a rejection). */
  private attachOnce(sceneId: string): Promise<string | null> {
    const going = this.attaching.get(sceneId);
    if (going) return going;
    const attach = new Promise<string | null>((resolve) => {
      resolve(this.deps.scenes.attach(sceneId));
    }).finally(() => {
      if (this.attaching.get(sceneId) === attach) this.attaching.delete(sceneId);
    });
    this.attaching.set(sceneId, attach);
    return attach;
  }

  /**
   * A closed, armed pair: the scene behind it attached ahead while the player is within PREPARE_M
   * of it, so a request opens it at once; with both scenes resident and the player beyond
   * RELEASE_M, the one that is not current released again (unless another pair still wants it).
   */
  private prepare(door: Door, dt: number): void {
    if (!this.deps.prepareAhead || door.state !== 'closed') return;
    door.cool = Math.max(0, door.cool - dt);
    const d = this.distance(door);
    const near = d <= PREPARE_M;
    // Away for ARM_S: a position read for a frame or two before a load places the player arms none.
    door.far = near ? 0 : door.far + dt;
    if (door.far >= ARM_S) door.armed = true;
    // Coming towards it, not standing still in reach of PREPARE_M (as a save may leave them).
    door.mark = door.armed && Number.isFinite(d) ? Math.max(door.mark, d) : 0;
    const approached = door.mark - d >= APPROACH_M;
    const { scenes } = this.deps;
    const [a, b] = door.pair.leaves;
    const inA = scenes.isResident(a.sceneId);
    const inB = scenes.isResident(b.sceneId);
    if (inA && inB) {
      if (!this.within(door, RELEASE_M)) this.releaseBehind(door);
      return;
    }
    if (inA === inB || !door.armed || !approached || door.cool > 0 || !near) return;
    if (!this.facing(door)) return;
    const far = (inA ? b : a).sceneId;
    if (this.attaching.has(far)) return;
    const attempt = door.attempt;
    this.attachOnce(far).then(
      (reason) => {
        if (reason !== null && attempt === door.attempt) door.cool = PREPARE_RETRY_S;
      },
      () => {
        if (attempt === door.attempt) door.cool = PREPARE_RETRY_S;
      },
    );
  }
}
