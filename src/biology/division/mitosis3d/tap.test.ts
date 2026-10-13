import { describe, expect, it } from 'vitest';
import { createTapTracker, tapTolerance, type PointerLike } from './tap';

const p = (
  pointerId: number,
  pointerType: string,
  clientX: number,
  clientY = 100,
): PointerLike => ({
  pointerId,
  pointerType,
  clientX,
  clientY,
});

describe('tap or drag on the 3D view', () => {
  it('a finger may wobble more than a mouse', () => {
    expect(tapTolerance('touch')).toBe(10);
    expect(tapTolerance('pen')).toBe(6);
    expect(tapTolerance('mouse')).toBe(4);
    expect(tapTolerance('')).toBe(4);
  });

  it('a touch tap that moves 6 px selects; a 20 px drag does not', () => {
    const tap = createTapTracker();
    tap.down(p(1, 'touch', 100));
    expect(tap.up(p(1, 'touch', 106))).toBe(true);
    tap.down(p(2, 'touch', 100));
    expect(tap.up(p(2, 'touch', 120))).toBe(false);
  });

  it('the mouse keeps its small tolerance', () => {
    const tap = createTapTracker();
    tap.down(p(1, 'mouse', 100));
    expect(tap.up(p(1, 'mouse', 104))).toBe(true);
    tap.down(p(1, 'mouse', 100));
    expect(tap.up(p(1, 'mouse', 106))).toBe(false);
  });

  it('a two-finger pinch never selects, whichever finger lifts first', () => {
    for (const first of [1, 2]) {
      const tap = createTapTracker();
      tap.down(p(1, 'touch', 100));
      tap.down(p(2, 'touch', 200));
      // Neither finger moved: still a pinch, not a tap.
      expect(tap.up(p(first, 'touch', first === 1 ? 100 : 200))).toBe(false);
      expect(tap.up(p(first === 1 ? 2 : 1, 'touch', first === 1 ? 200 : 100))).toBe(false);
      // The next single tap works again.
      tap.down(p(3, 'touch', 50));
      expect(tap.up(p(3, 'touch', 52))).toBe(true);
    }
  });

  it('a second finger landing while the first is down is tracked by pointer id', () => {
    const tap = createTapTracker();
    tap.down(p(1, 'touch', 100));
    tap.down(p(2, 'touch', 300));
    // The first finger's up is compared with its own start, not with the second finger's.
    expect(tap.up(p(1, 'touch', 100))).toBe(false);
    expect(tap.up(p(2, 'touch', 300))).toBe(false);
  });

  it('an up without a down, or after a cancel, is not a tap', () => {
    const tap = createTapTracker();
    expect(tap.up(p(7, 'touch', 10))).toBe(false);
    tap.down(p(8, 'touch', 10));
    tap.cancel(p(8, 'touch', 10));
    expect(tap.up(p(8, 'touch', 10))).toBe(false);
  });
});
