import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { magnetic3d } from './magnetic3d';
import { force, forceDirection } from './model';
import { FORCE_MIN, FORCE_SPAN, buildMagneticScene } from './scene3d';

const dot = (a: readonly number[], b: readonly number[]) =>
  (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0);

describe('magnetic force 3D binding', () => {
  it('draws the model’s F and the left-hand rule’s direction for every angle', () => {
    for (const reversed of [false, true])
      for (let alpha = 0; alpha <= 180; alpha += 15) {
        const s = { B: 5e-2, I: 3, L: 1, alpha, reversed };
        const m = magnetic3d(s);
        expect(m.F).toBe(force(s.B, s.I, s.L, alpha));
        expect(m.share * s.B * s.I * s.L).toBeCloseTo(m.F, 15);
        expect(m.dir).toBe(forceDirection(alpha, reversed));
        if (m.dir === 'none') {
          expect(m.force).toBeNull();
          continue;
        }
        const f = m.force;
        if (!f) throw new Error('no force arrow');
        // F⃗ ⊥ the wire and ⊥ B⃗, out of the page (+z, towards the viewer) or into it.
        expect(dot(f, m.current)).toBeCloseTo(0, 12);
        expect(dot(f, m.field)).toBeCloseTo(0, 12);
        expect(Math.sign(f[2])).toBe(m.dir === 'into' ? -1 : 1);
      }
  });

  it('question 1 p. 63: 0,13 N into the page; no force with no current', () => {
    const m = magnetic3d({ B: 5e-2, I: 3, L: 1, alpha: 60, reversed: false });
    expect(m.F).toBeCloseTo(0.075 * Math.sqrt(3), 12);
    expect(m.dir).toBe('into');
    expect(magnetic3d({ B: 5e-2, I: 0, L: 1, alpha: 60, reversed: false }).force).toBeNull();
  });
});

describe('magnetic force 3D scene', () => {
  it('sizes the force arrow by sinα, labels it with the model’s value and frees all', () => {
    const { kit, track, start } = testKit();
    const model = magnetic3d({ B: 5e-2, I: 3, L: 1, alpha: 90, reversed: true });
    const scene = buildMagneticScene(kit, {
      model,
      alpha: 90,
      texts: { B: 'B', I: 'I', F: 'F = 0,15 N', alpha: 'α = 90°' },
    });
    expect(scene.state().forceLength).toBeCloseTo(FORCE_MIN + FORCE_SPAN, 12);
    expect(scene.state().dir).toBe('outOf');
    expect(kit.scene.getObjectByName('mag-force')).toBeDefined();
    expect(kit.scene.getObjectByName('mag-field')?.children).toHaveLength(9);
    const texts: string[] = [];
    kit.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el?.textContent) texts.push(el.textContent);
    });
    expect(texts).toEqual(expect.arrayContaining(['B', 'I', 'F = 0,15 N', 'α = 90°']));
    expectAllFreed(kit, track, start);
  });
});
