import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Electrons in an atom (model `chemistry.atomic-structure`, Phase X): a simulation table whose
// display stands a Bohr picture of the atom upright above it — a red nucleus, four shell rings K, L,
// M, N, and the electrons as small cyan balls on their shells, circling (inner shells faster). The
// rig: each shell's electrons from the run's `shellK`…`shellN`, spread evenly round it; none before
// a run. A picture of shells, not of orbits: electrons are not little planets (see the orbitals
// table). Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.03;
const CENTRE_Y = 0.32;
const RADII = [0.05, 0.09, 0.13, 0.17] as const;
const MAX = 36;
const SPIN = [1.2, 0.8, 0.55, 0.4] as const; // rad/s, a picture's pace

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#141a22', ...LOOKS.satin }));
  const glow = own(
    new THREE.MeshBasicMaterial({ color: '#5fb8e8', transparent: true, opacity: 0.55 }),
  );
  const red = own(
    new THREE.MeshStandardMaterial({ color: '#d0402c', emissive: '#6a1a10', ...LOOKS.satin }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The projector's plinth (in the item's colour: focus shows on it) and the dark backdrop.
  mesh(keep(new THREE.BoxGeometry(0.3, 0.04, 0.2)), painted).position.set(0, BASE + 0.02, 0);
  mesh(keep(new THREE.BoxGeometry(0.46, 0.46, 0.01)), dark).position.set(0, CENTRE_Y, -0.1);
  const nucleus = mesh(keep(new THREE.SphereGeometry(0.018, 18, 12)), red);
  nucleus.name = 'nucleus';
  nucleus.position.set(0, CENTRE_Y, 0);
  RADII.forEach((r, i) => {
    const ring = mesh(keep(new THREE.TorusGeometry(r, 0.0015, 6, 64)), glow);
    ring.name = `shell-${'KLMN'[i]}`;
    ring.position.set(0, CENTRE_Y, 0);
    ring.castShadow = false;
  });
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(originOf(item));
  const material = own(new THREE.MeshBasicMaterial({ color: '#7fe3ff' }));
  const balls = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.007, 10, 8)),
    material,
    MAX,
  );
  balls.name = 'electrons';
  balls.castShadow = false;
  kit.group.add(balls);
  const matrix = new THREE.Matrix4();
  const counts = [0, 0, 0, 0];
  let angle = 0;

  const pose = ({ sample }: BenchPose, dt: number) => {
    counts[0] = Number.isFinite(sample.shellK) ? (sample.shellK ?? 0) : 0;
    counts[1] = Number.isFinite(sample.shellL) ? (sample.shellL ?? 0) : 0;
    counts[2] = Number.isFinite(sample.shellM) ? (sample.shellM ?? 0) : 0;
    counts[3] = Number.isFinite(sample.shellN) ? (sample.shellN ?? 0) : 0;
    angle += Math.min(dt, 0.05);
    let k = 0;
    for (let s = 0; s < 4; s++) {
      const n = Math.round(counts[s] ?? 0);
      const r = RADII[s] ?? 0;
      for (let e = 0; e < n && k < MAX; e++, k++) {
        const a = angle * (SPIN[s] ?? 0.5) + (2 * Math.PI * e) / n;
        matrix.makeTranslation(r * Math.cos(a), CENTRE_Y + r * Math.sin(a), 0);
        balls.setMatrixAt(k, matrix);
      }
    }
    balls.count = k;
    balls.instanceMatrix.needsUpdate = true;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      balls.dispose();
      kit.dispose();
    },
  };
}

export const bohrAtom: BenchModel = {
  frame,
  rig,
  reads: ['shellK', 'shellL', 'shellM', 'shellN'],
  fullScale: { shellK: 2, shellL: 8, shellM: 18, shellN: 8 },
};
