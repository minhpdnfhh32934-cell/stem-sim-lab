import { describe, expect, it } from 'vitest';
import { measureSegment } from './measure';

describe('ruler and protractor', () => {
  it('without a stretch: plain length and angle (every scene but the stretched one)', () => {
    const m = measureSegment({ x: 1, y: 1 }, { x: 4, y: 5 });
    expect(m.length).toBe(5);
    expect(m.angle).toBeCloseTo(Math.atan2(4, 3), 15);
  });

  it('a vertical stretch S is undone: a drawn 0,1 m rise with S = 10 measures 1 cm', () => {
    const m = measureSegment({ x: 0.2, y: 0 }, { x: 0.2, y: 0.1 }, 10);
    expect(m.length).toBeCloseTo(0.01, 15);
    expect(m.angle).toBeCloseTo(Math.PI / 2, 15);
    expect(measureSegment({ x: 0, y: 0 }, { x: 1, y: 1 }, 10).angle).toBeCloseTo(
      Math.atan(0.1),
      15,
    );
  });
});
