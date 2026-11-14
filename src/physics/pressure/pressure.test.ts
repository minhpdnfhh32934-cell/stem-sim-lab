import { describe, expect, it } from 'vitest';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { PR, PressureEngine, runLength } from './engine';
import { ATM, WATER_RHO, column, liquidPart, totalPressure } from './model';
import { liquidPressure, numericPressure } from './scenes';

const base = { ...liquidPressure.defaults, g: 9.81 };

describe('liquid pressure (VL10 Bài 34)', () => {
  it('p = pₐ + ρgh: a textbook value (10 m of water at g = 10 adds 10⁵ Pa)', () => {
    const q = column({ ...base, h: 10, rho: 1000, pa: 1e5, g: 10 });
    expect(liquidPart(q)).toBeCloseTo(1e5, 9);
    expect(totalPressure(q)).toBeCloseTo(2e5, 9);
  });

  it('defaults: water at 20 °C and one standard atmosphere', () => {
    expect(WATER_RHO).toBe(998.21);
    expect(ATM).toBe(101325);
    const q = column({});
    expect(q.rho).toBe(WATER_RHO);
    expect(q.pa).toBe(ATM);
  });

  it('the closed form = DOPRI5 of dp/dh = ρg, over every slider', () => {
    const sets = [...sliderEnds(liquidPressure), ...sliderSweep(liquidPressure, 300, 34)].map(
      (p) => ({ ...p, g: p.g ?? 9.81 }),
    );
    expect(sets.map((p) => checkMisses(liquidPressure, p)).filter((m) => m.length > 0)).toEqual([]);
    for (const p of sets) {
      const q = column(p);
      expect(numericPressure(q)).toBeCloseTo(totalPressure(q), 6);
    }
  });

  it('the pressure grows linearly with depth: twice as deep, twice the liquid part', () => {
    const a = liquidPart(column({ ...base, h: 3 }));
    const b = liquidPart(column({ ...base, h: 6 }));
    expect(b / a).toBeCloseTo(2, 12);
    // The total does not double: the air pressure stays the same.
    expect(
      totalPressure(column({ ...base, h: 6 })) / totalPressure(column({ ...base, h: 3 })),
    ).toBeLessThan(1.5);
  });

  it('the engine sinks the probe to h and ends on the solved pressure', () => {
    const p = { ...base, h: 7.5 };
    const e = new PressureEngine();
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    e.readState(s);
    expect(s[PR.d]).toBe(0);
    expect(s[PR.p]).toBe(ATM);
    while (!e.finished()) e.step();
    expect(e.time()).toBeCloseTo(runLength(column(p)), 9);
    e.readState(s);
    expect(s[PR.d]).toBeCloseTo(7.5, 12);
    const sol = liquidPressure.solve(p, 'vi');
    expect(s[PR.p]).toBeCloseTo(sol.answers.find((a) => a.id === 'p')?.value ?? NaN, 6);
  });

  it('at the surface only the air pressure acts', () => {
    const sol = liquidPressure.solve({ ...base, h: 0 }, 'en');
    expect(sol.answers.find((a) => a.id === 'pl')?.value).toBe(0);
    expect(sol.answers.find((a) => a.id === 'p')?.value).toBe(ATM);
  });

  it('says how much deeper adds 1 atm (computed, about 10,3 m of water)', () => {
    const note = liquidPressure.solve(base, 'vi').notes?.[0]?.vi ?? '';
    expect(note).toMatch(/^Cứ xuống sâu thêm 10,3 m/);
  });

  it('Science Card: exact, with the water and atmosphere sources', () => {
    const c = liquidPressure.scienceCard(base);
    expect(c.confidence).toBe('exact');
    expect(c.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['iapws-water', 'codata']));
    expect(c.assumptions.map((a) => a.vi).join(' ')).toContain('998,21 kg/m³');
    expect(c.assumptions.map((a) => a.vi).join(' ')).toContain('101,325 kPa');
  });
});
