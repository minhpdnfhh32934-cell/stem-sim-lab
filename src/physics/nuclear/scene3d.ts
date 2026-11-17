/**
 * The nuclear 3D scenes (three.js, on the biology scene kit; 1 world unit = 1 fm).
 *
 * - `buildNucleusScene`: the nucleons of `nucleus3d` (protons --chart-4, neutrons --chart-1) and,
 *   for scale, the see-through ball of the largest nucleus of Bảng 21.1.
 * - `buildDecayScene`: the SAMPLE nuclei on a lattice; the ones left --chart-4, the decayed ones
 *   small and grey. `setTime` (law: nuclei left at t) or `tick` (random: one step of the run every
 *   STEP_S seconds) recount them without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import type { Vec3 } from '../view3d/arrow';
import { SAMPLE, STEPS, decayOrder, type Nucleus3D } from './nuclear3d';

const FM = 1e-15;

export interface NucleusScene extends Bio3DScene {
  state(): { protons: number; neutrons: number; R: number };
}

export function buildNucleusScene(
  kit: SceneKit,
  o: { nucleus: Nucleus3D; reference: { R: number; text: string }; texts: string[] },
): NucleusScene {
  const { nucleus: n } = o;
  const counts = { protons: 0, neutrons: 0 };
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const size = new THREE.Vector3().setScalar(n.r / FM);
  const v = new THREE.Vector3();
  for (const isProton of [true, false]) {
    const k = n.proton.filter((p) => p === isProton).length;
    if (k === 0) continue;
    const mesh = kit.instanced(
      kit.sphere(),
      kit.solid(kit.color(isProton ? '--chart-4' : '--chart-1'), { roughness: 0.35 }),
      k,
    );
    mesh.name = isProton ? 'nuc-protons' : 'nuc-neutrons';
    let j = 0;
    n.at.forEach((p, i) => {
      if (n.proton[i] !== isProton) return;
      mesh.setMatrixAt(j++, m4.compose(v.set(p[0] / FM, p[1] / FM, p[2] / FM), one, size));
    });
    mesh.instanceMatrix.needsUpdate = true;
    counts[isProton ? 'protons' : 'neutrons'] = j;
  }
  // The largest nucleus of the table, for scale.
  const Rref = o.reference.R / FM;
  const ref = kit.mesh(
    kit.sphere(),
    kit.glass(kit.color('--text-muted'), { opacity: 0.08, side: THREE.DoubleSide }),
  );
  ref.scale.setScalar(Rref);
  ref.name = 'nuc-reference';
  kit.label(o.reference.text, [0, -Rref - 0.8, 0], 'muted');
  o.texts.forEach((t, k) =>
    kit.label(t, [0, Rref + 1.6 - k * 0.9, 0], k === 0 ? 'strong' : 'plain'),
  );
  const top = Rref + 2.2;
  return {
    kit,
    bounds: { center: [0, 0.6, 0], radius: top },
    state: () => ({ ...counts, R: n.R }),
  };
}

/** Seconds per step of the random run (its 50 steps over 5 half-lives take 10 s), then a pause. */
export const STEP_S = 0.2;
const PAUSE_S = 2;

export interface DecayScene extends Bio3DScene {
  state(): { left: number; step: number };
}

export function buildDecayScene(
  kit: SceneKit,
  o: {
    seed: number;
    /** Law: nuclei left at the store's t. Random: the run's counts, stepped by `tick`. */
    left: number | readonly number[];
    text: (left: number, step: number | null) => string;
    /** Random run without motion (reduced motion): its last step, still. */
    still?: boolean;
  },
): DecayScene {
  const side = Math.ceil(Math.cbrt(SAMPLE));
  const gap = 1;
  const sites: Vec3[] = [];
  for (let i = 0; i < SAMPLE; i++) {
    const x = i % side;
    const y = Math.floor(i / (side * side));
    const z = Math.floor(i / side) % side;
    sites.push([
      (x - (side - 1) / 2) * gap,
      (y - (side - 1) / 2) * gap,
      (z - (side - 1) / 2) * gap,
    ]);
  }
  const order = decayOrder(o.seed);
  const live = kit.instanced(kit.sphere(), kit.solid(kit.color('--chart-4')), SAMPLE);
  const gone = kit.instanced(kit.sphere(), kit.solid(kit.color('--text-faint')), SAMPLE);
  live.name = 'decay-left';
  gone.name = 'decay-gone';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const big = new THREE.Vector3().setScalar(0.32);
  const small = new THREE.Vector3().setScalar(0.16);
  const v = new THREE.Vector3();
  const label = kit.label('', [0, ((side - 1) / 2) * gap + 1.4, 0], 'strong');

  let left = SAMPLE;
  let step: number | null = null;
  const show = (n: number) => {
    left = Math.max(0, Math.min(SAMPLE, n));
    // The first SAMPLE − left nuclei of `order` have decayed.
    let a = 0;
    let b = 0;
    order.forEach((i, rank) => {
      const s = sites[i] ?? [0, 0, 0];
      if (rank < SAMPLE - left) gone.setMatrixAt(b++, m4.compose(v.set(...s), one, small));
      else live.setMatrixAt(a++, m4.compose(v.set(...s), one, big));
    });
    live.count = a;
    gone.count = b;
    live.instanceMatrix.needsUpdate = true;
    gone.instanceMatrix.needsUpdate = true;
    label.element.textContent = o.text(left, step);
  };

  const run = typeof o.left === 'number' ? null : o.left;
  let clock = 0;
  if (run) {
    step = o.still ? STEPS : 0;
    show(run[step] ?? SAMPLE);
  } else show(o.left as number);

  const half = ((side - 1) / 2) * gap + 0.5;
  return {
    kit,
    bounds: { center: [0, 0.5, 0], radius: Math.hypot(half, half + 1.4, half) },
    ...(run
      ? {
          tick: (dt: number) => {
            clock = (clock + Math.min(dt, 0.1)) % (STEPS * STEP_S + PAUSE_S);
            const k = Math.min(STEPS, Math.floor(clock / STEP_S));
            if (k !== step) {
              step = k;
              show(run[k] ?? 0);
            }
          },
        }
      : {}),
    state: () => ({ left, step: step ?? -1 }),
  };
}
