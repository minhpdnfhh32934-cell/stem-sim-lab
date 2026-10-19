/**
 * 3D scenes of "Khuếch tán & thẩm thấu".
 *
 * - Diffusion: a glass chamber split by a membrane with pore slots; the illustrative Brownian
 *   particles of the 2D picture, in depth (`particles3d.ts`). The page labels count each side.
 * - Osmosis: a glass U-tube; the liquid heights are the model's trajectory (the same samples as
 *   the 2D picture), the membrane at the bottom, the initial level and Δh marked.
 */
import * as THREE from 'three';
import { rng } from '../genetics/stats';
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import { initialParticles, leftCount, poreIntervals, stepParticles3d } from './particles3d';

/** The 8 corners of a box (half sizes h) centred at c: what the camera must show. */
function boxCorners(h: Vec3, c: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) out.push([c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]]);
  return out;
}

/** Chamber half sizes (world units) for the box [0, 2] × [0, 1] × [0, 1]. */
const HX = 6;
const HY = 3;
const HZ = 3;

export interface DiffusionSceneInput {
  particles: number;
  pores: number;
  run: number;
  /** "Ngăn 1: 80" … from the view (localized). */
  sideText: (side: 1 | 2, count: number) => string;
}

export function buildDiffusionScene(kit: SceneKit, input: DiffusionSceneInput): Bio3DScene {
  const muted = kit.color('--text-muted');
  const chamber = kit.mesh(
    kit.roundedBox(10),
    kit.glass(muted, { opacity: 0.04, rim: { color: muted, strength: 0.45, alpha: 0.28 } }),
  );
  chamber.scale.set(HX + 0.3, HY + 0.3, HZ + 0.3);
  kit.shadow(-HY - 0.8, HX * 1.2, HZ * 1.3, 0.22);

  // Membrane: solid bands between the pore slots, across the whole depth.
  const pores = poreIntervals(input.pores);
  const membrane = kit.glass(kit.color('--chart-2'), { opacity: 0.78, roughness: 0.5 });
  let y0 = 0;
  for (const [a, b] of [...pores, [1, 1] as [number, number]]) {
    if (a > y0) {
      const band = kit.mesh(kit.roundedBox(14), membrane);
      const h = (a - y0) * HY;
      band.scale.set(0.09, h, HZ);
      band.position.set(0, (y0 + a - 1) * HY, 0);
    }
    y0 = b;
  }

  const rand = rng(7 + input.run);
  const p = initialParticles(input.particles, rand);
  const dots = kit.instanced(
    kit.sphere(0.5),
    kit.solid(kit.color('--chart-1'), { roughness: 0.3, clearcoat: 0.5 }),
    input.particles,
  );
  const m = new THREE.Matrix4();
  const place = () => {
    for (let i = 0; i < input.particles; i++) {
      m.makeScale(0.11, 0.11, 0.11);
      m.setPosition(
        ((p[3 * i] ?? 0) - 1) * HX,
        ((p[3 * i + 1] ?? 0) * 2 - 1) * HY,
        ((p[3 * i + 2] ?? 0) * 2 - 1) * HZ,
      );
      dots.setMatrixAt(i, m);
    }
    dots.instanceMatrix.needsUpdate = true;
    const left = leftCount(p);
    l1.element.textContent = input.sideText(1, left);
    l2.element.textContent = input.sideText(2, input.particles - left);
  };
  const l1 = kit.label('', [-HX / 2, HY + 1.2, 0], 'strong');
  const l2 = kit.label('', [HX / 2, HY + 1.2, 0], 'strong');
  place();
  return {
    kit,
    bounds: {
      center: [0, 0.4, 0],
      radius: Math.hypot(HX, HY, HZ) + 0.8,
      points: boxCorners([HX + 0.4, HY + 1.6, HZ + 0.4], [0, 0.6, 0]),
    },
    tick: () => {
      stepParticles3d(p, pores, rand);
      place();
    },
  };
}

export interface OsmosisSceneInput {
  h0: number;
  /** Equilibrium (or dry) height of the solution arm, m. */
  hEq: number;
  traj: { t: number[]; hL: number[] };
  tEnd: number;
  texts: { solution: string; water: string; membrane: string; dh: (cm: number) => string };
}

/** World height of the tallest liquid column. */
const H = 10;
/** Arm radius and centre x; the connector's centre height. */
const ARM_R = 0.9;
const ARM_X = 2.8;
const BASE = -1.4;

export function buildOsmosisScene(kit: SceneKit, input: OsmosisSceneInput): Bio3DScene {
  const hMax = Math.max(input.hEq, input.h0) * 1.25;
  const k = H / hMax;
  const muted = kit.color('--text-muted');
  const glassMat = kit.glass(muted, {
    opacity: 0.1,
    side: THREE.DoubleSide,
    rim: { color: muted, strength: 0.7, alpha: 0.5 },
  });
  const sides = Math.max(16, kit.seg * 2);
  const tube = (x: number, y0: number, y1: number) => {
    const t = kit.mesh(kit.cylinder(sides, true), glassMat);
    t.scale.set(ARM_R, y1 - y0, ARM_R);
    t.position.set(x, (y0 + y1) / 2, 0);
  };
  const top = H * 1.05;
  tube(-ARM_X, BASE, top);
  tube(ARM_X, BASE, top);
  const conn = kit.mesh(kit.cylinder(sides, true), glassMat);
  conn.rotation.z = Math.PI / 2;
  conn.scale.set(ARM_R * 0.85, 2 * ARM_X, ARM_R * 0.85);
  conn.position.set(0, BASE, 0);
  kit.shadow(BASE - ARM_R - 0.6, ARM_X * 1.6, ARM_R * 2.2, 0.25);

  const solution = kit.color('--chart-6');
  const water = kit.color('--chart-1');
  const liquid = (c: string) =>
    kit.glass(c, { opacity: 0.55, roughness: 0.15, side: THREE.FrontSide });
  // Columns: unit cylinders scaled to the liquid's height above the connector.
  const left = kit.mesh(kit.cylinder(sides), liquid(solution));
  const right = kit.mesh(kit.cylinder(sides), liquid(water));
  const setColumn = (m: THREE.Mesh, x: number, h: number) => {
    const y1 = Math.max(BASE + 0.01, h * k);
    m.scale.set(ARM_R * 0.92, y1 - BASE, ARM_R * 0.92);
    m.position.set(x, (BASE + y1) / 2, 0);
  };
  // The connector's liquid: solution on the left of the membrane, water on the right.
  for (const [c, x] of [
    [solution, -ARM_X / 2],
    [water, ARM_X / 2],
  ] as [string, number][]) {
    const half = kit.mesh(kit.cylinder(sides), liquid(c));
    half.rotation.z = Math.PI / 2;
    half.scale.set(ARM_R * 0.78, ARM_X, ARM_R * 0.78);
    half.position.set(x, BASE, 0);
  }
  const membrane = kit.mesh(
    kit.cylinder(sides),
    kit.solid(kit.color('--chart-2'), { roughness: 0.6 }),
  );
  membrane.rotation.z = Math.PI / 2;
  membrane.scale.set(ARM_R * 0.86, 0.12, ARM_R * 0.86);
  membrane.position.set(0, BASE, 0);

  // Initial level on both arms.
  const ringMat = kit.solid(kit.color('--text-muted'), { roughness: 0.5 });
  const ringGeo = kit.geometry(new THREE.TorusGeometry(ARM_R * 1.02, 0.035, 6, sides));
  for (const x of [-ARM_X, ARM_X]) {
    const ring = kit.mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, input.h0 * k, 0);
  }

  // Δh bracket right of the water arm.
  const bx = ARM_X + ARM_R + 1.1;
  const barMat = kit.solid(kit.color('--text'), { roughness: 0.5 });
  const bar = kit.mesh(kit.cylinder(8), barMat);
  const tickL = kit.mesh(kit.cylinder(8), barMat);
  const tickR = kit.mesh(kit.cylinder(8), barMat);
  for (const t of [tickL, tickR]) {
    t.rotation.z = Math.PI / 2;
    t.scale.set(0.04, 0.6, 0.04);
  }
  const dhLabel = kit.label('', [bx + 0.4, 0, 0], 'strong');
  kit.label(input.texts.solution, [-ARM_X, top + 0.8, 0], 'strong');
  kit.label(input.texts.water, [ARM_X, top + 0.8, 0], 'strong');
  kit.label(input.texts.membrane, [0, BASE - ARM_R - 0.7, 0], 'muted');

  const at = (t: number) => {
    // The 2D picture's rule: the sample at or before t.
    const n = input.traj.t.length;
    const idx = Math.min(
      n - 1,
      Math.floor((Math.max(0, t) / Math.max(1e-12, input.tEnd)) * (n - 1)),
    );
    const hL = input.traj.hL[idx] ?? input.h0;
    return { hL, hR: Math.max(0, 2 * input.h0 - hL) };
  };
  const setTime = (t: number) => {
    const { hL, hR } = at(t);
    setColumn(left, -ARM_X, hL);
    setColumn(right, ARM_X, hR);
    const yl = hL * k;
    const yr = hR * k;
    const lo = Math.min(yl, yr);
    const hi = Math.max(yl, yr);
    bar.visible = hi - lo > 0.02;
    bar.scale.set(0.04, Math.max(0.001, hi - lo), 0.04);
    bar.position.set(bx, (lo + hi) / 2, 0);
    tickL.position.set(bx, yl, 0);
    tickR.position.set(bx, yr, 0);
    dhLabel.position.set(bx + 0.5, (lo + hi) / 2, 0);
    dhLabel.element.textContent = input.texts.dh((hL - hR) * 100);
  };
  setTime(0);
  const center: Vec3 = [0.6, (BASE + top) / 2, 0];
  const half: Vec3 = [ARM_X + ARM_R + 2.6, (top - BASE) / 2 + 1.4, ARM_R + 0.3];
  return {
    kit,
    bounds: {
      center,
      radius: Math.hypot(half[0], half[1]),
      points: boxCorners(half, [0.6, (BASE + top) / 2 + 0.2, 0]),
    },
    setTime,
  };
}
