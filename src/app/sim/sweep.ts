import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { toSI } from '@/core/units';
import { applyAutoDefaults } from '@/physics/autoDefaults';
import type { ParamDef, ParamSource, Params, PhysicsScene } from '@/physics/types';

/**
 * "Quét tham số" (#195 step 5): one answer of the lesson against one parameter. Each point is the
 * lesson's own `solve()` with that parameter set the way the slider sets it (auto defaults, then
 * the lesson's checks), the other parameters unchanged. A point the lesson refuses or cannot
 * solve is left out and said, never interpolated.
 */

export const SWEEP_MIN_STEPS = 5;
export const SWEEP_MAX_STEPS = 50;

/** Parameters a sweep can vary now: numbers with a slider range that apply to these values. */
export function sweepable(scene: PhysicsScene, params: Params): ParamDef[] {
  return scene.params.filter(
    (d) =>
      d.kind === 'number' &&
      d.min !== undefined &&
      d.max !== undefined &&
      d.max > d.min &&
      (d.when?.(params) ?? true),
  );
}

/** `steps` values from `from` to `to` (display units, both ends included), inside the slider. */
export function sweepValues(def: ParamDef, from: number, to: number, steps: number): number[] {
  const lo = def.min ?? -Infinity;
  const hi = def.max ?? Infinity;
  const a = Math.min(hi, Math.max(lo, from));
  const b = Math.min(hi, Math.max(lo, to));
  const n = Math.round(Math.min(SWEEP_MAX_STEPS, Math.max(SWEEP_MIN_STEPS, steps)));
  if (a === b) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export type SweepAt = { y: number } | { reason: LocalizedText | null };

/** The answer `answerId` with `def` at `x` (display unit): SI value, or why there is none. */
export function sweepAt(
  scene: PhysicsScene,
  params: Params,
  sources: Record<string, ParamSource>,
  def: ParamDef,
  x: number,
  answerId: string,
  locale: Locale,
): SweepAt {
  const p = applyAutoDefaults(
    scene,
    { ...params, [def.key]: toSI(x, def.unit ?? '1') },
    { ...sources, [def.key]: 'user' },
  );
  const refused = scene.validate?.(p) ?? [];
  if (refused[0]) return { reason: refused[0] };
  try {
    const a = scene.solve(p, locale).answers.find((ans) => ans.id === answerId);
    if (a && Number.isFinite(a.value)) return { y: a.value };
  } catch {
    // An unsolvable point is said as such below.
  }
  return { reason: null };
}

export interface SweepResult {
  /** Display values of the parameter, in order. */
  x: number[];
  /** SI answer at each x; null where the point was left out. */
  y: (number | null)[];
  /** The points left out and why (null: no answer for these values). */
  skipped: { x: number; reason: LocalizedText | null }[];
}

/** Time spent computing before the page gets a frame back (ms). */
const SLICE_MS = 12;

/**
 * Runs the sweep a few points at a time so the window keeps responding; resolves null when
 * `signal` aborts (the learner pressed Hủy or left the lesson).
 */
export async function runSweep(
  scene: PhysicsScene,
  params: Params,
  sources: Record<string, ParamSource>,
  def: ParamDef,
  values: readonly number[],
  answerId: string,
  locale: Locale,
  signal: AbortSignal,
  onProgress?: (done: number) => void,
): Promise<SweepResult | null> {
  const out: SweepResult = { x: [], y: [], skipped: [] };
  let slice = performance.now();
  for (const x of values) {
    if (signal.aborted) return null;
    const r = sweepAt(scene, params, sources, def, x, answerId, locale);
    out.x.push(x);
    if ('y' in r) out.y.push(r.y);
    else {
      out.y.push(null);
      out.skipped.push({ x, reason: r.reason });
    }
    if (performance.now() - slice > SLICE_MS) {
      onProgress?.(out.x.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
      slice = performance.now();
    }
  }
  return signal.aborted ? null : out;
}
