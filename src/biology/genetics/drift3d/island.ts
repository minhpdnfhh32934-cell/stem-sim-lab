/**
 * The ground, sea and p : q bands of the genetic drift archipelago (one draw call each):
 *
 * - `islandGround`: every island's low-poly dome (grass on top, a sand beach, wet sand under the
 *   water), flat shaded with vertex colours from the habitat tokens. When the model fixes or loses
 *   A on an island, its grass is recoloured towards that allele's colour (A or a): the habitat
 *   changes colour with the island's fate. The beaches keep their sand.
 * - `sea`: a translucent water surface over a darker sea floor, so the shallows round each island
 *   read lighter; fog hides its far edge.
 * - `pqBands`: one band round each coast split exactly p : q at the generation shown (A's arc
 *   from the front, clockwise seen from above), rewritten in place without allocation.
 *
 * Shapes and colours of land and water are illustration; the fate and p come from the model.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import type { SceneKit } from '../../view3d/kit';
import { fbm3 } from '../../view3d/noise';
import { noiseTile } from '../../view3d/recipes';
import type { Fate } from './binding';
import {
  BAND_GAP,
  BAND_HEIGHT,
  BAND_WIDTH,
  coastAt,
  coastMax,
  islandHeight,
  type DriftLayout,
  type IslandPlace,
} from './layout';

/** How far a fixed island's grass is drawn towards the allele's colour. */
export const FATE_TINT = 0.58;

/** Radii (share of the coast at each angle) of the ground rings per tier: denser at the beach. */
const RINGS: Record<QualityTier, readonly number[]> = {
  low: [0.35, 0.62, 0.8, 0.92, 1.02, 1.14, 1.32],
  medium: [0.22, 0.42, 0.6, 0.74, 0.84, 0.92, 0.98, 1.04, 1.12, 1.32],
  high: [0.16, 0.32, 0.47, 0.6, 0.71, 0.8, 0.87, 0.93, 0.98, 1.02, 1.07, 1.14, 1.22, 1.34],
};
const SIDES: Record<QualityTier, number> = { low: 24, medium: 36, high: 52 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface IslandGround {
  mesh: THREE.Mesh;
  /** Ground height at (x, z) on the nearest island (world). */
  heightAt(x: number, z: number): number;
  /** Recolours an island's grass for its fate (no change when the fate is the same). */
  setFate(island: number, fate: Fate): void;
  /** The fate each island is drawn with now (read back for tests). */
  fates(): readonly Fate[];
  /** The island a ray hit on the ground (`faceIndex` of the hit), or null. */
  islandOfFace(face: number): number | null;
  /** An island's mean grass colour now (r, g, b in 0…1; for tests). */
  grassColor(island: number): [number, number, number];
}

export function islandGround(
  kit: SceneKit,
  L: DriftLayout,
  colors: { A: string; a: string },
): IslandGround {
  const rings = RINGS[kit.tier];
  const sides = SIDES[kit.tier];
  const col = (name: string) => new THREE.Color(kit.color(name));
  const grass = col('--bio3d-grass');
  const grass2 = col('--bio3d-grass-2');
  const sand = col('--bio3d-sand');
  const wet = sand.clone().lerp(col('--bio3d-soil'), 0.35);
  const fateColor = { A: new THREE.Color(colors.A), a: new THREE.Color(colors.a) };

  // Triangles per island: a fan round the centre, then two per quad of each further ring.
  const tris = sides * (1 + 2 * (rings.length - 1));
  const perIsland = tris * 3;
  const n = perIsland * L.islands.length;
  const pos = new Float32Array(n * 3);
  const base = new Float32Array(n * 3);
  const weight = new Float32Array(n);
  const tmp = new THREE.Color();

  const point = (is: IslandPlace, ring: number, side: number): [number, number, number] => {
    if (ring < 0) return [is.x, islandHeight(is, is.x, is.z), is.z];
    const a = (side / sides) * Math.PI * 2;
    const r = (rings[ring] ?? 1) * coastAt(is, a);
    const x = is.x + Math.cos(a) * r;
    const z = is.z + Math.sin(a) * r;
    return [x, islandHeight(is, x, z), z];
  };

  let v = 0;
  const put = (is: IslandPlace, p: [number, number, number]) => {
    pos[v * 3] = p[0];
    pos[v * 3 + 1] = p[1];
    pos[v * 3 + 2] = p[2];
    const h = p[1];
    const mix = 0.5 + 0.5 * fbm3(p[0] * 0.45, 3, p[2] * 0.45, is.seed + 2, 2);
    tmp.copy(grass).lerp(grass2, Math.min(1, Math.max(0, mix)));
    const beach = 1 - smooth(0.07, 0.2, h);
    tmp.lerp(sand, beach);
    tmp.lerp(wet, smooth(-0.02, -0.25, h));
    base[v * 3] = tmp.r;
    base[v * 3 + 1] = tmp.g;
    base[v * 3 + 2] = tmp.b;
    weight[v] = 1 - beach;
    v++;
  };
  for (const is of L.islands) {
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      // Counter-clockwise seen from above (+y): the faces look up.
      put(is, point(is, -1, 0));
      put(is, point(is, 0, s1));
      put(is, point(is, 0, s));
      for (let k = 1; k < rings.length; k++) {
        const a = point(is, k - 1, s);
        const b = point(is, k - 1, s1);
        const c = point(is, k, s);
        const d = point(is, k, s1);
        put(is, a);
        put(is, b);
        put(is, c);
        put(is, b);
        put(is, d);
        put(is, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const colorAttr = new THREE.BufferAttribute(base.slice(), 3);
  g.setAttribute('color', colorAttr);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const material = kit.shared(
    'drift-ground-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
        envMapIntensity: 0.3,
      }),
  );
  const mesh = kit.mesh(kit.geometry(g), material);
  mesh.name = 'drift-islands';
  mesh.receiveShadow = kit.shadows;

  const fates: Fate[] = L.islands.map(() => 'polymorphic');
  const near = (x: number, z: number) => {
    let best = L.islands[0];
    let d = Infinity;
    for (const is of L.islands) {
      const e = Math.hypot(x - is.x, z - is.z);
      if (e < d) {
        d = e;
        best = is;
      }
    }
    return best;
  };
  const colorsOf = colorAttr.array as Float32Array;

  return {
    mesh,
    heightAt(x, z) {
      const is = near(x, z);
      return is ? islandHeight(is, x, z) : 0;
    },
    setFate(island, fate) {
      if (fates[island] === fate || island < 0 || island >= fates.length) return;
      fates[island] = fate;
      const to = fate === 'fixed' ? fateColor.A : fate === 'lost' ? fateColor.a : null;
      for (let i = island * perIsland; i < (island + 1) * perIsland; i++) {
        const k = to ? FATE_TINT * (weight[i] ?? 0) : 0;
        for (let c = 0; c < 3; c++) {
          const b = base[i * 3 + c] ?? 0;
          const t = to ? (c === 0 ? to.r : c === 1 ? to.g : to.b) : b;
          colorsOf[i * 3 + c] = b + (t - b) * k;
        }
      }
      colorAttr.needsUpdate = true;
    },
    fates: () => fates,
    islandOfFace(face) {
      const i = Math.floor((face * 3) / perIsland);
      return i >= 0 && i < L.islands.length ? i : null;
    },
    grassColor(island) {
      // The island's centre fan (all grass).
      const out: [number, number, number] = [0, 0, 0];
      const start = island * perIsland;
      for (let c = 0; c < 3; c++) out[c] = colorsOf[start * 3 + c] ?? 0;
      return out;
    },
  };
}

/**
 * The sea (illustration): an opaque surface with soft ripples out to `radius`, and round each
 * island a halo of shallow water fading from the beach's sand into the sea.
 */
export function sea(kit: SceneKit, radius: number, L: DriftLayout): THREE.Mesh {
  const water = new THREE.Color(kit.color('--bio3d-water'));
  const sand = new THREE.Color(kit.color('--bio3d-sand'));
  const segs = Math.max(48, kit.seg * 4);
  const ripples = kit.keep(noiseTile(kit).clone());
  ripples.wrapS = THREE.RepeatWrapping;
  ripples.wrapT = THREE.RepeatWrapping;
  ripples.repeat.set(radius / 3, radius / 3);
  ripples.needsUpdate = true;
  const surface = kit.mesh(
    kit.geometry(new THREE.CircleGeometry(radius, segs).rotateX(-Math.PI / 2)),
    kit.own(
      new THREE.MeshStandardMaterial({
        color: water,
        roughness: 0.2,
        metalness: 0,
        envMapIntensity: 0.75,
        // Ripples: a bump map on High; below it (integrated GPUs) only the sheen varies (one
        // texture read per pixel instead of the bump map's three and their derivatives).
        ...(kit.tier === 'high'
          ? { bumpMap: ripples, bumpScale: 0.9 }
          : { roughnessMap: ripples, roughness: 0.32 }),
      }),
    ),
  );
  surface.name = 'drift-sea';
  surface.raycast = () => undefined;
  surface.receiveShadow = kit.shadows;

  // Shallows: an annulus per island from under the beach out into the sea, sand-tinted water
  // fading to clear (vertex alpha), drawn just over the surface.
  const shallow = water.clone().lerp(sand, 0.5);
  const sides = SIDES[kit.tier];
  const radii = [0.9, 1.08, 1.2, 1.36];
  const alpha = [0.9, 0.75, 0.35, 0];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const is of L.islands) {
    const v0 = pos.length / 3;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const c = coastAt(is, a);
      radii.forEach((u, k) => {
        pos.push(is.x + Math.cos(a) * c * u, 0.012, is.z + Math.sin(a) * c * u);
        col.push(shallow.r, shallow.g, shallow.b, alpha[k] ?? 0);
      });
    }
    const n = radii.length;
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      for (let k = 0; k < n - 1; k++) {
        const a = v0 + s * n + k;
        const b = v0 + s1 * n + k;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const halo = kit.mesh(
    kit.geometry(g),
    kit.own(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.3,
        envMapIntensity: 0.55,
      }),
    ),
  );
  halo.name = 'drift-shallows';
  halo.renderOrder = 1;
  halo.raycast = () => undefined;
  return surface;
}

export interface PqBands {
  mesh: THREE.Mesh;
  /** Splits island `i`'s band at frequency p (A's arc from the front). */
  set(island: number, p: number): void;
  /** The split each band shows now (for tests). */
  shown(): readonly number[];
  islandOfFace(face: number): number | null;
}

/** Steps (quads) per arc of a band. */
const STEPS: Record<QualityTier, number> = { low: 24, medium: 40, high: 64 };
/** Vertices per step edge: inner bottom, inner top, outer top, outer bottom. */
const EDGE = 4;

export function pqBands(kit: SceneKit, L: DriftLayout, colors: { A: string; a: string }): PqBands {
  const steps = STEPS[kit.tier];
  const perArc = (steps + 1) * EDGE;
  const perIsland = 2 * perArc;
  const nIslands = L.islands.length;
  const pos = new Float32Array(perIsland * nIslands * 3);
  const col = new Float32Array(perIsland * nIslands * 3);
  const idx: number[] = [];
  const A = new THREE.Color(colors.A);
  const a = new THREE.Color(colors.a);
  for (let i = 0; i < nIslands; i++) {
    for (let arc = 0; arc < 2; arc++) {
      const c = arc === 0 ? A : a;
      const v0 = i * perIsland + arc * perArc;
      for (let k = 0; k <= steps; k++)
        for (let e = 0; e < EDGE; e++) {
          const v = v0 + k * EDGE + e;
          col[v * 3] = c.r;
          col[v * 3 + 1] = c.g;
          col[v * 3 + 2] = c.b;
        }
      for (let k = 0; k < steps; k++) {
        const p = v0 + k * EDGE;
        const q = p + EDGE;
        // Inner wall, top, outer wall (two triangles each).
        for (const [e0, e1] of [
          [0, 1],
          [1, 2],
          [2, 3],
        ] as const)
          idx.push(p + e0, q + e0, p + e1, p + e1, q + e0, q + e1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', posAttr);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  const mesh = kit.mesh(
    kit.geometry(g),
    kit.shared(
      'drift-band-mat',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          flatShading: true,
          // Walls seen from inside and out (flat shading takes the face's own normal).
          side: THREE.DoubleSide,
          roughness: 0.45,
          envMapIntensity: 0.6,
        }),
    ),
  );
  mesh.name = 'drift-bands';
  mesh.castShadow = kit.shadows;
  const shown = L.islands.map(() => -1);
  const FRONT = Math.PI / 2;

  const writeArc = (i: number, arc: number, from: number, to: number) => {
    const is = L.islands[i];
    if (!is) return;
    const r0 = coastMax(is) + BAND_GAP;
    const r1 = r0 + BAND_WIDTH;
    const v0 = i * perIsland + arc * perArc;
    for (let k = 0; k <= steps; k++) {
      const t = from + ((to - from) * k) / steps;
      const cx = Math.cos(t);
      const sz = Math.sin(t);
      const ring: [number, number][] = [
        [r0, -0.06],
        [r0, BAND_HEIGHT],
        [r1, BAND_HEIGHT],
        [r1, -0.06],
      ];
      ring.forEach(([r, y], e) => {
        const v = v0 + k * EDGE + e;
        pos[v * 3] = is.x + cx * r;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = is.z + sz * r;
      });
    }
  };

  const set = (i: number, p: number) => {
    const q = Math.min(1, Math.max(0, p));
    if (shown[i] === q) return;
    shown[i] = q;
    const split = FRONT + q * Math.PI * 2;
    writeArc(i, 0, FRONT, split);
    writeArc(i, 1, split, FRONT + Math.PI * 2);
    posAttr.needsUpdate = true;
    g.boundingSphere = null;
  };
  for (let i = 0; i < nIslands; i++) set(i, 0.5);
  g.computeBoundingSphere();

  return {
    mesh,
    set,
    shown: () => shown,
    islandOfFace(face) {
      const v = idx[face * 3];
      if (v === undefined) return null;
      const i = Math.floor(v / perIsland);
      return i >= 0 && i < nIslands ? i : null;
    },
  };
}
