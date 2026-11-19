import * as THREE from 'three';
import { BLOCK, PERIOD, STREET } from '../render/city/layout';
import { CITY_RINGS } from '../render/city/CityView';
import { FLAT_RADIUS, landHeight, woodsAt } from './land';
import { random } from './random';

/*
 * Trees (Phase W): street trees along the city's kerbs, between its lamps, and woods on the hills
 * where the land is wooded (`woodsAt`, the same mask that darkens the land there). Two kinds — a
 * round broadleaf and a conifer — each one instanced mesh, every tree its own size, lean and shade.
 * Positions are pure (tested); the city's frame (y 0 the street).
 */

export interface TreeSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Height (m). */
  readonly h: number;
  readonly conifer: boolean;
  /** 0–1: its shade and turn. */
  readonly seed: number;
}

/** How far off a street's centre line a street tree stands (m): the kerb side of the sidewalk. */
const KERB = 9.9;

/** The city's street trees: two to each block side, each sidewalk, between the lamps. */
export function streetTrees(): TreeSpot[] {
  const rnd = random(31);
  const rings = CITY_RINGS.full.rings;
  const out: TreeSpot[] = [];
  for (let a = -rings; a <= rings; a++) {
    for (let b = -rings; b < rings; b++) {
      for (const along of [BLOCK / 3, (2 * BLOCK) / 3]) {
        const s = b * PERIOD + STREET / 2 + along;
        for (const side of [-1, 1]) {
          for (const [x, z] of [
            [a * PERIOD + side * KERB, s],
            [s, a * PERIOD + side * KERB],
          ] as const) {
            out.push({ x, y: 0, z, h: 7 + rnd() * 4, conifer: false, seed: rnd() });
          }
        }
      }
    }
  }
  return out;
}

/** Woods on the land round the city: a jittered grid, kept where the land is wooded. */
export function woodTrees(reach = 3600, spacing = 24): TreeSpot[] {
  const rnd = random(57);
  const out: TreeSpot[] = [];
  for (let x = -reach; x <= reach; x += spacing) {
    for (let z = -reach; z <= reach; z += spacing) {
      const px = x + (rnd() - 0.5) * spacing;
      const pz = z + (rnd() - 0.5) * spacing;
      const r = Math.hypot(px, pz);
      if (r < FLAT_RADIUS + 140 || r > reach) continue;
      const woods = woodsAt(px, pz);
      if (rnd() > woods * 0.95) continue;
      const y = landHeight(px, pz);
      if (y > 420) continue; // the tree line
      out.push({ x: px, y, z: pz, h: 9 + rnd() * 9, conifer: rnd() < 0.35 + y / 900, seed: rnd() });
    }
  }
  return out;
}

/** A broadleaf: a trunk and a lumpy crown, its underside darker (vertex colours), ~1 m tall. */
function broadleaf(detail: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.035, 0.055, 0.45, 6).translate(0, 0.225, 0);
  const crown = new THREE.IcosahedronGeometry(0.36, detail);
  const p = crown.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const bump = 1 + 0.16 * Math.sin(v.x * 17 + v.y * 11) * Math.cos(v.z * 13 - v.y * 7);
    v.multiplyScalar(bump).multiply(new THREE.Vector3(1, 1.12, 1));
    p.setXYZ(i, v.x, v.y + 0.66, v.z);
  }
  crown.computeVertexNormals();
  return paint(trunk, crown, 0.3, 1.05);
}

/** A conifer: a trunk and three stacked cones, ~1 m tall. */
function conifer(sides: number): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.03, 0.045, 0.3, 6).translate(0, 0.15, 0);
  const cones = [
    new THREE.ConeGeometry(0.3, 0.45, sides).translate(0, 0.42, 0),
    new THREE.ConeGeometry(0.24, 0.38, sides).translate(0, 0.62, 0),
    new THREE.ConeGeometry(0.16, 0.32, sides).translate(0, 0.84, 0),
  ];
  const crown = mergeAll(cones);
  return paint(trunk, crown, 0.2, 1.0);
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of nonIndexed) count += g.getAttribute('position').count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  let o = 0;
  for (const g of nonIndexed) {
    positions.set(g.getAttribute('position').array, o * 3);
    normals.set(g.getAttribute('normal').array, o * 3);
    o += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return out;
}

/** Bark brown on the trunk; the crown dark underneath, lit green on top. */
function paint(
  trunk: THREE.BufferGeometry,
  crown: THREE.BufferGeometry,
  low: number,
  high: number,
): THREE.BufferGeometry {
  const merged = mergeAll([trunk, crown]);
  const p = merged.getAttribute('position');
  const trunkCount = (trunk.index ? trunk.toNonIndexed() : trunk).getAttribute('position').count;
  const colors = new Float32Array(p.count * 3);
  const bark = new THREE.Color('#2e241b');
  const leaf = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    if (i < trunkCount) {
      colors.set([bark.r, bark.g, bark.b], i * 3);
      continue;
    }
    const t = THREE.MathUtils.clamp((p.getY(i) - low) / (high - low), 0, 1);
    // Linear values: a dark underside, sunlit green on top.
    leaf.setRGB(0.025 + 0.035 * t, 0.05 + 0.06 * t, 0.018 + 0.016 * t);
    colors.set([leaf.r, leaf.g, leaf.b], i * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

export interface Trees {
  readonly group: THREE.Group;
  dispose(): void;
}

/** Tiles of woods (m): each its own mesh, so what is out of view is not drawn. */
const TILE = 500;
/** Past this from the roof (m) a tile's trees are the simple ones: a few pixels each. */
const NEAR_TILES = 900;

/**
 * The trees drawn: instanced by kind, in tiles that the camera culls one by one; tiles near the
 * roof (`viewer`, the city's frame) get the lumpy crowns, far ones a few faces each.
 */
export function treeMeshes(
  spots: readonly TreeSpot[],
  castShadow: boolean,
  viewer: { x: number; z: number },
): Trees {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const shapes = { near: [broadleaf(1), conifer(8)], far: [broadleaf(0), conifer(5)] };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const tint = new THREE.Color();
  const tiles = new Map<string, TreeSpot[]>();
  for (const s of spots) {
    const key = `${Math.floor(s.x / TILE)},${Math.floor(s.z / TILE)}`;
    const list = tiles.get(key);
    if (list) list.push(s);
    else tiles.set(key, [s]);
  }
  for (const [key, list] of tiles) {
    const [i, j] = key.split(',').map(Number) as [number, number];
    const near = Math.hypot((i + 0.5) * TILE - viewer.x, (j + 0.5) * TILE - viewer.z) < NEAR_TILES;
    const [leafy, pointy] = near ? shapes.near : shapes.far;
    for (const [geometry, conifers] of [
      [leafy, false],
      [pointy, true],
    ] as const) {
      const mine = list.filter((s) => s.conifer === conifers);
      if (mine.length === 0 || !geometry) continue;
      const mesh = new THREE.InstancedMesh(geometry, material, mine.length);
      mine.forEach((s, k) => {
        const lean = (s.seed - 0.5) * 0.08;
        e.set(lean, s.seed * Math.PI * 2, -lean);
        q.setFromEuler(e);
        const w = s.h * (0.85 + 0.3 * ((s.seed * 7.3) % 1));
        mesh.setMatrixAt(k, m.compose(pos.set(s.x, s.y - 0.2, s.z), q, scale.set(w, s.h, w)));
        const shade = 0.8 + 0.4 * ((s.seed * 13.7) % 1);
        tint.setRGB(shade * (0.95 + 0.1 * ((s.seed * 3.1) % 1)), shade, shade * 0.95);
        mesh.setColorAt(k, tint);
      });
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return {
    group,
    dispose: () => {
      for (const g of [...shapes.near, ...shapes.far]) g.dispose();
      material.dispose();
    },
  };
}
