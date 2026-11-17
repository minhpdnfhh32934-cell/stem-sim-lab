/**
 * The 3D scene of "Con lắc lò xo" (three.js on the biology scene kit; 1 world unit = 1 m), the
 * 2D picture's layout in space: horizontal — the wall, the spring, the block sliding on the
 * ground, the equilibrium O and ±A, v and the spring force; vertical — the ceiling, the spring,
 * the hanging block, the equilibrium (VTCB), the natural length l₀, ±A, the weight and the spring
 * force. The block is where the lesson's engine puts it (`sim.renderState`); `setTime` / `tick`
 * stretch the coil and move the block without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, addMovingArrow, type Vec3 } from '../view3d/arrow';
import { SP, type SpringInput } from './engine';
import { COIL_POINTS, spring3d, writeCoil } from './spring3d';

export interface SpringScene extends Bio3DScene {
  state(): { x: number; block: Vec3; coilEnd: Vec3 };
}

export function buildSpringScene(
  kit: SceneKit,
  o: {
    q: SpringInput;
    texts: { v: string; F: string; P: string; O: string; eq: string; l0: string };
    read: () => Float64Array | null;
  },
): SpringScene {
  const { q } = o;
  const L = spring3d(q);
  const { A, bs, len } = L;
  const faint = kit.color('--text-faint');
  const box = kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const fixture = kit.solid(kit.color('--text-muted'), { roughness: 0.8 });

  // The coil: one line, its points rewritten each frame.
  const coilPos = new Float32Array(COIL_POINTS * 3);
  const coilGeo = kit.geometry(new THREE.BufferGeometry());
  const coilAttr = new THREE.BufferAttribute(coilPos, 3);
  coilGeo.setAttribute('position', coilAttr);
  const coil = new THREE.Line(
    coilGeo,
    kit.own(new THREE.LineBasicMaterial({ color: kit.color('--text-muted') })),
  );
  coil.name = 'spring-coil';
  kit.scene.add(coil);

  const block = kit.mesh(box, kit.solid(kit.color('--chart-2'), { roughness: 0.5 }));
  block.name = 'spring-block';
  block.scale.setScalar(bs);
  const mTag = kit.label('m', [0, 0, 0], 'strong');
  const thick = 0.03 * bs;
  const front = 0.6 * bs;
  const F = addMovingArrow(kit, { radius: thick, color: kit.color('--chart-3'), name: 'spring-F' });
  const FTag = kit.label(o.texts.F, [0, 0, 0], 'strong');
  const now = { x: 0, block: [0, 0, 0] as Vec3, coilEnd: [0, 0, 0] as Vec3 };
  let place: () => void;
  const points: Vec3[] = [];

  if (q.vertical) {
    const ceil = L.ceil ?? len + bs / 2;
    const top = kit.mesh(box, fixture);
    top.scale.set(4 * bs, 0.1 * bs, 1.6 * bs);
    top.position.set(0, ceil + 0.05 * bs, 0);
    addLine(
      kit,
      [
        [-2.2 * bs, 0, 0],
        [2.2 * bs, 0, 0],
      ],
      faint,
      'spring-eq',
    );
    kit.label(o.texts.eq, [2.6 * bs, 0, 0], 'muted');
    const natural = ceil - q.l0 - bs / 2;
    addLine(
      kit,
      [
        [-1.6 * bs, natural, 0],
        [1.6 * bs, natural, 0],
      ],
      faint,
    );
    kit.label(o.texts.l0, [-2.4 * bs, natural, 0], 'muted');
    if (A > 0)
      for (const y of [A, -A])
        addLine(
          kit,
          [
            [1.4 * bs, y, 0],
            [1.8 * bs, y, 0],
          ],
          faint,
        );
    const P = addMovingArrow(kit, {
      radius: thick,
      color: kit.color('--chart-4'),
      name: 'spring-P',
    });
    const PTag = kit.label(o.texts.P, [0, 0, 0], 'strong');
    place = () => {
      const s = o.read();
      const x = s?.[SP.x] ?? q.x0;
      now.x = x;
      now.block = [0, x, 0];
      block.position.set(0, x, 0);
      mTag.visible = false; // the hanging block is small: its name would cover the forces
      writeCoil(coilPos, ceil, x + bs / 2, 1, 0, 0.3 * bs);
      coilAttr.needsUpdate = true;
      now.coilEnd = [0, x + bs / 2, 0];
      const w = q.m * q.g * L.kf;
      P.set(0.25 * bs, x, front, 0, -w, 0);
      PTag.position.set(0.25 * bs + 0.2 * bs, x - w, front);
      const f = (s?.[SP.F] ?? 0) * L.kf;
      F.set(-0.25 * bs, x, front, 0, f, 0);
      FTag.position.set(-0.25 * bs - 0.25 * bs, x + f, front);
      FTag.visible = F.group.visible;
    };
    for (const px of [-2.6 * bs, 2.8 * bs])
      for (const py of [-A - 1.5 * bs, ceil + 0.2 * bs]) points.push([px, py, 0]);
  } else {
    const wall = L.wall ?? -len - bs / 2;
    const ground = kit.mesh(box, kit.solid(kit.color('--border'), { roughness: 0.9 }));
    const x0 = wall - 0.1 * bs;
    const x1 = A + 2 * bs;
    ground.scale.set(x1 - x0, 0.06 * bs, 2.4 * bs);
    ground.position.set((x0 + x1) / 2, -0.03 * bs, 0);
    const wallBox = kit.mesh(box, fixture);
    wallBox.scale.set(0.12 * bs, 2 * bs, 2 * bs);
    wallBox.position.set(wall - 0.06 * bs, bs, 0);
    addLine(
      kit,
      [
        [0, -0.4 * bs, 0],
        [0, 1.8 * bs, 0],
      ],
      faint,
      'spring-O',
    );
    kit.label(o.texts.O, [0, 1.95 * bs, 0], 'muted');
    if (A > 0) {
      kit.label('+A', [A, 0, front + 0.2 * bs], 'muted');
      kit.label('−A', [-A, 0, front + 0.2 * bs], 'muted');
    }
    const v = addMovingArrow(kit, {
      radius: thick,
      color: kit.color('--chart-1'),
      name: 'spring-v',
    });
    const vTag = kit.label(o.texts.v, [0, 0, 0], 'strong');
    place = () => {
      const s = o.read();
      const x = s?.[SP.x] ?? q.x0;
      now.x = x;
      now.block = [x, bs / 2, 0];
      block.position.set(x, bs / 2, 0);
      mTag.position.set(x, bs / 2, front);
      writeCoil(coilPos, wall, x - bs / 2, 0, bs / 2, 0.3 * bs);
      coilAttr.needsUpdate = true;
      now.coilEnd = [x - bs / 2, bs / 2, 0];
      const vv = (s?.[SP.v] ?? 0) * L.kv;
      v.set(x, 1.15 * bs, 0, vv, 0, 0);
      vTag.position.set(x + vv * 1.1, 1.35 * bs, 0);
      vTag.visible = v.group.visible;
      const f = (s?.[SP.F] ?? 0) * L.kf;
      F.set(x, 0.5 * bs, front, f, 0, 0);
      FTag.position.set(x + f * 1.1, 0.75 * bs, front);
      FTag.visible = F.group.visible;
    };
    for (const px of [x0, x1]) for (const py of [-0.4 * bs, 2.1 * bs]) points.push([px, py, 0]);
  }
  points.push([0, 0, -1.2 * bs], [0, 0, 1.2 * bs]);
  place();
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const radius = Math.max(...points.map((p) => Math.hypot(p[0] - cx, p[1] - cy, p[2])));
  return {
    kit,
    bounds: { center: [cx, cy, 0], radius, points },
    setTime: place,
    tick: place,
    state: () => ({ x: now.x, block: [...now.block], coilEnd: [...now.coilEnd] }),
  };
}
