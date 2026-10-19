import { describe, expect, it } from 'vitest';
import { REACTIONS, reactionById, type Reaction } from '@/chemistry/data/reactions';
import { validateScenario } from '../scenario';
import { chemistryChlorideTest as sc } from '../scenarios/chemistryChlorideTest';
import { chemistryOf, targetMatchesLibrary } from './evidence';
import {
  checkEquation,
  equationString,
  libraryModelId,
  mixKey,
  mixOutcome,
  reactionIdOf,
  recordsFor,
  speciesKey,
} from './library';

const b = (() => {
  const binding = chemistryOf(sc);
  if (!binding) throw new Error('chemistry scenario expected');
  return binding;
})();

describe('library matching', () => {
  it('is order-independent and finds the precipitation records', () => {
    for (const pair of [
      ['NaCl', 'AgNO3'],
      ['AgNO3', 'NaCl'],
    ]) {
      const o = mixOutcome(pair);
      expect(o.kind).toBe('library');
      if (o.kind === 'library') {
        expect(o.reaction.id).toBe('agcl');
        expect(o.precipitate).toBe(true);
      }
    }
    const ba = mixOutcome(['H2SO4', 'BaCl2']);
    expect(ba.kind === 'library' && ba.reaction.id).toBe('baso4');
    expect(speciesKey('NaCl')).toBe(speciesKey('ClNa'));
    expect(mixKey(['NaCl', 'AgNO3'])).toBe(mixKey(['AgNO3', 'NaCl']));
  });

  it('says "unknown" for pairs without a record and never guesses', () => {
    for (const pair of [
      ['AgNO3', 'BaCl2'],
      ['NaCl', 'BaCl2'],
      ['NaCl', 'H2SO4'],
      ['AgNO3', 'H2SO4'],
    ]) {
      expect(mixOutcome(pair)).toEqual({ kind: 'unknown' });
    }
    // CuSO₄ + NaOH is not in the library.
    expect(mixOutcome(['CuSO4', 'NaOH'])).toEqual({ kind: 'unknown' });
  });

  it('needs the exact set of starting substances (a subset is not a match)', () => {
    expect(recordsFor(['AgNO3'])).toEqual([]);
    expect(recordsFor(['AgNO3', 'NaCl', 'BaCl2'])).toEqual([]);
  });

  it('reports several records with different conditions as ambiguous', () => {
    const o = mixOutcome(['Cu', 'HNO3']);
    expect(o.kind).toBe('ambiguous');
    if (o.kind === 'ambiguous') {
      expect(o.reactions.map((r) => r.id).sort()).toEqual(['cu-hno3-conc', 'cu-hno3-dil']);
    }
  });

  it('only a record classified as precipitation counts as a precipitate', () => {
    const o = mixOutcome(['HCl', 'NaOH']);
    expect(o.kind === 'library' && o.reaction.id).toBe('hcl-naoh');
    expect(o.kind === 'library' && o.precipitate).toBe(false);
  });
});

describe('equation check with balance.ts', () => {
  it('confirms the library coefficients of both precipitation records', () => {
    for (const id of ['agcl', 'baso4']) {
      const r = reactionById(id);
      expect(r).toBeDefined();
      if (r) expect(checkEquation(r)).toEqual({ conserved: true, unbalanced: [], minimal: true });
    }
    const agcl = reactionById('agcl');
    if (agcl) expect(equationString(agcl)).toBe('AgNO₃ + NaCl → AgCl + NaNO₃');
    const baso4 = reactionById('baso4');
    if (baso4) expect(equationString(baso4)).toBe('BaCl₂ + H₂SO₄ → BaSO₄ + 2HCl');
  });

  it('catches a wrong coefficient', () => {
    const base = reactionById('baso4') as Reaction;
    const broken: Reaction = {
      ...base,
      products: [
        { coef: 1, formula: 'BaSO4' },
        { coef: 1, formula: 'HCl' },
      ],
    };
    const c = checkEquation(broken);
    expect(c.conserved).toBe(false);
    expect(c.unbalanced.sort()).toEqual(['Cl', 'H']);
    expect(c.minimal).toBe(false);
  });

  it('every precipitation record in the library is conserved', () => {
    for (const r of REACTIONS.filter((x) => x.category === 'precipitation')) {
      expect(checkEquation(r).conserved).toBe(true);
    }
  });
});

describe('the chloride scenario uses only library data', () => {
  it('is valid, its rack solutions are library reactants and its target is the agcl record', () => {
    expect(validateScenario(sc).ok).toBe(true);
    const reactants = new Set(REACTIONS.flatMap((r) => r.reactants.map((t) => t.formula)));
    for (const f of b.inventory) expect(reactants.has(f)).toBe(true);
    expect(targetMatchesLibrary(b)).toBe(true);
    expect(sc.review_status).toBe('pending');
  });

  it('rejects a target outside the rack or the same solution twice', () => {
    const bad = (target: [string, string]) =>
      validateScenario({ ...sc, binding: { ...b, target } });
    expect(bad(['NaCl', 'CuSO4']).ok).toBe(false);
    expect(bad(['NaCl', 'NaCl']).ok).toBe(false);
    expect(targetMatchesLibrary({ ...b, reaction: 'baso4' })).toBe(false);
  });

  it('maps library records to evidence model ids and back', () => {
    expect(libraryModelId({ id: 'agcl' })).toBe('reactions/agcl');
    expect(reactionIdOf('reactions/agcl')).toBe('agcl');
    expect(reactionIdOf('reactions')).toBeNull();
    expect(reactionIdOf('phys.projectile')).toBeNull();
  });
});
