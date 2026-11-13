import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Composition of concurrent forces: an upright white board on its foot, a protractor ring printed
// round its centre mark; three spring balances pinned to it, each pulling a light ring on the mark
// by a string. The rig is what the station sets: balance 1 along the board's +x, balance 2 at the
// dialled angle α from it, balance 3 opposite the resultant (its direction worked out from the
// dialled forces, as the student turns it until the ring rests on the mark); each balance's
// indicator stands at its reading; the ring at its offset during the run.

const FOOT = 0.03;
const BOARD = { size: 0.6, thick: 0.018 };
/** The centre mark's height above the base, and how far in front of the board the ring hangs. */
const CENTRE = FOOT + BOARD.size / 2;
const FRONT = BOARD.thick / 2 + 0.012;
/** Along a balance from the ring: the string, the balance's barrel, its peg (m). */
const BALANCE = { from: 0.1, length: 0.15, radius: 0.011, peg: 0.27, range: 10 };
const DEG = Math.PI / 180;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The foot (the entity's mesh), the board and its printed protractor and centre mark. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f5f2', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#2a3440', ...LOOKS.matte }));
  const body = keep(slab(w, d, FOOT, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2;
  const board = mesh(keep(new THREE.BoxGeometry(BOARD.size, BOARD.size, BOARD.thick)), white);
  board.position.set(0, y0 + CENTRE, 0);
  // Two struts behind it, in the item's colour (focus shows on them).
  for (const s of [-1, 1]) {
    mesh(keep(new THREE.BoxGeometry(0.03, 0.3, 0.03)), painted).position.set(
      s * 0.2,
      y0 + FOOT + 0.15,
      -BOARD.thick / 2 - 0.015,
    );
  }
  // The protractor: a ring of ink, ticks every 10°, the centre mark.
  const face = BOARD.thick / 2 + 0.0008;
  const ring = mesh(keep(new THREE.RingGeometry(0.2, 0.203, 72)), ink);
  ring.position.set(0, y0 + CENTRE, face);
  ring.castShadow = false;
  const ticks: THREE.BufferGeometry[] = [];
  for (let a = 0; a < 360; a += 10) {
    const long = a % 30 === 0;
    ticks.push(
      new THREE.PlaneGeometry(long ? 0.03 : 0.015, 0.002)
        .translate(0.2 - (long ? 0.015 : 0.0075), 0, 0)
        .rotateZ(a * DEG),
    );
  }
  for (const t of ticks) {
    const m = mesh(keep(t), ink);
    m.position.set(0, y0 + CENTRE, face);
    m.castShadow = false;
  }
  const mark = mesh(keep(new THREE.CircleGeometry(0.004, 16)), ink);
  mark.position.set(0, y0 + CENTRE, face);
  mark.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The ring, three balances with their strings and indicators, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const barrel = own(new THREE.MeshStandardMaterial({ color: '#d9c25a', ...LOOKS.plastic }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
  const thread = own(new THREE.MeshStandardMaterial({ color: '#f2efe6', ...LOOKS.matte }));
  const centre = new THREE.Vector3(0, CENTRE, FRONT);
  const ring = mesh(keep(new THREE.TorusGeometry(0.01, 0.0025, 8, 20)), steel);
  ring.name = 'ring';
  ring.castShadow = false;
  // A balance in its own frame: the string from the ring along +x, then the barrel, its peg.
  const strings: THREE.Mesh[] = [];
  const indicators: THREE.Mesh[] = [];
  const turns = [0, 1, 2].map((i) => {
    const turn = new THREE.Group();
    turn.name = `balance-${i + 1}`;
    turn.position.copy(centre);
    kit.group.add(turn);
    const string = mesh(
      keep(
        new THREE.CylinderGeometry(0.0012, 0.0012, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0),
      ),
      thread,
      turn,
    );
    string.castShadow = false;
    strings.push(string);
    const body = mesh(
      keep(
        new THREE.CylinderGeometry(BALANCE.radius, BALANCE.radius, BALANCE.length, 14)
          .rotateZ(Math.PI / 2)
          .translate(BALANCE.from + BALANCE.length / 2, 0, 0),
      ),
      barrel,
      turn,
    );
    body.castShadow = false;
    const peg = mesh(
      keep(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10).rotateX(Math.PI / 2)),
      steel,
      turn,
    );
    peg.position.set(BALANCE.peg, 0, -0.012);
    const indicator = mesh(keep(new THREE.BoxGeometry(0.004, 0.026, 0.026)), red, turn);
    indicator.name = `indicator-${i + 1}`;
    indicator.castShadow = false;
    indicators.push(indicator);
    return turn;
  });

  const drawn = { f1: NaN, f2: NaN, angle: NaN };
  const directions = [0, 0, 0];
  let offset = NaN;
  const readings = [NaN, NaN, NaN];
  const pose = ({ parameters, sample }: BenchPose) => {
    const f1 = parameters.force1 ?? 3;
    const f2 = parameters.force2 ?? 4;
    const angle = parameters.angle ?? 90;
    if (f1 !== drawn.f1 || f2 !== drawn.f2 || angle !== drawn.angle) {
      drawn.f1 = f1;
      drawn.f2 = f2;
      drawn.angle = angle;
      const a = angle * DEG;
      directions[1] = a;
      directions[2] = Math.atan2(f2 * Math.sin(a), f1 + f2 * Math.cos(a)) + Math.PI;
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        if (turn) turn.rotation.z = directions[i] ?? 0;
      }
      readings.fill(NaN); // redraw the indicators at the new forces
      offset = NaN;
    }
    const u = Number.isFinite(sample.offset) ? (sample.offset ?? 0) : 0;
    if (u !== offset) {
      offset = u;
      const towards = directions[2] ?? 0;
      ring.position.set(
        centre.x + u * Math.cos(towards),
        centre.y + u * Math.sin(towards),
        centre.z,
      );
      // Each string from the ring (moved by u) to its balance: its length along the balance.
      for (let i = 0; i < strings.length; i++) {
        const string = strings[i];
        if (!string) continue;
        const along = u * Math.cos(towards - (directions[i] ?? 0));
        string.position.x = along;
        string.scale.x = BALANCE.from - along;
      }
    }
    const r = Math.hypot(f1 + f2 * Math.cos(angle * DEG), f2 * Math.sin(angle * DEG));
    for (let i = 0; i < indicators.length; i++) {
      const indicator = indicators[i];
      const key = i === 0 ? 'reading1' : i === 1 ? 'reading2' : 'reading3';
      const rest = i === 0 ? f1 : i === 1 ? f2 : r; // no run: each balance at its force at rest
      const reading = Number.isFinite(sample[key]) ? (sample[key] ?? 0) : rest;
      if (!indicator || reading === readings[i]) continue;
      readings[i] = reading;
      const share = Math.min(Math.max(reading / BALANCE.range, 0), 1);
      indicator.position.x = BALANCE.from + BALANCE.length * (1 - share);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const forceBoard: BenchModel = {
  frame,
  rig,
  reads: ['offset', 'reading1', 'reading2', 'reading3'],
  fullScale: { offset: 0.01, reading1: 10, reading2: 10, reading3: 10 },
};
