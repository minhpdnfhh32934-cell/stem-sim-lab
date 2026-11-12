import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectDisposes } from '@/ui/three/testing';
import { buildOrbScene } from './orbScene';
import { ORB_BUDGET } from './points';
import { ORB_STATES, still } from './states';

const COLORS = { accent: '#5fe0d2', line: '#468f92', glow: true };

function parts(orb: ReturnType<typeof buildOrbScene>) {
  const group = orb.scene.children[0] as THREE.Group;
  const points = group.children.find((c) => c instanceof THREE.Points) as THREE.Points;
  return { group, color: points.geometry.getAttribute('color') as THREE.BufferAttribute };
}

describe('orb scene (#234 step 2)', () => {
  for (const tier of ['medium', 'high'] as const) {
    it(`${tier}: its budget of points and lines`, () => {
      const orb = buildOrbScene(tier, COLORS);
      expect(orb.points).toBe(ORB_BUDGET[tier].points);
      expect(orb.pairs).toBeLessThanOrEqual(ORB_BUDGET[tier].pairs);
      expect(orb.pairs).toBeGreaterThan(ORB_BUDGET[tier].pairs / 2);
      orb.dispose();
    });
  }

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => buildOrbScene('high', COLORS),
      (orb) => {
        orb.dispose();
      },
    );
  });

  it('a frame writes the existing buffers (no new arrays) and turns at the state’s speed', () => {
    const orb = buildOrbScene('medium', COLORS);
    const { group, color } = parts(orb);
    const array = color.array;
    const p = ORB_STATES.thinking;
    orb.update(0.5, p, 0);
    orb.update(0.5, p, 0);
    expect(color.array).toBe(array);
    expect(group.rotation.y).toBeCloseTo(p.spin * 1, 12);
    orb.dispose();
  });

  it('reduced motion: frames leave it where it is', () => {
    const orb = buildOrbScene('medium', COLORS);
    const { group } = parts(orb);
    const p = still(ORB_STATES.thinking);
    for (let i = 0; i < 10; i++) orb.update(0.1, p, 1);
    expect(group.rotation.y).toBe(0);
    expect(group.scale.x).toBe(p.scale);
    orb.dispose();
  });

  it('speaking: the voice level swells the orb; other states ignore it', () => {
    const orb = buildOrbScene('medium', COLORS);
    const { group } = parts(orb);
    orb.update(0.016, ORB_STATES.speaking, 0);
    const quiet = group.scale.x;
    orb.update(0.016, ORB_STATES.speaking, 1);
    expect(group.scale.x).toBeGreaterThan(quiet);
    orb.update(0.016, ORB_STATES.idle, 1);
    expect(group.scale.x).toBe(ORB_STATES.idle.scale);
    orb.dispose();
  });

  it('thinking lights a band: the brightest point is brighter than with no band', () => {
    const brightest = (band: number) => {
      const orb = buildOrbScene('medium', COLORS);
      orb.update(0.3, { ...ORB_STATES.thinking, band, pulseHz: 0 }, 0);
      const values = Array.from(parts(orb).color.array);
      orb.dispose();
      return Math.max(...values);
    };
    expect(brightest(1)).toBeGreaterThan(1.5 * brightest(0));
  });
});
