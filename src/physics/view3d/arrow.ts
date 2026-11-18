/**
 * Vector arrows for the physics 3D views (#302), on the biology scene kit (`SceneKit` owns and
 * frees every geometry and material). An arrow is a shaft and a cone along a unit direction; its
 * length is what the lesson's model gives, scaled by the caller.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '@/biology/view3d/kit';

export type { Vec3 };

export interface ArrowOptions {
  from: Vec3;
  /** Any non-zero direction (normalised here). */
  dir: Vec3;
  length: number;
  /** Shaft radius (world units). */
  radius: number;
  /** Material colour (a theme token's value). */
  color: string;
  name?: string;
}

const UP = new THREE.Vector3(0, 1, 0);

export const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
};

/** The cone's length for a shaft radius and a total length (never more than 35 % of it). */
export const headLength = (radius: number, length: number) => Math.min(length * 0.35, radius * 6);

/** Adds an arrow to `parent`; its group sits at `from` and points along `dir`. */
export function addArrow(kit: SceneKit, o: ArrowOptions, parent: THREE.Object3D = kit.scene) {
  const g = new THREE.Group();
  if (o.name) g.name = o.name;
  g.position.set(...o.from);
  g.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...norm(o.dir)));
  const mat = kit.solid(o.color);
  const head = headLength(o.radius, o.length);
  const shaft = kit.mesh(kit.cylinder(), mat, g);
  shaft.scale.set(o.radius, o.length - head, o.radius);
  shaft.position.y = (o.length - head) / 2;
  const cone = kit.mesh(
    kit.shared(`cone|${String(kit.seg)}`, () => new THREE.ConeGeometry(1, 1, kit.seg)),
    mat,
    g,
  );
  cone.scale.set(o.radius * 2.4, head, o.radius * 2.4);
  cone.position.y = o.length - head / 2;
  parent.add(g);
  return g;
}

/**
 * Uniform field lines along +x: a `rows` × `rows` grid of thin arrows in the box
 * [−half, half]³ (the picture of a uniform B⃗, like the book's figures).
 */
export function addUniformField(
  kit: SceneKit,
  o: { half: number; rows: number; color: string; radius: number; name: string },
) {
  const g = new THREE.Group();
  g.name = o.name;
  const step = o.rows > 1 ? (2 * o.half * 0.8) / (o.rows - 1) : 0;
  for (let i = 0; i < o.rows; i++)
    for (let k = 0; k < o.rows; k++) {
      const y = -o.half * 0.8 + i * step;
      const z = -o.half * 0.8 + k * step;
      addArrow(
        kit,
        {
          from: [-o.half, y, z],
          dir: [1, 0, 0],
          length: 2 * o.half,
          radius: o.radius,
          color: o.color,
        },
        g,
      );
    }
  kit.scene.add(g);
  return g;
}

/** A polyline (an angle's arc, a wave) in one draw call; the kit frees its geometry. */
export function addLine(kit: SceneKit, points: Vec3[], color: string, name?: string) {
  const geo = kit.geometry(
    new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))),
  );
  const line = new THREE.Line(geo, kit.own(new THREE.LineBasicMaterial({ color })));
  if (name) line.name = name;
  kit.scene.add(line);
  return line;
}

export interface MovingArrow {
  group: THREE.Group;
  /** Points the arrow from (fx, fy, fz) along (x, y, z); hidden while its length is ~0. */
  set(fx: number, fy: number, fz: number, x: number, y: number, z: number): void;
}

/**
 * An arrow that a moving view re-aims every frame (a body's velocity, its acceleration): the
 * same shaft and cone as `addArrow`, re-scaled in place, nothing allocated per call.
 */
export function addMovingArrow(
  kit: SceneKit,
  o: { radius: number; color: string; name?: string },
  parent: THREE.Object3D = kit.scene,
): MovingArrow {
  const g = new THREE.Group();
  if (o.name) g.name = o.name;
  const mat = kit.solid(o.color);
  const shaft = kit.mesh(kit.cylinder(), mat, g);
  const cone = kit.mesh(
    kit.shared(`cone|${String(kit.seg)}`, () => new THREE.ConeGeometry(1, 1, kit.seg)),
    mat,
    g,
  );
  parent.add(g);
  const d = new THREE.Vector3();
  return {
    group: g,
    set(fx, fy, fz, x, y, z) {
      const len = Math.hypot(x, y, z);
      g.visible = len > 1e-9;
      if (!g.visible) return;
      g.position.set(fx, fy, fz);
      g.quaternion.setFromUnitVectors(UP, d.set(x / len, y / len, z / len));
      const head = headLength(o.radius, len);
      shaft.scale.set(o.radius, len - head, o.radius);
      shaft.position.y = (len - head) / 2;
      cone.scale.set(o.radius * 2.4, head, o.radius * 2.4);
      cone.position.y = len - head / 2;
    },
  };
}
