import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import { capsuleInBox, createYawBox } from '../../world/door';
import type { WorldEntity } from '../../world/World';
import { type DoorDriver, HOLD_S, MARGIN_M, type PlayerCapsule } from './DoorSystem';

const EPS = 1e-9;
/** Past `near` plus this (m) the player is away (no flicker at the edge). */
const AWAY_MORE_M = 0.4;

/** What the renderer reads about sliding leaves. */
export interface SlidingState {
  /** A leaf's opening fraction (0 closed … 1 open); 0 for anything else. */
  fraction(entityId: string): number;
}

export interface SlidingSystemDeps {
  events: EventBus<GameEvents>;
  driver: Pick<DoorDriver, 'setDoorOpening' | 'dynamicBodyIn'>;
  player: PlayerCapsule;
  /** Entities already in the world when it starts. */
  entities: () => Iterable<WorldEntity>;
}

interface Slide {
  readonly entity: WorldEntity;
  /** Where its leaf meets the other (its −x edge, closed), on the floor: the doorway's middle. */
  readonly middle: readonly [number, number, number];
  /** Its yaw (a placement turns about +y only). */
  readonly yaw: number;
  f: number;
  /** Open or shut is its goal; `away` counts the seconds since the player left. */
  open: boolean;
  away: number;
}

/**
 * Doors between two rooms of one scene (Phase U, Phú: a starship's door — two leaves part from the
 * middle into the wall; items with `slider`): the only authority on how far each leaf is open,
 * runtime only (never saved: a load starts each one as the player's distance asks). A leaf opens
 * by itself while the player is within its `near` of the doorway's middle, and closes HOLD_S after
 * they are past it (+ AWAY_MORE_M) — never onto the player or an object in the doorway: it waits,
 * open, until the way is clear. Both leaves of a door share the middle, so they agree. Physics
 * slides each leaf's body (DoorDriver), the renderer draws it from `fraction`. A start of a move
 * is announced (`DoorSlid`, for its sound). Paused (dt 0), nothing moves.
 */
export class SlidingSystem implements GameSystem, SlidingState {
  readonly id = 'sliders';
  private readonly slides = new Map<string, Slide>();
  private readonly subscriptions = new Disposables();
  private readonly doorway = createYawBox();

  constructor(private readonly deps: SlidingSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    for (const entity of this.deps.entities()) this.add(entity);
    const s = this.subscriptions;
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.add(entity)));
    s.add(events.subscribe('EntityDespawned', ({ entityId }) => this.slides.delete(entityId)));
  }

  update(dt: number): void {
    if (dt <= 0) return; // paused: nothing moves
    for (const slide of this.slides.values()) {
      const slider = slide.entity.item.slider;
      if (!slider) continue;
      const distance = this.distance(slide);
      if (distance <= slider.near) {
        slide.away = 0;
        this.goal(slide, true);
      } else if (distance > slider.near + AWAY_MORE_M) {
        slide.away += dt;
        if (slide.away >= HOLD_S && !this.blocked(slide)) this.goal(slide, false);
      }
      // Shutting, it stops (and goes back open) the moment someone or something is in its way.
      if (!slide.open && slide.f > 0 && this.blocked(slide)) this.goal(slide, true);
      const target = slide.open ? 1 : 0;
      if (slide.f === target) continue;
      const step = dt / (slide.open ? slider.openS : slider.closeS);
      const raw = slide.open ? Math.min(1, slide.f + step) : Math.max(0, slide.f - step);
      slide.f = Math.abs(raw - target) < EPS ? target : raw;
      this.deps.driver.setDoorOpening(slide.entity.id, slide.f);
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.slides.clear();
  }

  fraction(entityId: string): number {
    return this.slides.get(entityId)?.f ?? 0;
  }

  private add(entity: WorldEntity): void {
    const slider = entity.item.slider;
    if (!slider || this.slides.has(entity.id)) return;
    const q = entity.pose.rotation;
    const yaw = 2 * Math.atan2(q[1], q[3]);
    const half = entity.item.visual.size[0] / 2;
    const [x, , z] = entity.pose.position;
    const slide: Slide = {
      entity,
      middle: [x - Math.cos(yaw) * half, 0, z + Math.sin(yaw) * half],
      yaw,
      f: 0,
      open: false,
      away: 0,
    };
    // Spawned with the player at it (a load, a save in the doorway): it stands open already.
    if (this.distance(slide) <= slider.near) {
      slide.open = true;
      slide.f = 1;
      this.deps.driver.setDoorOpening(entity.id, 1);
    }
    this.slides.set(entity.id, slide);
  }

  private goal(slide: Slide, open: boolean): void {
    if (slide.open === open) return;
    slide.open = open;
    this.deps.events.publish('DoorSlid', {
      entityId: slide.entity.id,
      open,
      position: [slide.middle[0], slide.entity.pose.position[1], slide.middle[2]],
    });
  }

  private distance(slide: Slide): number {
    const p = this.deps.player.position;
    return Math.hypot(p[0] - slide.middle[0], p[2] - slide.middle[2]);
  }

  /** Whether the player or an object stands in the whole doorway (both leaves' place, + margin). */
  private blocked(slide: Slide): boolean {
    const { entity } = slide;
    const [w, h, d] = entity.item.visual.size;
    const box = this.doorway;
    box.center[0] = slide.middle[0];
    box.center[1] = entity.pose.position[1];
    box.center[2] = slide.middle[2];
    box.halfExtents[0] = w + MARGIN_M;
    box.halfExtents[1] = h / 2;
    box.halfExtents[2] = d / 2 + MARGIN_M;
    box.rotationY = slide.yaw;
    const { position, radius, halfHeight } = this.deps.player;
    if (capsuleInBox(box, position, radius, halfHeight)) return true;
    return this.deps.driver.dynamicBodyIn(box.center, box.halfExtents, box.rotationY);
  }
}
