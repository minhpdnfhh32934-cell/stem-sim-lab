import { Disposables, type EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { EntityStates } from '../../world/EntityStates';
import { type BodyQuery, bodyInSwing, capsuleInSwing } from '../../world/hinge';
import type { WorldEntity } from '../../world/World';
import { MARGIN_M, type PlayerCapsule } from './DoorSystem';

const EPS = 1e-9;

/** The physics side of hinged leaves, implemented by the physics system (like DoorDriver). */
export interface HingeDriver {
  /** Turns an item's hinged leaves to opening fraction f (0 closed … 1 open). */
  setSwing(entityId: string, f: number): void;
}

/** What behaviours and the renderer read about hinged leaves. */
export interface HingeState {
  /** An item's leaves' opening fraction f (0 closed … 1 open); 0 for anything else. */
  fraction(entityId: string): number;
  /** Whether its leaves could swing all the way open (or shut) now without meeting the player. */
  clear(entityId: string, open: boolean): boolean;
  /**
   * Whether closing its leaves now would sweep into a dynamic body (glassware on a shelf edge): a
   * kinematic leaf would shove it, so the close is refused. False without the physics query.
   */
  blockedShut(entityId: string): boolean;
}

export interface HingeSystemDeps {
  events: EventBus<GameEvents>;
  entityStates: EntityStates;
  driver: HingeDriver;
  player: PlayerCapsule;
  /** Entities already in the world when it starts. */
  entities: () => Iterable<WorldEntity>;
  /** Dynamic bodies where a closing leaf would sweep (physics); none: never asked. */
  bodies?: BodyQuery;
}

interface Swing {
  readonly entity: WorldEntity;
  /** Its leaves' opening fraction (runtime only: a load snaps it to the saved `open` state). */
  f: number;
}

/**
 * Hinged leaves (items with `hinged`: the PPE cabinet's doors, the washroom door): the only
 * authority on how far they are open, runtime only. An item's `open` state is the goal; its leaves
 * turn towards it at 1/swingS per second and hold where they are while the player stands in what
 * they still sweep (+ MARGIN_M), going on once clear — never into the player, never pushing them.
 * Physics turns each leaf's body (HingeDriver), the renderer draws them from `fraction`. A request
 * to open or close is refused beforehand when the whole swing would meet the player (`clear`).
 * Spawned (a load, a save), they stand at their state at once. Paused (dt 0), nothing moves.
 */
export class HingeSystem implements GameSystem, HingeState {
  readonly id = 'hinges';
  private readonly swings = new Map<string, Swing>();
  /** The swings not at their goal: only these are looked at each frame. */
  private readonly moving = new Set<Swing>();
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: HingeSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    for (const entity of this.deps.entities()) this.add(entity);
    const s = this.subscriptions;
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.add(entity)));
    s.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        const swing = this.swings.get(entityId);
        if (swing) this.moving.delete(swing);
        this.swings.delete(entityId);
      }),
    );
    s.add(
      events.subscribe('EntityStateChanged', ({ entityId, key }) => {
        const swing = key === 'open' ? this.swings.get(entityId) : undefined;
        if (swing) this.moving.add(swing);
      }),
    );
  }

  update(dt: number): void {
    if (dt <= 0) return; // paused: nothing moves
    for (const swing of this.moving) {
      const { entity } = swing;
      const hinged = entity.item.hinged;
      if (!hinged) continue;
      const goal = this.isOpen(entity) ? 1 : 0;
      const step = dt / hinged.swingS;
      const raw = goal > swing.f ? Math.min(goal, swing.f + step) : Math.max(goal, swing.f - step);
      const next = Math.abs(raw - goal) < EPS ? goal : raw; // sums of 1/60 s steps drift by ~1e-16
      if (this.meets(swing, next)) continue; // the player is in its way: it waits, held
      swing.f = next;
      this.deps.driver.setSwing(entity.id, next);
      if (next === goal) this.moving.delete(swing);
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.swings.clear();
    this.moving.clear();
  }

  fraction(entityId: string): number {
    return this.swings.get(entityId)?.f ?? 0;
  }

  clear(entityId: string, open: boolean): boolean {
    const swing = this.swings.get(entityId);
    return !swing || !this.meets(swing, open ? 1 : 0);
  }

  blockedShut(entityId: string): boolean {
    const swing = this.swings.get(entityId);
    const hinged = swing?.entity.item.hinged;
    const bodies = this.deps.bodies;
    if (!swing || !hinged || !bodies || swing.f === 0) return false;
    const { position, rotation: q } = swing.entity.pose;
    const yaw = 2 * Math.atan2(q[1], q[3]); // a placement turns about +y only
    const widest = (hinged.angleDeg * Math.PI) / 180;
    for (const leaf of hinged.leaves) {
      if (bodyInSwing(position, yaw, leaf, widest, swing.f, 0, bodies)) return true;
    }
    return false;
  }

  private add(entity: WorldEntity): void {
    if (!entity.item.hinged || this.swings.has(entity.id)) return;
    this.swings.set(entity.id, { entity, f: this.isOpen(entity) ? 1 : 0 });
  }

  private isOpen(entity: WorldEntity): boolean {
    return this.deps.entityStates.get(entity.id, 'open') === true;
  }

  /** Whether any of its leaves meets the player on the way from where it is to fraction `to`. */
  private meets(swing: Swing, to: number): boolean {
    const { entity, f } = swing;
    const hinged = entity.item.hinged;
    if (!hinged || f === to) return false;
    const widest = (hinged.angleDeg * Math.PI) / 180;
    const { position, radius, halfHeight } = this.deps.player;
    const q = entity.pose.rotation;
    const yaw = 2 * Math.atan2(q[1], q[3]); // a placement turns about +y only
    for (const leaf of hinged.leaves) {
      const at: Readonly<Vec3> = entity.pose.position;
      if (capsuleInSwing(at, yaw, leaf, widest, f, to, MARGIN_M, position, radius, halfHeight)) {
        return true;
      }
    }
    return false;
  }
}
