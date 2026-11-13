import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';
import { nameGlass } from './glassNames';

// Separating salt from sand (model `chemistry.separation`, Phase X), left to right as the method
// goes: the beaker the mixture was stirred in (wet sand at its bottom), a filter funnel with its
// paper cone on a conical flask (the sand left on the paper, the clear filtrate below), and a
// hot plate heating the filtrate in a white evaporating dish. The rig: the dish's liquid falling
// as `waterMass` boils away, white salt crystals growing by `crystalMass`, the plate glowing while
// it heats (running), and a thermometer in the dish reading by its red column's height between
// 20 and 110 °C (`temperature`). Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.015;
const BEAKER = { x: -0.24, radius: 0.04, height: 0.1 };
const FUNNEL = { x: -0.03, top: 0.26, radius: 0.055, stem: 0.06 };
const FLASK = { x: -0.03, radius: 0.05, height: 0.15 };
const PLATE = { x: 0.2, width: 0.17, depth: 0.17, height: 0.06 };
const DISH = { radius: 0.055, depth: 0.03 };
/** The dish's liquid: 1 g of water this deep (m) — a shallow bowl, taken as a cylinder. */
const DEPTH_PER_G = 1e-6 / (Math.PI * (DISH.radius - 0.004) ** 2);
const THERMO = { from: 20, to: 110, length: 0.16 };

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The tray (the entity's mesh), the beaker with its wet sand, the funnel on its flask, the plate. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const sand = own(new THREE.MeshStandardMaterial({ color: '#c8a46a', ...LOOKS.matte }));
  const paper = own(new THREE.MeshStandardMaterial({ color: '#f4f2ea', ...LOOKS.matte }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#cfe7f0', ...LOOKS.glass, opacity: 0.45 }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The beaker: glass, a layer of wet sand, a little water over it.
  const beaker = mesh(
    keep(
      new THREE.CylinderGeometry(
        BEAKER.radius,
        BEAKER.radius,
        BEAKER.height,
        24,
        1,
        true,
      ).translate(0, BEAKER.height / 2, 0),
    ),
    glass,
  );
  beaker.name = 'beaker';
  beaker.position.set(BEAKER.x, BASE, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(BEAKER.radius - 0.002, BEAKER.radius - 0.002, 0.018, 20).translate(
        0,
        0.009,
        0,
      ),
    ),
    sand,
  ).position.set(BEAKER.x, BASE, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(BEAKER.radius - 0.002, BEAKER.radius - 0.002, 0.01, 20).translate(
        0,
        0.005,
        0,
      ),
    ),
    water,
  ).position.set(BEAKER.x, BASE + 0.018, 0);
  // The conical flask (a cone and a neck) and the filtrate in it.
  const flask = mesh(
    keep(
      new THREE.CylinderGeometry(0.014, FLASK.radius, FLASK.height * 0.75, 24, 1, true).translate(
        0,
        FLASK.height * 0.375,
        0,
      ),
    ),
    glass,
  );
  flask.name = 'flask';
  flask.position.set(FLASK.x, BASE, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(0.014, 0.014, FLASK.height * 0.25, 16, 1, true).translate(
        0,
        FLASK.height * 0.875,
        0,
      ),
    ),
    glass,
  ).position.set(FLASK.x, BASE, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(FLASK.radius * 0.8, FLASK.radius - 0.002, 0.03, 20).translate(
        0,
        0.015,
        0,
      ),
    ),
    water,
  ).position.set(FLASK.x, BASE, 0);
  // The funnel over the flask: its cone, stem and the folded paper with the sand on it.
  const funnel = mesh(
    keep(
      new THREE.CylinderGeometry(FUNNEL.radius, 0.006, 0.07, 24, 1, true).translate(0, -0.035, 0),
    ),
    glass,
  );
  funnel.name = 'funnel';
  funnel.position.set(FUNNEL.x, BASE + FUNNEL.top, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(0.004, 0.004, FUNNEL.stem, 10).translate(
        0,
        -0.07 - FUNNEL.stem / 2,
        0,
      ),
    ),
    glass,
  ).position.set(FUNNEL.x, BASE + FUNNEL.top, 0);
  const cone = mesh(
    keep(
      new THREE.CylinderGeometry(FUNNEL.radius - 0.006, 0.004, 0.06, 20, 1, true).translate(
        0,
        -0.03,
        0,
      ),
    ),
    paper,
  );
  cone.position.set(FUNNEL.x, BASE + FUNNEL.top - 0.004, 0);
  const residue = mesh(
    keep(new THREE.ConeGeometry(0.028, 0.03, 20).rotateX(Math.PI).translate(0, -0.035, 0)),
    sand,
  );
  residue.name = 'residue';
  residue.position.set(FUNNEL.x, BASE + FUNNEL.top - 0.004, 0);
  // The hot plate (in the item's colour: focus shows on it).
  const plate = mesh(keep(new THREE.BoxGeometry(PLATE.width, PLATE.height, PLATE.depth)), painted);
  plate.name = 'hot-plate';
  plate.position.set(PLATE.x, BASE + PLATE.height / 2, 0);
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The plate's glowing top, the dish, its liquid and crystals, the thermometer. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const top = BASE + PLATE.height;
  const cold = own(new THREE.MeshStandardMaterial({ color: '#30353c', ...LOOKS.satin }));
  const hot = own(
    new THREE.MeshStandardMaterial({
      color: '#5a2a1a',
      emissive: '#ff5a1e',
      emissiveIntensity: 0.8,
    }),
  );
  const china = own(new THREE.MeshStandardMaterial({ color: '#f5f5f2', ...LOOKS.satin }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#cfe7f0', ...LOOKS.glass, opacity: 0.55 }),
  );
  const salt = own(new THREE.MeshStandardMaterial({ color: '#ffffff', ...LOOKS.matte }));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#e8f4f8', ...GLASSWARE_LOOK }));
  const red = own(new THREE.MeshBasicMaterial({ color: '#d33b2c' }));
  const element = mesh(keep(new THREE.CylinderGeometry(0.065, 0.065, 0.004, 28)), cold);
  element.name = 'element';
  swaps(element, hot); // compiled with the scene, not at the first run
  element.position.set(PLATE.x, top + 0.002, 0);
  const dish = mesh(
    keep(
      new THREE.SphereGeometry(
        DISH.radius,
        28,
        10,
        0,
        Math.PI * 2,
        Math.PI / 2 + 0.35,
        Math.PI / 2 - 0.35,
      ),
    ),
    china,
  );
  dish.name = 'dish';
  dish.position.set(PLATE.x, top + 0.004 + DISH.radius * Math.cos(0.35), 0);
  const liquid = mesh(
    keep(
      new THREE.CylinderGeometry(DISH.radius - 0.006, DISH.radius - 0.016, 1, 24).translate(
        0,
        0.5,
        0,
      ),
    ),
    water,
  );
  liquid.name = 'filtrate';
  liquid.castShadow = false;
  liquid.position.set(PLATE.x, top + 0.006, 0);
  const crystals = mesh(
    keep(
      new THREE.CylinderGeometry(DISH.radius - 0.02, DISH.radius - 0.012, 1, 20).translate(
        0,
        0.5,
        0,
      ),
    ),
    salt,
  );
  crystals.name = 'crystals';
  crystals.position.set(PLATE.x, top + 0.006, 0);
  // The thermometer, dipped in the dish, leaning on its rim.
  const thermometer = new THREE.Group();
  thermometer.name = 'thermometer';
  thermometer.position.set(PLATE.x + 0.03, top + 0.012, 0.02);
  thermometer.rotation.z = -0.35;
  kit.group.add(thermometer);
  mesh(
    keep(
      new THREE.CylinderGeometry(0.004, 0.004, THERMO.length + 0.03, 10).translate(
        0,
        (THERMO.length + 0.03) / 2,
        0,
      ),
    ),
    glass,
    thermometer,
  ).castShadow = false;
  const column = mesh(
    keep(new THREE.CylinderGeometry(0.0015, 0.0015, 1, 6).translate(0, 0.5, 0)),
    red,
    thermometer,
  );
  column.castShadow = false;
  column.position.y = 0.012;

  const pose = ({ status, sample }: BenchPose) => {
    element.material = status === 'running' ? hot : cold;
    const ran = Number.isFinite(sample.waterMass);
    const grams = ran ? (sample.waterMass ?? 0) : 0;
    liquid.visible = grams > 0.05;
    liquid.scale.y = Math.max(0.0005, Math.min(DISH.depth - 0.004, grams * DEPTH_PER_G));
    const solid = ran ? (sample.crystalMass ?? 0) : 0;
    crystals.visible = solid > 0.01;
    // Salt is about 2.17 g/cm³, loose crystals half that: a thin white layer, a few mm.
    crystals.scale.y = Math.max(
      0.0005,
      Math.min(0.012, (solid * 1e-6) / 1.1 / (Math.PI * 0.035 ** 2)),
    );
    const t = ran ? (sample.temperature ?? THERMO.from) : THERMO.from;
    const share =
      (Math.min(Math.max(t, THERMO.from), THERMO.to) - THERMO.from) / (THERMO.to - THERMO.from);
    column.scale.y = 0.01 + share * (THERMO.length - 0.01);
  };
  nameGlass(kit.group, glass);
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const separationBench: BenchModel = {
  frame,
  rig,
  reads: ['waterMass', 'crystalMass', 'temperature'],
  fullScale: { waterMass: 100, crystalMass: 20, temperature: 110 },
};
