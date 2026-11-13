import { clamp, directionFromYawPitch, type Quat, type Vec3 } from '../../core/math';
import type { PlayerState } from '../../game/GameState';
import type { WorldEntity } from '../../world/World';
import type { ItemDefinition } from '../item';

/**
 * Pitch range (rad, ≈ ±50°) used for the hold point. Looking further down would put a held
 * object inside the player's own capsule; the aim itself is not limited.
 */
export const HOLD_PITCH_LIMIT = 0.87;

/** How low the hold is at `pitch`: 0 down to 0.35 rad below level, 1 at the hold's lowest. */
export function holdLow(pitch: number): number {
  return smooth(-pitch, 0.35, HOLD_PITCH_LIMIT);
}

/**
 * AFFORDANCE: how far (m along the view) a player holding something stoops as they look down,
 * fully at the hold's lowest: the back bends and the knees give (`lean.ts`), down to a burette
 * standing on the floor. The hold moves out with it.
 */
export const STOOP = 0.55;

/**
 * How far from the eye (m) a held object is at `pitch` (clamped): `distance` (config
 * `player.holdDistance`, within the arm's reach) looking ahead; looking down, the arm reaches
 * 0.1 m further and the player stoops (STOOP, the eye moving in along the view); looking up, it
 * is held 0.1 m nearer. So it stays in the hand, wherever the view is.
 */
export function holdReach(pitch: number, distance: number): number {
  const p = clamp(pitch, -HOLD_PITCH_LIMIT, HOLD_PITCH_LIMIT);
  return distance + (0.1 + STOOP) * holdLow(p) - 0.1 * smooth(p, 0.3, HOLD_PITCH_LIMIT);
}

const smooth = (x: number, from: number, to: number) => {
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The pitch (rad) at which the hold point is `dy` m above the eye (below: negative), or null
 * beyond the hold's range. Its height rises with the pitch throughout: found by bisection.
 */
export function holdPitch(dy: number, distance: number): number | null {
  const height = (p: number) => holdReach(p, distance) * Math.sin(p);
  let [lo, hi] = [-HOLD_PITCH_LIMIT, HOLD_PITCH_LIMIT];
  if (dy < height(lo) || dy > height(hi)) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (height(mid) < dy) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Where a held object should be: `holdReach` m from the eye along the (clamped) aim, or further
 * along it so that its centre is at least `clear` m from the player's axis (`heldClearance`: a
 * bulky object held clear of the player, who would otherwise be pushed by it once let go).
 */
export function holdPoint(
  player: Readonly<PlayerState>,
  distance: number,
  out: Vec3,
  clear = 0,
  aside?: readonly [number, number],
): Vec3 {
  const pitch = clamp(player.pitch, -HOLD_PITCH_LIMIT, HOLD_PITCH_LIMIT);
  const reach = Math.max(holdReach(pitch, distance), clear / Math.cos(pitch));
  directionFromYawPitch(player.yaw, pitch, out);
  out[0] = player.position[0] + out[0] * reach;
  out[1] = player.position[1] + player.eyeHeight + out[1] * reach;
  out[2] = player.position[2] + out[2] * reach;
  if (aside) {
    // Held to the right of the view and lower (an extinguisher, not to hide what it is aimed at).
    out[0] += Math.cos(player.yaw) * aside[0];
    out[1] -= aside[1];
    out[2] -= Math.sin(player.yaw) * aside[0];
  }
  return out;
}

/**
 * Pour assist (AFFORDANCE, Phú 2026-11-04: "the person reaches out to pour, no aiming to the
 * centimetre"): pouring (R held) with a vessel's mouth near the aim — within POUR_REACH of the eye
 * and POUR_AIM of the view — the hand takes the spout to POUR_GAP over that mouth. Only where the
 * spout goes: what flows, and whether it is allowed, is the pour's own rule.
 */
export const POUR_REACH = 1.2;
/** The largest angle (rad, about 11°) between the view and a mouth the pour assist reaches for. */
export const POUR_AIM = 0.2;
/** How high (m) over the mouth the assisted spout is held. */
export const POUR_GAP = 0.05;

/**
 * How far (m) from the player's axis a held `item` stays: the capsule's `radius`, the item's own
 * half width across and 2 cm. Held upright, that is its box's at any heading; held as grabbed
 * (`handling` "free", turned any way), its bounding sphere's (a ball's own radius).
 */
export function heldClearance(
  radius: number,
  { visual: { shape, size }, physical }: Pick<ItemDefinition, 'visual' | 'physical'>,
): number {
  const across =
    physical.handling !== 'free'
      ? Math.hypot(size[0], size[2]) / 2
      : shape === 'sphere'
        ? size[0] / 2
        : Math.hypot(...size) / 2;
  return radius + across + 0.02;
}

/**
 * The physics side of holding, implemented by the physics system — the only code that moves
 * bodies. Interaction decides *what* is held; the holder makes the body follow the hold point
 * while it keeps colliding with the world.
 */
export interface ObjectHolder {
  /** Starts holding a dynamic body; false when the entity has none (or something is held). */
  grab(entityId: string): boolean;
  /** Ends the hold: the body is an ordinary dynamic body again, moving at `velocity` (m/s). */
  release(velocity: Readonly<Vec3>): void;
  /**
   * The tilt (rad, 0 = upright) the held object is turned to, about the view's right axis so its
   * top tips away from the player. Only items whose `physical.handling` is not "free" are turned:
   * upright when grabbed, keeping their heading as the view turns. Physics turns the body on its
   * fixed step at a capped rate; the value stays until the next call, grab or release.
   */
  setHoldTilt(rad: number): void;
  /**
   * Holds a pouring object so that its spout (`container.pour.spout`) is at `point` (world)
   * instead of at the hold point, as its tilt turns it; null: back to the hold point. Physics
   * drives it there as it drives the hold, swept against static surfaces. The value stays until
   * the next call, grab or release.
   */
  setSpoutAt(point: Readonly<Vec3> | null): void;
  /**
   * Where the held object would be set down at the aim, checked (a surface within reach that
   * faces up, room for it there, a seat that takes it); moves nothing. Asked on the key press
   * only, never per frame.
   */
  planSetDown(): SetDownPlan;
  /**
   * Sets the held object down where the last `planSetDown` (same frame) found: the hold ends at
   * once, and physics drives the body to its rest pose over a few steps and lets it go there at
   * rest — it never teleports. False (nothing changes) without an accepted plan.
   */
  setDown(): boolean;
}

/**
 * Why a set-down is refused: nothing solid along the aim · the surface does not face up (more
 * than 10° off) · it does not fit there (a wall, another object, the player) · the surface is
 * beyond reach · the aim is on a seat that does not take this item (its `accepts` tags).
 */
export type SetDownRefusal = 'no-surface' | 'not-level' | 'no-room' | 'too-far' | 'wrong-seat';

export type SetDownPlan =
  | {
      ok: true;
      /** The entity it stands on, or null for the room (the floor). */
      surfaceId: string | null;
      /** The id of the surface entity's seat it goes into, or null for a free spot. */
      seat: string | null;
    }
  | { ok: false; reason: SetDownRefusal };

/**
 * The rule side of a set-down (StationSystem): refuses it with the reason shown to the player, or
 * commits it (records the seat, marks the step) and returns null. Asked once per key press, after
 * the geometry was accepted and before the body moves; a refusal keeps the object in hand.
 */
export type SetDownRule = (
  held: WorldEntity,
  surfaceId: string | null,
  seat: string | null,
) => string | null;

/**
 * The physics side of objects whose motion gameplay dictates (a ball in a launcher or in a
 * simulated flight), implemented by the physics system. A driven body leaves the simulation —
 * it neither moves nor collides — and its entity pose is whatever the driver writes.
 */
export interface PoseDriver {
  /** Takes a dynamic body out of the simulation; false if the entity has none. */
  drive(entityId: string): boolean;
  /** Puts it back where its pose now is, at rest, as an ordinary dynamic body. */
  stopDriving(entityId: string): void;
}

/** First solid surface along a ray, used so targets behind walls or furniture are not picked. */
export interface RayHit {
  distance: number;
  /** Entity the surface belongs to, or null for rooms and other non-entity colliders. */
  entityId: string | null;
  /** The surface's outward unit normal where the ray met it (zero if the ray started inside). */
  readonly normal: Vec3;
}

export interface LineOfSight {
  /** The hit object is reused by the next call (no allocation per ray): read it at once. */
  castRay(origin: Readonly<Vec3>, dir: Readonly<Vec3>, maxDistance: number): RayHit | null;
}

// ---- Held orientation (pure: physics turns bodies with it, gameplay may read it) ------------

/** out = a·b (b first, then a). `out` may be a or b. */
export function mulQuat(a: Readonly<Quat>, b: Readonly<Quat>, out: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

/** yaw·q: q turned `yaw` rad about world +y. `out` may be q. */
export function turnYaw(q: Readonly<Quat>, yaw: number, out: Quat): Quat {
  const s = Math.sin(yaw / 2);
  const c = Math.cos(yaw / 2);
  const [x, y, z, w] = q;
  out[0] = c * x + s * z;
  out[1] = c * y + s * w;
  out[2] = c * z - s * x;
  out[3] = c * w - s * y;
  return out;
}

/** Angle (rad, 0–π) between an object's own +y and world +y: how far it is tipped over. */
export function tiltOf(q: Readonly<Quat>): number {
  return Math.acos(clamp(1 - 2 * (q[0] * q[0] + q[2] * q[2]), -1, 1));
}

/** Its heading (rad): the rotation's turn about world +y, its tip left out (swing–twist). */
export function headingOf(q: Readonly<Quat>): number {
  return 2 * Math.atan2(q[1], q[3]);
}

/**
 * A held object's rotation: its own heading `offset` (rad) relative to the view's yaw, tipped
 * `tilt` rad about the view's right axis, top away from the player: yaw(view)·rotX(−tilt)·yaw(offset).
 */
export function holdRotation(viewYaw: number, tilt: number, offset: number, out: Quat): Quat {
  const sx = Math.sin(-tilt / 2);
  const cx = Math.cos(-tilt / 2);
  const sy = Math.sin(offset / 2);
  const cy = Math.cos(offset / 2);
  out[0] = sx * cy;
  out[1] = cx * sy;
  out[2] = sx * sy;
  out[3] = cx * cy;
  return turnYaw(out, viewYaw, out);
}
