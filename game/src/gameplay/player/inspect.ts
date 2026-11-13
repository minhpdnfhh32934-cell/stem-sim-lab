/**
 * The close-inspection view: while the `inspect` input is held the field of view narrows and the
 * mouse turns the view less, so a vessel's mark, level or colour can be looked at closely. Pure
 * and allocation-free; `PlayerSystem` eases the amount, the renderer draws `inspectFov(…)`.
 * Pacing and comfort only: nothing here is a model input or a measurement.
 */

/** AFFORDANCE: the tangent of the half field of view is scaled by this at full inspection (2.5× zoom). */
export const INSPECT_ZOOM = 0.4;
/** AFFORDANCE: seconds the view takes to cover 1 − 1/e of the way to its target. */
export const INSPECT_EASE_S = 0.07;
/** The amount (0 base view … 1 fully inspecting) is snapped to its target within this. */
const SNAP = 0.002;

const RAD = Math.PI / 180;

/** The vertical field of view (degrees) at `amount`: the base's half-angle tangent × (1 − a(1 − zoom)). */
export function inspectFov(baseDeg: number, amount: number): number {
  const a = Math.min(Math.max(amount, 0), 1);
  const tan = Math.tan((baseDeg * RAD) / 2) * (1 - a * (1 - INSPECT_ZOOM));
  return (2 * Math.atan(tan)) / RAD;
}

/**
 * How much the mouse turns the view at `amount`, against the base view: the ratio of the fields'
 * half-angle tangents, so the picture follows the mouse at the same speed on screen.
 */
export function lookScale(amount: number): number {
  const a = Math.min(Math.max(amount, 0), 1);
  return 1 - a * (1 - INSPECT_ZOOM);
}

/** One frame towards `target` (0 or 1), the same at any frame rate: exponential in time. */
export function easeInspect(amount: number, target: number, dt: number): number {
  if (dt <= 0) return amount;
  const next = amount + (target - amount) * (1 - Math.exp(-dt / INSPECT_EASE_S));
  return Math.abs(next - target) < SNAP ? target : next;
}
