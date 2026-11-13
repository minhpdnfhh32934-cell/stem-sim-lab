import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// A respirometer (seed respiration): on a base board, a glass water bath holding two stoppered
// boiling tubes — behind, the seeds on gauze over the CO₂ absorber; in front, the control of glass
// beads over the same absorber (a thermobarometer). From each bung a glass stem rises to a 1 mL
// graduated pipette laid level along a white scale on two legs; a thermometer stands in the bath.
// The control's drop stays where it was set. The rig is what the run and the desk change: the
// seeds' drop, moving towards the tubes by the run's `gasTakenUp` (1 mL along 0.2 m of scale);
// the seeds' look with `parameters.seeds` (peas, sunflower, boiled peas); the absorber's with
// `parameters.absorber` (water, or potassium hydroxide solution). Glass parts are merged into one
// mesh, as are the bungs, the gauze and the legs: one draw each.

const BASE = 0.02;
const BATH = { x: -0.24, w: 0.26, d: 0.2, h: 0.2, water: 0.16 };
/** The two tubes' z (seeds behind, control in front), radius, foot and length. */
const TUBE = { seeds: -0.045, control: 0.045, radius: 0.014, foot: 0.01, length: 0.22 };
/** The pipettes' height above the base, radius, end; the scale's zero and its 1 mL length. */
const PIPETTE = { y: 0.33, radius: 0.003, end: 0.4, zero: 0.34, length: 0.2, volume: 1 };
const ABSORBER = { y: 0.02, h: 0.025 };
const SEED = { radius: 0.0045, count: 12 };

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** Geometries merged into one and the pieces freed. */
function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return g;
}

/** A level cylinder along x from x0 to x1 at (y, z). */
const along = (radius: number, x0: number, x1: number, y: number, z: number) =>
  new THREE.CylinderGeometry(radius, radius, x1 - x0, 10)
    .rotateZ(Math.PI / 2)
    .translate((x0 + x1) / 2, y, z);

/** The base, the bath and its tubes, stems, pipettes and scale, the gauze, beads, control drop. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#9fd0e6', ...LOOKS.glass, opacity: 0.45 }),
  );
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#2b2e32', ...LOOKS.rubber }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const beads = own(new THREE.MeshStandardMaterial({ color: '#e4ecef', ...LOOKS.satin }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const dye = own(new THREE.MeshStandardMaterial({ color: '#c8322b', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const tubeTop = y0 + TUBE.foot + TUBE.length;
  const py = y0 + PIPETTE.y;
  const tubes = [TUBE.seeds, TUBE.control];
  // Clear glass, one mesh: the bath, the tubes, the stems, the pipettes and the thermometer.
  const glassware = mesh(
    keep(
      merged([
        new THREE.BoxGeometry(BATH.w, BATH.h, BATH.d).translate(BATH.x, y0 + BATH.h / 2, 0),
        ...tubes.flatMap((z) => [
          new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.length, 16, 1, true).translate(
            BATH.x,
            y0 + TUBE.foot + TUBE.length / 2,
            z,
          ),
          new THREE.CylinderGeometry(PIPETTE.radius, PIPETTE.radius, py - tubeTop, 8).translate(
            BATH.x,
            (tubeTop + py) / 2,
            z,
          ),
          along(PIPETTE.radius, BATH.x, PIPETTE.end, py, z),
        ]),
        new THREE.CylinderGeometry(0.003, 0.003, 0.28, 8).translate(BATH.x + 0.1, y0 + 0.16, 0),
      ]),
    ),
    glass,
  );
  glassware.name = 'glass'; // clear glassware: a sheen pass on High (quality.ts)
  mesh(keep(new THREE.BoxGeometry(BATH.w - 0.006, BATH.water, BATH.d - 0.006)), water).position.set(
    BATH.x,
    y0 + BATH.water / 2 + 0.002,
    0,
  );
  // The bungs, the gauze over each absorber, the control's beads.
  mesh(
    keep(
      merged(
        tubes.map((z) =>
          new THREE.CylinderGeometry(TUBE.radius + 0.002, TUBE.radius - 0.002, 0.025, 14).translate(
            BATH.x,
            tubeTop + 0.0125 - 0.006,
            z,
          ),
        ),
      ),
    ),
    rubber,
  );
  const gauzeY = y0 + ABSORBER.y + ABSORBER.h + 0.002;
  mesh(
    keep(
      merged(
        tubes.map((z) =>
          new THREE.CylinderGeometry(TUBE.radius - 0.001, TUBE.radius - 0.001, 0.002, 14).translate(
            BATH.x,
            gauzeY,
            z,
          ),
        ),
      ),
    ),
    steel,
  ).castShadow = false;
  mesh(
    keep(new THREE.CylinderGeometry(TUBE.radius - 0.002, TUBE.radius - 0.002, 0.05, 14)),
    beads,
  ).position.set(BATH.x, gauzeY + 0.026, TUBE.control);
  // The scale under the pipettes, on two legs in the item's colour (focus shows on them).
  const scaleX = PIPETTE.zero - PIPETTE.length / 2;
  mesh(keep(new THREE.BoxGeometry(PIPETTE.length + 0.04, 0.004, 0.14)), white).position.set(
    scaleX,
    py - PIPETTE.radius - 0.002,
    0,
  );
  mesh(
    keep(
      merged(
        [-1, 1].map((side) =>
          new THREE.BoxGeometry(0.012, PIPETTE.y - 0.006, 0.012).translate(
            scaleX + side * (PIPETTE.length / 2 + 0.01),
            y0 + (PIPETTE.y - 0.006) / 2,
            0,
          ),
        ),
      ),
    ),
    painted,
  );
  // 0.01 mL a tick, every 0.1 mL long, beside the seeds' pipette.
  const ticks: THREE.Matrix4[] = [];
  const ticksPerMl = 100;
  for (let i = 0; i <= ticksPerMl * PIPETTE.volume; i++) {
    const long = i % 10 === 0;
    const m = at(
      PIPETTE.zero - (i / (ticksPerMl * PIPETTE.volume)) * PIPETTE.length,
      py - PIPETTE.radius + 0.0005,
      TUBE.seeds + (long ? 0.016 : 0.012),
    );
    m.scale(new THREE.Vector3(1, 1, long ? 1 : 0.5));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.0008, 0.001, 0.016)), ink, ticks).castShadow = false;
  // The control's drop, set a little in from the end: it does not move.
  const still = mesh(
    keep(new THREE.CapsuleGeometry(PIPETTE.radius * 0.8, 0.008, 4, 8).rotateZ(Math.PI / 2)),
    dye,
  );
  still.position.set(PIPETTE.zero - 0.04, py, TUBE.control);
  still.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The seeds, the absorber in both tubes and the seeds' drop, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const looks = [
    own(new THREE.MeshStandardMaterial({ color: '#c4c45a', ...LOOKS.satin })), // peas
    own(new THREE.MeshStandardMaterial({ color: '#3a3833', ...LOOKS.satin })), // sunflower
    own(new THREE.MeshStandardMaterial({ color: '#d9cba2', ...LOOKS.matte })), // boiled peas
  ] as const;
  const absorbers = [
    own(new THREE.MeshStandardMaterial({ color: '#bfe0ee', ...LOOKS.glass, opacity: 0.6 })), // water
    own(new THREE.MeshStandardMaterial({ color: '#f3f5f2', ...LOOKS.satin })), // KOH on cotton
  ] as const;
  const dye = own(new THREE.MeshStandardMaterial({ color: '#c8322b', ...LOOKS.satin }));
  // The seeds heaped on the gauze: a fixed pile, in two layers.
  const piles: THREE.Matrix4[] = [];
  const floor = y0 + ABSORBER.y + ABSORBER.h + 0.004 + SEED.radius;
  for (let i = 0; i < SEED.count; i++) {
    const layer = i < 7 ? 0 : 1;
    const turn = (i * 2 * Math.PI) / (layer === 0 ? 7 : 5) + layer * 0.6;
    const r = layer === 0 ? 0.0075 : 0.004;
    piles.push(
      at(
        BATH.x + r * Math.cos(turn),
        floor + layer * 1.6 * SEED.radius,
        TUBE.seeds + r * Math.sin(turn),
        turn,
        turn * 0.5,
        0,
      ),
    );
  }
  const seeds = copies(
    keep(new THREE.SphereGeometry(SEED.radius, 10, 8).scale(1, 0.85, 1.15)),
    looks[0],
    piles,
  );
  seeds.name = 'seeds';
  seeds.castShadow = false;
  swaps(seeds, ...looks);
  const absorber = mesh(
    keep(
      merged(
        [TUBE.seeds, TUBE.control].map((z) =>
          new THREE.CylinderGeometry(
            TUBE.radius - 0.002,
            TUBE.radius - 0.002,
            ABSORBER.h,
            14,
          ).translate(BATH.x, y0 + ABSORBER.y + ABSORBER.h / 2, z),
        ),
      ),
    ),
    absorbers[1],
  );
  absorber.name = 'absorber';
  absorber.castShadow = false;
  swaps(absorber, ...absorbers);
  const drop = mesh(
    keep(new THREE.CapsuleGeometry(PIPETTE.radius * 0.8, 0.008, 4, 8).rotateZ(Math.PI / 2)),
    dye,
  );
  drop.name = 'drop';
  drop.castShadow = false;
  drop.position.set(PIPETTE.zero, y0 + PIPETTE.y, TUBE.seeds);

  let volume = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const v = Number.isFinite(sample.gasTakenUp) ? (sample.gasTakenUp ?? 0) : 0;
    if (v !== volume) {
      volume = v;
      drop.position.x =
        PIPETTE.zero - (Math.min(Math.max(v, 0), PIPETTE.volume) / PIPETTE.volume) * PIPETTE.length;
    }
    seeds.material = looks[parameters.seeds ?? 0] ?? looks[0];
    absorber.material = absorbers[parameters.absorber ?? 1] ?? absorbers[1];
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const respirometer: BenchModel = {
  frame,
  rig,
  reads: ['gasTakenUp'],
  fullScale: { gasTakenUp: PIPETTE.volume },
};
