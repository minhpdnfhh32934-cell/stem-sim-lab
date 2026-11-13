import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { quantileSpeeds } from '../../../simulation/models/gasSpeeds';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Collision theory (model `chemistry.collision-theory`, Phase X): a glass box of reacting
// molecules — A blue, B green — that turn into the product P (larger, violet) as the run's
// `conversion` grows: the first share of the pairs shown as product, their B hidden. The balls
// move as a gas's would at the dialled temperature (speeds from the Maxwell–Boltzmann quantiles
// of a 30 g/mol molecule, slowed down): a picture, not the reaction's mechanism.

const BASE = 0.03;
const BOX = 0.32;
const PAIRS = 60;
const BALLS = PAIRS * 2;
const RADIUS = 0.006;
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
  mesh(keep(new THREE.BoxGeometry(BOX + 0.04, 0.02, BOX + 0.04)), painted).position.set(
    0,
    BASE + 0.01,
    0,
  );
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
  const half = BOX / 2 - RADIUS * 1.6;
  const position = new Float32Array(BALLS * 3);
  const direction = new Float32Array(BALLS * 3);
  let seed = 4242;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < BALLS * 3; i++) position[i] = next() * half;
  for (let i = 0; i < BALLS; i++) {
    const x = next();
    const y = next();
    const z = next();
    const n = Math.hypot(x, y, z) || 1;
    direction[i * 3] = x / n;
    direction[i * 3 + 1] = y / n;
    direction[i * 3 + 2] = z / n;
  }
  const speeds = new Float64Array(BALLS);
  const colourA = new THREE.Color('#3a7bd5');
  const colourB = new THREE.Color('#3fae5a');
  const colourP = new THREE.Color('#8a4fc2');
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const at = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  let shownT = NaN;
  let shownProducts = -1;

  const pose = ({ parameters, sample }: BenchPose, dt: number) => {
    const t = parameters.temperature ?? 300;
    if (t !== shownT) {
      shownT = t;
      quantileSpeeds(BALLS, 0.03, t, speeds);
    }
    const conversion = Number.isFinite(sample.conversion) ? (sample.conversion ?? 0) : 0;
    const products = Math.round((PAIRS * conversion) / 100);
    if (products !== shownProducts) {
      shownProducts = products;
      for (let i = 0; i < BALLS; i++) {
        const pair = i >> 1;
        const isA = (i & 1) === 0;
        balls.setColorAt(i, pair < products ? colourP : isA ? colourA : colourB);
      }
      if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
    }
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < BALLS; i++) {
      const v = (speeds[(i * 37) % BALLS] ?? 0) * VISUAL * step;
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        let p = (position[j] ?? 0) + (direction[j] ?? 0) * v;
        if (p > half || p < -half) {
          direction[j] = -(direction[j] ?? 0);
          p = Math.max(-half, Math.min(half, p));
        }
        position[j] = p;
      }
      const pair = i >> 1;
      const product = pair < products;
      // A product is one bigger ball where its A was; its B is gone (scaled to nothing).
      const size = product ? ((i & 1) === 0 ? 1.6 : 0) : 1;
      at.set(
        centre.x + (position[i * 3] ?? 0),
        centre.y + (position[i * 3 + 1] ?? 0),
        centre.z + (position[i * 3 + 2] ?? 0),
      );
      matrix.compose(at, turn, scale.setScalar(Math.max(size, 1e-4)));
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

export const reactionBox: BenchModel = {
  frame,
  rig,
  reads: ['conversion'],
  fullScale: { conversion: 100 },
};
