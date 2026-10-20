/**
 * Diffusion in 3D, the numbers (pure, tested against the lesson's model): how many of the
 * `particles` drawn are in each compartment at time t and when each crossing happens.
 *
 * The particles stand for the solute amount c₁V₁ + c₂V₂ (mM × mL = µmol, the same at every t):
 * compartment 1 holds N₁(t) = particles · c₁(t)V₁ / (c₁(0)V₁ + c₂(0)V₂) of them, c₁(t) from the
 * exact two-compartment Fick solution (`twoCompartment`), shared out by largest remainders so
 * N₁ + N₂ = particles exactly. Particles cross on a deterministic schedule — the m-th crossing is
 * the moment N₁ moves on by m — so the drawn counts equal Fick's law at every scrubbed t. Only
 * the net crossings are drawn. Which particle crosses and its path are illustration
 * (`diffusionLayout.ts`); the pores are not in the Fick model (P·A sets the rate).
 */
import { apportion } from '../../view3d/sampling';
import { fickTimeEnd, twoCompartment } from '../transport';

/** The lesson's diffusion inputs (its store). */
export interface DiffusionInputs {
  particles: number;
  pores: number;
  c1: number;
  c2: number;
  v1: number;
  v2: number;
  pa: number;
  run: number;
}

export interface DiffusionModel3D {
  inputs: DiffusionInputs;
  /** Solute amount c₁V₁ + c₂V₂ (µmol), the same at every t. */
  amount: number;
  /** Particles drawn: the lesson's `particles`, or 0 when there is no solute. */
  total: number;
  /** Amount one particle stands for (µmol; 0 without solute). */
  perParticle: number;
  /** k = P·A·(1/V₁ + 1/V₂) (1/min) and the chart's time range 5/k (min). */
  k: number;
  tEnd: number;
  /** Equilibrium concentration (mM), the same on both sides. */
  ceq: number;
  /** Particles in compartment 1 at t = 0 and at equilibrium. */
  n1Start: number;
  n1End: number;
  /** No pore in the membrane: nothing crosses on the picture (the chart still follows P·A). */
  blocked: boolean;
  /** Particle of the m-th crossing (m = 0, 1, …) and the time it happens (min; ∞: never). */
  crossers: Int32Array;
  crossTimes: Float64Array;
  /** Crossing number of each particle (−1: it stays where it starts). */
  crossIndex: Int32Array;
}

export interface DiffusionFrame {
  /** Time (min). */
  t: number;
  /** Concentrations of the model (mM). */
  c1: number;
  c2: number;
  /** Particles in each compartment on the picture. */
  n1: number;
  n2: number;
  /** Crossings that have happened by t. */
  crossed: number;
}

/** Particles in compartments 1 and 2 for concentrations c1, c2 (largest remainders). */
function split(
  m: Pick<DiffusionModel3D, 'total' | 'perParticle' | 'inputs'>,
  c1: number,
  c2: number,
) {
  if (m.total === 0) return [0, 0] as const;
  const [a = 0, b = 0] = apportion([c1 * m.inputs.v1, c2 * m.inputs.v2], m.perParticle);
  return [a, b] as const;
}

/** The 3D numbers of the lesson's diffusion inputs. */
export function diffusionModel3d(inputs: DiffusionInputs): DiffusionModel3D {
  const { c1, c2, v1, v2, pa } = inputs;
  const amount = Math.max(0, c1 * v1 + c2 * v2);
  const total = amount > 0 ? Math.max(0, Math.round(inputs.particles)) : 0;
  const perParticle = total > 0 ? amount / total : 0;
  const k = pa * (1 / v1 + 1 / v2);
  const tEnd = fickTimeEnd(v1, v2, pa);
  const ceq = (c1 * v1 + c2 * v2) / (v1 + v2);
  const base = { inputs, total, perParticle };
  const n1Start = split(base, c1, c2)[0];
  const n1End = split(base, ceq, ceq)[0];
  const blocked = Math.round(inputs.pores) <= 0;
  const count = blocked ? 0 : Math.abs(n1Start - n1End);
  const crossers = new Int32Array(count);
  const crossTimes = new Float64Array(count);
  const crossIndex = new Int32Array(total).fill(-1);
  const down = n1End < n1Start;
  // Quotas of compartment 1: q₁(t) = q∞ + (q₀ − q∞)·e^(−kt).
  const q0 = perParticle > 0 ? (c1 * v1) / perParticle : 0;
  const qInf = perParticle > 0 ? (ceq * v1) / perParticle : 0;
  for (let m = 0; m < count; m++) {
    // N₁ = round(q₁) reaches n1Start ∓ (m + 1) when q₁ passes the level half-way between.
    const level = down ? n1Start - m - 0.5 : n1Start + m + 0.5;
    const ratio = (level - qInf) / (q0 - qInf);
    crossTimes[m] = ratio >= 1 ? 0 : ratio <= 0 ? Infinity : Math.log(1 / ratio) / k;
    // From the side that loses particles, in index order (their places are random anyway).
    const j = down ? m : n1Start + m;
    crossers[m] = j;
    crossIndex[j] = m;
  }
  return {
    inputs,
    amount,
    total,
    perParticle,
    k,
    tEnd,
    ceq,
    n1Start,
    n1End,
    blocked,
    crossers,
    crossTimes,
    crossIndex,
  };
}

/** The model at time t (min): concentrations, particles per compartment, crossings so far. */
export function diffusionFrameAt(m: DiffusionModel3D, t: number): DiffusionFrame {
  const { c1, c2, v1, v2, pa } = m.inputs;
  const c = twoCompartment(c1, c2, v1, v2, pa, Math.max(0, t));
  if (m.blocked)
    return { t, c1: c.c1, c2: c.c2, n1: m.n1Start, n2: m.total - m.n1Start, crossed: 0 };
  const [n1, n2] = split(m, c.c1, c.c2);
  const crossed = Math.min(m.crossers.length, Math.abs(m.n1Start - n1));
  return { t, c1: c.c1, c2: c.c2, n1, n2, crossed };
}

/** The compartment (1 or 2) particle j is in on the picture at a frame. */
export function sideOf(m: DiffusionModel3D, frame: DiffusionFrame, j: number): 1 | 2 {
  const start = j < m.n1Start ? 1 : 2;
  const c = m.crossIndex[j] ?? -1;
  if (c < 0 || c >= frame.crossed) return start;
  return start === 1 ? 2 : 1;
}
