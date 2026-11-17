import { describe, expect, it } from 'vitest';
import {
  COMPLEXES,
  SUBSTITUTIONS,
  chargeSum,
  complex,
  complexModel,
  complexText,
  computedCharge,
  coordination,
  metalText,
  substitutionBalanced,
  substitutionText,
} from './model';

describe('complexes of Bài 28–29', () => {
  it('writes the book’s formulas', () => {
    expect(complexText(complex('co_nh3_6_3'))).toBe('[Co(NH₃)₆]³⁺');
    expect(complexText(complex('zn_oh_4'))).toBe('[Zn(OH)₄]²⁻');
    expect(complexText(complex('fe_co_5'))).toBe('[Fe(CO)₅]');
    expect(complexText(complex('cisplatin'))).toBe('[PtCl₂(NH₃)₂]');
    expect(complexText(complex('ptcl3_nh3'))).toBe('[PtCl₃(NH₃)]⁻');
    expect(complexText(complex('co_f_6'))).toBe('[CoF₆]³⁻');
  });

  it('every charge is the central atom’s plus the ligands’ (question 1 tr. 134)', () => {
    for (const c of COMPLEXES) expect(computedCharge(c), c.id).toBe(c.charge);
    expect(chargeSum(complex('co_nh3_6_3'))).toBe('(+3) + 6 × (0) = +3');
    expect(chargeSum(complex('co_f_6'))).toBe('(+3) + 6 × (−1) = −3');
    expect(metalText(complex('fe_co_5'))).toBe('Fe');
    expect(metalText(complex('ag_nh3_2'))).toBe('Ag⁺');
  });

  it('question 1: coordination numbers', () => {
    expect(coordination(complex('cu_h2o_6'))).toBe(6);
    expect(coordination(complex('ni_co_4'))).toBe(4);
    expect(coordination(complex('cisplatin'))).toBe(4);
    expect(coordination(complex('fe_co_5'))).toBe(5);
  });

  it('draws only the geometries the book states, on Bảng 28.1’s directions', () => {
    const oct = complexModel(complex('cu_h2o_6'));
    expect(oct?.atoms).toHaveLength(7);
    expect(oct?.atoms.slice(1).every((a) => a.el === 'O')).toBe(true);
    const cis = complexModel(complex('cisplatin'));
    expect(cis?.atoms.map((a) => a.el)).toEqual(['Pt', 'Cl', 'Cl', 'N', 'N']);
    // cis: the two Cl at 90°; every ligand at the same distance (a rigid turn keeps the shape).
    const [, a, b] = cis?.atoms ?? [];
    const dot = (p?: readonly number[], q?: readonly number[]) =>
      (p?.[0] ?? 0) * (q?.[0] ?? 0) + (p?.[1] ?? 0) * (q?.[1] ?? 0) + (p?.[2] ?? 0) * (q?.[2] ?? 0);
    expect(dot(a?.xyz, b?.xyz)).toBeCloseTo(0, 12);
    for (const at of oct?.atoms.slice(1) ?? [])
      expect(Math.sqrt(dot(at.xyz, at.xyz))).toBeCloseTo(2, 12);
    expect(complexModel(complex('ni_co_4'))).toBeNull();
    expect(complexModel(complex('fe_co_5'))).toBeNull();
  });

  it('ligand substitutions (tr. 140) keep the charge', () => {
    expect(SUBSTITUTIONS).toHaveLength(4);
    for (const s of SUBSTITUTIONS) expect(substitutionBalanced(s), s.id).toBe(true);
    const fe = SUBSTITUTIONS.find((s) => s.id === 'fe');
    if (!fe) throw new Error('no fe');
    expect(substitutionText(fe)).toBe('[Fe(H₂O)₆]²⁺ + 6CN⁻ → [Fe(CN)₆]⁴⁻ + 6H₂O');
  });
});
