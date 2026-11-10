import { describe, expect, it } from 'vitest';
import raw from '@data/cell_dna_zoom.json';
import { B_DNA } from '../../central/dogma3d/bdna';
import {
  CORE_RADIUS_NM,
  DRAWN,
  LEVELS,
  LEVEL_FACTS,
  SIZE,
  SIZES,
  WRAP_RADIUS_NM,
  levelInfo,
  scaleBarNm,
  sourceOf,
  zoomSpot,
} from './levels';

describe('cell → DNA zoom data', () => {
  it('reads the printed textbook numbers (SGK Sinh học 10 / 12 KNTT)', () => {
    // Oracle: the printed pages (DATA_REVIEW DNAZ-1 … 5), not the code under test.
    expect(SIZE.cellMinNm).toBe(10_000);
    expect(SIZE.cellMaxNm).toBe(100_000);
    expect(SIZE.nucleusNm).toBe(5000);
    expect(SIZE.chromatidNm).toBe(700);
    expect(SIZE.fibreNm).toBe(10);
    expect([SIZE.histones, SIZE.histoneKinds, SIZE.nucleosomeBp]).toEqual([8, 4, 146]);
    expect(SIZES.nucleusUm.pages).toEqual([49]);
    expect(SIZES.chromatidNm.pages).toEqual([37]);
    expect(SIZES.nucleosomeBp.pages).toEqual([36]);
  });

  it('every size is pending, sourced and on a printed page (textbooks)', () => {
    for (const [key, item] of Object.entries(SIZES)) {
      expect(item.review_status, key).toBe('pending');
      expect(sourceOf(key as keyof typeof SIZES).citation.length, key).toBeGreaterThan(10);
      if (item.source.startsWith('sgk')) expect(item.pages.length, key).toBeGreaterThan(0);
    }
    expect(raw.generated_by).toBe('scripts/data/gen_cell_dna_zoom.py');
  });

  it('uses the B-DNA constant of the DNA lessons, and the textbook prints the same width', () => {
    expect(SIZE.dnaNm).toBe(B_DNA.diameterNm);
    expect(SIZES.dnaWidthNm.value).toBe(B_DNA.diameterNm);
  });

  it('draws the cell inside the textbook range and the nucleus bead from the 10 nm and 2 nm', () => {
    expect(DRAWN.cellNm).toBeGreaterThanOrEqual(SIZE.cellMinNm);
    expect(DRAWN.cellNm).toBeLessThanOrEqual(SIZE.cellMaxNm);
    expect(DRAWN.cellNm).toBeGreaterThan(SIZE.nucleusNm);
    expect(2 * WRAP_RADIUS_NM + SIZE.dnaNm).toBeCloseTo(SIZE.fibreNm, 12);
    expect(CORE_RADIUS_NM).toBeGreaterThan(0);
  });
});

describe('levels and scale bars', () => {
  it('has six levels, each smaller than the one before', () => {
    expect(LEVELS).toHaveLength(6);
    const fields = LEVELS.map((_, i) => levelInfo(i).fieldNm);
    for (let i = 1; i < fields.length; i++)
      expect(fields[i], LEVELS[i]).toBeLessThan(fields[i - 1] ?? 0);
  });

  it('a scale bar is 1, 2 or 5 × 10ᵏ nm, at most a quarter of the picture and over a tenth', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const { fieldNm, barNm } = levelInfo(i);
      const mant = barNm / 10 ** Math.floor(Math.log10(barNm) + 1e-9);
      expect(
        [1, 2, 5].some((m) => Math.abs(mant - m) < 1e-9),
        `${barNm}`,
      ).toBe(true);
      expect(barNm).toBeLessThanOrEqual(fieldNm / 4 + 1e-9);
      expect(barNm).toBeGreaterThan(fieldNm / 40);
    }
  });

  it('scale bars of the six levels (hand-checked: ¼ of each field rounded down to 1-2-5)', () => {
    expect(LEVELS.map((_, i) => levelInfo(i).barNm)).toEqual([5000, 1000, 500, 100, 10, 1]);
    expect(scaleBarNm(1000)).toBe(200);
    expect(scaleBarNm(399)).toBe(50);
  });

  it('clamps an index from a file to the six levels', () => {
    expect(levelInfo(-3).id).toBe('cell');
    expect(levelInfo(99).id).toBe('dna');
    expect(levelInfo(2.4).id).toBe('chromosome');
  });

  it('every level but the last zooms into a spot inside its own picture', () => {
    LEVELS.forEach((id, i) => {
      const spot = zoomSpot(id);
      if (id === 'dna') {
        expect(spot).toBeNull();
        return;
      }
      expect(spot).not.toBeNull();
      const { fieldNm } = levelInfo(i);
      const [x, y, z] = spot?.center ?? [0, 0, 0];
      expect(Math.hypot(x, y, z) + (spot?.radiusNm ?? 0)).toBeLessThanOrEqual(fieldNm);
      // The next level is a real enlargement of the spot.
      expect(spot?.radiusNm ?? 0).toBeLessThan(fieldNm / 2);
    });
  });

  it('every level shows at least one printed size', () => {
    for (const id of LEVELS) expect(LEVEL_FACTS[id].length).toBeGreaterThan(0);
  });
});
