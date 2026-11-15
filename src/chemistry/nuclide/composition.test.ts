import { describe, expect, it } from 'vitest';
import { elementByZ } from '../data/elements';
import { isotopesOf, naturalNuclide } from '../data/isotopes';
import {
  atomKind,
  composition,
  electronRange,
  notation,
  N_MAX,
  R0_FM,
  Z_MAX,
  Z_MIN,
} from './composition';

/** CODATA 2022 particle masses in u, typed from https://physics.nist.gov/cuu/Constants/. */
const MP_U = 1.0072764665789;
const MN_U = 1.00866491606;
const ME_U = 5.485799090441e-4;

describe('composition of an atom (HH10 Bài 1)', () => {
  it('²³Na: A = Z + N, neutral, masses from CODATA 2022', () => {
    const c = composition(11, 12, 11);
    expect(c.a).toBe(23);
    expect(c.charge).toBe(0);
    expect(atomKind(c.charge)).toBe('neutral');
    expect(c.element.symbol).toBe('Na');
    expect(notation(c)).toBe('²³₁₁Na');
    expect(c.masses.proton.eachU).toBeCloseTo(MP_U, 9);
    expect(c.masses.neutron.eachU).toBeCloseTo(MN_U, 9);
    expect(c.masses.electron.eachU).toBeCloseTo(ME_U, 12);
    expect(c.masses.proton.eachKg).toBeCloseTo(1.67262192595e-27, 37);
    expect(c.totalU).toBeCloseTo(11 * MP_U + 12 * MN_U + 11 * ME_U, 9);
    expect(c.totalKg / c.totalU).toBeCloseTo(1.66053906892e-27, 36);
    // The electrons weigh 11 × 0.000549 u of 23.19 u: the nucleus holds 99.97 %.
    expect(c.nucleusShare).toBeCloseTo(1 - (11 * ME_U) / c.totalU, 12);
    expect(c.nucleusShare).toBeGreaterThan(0.9997);
  });

  it('ions: Cl⁻ is an anion, Al³⁺ a cation; the electron mass follows the electrons', () => {
    const cl = composition(17, 18, 18);
    expect(cl.charge).toBe(-1);
    expect(atomKind(cl.charge)).toBe('anion');
    expect(notation(cl)).toBe('³⁵₁₇Cl⁻');
    expect(cl.masses.electron.totalU).toBeCloseTo(18 * ME_U, 12);
    const al = composition(13, 14, 10);
    expect(notation(al)).toBe('²⁷₁₃Al³⁺');
    expect(atomKind(al.charge)).toBe('cation');
    expect(notation(composition(8, 8, 10))).toBe('¹⁶₈O²⁻');
  });

  it('mass defect of a natural nuclide: sum of the neutral atom’s particles − real mass', () => {
    const na = composition(11, 12, 10); // an ion: the defect is still the neutral atom's
    const real = naturalNuclide(11, 23)?.mass_u ?? NaN;
    expect(na.nuclide?.mass_u).toBe(real);
    expect(na.massDefectU).toBeCloseTo(11 * (MP_U + ME_U) + 12 * MN_U - real, 9);
    expect(na.massDefectU).toBeCloseTo(0.2003, 4);
    // ¹H is one proton and one electron: only the 13.6 eV binding, about 1.5·10⁻⁸ u.
    expect(Math.abs(composition(1, 0, 1).massDefectU ?? NaN)).toBeLessThan(1e-7);
    // ¹²C defines the unit: 12 u exactly.
    expect(composition(6, 6, 6).nuclide?.mass_u).toBe(12);
    // ²³Na with 13 neutrons is not natural: no real mass, no defect.
    const na24 = composition(11, 13, 11);
    expect(na24.nuclide).toBeUndefined();
    expect(na24.massDefectU).toBeNull();
  });

  it('nucleus vs atom: R = r₀A^(1/3) against the covalent radius, 10⁴–10⁵ times', () => {
    const h = composition(1, 0, 1);
    expect(h.nucleusRadiusFm).toBe(R0_FM);
    expect(h.atomRadiusPm).toBe(31);
    expect(h.sizeRatio).toBeCloseTo((31 * 1000) / 1.2, 6);
    const kr = composition(36, 50, 36);
    expect(kr.nucleusRadiusFm).toBeCloseTo(1.2 * Math.cbrt(86), 12);
    for (let z = Z_MIN; z <= Z_MAX; z++) {
      for (const i of isotopesOf(z)?.isotopes ?? []) {
        const ratio = composition(z, i.a - z, z).sizeRatio ?? NaN;
        expect(ratio, `Z=${z} A=${i.a}`).toBeGreaterThan(1e4);
        expect(ratio, `Z=${z} A=${i.a}`).toBeLessThan(1e5);
      }
    }
  });

  it('the slider ranges hold every natural nuclide of H…Kr, each with a covalent radius', () => {
    let maxN = 0;
    for (let z = Z_MIN; z <= Z_MAX; z++) {
      expect(elementByZ(z)?.covalent_radius_pm, `Z=${z}`).not.toBeNull();
      const isotopes = isotopesOf(z)?.isotopes ?? [];
      expect(isotopes.length, `Z=${z}`).toBeGreaterThan(0);
      for (const i of isotopes) maxN = Math.max(maxN, i.a - z);
    }
    expect(maxN).toBe(N_MAX);
    expect(electronRange(1)).toEqual([0, 4]);
    expect(electronRange(17)).toEqual([14, 20]);
  });
});
