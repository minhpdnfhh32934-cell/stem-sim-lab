import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode/dopri5';
import type { Params } from '../types';

/**
 * Current in a metal wire (SGK Vật lí 11 KNTT, Bài 22 "Cường độ dòng điện"): I = Δq/Δt (22.1),
 * Δq = IΔt (22.2); free electrons of density n drift against the field at speed v, so the charge
 * through the cross-section S in Δt is Δq = Snve·Δt and I = Snve (22.3).
 */
export interface Wire {
  /** Current (A). */
  I: number;
  /** Diameter of the wire's cross-section (m). */
  d: number;
  /** Free electrons per cubic metre. */
  n: number;
  /** Time over which the charge is counted (s). */
  dt: number;
}

/**
 * Defaults: the textbook's exercise (tr. 93): a copper wire of diameter d = 2 mm carrying I = 5 A,
 * free-electron density n = 8,45·10²⁸ electron/m³ (answer v ≈ 1,2·10⁻⁴ m/s); Δt = 1 s.
 */
export const WIRE_DEFAULTS = { I: 5, d: 2e-3, n: 8.45e28, dt: 1 } as const;

export function wireInput(p: Params): Wire {
  return {
    I: p.I ?? WIRE_DEFAULTS.I,
    d: p.d ?? WIRE_DEFAULTS.d,
    n: p.n ?? WIRE_DEFAULTS.n,
    dt: p.dt ?? WIRE_DEFAULTS.dt,
  };
}

/** S = πd²/4. */
export const area = (w: Wire) => (Math.PI * w.d * w.d) / 4;
/** v = I/(nSe), from I = Snve (22.3). */
export const driftSpeed = (w: Wire) => w.I / (w.n * area(w) * C.e);
/** Δq = IΔt (22.2). */
export const chargeIn = (w: Wire, t: number) => w.I * t;
/** Electrons through the cross-section in time t: Δq/e. */
export const electronsIn = (w: Wire, t: number) => chargeIn(w, t) / C.e;

export const isValid = (w: Wire) => [w.I, w.d, w.n, w.dt].every((x) => Number.isFinite(x) && x > 0);

/**
 * Independent check of Δq: DOPRI5 adds up the current, dq/dt = I, from 0 to Δt (the definition
 * (22.1) read the other way).
 */
export function integratedCharge(w: Wire): number {
  return (
    dopri5(
      (_t, _y, d) => {
        d[0] = w.I;
      },
      [0],
      0,
      w.dt,
      { rtol: 1e-12, atol: 1e-15 * w.I },
    ).y[0] ?? Number.NaN
  );
}

/** The drawn piece of wire is four diameters long, to scale (2D and 3D pictures). */
export const lengthOf = (d: number) => 4 * d;
