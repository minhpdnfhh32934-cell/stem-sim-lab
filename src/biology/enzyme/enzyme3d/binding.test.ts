import { describe, expect, it } from 'vitest';
import { sTopOf } from '../data';
import { apparent, enzymeSpecies, rate, substrateAt, type Inhibition } from '../enzyme';
import {
  ENZYMES_DRAWN,
  ENZYME_ORDER,
  PARTICLE_CAP,
  defaultCursor,
  enzymeCounts,
  enzymeModel3d,
  formsOf,
  frameAt,
  particleScale,
  splitTotal,
  type EnzymeInputs,
} from './binding';
import { ENZYME_PLACES, I_PLACES, LAYOUT, SP_PLACES, particleAt, type Vec3 } from './layout';

const KINDS: Inhibition[] = ['none', 'competitive', 'noncompetitive', 'uncompetitive'];
const inputs = (over: Partial<EnzymeInputs> = {}): EnzymeInputs => ({
  vmax: 10,
  km: 2,
  kind: 'competitive',
  inhibitor: 2,
  ki: 1,
  s0: 10,
  view: 'rate',
  ...over,
});

describe('enzymes drawn in each form', () => {
  it('ES drawn = round(24 · rate / Vmax) for every inhibition type; the forms add up to 24', () => {
    for (const kind of KINDS)
      for (const over of [{}, { inhibitor: 0.5 }, { inhibitor: 15, ki: 3 }, { km: 0.4 }])
        for (const S of [0, 0.1, 0.5, 1, 2, 3.3, 6, 11, 20, 80, 400]) {
          const p = enzymeModel3d(inputs({ kind, ...over })).p;
          const n = enzymeCounts(p, S);
          const tag = `${kind} ${JSON.stringify(over)} S=${String(S)}`;
          expect(n.ES, tag).toBe(Math.round((ENZYMES_DRAWN * rate(p, S)) / p.vmax));
          expect(n.E + n.ES + n.EI + n.ESI, tag).toBe(ENZYMES_DRAWN);
          const f = enzymeSpecies(p, S);
          // Each other form is within one enzyme of its exact share.
          for (const k of ['E', 'EI', 'ESI'] as const)
            expect(Math.abs(n[k] - f[k] * ENZYMES_DRAWN), `${tag} ${k}`).toBeLessThanOrEqual(1);
          if (kind === 'none') expect(n.EI + n.ESI, tag).toBe(0);
          if (kind === 'competitive') expect(n.ESI, tag).toBe(0);
          if (kind === 'uncompetitive') expect(n.EI, tag).toBe(0);
        }
  });

  it('competitive inhibition at high [S]: almost every enzyme holds substrate', () => {
    const p = enzymeModel3d(inputs({ kind: 'competitive', inhibitor: 20, ki: 1 })).p;
    const S = 2000 * apparent(p).km;
    expect(enzymeCounts(p, S).ES).toBeGreaterThanOrEqual(ENZYMES_DRAWN - 1);
    // At the same [S] a non-competitive inhibitor keeps most enzymes as ESI.
    const q = { ...p, kind: 'noncompetitive' as const };
    expect(enzymeCounts(q, S).ESI).toBeGreaterThan(ENZYMES_DRAWN / 2);
  });

  it('forms: the first ES of a fixed order hold substrate, then ESI, EI, the rest are free', () => {
    expect([...ENZYME_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: ENZYMES_DRAWN }, (_, k) => k),
    );
    const counts = { E: 5, ES: 9, EI: 4, ESI: 6 };
    const forms = formsOf(counts);
    expect(forms).toHaveLength(ENZYMES_DRAWN);
    for (const f of ['E', 'ES', 'EI', 'ESI'] as const)
      expect(forms.filter((x) => x === f)).toHaveLength(counts[f]);
    expect(forms[ENZYME_ORDER[0] ?? 0]).toBe('ES');
  });

  it('splitTotal keeps the total and stays within one of each exact share', () => {
    expect(splitTotal([1, 1, 1], 10)).toEqual([4, 3, 3]);
    expect(splitTotal([0, 0], 5)).toEqual([5, 0]);
    expect(splitTotal([0.2, 0.3, 0.5], 0)).toEqual([0, 0, 0]);
    for (const w of [
      [0.1, 0.7, 0.2],
      [3, 0, 1e-9],
      [1, 2, 3, 4],
    ])
      for (const total of [1, 7, 23, 150]) {
        const out = splitTotal(w, total);
        expect(out.reduce((a, b) => a + b, 0)).toBe(total);
        const sum = w.reduce((a, b) => a + b, 0);
        out.forEach((v, i) => {
          expect(Math.abs(v - ((w[i] ?? 0) / sum) * total)).toBeLessThan(1);
        });
      }
  });
});

describe('particles at a stated scale', () => {
  it('one particle stands for a nice step (1, 2, 5 × 10ⁿ mM) that fits the cap', () => {
    expect(particleScale(20)).toBe(0.2);
    expect(particleScale(10)).toBe(0.1);
    expect(particleScale(200)).toBe(2);
    expect(particleScale(0.5)).toBe(0.005);
    for (const max of [0.37, 1, 4.2, 20, 63, 199.9, 1000]) {
      const k = particleScale(max);
      expect(Math.ceil(max / k - 1e-9)).toBeLessThanOrEqual(PARTICLE_CAP);
      const mant = k / 10 ** Math.floor(Math.log10(k) + 1e-9);
      expect([1, 2, 5].some((f) => Math.abs(mant - f) < 1e-9)).toBe(true);
    }
  });

  it('rate view: the [S] cursor opens at the apparent Km; particles = round([S]/scale)', () => {
    const m = enzymeModel3d(inputs());
    expect(m.sTop).toBe(sTopOf({ km: 2 }));
    expect(defaultCursor(m)).toBeCloseTo(6, 12);
    expect(m.scale).toBe(0.2);
    const f = frameAt(m, defaultCursor(m));
    expect(f.v).toBeCloseTo(5, 12);
    expect(f.counts).toEqual({ E: 4, ES: 12, EI: 8, ESI: 0 });
    expect(f.particles).toEqual({ S: 30, P: 0, I: 10 });
    // The cursor stays inside the plot's range.
    expect(frameAt(m, 1e6).S).toBe(m.sTop);
    expect(frameAt(m, -3).S).toBe(0);
    // No inhibitor: no inhibitor particles.
    expect(enzymeModel3d(inputs({ kind: 'none' })).inhibitorParticles).toBe(0);
  });

  it('time view: tEnd as the 2D plot; S(t) exact; drawn S + P = drawn [S]₀ at every moment', () => {
    for (const kind of KINDS)
      for (const s0 of [0.5, 3, 10, 37.5, 100]) {
        const m = enzymeModel3d(inputs({ kind, s0, view: 'time' }));
        const a = apparent(m.p);
        expect(m.tEnd).toBeCloseTo((s0 + 5 * a.km) / a.vmax, 12);
        expect(m.pool0).toBe(Math.round(s0 / m.scale));
        for (let i = 0; i <= 40; i++) {
          const t = (i / 40) * m.tEnd;
          const f = frameAt(m, t);
          expect(f.S).toBeCloseTo(substrateAt(m.p, s0, t), 12);
          expect(f.S + f.P).toBeCloseTo(s0, 12);
          expect(f.particles.S + f.particles.P, `${kind} s0=${String(s0)} t=${String(t)}`).toBe(
            m.pool0,
          );
          expect(f.counts.ES).toBe(Math.round((ENZYMES_DRAWN * rate(m.p, f.S)) / m.p.vmax));
        }
        // All substrate at the start, most of it turned into product at the end.
        expect(frameAt(m, 0).particles.P).toBe(0);
        expect(frameAt(m, m.tEnd).particles.P).toBeGreaterThan(frameAt(m, m.tEnd).particles.S);
      }
  });
});

describe('layout (illustration)', () => {
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  it('enzymes inside the volume, apart; particle places clear of every enzyme', () => {
    const L = LAYOUT;
    expect(ENZYME_PLACES).toHaveLength(ENZYMES_DRAWN);
    for (const e of ENZYME_PLACES) {
      expect(Math.abs(e.center[0]) + L.enzymeR * 1.1).toBeLessThan(L.hx);
      expect(Math.abs(e.center[1]) + L.enzymeR * 1.1).toBeLessThan(L.hy);
      expect(Math.abs(e.center[2]) + L.enzymeR * 1.1).toBeLessThan(L.hz);
      for (const o of ENZYME_PLACES)
        if (o !== e) expect(dist(e.center, o.center)).toBeGreaterThan(2.2 * L.enzymeR);
    }
    for (const places of [SP_PLACES, I_PLACES]) {
      expect(places).toHaveLength(PARTICLE_CAP);
      for (const p of places)
        for (const e of ENZYME_PLACES)
          expect(dist(p, e.center)).toBeGreaterThan(L.enzymeR * 1.2 + L.particleR);
    }
    // Drift is small and starts where the particle stands.
    const out: Vec3 = [0, 0, 0];
    expect(particleAt('sp', 3, 0, out)).toEqual(SP_PLACES[3]);
    particleAt('i', 3, 7.5, out);
    expect(dist(out, I_PLACES[3] ?? out)).toBeLessThanOrEqual(2 * L.drift * Math.sqrt(3));
  });
});
