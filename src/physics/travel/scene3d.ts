/**
 * The 3D scene of "Sóng cơ" (three.js, on the biology scene kit): the medium of `travel3d` as one
 * instanced mesh of parts (--chart-2), the parts at M highlighted (--chart-5), the source O and the
 * direction of travel. `setTime` / `tick` move every part to its place at the engine's instant
 * (t = front / v, as the 2D picture) without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, type Vec3 } from '../view3d/arrow';
import { shiftScale, verticalScale, viewLength } from './draw';
import { TW } from './engine';
import { KIND, displacement, type Travel } from './model';
import { medium } from './travel3d';

export interface TravelScene extends Bio3DScene {
  state(): { t: number; parts: number; mY: number; mX: number };
}

export function buildTravelScene(
  kit: SceneKit,
  o: { q: Travel; texts: { O: string; M: string; v: string }; read: () => Float64Array | null },
): TravelScene {
  const { q } = o;
  const md = medium(q);
  const Lv = viewLength(q);
  const S = verticalScale(q);
  const shift = shiftScale(q);
  const transverse = q.kind === KIND.transverse;
  const count = md.xs.length * md.rows.length * md.layers.length;
  const r = Math.min(Lv / md.xs.length / 2.6, md.half / md.rows.length);
  const parts = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-2')), count);
  parts.name = 'tw-parts';
  // The parts at M's place (nearest layer): a second, highlighted mesh; none when M lies past
  // the drawn length (the 2D picture stops at 12 λ).
  const step = md.xs[1] ?? 1;
  const jM = q.xM <= (md.xs[md.xs.length - 1] ?? 0) + step / 2 ? Math.round(q.xM / step) : -1;
  const mCount = md.rows.length * md.layers.length;
  const atM = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-5')), mCount);
  atM.name = 'tw-m';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3().setScalar(r);
  const sizeM = new THREE.Vector3().setScalar(r * 1.35);
  let t = 0;
  let mX = 0;
  let mY = 0;
  const place = () => {
    t = (o.read()?.[TW.front] ?? 0) / q.v;
    let k = 0;
    let km = 0;
    for (let j = 0; j < md.xs.length; j++) {
      const x = md.xs[j] ?? 0;
      const u = displacement(q, x, t);
      const px = transverse ? x : x + u * shift;
      const py = transverse ? u * S : 0;
      if (j === jM) {
        mX = px;
        mY = py;
      }
      for (const row of md.rows)
        for (const layer of md.layers) {
          pos.set(px, py + layer * md.half, row * md.half);
          if (j === jM) atM.setMatrixAt(km++, m4.compose(pos, one, sizeM));
          else parts.setMatrixAt(k++, m4.compose(pos, one, size));
        }
    }
    parts.count = k;
    atM.count = km;
    parts.instanceMatrix.needsUpdate = true;
    atM.instanceMatrix.needsUpdate = true;
  };
  place();

  // The source O at x = 0 and the direction of travel.
  const post = kit.mesh(kit.cylinder(), kit.solid(kit.color('--text-muted')));
  post.scale.set(r * 0.8, 2.6 * md.half, r * 0.8);
  post.position.set(-r * 3, 0, 0);
  kit.label(o.texts.O, [-r * 3, 1.6 * md.half, 0], 'strong');
  if (jM >= 0)
    kit.label(
      o.texts.M,
      [md.xs[jM] ?? 0, 1.7 * md.half + (transverse ? q.A * S : 0), md.half],
      'strong',
    );
  addArrow(kit, {
    from: [0.1 * Lv, -1.6 * md.half - (transverse ? q.A * S : 0), md.half],
    dir: [1, 0, 0],
    length: 0.2 * Lv,
    radius: r * 0.25,
    color: kit.color('--accent'),
    name: 'tw-direction',
  });
  kit.label(
    o.texts.v,
    [0.32 * Lv, -1.6 * md.half - (transverse ? q.A * S : 0) + r * 3, md.half],
    'plain',
  );

  const hy = 1.8 * md.half + (transverse ? q.A * S : 0);
  const points: Vec3[] = [];
  for (const x of [-r * 4, Lv])
    for (const y of [-hy, hy]) for (const z of [-md.half, md.half]) points.push([x, y, z]);
  return {
    kit,
    bounds: { center: [Lv / 2, 0, 0], radius: Math.hypot(Lv / 2, hy, md.half), points },
    setTime: place,
    tick: place,
    state: () => ({ t, parts: count, mX, mY }),
  };
}
