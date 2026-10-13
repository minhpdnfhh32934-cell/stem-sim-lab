import { describe, expect, it } from 'vitest';
import type { ParamDef } from '@/physics/types';
import { changedParams, recordedTracks } from './compare';

const def = (key: string): ParamDef => ({
  key,
  label: { vi: key, en: key },
  symbol: key,
  kind: 'number',
});

describe('before / after compare', () => {
  it('copies the recorded trail, ending on the last state', () => {
    const states = Array.from({ length: 1301 }, (_, i) => Float64Array.of(i, 2 * i));
    const tracks = recordedTracks(
      { states, length: states.length },
      {
        trail: (s) => [{ x: s[0] ?? 0, y: s[1] ?? 0 }],
      },
      {},
    );
    expect(tracks).toHaveLength(1);
    const track = tracks[0] ?? [];
    expect(track.length).toBeLessThanOrEqual(601);
    expect(track[0]).toEqual({ x: 0, y: 0 });
    expect(track.at(-1)).toEqual({ x: 1300, y: 2600 });
  });

  it('has nothing to copy for a scene without a trail', () => {
    expect(recordedTracks({ states: [Float64Array.of(1)], length: 1 }, {}, {})).toEqual([]);
  });

  it('lists only the parameters that changed', () => {
    const defs = [def('v0'), def('angle'), def('g')];
    const changed = changedParams(
      defs,
      { v0: 20, angle: 0.785, g: 9.81 },
      {
        v0: 25,
        angle: 0.785,
        g: 9.81,
      },
    );
    expect(changed.map((d) => d.key)).toEqual(['v0']);
  });
});
