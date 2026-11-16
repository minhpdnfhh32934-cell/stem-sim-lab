import { describe, expect, it } from 'vitest';
import { nsCard } from './card';
import { AXES, NS_REACTIONS, SUBSTANCES, analyse, place } from './model';
import { addFormula, removeFormula, setNs, useNsStore } from './store';

const value = (el: 'N' | 'S', f: string) => {
  const p = place(el, f);
  return p.ok ? p.value : p.reason;
};

describe('nitrogen and sulfur (HH11 Bài 4–8)', () => {
  it('the book’s activity (tr. 30): the nitrogen compounds on the −3 … +5 axis', () => {
    expect(AXES.N.min).toBe(-3);
    expect(AXES.N.max).toBe(5);
    expect(
      ['NO', 'N2O', 'NO2', 'NH3', 'HNO2', 'HNO3', 'NH4Cl', 'KNO2', 'NaNO3'].map((f) =>
        value('N', f),
      ),
    ).toEqual([2, 1, 4, -3, 3, 5, -3, 3, 5]);
    expect(value('N', 'N2')).toBe(0);
  });

  it('sulfur from −2 to +6 (tr. 43): H₂S, S, SO₂, SO₃, H₂SO₄', () => {
    expect([AXES.S.min, AXES.S.max]).toEqual([-2, 6]);
    expect(['H2S', 'S', 'SO2', 'SO3', 'H2SO4', 'BaSO4', 'Al2S3'].map((f) => value('S', f))).toEqual(
      [-2, 0, 4, 6, 6, 6, -2],
    );
  });

  it('the role read from the axis: NH₃ reducing, HNO₃ oxidising, SO₂ both (tr. 35, 39, 46)', () => {
    const role = (el: 'N' | 'S', f: string) => {
      const p = place(el, f);
      return p.ok ? p.role : p.reason;
    };
    expect(role('N', 'NH3')).toBe('reducing');
    expect(role('N', 'HNO3')).toBe('oxidising');
    expect(role('N', 'N2')).toBe('both');
    expect(role('S', 'SO2')).toBe('both');
    expect(role('S', 'H2S')).toBe('reducing');
    expect(role('S', 'H2SO4')).toBe('oxidising');
  });

  it('never guesses: NH₄NO₃ (N at two levels), a formula without the element, an unreadable one', () => {
    expect(value('N', 'NH4NO3')).toBe('mixed');
    expect(value('N', 'H2SO4')).toBe('absent');
    expect(value('S', 'xyz')).toBe('unreadable');
  });

  it('the book’s reactions: who is oxidised and reduced (questions tr. 31, 35, 45, 46)', () => {
    const verdict = Object.fromEntries(NS_REACTIONS.map((r) => [r.id, analyse(r)]));
    const haber = verdict.haber;
    expect(haber?.kind).toBe('redox');
    if (haber?.kind === 'redox') expect(haber.oxidisingAgents).toEqual(['N2']);
    const so2h2s = verdict['so2-h2s'];
    if (so2h2s?.kind !== 'redox') throw new Error('SO₂ + H₂S is a redox reaction');
    expect(so2h2s.oxidisingAgents).toEqual(['SO2']);
    expect(so2h2s.reducingAgents).toEqual(['H2S']);
    const so2no2 = verdict['so2-no2'];
    if (so2no2?.kind !== 'redox') throw new Error('SO₂ + NO₂ is a redox reaction');
    expect(so2no2.reducingAgents).toEqual(['SO2']);
    expect(verdict['nh3-hcl']?.kind).toBe('notRedox');
    expect(verdict['caf2-h2so4']?.kind).toBe('notRedox');
    expect(verdict['nh4no3-heat']?.kind).toBe('undecided');
    // ΔrH° as printed: −91,8 kJ (tr. 35), +180,6 kJ (tr. 31), −296,8 kJ (tr. 45).
    const dH = Object.fromEntries(NS_REACTIONS.map((r) => [r.id, r.dH_kJ]));
    expect([dH.haber, dH['n2-o2'], dH['s-o2'], dH['s-f2'], dH['h2-s']]).toEqual([
      -91.8, 180.6, -296.8, -1220.5, -20.6,
    ]);
  });

  it('every substance has facts with pages inside lessons 4–8 (tr. 29–54)', () => {
    for (const s of SUBSTANCES)
      for (const f of s.facts) {
        expect(f.page, s.id).toBeGreaterThanOrEqual(29);
        expect(f.page, s.id).toBeLessThanOrEqual(54);
      }
    expect(
      SUBSTANCES.find((s) => s.id === 'n2')?.facts.some((f) => f.text.vi.includes('945')),
    ).toBe(true);
  });

  it('the store keeps the learner’s formulas per element, at most 8, no duplicates', () => {
    setNs({ element: 'N', extraN: [], extraS: [] });
    addFormula('N2O5');
    addFormula('N2O5');
    expect(useNsStore.getState().extraN).toEqual(['N2O5']);
    for (let i = 0; i < 10; i++) addFormula(`X${String(i)}`);
    expect(useNsStore.getState().extraN).toHaveLength(8);
    removeFormula('X9');
    expect(useNsStore.getState().extraN).not.toContain('X9');
    setNs({ element: 'S', selected: 'nope' });
    expect(useNsStore.getState()).toMatchObject({ element: 'S', selected: 'n2' });
    setNs({ element: 'N', extraN: [], extraS: [] });
  });

  it('the card cites chapter 2 with its pages', () => {
    expect(nsCard().sources[0]?.citation).toContain('Bài 4 (tr. 29–32)');
  });
});
