import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Population genetics (model `biology.population-genetics`, Phase X): a tray of beetles, one per
// individual of the current generation (at most 200 shown: a sample of a bigger population),
// coloured by genotype — AA dark green, Aa light green, aa yellow — mixed in a fixed pattern, and
// beside it a gauge of the gene pool: the share of allele A (dark) and a (yellow).

const BASE = 0.03;
const TRAY_W = 0.34;
const TRAY_D = 0.26;
const SHOWN = 200;
const GAUGE_H = 0.24;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const soil = own(new THREE.MeshStandardMaterial({ color: '#6b5640', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const tray = mesh(keep(new THREE.BoxGeometry(TRAY_W + 0.02, 0.03, TRAY_D + 0.02)), painted);
  tray.position.set(-0.06, BASE + 0.015, 0);
  const floor = mesh(keep(new THREE.BoxGeometry(TRAY_W, 0.004, TRAY_D)), soil);
  floor.name = 'tray';
  floor.position.set(-0.06, BASE + 0.032, 0);
  mesh(keep(new THREE.BoxGeometry(0.05, GAUGE_H + 0.02, 0.05)), painted).position.set(
    0.19,
    BASE + (GAUGE_H + 0.02) / 2,
    0,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const beetles = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(1, 12, 8).scale(0.008, 0.005, 0.011)),
    own(new THREE.MeshStandardMaterial({ ...LOOKS.satin })),
    SHOWN,
  );
  beetles.name = 'population';
  beetles.castShadow = false;
  beetles.count = 0;
  kit.group.add(beetles);
  const darkA = new THREE.Color('#1f6b34');
  const mixed = new THREE.Color('#7cc46a');
  const yellow = new THREE.Color('#e3c234');
  const gaugeA = mesh(
    keep(new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0)),
    own(new THREE.MeshStandardMaterial({ color: darkA, ...LOOKS.satin })),
  );
  gaugeA.name = 'allele-a';
  const gaugeB = mesh(
    keep(new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0)),
    own(new THREE.MeshStandardMaterial({ color: yellow, ...LOOKS.satin })),
  );
  gaugeB.name = 'allele-b';
  for (const g of [gaugeA, gaugeB]) g.position.set(0.19, BASE + 0.01, 0.03);
  // Slots on the tray in a fixed shuffled order (for the number shown), each with a fixed turn.
  const order = new Int32Array(SHOWN);
  let orderFor = 0;
  const shuffle = (n: number) => {
    let h = 12345;
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = n - 1; i > 0; i--) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const j = Math.floor((h / 4294967296) * (i + 1));
      const t = order[i] ?? 0;
      order[i] = order[j] ?? 0;
      order[j] = t;
    }
    orderFor = n;
  };
  const cols = 20;
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);
  let shownN = NaN;
  let shownAA = NaN;
  let shownAB = NaN;
  let shownP = NaN;

  const pose = ({ parameters, sample }: BenchPose) => {
    const n = Math.min(SHOWN, Math.max(1, Math.round(parameters.population ?? SHOWN)));
    const aa = Number.isFinite(sample.homozygousA) ? (sample.homozygousA ?? 0) : 0.25;
    const ab = Number.isFinite(sample.heterozygous) ? (sample.heterozygous ?? 0) : 0.5;
    const p = Number.isFinite(sample.p) ? (sample.p ?? 0.5) : 0.5;
    if (n === shownN && aa === shownAA && ab === shownAB && p === shownP) return;
    shownN = n;
    shownAA = aa;
    shownAB = ab;
    shownP = p;
    if (n !== orderFor) shuffle(n);
    const nAA = Math.round(aa * n);
    const nAB = Math.min(n - nAA, Math.round(ab * n));
    const rows = Math.ceil(n / cols);
    const dx = TRAY_W / cols;
    const dz = Math.min(TRAY_D / Math.max(1, rows), 0.026);
    for (let k = 0; k < n; k++) {
      const s = order[k] ?? k;
      const c = s % cols;
      const r = Math.floor(s / cols);
      at.set(-0.06 - TRAY_W / 2 + (c + 0.5) * dx, BASE + 0.037, (r - (rows - 1) / 2) * dz);
      turn.setFromAxisAngle(axis, ((s * 137) % 360) * (Math.PI / 180));
      matrix.compose(at, turn, one);
      beetles.setMatrixAt(k, matrix);
      beetles.setColorAt(k, k < nAA ? darkA : k < nAA + nAB ? mixed : yellow);
    }
    beetles.count = n;
    beetles.instanceMatrix.needsUpdate = true;
    if (beetles.instanceColor) beetles.instanceColor.needsUpdate = true;
    gaugeA.scale.set(1, Math.max(1e-3, GAUGE_H * p), 1);
    gaugeB.scale.set(1, Math.max(1e-3, GAUGE_H * (1 - p)), 1);
    gaugeB.position.y = BASE + 0.01 + GAUGE_H * p;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      beetles.dispose();
      kit.dispose();
    },
  };
}

export const beetleTray: BenchModel = {
  frame,
  rig,
  reads: ['homozygousA', 'heterozygous', 'p'],
};
