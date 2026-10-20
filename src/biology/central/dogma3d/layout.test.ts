import { describe, expect, it } from 'vitest';
import { TWIST } from './bdna';
import { dogmaClock, dogmaModel3d, momentAt } from './binding';
import {
  CONTEXT,
  dnaPlace,
  dnaPose,
  nucleotidePose,
  placeDna,
  recede,
  rigidSpan,
  strandPose,
  type DnaPlace,
  type RigidSpan,
  type Vec3,
} from './layout';

const m = dogmaModel3d(`ATG${'GCTAAAGGC'.repeat(6)}TAA`);
const c = dogmaClock(m);

/** `p` turned by `a` about the x axis. */
const turn = (p: Vec3, a: number): Vec3 => [
  p[0],
  p[1] * Math.cos(a) - p[2] * Math.sin(a),
  p[1] * Math.sin(a) + p[2] * Math.cos(a),
];

describe('dogma 3D layout: the rigid stretches of the helix', () => {
  it('pairs outside the bubble sit where the resting helix, turned as one piece, puts them', () => {
    const span: RigidSpan = { left: 0, right: 0, leftTurn: 0, rightTurn: 0 };
    const back: Vec3 = [0, 0, 0];
    const tip: Vec3 = [0, 0, 0];
    const rest: Vec3 = [0, 0, 0];
    const restTip: Vec3 = [0, 0, 0];
    for (const f of [0.05, 0.3, 0.6, 0.97]) {
      const mo = momentAt(c, f * c.total);
      rigidSpan(mo, span);
      for (let i = 0; i < m.coding.length; i++) {
        const left = i <= span.left;
        const right = i >= span.right;
        if (!left && !right) continue;
        for (const strand of ['coding', 'template'] as const) {
          expect(dnaPose(i, strand, mo, back, tip)).toBe(0);
          strandPose(i, strand, 0, TWIST * i, rest, restTip);
          const q = turn(rest, left ? span.leftTurn : span.rightTurn);
          for (let k = 0; k < 3; k++) expect(back[k]).toBeCloseTo(q[k] ?? 0, 9);
        }
      }
    }
  });

  it('without a bubble the whole helix is one piece', () => {
    const span: RigidSpan = { left: 0, right: 0, leftTurn: 0, rightTurn: 0 };
    rigidSpan(momentAt(c, c.total), span);
    expect(span.left).toBe(Infinity);
    expect(span.leftTurn).toBe(span.rightTurn);
  });
});

describe('dogma 3D layout: illustration only (DNA stepping back, free nucleotides)', () => {
  it('the DNA steps back only while the ribosome works, and back to scale 1 before', () => {
    expect(recede(momentAt(c, 0))).toBe(0);
    expect(recede(momentAt(c, c.tlStart - 0.01))).toBe(0);
    expect(recede(momentAt(c, c.total))).toBe(1);
    const place: DnaPlace = { k: 1, x0: 0, dy: 0, dz: 0 };
    dnaPlace(momentAt(c, c.total), 2, place);
    expect(place.k).toBeCloseTo(CONTEXT.scale, 9);
    // The left end of the drawn stretch stays put along x.
    expect(placeDna(place, [2, 0, 0])[0]).toBeCloseTo(2, 9);
    dnaPlace(momentAt(c, 0), 2, place);
    expect(placeDna(place, [5, 1, -1])).toEqual([5, 1, -1]);
  });

  it('at most three nucleotides come in, only while transcribing; the next one arrives last', () => {
    const at: Vec3 = [0, 0, 0];
    const mo = momentAt(c, 0.4 * c.tlStart);
    expect(mo.phase).toBe('transcription');
    const d = [0, 1, 2, 3].map((k) => nucleotidePose(mo, k, at));
    expect(d[0]).toBeGreaterThan(0);
    expect(d[0]).toBeLessThanOrEqual(1);
    expect(d[1]).toBeGreaterThan(d[0] ?? 0);
    expect(d[3]).toBe(0);
    expect(nucleotidePose(momentAt(c, c.total), 0, at)).toBe(0);
  });
});
