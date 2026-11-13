import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROPS } from '../../../gameplay/props';
import { Palette } from '../palette';
import { HUB_PROPS } from './hub';
import { attachParts, castsShadow, PROP_BUILDERS, PropCache } from './index';
import { testItem } from './testing';

// The registry the renderer resolves `visual.prop` through, and how a prop's parts are shared:
// built once per size, its non-body parts as children of an entity's mesh, shadows by one rule.

describe('the prop registry', () => {
  it('builds only props of the closed list, every hub prop among them', () => {
    for (const prop of Object.keys(PROP_BUILDERS)) expect(PROPS).toContain(prop);
    for (const prop of Object.keys(HUB_PROPS)) expect(PROP_BUILDERS).toHaveProperty(prop);
  });

  it('builds a prop once per size, shares it, and frees it with the cache', () => {
    const cache = new PropCache();
    const parts = cache.get('column', [0.7, 9, 0.7]);
    expect(parts).not.toBeNull();
    expect(cache.get('column', [0.7, 9, 0.7])).toBe(parts);
    const other = cache.get('column', [0.5, 4, 0.5]);
    expect(other).not.toBe(parts);
    const freed = new Set<THREE.BufferGeometry>();
    for (const { geometry } of [...(parts ?? []), ...(other ?? [])])
      geometry.addEventListener('dispose', () => freed.add(geometry));
    cache.dispose();
    expect(freed.size).toBe((parts?.length ?? 0) + (other?.length ?? 0));
    expect(cache.get('column', [0.7, 9, 0.7])).not.toBe(parts); // built again after
  });

  it('has no parts for a prop without a builder (drawn as its primitive)', () => {
    const cache = new PropCache();
    for (const prop of PROPS) {
      expect(cache.get(prop, [1, 1, 1]) === null).toBe(PROP_BUILDERS[prop] === undefined);
    }
  });

  it('dresses an entity mesh with the other parts, sharing their geometry and material', () => {
    const palette = new Palette();
    const item = testItem('desk', { size: [2.2, 1.1, 0.8], material: 'satin' });
    const parts = new PropCache().get('reception-desk', item.visual.size) ?? [];
    const body = parts.find((p) => p.finish === 'body');
    const mesh = new THREE.Mesh(body?.geometry, new THREE.MeshStandardMaterial());
    attachParts(mesh, parts, item, palette);
    expect(mesh.children).toHaveLength(parts.length - 1);
    mesh.children.forEach((child, i) => {
      const part = parts.filter((p) => p.finish !== 'body')[i];
      expect((child as THREE.Mesh).geometry).toBe(part?.geometry);
      if (part && part.finish !== 'body') {
        expect((child as THREE.Mesh).material).toBe(palette.finish(part.finish));
      }
      expect(child.castShadow).toBe(true); // worktop and plinth
    });
    expect(mesh.castShadow).toBe(true);
  });

  it('casts shadows only from parts that say so, never from lit or see-through ones', () => {
    const satin = testItem('satin', { material: 'satin' });
    const lit = testItem('lit', { material: 'light' });
    const glass = testItem('glass', { material: 'glass' });
    const geometry = new THREE.BufferGeometry();
    expect(castsShadow({ finish: 'body', geometry, casts: true }, satin)).toBe(true);
    expect(castsShadow({ finish: 'body', geometry, casts: false }, satin)).toBe(false);
    expect(castsShadow({ finish: 'body', geometry, casts: true }, lit)).toBe(false);
    expect(castsShadow({ finish: 'body', geometry, casts: true }, glass)).toBe(false);
    // A finish's own look decides, whatever the item's.
    expect(castsShadow({ finish: 'steel', geometry, casts: true }, lit)).toBe(true);
    expect(castsShadow({ finish: 'glow-warm', geometry, casts: true }, satin)).toBe(false);
    expect(castsShadow({ finish: 'emblem-glow', geometry, casts: true }, satin)).toBe(false);
  });
});
