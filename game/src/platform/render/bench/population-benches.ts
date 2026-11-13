import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Populations (Phase X): the culture flask of logistic growth (model `biology.logistic-growth`), a
// dot per cell of yeast in its broth, as many as the run's `population`; and the meadow of
// predator and prey (model `biology.predator-prey`), a white rabbit per prey and an orange fox per
// predator, as many as the run's. Places are fixed (seeded), so a count only adds or takes away.

const BASE = 0.03;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function seeded(seed: number): () => number {
  let h = seed >>> 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + 374761393) >>> 0;
    return h / 4294967296;
  };
}

/** Fills `mesh` with `capacity` fixed places from `place` (each a matrix), then shows none. */
function scatter(mesh: THREE.InstancedMesh, place: (i: number, m: THREE.Matrix4) => void): void {
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.instanceMatrix.count; i++) {
    place(i, m);
    mesh.setMatrixAt(i, m);
  }
  mesh.count = 0;
  mesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- culture flask

const FLASK_R = 0.11;
const BROTH_H = 0.2;
const CELLS = 1000;

function flaskFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#dceef2', ...GLASSWARE_LOOK }));
  const broth = own(
    new THREE.MeshStandardMaterial({
      color: '#f1e3b0',
      ...LOOKS.glass,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 32)), painted).position.set(
    0,
    BASE + 0.0075,
    0,
  );
  const vessel = mesh(
    keep(new THREE.CylinderGeometry(FLASK_R + 0.004, FLASK_R + 0.004, BROTH_H + 0.06, 40, 1, true)),
    glass,
  );
  vessel.name = 'flask';
  vessel.position.set(0, BASE + 0.015 + (BROTH_H + 0.06) / 2, 0);
  vessel.castShadow = false;
  const liquid = mesh(keep(new THREE.CylinderGeometry(FLASK_R, FLASK_R, BROTH_H, 40)), broth);
  liquid.name = 'broth';
  liquid.position.set(0, BASE + 0.015 + BROTH_H / 2, 0);
  liquid.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function flaskRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(originOf(item));
  const cells = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.0035, 6, 4)),
    own(new THREE.MeshStandardMaterial({ color: '#8a5a2b', ...LOOKS.satin })),
    CELLS,
  );
  cells.name = 'cells';
  cells.castShadow = false;
  kit.group.add(cells);
  const rand = seeded(777);
  scatter(cells, (_, m) => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (FLASK_R - 0.008);
    m.makeTranslation(Math.cos(a) * r, BASE + 0.022 + rand() * (BROTH_H - 0.014), Math.sin(a) * r);
  });
  const pose = ({ sample }: BenchPose) => {
    const n = Number.isFinite(sample.population) ? (sample.population ?? 0) : 0;
    cells.count = Math.max(0, Math.min(CELLS, Math.round(n)));
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      cells.dispose();
      kit.dispose();
    },
  };
}

export const cultureFlask: BenchModel = {
  frame: flaskFrame,
  rig: flaskRig,
  reads: ['population'],
  fullScale: { population: 1000 },
};

// ---------------------------------------------------------------- meadow

const MEADOW_W = 0.44;
const MEADOW_D = 0.28;
const RABBITS = 400;
const FOXES = 200;

function meadowFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const grass = own(new THREE.MeshStandardMaterial({ color: '#5f8f3e', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(MEADOW_W + 0.02, 0.02, MEADOW_D + 0.02)), painted).position.set(
    0,
    BASE + 0.01,
    0,
  );
  const field = mesh(keep(new THREE.BoxGeometry(MEADOW_W, 0.006, MEADOW_D)), grass);
  field.name = 'meadow';
  field.position.set(0, BASE + 0.023, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function meadowRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(originOf(item));
  const animals = (
    name: string,
    geometry: THREE.BufferGeometry,
    colour: string,
    capacity: number,
    seed: number,
  ) => {
    const m = new THREE.InstancedMesh(
      keep(geometry),
      own(new THREE.MeshStandardMaterial({ color: colour, ...LOOKS.satin })),
      capacity,
    );
    m.name = name;
    m.castShadow = false;
    kit.group.add(m);
    const rand = seeded(seed);
    const turn = new THREE.Quaternion();
    const at = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    scatter(m, (_, mat) => {
      at.set((rand() - 0.5) * (MEADOW_W - 0.02), BASE + 0.03, (rand() - 0.5) * (MEADOW_D - 0.02));
      turn.setFromAxisAngle(up, rand() * Math.PI * 2);
      mat.compose(at, turn, one);
    });
    return m;
  };
  const rabbits = animals(
    'prey',
    new THREE.SphereGeometry(1, 10, 8).scale(0.006, 0.006, 0.009),
    '#f2f0ea',
    RABBITS,
    4242,
  );
  const foxes = animals(
    'predators',
    new THREE.ConeGeometry(0.008, 0.024, 8).rotateX(Math.PI / 2).translate(0, 0.004, 0),
    '#d4682a',
    FOXES,
    9191,
  );
  const pose = ({ sample }: BenchPose) => {
    const x = Number.isFinite(sample.prey) ? (sample.prey ?? 0) : 0;
    const y = Number.isFinite(sample.predators) ? (sample.predators ?? 0) : 0;
    rabbits.count = Math.max(0, Math.min(RABBITS, Math.round(x)));
    foxes.count = Math.max(0, Math.min(FOXES, Math.round(y)));
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      rabbits.dispose();
      foxes.dispose();
      kit.dispose();
    },
  };
}

export const meadow: BenchModel = {
  frame: meadowFrame,
  rig: meadowRig,
  reads: ['prey', 'predators'],
  fullScale: { prey: 400, predators: 200 },
};
