import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { CUBES } from '../../../simulation/models/agarDiffusion';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Diffusion into agar cubes (model `biology.agar-diffusion`, Phase X): a glass tray of acid with
// three cubes of indicator agar, 1, 2 and 3 cm (drawn 4× as large). Each is a pale outer cube — the
// agar the acid has reached, its colour gone — around a pink core still untouched, the core's side
// L − 2x shrinking with the run's depth x. The same x eats a larger share of a smaller cube.

const BASE = 0.03;
const SCALE = 4; // drawn size / real size
const TRAY_W = 0.42;
const TRAY_D = 0.2;
const LIQUID = 0.05;
const GAP = 0.03;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The drawn side (m) of each cube and its centre along x. */
const SIDES = CUBES.map((cm) => (cm / 100) * SCALE);
const CENTRES = (() => {
  const total = SIDES.reduce((a, b) => a + b, 0) + GAP * (SIDES.length - 1);
  let x = -total / 2;
  return SIDES.map((s) => {
    const c = x + s / 2;
    x += s + GAP;
    return c;
  });
})();

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#dceef2', ...GLASSWARE_LOOK }));
  const acid = own(
    new THREE.MeshStandardMaterial({
      color: '#d6ecf5',
      ...LOOKS.glass,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(TRAY_W + 0.02, 0.008, TRAY_D + 0.02)), painted).position.set(
    0,
    BASE + 0.004,
    0,
  );
  const tray = mesh(keep(new THREE.BoxGeometry(TRAY_W, LIQUID + 0.03, TRAY_D)), glass);
  tray.name = 'tray';
  tray.position.set(0, BASE + 0.008 + (LIQUID + 0.03) / 2, 0);
  tray.castShadow = false;
  const liquid = mesh(keep(new THREE.BoxGeometry(TRAY_W - 0.008, LIQUID, TRAY_D - 0.008)), acid);
  liquid.name = 'acid';
  liquid.position.set(0, BASE + 0.008 + LIQUID / 2, 0);
  liquid.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const pale = own(
    new THREE.MeshStandardMaterial({
      color: '#f3efd6',
      ...LOOKS.glass,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  const pink = own(new THREE.MeshStandardMaterial({ color: '#d9468f', ...LOOKS.satin }));
  const floor = BASE + 0.012;
  const cores = SIDES.map((side, i) => {
    const outer = mesh(box, pale);
    outer.name = `cube-${CUBES[i]}`;
    outer.castShadow = false;
    outer.renderOrder = 1;
    outer.scale.setScalar(side);
    outer.position.set(CENTRES[i] ?? 0, floor + side / 2, 0);
    const core = mesh(box, pink);
    core.name = `core-${CUBES[i]}`;
    core.scale.setScalar(side);
    core.position.copy(outer.position);
    return core;
  });
  const pose = ({ sample }: BenchPose) => {
    const depth = Number.isFinite(sample.depth) ? (sample.depth ?? 0) : 0; // mm
    const x = (depth / 1000) * SCALE;
    for (let i = 0; i < cores.length; i++) {
      const core = cores[i];
      if (!core) continue;
      const inner = Math.max(0, (SIDES[i] ?? 0) - 2 * x);
      core.visible = inner > 1e-4;
      core.scale.setScalar(Math.max(inner, 1e-4));
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const agarCubes: BenchModel = {
  frame,
  rig,
  reads: ['depth'],
  fullScale: { depth: 0 },
};
