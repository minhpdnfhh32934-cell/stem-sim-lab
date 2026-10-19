/**
 * 3D scene of a meiosis stage (rebuilt for every stage: a stage is a still picture). Cells are
 * glass spheres; condensed chromosomes are their chromatids side by side, each drawn segment by
 * segment in the colour of the parent it came from (so crossing over shows as a colour change,
 * exactly where the model put it), joined at the centromere; interphase chromatin is thin
 * threads. Spindle fibres run from the poles to the centromeres at metaphase and anaphase.
 * Shapes and positions are illustration; what is drawn is the model's stage.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import type { Chromatid, StageState } from './division';
import { CELL_R, CHROMATID_R, meiosisLayout, type PlacedChromosome } from './meiosisLayout';

/** Distance of each sister chromatid's axis from the centromere. */
const SISTER = 0.21;

/** A cylinder from a to b (unit cylinder scaled). */
function rod(kit: SceneKit, mat: THREE.Material, a: Vec3, b: Vec3, r: number): void {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  if (len < 1e-5) return;
  const m = kit.mesh(kit.cylinder(10), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.scale.set(r, len, r);
}

export function buildMeiosisScene(kit: SceneKit, stage: StageState): Bio3DScene {
  const layout = meiosisLayout(stage);
  const origin = {
    M: kit.solid(kit.color('--chart-4'), { roughness: 0.5, sheen: 0.6 }),
    P: kit.solid(kit.color('--chart-1'), { roughness: 0.5, sheen: 0.6 }),
  };
  const membrane = kit.color('--subject-biology');
  const cellMat = kit.glass(membrane, {
    opacity: 0.12,
    rim: { color: membrane, strength: 0.7, alpha: 0.55 },
  });
  const anaphase = stage.poles !== undefined;
  for (const c of layout.cells) {
    const cell = kit.mesh(kit.sphere(1.5), cellMat);
    cell.position.set(...c);
    cell.scale.set(CELL_R * (anaphase ? 1.12 : 1), CELL_R, CELL_R);
  }
  const width = layout.cells.length * (2 * CELL_R + 1.4);
  kit.shadow(-CELL_R - 0.8, width / 2 + 0.6, CELL_R * 1.1, 0.25);

  const sphere = kit.sphere();
  const drawChromatid = (c: Chromatid, x: number, y: number, z: number, length: number) => {
    const y0 = y - length / 2;
    for (const seg of c) {
      rod(
        kit,
        origin[seg.origin],
        [x, y0 + seg.from * length, z],
        [x, y0 + seg.to * length, z],
        CHROMATID_R,
      );
    }
    // Rounded ends in the colour of the end segment.
    const first = c[0];
    const last = c.at(-1);
    for (const [seg, yy] of [
      [first, y0],
      [last, y0 + length],
    ] as const) {
      if (!seg) continue;
      const cap = kit.mesh(sphere, origin[seg.origin]);
      cap.scale.setScalar(CHROMATID_R);
      cap.position.set(x, yy, z);
    }
  };
  const bead = kit.solid(kit.color('--text'), { roughness: 0.35, clearcoat: 0.3 });

  if (layout.condensed) {
    for (const p of layout.chromosomes) {
      const [x, y, z] = p.center;
      const chromatids = p.chromosome.chromatids;
      if (chromatids.length === 2) {
        drawChromatid(chromatids[0] ?? [], x - SISTER, y, z, p.length);
        drawChromatid(chromatids[1] ?? [], x + SISTER, y, z, p.length);
        const b = kit.mesh(sphere, bead);
        b.scale.set(SISTER + 0.08, 0.17, 0.17);
        b.position.set(x, y, z);
      } else {
        drawChromatid(chromatids[0] ?? [], x, y, z, p.length);
      }
    }
  } else {
    // Interphase: chromatin threads (illustrative curves), one per DNA molecule.
    const curves = [0, 1, 2, 3].map((v) => {
      let s = 1234 + v * 977;
      const r = () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
      const pts: THREE.Vector3[] = [];
      const q = new THREE.Vector3();
      for (let i = 0; i < 12; i++) {
        q.set(q.x + (r() - 0.5) * 0.9, q.y + (r() - 0.5) * 0.9, q.z + (r() - 0.5) * 0.9);
        if (q.length() > 1) q.setLength(0.9);
        pts.push(q.clone());
      }
      return kit.geometry(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), kit.seg * 3, 0.06, 5, false),
      );
    });
    let k = 0;
    for (const p of layout.chromosomes) {
      for (const c of p.chromosome.chromatids) {
        const o = c[0]?.origin ?? p.chromosome.origin;
        const t = kit.mesh(curves[k % curves.length] ?? curves[0] ?? sphere, origin[o]);
        t.position.set(p.center[0] + (k % 2 ? 0.25 : -0.25), p.center[1], p.center[2]);
        t.rotation.set(k * 1.3, k * 0.7, k * 2.1);
        t.scale.setScalar(Math.max(0.9, p.length * 0.45));
        k++;
      }
    }
  }

  if (layout.spindle) {
    const fibre = kit.solid(kit.color('--text-muted'), { roughness: 0.4 });
    layout.cells.forEach((c, k) => {
      const left: Vec3 = [c[0] - CELL_R * 0.9, c[1], c[2]];
      const right: Vec3 = [c[0] + CELL_R * 0.9, c[1], c[2]];
      // Polar fibres (not attached to chromosomes), illustrative.
      for (const dy of [-0.9, 0.9])
        for (const dz of [-0.6, 0.6]) {
          rod(kit, fibre, left, [c[0] + 0.3, c[1] + dy, c[2] + dz], 0.03);
          rod(kit, fibre, right, [c[0] - 0.3, c[1] - dy, c[2] - dz], 0.03);
        }
      const mine = layout.chromosomes.filter((p: PlacedChromosome) => p.cell === k);
      for (const p of mine) {
        if (p.pole === -1 || p.pole === 0) rod(kit, fibre, left, p.center, 0.03);
        if (p.pole === 1 || p.pole === 0) rod(kit, fibre, right, p.center, 0.03);
      }
    });
  }

  const half: Vec3 = [width / 2, CELL_R + 0.6, CELL_R + 0.4];
  const pts: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) pts.push([sx * half[0], sy * half[1], sz * half[2]]);
  return {
    kit,
    bounds: { center: [0, 0, 0], radius: Math.hypot(half[0], half[1]), points: pts },
  };
}
