import { describe, expect, it } from 'vitest';
import type { SetupProgress } from '../../../../gameplay/experiment/StationSystem';
import type { ExperimentWorkspace } from '../../../../simulation/experiment';
import {
  BUBBLE_POOL,
  BubbleRing,
  bubbleShare,
  columnFraction,
  cylinderFraction,
  plungerFraction,
  RISE_TIME,
  RunMax,
  scaleMarks,
  slideStages,
  type SlideStages,
  unitRatio,
} from './bio-maps';

const piece = (id: string, kind: string) => ({
  id,
  kind,
  slot: 's',
  label: id,
  owns: [],
  shows: [],
});
const workspace = {
  pieces: [
    piece('slide', 'slide'),
    piece('coverslip', 'coverslip'),
    piece('stage', 'microscope-stage'),
    piece('prep', 'prep-tile'),
  ],
  materials: [
    { id: 'onion', kind: 'specimen', label: 'Onion', sets: { parameter: 'specimen', value: 0 } },
    { id: 'iodine', kind: 'stain', label: 'Iodine', sets: { parameter: 'stain', value: 1 } },
  ],
  setup: [],
} as unknown as ExperimentWorkspace;

const step = (id: string, place: string, onto: string, done: boolean): SetupProgress =>
  ({ step: { id, place, onto }, done }) as unknown as SetupProgress;

const stages = (setup: SetupProgress[]): SlideStages =>
  slideStages(setup, workspace, {
    tile: true,
    specimen: true,
    stained: true,
    covered: true,
    onStage: true,
  });

describe("the slide's stages", () => {
  it('takes a slide with no applying step as prepared and on the stage', () => {
    expect(stages([])).toEqual({
      tile: true,
      specimen: true,
      stained: true,
      covered: true,
      onStage: true,
    });
    expect(slideStages([], undefined, stages([]))).toEqual(stages([]));
  });

  it("follows the steps of onion's preparation as they are done", () => {
    const steps = (done: number) => [
      step('s1', 'slide', 'prep', done > 0),
      step('s2', 'onion', 'slide', done > 1),
      step('s3', 'iodine', 'slide', done > 2),
      step('s4', 'coverslip', 'slide', done > 3),
      step('s5', 'slide', 'stage', done > 4),
    ];
    expect(stages(steps(0))).toEqual({
      tile: false,
      specimen: false,
      stained: false,
      covered: false,
      onStage: false,
    });
    expect(stages(steps(2))).toEqual({
      tile: true,
      specimen: true,
      stained: false,
      covered: false,
      onStage: false,
    });
    expect(stages(steps(4))).toEqual({
      tile: true,
      specimen: true,
      stained: true,
      covered: true,
      onStage: false,
    });
    expect(stages(steps(5))).toEqual({
      tile: true,
      specimen: true,
      stained: true,
      covered: true,
      onStage: true,
    });
  });

  it('shows only the stages a prepared slide has steps for (a cheek slide: tile and stage)', () => {
    const cheek = [step('s1', 'slide', 'prep', true), step('s5', 'slide', 'stage', false)];
    expect(stages(cheek)).toEqual({
      tile: true,
      specimen: true,
      stained: true,
      covered: true,
      onStage: false,
    });
  });
});

describe('bubbles', () => {
  it('starts one bubble per increment of the count, at the model time of the increment', () => {
    const ring = new BubbleRing();
    ring.update(0, 0);
    ring.update(1, 1.5);
    ring.update(3, 3);
    expect(ring.born).toEqual([1.5, 3, 3]);
    expect(ring.progress(0, 2.5)).toBeCloseTo(1 / RISE_TIME, 12);
    expect(ring.progress(0, 1.5 + RISE_TIME)).toBe(-1); // gone
    expect(ring.progress(5, 3)).toBe(-1); // never was
    expect(ring.progress(1, NaN)).toBe(-1);
  });

  it('starts none for a count first seen part-way, keeps at most the pool, and empties on a reset', () => {
    const ring = new BubbleRing();
    ring.update(12, 5); // mounted mid-run
    expect(ring.born).toEqual([]);
    ring.update(40, 6);
    expect(ring.born).toHaveLength(BUBBLE_POOL);
    ring.update(0, NaN); // run reset
    expect(ring.born).toEqual([]);
    ring.update(0, 0);
    ring.update(1, 1);
    expect(ring.born).toEqual([1]);
    ring.update(0, 0); // a new run: the count fell
    expect(ring.born).toEqual([]);
  });
});

describe('quantities against the run', () => {
  it('keeps the largest value of one run only', () => {
    const max = new RunMax();
    const a = {};
    expect([2, 5, 3].map((v) => max.update(a, v))).toEqual([2, 5, 5]);
    expect(max.update({}, 1)).toBe(1); // another run
    expect(max.update(null, NaN)).toBe(0);
  });

  it("draws a share of bubbles from the rate against the run's fastest, none without a rate", () => {
    expect(bubbleShare(NaN, 1)).toBe(0);
    expect(bubbleShare(0, 1)).toBe(0);
    expect(bubbleShare(1, 0)).toBe(0);
    expect(bubbleShare(1, 1)).toBe(1);
    expect(bubbleShare(0.25, 1)).toBe(0.5);
  });

  it('draws the cylinder, plunger and gas column in proportion, none for no value', () => {
    expect(cylinderFraction(NaN, 3)).toBe(0);
    expect(cylinderFraction(3, NaN)).toBe(0);
    expect(cylinderFraction(5, 3)).toBeGreaterThan(cylinderFraction(3, 3));
    expect(cylinderFraction(1e6, 3)).toBe(1);
    expect(plungerFraction(NaN)).toBe(0);
    expect(plungerFraction(50)).toBe(0.5);
    expect(plungerFraction(500)).toBe(1);
    expect(columnFraction(NaN)).toBe(0);
  });
});

describe('scale marks', () => {
  it('knows the units a scale is read in', () => {
    expect(unitRatio('mm', 'm')).toBe(1e-3);
    expect(unitRatio('mL', 'mL')).toBe(1);
    expect(unitRatio('cm', 'm')).toBeNaN();
    expect(unitRatio('', 'm')).toBeNaN();
  });

  it('marks every step along the scale, none where the step does not divide it into a drawable count', () => {
    const out: number[] = [];
    expect(scaleMarks(0.25, 1, out)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(scaleMarks(NaN, 1, out)).toEqual([]);
    expect(scaleMarks(0.001, 2, out)).toEqual([]); // 2000 marks: not drawn rather than drawn wrong
  });
});
