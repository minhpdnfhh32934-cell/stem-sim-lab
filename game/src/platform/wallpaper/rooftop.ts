import * as THREE from 'three';
import { TOWER } from './site';

/*
 * Our tower's roof (Phase W-1 blockout): the slab, the ledge Linh sits on (a cornice proud of the
 * facade, a metal coping on top), the parapets round the rest, and what a high roof carries —
 * cooling units, a water tank, a stair hut, a mast with its red light, vent pipes. Concrete is mottled by a painted texture, never one flat colour.
 */

/** The ledge's top (m) and its depth: from the facade's cornice (−z) to the roof (0). */
export const LEDGE = { top: 0.52, outer: -0.42, inner: 0 } as const;

export interface Rooftop {
  readonly group: THREE.Group;
  /** The mast's warning light (blinks): world position. */
  readonly beacon: THREE.Mesh;
  dispose(): void;
}

export function rooftop(): Rooftop {
  const group = new THREE.Group();
  group.name = 'wallpaper-roof';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
  const made = <T extends THREE.Material>(m: T) => (materials.push(m), m);

  const concreteMap = mottled(512, [92, 90, 87], 22, 7);
  const ledgeMap = mottled(512, [122, 119, 114], 18, 11);
  // Concrete's surface: pits, grit and trowel marks as a normal map (no flat, plastic sheen).
  const grain = concreteNormals(512, 5);
  const concrete = made(
    new THREE.MeshStandardMaterial({
      map: concreteMap,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.95,
    }),
  );
  const ledgeStone = made(
    new THREE.MeshStandardMaterial({
      map: ledgeMap,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.92,
      envMapIntensity: 0.5,
    }),
  );
  // The coping: cast stone, a shade darker and warmer than the wall below it (a steel cap, the
  // whole top mirrored the sky: blue, like plastic).
  const coping = made(
    new THREE.MeshStandardMaterial({
      map: ledgeMap,
      color: '#c9c2b6',
      normalMap: grain,
      normalScale: new THREE.Vector2(1, 1),
      roughness: 0.95,
      envMapIntensity: 0.35,
    }),
  );
  const metal = made(
    new THREE.MeshStandardMaterial({ color: '#b9bec3', roughness: 0.5, metalness: 0.7 }),
  );
  const darkMetal = made(
    new THREE.MeshStandardMaterial({ color: '#3b3f44', roughness: 0.55, metalness: 0.6 }),
  );
  const tankPaint = made(new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.7 }));
  const red = made(
    new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 3 }),
  );

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const w = TOWER.x1 - TOWER.x0;
  const d = TOWER.z1 - TOWER.z0;
  const cx = (TOWER.x0 + TOWER.x1) / 2;
  // The slab, its top the roof (y 0), mapped at a texel per ~2 cm.
  const slab = new THREE.BoxGeometry(w, 0.6, d);
  scaleUv(slab, w / 6, d / 6);
  add(slab, concrete, cx, -0.3, (TOWER.z0 + TOWER.z1) / 2);
  // The ledge: a cornice out past the facade, the coping on it.
  const ledgeDepth = LEDGE.inner - LEDGE.outer;
  const ledge = new THREE.BoxGeometry(w + 0.2, LEDGE.top - 0.03, ledgeDepth);
  scaleUv(ledge, w / 3, 1);
  add(ledge, ledgeStone, cx, (LEDGE.top - 0.03) / 2, (LEDGE.outer + LEDGE.inner) / 2);
  add(
    new THREE.BoxGeometry(w + 0.24, 0.03, ledgeDepth + 0.05),
    coping,
    cx,
    LEDGE.top - 0.015,
    (LEDGE.outer + LEDGE.inner) / 2,
  );
  // The cornice's drip edge under the ledge, proud of the glass below.
  add(new THREE.BoxGeometry(w + 0.2, 0.18, 0.16), ledgeStone, cx, -0.69, LEDGE.outer + 0.08);
  // The other three parapets, taller (1.1 m): only the front has the low ledge.
  for (const [px, pz, pw, pd] of [
    [TOWER.x0 - 0.1, (TOWER.z0 + TOWER.z1) / 2, 0.3, d],
    [TOWER.x1 + 0.1, (TOWER.z0 + TOWER.z1) / 2, 0.3, d],
    [cx, TOWER.z1 + 0.1, w + 0.5, 0.3],
  ] as const) {
    add(new THREE.BoxGeometry(pw, 1.1, pd), ledgeStone, px, 0.55, pz);
  }
  // Cooling units: a box, its fan's ring and grille on top.
  for (const [ux, uz] of [
    [7.5, 9],
    [10.4, 9],
    [7.5, 12.2],
  ] as const) {
    add(new THREE.BoxGeometry(2.4, 1.3, 2.6), metal, ux, 0.65, uz);
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 40), darkMetal, ux, 1.34, uz);
  }
  // The water tank on its legs.
  add(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 48), tankPaint, -10, 2.4, 14);
  add(new THREE.CylinderGeometry(1.65, 1.65, 0.12, 48), darkMetal, -10, 4.05, 14);
  for (const [lx, lz] of [
    [-11.1, 12.9],
    [-8.9, 12.9],
    [-11.1, 15.1],
    [-8.9, 15.1],
  ] as const) {
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 10), darkMetal, lx, 0.4, lz);
  }
  // The stair hut with its door.
  add(new THREE.BoxGeometry(3.2, 2.8, 3.4), concrete, -3.5, 1.4, 19);
  add(new THREE.BoxGeometry(0.95, 2.05, 0.06), darkMetal, -3.5, 1.03, 17.27);
  // Vent pipes, capped.
  for (const [vx, vz] of [
    [3, 6],
    [3.6, 6.3],
    [-6, 7.5],
  ] as const) {
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 16), metal, vx, 0.45, vz);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), darkMetal, vx, 0.94, vz);
  }
  // The mast and its warning light.
  add(new THREE.CylinderGeometry(0.06, 0.1, 9, 12), metal, 12.5, 4.5, 22);
  const beacon = add(new THREE.SphereGeometry(0.14, 20, 12), red, 12.5, 9.1, 22);
  beacon.castShadow = false;

  return {
    group,
    beacon,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      concreteMap.dispose();
      grain.dispose();
      ledgeMap.dispose();
    },
  };
}

/**
 * Concrete's relief as a normal map: soft lumps, fine grit and pits on a height field (seeded,
 * tiling), turned into normals by its slopes.
 */
function concreteNormals(size: number, seed: number): THREE.DataTexture {
  let a = seed;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const h = new Float32Array(size * size);
  // Lumps: a few octaves of smoothed noise (box-blurred random values), then grit and pits.
  const noise = (cell: number, weight: number) => {
    const n = Math.ceil(size / cell);
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = x / cell;
        const fy = y / cell;
        const x0 = Math.floor(fx) % n;
        const y0 = Math.floor(fy) % n;
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const u = fx - Math.floor(fx);
        const v = fy - Math.floor(fy);
        const s = (t: number) => t * t * (3 - 2 * t);
        const top = (g[y0 * n + x0] ?? 0) * (1 - s(u)) + (g[y0 * n + x1] ?? 0) * s(u);
        const bottom = (g[y1 * n + x0] ?? 0) * (1 - s(u)) + (g[y1 * n + x1] ?? 0) * s(u);
        h[y * size + x] = (h[y * size + x] ?? 0) + weight * (top * (1 - s(v)) + bottom * s(v));
      }
    }
  };
  noise(64, 0.5);
  noise(16, 0.25);
  noise(4, 0.12);
  for (let i = 0; i < h.length; i++) h[i] = (h[i] ?? 0) + (rnd() - 0.5) * 0.06;
  for (let k = 0; k < 260; k++) {
    const cx = Math.floor(rnd() * size);
    const cy = Math.floor(rnd() * size);
    const r = 1 + rnd() * 2.5;
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        const d = Math.hypot(x, y);
        if (d > r) continue;
        const i = ((cy + y + size) % size) * size + ((cx + x + size) % size);
        h[i] = (h[i] ?? 0) - 0.25 * (1 - d / r);
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)] ?? 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 3;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function scaleUv(geometry: THREE.BufferGeometry, u: number, v: number): void {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
}

/**
 * Concrete's mottle: a base colour, soft blotches of weathering and fine grit, painted once
 * (seeded) on a canvas that tiles.
 */
function mottled(
  size: number,
  base: readonly [number, number, number],
  blotch: number,
  seed: number,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the roof');
  let a = seed;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 8 + rnd() * 60;
    const dark = rnd() < 0.6;
    const k = (dark ? -1 : 1) * blotch * rnd();
    // Painted at each wrap so the texture tiles without seams.
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ] as const) {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, `rgba(${base[0] + k},${base[1] + k},${base[2] + k},0.35)`);
      grad.addColorStop(1, `rgba(${base[0] + k},${base[1] + k},${base[2] + k},0)`);
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
    }
  }
  const image = g.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    image.data[i] = (image.data[i] ?? 0) + n;
    image.data[i + 1] = (image.data[i + 1] ?? 0) + n;
    image.data[i + 2] = (image.data[i + 2] ?? 0) + n;
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
