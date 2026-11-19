import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../render/body/actor';
import type { BoneName } from '../render/body/BodyModel';
import { cast, type CastFrame } from './cast';
import { type Hour, hourAt, LOOP, togetherAt } from './cycle';
import type { Prop } from './props';
import { LEDGE } from './rooftop';

/*
 * The two on the roof, measured on their real skeletons over a whole day (Phase W, Phú: nothing
 * through anything, every touch a touch). Each limb is sampled along its bones; a sample inside
 * the ledge or the roof (by more than its own thickness, less a little softness) is a fault, as is
 * one of a person's limbs inside the other's body. Where they rest on each other the contact is
 * checked: her head on his shoulder, his hand at her waist, his head on her lap.
 */

/** Plain props (no canvas in the tests). */
const plain = (): Prop => {
  const group = new THREE.Group();
  const turn = new THREE.Group();
  group.add(turn);
  return { group, turn, setNight: () => undefined, dispose: () => undefined };
};

const LIMBS: readonly [BoneName, BoneName, number][] = [
  ['upperArmL', 'foreArmL', 0.045],
  ['foreArmL', 'handL', 0.038],
  ['upperArmR', 'foreArmR', 0.045],
  ['foreArmR', 'handR', 0.038],
  ['thighL', 'shinL', 0.065],
  ['shinL', 'footL', 0.05],
  ['thighR', 'shinR', 0.065],
  ['shinR', 'footR', 0.05],
];
/** How far a surface may sink into another before it shows (m). */
const SOFT = 0.02;

const at = (a: Actor, bone: BoneName) => a.model.bones[bone].getWorldPosition(new THREE.Vector3());

/** How deep a ball (centre, radius) is in the ledge or the roof's floor (0: clear). */
function inSolids(p: THREE.Vector3, r: number): number {
  const e = r - SOFT;
  const box = (x0: number, x1: number, y0: number, y1: number) =>
    p.z > x0 - e && p.z < x1 + e && p.y > y0 - e && p.y < y1 + e
      ? Math.min(p.z - (x0 - e), x1 + e - p.z, p.y - (y0 - e), y1 + e - p.y)
      : 0;
  // (z, y boxes, as rooftop.ts builds them: the ledge, the roof's floor, the cornice's drip, the
  // tower's face below.)
  return Math.max(
    box(LEDGE.outer, LEDGE.inner, 0, LEDGE.top),
    box(LEDGE.inner, 30, -0.6, 0),
    box(LEDGE.outer, -0.26, -0.78, -0.6),
    box(-0.3, 30, -60, -0.6),
  );
}

/**
 * How deep a ball is in a body's trunk: round its axis from hips to neck, an ellipse `trunk` wide
 * (side to side) and two thirds of that deep (front to back), in the body's own turn.
 */
function inTrunk(
  p: THREE.Vector3,
  r: number,
  body: Actor,
  trunk: number,
  depth: number,
  from: BoneName = 'hips',
  shoulders = false,
): number {
  // Hips to chest, or on up through the shoulder blades most of the way to the neck (an arm round
  // the other's back went through his shoulder: Phú). A head may rest by the shoulders: only
  // limbs are checked against them.
  const top = at(body, 'chest');
  if (shoulders) top.lerp(at(body, 'neck'), 0.6);
  const line = new THREE.Line3(at(body, from), top);
  const c = line.closestPointToPoint(p, true, new THREE.Vector3());
  const local = p
    .clone()
    .sub(c)
    .applyQuaternion(body.model.bones.chest.getWorldQuaternion(new THREE.Quaternion()).invert());
  const rx = trunk + r - SOFT;
  const rz = depth + r - SOFT;
  // Past either end of the trunk (along its axis): clear of it.
  if (Math.abs(local.y) > r) return 0;
  const k = Math.hypot(local.x / rx, local.z / rz);
  return k >= 1 ? 0 : (1 - k) * Math.min(rx, rz);
}

interface Fault {
  readonly t: number;
  readonly what: string;
  readonly depth: number;
}

function check(
  t: number,
  linh: Actor,
  khoa: Actor,
  faults: Fault[],
  scene: { lap: number; acts: string },
): void {
  // Each trunk's half-width and half-depth. The depth is measured on the bodies in their clothes:
  // Linh's back 0.15 m behind her chest's axis, Khoa's jacket 0.15 m (taken thinner, an arm went
  // 5 cm into his back unseen by the test). The width is kept short of hips and shoulders: sat hip
  // by hip, they press there.
  const LINH = { w: 0.15, d: 0.14 };
  const KHOA = { w: 0.16, d: 0.15 };
  for (const [name, body, other, own, theirs] of [
    ['Linh', linh, khoa, LINH, KHOA],
    ['Khoa', khoa, linh, KHOA, LINH],
  ] as const) {
    for (const [a, b, r] of LIMBS) {
      const p = at(body, a);
      const q = at(body, b);
      for (let k = 0; k <= 4; k++) {
        const s = p.clone().lerp(q, k / 4);
        const d = inSolids(s, r);
        if (d > 0)
          faults.push({ t, what: `${name} ${a}→${b} in the ledge/roof (${scene.acts})`, depth: d });
        const o = inTrunk(s, r, other, theirs.w, theirs.d, 'spine', true);
        if (o > 0)
          faults.push({
            t,
            what: `${name} ${a}→${b} in the other's body (${scene.acts})`,
            depth: o,
          });
      }
    }
    // A body through itself: a forearm in its own legs or trunk, a thigh (past the hip) or a shin
    // in its own trunk (waist to chest: below the waist a thigh joins it).
    for (const [a, b, r] of LIMBS) {
      const arm = a.startsWith('foreArm');
      if (!arm && !a.startsWith('thigh') && !a.startsWith('shin')) continue;
      // (A hand in its pocket is in the trousers: shrunk into the wrist at the pocket's mouth.)
      if (arm && body.model.bones[b].scale.x < 0.5) continue;
      const p = at(body, a);
      const q = at(body, b);
      for (let k = a.startsWith('thigh') ? 2 : 0; k <= 4; k++) {
        const s = p.clone().lerp(q, k / 4);
        const o = inTrunk(s, r, body, own.w * 0.85, own.d * 0.85, 'spine');
        if (o > 0)
          faults.push({ t, what: `${name} ${a}→${b} in its own body (${scene.acts})`, depth: o });
        if (!arm) continue;
        for (const [c, d, r2] of LIMBS) {
          if (!c.startsWith('thigh') && !c.startsWith('shin')) continue;
          const leg = new THREE.Line3(at(body, c), at(body, d));
          const gap = s.distanceTo(leg.closestPointToPoint(s, true, new THREE.Vector3()));
          const depth = r + r2 - SOFT - gap;
          if (depth > 0)
            faults.push({ t, what: `${name} ${a}→${b} in its own ${c} (${scene.acts})`, depth });
        }
      }
    }
    // Sat or lying, the hips and the head rest on the ledge, never in it.
    for (const [bone, r] of [
      ['hips', 0.08],
      ['head', 0.09],
    ] as const) {
      const d = inSolids(at(body, bone), r);
      if (d > 0) faults.push({ t, what: `${name} ${bone} in the ledge/roof`, depth: d });
    }
  }
  // His head may rest on her lap, not in her body (a narrower trunk there: her thigh is not).
  const head = at(khoa, 'head');
  const inHer = inTrunk(
    head,
    0.09,
    linh,
    scene.lap > 0 ? 0.08 : 0.13,
    scene.lap > 0 ? 0.054 : 0.087,
  );
  if (inHer > 0) faults.push({ t, what: 'Khoa head in Linh', depth: inHer });
}

function frameAt(t: number, hour: Hour, camera: THREE.Camera): CastFrame {
  hourAt(t, hour);
  const day = t % LOOP;
  return {
    lab: new THREE.Vector3(-100, 28, -348),
    stunt: null,
    attention: null,
    night: hour.night,
    outfit: hour.outfit,
    sun: new THREE.Vector3(-0.5, 0.6, 0.6).normalize(),
    wind: new THREE.Vector3(0.8, 0, 0.35),
    camera,
    together: togetherAt(day),
    canLap: togetherAt(day) < 0 && togetherAt(day + 70) < 0,
    inkPx: 0.0005,
  };
}

function run(from: number, to: number, debug: { lapAt?: number; chatAt?: number }) {
  const c = cast(debug, { karambit: plain, card: plain });
  const camera = new THREE.PerspectiveCamera();
  const hour: Hour = { night: 0, elevation: 0, azimuth: 0, golden: 0, outfit: 0, clockS: 0 };
  const faults: Fault[] = [];
  const contacts: { t: number; what: string; gap: number }[] = [];
  const presses: number[] = [];
  const dt = 1 / 30;
  let lapSince: number | null = null;
  let hugSince: number | null = null;
  for (let t = from, n = 0; t < to; t += dt, n++) {
    c.update(dt, t, frameAt(t, hour, camera));
    if (n % 8 !== 0) continue;
    const linh = c.probe.linh();
    const khoa = c.probe.khoa();
    const scene = c.probe.scene();
    check(t, linh, khoa, faults, scene);
    // Her bust gives way to what presses on it, as far as it rises; deeper is through her chest.
    const bust = c.probe.bust();
    const solids = c.probe.solids();
    if (bust) {
      bust.place(linh);
      const past = bust.deepest(solids) - bust.depth;
      if (past > SOFT / 2) faults.push({ t, what: `into her chest (${scene.acts})`, depth: past });
    }
    const q = new THREE.Quaternion();
    // Sat holding each other, once settled a moment.
    if (scene.hug > 0.99) hugSince ??= t;
    else hugSince = null;
    if (hugSince !== null && t - hugSince > 1) {
      // Her temple on his left shoulder.
      const temple = at(linh, 'head').add(
        new THREE.Vector3(0.075, 0.085, 0).applyQuaternion(
          linh.model.bones.head.getWorldQuaternion(q),
        ),
      );
      const shoulder = at(khoa, 'upperArmL').add(new THREE.Vector3(-0.03, 0.07, 0));
      contacts.push({ t, what: 'her head on his shoulder', gap: temple.distanceTo(shoulder) });
      // His left hand at her waist, round her back: on her clothes (0.15–0.18 m behind her
      // spine's axis; a point 0.12 m behind, inside her, had the hand pass for there).
      const waist = at(linh, 'spine').add(new THREE.Vector3(-0.08, 0, 0.2));
      contacts.push({ t, what: 'his hand at her waist', gap: at(khoa, 'handL').distanceTo(waist) });
      // Held to him, her chest pressed against his side (Phú: it gives way there).
      if (bust) presses.push(bust.deepest([[], solids[1] ?? []]));
    }
    // His head on her lap, once he has lain still a moment.
    if (scene.lap > 0.99) lapSince ??= t;
    else lapSince = null;
    if (lapSince !== null && t - lapSince > 1.5) {
      const back = at(khoa, 'head').add(
        new THREE.Vector3(0, 0.1, 0.1).applyQuaternion(khoa.model.bones.head.getWorldQuaternion(q)),
      );
      const hip = at(linh, 'thighR');
      const knee = at(linh, 'shinR');
      const thigh = hip.clone().add(knee.sub(hip).normalize().multiplyScalar(0.14));
      thigh.y += 0.085;
      contacts.push({ t, what: 'his head on her lap', gap: back.distanceTo(thigh) });
    }
  }
  c.dispose();
  return { faults, contacts, presses };
}

/** The deepest fault of each kind (the part and what it is in), deepest first. */
const worst = (faults: readonly Fault[]) => {
  const kinds = new Map<string, Fault>();
  for (const f of faults) {
    const kind = f.what.replace(/ \(.*\)$/, '');
    if ((kinds.get(kind)?.depth ?? 0) < f.depth) kinds.set(kind, f);
  }
  return [...kinds.values()]
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 16)
    .map((f) => `${f.t.toFixed(1)} s ${f.what} ${(f.depth * 100).toFixed(1)} cm`);
};

describe('Linh and Khoa (Phase W)', () => {
  it('go a whole day without a limb through the ledge, the roof or each other; rest on each other', () => {
    const { faults, contacts, presses } = run(0, LOOP, {});
    expect(worst(faults)).toEqual([]);
    const hug = contacts.filter((c) => c.what !== 'his head on her lap');
    expect(hug.length).toBeGreaterThan(10);
    for (const c of hug) expect(c.gap, `${c.t.toFixed(1)} s ${c.what}`).toBeLessThan(0.07);
    // Her chest against him all through the hug: pressed in (at least 8 mm), never through.
    expect(presses.length).toBeGreaterThan(10);
    expect(Math.min(...presses), 'her chest against him').toBeGreaterThan(0.008);
  }, 120_000);

  it('lie his head on her lap, and talk, without a limb through anything', () => {
    const lap = run(10, 75, { lapAt: 12 });
    expect(worst(lap.faults)).toEqual([]);
    const head = lap.contacts.filter((c) => c.what === 'his head on her lap');
    expect(head.length).toBeGreaterThan(10);
    for (const c of head) expect(c.gap, `${c.t.toFixed(1)} s ${c.what}`).toBeLessThan(0.05);
    const chat = run(10, 50, { chatAt: 12 });
    expect(worst(chat.faults)).toEqual([]);
  }, 120_000);
});
