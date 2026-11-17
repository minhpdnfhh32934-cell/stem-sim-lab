import { describe, expect, it } from 'vitest';
import {
  ANIONS,
  CARBONATE_DH,
  GROUP_IA,
  GROUP_IIA,
  IIA_SALT_METALS,
  NITRATE_DH,
  TABLE_25_4,
  TRANSITION,
  BE_MELTING_POINT,
  HEAVY_METAL_MIN_DENSITY,
  compoundFormula,
  feso4Concentration,
  ionConfiguration,
  solubility,
  solubilityClass,
  trend,
} from './model';

describe('groups IA and IIA (Bảng 24.1, 24.2, 25.1, 25.2)', () => {
  it('keeps the book’s rows', () => {
    expect(GROUP_IA.map((m) => m.id)).toEqual(['Li', 'Na', 'K', 'Rb', 'Cs']);
    expect(GROUP_IIA.map((m) => m.id)).toEqual(['Be', 'Mg', 'Ca', 'Sr', 'Ba']);
    expect(GROUP_IA[0]).toMatchObject({ radius_pm: 152, E_V: -3.04, mp_C: 180.5, density: 0.534 });
    expect(GROUP_IIA[0]).toMatchObject({ radius_pm: 112, E_V: -1.99, mp_C: 1287, bp_C: 2467 });
  });

  it('question 1: radius grows down both groups; melting points fall down group IA', () => {
    expect(trend(GROUP_IA.map((m) => m.radius_pm))).toBe('up');
    expect(trend(GROUP_IIA.map((m) => m.radius_pm))).toBe('up');
    expect(trend(GROUP_IA.map((m) => m.mp_C))).toBe('down');
    expect(trend(GROUP_IA.map((m) => m.density))).toBe('uneven');
  });
});

describe('solubility in group IIA (tr. 119–120)', () => {
  it('the thresholds of tr. 120 give back Bảng 25.4 as printed', () => {
    for (const anion of ANIONS) {
      const row = IIA_SALT_METALS.map((m) => solubilityClass(solubility(m, anion) ?? NaN)).join('');
      expect(row, anion).toBe(TABLE_25_4[anion]);
    }
  });

  it('hydroxides dissolve more down the group', () => {
    expect(trend(IIA_SALT_METALS.map((m) => solubility(m, 'OH') ?? NaN))).toBe('up');
    expect(compoundFormula('Ca', 'OH')).toBe('Ca(OH)2');
    expect(compoundFormula('Ba', 'SO4')).toBe('BaSO4');
  });

  it('carbonates and nitrates take more heat to decompose down the group', () => {
    expect(trend(IIA_SALT_METALS.map((m) => CARBONATE_DH[m] ?? NaN))).toBe('up');
    expect(trend(IIA_SALT_METALS.map((m) => NITRATE_DH[m] ?? NaN))).toBe('up');
  });
});

describe('first-row transition metals (Bảng 27.1, 27.2, 27.4; tr. 131–132)', () => {
  it('question 1: metals melting above Be, and the heavy metals', () => {
    expect(TRANSITION.filter((m) => m.mp_C > BE_MELTING_POINT).map((m) => m.id)).toEqual([
      'Sc',
      'Ti',
      'V',
      'Cr',
      'Fe',
      'Co',
      'Ni',
    ]);
    expect(TRANSITION.filter((m) => m.density >= HEAVY_METAL_MIN_DENSITY).map((m) => m.id)).toEqual(
      ['V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu'],
    );
  });

  it('ion configurations: the book’s Fe²⁺, Fe³⁺ and question 2’s Cr³⁺, Mn²⁺, Cu²⁺', () => {
    const conf = (id: string) => TRANSITION.find((m) => m.id === id)?.configuration ?? '';
    expect(ionConfiguration(conf('Fe'), 2)).toBe('[Ar]3d6');
    expect(ionConfiguration(conf('Fe'), 3)).toBe('[Ar]3d5');
    expect(ionConfiguration(conf('Cr'), 3)).toBe('[Ar]3d3');
    expect(ionConfiguration(conf('Mn'), 2)).toBe('[Ar]3d5');
    expect(ionConfiguration(conf('Cu'), 2)).toBe('[Ar]3d9');
  });

  it('the titration: 5 mL of KMnO₄ 0,02 M for 5,0 mL of FeSO₄ means 0,10 M', () => {
    expect(feso4Concentration(5)).toBeCloseTo(0.1, 12);
    expect(feso4Concentration(4.5)).toBeCloseTo(0.09, 12);
  });
});

describe('text', () => {
  it('raises each subshell count, two-digit ones included', async () => {
    const { configText } = await import('./text');
    expect(configText('[Ar]3d104s1')).toBe('[Ar]3d¹⁰4s¹');
    expect(configText('[He]2s1')).toBe('[He]2s¹');
    expect(configText('[Ar]3d54s2')).toBe('[Ar]3d⁵4s²');
  });
});
