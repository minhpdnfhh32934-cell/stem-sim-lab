/**
 * Test helpers for the biology 3D scenes (imported by tests only): a scene kit with theme
 * colours stubbed, and a check that a scene freed every geometry and material it created.
 */
import * as THREE from 'three';
import { expect, vi } from 'vitest';
import type { QualityTier } from '@/perf/tiers';
import { SceneKit } from './kit';

/** three.js numbers every material (`Material.id`, documented, missing from @types/three). */
const materialId = (m: unknown) => (m as THREE.Material & { readonly id: number }).id;

/** Ids the next BufferGeometry / Material will get (three.js numbers both in order). */
function nextIds() {
  return { geometry: new THREE.BufferGeometry().id, material: materialId(new THREE.Material()) };
}

export interface Tracking {
  geometries: () => Set<number>;
  materials: () => Set<number>;
}

export function testKit(tier: QualityTier = 'medium', maxParticles = 4000) {
  const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const mat = vi.spyOn(THREE.Material.prototype, 'dispose');
  const track: Tracking = {
    geometries: () => new Set(geo.mock.contexts.map((g) => (g as THREE.BufferGeometry).id)),
    materials: () => new Set(mat.mock.contexts.map(materialId)),
  };
  const start = nextIds();
  const kit = new SceneKit({
    tier,
    segments: tier === 'high' ? 24 : tier === 'medium' ? 16 : 8,
    maxParticles,
    token: () => '#808080',
  });
  return { kit, track, start };
}

/** Disposes the kit and checks that everything created since `start` was freed. */
export function expectAllFreed(
  kit: SceneKit,
  track: Tracking,
  start: { geometry: number; material: number },
): void {
  const end = nextIds();
  kit.dispose();
  const between = (a: number, b: number) => Array.from({ length: b - a - 1 }, (_, k) => a + 1 + k);
  const geos = between(start.geometry, end.geometry);
  const mats = between(start.material, end.material);
  const freedGeo = track.geometries();
  const freedMat = track.materials();
  expect(
    geos.filter((id) => !freedGeo.has(id)),
    'geometries not freed',
  ).toEqual([]);
  expect(
    mats.filter((id) => !freedMat.has(id)),
    'materials not freed',
  ).toEqual([]);
  expect(kit.scene.children).toHaveLength(0);
  vi.restoreAllMocks();
}
