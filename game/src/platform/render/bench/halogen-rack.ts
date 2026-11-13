import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { HALOGENS } from '../../../simulation/models/halogens';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Displacement reactions of the halogens (model `chemistry.halogens`, Phase X): a rack of the
// three potassium halide solutions (colourless) at the back, three dropping bottles of halogen
// water on the right in their own colours (chlorine pale yellow-green, bromine orange, iodine
// brown), and a test tube at the front holding the dialled halide with a layer of cyclohexane on
// top. The rig: the water rising as the halogen water runs in, its colour that of the halogen
// free in it, and the cyclohexane layer taking the colour of the halogen dissolved in it — the
// one formed (bromine orange-red, iodine violet), else the one added. Real sizes in metres.

const BASE = 0.015;
const TUBE = { x: -0.08, z: 0.06, radius: 0.011, height: 0.15, foot: 0.03 };
const INNER = TUBE.radius - 0.0012;
const ML = 1e-6 / (Math.PI * INNER * INNER);
const ORGANIC_ML = 2; // the cyclohexane layer on top
const RACK = { x: -0.05, z: -0.08, width: 0.2, depth: 0.06, height: 0.07 };
const SLOTS = [-0.11, -0.05, 0.01];
const BOTTLES = { x: 0.17, z: [-0.07, 0, 0.07], radius: 0.022, height: 0.09 };
const CLEAR = 0xdcecf1;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(originOf(item));
  const wood = own(new THREE.MeshStandardMaterial({ color: '#b98a56', ...LOOKS.matte }));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const rack = mesh(keep(new THREE.BoxGeometry(RACK.width, RACK.height, RACK.depth)), wood);
  rack.name = 'rack';
  rack.position.set(RACK.x, BASE + RACK.height / 2, RACK.z);
  const small = copies(
    keep(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 14, 1, true).translate(0, 0.05, 0)),
    glass,
    SLOTS.map((x) => at(x, BASE + 0.012, RACK.z)),
  );
  small.name = 'halides';
  small.castShadow = false;
  // The stand's rod (in the item's colour: focus shows on it) and the test tube.
  mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 10)), painted).position.set(
    TUBE.x,
    BASE + 0.13,
    TUBE.z - 0.05,
  );
  const tube = mesh(
    keep(
      new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.height, 22, 1, true).translate(
        0,
        TUBE.height / 2,
        0,
      ),
    ),
    glass,
  );
  tube.name = 'glass';
  tube.position.set(TUBE.x, BASE + TUBE.foot, TUBE.z);
  tube.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const water = own(new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.6, color: CLEAR }));
  const organic = own(
    new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.75, color: CLEAR }),
  );
  const cap = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.rubber }));
  HALOGENS.forEach((x, i) => {
    const bottle = new THREE.Group();
    bottle.name = `halogen-${i}`;
    bottle.position.set(BOTTLES.x, BASE, BOTTLES.z[i] ?? 0);
    kit.group.add(bottle);
    const tint = own(
      new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.8, color: x.water }),
    );
    mesh(
      keep(
        new THREE.CylinderGeometry(BOTTLES.radius, BOTTLES.radius, BOTTLES.height, 18).translate(
          0,
          BOTTLES.height / 2,
          0,
        ),
      ),
      tint,
      bottle,
    );
    mesh(
      keep(
        new THREE.CylinderGeometry(0.008, 0.012, 0.03, 12).translate(0, BOTTLES.height + 0.015, 0),
      ),
      cap,
      bottle,
    );
  });
  const layer = (material: THREE.Material, name: string) => {
    const m = mesh(
      keep(new THREE.CylinderGeometry(INNER, INNER, 1, 18).translate(0, 0.5, 0)),
      material,
    );
    m.name = name;
    m.castShadow = false;
    return m;
  };
  const aqueous = layer(water, 'aqueous');
  aqueous.position.set(TUBE.x, BASE + TUBE.foot, TUBE.z);
  const top = layer(organic, 'organic');
  const colour = new THREE.Color();
  const clear = new THREE.Color(CLEAR);

  const pose = ({ parameters, sample }: BenchPose) => {
    const ran = Number.isFinite(sample.volumeAdded);
    const added = ran ? (sample.volumeAdded ?? 0) : 0;
    const sampleMl = parameters.sampleVolume ?? 2;
    const h = Math.max(0.001, (sampleMl + added) * ML);
    aqueous.scale.y = h;
    top.scale.y = ORGANIC_ML * ML;
    top.position.set(TUBE.x, BASE + TUBE.foot + h, TUBE.z);
    const product = ran ? Math.round(sample.product ?? -1) : -1;
    const x = Math.round(parameters.halogen ?? 0);
    // What is free: the halogen formed, else (some added) the halogen added, else nothing.
    const free = product >= 0 ? HALOGENS[product] : added > 0 ? HALOGENS[x] : undefined;
    water.color.copy(free ? colour.setHex(free.water) : clear).lerp(clear, 0.35);
    organic.color.copy(free ? colour.setHex(free.organic) : clear);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const halogenRack: BenchModel = {
  frame,
  rig,
  reads: ['volumeAdded', 'product'],
  fullScale: { volumeAdded: 5, product: 2 },
};
