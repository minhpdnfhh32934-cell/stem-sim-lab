/**
 * 3D scene of enzyme kinetics: a beaker with a fixed number of enzyme molecules (illustrative
 * number and shapes) shared between their forms in the model's proportions (`enzyme3d.ts`):
 * free, with substrate in the active site (ES), with inhibitor in the active site (competitive
 * EI) or at another site (noncompetitive EI, ESI). Free substrate, product and inhibitor
 * molecules are drawn in proportion to their concentrations.
 */
import * as THREE from 'three';
import { rng } from '../genetics/stats';
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import type { Inhibition } from './enzyme';
import {
  ENZYMES_DRAWN,
  MOLECULES_MAX,
  moleculesFor,
  splitCount,
  type EnzymeShares,
} from './enzymeShares';

/** Beaker inner radius and liquid height (world units). */
const R = 6.4;
const HL = 7.2;

export interface EnzymeSceneInput {
  kind: Inhibition;
  /** Concentration one drawn free molecule stands for (mM). */
  per: number;
  inhibitor: number;
  /** The moment shown: x is [S] (rate plot) or time (time course). */
  at: (x: number) => { S: number; P: number; shares: EnzymeShares };
}

/** Random points inside the liquid (seeded), clear of the enzymes' rings. */
function liquidPoints(n: number, seed: number): Vec3[] {
  const rand = rng(seed);
  const out: Vec3[] = [];
  while (out.length < n) {
    const r = R * 0.92 * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    out.push([r * Math.cos(a), 0.4 + rand() * (HL - 0.8), r * Math.sin(a)]);
  }
  return out;
}

export function buildEnzymeScene(kit: SceneKit, input: EnzymeSceneInput): Bio3DScene {
  const muted = kit.color('--text-muted');
  const sides = Math.max(24, kit.seg * 2);
  // Beaker: open glass cylinder with a bottom, and the faintly tinted liquid.
  const beaker = kit.mesh(
    kit.cylinder(sides, true),
    kit.glass(muted, {
      opacity: 0.06,
      side: THREE.DoubleSide,
      rim: { color: muted, strength: 0.5, alpha: 0.35 },
    }),
  );
  beaker.scale.set(R + 0.25, HL + 1.6, R + 0.25);
  beaker.position.y = (HL + 1.6) / 2 - 0.15;
  const bottom = kit.mesh(kit.cylinder(sides), kit.glass(muted, { opacity: 0.18 }));
  bottom.scale.set(R + 0.25, 0.15, R + 0.25);
  bottom.position.y = -0.15;
  const liquid = kit.mesh(
    kit.cylinder(sides),
    kit.glass(kit.color('--chart-6'), { opacity: 0.07 }),
  );
  liquid.scale.set(R, HL, R);
  liquid.position.y = HL / 2;
  kit.shadow(-0.5, R * 1.3, R * 1.3, 0.25);

  // Enzymes: three rings of eight, turned so the active site faces outwards.
  const centres: Vec3[] = [];
  const outward: THREE.Vector3[] = [];
  for (let k = 0; k < ENZYMES_DRAWN; k++) {
    const layer = Math.floor(k / 8);
    const a = ((k % 8) / 8) * Math.PI * 2 + layer * 0.4;
    const r = 3.4 + (layer % 2) * 0.7;
    centres.push([r * Math.cos(a), 1.5 + layer * 2.1, r * Math.sin(a)]);
    outward.push(new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)).normalize());
  }
  const enzymeR = 0.85;
  const enzymes = kit.instanced(
    kit.sphere(),
    kit.solid(kit.color('--chart-3'), { roughness: 0.5, sheen: 0.5 }),
    ENZYMES_DRAWN,
  );
  const pocketR = 0.36;
  const pockets = kit.instanced(
    kit.sphere(0.6),
    kit.solid(kit.color('--text'), { roughness: 0.8 }),
    ENZYMES_DRAWN,
  );
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion();
  centres.forEach((c, k) => {
    m.compose(new THREE.Vector3(...c), q, one.clone().multiplyScalar(enzymeR));
    enzymes.setMatrixAt(k, m);
    v.copy(outward[k] ?? v)
      .multiplyScalar(enzymeR * 0.82)
      .add(new THREE.Vector3(...c));
    m.compose(v, q, one.clone().multiplyScalar(pocketR));
    pockets.setMatrixAt(k, m);
  });
  enzymes.instanceMatrix.needsUpdate = true;
  pockets.instanceMatrix.needsUpdate = true;

  // Which enzyme takes which form: a fixed, mixed order (illustrative positions).
  const order = Array.from({ length: ENZYMES_DRAWN }, (_, k) => k);
  const rand = rng(11);
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [order[k], order[j]] = [order[j] ?? 0, order[k] ?? 0];
  }

  const substrateColor = kit.color('--chart-1');
  const inhibitorColor = kit.color('--chart-5');
  const molR = 0.24;
  const subMat = kit.solid(substrateColor, { roughness: 0.35, clearcoat: 0.4 });
  const inhMat = kit.solid(inhibitorColor, { roughness: 0.35, clearcoat: 0.4 });
  const octa = kit.geometry(new THREE.OctahedronGeometry(1, 0));
  const boundSub = kit.instanced(kit.sphere(0.6), subMat, ENZYMES_DRAWN);
  const boundInhPocket = kit.instanced(octa, inhMat, ENZYMES_DRAWN);
  const boundInhSide = kit.instanced(octa, inhMat, ENZYMES_DRAWN);
  const pocketAt = (k: number, far: number) =>
    v
      .copy(outward[k] ?? v)
      .multiplyScalar(enzymeR * far)
      .add(new THREE.Vector3(...(centres[k] ?? [0, 0, 0])));
  const placeBound = (mesh: THREE.InstancedMesh, slots: number[], site: 'pocket' | 'side') => {
    slots.forEach((k, i) => {
      if (site === 'pocket') pocketAt(k, 1.02);
      else {
        // The other site: on the far side of the molecule.
        v.copy(outward[k] ?? v)
          .multiplyScalar(-enzymeR * 1.0)
          .add(new THREE.Vector3(...(centres[k] ?? [0, 0, 0])));
      }
      m.compose(v, q, one.clone().multiplyScalar(site === 'pocket' ? molR * 1.15 : molR * 1.1));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = slots.length;
    mesh.visible = slots.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
  };

  // Free molecules: fixed seeded spots; a count shows the first n of them.
  const free = (
    color: THREE.Material,
    geometry: THREE.BufferGeometry,
    seed: number,
    scale: number,
  ) => {
    const pts = liquidPoints(MOLECULES_MAX, seed);
    const mesh = kit.instanced(geometry, color, MOLECULES_MAX);
    pts.forEach((p, i) => {
      m.compose(new THREE.Vector3(...p), q, one.clone().multiplyScalar(scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return (n: number) => {
      mesh.count = n;
      mesh.visible = n > 0;
    };
  };
  const freeSub = free(subMat, kit.sphere(0.6), 21, molR);
  const freeProd = free(
    kit.solid(kit.color('--chart-4'), { roughness: 0.35, clearcoat: 0.4 }),
    kit.sphere(0.6),
    37,
    molR * 0.9,
  );
  const freeInh = free(inhMat, octa, 53, molR * 1.05);
  freeInh(input.kind === 'none' ? 0 : moleculesFor(input.inhibitor, input.per));

  return {
    kit,
    bounds: {
      center: [0, HL / 2 + 0.4, 0],
      radius: Math.hypot(R + 0.5, (HL + 2) / 2),
      points: [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sz) =>
          [-0.5, HL + 1.6].map((y): Vec3 => [sx * (R + 0.4), y, sz * (R + 0.4)]),
        ),
      ),
    },
    setTime: (x) => {
      const st = input.at(x);
      const n = splitCount(st.shares, ENZYMES_DRAWN);
      const es = order.slice(0, n.ES);
      const esi = order.slice(n.ES, n.ES + n.ESI);
      const ei = order.slice(n.ES + n.ESI, n.ES + n.ESI + n.EI);
      placeBound(boundSub, [...es, ...esi], 'pocket');
      if (input.kind === 'competitive') {
        placeBound(boundInhPocket, ei, 'pocket');
        placeBound(boundInhSide, [], 'side');
      } else {
        placeBound(boundInhPocket, [], 'pocket');
        placeBound(boundInhSide, [...esi, ...ei], 'side');
      }
      freeSub(moleculesFor(st.S, input.per));
      freeProd(moleculesFor(st.P, input.per));
    },
  };
}
