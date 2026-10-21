import { describe, expect, it } from 'vitest';
import { dogmaClock, dogmaModel3d, momentAt } from './binding';
import { CLOSE_SHARE, FOCUS_TL_Y, dogmaFrame, zoomedCenter } from './camera';
import { LAYOUT } from './layout';

const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';

describe('3D dogma camera', () => {
  const m = dogmaModel3d(CODING);
  const c = dogmaClock(m);
  const win = { from: 0, to: CODING.length };
  const at = (phase: string) => {
    for (let k = 0; k <= 200; k++) {
      const mo = momentAt(c, (c.total * k) / 200);
      if (mo.phase === phase && (phase !== 'translation' || mo.step >= 1)) return mo;
    }
    throw new Error(`no ${phase} moment`);
  };

  it('following the ribosome, zooming in homes in on the codon, the tRNAs and the chain', () => {
    const f = dogmaFrame('follow', m, at('translation'), win);
    expect(f.focus).toBeDefined();
    const focus = f.focus!;
    // Same column as the ribosome; between the mRNA and the amino acids the tRNAs carry.
    expect(focus[0]).toBe(f.center[0]);
    expect(focus[1]).toBe(FOCUS_TL_Y);
    expect(focus[1]).toBeLessThan(LAYOUT.mrnaLineY);
    expect(focus[1]).toBeGreaterThan(LAYOUT.mrnaLineY + LAYOUT.trnaAcceptorY);
    // Inside what the frame holds, below its centre (the DNA context is above).
    const ys = f.points.map((p) => p[1] + f.center[1]);
    expect(focus[1]).toBeGreaterThan(Math.min(...ys));
    expect(focus[1]).toBeLessThan(f.center[1]);
    // As framed (or further): the centre; close: the focus; in between, on the way down.
    expect(zoomedCenter(f, 1)).toEqual(f.center);
    expect(zoomedCenter(f, 2)).toEqual(f.center);
    expect(zoomedCenter(f, CLOSE_SHARE)[1]).toBeCloseTo(focus[1], 12);
    expect(zoomedCenter(f, 0.2)[1]).toBeCloseTo(focus[1], 12);
    const mid = zoomedCenter(f, (1 + CLOSE_SHARE) / 2)[1];
    expect(mid).toBeLessThan(f.center[1]);
    expect(mid).toBeGreaterThan(focus[1]);
    expect(zoomedCenter(f, Number.NaN)).toEqual(f.center);
  });

  it('transcription and the overview keep their centre at every zoom', () => {
    for (const f of [
      dogmaFrame('follow', m, at('transcription'), win),
      dogmaFrame('overview', m, at('translation'), win),
    ]) {
      expect(f.focus).toBeUndefined();
      expect(zoomedCenter(f, 0.3)).toEqual(f.center);
    }
  });
});
