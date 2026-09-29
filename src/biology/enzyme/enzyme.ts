import { dopri5 } from '@/core/ode';

export type Inhibition = 'none' | 'competitive' | 'noncompetitive' | 'uncompetitive';

export interface EnzymeParams {
  vmax: number;
  km: number;
  /** Inhibitor concentration and inhibition constant (same units as Km). */
  inhibitor: number;
  ki: number;
  kind: Inhibition;
}

/** Apparent Vmax and Km in the presence of an inhibitor (standard forms). */
export function apparent(p: EnzymeParams): { vmax: number; km: number } {
  const a = 1 + p.inhibitor / p.ki;
  switch (p.kind) {
    case 'none':
      return { vmax: p.vmax, km: p.km };
    case 'competitive':
      return { vmax: p.vmax, km: p.km * a };
    case 'noncompetitive':
      return { vmax: p.vmax / a, km: p.km };
    case 'uncompetitive':
      return { vmax: p.vmax / a, km: p.km / a };
  }
}

/** Michaelis–Menten initial rate v = Vmax[S]/(Km + [S]) (with apparent constants). */
export function rate(p: EnzymeParams, s: number): number {
  const { vmax, km } = apparent(p);
  return (vmax * s) / (km + s);
}

/** Principal branch of the Lambert W function (Halley iteration), x ≥ −1/e. */
export function lambertW(x: number): number {
  if (x < -1 / Math.E) throw new RangeError('lambertW: x < −1/e');
  if (x === 0) return 0;
  let w = x < 1 ? x : Math.log(x) - Math.log(Math.log(x) + 1e-300 + 1);
  if (x > 1e300) w = Math.log(x) - Math.log(Math.log(x));
  for (let i = 0; i < 60; i++) {
    const e = Math.exp(w);
    const f = w * e - x;
    const wn = w - f / (e * (w + 1) - ((w + 2) * f) / (2 * w + 2));
    if (Math.abs(wn - w) <= 1e-15 * (1 + Math.abs(wn))) return wn;
    w = wn;
  }
  return w;
}

/**
 * Substrate over time for an irreversible MM reaction S → P (exact, Schnell–Mendoza):
 *   [S](t) = Km·W((S₀/Km)·exp((S₀ − Vmax·t)/Km)).
 * For very large arguments the logarithmic form of W avoids overflow.
 */
export function substrateAt(p: EnzymeParams, s0: number, t: number): number {
  const { vmax, km } = apparent(p);
  const lnArg = Math.log(s0 / km) + (s0 - vmax * t) / km;
  if (lnArg > 700) {
    // W(e^L) for large L: solve w + ln w = L.
    let w = lnArg - Math.log(lnArg);
    for (let i = 0; i < 50; i++) w -= (w + Math.log(w) - lnArg) / (1 + 1 / w);
    return km * w;
  }
  return km * lambertW(Math.exp(lnArg));
}

/** Numerical cross-check of `substrateAt` with DOPRI5. */
export function substrateNumeric(p: EnzymeParams, s0: number, t: number): number {
  const { vmax, km } = apparent(p);
  if (t <= 0) return s0;
  return (
    dopri5(
      (_t, y, d) => {
        const s = Math.max(0, y[0] ?? 0);
        d[0] = (-vmax * s) / (km + s);
      },
      [s0],
      0,
      t,
      { rtol: 1e-11, atol: 1e-14 },
    ).y[0] ?? NaN
  );
}
