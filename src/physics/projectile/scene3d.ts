/**
 * The 3D scene of the throw lessons (Rơi tự do, Ném ngang, Ném xiên; three.js on the biology
 * scene kit; 1 world unit = 1 m): the ground with metre marks, the launch platform of height
 * h₀, the predicted path of `throw3d` (dots), the highest point H and the landing point L, and
 * the ball where the lesson's engine puts it (`sim.renderState`) with its shadow on the ground,
 * its velocity v⃗ (and the two components) and its acceleration g⃗ — the 2D picture's colours
 * and scales. `setTime` / `tick` move the ball and re-aim the arrows without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, addMovingArrow, type Vec3 } from '../view3d/arrow';
import type { ProjectileInput } from './analytic';
import { PS } from './engine';
import { throw3d } from './projectile3d';

export interface ThrowScene extends Bio3DScene {
  state(): { x: number; y: number; vx: number; vy: number; landed: boolean; path: number };
}

export function buildThrowScene(
  kit: SceneKit,
  o: {
    inp: ProjectileInput;
    /** The predicted path means something only while nobody intervened (as in 2D). */
    showPath: boolean;
    texts: { H: string | null; L: string | null; h0: string | null; v: string; a: string };
    fmtX: (x: number) => string;
    read: () => Float64Array | null;
  },
): ThrowScene {
  const { inp } = o;
  const T = throw3d(inp);
  const { r, s, xMin, xMax, zHalf } = T;
  const top = r.maxHeight + 0.15 * s;

  // The ground: a slab with its top at y = 0, metre marks along its front edge.
  const box = kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const ground = kit.mesh(box, kit.solid(kit.color('--border'), { roughness: 0.9 }));
  ground.name = 'throw-ground';
  ground.scale.set(xMax - xMin, 0.02 * s, 2 * zHalf);
  ground.position.set((xMin + xMax) / 2, -0.01 * s, 0);
  const markColor = kit.color('--text-faint');
  for (const x of T.ticks) {
    addLine(
      kit,
      [
        [x, 0.001 * s, zHalf],
        [x, 0.001 * s, zHalf - 0.04 * s],
      ],
      markColor,
    );
    kit.label(o.fmtX(x), [x, 0, zHalf + 0.03 * s], 'muted');
  }

  // The launch platform.
  if (inp.h0 > 0) {
    const w = 0.08 * s;
    const tower = kit.mesh(box, kit.solid(kit.color('--text-muted'), { roughness: 0.8 }));
    tower.scale.set(w, inp.h0, 2 * w);
    tower.position.set(-w / 2, inp.h0 / 2, 0);
    if (o.texts.h0) kit.label(o.texts.h0, [-w - 0.14 * s, inp.h0 / 2, 0], 'muted');
  }

  // The predicted path, H and L.
  let pathCount = 0;
  if (o.showPath) {
    const dots = kit.instanced(kit.sphere(0.5), kit.solid(markColor), T.path.length);
    dots.name = 'throw-path';
    const m4 = new THREE.Matrix4();
    const one = new THREE.Quaternion();
    const size = new THREE.Vector3().setScalar(0.005 * s);
    const at = new THREE.Vector3();
    T.path.forEach(([x, y], i) => dots.setMatrixAt(i, m4.compose(at.set(x, y, 0), one, size)));
    dots.instanceMatrix.needsUpdate = true;
    pathCount = T.path.length;
    if (r.apexTime > 0 && o.texts.H) {
      const ax = r.vx0 * r.apexTime;
      addLine(
        kit,
        [
          [ax, 0, 0],
          [ax, r.maxHeight, 0],
        ],
        markColor,
        'throw-apex',
      );
      kit.label(o.texts.H, [ax, r.maxHeight + 0.06 * s, 0], 'muted');
    }
    // A vertical throw has no range (cos 90° is not exactly 0 in floating point).
    if (Math.abs(r.vx0) > 1e-9 * Math.max(1, inp.v0) && o.texts.L) {
      const mark = kit.mesh(kit.cylinder(), kit.solid(markColor));
      mark.scale.set(0.03 * s, 0.002 * s, 0.03 * s);
      mark.position.set(r.range, 0.001 * s, 0);
      kit.label(o.texts.L, [r.range, 0.05 * s, 0.08 * s], 'muted');
    }
  }

  // The ball, its shadow and its vectors.
  const radius = 0.02 * s;
  const ball = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-2'), { roughness: 0.4 }));
  ball.name = 'throw-ball';
  ball.scale.setScalar(radius);
  const shadow = kit.mesh(kit.cylinder(), kit.glass(kit.color('--text'), { opacity: 0.22 }));
  shadow.scale.set(radius, 0.001 * s, radius);
  const vColor = kit.color('--chart-1');
  const thick = 0.004 * s;
  const v = addMovingArrow(kit, { radius: thick, color: vColor, name: 'throw-v' });
  const vx = addMovingArrow(kit, { radius: thick * 0.6, color: vColor });
  const vy = addMovingArrow(kit, { radius: thick * 0.6, color: vColor });
  const a = addMovingArrow(kit, { radius: thick, color: kit.color('--chart-4'), name: 'throw-a' });
  const vTag = kit.label(o.texts.v, [0, 0, 0], 'strong');
  const aTag = kit.label(o.texts.a, [0, 0, 0], 'strong');

  const now = { x: 0, y: 0, vx: 0, vy: 0, landed: false };
  const place = () => {
    const st = o.read();
    now.x = st?.[PS.x] ?? 0;
    now.y = st?.[PS.y] ?? inp.h0;
    now.vx = st?.[PS.vx] ?? 0;
    now.vy = st?.[PS.vy] ?? 0;
    now.landed = (st?.[PS.landed] ?? 0) > 0.5;
    const ax = st?.[PS.ax] ?? 0;
    const ay = st?.[PS.ay] ?? -inp.g;
    ball.position.set(now.x, now.y, 0);
    shadow.position.set(now.x, 0.001 * s, 0);
    shadow.visible = now.y > radius;
    const k = T.kv;
    v.set(now.x, now.y, 0, now.vx * k, now.vy * k, 0);
    vx.set(now.x, now.y, 0, now.vx * k, 0, 0);
    vy.set(now.x, now.y, 0, 0, now.vy * k, 0);
    vTag.position.set(now.x + now.vx * k, now.y + now.vy * k + 0.03 * s, 0);
    vTag.visible = v.group.visible;
    // Beside the ball, as in 2D: g points down like v_y, and on it the two would merge.
    const gx = now.x - 0.035 * s;
    a.set(gx, now.y, 0, ax * T.ka, ay * T.ka, 0);
    aTag.position.set(gx + ax * T.ka - 0.02 * s, now.y + ay * T.ka, 0);
    aTag.visible = a.group.visible;
  };
  place();

  // What the camera keeps in view: the ground with its marks, the path, and the velocity arrows
  // at launch and at landing (the landing one points below the ground).
  const points: Vec3[] = [];
  for (const x of [xMin, xMax])
    for (const y of [-0.02 * s, top])
      for (const z of [-zHalf, zHalf + 0.06 * s]) points.push([x, y, z]);
  const vyEnd = r.vy0 - inp.g * r.flightTime;
  points.push([r.vx0 * T.kv, inp.h0 + r.vy0 * T.kv, 0]);
  points.push([r.range + r.vx0 * T.kv, vyEnd * T.kv - 0.04 * s, 0]);
  return {
    kit,
    bounds: {
      center: [(xMin + xMax) / 2, top / 2, 0],
      radius: Math.hypot((xMax - xMin) / 2, top / 2, zHalf),
      points,
    },
    setTime: place,
    tick: place,
    state: () => ({ ...now, path: pathCount }),
  };
}
