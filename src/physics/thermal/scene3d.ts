/**
 * The 3D scene of "Nhiệt lượng" (three.js, on the biology scene kit): a see-through container with
 * the sample's particles of `thermal3d` — on a lattice (solid), packed loosely at the bottom
 * (liquid) or flying in the space above (gas). `setTime(τ)` asks the model how many are in each
 * state; `tick` only jiggles them (illustration, no allocation). The top layers melt and boil
 * first.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { jitter } from '../common/jitter';
import type { Vec3 } from '../view3d/arrow';
import type { Stage } from './model';
import { COUNT, GRID, phasesAt, type Phases } from './thermal3d';

const A = 0.32;
const SIDE = GRID * A;
/** Container: as wide as the lattice + a margin, tall enough for the gas. */
const BOX_W = SIDE + 0.9;
const BOX_H = SIDE * 2.6;

export interface ThermalScene extends Bio3DScene {
  state(): Phases;
}

export function buildThermalScene(
  kit: SceneKit,
  o: { stages: Stage[]; texts: { t: (p: Phases) => string } },
): ThermalScene {
  const glass = kit.glass(kit.color('--text-muted'), { opacity: 0.12, side: THREE.DoubleSide });
  const box = kit.mesh(
    kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1)),
    glass,
  );
  box.scale.set(BOX_W, BOX_H, BOX_W);
  box.position.set(0, BOX_H / 2, 0);

  // Lattice sites, ranked from the top layer down (they melt and boil first).
  const solid = new Float32Array(COUNT * 3);
  const liquid = new Float32Array(COUNT * 3);
  const gas = new Float32Array(COUNT * 3);
  let k = 0;
  for (let iy = GRID - 1; iy >= 0; iy--)
    for (let ix = 0; ix < GRID; ix++)
      for (let iz = 0; iz < GRID; iz++) {
        solid.set([(ix - (GRID - 1) / 2) * A, (iy + 0.5) * A, (iz - (GRID - 1) / 2) * A], 3 * k);
        // Liquid: loosely packed in a slightly wider, slightly lower pool.
        liquid.set(
          [
            (jitter(k, 1) - 0.5) * (BOX_W - 0.3),
            0.15 + jitter(k, 2) * SIDE * 0.95,
            (jitter(k, 3) - 0.5) * (BOX_W - 0.3),
          ],
          3 * k,
        );
        // Gas: spread through the space above.
        gas.set(
          [
            (jitter(k, 4) - 0.5) * (BOX_W - 0.3),
            SIDE * 1.2 + jitter(k, 5) * (BOX_H - SIDE * 1.4),
            (jitter(k, 6) - 0.5) * (BOX_W - 0.3),
          ],
          3 * k,
        );
        k++;
      }

  const parts = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-1')), COUNT);
  parts.name = 'th-parts';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const size = new THREE.Vector3().setScalar(A * 0.42);
  const v = new THREE.Vector3();
  const label = kit.label('', [0, BOX_H + 0.35, 0], 'strong');

  let phases = phasesAt(o.stages, 0);
  let clock = 0;
  const draw = () => {
    const amp = phases.jiggle;
    for (let i = 0; i < COUNT; i++) {
      // Rank i: the first `gas` are gas, then `liquid` liquid (melting from the top), the rest solid.
      const isGas = i < phases.gas;
      const isLiquid = !isGas && i < phases.gas + phases.liquid;
      const src = isGas ? gas : isLiquid ? liquid : solid;
      const a = isGas ? 0.45 : isLiquid ? 0.09 : 0.035;
      const w = isGas ? 1.3 : 2.4;
      v.set(
        (src[3 * i] ?? 0) + a * amp * Math.sin(w * clock + 6.28 * jitter(i, 7)),
        (src[3 * i + 1] ?? 0) + a * amp * Math.sin(1.13 * w * clock + 6.28 * jitter(i, 8)),
        (src[3 * i + 2] ?? 0) + a * amp * Math.sin(0.91 * w * clock + 6.28 * jitter(i, 9)),
      );
      parts.setMatrixAt(i, m4.compose(v, one, size));
    }
    parts.instanceMatrix.needsUpdate = true;
  };
  const setTime = (tau: number) => {
    phases = phasesAt(o.stages, tau);
    label.element.textContent = o.texts.t(phases);
    draw();
  };
  setTime(0);

  const points: Vec3[] = [];
  for (const x of [-BOX_W / 2, BOX_W / 2])
    for (const y of [0, BOX_H + 0.5])
      for (const z of [-BOX_W / 2, BOX_W / 2]) points.push([x, y, z]);
  return {
    kit,
    bounds: {
      center: [0, BOX_H / 2, 0],
      radius: Math.hypot(BOX_W / 2, BOX_H / 2, BOX_W / 2),
      points,
    },
    setTime,
    tick: (dt) => {
      clock += Math.min(dt, 0.05);
      draw();
    },
    state: () => ({ ...phases }),
  };
}
