/**
 * The 3D scene of "Khí lí tưởng" (three.js, on the biology scene kit): one see-through cylinder
 * per state of `gas3d`, its gas column as tall as V, a piston on top pressed by an arrow as long
 * as p, and the same number of particles in each, bouncing in the column at a speed ∝ √T
 * (illustrative motion; `tick` moves them in place, no allocation).
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { jitter } from '../common/jitter';
import { addArrow, type Vec3 } from '../view3d/arrow';
import { PARTICLES, type Cylinder3D } from './gas3d';

/** Cylinder radius, tallest gas column, gap between the cylinders (world units, illustration). */
export const RADIUS = 0.6;
export const COLUMN = 2.4;
const GAP = 2.2;
/** Particle speed (units/s) at the higher temperature: illustration, slowed down. */
const SPEED = 1.1;

export interface GasScene extends Bio3DScene {
  state(): { heights: number[]; pushes: number[]; speeds: number[] };
}

export function buildGasScene(
  kit: SceneKit,
  o: { cylinders: Cylinder3D[]; texts: string[][] },
): GasScene {
  const n = o.cylinders.length;
  const glass = kit.glass(kit.color('--text-muted'), { opacity: 0.14, side: THREE.DoubleSide });
  const pistonMat = kit.solid(kit.color('--bio3d-rock'), { roughness: 0.5 });
  const dot = kit.sphere(0.5);
  const partMat = kit.solid(kit.color('--chart-1'));
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const size = new THREE.Vector3().setScalar(0.045);
  const v3 = new THREE.Vector3();

  const columns = o.cylinders.map((c, i) => {
    const cx = (i - (n - 1) / 2) * GAP;
    const h = COLUMN * c.height;
    const tube = kit.mesh(kit.cylinder(kit.seg, true), glass);
    tube.scale.set(RADIUS, COLUMN * 1.15, RADIUS);
    tube.position.set(cx, (COLUMN * 1.15) / 2, 0);
    const base = kit.mesh(kit.cylinder(), pistonMat);
    base.scale.set(RADIUS * 1.08, 0.06, RADIUS * 1.08);
    base.position.set(cx, -0.03, 0);
    const piston = kit.mesh(kit.cylinder(), pistonMat);
    piston.scale.set(RADIUS * 0.98, 0.12, RADIUS * 0.98);
    piston.position.set(cx, h + 0.06, 0);
    // The push of the gas's pressure on the piston, as long as p.
    const push = 0.35 + 0.9 * c.push;
    addArrow(kit, {
      from: [cx, h + 0.15 + push, 0],
      dir: [0, -1, 0],
      length: push,
      radius: 0.05,
      color: kit.color('--chart-4'),
      name: `gas-push-${String(i + 1)}`,
    });
    (o.texts[i] ?? []).forEach((t, k) =>
      kit.label(t, [cx, COLUMN * 1.15 + 1.45 - k * 0.32, 0], k === 0 ? 'strong' : 'plain'),
    );
    // The particles: seeded places and directions, the same count in every state.
    const parts = kit.instanced(dot, partMat, PARTICLES);
    parts.name = `gas-parts-${String(i + 1)}`;
    const pos = new Float32Array(PARTICLES * 3);
    const vel = new Float32Array(PARTICLES * 3);
    for (let k = 0; k < PARTICLES; k++) {
      const rho = 0.85 * RADIUS * Math.sqrt(jitter(k, 1));
      const phi = 2 * Math.PI * jitter(k, 2);
      pos[3 * k] = rho * Math.cos(phi);
      pos[3 * k + 1] = h * (0.05 + 0.9 * jitter(k, 3));
      pos[3 * k + 2] = rho * Math.sin(phi);
      // A random direction (uniform on the sphere), the speed of this state.
      const z = 2 * jitter(k, 4) - 1;
      const a = 2 * Math.PI * jitter(k, 5);
      const s = Math.sqrt(1 - z * z);
      const sp = SPEED * c.speed;
      vel[3 * k] = sp * s * Math.cos(a);
      vel[3 * k + 1] = sp * z;
      vel[3 * k + 2] = sp * s * Math.sin(a);
    }
    return { cx, h, parts, pos, vel };
  });

  const move = (dt: number) => {
    for (const col of columns) {
      const { pos, vel, h } = col;
      const rMax = 0.9 * RADIUS;
      for (let k = 0; k < PARTICLES; k++) {
        const i = 3 * k;
        let x = (pos[i] ?? 0) + (vel[i] ?? 0) * dt;
        let y = (pos[i + 1] ?? 0) + (vel[i + 1] ?? 0) * dt;
        let z = (pos[i + 2] ?? 0) + (vel[i + 2] ?? 0) * dt;
        // Floor and piston: bounce.
        if (y < 0.03 || y > h - 0.03) {
          vel[i + 1] = -(vel[i + 1] ?? 0);
          y = Math.min(h - 0.03, Math.max(0.03, y));
        }
        // The round wall: reflect the velocity about the wall's normal.
        const r = Math.hypot(x, z);
        if (r > rMax) {
          const nx = x / r;
          const nz = z / r;
          const dot2 = 2 * ((vel[i] ?? 0) * nx + (vel[i + 2] ?? 0) * nz);
          vel[i] = (vel[i] ?? 0) - dot2 * nx;
          vel[i + 2] = (vel[i + 2] ?? 0) - dot2 * nz;
          x = nx * rMax;
          z = nz * rMax;
        }
        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = z;
        col.parts.setMatrixAt(k, m4.compose(v3.set(col.cx + x, y, z), one, size));
      }
      col.parts.instanceMatrix.needsUpdate = true;
    }
  };
  move(0);

  const half = ((n - 1) / 2) * GAP + RADIUS + 0.4;
  const top = COLUMN * 1.15 + 1.7;
  const points: Vec3[] = [];
  for (const x of [-half, half])
    for (const y of [-0.1, top]) for (const z of [-RADIUS, RADIUS]) points.push([x, y, z]);
  return {
    kit,
    bounds: { center: [0, top / 2, 0], radius: Math.hypot(half, top / 2), points },
    tick: (dt) => {
      // Big gaps (a tab in the background) would let particles jump through the piston.
      move(Math.min(dt, 0.05));
    },
    state: () => ({
      heights: o.cylinders.map((c) => c.height),
      pushes: o.cylinders.map((c) => c.push),
      speeds: columns.map(
        (col) => Math.hypot(col.vel[0] ?? 0, col.vel[1] ?? 0, col.vel[2] ?? 0) / SPEED,
      ),
    }),
  };
}
