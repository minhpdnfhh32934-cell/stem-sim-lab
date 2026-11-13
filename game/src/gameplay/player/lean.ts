import { directionFromYawPitch, type Vec3 } from '../../core/math';
import type { PlayerState } from '../../game/GameState';
import { holdLow, holdReach, STOOP } from '../interaction/hold';

/**
 * Leaning in (Phase H-2, H6): for precise work the eye moves towards what is looked at, along the
 * view (down and forward when looking down), while the feet stay and a held object stays where it
 * is held — so it stays in the middle of the view, only closer. Pure and allocation-free;
 * `PlayerSystem` eases `player.lean`, the renderer draws the eye there and bends the body to it.
 * Pacing and comfort only: nothing here is a model input or a measurement.
 */

/** AFFORDANCE: how far (m) the eye moves in while pouring (R held) or looking closely (C). */
export const LEAN_IN = 0.25;
/** A held object stays at least this far (m) from the eye. */
export const HELD_CLEAR = 0.25;
/** The head's room (m): the eye stops this far short of what the probe meets. */
export const HEAD_CLEAR = 0.15;
/** AFFORDANCE: seconds the lean takes to cover 1 − 1/e of the way to its target. */
export const LEAN_EASE_S = 0.12;

/** Why the player leans: working (pouring, looking closely) and whether something is held. */
export interface LeanCause {
  readonly working: boolean;
  readonly holding: boolean;
}

/**
 * The lean (m along the view) the player wants now, before the clearance probe: `LEAN_IN` while
 * working, the stoop while holding and looking down, never so far that a held object comes closer
 * than `HELD_CLEAR`.
 */
export function leanTarget(pitch: number, holdDistance: number, cause: LeanCause): number {
  const stoop = cause.holding ? STOOP * holdLow(pitch) : 0;
  const lean = Math.max(cause.working ? LEAN_IN : 0, stoop);
  return cause.holding ? Math.min(lean, holdReach(pitch, holdDistance) - HELD_CLEAR) : lean;
}

/** AFFORDANCE: how far (m) the eye leans at most to follow a hand reaching to pour (`pourLean`). */
export const POUR_LEAN = 0.6;
/** Where the eye leans to, from a spout the hand holds out to pour: about an arm's length (m). */
const POUR_ARM = 0.5;

/**
 * The lean (m along the view) while the hand reaches a spout `distance` m from the upright eye
 * to pour (the pour assist): the eye comes to within an arm's length of it, at least `LEAN_IN`,
 * at most POUR_LEAN, never closer than `HELD_CLEAR`.
 */
export function pourLean(distance: number): number {
  const lean = Math.min(POUR_LEAN, Math.max(LEAN_IN, distance - POUR_ARM));
  return Math.max(0, Math.min(lean, distance - HELD_CLEAR));
}

/** The direction the eye leans in: the view's, never upwards (the feet stay on the floor). */
export function leanDirection(yaw: number, pitch: number, out: Vec3): Vec3 {
  directionFromYawPitch(yaw, Math.min(pitch, 0), out);
  return out;
}

/** The eye, leaned: `position + eyeHeight` moved `lean` m along `leanDirection`. */
export function eyeOf(player: Readonly<PlayerState>, out: Vec3): Vec3 {
  leanDirection(player.yaw, player.pitch, out);
  out[0] = player.position[0] + out[0] * player.lean;
  out[1] = player.position[1] + player.eyeHeight + out[1] * player.lean;
  out[2] = player.position[2] + out[2] * player.lean;
  return out;
}

/** One frame towards `target`, the same at any frame rate: exponential in time. */
export function easeLean(lean: number, target: number, dt: number): number {
  if (dt <= 0) return lean;
  const next = lean + (target - lean) * (1 - Math.exp(-dt / LEAN_EASE_S));
  return Math.abs(next - target) < 0.0005 ? target : next;
}
