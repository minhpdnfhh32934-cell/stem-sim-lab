/**
 * The 3D scene of "Định luật II Kepler" (three.js on the biology scene kit; 1 world unit = the
 * semi-major axis a): the orbit in a horizontal plane, the Sun at the focus, the N slices swept
 * in equal times (the one being swept highlighted, as in 2D), and the planet where the lesson's
 * engine puts it (`sim.renderState`) joined to the Sun. `setTime` moves the planet and the
 * highlight without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, type Vec3 } from '../view3d/arrow';
import { slices, sliceAt, toWorld } from './kepler3d';
import { KE } from './engine';
import { A, arc, perihelion, semiMinor, type Orbit } from './model';

export interface KeplerScene extends Bio3DScene {
  state(): { slice: number; at: Vec3 };
}

export function buildKeplerScene(
  kit: SceneKit,
  o: { o: Orbit; texts: { sun: string }; read: () => Float64Array | null },
): KeplerScene {
  const orb = o.o;
  const faint = kit.color('--text-faint');
  // The slices: one fan each (Sun + the arc), on the orbit's plane.
  const swept = kit.glass(kit.color('--stage-accent'), { opacity: 0.35, side: THREE.DoubleSide });
  const even = kit.glass(kit.color('--chart-1'), { opacity: 0.12, side: THREE.DoubleSide });
  const odd = kit.glass(kit.color('--chart-1'), { opacity: 0.06, side: THREE.DoubleSide });
  const fans = slices(orb).map((pts, k) => {
    const pos = new Float32Array((pts.length + 1) * 3);
    pts.forEach((p, i) => {
      pos.set(toWorld(p.x, p.y), 3 * (i + 1));
    });
    const index: number[] = [];
    for (let i = 1; i < pts.length; i++) index.push(0, i, i + 1);
    const geo = kit.geometry(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(index);
    const fan = kit.mesh(geo, k % 2 === 0 ? even : odd);
    fan.name = `kepler-slice-${String(k)}`;
    const end = pts.at(-1) ?? { x: 0, y: 0 };
    addLine(kit, [[0, 0, 0], toWorld(end.x, end.y)], faint);
    return fan;
  });
  addLine(
    kit,
    arc(orb, 0, orb.T, 240).map((p) => toWorld(p.x, p.y)),
    kit.color('--text-muted'),
    'kepler-orbit',
  );

  // The Sun at the focus, the planet and the line joining them.
  const sun = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-3'), { roughness: 0.5 }));
  sun.name = 'kepler-sun';
  sun.scale.setScalar(0.06 * A);
  kit.label(o.texts.sun, [0, 0.12 * A, 0], 'muted');
  const planet = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-2'), { roughness: 0.4 }));
  planet.name = 'kepler-planet';
  planet.scale.setScalar(0.04 * A);
  const join = new THREE.Line(
    kit.geometry(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(6), 3),
      ),
    ),
    kit.own(new THREE.LineBasicMaterial({ color: kit.color('--text') })),
  );
  kit.scene.add(join);
  const joinPos = join.geometry.getAttribute('position') as THREE.BufferAttribute;

  const now = { slice: -1, at: toWorld(perihelion(orb), 0) };
  let lastT = 0;
  const place = (t: number) => {
    lastT = t;
    const s = o.read();
    now.at = toWorld(s?.[KE.x] ?? perihelion(orb), s?.[KE.y] ?? 0);
    planet.position.set(...now.at);
    joinPos.setXYZ(1, ...now.at);
    joinPos.needsUpdate = true;
    const k = sliceAt(orb, t);
    if (k !== now.slice) {
      fans.forEach((f, i) => {
        f.material = i === k ? swept : i % 2 === 0 ? even : odd;
      });
      now.slice = k;
    }
  };
  place(0);

  // The ellipse spans x ∈ [−a(1+e), a(1−e)] (the Sun at the origin) and z ∈ [−b, b].
  const b = semiMinor(orb);
  const x0 = -A * (1 + orb.e);
  const x1 = A * (1 - orb.e);
  const points: Vec3[] = [];
  for (const x of [x0 - 0.05, x1 + 0.05])
    for (const z of [-b - 0.05, b + 0.05]) points.push([x, 0.12 * A, z]);
  return {
    kit,
    bounds: { center: [(x0 + x1) / 2, 0, 0], radius: Math.hypot((x1 - x0) / 2, b) + 0.1, points },
    setTime: place,
    tick: () => {
      place(lastT);
    },
    state: () => ({ slice: now.slice, at: [...now.at] }),
  };
}
