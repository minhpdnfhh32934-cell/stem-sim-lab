import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Pressure in a liquid: a tall glass tank of the dialled liquid with a depth scale on its front, a
// stand above it lowering a probe (a funnel closed by a membrane) on a rod, a tube from the probe to
// a U-tube manometer of water on a white board with its own scale. The rig: the liquid's colour, the
// probe at the run's `probeDepth`, the manometer's two columns `manometerDifference` apart.

const BASE = 0.02;
const TANK = { x: -0.17, width: 0.24, height: 0.36, depth: 0.2, fill: 0.32 };
const MANOMETER = { x: 0.24, height: 0.5, bore: 0.006, gap: 0.06, rest: 0.25 };
const LIQUID_COLOURS = ['#9fd0e6', '#a9c7d8', '#e9edf0'];

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the tank's glass and scale, the stand, the manometer's board and tubes. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const tank = mesh(keep(new THREE.BoxGeometry(TANK.width, TANK.height, TANK.depth)), glass);
  tank.name = 'glass';
  tank.position.set(TANK.x, y0 + TANK.height / 2, 0);
  // The depth scale on the tank's front: 0 at the surface, a tick each centimetre down.
  const surface = y0 + TANK.fill;
  mesh(keep(new THREE.BoxGeometry(0.03, TANK.fill, 0.002)), white).position.set(
    TANK.x + TANK.width / 2 - 0.025,
    y0 + TANK.fill / 2,
    TANK.depth / 2 + 0.002,
  );
  const ticks: THREE.Matrix4[] = [];
  for (let cm = 0; cm <= 30; cm++) {
    const m = at(TANK.x + TANK.width / 2 - 0.03, surface - cm / 100, TANK.depth / 2 + 0.0035);
    if (cm % 5 !== 0) m.scale(new THREE.Vector3(0.5, 1, 1));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.02, 0.0012, 0.001)), ink, ticks).castShadow = false;
  // The stand: a post behind the tank (in the item's colour) and its arm over it.
  mesh(keep(new THREE.BoxGeometry(0.025, 0.52, 0.025)), painted).position.set(
    TANK.x,
    y0 + 0.26,
    -TANK.depth / 2 - 0.03,
  );
  mesh(keep(new THREE.BoxGeometry(0.025, 0.025, 0.14)), painted).position.set(
    TANK.x,
    y0 + 0.51,
    -0.05,
  );
  // The manometer: a white board with a scale, two glass tubes joined at the bottom.
  mesh(keep(new THREE.BoxGeometry(0.14, MANOMETER.height, 0.012)), white).position.set(
    MANOMETER.x,
    y0 + MANOMETER.height / 2,
    -0.04,
  );
  for (const s of [-1, 1]) {
    const limb = mesh(
      keep(new THREE.CylinderGeometry(MANOMETER.bore, MANOMETER.bore, MANOMETER.height - 0.04, 10)),
      glass,
    );
    limb.name = 'tube';
    limb.position.set(
      MANOMETER.x + (s * MANOMETER.gap) / 2,
      y0 + MANOMETER.height / 2 + 0.01,
      -0.025,
    );
  }
  const bend = mesh(
    keep(
      new THREE.CylinderGeometry(MANOMETER.bore, MANOMETER.bore, MANOMETER.gap, 10).rotateZ(
        Math.PI / 2,
      ),
    ),
    glass,
  );
  bend.name = 'tube';
  bend.position.set(MANOMETER.x, y0 + 0.03, -0.025);
  const marks: THREE.Matrix4[] = [];
  for (let cm = -20; cm <= 20; cm += 2)
    marks.push(at(MANOMETER.x, y0 + MANOMETER.rest + cm / 100, -0.033));
  copies(keep(new THREE.BoxGeometry(0.03, 0.0012, 0.001)), ink, marks).castShadow = false;
  // The tube from the probe's rod over to the manometer's left limb.
  mesh(
    keep(
      new THREE.CylinderGeometry(0.003, 0.003, MANOMETER.x - MANOMETER.gap / 2 - TANK.x, 8).rotateZ(
        Math.PI / 2,
      ),
    ),
    steel,
  ).position.set(
    (TANK.x + MANOMETER.x - MANOMETER.gap / 2) / 2,
    y0 + MANOMETER.height - 0.01,
    -0.025,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The liquid, the probe on its rod, the manometer's two water columns. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const liquids = LIQUID_COLOURS.map((color) =>
    own(new THREE.MeshStandardMaterial({ color, ...LOOKS.glass, opacity: 0.5 })),
  );
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#4f9fd0', ...LOOKS.glass, opacity: 0.75 }),
  );
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#3a3f46', ...LOOKS.rubber }));
  const liquid = mesh(
    keep(new THREE.BoxGeometry(TANK.width - 0.01, TANK.fill, TANK.depth - 0.01)),
    liquids[0] ?? water,
  );
  liquid.name = 'liquid';
  swaps(liquid, ...liquids);
  liquid.position.set(TANK.x, y0 + TANK.fill / 2, 0);
  liquid.castShadow = false;
  const surface = y0 + TANK.fill;
  // The probe: a funnel, mouth down, closed by a membrane, on a rod up to the arm.
  const probe = new THREE.Group();
  probe.name = 'probe';
  kit.group.add(probe);
  mesh(
    keep(new THREE.ConeGeometry(0.025, 0.03, 18, 1, true).rotateX(Math.PI).translate(0, 0.015, 0)),
    steel,
    probe,
  );
  mesh(keep(new THREE.CircleGeometry(0.025, 18).rotateX(Math.PI / 2)), rubber, probe).castShadow =
    false;
  mesh(keep(new THREE.CylinderGeometry(0.003, 0.003, 0.5, 8).translate(0, 0.28, 0)), steel, probe);
  // The manometer's columns: unit-high bars from the bend, scaled to their levels.
  const column = (s: number) => {
    const c = mesh(
      keep(
        new THREE.CylinderGeometry(MANOMETER.bore * 0.8, MANOMETER.bore * 0.8, 1, 8).translate(
          0,
          0.5,
          0,
        ),
      ),
      water,
    );
    c.position.set(MANOMETER.x + (s * MANOMETER.gap) / 2, y0 + 0.03, -0.025);
    c.castShadow = false;
    return c;
  };
  const left = column(-1);
  left.name = 'left-column';
  const right = column(1);
  right.name = 'right-column';

  let drawnLiquid = NaN;
  let depth = NaN;
  let difference = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const l = parameters.liquid ?? 0;
    if (l !== drawnLiquid) {
      drawnLiquid = l;
      liquid.material = liquids[l] ?? liquids[0] ?? water;
    }
    const d = Number.isFinite(sample.probeDepth) ? (sample.probeDepth ?? 0) : 0;
    if (d !== depth) {
      depth = d;
      probe.position.set(TANK.x, surface - d, 0);
    }
    const dh = Number.isFinite(sample.manometerDifference) ? (sample.manometerDifference ?? 0) : 0;
    if (dh !== difference) {
      difference = dh;
      // The probe's side (left) pushed down by Δh/2, the open side up by Δh/2.
      left.scale.y = MANOMETER.rest - 0.03 - dh / 2;
      right.scale.y = MANOMETER.rest - 0.03 + dh / 2;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const pressureTank: BenchModel = {
  frame,
  rig,
  reads: ['probeDepth', 'manometerDifference'],
  fullScale: { probeDepth: 0.3, manometerDifference: 0.36 },
};
