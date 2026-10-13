import { describe, expect, it } from 'vitest';
import { indicatorBox } from './slidingIndicator';

describe('sliding selection indicator', () => {
  it('places the pill on the checked item, relative to its control', () => {
    expect(
      indicatorBox({ left: 100, top: 40 }, { left: 162, top: 43, width: 80, height: 30 }),
    ).toEqual({ x: 62, y: 3, w: 80, h: 30 });
  });

  it('accounts for a scrolled control (long tab lists)', () => {
    expect(
      indicatorBox(
        { left: 0, top: 0 },
        { left: 20, top: 0, width: 50, height: 32 },
        { left: 120, top: 0 },
      ),
    ).toEqual({ x: 140, y: 0, w: 50, h: 32 });
  });
});
