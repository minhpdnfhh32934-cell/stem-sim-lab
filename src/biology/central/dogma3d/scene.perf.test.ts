import { describe, expect, it } from 'vitest';
import { dogmaClock, dogmaModel3d, momentAt } from './binding';
import { buildDogmaScene } from './scene';

/** A 300-bp gene (start codon, 98 sense codons, stop codon): the budget's input. */
const CODING = `ATG${'GCTAAAGGC'.repeat(32)}GCTAAATAA`;
const model = dogmaModel3d(CODING);
const clock = dogmaClock(model);

/** Instance budget of each tier (`quality3d`: maxInstances), sphere segments. */
const TIERS = [
  { tier: 'medium', segments: 16, maxBasePairs: 600 },
  { tier: 'high', segments: 24, maxBasePairs: 1500 },
] as const;

/**
 * Most triangles drawn at any moment for the 300-bp gene, measured on the CPU with `drawStats`
 * (2026-10-20): all 300 base pairs, the mRNA and up to 99 beads. High draws rounder rungs,
 * nodes and beads. The budget allows 5 %; a bigger change must update this table on purpose.
 */
const TRIANGLES: Record<string, number> = { medium: 197388, high: 437192 };
/** Draw calls: one per instanced set or machine part, never one per base. */
const CALLS = 32;

describe('3D dogma drawing budget for a 300-bp input (CPU count, no GPU)', () => {
  it('300 base pairs: instance counts, draw calls and triangles per tier', () => {
    expect(CODING.length).toBe(300);
    expect(clock.steps).toBe(100);
    for (const o of TIERS) {
      const sc = buildDogmaScene(model, { ...o, token: () => '#808080' });
      let calls = 0;
      let triangles = 0;
      const frames = Math.round(clock.total * 10);
      for (let k = 0; k <= frames; k++) {
        sc.update(momentAt(clock, (k / frames) * clock.total));
        const s = sc.drawStats();
        calls = Math.max(calls, s.calls);
        triangles = Math.max(triangles, s.triangles);
      }
      // The whole gene is drawn (300 < the tier's budget).
      expect(sc.window()).toEqual({ from: 0, to: 300 });
      sc.dispose();
      expect(calls, o.tier).toBeLessThanOrEqual(CALLS);
      const budget = TRIANGLES[o.tier] ?? 0;
      expect(triangles, o.tier).toBeLessThanOrEqual(budget * 1.05);
      expect(triangles, o.tier).toBeGreaterThan(budget * 0.95);
    }
  });

  it('building takes under 150 ms; one playback frame (moment + scene update) under 2 ms (p95)', () => {
    const a = performance.now();
    const sc = buildDogmaScene(model, { ...TIERS[1], token: () => '#808080' });
    sc.update(momentAt(clock, 0));
    expect(performance.now() - a).toBeLessThan(150);
    // Transcription (the whole helix turns: every base pair moves) and translation, at 60 fps.
    for (const [from, to] of [
      [0, clock.tlStart],
      [clock.tlStart, clock.total],
    ] as const) {
      const frames = Math.round((to - from) * 60);
      const at = (k: number) => from + (k / frames) * (to - from);
      for (let k = 0; k < frames; k++) sc.update(momentAt(clock, at(k)));
      const times: number[] = [];
      for (let k = 0; k < frames; k++) {
        const t0 = performance.now();
        sc.update(momentAt(clock, at(k)));
        times.push(performance.now() - t0);
      }
      times.sort((x, y) => x - y);
      expect(times[Math.floor(0.95 * times.length)] ?? Infinity).toBeLessThan(2);
    }
    sc.dispose();
  });
});
