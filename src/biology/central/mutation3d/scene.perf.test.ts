import { describe, expect, it } from 'vitest';
import type { Mutation } from '../dogma';
import { mutationModel3d } from './binding';
import { buildMutationScene } from './scene';

/** A 300-bp gene (start codon, 98 sense codons, stop codon): the budget's input. */
const CODING = `ATG${'GCTAAAGGC'.repeat(32)}GCTAAATAA`;

/** Instance budget of each tier (`quality3d`: maxInstances), sphere segments. */
const TIERS = [
  { tier: 'medium', segments: 16, maxBasePairs: 600 },
  { tier: 'high', segments: 24, maxBasePairs: 1500 },
] as const;

const KINDS: Mutation[] = [
  { kind: 'substitution', pos: 150, base: 'T' },
  { kind: 'insertion', pos: 150, bases: 'GCATG' },
  { kind: 'deletion', pos: 150, count: 4 },
];

/**
 * Triangles drawn for the 300-bp gene, measured on the CPU with `drawStats` (2026-10-20): both
 * helices, both mRNAs with their brackets and both chains (the scene does not move: one layout).
 * High draws rounder rungs, nodes and beads. The budget allows 5 %; a bigger change must update
 * this table on purpose.
 */
const TRIANGLES: Record<string, Record<Mutation['kind'], number>> = {
  medium: { substitution: 402736, insertion: 406448, deletion: 425728 },
  high: { substitution: 879856, insertion: 888080, deletion: 928920 },
};
/** Draw calls: one per instanced set, never one per base. */
const CALLS = 28;

describe('3D point-mutation drawing budget for a 300-bp input (CPU count, no GPU)', () => {
  it('300 base pairs: draw calls and triangles per tier and kind; built in under 150 ms', () => {
    for (const o of TIERS)
      for (const m of KINDS) {
        const t0 = performance.now();
        const sc = buildMutationScene(mutationModel3d(CODING, m), {
          ...o,
          token: () => '#808080',
        });
        expect(performance.now() - t0, `${o.tier} ${m.kind}`).toBeLessThan(150);
        // The whole gene is drawn (300 < the tier's budget).
        expect(sc.window()).toEqual({ from: 0, to: 300 });
        const s = sc.drawStats();
        sc.dispose();
        expect(s.calls, `${o.tier} ${m.kind}`).toBeLessThanOrEqual(CALLS);
        const budget = TRIANGLES[o.tier]?.[m.kind] ?? 0;
        expect(s.triangles, `${o.tier} ${m.kind}`).toBeLessThanOrEqual(budget * 1.05);
        expect(s.triangles, `${o.tier} ${m.kind}`).toBeGreaterThan(budget * 0.95);
      }
  });
});
