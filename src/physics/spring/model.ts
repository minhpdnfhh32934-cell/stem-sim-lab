/**
 * Linear (optionally damped) spring–mass oscillator  m x″ + b x′ + k x = 0,
 * x measured from equilibrium. The exact state-transition map is used for stepping,
 * so the simulation carries no truncation error (only round-off).
 * Sources: SGK Vật lí 11 (dao động điều hoà); Halliday–Resnick–Walker ch. 15.
 */
export interface Oscillator {
  m: number;
  k: number;
  /** Viscous damping coefficient b (N·s/m). */
  b: number;
}

export const omega0 = (o: Oscillator) => Math.sqrt(o.k / o.m);
export const gammaOf = (o: Oscillator) => o.b / (2 * o.m);

export type DampingRegime = 'none' | 'under' | 'critical' | 'over';

export function regime(o: Oscillator): DampingRegime {
  const g = gammaOf(o);
  const w = omega0(o);
  if (g === 0) return 'none';
  if (Math.abs(g - w) <= 1e-9 * w) return 'critical';
  return g < w ? 'under' : 'over';
}

/** Exact propagation of (x, v) over time h. */
export function propagate(o: Oscillator, x: number, v: number, h: number): [number, number] {
  const w0 = omega0(o);
  const g = gammaOf(o);
  switch (regime(o)) {
    case 'none': {
      const c = Math.cos(w0 * h);
      const s = Math.sin(w0 * h);
      return [x * c + (v / w0) * s, v * c - x * w0 * s];
    }
    case 'under': {
      const wd = Math.sqrt(w0 * w0 - g * g);
      const e = Math.exp(-g * h);
      const c = Math.cos(wd * h);
      const s = Math.sin(wd * h);
      return [e * (x * c + ((v + g * x) / wd) * s), e * (v * c - ((w0 * w0 * x + g * v) / wd) * s)];
    }
    case 'critical': {
      const e = Math.exp(-g * h);
      const B = v + g * x;
      return [e * (x + B * h), e * (v - g * B * h)];
    }
    case 'over': {
      const d = Math.sqrt(g * g - w0 * w0);
      const r1 = -g + d;
      const r2 = -g - d;
      const c1 = (v - r2 * x) / (r1 - r2);
      const c2 = x - c1;
      const e1 = Math.exp(r1 * h);
      const e2 = Math.exp(r2 * h);
      return [c1 * e1 + c2 * e2, r1 * c1 * e1 + r2 * c2 * e2];
    }
  }
}

/** Amplitude and phase of the undamped motion x = A cos(ωt + φ). */
export function amplitudePhase(o: Oscillator, x0: number, v0: number) {
  const w = omega0(o);
  return { A: Math.hypot(x0, v0 / w), phi: Math.atan2(-v0 / w, x0) };
}

export const period = (o: Oscillator) => (2 * Math.PI) / omega0(o);
