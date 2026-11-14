import type { Params } from '../types';

/**
 * A sphere released from rest in a still fluid (VL10 Bài 19, lực cản): weight m·g down, the
 * fluid's upthrust ρ_f·V·g up, and a drag ½·ρ_f·C_d·A·v² against the motion (quadratic law,
 * C_d constant). A sphere denser than the fluid sinks from the top of the column; a lighter one
 * rises from the bottom to the surface.
 */

/** Fluid properties used by the scene (review_status pending, docs/DATA_REVIEW.md FLD-1). */
export interface Fluid {
  /** Density (kg/m³). */
  rho: number;
  /** Dynamic viscosity (Pa·s), only to estimate the Reynolds number; NaN when unknown. */
  mu: number;
}

/** Air, ISA sea level (ISO 2533:1975): 15 °C, 101 325 Pa. */
const AIR: Fluid = { rho: 1.225, mu: 1.7894e-5 };
/** Water at 20 °C, 101 325 Pa (IAPWS-95 density; IAPWS 2008 viscosity). */
const WATER: Fluid = { rho: 998.21, mu: 1.0016e-3 };

export const FLUIDS: readonly Fluid[] = [AIR, WATER];

/** Range of Reynolds numbers where a smooth sphere's C_d stays close to constant (FLD-2). */
export const RE_CONSTANT_CD: readonly [number, number] = [1e3, 2e5];

export interface FallInput {
  m: number;
  r: number;
  cd: number;
  fluid: Fluid;
  /** Column height (m): from the top to the bottom of the fluid. */
  H: number;
  g: number;
}

/** Fluid choice 2: a density the learner types; its viscosity is unknown (no Reynolds number). */
export const CUSTOM_FLUID = 2;

export function fallInput(p: Params): FallInput {
  const k = Math.round(p.fluid ?? 0);
  const fluid = k === CUSTOM_FLUID ? { rho: p.rhoF ?? 1.29, mu: NaN } : (FLUIDS[k] ?? AIR);
  return {
    m: p.m ?? 0.0027,
    r: p.r ?? 0.02,
    cd: p.cd ?? 0.47,
    fluid,
    H: p.H ?? 20,
    g: p.g ?? 9.81,
  };
}

export const volume = (q: FallInput) => (4 / 3) * Math.PI * q.r ** 3;
export const area = (q: FallInput) => Math.PI * q.r ** 2;

/** Net force with the sphere at rest: weight minus upthrust (N), positive downward. */
export const netWeight = (q: FallInput) => (q.m - q.fluid.rho * volume(q)) * q.g;

/** Drag coefficient b in F_d = b·v² (N·s²/m²). */
export const dragB = (q: FallInput) => 0.5 * q.fluid.rho * q.cd * area(q);

/** Direction of motion: +1 sinks, −1 rises, 0 floats where it is. */
export const direction = (q: FallInput) => Math.sign(netWeight(q));

/** Terminal speed (m/s): drag balances weight minus upthrust. */
export const terminalSpeed = (q: FallInput) => Math.sqrt(Math.abs(netWeight(q)) / dragB(q));

/** Starting acceleration (m/s², size): (weight − upthrust)/(m + ½ρ_f V). */
/**
 * Inertia of the moving sphere: its mass plus half the mass of the fluid it displaces (the fluid
 * set in motion around it, potential flow; Lamb, Hydrodynamics). Negligible in air, large for a
 * light ball in water. The terminal speed does not depend on it.
 */
export const ADDED_MASS_COEFF = 0.5;
export const inertia = (q: FallInput) => q.m + ADDED_MASS_COEFF * q.fluid.rho * volume(q);

export const startAccel = (q: FallInput) => Math.abs(netWeight(q)) / inertia(q);

/**
 * Distance travelled (m) and speed (m/s) at time t, both along the motion:
 * v = v_t·tanh(a₀t/v_t), s = (v_t²/a₀)·ln cosh(a₀t/v_t).
 */
export function motionAt(q: FallInput, t: number): { s: number; v: number } {
  const a0 = startAccel(q);
  if (a0 === 0) return { s: 0, v: 0 };
  const vt = terminalSpeed(q);
  const x = (a0 * t) / vt;
  // ln cosh x without overflow for a large x.
  const lnCosh = x > 20 ? x - Math.LN2 : Math.log(Math.cosh(x));
  return { s: ((vt * vt) / a0) * lnCosh, v: vt * Math.tanh(x) };
}

/** Time (s) to travel the whole column H: t = (v_t/a₀)·arcosh(exp(a₀H/v_t²)). */
export function travelTime(q: FallInput): number {
  const a0 = startAccel(q);
  if (a0 === 0) return Infinity;
  const vt = terminalSpeed(q);
  const k = (a0 * q.H) / (vt * vt);
  // arcosh(e^k) = k + ln(1 + √(1 − e^(−2k))), stable for a large k.
  return (vt / a0) * (k + Math.log(1 + Math.sqrt(1 - Math.exp(-2 * k))));
}

/** Reynolds number at a speed v: Re = ρ_f·v·(2r)/μ. */
export const reynolds = (q: FallInput, v: number) => (q.fluid.rho * v * 2 * q.r) / q.fluid.mu;

/** Free fall in a vacuum from the same height (no drag, no upthrust), for comparison. */
export function vacuumAt(q: FallInput, t: number): { s: number; v: number } {
  const tEnd = Math.sqrt((2 * q.H) / q.g);
  const tt = Math.min(t, tEnd);
  return { s: 0.5 * q.g * tt * tt, v: q.g * tt };
}
