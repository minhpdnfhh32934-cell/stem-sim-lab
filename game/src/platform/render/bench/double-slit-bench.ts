import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { doubleSlitPattern } from '../../../simulation/models/doubleSlit';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Young's double slit: an optical rail along the bench, a laser at its left end, the double slit
// in a holder 10 cm on, a white screen at the dialled distance D beyond it, a light sensor on a
// carriage across the screen. The rig: the screen at D, the beam in the laser's colour, the fringes
// drawn on the screen from the model's own pattern (at their real spacing, i = λD/a: millimetres),
// the sensor at the run's `sensor` position.

const BASE = 0.02;
const RAIL = { length: 1.8, y: 0.06 };
const LASER_X = -0.85;
const SLIT_X = -0.75;
const BEAM_Y = 0.16;
const SCREEN = { width: 0.24, height: 0.18 };
const FRINGES = 41; // drawn bars, the central one in the middle
const RED = 650e-9;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the rail, the laser and the slit's holder. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const aluminium = own(new THREE.MeshStandardMaterial({ color: '#c6ccd2', ...LOOKS.satin }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  mesh(keep(new THREE.BoxGeometry(RAIL.length, 0.04, 0.06)), aluminium).position.set(
    0,
    y0 + RAIL.y - 0.02,
    0,
  );
  // The laser on its post (its case in the item's colour: focus shows on it).
  mesh(
    keep(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 16).rotateZ(Math.PI / 2)),
    painted,
  ).position.set(LASER_X, y0 + BEAM_Y, 0);
  mesh(keep(new THREE.BoxGeometry(0.03, BEAM_Y - RAIL.y, 0.03)), dark).position.set(
    LASER_X,
    y0 + (BEAM_Y + RAIL.y) / 2,
    0,
  );
  // The slit holder: a dark plate on a post, the slits at the beam.
  mesh(keep(new THREE.BoxGeometry(0.004, 0.08, 0.08)), dark).position.set(SLIT_X, y0 + BEAM_Y, 0);
  mesh(keep(new THREE.BoxGeometry(0.02, BEAM_Y - RAIL.y - 0.04, 0.02)), dark).position.set(
    SLIT_X,
    y0 + (BEAM_Y - 0.04 + RAIL.y) / 2,
    0,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The screen and its fringes, the beam, the sensor. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f5f2', ...LOOKS.matte }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const red = own(new THREE.MeshBasicMaterial({ color: '#ff3b2f' })); // laser light reads in the dark
  const green = own(new THREE.MeshBasicMaterial({ color: '#45ff5a' }));
  const screen = new THREE.Group();
  screen.name = 'screen';
  kit.group.add(screen);
  mesh(keep(new THREE.BoxGeometry(0.006, SCREEN.height, SCREEN.width)), white, screen).position.set(
    0,
    y0 + BEAM_Y,
    0,
  );
  mesh(keep(new THREE.BoxGeometry(0.02, BEAM_Y - RAIL.y, 0.02)), dark, screen).position.set(
    0.01,
    y0 + (BEAM_Y + RAIL.y) / 2 - SCREEN.height / 2 + 0.02,
    0,
  );
  // The fringes: a bar each, on the screen's face towards the laser (−x), scaled to their brightness.
  const bar = keep(new THREE.PlaneGeometry(1, 0.05).rotateY(-Math.PI / 2));
  const fringes = copies(
    bar,
    red,
    Array.from({ length: FRINGES }, () => new THREE.Matrix4()),
    screen,
  );
  fringes.name = 'fringes';
  fringes.castShadow = false;
  const beam = mesh(
    keep(
      new THREE.CylinderGeometry(0.0012, 0.0012, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0),
    ),
    red,
  );
  beam.name = 'beam';
  beam.castShadow = false;
  beam.position.set(LASER_X + 0.06, y0 + BEAM_Y, 0);
  beam.scale.x = SLIT_X - LASER_X - 0.06;
  const sensor = mesh(keep(new THREE.BoxGeometry(0.02, 0.02, 0.012)), dark, screen);
  sensor.name = 'sensor';

  const matrix = new THREE.Matrix4();
  const drawn = { lambda: NaN, a: NaN, D: NaN };
  let y = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const lambda = parameters.wavelength ?? RED;
    const a = parameters.slitSeparation ?? 0.3e-3;
    const D = parameters.screenDistance ?? 1;
    if (lambda !== drawn.lambda || a !== drawn.a || D !== drawn.D) {
      drawn.lambda = lambda;
      drawn.a = a;
      drawn.D = D;
      screen.position.x = SLIT_X + D;
      const light = lambda > 600e-9 ? red : green;
      fringes.material = light;
      beam.material = light;
      const pattern = doubleSlitPattern({
        wavelength: lambda,
        slitSeparation: a,
        slitWidth: parameters.slitWidth ?? 0.05e-3,
        screenDistance: D,
        scanSpan: 0.03,
        scanTime: 4,
      });
      const i = (lambda * D) / a;
      const half = (FRINGES - 1) / 2;
      for (let k = 0; k < FRINGES; k++) {
        const z = (k - half) * i;
        const bright = Math.abs(z) < SCREEN.width / 2 ? pattern(z) : 0;
        // Each bar half a fringe wide, its height with its brightness (zero: not drawn).
        matrix.makeScale(1, Math.max(bright, 1e-4), i / 2);
        matrix.setPosition(-0.0035, y0 + BEAM_Y, z);
        fringes.setMatrixAt(k, matrix);
      }
      fringes.instanceMatrix.needsUpdate = true;
      fringes.computeBoundingSphere();
    }
    const next = Number.isFinite(sample.sensor) ? (sample.sensor ?? 0) : -0.015;
    if (next !== y) {
      y = next;
      sensor.position.set(-0.012, y0 + BEAM_Y - 0.05, y);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const doubleSlitBench: BenchModel = {
  frame,
  rig,
  reads: ['sensor'],
  fullScale: { sensor: 0.015 },
};
