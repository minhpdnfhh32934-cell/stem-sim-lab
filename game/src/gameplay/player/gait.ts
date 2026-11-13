import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { World } from '../../world/World';

/** A step's length (m): the legs swing once per step. */
export const STRIDE = 0.7;
/** Slower than this (m/s) the feet shuffle: no footfall is heard. */
const STEPPING = 0.35;
const TURN = Math.PI * 2;
/** Where a foot comes down in the swing: at its ends, the legs farthest apart. */
const LEFT_DOWN = Math.PI / 2;
const RIGHT_DOWN = (3 * Math.PI) / 2;

/**
 * The walk's rhythm from the feet's own movement: the speed they move at (eased) and the swing's
 * phase, a stride per half turn. One for the player (`GaitSystem`): the body's legs swing by it
 * and the footsteps are heard by it, so a foot is heard as it is seen to come down.
 */
export class Gait {
  speed = 0;
  phase = 0;
  private x = 0;
  private z = 0;
  private known = false;

  /** Forgets where the feet were (a scene change, a jump): the next move is not a walk. */
  reset(): void {
    this.known = false;
    this.speed = 0;
  }

  /** Advances by the feet's move to (x, z); the foot that came down: 1 left, 2 right, 0 none. */
  step(dt: number, x: number, z: number): 0 | 1 | 2 {
    if (dt <= 0) return 0;
    if (this.known) {
      const moved = Math.hypot(x - this.x, z - this.z) / dt;
      this.speed += (Math.min(moved, 4) - this.speed) * Math.min(1, dt * 10);
    }
    this.x = x;
    this.z = z;
    this.known = true;
    const from = this.phase;
    const to = from + (dt * this.speed * Math.PI) / STRIDE;
    this.phase = to % TURN;
    if (this.speed < STEPPING) return 0;
    const crossed = (at: number) =>
      (from < at && to >= at) || (from < at + TURN && to >= at + TURN);
    return crossed(LEFT_DOWN) ? 1 : crossed(RIGHT_DOWN) ? 2 : 0;
  }
}

export interface GaitSystemDeps {
  state: GameState;
  world: World;
  events: EventBus<GameEvents>;
}

/**
 * The player's gait, after physics has moved the capsule: a footstep (`Footstep`, with the floor
 * of the room it is in) each time a foot comes down while the player is on the ground.
 */
export class GaitSystem implements GameSystem {
  readonly id = 'gait';
  readonly gait = new Gait();
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: GaitSystemDeps) {}

  init(): void {
    this.subscriptions.add(this.deps.events.subscribe('SceneEntered', () => this.gait.reset()));
  }

  update(dt: number): void {
    const { state, world, events } = this.deps;
    const player = state.player;
    if (state.session.phase !== 'playing') {
      this.gait.reset();
      return;
    }
    const foot = this.gait.step(dt, player.position[0], player.position[2]);
    if (foot === 0 || !player.grounded) return;
    const room = world.roomAt(player.position[0], player.position[2]);
    events.publish('Footstep', {
      foot: foot === 1 ? 'left' : 'right',
      speed: this.gait.speed,
      floor: room?.floor ?? 'vinyl',
    });
  }

  dispose(): void {
    this.subscriptions.dispose();
  }
}
