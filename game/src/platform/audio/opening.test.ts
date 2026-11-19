import { describe, expect, it } from 'vitest';
import { OPENING } from './opening';

const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);
const pitchClass = (hz: number) => (((Math.round(12 * Math.log2(hz / 440)) + 69) % 12) + 12) % 12;

describe('the opening sound', () => {
  it('is in the menu music key, D major', () => {
    for (const part of OPENING) {
      if (part.kind === 'air') continue;
      const notes = 'hz' in part ? [part.hz] : [part.lowHz, part.highHz];
      for (const hz of notes) expect(D_MAJOR.has(pitchClass(hz)), `${hz} Hz`).toBe(true);
    }
  });

  it('never adds up past full scale at full volume', () => {
    for (let t = 0; t < 7; t += 0.01) {
      let sum = 0;
      for (const part of OPENING) {
        if (part.kind === 'bell') {
          // Struck, then dying away exponentially to 1e-4 over its ring.
          const into = (t - part.at) / part.ring;
          if (into >= 0 && into < 1) sum += part.peak * 1e-4 ** into;
        } else if (part.at <= t && t < part.end) sum += part.peak;
      }
      expect(sum, `at ${t.toFixed(2)} s`).toBeLessThan(1);
    }
  });

  it('has every sweep and held voice end after it starts', () => {
    for (const part of OPENING) {
      if (part.kind !== 'bell') expect(part.end).toBeGreaterThan(part.at + 0.5);
    }
  });
});
