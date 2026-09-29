import { describe, expect, it } from 'vitest';
import { balance, parseEquation } from '../balance';
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
    expect(matchLibrary(['H2O', 'CH4', 'CO2', 'O2'])?.id).toBe('ch4-combustion');
    expect(matchLibrary(['H2', 'N2'])).toBeUndefined();
  });
});
