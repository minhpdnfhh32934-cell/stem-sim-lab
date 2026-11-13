import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Plasmolysis (model `biology.plasmolysis`, Phase X): one red-onion epidermis cell drawn large on
// a stand — the rigid cell wall a pale green box, inside it the protoplast (membrane, cytoplasm and
// the purple vacuole) at the run's `volume`: filling the wall when turgid, shrunk away from it when
// plasmolysed, its purple deepening as the sap gets more concentrated. Sizes are a picture's.

const BASE = 0.03;
const CENTRE_Y = 0.2;
const WALL: readonly [number, number, number] = [0.38, 0.16, 0.14];

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.3, 0.02, 0.1)), painted).position.set(0, BASE + 0.01, 0);
  mesh(
    keep(new THREE.BoxGeometry(0.02, CENTRE_Y - WALL[1] / 2 - BASE - 0.02, 0.02)),
    painted,
  ).position.set(0, BASE + 0.02 + (CENTRE_Y - WALL[1] / 2 - BASE - 0.02) / 2, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const wall = mesh(
    keep(new THREE.BoxGeometry(...WALL)),
    own(
      new THREE.MeshStandardMaterial({
        color: '#cfe6b8',
        ...LOOKS.glass,
        opacity: 0.3,
        depthWrite: false,
      }),
    ),
  );
  wall.name = 'cell-wall';
  wall.position.set(0, CENTRE_Y, 0);
  wall.castShadow = false;
  wall.renderOrder = 1;
  const purple = new THREE.MeshStandardMaterial({ color: '#b04a9a', ...LOOKS.satin });
  own(purple);
  const protoplast = mesh(keep(new THREE.SphereGeometry(1, 32, 20)), purple);
  protoplast.name = 'protoplast';
  protoplast.position.copy(wall.position);
  const nucleus = mesh(
    keep(new THREE.SphereGeometry(0.018, 16, 12)),
    own(new THREE.MeshStandardMaterial({ color: '#efe3d0', ...LOOKS.satin })),
  );
  nucleus.name = 'nucleus';
  const full = new THREE.Color('#b04a9a');
  const deep = new THREE.Color('#5e1653');
  let shown = NaN;

  const pose = ({ sample }: BenchPose) => {
    const v = Number.isFinite(sample.volume) ? (sample.volume ?? 100) / 100 : 1;
    if (v === shown) return;
    shown = v;
    // A turgid protoplast fills the wall (a rounded box, drawn as a squashed sphere a hair inside
    // it); plasmolysed, it shrinks by the cube root of its volume, a little more along its length.
    const s = Math.cbrt(Math.max(0.05, v));
    protoplast.scale.set(
      (WALL[0] / 2) * 0.99 * s ** 1.15,
      (WALL[1] / 2) * 0.97 * s,
      (WALL[2] / 2) * 0.97 * s,
    );
    nucleus.position.set(-WALL[0] * 0.18 * s, CENTRE_Y + WALL[1] * 0.12 * s, WALL[2] * 0.2 * s);
    purple.color.copy(full).lerp(deep, Math.min(1, (1 - v) / 0.6));
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const plantCell: BenchModel = {
  frame,
  rig,
  reads: ['volume'],
  fullScale: { volume: 100 },
};
