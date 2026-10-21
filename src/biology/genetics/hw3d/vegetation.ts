/**
 * Plants and stones of the Hardy–Weinberg habitat (illustration, no data): low-poly conifers and
 * broadleaf trees, bushes, rocks and grass tufts, one instanced draw per kind. Muted habitat
 * tokens only (rule 0 "saturation = data": the creatures' chart colours stay the only saturated
 * colours). Shapes are procedural; every geometry and material is the kit's to free.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import type { Plant, PlantKind } from './layout';

type Piece = {
  g: THREE.BufferGeometry;
  color: THREE.Color;
  at: Vec3;
  scale: Vec3;
  rot?: Vec3;
};

/** Merges pieces into one flat-shaded geometry with their colours as vertex colours. */
function merged(pieces: Piece[], jitter = 0, seed = 1): THREE.BufferGeometry {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const flat = pieces.map(({ g, color, at, scale, rot }) => {
    // Icosahedra and dodecahedra are already non-indexed (no copy, no three.js warning).
    const f = g.index ? g.toNonIndexed() : g;
    if (f !== g) g.dispose();
    f.deleteAttribute('uv');
    if (jitter > 0) {
      // Uneven, hand-made surfaces: move every vertex a little (same seed, same plant).
      const p = f.attributes.position as THREE.BufferAttribute;
      const moved = new Map<string, Vec3>();
      for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i).toFixed(3)}|${p.getY(i).toFixed(3)}|${p.getZ(i).toFixed(3)}`;
        let d = moved.get(key);
        if (!d) {
          d = [(rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter];
          moved.set(key, d);
        }
        p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
      }
    }
    f.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...at),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))),
        new THREE.Vector3(...scale),
      ),
    );
    const n = f.attributes.position?.count ?? 0;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r;
      c[i * 3 + 1] = color.g;
      c[i * 3 + 2] = color.b;
    }
    f.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return f;
  });
  const out = mergeGeometries(flat);
  for (const f of flat) f.dispose();
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

interface Palette {
  foliage: THREE.Color;
  foliage2: THREE.Color;
  bark: THREE.Color;
  rock: THREE.Color;
  grass: THREE.Color;
}

function shapeOf(kind: PlantKind, c: Palette): THREE.BufferGeometry {
  const ico = (d: number) => new THREE.IcosahedronGeometry(1, d);
  switch (kind) {
    case 'conifer':
      return merged(
        [
          {
            g: new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6),
            color: c.bark,
            at: [0, 0.6, 0],
            scale: [1, 1, 1],
          },
          {
            g: new THREE.ConeGeometry(1.15, 2, 7),
            color: c.foliage,
            at: [0, 2.0, 0],
            scale: [1, 1, 1],
          },
          {
            g: new THREE.ConeGeometry(0.9, 1.7, 7),
            color: c.foliage,
            at: [0, 3.0, 0],
            scale: [1, 1, 1],
            rot: [0, 0.4, 0],
          },
          {
            g: new THREE.ConeGeometry(0.6, 1.4, 7),
            color: c.foliage2,
            at: [0, 3.9, 0],
            scale: [1, 1, 1],
            rot: [0, 0.9, 0],
          },
        ],
        0.06,
        3,
      );
    case 'broadleaf':
      return merged(
        [
          {
            g: new THREE.CylinderGeometry(0.14, 0.22, 1.7, 6),
            color: c.bark,
            at: [0, 0.85, 0],
            scale: [1, 1, 1],
          },
          { g: ico(1), color: c.foliage2, at: [0, 2.55, 0], scale: [1.25, 1.05, 1.2] },
          { g: ico(1), color: c.foliage, at: [0.65, 2.2, 0.15], scale: [0.8, 0.7, 0.8] },
          { g: ico(1), color: c.foliage, at: [-0.55, 2.25, -0.3], scale: [0.75, 0.7, 0.75] },
          { g: ico(1), color: c.foliage2, at: [0.1, 3.2, -0.1], scale: [0.7, 0.6, 0.7] },
        ],
        0.12,
        7,
      );
    case 'bush':
      return merged(
        [
          { g: ico(1), color: c.foliage, at: [0, 0.42, 0], scale: [0.75, 0.55, 0.7] },
          { g: ico(1), color: c.foliage2, at: [0.5, 0.32, 0.12], scale: [0.5, 0.4, 0.5] },
          { g: ico(1), color: c.foliage, at: [-0.42, 0.3, -0.15], scale: [0.48, 0.38, 0.46] },
        ],
        0.08,
        11,
      );
    case 'rock':
      return merged(
        [
          {
            g: new THREE.DodecahedronGeometry(1, 0),
            color: c.rock,
            at: [0, 0.18, 0],
            scale: [0.8, 0.5, 0.65],
          },
        ],
        0.18,
        13,
      );
    case 'tuft': {
      // Five thin blades leaning out.
      const blades: Piece[] = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        blades.push({
          g: new THREE.ConeGeometry(0.05, 0.5, 3),
          color: k % 2 ? c.grass : c.foliage2,
          at: [Math.cos(a) * 0.07, 0.22, Math.sin(a) * 0.07],
          scale: [1, 0.8 + 0.25 * (k % 3), 1],
          rot: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35],
        });
      }
      return merged(blades);
    }
  }
}

export interface Plants {
  meshes: THREE.InstancedMesh[];
}

/**
 * Grows the habitat's plants (illustration) on the ground at `heightAt`; tufts take their colour
 * from the grass they grow on (`grassToken`).
 */
export function plants(
  kit: SceneKit,
  list: readonly Plant[],
  heightAt: (x: number, z: number) => number,
  grassToken = '--bio3d-grass',
): Plants {
  const col = (name: string) => new THREE.Color(kit.color(name));
  const grass = col(grassToken);
  const palette: Palette = {
    foliage: col('--bio3d-foliage'),
    foliage2: col('--bio3d-foliage-2'),
    bark: col('--bio3d-bark'),
    rock: col('--bio3d-rock'),
    // Tufts a little darker than the meadow they grow on, so the ground reads as grass.
    grass: grass.clone().lerp(col('--bio3d-foliage'), 0.25),
  };
  const material = kit.shared(
    'hw-plant-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.9,
        envMapIntensity: 0.4,
      }),
  );
  const meshes: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  for (const kind of ['conifer', 'broadleaf', 'bush', 'rock', 'tuft'] as const) {
    const mine = list.filter((p) => p.kind === kind);
    if (!mine.length) continue;
    const mesh = kit.instanced(kit.geometry(shapeOf(kind, palette)), material, mine.length);
    mesh.name = `hw-plants-${kind}`;
    mesh.raycast = () => undefined;
    mesh.castShadow = kit.shadows && kind !== 'tuft';
    mesh.receiveShadow = kit.shadows;
    mine.forEach((p, i) => {
      // Sunk a little, so no plant floats over a slope.
      const y = heightAt(p.x, p.z) - (kind === 'tuft' ? 0.02 : 0.12 * p.scale);
      q.setFromAxisAngle(up, p.yaw);
      m.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
      mesh.setMatrixAt(i, m);
      // Light and shade variation between plants (multiplies the baked colours).
      const v = 0.86 + 0.18 * p.tint;
      mesh.setColorAt(i, tint.setRGB(v, v, v));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshes.push(mesh);
  }
  return { meshes };
}
