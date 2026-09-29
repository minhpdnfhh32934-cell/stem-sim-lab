import type { ParamSource, Params, PhysicsScene } from './types';

/**
 * Applies `scene.autoDefaults` (values derived in code from the stated ones, e.g. a time
 * span long enough to show the whole motion) to parameters that are still defaults.
 * Values from the problem or the user are never overwritten.
 */
export function applyAutoDefaults(
  scene: PhysicsScene,
  params: Params,
  sources: Record<string, ParamSource>,
): Params {
  const derived = scene.autoDefaults?.(params, sources);
  if (!derived) return params;
  const out = { ...params };
  for (const [k, v] of Object.entries(derived)) {
    if (sources[k] === 'default' || sources[k] === undefined) out[k] = v;
  }
  return out;
}
