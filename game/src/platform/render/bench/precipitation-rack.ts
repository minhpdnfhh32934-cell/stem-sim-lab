import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { PRECIPITATES, REAGENTS, SAMPLES } from '../../../simulation/models/precipitation';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Precipitation tests for ions (model `chemistry.precipitation`, Phase X): a tray with a wooden
// rack of the seven test solutions in small tubes at the back (each its own colour: copper(II)
// sulfate blue, iron(III) chloride yellow, the rest colourless), the three reagents in dropping
// bottles on the right, and at the front a boiling tube in a stand's clamp. The rig: the dialled
// sample's tube lifted out of the rack, the boiling tube's liquid rising as the reagent runs in
// (the sample's volume plus `volumeAdded`, mL), clouding with the precipitate's own colour as
// `precipitatedPercent` grows, and the solid settling at the bottom by `precipitateMass`; the
// dialled reagent's bottle stands forward, its dropper over the tube while the reagent runs.
// Real sizes in metres; the item's floor at y = −h/2 (the entity's origin is its box's centre).

const BASE = 0.015;
/** The boiling tube in its clamp at the front: inner radius, height, its foot above the tray. */
const TUBE = { x: -0.08, z: 0.06, radius: 0.0125, wall: 0.0012, height: 0.15, foot: 0.03 };
const INNER = TUBE.radius - TUBE.wall;
/** One mL in the boiling tube is this tall (m). */
const ML = 1e-6 / (Math.PI * INNER * INNER);
/** The rack of sample tubes at the back. */
const RACK = { z: -0.08, width: 0.34, depth: 0.06, height: 0.07, x: -0.05 };
const SMALL = { radius: 0.008, height: 0.1, fill: 0.06 };
const SLOTS = SAMPLES.map((_, i) => RACK.x - RACK.width / 2 + 0.03 + i * 0.047);
/** The reagent bottles on the right. */
const BOTTLES = { x: 0.2, z: [-0.07, 0, 0.07], radius: 0.022, height: 0.09 };
/** Sediment height per gram of precipitate (m/g): a loose, wet solid. */
const SEDIMENT_PER_G = 0.6;
const SEDIMENT_MAX = 0.012;

const CLEAR = 0xd9ecf2;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The tray (the entity's mesh), the rack, the stand and clamp, the boiling tube's glass. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const wood = own(new THREE.MeshStandardMaterial({ color: '#b98a56', ...LOOKS.matte }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The rack: a wooden block with a hole per tube.
  const rack = mesh(keep(new THREE.BoxGeometry(RACK.width, RACK.height, RACK.depth)), wood);
  rack.name = 'rack';
  rack.position.set(RACK.x, BASE + RACK.height / 2, RACK.z);
  // The stand: a rod at the tube's back (in the item's colour: focus shows on it), a clamp.
  mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 10)), painted).position.set(
    TUBE.x,
    BASE + 0.13,
    TUBE.z - 0.05,
  );
  mesh(keep(new THREE.BoxGeometry(0.012, 0.012, 0.05)), steel).position.set(
    TUBE.x,
    BASE + TUBE.foot + TUBE.height - 0.03,
    TUBE.z - 0.025,
  );
  const tube = mesh(
    keep(
      new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.height, 24, 1, true).translate(
        0,
        TUBE.height / 2,
        0,
      ),
    ),
    glass,
  );
  tube.name = 'glass';
  tube.position.set(TUBE.x, BASE + TUBE.foot, TUBE.z);
  const bottom = mesh(
    keep(new THREE.SphereGeometry(TUBE.radius, 16, 8, 0, Math.PI * 2, Math.PI / 2)),
    glass,
  );
  bottom.name = 'glass';
  bottom.position.set(TUBE.x, BASE + TUBE.foot, TUBE.z);
  bottom.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The sample tubes, the reagent bottles and dropper, and the boiling tube's contents. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const amber = own(
    new THREE.MeshStandardMaterial({ color: '#7a4a1c', ...LOOKS.glass, opacity: 0.85 }),
  );
  const cap = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.rubber }));
  // The sample tubes: glass, and a liquid each in its solution's colour (instanced, coloured).
  const smallTube = keep(
    new THREE.CylinderGeometry(SMALL.radius, SMALL.radius, SMALL.height, 14, 1, true).translate(
      0,
      SMALL.height / 2,
      0,
    ),
  );
  const smallFill = keep(
    new THREE.CylinderGeometry(
      SMALL.radius - 0.001,
      SMALL.radius - 0.001,
      SMALL.fill,
      14,
    ).translate(0, SMALL.fill / 2, 0),
  );
  const tubes = copies(
    smallTube,
    glass,
    SLOTS.map((x) => at(x, BASE + 0.012, RACK.z)),
  );
  tubes.name = 'samples';
  tubes.castShadow = false;
  const fillMaterial = own(
    new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.75, color: '#ffffff' }),
  );
  const fills = copies(
    smallFill,
    fillMaterial,
    SLOTS.map((x) => at(x, BASE + 0.013, RACK.z)),
  );
  fills.castShadow = false;
  const colour = new THREE.Color();
  SAMPLES.forEach((s, i) => fills.setColorAt(i, colour.setHex(s.rgb ?? CLEAR)));
  // The reagent bottles and their caps; the dialled one comes forward.
  const bottles = REAGENTS.map((_, i) => {
    const g = new THREE.Group();
    g.name = `reagent-${i}`;
    kit.group.add(g);
    mesh(
      keep(
        new THREE.CylinderGeometry(BOTTLES.radius, BOTTLES.radius, BOTTLES.height, 18).translate(
          0,
          BOTTLES.height / 2,
          0,
        ),
      ),
      amber,
      g,
    );
    mesh(
      keep(
        new THREE.CylinderGeometry(0.008, 0.012, 0.03, 12).translate(0, BOTTLES.height + 0.015, 0),
      ),
      cap,
      g,
    );
    return g;
  });
  // The dropper over the boiling tube while the reagent runs.
  const dropper = new THREE.Group();
  dropper.name = 'dropper';
  kit.group.add(dropper);
  const pipette = mesh(
    keep(new THREE.CylinderGeometry(0.003, 0.0015, 0.08, 8).translate(0, -0.04, 0)),
    glass,
    dropper,
  );
  pipette.name = 'dropper-glass';
  pipette.castShadow = false;
  mesh(keep(new THREE.SphereGeometry(0.008, 10, 8)), cap, dropper);
  dropper.position.set(TUBE.x, BASE + TUBE.foot + TUBE.height + 0.05, TUBE.z);
  // The boiling tube's liquid, its cloud of precipitate and the settled solid.
  const liquidMaterial = own(
    new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.55, color: CLEAR }),
  );
  const liquid = mesh(
    keep(new THREE.CylinderGeometry(INNER, INNER, 1, 20).translate(0, 0.5, 0)),
    liquidMaterial,
  );
  liquid.name = 'liquid';
  liquid.castShadow = false;
  liquid.position.set(TUBE.x, BASE + TUBE.foot, TUBE.z);
  const cloudMaterial = own(
    new THREE.MeshStandardMaterial({
      ...LOOKS.matte,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const cloud = mesh(
    keep(new THREE.CylinderGeometry(INNER - 0.0005, INNER - 0.0005, 1, 20).translate(0, 0.5, 0)),
    cloudMaterial,
  );
  cloud.name = 'precipitate';
  cloud.castShadow = false;
  cloud.position.copy(liquid.position);
  const solidMaterial = own(new THREE.MeshStandardMaterial({ ...LOOKS.matte }));
  const solid = mesh(
    keep(new THREE.CylinderGeometry(INNER - 0.0005, INNER - 0.0005, 1, 20).translate(0, 0.5, 0)),
    solidMaterial,
  );
  solid.name = 'solid';
  solid.castShadow = false;
  solid.position.copy(liquid.position);

  const pose = ({ status, parameters, sample }: BenchPose) => {
    const s = Math.round(parameters.sample ?? 0);
    const r = Math.round(parameters.reagent ?? 0);
    const running = status === 'running';
    const ran = Number.isFinite(sample.volumeAdded);
    // The dialled reagent's bottle forward, the others in their row.
    bottles.forEach((b, i) =>
      b.position.set(
        BOTTLES.x - (i === r ? 0.07 : 0),
        BASE,
        (BOTTLES.z[i] ?? 0) + (i === r ? 0.04 : 0),
      ),
    );
    dropper.visible = running;
    // The sample in the boiling tube (its own colour), the reagent on top of it.
    const mL = (parameters.sampleVolume ?? 5) + (ran ? (sample.volumeAdded ?? 0) : 0);
    liquid.scale.y = Math.max(0.001, Math.min(mL * ML, TUBE.height - 0.01));
    liquidMaterial.color.setHex(SAMPLES[s]?.rgb ?? CLEAR);
    const product = ran ? Math.round(sample.product ?? 0) : 0;
    const precipitate = PRECIPITATES[product - 1];
    const percent = ran ? (sample.precipitatedPercent ?? 0) : 0;
    cloud.visible = !!precipitate && percent > 0;
    cloud.scale.y = liquid.scale.y;
    if (precipitate) {
      cloudMaterial.color.setHex(precipitate.rgb);
      solidMaterial.color.setHex(precipitate.rgb);
    }
    cloudMaterial.opacity = Math.min(0.9, 0.15 + (0.75 * percent) / 100);
    const settled = ran
      ? Math.min(SEDIMENT_MAX, (sample.precipitateMass ?? 0) * SEDIMENT_PER_G)
      : 0;
    solid.visible = !!precipitate && settled > 0;
    solid.scale.y = Math.max(0.0005, settled);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const precipitationRack: BenchModel = {
  frame,
  rig,
  reads: ['volumeAdded', 'product', 'precipitatedPercent', 'precipitateMass'],
  fullScale: { volumeAdded: 10, product: 7, precipitatedPercent: 100, precipitateMass: 0.02 },
};
