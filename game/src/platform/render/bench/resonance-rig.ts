import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Forced oscillation and resonance: a stand whose arm carries a small motor; an eccentric drives a
// rod up and down, a spring hangs from it with a brass mass, a card damping vane under the mass, a
// vertical scale beside it. The rig: the rod at the run's `driver`, the mass at its `displacement`,
// the spring stretched between them, the vane's width with the dialled damping.

const BASE = 0.02;
const ROD_END = 0.74; // the rod's lower end at rest, above the base
const SPRING = { rest: 0.3, radius: 0.018, turns: 14, wire: 0.0018 };
const MASS = { radius: 0.025, height: 0.05 };
const SCALE = { x: 0.09, from: 0.18, to: 0.66 };

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the stand and its arm, the motor, the scale. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  mesh(keep(new THREE.CylinderGeometry(0.009, 0.009, 0.84, 12)), steel).position.set(
    -0.17,
    y0 + 0.42,
    -0.06,
  );
  mesh(keep(new THREE.BoxGeometry(0.2, 0.02, 0.02)), painted).position.set(-0.08, y0 + 0.83, -0.06);
  // The motor and its eccentric wheel.
  mesh(keep(new THREE.BoxGeometry(0.08, 0.06, 0.07)), dark).position.set(0, y0 + 0.82, -0.04);
  mesh(
    keep(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 20).rotateX(Math.PI / 2)),
    steel,
  ).position.set(0, y0 + 0.8, 0);
  // The scale beside the mass: a white strip, a tick each centimetre.
  mesh(keep(new THREE.BoxGeometry(0.035, SCALE.to - SCALE.from, 0.004)), white).position.set(
    SCALE.x,
    y0 + (SCALE.from + SCALE.to) / 2,
    0,
  );
  const ticks: THREE.Matrix4[] = [];
  for (let cm = 0; SCALE.from + cm / 100 <= SCALE.to + 1e-6; cm++) {
    const m = at(SCALE.x - 0.008, y0 + SCALE.from + cm / 100, 0.0025);
    if (cm % 5 !== 0) m.scale(new THREE.Vector3(0.5, 1, 1));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.018, 0.0012, 0.001)), ink, ticks).castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The driven rod, the spring, the mass and its vane. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  const card = own(
    new THREE.MeshStandardMaterial({ color: '#e8e2d0', ...LOOKS.matte, side: THREE.DoubleSide }),
  );
  const rod = mesh(
    keep(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 8).translate(0, 0.03, 0)),
    steel,
  );
  rod.name = 'rod';
  // A unit-length helix, its top at 0, hanging to −1: scaled to the spring's length each pose.
  const points: THREE.Vector3[] = [];
  const n = SPRING.turns * 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * SPRING.turns * 2 * Math.PI;
    points.push(new THREE.Vector3(SPRING.radius * Math.cos(a), -t, SPRING.radius * Math.sin(a)));
  }
  const spring = mesh(
    keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), n, SPRING.wire, 5)),
    steel,
  );
  spring.name = 'spring';
  spring.castShadow = false;
  const mass = mesh(
    keep(new THREE.CylinderGeometry(MASS.radius, MASS.radius, MASS.height, 20)),
    brass,
  );
  mass.name = 'mass';
  const vane = mesh(keep(new THREE.PlaneGeometry(1, 0.08)), card);
  vane.name = 'vane';
  vane.castShadow = false;

  let x = NaN;
  let driver = NaN;
  let zeta = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const nextX = Number.isFinite(sample.displacement) ? (sample.displacement ?? 0) : 0;
    const nextD = Number.isFinite(sample.driver) ? (sample.driver ?? 0) : 0;
    const z = parameters.dampingRatio ?? 0.05;
    if (z !== zeta) {
      zeta = z;
      vane.scale.x = 0.04 + 0.5 * z; // a larger card for heavier damping (look only)
    }
    if (nextX === x && nextD === driver) return;
    x = nextX;
    driver = nextD;
    const top = y0 + ROD_END + driver;
    rod.position.set(0, top, 0);
    const massTop = y0 + ROD_END - SPRING.rest + x;
    spring.position.set(0, top, 0);
    spring.scale.y = Math.max(top - massTop, 0.01);
    mass.position.set(0, massTop - MASS.height / 2, 0);
    vane.position.set(0, massTop - MASS.height - 0.05, 0);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const resonanceRig: BenchModel = {
  frame,
  rig,
  reads: ['displacement', 'driver'],
  fullScale: { displacement: 0.12, driver: 0.01 },
};
