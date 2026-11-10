/**
 * Test helpers for physics scenes (imported by tests only): seeded slider sweeps and the gap
 * between each answer's closed form and its numeric cross-check (issue #112).
 */
import { toSI } from '@/core/units';
import { compareCheck } from './tolerance';
import type { Params, PhysicsScene } from './types';

export { CHECK_TOL } from './tolerance';

/** Small seeded generator (the same sweep every run). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** `n` parameter sets drawn uniformly over every slider (SI), choices and toggles at random. */
export function sliderSweep(
  scene: PhysicsScene,
  n: number,
  seed = 1,
  fixed: Params = {},
): Params[] {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => {
    const p: Params = { ...scene.defaults };
    for (const d of scene.params) {
      if (d.kind === 'choice' && d.choices?.length)
        p[d.key] = d.choices[Math.floor(rand() * d.choices.length)]?.value ?? 0;
      else if (d.kind === 'toggle') p[d.key] = rand() < 0.5 ? 0 : 1;
      else if (d.min !== undefined && d.max !== undefined) {
        const unit = d.unit ?? '1';
        const lo = toSI(d.min, unit);
        p[d.key] = lo + rand() * (toSI(d.max, unit) - lo);
      }
    }
    return { ...p, ...fixed };
  });
}

/** Answers whose check the solution panel would show as "chưa khớp" (empty: all agree). */
export function checkMisses(
  scene: PhysicsScene,
  params: Params,
): { id: string; value: number; check: number }[] {
  if ((scene.validate?.(params) ?? []).length > 0) return [];
  return scene
    .solve(params, 'vi')
    .answers.filter(
      (a) => a.check !== undefined && !compareCheck(a.value, a.check, a.checkTol).agrees,
    )
    .map((a) => ({ id: a.id, value: a.value, check: a.check ?? NaN }));
}
