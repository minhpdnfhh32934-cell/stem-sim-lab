import { facePhotoMaterial } from './facePhoto';
import * as THREE from 'three';
import type { CharacterDefinition, SIGNATURE_POSES } from '../../../gameplay/character';
import type { WornOn } from '../../../gameplay/item';
import {
  type BodyModel,
  bodyShapeOf,
  type BoneName,
  buildBody,
  clothMaterial,
  DIGITS,
  outlineMaterial,
  setOutlineWidth,
  SHOWN_BY,
  type Surface,
  toonGradient,
} from './BodyModel';
import { Cloth } from './cloth';
import { blushColour, lipColour } from './head';
import type { Gesture, PersonView } from './person';

/*
 * A person on the character page: their body (`buildBody`, the player's own model) animated by
 * hand from what the room's life says they do — walking, sitting, talking, listening, their
 * task's motion, their own pose at the front. Each bone's angles are worked out as targets every
 * frame, from layers (a stance, a gesture, a walk, where they look), and the body eases towards
 * them. Bones start unturned (the bind pose: standing, arms down): angles are about the body's
 * axes, the body facing −z with its left at −x. Signs: an arm or a thigh with +x swings forward;
 * a forearm with +x bends the elbow; a shin with −x bends the knee; an arm with z = side·θ rises
 * to that side (side −1 left, +1 right); the head with +y turns left, with −x looks down.
 */

export type Pose = (typeof SIGNATURE_POSES)[number];
type Angles = [number, number, number];
/** The limbs' bones (the digits are curled apart). */
const LIMBS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'upperArmL',
  'foreArmL',
  'handL',
  'upperArmR',
  'foreArmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const satisfies readonly BoneName[];
type Limb = (typeof LIMBS)[number];
/** Each limb's target angles, written in place every frame (nothing allocated). */
type Targets = Record<Limb, Angles>;

/** A target per limb, all zero. */
function newTargets(): Targets {
  return Object.fromEntries(LIMBS.map((name) => [name, [0, 0, 0]])) as unknown as Targets;
}

/** Every limb's target back to zero (the bind pose). */
function clearTargets(out: Targets): void {
  for (let i = 0; i < LIMBS.length; i++) {
    const a = out[LIMBS[i] as Limb];
    a[0] = 0;
    a[1] = 0;
    a[2] = 0;
  }
}

function put(out: Targets, limb: Limb, x: number, y: number, z: number): void {
  const a = out[limb];
  a[0] = x;
  a[1] = y;
  a[2] = z;
}

/** An arm's three bones for a side (+1 right, −1 left): angles of the right, mirrored for the left. */
function arms(
  out: Targets,
  side: 1 | -1,
  ux: number,
  uy: number,
  uz: number,
  fx: number,
  fy: number,
  fz: number,
  hx = 0,
  hy = 0,
  hz = 0,
): void {
  const right = side === 1;
  put(out, right ? 'upperArmR' : 'upperArmL', ux, uy * side, uz * side);
  put(out, right ? 'foreArmR' : 'foreArmL', fx, fy * side, fz * side);
  put(out, right ? 'handR' : 'handL', hx, hy * side, hz * side);
}

/** The finger bones (each digit's two joints) per side, with the side's curl sign. */
const FINGERS = (['L', 'R'] as const).flatMap((side) =>
  DIGITS.flatMap((d) =>
    ([1, 2] as const).map((joint) => ({
      name: `${d}${side}${joint}` as BoneName,
      digit: d,
      sign: side === 'L' ? 1 : -1,
    })),
  ),
);
/** The outline's ink, and its glow when lit up. */
const INK = new THREE.Color('#2b2426');
/** The player's own place before they make a character: a person in one flat black. */
const SHADOW_PERSON = '#14151a';
const GLOW = new THREE.Color('#ffd34d');
const EASE = 9; // 1/s: how quickly a body follows its targets
/** A seat's height (m): where a seated body's hips go; the room's chairs are made to it. */
export const SEAT = 0.47;

/** Bone angles of each signature pose, for the right (+1) and left (−1) sides where they differ. */
function poseTargets(pose: Pose, t: number, out: Targets): Targets {
  const breathe = 0.02 * Math.sin(t * 1.6);
  clearTargets(out);
  put(out, 'chest', breathe, 0, 0);
  switch (pose) {
    case 'arms-crossed':
      arms(out, 1, 0.55, 0, -0.25, 1.75, 0, -0.55);
      arms(out, -1, 0.6, 0, -0.3, 1.65, 0, -0.5);
      put(out, 'head', 0.05, 0, 0.06);
      break;
    case 'wave': {
      arms(out, 1, 0.2, 0, 2.5, 0.3, 0, 0.35 * Math.sin(t * 7));
      arms(out, -1, 0.05, 0, 0.12, 0.15, 0, 0);
      put(out, 'head', 0.04, 0, -0.1);
      break;
    }
    case 'thumbs-up':
      arms(out, 1, 0.7, 0, 0.25, 1.25, -0.6, 0);
      arms(out, -1, 0, 0, 0.1, 0.1, 0, 0);
      put(out, 'chest', breathe - 0.05, 0.1, 0);
      break;
    case 'notes':
      arms(out, 1, 0.3, 0, -0.15, 1.85, 0, -0.35);
      arms(out, -1, 0.3, 0, -0.15, 1.85, 0, -0.35);
      put(out, 'head', -0.12, 0, 0.12);
      break;
    case 'hands-on-hips':
      arms(out, 1, -0.15, 0, 0.75, 0.2, 0, -1.65);
      arms(out, -1, -0.15, 0, 0.75, 0.2, 0, -1.65);
      put(out, 'chest', breathe + 0.04, 0, 0);
      break;
    case 'presenting':
      arms(out, 1, 1.05, 0, 0.45, 0.25, 0, 0, 0, 0, -0.6);
      arms(out, -1, 0.1, 0, 0.1, 0.4, 0, 0);
      put(out, 'head', 0, -0.18, 0);
      break;
    case 'thinking':
      arms(out, 1, 0.35, 0, -0.1, 2.35, 0, -0.35);
      arms(out, -1, 0.4, 0, -0.25, 1.55, 0, -0.75);
      put(out, 'head', 0.08, 0, -0.12);
      break;
    case 'peace':
      arms(out, 1, 0.45, 0, 0.55, 2.0, 0, 0.2);
      arms(out, -1, 0, 0, 0.18, 0.2, 0, 0);
      put(out, 'head', 0.02, 0, -0.16);
      break;
  }
  return out;
}

/** Fingers curled (0–1) per digit for a pose: a fist but for the thumb, a V… */
const CURL_THUMBS_UP = { thumb: 0, index: 1, middle: 1, ring: 1, little: 1 } as const;
const CURL_PEACE = { thumb: 0.9, index: 0, middle: 0, ring: 1, little: 1 } as const;
const CURL_HOLD = { thumb: 0.5, index: 0.7, middle: 0.75, ring: 0.8, little: 0.85 } as const;
const CURL_EASY = { thumb: 0.15, index: 0.25, middle: 0.3, ring: 0.35, little: 0.4 } as const;

function curlOf(
  pose: Pose | null,
  gesture: Gesture,
): Readonly<Record<(typeof DIGITS)[number], number>> {
  if (pose === 'thumbs-up') return CURL_THUMBS_UP;
  if (pose === 'peace') return CURL_PEACE;
  if (pose === 'arms-crossed' || gesture === 'drink' || gesture === 'phone') return CURL_HOLD;
  return CURL_EASY;
}

/** Bone angles of a gesture (standing or seated, not walking). */
function gestureTargets(g: Gesture, t: number, seed: number, out: Targets): Targets {
  const s = Math.sin;
  clearTargets(out);
  put(out, 'chest', 0.02 * s(t * 1.5 + seed), 0, 0);
  switch (g) {
    case 'talk': {
      // Hands that talk: forearms up and moving, a hand turning, the head nodding along.
      const a = s(t * 2.6 + seed);
      const b = s(t * 1.9 + seed * 2);
      put(out, 'upperArmR', 0.25 + 0.1 * a, 0, 0.18);
      put(out, 'foreArmR', 1.05 + 0.35 * a, 0.3 * b, 0);
      put(out, 'handR', 0, 0, -0.4 + 0.3 * b);
      put(out, 'upperArmL', 0.15 + 0.08 * b, 0, -0.12);
      put(out, 'foreArmL', 0.75 + 0.3 * b, -0.2 * a, 0);
      put(out, 'head', 0.06 * s(t * 3.1 + seed), 0, 0.05 * a);
      break;
    }
    case 'listen': {
      // Arms easy, a nod now and then, the head a little on one side.
      const nod = Math.max(0, s(t * 1.3 + seed)) ** 6;
      put(out, 'upperArmR', 0.05, 0, 0.08);
      put(out, 'upperArmL', 0.05, 0, -0.08);
      put(out, 'foreArmR', 0.2, 0, 0);
      put(out, 'foreArmL', 0.2, 0, 0);
      put(out, 'head', -0.18 * nod, 0, 0.08);
      break;
    }
    case 'type': {
      const tap = 0.04 * s(t * 14 + seed);
      put(out, 'upperArmR', 0.45, 0, 0.1);
      put(out, 'upperArmL', 0.45, 0, -0.1);
      put(out, 'foreArmR', 1.05 + tap, 0, -0.25);
      put(out, 'foreArmL', 1.05 - tap, 0, 0.25);
      put(out, 'head', -0.22, 0.05 * s(t * 0.4 + seed), 0);
      break;
    }
    case 'write': {
      // At the board: the right hand up writing, small strokes; the left at the side.
      put(out, 'upperArmR', 1.75 + 0.06 * s(t * 2.2 + seed), 0, 0.12 + 0.12 * s(t * 0.9 + seed));
      put(out, 'foreArmR', 0.45 + 0.1 * s(t * 5 + seed), 0, 0);
      put(out, 'upperArmL', 0.05, 0, -0.1);
      put(out, 'head', 0.12, 0, 0);
      break;
    }
    case 'drink': {
      // A cup to the mouth every few seconds, held at the chest between sips.
      const sip = Math.max(0, s(t * 0.9 + seed)) ** 4;
      put(out, 'upperArmR', 0.35 + 0.25 * sip, 0, -0.1);
      put(out, 'foreArmR', 1.5 + 0.85 * sip, 0, -0.3);
      put(out, 'upperArmL', 0.2, 0, -0.1);
      put(out, 'foreArmL', 1.1, 0, 0.35);
      put(out, 'head', 0.12 * sip, 0, 0);
      break;
    }
    case 'read':
      put(out, 'upperArmR', 0.3, 0, -0.1);
      put(out, 'upperArmL', 0.3, 0, 0.1);
      put(out, 'foreArmR', 1.35, 0, -0.2);
      put(out, 'foreArmL', 1.35, 0, 0.2);
      put(out, 'head', -0.4, 0, 0.04 * s(t * 0.3 + seed));
      break;
    case 'phone':
      put(out, 'upperArmR', 0.35, 0, 0.45);
      put(out, 'foreArmR', 2.45, 0, 0.35);
      put(out, 'upperArmL', 0.15, 0, -0.35);
      put(out, 'foreArmL', 1.3, 0, 0.6);
      put(out, 'head', 0.02, 0.1 * s(t * 0.5 + seed), -0.1);
      break;
    // Another player (2026-11-12). The head is theirs: it follows their view's pitch (update).
    case 'hands':
      // Looking at their own hands: both forearms up before the waist, the palms in and up.
      put(out, 'upperArmR', 0.4, 0, 0.18);
      put(out, 'upperArmL', 0.4, 0, -0.18);
      put(out, 'foreArmR', 1.15, 0, -0.35);
      put(out, 'foreArmL', 1.15, 0, 0.35);
      put(out, 'handR', 0, -0.6, 0);
      put(out, 'handL', 0, 0.6, 0);
      break;
    case 'dial':
      // The phone held up before the chest in the right hand, the thumb on its screen.
      put(out, 'upperArmR', 0.45, 0, 0.12);
      put(out, 'foreArmR', 1.55, 0, -0.35);
      put(out, 'handR', 0.04 * Math.max(0, s(t * 6 + seed)), 0, 0);
      put(out, 'upperArmL', 0.05, 0, -0.1);
      put(out, 'foreArmL', 0.2, 0, 0);
      break;
    case 'test':
      // A test paper in the left hand before the chest, the right hand writing on it.
      put(out, 'upperArmL', 0.4, 0, -0.15);
      put(out, 'foreArmL', 1.45, 0, 0.35);
      put(out, 'upperArmR', 0.45 + 0.03 * s(t * 3 + seed), 0, 0.12);
      put(out, 'foreArmR', 1.3 + 0.06 * s(t * 7 + seed), 0, -0.45);
      break;
    case 'wait':
      // Hands behind the back, weight on one leg, now and then a look round.
      put(out, 'upperArmR', -0.3, 0, 0.12);
      put(out, 'upperArmL', -0.3, 0, -0.12);
      put(out, 'foreArmR', 0.75, 0, -0.5);
      put(out, 'foreArmL', 0.75, 0, 0.5);
      put(out, 'hips', 0, 0, 0.04);
      break;
    default:
      put(out, 'upperArmR', 0, 0, 0.08);
      put(out, 'upperArmL', 0, 0, -0.08);
      put(out, 'foreArmR', 0.12, 0, 0);
      put(out, 'foreArmL', 0.12, 0, 0);
  }
  return out;
}

export class Actor {
  readonly model: BodyModel;
  readonly group: THREE.Group;
  private readonly materials: Record<Surface, THREE.MeshToonMaterial | THREE.MeshBasicMaterial>;
  /** The anime look (C-7): light in flat steps, a dark outline. */
  private readonly gradient = toonGradient();
  /** Skin in two soft steps: an anime face is mostly lit, a light shadow at most. */
  private readonly skinGradient = toonGradient([205, 255]);
  private readonly outline = outlineMaterial('#2b2426', 0.0022);
  /** How lit up they are (0–1): called up and on the way to the front. */
  private glow = 0;
  private glowing = false;
  private readonly current = new Map<BoneName, THREE.Euler>();
  /** This frame's target angles per limb (written in place). */
  private readonly targets = newTargets();
  /** Scratch: a shoulder's place in the world (pointing). */
  private readonly shoulder = new THREE.Vector3();
  private readonly hip: number;
  private phase = 0;
  private sit = 0;
  /** How far into their pose they are since reaching the front (0–1, a quick strike). */
  private strike = 0;
  private readonly seed: number;
  private readonly spread: number;
  private readonly cloth: Cloth;
  /** What their hand holds for what they do there (put down when chosen). */
  private readonly props: [Gesture, THREE.Object3D][] = [];
  private readonly propParts: THREE.Mesh[] = [];
  /** A black key card in the right hand, shown while `card`. */
  private keyCard: THREE.Object3D | null = null;
  /** A pen (its cap the colour of its ink): Phase Y-5. */
  private pen: THREE.Object3D | null = null;
  private penInk: THREE.MeshToonMaterial | null = null;

  constructor(
    readonly character: CharacterDefinition,
    shadowMaterial: THREE.Material,
    index: number,
    /** Drawn all in black: the place of a character not made yet. */
    silhouette = false,
  ) {
    const a = character.appearance;
    const m = (color: string) =>
      silhouette
        ? new THREE.MeshBasicMaterial({ color: SHADOW_PERSON })
        : clothMaterial(color, this.gradient);
    this.materials = {
      skin: silhouette
        ? m(a.skinTone)
        : new THREE.MeshToonMaterial({ color: a.skinTone, gradientMap: this.skinGradient }),
      hands: silhouette
        ? m(a.skinTone)
        : new THREE.MeshToonMaterial({ color: a.skinTone, gradientMap: this.skinGradient }),
      hair: m(a.hairColor),
      // The drawn eyes keep their colours in any light, as an anime's do.
      eyeWhite: new THREE.MeshBasicMaterial({ color: silhouette ? SHADOW_PERSON : '#fbfbfb' }),
      iris: new THREE.MeshBasicMaterial({ color: silhouette ? SHADOW_PERSON : a.eyeColor }),
      mouth: m(lipColour(a.skinTone, a.lashes, a.allure)),
      blush: m(blushColour(a.skinTone)),
      top: m(a.clothes.top),
      bottom: m(a.clothes.bottom),
      shoes: m(a.clothes.shoes),
      accent: m(a.clothes.accent),
      trim: m('#1d1f23'),
      coat: m('#f7f8fa'),
      coatTrim: m('#5b6878'),
      goggles: m('#d9e6ee'),
      shield: m('#e4f1f7'),
      outer: m(a.clothes.jacketColour),
      outerTrim: m(a.clothes.jacketTrim),
      legwear: m(a.clothes.legwearColour),
      bandage: m('#efe9dc'),
      photo: facePhotoMaterial(silhouette ? undefined : a.facePhoto, this.skinGradient),
    };
    for (const key of ['coat', 'outer', 'top', 'bottom', 'hair'] as const)
      this.materials[key].side = THREE.DoubleSide;
    // Clear plastic, as the player's own (BodyView): the face seen through the shield and the
    // goggles' lenses — opaque, the shield was a white panel over the face (Phú, 2026-11-12).
    for (const [key, opacity] of [
      ['shield', 0.3],
      ['goggles', 0.5],
    ] as const) {
      this.materials[key].transparent = true;
      this.materials[key].opacity = opacity;
      this.materials[key].depthWrite = false;
    }
    this.model = buildBody(bodyShapeOf(a), this.materials, shadowMaterial, this.outline);
    this.group = this.model.group;
    this.group.name = `actor-${character.id}`;
    for (const mesh of this.model.meshes) {
      const slot = SHOWN_BY[mesh.userData.surface as Surface];
      // The coat as their profile says; no goggles or shield in the common room.
      mesh.visible = !slot || (slot === 'body' && character.profile.coat);
    }
    this.model.shadows.coat.visible = character.profile.coat;
    if (this.model.outlines) this.model.outlines.coat.visible = character.profile.coat;
    this.hip = this.model.bones.thighL.getWorldPosition(new THREE.Vector3()).y;
    for (const name of Object.keys(this.model.bones) as BoneName[]) {
      this.current.set(name, new THREE.Euler());
    }
    this.seed = index * 1.37;
    // The arms hang clear of the body (and the coat, worn): as far out as its build needs.
    // (The poses already hang the arms about 0.06 rad out.)
    this.spread = Math.max(
      0,
      this.model.fit.spread[character.profile.coat ? 'coat' : 'bare'] - 0.06,
    );
    this.cloth = new Cloth(this.model);
    if (!silhouette) this.makeProps();
  }

  /**
   * A coffee cup, a phone and an open book, in the right hand (its frame: the fingers down −y,
   * the palm towards the body, −x on the right). Shown only for their gesture.
   */
  private makeProps(): void {
    const part = (
      geometry: THREE.BufferGeometry,
      color: string,
      parent: THREE.Object3D,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshToonMaterial({ color, gradientMap: this.gradient }),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      this.propParts.push(mesh);
      return mesh;
    };
    const hand = this.model.bones.handR;
    const cup = new THREE.Group();
    const body = part(new THREE.CylinderGeometry(0.036, 0.03, 0.095, 16), '#f4f1ea', cup, 0, 0, 0);
    body.rotation.x = Math.PI / 2;
    const coffee = part(new THREE.CircleGeometry(0.031, 16), '#5a3a22', cup, 0, 0, -0.044);
    coffee.rotation.y = Math.PI;
    cup.position.set(-0.04, -0.075, 0);
    const phone = new THREE.Group();
    part(new THREE.BoxGeometry(0.008, 0.145, 0.072), '#22252b', phone, 0, 0, 0);
    part(new THREE.BoxGeometry(0.002, 0.13, 0.062), '#7fb8e6', phone, -0.005, 0, 0);
    phone.position.set(-0.03, -0.085, 0);
    const book = new THREE.Group();
    for (const side of [-1, 1]) {
      const page = part(
        new THREE.BoxGeometry(0.15, 0.2, 0.012),
        '#f6f2e6',
        book,
        side * 0.075,
        0,
        0,
      );
      page.rotation.y = side * 0.18;
      const cover = part(
        new THREE.BoxGeometry(0.155, 0.205, 0.006),
        '#2f5d8a',
        book,
        side * 0.077,
        0,
        0.01,
      );
      cover.rotation.y = side * 0.18;
    }
    // A key card (85.6 × 54 mm, black: the player's own), held by its end, along the fingers.
    const card = new THREE.Group();
    part(new THREE.BoxGeometry(0.002, 0.086, 0.054), '#15161a', card, 0, 0, 0);
    card.position.set(-0.03, -0.09, 0);
    card.visible = false;
    hand.add(card);
    this.keyCard = card;
    // A ballpoint pen, its tip past the fingers; the cap shows the ink.
    const pen = new THREE.Group();
    part(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 8), '#eef0f2', pen, 0, 0, 0);
    const cap = part(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.035, 8),
      '#1d3fa8',
      pen,
      0,
      0.06,
      0,
    );
    this.penInk = cap.material;
    pen.position.set(-0.025, -0.1, 0.015);
    pen.visible = false;
    hand.add(pen);
    this.pen = pen;
    book.position.set(-0.13, -0.08, -0.02);
    book.rotation.set(-0.9, 0, 0);
    phone.name = 'phone';
    for (const [g, prop] of [
      ['drink', cup],
      ['phone', phone],
      ['dial', phone],
      ['read', book],
    ] as const) {
      prop.visible = false;
      hand.add(prop);
      this.props.push([g, prop]);
    }
    // A test paper (A5-sized as drawn) in the left hand, its face up towards the eyes.
    const sheet = new THREE.Group();
    sheet.name = 'test-sheet';
    const page = part(new THREE.BoxGeometry(0.15, 0.002, 0.21), '#fbfaf6', sheet, 0, 0, 0);
    page.rotation.x = 0.2;
    sheet.position.set(0.04, -0.09, -0.06);
    sheet.visible = false;
    this.model.bones.handL.add(sheet);
    this.props.push(['test', sheet]);
  }

  /**
   * What they wear, shown (another player, Phase F-3): each slot's colour, nothing for a slot
   * with nothing on it — the lab coat, goggles, a face shield, gloves (the hands' colour).
   */
  wear(worn: Partial<Record<WornOn, string>>): void {
    for (const mesh of this.model.meshes) {
      const slot = SHOWN_BY[mesh.userData.surface as Surface];
      if (slot) mesh.visible = worn[slot] !== undefined;
    }
    if (worn.body) this.materials.coat.color.set(worn.body);
    const coat = worn.body !== undefined;
    this.model.shadows.coat.visible = coat;
    if (this.model.outlines) this.model.outlines.coat.visible = coat;
    this.materials.hands.color.set(worn.hands ?? this.character.appearance.skinTone);
  }

  /** The top of the head above the floor (m), standing. */
  top(): number {
    return this.character.appearance.heightM;
  }

  /**
   * Poses the body from its person's view, `dt` s on; `time` the room's clock. Standing, with a
   * `point` (world, m) they point at it with the arm on its side (a teacher at an apparatus).
   */
  update(
    view: PersonView,
    dt: number,
    time: number,
    look: { x: number; z: number } | null,
    point: { readonly x: number; readonly y: number; readonly z: number } | null = null,
  ): void {
    const g = this.group;
    g.position.set(view.x, 0, view.z);
    g.rotation.y = view.heading;
    const k = 1 - Math.exp(-EASE * dt);
    this.sit += ((view.sit ? 1 : 0) - this.sit) * k;
    const posing = view.gesture === 'pose' && view.speed === 0;
    this.strike = posing ? Math.min(1, this.strike + dt * 2.5) : 0;

    const targets = posing
      ? poseTargets(this.character.profile.pose, time + this.seed, this.targets)
      : gestureTargets(view.gesture, time, this.seed, this.targets);
    if (view.speed > 0) {
      // Walking: legs and arms swing with the stride, the body bobbing at each step. Running
      // (called up): a longer stride, the knees high, the arms bent and pumping, the body leaning
      // into it and bouncing.
      const run = THREE.MathUtils.smoothstep(view.speed, 2.4, 3.6);
      // Heard steps (the world's people) set the swing, so a foot comes down as it is heard.
      if (view.stride === undefined) this.phase += (view.speed * dt * Math.PI) / (0.75 + 0.6 * run);
      else this.phase = view.stride;
      const p = this.phase;
      const swing = (0.34 + 0.36 * run) * Math.min(1, view.speed / 1.2);
      const knee = 0.75 + 0.85 * run;
      put(targets, 'thighL', swing * Math.sin(p) + 0.15 * run, 0, 0);
      put(targets, 'thighR', -swing * Math.sin(p) + 0.15 * run, 0, 0);
      put(targets, 'shinL', -knee * Math.max(0, Math.sin(p - 1.2)) - 0.2 * run, 0, 0);
      put(targets, 'shinR', -knee * Math.max(0, Math.sin(p + Math.PI - 1.2)) - 0.2 * run, 0, 0);
      const arms = 0.4 + 0.5 * run;
      put(targets, 'upperArmL', -arms * swing * Math.sin(p), 0, -0.08 - 0.1 * run);
      put(targets, 'upperArmR', arms * swing * Math.sin(p), 0, 0.08 + 0.1 * run);
      put(targets, 'foreArmL', 0.25 + 1.2 * run, 0, 0);
      put(targets, 'foreArmR', 0.25 + 1.2 * run, 0, 0);
      put(targets, 'spine', -0.2 * run, 0, 0);
      put(targets, 'head', 0.1 * run, 0, 0);
      g.position.y = (0.018 + 0.04 * run) * Math.abs(Math.cos(p));
    }
    if (this.sit > 0.01) {
      const s = this.sit;
      put(targets, 'thighL', 1.5 * s, 0, -0.06 * s);
      put(targets, 'thighR', 1.5 * s, 0, 0.06 * s);
      put(targets, 'shinL', -1.5 * s, 0, 0);
      put(targets, 'shinR', -1.5 * s, 0, 0);
      g.position.y -= (this.hip - SEAT) * s;
      // Seated, they sit a little back in the chair.
      g.position.x += Math.sin(view.heading) * 0.12 * s;
      g.position.z += Math.cos(view.heading) * 0.12 * s;
    }
    if (view.pitch) {
      // Their view's pitch (another player): most in the head, some in the neck.
      const pitch = THREE.MathUtils.clamp(view.pitch, -1.2, 1.2);
      targets.head[0] += pitch * 0.65;
      targets.neck[0] += pitch * 0.25;
    }
    if (look) {
      // The head (and the neck a little) turned towards what they look at, within reach.
      let yaw = Math.atan2(-(look.x - view.x), -(look.z - view.z)) - view.heading;
      yaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw), Math.cos(yaw)), -1.1, 1.1);
      targets.head[1] += yaw * 0.7;
      targets.neck[1] += yaw * 0.3;
    }

    if (this.spread > 0) {
      targets.upperArmR[2] += this.spread;
      targets.upperArmL[2] -= this.spread;
    }
    if (point && view.speed === 0 && this.sit < 0.5) {
      // A card to a reader, a pen on a board: the right hand.
      this.aim(
        targets,
        view.heading,
        point,
        view.card === true || view.paper === true || view.gesture === 'write',
      );
    }

    // Lit up while chosen (Phú, 2026-11-08): the outline swells and glows gold, pulsing.
    this.glow += ((view.called ? 1 : 0) - this.glow) * Math.min(1, dt * 6);
    if (this.glow > 0.001 || this.glowing) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 7);
      this.outline.color.lerpColors(INK, GLOW, this.glow * (0.75 + 0.25 * pulse));
      setOutlineWidth(this.outline, 0.0022 + this.glow * (0.0035 + 0.0012 * pulse));
      this.glowing = this.glow > 0.001;
    }

    const bones = this.model.bones;
    const ease = posing && this.strike < 1 ? Math.min(1, k * 2.2) : k;
    for (let i = 0; i < LIMBS.length; i++) {
      const name = LIMBS[i] as Limb;
      const euler = this.current.get(name);
      if (!euler) continue;
      const t = targets[name];
      euler.x += (t[0] - euler.x) * ease;
      euler.y += (t[1] - euler.y) * ease;
      euler.z += (t[2] - euler.z) * ease;
      bones[name].rotation.copy(euler);
    }
    // Fingers: curled towards the palm (+x left, −x right) by the pose or the gesture.
    const curl = curlOf(posing ? this.character.profile.pose : null, view.gesture);
    for (let i = 0; i < FINGERS.length; i++) {
      const finger = FINGERS[i];
      if (!finger) continue;
      const euler = this.current.get(finger.name);
      if (!euler) continue;
      const d = finger.digit;
      euler.z += (finger.sign * curl[d] * (d === 'thumb' ? 0.6 : 1.3) - euler.z) * k;
      bones[finger.name].rotation.copy(euler);
    }
    this.cloth.step(dt, SEAT * this.sit);
    for (let i = 0; i < this.props.length; i++) {
      const entry = this.props[i];
      if (entry) entry[1].visible = false;
    }
    for (let i = 0; i < this.props.length; i++) {
      const entry = this.props[i];
      if (entry && entry[0] === view.gesture) entry[1].visible = true;
    }
    if (this.keyCard) this.keyCard.visible = view.card === true;
    if (this.pen) this.pen.visible = (view.pen ?? null) !== null;
    if (view.pen) this.penInk?.color.set(view.pen === 'red' ? '#c62828' : '#1d3fa8');
  }

  /**
   * The arm on the point's side straight out at it. In the body's frame (it faces −z, its right
   * +x) the arm hangs down −y; turned by z = side·a it rises to that side, then by x = b forward:
   * it points along (side·sin a, −cos a·cos b, −cos a·sin b).
   */
  private aim(
    targets: Targets,
    heading: number,
    point: { readonly x: number; readonly y: number; readonly z: number },
    rightHand: boolean,
  ): void {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const across = (point.x - this.group.position.x) * c - (point.z - this.group.position.z) * s;
    const side = rightHand || across >= 0 ? 1 : -1;
    const at = this.model.bones[side === 1 ? 'upperArmR' : 'upperArmL'].getWorldPosition(
      this.shoulder,
    );
    const wx = point.x - at.x;
    const wy = point.y - at.y;
    const wz = point.z - at.z;
    const length = Math.hypot(wx, wy, wz) || 1;
    const dx = ((wx * c - wz * s) / length) * side;
    const dz = (wx * s + wz * c) / length;
    const dy = wy / length;
    const a = Math.asin(THREE.MathUtils.clamp(dx, -0.3, 1));
    const b = Math.atan2(-dz, -dy);
    arms(targets, side, b, 0, a, 0.08, 0, 0, 0, 0, -0.1);
  }

  dispose(): void {
    for (const mesh of [...this.model.meshes, this.model.shadows.body, this.model.shadows.coat]) {
      mesh.geometry.dispose();
    }
    for (const material of Object.values(this.materials)) material.dispose();
    for (const mesh of this.propParts) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.gradient.dispose();
    this.skinGradient.dispose();
    this.outline.dispose();
    // Its bones' texture (16 × 16 float, made when first drawn): leaked one per NPC made again.
    this.model.skeleton.dispose();
  }
}
