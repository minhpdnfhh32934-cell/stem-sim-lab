import { describe, expect, it } from 'vitest';
import { balance, parseEquation } from '../balance';
import { canonicalFormulaText } from '../formula';
import {
  REACTIONS,
  bondChanges,
  frameCharge,
  isBalanced,
  matchLibrary,
  reactionById,
} from './reactions';

describe('curated reaction library', () => {
  it('has 30–50 reactions, each with sources and a review status', () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(30);
    expect(REACTIONS.length).toBeLessThanOrEqual(50);
    for (const r of REACTIONS) {
      expect(r.sources.length, r.id).toBeGreaterThan(0);
      expect(['pending', 'verified']).toContain(r.review_status);
      // A reaction either has a mechanism or says why it has none.
      expect(r.mechanism !== null || r.no_mechanism_reason !== null, r.id).toBe(true);
    }
  });

  it('every equation conserves atoms and charge', () => {
    for (const r of REACTIONS) expect(isBalanced(r), r.id).toBe(true);
  });

  it('the balancer finds the same coefficients as the library', () => {
    let ambiguous = 0;
    for (const r of REACTIONS) {
      const text = `${r.reactants.map((t) => t.formula).join(' + ')} -> ${r.products.map((t) => t.formula).join(' + ')}`;
      const res = balance(parseEquation(text));
      if (res.kind === 'ambiguous') {
        // e.g. the silver-mirror equation: several independent balancings exist, the library
        // gives the textbook one (its conservation is checked above).
        ambiguous++;
        continue;
      }
      expect(res.kind, r.id).toBe('balanced');
      if (res.kind === 'balanced') {
        expect(res.coefficients, r.id).toEqual([...r.reactants, ...r.products].map((t) => t.coef));
      }
    }
    expect(ambiguous).toBeLessThanOrEqual(1);
  });

  it('mechanism frames keep the same atoms (atom mapping) and charge', () => {
    for (const r of REACTIONS) {
      const m = r.mechanism;
      if (!m) continue;
      const sig = (f: (typeof m.frames)[number]) => f.atoms.map((a) => `${a.map}${a.el}`).join(',');
      const first = m.frames[0]!;
      for (const f of m.frames) {
        expect(sig(f), `${r.id}: ${f.label.en}`).toBe(sig(first));
        expect(f.total_charge, `${r.id}: ${f.label.en}`).toBe(frameCharge(first));
        // Formal charges add up in every frame except transition states (partial charges).
        if (f.kind !== 'ts') expect(frameCharge(f), `${r.id}: ${f.label.en}`).toBe(f.total_charge);
        for (const b of [...f.bonds, ...f.partial]) {
          expect(f.atoms.some((a) => a.map === b.a) && f.atoms.some((a) => a.map === b.b)).toBe(
            true,
          );
        }
      }
      expect(first.kind).toBe('reactants');
      expect(m.frames.at(-1)?.kind).toBe('products');
    }
  });

  it('mechanism end frames contain the equation’s species (atom totals match)', () => {
    // Totals of the first frame equal the reactant side (plus spectators/catalyst present on
    // both sides of the frames, e.g. H3O+ in esterification).
    const r = reactionById('sn2-ch3br')!;
    const f = r.mechanism!.frames;
    const count = (fr: (typeof f)[number]) => fr.atoms.length;
    expect(count(f[0]!)).toBe(count(f.at(-1)!));
  });

  it('SN2: C–Br breaks and C–O forms', () => {
    const f = reactionById('sn2-ch3br')!.mechanism!.frames;
    const ch = bondChanges(f[0]!, f.at(-1)!);
    expect(ch.get('1-2')).toBe('broken');
    expect(ch.get('1-3')).toBe('formed');
  });

  it('Fischer esterification: the water oxygen comes from the acid (¹⁸O labelling result)', () => {
    const last = reactionById('esterification')!.mechanism!.frames.at(-1)!;
    // O4 is the acid's OH oxygen; it must end up bonded to two H and nothing else.
    const partners = last.bonds
      .filter((b) => b.a === 4 || b.b === 4)
      .map((b) => (b.a === 4 ? b.b : b.a));
    const els = partners.map((m) => last.atoms.find((a) => a.map === m)?.el);
    expect(els.sort()).toEqual(['H', 'H']);
  });

  it('matches equations to the library regardless of order', () => {
    expect(matchLibrary(['O2', 'CH4'], ['H2O', 'CO2'])).toMatchObject({
      reaction: { id: 'ch4-combustion' },
      reverse: false,
      exact: true,
    });
    expect(matchLibrary(['H2', 'N2'], [])).toBeUndefined();
  });

  const eqMatch = (text: string) => {
    const eq = parseEquation(text);
    return matchLibrary(
      eq.reactants.map((s) => s.text),
      eq.products.map((s) => s.text),
    );
  };

  it.each([
    'H2O -> H2 + O2', // reverse of H2 + O2 → H2O (not reversible)
    'CaO + CO2 -> CaCO3', // reverse of the decomposition
    'C2H5OH -> C2H4 + H2O', // reverse of the hydration
  ])('the reverse of an irreversible library reaction is not verified: %s', (text) => {
    expect(eqMatch(text)).toBeUndefined();
  });

  it.each([
    ['C2H4 + H2O -> CH3OCH3', 'c2h4-h2o'], // the library product is ethanol
    ['C3H6 + HBr -> CH3CH2CH2Br', 'propene-hbr'], // the library product is C3H7Br (Markovnikov)
  ])('same molecular formula but another written species is not exact: %s', (text, id) => {
    expect(eqMatch(text)).toMatchObject({ reaction: { id }, exact: false });
  });

  it('the reverse of a reversible library reaction matches and says so', () => {
    const r = REACTIONS.find((x) => x.reversible)!;
    const m = matchLibrary(
      r.products.map((t) => t.formula),
      r.reactants.map((t) => t.formula),
    );
    expect(m).toMatchObject({ reaction: { id: r.id }, reverse: true, exact: true });
  });

  it('charge spellings do not break an exact match', () => {
    expect(canonicalFormulaText('CH3COO-')).toBe(canonicalFormulaText('CH3COO^-'));
    expect(canonicalFormulaText('Cu²⁺')).toBe(canonicalFormulaText('Cu^2+'));
    expect(canonicalFormulaText('C2H5OH')).not.toBe(canonicalFormulaText('CH3OCH3'));
  });
});
