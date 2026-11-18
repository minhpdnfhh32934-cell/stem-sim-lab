import { describe, expect, it } from 'vitest';
import { sgkVl12 } from '../common/sources';
import { thermalCard } from './card';
import {
  PRESETS,
  REFERENCE,
  convert,
  deltaU,
  heatingPlan,
  inclineExample,
  integratedStageEnds,
  physical,
  presetDef,
  reach,
  stateAt,
  substance,
  totalHeat,
  totalTime,
} from './model';
import { setThermal, useThermalStore } from './store';

describe('heat and changes of state (VL12 Bài 2–6)', () => {
  it('the book’s tables as printed (Bảng 4.1, 5.1, 6.1)', () => {
    expect(substance('water')).toMatchObject({
      c_solid: 2100,
      c_liquid: 4200,
      lambda: 3.34e5,
      L: 2.26e6,
    });
    expect(substance('copper')).toMatchObject({ c_solid: 380, melt_C: 1084, lambda: 1.8e5 });
    expect(substance('mercury')).toMatchObject({ c_liquid: 140, boil_C: 357, L: 2.85e5 });
    expect(substance('ether')).toMatchObject({ boil_C: 34.5, L: 4e5 });
  });

  it('question 2, tr. 24: 2 kg of copper from 30 °C, 20 000 W at 50 % melts fully in about 116 s', () => {
    const stages = heatingPlan({ preset: 'copper', m: 2, t0: 30, P: 20000, eff: 0.5 });
    const melted = reach(stages, { kind: 'melted' });
    // Q = 2·380·(1084 − 30) + 2·1,8·10⁵ = 801 040 + 360 000 J.
    expect(melted?.Q).toBeCloseTo(1_161_040, 6);
    expect(melted?.time).toBeCloseTo(116.104, 9);
  });

  it('question 3, tr. 21: 20 L of water from 20 °C to 70 °C takes 4,2 MJ, 2 100 s at 2,5 kW and 80 %', () => {
    const stages = heatingPlan({ preset: 'water', m: 20, t0: 20, P: 2500, eff: 0.8 });
    const r = reach(stages, { kind: 'temp', t: 70 });
    expect(r?.Q).toBeCloseTo(4.2e6, 6);
    expect(r?.time).toBeCloseTo(2100, 9);
  });

  it('ice at −10 °C to steam: four stages that add up, and DOPRI5 finds the same stage ends', () => {
    const inp = { preset: 'ice' as const, m: 0.5, t0: -10, P: 1000, eff: 0.8 };
    const stages = heatingPlan(inp);
    expect(stages.map((s) => s.kind)).toEqual(['heatSolid', 'melt', 'heatLiquid', 'boil']);
    expect(totalHeat(stages)).toBeCloseTo(0.5 * (2100 * 10 + 3.34e5 + 4200 * 100 + 2.26e6), 6);
    const ends = integratedStageEnds(inp);
    stages.forEach((s, i) => {
      expect(ends[i] ?? 0, s.kind).toBeCloseTo(s.start + s.dt, 6);
    });
    for (const p of PRESETS) {
      const def = presetDef(p);
      const plan = heatingPlan({ preset: p, m: 1.3, t0: def.t0[0], P: 750, eff: 0.6 });
      const found = integratedStageEnds({ preset: p, m: 1.3, t0: def.t0[0], P: 750, eff: 0.6 });
      expect(found.length, p).toBe(plan.length);
      expect(found.at(-1) ?? 0, p).toBeCloseTo(totalTime(plan), 6);
    }
  });

  it('along the curve the temperature stays put while melting or boiling', () => {
    const stages = heatingPlan({ preset: 'ice', m: 1, t0: -20, P: 2000, eff: 1 });
    const melt = stages[1];
    if (!melt) throw new Error('no melt');
    const mid = stateAt(stages, melt.start + melt.dt / 2);
    expect(mid).toMatchObject({ t: 0, done: 0.5 });
    expect(stateAt(stages, totalTime(stages)).t).toBe(100);
    expect(
      reach(heatingPlan({ preset: 'lead', m: 1, t0: 20, P: 100, eff: 1 }), { kind: 'boiled' }),
    ).toBeNull();
  });

  it('temperature scales: the book’s conversions (tr. 17–18) and absolute zero', () => {
    expect(convert(270, 'C').K).toBeCloseTo(543.15, 9);
    expect(convert(-270, 'C').K).toBeCloseTo(3.15, 9);
    expect(convert(0, 'K').C).toBeCloseTo(-273.15, 9);
    expect(convert(1000, 'K').C).toBeCloseTo(726.85, 9);
    expect(convert(100, 'C')).toMatchObject({ Krounded: 373, F: 212 });
    expect(convert(32, 'F').C).toBeCloseTo(0, 12);
    // Cooling from 100 °C to 0 °C lowers the Kelvin temperature by 100 K.
    expect(convert(100, 'C').K - convert(0, 'C').K).toBeCloseTo(100, 12);
    expect(physical(-274, 'C')).toBe(false);
    expect(physical(0, 'K')).toBe(true);
    // Hình 3.3: where both scales are printed they follow T = t + 273.
    for (const r of REFERENCE)
      if (r.kelvin !== null && r.celsius !== null && r.kelvin !== 0)
        expect(r.kelvin).toBe(r.celsius + 273);
  });

  it('first law ΔU = A + Q, and the incline question (tr. 14)', () => {
    expect(deltaU(300, -100)).toBe(200);
    expect(deltaU(-50, -50)).toBe(-100);
    const ex = inclineExample(1, 21, 30, 4.1, 9.8);
    // mgh − ½mv² = 9,8 · 10,5 − 0,5 · 16,81
    expect(ex.dU).toBeCloseTo(102.9 - 8.405, 9);
    expect(ex.friction).toBeCloseTo(-94.495, 9);
  });

  it('the store keeps values inside the preset’s range and refuses temperatures below 0 K', () => {
    setThermal({ preset: 'ice', t0: 30 });
    expect(useThermalStore.getState().t0).toBe(0);
    setThermal({ unit: 'K', value: -5 });
    expect(useThermalStore.getState().value).not.toBe(-5);
    // Changing the unit alone keeps the temperature.
    setThermal({ unit: 'C', value: -40 });
    setThermal({ unit: 'K' });
    expect(useThermalStore.getState()).toMatchObject({ unit: 'K', value: 233.15 });
    setThermal({ unit: 'F' });
    expect(useThermalStore.getState().value).toBeCloseTo(-40, 9);
    // Water never melts and copper never boils in the book's data: the target follows.
    setThermal({ preset: 'copper', target: 'melted' });
    setThermal({ preset: 'water' });
    expect(useThermalStore.getState().target).toBe('boiled');
    setThermal({ preset: 'copper' });
    expect(useThermalStore.getState().target).toBe('melted');
    setThermal({ preset: 'copper', t0: 30, unit: 'C', value: 270 });
    expect(thermalCard().sources.map((s) => s.id)).toEqual(
      expect.arrayContaining([2, 3, 4, 5, 6].map((n) => sgkVl12(n).id)),
    );
  });
});
