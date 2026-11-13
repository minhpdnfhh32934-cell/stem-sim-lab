import { describe, expect, it } from 'vitest';
import type { PropPart } from './parts';
import { ROOM_PROPS } from './rooms';
import { bounds, expectProp, triangles } from './testing';

// The other rooms' props at the size their items ship (Z3 §4.2, Appendix A), and at 0.8 × that;
// then what each promises in the teacher room.

/** The rooms' props as their items carry them: prop, item shape, size, triangles a copy may draw. */
const SHIPPED = [
  ['bookshelf', 'box', [1, 1.9, 0.35], 1500], // teacher-bookshelf
  ['whiteboard', 'box', [1.6, 0.9, 0.06], 100], // whiteboard
] as const;

const finish = (parts: readonly PropPart[], name: PropPart['finish']) => {
  const found = parts.find((p) => p.finish === name);
  expect(found, name).toBeDefined();
  return found!.geometry;
};

describe('room props', () => {
  it('cover every room builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(ROOM_PROPS)));
  });

  describe.each(SHIPPED.flatMap((row) => [1, 0.8].map((scale) => [...row, scale] as const)))(
    '%s (%s %j, ≤ %d triangles) × %d',
    (prop, shape, size, budget, scale) => {
      it('is sound and inside its box', () => {
        const scaled = size.map((v) => v * scale);
        expectProp(ROOM_PROPS[prop](scaled), shape, scaled);
      });

      if (scale === 1) {
        it('stays within its triangle budget', () => {
          expect(triangles(ROOM_PROPS[prop](size))).toBeLessThanOrEqual(budget);
        });
      }
    },
  );

  it('fill the bookcase with books in three colours on its shelves, the same every time', () => {
    const [w, h, d] = [1, 1.9, 0.35];
    const parts = ROOM_PROPS.bookshelf([w, h, d]);
    expect(parts.map((p) => p.finish)).toEqual(['body', 'book-a', 'book-b', 'book-c']);
    for (const name of ['book-a', 'book-b', 'book-c'] as const) {
      const books = bounds(finish(parts, name));
      expect(books.min.y).toBeGreaterThanOrEqual(-h / 2 + 0.09 - 1e-6); // on the lowest shelf
      expect(books.max.z).toBeLessThan(d / 2); // inside the case's front
    }
    // A fixed seed: built again, every book is where it was.
    const again = ROOM_PROPS.bookshelf([w, h, d]);
    parts.forEach(({ geometry }, i) => {
      expect(again[i]?.geometry.getAttribute('position').array).toEqual(
        geometry.getAttribute('position').array,
      );
    });
  });

  it('keep the whiteboard blank, flat on the wall, its tray along the bottom', () => {
    const [w, h, d] = [1.6, 0.9, 0.06];
    const parts = ROOM_PROPS.whiteboard([w, h, d]);
    const board = finish(parts, 'body');
    expect((board.getIndex()?.count ?? 0) / 3).toBe(12); // one plain panel: nothing written
    expect(bounds(board).min.z).toBeCloseTo(-d / 2, 6);
    const steel = bounds(finish(parts, 'steel'));
    expect([steel.min.y, steel.max.y, steel.max.z]).toEqual([
      expect.closeTo(-h / 2, 6),
      expect.closeTo(h / 2, 6),
      expect.closeTo(d / 2, 6),
    ]);
  });
});
