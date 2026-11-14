import type { Params } from '../types';
import { inclineInput } from '../incline/engine';
import { accelFor, forces, type InclineInput } from '../incline/model';

/**
 * A crate pulled from rest up a slope (θ = 0: a level floor) by a constant force F at β above
 * the surface, with kinetic friction μ, over a distance s (VL10 Bài 23 công, Bài 24 công suất,
 * Bài 27 hiệu suất). The motion is the incline model's; this file adds the work of each force,
 * the power and the efficiency of the pull.
 */
export function pullInput(p: Params): InclineInput {
  return inclineInput({ ...p, muS: p.mu ?? 0, muK: p.mu ?? 0, s0: 0, v0: 0 });
}

/** The pull starts the crate moving up the slope (else nothing happens or it slides back). */
export const climbs = (q: InclineInput) => forces(q).N > 0 && accelFor(q, 0).regime === 'up';

/** Constant acceleration up the slope, time and speed at the top (s = length). */
export function climb(q: InclineInput): { a: number; t: number; v: number } {
  const { a } = accelFor(q, 0);
  const t = Math.sqrt((2 * q.length) / a);
  return { a, t, v: a * t };
}

/** Work done by each force after the crate has moved a distance s up the slope (J). */
export function works(q: InclineInput, s: number) {
  const f = forces(q);
  const WF = q.F * Math.cos(q.beta) * s;
  // 0 − x, not −x: no work is +0, never "−0 J" on a level floor or without friction.
  const WP = 0 - q.m * q.g * Math.sin(q.theta) * s;
  const Wms = 0 - f.kinetic * s;
  return { WF, WP, Wms, WN: 0, total: WF + WP + Wms };
}

/**
 * Efficiency of the pull: the part of the pulling force's work that raises the crate's
 * mechanical energy (kinetic + potential); the rest is lost to friction as heat.
 */
export function efficiency(q: InclineInput, s: number, v: number): number {
  const { WF } = works(q, s);
  const gain = 0.5 * q.m * v * v + q.m * q.g * Math.sin(q.theta) * s;
  return gain / WF;
}
