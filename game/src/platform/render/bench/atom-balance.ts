import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { REACTIONS } from '../../../simulation/models/balancing';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Balancing equations (model `chemistry.balancing`, Phase X): a two-pan beam balance whose left
// pan holds the reactants' atoms and right pan the products', at the run's coefficients — each
// element in its own row, in the usual element colours — so the atoms can be counted on each side.
// The beam tips towards the heavier side by the run's masses (`leftMass`, `rightMass`) and is level
// when the equation is balanced: the same atoms, so the same mass. The tilt is a picture: 1% of
// mass difference → 1°, at most 12°.

const BASE = 0.03;
const PIVOT_Y = 0.36;
const ARM = 0.15;
const HANG = 0.16;
const PAN_R = 0.1;
const BALL = 0.009;
const ROW = 8;
const CAPACITY = 40;
const MAX_TILT = (12 * Math.PI) / 180;
const COEFFICIENTS = ['coefficientA', 'coefficientB', 'coefficientC', 'coefficientD'] as const;
const COLOURS: Readonly<Record<string, string>> = {
  H: '#f2f2f2',
  C: '#3b3f45',
  N: '#3f66d6',
  O: '#d8352a',
  Cl: '#3fbf4f',
  Fe: '#c06a2c',
  Al: '#b9c2cc',
  K: '#9b59d0',
};

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#9aa3ad', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.12, 0.02, 0.1)), painted).position.set(0, BASE + 0.01, 0);
  const post = mesh(keep(new THREE.CylinderGeometry(0.008, 0.01, PIVOT_Y - BASE, 12)), steel);
  post.name = 'pillar';
  post.position.set(0, BASE + (PIVOT_Y - BASE) / 2, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c3cad2', ...LOOKS.satin }));
  const beam = new THREE.Group();
  beam.name = 'beam';
  beam.position.set(0, PIVOT_Y, 0);
  kit.group.add(beam);
  mesh(keep(new THREE.BoxGeometry(ARM * 2 + 0.02, 0.008, 0.012)), steel, beam);
  const pointer = mesh(keep(new THREE.BoxGeometry(0.004, 0.08, 0.004)), steel, beam);
  pointer.name = 'pointer';
  pointer.position.set(0, -0.045, 0.01);
  const panGeometry = keep(new THREE.CylinderGeometry(PAN_R, PAN_R * 0.9, 0.008, 28));
  const wire = keep(new THREE.CylinderGeometry(0.0015, 0.0015, HANG, 6).translate(0, -HANG / 2, 0));
  const ballGeometry = keep(new THREE.SphereGeometry(BALL, 10, 8));
  const atomMaterial = own(new THREE.MeshStandardMaterial({ ...LOOKS.satin }));
  // A pan hangs level from its end of the beam (its group does not turn with the beam).
  const pans = [-1, 1].map((side) => {
    const hanger = new THREE.Group();
    hanger.name = side < 0 ? 'left-hanger' : 'right-hanger';
    kit.group.add(hanger);
    mesh(wire, steel, hanger);
    const pan = mesh(panGeometry, steel, hanger);
    pan.position.y = -HANG;
    pan.name = side < 0 ? 'reactants-pan' : 'products-pan';
    const atoms = new THREE.InstancedMesh(ballGeometry, atomMaterial, CAPACITY);
    atoms.name = side < 0 ? 'reactant-atoms' : 'product-atoms';
    atoms.castShadow = false;
    atoms.count = 0;
    hanger.add(atoms);
    return { side, hanger, atoms };
  });
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  const shown = [NaN, NaN, NaN, NaN];
  let shownReaction: (typeof REACTIONS)[number] | null = null;
  let tilt = 0;

  const fill = (atoms: THREE.InstancedMesh, counts: Map<string, number>) => {
    let n = 0;
    let row = 0;
    for (const [element, count] of counts) {
      colour.set(COLOURS[element] ?? '#888888');
      for (let i = 0; i < count && n < CAPACITY; i++) {
        const r = row + Math.floor(i / ROW);
        const c = i % ROW;
        matrix.makeTranslation(
          (c - (ROW - 1) / 2) * BALL * 2.3,
          -HANG + 0.013,
          (r - 1.5) * BALL * 2.3,
        );
        atoms.setMatrixAt(n, matrix);
        atoms.setColorAt(n, colour);
        n++;
      }
      row += Math.ceil(count / ROW);
    }
    atoms.count = n;
    atoms.instanceMatrix.needsUpdate = true;
    if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
  };

  const pose = ({ parameters, sample }: BenchPose, dt: number) => {
    const reaction = REACTIONS[Math.round(parameters.reaction ?? 0)] ?? REACTIONS[0];
    if (!reaction) return;
    let changed = reaction !== shownReaction;
    for (let i = 0; i < 4; i++) {
      const v = sample[COEFFICIENTS[i] ?? ''];
      const c = v !== undefined && Number.isFinite(v) && v > 0 ? v : 1;
      if (c !== shown[i]) changed = true;
      shown[i] = c;
    }
    if (changed) {
      // Only when a coefficient or the reaction changes: the atoms on each pan.
      shownReaction = reaction;
      const left = new Map<string, number>();
      const right = new Map<string, number>();
      const species = [...reaction.reactants, ...reaction.products];
      species.forEach((sp, i) => {
        const side = i < reaction.reactants.length ? left : right;
        for (const [el, n] of Object.entries(sp.atoms))
          side.set(el, (side.get(el) ?? 0) + n * (shown[i] ?? 1));
      });
      fill(pans[0]?.atoms as THREE.InstancedMesh, left);
      fill(pans[1]?.atoms as THREE.InstancedMesh, right);
    }
    const l = sample.leftMass ?? 0;
    const r = sample.rightMass ?? 0;
    const target =
      Number.isFinite(l) && Number.isFinite(r) && l + r > 0
        ? Math.max(-MAX_TILT, Math.min(MAX_TILT, (((l - r) / ((l + r) / 2)) * 100 * Math.PI) / 180))
        : 0;
    tilt += (target - tilt) * Math.min(1, Math.min(dt, 0.05) * 6);
    // A positive tilt turns the beam about +z: its left (reactants) end goes down.
    beam.rotation.z = tilt;
    for (let i = 0; i < pans.length; i++) {
      const pan = pans[i];
      if (pan)
        pan.hanger.position.set(
          pan.side * ARM * Math.cos(tilt),
          PIVOT_Y + pan.side * ARM * Math.sin(tilt),
          0,
        );
    }
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      for (const { atoms } of pans) atoms.dispose();
      kit.dispose();
    },
  };
}

export const atomBalance: BenchModel = {
  frame,
  rig,
  reads: ['coefficientA', 'coefficientB', 'coefficientC', 'coefficientD', 'leftMass', 'rightMass'],
  fullScale: {
    coefficientA: 2,
    coefficientB: 5,
    coefficientC: 3,
    coefficientD: 4,
    leftMass: 100,
    rightMass: 100,
  },
};
