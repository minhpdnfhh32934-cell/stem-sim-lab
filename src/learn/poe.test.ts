import { describe, expect, it } from 'vitest';
import { fromSI } from '@/core/units';
import { loadScene, sceneIds } from '@/physics/registry';
import type { Params } from '@/physics/types';
import { observe, POES, poeFor } from './poe';

describe('predict – observe – explain', () => {
  it('every physics topic has a prediction question', () => {
    for (const id of sceneIds()) expect(poeFor(id), id).toBeDefined();
  });

  for (const g of [9.81, 9.8, 10]) {
    it(`the right choice is computed by the engine and exists (g = ${g})`, async () => {
      for (const poe of POES) {
        const s = await loadScene(poe.topic);
        const params: Params = s.usesGravity
          ? { ...s.defaults, ...poe.start, g }
          : { ...s.defaults, ...poe.start };
        const out = observe(s, poe, params);
        expect(out, poe.id).not.toBeNull();
        expect(out?.correct ?? -1, poe.id).toBeGreaterThanOrEqual(0);
        // The changed value stays inside the slider range.
        const def = s.params.find((d) => d.key === poe.param);
        const shown = fromSI((params[poe.param] ?? 0) * poe.factor, def?.unit ?? '1');
        expect(shown, poe.id).toBeGreaterThanOrEqual(def?.min ?? -Infinity);
        expect(shown, poe.id).toBeLessThanOrEqual(def?.max ?? Infinity);
      }
    });
  }

  it('known closed forms: free fall √2, stopping distance ×4, period ×2', async () => {
    const pick = async (id: string) => {
      const poe = POES.find((p) => p.id === id);
      if (!poe) throw new Error(id);
      const s = await loadScene(poe.topic);
      const out = observe(s, poe, { ...s.defaults });
      if (!out) throw new Error(id);
      return { out, poe };
    };
    const ff = await pick('freeFall.h0');
    expect(ff.out.after / ff.out.before).toBeCloseTo(Math.SQRT2, 6);
    expect(ff.poe.choices[ff.out.correct]).toEqual({ kind: 'ratio', ratio: Math.SQRT2 });
    const ua = await pick('uniformAcceleration.vA');
    expect(ua.out.after / ua.out.before).toBeCloseTo(4, 6);
    const hk = await pick('hookeSpring.m');
    expect(hk.out.after / hk.out.before).toBeCloseTo(2, 6);
    const ob = await pick('obliqueProjectile.m');
    expect(ob.poe.choices[ob.out.correct]).toEqual({ kind: 'ratio', ratio: 1 });
  });
});
