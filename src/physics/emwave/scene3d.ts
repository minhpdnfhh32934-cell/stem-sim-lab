/**
 * The 3D scene of "Sóng điện từ" (three.js, on the biology scene kit): the direction of travel
 * along +x, E⃗ (--chart-4) in the vertical plane and B⃗ (--chart-1) in the horizontal plane as
 * curves with field sticks (`emwave3d`), and a bracket of one wavelength labelled with the
 * lesson's λ. `tick` moves the wave (illustration, slowed down) without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, addLine, type Vec3 } from '../view3d/arrow';
import { AMP, SPAN, WAVES, fieldsAt, phaseAt, xAt } from './emwave3d';

const POINTS = 241;
const STICKS = 32;

export interface EmTexts {
  E: string;
  B: string;
  c: string;
  lambda: string;
}

export interface EmScene extends Bio3DScene {
  state(): { phase: number; crestGap: number; eAt0: number; bAt0: number };
}

export function buildEmScene(kit: SceneKit, o: { texts: EmTexts }): EmScene {
  const muted = kit.color('--text-muted');
  addArrow(kit, {
    from: [-SPAN / 2 - 0.4, 0, 0],
    dir: [1, 0, 0],
    length: SPAN + 1.2,
    radius: 0.025,
    color: muted,
    name: 'em-axis',
  });
  kit.label(o.texts.c, [SPAN / 2 + 1.0, 0.3, 0], 'strong');

  const curve = (color: string, name: string) => {
    const line = addLine(
      kit,
      Array.from({ length: POINTS }, (): Vec3 => [0, 0, 0]),
      color,
      name,
    );
    const sticks = kit.instanced(kit.cylinder(), kit.solid(color), STICKS);
    sticks.name = `${name}-sticks`;
    return { line, sticks };
  };
  const E = curve(kit.color('--chart-4'), 'em-e');
  const B = curve(kit.color('--chart-1'), 'em-b');
  kit.label(o.texts.E, [xAt(0.25), AMP + 0.3, 0], 'strong');
  kit.label(o.texts.B, [xAt(0.25), 0, AMP + 0.35], 'strong');

  // One wavelength between two crests of E (at phase 0), above the wave.
  const y = AMP + 0.6;
  addLine(
    kit,
    [
      [xAt(0.25), y - 0.15, 0],
      [xAt(0.25), y, 0],
      [xAt(1.25), y, 0],
      [xAt(1.25), y - 0.15, 0],
    ],
    muted,
    'em-lambda',
  );
  kit.label(o.texts.lambda, [xAt(0.75), y + 0.3, 0], 'plain');

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const qE = new THREE.Quaternion();
  const qB = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  let time = 0;
  let phase = 0;
  const place = () => {
    phase = phaseAt(time);
    for (const [c, axis] of [
      [E, 1],
      [B, 2],
    ] as const) {
      const pos = c.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < POINTS; i++) {
        const u = (WAVES * i) / (POINTS - 1);
        const f = fieldsAt(u, phase);
        const v = axis === 1 ? f.e[1] : f.b[2];
        pos.setXYZ(i, xAt(u), axis === 1 ? v : 0, axis === 2 ? v : 0);
      }
      pos.needsUpdate = true;
      c.line.geometry.computeBoundingSphere();
      for (let k = 0; k < STICKS; k++) {
        const u = (WAVES * (k + 0.5)) / STICKS;
        const f = fieldsAt(u, phase);
        const v = axis === 1 ? f.e[1] : f.b[2];
        p.set(xAt(u), axis === 1 ? v / 2 : 0, axis === 2 ? v / 2 : 0);
        sc.set(0.018, Math.max(Math.abs(v), 1e-4), 0.018);
        m.compose(p, axis === 1 ? qE : qB, sc);
        c.sticks.setMatrixAt(k, m);
      }
      c.sticks.instanceMatrix.needsUpdate = true;
    }
  };
  place();

  return {
    kit,
    bounds: {
      center: [0, 0, 0],
      radius: SPAN / 2 + 1.3,
      // The wave's outline (with the axis' end and the λ bracket): fills the stage's width.
      points: [-1, 1].flatMap((x) =>
        [-1, 1].flatMap((z): Vec3[] => [
          [x * (SPAN / 2 + 0.9), AMP + 0.9, z * AMP],
          [x * (SPAN / 2 + 0.9), -AMP, z * AMP],
        ]),
      ),
    },
    tick: (dt) => {
      time += dt;
      place();
    },
    state: () => {
      const pos = E.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const posB = B.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      return { phase, crestGap: xAt(1) - xAt(0), eAt0: pos.getY(0), bAt0: posB.getZ(0) };
    },
  };
}
