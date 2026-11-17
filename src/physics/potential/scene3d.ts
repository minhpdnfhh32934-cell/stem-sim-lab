/**
 * The 3D scene of "Điện thế" (three.js, on the biology scene kit): the two plates (+ --chart-3,
 * − --chart-1, as in 2D), field lines from + to −, the equipotential planes through M and N
 * (see-through, labelled with V), the path, and the charge where the engine has it (moved by
 * `setTime` / `tick` from `read()`, never rebuilt) with the force qE on it.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, addLine, type Vec3 } from '../view3d/arrow';
import { PT } from './engine';
import { chargeAt, type Potential3D } from './potential3d';

/** Seen almost side-on, a little from above: the planes y = const show as bands. */
export const POTENTIAL_VIEW: Vec3 = [0.35, 0.35, 1];

export interface PotentialTexts {
  plus: string;
  minus: string;
  E: string;
  /** "V_M = …", "V_N = …". */
  planes: Record<'M' | 'N', string>;
  F: string;
}

export interface PotentialScene extends Bio3DScene {
  state(): { charge: Vec3; planes: number };
}

export function buildPotentialScene(
  kit: SceneKit,
  o: { model: Potential3D; texts: PotentialTexts; read: () => Float64Array | null },
): PotentialScene {
  const { model: m, texts } = o;
  const { d } = m.q;
  const w = m.x1 - m.x0;
  const cx = (m.x0 + m.x1) / 2;
  const box = kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const plus = kit.color('--chart-3');
  const minus = kit.color('--chart-1');
  const muted = kit.color('--text-muted');

  // The plates: + on top (V = U), − below (V = 0).
  for (const [y, color, text] of [
    [d, plus, texts.plus],
    [0, minus, texts.minus],
  ] as const) {
    const p = kit.mesh(box, kit.solid(color, { roughness: 0.4 }));
    p.scale.set(w, d * 0.06, 2 * m.depth);
    p.position.set(cx, y + (y > 0 ? 0.03 : -0.03) * d, 0);
    kit.label(text, [m.x0 - 0.05 * d, y, m.depth], 'strong');
  }

  // Field lines from + to − (illustration of a uniform field).
  if (m.q.U !== 0) {
    const g = new THREE.Group();
    g.name = 'pot-field';
    kit.scene.add(g);
    for (const fx of [0.2, 0.5, 0.8])
      for (const fz of [-0.6, 0.6]) {
        const top = m.q.U > 0 ? d : 0;
        addArrow(
          kit,
          {
            from: [m.x0 + fx * w, top, fz * m.depth],
            dir: [0, m.q.U > 0 ? -1 : 1, 0],
            length: d,
            radius: d * 0.008,
            color: muted,
          },
          g,
        );
      }
    kit.label(texts.E, [m.x0 - 0.05 * d, 0.5 * d, m.depth], 'plain');
  }

  // Equipotential planes through M and N.
  const sheet = kit.glass(kit.color('--chart-2'), { opacity: 0.18, side: THREE.DoubleSide });
  const plane = kit.shared('plane', () => new THREE.PlaneGeometry(1, 1));
  m.planes.forEach((pl) => {
    const mesh = kit.mesh(plane, sheet);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(w, 2 * m.depth, 1);
    mesh.position.set(cx, pl.y, 0);
    mesh.name = `pot-plane-${pl.name}`;
    kit.label(texts.planes[pl.name], [m.x1 - 0.05 * d, pl.y + 0.06 * d, -m.depth], 'plain');
  });

  // The path, then M, N (and P).
  addLine(kit, m.path, kit.color('--accent'), 'pot-path');
  const r = Math.max(0.004, 0.06 * d) / 2;
  const point = kit.solid(kit.color('--chart-5'));
  for (const [pt, name] of [
    [m.q.M, 'M'],
    [m.q.N, 'N'],
  ] as const) {
    const s = kit.mesh(kit.sphere(), point);
    s.scale.setScalar(r * 0.6);
    s.position.set(pt.x, pt.y, 0);
    kit.label(name, [pt.x - 0.06 * d, pt.y + 0.08 * d, 0], 'strong');
  }
  if (m.path.length === 3) kit.label('P', [m.q.P.x + 0.06 * d, m.q.P.y + 0.06 * d, 0], 'strong');

  // The charge and the force qE on it (moved, never rebuilt).
  const charge = new THREE.Group();
  charge.name = 'pot-charge';
  kit.scene.add(charge);
  const ball = kit.mesh(kit.sphere(), kit.solid(m.q.q >= 0 ? plus : minus), charge);
  ball.scale.setScalar(r);
  if (m.force)
    addArrow(
      kit,
      {
        from: [0, 0, 0],
        dir: m.force,
        length: 0.22 * d,
        radius: d * 0.012,
        color: plus,
        name: 'pot-force',
      },
      charge,
    );
  const fLabel = m.force ? kit.label(texts.F, [0, 0, 0], 'strong') : null;
  // Every frame while playing: no allocation.
  const place = () => {
    const s = o.read();
    const x = s?.[PT.x] ?? m.q.M.x;
    const y = s?.[PT.y] ?? m.q.M.y;
    charge.position.set(x, y, 0);
    fLabel?.position.set(x + 0.06 * d, y + (m.force?.[1] ?? 0) * 0.28 * d, 0);
  };
  place();

  return {
    kit,
    bounds: {
      center: [cx, d / 2, 0],
      radius: Math.hypot(w / 2, d * 0.7, m.depth),
      points: [m.x0, m.x1].flatMap((x) =>
        [-0.1 * d, 1.1 * d].flatMap((y) => [-m.depth, m.depth].map((z): Vec3 => [x, y, z])),
      ),
    },
    setTime: place,
    tick: place,
    state: () => ({ charge: chargeAt(o.read(), m), planes: m.planes.length }),
  };
}
