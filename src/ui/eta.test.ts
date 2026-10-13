import { describe, expect, it } from 'vitest';
import { createEtaTracker, etaSeconds, roundEta } from './eta';

describe('download time estimate', () => {
  it('uses the recent speed', () => {
    // 10 MB/s over the last 4 s, 100 MB left → 10 s.
    const samples = [0, 1, 2, 3, 4].map((s) => ({ t: s * 1000, loaded: s * 10e6 }));
    expect(etaSeconds(samples, 140e6)).toBeCloseTo(10);
  });

  it('ignores samples older than the window (a slow start does not count)', () => {
    const samples = [
      { t: 0, loaded: 0 },
      { t: 20_000, loaded: 1e6 },
      { t: 22_000, loaded: 21e6 },
      { t: 24_000, loaded: 41e6 },
    ];
    expect(etaSeconds(samples, 141e6)).toBeCloseTo(10);
  });

  it('says nothing without enough history, a total or progress', () => {
    expect(etaSeconds([{ t: 0, loaded: 0 }], 100)).toBeNull();
    expect(
      etaSeconds(
        [
          { t: 0, loaded: 0 },
          { t: 500, loaded: 50 },
        ],
        100,
      ),
    ).toBeNull();
    expect(
      etaSeconds(
        [
          { t: 0, loaded: 0 },
          { t: 5000, loaded: 50 },
        ],
        null,
      ),
    ).toBeNull();
    expect(
      etaSeconds(
        [
          { t: 0, loaded: 10 },
          { t: 5000, loaded: 10 },
        ],
        100,
      ),
    ).toBeNull();
  });

  it('rounds for reading', () => {
    expect(roundEta(2)).toEqual({ unit: 'seconds', n: 5 });
    expect(roundEta(23)).toEqual({ unit: 'seconds', n: 25 });
    expect(roundEta(70)).toEqual({ unit: 'minutes', n: 1 });
    expect(roundEta(200)).toEqual({ unit: 'minutes', n: 3 });
  });
});

describe('createEtaTracker', () => {
  it('builds the estimate from progress callbacks', () => {
    let clock = 0;
    const track = createEtaTracker(() => clock);
    expect(track(0, 100e6)).toBeNull();
    clock = 1000;
    expect(track(10e6, 100e6)).toBeNull();
    clock = 3000;
    // 30 MB in 3 s → 10 MB/s, 70 MB left → 7 s.
    expect(track(30e6, 100e6)).toBeCloseTo(7);
  });
});
