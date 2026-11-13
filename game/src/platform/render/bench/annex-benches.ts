import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { chromosomesOf, KARYOTYPES, LENGTHS_MB } from '../../../simulation/models/karyotype';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The Biology practice room's last five simulation tables (Phase X): yeast fermenting in a flask,
// a beating heart with its ECG, oat seedlings bending to light, DNA coming out of a strawberry
// extract, and a human karyogram. Each draws only what its run's variables say.

const BASE = 0.03;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function base(item: ItemDefinition): { kit: Assembly; body: THREE.BufferGeometry } {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  kit.group.position.copy(originOf(item));
  const body = kit.keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  return { kit, body };
}

const finite = (v: number | undefined, fallback: number) =>
  v !== undefined && Number.isFinite(v) ? v : fallback;

// ---------------------------------------------------------------- yeast flask (fermentation)

const FLASK_Y = BASE + 0.02;
const BUBBLES = 40;

function flaskFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body } = base(item);
  const { keep, own, mesh } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#dceef2', ...GLASSWARE_LOOK }));
  const broth = own(
    new THREE.MeshStandardMaterial({
      color: '#e6d39a',
      ...LOOKS.glass,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32)), painted).position.set(
    0,
    BASE + 0.01,
    0,
  );
  // A conical flask: a cone body and a neck.
  const flask = mesh(keep(new THREE.CylinderGeometry(0.03, 0.1, 0.18, 32, 1, true)), glass);
  flask.name = 'flask';
  flask.position.set(0, FLASK_Y + 0.09, 0);
  flask.castShadow = false;
  mesh(keep(new THREE.CylinderGeometry(0.026, 0.026, 0.06, 20, 1, true)), glass).position.set(
    0,
    FLASK_Y + 0.21,
    0,
  );
  const liquid = mesh(keep(new THREE.CylinderGeometry(0.058, 0.098, 0.1, 32)), broth);
  liquid.name = 'yeast-solution';
  liquid.position.set(0, FLASK_Y + 0.05, 0);
  liquid.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function flaskRig(item: ItemDefinition): BenchRig {
  const { kit } = base(item);
  const { keep, own, mesh } = kit;
  const balloon = mesh(
    keep(new THREE.SphereGeometry(1, 24, 16).translate(0, 1, 0)),
    own(new THREE.MeshStandardMaterial({ color: '#d8423a', ...LOOKS.satin })),
  );
  balloon.name = 'balloon';
  balloon.position.set(0, FLASK_Y + 0.24, 0);
  const bubbles = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.003, 6, 4)),
    own(new THREE.MeshStandardMaterial({ color: '#ffffff', ...LOOKS.glass, opacity: 0.7 })),
    BUBBLES,
  );
  bubbles.name = 'bubbles';
  bubbles.castShadow = false;
  kit.group.add(bubbles);
  const heights = new Float32Array(BUBBLES).map((_, i) => (i / BUBBLES) * 0.1);
  const matrix = new THREE.Matrix4();
  const pose = ({ sample }: BenchPose, dt: number) => {
    const volume = finite(sample.co2, 0); // mL
    // The balloon holds the gas: radius from V = 4/3 πr³ (drawn at 1:1, a hair to start with).
    const r = Math.max(0.004, Math.cbrt((3 * volume * 1e-6) / (4 * Math.PI)));
    balloon.scale.set(r, r * 1.1, r);
    const rate = finite(sample.rate, 0); // mL/min
    const rise = Math.min(dt, 0.05) * 0.05;
    const shown = Math.min(BUBBLES, Math.round(rate / 2));
    for (let i = 0; i < BUBBLES; i++) {
      let y = (heights[i] ?? 0) + rise;
      if (y > 0.1) y -= 0.1;
      heights[i] = y;
      const a = i * 2.39996;
      const spread = 0.02 + 0.05 * (1 - y / 0.1);
      matrix.makeTranslation(Math.cos(a) * spread, FLASK_Y + 0.005 + y, Math.sin(a) * spread);
      bubbles.setMatrixAt(i, matrix);
    }
    bubbles.count = shown;
    bubbles.instanceMatrix.needsUpdate = true;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      bubbles.dispose();
      kit.dispose();
    },
  };
}

export const yeastFlask: BenchModel = {
  frame: flaskFrame,
  rig: flaskRig,
  reads: ['co2', 'rate'],
  fullScale: { co2: 1500, rate: 80 },
};

// ---------------------------------------------------------------- heart and ECG

const ECG_POINTS = 160;
const SCREEN_W = 0.2;
const SCREEN_H = 0.1;

/** One ECG beat (P, QRS, T) at phase 0–1 of the beat: a schematic, mV-shaped curve. */
function ecg(phase: number): number {
  const g = (mu: number, s: number, a: number) => a * Math.exp(-((phase - mu) ** 2) / (2 * s * s));
  return (
    g(0.12, 0.025, 0.12) +
    g(0.24, 0.008, -0.12) +
    g(0.27, 0.01, 1) +
    g(0.3, 0.01, -0.25) +
    g(0.55, 0.05, 0.28)
  );
}

function heartFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body } = base(item);
  const { keep, own, mesh } = kit;
  mesh(keep(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 24)), painted).position.set(
    -0.1,
    BASE + 0.01,
    0,
  );
  mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 10)), painted).position.set(
    -0.1,
    BASE + 0.08,
    0,
  );
  const screen = mesh(
    keep(new THREE.BoxGeometry(SCREEN_W + 0.02, SCREEN_H + 0.02, 0.02)),
    own(new THREE.MeshStandardMaterial({ color: '#0d1a14', ...LOOKS.satin })),
  );
  screen.name = 'ecg-screen';
  screen.position.set(0.12, BASE + 0.16, -0.05);
  mesh(keep(new THREE.BoxGeometry(0.02, 0.11, 0.02)), painted).position.set(
    0.12,
    BASE + 0.055,
    -0.05,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function heartRig(item: ItemDefinition): BenchRig {
  const { kit } = base(item);
  const { keep, own, mesh } = kit;
  const heart = new THREE.Group();
  heart.name = 'heart';
  heart.position.set(-0.1, BASE + 0.2, 0);
  kit.group.add(heart);
  const muscle = own(new THREE.MeshStandardMaterial({ color: '#b5332e', ...LOOKS.satin }));
  // Two ventricles (a rounded cone, tip down) and two atria above; the aorta arching on top.
  mesh(
    keep(new THREE.SphereGeometry(1, 24, 16).scale(0.055, 0.065, 0.045).translate(0, -0.01, 0)),
    muscle,
    heart,
  );
  mesh(
    keep(new THREE.ConeGeometry(0.04, 0.05, 20).rotateX(Math.PI).translate(0.005, -0.07, 0)),
    muscle,
    heart,
  );
  for (const x of [-0.03, 0.03])
    mesh(keep(new THREE.SphereGeometry(0.026, 16, 12)), muscle, heart).position.set(
      x,
      0.05,
      -0.005,
    );
  mesh(
    keep(new THREE.TorusGeometry(0.025, 0.009, 10, 20, Math.PI)),
    own(new THREE.MeshStandardMaterial({ color: '#c9524a', ...LOOKS.satin })),
    heart,
  ).position.set(0.005, 0.075, 0);
  // It beats all the time: no shadow, or every frame would redraw the shadow maps.
  heart.traverse((o) => (o.castShadow = false));
  const positions = new Float32Array(ECG_POINTS * 3);
  for (let i = 0; i < ECG_POINTS; i++) {
    positions[i * 3] = -SCREEN_W / 2 + (i / (ECG_POINTS - 1)) * SCREEN_W;
    positions[i * 3 + 1] = 0;
  }
  const geometry = keep(new THREE.BufferGeometry());
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  const trace = new THREE.Line(geometry, own(new THREE.LineBasicMaterial({ color: '#3ef08a' })));
  trace.name = 'ecg';
  trace.position.set(0.12, BASE + 0.16 - SCREEN_H * 0.25, -0.038);
  trace.frustumCulled = false;
  kit.group.add(trace);
  let phase = 0;
  let sweep = 0;
  const pose = ({ sample, status }: BenchPose, dt: number) => {
    const bpm = finite(sample.rate, 70);
    const step = Math.min(dt, 0.05);
    phase = (phase + (step * bpm) / 60) % 1;
    // Systole squeezes the ventricles just after the QRS.
    const squeeze = Math.exp(-((phase - 0.32) ** 2) / 0.004);
    heart.scale.setScalar(1 - 0.08 * squeeze);
    if (status !== 'running') return;
    // The trace sweeps across the screen at 2 s per width, like a monitor.
    sweep = (sweep + step / 2) % 1;
    const i = Math.min(ECG_POINTS - 1, Math.floor(sweep * ECG_POINTS));
    positions[i * 3 + 1] = ecg(phase) * SCREEN_H * 0.55;
    attribute.needsUpdate = true;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const heartModel: BenchModel = {
  frame: heartFrame,
  rig: heartRig,
  reads: ['rate'],
  fullScale: { rate: 200 },
};

// ---------------------------------------------------------------- seedlings (tropism)

const SHOOTS = 5;
const SEGMENTS = 8;
const SHOOT_H = 0.16;
const POT_Y = BASE + 0.07;

function seedlingFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body } = base(item);
  const { keep, mesh } = kit;
  mesh(keep(new THREE.BoxGeometry(0.34, 0.02, 0.16)), painted).position.set(0, BASE + 0.01, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function seedlingRig(item: ItemDefinition): BenchRig {
  const { kit } = base(item);
  const { keep, own, mesh } = kit;
  // The pot and its shoots turn together when laid on its side.
  const pot = new THREE.Group();
  pot.name = 'pot';
  pot.position.set(0, POT_Y, 0);
  kit.group.add(pot);
  mesh(
    keep(new THREE.BoxGeometry(0.22, 0.05, 0.08).translate(0, -0.025, 0)),
    own(new THREE.MeshStandardMaterial({ color: '#a8643a', ...LOOKS.matte })),
    pot,
  );
  const green = own(new THREE.MeshStandardMaterial({ color: '#b9d66a', ...LOOKS.satin }));
  const segment = keep(
    new THREE.CylinderGeometry(0.005, 0.005, SHOOT_H / SEGMENTS, 8).translate(
      0,
      SHOOT_H / SEGMENTS / 2,
      0,
    ),
  );
  const black = own(new THREE.MeshStandardMaterial({ color: '#1b1b1b', ...LOOKS.satin }));
  const cap = keep(new THREE.CylinderGeometry(0.0075, 0.0075, 0.022, 10).translate(0, 0.006, 0));
  const sleeve = keep(new THREE.CylinderGeometry(0.0075, 0.0075, 0.06, 10).translate(0, 0.03, 0));
  const auxinMaterial = own(new THREE.MeshBasicMaterial({ color: '#ff9a1f' }));
  const dot = keep(new THREE.SphereGeometry(0.0022, 6, 4));
  const shoots = Array.from({ length: SHOOTS }, (_, s) => {
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = pot;
    for (let k = 0; k < SEGMENTS; k++) {
      const joint = new THREE.Group();
      joint.position.set(
        k === 0 ? (s - (SHOOTS - 1) / 2) * 0.04 : 0,
        k === 0 ? 0 : SHOOT_H / SEGMENTS,
        0,
      );
      parent.add(joint);
      mesh(segment, green, joint).name = s === 2 && k === SEGMENTS - 1 ? 'shoot-tip' : '';
      joints.push(joint);
      parent = joint;
    }
    const tip = joints[SEGMENTS - 1] as THREE.Group;
    const capMesh = mesh(cap, black, tip);
    capMesh.name = s === 2 ? 'tip-cap' : '';
    capMesh.position.y = SHOOT_H / SEGMENTS - 0.006;
    const sleeveMesh = mesh(sleeve, black, joints[0]);
    const auxin = Array.from({ length: 3 }, (_, a) => {
      const d = mesh(dot, auxinMaterial, joints[SEGMENTS - 2 - a]);
      d.position.y = SHOOT_H / SEGMENTS / 2;
      return d;
    });
    return { joints, capMesh, sleeveMesh, auxin };
  });
  const lamp = mesh(
    keep(new THREE.SphereGeometry(0.02, 16, 12)),
    own(new THREE.MeshBasicMaterial({ color: '#fff3b0' })),
  );
  lamp.name = 'lamp';
  const pose = ({ parameters, sample }: BenchPose) => {
    const condition = Math.round(parameters.condition ?? 0);
    const light = Math.round(parameters.light ?? 1);
    const angle = (finite(sample.angle, 0) * Math.PI) / 180;
    const auxin = finite(sample.auxin, 0);
    const side = condition === 4;
    pot.rotation.z = side ? Math.PI / 2 : 0; // on its side: the shoots point left (−x)
    pot.position.y = side ? BASE + 0.13 : POT_Y; // lifted clear of the stand
    lamp.visible = !side;
    lamp.position.set(light * 0.2, light === 0 ? POT_Y + SHOOT_H + 0.08 : POT_Y + SHOOT_H * 0.8, 0);
    // The bend is spread over the upper half (the growing zone); + bends towards +x upright,
    // on its side + is towards the pot's +x, which the pot's quarter turn points up.
    const per = angle / (SEGMENTS / 2);
    for (let s = 0; s < shoots.length; s++) {
      const shoot = shoots[s];
      if (!shoot) continue;
      for (let k = 0; k < shoot.joints.length; k++) {
        const j = shoot.joints[k];
        if (j) j.rotation.z = k >= SEGMENTS / 2 ? -per : 0;
      }
      const tip = shoot.joints[SEGMENTS - 1];
      if (tip) tip.visible = condition !== 3; // tip removed
      shoot.capMesh.visible = condition === 1;
      shoot.sleeveMesh.visible = condition === 2;
      for (let d = 0; d < shoot.auxin.length; d++) {
        const dot = shoot.auxin[d];
        if (!dot) continue;
        dot.visible = auxin !== 0 && condition !== 3;
        // Upright, x is across; on its side the lower side is the pot's −x.
        dot.position.x = (side ? -1 : auxin) * 0.0055;
      }
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const seedlingBox: BenchModel = {
  frame: seedlingFrame,
  rig: seedlingRig,
  reads: ['angle', 'auxin'],
  fullScale: { angle: 90, auxin: 1 },
};

// ---------------------------------------------------------------- DNA extraction tube

const TUBE_R = 0.028;
const TUBE_H = 0.26;
const TUBE_Y = BASE + 0.03;
const STRANDS = 30;

function tubeFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body } = base(item);
  const { keep, own, mesh } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#dceef2', ...GLASSWARE_LOOK }));
  mesh(keep(new THREE.BoxGeometry(0.16, 0.06, 0.08)), painted).position.set(0, BASE + 0.03, 0);
  const tube = mesh(keep(new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 24, 1, true)), glass);
  tube.name = 'tube';
  tube.position.set(0, TUBE_Y + TUBE_H / 2, 0);
  tube.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function tubeRig(item: ItemDefinition): BenchRig {
  const { kit } = base(item);
  const { keep, own, mesh } = kit;
  const column = keep(
    new THREE.CylinderGeometry(TUBE_R - 0.002, TUBE_R - 0.002, 1, 24).translate(0, 0.5, 0),
  );
  const extract = mesh(
    column,
    own(
      new THREE.MeshStandardMaterial({
        color: '#c8324a',
        ...LOOKS.glass,
        opacity: 0.8,
        depthWrite: false,
      }),
    ),
  );
  extract.name = 'extract';
  extract.position.set(0, TUBE_Y, 0);
  const ethanol = mesh(
    column,
    own(
      new THREE.MeshStandardMaterial({
        color: '#eef6fb',
        ...LOOKS.glass,
        opacity: 0.35,
        depthWrite: false,
      }),
    ),
  );
  ethanol.name = 'ethanol';
  const strands = new THREE.InstancedMesh(
    keep(new THREE.TorusGeometry(0.006, 0.0012, 4, 10, Math.PI * 1.4)),
    own(new THREE.MeshStandardMaterial({ color: '#f6f3ea', ...LOOKS.satin })),
    STRANDS,
  );
  strands.name = 'dna';
  strands.castShadow = false;
  kit.group.add(strands);
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();
  const EXTRACT_H = 0.1;
  const pose = ({ parameters, sample }: BenchPose) => {
    const step = Math.round(finite(sample.step, 0));
    const dna = finite(sample.dna, 0);
    // The extract fills the tube after filtering (step 3); the ethanol is layered on at step 4.
    const filtered = step >= 3;
    extract.visible = filtered;
    extract.scale.set(1, EXTRACT_H, 1);
    const withEthanol = step >= 4 && parameters.ethanol === 1;
    ethanol.visible = withEthanol;
    ethanol.position.set(0, TUBE_Y + EXTRACT_H, 0);
    ethanol.scale.set(1, 0.08, 1);
    const n = Math.round((STRANDS * dna) / 100);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      at.set(
        Math.cos(a) * 0.012 * ((i % 3) / 2),
        TUBE_Y + EXTRACT_H + 0.004 + (i % 5) * 0.006,
        Math.sin(a) * 0.01,
      );
      turn.setFromEuler(euler.set(i * 0.7, i * 1.3, i * 0.4));
      matrix.compose(at, turn, one);
      strands.setMatrixAt(i, matrix);
    }
    strands.count = n;
    strands.instanceMatrix.needsUpdate = true;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      strands.dispose();
      kit.dispose();
    },
  };
}

export const dnaTube: BenchModel = {
  frame: tubeFrame,
  rig: tubeRig,
  reads: ['step', 'dna'],
  fullScale: { step: 5, dna: 100 },
};

// ---------------------------------------------------------------- karyogram

const BOARD_W = 0.46;
const BOARD_H = 0.3;
const BOARD_Y = BASE + 0.2;
const MAX_CHROMOSOMES = 47;
const MM_PER_MB = 0.06 / 249;
/** The karyogram's rows: chromosome pairs per row, and the sex chromosomes at the end of row 2 and 4. */
const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '10', '11', '12', 'X'],
  ['13', '14', '15', '16', '17', '18'],
  ['19', '20', '21', '22', 'Y'],
];

function karyoFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body } = base(item);
  const { keep, own, mesh } = kit;
  const board = mesh(
    keep(new THREE.BoxGeometry(BOARD_W + 0.02, BOARD_H + 0.02, 0.012)),
    own(new THREE.MeshStandardMaterial({ color: '#f4f6f8', ...LOOKS.satin })),
  );
  board.name = 'lightbox';
  board.position.set(0, BOARD_Y, -0.05);
  for (const x of [-0.2, 0.2])
    mesh(
      keep(new THREE.BoxGeometry(0.02, BOARD_Y - BOARD_H / 2 - BASE, 0.02)),
      painted,
    ).position.set(x, BASE + (BOARD_Y - BOARD_H / 2 - BASE) / 2, -0.05);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function karyoRig(item: ItemDefinition): BenchRig {
  const { kit } = base(item);
  const { keep, own } = kit;
  const rods = new THREE.InstancedMesh(
    keep(new THREE.CapsuleGeometry(0.0028, 1, 4, 8)),
    own(new THREE.MeshStandardMaterial({ color: '#5a3d7a', ...LOOKS.satin })),
    MAX_CHROMOSOMES,
  );
  rods.name = 'chromosomes';
  rods.castShadow = false;
  rods.position.set(0, BOARD_Y, -0.04);
  kit.group.add(rods);
  const spread = new Float32Array(MAX_CHROMOSOMES * 3); // x, y, turn
  const sorted = new Float32Array(MAX_CHROMOSOMES * 2);
  const lengths = new Float32Array(MAX_CHROMOSOMES);
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);
  let shownKaryotype = -1;
  let count = 0;
  const layout = (k: number) => {
    const all = chromosomesOf(KARYOTYPES[k] ?? (KARYOTYPES[0] as (typeof KARYOTYPES)[number]));
    count = Math.min(MAX_CHROMOSOMES, all.length);
    let h = 99991;
    const rand = () => (h = (Math.imul(h, 1103515245) + 12345) >>> 0) / 4294967296;
    const seen = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const id = all[i] ?? '1';
      lengths[i] = (LENGTHS_MB[id] ?? 50) * MM_PER_MB;
      spread[i * 3] = (rand() - 0.5) * BOARD_W * 0.8;
      spread[i * 3 + 1] = (rand() - 0.5) * BOARD_H * 0.75;
      spread[i * 3 + 2] = rand() * Math.PI;
      // Its place in the karyogram: its row, its pair's column, the copy side by side.
      const r = ROWS.findIndex((row) => row.includes(id));
      const row = ROWS[r] ?? [];
      const col = row.indexOf(id);
      const copy = seen.get(id) ?? 0;
      seen.set(id, copy + 1);
      const pitch = BOARD_W / row.length;
      sorted[i * 2] = -BOARD_W / 2 + (col + 0.5) * pitch + (copy - 0.5) * 0.011;
      sorted[i * 2 + 1] = BOARD_H / 2 - 0.045 - r * 0.072;
    }
    rods.count = count;
  };
  const pose = ({ parameters, sample }: BenchPose) => {
    const k = Math.round(parameters.karyotype ?? 0);
    if (k !== shownKaryotype) {
      shownKaryotype = k;
      layout(k);
    }
    const s = Math.min(1, Math.max(0, finite(sample.sorted, 0)));
    const e = s * s * (3 - 2 * s);
    for (let i = 0; i < count; i++) {
      const x = (spread[i * 3] ?? 0) * (1 - e) + (sorted[i * 2] ?? 0) * e;
      const y = (spread[i * 3 + 1] ?? 0) * (1 - e) + (sorted[i * 2 + 1] ?? 0) * e;
      at.set(x, y, 0);
      turn.setFromAxisAngle(z, (spread[i * 3 + 2] ?? 0) * (1 - e));
      size.set(1, lengths[i] ?? 0.02, 1);
      matrix.compose(at, turn, size);
      rods.setMatrixAt(i, matrix);
    }
    rods.instanceMatrix.needsUpdate = true;
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      rods.dispose();
      kit.dispose();
    },
  };
}

export const karyogram: BenchModel = {
  frame: karyoFrame,
  rig: karyoRig,
  reads: ['sorted'],
};
