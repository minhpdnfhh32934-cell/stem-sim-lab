import { describe, expect, it } from 'vitest';
import { molarMass } from '../formula';
import {
  AMINE_TABLE,
  AMINO_ACIDS,
  amine,
  amineIsomers,
  fragments,
  glycineMigration,
  peptide,
} from './model';

const count = (smiles: string, el: 'C' | 'N' | 'O') =>
  (smiles.match(el === 'C' ? /C(?!l)/g : el === 'N' ? /N/g : /O/g) ?? []).length;

describe('amines (HH12 Bài 8)', () => {
  it('names as the book does (tr. 35–36)', () => {
    expect(amine(['methyl', 'methyl', 'ethyl'])).toMatchObject({
      condensed: 'CH3CH2N(CH3)2',
      radicofunctional: 'ethyldimethylamine',
      substitutive: 'N,N-dimethylethanamine',
      degree: 3,
    });
    expect(amine(['isopropyl'])).toMatchObject({
      condensed: '(CH3)2CHNH2',
      radicofunctional: 'isopropylamine',
      substitutive: 'propan-2-amine',
    });
    expect(amine(['methyl', 'methyl', 'propyl'])).toMatchObject({
      radicofunctional: 'dimethylpropylamine',
      substitutive: 'N,N-dimethylpropan-1-amine',
    });
    expect(amine(['methyl', 'methyl']).substitutive).toBe('N-methylmethanamine');
  });

  it('question 3, tr. 37: CH3CH2CH2NH2, CH3CH2NHCH3, (CH3)3N', () => {
    expect(amine(['propyl'])).toMatchObject({
      condensed: 'CH3CH2CH2NH2',
      radicofunctional: 'propylamine',
      substitutive: 'propan-1-amine',
    });
    expect(amine(['ethyl', 'methyl'])).toMatchObject({
      condensed: 'CH3CH2NHCH3',
      radicofunctional: 'ethylmethylamine',
      substitutive: 'N-methylethanamine',
    });
    expect(amine(['methyl', 'methyl', 'methyl'])).toMatchObject({
      condensed: '(CH3)3N',
      radicofunctional: 'trimethylamine',
      substitutive: 'N,N-dimethylmethanamine',
    });
  });

  it('question 2, tr. 36: C3H9N has four amines; CnH2n+3N has 1, 2, 4, 8 for n = 1…4', () => {
    expect(amineIsomers(3).map((a) => [a.radicofunctional, a.degree])).toEqual([
      ['propylamine', 1],
      ['isopropylamine', 1],
      ['ethylmethylamine', 2],
      ['trimethylamine', 3],
    ]);
    expect([1, 2, 3, 4].map((n) => amineIsomers(n).length)).toEqual([1, 2, 4, 8]);
    for (const n of [1, 2, 3, 4])
      for (const a of amineIsomers(n)) {
        expect(a.formula, a.condensed).toBe(`C${n === 1 ? '' : n}H${2 * n + 3}N`);
        expect(a.M).toBeCloseTo(molarMass(a.formula), 9);
        expect(count(a.smiles, 'C'), a.smiles).toBe(n);
      }
  });

  it('Bảng 8.1 as printed; aniline boils highest', () => {
    expect(AMINE_TABLE).toHaveLength(7);
    for (const a of AMINE_TABLE) expect(a.mp_C).toBeLessThan(a.bp_C);
    expect(AMINE_TABLE.find((a) => a.name === 'aniline')?.bp_C).toBe(
      Math.max(...AMINE_TABLE.map((a) => a.bp_C)),
    );
  });
});

describe('amino acids and peptides (HH12 Bài 9)', () => {
  it('Bảng 9.1: names and symbols as printed', () => {
    expect(AMINO_ACIDS.map((a) => [a.id, a.common])).toEqual([
      ['Gly', 'glycine'],
      ['Ala', 'alanine'],
      ['Lys', 'lysine'],
      ['Glu', 'glutamic acid'],
      ['Val', 'valine'],
    ]);
    for (const a of AMINO_ACIDS) {
      expect(count(a.smiles, 'C'), a.id).toBe(Number(/C(\d+)/.exec(a.formula)?.[1]));
    }
  });

  it('glycine in an electric field (tr. 43): to the cathode below pH 6, still near 6, to the anode above', () => {
    expect(glycineMigration(3)).toBe('cathode');
    expect(glycineMigration(6)).toBe('none');
    expect(glycineMigration(10)).toBe('anode');
  });

  it('Val-Gly-Ala (Hình 9.2): a tripeptide with two peptide bonds, biuret positive', () => {
    const p = peptide(['Val', 'Gly', 'Ala']);
    expect(p).toMatchObject({ name: 'Val-Gly-Ala', kind: 'tripeptide', bonds: 2, biuret: true });
    expect(p.formula).toBe('C10H19N3O4');
    expect(p.M).toBeCloseTo(molarMass('C10H19N3O4'), 9);
    const smiles = p.smiles ?? '';
    expect([count(smiles, 'C'), count(smiles, 'N'), count(smiles, 'O')]).toEqual([10, 3, 4]);
    expect(peptide(['Gly', 'Gly'])).toMatchObject({ kind: 'dipeptide', biuret: false });
  });

  it('partial hydrolysis of Gly-Tyr-Val-Ala gives the book’s tripeptides and dipeptides (tr. 44)', () => {
    expect(fragments(['Gly', 'Tyr', 'Val', 'Ala']).map((f) => f.join('-'))).toEqual([
      'Gly-Tyr-Val',
      'Tyr-Val-Ala',
      'Gly-Tyr',
      'Tyr-Val',
      'Val-Ala',
    ]);
    // Tyr's structure is not in Bảng 9.1: no formula is made up for it.
    expect(peptide(['Gly', 'Tyr', 'Val', 'Ala']).formula).toBeNull();
  });
});
