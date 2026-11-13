import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { chargeField } from '../../../simulation/models/pointCharges';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The electric field simulation: a dark screen tilted towards the desk on a case. On it, at full
// size, Q1 and Q2 (0.2 m to its left, hidden when none) — red positive, blue negative — their
// field lines traced from the model's own field (`chargeField`) when a charge changes, an arrow on
// each, and the probe on the axis at the run's `probe` distance from Q1.

const BASE = 0.02;
const CASE = { width: 0.96, depth: 0.2, height: 0.08 };
const SCREEN = { width: 0.9, height: 0.4, tilt: (25 * Math.PI) / 180 };
const SHIFT = -0.025; // the charges' frame on the screen: Q2 (−0.2) to the probe's end (0.25) centred
const D = 0.2; // Q1 to Q2 (the model's `separation`)
const LINES_PER_5NC = 16;
const MAX_LINES = 2 * LINES_PER_5NC;
const STEP = 0.003; // along a field line (m)
const MAX_STEPS = 300;
const START = 0.014; // lines start this far from their charge
const ARROW_AT = 24; // steps along each line

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The screen's frame in the item's: x along the axis, y up the tilted screen, z out of it. */
function screenFrame(y0: number): THREE.Group {
  const screen = new THREE.Group();
  screen.name = 'screen';
  screen.position.set(0, y0 + CASE.height + 0.02, 0.02);
  screen.rotation.x = -(Math.PI / 2 - SCREEN.tilt);
  return screen;
}

/** The base (the entity's mesh), the case, the dark screen and its bezel. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const glass = own(new THREE.MeshBasicMaterial({ color: '#0b1118' })); // reads at any light
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  // The case in the item's colour (focus shows on it).
  mesh(keep(slab(CASE.width, CASE.depth, CASE.height, 0.01, 0.002)), painted).position.set(
    0,
    y0,
    -0.08,
  );
  const screen = screenFrame(y0);
  kit.group.add(screen);
  mesh(
    keep(new THREE.BoxGeometry(SCREEN.width + 0.04, SCREEN.height + 0.04, 0.02)),
    dark,
    screen,
  ).position.set(0, 0, -0.011);
  const face = mesh(keep(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height)), glass, screen);
  face.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The charges, their field lines and arrows, the probe. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const screen = screenFrame(BASE);
  kit.group.add(screen);
  const positive = own(new THREE.MeshBasicMaterial({ color: '#ff5a4a' }));
  const negative = own(new THREE.MeshBasicMaterial({ color: '#4a8dff' }));
  const yellow = own(new THREE.MeshBasicMaterial({ color: '#ffd23a' }));
  const pale = own(new THREE.LineBasicMaterial({ color: '#9fd8ff' }));
  const arrowLook = own(new THREE.MeshBasicMaterial({ color: '#9fd8ff' }));
  const ball = keep(new THREE.SphereGeometry(0.012, 18, 12));
  const q1 = mesh(ball, positive, screen);
  q1.name = 'q1';
  q1.position.set(SHIFT, 0, 0.004);
  const q2 = mesh(ball, positive, screen);
  q2.name = 'q2';
  q2.position.set(SHIFT - D, 0, 0.004);
  const probe = mesh(keep(new THREE.SphereGeometry(0.006, 12, 8)), yellow, screen);
  probe.name = 'probe';
  for (const m of [q1, q2, probe]) m.castShadow = false;
  // The lines: one buffer for the most there can be, drawn up to what was traced.
  const positions = new Float32Array(MAX_LINES * MAX_STEPS * 2 * 3);
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, pale);
  lines.name = 'field-lines';
  lines.frustumCulled = false;
  lines.position.set(SHIFT, 0, 0.002);
  screen.add(lines);
  const arrows = copies(
    keep(new THREE.ConeGeometry(0.006, 0.016, 10)),
    arrowLook,
    Array.from({ length: MAX_LINES }, () => new THREE.Matrix4()),
    screen,
  );
  arrows.name = 'arrows';
  arrows.castShadow = false;
  arrows.position.set(SHIFT, 0, 0.003);

  const e: [number, number] = [0, 0];
  const mid: [number, number] = [0, 0];
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const where = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const inside = (x: number, y: number) =>
    Math.abs(x + SHIFT) < SCREEN.width / 2 && Math.abs(y) < SCREEN.height / 2;

  /** Traces the lines of these charges (C) from each of the one sign that starts them. */
  const trace = (c1: number, c2: number) => {
    const field = chargeField({
      charge: c1,
      secondCharge: c2,
      separation: D,
      probeDistance: 0.1,
      testCharge: 1e-9,
      scanFrom: 0.03,
      scanTo: 0.25,
      scanTime: 6,
    });
    const charges: [number, number][] = [
      [c1, 0],
      [c2, -D],
    ];
    // Lines leave positive charges; with none, they arrive at the negative ones (traced back).
    const sign = c1 > 0 || c2 > 0 ? 1 : -1;
    let v = 0;
    let line = 0;
    for (const [q, cx] of charges) {
      if (q * sign <= 0) continue;
      const count = Math.max(4, Math.round((LINES_PER_5NC * Math.abs(q)) / 5e-9));
      for (let n = 0; n < count && line < MAX_LINES; n++, line++) {
        const angle = (2 * Math.PI * (n + 0.5)) / count;
        let x = cx + START * Math.cos(angle);
        let y = START * Math.sin(angle);
        let arrowed = false;
        for (let k = 0; k < MAX_STEPS; k++) {
          // Midpoint (RK2) along the unit field, forwards from + or backwards to −.
          field(x, y, e);
          let m = Math.hypot(e[0], e[1]);
          if (m === 0) break;
          const hx = x + (sign * STEP * e[0]) / m / 2;
          const hy = y + (sign * STEP * e[1]) / m / 2;
          field(hx, hy, mid);
          m = Math.hypot(mid[0], mid[1]);
          if (m === 0) break;
          const nx = x + (sign * STEP * mid[0]) / m;
          const ny = y + (sign * STEP * mid[1]) / m;
          positions[v] = x;
          positions[v + 1] = y;
          positions[v + 3] = nx;
          positions[v + 4] = ny;
          v += 6; // z stays 0
          if (k === ARROW_AT) {
            // The arrow points along the field (+ to −), whichever way the line was traced.
            dir.set((nx - x) * sign, (ny - y) * sign, 0).normalize();
            turn.setFromUnitVectors(up, dir);
            matrix.compose(where.set(nx, ny, 0), turn, one);
            arrows.setMatrixAt(line, matrix);
            arrowed = true;
          }
          x = nx;
          y = ny;
          if (!inside(x, y)) break;
          // Arrived at a charge of the other sign.
          if (charges.some(([o, ox]) => o * sign < 0 && Math.hypot(x - ox, y) < START)) break;
        }
        if (!arrowed) arrows.setMatrixAt(line, matrix.makeScale(0, 0, 0));
      }
    }
    for (let k = line; k < MAX_LINES; k++) arrows.setMatrixAt(k, matrix.makeScale(0, 0, 0));
    arrows.instanceMatrix.needsUpdate = true;
    arrows.computeBoundingSphere();
    geometry.setDrawRange(0, v / 3);
    geometry.getAttribute('position').needsUpdate = true;
  };

  const drawn = { c1: NaN, c2: NaN };
  let r = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const c1 = parameters.charge ?? 5e-9;
    const c2 = parameters.secondCharge ?? 0;
    if (c1 !== drawn.c1 || c2 !== drawn.c2) {
      drawn.c1 = c1;
      drawn.c2 = c2;
      q1.material = c1 > 0 ? positive : negative;
      q2.material = c2 > 0 ? positive : negative;
      q2.visible = c2 !== 0;
      trace(c1, c2);
    }
    const next = Number.isFinite(sample.probe) ? (sample.probe ?? 0) : 0.03;
    if (next !== r) {
      r = next;
      probe.position.set(SHIFT + r, 0, 0.006);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const fieldDisplay: BenchModel = {
  frame,
  rig,
  reads: ['probe'],
  fullScale: { probe: 0.25 },
};
