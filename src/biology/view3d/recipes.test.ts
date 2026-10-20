import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QualityTier } from '@/perf/tiers';
import { oklch } from '@/ui/three/color';
import { LAYER, assignLayers } from '@/ui/three/layers';
import { SceneKit } from './kit';
import { NOISE_SIZE, noiseTexture } from './noise';
import { ROLES, STRUCTURES, muted } from './palette';
import { BLOB_DETAIL, icosphere, proteinBlob } from './proteinBlob';
import {
  annotation,
  backboneGeometry,
  backboneMaterial,
  bakeContactAO,
  basePairHalfGeometry,
  basePairMaterial,
  chromosome,
  glassware,
  highlight,
  kinetochore,
  liquid,
  membrane,
  meniscusGeometry,
  organismGeometry,
  organismMaterial,
  particleMaterial,
  protein,
  proteinMaterial,
  shell,
  stateRing,
  terrain,
} from './recipes';
import { expectAllFreed, testKit } from './testing';

/** Hex tokens of a theme, read from the stylesheet (no browser needed). */
const CSS = readFileSync(resolve(__dirname, '../../app/theme/tokens.css'), 'utf8');
function block(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  const end = CSS.indexOf('\n}', start);
  const out = new Map<string, string>();
  for (const m of CSS.slice(start, end).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6}|[0-9.]+)\b/g))
    if (m[1] && m[2]) out.set(m[1], m[2]);
  return out;
}
const ROOT = block(':root {');
const THEME = {
  light: new Map([...ROOT, ...block(":root[data-theme='light']")]),
  dark: new Map([...ROOT, ...block(":root[data-theme='dark']")]),
};
const tokenOf = (theme: 'light' | 'dark') => (name: string) => THEME[theme].get(name) ?? '';

function kitFor(
  tier: QualityTier,
  o: { transmission?: boolean; hdr?: boolean; theme?: 'light' | 'dark' } = {},
): SceneKit {
  return new SceneKit({
    tier,
    segments: tier === 'high' ? 24 : 16,
    maxParticles: 4000,
    token: tokenOf(o.theme ?? 'light'),
    transmission: o.transmission ?? false,
    hdr: o.hdr ?? false,
  });
}

const hex = (m: THREE.Material) => `#${(m as THREE.MeshStandardMaterial).color.getHexString()}`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('material recipes: tier → material class', () => {
  it('Medium: standard materials; see-through shells in two draws on the SHELL layer', () => {
    const kit = kitFor('medium');
    expect(chromosome(kit, '#d55e00')).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(proteinMaterial(kit)).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const geo = kit.sphere();
    const g = membrane(kit, geo, { radius: 4, outermost: true });
    expect(g.children).toHaveLength(2);
    const [back, front] = g.children as THREE.Mesh[];
    expect((back!.material as THREE.Material).side).toBe(THREE.BackSide);
    expect((back!.material as THREE.Material).opacity).toBeCloseTo(0.07, 6);
    expect((front!.material as THREE.Material).side).toBe(THREE.FrontSide);
    // The theme's membrane opacity (light: 0.2).
    expect((front!.material as THREE.Material).opacity).toBeCloseTo(0.2, 6);
    assignLayers(kit.scene);
    for (const m of g.children) expect(m.layers.mask).toBe(1 << LAYER.SHELL);
    kit.dispose();
  });

  it('High without a discrete GPU: physical materials, no refraction', () => {
    const kit = kitFor('high');
    const c = chromosome(kit, '#d55e00');
    expect(c).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((c as THREE.MeshPhysicalMaterial).sheen).toBe(0.7);
    expect(c.roughness).toBe(0.55);
    expect(c.bumpMap).toBeInstanceOf(THREE.DataTexture);
    const g = shell(kit, kit.sphere(), '#7fa0a0', { radius: 3, outermost: true });
    expect(g.children).toHaveLength(2);
    expect(glassware(kit).refract).toBeNull();
    kit.dispose();
  });

  it('High on a discrete GPU: only the outermost shell and glassware refract', () => {
    const kit = kitFor('high', { transmission: true });
    const outer = shell(kit, kit.sphere(), '#7fa0a0', { radius: 4, outermost: true });
    expect(outer.children).toHaveLength(1);
    const m = (outer.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    expect(m.transmission).toBe(0.9);
    expect(m.thickness).toBeCloseTo(0.6, 6);
    expect(m.ior).toBe(1.36);
    expect(m.attenuationDistance).toBe(8);
    expect(m.clearcoat).toBe(0.6);
    // Refracting shells are drawn with the opaque scene they refract (GLASS), still kept out of
    // ambient occlusion.
    assignLayers(kit.scene);
    expect(outer.children[0]!.layers.mask).toBe(1 << LAYER.GLASS);
    expect(outer.children[0]!.layers.isEnabled(LAYER.OPAQUE)).toBe(false);
    const inner = shell(kit, kit.sphere(), '#7fa0a0', { radius: 2 });
    expect(inner.children).toHaveLength(2);
    const glass = glassware(kit).refract;
    expect(glass?.transmission).toBe(1);
    expect(glass?.ior).toBe(1.5);
    kit.dispose();
  });
});

describe('material recipes: data colours are the tokens, unchanged', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: albedo = token for every data role`, () => {
      const t = tokenOf(theme);
      const kit = kitFor('high', { theme });
      for (const role of ['solute', 'substrate', 'product', 'inhibitor'] as const) {
        expect(hex(particleMaterial(kit, role)), role).toBe(t(ROLES[role].token));
      }
      for (const b of ['baseA', 'baseT', 'baseG', 'baseC', 'baseU'] as const) {
        const color = t(ROLES[b].token);
        expect(hex(basePairMaterial(kit, color)), b).toBe(color);
      }
      expect(hex(chromosome(kit, t('--chart-4')))).toBe(t('--chart-4'));
      expect(hex(chromosome(kit, t('--chart-1')))).toBe(t('--chart-1'));
      expect(hex(stateRing(kit, 'inhibitor'))).toBe(t(ROLES.inhibitor.token));
      expect(hex(backboneMaterial(kit, 'template'))).toBe(t('--dna3d-template'));
      // Structures are muted: water is a muted --chart-6, never the solute colour.
      expect(hex(particleMaterial(kit, 'water'))).toBe(muted(t, '--chart-6'));
      expect(hex(proteinMaterial(kit))).toBe(t('--bio3d-protein'));
      expect(hex(liquid(kit))).toBe(t('--bio3d-liquid'));
      expect(hex(annotation(kit))).toBe(t('--text-muted'));
      kit.dispose();
    });
  }

  it('structures are less saturated than the data they hold', () => {
    for (const theme of ['light', 'dark'] as const) {
      const t = tokenOf(theme);
      const mem = oklch(muted(t, STRUCTURES.membrane.token));
      const bio = oklch(t('--subject-biology'));
      expect(mem!.C).toBeLessThan(bio!.C * 0.6);
      const chromosomeC = oklch(t('--chart-1'))!.C;
      expect(mem!.C).toBeLessThan(chromosomeC);
    }
  });

  /**
   * Colour identity: the frame shows a data colour as the legend does. Khronos PBR Neutral tone
   * mapping of the albedo, lit from dim to bright, keeps its hue within 8° (ACES or AgX would not).
   */
  it('Neutral tone mapping keeps every legend hue within 8° (both themes, dim to bright)', () => {
    const neutral = (c: [number, number, number]): [number, number, number] => {
      const x = Math.min(...c);
      const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
      let col = c.map((v) => v - offset) as [number, number, number];
      const peak = Math.max(...col);
      const start = 0.8 - 0.04;
      if (peak < start) return col;
      const d = 1 - start;
      const newPeak = 1 - (d * d) / (peak + d - start);
      col = col.map((v) => (v * newPeak) / peak) as [number, number, number];
      const g = 1 - 1 / (0.15 * (peak - newPeak) + 1);
      return col.map((v) => v * (1 - g) + newPeak * g) as [number, number, number];
    };
    const failures: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      for (const name of [
        '--chart-1',
        '--chart-2',
        '--chart-3',
        '--chart-4',
        '--chart-5',
        '--chart-6',
      ]) {
        const token = THEME[theme].get(name) ?? '';
        const lin = new THREE.Color(token);
        const want = oklch(token)!;
        for (const light of [0.5, 1, 1.4]) {
          const out = neutral([lin.r * light, lin.g * light, lin.b * light]);
          const shown = `#${new THREE.Color().setRGB(...out).getHexString()}`;
          const got = oklch(shown)!;
          const dh = Math.abs(((got.h - want.h + 540) % 360) - 180);
          if (dh >= 8) failures.push(`${theme} ${name} ×${String(light)}: Δhue ${dh.toFixed(1)}°`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('shapes', () => {
  it('icosphere: the counts of three.js detail 7 / 15, on the unit sphere, faces outwards', () => {
    for (const [level, verts, tris] of [
      [3, 642, 1280],
      [4, 2562, 5120],
    ] as const) {
      const g = icosphere(level);
      const pos = g.attributes.position as THREE.BufferAttribute;
      expect(pos.count).toBe(verts);
      expect((g.index?.count ?? 0) / 3).toBe(tris);
      g.computeVertexNormals();
      const nor = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        expect(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))).toBeCloseTo(1, 5);
        const d = pos.getX(i) * nor.getX(i) + pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i);
        expect(d).toBeGreaterThan(0.99);
      }
      g.dispose();
    }
  });

  it('protein blob: deterministic, 8–12 % bumps, cavities at most 20 % darker, cached per seed', () => {
    const a = proteinBlob('medium', { seed: 3 });
    const b = proteinBlob('medium', { seed: 3 });
    const c = proteinBlob('medium', { seed: 4 });
    const pa = Array.from((a.attributes.position as THREE.BufferAttribute).array);
    expect(pa).toEqual(Array.from((b.attributes.position as THREE.BufferAttribute).array));
    expect(pa).not.toEqual(Array.from((c.attributes.position as THREE.BufferAttribute).array));
    const pos = a.attributes.position as THREE.BufferAttribute;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    expect(lo).toBeGreaterThanOrEqual(0.9 - 1e-6);
    expect(hi).toBeLessThanOrEqual(1.1 + 1e-6);
    expect(hi - lo).toBeGreaterThan(0.05);
    const col = Array.from((a.attributes.color as THREE.BufferAttribute).array);
    expect(Math.min(...col)).toBeGreaterThanOrEqual(0.8 - 1e-6);
    expect(Math.max(...col)).toBeLessThanOrEqual(1);
    expect(Math.min(...col)).toBeLessThan(0.95);
    // Triangles: a level-3 icosphere (1280) on Medium, level 4 (5120) on High.
    expect(BLOB_DETAIL).toMatchObject({ medium: 7, high: 15 });
    expect((a.index?.count ?? 0) / 3).toBe(1280);
    for (const g of [a, b, c]) g.dispose();

    const kit = kitFor('medium');
    const m1 = protein(kit, { seed: 9 });
    const m2 = protein(kit, { seed: 9 });
    expect(m1.geometry).toBe(m2.geometry);
    const see = protein(kit, { seed: 9, seeThrough: true });
    expect((see.material as THREE.Material).opacity).toBe(0.55);
    expect(see.userData.layer).toBe(LAYER.SHELL);
    kit.dispose();
  });

  it('noise tile repeats without a seam and is not flat', () => {
    const tex = noiseTexture(5);
    const data = tex.image.data as Uint8Array;
    const at = (x: number, y: number) => data[4 * (y * NOISE_SIZE + x)] ?? 0;
    let edge = 0;
    for (let y = 0; y < NOISE_SIZE; y++)
      edge = Math.max(edge, Math.abs(at(0, y) - at(NOISE_SIZE - 1, y)));
    // Neighbours across the wrap differ as little as neighbours inside the tile.
    let inner = 0;
    for (let y = 0; y < NOISE_SIZE; y++) inner = Math.max(inner, Math.abs(at(31, y) - at(32, y)));
    expect(edge).toBeLessThanOrEqual(inner + 4);
    const values = new Set(Array.from(data).filter((_, k) => k % 4 === 0));
    expect(values.size).toBeGreaterThan(20);
    expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    tex.dispose();
  });

  it('organisms: white body, dark eyes, neutral feet (the instance tint multiplies)', () => {
    const kit = kitFor('medium');
    const g = organismGeometry(kit, 'predator');
    const col = Array.from((g.attributes.color as THREE.BufferAttribute).array, (v) =>
      Number(v.toFixed(3)),
    );
    expect(new Set(col)).toEqual(new Set([1, 0.08, 0.55]));
    expect(organismMaterial(kit).flatShading).toBe(true);
    expect(organismMaterial(kit).vertexColors).toBe(true);
    kit.dispose();
  });

  it('terrain colours come from the habitat tokens; the height function matches the mesh', () => {
    const kit = kitFor('medium');
    const t = terrain(kit, { radius: 10, seed: 2 });
    const pos = t.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 37) {
      expect(pos.getY(i)).toBeCloseTo(t.heightAt(pos.getX(i), pos.getZ(i)), 6);
    }
    expect(t.material.flatShading).toBe(true);
    expect(t.material.roughness).toBe(0.95);
    kit.dispose();
  });

  it('contact AO darkens the side facing the sister chromatid only', () => {
    const g = new THREE.SphereGeometry(1, 16, 12);
    bakeContactAO(g, [1, 0, 0]);
    const col = g.attributes.color as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < nor.count; i++) {
      if (nor.getX(i) > 0.99) expect(col.getX(i)).toBeCloseTo(0.85, 2);
      if (nor.getX(i) < 0) expect(col.getX(i)).toBe(1);
    }
    g.dispose();
  });

  it('highlight: ×1 emissive on Medium, ×3 and marked to bloom in HDR', () => {
    const med = kitFor('medium');
    const a = highlight(med, new THREE.MeshStandardMaterial());
    expect(a.emissiveIntensity).toBe(1);
    expect(a.userData.bloom).toBe(false);
    const hi = kitFor('high', { hdr: true });
    const b = highlight(hi, new THREE.MeshStandardMaterial());
    expect(b.emissiveIntensity).toBe(3);
    expect(b.userData.bloom).toBe(true);
    expect(`#${b.emissive.getHexString()}`).toBe(tokenOf('light')('--m3d-highlight'));
    a.dispose();
    b.dispose();
    med.dispose();
    hi.dispose();
  });
});

describe('recipes free everything with the kit', () => {
  for (const tier of ['medium', 'high'] as const) {
    it(`${tier}: geometries, materials and the noise tile`, () => {
      const tex = vi.spyOn(THREE.Texture.prototype, 'dispose');
      const { kit, track, start } = testKit(tier);
      membrane(kit, kit.sphere(), { radius: 2, outermost: true });
      chromosome(kit, '#d55e00');
      kinetochore(kit);
      backboneMaterial(kit, 'coding');
      kit.mesh(
        backboneGeometry(
          kit,
          [
            [0, 0, 0],
            [1, 1, 0],
            [2, 0, 1],
          ],
          'mrna',
          0.2,
        ),
        backboneMaterial(kit, 'mrna'),
      );
      kit.mesh(basePairHalfGeometry(kit, 'slab'), basePairMaterial(kit, '#009e73'));
      protein(kit, { seed: 1 });
      protein(kit, { seed: 2, seeThrough: true });
      particleMaterial(kit, 'water');
      glassware(kit);
      kit.mesh(meniscusGeometry(kit, 1, 0.1), liquid(kit));
      kit.instanced(organismGeometry(kit, 'prey'), organismMaterial(kit), 3);
      const ground = terrain(kit, { radius: 5, seed: 1 });
      kit.mesh(ground.geometry, ground.material);
      annotation(kit);
      const freedBefore = tex.mock.calls.length;
      expectAllFreed(kit, track, start);
      expect(tex.mock.calls.length).toBeGreaterThan(freedBefore);
    });
  }
});
