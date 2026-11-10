import { createEngine } from '@/core/sim/engine';
import { loadScene } from '@/physics/registry';
import type { PhysicsScene } from '@/physics/types';
import '@/workers/engines';

/** The still shows this much of the run: mid-flight, the trail and the body both in view. */
const AT = 0.6;
/** At most this much simulated time and this many steps (a still never stalls the page). */
const MAX_T = 4;
const MAX_STEPS = 6000;
const BUDGET_MS = 40;
/** States kept for the trail (every k-th, the last always): a still needs no more. */
const KEEP = 300;

export interface StillRun {
  scene: PhysicsScene;
  /** States the engine computed, in order (the trail), the last one is the still's state. */
  states: Float64Array[];
}

/**
 * Runs a topic's own engine from its default values, as the bench would (`engineParams`), up
 * to its end condition or MAX_T, and keeps the states up to AT of that run. Numbers only from
 * the engine: nothing is interpolated or made up; any failure gives null (no picture).
 */
export function stillRun(topic: string): Promise<StillRun | null> {
  // One run per topic and page: the shelf remounts its cards each time it opens.
  let run = runs.get(topic);
  if (!run) {
    run = computeStill(topic);
    runs.set(topic, run);
  }
  return run;
}
const runs = new Map<string, Promise<StillRun | null>>();

async function computeStill(topic: string): Promise<StillRun | null> {
  try {
    const scene = await loadScene(topic);
    const engine = await createEngine(scene.engineId);
    engine.reset(scene.engineParams?.(scene.defaults) ?? scene.defaults);
    const all: Float64Array[] = [];
    const start = performance.now();
    for (let i = 0; i < MAX_STEPS && engine.time() < MAX_T; i++) {
      const s = new Float64Array(engine.stateSize);
      engine.readState(s);
      if (!s.every(Number.isFinite)) return null;
      all.push(s);
      if (engine.finished?.() || performance.now() - start > BUDGET_MS) break;
      engine.step();
    }
    const end = Math.max(1, Math.round(all.length * AT));
    const stride = Math.max(1, Math.ceil(end / KEEP));
    const states = all.slice(0, end).filter((_, i) => i % stride === 0 || i === end - 1);
    return states.length > 0 ? { scene, states } : null;
  } catch {
    return null;
  }
}
