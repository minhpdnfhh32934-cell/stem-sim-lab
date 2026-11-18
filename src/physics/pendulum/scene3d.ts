/**
 * The 3D scene of "Con lắc đơn" (three.js on the biology scene kit; 1 world unit = 1 m): the
 * support, the string and the bob at the engine's angle (`sim.renderState`), the swing arc
 * between the turning points, the small-angle bob (a see-through ghost, when the lesson shows it,
 * as in 2D), and the velocity v, the weight P and the tension T at the 2D picture's scales.
 * `setTime` / `tick` move the bob and re-aim the arrows without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, addMovingArrow, type Vec3 } from '../view3d/arrow';
import { PE, type PendulumInput } from './engine';
import { bobAt, pendulum3d } from './pendulum3d';

export interface PendulumScene extends Bio3DScene {
  state(): { th: number; bob: Vec3; small: Vec3 | null };
}

function dynamicLine(kit: SceneKit, color: string, opacity = 1) {
  const line = new THREE.Line(
    kit.geometry(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3),
      ),
    ),
    kit.own(new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })),
  );
  kit.scene.add(line);
  return line.geometry.getAttribute('position') as THREE.BufferAttribute;
}

export function buildPendulumScene(
  kit: SceneKit,
  o: {
    q: PendulumInput;
    showSmall: boolean;
    texts: { v: string; P: string; T: string; small: string };
    read: () => Float64Array | null;
  },
): PendulumScene {
  const { q } = o;
  const L = q.L;
  const { arc, kv, kf } = pendulum3d(q);
  const faint = kit.color('--text-faint');

  // The support beam above the pivot and the vertical through it.
  const beam = kit.mesh(
    kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1)),
    kit.solid(kit.color('--text-muted'), { roughness: 0.8 }),
  );
  beam.scale.set(0.6 * L, 0.04 * L, 0.2 * L);
  beam.position.set(0, 0.02 * L, 0);
  addLine(
    kit,
    [
      [0, 0, 0],
      [0, -1.1 * L, 0],
    ],
    faint,
    'pendulum-vertical',
  );
  if (arc.length) addLine(kit, arc, faint, 'pendulum-arc');

  // The small-angle model's bob (when shown), the string and the bob.
  const r = 0.06 * L;
  const smallLine = o.showSmall ? dynamicLine(kit, kit.color('--chart-1'), 0.5) : null;
  const ghost = o.showSmall
    ? kit.mesh(kit.sphere(), kit.glass(kit.color('--chart-1'), { opacity: 0.35 }))
    : null;
  if (ghost) {
    ghost.name = 'pendulum-small';
    ghost.scale.setScalar(r);
  }
  const smallTag = o.showSmall ? kit.label(o.texts.small, [0, 0, 0], 'muted') : null;
  const string = dynamicLine(kit, kit.color('--text'));
  const bob = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-2'), { roughness: 0.4 }));
  bob.name = 'pendulum-bob';
  bob.scale.setScalar(r);
  const thick = 0.012 * L;
  const v = addMovingArrow(kit, {
    radius: thick,
    color: kit.color('--chart-1'),
    name: 'pendulum-v',
  });
  const P = addMovingArrow(kit, {
    radius: thick,
    color: kit.color('--chart-3'),
    name: 'pendulum-P',
  });
  const T = addMovingArrow(kit, {
    radius: thick,
    color: kit.color('--chart-4'),
    name: 'pendulum-T',
  });
  const vTag = kit.label(o.texts.v, [0, 0, 0], 'strong');
  const PTag = kit.label(o.texts.P, [0, 0, 0], 'strong');
  const TTag = kit.label(o.texts.T, [0, 0, 0], 'strong');

  const now = { th: q.theta0, bob: bobAt(q, q.theta0), small: null as Vec3 | null };
  const place = () => {
    const s = o.read();
    const th = s?.[PE.th] ?? q.theta0;
    const om = s?.[PE.om] ?? 0;
    const tension = s?.[PE.T] ?? q.m * q.g * Math.cos(th);
    const [x, y] = bobAt(q, th);
    now.th = th;
    now.bob = [x, y, 0];
    bob.position.set(x, y, 0);
    string.setXYZ(1, x, y, 0);
    string.needsUpdate = true;
    if (ghost && smallLine && smallTag) {
      const [sx, sy] = bobAt(q, s?.[PE.thS] ?? q.theta0);
      ghost.position.set(sx, sy, 0);
      smallLine.setXYZ(1, sx, sy, 0);
      smallLine.needsUpdate = true;
      smallTag.position.set(sx + 0.12 * L, sy - 0.08 * L, 0);
      now.small = [sx, sy, 0];
    }
    // v is tangent (L ω (cos θ, sin θ)); P is down; T points from the bob to the pivot.
    const vx = L * om * Math.cos(th) * kv;
    const vy = L * om * Math.sin(th) * kv;
    v.set(x, y, 0, vx, vy, 0);
    vTag.position.set(x + vx * 1.15, y + vy * 1.15, 0);
    vTag.visible = v.group.visible;
    const w = q.m * q.g * kf;
    P.set(x, y, 0, 0, -w, 0);
    PTag.position.set(x + 0.05 * L, y - w * 1.1, 0);
    const tx = -Math.sin(th) * tension * kf;
    const ty = Math.cos(th) * tension * kf;
    T.set(x, y, 0, tx, ty, 0);
    TTag.position.set(x + tx * 1.15, y + ty * 1.15, 0);
    TTag.visible = T.group.visible;
  };
  place();

  const points: Vec3[] = [];
  for (const px of [-1.05 * L, 1.05 * L])
    for (const py of [0.08 * L, -1.25 * L]) points.push([px, py, 0]);
  points.push([0, 0, -0.1 * L], [0, 0, 0.1 * L]);
  return {
    kit,
    bounds: { center: [0, -0.55 * L, 0], radius: 1.2 * L, points },
    setTime: place,
    tick: place,
    state: () => ({ th: now.th, bob: [...now.bob], small: now.small && [...now.small] }),
  };
}
