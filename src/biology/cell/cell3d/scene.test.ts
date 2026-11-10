import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawStats } from '@/ui/three/drawStats';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { CELL_KINDS, partsFor, type CellKind, type PartId } from '../parts';
import { CONTAINERS, buildCellScene } from './scene';

afterEach(() => {
  vi.restoreAllMocks();
});

const names = (kind: CellKind) => Object.fromEntries(partsFor(kind).map((p) => [p, p]));

/** A tap aimed from the front (+z) straight at `at`. */
function rayAt(at: [number, number, number]): THREE.Raycaster {
  const ray = new THREE.Raycaster();
  ray.set(new THREE.Vector3(at[0], at[1], 40), new THREE.Vector3(0, 0, -1));
  return ray;
}

describe.each(CELL_KINDS)('3D %s cell', (kind) => {
  it.each(['low', 'medium', 'high'] as const)(
    '%s tier: builds, names its parts, frees everything',
    (tier) => {
      const { kit, track, start } = testKit(tier);
      const sc = buildCellScene(kit, { kind, names: names(kind) });
      const st = sc.state?.() as { parts: PartId[]; named: PartId[] };
      expect(new Set(st.named)).toEqual(new Set(partsFor(kind)));
      expect(sc.bounds.radius).toBeGreaterThan(4);
      expectAllFreed(kit, track, start);
    },
  );

  it('a tap picks an organelle, not the shells around it; the pick is outlined, then cleared', () => {
    const { kit } = testKit('medium');
    const sc = buildCellScene(kit, { kind, names: null });
    kit.scene.updateMatrixWorld(true);
    // Aimed at the middle of the cell: shells and cytoplasm are hit first, an organelle wins.
    const picked = sc.pick?.(rayAt(kind === 'bacterium' ? [0.2, 0, 0] : [0, 0, 0]));
    expect(picked).not.toBeNull();
    expect(CONTAINERS.has(picked as PartId)).toBe(false);
    expect(partsFor(kind)).toContain(picked);
    // Outside the cell: nothing.
    expect(sc.pick?.(rayAt([30, 30, 0]))).toBeNull();
    sc.select?.(picked ?? null);
    expect(sc.state?.()).toMatchObject({ selected: picked });
    sc.select?.(null);
    expect(sc.state?.()).toMatchObject({ selected: null });
    kit.dispose();
  });
});

/**
 * Draw calls and triangles per cell and tier, measured with drawStats (2026-11-10). The number of
 * organelles is the same on every tier (the layout has no tier); only the segments change.
 */
const BUDGET: Record<'low' | 'medium' | 'high', Record<CellKind, [number, number]>> = {
  low: { bacterium: [13, 18656], animal: [13, 12504], plant: [15, 13464] },
  medium: { bacterium: [13, 41024], animal: [13, 40000], plant: [15, 44288] },
  high: { bacterium: [13, 77056], animal: [13, 87120], plant: [15, 97008] },
};

describe('draw budget (one instanced draw per kind of organelle)', () => {
  it.each(
    CELL_KINDS.flatMap((kind) =>
      (['low', 'medium', 'high'] as const).map((t) => [kind, t] as const),
    ),
  )('%s, %s tier', (kind, tier) => {
    const { kit } = testKit(tier);
    buildCellScene(kit, { kind, names: null });
    const s = drawStats(kit.scene);
    kit.dispose();
    const [calls, triangles] = BUDGET[tier][kind];
    expect(s.calls).toBe(calls);
    expect(s.triangles).toBeLessThanOrEqual(triangles * 1.05);
    expect(s.triangles).toBeGreaterThan(triangles * 0.95);
  });
});
