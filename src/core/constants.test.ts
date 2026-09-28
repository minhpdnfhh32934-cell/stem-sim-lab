import { describe, expect, it } from 'vitest';
import { C, CONSTANTS_DATASET, constant } from './constants';

describe('physical constants (CODATA)', () => {
  it('loads the dataset with a source and review status on every item', () => {
    expect(CONSTANTS_DATASET.source.citation).toMatch(/CODATA/);
    for (const c of CONSTANTS_DATASET.items) {
      expect(['pending', 'verified']).toContain(c.review_status);
    }
  });

  it('SI-defining constants are exact', () => {
    // Values fixed by the 2019 SI redefinition (BIPM SI Brochure, 9th ed.).
    expect(constant('c').value).toBe(299792458);
    expect(constant('h').value).toBe(6.62607015e-34);
    expect(constant('e').value).toBe(1.602176634e-19);
    expect(constant('kB').value).toBe(1.380649e-23);
    expect(constant('NA').value).toBe(6.02214076e23);
    for (const id of ['c', 'h', 'e', 'kB', 'NA']) expect(constant(id).exact).toBe(true);
  });

  it('derived constants are consistent with their definitions', () => {
    expect(C.R).toBeCloseTo(C.NA * C.kB, 10);
    expect(constant('F').value).toBeCloseTo(C.NA * C.e, 6);
    expect(C.gn).toBe(9.80665);
  });

  it('throws on unknown ids', () => {
    expect(() => constant('nope')).toThrow();
  });
});
