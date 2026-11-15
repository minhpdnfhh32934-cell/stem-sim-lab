import { describe, expect, it } from 'vitest';
import { balancedCoefficients, REACTIONS, reactionById, type Reaction } from '../data/reactions';
import { analyzeRedox, type RedoxAnalysis } from './redox';

const lib = (id: string): Reaction => {
  const r = reactionById(id);
  if (!r) throw new Error(id);
  return r;
};
const redox = (id: string) => {
  const a = analyzeRedox(lib(id));
  if (a.kind !== 'redox') throw new Error(`${id}: ${a.kind}`);
  return a;
};
const brief = (a: Extract<RedoxAnalysis, { kind: 'redox' }>) => ({
  oxidised: a.oxidised.map((c) => `${c.el} ${c.from}→${c.to} ×${c.atoms}`),
  reduced: a.reduced.map((c) => `${c.el} ${c.from}→${c.to} ×${c.atoms}`),
  electrons: a.electrons,
  reducing: a.reducingAgents,
  oxidising: a.oxidisingAgents,
});

describe('redox analysis of library reactions', () => {
  it('Fe2O3 + CO (the textbook opening example): Fe +3 → 0, C +2 → +4, 6 e', () => {
    expect(brief(redox('fe2o3-co'))).toEqual({
      oxidised: ['C 2→4 ×3'],
      reduced: ['Fe 3→0 ×2'],
      electrons: 6,
      reducing: ['CO'],
      oxidising: ['Fe2O3'],
    });
  });

  it('KMnO4 + HCl: only the Cl going into Cl2 is oxidised, 10 e', () => {
    expect(brief(redox('kmno4-hcl'))).toEqual({
      oxidised: ['Cl -1→0 ×10'],
      reduced: ['Mn 7→2 ×2'],
      electrons: 10,
      reducing: ['HCl'],
      oxidising: ['KMnO4'],
    });
  });

  it('H2O2 decomposition: the same reactant is oxidised and reduced', () => {
    expect(brief(redox('h2o2-decomp'))).toEqual({
      oxidised: ['O -1→0 ×2'],
      reduced: ['O -1→-2 ×2'],
      electrons: 2,
      reducing: ['H2O2'],
      oxidising: ['H2O2'],
    });
  });

  it('Na + H2O, Zn + HCl, CH4 combustion, Daniell cell', () => {
    expect(brief(redox('na-h2o'))).toMatchObject({ electrons: 2, reducing: ['Na'] });
    expect(brief(redox('na-h2o')).oxidising).toEqual(['H2O']);
    expect(brief(redox('zn-hcl'))).toMatchObject({
      oxidised: ['Zn 0→2 ×1'],
      reduced: ['H 1→0 ×2'],
      electrons: 2,
    });
    expect(brief(redox('ch4-combustion'))).toMatchObject({
      oxidised: ['C -4→4 ×1'],
      reduced: ['O 0→-2 ×4'],
      electrons: 8,
    });
    expect(brief(redox('daniell'))).toMatchObject({ electrons: 2, oxidising: ['Cu^2+'] });
  });

  it('coefficients come from the exact balancer and equal the library', () => {
    const a = analyzeRedox(lib('kmno4-hcl'));
    expect(a.coefficientsBy).toBe('balancer');
    expect(a.species.map((s) => s.coef)).toEqual([2, 16, 2, 2, 5, 8]);
  });

  it('not redox: no oxidation number changes', () => {
    for (const id of ['caco3-decomp', 'hcl-naoh', 'baso4', 'caco3-hcl', 'neutralization'])
      expect(analyzeRedox(lib(id)).kind, id).toBe('notRedox');
  });

  it('undecided when a species is refused, naming it', () => {
    const a = analyzeRedox(lib('fe-cuso4'));
    expect(a.kind).toBe('undecided');
    expect(a.kind === 'undecided' && a.refused.map((s) => s.formula)).toEqual(['CuSO4', 'FeSO4']);
    expect(analyzeRedox(lib('c2h5oh-combustion')).kind).toBe('undecided');
  });

  it('every decided library reaction gives and takes the same number of electrons', () => {
    for (const r of REACTIONS) {
      const a = analyzeRedox(r);
      if (a.kind !== 'redox') continue;
      const taken = a.reduced.reduce((s, c) => s + c.electrons, 0);
      expect(taken, r.id).toBe(a.electrons);
      expect(a.electrons, r.id).toBeGreaterThan(0);
    }
  });

  it('every reaction the library files under redox is redox or honestly undecided', () => {
    for (const r of REACTIONS.filter((x) => x.category === 'redox'))
      expect(['redox', 'undecided'], r.id).toContain(analyzeRedox(r).kind);
  });
});

describe('the book’s electron-balance steps (SGK tr. 74)', () => {
  const steps = (id: string) => {
    const a = redox(id);
    return [...a.oxidised, ...a.reduced].map(
      (c) =>
        `${c.el} ${String(c.from)}→${String(c.to)} unit ${String(c.unit)} ×${String(c.multiplier)}`,
    );
  };
  it('Ostwald: 4 × (N⁻³ → N⁺² + 5e), 5 × (O₂ + 4e → 2O⁻²), as in the book', () => {
    expect(steps('ostwald')).toEqual(['N -3→2 unit 1 ×4', 'O 0→-2 unit 2 ×5']);
  });
  it('a molecule on either side sets the unit: Cl₂ formed, H₂ formed, O₂ used', () => {
    expect(steps('kmno4-hcl')).toEqual(['Cl -1→0 unit 2 ×5', 'Mn 7→2 unit 1 ×2']);
    expect(steps('zn-hcl')).toEqual(['Zn 0→2 unit 1 ×1', 'H 1→0 unit 2 ×1']);
    expect(steps('fe2o3-co')).toEqual(['C 2→4 unit 1 ×3', 'Fe 3→0 unit 1 ×2']);
  });
  it('Bước 3 takes the smallest factors: thermite 1 × and 1 ×, 6 e in the equation', () => {
    expect(steps('thermite')).toEqual(['Al 0→3 unit 1 ×1', 'Fe 3→0 unit 1 ×1']);
    expect(redox('thermite').electrons).toBe(6);
  });
});

describe('balancedCoefficients', () => {
  it('equals the library’s coefficients for every reaction the balancer can solve', () => {
    let solved = 0;
    for (const r of REACTIONS) {
      const b = balancedCoefficients(r);
      if (b.by !== 'balancer') continue;
      solved++;
      expect(b.coefficients, r.id).toEqual([...r.reactants, ...r.products].map((t) => t.coef));
    }
    expect(solved).toBeGreaterThanOrEqual(REACTIONS.length - 1);
  });
});
