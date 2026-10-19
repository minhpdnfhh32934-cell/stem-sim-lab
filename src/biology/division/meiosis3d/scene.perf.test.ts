import { describe, expect, it } from 'vitest';
import { meiosisOptions } from '../meiosisOptions';
import { buildMeiosisScene, type MeiosisPalette } from './scene';
import { buildMeiosisTimeline } from './timeline';

const PALETTE: MeiosisPalette = {
  maternal: 'gray',
  paternal: 'gray',
  centromere: 'gray',
  chiasma: 'gray',
  membrane: 'gray',
  envelope: 'gray',
  nucleolus: 'gray',
  spindle: 'gray',
  centrosome: 'gray',
  ring: 'gray',
  highlight: 'gray',
};

/**
 * Draw-call budget: one call per drawn object, at most. Each chromatid is one tube plus its
 * kinetochore (2 calls; 2n chromosomes × 2 chromatids); the rest (membranes and their cytoplasm
 * tint, nuclei, centrosomes, spindles as one instanced call, chiasma bars, contact shadow) is at
 * most 24 calls. Measured maxima 2026-10-20: 31/38/46/54 (Low, Medium), 32/37/45/53 (High).
 */
const CALLS = (n2: number) => 24 + 4 * n2;

/**
 * Most triangles drawn at any moment of the division, per quality tier (sphere segments: Low 8,
 * Medium 16, High 24), measured on the CPU with `drawStats` (2026-10-20). Meiosis draws up to
 * four nuclei and two dividing membranes at once (mitosis: two and one), so its High tier peaks
 * higher: four double nuclear envelopes with pores and vesicles in telophase II. The budget
 * allows 5 % more; a bigger change must update this table on purpose.
 */
const TRIANGLES: Record<number, Record<number, number>> = {
  8: { 2: 5570, 4: 6962, 6: 8330, 8: 9778 },
  16: { 2: 16386, 4: 18242, 6: 19970, 8: 21634 },
  24: { 2: 55970, 4: 58290, 6: 60450, 8: 62530 },
};

describe('3D meiosis drawing budget (CPU count, no GPU)', () => {
  for (const segments of [8, 16, 24]) {
    it(`draw calls and triangles per tier for 2n = 2–8 (sphere segments ${String(segments)})`, () => {
      for (const pairs of [1, 2, 3, 4]) {
        const n2 = 2 * pairs;
        const tl = buildMeiosisTimeline(pairs, meiosisOptions(pairs, true, 1));
        const ms = buildMeiosisScene(tl, PALETTE, { segments });
        let calls = 0;
        let triangles = 0;
        for (let t = 0; t <= tl.total + 1e-9; t += 0.25) {
          ms.update(tl.stateAt(t));
          const s = ms.drawStats();
          calls = Math.max(calls, s.calls);
          triangles = Math.max(triangles, s.triangles);
        }
        ms.dispose();
        const at = `2n=${String(n2)} segments ${String(segments)}`;
        expect(calls, at).toBeLessThanOrEqual(CALLS(n2));
        const budget = TRIANGLES[segments]?.[n2] ?? 0;
        expect(triangles, at).toBeLessThanOrEqual(budget * 1.05);
        expect(triangles, at).toBeGreaterThan(budget * 0.95);
      }
    });
  }

  it('one playback frame (stateAt + scene update) takes under 2 ms on the CPU (p95)', () => {
    // 2n = 8 is the largest set the view draws (PAIR_CHOICES).
    const tl = buildMeiosisTimeline(4, meiosisOptions(4, true, 1));
    const ms = buildMeiosisScene(tl, PALETTE, { segments: 24 });
    const frames = Math.round(tl.total * 60);
    const at = (k: number) => (k / frames) * tl.total;
    for (let k = 0; k < frames; k++) ms.update(tl.stateAt(at(k)));
    const times: number[] = [];
    for (let k = 0; k < frames; k++) {
      const a = performance.now();
      ms.update(tl.stateAt(at(k)));
      times.push(performance.now() - a);
    }
    ms.dispose();
    times.sort((a, b) => a - b);
    expect(times[Math.floor(0.95 * times.length)] ?? Infinity).toBeLessThan(2);
  });
});
