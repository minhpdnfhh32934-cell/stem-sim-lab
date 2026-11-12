import type { SimulationEngine } from '@/core/sim/engine';

/**
 * Runs an RK4 engine with no end of its own for `seconds` and returns the largest relative drift
 * of its conserved energy (#205 C1). Test helper, shared by endless.test.ts (10⁴ s) and
 * endless.slow.test.ts (10⁵ s).
 */
export function energyDrift(
  e: SimulationEngine<Record<string, number>>,
  params: Record<string, number>,
  seconds: number,
): number {
  e.reset(params);
  const energy = () => e.diagnostics?.().invariants?.energy ?? Number.NaN;
  const e0 = energy();
  const n = Math.round(seconds / e.dt);
  let worst = 0;
  for (let i = 1; i <= n; i++) {
    e.step();
    // Every simulated second is enough to catch a drift (it only grows).
    if (i % 240 === 0 || i === n) worst = Math.max(worst, Math.abs(energy() - e0) / Math.abs(e0));
  }
  if (e.finished?.()) throw new Error('the run ended before the time asked');
  return worst;
}
