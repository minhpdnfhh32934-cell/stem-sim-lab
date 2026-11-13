import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Grade 12 calorimetry. The joulemeter calorimeter: an insulated can with its lid, stirrer, heater
// leads and thermometer, a joulemeter beside it; the rig is the thermometer's liquid, up with the
// run's `temperature`. The ice funnels: two funnels of crushed ice on a stand, a heater in the
// left one, a beaker under each; the rig is the meltwater in each beaker, from `meltHeated` and
// `meltControl` at its real volume.

const BASE = 0.02;
/** A thermometer's stem: its bulb at `bulb` above the base, 0–100 °C over `span` (m). */
const STEM = { bulb: 0.12, span: 0.24, radius: 0.004 };
const WATER_DENSITY = 1000; // kg/m³, for the meltwater's volume

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

/** A joulemeter: a dark case with a lit display window, at (x, z) on the base. */
function joulemeter(kit: Assembly, x: number, z: number, y0: number) {
  const { keep, own, mesh } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const screen = own(
    new THREE.MeshStandardMaterial({
      color: '#1f3b2c',
      emissive: '#3fae6a',
      emissiveIntensity: 0.6,
    }),
  );
  mesh(keep(new THREE.BoxGeometry(0.14, 0.07, 0.1)), dark).position.set(x, y0 + 0.035, z);
  mesh(keep(new THREE.BoxGeometry(0.09, 0.025, 0.002)), screen).position.set(
    x,
    y0 + 0.045,
    z + 0.051,
  );
}

/** A thermometer's glass stem from `bottom`, at (x, z). */
function stem(kit: Assembly, x: number, z: number, bottom: number) {
  const glass = kit.own(new THREE.MeshStandardMaterial({ color: '#e6f2f6', ...GLASSWARE_LOOK }));
  const tube = kit.mesh(
    kit.keep(new THREE.CylinderGeometry(STEM.radius, STEM.radius, STEM.span + 0.03, 10, 1, true)),
    glass,
  );
  tube.name = 'stem';
  tube.position.set(x, bottom + (STEM.span + 0.03) / 2, z);
}

/** The red liquid of a thermometer at (x, z), its bulb at `bottom`; returns its pose by °C. */
function liquid(kit: Assembly, x: number, z: number, bottom: number) {
  const red = kit.own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.satin }));
  const column = kit.mesh(
    kit.keep(
      new THREE.CylinderGeometry(STEM.radius * 0.45, STEM.radius * 0.45, 1, 8).translate(0, 0.5, 0),
    ),
    red,
  );
  column.name = 'thermometer';
  column.castShadow = false;
  column.position.set(x, bottom, z);
  return (celsius: number) => {
    column.scale.y = 0.01 + (STEM.span * Math.min(Math.max(celsius, 0), 100)) / 100;
  };
}

// ---------------------------------------------------------------------------------------------

const CAN = { x: -0.08, radius: 0.07, height: 0.14 };

function calorimeterFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const black = own(new THREE.MeshStandardMaterial({ color: '#23262b', ...LOOKS.rubber }));
  // The insulated can (the item's colour: focus shows on it), its lid, stirrer and heater's leads.
  mesh(
    keep(new THREE.CylinderGeometry(CAN.radius, CAN.radius, CAN.height, 28)),
    painted,
  ).position.set(CAN.x, y0 + CAN.height / 2, 0);
  mesh(
    keep(new THREE.CylinderGeometry(CAN.radius + 0.004, CAN.radius + 0.004, 0.012, 28)),
    black,
  ).position.set(CAN.x, y0 + CAN.height + 0.006, 0);
  mesh(keep(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 8)), steel).position.set(
    CAN.x - 0.035,
    y0 + CAN.height + 0.04,
    0.02,
  );
  for (const [s, color] of [
    [-1, '#c8402f'],
    [1, '#23262b'],
  ] as const) {
    const lead = own(new THREE.MeshStandardMaterial({ color, ...LOOKS.rubber }));
    mesh(
      keep(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 8).rotateZ(Math.PI / 2.6)),
      lead,
    ).position.set(0.03, y0 + CAN.height + 0.03, 0.012 * s);
  }
  joulemeter(kit, 0.15, 0, y0);
  stem(kit, CAN.x + 0.03, -0.02, y0 + STEM.bulb);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function calorimeterRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  kit.group.position.copy(topOf(item));
  const set = liquid(kit, CAN.x + 0.03, -0.02, BASE + STEM.bulb);
  let t = NaN;
  const pose = ({ sample }: BenchPose) => {
    const next = Number.isFinite(sample.temperature) ? (sample.temperature ?? 20) : 20;
    if (next === t) return;
    t = next;
    set(t);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** The specific heat station: a joulemeter calorimeter. */
export const joulemeterCalorimeter: BenchModel = {
  frame: calorimeterFrame,
  rig: calorimeterRig,
  reads: ['temperature'],
  fullScale: { temperature: 100 },
};

// ---------------------------------------------------------------------------------------------

const FUNNEL = { x: 0.13, y: 0.24, radius: 0.08, depth: 0.1 };
const BEAKER = { radius: 0.03, height: 0.09 };

function funnelsFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#e6f2f6', ...GLASSWARE_LOOK }));
  const ice = own(new THREE.MeshStandardMaterial({ color: '#eef6fa', ...LOOKS.satin }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  // The stand (the item's colour) and its cross-bar.
  mesh(keep(new THREE.BoxGeometry(0.02, FUNNEL.y + 0.12, 0.02)), painted).position.set(
    0,
    y0 + (FUNNEL.y + 0.12) / 2,
    -0.09,
  );
  mesh(keep(new THREE.BoxGeometry(2 * FUNNEL.x + 0.06, 0.015, 0.015)), steel).position.set(
    0,
    y0 + FUNNEL.y + FUNNEL.depth * 0.6,
    -0.09,
  );
  const cubes: THREE.Matrix4[] = [];
  for (const s of [-1, 1]) {
    const x = s * FUNNEL.x;
    const cone = mesh(
      keep(new THREE.CylinderGeometry(FUNNEL.radius, 0.008, FUNNEL.depth, 20, 1, true)),
      glass,
    );
    cone.name = s < 0 ? 'funnel-heated' : 'funnel-control';
    cone.position.set(x, y0 + FUNNEL.y + FUNNEL.depth / 2, 0);
    const spout = mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8, 1, true)), glass);
    spout.name = 'spout';
    spout.position.set(x, y0 + FUNNEL.y - 0.035, 0);
    const beaker = mesh(
      keep(new THREE.CylinderGeometry(BEAKER.radius, BEAKER.radius, BEAKER.height, 20, 1, true)),
      glass,
    );
    beaker.name = s < 0 ? 'beaker-heated' : 'beaker-control';
    beaker.position.set(x, y0 + BEAKER.height / 2, 0);
    // Crushed ice heaped in the funnel: a fixed scatter of small cubes.
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = (0.012 + (i % 4) * 0.012) * (i < 7 ? 0.7 : 1);
      cubes.push(
        at(
          x + r * Math.cos(a),
          y0 + FUNNEL.y + 0.03 + (i % 5) * 0.013,
          r * Math.sin(a),
          a,
          a * 0.7,
          0,
        ),
      );
    }
  }
  copies(keep(new THREE.BoxGeometry(0.018, 0.018, 0.018)), ice, cubes).castShadow = false;
  // The heater: a coiled element down into the left funnel, its leads to the joulemeter.
  mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8)), steel).position.set(
    -FUNNEL.x,
    y0 + FUNNEL.y + 0.07,
    0,
  );
  joulemeter(kit, -0.02, 0.09, y0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function funnelsRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#7fb8d8', ...LOOKS.glass, opacity: 0.6 }),
  );
  const area = Math.PI * (BEAKER.radius - 0.002) ** 2;
  const column = (s: number) => {
    const c = mesh(
      keep(
        new THREE.CylinderGeometry(BEAKER.radius - 0.002, BEAKER.radius - 0.002, 1, 16).translate(
          0,
          0.5,
          0,
        ),
      ),
      water,
    );
    c.name = s < 0 ? 'melt-heated' : 'melt-control';
    c.castShadow = false;
    c.position.set(s * FUNNEL.x, BASE + 0.002, 0);
    return c;
  };
  const heatedColumn = column(-1);
  const controlColumn = column(1);
  let heated = NaN;
  let control = NaN;
  const height = (kg: number) =>
    Math.min(Math.max(kg / WATER_DENSITY / area, 0.0005), BEAKER.height - 0.004);
  const pose = ({ sample }: BenchPose) => {
    const h = Number.isFinite(sample.meltHeated) ? (sample.meltHeated ?? 0) : 0;
    const c = Number.isFinite(sample.meltControl) ? (sample.meltControl ?? 0) : 0;
    if (h !== heated) {
      heated = h;
      heatedColumn.scale.y = height(h);
    }
    if (c !== control) {
      control = c;
      controlColumn.scale.y = height(c);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** The latent heat station: two funnels of ice, one heated, one the control. */
export const iceFunnels: BenchModel = {
  frame: funnelsFrame,
  rig: funnelsRig,
  reads: ['meltHeated', 'meltControl'],
  fullScale: { meltHeated: 0.1, meltControl: 0.1 },
};
