import { describe, expect, it } from 'vitest';
import { logistic, logisticInflection } from '../ecology';
import { curvePoints, logisticModel3d, momentAt, tStarInRun } from './binding';
import { selectionCard } from './facts';

/** The lesson's defaults (store.ts) and a run falling towards K from above. */
const LESSON = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };
const FALLING = { N0: 1500, r: 0.5, K: 500, tEnd: 20 };
const fmt = (v: number) => String(v);

describe('logistic 3D: the endless run (#205 C5)', () => {
  it('span k shows the exact N(t) on [k·tEnd, (k + 1)·tEnd], on scales that never change', () => {
    const first = logisticModel3d(LESSON, 200);
    for (const k of [1, 2, 5]) {
      const t0 = k * LESSON.tEnd;
      const model = logisticModel3d(LESSON, 200, t0);
      expect(model.per).toBe(first.per);
      expect(model.top).toBe(first.top);
      for (const t of [t0, t0 + 7.5, t0 + LESSON.tEnd]) {
        const m = momentAt(model, t);
        expect(m.t).toBe(t);
        expect(m.N).toBe(logistic(LESSON.N0, LESSON.r, LESSON.K, t));
        expect(m.shown).toBeLessThanOrEqual(model.slots);
        expect(m.fill).toBeLessThanOrEqual(1);
      }
      // Times outside the span are held at its ends.
      expect(momentAt(model, 0).t).toBe(t0);
      expect(momentAt(model, t0 + 2 * LESSON.tEnd).t).toBe(t0 + LESSON.tEnd);
      for (const [u, v] of curvePoints(model)) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // Later on N stands at K (the herd fills the fence).
    const late = logisticModel3d(LESSON, 200, 5 * LESSON.tEnd);
    expect(momentAt(late, late.t0).N).toBeCloseTo(LESSON.K, 6);
    expect(momentAt(late, late.t0).shown).toBe(late.kSlots);
  });

  it('a run falling from above K keeps its scales and settles at K too', () => {
    const first = logisticModel3d(FALLING, 200);
    const later = logisticModel3d(FALLING, 200, 3 * FALLING.tEnd);
    expect(later.peak).toBe(FALLING.N0);
    expect(later.slots).toBe(first.slots);
    expect(momentAt(later, later.t0).N).toBeCloseTo(FALLING.K, 6);
  });

  it('t* is marked only on the span holding it; the card says when it was', () => {
    const tStar = logisticInflection(LESSON.N0, LESSON.r, LESSON.K);
    expect(tStar).toBeGreaterThan(0);
    expect(tStar).toBeLessThan(LESSON.tEnd);
    const first = logisticModel3d(LESSON, 200);
    const later = logisticModel3d(LESSON, 200, LESSON.tEnd);
    expect(tStarInRun(first)).toBe(true);
    expect(tStarInRun(later)).toBe(false);
    const card = selectionCard(later, momentAt(later, later.t0), { kind: 'gauge' }, fmt);
    expect(card?.lines.map((l) => l.vi).join(' ')).toContain('trước khoảng thời gian đang xem');
  });
});
