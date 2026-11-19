import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shareTextures } from './CityView';

// The city's models share pictures; each model's loader made its own texture of each (2026-11-14):
// one texture per picture for the whole city, uploaded once.

/** A loaded model of one mesh whose material has `maps`, each from the picture named for it. */
function model(maps: Partial<Record<'map' | 'normalMap', [THREE.Texture, string]>>) {
  const material = new THREE.MeshStandardMaterial();
  const images: { uri: string }[] = [];
  const textures: { source: number }[] = [];
  const associations = new Map<unknown, { textures?: number }>();
  for (const [slot, [texture, uri]] of Object.entries(maps)) {
    material[slot as 'map'] = texture;
    images.push({ uri });
    textures.push({ source: images.length - 1 });
    associations.set(texture, { textures: textures.length - 1 });
  }
  const scene = new THREE.Group().add(new THREE.Mesh(new THREE.BufferGeometry(), material));
  return { scene, parser: { json: { images, textures }, associations }, material };
}

describe('the city under the glass', () => {
  it('uses one texture for a picture every model has, and keeps those that differ', () => {
    const brick = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
    const normal = [new THREE.Texture(), new THREE.Texture()];
    normal[1]!.colorSpace = THREE.SRGBColorSpace; // the same picture used another way
    const a = model({
      map: [brick[0]!, 'T_RedBrick_BaseColor.jpg'],
      normalMap: [normal[0]!, 'N.jpg'],
    });
    const b = model({
      map: [brick[1]!, 'T_RedBrick_BaseColor.jpg'],
      normalMap: [normal[1]!, 'N.jpg'],
    });
    const c = model({ map: [brick[2]!, 'T_Trim_BaseColor.jpg'] });
    const loose = new THREE.Texture(); // not from a picture of the model (no association)
    c.material.normalMap = loose;
    shareTextures([a, b, c]);
    expect(b.material.map).toBe(brick[0]);
    expect(a.material.map).toBe(brick[0]);
    expect(b.material.normalMap).toBe(normal[1]); // not the same setting: its own
    expect(c.material.map).toBe(brick[2]); // another picture
    expect(c.material.normalMap).toBe(loose);
  });
});
