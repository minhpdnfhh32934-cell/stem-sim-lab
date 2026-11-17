import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { AMP, SPAN, WAVES, fieldsAt, phaseAt, xAt } from './emwave3d';
import { buildEmScene } from './scene3d';

const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

describe('electromagnetic wave 3D shape', () => {
  it('E ⊥ B ⊥ the direction of travel, in phase, one wavelength = SPAN / WAVES', () => {
    for (const phase of [0, 0.7, 2.1])
      for (let u = 0; u <= WAVES; u += 0.05) {
        const { e, b } = fieldsAt(u, phase);
        expect(dot(e, b)).toBe(0);
        expect(dot(e, [1, 0, 0])).toBe(0);
        expect(dot(b, [1, 0, 0])).toBe(0);
        // In phase: the same signed size at every point.
        expect(e[1]).toBe(b[2]);
        // Periodic in u with period 1 (one wavelength).
        expect(fieldsAt(u + 1, phase).e[1]).toBeCloseTo(e[1], 12);
        expect(Math.abs(e[1])).toBeLessThanOrEqual(AMP);
      }
    expect(xAt(1) - xAt(0)).toBeCloseTo(SPAN / WAVES, 15);
    expect(phaseAt(2)).toBeCloseTo(2 * Math.PI, 15);
  });
});

describe('electromagnetic wave 3D scene', () => {
  it('moves without rebuilding, labels λ and frees all', () => {
    const { kit, track, start } = testKit();
    const scene = buildEmScene(kit, { texts: { E: 'E', B: 'B', c: 'c', lambda: 'λ = 500 nm' } });
    // Positions are stored as 32-bit floats.
    expect(scene.state().eAt0).toBeCloseTo(0, 5);
    scene.tick?.(0.5);
    const s = scene.state();
    expect(s.phase).toBeCloseTo(Math.PI / 2, 12);
    // sin(−π/2) at the start of the drawn part, for E and B alike.
    expect(s.eAt0).toBeCloseTo(-AMP, 5);
    expect(s.bAt0).toBeCloseTo(-AMP, 5);
    expect(s.crestGap).toBeCloseTo(SPAN / WAVES, 15);
    const texts: string[] = [];
    kit.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el?.textContent) texts.push(el.textContent);
    });
    expect(texts).toEqual(expect.arrayContaining(['E', 'B', 'c', 'λ = 500 nm']));
    expectAllFreed(kit, track, start);
  });
});
