import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { freeFallModel } from './freeFall';

const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'free-fall'),
);

/** Textbook release from rest, written out independently of the model. */
const textbook = (h: number, g: number) => ({
  t: Math.sqrt((2 * h) / g),
  v: -Math.sqrt(2 * g * h),
});

describe('free-fall theory', () => {
  it('is the textbook release from rest: t = √(2h/g), v = −√(2gh)', () => {
    for (const [h, g] of [
      [1.5, 9.81],
      [0.2, 24.79],
      [3, 1.62],
    ] as const) {
      const theory = freeFallModel.predict!({ height: h, gravity: g, initialVelocity: 0 });
      expect(theory.fallTime).toBeCloseTo(textbook(h, g).t, 14);
      expect(theory.impactVelocity).toBeCloseTo(textbook(h, g).v, 13);
    }
  });

  it('includes a throw upward: t = (v₀ + √(v₀² + 2gh))/g', () => {
    const theory = freeFallModel.predict!({ height: 2, gravity: 9.81, initialVelocity: 5 });
    expect(theory.fallTime).toBeCloseTo((5 + Math.sqrt(25 + 2 * 9.81 * 2)) / 9.81, 14);
    expect(theory.impactVelocity).toBeCloseTo(-Math.sqrt(25 + 2 * 9.81 * 2), 13);
  });

  it('is what the stepped run measures, across the tower’s range of h and every g preset', () => {
    for (const h of [0.2, 1.5, 3]) {
      for (const g of [1.62, 3.71, 9.81, 24.79]) {
        const run = new ExperimentRuntime('test', definition, freeFallModel, {
          height: h,
          gravity: g,
        });
        run.runToCompletion();
        expect(run.endReason).toBe('model');
        const theory = run.theory()!;
        expect(run.results?.['fall-time']).toBeCloseTo(theory.fallTime!, 12);
        expect(run.results?.['impact-velocity']).toBeCloseTo(theory.impactVelocity!, 10);
      }
    }
  });
});
