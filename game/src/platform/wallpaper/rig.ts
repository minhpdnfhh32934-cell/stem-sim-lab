import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import { BONES, type BoneName } from '../render/body/BodyModel';
import type { Gesture, PersonView } from '../render/body/person';
import { type Capsule, depthIn, type Part, segmentDepth, type Solids } from './contact';
import { limb, type Limb, middle, orient, reach } from './ik';
import type { Pose } from './poses';
import { spring, type Spring, stepAngle, stepSpring } from './spring';

/*
 * One person's body on the roof (Phase W): what they mean to do (`Intent`: where they are, their
 * joints' angles, where hands and feet go, how their hands are shaped, what they look at) made into
 * a moving body. Everything eases on second-order springs (`spring.ts`): the body's place, every
 * joint, every reach, the hands' shape, the gaze — motion that gathers and settles. Then the
 * limbs that touch something are solved to it (`ik.ts`: feet planted, palms flat on the ledge, a
 * hand at a waist), the fingers shaped, the gaze turned. Solved on whichever of the person's two
 * bodies (day or night clothes) shows, then copied to the other.
 */

export type LimbName = 'handL' | 'handR' | 'footL' | 'footR';
export const LIMB_NAMES: readonly LimbName[] = ['handL', 'handR', 'footL', 'footR'];

export interface Reach {
  /** Where the wrist or ankle goes (world). */
  readonly target: THREE.Vector3;
  /** Where the elbow or knee points (world). */
  readonly pole: THREE.Vector3;
  /** The hand's or foot's own turn (world): where its −y and its +x point; unset keeps its pose's. */
  readonly along: THREE.Vector3 | null;
  readonly xAxis: THREE.Vector3 | null;
  /** How firmly (0 the pose's own limb … 1 the solved one). */
  weight: number;
}

export const makeReach = (): Reach => ({
  target: new THREE.Vector3(),
  pole: new THREE.Vector3(),
  along: new THREE.Vector3(),
  xAxis: new THREE.Vector3(),
  weight: 0,
});

export interface HandShape {
  /** 0 open and flat … 1 a fist. */
  curl: number;
  /** The thumb's curl. */
  thumb: number;
}

export interface Intent {
  /**
   * Where the body stands (its feet's origin, world), its heading and pitch; `frame`, when set,
   * turns all of it as a vehicle it stands in is turned (the rocket's cabin, Phú 2026-11-18).
   */
  readonly root: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    frame: THREE.Quaternion | null;
  };
  readonly pose: Pose;
  readonly reaches: Record<LimbName, Reach>;
  /** Whether the hand's or foot's own turn is set (`along`/`xAxis`). */
  readonly turned: Record<LimbName, boolean>;
  readonly hands: { L: HandShape; R: HandShape };
  /** A point to look at (world), or none (the pose's own head). */
  look: THREE.Vector3 | null;
  /** How much of the gaze the head takes (0–1). */
  lookWeight: number;
  gesture: Gesture;
  /** Each hand hidden in its pocket (0 out … 1 in). */
  readonly pocket: [number, number];
  /** How quick the root follows (Hz): quicker while stepping exactly. */
  rootFreq: number;
  /**
   * The place and the reached-for points taken as they are, with no easing: for a body carried by
   * something fast (a hand on a flying rocket's door would trail it by metres).
   */
  exact: boolean;
}

export function makeIntent(): Intent {
  return {
    root: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, frame: null },
    pose: {},
    reaches: { handL: makeReach(), handR: makeReach(), footL: makeReach(), footR: makeReach() },
    turned: { handL: false, handR: false, footL: false, footR: false },
    hands: { L: { curl: 0.35, thumb: 0.3 }, R: { curl: 0.35, thumb: 0.3 } },
    look: null,
    lookWeight: 0,
    gesture: 'idle',
    pocket: [0, 0],
    rootFreq: 3,
    exact: false,
  };
}

/** How each joint eases: quick and loose (arms, hands) or slow and firm (the spine). */
function feel(bone: BoneName): [number, number] {
  if (bone === 'hips' || bone === 'spine' || bone === 'chest') return [1.8, 0.95];
  if (bone === 'neck' || bone === 'head') return [2.4, 0.85];
  if (bone.startsWith('upperArm') || bone.startsWith('foreArm')) return [2.6, 0.78];
  if (bone.startsWith('hand')) return [3.2, 0.8];
  if (bone.startsWith('thigh') || bone.startsWith('shin') || bone.startsWith('foot'))
    return [3.2, 0.92];
  return [3, 0.9];
}

/** Feet first, then hands: an arm keeps clear of the legs as they are this frame. */
const SOLVE_ORDER: readonly LimbName[] = ['footL', 'footR', 'handL', 'handR'];

/**
 * What a reaching limb is kept out of, by list (0 its own body, 1 the other's): an arm out of
 * everything but itself; a leg only out of its own chest and the other's chest and head (thighs
 * and hips side by side, legs crossed, press on each other as they do; below the waist a thigh
 * joins the trunk).
 */
const KEEP_OUT: Record<LimbName, (list: number, part: Part) => boolean> = {
  handL: (l, p) => l === 0 && (p === 'upperArmL' || p === 'foreArmL'),
  handR: (l, p) => l === 0 && (p === 'upperArmR' || p === 'foreArmR'),
  footL: (l, p) => (l === 0 ? p !== 'chest' : p !== 'chest' && p !== 'head'),
  footR: (l, p) => (l === 0 ? p !== 'chest' : p !== 'chest' && p !== 'head'),
};
/** The same, in its own body only, and in the other's only. */
const OWN_ONLY = new Map(
  Object.values(KEEP_OUT).map((k) => [k, (l: number, p: Part) => l === 1 || k(l, p)]),
);
const OTHER_ONLY = new Map(
  Object.values(KEEP_OUT).map((k) => [k, (l: number, p: Part) => l === 0 || k(l, p)]),
);
/** The swings round its reach an elbow or knee may take to pass clear (rad, nearest first). */
const SWINGS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25, 1.6, -1.6, 2.0, -2.0, 2.5, -2.5];
/**
 * A knee's: a little either way only. (Crouched, its foot under its hip, a knee swung far went
 * round and round its short reach, through her once a turn.)
 */
const KNEE_SWINGS = [0, 0.25, -0.25, 0.5, -0.5];
/** How far either side of its own an elbow's swing is also tried (rad). */
const NEAR_SWING = 0.06;
/** How far a limb may sink into a body before it counts (soft flesh, cloth) (m). */
const SOFT = 0.01;

const DIGITS = ['thumb', 'index', 'middle', 'ring', 'little'] as const;
/** A relaxed hand curls its outer fingers more (index least, little most). */
const CASCADE: Record<(typeof DIGITS)[number], number> = {
  thumb: 0,
  index: 0.82,
  middle: 1,
  ring: 1.1,
  little: 1.2,
};

interface Joint {
  readonly bone: BoneName;
  readonly x: Spring;
  readonly y: Spring;
  readonly z: Spring;
}

export class Rig {
  private readonly joints = new Map<BoneName, Joint>();
  private readonly limbs: { day: Record<LimbName, Limb>; night: Record<LimbName, Limb> };
  private readonly root = {
    x: spring(),
    y: spring(),
    z: spring(),
    heading: spring(),
    pitch: spring(),
  };
  private readonly reachAt: Record<LimbName, { x: Spring; y: Spring; z: Spring; w: Spring }>;
  private readonly fingers = {
    L: { curl: spring(0.35), thumb: spring(0.3) },
    R: { curl: spring(0.35), thumb: spring(0.3) },
  };
  private readonly pocketL = spring();
  private readonly pocketR = spring();
  private readonly gaze = { yaw: spring(), pitch: spring() };
  private readonly still: PersonView = {
    id: '',
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    sit: false,
    gesture: 'idle',
    look: null,
    called: false,
  };
  private readonly target = new THREE.Vector3();
  private readonly head = new THREE.Vector3();
  private readonly toLook = new THREE.Vector3();
  private readonly invRoot = new THREE.Quaternion();
  private started = false;
  /** Props held in the hands (kept when the actor's own are put away). */
  readonly held = new Set<THREE.Object3D>();
  /**
   * The bodies its reaching limbs are kept out of (`contact.ts`): its own (placed on its bones
   * here, each frame) and the other person's; none, nothing is kept out.
   */
  solids: { readonly own: Solids; readonly other: Solids } | null = null;
  /** The vehicle's turn the body stands in, this frame (`Intent.root.frame`). */
  private frame: THREE.Quaternion | null = null;
  /** Each limb's swing round its reach (rad), eased: where its elbow or knee passes clear. */
  private readonly swing: Record<LimbName, Spring> = {
    handL: spring(),
    handR: spring(),
    footL: spring(),
    footR: spring(),
  };
  /** Scratch: the swings either side of an elbow's own. */
  private readonly nearSwings = [0, 0, 0];
  private readonly lists: (readonly Capsule[])[] = [];
  private readonly away = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly bend = new THREE.Vector3();
  private readonly turnQ = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly swungPole = new THREE.Vector3();
  private readonly fromEnd = new THREE.Vector3();
  private readonly fromMid = new THREE.Vector3();
  private readonly blendPole = new THREE.Vector3();

  constructor(
    readonly day: Actor,
    readonly night: Actor,
  ) {
    const limbsOf = (a: Actor): Record<LimbName, Limb> => {
      const b = a.model.bones;
      return {
        handL: limb(b.upperArmL, b.foreArmL, b.handL, 1),
        handR: limb(b.upperArmR, b.foreArmR, b.handR, 1),
        footL: limb(b.thighL, b.shinL, b.footL, -1),
        footR: limb(b.thighR, b.shinR, b.footR, -1),
      };
    };
    this.limbs = { day: limbsOf(day), night: limbsOf(night) };
    const r = () => ({ x: spring(), y: spring(), z: spring(), w: spring() });
    this.reachAt = { handL: r(), handR: r(), footL: r(), footR: r() };
  }

  /** Put where the next intent says at once, with no easing (a scene jumped to). */
  reset(): void {
    this.started = false;
  }

  /** The body showing (solved on), and the other (copied to, if it shows too). */
  private get bodies(): [Actor, Actor | null] {
    const a = this.day.group.visible ? this.day : this.night;
    const b = a === this.day && this.night.group.visible ? this.night : null;
    return [a, b];
  }

  apply(intent: Intent, dt: number, time: number): void {
    const first = !this.started;
    this.started = true;
    const exact = intent.exact;
    const snap = (s: Spring, v: number) => {
      if (first || exact) {
        s.x = v;
        s.v = 0;
      }
    };
    // The body's place.
    const R = intent.root;
    const rf = intent.rootFreq;
    for (const [s, v] of [
      [this.root.x, R.x],
      [this.root.y, R.y],
      [this.root.z, R.z],
    ] as const) {
      snap(s, v);
      stepSpring(s, v, rf, 1, dt);
    }
    snap(this.root.heading, R.heading);
    snap(this.root.pitch, R.pitch);
    stepAngle(this.root.heading, R.heading, rf * 0.8, 1, dt);
    stepAngle(this.root.pitch, R.pitch, rf * 0.8, 1, dt);
    this.frame = R.frame;
    // The joints.
    for (const k in intent.pose) {
      const bone = k as BoneName;
      const t = intent.pose[bone];
      if (!t || t[3] !== 1) continue;
      let j = this.joints.get(bone);
      if (!j) {
        j = { bone, x: spring(t[0]), y: spring(t[1]), z: spring(t[2]) };
        this.joints.set(bone, j);
      }
      const [f, d] = feel(bone);
      stepAngle(j.x, t[0], f, d, dt);
      stepAngle(j.y, t[1], f, d, dt);
      stepAngle(j.z, t[2], f, d, dt);
    }
    // Reaches, hands, pockets, gaze.
    for (const name of LIMB_NAMES) {
      const want = intent.reaches[name];
      const s = this.reachAt[name];
      const quick = name.startsWith('foot') ? 7 : 4.5;
      snap(s.x, want.target.x);
      snap(s.y, want.target.y);
      snap(s.z, want.target.z);
      if (first) {
        s.w.x = want.weight;
        s.w.v = 0;
      }
      stepSpring(s.x, want.target.x, quick, 1, dt);
      stepSpring(s.y, want.target.y, quick, 1, dt);
      stepSpring(s.z, want.target.z, quick, 1, dt);
      stepSpring(s.w, want.weight, 2.4, 1, dt);
    }
    for (const side of ['L', 'R'] as const) {
      stepSpring(this.fingers[side].curl, intent.hands[side].curl, 4, 0.9, dt);
      stepSpring(this.fingers[side].thumb, intent.hands[side].thumb, 4, 0.9, dt);
    }
    stepSpring(this.pocketL, intent.pocket[0], 3, 1, dt);
    stepSpring(this.pocketR, intent.pocket[1], 3, 1, dt);

    const [main, copy] = this.bodies;
    (this.still as { gesture: Gesture }).gesture = intent.gesture;
    main.update(this.still, dt, time, null);
    this.pose(main, intent, dt);
    if (copy) {
      copy.update(this.still, dt, time, null);
      copy.group.position.copy(main.group.position);
      copy.group.rotation.copy(main.group.rotation);
      for (const name of BONES) {
        copy.model.bones[name].quaternion.copy(main.model.bones[name].quaternion);
        copy.model.bones[name].scale.copy(main.model.bones[name].scale);
      }
      copy.group.updateMatrixWorld(true);
    }
    for (const a of [main, copy]) if (a) this.putAway(a);
  }

  /** The actor's own hand props away: only what is held here shows. */
  private putAway(a: Actor): void {
    for (const hand of [a.model.bones.handR, a.model.bones.handL]) {
      for (const child of hand.children) {
        if (!(child instanceof THREE.Bone) && !this.held.has(child)) child.visible = false;
      }
    }
  }

  private pose(a: Actor, intent: Intent, dt: number): void {
    const g = a.group;
    g.position.set(this.root.x.x, this.root.y.x, this.root.z.x);
    g.rotation.set(this.root.pitch.x, this.root.heading.x, 0, 'YXZ');
    if (this.frame) g.quaternion.premultiply(this.frame);
    const bones = a.model.bones;
    for (const j of this.joints.values()) bones[j.bone].rotation.set(j.x.x, j.y.x, j.z.x);
    // The gaze: the head (and a little the neck) turned to the point, eased.
    g.updateMatrixWorld(true);
    let yaw = 0;
    let pitch = 0;
    if (intent.look && intent.lookWeight > 0) {
      bones.neck.getWorldPosition(this.head);
      this.toLook.subVectors(intent.look, this.head);
      bones.chest.getWorldQuaternion(this.invRoot).invert();
      this.toLook.applyQuaternion(this.invRoot);
      yaw = Math.atan2(-this.toLook.x, -this.toLook.z) * intent.lookWeight;
      pitch =
        Math.atan2(this.toLook.y, Math.hypot(this.toLook.x, this.toLook.z)) * intent.lookWeight;
    }
    stepAngle(this.gaze.yaw, Math.max(-1.15, Math.min(1.15, yaw)), 1.6, 0.9, dt);
    stepAngle(this.gaze.pitch, Math.max(-0.7, Math.min(0.6, pitch)), 1.6, 0.9, dt);
    bones.neck.rotation.y += this.gaze.yaw.x * 0.35;
    bones.neck.rotation.x += this.gaze.pitch.x * 0.3;
    bones.head.rotation.y += this.gaze.yaw.x * 0.65;
    bones.head.rotation.x += this.gaze.pitch.x * 0.7;
    // Hands into pockets: shrunk into the wrist inside the trousers.
    // (0.001 at most: a hand shrunk to a twentieth still showed as a ball at the wrist.)
    bones.handL.scale.setScalar(1 - 0.999 * Math.min(1, Math.max(0, this.pocketL.x)));
    bones.handR.scale.setScalar(1 - 0.999 * Math.min(1, Math.max(0, this.pocketR.x)));
    g.updateMatrixWorld(true);
    // The limbs that touch something.
    const limbs = a === this.day ? this.limbs.day : this.limbs.night;
    for (const name of SOLVE_ORDER) {
      // (The body as the legs have left it, for the arms to keep clear of.)
      if (name === 'handL') this.solids?.own.update(a);
      const s = this.reachAt[name];
      const w = Math.min(1, Math.max(0, s.w.x));
      if (w < 0.002) {
        this.swing[name].x = 0;
        this.swing[name].v = 0;
        continue;
      }
      const want = intent.reaches[name];
      const lb = limbs[name];
      // Part way, the limb is carried by place, not by its joints' turns: the wrist (ankle) from
      // where the pose holds it towards the target, the elbow (knee) from the pose's towards the
      // pole — a path the bodies can be kept clear of. (Turns blended, it swept through a thigh
      // between a pose and a reach.) Only the first steps still blend the turns, so a reach
      // starts without a jump.
      lb.end.getWorldPosition(this.fromEnd);
      lb.lower.getWorldPosition(this.fromMid);
      this.target.set(s.x.x, s.y.x, s.z.x).sub(this.fromEnd).multiplyScalar(w).add(this.fromEnd);
      this.blendPole.copy(want.pole).sub(this.fromMid).multiplyScalar(w).add(this.fromMid);
      // (A hand going into its pocket goes into the trousers: let be once half in.)
      const pocket = name === 'handL' ? this.pocketL.x : name === 'handR' ? this.pocketR.x : 0;
      const pole =
        this.solids && pocket < 0.5 ? this.clear(name, lb, this.blendPole, dt) : this.blendPole;
      reach(lb, this.target, pole, Math.min(1, w / 0.15));
      if (intent.turned[name] && want.along && want.xAxis)
        orient(limbs[name].end, want.along, want.xAxis, w);
    }
    // The fingers: curled by the hand's shape, the outer ones more, each joint a little more.
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? 1 : -1;
      const curl = this.fingers[side].curl.x;
      const thumb = this.fingers[side].thumb.x;
      for (const d of DIGITS) {
        const amount = d === 'thumb' ? thumb * 0.6 : curl * CASCADE[d];
        bones[`${d}${side}1` as BoneName].rotation.set(0, 0, sign * amount * 1.05);
        bones[`${d}${side}2` as BoneName].rotation.set(
          0,
          0,
          sign * amount * (d === 'thumb' ? 0.8 : 1.45),
        );
      }
    }
    g.updateMatrixWorld(true);
    // As it now stands: for the other person's limbs, and for the bust to give way to.
    this.solids?.own.update(a);
  }

  /**
   * Keeps a reaching limb out of the bodies: a wrist going into one is put on its surface
   * (`this.target`, moved), and the elbow or knee swung round the reach to where both bones pass
   * clear — the nearest swing that does (or, if none, goes least deep), eased so it never jumps.
   * Returns the pole to reach with.
   */
  private clear(name: LimbName, lb: Limb, pole: THREE.Vector3, dt: number): THREE.Vector3 {
    const solids = this.solids;
    if (!solids) return pole;
    const lists = this.lists;
    lists[0] = solids.own.capsules;
    lists[1] = solids.other.capsules;
    const skip = KEEP_OUT[name];
    const hand = name.startsWith('hand');
    const build = solids.own.build;
    const r1 = hand ? build.upperArm : build.thigh;
    const r2 = hand ? build.foreArm : build.shin;
    // The wrist on the surface, never in.
    if (hand) {
      for (let i = 0; i < 3; i++) {
        const d = depthIn(this.target, r2, lists, skip, 0, this.away);
        if (d <= 0) break;
        this.target.addScaledVector(this.away, d);
      }
    }
    const swing = this.swing[name];
    let best = 0;
    if (this.depthAt(lb, pole, 0, skip, r1, r2) > 0) {
      let least = Infinity;
      // The set swings, and a little either side of where the elbow is now: two set swings all
      // but tied took turns as she breathed in the hug, her elbow jerking between them (Phú
      // 2026-11-18); near ones let it ease to the clearest place instead.
      const near = this.nearSwings;
      near[0] = swing.x - NEAR_SWING;
      near[1] = swing.x + NEAR_SWING;
      near[2] = swing.x;
      for (const set of hand ? [SWINGS, near] : [KNEE_SWINGS]) {
        for (const angle of set) {
          // Deep counts most; then a small swing, then staying near the last.
          const cost =
            this.depthAt(lb, pole, angle, skip, r1, r2) * 40 +
            Math.abs(angle) * 0.02 +
            Math.abs(angle - swing.x) * 0.04;
          if (cost < least) {
            least = cost;
            best = angle;
          }
        }
      }
    }
    stepAngle(swing, best, 5, 1, dt);
    return this.swung(lb, pole, swing.x);
  }

  /** How deep the limb's two bones go into the bodies, reaching with its pole swung `angle`. */
  private depthAt(
    lb: Limb,
    pole: THREE.Vector3,
    angle: number,
    skip: (list: number, part: Part) => boolean,
    r1: number,
    r2: number,
  ): number {
    middle(lb, this.target, this.swung(lb, pole, angle), this.bend);
    lb.upper.getWorldPosition(this.start);
    // (The upper bone, in its own body from a third of the way — its joint sits against the
    // trunk — in the other's from near its start.)
    const own = OWN_ONLY.get(skip) ?? skip;
    const other = OTHER_ONLY.get(skip) ?? skip;
    return (
      segmentDepth(this.start, this.bend, r1, this.lists, own, SOFT, 0.35) +
      segmentDepth(this.start, this.bend, r1, this.lists, other, SOFT, 0.1) +
      segmentDepth(this.bend, this.target, r2, this.lists, skip, SOFT, 0)
    );
  }

  /** The pole turned `angle` round the reach from the limb's start to `this.target`. */
  private swung(lb: Limb, pole: THREE.Vector3, angle: number): THREE.Vector3 {
    if (Math.abs(angle) < 1e-4) return this.swungPole.copy(pole);
    lb.upper.getWorldPosition(this.start);
    this.axis.subVectors(this.target, this.start).normalize();
    this.turnQ.setFromAxisAngle(this.axis, angle);
    return this.swungPole.subVectors(pole, this.start).applyQuaternion(this.turnQ).add(this.start);
  }
}
