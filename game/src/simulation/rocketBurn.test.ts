import { describe, expect, it } from 'vitest';
import { burnAt, G0, MOLAR } from './rocketBurn';

describe('a methane–oxygen engine’s burn', () => {
  it('burns fuel-rich: mass kept, the oxygen used up, some methane left', () => {
    const thrust = 3.5e6;
    const b = burnAt(thrust, 327, 3.6);
    expect(b.methane + b.oxygen).toBeCloseTo(thrust / (327 * G0), 9);
    expect(b.oxygen / b.methane).toBeCloseTo(3.6, 9);
    expect(b.stoichiometric).toBeCloseTo((2 * MOLAR.O2) / MOLAR.CH4, 12);
    expect(3.6).toBeLessThan(b.stoichiometric);
    // Mass in = mass out (to the molar masses' rounding).
    expect(b.carbonDioxide + b.water + b.unburnt).toBeCloseTo(b.methane + b.oxygen, 0);
    // One CO₂ and two H₂O per CH₄ burned: their moles in a 1 : 2 ratio.
    expect(b.water / MOLAR.H2O / (b.carbonDioxide / MOLAR.CO2)).toBeCloseTo(2, 9);
    expect(b.unburnt).toBeGreaterThan(0);
    expect(b.heat).toBeGreaterThan(1e9);
  });

  it('burns all of both at the stoichiometric mix', () => {
    const mix = (2 * MOLAR.O2) / MOLAR.CH4;
    const b = burnAt(1e6, 327, mix);
    expect(b.unburnt).toBeCloseTo(0, 6);
  });
});
