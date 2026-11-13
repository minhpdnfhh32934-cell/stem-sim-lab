import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Grade 12 gas laws. Boyle: a 60 mL syringe upright in a clamp, its nozzle piped to a pressure
// gauge; the rig is the plunger, at the run's `volume` (the barrel's real bore), and the gauge's
// needle at its `pressure`. Charles: a capillary with an air column in a beaker of water on a hot
// plate, a ruler and a thermometer beside it; the rig is the index, at the run's column `length`
// (1:1), and the thermometer's liquid at its `temperature`.

const BASE = 0.02;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function base(item: ItemDefinition) {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const body = kit.keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  return { kit, body, y0: -h / 2 + BASE };
}

// ---------------------------------------------------------------------------------------------

/** The barrel: 29 mm bore (a 60 mL syringe), its nozzle `nozzle` above the base. */
const BARREL = { x: -0.06, radius: 0.0145, nozzle: 0.1, length: 0.12 };
const GAUGE = { x: 0.1, y: 0.2, radius: 0.06, full: 300000, sweep: 1.5 * Math.PI };

function syringeFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#e6f2f6', ...GLASSWARE_LOOK }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f5f2', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#3a3f46', ...LOOKS.rubber }));
  // The clamp stand (the item's colour), the barrel and its nozzle.
  mesh(keep(new THREE.BoxGeometry(0.02, 0.32, 0.02)), painted).position.set(
    BARREL.x - 0.05,
    y0 + 0.16,
    -0.05,
  );
  mesh(keep(new THREE.BoxGeometry(0.06, 0.012, 0.012)), steel).position.set(
    BARREL.x - 0.025,
    y0 + 0.17,
    -0.03,
  );
  const barrel = mesh(
    keep(
      new THREE.CylinderGeometry(
        BARREL.radius + 0.0015,
        BARREL.radius + 0.0015,
        BARREL.length,
        24,
        1,
        true,
      ),
    ),
    glass,
  );
  barrel.name = 'barrel';
  barrel.position.set(BARREL.x, y0 + BARREL.nozzle + BARREL.length / 2, 0);
  const nozzle = mesh(keep(new THREE.CylinderGeometry(0.004, 0.006, 0.02, 10)), glass);
  nozzle.name = 'nozzle';
  nozzle.position.set(BARREL.x, y0 + BARREL.nozzle - 0.01, 0);
  // Its scale: a tick each 5 mL up the barrel.
  const area = Math.PI * BARREL.radius ** 2;
  const ticks: THREE.Matrix4[] = [];
  for (let mL = 0; mL <= 60; mL += 5)
    ticks.push(at(BARREL.x + BARREL.radius + 0.002, y0 + BARREL.nozzle + (mL * 1e-6) / area, 0));
  copies(keep(new THREE.BoxGeometry(0.006, 0.001, 0.004)), ink, ticks).castShadow = false;
  // The tube from the nozzle down, along the base and up to the gauge.
  mesh(
    keep(new THREE.CylinderGeometry(0.004, 0.004, BARREL.nozzle - 0.02, 8)),
    rubber,
  ).position.set(BARREL.x, y0 + (BARREL.nozzle - 0.02) / 2, 0);
  mesh(
    keep(new THREE.CylinderGeometry(0.004, 0.004, GAUGE.x - BARREL.x, 8).rotateZ(Math.PI / 2)),
    rubber,
  ).position.set((GAUGE.x + BARREL.x) / 2, y0 + 0.004, 0);
  mesh(keep(new THREE.BoxGeometry(0.02, GAUGE.y - GAUGE.radius, 0.02)), steel).position.set(
    GAUGE.x,
    y0 + (GAUGE.y - GAUGE.radius) / 2,
    0,
  );
  // The gauge: a steel case, its white face, ticks every 50 kPa.
  mesh(
    keep(
      new THREE.CylinderGeometry(GAUGE.radius + 0.006, GAUGE.radius + 0.006, 0.03, 32).rotateX(
        Math.PI / 2,
      ),
    ),
    steel,
  ).position.set(GAUGE.x, y0 + GAUGE.y, -0.01);
  const face = mesh(keep(new THREE.CircleGeometry(GAUGE.radius, 32)), white);
  face.position.set(GAUGE.x, y0 + GAUGE.y, 0.0055);
  face.castShadow = false;
  const marks: THREE.Matrix4[] = [];
  for (let kPa = 0; kPa <= 300; kPa += 50) {
    const a = GAUGE.sweep / 2 - (kPa / 300) * GAUGE.sweep;
    marks.push(
      at(
        GAUGE.x - Math.sin(a) * GAUGE.radius * 0.85,
        y0 + GAUGE.y + Math.cos(a) * GAUGE.radius * 0.85,
        0.007,
        0,
        0,
        a,
      ),
    );
  }
  copies(keep(new THREE.BoxGeometry(0.002, 0.012, 0.001)), ink, marks).castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function syringeRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.rubber }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.plastic }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
  const plunger = new THREE.Group();
  plunger.name = 'plunger';
  kit.group.add(plunger);
  mesh(
    keep(new THREE.CylinderGeometry(BARREL.radius, BARREL.radius, 0.008, 20)),
    rubber,
    plunger,
  ).position.y = 0.004;
  mesh(keep(new THREE.BoxGeometry(0.006, 0.14, 0.006)), white, plunger).position.y = 0.078;
  mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.004, 20)), white, plunger).position.y = 0.15;
  const needle = mesh(
    keep(
      new THREE.BoxGeometry(0.0025, GAUGE.radius * 0.8, 0.001).translate(0, GAUGE.radius * 0.35, 0),
    ),
    red,
  );
  needle.name = 'needle';
  needle.castShadow = false;
  needle.position.set(GAUGE.x, BASE + GAUGE.y, 0.008);
  const area = Math.PI * BARREL.radius ** 2;
  let v = NaN;
  let p = NaN;
  const pose = ({ sample }: BenchPose) => {
    const nv = Number.isFinite(sample.volume) ? (sample.volume ?? 0) : 60e-6;
    const np = Number.isFinite(sample.pressure) ? (sample.pressure ?? 0) : 0;
    if (nv !== v) {
      v = nv;
      plunger.position.set(BARREL.x, BASE + BARREL.nozzle + Math.min(v / area, BARREL.length), 0);
    }
    if (np !== p) {
      p = np;
      needle.rotation.z =
        GAUGE.sweep / 2 - (Math.min(Math.max(p, 0), GAUGE.full) / GAUGE.full) * GAUGE.sweep;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** Boyle's law: a syringe on a pressure gauge. */
export const boyleSyringe: BenchModel = {
  frame: syringeFrame,
  rig: syringeRig,
  reads: ['volume', 'pressure'],
  fullScale: { volume: 60e-6, pressure: 300000 },
};

// ---------------------------------------------------------------------------------------------

const BATH = { radius: 0.065, height: 0.2, plate: 0.05 };
/** The capillary: sealed at its foot `foot` above the base, `length` long. */
const CAPILLARY = { x: -0.015, foot: 0.075, length: 0.22, radius: 0.003 };
const THERMO = { x: 0.03, bulb: 0.08, span: 0.24 };

function columnFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#e6f2f6', ...GLASSWARE_LOOK }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#7fb8d8', ...LOOKS.glass, opacity: 0.45 }),
  );
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f5f2', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  // The hot plate (the item's colour), the beaker and its water.
  mesh(keep(new THREE.BoxGeometry(0.2, BATH.plate, 0.2)), painted).position.set(
    0,
    y0 + BATH.plate / 2,
    0,
  );
  const beaker = mesh(
    keep(new THREE.CylinderGeometry(BATH.radius, BATH.radius, BATH.height, 28, 1, true)),
    glass,
  );
  beaker.name = 'bath';
  beaker.position.set(0, y0 + BATH.plate + BATH.height / 2, 0);
  const bathWater = mesh(
    keep(
      new THREE.CylinderGeometry(BATH.radius - 0.003, BATH.radius - 0.003, BATH.height * 0.8, 24),
    ),
    water,
  );
  bathWater.castShadow = false;
  bathWater.position.set(0, y0 + BATH.plate + BATH.height * 0.4, 0);
  // The capillary and the ruler behind it, 0 at the sealed foot, a tick each centimetre.
  const tube = mesh(
    keep(
      new THREE.CylinderGeometry(CAPILLARY.radius, CAPILLARY.radius, CAPILLARY.length, 10, 1, true),
    ),
    glass,
  );
  tube.name = 'capillary';
  tube.position.set(CAPILLARY.x, y0 + CAPILLARY.foot + CAPILLARY.length / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.02, CAPILLARY.length, 0.003)), white).position.set(
    CAPILLARY.x - 0.016,
    y0 + CAPILLARY.foot + CAPILLARY.length / 2,
    -0.006,
  );
  const ticks: THREE.Matrix4[] = [];
  for (let cm = 0; cm <= 20; cm++) {
    const m = at(CAPILLARY.x - 0.012, y0 + CAPILLARY.foot + cm / 100, -0.004);
    if (cm % 5 !== 0) m.scale(new THREE.Vector3(0.5, 1, 1));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.012, 0.0012, 0.001)), ink, ticks).castShadow = false;
  const stem = mesh(
    keep(new THREE.CylinderGeometry(0.004, 0.004, THERMO.span + 0.03, 10, 1, true)),
    glass,
  );
  stem.name = 'stem';
  stem.position.set(THERMO.x, y0 + THERMO.bulb + (THERMO.span + 0.03) / 2, 0.02);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function columnRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const index = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.satin }));
  const bead = mesh(
    keep(new THREE.CylinderGeometry(CAPILLARY.radius * 0.8, CAPILLARY.radius * 0.8, 0.01, 8)),
    index,
  );
  bead.name = 'index';
  bead.castShadow = false;
  const liquid = mesh(
    keep(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 8).translate(0, 0.5, 0)),
    index,
  );
  liquid.name = 'thermometer';
  liquid.castShadow = false;
  liquid.position.set(THERMO.x, BASE + THERMO.bulb, 0.02);
  let l = NaN;
  let t = NaN;
  const pose = ({ sample }: BenchPose) => {
    const nl = Number.isFinite(sample.length) ? (sample.length ?? 0) : 0.1;
    const nt = Number.isFinite(sample.temperature) ? (sample.temperature ?? 20) : 20;
    if (nl !== l) {
      l = nl;
      // The index sits on the air column: its foot at the column's top.
      bead.position.set(
        CAPILLARY.x,
        BASE + CAPILLARY.foot + Math.min(l, CAPILLARY.length - 0.01) + 0.005,
        0,
      );
    }
    if (nt !== t) {
      t = nt;
      liquid.scale.y = 0.01 + (THERMO.span * Math.min(Math.max(t, 0), 100)) / 100;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** Charles's law: an air column in a capillary, in a water bath. */
export const gasColumn: BenchModel = {
  frame: columnFrame,
  rig: columnRig,
  reads: ['length', 'temperature'],
  fullScale: { length: 0.2, temperature: 100 },
};
