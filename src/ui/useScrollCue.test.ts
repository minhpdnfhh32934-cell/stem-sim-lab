import { describe, expect, it } from 'vitest';
import { moreBelow } from './useScrollCue';

const box = (scrollTop: number, clientHeight: number, scrollHeight: number) =>
  ({ scrollTop, clientHeight, scrollHeight }) as HTMLElement;

describe('scroll cue (UI-09, UI-10)', () => {
  it('shows while content is hidden below, not at the end or when everything fits', () => {
    expect(moreBelow(box(0, 150, 400))).toBe(true);
    expect(moreBelow(box(240, 150, 400))).toBe(true);
    expect(moreBelow(box(250, 150, 400))).toBe(false);
    expect(moreBelow(box(0, 150, 150))).toBe(false);
    // Sub-pixel rounding at the end does not keep the cue.
    expect(moreBelow(box(249, 150, 400.5))).toBe(false);
  });
});
