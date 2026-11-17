/**
 * The 3D scene of "Sóng dừng trên dây" (three.js, on the biology scene kit): the string between
 * two clamps as beads at y = S·standing(w, x, t) (the model's own y = 2A sin kx sin ωt, drawn S
 * times taller as in 2D) at the engine's instant t = φ/ω, the envelope ±2A|sin kx| turned about
 * the string into see-through "loops" (the path the string sweeps through), the nodes N and the
 * antinodes, and point P where the engine reads y. `setTime` / `tick` move the beads without
 * allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import type { Vec3 } from '../view3d/arrow';
import { STRING_POINTS, verticalScale } from './draw';
import { SW, waveOf, type StandingInput } from './engine';
import { antinodes, nodes, standing } from './model';

export interface StandingScene extends Bio3DScene {
  state(): { t: number; yP: number; beads: number };
}

export function buildStandingScene(
  kit: SceneKit,
  o: {
    q: StandingInput;
    texts: { N: string; B: string; P: string; none: string };
    read: () => Float64Array | null;
  },
): StandingScene {
  const { q } = o;
  const w = waveOf(q);
  const S = verticalScale(q);
  const H = 2 * q.A * S;
  const L = q.L;
  const r = L / 220;
  const clampH = Math.max(1.6 * H, 0.08 * L);

  // The clamps at both ends.
  const block = kit.solid(kit.color('--text-muted'), { roughness: 0.7 });
  for (const x of [0, L]) {
    const b = kit.mesh(
      kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1)),
      block,
    );
    b.scale.set(0.03 * L, 2 * clampH, 0.12 * L);
    b.position.set(x + (x === 0 ? -1 : 1) * 0.015 * L, 0, 0);
  }

  // The string as beads.
  const beads = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-2')), STRING_POINTS);
  beads.name = 'sw-string';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3().setScalar(r);
  const xs = Array.from({ length: STRING_POINTS }, (_, i) => (i * L) / (STRING_POINTS - 1));
  const pDot = kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-5')));
  pDot.scale.setScalar(L / 90);
  const pLabel = kit.label(o.texts.P, [q.xP, H, 0], 'strong');

  if (w) {
    // The loops: the envelope turned about the string (a lathe about y, laid along x).
    const n = q.n ?? 0;
    // 24 profile points per loop (smooth at any n), 12 around: a light see-through shape.
    const steps = Math.max(48, 24 * n);
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = (i * L) / steps;
      profile.push(new THREE.Vector2(H * Math.abs(Math.sin(w.k * x)) + 1e-6 * L, x));
    }
    const lathe = kit.geometry(new THREE.LatheGeometry(profile, 12));
    lathe.rotateZ(-Math.PI / 2);
    const loops = kit.mesh(
      lathe,
      kit.glass(kit.color('--chart-2'), { opacity: 0.12, side: THREE.DoubleSide }),
    );
    loops.name = 'sw-loops';
    const dot = kit.solid(kit.color('--text'));
    for (const x of nodes(L, n)) {
      const d = kit.mesh(kit.sphere(), dot);
      d.scale.setScalar(r * 1.8);
      d.position.set(x, 0, 0);
      kit.label(o.texts.N, [x, -0.45 * clampH, 0], 'strong');
    }
    for (const x of antinodes(L, n)) kit.label(o.texts.B, [x, H + 0.15 * clampH, 0], 'muted');
  } else kit.label(o.texts.none, [L / 2, clampH, 0], 'strong');

  let t = 0;
  let yP = 0;
  const place = () => {
    const s = o.read();
    t = w ? (s?.[SW.phi] ?? 0) / w.omega : 0;
    for (let i = 0; i < STRING_POINTS; i++) {
      const x = xs[i] ?? 0;
      pos.set(x, w ? S * standing(w, x, t) : 0, 0);
      beads.setMatrixAt(i, m4.compose(pos, one, size));
    }
    beads.instanceMatrix.needsUpdate = true;
    // P: the engine's own y at x_P (as the 2D picture).
    yP = (s?.[SW.y] ?? 0) * S;
    pDot.position.set(q.xP, yP, 0);
    // A little to the right: an antinode's name may sit right above P.
    pLabel.position.set(q.xP + 0.035 * L, Math.max(H, yP) + 0.12 * clampH, 0);
  };
  place();

  const points: Vec3[] = [];
  for (const x of [-0.05 * L, 1.05 * L])
    for (const y of [-clampH, clampH]) for (const z of [-H, H]) points.push([x, y, z]);
  return {
    kit,
    bounds: { center: [L / 2, 0, 0], radius: Math.hypot(0.55 * L, clampH), points },
    setTime: place,
    tick: place,
    state: () => ({ t, yP, beads: STRING_POINTS }),
  };
}
