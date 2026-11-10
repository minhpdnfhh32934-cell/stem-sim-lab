import { describe, expect, it } from 'vitest';
import { loadScene, sceneIds } from './registry';
import { sliderSweep } from './testing';
import { CHECK_FLOOR, CHECK_TOL, compareCheck } from './tolerance';

describe('compareCheck: one rule for "khớp" (#119)', () => {
  it('relative CHECK_TOL for ordinary answers', () => {
    expect(compareCheck(2.5, 2.5 * (1 + 5e-9))).toMatchObject({ agrees: true, relative: true });
    expect(compareCheck(2.5, 2.5 * (1 + 5e-9)).deviation).toBeCloseTo(5e-9, 15);
    expect(compareCheck(2.5, 2.5 * (1 + 2e-8)).agrees).toBe(false);
    // Small SI values are held to the same relative tolerance, not to an absolute 1e-8.
    expect(compareCheck(4e-4, 4e-4 + 1e-10)).toMatchObject({ agrees: false, relative: true });
    expect(compareCheck(-3, -3 * (1 + 2e-8)).agrees).toBe(false);
  });

  it('an answer of exactly 0: round-off agrees, the deviation is absolute', () => {
    expect(compareCheck(0, 1e-15)).toEqual({ agrees: true, relative: false, deviation: 1e-15 });
    expect(compareCheck(0, -3e-13).agrees).toBe(true);
    expect(compareCheck(0, 2 * CHECK_FLOOR)).toMatchObject({ agrees: false, relative: false });
  });

  it('a declared tolerance widens only that answer; NaN never agrees', () => {
    expect(compareCheck(0.5, 0.5 * 1.002, 3e-3).agrees).toBe(true);
    expect(compareCheck(0.5, 0.5 * 1.004, 3e-3).agrees).toBe(false);
    expect(compareCheck(0.5, 0.5 * 1.002).agrees).toBe(false);
    expect(compareCheck(1, Number.NaN).agrees).toBe(false);
    expect(compareCheck(Number.NaN, 1).agrees).toBe(false);
    expect(CHECK_TOL).toBe(1e-8);
  });
});

describe('every physics scene: its checks agree over a slider sweep', () => {
  it('no answer on any slider setting reads "chưa khớp"', async () => {
    const misses: string[] = [];
    let checked = 0;
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      for (const p of sliderSweep(scene, 300, 119)) {
        if ((scene.validate?.(p) ?? []).length > 0) continue;
        for (const a of scene.solve(p, 'vi').answers) {
          if (a.check === undefined) continue;
          checked++;
          if (!compareCheck(a.value, a.check, a.checkTol).agrees)
            misses.push(
              `${id}.${a.id} ${String(a.value)} vs ${String(a.check)} ${JSON.stringify(p)}`,
            );
        }
      }
    }
    expect(misses).toEqual([]);
    expect(checked).toBeGreaterThan(10_000);
  }, 60_000);
});
