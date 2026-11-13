import { facePhotoMaterial } from './facePhoto';
import * as THREE from 'three';
import type { Disposables } from '../../../core/EventBus';
import type { Vec3 } from '../../../core/math';
import type { Game } from '../../../game/Game';
import {
  carrying,
  type HandKey,
  type HandSample,
  sampleHand,
} from '../../../gameplay/action/action';
import type { PlayingAction } from '../../../gameplay/action/ActionSystem';
import { handPoint } from '../../../gameplay/action/handPoint';
import type { ItemDefinition, WornOn } from '../../../gameplay/item';
import { leanDirection } from '../../../gameplay/player/lean';
import { Cloth } from './cloth';
import { blushColour, lipColour } from './head';
import {
  type BodyModel,
  bodyShapeOf,
  buildBody,
  clothMaterial,
  DIGITS,
  EYE_FORWARD,
  outlineMaterial,
  PALM_DROP,
  PALM_HALF,
  SELF_LAYER,
  SHOWN_BY,
  type Surface,
  toonGradient,
} from './BodyModel';

/** What the player holds, as drawn this frame: its posed object and its entity's item. */
export interface HeldView {
  readonly group: THREE.Object3D;
  readonly entity: { readonly item: ItemDefinition };
  /**
   * Held from behind (a phone before the eye): the palm on its back, the fingers round its left
   * edge, the forearm away down to the right — not round its side with the fingers ahead, which
   * so close to the eye points the forearm, and the sleeve's opening, at it.
   */
  readonly behind?: boolean;
}

/** The wrist behind a drawn hand's palm centre, along its forearm (HandsView: fingers −z). */
const WRIST_BEHIND = 0.07;
/**
 * The body's hand (fingers −y, its palm towards the thigh: +x on the left, −x on the right) turned
 * into a drawn hand's axes (fingers −z, the palm down −y, the thumb inwards), per side.
 */
const axesOf = (side: -1 | 1) =>
  new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, side, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(side, 0, 0),
    ),
  );
const HAND_AXES = { [-1]: axesOf(-1), [1]: axesOf(1) } as const;
// Scratch for the limbs' IK and the grips (per frame, never allocated).
const shoulder = new THREE.Vector3();
const target = new THREE.Vector3();
const goal = new THREE.Vector3();
const pole = new THREE.Vector3();
const goalTurn = new THREE.Quaternion();
const up = new THREE.Vector3();
const right = new THREE.Vector3();
const fingers = new THREE.Vector3();
const back = new THREE.Vector3();
const across = new THREE.Vector3();
const local = new THREE.Vector3();
const objectTurn = new THREE.Quaternion();
const gripBasis = new THREE.Matrix4();
const leanDir: Vec3 = [0, 0, 0];
const ZERO: Vec3 = [0, 0, 0];
const elbow = new THREE.Vector3();
const along = new THREE.Vector3();
const bend = new THREE.Vector3();
const at = new THREE.Vector3();
const axis = new THREE.Vector3();
const turn = new THREE.Quaternion();
const parent = new THREE.Quaternion();
const gripAt = new THREE.Vector3();
const gripTurn = new THREE.Quaternion();
const actionTurn = new THREE.Quaternion();
/** The view's pitch (looking down, rad) at which idle hands start to come up, and are fully up. */
const LOOK_DOWN_FROM = 0.35;
const LOOK_DOWN_TO = 0.8;
/**
 * Hands the player looks down at: the wrists before the waist in the body's frame (x out, height as
 * a share of the body's, z ahead), the hand turned fingers ahead (−z), a little down, and the palms
 * half up, towards each other — the bind hand's fingers (−y) tipped forward, then rolled a third of
 * a turn from facing the thigh. (Palms flat up and fingers straight read as hands raised, Phú
 * 2026-11-12.) The fingers rest relaxed.
 */
const LOOKED_AT = { x: 0.13, height: 0.57, z: -0.3 };
const lookedAtTurn = (side: -1 | 1) =>
  new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-side * Math.PI) / 3)
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - 0.25),
    );
const LOOKED_AT_TURN = { [-1]: lookedAtTurn(-1), [1]: lookedAtTurn(1) } as const;
const SIDES = [-1, 1] as const;
/** Each hand's digits' bone names, root and tip (left, right). */
const DIGIT_BONES = (['L', 'R'] as const).map((side) =>
  DIGITS.map((d) => [`${d}${side}1`, `${d}${side}2`] as const),
);

/** A held object's grip axis lies this far (m) ahead of the palm's centre: in the fingers' roots. */
const GRIP_AHEAD = 0.03;
/** How far (m) a shoulder comes forward, at most, for a grip just past the arm's length. */
const SHOULDER_REACH = 0.05;
/** The spine's joint below the eye, as a share of the height (BodyModel: 0.93 − 0.6). */
const SPINE_TO_EYE = 0.33;

/** Each digit's curl (rad) at its two joints, thumb first. */
type Curl = readonly (readonly [number, number])[];
const RELAXED: Curl = [
  [0.15, 0.1],
  [0.25, 0.35],
  [0.25, 0.35],
  [0.3, 0.4],
  [0.3, 0.45],
];
/** Hands held out to be looked at, or acting out a motion: open, the fingers nearly straight. */
const OPEN: Curl = [
  [0.05, 0.05],
  [0.08, 0.1],
  [0.08, 0.1],
  [0.1, 0.12],
  [0.12, 0.15],
];
/** A fist (pressing a button, pulling gloves off into a bin). */
const FIST: Curl = [
  [0.9, 0.6],
  [1.35, 1.5],
  [1.4, 1.5],
  [1.45, 1.5],
  [1.45, 1.5],
];
/** Fingers closed on something about 3 cm thick (a coat's lapel, a goggles' strap). */
const GRIP: Curl = [
  [0.55, 0.35],
  [0.9, 1.0],
  [0.95, 1.05],
  [1.0, 1.1],
  [1.05, 1.15],
];
const CURLS: Record<HandKey['fingers'], Curl> = { open: OPEN, grip: GRIP, fist: FIST };

/**
 * An action key's hand turned in the body's frame, per side (−1 left): its fingers ahead (−z) and
 * palm down, palm up, palm in; fingers up and palm out (−z); or hanging (the bind pose: fingers
 * down, palm in).
 */
const turnOf = (palm: HandKey['palm'], side: -1 | 1) => {
  const ahead = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const roll = (angle: number) =>
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle).multiply(ahead);
  if (palm === 'forward') return roll((side * Math.PI) / 2);
  if (palm === 'up') return roll((-side * Math.PI) / 2);
  if (palm === 'in') return ahead;
  if (palm === 'out') {
    return new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
  }
  return new THREE.Quaternion();
};
const PALMS = Object.fromEntries(
  (['forward', 'up', 'in', 'out', 'down'] as const).map((p) => [
    p,
    { [-1]: turnOf(p, -1), [1]: turnOf(p, 1) },
  ]),
) as Record<HandKey['palm'], Record<-1 | 1, THREE.Quaternion>>;
const keyAt = new THREE.Vector3();
/** Soap foam on a palm: blobs (x out of the palm, y down the hand, z, radius; m), right hand's x. */
const FOAM: readonly (readonly [number, number, number, number])[] = [
  [0.017, -0.04, 0.0, 0.016],
  [0.016, -0.06, -0.015, 0.012],
  [0.016, -0.03, 0.018, 0.011],
  [0.012, -0.085, 0.005, 0.01],
];
/** A key card's colour (Phú: a black card tapped on a door's reader). */
const CARD = '#15171a';
/** A paper towel's colour. */
const TOWEL = '#f2f0ea';
/** A test paper's sheet (Phase Y-5). */
const PAPER = '#f7f4ea';
const keyTurn = new THREE.Quaternion();
/** A thin thing (a pipette) between the thumb and the index; the other fingers tucked in. */
const PINCH: Curl = [
  [0.8, 0.4],
  [0.6, 0.55],
  [0.9, 1.0],
  [1.2, 1.3],
  [1.25, 1.35],
];
/** A finger's piece (m): half of its length, the root's and the tip's (BodyModel's fingers). */
const FINGER_PIECE = 0.037;
/** A finger's own radius (m): it lies on the held object's surface, its axis this far out. */
const FINGER_RADIUS = 0.0085;
/**
 * The fingers round a held object of `radius` (m): each piece a chord of the circle its axis
 * follows round the object, so the root bends by half the first chord's angle and the middle
 * joint by half of both. A thin neck closes them to a fist; the thumb closes a little less.
 */
function wrap(radius: number, out: [number, number][]): void {
  const half = Math.asin(Math.min(1, FINGER_PIECE / (2 * (radius + FINGER_RADIUS))));
  const root = Math.min(1.5, half);
  const middle = Math.min(1.6, 2 * half);
  for (let i = 0; i < out.length; i++) {
    const joint = out[i];
    if (!joint) continue;
    joint[0] = i === 0 ? 0.3 + 0.5 * root : root;
    joint[1] = i === 0 ? 0.4 * middle : middle;
  }
}

const hand = (hands: readonly [THREE.Object3D, THREE.Object3D], side: -1 | 1) =>
  side < 0 ? hands[0] : hands[1];

/** The walking speed at which the swing is full (config player.walkSpeed's 2.2 m/s). */
const FULL_SWING_SPEED = 2.2;
/** The thighs' swing at full speed (rad); the arms swing a little less, opposite. */
const THIGH_SWING = 0.42;

/**
 * The player's body in the world (Phase H-1): built from the character's appearance, dressed in
 * what is worn, stood at the drawn feet behind the eye and turned to the view; the legs step and
 * the arms swing with the speed it moves at, the head follows the view's pitch. Its shadow-only
 * meshes cast the player's shadow; its head and arms are on SELF_LAYER (mirrors only). Per frame
 * only the pose runs, without allocating.
 */
export class BodyView {
  readonly group = new THREE.Group();
  private model: BodyModel | null = null;
  /** The coat's skirt and a dress, swinging (C-5). */
  private cloth: Cloth | null = null;
  /** How far out the arms hang to clear the body as dressed now (rad). */
  private hang = 0.06;
  private shapeKey = '';
  private readonly materials: Record<Surface, THREE.MeshToonMaterial | THREE.MeshBasicMaterial>;
  /** The anime look (C-7): light in flat steps; the outline, seen in mirrors (SELF_LAYER). */
  private readonly gradient = toonGradient();
  /** Skin in two soft steps: an anime face is mostly lit, a light shadow at most. */
  private readonly skinGradient = toonGradient([205, 255]);
  private readonly outline = outlineMaterial('#2b2426', 0.0022);
  /** The shadow-only meshes' material: it writes no colour and no depth (shadow maps draw it). */
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  });
  private casts = true;
  private heightM = 1.7;
  /** How far each arm (left, right) is raised to its goal (0: hanging relaxed, 1: there), eased. */
  private readonly raised = [0, 0];
  /** Where each hand (left, right) hangs this frame, and how it is turned: a reach starts there. */
  private readonly hangs = [new THREE.Vector3(), new THREE.Vector3()] as const;
  private readonly hangTurns = [new THREE.Quaternion(), new THREE.Quaternion()] as const;
  /** The shoulders' places in the chest (the bind pose): a grip may bring them forward. */
  private readonly shoulders = [new THREE.Vector3(), new THREE.Vector3()] as const;
  /** Each hand's finger pose this frame (left, right). */
  private readonly curls = [0, 1].map(() => DIGITS.map((): [number, number] => [0, 0]));
  /** The held object's finger pose (`gripGoal`). */
  private readonly gripCurl = DIGITS.map((): [number, number] => [0, 0]);
  /** Soap foam on the palms (HandsView: from taking soap until rinsing). */
  foamy = false;
  /** The foam: white blobs on each palm, on the hand bones of each body built. */
  private readonly foamGeometry = new THREE.SphereGeometry(1, 10, 8);
  private readonly foamMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
  });
  private readonly foam = [new THREE.Group(), new THREE.Group()] as const;
  /** Where a hand works an action's target (`handPoint`, reused per frame). */
  private readonly workAt: Vec3 = [0, 0, 0];
  /** An action key's hand, sampled (per frame, reused). */
  private readonly sample: HandSample = {
    from: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
    to: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
    along: 0,
    weight: 0,
  };
  /** The fingers between two action keys (per frame, reused). */
  private readonly actionCurl = DIGITS.map((): [number, number] => [0, 0]);
  /** What is worn changed (or the scene): its look waits for the playing action's `swap`. */
  private stale = false;
  /** The worn item carried in the right hand during an action (`carry`): one box, recoloured. */
  private readonly carried = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
  );

  constructor(private readonly game: Game) {
    // Vertex colours: the cloth's folds drawn darker (C-10).
    const m = (color: string) => clothMaterial(color, this.gradient);
    // Colours from the character (refresh); these are the looks.
    this.materials = {
      skin: new THREE.MeshToonMaterial({ color: '#e0b899', gradientMap: this.skinGradient }),
      hands: new THREE.MeshToonMaterial({ color: '#e0b899', gradientMap: this.skinGradient }),
      hair: m('#2b2118'),
      // The drawn eyes keep their colours in any light, as an anime's do.
      eyeWhite: new THREE.MeshBasicMaterial({ color: '#fbfbfb' }),
      iris: new THREE.MeshBasicMaterial({ color: '#4a3426' }),
      mouth: m('#c56a6a'),
      blush: m('#f2a3a3'),
      top: m('#a8c8ee'),
      bottom: m('#4f5b6b'),
      shoes: m('#f2f3f4'),
      accent: m('#1f3d7a'),
      trim: m('#1d1f23'),
      coat: m('#ffffff'),
      coatTrim: m('#5b6878'),
      goggles: m('#d9e6ee'),
      shield: m('#e4f1f7'),
      outer: m('#1f2228'),
      outerTrim: m('#e6c46a'),
      legwear: m('#1f2228'),
      bandage: m('#efe9dc'),
      // The player's own face is never seen from their eyes: no picture.
      photo: facePhotoMaterial(undefined, this.skinGradient),
    };
    // Open shells (the coat's, a jacket's, the skirt's, the hair's) are seen inside from below.
    for (const key of ['coat', 'outer', 'top', 'bottom', 'hair'] as const)
      this.materials[key].side = THREE.DoubleSide;
    this.materials.shield.transparent = true;
    this.materials.shield.opacity = 0.3;
    this.materials.goggles.transparent = true;
    this.materials.goggles.opacity = 0.8;
    // Foam: blobs on the palm's face (the bind hand's palm is towards the body: −x right, +x left).
    FOAM.forEach(([x, y, z, r]) => {
      this.foam.forEach((group, i) => {
        const blob = new THREE.Mesh(this.foamGeometry, this.foamMaterial);
        blob.position.set((i === 0 ? 1 : -1) * x, y, z);
        blob.scale.setScalar(r);
        group.add(blob);
      });
    });
  }

  attach(subscriptions: Disposables): void {
    const { events } = this.game;
    // Applied on the next frame, once an action it starts is known (its `swap`).
    const refresh = () => (this.stale = true);
    for (const type of ['EquipmentChanged', 'SceneLoaded', 'SceneEntered', 'GameLoaded'] as const) {
      subscriptions.add(events.subscribe(type, refresh));
    }
    this.refresh();
  }

  /** Shadows on or off (the preset's). */
  set castShadow(on: boolean) {
    this.casts = on;
    const shadows = this.model?.shadows;
    if (!shadows) return;
    shadows.body.castShadow = on;
    shadows.coat.castShadow = on;
  }

  /**
   * Stands the body at `feet` (drawn), turned to the view, and poses it for the frame: the legs
   * step, the head follows the view, the back bends and the knees give as the eye leans in
   * (`player.lean`). A `held` object is in the hands, gripped as its item says (one hand or both).
   * Otherwise the arms hang relaxed (swinging as it walks) unless the hands are `posing` (a motion
   * acted out: they reach `hands`, the drawn hands' poses, children of `camera`) or the player
   * looks down at them (they come up before the waist, palm up).
   */
  update(
    dt: number,
    feet: Readonly<Vec3>,
    camera: THREE.Camera,
    hands: readonly [THREE.Object3D, THREE.Object3D],
    posing: boolean,
    held: HeldView | null = null,
  ): void {
    const { state } = this.game;
    const action = this.game.actions.current;
    const swapAt = action?.sequence.swap;
    if (this.stale && (swapAt === undefined || (action?.t ?? 0) >= swapAt)) {
      this.stale = false;
      this.refresh();
    }
    this.group.visible = state.session.phase === 'playing' && this.model !== null;
    const model = this.model;
    if (!model || !this.group.visible) return;
    this.carry(action);
    this.foam[0].visible = this.foamy;
    this.foam[1].visible = this.foamy;
    const { yaw, pitch, lean } = state.player;
    // Leaning in: the back bends forward so that the eye comes forward by the lean's reach; what
    // that leaves of its drop the knees give (a crouch), the feet staying where they are.
    leanDirection(yaw, pitch, leanDir);
    const ahead = lean * Math.hypot(leanDir[0], leanDir[2]);
    const spine = SPINE_TO_EYE * this.heightM;
    const bow = Math.asin(THREE.MathUtils.clamp(ahead / spine, 0, 0.9));
    const drop = spine * (1 - Math.cos(bow)) + EYE_FORWARD * Math.sin(bow);
    const crouch = Math.max(0, -lean * leanDir[1] - drop);
    // Behind the eye: the camera is EYE_FORWARD in front of the neck's axis.
    this.group.position.set(
      feet[0] + Math.sin(yaw) * EYE_FORWARD,
      feet[1] - crouch,
      feet[2] + Math.cos(yaw) * EYE_FORWARD,
    );
    this.group.rotation.set(0, yaw, 0);

    // The player's walk (GaitSystem): the legs swing in time with the footsteps heard.
    const { speed, phase } = this.game.gait.gait;
    const swing = Math.min(1, speed / FULL_SWING_SPEED);
    const s = Math.sin(phase) * swing;
    const b = model.bones;
    // Whole turns, never one axis: a crouch's leg IK (stand) turns these bones about every axis.
    b.spine.rotation.set(-bow, 0, 0);
    b.thighL.rotation.set(THIGH_SWING * s, 0, 0);
    b.thighR.rotation.set(-THIGH_SWING * s, 0, 0);
    // The knee bends as its leg swings back and lifts.
    b.shinL.rotation.set(-0.7 * swing * Math.max(0, -Math.sin(phase + 0.6)), 0, 0);
    b.shinR.rotation.set(-0.7 * swing * Math.max(0, Math.sin(phase + 0.6)), 0, 0);
    b.footL.rotation.set(0, 0, 0);
    b.footR.rotation.set(0, 0, 0);
    // The head looks where the view does (the bow taken back out); the neck takes a little of it.
    const looks = pitch + state.player.glance; // where the eyes look: the head follows them
    b.neck.rotation.set(0.2 * looks + 0.3 * bow, 0, 0);
    b.head.rotation.set(0.6 * looks + 0.7 * bow, 0, 0);
    // Relaxed: hanging a little out from the sides, the elbows soft, swinging opposite the legs.
    b.upperArmL.rotation.set(-0.7 * THIGH_SWING * s, 0, -this.hang);
    b.upperArmR.rotation.set(0.7 * THIGH_SWING * s, 0, this.hang);
    b.foreArmL.rotation.set(0.15 + 0.2 * swing, 0, 0);
    b.foreArmR.rotation.set(0.15 + 0.2 * swing, 0, 0);
    b.handL.rotation.set(0, 0, 0);
    b.handR.rotation.set(0, 0, 0);
    b.upperArmL.position.copy(this.shoulders[0]);
    b.upperArmR.position.copy(this.shoulders[1]);
    this.group.updateMatrixWorld(true);
    if (crouch > 1e-3) {
      this.stand(model, -1, feet[1]);
      this.stand(model, 1, feet[1]);
    }

    const down = THREE.MathUtils.smoothstep(-pitch, LOOK_DOWN_FROM, LOOK_DOWN_TO);
    // Where each hand hangs now: a reach starts from there (on a straight line to its goal).
    b.handL.getWorldPosition(this.hangs[0]);
    b.handR.getWorldPosition(this.hangs[1]);
    b.handL.getWorldQuaternion(this.hangTurns[0]);
    b.handR.getWorldQuaternion(this.hangTurns[1]);
    camera.updateMatrixWorld(true);
    held?.group.updateMatrixWorld(true);
    for (const side of SIDES) {
      const i = side < 0 ? 0 : 1;
      // An action acted out leads the hands it moves (Phase H-3).
      if (
        action &&
        sampleHand(action.sequence, side < 0 ? 'left' : 'right', action.t, this.sample)
      ) {
        const weight = this.sample.weight;
        // A hand that holds the object (one just picked up): from its grip into the keys and back
        // to its grip, never down to its side first (Phú, 2026-11-05: it drew back, then reached
        // out again for the ball it had already taken).
        if (weight < 1 && held !== null && this.gripGoal(held, side, yaw)) {
          gripAt.copy(goal);
          gripTurn.copy(goalTurn);
          this.actionGoal(action, side);
          goal.lerpVectors(gripAt, goal, weight);
          actionTurn.copy(goalTurn);
          goalTurn.copy(gripTurn).slerp(actionTurn, weight);
          this.raised[i] = 1;
          this.curl(model, side, weight > 0.5 ? this.actionCurl : this.gripCurl, 1);
          this.reach(model, side, 1);
          continue;
        }
        this.raised[i] = weight;
        this.actionGoal(action, side);
        this.curl(model, side, this.actionCurl, weight);
        if (weight < 1e-3) continue;
        this.reach(model, side, weight);
        continue;
      }
      // What this hand does: grips the held object; hangs (the free hand while holding); acts out
      // a motion; or comes up to be looked at as the player looks down.
      const grips = held !== null && this.gripGoal(held, side, yaw);
      const want = grips ? 1 : held ? 0 : posing ? 1 : down;
      const weight = (this.raised[i] ?? 0) + (want - (this.raised[i] ?? 0)) * Math.min(1, dt * 8);
      this.raised[i] = weight;
      this.curl(model, side, grips ? this.gripCurl : posing ? OPEN : RELAXED, weight);
      if (weight < 1e-3) continue;
      if (!grips) this.restGoal(side, hand(hands, side), posing);
      this.reach(model, side, weight);
    }
    this.cloth?.step(dt);
  }

  /**
   * The wrist's goal and the hand's turn for the playing action's keys (`sample`), and its
   * fingers (`actionCurl`): each key's palm centre at the body (its frame: x right, y a share of
   * the height, z ahead) or at the target (its centre, world offset), the two keys blended.
   */
  private actionGoal(action: PlayingAction, side: -1 | 1): void {
    const { from, to, along } = this.sample;
    this.keyGoal(from, side, action);
    goal.copy(keyAt);
    goalTurn.copy(keyTurn);
    this.keyGoal(to, side, action);
    goal.lerp(keyAt, along);
    goalTurn.slerp(keyTurn, along);
    // The wrist behind the palm's centre, back along the fingers.
    goal.add(back.set(0, PALM_DROP, 0).applyQuaternion(goalTurn));
    const a = CURLS[from.fingers];
    const z = CURLS[to.fingers];
    for (let k = 0; k < DIGITS.length; k++) {
      const joint = this.actionCurl[k];
      const p = a[k];
      const q = z[k];
      if (!joint || !p || !q) continue;
      joint[0] = p[0] + (q[0] - p[0]) * along;
      joint[1] = p[1] + (q[1] - p[1]) * along;
    }
  }

  /**
   * One action key's palm centre (`keyAt`, world) and hand turn (`keyTurn`): at the body, or where
   * a hand works the target (`handPoint`) offset in its own frame.
   */
  private keyGoal(key: HandKey, side: -1 | 1, action: PlayingAction): void {
    const [x, y, z] = key.offset;
    if (key.at === 'target') {
      const at = handPoint(action.target, this.game.world, this.workAt);
      const [qx, qy, qz, qw] = action.target.pose.rotation;
      local.set(x, y, z).applyQuaternion(objectTurn.set(qx, qy, qz, qw));
      keyAt.set(at[0], at[1], at[2]).add(local);
    } else keyAt.set(x, y * this.heightM, -z).applyMatrix4(this.group.matrixWorld);
    keyTurn.copy(this.group.quaternion).multiply(PALMS[key.palm][side]);
  }

  /**
   * What the right hand carries while the action says (`carry`): the worn item, its box no larger
   * than 0.3 m, or a black key card (`prop`).
   */
  private carry(action: PlayingAction | null): void {
    const shown = action !== null && carrying(action.sequence, action.t);
    this.carried.visible = shown;
    if (!shown) return;
    if (action.sequence.prop === 'card') {
      // A key card (85.6 × 54 mm), flat against the palm, along the fingers.
      this.carried.scale.set(0.002, 0.086, 0.054);
      this.carried.position.set(-(PALM_HALF + 0.001), -PALM_DROP - 0.01, 0);
      this.carried.material.color.set(CARD);
      return;
    }
    if (action.sequence.prop === 'paper') {
      // A sheet (A4) held by its edge between thumb and fingers, upright, its face ahead (to whom it
      // is given, or to the eyes): thin along the fingers.
      this.carried.scale.set(0.21, 0.297, 0.002);
      this.carried.position.set(-(PALM_HALF + 0.04), -PALM_DROP - 0.11, 0.02);
      this.carried.material.color.set(PAPER);
      return;
    }
    if (action.sequence.prop === 'glove' || action.sequence.prop === 'towel') {
      // A glove (in its dispenser's colour) or a paper towel, held by its edge, hanging limp.
      const glove = action.sequence.prop === 'glove';
      this.carried.scale.set(0.012, glove ? 0.2 : 0.24, glove ? 0.09 : 0.2);
      this.carried.position.set(-(PALM_HALF + 0.006), -PALM_DROP - (glove ? 0.08 : 0.1), 0);
      const { item } = action.target;
      // A glove from its dispenser, or one peeled off: the colour the hands still wear (its swap).
      if (!glove) this.carried.material.color.set(TOWEL);
      else if (item.wornOn === 'hands') this.carried.material.color.set(item.visual.color);
      else this.carried.material.color.copy(this.materials.hands.color);
      return;
    }
    const { visual } = action.target.item;
    const [sw, sh, sd] = visual.size;
    const w = Math.min(sw, 0.3);
    const h = Math.min(sh, 0.3);
    const d = Math.min(sd, 0.3);
    this.carried.scale.set(d, h, w); // across the palm, up the hand, along the fingers
    this.carried.position.set(-(PALM_HALF + d / 2), -PALM_DROP, 0);
    this.carried.material.color.set(visual.color);
  }

  /**
   * The wrist's goal and the hand's turn (`goal`, `goalTurn`, world) for gripping `held` with the
   * hand of `side`, and its fingers' pose (`gripCurl`); false when this hand has no grip (the left
   * one, unless the item is held in both). The hand closes on the object from its side of the
   * view, the palm towards it, the fingers ahead (round its front) and the thumb up its axis; the
   * object's axis lies in the fingers' roots.
   */
  private gripGoal(held: HeldView, side: -1 | 1, yaw: number): boolean {
    const { item } = held.entity;
    const grip = item.grip;
    const at = side > 0 ? (grip?.at ?? ZERO) : grip?.other;
    if (!at) return false;
    const object = held.group;
    goal.set(at[0], at[1], at[2]).applyMatrix4(object.matrixWorld);
    object.getWorldQuaternion(objectTurn);
    // Its axis: its own +y, unless it is held as it was grabbed (a ball): then upright.
    up.set(0, 1, 0);
    if (item.physical.handling !== 'free') up.applyQuaternion(objectTurn);
    // From the side: across the view (its right); from behind: ahead, away from the eye.
    if (held.behind) right.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    else right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    right.addScaledVector(up, -right.dot(up)).normalize();
    fingers.crossVectors(up, right);
    let radius = grip?.radius;
    // From behind the fingers reach across its back to the far edge; the palm lies on its back.
    let palmOut = radius;
    if (held.behind) {
      const [w, , d] = item.visual.size;
      radius = w / 2;
      palmOut = d / 2;
    }
    if (radius === undefined) {
      // Its half width across the view: round across its axis, square along it.
      const [w, h, d] = item.visual.size;
      local.copy(right).applyQuaternion(objectTurn.invert());
      radius = Math.hypot((local.x * w) / 2, (local.z * d) / 2) + (Math.abs(local.y) * h) / 2;
    }
    if (grip?.pose === 'pinch') {
      for (let k = 0; k < DIGITS.length; k++) {
        const joint = this.gripCurl[k];
        if (!joint) continue;
        joint[0] = PINCH[k]?.[0] ?? 0;
        joint[1] = PINCH[k]?.[1] ?? 0;
      }
    } else wrap(radius, this.gripCurl);
    // The palm's centre across from the axis on this hand's side; the wrist behind it.
    goal
      .addScaledVector(right, side * ((palmOut ?? radius) + PALM_HALF))
      .addScaledVector(fingers, -GRIP_AHEAD - PALM_DROP);
    // The bind hand's axes (x: across the palm, y: up the arm, z: back) onto the grip's.
    back.copy(fingers).negate();
    across.crossVectors(fingers, right);
    gripBasis.makeBasis(right, back, across);
    goalTurn.setFromRotationMatrix(gripBasis);
    return true;
  }

  /** The wrist's goal and the hand's turn: at the drawn hand's (`posing`), or before the waist. */
  private restGoal(side: -1 | 1, drawn: THREE.Object3D, posing: boolean): void {
    if (posing) {
      goal.set(0, 0, WRIST_BEHIND).applyMatrix4(drawn.matrixWorld);
      drawn.getWorldQuaternion(goalTurn).multiply(HAND_AXES[side]);
    } else {
      goal
        .set(side * LOOKED_AT.x, LOOKED_AT.height * this.heightM, LOOKED_AT.z)
        .applyMatrix4(this.group.matrixWorld);
      goalTurn.copy(this.group.quaternion).multiply(LOOKED_AT_TURN[side]);
    }
  }

  /**
   * The arm of `side` (−1 left) `weight` of the way from where its hand hangs to `goal` — on the
   * straight line between them, so a hand comes up from below, not round — its hand turned as far
   * towards `goalTurn`: two-bone IK, the elbow down, out and a little back; a goal just past the
   * arm's length brings the shoulder forward (at most SHOULDER_REACH).
   */
  private reach(model: BodyModel, side: -1 | 1, weight: number): void {
    const i = side < 0 ? 0 : 1;
    goal.lerpVectors(this.hangs[i], goal, weight);
    turn.copy(goalTurn); // slerpQuaternions would overwrite its own target first
    goalTurn.copy(this.hangTurns[i]).slerp(turn, weight);
    const b = model.bones;
    const upper = side < 0 ? b.upperArmL : b.upperArmR;
    const fore = side < 0 ? b.foreArmL : b.foreArmR;
    const wrist = side < 0 ? b.handL : b.handR;
    const length = fore.position.length() + wrist.position.length();
    upper.getWorldPosition(shoulder);
    const short = goal.distanceTo(shoulder) - 0.995 * length;
    if (short > 0 && upper.parent) {
      along.subVectors(goal, shoulder).normalize();
      along.multiplyScalar(Math.min(short, SHOULDER_REACH));
      upper.parent.getWorldQuaternion(parent).invert();
      upper.position.add(along.applyQuaternion(parent));
      upper.updateMatrixWorld(true);
    }
    pole.set(side * 0.45, -1, 0.35).applyQuaternion(this.group.quaternion);
    this.twoBone(upper, fore, wrist, pole);
    fore.getWorldQuaternion(parent).invert();
    wrist.quaternion.copy(parent.multiply(goalTurn));
  }

  /** Keeps the foot of `side` on the floor (`floor`, m) as the body crouches: the knee forward. */
  private stand(model: BodyModel, side: -1 | 1, floor: number): void {
    const b = model.bones;
    const thigh = side < 0 ? b.thighL : b.thighR;
    const shin = side < 0 ? b.shinL : b.shinR;
    const foot = side < 0 ? b.footL : b.footR;
    // Its ankle where it stands upright: under the hip, at its height over the floor.
    thigh.getWorldPosition(goal);
    goal.y = floor + 0.04 * this.heightM;
    pole.set(0, 0.2, -1).applyQuaternion(this.group.quaternion);
    this.twoBone(thigh, shin, foot, pole);
    // The foot flat on the floor, turned with the body.
    shin.getWorldQuaternion(parent).invert();
    foot.quaternion.copy(parent.multiply(this.group.quaternion));
  }

  /**
   * Two-bone IK: `upper` and `lower` turned so that `end` reaches `goal` (as near as their lengths
   * allow), bending at `lower` towards `poleDir` (world).
   */
  private twoBone(
    upper: THREE.Bone,
    lower: THREE.Bone,
    end: THREE.Bone,
    poleDir: THREE.Vector3,
  ): void {
    const a = lower.position.length();
    const c = end.position.length();
    upper.getWorldPosition(shoulder);
    along.subVectors(goal, shoulder);
    const d = THREE.MathUtils.clamp(along.length(), Math.abs(a - c) + 1e-3, a + c - 1e-3);
    along.normalize();
    bend.copy(poleDir).addScaledVector(along, -poleDir.dot(along)).normalize();
    const x = (a * a - c * c + d * d) / (2 * d);
    elbow
      .copy(shoulder)
      .addScaledVector(along, x)
      .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - x * x)));
    target.copy(shoulder).addScaledVector(along, d); // within reach
    this.point(upper, lower.position, elbow);
    this.point(lower, end.position, target);
  }

  /**
   * The fingers of `side`: from relaxed towards `pose` by `weight`. A finger bends towards its
   * palm about the hand's z; the thumb swings across the palm about its y.
   */
  private curl(model: BodyModel, side: -1 | 1, pose: Curl, weight: number): void {
    const b = model.bones;
    const curls = this.curls[side < 0 ? 0 : 1];
    const names = DIGIT_BONES[side < 0 ? 0 : 1];
    if (!curls || !names) return;
    for (let k = 0; k < DIGITS.length; k++) {
      const now = curls[k];
      const from = RELAXED[k];
      const to = pose[k];
      const bones = names[k];
      if (!now || !from || !to || !bones) continue;
      now[0] = from[0] + (to[0] - from[0]) * weight;
      now[1] = from[1] + (to[1] - from[1]) * weight;
      const root = b[bones[0]];
      const tip = b[bones[1]];
      if (k === 0) root.rotation.set(0, side * now[0], -side * 0.3 * now[0]);
      else root.rotation.set(0, 0, -side * now[0]);
      tip.rotation.set(0, 0, -side * now[1]);
    }
  }

  /** Turns `bone` so that its child (at `child`, in its space) lies towards `towards` (world). */
  private point(bone: THREE.Bone, child: THREE.Vector3, towards: THREE.Vector3): void {
    bone.getWorldPosition(at);
    at.subVectors(towards, at).normalize();
    axis.copy(child).normalize();
    turn.setFromUnitVectors(axis, at);
    (bone.parent ?? bone).getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent.multiply(turn));
    bone.updateMatrixWorld(true);
  }

  dispose(): void {
    this.drop();
    for (const material of Object.values(this.materials)) material.dispose();
    this.gradient.dispose();
    this.skinGradient.dispose();
    this.outline.dispose();
    this.shadowMaterial.dispose();
    this.carried.geometry.dispose();
    this.carried.material.dispose();
    this.foamGeometry.dispose();
    this.foamMaterial.dispose();
  }

  /** The character's body (built again when it changes) and what it wears. */
  private refresh(): void {
    const { state, content } = this.game;
    const character = state.player.characterId
      ? content.characters.tryGet(state.player.characterId)
      : undefined;
    if (!character) {
      this.drop();
      return;
    }
    const a = character.appearance;
    const shape = bodyShapeOf(a);
    const key = JSON.stringify(shape);
    if (key !== this.shapeKey) {
      this.drop();
      this.model = buildBody(shape, this.materials, this.shadowMaterial, this.outline);
      for (const line of Object.values(this.model.outlines ?? {})) line.layers.set(SELF_LAYER);
      this.cloth = new Cloth(this.model);
      this.shapeKey = key;
      this.heightM = a.heightM;
      this.shoulders[0].copy(this.model.bones.upperArmL.position);
      this.shoulders[1].copy(this.model.bones.upperArmR.position);
      this.model.bones.handR.add(this.carried);
      this.model.bones.handL.add(this.foam[0]);
      this.model.bones.handR.add(this.foam[1]);
      this.group.add(this.model.group);
      this.castShadow = this.casts;
    }
    const paint: Partial<Record<Surface, string>> = {
      skin: a.skinTone,
      hair: a.hairColor,
      iris: a.eyeColor,
      top: a.clothes.top,
      bottom: a.clothes.bottom,
      shoes: a.clothes.shoes,
      accent: a.clothes.accent,
      outer: a.clothes.jacketColour,
      outerTrim: a.clothes.jacketTrim,
      legwear: a.clothes.legwearColour,
      mouth: lipColour(a.skinTone, a.lashes, a.allure),
      blush: blushColour(a.skinTone),
    };
    for (const [surface, colour] of Object.entries(paint)) {
      this.materials[surface as Surface].color.set(colour);
    }
    const gloves = this.wornOn('hands');
    this.materials.hands.color.set(gloves ?? a.skinTone);
    for (const mesh of this.model?.meshes ?? []) {
      const slot = SHOWN_BY[mesh.userData.surface as Surface];
      if (!slot) continue;
      const colour = this.wornOn(slot);
      mesh.visible = colour !== undefined;
      if (colour && mesh.userData.surface === 'coat') this.materials.coat.color.set(colour);
    }
    if (this.model) {
      const coat = this.wornOn('body') !== undefined;
      this.model.shadows.coat.visible = coat;
      if (this.model.outlines) this.model.outlines.coat.visible = coat;
      this.hang = Math.max(0.06, this.model.fit.spread[coat ? 'coat' : 'bare']);
    }
  }

  private drop(): void {
    if (!this.model) return;
    this.model.group.removeFromParent();
    for (const mesh of this.model.meshes) mesh.geometry.dispose();
    this.model.shadows.body.geometry.dispose();
    this.model.shadows.coat.geometry.dispose();
    this.model.skeleton.dispose();
    this.model = null;
    this.cloth = null;
    this.shapeKey = '';
  }

  /** Colour of what is worn on `slot`, if anything. */
  private wornOn(slot: WornOn): string | undefined {
    const { equipment, content } = this.game;
    for (const id of equipment.worn) {
      const item = content.items.tryGet(id);
      if (item?.wornOn === slot) return item.visual.color;
    }
    return undefined;
  }
}
