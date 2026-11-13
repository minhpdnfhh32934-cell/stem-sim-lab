import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { MOLECULES, type Molecule } from '../../../simulation/models/moleculeShapes';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The shapes of molecules (model `chemistry.molecule-shapes`, Phase X): a simulation table whose
// display holds the chosen molecule as a ball-and-stick model, turning slowly — the central atom,
// its bonded atoms in the usual element colours, the lone pairs as pale lobes — and, for a polar
// molecule, an arrow along its dipole pointing to its negative end (the chemists' convention).
// The rig: the bonds at the run's `angle` (from the ideal to the measured), the molecule from the
// dial. Sizes are a model's, not an atom's: 1 Å drawn as 7 cm.

const BASE = 0.03;
const CENTRE_Y = 0.32;
const BOND = 0.1;
const SPIN = 0.35; // rad/s
const COLOURS: Readonly<Record<string, string>> = {
  H: '#f2f2f2',
  C: '#3b3f45',
  N: '#3f66d6',
  O: '#d8352a',
  F: '#9be05a',
  Cl: '#3fbf4f',
  S: '#e8c934',
  P: '#ef8a2c',
  B: '#f0a39a',
  Be: '#5a8a5a',
};
const RADIUS: Readonly<Record<string, number>> = { H: 0.018, Be: 0.026 };
const up = new THREE.Vector3(0, 1, 0);

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The unit directions of the bonds, then of the lone pairs, for a molecule at bond angle θ (°). */
function directions(m: Molecule, theta: number, out: THREE.Vector3[]): void {
  const t = (theta * Math.PI) / 180;
  const ring = (count: number, polar: number, below: boolean, from: number) => {
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      (out[from + i] as THREE.Vector3).set(
        Math.sin(polar) * Math.cos(a),
        (below ? -1 : 1) * Math.cos(polar),
        Math.sin(polar) * Math.sin(a),
      );
    }
  };
  switch (m.geometry) {
    case 'linear':
      (out[0] as THREE.Vector3).set(1, 0, 0);
      (out[1] as THREE.Vector3).set(-1, 0, 0);
      return;
    case 'trigonal-planar':
      ring(3, Math.PI / 2, false, 0);
      return;
    case 'tetrahedral':
      (out[0] as THREE.Vector3).set(0, 1, 0);
      ring(3, Math.PI - t, false, 1);
      return;
    case 'trigonal-pyramidal': {
      const alpha = Math.asin(Math.sqrt(Math.max(0, (1 - Math.cos(t)) / 1.5)));
      ring(3, alpha, true, 0);
      (out[3] as THREE.Vector3).set(0, 1, 0);
      return;
    }
    case 'bent': {
      (out[0] as THREE.Vector3).set(Math.sin(t / 2), -Math.cos(t / 2), 0);
      (out[1] as THREE.Vector3).set(-Math.sin(t / 2), -Math.cos(t / 2), 0);
      if (m.lonePairs === 1) (out[2] as THREE.Vector3).set(0, 1, 0);
      else {
        (out[2] as THREE.Vector3).set(0, 0.577, 0.816);
        (out[3] as THREE.Vector3).set(0, 0.577, -0.816);
      }
      return;
    }
    case 'trigonal-bipyramidal':
      (out[0] as THREE.Vector3).set(0, 1, 0);
      (out[1] as THREE.Vector3).set(0, -1, 0);
      ring(3, Math.PI / 2, false, 2);
      return;
    case 'octahedral':
      [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ].forEach((v, i) => (out[i] as THREE.Vector3).set(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0));
  }
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#141a22', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.3, 0.04, 0.2)), painted).position.set(0, BASE + 0.02, 0);
  mesh(keep(new THREE.BoxGeometry(0.46, 0.46, 0.01)), dark).position.set(0, CENTRE_Y, -0.14);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const molecule = new THREE.Group();
  molecule.name = 'molecule';
  molecule.position.set(0, CENTRE_Y, 0);
  kit.group.add(molecule);
  const material = (hex: string) =>
    own(new THREE.MeshStandardMaterial({ color: hex, ...LOOKS.satin }));
  const materials = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, material(v)]));
  const stick = own(new THREE.MeshStandardMaterial({ color: '#b8bec6', ...LOOKS.satin }));
  const lobe = own(
    new THREE.MeshStandardMaterial({
      color: '#e9e2ff',
      ...LOOKS.glass,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  const arrowMaterial = own(new THREE.MeshBasicMaterial({ color: '#ffb02e' }));
  const ball = keep(new THREE.SphereGeometry(1, 20, 14));
  const rod = keep(new THREE.CylinderGeometry(0.006, 0.006, 1, 10).translate(0, 0.5, 0));
  const lobeGeometry = keep(
    new THREE.SphereGeometry(1, 16, 12).scale(0.03, 0.055, 0.03).translate(0, 0.06, 0),
  );
  const centre = mesh(ball, stick, molecule);
  centre.name = 'central-atom';
  centre.scale.setScalar(0.03);
  const ligands = Array.from({ length: 6 }, (_, i) => {
    const m = mesh(ball, stick, molecule);
    m.name = `atom-${i}`;
    m.scale.setScalar(0.026); // drawn sizes from the start: hidden parts still count in bounds
    return m;
  });
  const bonds = Array.from({ length: 6 }, () => {
    const b = mesh(rod, stick, molecule);
    b.scale.set(1, BOND, 1);
    return b;
  });
  const lobes = Array.from({ length: 3 }, (_, i) => {
    const m = mesh(lobeGeometry, lobe, molecule);
    m.name = `lone-pair-${i}`;
    m.castShadow = false;
    return m;
  });
  const arrow = new THREE.Group();
  arrow.name = 'dipole';
  molecule.add(arrow);
  mesh(
    keep(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 8).translate(0, 0.07, 0)),
    arrowMaterial,
    arrow,
  );
  mesh(keep(new THREE.ConeGeometry(0.012, 0.03, 12).translate(0, 0.155, 0)), arrowMaterial, arrow);
  arrow.position.set(0.17, -0.07, 0);
  // It turns all the time: no shadow, or every frame would redraw the shadow maps.
  molecule.traverse((o) => (o.castShadow = false));
  const dirs = Array.from({ length: 9 }, () => new THREE.Vector3());
  let turn = 0;
  let shownMolecule: Molecule | null = null;
  let shownAngle = NaN;

  const pose = ({ parameters, sample }: BenchPose, dt: number) => {
    const m = MOLECULES[Math.round(parameters.molecule ?? 0)] ?? MOLECULES[0];
    if (!m) return;
    const theta = Number.isFinite(sample.angle) ? (sample.angle ?? m.angle) : m.angle;
    turn += Math.min(dt, 0.05) * SPIN;
    molecule.rotation.y = turn;
    if (m === shownMolecule && theta === shownAngle) return; // only the turn changes
    shownMolecule = m;
    shownAngle = theta;
    directions(m, theta, dirs);
    centre.material = materials[m.centre] ?? stick;
    centre.scale.setScalar(RADIUS[m.centre] ?? 0.03);
    for (let i = 0; i < 6; i++) {
      const on = i < m.bonds;
      const ligand = ligands[i] as THREE.Mesh;
      const bond = bonds[i] as THREE.Mesh;
      ligand.visible = on;
      bond.visible = on;
      if (!on) continue;
      const dir = dirs[i] as THREE.Vector3;
      ligand.material = materials[m.ligand] ?? stick;
      ligand.scale.setScalar(RADIUS[m.ligand] ?? 0.026);
      ligand.position.copy(dir).multiplyScalar(BOND);
      bond.scale.set(1, BOND, 1);
      bond.quaternion.setFromUnitVectors(up, dir);
    }
    for (let i = 0; i < 3; i++) {
      const pair = lobes[i] as THREE.Mesh;
      pair.visible = i < m.lonePairs;
      if (pair.visible) pair.quaternion.setFromUnitVectors(up, dirs[m.bonds + i] as THREE.Vector3);
    }
    arrow.visible = m.dipole > 0;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const moleculeModel: BenchModel = {
  frame,
  rig,
  reads: ['angle'],
  fullScale: { angle: 180 },
};
