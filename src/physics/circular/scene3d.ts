/**
 * The 3D scene of "Chuyển động tròn đều" (three.js on the biology scene kit; 1 world unit = 1 m):
 * the circle of radius r in a horizontal plane, the axis through its centre, the string from the
 * centre to the body, the body where the lesson's engine puts it (`sim.renderState`), its velocity
 * v (tangent) and its centripetal acceleration a_ht (towards the centre) at the 2D picture's
 * scales. `setTime` / `tick` move the body and re-aim the arrows without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, addMovingArrow, type Vec3 } from '../view3d/arrow';
import { circle3d, toWorld } from './circular3d';
import { CE } from './engine';
import type { Circular } from './model';

export interface CircularScene extends Bio3DScene {
  /** The body's world position and its arrows' world directions. */
  state(): { at: Vec3; v: Vec3; a: Vec3 };
}

const SEGMENTS = 96;

export function buildCircularScene(
  kit: SceneKit,
  o: { c: Circular; texts: { v: string; a: string }; read: () => Float64Array | null },
): CircularScene {
  const { r, kv, ka } = circle3d(o.c);
  const faint = kit.color('--text-faint');

  // The turning plane (a faint disc), the path, the axis and the centre.
  const disc = kit.mesh(
    kit.cylinder(48),
    kit.glass(kit.color('--text-muted'), { opacity: 0.08, side: THREE.DoubleSide }),
  );
  disc.scale.set(1.15 * r, 0.002 * r, 1.15 * r);
  disc.position.y = -0.002 * r;
  const ring: Vec3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (2 * Math.PI * i) / SEGMENTS;
    ring.push(toWorld(r * Math.cos(a), r * Math.sin(a)));
  }
  addLine(kit, ring, kit.color('--text-muted'), 'circle-path');
  addLine(
    kit,
    [
      [0, -0.3 * r, 0],
      [0, 0.3 * r, 0],
    ],
    faint,
    'circle-axis',
  );
  const centre = kit.mesh(kit.sphere(), kit.solid(kit.color('--text')));
  centre.scale.setScalar(0.025 * r);

  // The string, the body and its arrows.
  const string = new THREE.Line(
    kit.geometry(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3),
      ),
    ),
    kit.own(new THREE.LineBasicMaterial({ color: faint })),
  );
  string.name = 'circle-string';
  kit.scene.add(string);
  const strPos = string.geometry.getAttribute('position') as THREE.BufferAttribute;
  const body = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-2'), { roughness: 0.4 }));
  body.name = 'circle-body';
  body.scale.setScalar(0.09 * r);
  const vArrow = addMovingArrow(kit, {
    radius: 0.02 * r,
    color: kit.color('--chart-1'),
    name: 'circle-v',
  });
  const aArrow = addMovingArrow(kit, {
    radius: 0.02 * r,
    color: kit.color('--chart-4'),
    name: 'circle-a',
  });
  const vTag = kit.label(o.texts.v, [0, 0, 0], 'strong');
  const aTag = kit.label(o.texts.a, [0, 0, 0], 'strong');

  const now = { at: [r, 0, 0] as Vec3, v: [0, 0, 0] as Vec3, a: [0, 0, 0] as Vec3 };
  const place = () => {
    const s = o.read();
    const [x, y, z] = toWorld(s?.[CE.x] ?? r, s?.[CE.y] ?? 0);
    const [vx, , vz] = toWorld(s?.[CE.vx] ?? 0, s?.[CE.vy] ?? 0);
    const [ax, , az] = toWorld(s?.[CE.ax] ?? 0, s?.[CE.ay] ?? 0);
    now.at[0] = x;
    now.at[1] = y;
    now.at[2] = z;
    now.v[0] = vx;
    now.v[2] = vz;
    now.a[0] = ax;
    now.a[2] = az;
    body.position.set(x, y, z);
    strPos.setXYZ(1, x, y, z);
    strPos.needsUpdate = true;
    vArrow.set(x, y, z, vx * kv, 0, vz * kv);
    // Labels just beyond the arrow tips, v a little above the plane and a_ht a little below, so
    // that neither covers the body when it is on the far side.
    vTag.position.set(x + vx * kv * 1.3, 0.05 * r, z + vz * kv * 1.3);
    aArrow.set(x, y, z, ax * ka, 0, az * ka);
    aTag.position.set(x + ax * ka * 1.2, -0.1 * r, z + az * ka * 1.2);
  };
  place();

  const R = 1.2 * r;
  const points: Vec3[] = [];
  for (const x of [-R, R])
    for (const y of [-0.3 * r, 0.3 * r]) for (const z of [-R, R]) points.push([x, y, z]);
  return {
    kit,
    bounds: { center: [0, 0, 0], radius: Math.hypot(R, 0.3 * r), points },
    setTime: place,
    tick: place,
    state: () => ({ at: [...now.at], v: [...now.v], a: [...now.a] }),
  };
}
