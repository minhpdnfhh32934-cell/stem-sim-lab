import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Placed } from '../render/city/layout';

/*
 * The city's roofs made busy (Phase W, Phú: "nâng cấp chi tiết của nhà trong thành phố — chỉ phần
 * có thể thấy được"). Seen from our roof 100 m up, a building is mostly its roof, and the kit's
 * roofs are bare slabs. Each building gets, by a hash of where it stands: a stair housing with its
 * door, air-conditioning units in a row, vent pipes, a skylight; the bigger ones a water tank on
 * legs; the tall ones a red light that burns by night. Where a kind's roof is open is measured once
 * on its model (rays down on a 2 m grid: the slab is the height most of them meet, a spot open when
 * it and its neighbours meet the slab), then turned and moved to each copy. Instanced: a draw per
 * part for the whole city; under the city's own sun and shadows (the far pass). Nothing goes on
 * walls or below: from up here only roofs and the sides facing us are seen.
 */

export interface CityRoofs {
  readonly group: THREE.Group;
  /** 0 day … 1 night: the red lights. */
  setNight(n: number): void;
  dispose(): void;
}

/** A spot on a kind's roof (its own frame) and the slab's height. */
interface Roof {
  readonly slab: number;
  readonly open: readonly [number, number][];
  /** Its footprint's size (m). */
  readonly size: number;
}

const GRID = 2;
/** The parts a ray looks at: not the trims, glass or rooms behind the windows (fine, many). */
const SKIP = /Trim|Glass|Interior/;

function measure(model: THREE.Object3D): Roof | null {
  model.updateMatrixWorld(true);
  const targets: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mesh = o as THREE.Mesh;
    if (!SKIP.test((mesh.material as THREE.Material).name)) targets.push(mesh);
  });
  const box = new THREE.Box3().setFromObject(model);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const at = new THREE.Vector3();
  const hits = new Map<string, number>();
  for (let x = box.min.x + GRID / 2; x < box.max.x; x += GRID) {
    for (let z = box.min.z + GRID / 2; z < box.max.z; z += GRID) {
      ray.set(at.set(x, box.max.y + 5, z), down);
      const hit = ray.intersectObjects(targets, false)[0];
      if (hit && hit.point.y > 3) hits.set(`${x.toFixed(2)},${z.toFixed(2)}`, hit.point.y);
    }
  }
  // The slab: the height most rays meet (to a decimetre).
  const counts = new Map<number, number>();
  for (const y of hits.values()) {
    const k = Math.round(y * 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let slab = -1;
  let most = 0;
  for (const [k, n] of counts) {
    if (n > most) {
      most = n;
      slab = k / 10;
    }
  }
  if (slab < 0) return null;
  const onSlab = (x: number, z: number) => {
    const y = hits.get(`${x.toFixed(2)},${z.toFixed(2)}`);
    return y !== undefined && Math.abs(y - slab) < 0.15;
  };
  const open: [number, number][] = [];
  for (let x = box.min.x + GRID / 2; x < box.max.x; x += GRID) {
    for (let z = box.min.z + GRID / 2; z < box.max.z; z += GRID) {
      if (
        onSlab(x, z) &&
        onSlab(x + GRID, z) &&
        onSlab(x - GRID, z) &&
        onSlab(x, z + GRID) &&
        onSlab(x, z - GRID)
      )
        open.push([x, z]);
    }
  }
  return { slab, open, size: Math.min(box.max.x - box.min.x, box.max.z - box.min.z) };
}

/** 0–1 from where a building stands and what is asked (fixed: the same roofs every time). */
const hash = (x: number, z: number, k: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly at: THREE.Matrix4[];
}

/**
 * The props on every building of `plan` (the city's frame), on the roofs of `models` (each
 * kind's, its own frame). The group goes where the city's other pieces are.
 */
export function cityRoofs(
  plan: readonly Placed[],
  models: ReadonlyMap<string, THREE.Object3D>,
): CityRoofs {
  const group = new THREE.Group();
  group.name = 'city-roofs';
  const roofs = new Map<string, Roof | null>();
  for (const [kind, model] of models)
    if (kind.startsWith('Building')) roofs.set(kind, measure(model));

  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const beacon = mat('#3a0a0a', { emissive: '#ff2a1a', emissiveIntensity: 0 });
  const parts = {
    housing: {
      geometry: new THREE.BoxGeometry(2.8, 3, 2.4).translate(0, 1.5, 0),
      material: mat('#8c877e'),
      at: [],
    },
    door: {
      geometry: new THREE.BoxGeometry(1, 2.1, 0.06).translate(0, 1.05, 1.22),
      material: mat('#3a3d42'),
      at: [],
    },
    ac: {
      geometry: new THREE.BoxGeometry(1.3, 1, 0.9).translate(0, 0.5, 0),
      material: mat('#b4b7ba', { roughness: 0.6 }),
      at: [],
    },
    fan: {
      geometry: new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12).translate(0, 1.03, 0),
      material: mat('#2c3034'),
      at: [],
    },
    pipe: {
      geometry: new THREE.CylinderGeometry(0.17, 0.17, 1.2, 8).translate(0, 0.6, 0),
      material: mat('#8e9297', { metalness: 0.4, roughness: 0.5 }),
      at: [],
    },
    skylight: {
      geometry: new THREE.BoxGeometry(2.2, 0.4, 1.4).translate(0, 0.2, 0),
      material: mat('#5f7f95', { metalness: 0.3, roughness: 0.2 }),
      at: [],
    },
    tank: {
      geometry: new THREE.CylinderGeometry(1.5, 1.5, 2.8, 16).translate(0, 3.0, 0),
      material: mat('#7a5a3c'),
      at: [],
    },
    lid: {
      geometry: new THREE.ConeGeometry(1.62, 0.8, 16).translate(0, 4.8, 0),
      material: mat('#3d3a36'),
      at: [],
    },
    legs: {
      // Four legs in one: at the corners under the tank.
      geometry: legs(),
      material: mat('#4a4744', { metalness: 0.3 }),
      at: [],
    },
    light: {
      geometry: new THREE.SphereGeometry(0.22, 10, 8),
      material: beacon,
      at: [],
    },
  } satisfies Record<string, Part>;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  for (const copy of plan) {
    const roof = roofs.get(copy.kind);
    if (!roof || roof.open.length < 6) continue;
    const c = Math.cos(copy.turn);
    const s = Math.sin(copy.turn);
    // A spot of the roof (its kind's frame) placed on this copy, turned `turn` more about it.
    const put = (part: Part, spot: readonly [number, number], turn: number, lift = 0) => {
      const [lx, lz] = spot;
      p.set(copy.x + lx * c + lz * s, roof.slab + lift, copy.z - lx * s + lz * c);
      q.setFromAxisAngle(up, copy.turn + turn);
      part.at.push(m.compose(p, q, one).clone());
    };
    const used = new Set<number>();
    /** An open spot not yet taken, `k`-th by the hash (keeping a cell's neighbours free too). */
    const take = (k: number): readonly [number, number] | null => {
      for (let tries = 0; tries < 12; tries++) {
        const i = Math.floor(hash(copy.x, copy.z, k * 13 + tries) * roof.open.length);
        const spot = roof.open[i];
        if (!spot || used.has(i)) continue;
        used.add(i);
        // Its neighbours taken with it (props never touch).
        roof.open.forEach(([x, z], j) => {
          if (Math.abs(x - spot[0]) <= GRID && Math.abs(z - spot[1]) <= GRID) used.add(j);
        });
        return spot;
      }
      return null;
    };
    const facing = Math.floor(hash(copy.x, copy.z, 1) * 4) * (Math.PI / 2);
    const housing = take(1);
    if (housing) {
      put(parts.housing, housing, facing);
      put(parts.door, housing, facing);
      if (roof.slab > 24) put(parts.light, housing, 0, 3.25);
    }
    const acs = 2 + Math.floor(hash(copy.x, copy.z, 2) * 4);
    for (let i = 0; i < acs; i++) {
      const spot = take(10 + i);
      if (!spot) break;
      put(parts.ac, spot, facing);
      put(parts.fan, spot, facing);
    }
    for (let i = 0; i < 1 + Math.floor(hash(copy.x, copy.z, 3) * 3); i++) {
      const spot = take(20 + i);
      if (spot) put(parts.pipe, spot, 0);
    }
    if (hash(copy.x, copy.z, 4) < 0.5) {
      const spot = take(30);
      if (spot) put(parts.skylight, spot, facing);
    }
    if (roof.size > 14 && hash(copy.x, copy.z, 5) < 0.45) {
      const spot = take(40);
      if (spot) {
        put(parts.tank, spot, 0);
        put(parts.lid, spot, 0);
        put(parts.legs, spot, 0);
        if (roof.slab > 24 && !housing) put(parts.light, spot, 0, 5.3);
      }
    }
  }

  const owned: { dispose(): void }[] = [];
  for (const part of Object.values(parts) as Part[]) {
    owned.push(part.geometry, part.material);
    if (part.at.length === 0) continue;
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, part.at.length);
    part.at.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere();
    mesh.castShadow = part.material !== beacon;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return {
    group,
    setNight(n) {
      beacon.emissiveIntensity = 4 * n;
    },
    dispose() {
      for (const o of owned) o.dispose();
      group.clear();
    },
  };
}

/** A tank's four legs (1.9 m, at its corners) as one geometry. */
function legs(): THREE.BufferGeometry {
  const one = new THREE.BoxGeometry(0.16, 1.6, 0.16);
  const out: THREE.BufferGeometry[] = [];
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    out.push(one.clone().translate(x * 1.05, 0.8, z * 1.05));
  }
  one.dispose();
  const merged = mergeGeometries(out);
  for (const g of out) g.dispose();
  return merged;
}
