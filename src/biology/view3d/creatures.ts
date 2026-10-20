/**
 * Populations in 3D (ecology and population genetics): a ground disc, individuals drawn as
 * small figures (one instanced mesh per group: thousands of figures in one draw call) and
 * "gauges" — glass columns filled to a share of a reference value (K, a run's peak). Figures,
 * positions and shapes are illustrative; how many there are comes from the lesson's model.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { discPoints, type SceneKit, type Vec3 } from './kit';

export type CreatureKind = 'small' | 'large';

/** One figure: an ellipsoid body, a head and two ears (small: round ears; large: pointed). */
export function creatureGeometry(kit: SceneKit, kind: CreatureKind): THREE.BufferGeometry {
  const s = Math.max(10, Math.round(kit.seg * 0.75));
  const part = (g: THREE.BufferGeometry, m: THREE.Matrix4) => {
    const out = g.toNonIndexed();
    g.dispose();
    out.applyMatrix4(m);
    // Only what both kinds of parts share (positions and normals) is merged.
    out.deleteAttribute('uv');
    return out;
  };
  const m = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)),
      new THREE.Vector3(sx, sy, sz),
    );
  const big = kind === 'large';
  const k = big ? 1.35 : 1;
  const parts = [
    part(
      new THREE.SphereGeometry(1, s, Math.round(s * 0.7)),
      m(0, 0.32 * k, 0, 0.4 * k, 0.3 * k, 0.6 * k),
    ),
    part(
      new THREE.SphereGeometry(1, s, Math.round(s * 0.7)),
      m(0, 0.55 * k, 0.55 * k, 0.24 * k, 0.24 * k, 0.24 * k),
    ),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      big
        ? part(
            new THREE.ConeGeometry(0.08, 0.22, 8),
            m(side * 0.12 * k, 0.86 * k, 0.5 * k, k, k, k, -0.25),
          )
        : part(
            new THREE.SphereGeometry(1, 10, 8),
            m(side * 0.1, 0.84, 0.45, 0.06, 0.2, 0.08, -0.35),
          ),
    );
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  merged.computeBoundingSphere();
  return kit.geometry(merged);
}

export interface Population {
  mesh: THREE.InstancedMesh;
  /** Shows the first n figures (n ≤ capacity). */
  setCount: (n: number) => void;
  capacity: number;
}

/**
 * `capacity` figures placed once (seeded sunflower spiral inside radius r, random headings);
 * `setCount(n)` shows the first n of them, so a growing population spreads from the centre.
 */
export function population(
  kit: SceneKit,
  o: {
    capacity: number;
    radius: number;
    color: string;
    kind: CreatureKind;
    seed: number;
    size: number;
  },
): Population {
  const capacity = Math.max(1, Math.floor(o.capacity));
  const geometry = creatureGeometry(kit, o.kind);
  const material = kit.solid(o.color, { roughness: 0.55, sheen: 0.5 });
  const mesh = kit.instanced(geometry, material, capacity);
  const pts = discPoints(capacity, o.radius, 0, o.seed);
  let s = 97 + o.seed * 131;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3(o.size, o.size, o.size);
  const pos = new THREE.Vector3();
  pts.forEach((p, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    pos.set(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, mtx.compose(pos, q, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = 0;
  return {
    mesh,
    capacity,
    setCount: (n) => {
      mesh.count = Math.max(0, Math.min(capacity, Math.round(n)));
      mesh.visible = mesh.count > 0;
    },
  };
}

/**
 * Figures at given points (one instanced mesh, random headings, seeded): e.g. the individuals of
 * one genotype mixed among others.
 */
export function figuresAt(
  kit: SceneKit,
  points: readonly Vec3[],
  o: { color: string; kind: CreatureKind; size: number; seed: number },
): THREE.InstancedMesh {
  const mesh = kit.instanced(
    creatureGeometry(kit, o.kind),
    kit.solid(o.color, { roughness: 0.55, sheen: 0.5 }),
    points.length,
  );
  let s = 97 + o.seed * 131;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3(o.size, o.size, o.size);
  const pos = new THREE.Vector3();
  points.forEach((p, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    pos.set(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, mtx.compose(pos, q, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = points.length > 0;
  return mesh;
}

/** A round patch of ground (top face at y = 0) with a soft shadow under its edge. */
export function ground(kit: SceneKit, radius: number, color: string): THREE.Mesh {
  const g = kit.mesh(kit.cylinder(Math.max(24, kit.seg * 3)), kit.solid(color, { roughness: 0.9 }));
  g.scale.set(radius, 0.35, radius);
  g.position.y = -0.175;
  kit.shadow(-0.5, radius * 1.15, radius * 1.15, 0.22);
  return g;
}

export interface Gauge {
  /** Fills the column to `share` (0…1 of its height). */
  set: (share: number) => void;
}

/**
 * A glass column of the given height at (x, z) whose coloured fill rises to a share of it, with
 * marks (a line and a page label) at given shares: e.g. K and K/2. Labels are the lesson's.
 */
export function gauge(
  kit: SceneKit,
  o: {
    at: [number, number];
    height: number;
    radius: number;
    color: string;
    marks: { share: number; text: string }[];
    title?: string;
  },
): Gauge {
  const [x, z] = o.at;
  const glassMat = kit.glass(kit.color('--text-muted'), {
    opacity: 0.12,
    rim: { color: kit.color('--text-muted'), strength: 0.6, alpha: 0.5 },
  });
  const tube = kit.mesh(kit.cylinder(), glassMat);
  tube.scale.set(o.radius, o.height, o.radius);
  tube.position.set(x, o.height / 2, z);
  const fill = kit.mesh(kit.cylinder(), kit.solid(o.color, { roughness: 0.35, clearcoat: 0.4 }));
  fill.position.set(x, 0, z);
  const markMat = kit.solid(kit.color('--text'), { roughness: 0.5 });
  for (const mark of o.marks) {
    const ring = kit.mesh(kit.cylinder(), markMat);
    ring.scale.set(o.radius * 1.18, 0.03, o.radius * 1.18);
    ring.position.set(x, mark.share * o.height, z);
    kit.label(mark.text, [x + o.radius * 1.4, mark.share * o.height, z], 'muted');
  }
  if (o.title) kit.label(o.title, [x, o.height * 1.12 + 0.6, z], 'strong');
  const set = (share: number) => {
    const h = Math.max(0, Math.min(1, share)) * o.height;
    fill.visible = h > 1e-4;
    fill.scale.set(o.radius * 0.86, Math.max(1e-4, h), o.radius * 0.86);
    fill.position.y = h / 2;
  };
  set(0);
  return { set };
}

export type { Vec3 };
