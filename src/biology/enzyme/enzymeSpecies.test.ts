import { describe, expect, it } from 'vitest';
import { enzymeSpecies, rate, timeCourseEnd, type EnzymeParams, type Inhibition } from './enzyme';

const KINDS: Inhibition[] = ['none', 'competitive', 'noncompetitive', 'uncompetitive'];
const params = (kind: Inhibition, over: Partial<EnzymeParams> = {}): EnzymeParams => ({
  vmax: 10,
  km: 2,
  inhibitor: 2,
  ki: 1,
  kind,
  ...over,
});

describe('enzymeSpecies: rapid-equilibrium fractions of E, ES, EI, ESI', () => {
  it('add up to 1, and the ES fraction is v / Vmax of the lesson’s rate law, for every type', () => {
    for (const kind of KINDS)
      for (const over of [{}, { inhibitor: 0 }, { inhibitor: 7, ki: 0.4 }, { km: 0.3, vmax: 42 }])
        for (const S of [0, 0.05, 1, 2, 6, 20, 150, 1e4]) {
          const p = params(kind, over);
          const f = enzymeSpecies(p, S);
          const tag = `${kind} ${JSON.stringify(over)} S=${String(S)}`;
          expect(f.E + f.ES + f.EI + f.ESI, tag).toBeCloseTo(1, 12);
          for (const v of [f.E, f.ES, f.EI, f.ESI]) expect(v, tag).toBeGreaterThanOrEqual(0);
          // v = kcat·[ES], Vmax = kcat·[E]t ⇒ [ES]/[E]t = v/Vmax.
          expect(f.ES, tag).toBeCloseTo(rate(p, S) / p.vmax, 12);
        }
  });

  it('each type has only its own forms, bound with the dissociation constants Km and Kᵢ', () => {
    const S = 3;
    const none = enzymeSpecies(params('none'), S);
    expect(none.EI + none.ESI).toBe(0);
    const c = enzymeSpecies(params('competitive'), S);
    expect(c.ESI).toBe(0);
    // [E][I]/[EI] = Kᵢ and [E][S]/[ES] = Km.
    expect((c.E * 2) / c.EI).toBeCloseTo(1, 12);
    expect((c.E * S) / c.ES).toBeCloseTo(2, 12);
    const n = enzymeSpecies(params('noncompetitive'), S);
    expect((n.E * 2) / n.EI).toBeCloseTo(1, 12);
    expect((n.ES * 2) / n.ESI).toBeCloseTo(1, 12);
    const u = enzymeSpecies(params('uncompetitive'), S);
    expect(u.EI).toBe(0);
    expect((u.ES * 2) / u.ESI).toBeCloseTo(1, 12);
  });

  it('the time course ends as the 2D plot’s: ([S]₀ + 5 Km_app) / Vmax_app', () => {
    expect(timeCourseEnd(params('competitive'), 10)).toBeCloseTo((10 + 5 * 6) / 10, 12);
    expect(timeCourseEnd(params('noncompetitive'), 10)).toBeCloseTo((10 + 5 * 2) / (10 / 3), 12);
    expect(timeCourseEnd(params('none'), 4)).toBeCloseTo((4 + 10) / 10, 12);
  });
});
