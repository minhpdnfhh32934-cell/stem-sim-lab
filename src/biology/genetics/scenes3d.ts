/**
 * 3D scenes of the genetics lessons; every number is the lesson model's.
 *
 * - Drift: every Wright–Fisher run is a tube of its 2N gene copies (beads), copies of A filling
 *   it from the bottom: the fill level is the frequency of A at the generation shown, a full or
 *   empty tube a fixed or lost allele.
 * (Mendel and Hardy–Weinberg have their own 3D views: `mendel3d/`, `hw3d/`.)
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import { driftAt } from './genetics3d';

export interface DriftSceneInput {
  runs: number[][];
  /** Gene copies per population (2N). */
  copies: number;
  /** Gene copies one bead stands for. */
  per: number;
  texts: { tube: (k: number) => string };
}

/** Beads per layer in a tube: one in the middle, six around it. */
const RING = [
  [0, 0],
  ...Array.from({ length: 6 }, (_, i) => [
    Math.cos((i * Math.PI) / 3),
    Math.sin((i * Math.PI) / 3),
  ]),
] as const;

export function buildDriftScene(kit: SceneKit, input: DriftSceneInput): Bio3DScene {
  const { runs, per } = input;
  const n = Math.max(1, runs.length);
  const beadsPerTube = Math.max(1, Math.round(input.copies / per));
  const bead = 0.12;
  const pitch = 0.255;
  const layers = Math.ceil(beadsPerTube / RING.length);
  const tubeR = pitch + bead + 0.08;
  const H = layers * bead * 2.05 + 0.4;
  const cols = Math.min(n, 10);
  const rows = Math.ceil(n / cols);
  const dx = 1.15;
  const dz = 1.7;
  const centre = (k: number): Vec3 => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    return [(c - (inRow - 1) / 2) * dx, 0, (r - (rows - 1) / 2) * dz];
  };
  const muted = kit.color('--text-muted');
  const glassMat = kit.glass(muted, {
    opacity: 0.07,
    side: THREE.DoubleSide,
    rim: { color: muted, strength: 0.6, alpha: 0.45 },
  });
  const baseMat = kit.solid(kit.color('--bg-panel-2'), { roughness: 0.8 });
  const rack = kit.mesh(kit.roundedBox(12), baseMat);
  const w = (cols * dx) / 2 + 0.5;
  const d = (rows * dz) / 2 + 0.3;
  rack.scale.set(w, 0.15, d);
  rack.position.y = -0.18;
  kit.shadow(-0.5, w + 0.8, d + 0.8, 0.22);
  for (let k = 0; k < n; k++) {
    const [x, , z] = centre(k);
    const tube = kit.mesh(kit.cylinder(Math.max(16, kit.seg), true), glassMat);
    tube.scale.set(tubeR, H, tubeR);
    tube.position.set(x, H / 2, z);
    kit.label(input.texts.tube(k), [x, -0.5, z + tubeR + 0.35], 'muted');
  }
  // Every bead place of every tube, bottom layer first (A fills the tube from the bottom).
  const slot = (k: number, i: number): Vec3 => {
    const [x, , z] = centre(k);
    const layer = Math.floor(i / RING.length);
    const [u, v] = RING[i % RING.length] ?? [0, 0];
    return [x + u * pitch, bead + layer * bead * 2.05, z + v * pitch];
  };
  const total = n * beadsPerTube;
  const mk = (token: string) =>
    kit.instanced(
      kit.sphere(0.5),
      kit.solid(kit.color(token), { roughness: 0.3, clearcoat: 0.6 }),
      total,
    );
  const beadsA = mk('--chart-1');
  const beadsa = mk('--chart-3');
  const m = new THREE.Matrix4();
  const put = (mesh: THREE.InstancedMesh, i: number, p: Vec3) => {
    m.makeScale(bead, bead, bead);
    m.setPosition(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, m);
  };
  const top = H + 0.6;
  const pts: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) pts.push([sx * w, -0.4, sz * (d + 0.4)], [sx * w, top, sz * d]);
  return {
    kit,
    bounds: { center: [0, H / 2, 0], radius: Math.hypot(w, H / 2, d), points: pts },
    setTime: (g) => {
      const now = driftAt(runs, g);
      let a = 0;
      let b = 0;
      now.p.forEach((p, k) => {
        // Copies of A in this population now (the model's count), drawn as beads.
        const nA = Math.max(0, Math.min(beadsPerTube, Math.round((p * input.copies) / per)));
        for (let i = 0; i < beadsPerTube; i++) {
          if (i < nA) put(beadsA, a++, slot(k, i));
          else put(beadsa, b++, slot(k, i));
        }
      });
      beadsA.count = a;
      beadsa.count = b;
      beadsA.visible = a > 0;
      beadsa.visible = b > 0;
      beadsA.instanceMatrix.needsUpdate = true;
      beadsa.instanceMatrix.needsUpdate = true;
    },
  };
}
