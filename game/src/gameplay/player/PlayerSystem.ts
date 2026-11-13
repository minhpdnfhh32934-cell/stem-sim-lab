import type { EventBus } from '../../core/EventBus';
import type { GameConfig } from '../../core/config';
import { clamp, type Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { World } from '../../world/World';
import type { InputState } from './InputState';
import type { LineOfSight } from '../interaction/hold';
import { easeInspect, lookScale } from './inspect';
import { easeLean, HEAD_CLEAR, leanDirection, leanTarget, pourLean } from './lean';

const MAX_PITCH = 1.45; // rad, just short of straight up/down to avoid gimbal flip

export interface PlayerSystemDeps {
  state: GameState;
  input: InputState;
  world: World;
  events: EventBus<GameEvents>;
  config: GameConfig;
  /** Whether something is held (the lean keeps it at arm's length, the stoop follows it). */
  holding?: () => boolean;
  /**
   * The action acted out now (Phase H-3): while one plays the player does not move (looking
   * stays free) and leans as it asks (a crouch to the floor).
   */
  action?: () => {
    readonly busy: boolean;
    readonly lean: number;
    readonly glance: number;
    /** The way (m) the player steps before an action's hands reach out, or null. */
    readonly step: Readonly<Vec3> | null;
  };
  /** Where the hand holds a spout out to pour (the pour assist), if it does: the eye follows. */
  pourGoal?: () => Readonly<Vec3> | null;
  /** The clearance probe: the head stops short of walls, shelves and benches. */
  lineOfSight?: LineOfSight;
  /** The player's look sensitivity (× the configured one; the settings'). */
  sensitivity?: () => number;
}

/**
 * First-person look and movement intent. It turns input into yaw/pitch and a desired horizontal
 * velocity (`player.moveIntent`); the physics system moves the collision capsule and writes the
 * resolved position back. Also publishes `PlayerEnteredRoom` when the player's room changes.
 */
export class PlayerSystem implements GameSystem {
  readonly id = 'player';

  /** 0 the base view … 1 the close-inspection view, eased (`inspect.ts`); the renderer draws it. */
  private inspecting = 0;
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly ahead: Vec3 = [0, 0, 0];

  constructor(private readonly deps: PlayerSystemDeps) {}

  get inspectAmount(): number {
    return this.inspecting;
  }

  update(dt = 0): void {
    const { state, input, world, events, config } = this.deps;
    const player = state.player;
    const intent = player.moveIntent;
    intent[0] = 0;
    intent[1] = 0;
    intent[2] = 0;
    // At a workspace the player stands still and the camera holds: no look, no move, and the
    // close view is gone at once (the workspace's camera is laid out for the base field of view).
    // (The Explain view holds the player as a workspace does: its camera is the renderer's; so
    // does a conversation, the NpcSystem turning the view to the person talked to.)
    const workspace =
      (state.session.workspace ?? null) !== null ||
      (state.session.explain ?? null) !== null ||
      (state.session.conversation ?? null) !== null ||
      (state.session.paper ?? null) !== null;
    const looking = state.session.phase === 'playing' && !workspace && !state.session.paused;
    this.inspecting =
      looking && input.isHeld('inspect')
        ? easeInspect(this.inspecting, 1, dt)
        : workspace || state.session.phase !== 'playing'
          ? 0
          : easeInspect(this.inspecting, 0, dt);
    if (state.session.phase !== 'playing' || workspace) {
      player.lean = 0;
      player.glance = 0;
      return;
    }

    const sensitivity =
      config.input.mouseSensitivity * (this.deps.sensitivity?.() ?? 1) * lookScale(this.inspecting);
    player.yaw -= input.lookDeltaX * sensitivity;
    player.yaw += input.turnYaw;
    const pitchSign = config.input.invertY ? 1 : -1;
    player.pitch = clamp(
      player.pitch + pitchSign * input.lookDeltaY * sensitivity + input.turnPitch,
      -MAX_PITCH,
      MAX_PITCH,
    );

    // An analog stick (touch, gamepad) walks as far as it is pushed; else the walking keys.
    const analog = Math.hypot(input.stickX, input.stickY);
    const forward =
      analog > 0 ? -input.stickY : axis(input.isHeld('moveForward'), input.isHeld('moveBack'));
    const right =
      analog > 0 ? input.stickX : axis(input.isHeld('moveRight'), input.isHeld('moveLeft'));
    if (forward !== 0 || right !== 0) {
      const pace = input.isHeld('run') ? config.player.runSpeed : config.player.walkSpeed;
      const speed = analog > 0 ? pace * Math.min(1, analog) : pace;
      const scale = speed / Math.hypot(forward, right);
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      intent[0] = (-sin * forward + cos * right) * scale;
      intent[2] = (-cos * forward - sin * right) * scale;
    }

    // Sitting or lying (RestSystem): looking only; the RestSystem gets them up.
    if (player.rest) {
      intent[0] = 0;
      intent[2] = 0;
    }
    const action = this.deps.action?.();
    player.lean = easeLean(player.lean, Math.max(this.leanWanted(), action?.lean ?? 0), dt);
    player.glance = easeLean(player.glance, action?.glance ?? 0, dt);
    if (action?.busy) {
      // Standing for the action; first a step up to what the hands work, if it is out of reach.
      const step = action.step;
      const way = step ? Math.hypot(step[0], step[2]) : 0;
      const speed =
        step && way > 1e-3 ? (config.player.walkSpeed * Math.min(1, 0.3 + way / 0.3)) / way : 0;
      intent[0] = step ? step[0] * speed : 0;
      intent[2] = step ? step[2] * speed : 0;
    }

    // Uses the position physics resolved last frame; room changes are announced one frame late.
    // Inside a doorway (between two rooms' bounds) the player is still in the room they came from.
    const room = world.roomAt(player.position[0], player.position[2]);
    if (room && room.id !== player.roomId) {
      const previousRoomId = player.roomId;
      player.roomId = room.id;
      events.publish('PlayerEnteredRoom', { roomId: room.id, previousRoomId });
    }
  }

  /** The lean wanted now: `leanTarget`, the head kept `HEAD_CLEAR` short of what is ahead. */
  private leanWanted(): number {
    const { state, input, config, holding, pourGoal, lineOfSight } = this.deps;
    const player = state.player;
    this.eye[0] = player.position[0];
    this.eye[1] = player.position[1] + player.eyeHeight;
    this.eye[2] = player.position[2];
    const held = holding?.() ?? false;
    const working = input.isHeld('inspect') || (held && input.isHeld('pour'));
    const goal = pourGoal?.() ?? null;
    const want = goal
      ? pourLean(Math.hypot(goal[0] - this.eye[0], goal[1] - this.eye[1], goal[2] - this.eye[2]))
      : leanTarget(player.pitch, config.player.holdDistance, { working, holding: held });
    if (want <= 0 || !lineOfSight) return Math.max(0, want);
    leanDirection(player.yaw, player.pitch, this.ahead);
    const hit = lineOfSight.castRay(this.eye, this.ahead, want + HEAD_CLEAR);
    return hit ? Math.max(0, Math.min(want, hit.distance - HEAD_CLEAR)) : want;
  }
}

const axis = (positive: boolean, negative: boolean): number =>
  (positive ? 1 : 0) - (negative ? 1 : 0);
