/**
 * Numbers of the 3D view of "Động học enzyme" (pure, tested against the lesson's model). Every
 * count drawn comes from `enzyme.ts`:
 *
 * - a representative set of ENZYMES_DRAWN enzyme molecules. Under the quasi-steady state
 *   v = kcat·[ES] and Vmax = kcat·[E]total, so the enzymes drawn holding substrate are
 *   ES = round(ENZYMES_DRAWN · rate(p, [S]) / Vmax); the others are shared between free E, EI and
 *   ESI in the rapid-equilibrium fractions of `enzymeSpecies` (largest remainders, so the forms
 *   always add up to ENZYMES_DRAWN);
 * - free substrate, product and inhibitor particles at one stated scale, "1 hạt = x mM" (a nice
 *   step 1, 2 or 5 × 10ⁿ, the same for every quality tier). In the time view the particles of
 *   [S](t) (exact, `substrateAt`) and [P] = [S]₀ − [S](t) are shared out of round([S]₀ / x), so
 *   S + P drawn is conserved at every moment.
 *
 * The 'rate' view shows the steady state at the learner's [S] cursor (0 … the rate plot's top);
 * the 'time' view scrubs t over the 2D plot's time course (0 … `timeCourseEnd`).
 */
import { paramsOf, sTopOf } from '../data';
import {
  apparent,
  enzymeSpecies,
  rate,
  substrateAt,
  timeCourseEnd,
  type EnzymeParams,
  type EnzymeSpecies,
} from '../enzyme';
import type { EnzymeState } from '../store';

/** Enzyme molecules drawn: a fixed, representative sample (the view says so). */
export const ENZYMES_DRAWN = 24;
/** Most free particles of one kind (S and P together in the time view; I on its own). */
export const PARTICLE_CAP = 150;
/** One play-through ([S] sweep or time course) lasts this many seconds. */
export const PLAY_SECONDS = 12;

export type EnzymeForm = 'E' | 'ES' | 'EI' | 'ESI';
export const FORMS: readonly EnzymeForm[] = ['E', 'ES', 'EI', 'ESI'];
export type EnzymeCounts = Record<EnzymeForm, number>;

/**
 * Whole numbers proportional to `weights` that add up to `total` exactly: each gets the whole
 * part of its share, then one more for the largest remainders (ties: the earlier one).
 */
export function splitTotal(weights: readonly number[], total: number): number[] {
  const n = Math.max(0, Math.round(total));
  const w = weights.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return w.map((_, i) => (i === 0 ? n : 0));
  const quotas = w.map((x) => (x / sum) * n);
  const out = quotas.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = quotas
    .map((q, i) => ({ i, r: q - Math.floor(q) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    left--;
  }
  return out;
}

/**
 * Enzymes drawn in each form at substrate concentration S: ES = round(n · v / Vmax) (v = kcat[ES],
 * Vmax = kcat[E]t), the rest shared between E, EI and ESI in the model's fractions.
 */
export function enzymeCounts(p: EnzymeParams, S: number, n = ENZYMES_DRAWN): EnzymeCounts {
  const es = Math.min(n, Math.max(0, Math.round((n * rate(p, Math.max(0, S))) / p.vmax)));
  const f = enzymeSpecies(p, S);
  const [e = 0, ei = 0, esi = 0] = splitTotal([f.E, f.EI, f.ESI], n - es);
  return { E: e, ES: es, EI: ei, ESI: esi };
}

/**
 * Concentration one particle stands for: the smallest nice step (1, 2 or 5 × 10ⁿ mM) with which
 * `maxConc` takes at most `cap` particles.
 */
export function particleScale(maxConc: number, cap = PARTICLE_CAP): number {
  const max = Number.isFinite(maxConc) ? maxConc : 0;
  if (max <= 0) return 1;
  const c = Math.max(1, Math.floor(cap));
  let m = Math.floor(Math.log10(max / c)) - 1;
  for (let guard = 0; guard < 40; guard++, m++) {
    for (const f of [1, 2, 5]) {
      const k = m < 0 ? f / 10 ** -m : f * 10 ** m;
      if (Math.ceil(max / k - 1e-9) <= c) return k;
    }
  }
  return max / c;
}

/** Particles for a concentration at a scale (never more than the cap). */
export const particlesFor = (c: number, scale: number): number =>
  Math.max(0, Math.min(PARTICLE_CAP, Math.round(Math.max(0, c) / scale)));

/** The lesson's inputs the 3D view draws. */
export type EnzymeInputs = Pick<
  EnzymeState,
  'vmax' | 'km' | 'kind' | 'inhibitor' | 'ki' | 's0' | 'view'
>;

export interface EnzymeModel3D {
  p: EnzymeParams;
  view: EnzymeState['view'];
  s0: number;
  /** Top of the [S] cursor: the rate plot's top. */
  sTop: number;
  /** End of the time course (the 2D plot's). */
  tEnd: number;
  /** Apparent Vmax and Km. */
  app: { vmax: number; km: number };
  /** Concentration one particle stands for (mM). */
  scale: number;
  /** Time view: particles standing for [S]₀ (S + P drawn always add up to this). */
  pool0: number;
  /** Free inhibitor particles (0 without an inhibitor). */
  inhibitorParticles: number;
}

export function enzymeModel3d(st: EnzymeInputs): EnzymeModel3D {
  const p = paramsOf(st);
  const app = apparent(p);
  const sTop = sTopOf(st);
  const inh = p.kind === 'none' ? 0 : Math.max(0, p.inhibitor);
  const scale = particleScale(Math.max(st.view === 'time' ? st.s0 : sTop, inh));
  return {
    p,
    view: st.view,
    s0: st.s0,
    sTop,
    tEnd: timeCourseEnd(p, st.s0),
    app,
    scale,
    pool0: particlesFor(st.s0, scale),
    inhibitorParticles: particlesFor(inh, scale),
  };
}

/** The [S] cursor's opening value: the apparent Km, where v is half the apparent Vmax. */
export const defaultCursor = (m: EnzymeModel3D): number => Math.min(m.sTop, m.app.km);

/** The moment shown: x is [S] (rate view, mM) or t (time view, min). */
export interface EnzymeFrame {
  x: number;
  /** Time (min) in the time view, null in the rate view. */
  t: number | null;
  /** [S] and [P] (mM): the cursor and 0, or the exact time course. */
  S: number;
  P: number;
  /** Rate v at this [S] (mM/min). */
  v: number;
  species: EnzymeSpecies;
  counts: EnzymeCounts;
  particles: { S: number; P: number; I: number };
}

/** Clamps x to the view's range ([S]: 0 … sTop; t: 0 … tEnd). */
export function clampX(m: EnzymeModel3D, x: number): number {
  const top = m.view === 'time' ? m.tEnd : m.sTop;
  return Math.max(0, Math.min(top, Number.isFinite(x) ? x : 0));
}

export function frameAt(m: EnzymeModel3D, x: number): EnzymeFrame {
  const at = clampX(m, x);
  if (m.view === 'rate') {
    return {
      x: at,
      t: null,
      S: at,
      P: 0,
      v: rate(m.p, at),
      species: enzymeSpecies(m.p, at),
      counts: enzymeCounts(m.p, at),
      particles: { S: particlesFor(at, m.scale), P: 0, I: m.inhibitorParticles },
    };
  }
  const S = Math.max(0, Math.min(m.s0, substrateAt(m.p, m.s0, at)));
  const P = m.s0 - S;
  const [nS = 0, nP = 0] = splitTotal([S, P], m.pool0);
  return {
    x: at,
    t: at,
    S,
    P,
    v: rate(m.p, S),
    species: enzymeSpecies(m.p, S),
    counts: enzymeCounts(m.p, S),
    particles: { S: nS, P: nP, I: m.inhibitorParticles },
  };
}

/**
 * Which drawn enzyme is in which form: a fixed, mixed order (illustrative places), the first
 * ES of it hold substrate, then ESI, then EI, the rest are free.
 */
export const ENZYME_ORDER: readonly number[] = (() => {
  const order = Array.from({ length: ENZYMES_DRAWN }, (_, k) => k);
  // A small fixed LCG: the same order on every machine.
  let seed = 20261020;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(next() * (k + 1));
    const a = order[k] ?? k;
    order[k] = order[j] ?? j;
    order[j] = a;
  }
  return order;
})();

/** The form of each drawn enzyme (index = enzyme number − 1). */
export function formsOf(counts: EnzymeCounts, out: EnzymeForm[] = []): EnzymeForm[] {
  out.length = ENZYMES_DRAWN;
  let k = 0;
  const fill = (form: EnzymeForm, n: number) => {
    for (let i = 0; i < n && k < ENZYMES_DRAWN; i++, k++) out[ENZYME_ORDER[k] ?? k] = form;
  };
  fill('ES', counts.ES);
  fill('ESI', counts.ESI);
  fill('EI', counts.EI);
  fill('E', ENZYMES_DRAWN - k);
  return out;
}

/** Whether a form holds substrate (it makes product only as ES). */
export const holdsSubstrate = (f: EnzymeForm): boolean => f === 'ES' || f === 'ESI';
/** Whether a form holds inhibitor. */
export const holdsInhibitor = (f: EnzymeForm): boolean => f === 'EI' || f === 'ESI';
