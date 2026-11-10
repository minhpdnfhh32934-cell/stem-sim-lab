import { describe, expect, it } from 'vitest';
import { coordination, countInCell, countTerms, packingFraction, unitCell } from './lattice';

describe('unit cells counted by geometry (#54 item 8)', () => {
  it('particles inside one cell: BCC 2, FCC 4, HCP 6, NaCl 4 Na⁺ + 4 Cl⁻', () => {
    expect(countInCell(unitCell('bcc')).M).toBeCloseTo(2, 12);
    expect(countInCell(unitCell('fcc')).M).toBeCloseTo(4, 12);
    expect(countInCell(unitCell('hcp')).M).toBeCloseTo(6, 12);
    const nacl = countInCell(unitCell('nacl'));
    expect(nacl.Na).toBeCloseTo(4, 12);
    expect(nacl.Cl).toBeCloseTo(4, 12);
  });

  it('the count is written the textbook way (8 × 1/8 + 1; 12 × 1/6 + 2 × 1/2 + 3)', () => {
    expect(countTerms(unitCell('bcc'))).toEqual([
      { kind: 'M', share: 0.125, sites: 8 },
      { kind: 'M', share: 1, sites: 1 },
    ]);
    const hcp = countTerms(unitCell('hcp'));
    expect(hcp.map((t) => t.sites)).toEqual([12, 2, 3]);
    expect(hcp[0]?.share).toBeCloseTo(1 / 6, 12);
    expect(countTerms(unitCell('nacl'))).toEqual([
      { kind: 'Cl', share: 0.125, sites: 8 },
      { kind: 'Cl', share: 0.5, sites: 6 },
      { kind: 'Na', share: 0.25, sites: 12 },
      { kind: 'Na', share: 1, sites: 1 },
    ]);
  });

  it('nearest neighbours: BCC 8, FCC 12, HCP 12, NaCl 6 : 6 of the other ion', () => {
    expect(coordination('bcc', 'M')).toMatchObject({ n: 8, of: ['M'] });
    expect(coordination('fcc', 'M')).toMatchObject({ n: 12, of: ['M'] });
    expect(coordination('hcp', 'M')).toMatchObject({ n: 12, of: ['M'] });
    expect(coordination('nacl', 'Na')).toMatchObject({ n: 6, of: ['Cl'] });
    expect(coordination('nacl', 'Cl')).toMatchObject({ n: 6, of: ['Na'] });
    // Distances in units of a: half the body diagonal, half the face diagonal, a, a/2.
    expect(coordination('bcc', 'M').d).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(coordination('fcc', 'M').d).toBeCloseTo(Math.SQRT2 / 2, 12);
    expect(coordination('hcp', 'M').d).toBeCloseTo(1, 12);
    expect(coordination('nacl', 'Na').d).toBeCloseTo(0.5, 12);
  });

  it('packing fractions agree with the closed forms π√3/8 and π/(3√2)', () => {
    expect(packingFraction('bcc')).toBeCloseTo((Math.PI * Math.sqrt(3)) / 8, 12);
    expect(packingFraction('fcc')).toBeCloseTo(Math.PI / (3 * Math.SQRT2), 12);
    expect(packingFraction('hcp')).toBeCloseTo(Math.PI / (3 * Math.SQRT2), 12);
    expect(packingFraction('nacl')).toBeNull();
  });

  it('draws 12 cube edges, 18 prism edges', () => {
    expect(unitCell('fcc').edges).toHaveLength(12);
    expect(unitCell('hcp').edges).toHaveLength(18);
  });
});
