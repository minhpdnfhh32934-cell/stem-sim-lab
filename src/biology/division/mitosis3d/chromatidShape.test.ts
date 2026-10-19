import { describe, expect, it } from 'vitest';
import { ChromosomeTube, rodRadius } from '../../view3d/primitives/chromosomeTube';
import {
  THREAD_RADIUS,
  condensedShare,
  threadSamples,
  tubeProfile,
  writeCentreline,
  type CentrelineInput,
} from './chromatidShape';
import { ROD_RADIUS, SISTER_OFFSET, buildTimeline, type Vec3 } from './timeline';

const tl = buildTimeline(2, 'animal');
const info = tl.chromatids[0]!;
const tube = new ChromosomeTube({
  armA: info.armA,
  armB: info.armB,
  radius: ROD_RADIUS,
  sides: 8,
});
const n = tube.rings;
const thread = threadSamples(info, tube.stations);
const profile = tubeProfile(info, tube.stations);

function line(o: Partial<CentrelineInput>) {
  const input: CentrelineInput = {
    centromere: [1, 2, 3],
    dirA: [0, 1, 0],
    dirB: [0, -1, 0],
    thread,
    profile,
    threadScale: 0.75,
    m: 1,
    towardSister: [1, 0, 0],
    pinch: 0,
    ...o,
  };
  const centre = new Float32Array(n * 3);
  const radii = new Float32Array(n);
  writeCentreline(info, tube.stations, input, centre, radii);
  return { centre, radii, input };
}

const point = (a: Float32Array, i: number): Vec3 => [a[3 * i]!, a[3 * i + 1]!, a[3 * i + 2]!];

describe('chromatid centreline (thread ↔ rod in place)', () => {
  it('condensation 0: the line is the chromatin thread around the centromere', () => {
    expect(condensedShare(0)).toBe(0);
    const { centre, radii, input } = line({ m: 0 });
    for (let i = 0; i < n; i++) {
      const p = point(centre, i);
      for (let k = 0; k < 3; k++)
        expect(p[k]).toBeCloseTo(input.centromere[k]! + thread[3 * i + k]! * 0.75, 5);
      // A thin thread with rounded tips and no waist.
      expect(radii[i]).toBeLessThanOrEqual(THREAD_RADIUS + 1e-6);
    }
    expect(radii[tube.centromereRing]).toBeCloseTo(THREAD_RADIUS, 5);
  });

  it('condensation 1: the line is the rod — arm A along dirA, arm B along dirB', () => {
    expect(condensedShare(1)).toBe(1);
    const { centre, radii } = line({ m: 1 });
    for (let i = 0; i < n; i++) {
      const s = tube.stations[i]!;
      const p = point(centre, i);
      if (Math.abs(s) >= 0.25) {
        // Both arms lie on the y axis here (dirA up, dirB down).
        expect(p[0]).toBeCloseTo(1, 5);
        expect(p[1]).toBeCloseTo(2 - s, 5);
        expect(p[2]).toBeCloseTo(3, 5);
      }
      expect(radii[i]).toBeCloseTo(rodRadius(s, info.armA, info.armB, ROD_RADIUS, 1), 5);
    }
    // The tips are the model's arm lengths from the centromere.
    expect(point(centre, 0)[1]).toBeCloseTo(2 + info.armA, 5);
    expect(point(centre, n - 1)[1]).toBeCloseTo(2 - info.armB, 5);
  });

  it('joined sisters touch at the centromere (their waists meet halfway)', () => {
    const c = tube.centromereRing;
    const self = line({ centromere: [-SISTER_OFFSET, 0, 0], towardSister: [1, 0, 0], pinch: 1 });
    const other = line({ centromere: [SISTER_OFFSET, 0, 0], towardSister: [-1, 0, 0], pinch: 1 });
    const gap = point(other.centre, c)[0] - point(self.centre, c)[0];
    expect(gap).toBeCloseTo(self.radii[c]! + other.radii[c]!, 5);
    // Away from the centromere the arms keep their places.
    expect(point(self.centre, 0)[0]).toBeCloseTo(-SISTER_OFFSET, 5);
  });
});
