import { z } from 'zod';
import { Disposables, type EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState, RestState } from '../../game/GameState';
import type { World, WorldEntity } from '../../world/World';
import type { BehaviorDefinition } from '../interaction/behaviors';
import type { InputState } from './InputState';

/** Seconds lying still before the player falls asleep. */
export const FALL_ASLEEP_S = 4;
/** How long getting up takes (s): from the seat or the pillow back to standing. */
export const RISE_S = 0.6;
/** A sitter's eye over the seat, and a sleeper's over the mattress at the pillow (m). */
const SIT_EYE = 0.74;
const LIE_EYE = 0.16;

/**
 * Sitting down and lying down (Phú, Phase F-1): an item with `rest` (a bench, a chair, a bed)
 * offers E to sit or lie on its nearest free place. The player stays where they stood (the
 * capsule does not move: nothing to push out of the furniture); the view is drawn from the seat or
 * the pillow (`state.player.rest.eye`), the player cannot walk, and looking stays free (a sleeper's
 * a little). Lying still for FALL_ASLEEP_S, they fall asleep. E or a step gets them up; a hit
 * (`PlayerHit`) wakes a sleeper with a start. Getting up eases the view back over RISE_S.
 */
export class RestSystem implements GameSystem {
  readonly id = 'rest';
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly deps: {
      state: GameState;
      input: InputState;
      events: EventBus<GameEvents>;
      world: World;
    },
  ) {}

  init(): void {
    const { events } = this.deps;
    this.subscriptions.add(
      events.subscribe('RestRequested', ({ entityId }) => this.rest(entityId)),
    );
    this.subscriptions.add(
      events.subscribe('PlayerHit', () => {
        if (this.deps.state.player.rest) this.getUp(true);
      }),
    );
    // A scene change leaves the seat behind.
    for (const type of ['SceneLoading', 'SceneEntered'] as const) {
      this.subscriptions.add(events.subscribe(type, () => this.clear()));
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  get resting(): boolean {
    return this.deps.state.player.rest !== null;
  }

  update(dt: number): void {
    const { state, input } = this.deps;
    const player = state.player;
    if (player.rising) {
      player.rising.t += dt / RISE_S;
      if (player.rising.t >= 1) player.rising = null;
    }
    const rest = player.rest;
    if (!rest || state.session.phase !== 'playing' || state.session.paused) return;
    const moving =
      input.isHeld('moveForward') ||
      input.isHeld('moveBack') ||
      input.isHeld('moveLeft') ||
      input.isHeld('moveRight') ||
      input.stickX !== 0 ||
      input.stickY !== 0;
    if (input.wasPressed('interact') || moving) {
      this.getUp(false);
      return;
    }
    rest.seconds += dt;
    if (rest.kind === 'lie' && !rest.asleep && rest.seconds >= FALL_ASLEEP_S) {
      rest.asleep = true;
      this.deps.events.publish('RestChanged', { kind: 'lie', asleep: true, jolted: false });
    }
  }

  /** Sits or lies on the entity's free place nearest the player. */
  rest(entityId: string): boolean {
    const { world, state, events } = this.deps;
    const entity = world.entity(entityId);
    const spec = entity?.item.rest;
    if (!entity || !spec || state.player.rest) return false;
    const spot = nearestSpot(entity, state.player.position);
    if (!spot) return false;
    const { position, rotation } = entity.pose;
    const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
    const at = toWorld(position, yaw, spot.at);
    // Facing out of a seat towards where the player stood (a bench has two sides); along a bed.
    const facing =
      spec.kind === 'lie'
        ? yaw + (spot.yaw ?? 0)
        : Math.atan2(-(state.player.position[0] - at[0]), -(state.player.position[2] - at[2]));
    const eye: Vec3 = [at[0], at[1] + (spec.kind === 'sit' ? SIT_EYE : LIE_EYE), at[2]];
    state.player.rest = {
      entityId,
      kind: spec.kind,
      at,
      eye,
      facing,
      asleep: false,
      seconds: 0,
    };
    state.player.yaw = facing;
    state.player.pitch = spec.kind === 'lie' ? 1.1 : -0.05;
    state.player.rising = null;
    events.publish('RestChanged', { kind: spec.kind, asleep: false, jolted: false });
    return true;
  }

  /** Back on the feet: the view eases from the seat to the eye (`jolted`: woken by a hit). */
  getUp(jolted: boolean): void {
    const player = this.deps.state.player;
    const rest = player.rest;
    if (!rest) return;
    player.rest = null;
    player.rising = { from: [...rest.eye], t: jolted ? 0.3 : 0 };
    if (rest.kind === 'lie') player.pitch = 0;
    this.deps.events.publish('RestChanged', { kind: null, asleep: false, jolted });
  }

  private clear(): void {
    this.deps.state.player.rest = null;
    this.deps.state.player.rising = null;
  }
}

const RestParams = z.object({});

/** The furniture's own action: sit down, or lie down (the RestSystem decides where). */
export const restBehavior: BehaviorDefinition<object> = {
  id: 'rest',
  params: RestParams,
  actionIds: () => ['rest'],
  check: (item) => (item.rest ? null : '"rest" needs the item\'s "rest"'),
  createActions: ({ entity, events, texts, hands }) => [
    {
      id: 'rest',
      get label() {
        return entity.item.rest?.kind === 'lie'
          ? texts.ui('action.lieDown', 'Lie down')
          : texts.ui('action.sitDown', 'Sit down');
      },
      isAvailable: () => hands.heldId === null,
      perform: () => events.publish('RestRequested', { entityId: entity.id }),
    },
  ],
};

function toWorld(position: Readonly<Vec3>, yaw: number, [x, y, z]: readonly number[]): Vec3 {
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return [
    position[0] + c * (x ?? 0) + s * (z ?? 0),
    position[1] + (y ?? 0),
    position[2] - s * (x ?? 0) + c * (z ?? 0),
  ];
}

/** The rest place of `entity` nearest `from` (its own frame's places, in the world). */
function nearestSpot(entity: WorldEntity, from: Readonly<Vec3>) {
  const spec = entity.item.rest;
  if (!spec) return null;
  const { position, rotation } = entity.pose;
  const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
  let best: (typeof spec.spots)[number] | null = null;
  let distance = Infinity;
  for (const spot of spec.spots) {
    const [x, , z] = toWorld(position, yaw, spot.at);
    const d = Math.hypot(x - from[0], z - from[2]);
    if (d < distance) {
      distance = d;
      best = spot;
    }
  }
  return best;
}

export type { RestState };
