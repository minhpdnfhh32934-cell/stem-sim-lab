import { describe, expect, it } from 'vitest';
import { toSI } from '@/core/units';
import { applyAutoDefaults } from '@/physics/autoDefaults';
import { loadScene } from '@/physics/registry';
import type { ParamDef, PhysicsScene } from '@/physics/types';
import { SWEEP_MAX_STEPS, SWEEP_MIN_STEPS, runSweep, sweepValues, sweepable } from './sweep';

const L = (vi: string) => ({ vi, en: vi });

describe('Quét tham số (#195 step 5)', () => {
  it("every point is the lesson's own solve() with the parameter set as the slider sets it", async () => {
    const scene = await loadScene('obliqueProjectile');
    const params = { ...scene.defaults, g: 9.8 };
    const def = sweepable(scene, params).find((d) => d.key === 'v0');
    if (!def) throw new Error('v0 is not sweepable');
    const answers = scene.solve(params, 'vi').answers;
    expect(answers.length).toBeGreaterThan(0);
    for (const a of answers) {
      const values = sweepValues(def, 5, 25, 5);
      const r = await runSweep(
        scene,
        params,
        {},
        def,
        values,
        a.id,
        'vi',
        new AbortController().signal,
      );
      if (!r) throw new Error('aborted');
      expect(r.x).toEqual([5, 10, 15, 20, 25]);
      r.x.forEach((x, i) => {
        const p = applyAutoDefaults(
          scene,
          { ...params, v0: toSI(x, def.unit ?? '1') },
          { v0: 'user' },
        );
        const direct = scene.solve(p, 'vi').answers.find((b) => b.id === a.id)?.value;
        expect(r.y[i]).toBe(direct);
      });
    }
  });

  it('keeps the values inside the slider and the number of points within 5–50', () => {
    const def = { key: 'k', kind: 'number', min: 0, max: 10 } as ParamDef;
    expect(sweepValues(def, -5, 20, 3)).toHaveLength(SWEEP_MIN_STEPS);
    const many = sweepValues(def, -5, 20, 500);
    expect(many).toHaveLength(SWEEP_MAX_STEPS);
    expect(many[0]).toBe(0);
    expect(many.at(-1)).toBe(10);
    expect(sweepValues(def, 4, 4, 20)).toEqual([4]);
  });

  it('leaves out, and says, a point the lesson refuses or cannot solve; never fills it in', async () => {
    const def = { key: 'k', label: L('k'), kind: 'number', min: 0, max: 4 } as ParamDef;
    const scene = {
      params: [def],
      validate: (p: { k?: number }) => ((p.k ?? 0) === 1 ? [L('k = 1 không được')] : []),
      solve: (p: { k?: number }) => {
        if ((p.k ?? 0) === 3) throw new Error('no answer at 3');
        return {
          answers: [{ id: 'a', label: L('a'), value: 2 * (p.k ?? 0), unit: 'm' }],
          steps: [],
        };
      },
    } as unknown as PhysicsScene;
    const r = await runSweep(
      scene,
      {},
      {},
      def,
      [0, 1, 2, 3, 4],
      'a',
      'vi',
      new AbortController().signal,
    );
    expect(r?.y).toEqual([0, null, 4, null, 8]);
    expect(r?.skipped).toEqual([
      { x: 1, reason: L('k = 1 không được') },
      { x: 3, reason: null },
    ]);
  });

  it('stops when cancelled', async () => {
    const scene = await loadScene('obliqueProjectile');
    const def = sweepable(scene, scene.defaults).find((d) => d.key === 'v0');
    if (!def) throw new Error('v0 is not sweepable');
    const ctl = new AbortController();
    ctl.abort();
    const id = scene.solve(scene.defaults, 'vi').answers[0]?.id ?? '';
    expect(
      await runSweep(scene, scene.defaults, {}, def, [5, 10], id, 'vi', ctl.signal),
    ).toBeNull();
  });
});
