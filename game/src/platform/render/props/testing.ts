// Test helpers for prop builders (imported only by *.test.ts files).
import * as THREE from 'three';
import { expect } from 'vitest';
import { type ItemDefinition, ItemDefinitionSchema } from '../../../gameplay/item';
import type { PropPart } from './parts';

/** An item as content would define it: a grey 1 m box unless `fields` or `visual` say otherwise. */
export const testItem = (
  id: string,
  visual: Record<string, unknown> = {},
  fields: Record<string, unknown> = {},
): ItemDefinition =>
  ItemDefinitionSchema.parse({
    id,
    displayName: id,
    category: 'structure',
    physical: { massKg: 1, body: 'none' },
    ...fields,
    visual: { shape: 'box', size: [1, 1, 1], color: '#808080', ...visual },
  });

/** Floats stored as float32: what "exactly on the box" may miss by. */
export const EPSILON = 1e-6;

/**
 * What every prop's parts must be at a size (the pattern of consoleModel.test.ts): one geometry
 * per finish and exactly one body; indexed triangles, indices in range; finite positions; unit
 * normals; inside the item's box (a cylinder's: inside its radius; a sphere's: its ball).
 */
export function expectProp(
  parts: readonly PropPart[],
  shape: ItemDefinition['visual']['shape'],
  size: readonly number[],
): void {
  const [w = 0, h = 0, d = 0] = size;
  expect(parts.filter((p) => p.finish === 'body' && !p.hinge)).toHaveLength(1);
  // One part per finish and leaf (a leaf's parts share its hinge).
  const hinges = [...new Set(parts.map((p) => p.hinge))];
  expect(new Set(parts.map((p) => `${p.finish} ${hinges.indexOf(p.hinge)}`)).size).toBe(
    parts.length,
  );
  for (const { finish, geometry } of parts) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex();
    expect(normal.count, finish).toBe(position.count);
    expect(index, finish).not.toBeNull();
    let [finite, normalError, outside, maxIndex] = [true, 0, -Infinity, 0];
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      finite &&= Number.isFinite(x + y + z);
      normalError = Math.max(
        normalError,
        Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1),
      );
      const across =
        shape === 'box'
          ? Math.max(Math.abs(x) - w / 2, Math.abs(z) - d / 2, Math.abs(y) - h / 2)
          : shape === 'cylinder'
            ? Math.max(Math.hypot(x, z) - w / 2, Math.abs(y) - h / 2)
            : Math.hypot(x, y, z) - w / 2;
      outside = Math.max(outside, across);
    }
    for (let i = 0; i < (index?.count ?? 0); i++)
      maxIndex = Math.max(maxIndex, index?.getX(i) ?? 0);
    expect(finite, `${finish}: finite`).toBe(true);
    expect(normalError, `${finish}: unit normals`).toBeLessThan(1e-5);
    expect(outside, `${finish}: inside the box`).toBeLessThanOrEqual(EPSILON);
    expect((index?.count ?? 0) % 3, finish).toBe(0);
    expect(index?.count ?? 0, `${finish}: has triangles`).toBeGreaterThan(0);
    expect(maxIndex, `${finish}: indices in range`).toBeLessThan(position.count);
  }
}

/** The triangles a prop's parts draw per copy. */
export const triangles = (parts: readonly PropPart[]) =>
  parts.reduce((sum, { geometry }) => sum + (geometry.getIndex()?.count ?? 0) / 3, 0);

/** The axis-aligned box round a part's geometry. */
export function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox ?? new THREE.Box3();
}
