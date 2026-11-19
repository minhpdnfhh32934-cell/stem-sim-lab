import { describe, expect, it } from 'vitest';
import elements from '../../content/elements.json';
import { cellCentre, cellSize, elementAt, placeOf, TILE_SHARE } from './layout';

const BOARD = [4.4, 2.6] as const; // the hub's display (core-items.json)

describe('the periodic table display’s layout', () => {
  it('puts every element in its group and period (the f block in its two rows under the table)', () => {
    for (const e of elements.elements) {
      const { column, row } = placeOf(e.z);
      if (e.group === null) {
        expect([e.symbol, row]).toEqual([e.symbol, e.period === 6 ? 7.5 : 8.5]);
      } else {
        expect([e.symbol, column, row]).toEqual([e.symbol, e.group - 1, e.period - 1]);
      }
    }
  });

  it('reads each tile’s element back at its centre and near its edge, none in a gap', () => {
    const unit = cellSize(...BOARD);
    const edge = (TILE_SHARE * unit) / 2 - 0.002;
    for (let z = 1; z <= 118; z++) {
      const [x, y] = cellCentre(placeOf(z), unit);
      expect(elementAt(x, y, ...BOARD)).toBe(z);
      expect(elementAt(x + edge, y - edge, ...BOARD)).toBe(z);
      // Between two tiles.
      expect(elementAt(x + unit / 2, y, ...BOARD)).toBeNull();
    }
    // The gaps: over the d block in periods 1–3, group 3 of periods 6 and 7, the f rows' ends.
    for (const place of [
      { column: 5, row: 1 },
      { column: 2, row: 5 },
      { column: 2, row: 6 },
      { column: 0, row: 7.5 },
      { column: 17, row: 8.5 },
    ]) {
      const [x, y] = cellCentre(place, unit);
      expect(elementAt(x, y, ...BOARD)).toBeNull();
    }
    expect(elementAt(3, 0, ...BOARD)).toBeNull(); // off the board
  });
});
