import { describe, expect, it } from 'vitest';
import { GREENHOUSE_PROPS } from './greenhouse';

const FRAME = [2.6, 2.95, 0.4] as const; // the frame's item box (as the starship door's)
const LEAF = [1, 2.6, 0.08] as const;
const OPENING_HALF = 1; // the opening 2 m wide
const OPENING_TOP = 2.6; // and 2.6 m high, from the floor

/** Every vertex of a prop's parts, with its part's finish. */
function* vertices(size: readonly number[], prop: keyof typeof GREENHOUSE_PROPS) {
  for (const part of GREENHOUSE_PROPS[prop](size)) {
    const position = part.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      yield [part.finish, position.getX(i), position.getY(i), position.getZ(i)] as const;
    }
  }
}

describe('Biology’s greenhouse door (Phase U D2)', () => {
  it('frame: no face in the plane of a wall face round its opening (as the starship door)', () => {
    const bottom = -FRAME[1] / 2;
    for (const [finish, x, y] of vertices(FRAME, 'greenhouse-frame')) {
      expect(Math.abs(Math.abs(x) - OPENING_HALF), `${finish} x`).toBeGreaterThan(0.005);
      expect(Math.abs(y - (bottom + OPENING_TOP)), `${finish} y`).toBeGreaterThan(0.005);
    }
  });

  it('frame and leaf stay inside their item boxes (the leaf slides in the wall)', () => {
    for (const [size, prop] of [
      [FRAME, 'greenhouse-frame'],
      [LEAF, 'greenhouse-leaf'],
    ] as const) {
      for (const [finish, x, y, z] of vertices(size, prop)) {
        expect(Math.abs(x), `${prop} ${finish} x`).toBeLessThanOrEqual(size[0] / 2 + 1e-6);
        expect(Math.abs(y), `${prop} ${finish} y`).toBeLessThanOrEqual(size[1] / 2 + 1e-6);
        expect(Math.abs(z), `${prop} ${finish} z`).toBeLessThanOrEqual(size[2] / 2 + 1e-6);
      }
    }
  });

  it('leaf: clear glass with leaves etched on both faces, one body in the item’s wood', () => {
    const parts = GREENHOUSE_PROPS['greenhouse-leaf'](LEAF);
    expect(parts.filter((p) => p.finish === 'body')).toHaveLength(1);
    const etched = [...vertices(LEAF, 'greenhouse-leaf')].filter(([f]) => f === 'etched-glass');
    expect(etched.some(([, , , z]) => z > 0)).toBe(true);
    expect(etched.some(([, , , z]) => z < 0)).toBe(true);
  });
});
