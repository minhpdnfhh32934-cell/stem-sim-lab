import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { GASES, mostProbableSpeed, quantileSpeeds } from '../../../simulation/models/gasSpeeds';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Speeds of gas molecules (model `chemistry.gas-speeds`, Phase X): a glass box on a base, its
// molecules drawn as small balls flying and bouncing off the walls. Each ball keeps one speed of
// the dialled gas and temperature — the distribution's evenly spaced quantiles, the same set the
// model measures — shown slowed down (VISUAL m per m/s) and coloured from blue (slow) through
// white to red (fast) against the most probable speed. Only a picture of the distribution: the
// balls do not collide with each other (the model's ideal gas). Real sizes in metres.

const BASE = 0.03;
const BOX = 0.32;
const BALLS = 140;
const RADIUS = 0.006;
/** How fast a ball moves on screen per m/s of the molecule's speed (a slow motion, m per m/s). */
const VISUAL = 0.0004;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const plinth = mesh(keep(new THREE.BoxGeometry(BOX + 0.04, 0.02, BOX + 0.04)), painted);
  plinth.position.set(0, BASE + 0.01, 0);
  const box = mesh(keep(new THREE.BoxGeometry(BOX, BOX, BOX)), glass);
  box.name = 'box';
  box.position.set(0, BASE + 0.02 + BOX / 2, 0);
  box.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(originOf(item));
  const material = own(new THREE.MeshStandardMaterial({ ...LOOKS.satin }));
  const balls = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(RADIUS, 10, 8)),
    material,
    BALLS,
  );
  balls.name = 'molecules';
  balls.castShadow = false;
  kit.group.add(balls);
  const centre = new THREE.Vector3(0, BASE + 0.02 + BOX / 2, 0);
  const half = BOX / 2 - RADIUS;
  // Positions and unit directions from a fixed sequence (an LCG: the same picture every time).
  const position = new Float32Array(BALLS * 3);
  const direction = new Float32Array(BALLS * 3);
  let seed = 12345;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < BALLS; i++) {
    for (let k = 0; k < 3; k++) position[i * 3 + k] = next() * half;
    let x = next();
    let y = next();
    let z = next();
    const n = Math.hypot(x, y, z) || 1;
    [x, y, z] = [x / n, y / n, z / n];
    direction.set([x, y, z], i * 3);
  }
  const speeds = new Float64Array(BALLS);
  const order = new Uint16Array(BALLS); // a speed for each ball, shuffled by the same sequence
  for (let i = 0; i < BALLS; i++) order[i] = i;
  for (let i = BALLS - 1; i > 0; i--) {
    const j = Math.floor(((next() + 1) / 2) * (i + 1)) % (i + 1);
    [order[i], order[j]] = [order[j] ?? 0, order[i] ?? 0];
  }
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  const slow = new THREE.Color('#3a7bd5');
  const mid = new THREE.Color('#f2f2ee');
  const fast = new THREE.Color('#d6402c');
  let shownGas = NaN;
  let shownT = NaN;
  let vp = 1;

  const pose = ({ parameters }: BenchPose, dt: number) => {
    const gas = Math.round(parameters.gas ?? 1);
    const t = parameters.temperature ?? 300;
    if (gas !== shownGas || t !== shownT) {
      shownGas = gas;
      shownT = t;
      const M = GASES[gas]?.molarMass ?? 0.028;
      quantileSpeeds(BALLS, M, t, speeds);
      vp = mostProbableSpeed(M, t);
      for (let i = 0; i < BALLS; i++) {
        const v = speeds[order[i] ?? i] ?? 0;
        const r = v / vp;
        if (r < 1) colour.lerpColors(slow, mid, r);
        else colour.lerpColors(mid, fast, Math.min(1, (r - 1) / 1.5));
        balls.setColorAt(i, colour);
      }
      if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
    }
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < BALLS; i++) {
      const v = (speeds[order[i] ?? i] ?? 0) * VISUAL * step;
      for (let k = 0; k < 3; k++) {
        const at = i * 3 + k;
        let p = (position[at] ?? 0) + (direction[at] ?? 0) * v;
        if (p > half || p < -half) {
          direction[at] = -(direction[at] ?? 0);
          p = Math.max(-half, Math.min(half, p));
        }
        position[at] = p;
      }
      matrix.makeTranslation(
        centre.x + (position[i * 3] ?? 0),
        centre.y + (position[i * 3 + 1] ?? 0),
        centre.z + (position[i * 3 + 2] ?? 0),
      );
      balls.setMatrixAt(i, matrix);
    }
    balls.instanceMatrix.needsUpdate = true;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      balls.dispose();
      kit.dispose();
    },
  };
}

export const gasBox: BenchModel = {
  frame,
  rig,
  reads: [],
};
