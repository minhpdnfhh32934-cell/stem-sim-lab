import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawStats } from '@/ui/three/drawStats';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { RADIUS, RISE, TWIST } from '../../central/dogma3d/bdna';
import { HELIX_LENGTH_NM, LEVELS, LEVEL_PARTS, levelInfo } from './levels';
import { buildZoomScene, zoomFrame } from './scene';

afterEach(() => {
  vi.restoreAllMocks();
});

const NAMES = Object.fromEntries(
  Object.values(LEVEL_PARTS)
    .flat()
    .map((p) => [p, p]),
);

/** Length (scene units) of the longest mesh drawn along x: the scale bar (rotated cylinder). */
function barLength(scene: THREE.Scene): number {
  let best = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && Math.abs(o.rotation.z - Math.PI / 2) < 1e-9)
      best = Math.max(best, o.scale.y);
  });
  return best;
}

describe('cell → DNA zoom scenes', () => {
  it.each(LEVELS.map((id, i) => [id, i] as const))(
    '%s: builds, draws its scale bar to scale and frees everything',
    (id, i) => {
      const { kit, track, start } = testKit('medium');
      const sc = buildZoomScene(kit, { level: i, barText: 'bar', names: NAMES });
      const info = levelInfo(i);
      // The ruler is exactly barNm long in the level's units.
      expect(barLength(kit.scene)).toBeCloseTo(info.barNm / info.unitNm, 12);
      // Every named part of the level got its label; the next level's spot is a framing.
      expect(sc.state?.()).toMatchObject({ level: id, named: LEVEL_PARTS[id] });
      expect(Object.keys(sc.frames ?? {})).toEqual(id === 'dna' ? [] : [zoomFrame(i)]);
      expect(sc.bounds.radius).toBeGreaterThan(3);
      expectAllFreed(kit, track, start);
    },
  );

  it('the helix names point at a strand and at the middle of a base pair (3D)', () => {
    const { kit, track, start } = testKit('medium');
    const i = LEVELS.indexOf('dna');
    const sc = buildZoomScene(kit, { level: i, barText: 'bar', names: NAMES });
    const { unitNm: u } = levelInfo(i);
    const anchors = (sc.state?.() as { anchors: Record<string, [number, number, number]> }).anchors;
    const x = (k: number) => (-HELIX_LENGTH_NM / 2 + k * RISE) / u;
    const [bx, by, bz] = anchors.backbone ?? [0, 0, 0];
    const k = Math.round((bx * u + HELIX_LENGTH_NM / 2) / RISE);
    // The coding strand's nucleotide k sits at angle k · TWIST around the axis.
    expect(bx).toBeCloseTo(x(k), 9);
    expect(by).toBeCloseTo((RADIUS * Math.cos(k * TWIST)) / u, 9);
    expect(bz).toBeCloseTo((RADIUS * Math.sin(k * TWIST)) / u, 9);
    // The base pair's name: on the axis, where the pair's two halves meet.
    const [rx, ry, rz] = anchors.basePair ?? [0, 0, 0];
    const j = Math.round((rx * u + HELIX_LENGTH_NM / 2) / RISE);
    expect(rx).toBeCloseTo(x(j), 9);
    expect([ry, rz]).toEqual([0, 0]);
    expectAllFreed(kit, track, start);
  });

  it('no names: no labels but the scale bar’s', () => {
    const { kit, track, start } = testKit('medium');
    buildZoomScene(kit, { level: 0, barText: 'bar', names: null });
    // CSS2D labels carry their page element.
    expect(kit.scene.children.filter((o) => 'element' in o)).toHaveLength(1);
    expectAllFreed(kit, track, start);
  });
});

/**
 * Draw calls and triangles of each level, measured on the CPU with `drawStats` (2026-11-02,
 * first version; no name labels — they are page elements, not draws): only the level on screen
 * exists. High draws rounder tubes and the histones' detailed blobs. The budget allows 5 %; a
 * bigger change must update this table on purpose.
 */
const BUDGET = {
  medium: {
    cell: { calls: 8, triangles: 6544 },
    nucleus: { calls: 9, triangles: 18720 },
    chromosome: { calls: 6, triangles: 4320 },
    fibre: { calls: 8, triangles: 30016 },
    nucleosome: { calls: 6, triangles: 37344 },
    dna: { calls: 6, triangles: 5728 },
  },
  high: {
    cell: { calls: 8, triangles: 12712 },
    nucleus: { calls: 9, triangles: 25952 },
    chromosome: { calls: 6, triangles: 5920 },
    fibre: { calls: 8, triangles: 37264 },
    nucleosome: { calls: 6, triangles: 130880 },
    dna: { calls: 6, triangles: 13248 },
  },
} as const;

describe('cell → DNA zoom drawing budget (CPU count, no GPU)', () => {
  it.each(['medium', 'high'] as const)(
    '%s tier: draw calls and triangles of each level',
    (tier) => {
      LEVELS.forEach((id, i) => {
        const { kit } = testKit(tier);
        buildZoomScene(kit, { level: i, barText: 'bar', names: null });
        const s = drawStats(kit.scene);
        kit.dispose();
        const b = BUDGET[tier][id];
        expect(s.calls, id).toBeLessThanOrEqual(b.calls);
        expect(s.triangles, id).toBeLessThanOrEqual(b.triangles * 1.05);
        expect(s.triangles, id).toBeGreaterThan(b.triangles * 0.95);
      });
    },
  );

  it('building any level takes under 150 ms', () => {
    LEVELS.forEach((id, i) => {
      const { kit } = testKit('high');
      const t0 = performance.now();
      buildZoomScene(kit, { level: i, barText: 'bar', names: null });
      expect(performance.now() - t0, id).toBeLessThan(150);
      kit.dispose();
    });
  });
});
