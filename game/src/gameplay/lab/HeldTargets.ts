import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { World, WorldEntity } from '../../world/World';

/** The rules asked (StationSystem): each answers without committing or keeping anything. */
export interface TargetRules {
  /** Why `sourceId` may not pour into `receiverId` now, or null. */
  pourBlock(sourceId: string, receiverId: string): string | null;
  /** Why `held` may not be set down on `seat` of `surfaceId` now, or null. */
  setDownBlock(held: WorldEntity, surfaceId: string | null, seat: string | null): string | null;
}

export interface HeldTargetsDeps {
  /** The hands (InteractionSystem): what is held, and what its "with held" actions reach now. */
  hands: {
    readonly heldEntity: WorldEntity | null;
    usableTargets(out: string[]): string[];
  };
  rules: TargetRules;
  world: World;
  events: EventBus<GameEvents>;
}

/** Events after which what the held object can act on may have changed. */
const CHANGES = [
  'ObjectGrabbed',
  'ObjectReleased',
  'ObjectSetDown',
  'EntityStateChanged',
  'EntitySpawned',
  'EntityDespawned',
  'LiquidPoured',
  'ContainerRequested',
  'InteractionPerformed',
  'ExperimentStateChanged',
  'ExperimentParameterChanged',
  'SceneEntered',
] as const satisfies readonly (keyof GameEvents)[];

/**
 * Every object the held one can act on now (Phase A contract A1): an object a "with held" action
 * would accept (fill, deliver…), a vessel it may pour into, a seat it may be set down on — each
 * asked of the rule that already decides it, so an outline (render) or a task step can never show
 * an action the rules would refuse. Only the current scene's rooms count. Recomputed after an
 * event that can change it, never per frame; `version` grows when the list changes.
 */
export class HeldTargets implements GameSystem {
  readonly id = 'held-targets';
  private list: string[] = [];
  private next: string[] = [];
  private readonly rooms = new Set<string>();
  private dirty = true;
  private readonly subscriptions = new Disposables();
  version = 0;

  constructor(private readonly deps: HeldTargetsDeps) {}

  /** The entity ids, in no meaningful order (read-only: replaced on a change). */
  get ids(): readonly string[] {
    return this.list;
  }

  init(): void {
    const mark = () => {
      this.dirty = true;
    };
    for (const event of CHANGES) this.subscriptions.add(this.deps.events.subscribe(event, mark));
  }

  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const next = this.collect(this.next);
    if (sameMembers(next, this.list)) return;
    [this.list, this.next] = [next, this.list];
    this.version++;
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  private collect(out: string[]): string[] {
    const { hands, rules, world } = this.deps;
    hands.usableTargets(out);
    const held = hands.heldEntity;
    if (!held) return out;
    this.rooms.clear();
    for (const room of world.activeRooms) this.rooms.add(room.id);
    const pours = held.item.container?.pour !== undefined;
    const setsDown = held.item.physical.handling !== 'free';
    for (const entity of world.allEntities()) {
      if (entity.id === held.id || !this.rooms.has(entity.roomId) || out.includes(entity.id)) {
        continue;
      }
      const { container, seats } = entity.item;
      if (pours && container?.mouth && rules.pourBlock(held.id, entity.id) === null) {
        out.push(entity.id);
        continue;
      }
      if (!setsDown || !seats) continue;
      for (const seat of seats) {
        const fits = seat.accepts.some((tag) => held.item.tags.includes(tag));
        if (fits && rules.setDownBlock(held, entity.id, seat.id) === null) {
          out.push(entity.id);
          break;
        }
      }
    }
    return out;
  }
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
