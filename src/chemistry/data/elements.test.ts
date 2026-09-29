import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  aufbauPrediction,
  configString,
  electronsPerShell,
  elementBySymbol,
  energyOrder,
  hundBoxes,
  isAufbauException,
  shellOrder,
  shorthand,
  unpairedElectrons,
} from './elements';

const el = (s: string) => {
  const e = elementBySymbol(s);
  if (!e) throw new Error(s);
  return e;
};

describe('element dataset', () => {
  it('has 118 elements in order, each electron count = Z', () => {
    expect(ELEMENTS).toHaveLength(118);
    ELEMENTS.forEach((e, i) => {
      expect(e.z).toBe(i + 1);
      expect(e.configuration.reduce((s, [, , k]) => s + k, 0)).toBe(e.z);
    });
  });

  it('every item carries a review status (generated data starts as pending)', () => {
    const statuses = new Set(ELEMENTS.map((e) => e.review_status as string));
    expect([...statuses].every((s) => s === 'pending' || s === 'verified')).toBe(true);
  });

  it('electron configurations come from the table, including Aufbau exceptions', () => {
    // §2.2: Cr, Cu, Mo, Ag... must NOT follow the Madelung rule.
    for (const s of ['Cr', 'Cu', 'Mo', 'Ag', 'Au', 'Pd'])
      expect(isAufbauException(el(s))).toBe(true);
    for (const s of ['H', 'C', 'Fe', 'Zn', 'Br', 'Ca'])
      expect(isAufbauException(el(s))).toBe(false);
    expect(configString(shellOrder(el('Cr').configuration))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s¹');
    expect(shorthand(el('Cu'))).toBe('[Ar] 3d¹⁰ 4s¹');
    expect(shorthand(el('Pd'))).toBe('[Kr] 4d¹⁰');
    expect(shorthand(el('Fe'))).toBe('[Ar] 3d⁶ 4s²');
    expect(configString(energyOrder(el('Fe').configuration))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
  });

  it('Aufbau prediction is correct where no exception exists', () => {
    expect(configString(shellOrder(aufbauPrediction(26)))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²');
  });

  it('electrons per shell and unpaired electrons (Hund)', () => {
    expect(electronsPerShell(el('Cl'))).toEqual([2, 8, 7]);
    expect(electronsPerShell(el('Fe'))).toEqual([2, 8, 14, 2]);
    expect(unpairedElectrons(el('O'))).toBe(2);
    expect(unpairedElectrons(el('N'))).toBe(3);
    expect(unpairedElectrons(el('Cr'))).toBe(6);
    expect(unpairedElectrons(el('Fe'))).toBe(4);
    expect(hundBoxes('p', 4)).toEqual([2, 1, 1]);
    expect(hundBoxes('d', 6)).toEqual([2, 1, 1, 1, 1]);
  });

  it('positions: La/Ac in group 3, lanthanides/actinides without a group', () => {
    expect(el('La').group).toBe(3);
    expect(el('Ce').group).toBeNull();
    expect(el('Lu').block).toBe('f');
    expect(el('Tc').mass_number_only).toBe(true);
    expect(el('U').mass_number_only).toBe(false);
  });
});
