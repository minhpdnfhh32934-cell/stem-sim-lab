import { describe, expect, it } from 'vitest';
import { STARSHIP_PROPS } from './starship';

const SIZE = [2.6, 2.95, 0.4] as const; // the frame's item box
const OPENING_HALF = 1; // the opening 2 m wide
const OPENING_TOP = 2.6; // and 2.6 m high, from the floor

describe('the starship door frame (Phase U)', () => {
  it('has no face in the plane of a wall face round its opening (Phú: it flickered)', () => {
    const bottom = -SIZE[1] / 2;
    for (const part of STARSHIP_PROPS['starship-frame'](SIZE)) {
      const position = part.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        expect(Math.abs(Math.abs(x) - OPENING_HALF), `${part.finish} x`).toBeGreaterThan(0.005);
        expect(Math.abs(y - (bottom + OPENING_TOP)), `${part.finish} y`).toBeGreaterThan(0.005);
      }
    }
  });
});
