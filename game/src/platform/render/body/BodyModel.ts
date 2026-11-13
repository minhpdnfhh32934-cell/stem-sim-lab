import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACE_PICTURE } from './facePhoto';
import type {
  CharacterDefinition,
  Clothes,
  FaceShape,
  HAIR_STYLES,
  HairDesign,
} from '../../../gameplay/character';
import type { WornOn } from '../../../gameplay/item';
import { sculptHead } from './head';

/**
 * The player's body (Phase H-1), in the stylised look of Phú's references (2026-11-03): a large
 * head, big eyes with an iris and a highlight, hair in locks, clothes with a tie or a trimmed
 * collar, a knee-length lab coat open at the front with lapels and pockets. One skeleton;
 * rigid-skinned parts merged into one skinned mesh per surface and per layer, and a shadow-only
 * mesh (two, the coat's apart) so that the body costs one draw per shadow map. Proportions are
 * fractions of the height (the eyes at 0.93, as `eyeHeightOf`), widths from the character's data;
 * it faces −z (the camera at yaw 0), its feet at the origin, its eyes EYE_FORWARD in front of the
 * neck's axis. No shape reads `gender`: every difference is in the character's appearance data.
 * Each finger and the thumb bend at two joints (H-2), posed by the grip.
 * shortcut: rigid parts (no blended joints) in low-poly shapes; blend skin at the joints if the
 * creases show up close (a mirror at arm's length).
 */

/** What the player's own camera never draws (the head, the hair, the arms: H-1): mirrors do. */
export const SELF_LAYER = 6;
/** The body's shadow-only meshes: only the shadow maps draw them. */
export const SHADOW_LAYER = 7;

export type HairStyle = (typeof HAIR_STYLES)[number];

/** What is worn that changes the body's shape (C-10): sleeves, a jacket, the legs, shoes… */
export type Wear = Pick<
  Clothes,
  | 'sleeves'
  | 'crop'
  | 'jacket'
  | 'legs'
  | 'legwear'
  | 'footwear'
  | 'gloves'
  | 'choker'
  | 'bandage'
  | 'ripped'
  | 'logo'
  | 'blocks'
>;

/** Wear as before C-10: long sleeves, trousers, laced shoes, nothing more. */
export const PLAIN_WEAR: Wear = {
  sleeves: 'long',
  crop: false,
  jacket: 'none',
  legs: 'trousers',
  legwear: 'none',
  footwear: 'sneakers',
  gloves: 'none',
  choker: false,
  bandage: false,
  ripped: false,
  logo: false,
  blocks: false,
};

export interface BodyShape {
  readonly heightM: number;
  readonly shoulderM: number;
  readonly hipM: number;
  readonly waistM: number;
  readonly bustM: number;
  readonly build: number;
  readonly muscle: number;
  readonly watch: boolean;
  readonly earrings: boolean;
  readonly hair: HairStyle;
  readonly lashes: boolean;
  /** Rosy cheeks and a little smile. */
  readonly blush: boolean;
  /** An alluring face (C-10): half-lidded, flicked eyes, a side smile, a beauty mark. */
  readonly allure?: boolean;
  readonly neck: Clothes['neck'];
  readonly skirt: boolean;
  readonly glasses: 'none' | 'round' | 'square' | 'shades';
  readonly beard: boolean;
  /** The face's proportions (left out: the drawn face as it is) and the photo hairstyle's measures. */
  readonly face?: FaceShape;
  readonly hairDesign?: HairDesign;
  /** The face is a photo's picture (the material's), laid over it in place of the drawn eyes and mouth. */
  readonly facePhoto?: boolean;
  /** What else is worn (C-10); left out, `PLAIN_WEAR`. */
  readonly wear?: Wear;
}

/** The shape a character's appearance is drawn with. */
/** The photo hairstyle's measures when none are given (its schema's defaults). */
const PLAIN_HAIR: HairDesign = { length: 0.3, fringe: 0.6, parting: 0, volume: 0.4, curl: 0 };

/**
 * How far below the eyes (m) hair of `length` (0–1) reaches: past the ears (0.22) at their
 * height, the jaw (0.45), the shoulders (0.7), down the back (1); in between, in a straight line.
 */
export function hairBelowEye(length: number, k: number): number {
  const stops: readonly (readonly [number, number])[] = [
    [0.22, 0],
    [0.45, 0.08 * k],
    [0.7, 0.19],
    [1, 0.38],
  ];
  if (length <= 0.22) return 0;
  for (let j = 1; j < stops.length; j++) {
    const [l0, b0] = stops[j - 1] ?? [0, 0];
    const [l1, b1] = stops[j] ?? [1, 0.38];
    if (length <= l1) return b0 + ((b1 - b0) * (length - l0)) / (l1 - l0);
  }
  return 0.38;
}

/** The face as drawn (every proportion 1). */
const NO_FACE: FaceShape = {
  width: 1,
  length: 1,
  jaw: 1,
  chin: 1,
  eyeSize: 1,
  eyeSpacing: 1,
  nose: 1,
  mouth: 1,
};

export function bodyShapeOf(a: CharacterDefinition['appearance']): BodyShape {
  return {
    heightM: a.heightM,
    shoulderM: a.shoulderM,
    hipM: a.hipM,
    waistM: a.waistM,
    bustM: a.bustM,
    build: a.build,
    muscle: a.muscle,
    watch: a.watch,
    earrings: a.earrings,
    hair: a.hair,
    lashes: a.lashes,
    blush: a.blush,
    allure: a.allure,
    neck: a.clothes.neck,
    skirt: a.clothes.skirt,
    glasses: a.glasses,
    beard: a.beard,
    face: a.face,
    hairDesign: a.hairDesign,
    facePhoto: a.facePhoto !== undefined,
    wear: {
      sleeves: a.clothes.sleeves,
      crop: a.clothes.crop,
      jacket: a.clothes.jacket,
      legs: a.clothes.legs,
      legwear: a.clothes.legwear,
      footwear: a.clothes.footwear,
      gloves: a.clothes.gloves,
      choker: a.clothes.choker,
      bandage: a.clothes.bandage,
      ripped: a.clothes.ripped,
      logo: a.clothes.logo,
      blocks: a.clothes.blocks,
    },
  };
}

/** The digits, the thumb first; the fingers lie front (−z, the index) to back. */
export const DIGITS = ['thumb', 'index', 'middle', 'ring', 'little'] as const;
export type Digit = (typeof DIGITS)[number];
/** A digit's bones: 1 at its root knuckle, 2 at its middle joint. */
type DigitBone = `${Digit}${'L' | 'R'}${1 | 2}`;

/** Bones of the body and limbs, by name. Left is −x (the body faces −z). */
const LIMB_BONES = [
  'root',
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
] as const;
/**
 * The skirt's bones (C-5): eight round the waist, each swinging its panel of the lab coat's skirt or
 * a dress out and back (`Cloth`), numbered from the back (+z) round by the right (+x).
 */
export const SKIRT_BONES = [
  'skirt0',
  'skirt1',
  'skirt2',
  'skirt3',
  'skirt4',
  'skirt5',
  'skirt6',
  'skirt7',
] as const;
type SkirtBone = (typeof SKIRT_BONES)[number];
/** Skirt bone k's angle round the body (rad): x = r·sin, z = r·cos (0 behind, π in front). */
export const skirtAngle = (k: number) => (2 * Math.PI * k) / SKIRT_BONES.length;
export type BoneName = (typeof LIMB_BONES)[number] | DigitBone | SkirtBone;
/** Every bone: the limbs', the digits' (each hand's thumb to little finger, root first), the skirt's. */
export const BONES: readonly BoneName[] = [
  ...LIMB_BONES,
  ...(['L', 'R'] as const).flatMap((side) =>
    DIGITS.flatMap((d) => [`${d}${side}1`, `${d}${side}2`] as const),
  ),
  ...SKIRT_BONES,
];

/**
 * The fingers in the bind pose, index to little: z of the knuckle (front −z) and length (m).
 * The thumb starts in front of the palm's top and runs down the front.
 */
const FINGERS = [
  [-0.026, 0.07],
  [-0.009, 0.078],
  [0.008, 0.074],
  [0.024, 0.06],
] as const;
/** The palm's centre below the wrist (m, along the bind hand's −y: towards the fingers). */
export const PALM_DROP = 0.045;
/** The palm's half thickness (m, across it). */
export const PALM_HALF = 0.016;

/** The surfaces drawn: one material each (PPE pieces are shown only while worn). */
export const SURFACES = [
  'skin',
  'hands',
  'hair',
  'eyeWhite',
  'iris',
  'mouth',
  'blush',
  'top',
  'bottom',
  'shoes',
  'accent',
  'trim',
  'coat',
  // The coat's buttons, its pen and its badge's stripe: shown with the coat.
  'coatTrim',
  'goggles',
  'shield',
  // C-10: a jacket or vest, its stripes, zips and straps; tights or stockings; a bandage.
  'outer',
  'outerTrim',
  'legwear',
  'bandage',
  // The face from a photo (2026-11-12): its picture laid over the face.
  'photo',
] as const;
export type Surface = (typeof SURFACES)[number];

/** Which worn slot shows a surface (the rest are always shown). */
export const SHOWN_BY: Partial<Record<Surface, WornOn>> = {
  coat: 'body',
  coatTrim: 'body',
  goggles: 'eyes',
  shield: 'face',
};

/** The eyes in front of the neck's axis (m): the body stands this far behind the camera. */
export const EYE_FORWARD = 0.1;

export interface BodyModel {
  /** The root bone and the meshes, bound: place it at the feet, turned to the view. */
  readonly group: THREE.Group;
  readonly root: THREE.Bone;
  readonly bones: Readonly<Record<BoneName, THREE.Bone>>;
  readonly skeleton: THREE.Skeleton;
  /** Its drawn meshes, each tagged with its surface (`userData.surface`), the self-hidden ones on SELF_LAYER. */
  readonly meshes: readonly THREE.SkinnedMesh[];
  /** The shadow-only meshes: the body's, and the coat's (shown while it is worn). */
  readonly shadows: { readonly body: THREE.SkinnedMesh; readonly coat: THREE.SkinnedMesh };
  /** How the body is built, for what moves it (the arms' hang, the skirt's cloth). */
  readonly fit: BodyFit;
  /**
   * The anime outline (C-7), when an outline material was given: the body's and the coat's
   * (shown while it is worn), drawn from their shadow shapes, a little out and from inside.
   */
  readonly outlines: { readonly body: THREE.SkinnedMesh; readonly coat: THREE.SkinnedMesh } | null;
}

/** Measures of a built body that its animation needs. */
export interface BodyFit {
  /** How far out the arms hang (rad from straight down) to clear the body: bare, or in the coat. */
  readonly spread: { readonly bare: number; readonly coat: number };
  /** The thigh's radius at the top and the knee's (m). */
  readonly thighR: number;
  readonly kneeR: number;
  /** From the skirt's ring down to the coat's hem (m), and the hem's radius (m). */
  readonly skirtLength: number;
  readonly skirtHem: number;
}

interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly bone: BoneName;
  readonly surface: Surface;
  /** Hidden from the player's own eyes (H-1: the head, its hair and wear, the arms). */
  readonly self: boolean;
  /** Its skin weights, when not its bone's own blend (`BLEND`) or rigid on its bone. */
  readonly weigh?: Weigh;
  /** Its shade (0–1, by vertex colour): a fold drawn darker than its cloth (C-10). */
  readonly shade?: number;
  /** In the shadow and the outline though its surface is not (long gloves in the trim). */
  readonly shadow?: boolean;
}

/** A bone and its share of a vertex. */
type Influence = [BoneName, number];
/** A part's skin weights at a bind-pose point, pushed onto `out` (normalised later). */
type Weigh = (p: THREE.Vector3, out: Influence[]) => void;

/**
 * How a bone's parts bend at its joints (C-5): near its own joint they follow its parent half
 * way, near its child's joint the child half way, over `reach` (m) either side — the skin and the
 * cloth bend round an elbow or a knee instead of two rigid pieces crossing. The torso blends up
 * its chain the same way. Hands and feet blend only at the wrist and the ankle; the head, the
 * digits and the skirt's bones (their own weights) not at all.
 */
const BLEND: Partial<Record<BoneName, { parent?: BoneName; child?: BoneName; reach: number }>> = {
  hips: { child: 'spine', reach: 0.04 },
  spine: { parent: 'hips', child: 'chest', reach: 0.04 },
  chest: { parent: 'spine', child: 'neck', reach: 0.015 },
  neck: { parent: 'chest', child: 'head', reach: 0.02 },
  upperArmL: { parent: 'chest', child: 'foreArmL', reach: 0.035 },
  upperArmR: { parent: 'chest', child: 'foreArmR', reach: 0.035 },
  foreArmL: { parent: 'upperArmL', child: 'handL', reach: 0.025 },
  foreArmR: { parent: 'upperArmR', child: 'handR', reach: 0.025 },
  handL: { parent: 'foreArmL', reach: 0.012 },
  handR: { parent: 'foreArmR', reach: 0.012 },
  thighL: { parent: 'hips', child: 'shinL', reach: 0.045 },
  thighR: { parent: 'hips', child: 'shinR', reach: 0.045 },
  shinL: { parent: 'thighL', child: 'footL', reach: 0.04 },
  shinR: { parent: 'thighR', child: 'footR', reach: 0.04 },
  footL: { parent: 'shinL', reach: 0.02 },
  footR: { parent: 'shinR', reach: 0.02 },
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** A bone's own blend at its joints (`BLEND`), from the bind-pose joints; rigid without one. */
function blendOf(bone: BoneName, at: Record<BoneName, V3>): Weigh {
  const b = BLEND[bone];
  if (!b) return (_p, out) => void out.push([bone, 1]);
  const a = new THREE.Vector3(...at[bone]);
  const to = b.child ? new THREE.Vector3(...at[b.child]) : null;
  const from = b.parent ? new THREE.Vector3(...at[b.parent]) : null;
  const axis = to ? to.clone().sub(a) : a.clone().sub(from ?? a);
  const length = to ? axis.length() : 0;
  axis.normalize();
  const r = b.reach;
  const d = new THREE.Vector3();
  return (p, out) => {
    const s = d.subVectors(p, a).dot(axis);
    let wp = b.parent ? 1 - smooth(-r, r, s) : 0;
    let wc = b.child ? smooth(length - r, length + r, s) : 0;
    const total = wp + wc;
    if (total > 1) {
      wp /= total;
      wc /= total;
    }
    out.push([bone, 1 - wp - wc]);
    if (b.parent && wp > 0) out.push([b.parent, wp]);
    if (b.child && wc > 0) out.push([b.child, wc]);
  };
}

type V3 = readonly [number, number, number];

/** Bone positions in the bind pose, in the model (feet at the origin), by the build. */
function joints({ heightM: h, shoulderM: s, hipM: p }: BodyShape): Record<BoneName, V3> {
  const shoulder = s / 2 - 0.045;
  const hip = p * 0.27;
  const digits = {} as Record<DigitBone, V3>;
  for (const [side, sign] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    const wrist: V3 = [sign * (shoulder + 0.02), 0.483 * h, 0];
    for (const [d, [root, tip]] of digitLines(wrist, sign)) {
      digits[`${d}${side}1`] = root;
      digits[`${d}${side}2`] = mid(root, tip);
    }
  }
  return {
    ...digits,
    root: [0, 0, 0],
    hips: [0, 0.53 * h, 0],
    spine: [0, 0.6 * h, 0],
    chest: [0, 0.72 * h, 0],
    neck: [0, 0.84 * h, 0],
    head: [0, 0.89 * h, 0],
    upperArmL: [-shoulder, 0.815 * h, 0],
    foreArmL: [-shoulder - 0.012, 0.629 * h, 0],
    handL: [-shoulder - 0.02, 0.483 * h, 0],
    upperArmR: [shoulder, 0.815 * h, 0],
    foreArmR: [shoulder + 0.012, 0.629 * h, 0],
    handR: [shoulder + 0.02, 0.483 * h, 0],
    thighL: [-hip, 0.53 * h, 0],
    shinL: [-hip, 0.285 * h, 0],
    footL: [-hip, 0.04 * h, 0],
    thighR: [hip, 0.53 * h, 0],
    shinR: [hip, 0.285 * h, 0],
    footR: [hip, 0.04 * h, 0],
    ...skirtJoints(h, p),
  };
}

/** Where the skirt hangs from: its ring's height (of the height) and depth (of its width). */
export const SKIRT_Y = 0.575;
export const SKIRT_DEPTH = 0.75;
/** The skirt's ring radius for a hip width (m). */
export const skirtRing = (hipM: number) => (hipM / 2) * 0.92;

/** The skirt bones round the waist, on its ring (the panels pivot where they hang from). */
function skirtJoints(h: number, hipM: number): Record<SkirtBone, V3> {
  const r = skirtRing(hipM);
  const at = {} as Record<SkirtBone, V3>;
  SKIRT_BONES.forEach((name, k) => {
    const a = skirtAngle(k);
    at[name] = [r * Math.sin(a), SKIRT_Y * h, r * Math.cos(a) * SKIRT_DEPTH];
  });
  return at;
}

/** Each digit's root and tip in the bind pose, from its hand's wrist (`sign`: −1 left). */
function digitLines(wrist: V3, sign: number): [Digit, readonly [V3, V3]][] {
  const palm: V3 = [wrist[0], wrist[1] - PALM_DROP, 0];
  const thumb: [V3, V3] = [
    [palm[0] - sign * 0.004, palm[1] + 0.012, -0.03],
    [palm[0] - sign * 0.016, palm[1] - 0.045, -0.052],
  ];
  const fingers = FINGERS.map(([z, long]): [V3, V3] => [
    [palm[0], palm[1] - 0.035, z],
    [palm[0] - sign * 0.012, palm[1] - 0.035 - long, z * 1.1],
  ]);
  return DIGITS.map((d, i) => [d, i === 0 ? thumb : (fingers[i - 1] ?? thumb)]);
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

const DIGIT_PARENTS = Object.fromEntries(
  (['L', 'R'] as const).flatMap((side) =>
    DIGITS.flatMap((d) => [
      [`${d}${side}1`, `hand${side}`],
      [`${d}${side}2`, `${d}${side}1`],
    ]),
  ),
) as Record<DigitBone, BoneName>;

const PARENT: Record<BoneName, BoneName | null> = {
  ...DIGIT_PARENTS,
  root: null,
  hips: 'root',
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest',
  foreArmL: 'upperArmL',
  handL: 'foreArmL',
  upperArmR: 'chest',
  foreArmR: 'upperArmR',
  handR: 'foreArmR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
  ...(Object.fromEntries(SKIRT_BONES.map((name) => [name, 'hips'])) as Record<SkirtBone, 'hips'>),
};

const RADIAL = 20;

/**
 * A profile through its points as a smooth curve (Catmull-Rom), four steps between each two: a
 * waist, a calf or a hem curves instead of bending at a few corners.
 */
function curved(points: THREE.Vector2[], steps = 4): THREE.Vector2[] {
  if (points.length < 3) return points;
  // Centripetal: no dip or bulge between points far apart (a uniform spline sagged a dress
  // below the hips, through which the thighs showed).
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, p.y, 0)),
    false,
    'centripetal',
  );
  return curve.getPoints((points.length - 1) * steps).map((p) => new THREE.Vector2(p.x, p.y));
}
const basis = new THREE.Matrix4();

/** Merges `parts` (made along y from 0 up) and sets them from a to b, `depth` of their width deep. */
function along(a: V3, b: V3, parts: THREE.BufferGeometry[], depth: number) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const geometry = mergeGeometries(parts.map((g) => g.toNonIndexed().scale(1, 1, depth)));
  for (const g of parts) g.dispose();
  // Local y along a–b, local z (the flat side's normal) as near world z as it can be: a lock of
  // hair lies flat on the head whichever way it falls (a shortest-arc turn spun it at random).
  const y = to.clone().sub(from).normalize();
  const z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z);
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  basis.makeBasis(x, y, z);
  return geometry.applyMatrix4(basis).translate(from.x, from.y, from.z);
}

/** A tapered limb from a to b (radius ra at a, rb at b), its ends round. */
/** Segments round a tube of radius r: fewer for a thin one (a finger, a cord) than an arm. */
const round = (r: number) => Math.max(6, Math.min(RADIAL, Math.round(r * 520)));
const roundUp = (r: number) => Math.max(4, Math.min(8, Math.round(r * 220)));

function tube(a: V3, b: V3, ra: number, rb: number, depth = 1) {
  const length = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  return along(
    a,
    b,
    [
      new THREE.CylinderGeometry(rb, ra, length, round(ra), 1, true).translate(0, length / 2, 0),
      new THREE.SphereGeometry(ra, round(ra), roundUp(ra)),
      new THREE.SphereGeometry(rb, round(ra), roundUp(ra)).translate(0, length, 0),
    ],
    depth,
  );
}

/**
 * A surface of revolution about y through (radius, height) points, `depth` of its width deep; with
 * `gap` (rad), open at the front (−z) by that angle (a coat's opening).
 */
function lathe(
  points: readonly (readonly [number, number])[],
  depth: number,
  gap = 0,
  rises: readonly Rise[] = [],
) {
  // Finer where something rises out of it (a bust's round needs rows close together).
  const profile = curved(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    rises.some((r) => r.shape) ? 10 : 4,
  );
  // three's lathe sweeps from +z (phi 0) by sin and cos; the front (−z) is at phi π.
  const segments = rises.some((r) => r.shape) ? 72 : rises.length > 0 ? 48 : 40;
  // Closed, it starts behind (+z): its seam never runs down the front.
  const start = gap > 0 ? Math.PI + gap / 2 : 0;
  const geometry = new THREE.LatheGeometry(profile, segments, start, Math.PI * 2 - gap);
  geometry.scale(1, 1, depth);
  if (rises.length > 0) {
    // Indexed still: the normals come out smooth over the rise.
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      for (const rise of rises) {
        if (z >= 0 !== Boolean(rise.back)) continue;
        const k = riseOf(rise, p.getX(i), p.getY(i));
        if (k > 0) p.setZ(i, p.getZ(i) + (rise.back ? 1 : -1) * rise.out * k);
      }
    }
    geometry.computeVertexNormals();
  }
  return geometry.toNonIndexed();
}

/**
 * A smooth rise of a lathe's front (or its back), in two lobes `apart` either side of the middle:
 * `out` at height `y`, fading over `half` up and down and `width` across each lobe (a gentle dip
 * between them). The bust, a muscled chest, the seat.
 */
interface Rise {
  readonly y: number;
  readonly half: number;
  readonly apart: number;
  readonly width: number;
  readonly out: number;
  readonly back?: boolean;
  /** Its own shape (0–1 at x, y), in place of the two cosine lobes. */
  readonly shape?: (x: number, y: number) => number;
}

const riseOf = (rise: Rise, x: number, y: number) =>
  rise.shape ? rise.shape(x, y) : riseAt(rise, x, y);

/**
 * A bust's shape (C-6) under cloth, `drape` (0–1) how loosely the cloth hangs: the upper part a
 * gentle slope from under the collarbones to the fullest point, the lower part fuller and round,
 * curving back in to the fold under it; two lobes set a little apart and turned a little out, wider
 * on their outer side. A loose cloth (a blouse, a shirt) falls from the fullest point instead of
 * following the round under it, and bridges between the two; a knit follows more closely.
 */
function bustShape(h: number, bustM: number, drape: number) {
  const apex = 0.716 * h;
  const upper = 0.075 * h;
  const lower = 0.04 + bustM * 0.6;
  const apart = 0.05 + bustM * 0.25;
  return (x: number, y: number) => {
    let v: number;
    if (y >= apex) {
      const u = Math.min(1, (y - apex) / upper);
      v = (1 - u) * (1 - u) * (1 + 2 * u); // a smooth fall from the fullest point
    } else {
      const s = (apex - y) / lower;
      const round = s < 1 ? Math.sqrt(1 - s * s) : 0;
      const falls = Math.max(0, 1 - (apex - y) / (lower * 2.4));
      v = Math.max(round, drape * falls);
    }
    const q = Math.abs(x) - apart;
    const w = q >= 0 ? 0.088 : 0.058;
    const lobe = Math.abs(q) < w ? (1 - (q / w) ** 2) ** 2 : 0;
    // Between the two the cloth bridges across (more the looser it hangs).
    const across = Math.abs(x) < apart ? Math.max(lobe, 0.62 + 0.3 * drape) : lobe;
    return v * across;
  };
}

/** The rise's share (0–1) at x, y: a cosine bump up and down, each lobe rounded across. */
function riseAt(rise: Rise, x: number, y: number): number {
  const t = (y - rise.y) / rise.half;
  const across = (Math.abs(x) - rise.apart) / rise.width;
  if (Math.abs(t) >= 1 || Math.abs(across) >= 1) return 0;
  return ((1 + Math.cos(Math.PI * t)) / 2) * (1 - across * across) ** 2;
}

/** An ellipsoid of half-sizes (x, y, z) at c; `theta`: from the top down (a cap). */
function ellipsoid(c: V3, x: number, y: number, z: number, theta = Math.PI) {
  return new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, theta)
    .toNonIndexed()
    .scale(x, y, z)
    .translate(c[0], c[1], c[2]);
}

/** A box of size (x, y, z) at c, turned by `rz` about z (a brow's tilt, a lapel's slant). */
function block(c: V3, x: number, y: number, z: number, rz = 0, ry = 0) {
  return new THREE.BoxGeometry(x, y, z)
    .toNonIndexed()
    .rotateZ(rz)
    .rotateY(ry)
    .translate(c[0], c[1], c[2]);
}

/**
 * The turn (about y) that lays a flat piece on an elliptic section `depth` deep at (x, z) on its
 * front: a pocket or a badge following the chest round, not standing off it like a card.
 */
function lying(x: number, z: number, depth: number): number {
  return -Math.atan((depth * depth * x) / Math.max(1e-4, Math.abs(z)));
}

/**
 * A limb from a to b whose radius follows `profile` ([share of the length, radius], root first):
 * a calf, a biceps, a slim wrist; its ends round.
 */
function limb(a: V3, b: V3, profile: readonly (readonly [number, number])[], depth = 1) {
  const length = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  const r0 = profile[0]?.[1] ?? 0.03;
  const r1 = profile[profile.length - 1]?.[1] ?? r0;
  return along(
    a,
    b,
    [
      new THREE.LatheGeometry(
        curved(profile.map(([t, r]) => new THREE.Vector2(r, t * length))),
        round(r0),
      ),
      new THREE.SphereGeometry(r0, round(r0), roundUp(r0)),
      new THREE.SphereGeometry(r1, round(r0), roundUp(r0)).translate(0, length, 0),
    ],
    depth,
  );
}

/** A profile `out` (m) fuller all along: a sleeve over the arm. */
const over = (profile: readonly (readonly [number, number])[], out: number) =>
  profile.map(([t, r]) => [t, r + out] as const);

/** The back half (+z) of an ellipsoid's shell between two heights (theta from the top, fractions of π). */
function back(c: V3, x: number, y: number, z: number, from: number, to: number) {
  return new THREE.SphereGeometry(1, 20, 10, 0, Math.PI, Math.PI * from, Math.PI * (to - from))
    .toNonIndexed()
    .scale(x, y, z)
    .translate(c[0], c[1], c[2]);
}

// --- Clothes' shapes (C-10): parts of limbs, hems, and folds drawn the anime way.

/** How dark a fold is drawn (its cloth's colour times this). */
const FOLD = 0.6;

type Profile = readonly (readonly [number, number])[];

/** A profile's radius at share t (straight between its points). */
function radiusAt(profile: Profile, t: number): number {
  let r = profile[0]?.[1] ?? 0;
  for (let i = 1; i < profile.length; i++) {
    const [t0, r0] = profile[i - 1] ?? [0, r];
    const [t1, r1] = profile[i] ?? [1, r];
    if (t >= t0 && t <= t1) return t1 > t0 ? r0 + ((r1 - r0) * (t - t0)) / (t1 - t0) : r1;
    if (t > t1) r = r1;
  }
  return r;
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** The piece of a limb (a→b, `profile`) between shares t0 and t1, `out` m fuller: a sleeve's. */
function segment(a: V3, b: V3, profile: Profile, t0: number, t1: number, out = 0) {
  const steps = 4;
  const piece = Array.from({ length: steps + 1 }, (_, i): readonly [number, number] => {
    const t = t0 + ((t1 - t0) * i) / steps;
    return [i / steps, radiusAt(profile, t) + out];
  });
  return limb(lerp3(a, b, t0), lerp3(a, b, t1), piece);
}

/** An open band round a limb (a→b) from share t0 to t1, radius r0 to r1: a hem, a cuff, a strap. */
function band(a: V3, b: V3, t0: number, t1: number, r0: number, r1: number) {
  const p0 = lerp3(a, b, t0);
  const p1 = lerp3(a, b, t1);
  const length = new THREE.Vector3(...p0).distanceTo(new THREE.Vector3(...p1));
  return along(
    p0,
    p1,
    [new THREE.CylinderGeometry(r1, r0, length, round(r0), 1, true).translate(0, length / 2, 0)],
    1,
  );
}

/**
 * A thin strip lying on a surface, its points from `at(u)` (u 0 to 1) with the outward normal
 * `normal(u)`, `width` across (tapering to points at its ends: a fold, a pleat).
 */
function strip(
  at: (u: number) => THREE.Vector3,
  across: (u: number) => THREE.Vector3,
  normal: (u: number) => THREE.Vector3,
  width: number,
  n = 10,
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = at(u);
    const w = (width / 2) * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.85));
    const d = across(u).normalize().multiplyScalar(w);
    const q = normal(u).normalize();
    positions.push(p.x - d.x, p.y - d.y, p.z - d.z, p.x + d.x, p.y + d.y, p.z + d.z);
    normals.push(q.x, q.y, q.z, q.x, q.y, q.z);
    if (i < n) {
      const k = i * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * A fold round a limb (a→b, `profile`) at share t, over the turn `from`–`to` (rad; π its
 * front, as a lathe's), running `tilt` of its length along across that turn: a crease at an
 * elbow, cloth bunched at an ankle.
 */
function fold(
  a: V3,
  b: V3,
  profile: Profile,
  t: number,
  from: number,
  to: number,
  tilt = 0,
  width = 0.004,
) {
  const length = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  const share = (u: number) => THREE.MathUtils.clamp(t + tilt * (u - 0.5), 0, 1);
  const phi = (u: number) => from + (to - from) * u;
  const geometry = strip(
    (u) => {
      const r = radiusAt(profile, share(u)) + 0.0016;
      return new THREE.Vector3(r * Math.sin(phi(u)), share(u) * length, r * Math.cos(phi(u)));
    },
    () => new THREE.Vector3(0, 1, 0),
    (u) => new THREE.Vector3(Math.sin(phi(u)), 0, Math.cos(phi(u))),
    width,
  );
  return along(a, b, [geometry], 1);
}

/**
 * A fold round a torso's lathe (its radius `r(y)`, `depth` deep) at height y, over the turn
 * `from`–`to`, rising `rise` (m) across it.
 */
function ringFold(
  r: (y: number) => number,
  depth: number,
  y: number,
  from: number,
  to: number,
  rise = 0,
  width = 0.004,
) {
  const height = (u: number) => y + rise * (u - 0.5);
  const phi = (u: number) => from + (to - from) * u;
  return strip(
    (u) => {
      const radius = r(height(u)) + 0.0018;
      return new THREE.Vector3(
        radius * Math.sin(phi(u)),
        height(u),
        radius * Math.cos(phi(u)) * depth,
      );
    },
    () => new THREE.Vector3(0, 1, 0),
    (u) => new THREE.Vector3(Math.sin(phi(u)) * depth, 0, Math.cos(phi(u))),
    width,
  ).toNonIndexed();
}

/** A line down a lathe (radius `r(y)`, `depth` deep) at the turn `phi` from y0 to y1: a pleat. */
function lineDown(
  r: (y: number) => number,
  depth: number,
  phi: number,
  y0: number,
  y1: number,
  width = 0.004,
) {
  const height = (u: number) => y0 + (y1 - y0) * u;
  return strip(
    (u) => {
      const radius = r(height(u)) + 0.0018;
      return new THREE.Vector3(radius * Math.sin(phi), height(u), radius * Math.cos(phi) * depth);
    },
    () => new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi) * depth),
    () => new THREE.Vector3(Math.sin(phi) * depth, 0, Math.cos(phi)),
    width,
  ).toNonIndexed();
}

/** A line along a limb (a→b, `profile`) at the turn `phi` from share t0 to t1: a stripe, a zip. */
function lineAlong(
  a: V3,
  b: V3,
  profile: Profile,
  phi: number,
  t0: number,
  t1: number,
  width = 0.004,
) {
  const length = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  const share = (u: number) => t0 + (t1 - t0) * u;
  const geometry = strip(
    (u) => {
      const r = radiusAt(profile, share(u)) + 0.0016;
      return new THREE.Vector3(r * Math.sin(phi), share(u) * length, r * Math.cos(phi));
    },
    () => new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi)),
    () => new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)),
    width,
  );
  return along(a, b, [geometry], 1);
}

/** A lathe's radius at height y from its (radius, height) points, bottom first. */
const radiusOf =
  (points: readonly (readonly [number, number])[]) =>
  (y: number): number => {
    let r = points[0]?.[0] ?? 0;
    for (let i = 1; i < points.length; i++) {
      const [r0, y0] = points[i - 1] ?? [r, 0];
      const [r1, y1] = points[i] ?? [r, 0];
      if (y >= y0 && y <= y1) return y1 > y0 ? r0 + ((r1 - r0) * (y - y0)) / (y1 - y0) : r1;
      if (y > y1) r = r1;
    }
    return r;
  };

/** The body's parts in the bind pose. */
function partsOf(shape: BodyShape): { parts: Part[]; fit: BodyFit } {
  const h = shape.heightM;
  const j = joints(shape);
  const out: Part[] = [];
  const add = (
    bone: BoneName,
    surface: Surface,
    self: boolean,
    geometry: THREE.BufferGeometry,
    weigh?: Weigh,
  ) =>
    out.push(weigh ? { bone, surface, self, geometry, weigh } : { bone, surface, self, geometry });
  /** A fold: the part drawn at `FOLD` of its cloth's colour. */
  const crease = (
    bone: BoneName,
    surface: Surface,
    geometry: THREE.BufferGeometry,
    weigh?: Weigh,
  ) => out.push({ bone, surface, self: false, geometry, shade: FOLD, ...(weigh ? { weigh } : {}) });
  const hipsBlend = blendOf('hips', j);
  const scaled: Influence[] = [];
  /** The hips' own blend, its shares times `k`. */
  const hipsTimes = (p: THREE.Vector3, k: number, into: Influence[]) => {
    scaled.length = 0;
    hipsBlend(p, scaled);
    for (const [bone, w] of scaled) into.push([bone, w * k]);
  };
  // The trousers' seat and crotch: their lower part goes with each thigh, half way, so a leg
  // swinging or sitting bends the cloth over the hip instead of poking out of it.
  const hipJoint = shape.hipM * 0.27;
  const pelvisWeigh: Weigh = (p, into) => {
    const w = 0.55 * smooth(0.535 * h, 0.47 * h, p.y) * smooth(0.01, hipJoint, Math.abs(p.x));
    hipsTimes(p, 1 - w, into);
    into.push([p.x < 0 ? 'thighL' : 'thighR', w]);
  };
  // A skirt's panels (the coat's, a dress's): with the hips at the waist, then more and more
  // their two nearest skirt bones' lower down (`Cloth` swings them).
  const skirtTop = SKIRT_Y * h;
  const skirtWeigh: Weigh = (p, into) => {
    const s = smooth(0, 0.14, skirtTop - p.y);
    hipsTimes(p, 1 - s, into);
    if (s <= 0) return;
    const n = SKIRT_BONES.length;
    const turn = Math.atan2(p.x, p.z / SKIRT_DEPTH) / (2 * Math.PI);
    const f = (((turn % 1) + 1) % 1) * n;
    const k0 = Math.floor(f) % n;
    const t = f - Math.floor(f);
    into.push([SKIRT_BONES[k0] ?? 'skirt0', s * (1 - t)]);
    into.push([SKIRT_BONES[(k0 + 1) % n] ?? 'skirt0', s * t]);
  };
  const shoulders = shape.shoulderM / 2;
  const hips = shape.hipM / 2;
  const waist = shape.waistM / 2;
  const g = shape.build;
  const m = shape.muscle;
  /** Fuller hips and seat than the waist asks (a curvy figure): m more at the seat. */
  const seat = Math.max(0, shape.hipM - shape.waistM - 0.07) * 0.35;
  /**
   * How curved the figure is (0–1, from how much wider the hips are than the waist; Phú: a
   * woman's waist and bust beautiful and in proportion): the ribs widening up from a waist
   * narrowest at the navel, the hips flaring out from it gradually (an hourglass, not a bell).
   */
  const curve = THREE.MathUtils.clamp((shape.hipM - shape.waistM - 0.05) / 0.1, 0, 1);
  // C-10: what is worn. A dress covers the legs (its tights in `bottom`); trousers are the
  // bottom's; shorts and a pleated skirt leave the legs bare, in tights or stockings if worn.
  const w = shape.wear ?? PLAIN_WEAR;
  const dress = shape.skirt;
  const trousers = !dress && (w.legs === 'trousers' || w.legs === 'joggers' || w.legs === 'cargo');
  const bareLegs = !dress && !trousers;
  /** A part in the shadow and the outline though its surface is not (gloves, colour blocks). */
  /** How much roomier the lab coat is over a jacket or a vest (so it never shows through). */
  const layer = w.jacket === 'none' ? 0 : w.jacket === 'sweaterVest' ? 0.004 : 0.009;
  /** Whether a jacket's sleeves are under the coat's. */
  const sleeved = w.jacket === 'zip' || w.jacket === 'cropped';
  const solid = (bone: BoneName, surface: Surface, geometry: THREE.BufferGeometry) =>
    out.push({ bone, surface, self: false, geometry, shadow: true });

  // --- Head (C-7): drawn in the anime style — a head a little large for the body (about a sixth
  // and a half of the height), a smooth face, big drawn eyes, a small nose and mouth. Men and women
  // are drawn apart by their data (`lashes`: a soft face): a man's eyes narrower and longer under
  // straight, heavy brows, a firm jaw and chin; a woman's eyes large and round with long lashes,
  // fine arched brows, round cheeks, a small pointed chin. Heads differ far less than heights.
  const soft = shape.lashes;
  const allure = shape.allure === true;
  const eyeY = 0.93 * h;
  const k = (1.72 + (h - 1.72) * 0.3) / 1.72;
  // The face's own proportions (a face made from a photo; all 1 otherwise).
  const f = shape.face ?? NO_FACE;
  const W = (soft ? 0.08 : 0.083) * k * f.width;
  const Hy = ((0.112 * k) / 0.82) * f.length;
  const D = 0.094 * k;
  const cranium: [V3, number, number, number] = [[0, eyeY + 0.036 * k, 0.004], W, Hy * 0.82, D];
  const jaw: [V3, number, number, number] = [
    [0, eyeY - 0.038 * k * f.length, -0.012],
    W * (soft ? 0.7 : 0.78) * f.jaw,
    Hy * (soft ? 0.52 : 0.57) * f.chin,
    D * 0.8,
  ];
  const nose = eyeY - 0.037 * k * f.nose * f.length;
  const mouth = eyeY - 0.062 * k * f.mouth * f.length;
  const eyeScale = k * f.eyeSize;
  const eye = {
    x: (soft ? 0.0315 : 0.031) * k * f.eyeSpacing * f.width,
    y: eyeY - 0.002 * k,
    // Alluring: a longer eye under a lower, flatter lid (half-lidded).
    halfWidth: (allure ? 0.0224 : soft ? 0.0215 : 0.0192) * eyeScale,
    upper: (allure ? (soft ? 0.0142 : 0.0094) : soft ? 0.0172 : 0.0102) * eyeScale,
    lower: (soft ? 0.0098 : 0.0062) * eyeScale,
    radius: 0.0124 * k * Math.min(1.12, f.eyeSize),
  };
  const head = sculptHead({
    cranium: { c: cranium[0], r: [cranium[1], cranium[2], cranium[3]] },
    jaw: { c: jaw[0], r: [jaw[1], jaw[2], jaw[3]] },
    eyeY,
    noseY: nose,
    mouthY: mouth,
    eye,
    soft,
    anime: true,
  });
  add('head', 'skin', true, head.geometry);
  const front = head.front;
  for (const s of [-1, 1]) {
    // A simple ear and its lobe (an earring at the lobe).
    const ear: V3 = [s * W * 0.96, eyeY - 0.012 * k, 0.012];
    add('head', 'skin', true, ellipsoid(ear, 0.007, 0.025 * k, 0.015));
    const lobe: V3 = [ear[0] + s * 0.001, ear[1] - 0.022 * k, ear[2] - 0.003];
    add('head', 'skin', true, ellipsoid(lobe, 0.005, 0.007, 0.006));
    if (shape.earrings) {
      add(
        'head',
        'eyeWhite',
        true,
        ellipsoid([lobe[0] + s * 0.003, lobe[1] - 0.005, lobe[2] - 0.002], 0.003, 0.003, 0.003),
      );
    }
  }
  const neckR = (soft ? 0.039 : 0.046) * (0.75 + 0.25 * g) + 0.008 * m;
  add(
    'neck',
    'skin',
    true,
    limb(
      [0, 0.82 * h, 0.006],
      [0, eyeY - 0.055 * k, 0.014],
      [
        [0, neckR + 0.004],
        [0.35, neckR],
        [1, neckR - 0.003],
      ],
    ),
  );
  if (m > 0) {
    // The muscles from the neck down to the shoulders (the trapezius), under the collar (and
    // under a jacket's or a vest's shoulders, in its cloth).
    const cover = w.jacket === 'none' ? 0 : 0.006;
    for (const s of [-1, 1]) {
      add(
        'chest',
        cover > 0 ? 'outer' : 'top',
        false,
        tube(
          [s * 0.03, 0.835 * h, 0.012],
          [s * (shoulders - 0.06), 0.815 * h, 0.01],
          0.03 * m + 0.01 + cover,
          0.026 * m + 0.01 + cover,
          0.8,
        ),
      );
    }
  }

  if (shape.facePhoto) {
    // The face from a photo (Phú 2026-11-12): its picture over the face, the picture's eyes on the
    // drawn eyes' places and its mouth on the mouth's (`FACE_PICTURE`). The photo's left is the
    // face's right: +x, seen from the front.
    const sx = (2 * eye.x) / (1 - 2 * FACE_PICTURE.eyeU); // m across the picture
    const sy = (eye.y - mouth) / (FACE_PICTURE.mouthV - FACE_PICTURE.eyeV); // m down it
    const xOf = (u: number) => (0.5 - u) * sx;
    const yOf = (v: number) => eye.y - (v - FACE_PICTURE.eyeV) * sy;
    const sheet = head.grid(xOf(0.12), xOf(0.88), yOf(0.06), yOf(0.96), 0.0006);
    const position = sheet.getAttribute('position');
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      uv[i * 2] = 0.5 - position.getX(i) / sx;
      // Texture rows run from the bottom.
      uv[i * 2 + 1] = 1 - (FACE_PICTURE.eyeV + (eye.y - position.getY(i)) / sy);
    }
    sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    add('head', 'photo', true, sheet);
  }
  if (!shape.facePhoto) {
    // The mouth: a small line, a woman's a little fuller and rosy, smiling with `blush`.
    // Alluring: wider and fuller, its lower lip drawn, one corner up (a side smile).
    const smile = shape.blush ? 0.0022 : 0.0004;
    const mw = (soft ? 0.0072 : 0.0088) * k * (allure ? 1.08 : 1);
    const left = allure ? 0.0006 : smile;
    const right = allure ? 0.0028 : smile;
    add(
      'head',
      'mouth',
      true,
      head.ribbon(
        [
          [-mw, mouth + left],
          [-mw * 0.5, mouth + left * 0.2],
          [0, mouth],
          [mw * 0.5, mouth + right * 0.25],
          [mw, mouth + right],
        ],
        allure ? 0.0017 : soft ? 0.0011 : 0.0006,
        0.0008,
      ),
    );
    if (allure) {
      add(
        'head',
        'mouth',
        true,
        head.patch(mw * 0.08, mouth - 0.0028 * k, mw * 0.62, 0.0017 * k, 0.0006),
      );
      // A beauty mark under the left eye's outer corner.
      add(
        'head',
        'trim',
        true,
        head.patch(-(0.0315 + 0.014) * k, eyeY - 0.019 * k, 0.0009, 0.0009, 0.0007),
      );
    }

    // The eyes, drawn: the white (almond, the outer corner a little up on a soft face), a big iris
    // up under the lid, the pupil, two lights; the upper lash line heavy (and flicked out, with
    // lashes), a fine lower line at the outer half; the brows.
    for (const s of [-1, 1]) {
      const cx = s * eye.x;
      const cy = eye.y;
      const tilt = (allure ? 0.0034 : soft ? 0.0016 : 0.0006) * k;
      /** The white's edges at u (−1 the inner corner, 1 the outer). */
      const upperAt = (u: number) =>
        cy +
        eye.upper *
          Math.pow(Math.max(0, 1 - u * u), allure ? 0.62 : soft ? 0.42 : 0.55) *
          (1 - 0.12 * u) +
        tilt * u;
      const lowerAt = (u: number) =>
        cy - eye.lower * Math.pow(Math.max(0, 1 - u * u), 0.6) + tilt * u;
      const xAt = (u: number) => cx + s * u * eye.halfWidth;
      const uAt = (x: number) => (s * (x - cx)) / eye.halfWidth;
      const z = 0.0007;
      add(
        'head',
        'eyeWhite',
        true,
        head.drawn(
          [cx, cy],
          (t) => {
            // Round the outline: along the top from the outer corner to the inner, back along the bottom.
            const u = t < 0.5 ? 1 - 4 * t : -1 + 4 * (t - 0.5);
            return [xAt(u), t < 0.5 ? upperAt(u) : lowerAt(u)];
          },
          z,
        ),
      );
      /** An ellipse inside the white (an iris, a pupil): kept within its edges. */
      const inWhite = (ex: number, ey: number, rx: number, ry: number) => (t: number) => {
        const a = t * Math.PI * 2;
        const x = ex + rx * Math.cos(a);
        const u = Math.max(-0.98, Math.min(0.98, uAt(x)));
        const y = Math.max(
          lowerAt(u) + 0.0003,
          Math.min(upperAt(u) - 0.0003, ey + ry * Math.sin(a)),
        );
        return [xAt(u), y] as const;
      };
      const irisX = cx - s * 0.0006 * k;
      const irisY = cy - 0.0012 * k;
      const rx = (soft ? 0.0118 : 0.0092) * k;
      const ry = (soft ? 0.0158 : 0.0108) * k;
      add('head', 'iris', true, head.drawn([irisX, irisY], inWhite(irisX, irisY, rx, ry), z * 2));
      add(
        'head',
        'trim',
        true,
        head.drawn(
          [irisX, irisY + 0.0008],
          inWhite(irisX, irisY + 0.0008, rx * 0.46, ry * 0.5),
          z * 3,
        ),
      );
      const big = (soft ? 0.0029 : 0.0021) * k;
      add(
        'head',
        'eyeWhite',
        true,
        head.patch(irisX - s * 0.0032 * k, irisY + ry * 0.36, big, big, z * 4),
      );
      add(
        'head',
        'eyeWhite',
        true,
        head.patch(irisX + s * 0.0036 * k, irisY - ry * 0.42, big * 0.45, big * 0.45, z * 4),
      );
      // The upper lash line: heavier towards the outer corner; flicked out with lashes.
      const lash: [number, number][] = [];
      for (let j = 0; j <= 12; j++) {
        const u = -1 + (2 * j) / 12;
        lash.push([xAt(u), upperAt(u) + 0.0004]);
      }
      if (allure) {
        // A long wing out and up from the outer corner.
        lash.push([xAt(1) + s * 0.0042 * k, upperAt(1) + 0.0026 * k]);
        lash.push([xAt(1) + s * 0.0068 * k, upperAt(1) + 0.0048 * k]);
      } else if (soft) {
        lash.push([xAt(1) + s * 0.0035 * k, upperAt(1) + 0.0032 * k]);
      }
      const heavy = (allure ? 0.0025 : soft ? 0.0019 : 0.0015) * k;
      // Lash lines in the hair's colour; an alluring face's in a dark liner (a pale hair's lashes
      // would not frame the eye).
      const liner: Surface = allure ? 'trim' : 'hair';
      add(
        'head',
        liner,
        true,
        head.ribbon(lash, (t) => heavy * (0.45 + 0.75 * t) * (t > 0.97 ? 0.5 : 1), z * 5),
      );
      const low: [number, number][] = [];
      for (let j = 0; j <= 6; j++) {
        const u = 0.05 + (0.9 * j) / 6;
        low.push([xAt(u), lowerAt(u) - 0.0003]);
      }
      add(
        'head',
        liner,
        true,
        head.ribbon(low, (t) => (allure ? 0.0009 : soft ? 0.0006 : 0.0004) * k * (0.4 + t), z * 5),
      );
      if (allure) {
        // Two lashes flicked out at the outer corner, above the wing.
        for (const [dx, dy] of [
          [0.0036, 0.0046],
          [0.0018, 0.0052],
        ] as const) {
          const root: [number, number] = [xAt(0.8), upperAt(0.8) + 0.0004];
          add(
            'head',
            liner,
            true,
            head.ribbon(
              [root, [root[0] + s * dx * k, root[1] + dy * k]],
              (t) => 0.0009 * k * (1 - 0.8 * t),
              z * 5,
            ),
          );
        }
      }
      // The brow: a fine arch (soft), or straight, heavy and drawn down a little at the inner end.
      const brow: [number, number][] = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        const x = cx + s * (-0.015 + 0.034 * t) * k;
        const y = soft
          ? cy +
            eye.upper +
            (allure ? 0.0094 : 0.0072) * k +
            0.0035 * k * Math.sin(Math.PI * Math.min(1, t * 1.25)) +
            (allure ? 0.0012 * k * t : 0)
          : cy + eye.upper + 0.0078 * k + 0.0022 * k * t - 0.0012 * k * t * t;
        brow.push([x, y]);
      }
      const thick = (soft ? 0.0011 : 0.0024) * k;
      add(
        'head',
        'hair',
        true,
        head.ribbon(brow, (t) => thick * (soft ? 1 - 0.6 * t : 1 - 0.35 * t), 0.0009),
      );
      if (shape.blush) {
        add(
          'head',
          'blush',
          true,
          head.patch(s * 0.04 * k, eyeY - 0.03 * k, 0.012, 0.0055, 0.0005),
        );
      }
    }
  }

  // --- Hair (C-7, anime): the scalp's hair above its hairline, then the style in locks — each a
  // flattened, curving lock tapering to a point, the way anime draws hair: a fringe over the
  // forehead, locks framing the face, spikes, a tail; a bob or long hair hanging as a mass.
  const crown: V3 = cranium[0];
  const skullTop = crown[1] + Hy * 0.82;
  /** Thickness growing from the sides (`side`, m) to the top (`crownT`, m). */
  const layered = (side: number, crownT: number) => (_x: number, y: number) =>
    side + (crownT - side) * smooth(eyeY + 0.02, skullTop - 0.01, y);
  const menLine = { front: 0.07 * k, temple: 0.052 * k, side: 0.026 * k, nape: -0.066 * k };
  const womenLine = { front: 0.07 * k, temple: 0.056 * k, side: 0.028 * k, nape: -0.07 * k };
  const top = skullTop + 0.012;
  /** The middle the locks lean out from. */
  const centre: V3 = [0, eyeY + 0.012, 0.004];
  /** A point on the scalp: theta from the top, phi round from the back by the right, `out` m off. */
  const onScalp = (theta: number, phi: number, out: number): V3 => {
    const n: V3 = [
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi),
    ];
    return [
      crown[0] + n[0] * (W + out),
      crown[1] + n[1] * (Hy * 0.82 + out),
      crown[2] + n[2] * (D + out),
    ];
  };
  /**
   * A lock from `root` to a pointed `tip`, `width` (m) wide at its root, bowing `bulge` (m) out from
   * the head on its way, `flat` of its width thick.
   */
  const strand = (root: V3, tip: V3, width: number, bulge = 0.014, flat = 0.42) => {
    const mid = new THREE.Vector3(...root).add(new THREE.Vector3(...tip)).multiplyScalar(0.5);
    const out = mid
      .clone()
      .sub(new THREE.Vector3(...centre))
      .normalize();
    const ctrl = mid.addScaledVector(out, bulge);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...root),
      ctrl,
      new THREE.Vector3(...tip),
    );
    const n = 10;
    const ring = 6;
    const pos: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const c = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const away = c.clone().sub(new THREE.Vector3(...centre));
      const normal = away.addScaledVector(tangent, -away.dot(tangent)).normalize();
      const across = new THREE.Vector3().crossVectors(tangent, normal);
      const w = width * Math.pow(1 - t, 0.85) + 0.0004;
      for (let j = 0; j < ring; j++) {
        const a = (j / ring) * Math.PI * 2;
        const p = c
          .clone()
          .addScaledVector(across, Math.cos(a) * w)
          .addScaledVector(normal, Math.sin(a) * w * flat);
        pos.push(p.x, p.y, p.z);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * ring + j;
        const b = i * ring + ((j + 1) % ring);
        idx.push(a, a + ring, b, b, a + ring, b + ring);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const flatGeometry = g.toNonIndexed();
    g.dispose();
    return flatGeometry;
  };
  const lockAt = (root: V3, tip: V3, width: number, bulge?: number, flat?: number) =>
    add('head', 'hair', true, strand(root, tip, width, bulge, flat));
  /**
   * A fringe: `count` locks rooted across the front of the scalp from x0 to x1 (at `theta`), their
   * tips at `tipY(x)` swept `sweep` (m) to the right, each `width` wide.
   */
  const fringe = (
    count: number,
    x0: number,
    x1: number,
    tipY: (x: number, i: number) => number,
    sweep: number,
    width: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const x = x0 + (x1 - x0) * u;
      const phi = Math.PI - Math.asin(Math.max(-0.9, Math.min(0.9, x / (W * 0.95))));
      const root = onScalp(0.55, phi, 0.006);
      const tx = x * 1.08 + sweep;
      const ty = tipY(x, i);
      lockAt(root, [tx, ty, front(tx, ty) - 0.006], width, 0.016);
    }
  };
  const tuft = (c: V3, r: number, ry = r) =>
    new THREE.SphereGeometry(1, 10, 8).toNonIndexed().scale(r, ry, r).translate(c[0], c[1], c[2]);
  const brows = eyeY + 0.03 * k;

  if (shape.hair === 'spiky') {
    // A shōnen hero's spikes: a jagged fringe to the brows swept a little aside, spikes up and back
    // off the crown, short locks over the ears and at the nape.
    add('head', 'hair', true, head.scalp({ ...menLine, sideburns: true }, layered(0.006, 0.016)));
    fringe(
      6,
      -0.05 * k,
      0.05 * k,
      (x, i) => brows - 0.004 + (i % 2) * 0.012 - 2 * x * x,
      0.008,
      0.026,
    );
    for (let i = 0; i < 9; i++) {
      const phi = Math.PI * 0.35 + (i / 8) * Math.PI * 1.3; // round the top and back
      const theta = 0.35 + 0.22 * (i % 3);
      const root = onScalp(theta, phi, 0.004);
      const dir = new THREE.Vector3(...root).sub(new THREE.Vector3(...centre)).normalize();
      const len = 0.05 + 0.018 * ((i * 7) % 3);
      lockAt(
        root,
        [root[0] + dir.x * len, root[1] + dir.y * len * 0.6 + 0.008, root[2] + dir.z * len + 0.03],
        0.028,
        0.01,
        0.5,
      );
    }
    for (const s of [-1, 1]) {
      lockAt(
        onScalp(1.0, Math.PI - s * 1.35, 0.004),
        [s * W * 1.02, eyeY - 0.002, 0.004],
        0.014,
        0.006,
      );
    }
    for (const phi of [-0.35, 0, 0.35]) {
      lockAt(
        onScalp(1.55, phi, 0.004),
        [Math.sin(phi) * W, eyeY - 0.06 * k, D * 0.98],
        0.016,
        0.008,
      );
    }
  } else if (shape.hair === 'short') {
    // Short and neat: a crew cut, the front pushed up in short points.
    add('head', 'hair', true, head.scalp({ ...menLine, sideburns: true }, layered(0.004, 0.011)));
    for (let i = 0; i < 6; i++) {
      const x = (-0.045 + (0.09 * i) / 5) * k;
      const phi = Math.PI - Math.asin(x / (W * 0.95));
      const root = onScalp(0.62, phi, 0.004);
      lockAt(root, [x * 1.05, root[1] + 0.02, root[2] + 0.004], 0.012, 0.004, 0.5);
    }
  } else if (shape.hair === 'sidePart') {
    // A neat side part: the fringe swept from the parting on the left across to the right temple,
    // the sides tidy, locks over the ears.
    add('head', 'hair', true, head.scalp({ ...menLine, sideburns: true }, layered(0.006, 0.014)));
    for (let i = 0; i < 5; i++) {
      const root = onScalp(0.42 + i * 0.07, Math.PI + 0.35, 0.006);
      const tx = (0.012 + 0.012 * i) * k;
      const ty = brows + 0.012 - 0.003 * i;
      lockAt(root, [tx, ty, front(tx, ty) - 0.007], 0.02, 0.02);
    }
    for (const s of [-1, 1]) {
      lockAt(
        onScalp(1.0, Math.PI - s * 1.3, 0.004),
        [s * W * 1.02, eyeY + 0.004, 0.004],
        0.013,
        0.006,
      );
    }
  } else if (shape.hair === 'curly') {
    // Thick curls: a full head of round curls, a curly fringe over the forehead.
    add('head', 'hair', true, head.scalp({ ...menLine, sideburns: true }, layered(0.01, 0.022)));
    for (let i = 0; i < 70; i++) {
      const y = 1 - (i + 0.5) / 70;
      const theta = Math.acos(y) * 1.25;
      const phi = i * 2.39996;
      const at = onScalp(theta, phi, 0.016 - 0.006 * smooth(0.9, 1.6, theta));
      const a = Math.abs(Math.atan2(at[0], -at[2]));
      const line = eyeY + (a < 1.2 ? 0.072 : a < 2 ? 0.032 : -0.05) * k;
      if (at[1] < line) continue;
      add('head', 'hair', true, tuft(at, 0.016 + 0.004 * ((i * 0.37) % 1)));
    }
    for (const x of [-0.04, -0.013, 0.013, 0.04]) {
      const y = brows + 0.016 * k;
      add('head', 'hair', true, tuft([x * k, y, front(x * k, y) - 0.012], 0.015, 0.013));
    }
  } else if (shape.hair === 'bob') {
    // A bob to the jaw, turned under; a full fringe to the brows; a lock either side framing the
    // face down to the chin.
    add('head', 'hair', true, head.scalp({ ...womenLine, sideburns: false }, layered(0.01, 0.018)));
    add(
      'head',
      'hair',
      true,
      head.curtain({
        edge: (v) => 0.95 - 0.4 * v,
        thick: 0.011,
        y0: eyeY + 0.07 * k,
        end: (a) => eyeY - (0.07 + 0.018 * smooth(0.6, 1.4, a)) * k,
        out: 0.004,
        flare: 0.06,
        curl: 0.007,
      }),
    );
    fringe(
      7,
      -0.056 * k,
      0.056 * k,
      (x, i) => brows + 0.002 + (i % 2) * 0.004 + 2.6 * x * x,
      0,
      0.021,
    );
    for (const s of [-1, 1]) {
      lockAt(
        onScalp(0.85, Math.PI - s * 0.95, 0.008),
        [s * W * 0.86, mouth - 0.012 * k, -D * 0.42],
        0.016,
        0.012,
      );
    }
  } else if (shape.hair === 'long') {
    // Long and straight, down past the shoulder blades behind; parted in the middle, the fringe
    // falling either way; long locks either side of the face to the collarbones.
    add(
      'head',
      'hair',
      true,
      head.scalp({ ...womenLine, sideburns: false }, layered(0.009, 0.015)),
    );
    add(
      'head',
      'hair',
      true,
      head.curtain({
        edge: (v) => 0.85 - 0.12 * v,
        thick: 0.013,
        y0: eyeY + 0.03 * k,
        end: (a) => eyeY - 0.1 - 0.2 * smooth(1.2, 2.4, a),
        out: 0.004,
        flare: 0.035,
        curl: 0,
      }),
    );
    for (const s of [-1, 1]) {
      fringe(
        3,
        s * 0.008 * k,
        s * 0.05 * k,
        (x) => brows - 0.002 - 1.5 * Math.abs(x) * 0.1,
        s * 0.01,
        0.021,
      );
      lockAt(
        onScalp(0.9, Math.PI - s * 0.9, 0.008),
        [s * W * 0.95, eyeY - 0.13, -D * 0.25],
        0.017,
        0.016,
      );
    }
  } else if (shape.hair === 'bun') {
    // Drawn back into a bun, a band round its base; a side-swept fringe and a long lock either side
    // framing the face.
    add(
      'head',
      'hair',
      true,
      head.scalp({ ...womenLine, sideburns: false }, layered(0.005, 0.009)),
    );
    const bun: V3 = [0, eyeY + 0.075 * k, D + 0.032];
    add('head', 'hair', true, ellipsoid(bun, 0.032, 0.03, 0.028));
    add(
      'head',
      'hair',
      true,
      new THREE.TorusGeometry(0.028, 0.01, 8, 24)
        .rotateX(0.5)
        .toNonIndexed()
        .translate(bun[0], bun[1] - 0.006, bun[2] - 0.006),
    );
    add(
      'head',
      'accent',
      true,
      ellipsoid([0, bun[1] - 0.012, bun[2] - 0.018], 0.024, 0.006, 0.014),
    );
    fringe(4, -0.05 * k, 0.01 * k, (x) => brows + 0.012 + 0.2 * (x + 0.05 * k), 0.022, 0.024);
    for (const s of [-1, 1]) {
      lockAt(
        onScalp(0.95, Math.PI - s * 1.05, 0.006),
        [s * W * 0.88, mouth - 0.004, -D * 0.48],
        0.009,
        0.01,
      );
    }
  } else if (shape.hair === 'photo') {
    // Drawn from its measures (a face made from a photo, 2026-11-12): the scalp's hair as full as
    // it is, a mass round the back and sides down to its length, a fringe as far down the
    // forehead as it covers and swept from the parting, locks framing the face when long, curls.
    const d = shape.hairDesign ?? PLAIN_HAIR;
    const long = d.length >= 0.38;
    add(
      'head',
      'hair',
      true,
      head.scalp(
        { ...(long ? womenLine : menLine), sideburns: d.length < 0.3 },
        layered(
          0.004 + 0.008 * d.volume + 0.004 * d.curl,
          0.011 + 0.01 * d.volume + 0.006 * d.curl,
        ),
      ),
    );
    if (d.length > 0.22) {
      const below = hairBelowEye(d.length, k);
      add(
        'head',
        'hair',
        true,
        head.curtain({
          edge: (v) => (long ? 0.9 : 1.05) - 0.25 * v,
          thick: 0.009 + 0.006 * d.volume,
          y0: eyeY + 0.05 * k,
          // A little longer behind than at the sides.
          end: (a) => eyeY - below * (0.85 + 0.15 * smooth(0.6, 1.6, a)),
          out: 0.003 + 0.004 * d.volume,
          flare: 0.02 + 0.05 * d.volume + 0.04 * d.curl,
          curl: 0.003 + 0.008 * d.curl,
        }),
      );
      if (long) {
        for (const s of [-1, 1]) {
          lockAt(
            onScalp(0.9, Math.PI - s * 0.95, 0.008),
            [s * W * 0.92, eyeY - Math.min(below, 0.13), -D * 0.35],
            0.015,
            0.012,
          );
        }
      }
    }
    if (d.fringe > 0.15) {
      // Down the forehead as far as it covers it (full: to the brows), swept from the parting.
      const drop = (1 - d.fringe) * 0.034 * k;
      fringe(
        6,
        -0.05 * k,
        0.05 * k,
        (x, i) => brows + drop + (i % 2) * 0.004 + 2 * x * x,
        -d.parting * 0.014,
        0.021,
      );
    } else {
      // The forehead clear: the front pushed up and back in short points.
      for (let i = 0; i < 6; i++) {
        const x = (-0.045 + (0.09 * i) / 5) * k;
        const root = onScalp(0.62, Math.PI - Math.asin(x / (W * 0.95)), 0.004);
        lockAt(root, [x * 1.05, root[1] + 0.02, root[2] + 0.004], 0.012, 0.004, 0.5);
      }
    }
    if (d.curl > 0.45) {
      // Curls over the crown, as many as it is curly.
      const count = Math.round(20 + 40 * d.curl);
      for (let i = 0; i < count; i++) {
        const y = 1 - (i + 0.5) / count;
        const theta = Math.acos(y) * 1.2;
        const at = onScalp(theta, i * 2.39996, 0.012);
        const a = Math.abs(Math.atan2(at[0], -at[2]));
        if (at[1] < eyeY + (a < 1.2 ? 0.07 : 0.03) * k) continue;
        add('head', 'hair', true, tuft(at, 0.012 + 0.004 * d.volume));
      }
    }
  } else {
    // ponytail: pulled back into a high ponytail with a band; the tail in locks down to the
    // shoulder blades; a full fringe and short locks framing the face.
    add(
      'head',
      'hair',
      true,
      head.scalp({ ...womenLine, sideburns: false }, layered(0.006, 0.011)),
    );
    const tie: V3 = [0, eyeY + 0.05 * k, D + 0.014];
    add('head', 'accent', true, ellipsoid(tie, 0.016, 0.012, 0.014));
    for (const [dx, dz, len, w] of [
      [0, 0.03, 0.2, 0.026],
      [-0.016, 0.02, 0.17, 0.018],
      [0.016, 0.022, 0.18, 0.018],
      [0, 0.012, 0.14, 0.016],
    ] as const) {
      lockAt(
        [tie[0] + dx * 0.3, tie[1], tie[2] + 0.008],
        [dx, tie[1] - len, D + dz + 0.03],
        w,
        0.03,
        0.5,
      );
    }
    fringe(6, -0.05 * k, 0.05 * k, (x, i) => brows + (i % 2) * 0.006 + 2 * x * x, -0.006, 0.021);
    for (const s of [-1, 1]) {
      lockAt(
        onScalp(0.9, Math.PI - s * 1.0, 0.006),
        [s * W * 0.9, eyeY - 0.03 * k, -D * 0.45],
        0.012,
        0.01,
      );
    }
  }
  if (shape.beard) {
    // A short, neat beard: from the sideburns down along the jaw and over the chin, under the lower
    // lip, its line across the cheeks; a moustache over the upper lip. A few mm thick, thinning
    // into the skin at every edge; its edges follow their lines exactly.
    const fade = (u: number, v: number) =>
      smooth(0, 0.14, v) * smooth(1, 0.82, v) * smooth(0, 0.06, u) * smooth(1, 0.94, u);
    const cheek = eyeY - 0.046 * k;
    add(
      'head',
      'hair',
      true,
      head.band(
        -1.3,
        1.3,
        (x) => {
          const ax = Math.abs(x);
          return (
            mouth -
            0.011 * k +
            0.007 * k * smooth(0.016, 0.03, ax) +
            (cheek - (mouth - 0.004 * k)) * smooth(0.03, 0.058, ax) +
            (eyeY - 0.012 * k - cheek) * smooth(0.058, 0.074, ax)
          );
        },
        () => eyeY - 0.15 * k,
        (u, v) => 0.0028 * fade(u, v),
      ),
    );
    add(
      'head',
      'hair',
      true,
      head.band(
        -0.42,
        0.42,
        (x) => nose - 0.0072 * k - 18 * x * x,
        (x) => mouth + 0.0078 * k - 9 * x * x,
        (u, v) => 0.0024 * fade(u, v),
      ),
    );
  }
  if (shape.glasses !== 'none') {
    // Frames before the eyes (about 5 cm lenses), a bridge over the nose, the temples to the ears.
    const y = eyeY + 0.001;
    const ex = 0.032 * k;
    // In front of the eyes and clear of the nose's bridge.
    const z = Math.min(front(ex, y), front(0, y + 0.006)) - 0.009;
    for (const side of [-1, 1]) {
      const x = side * ex;
      if (shape.glasses === 'round') {
        add(
          'head',
          'trim',
          true,
          new THREE.TorusGeometry(1, 0.06, 6, 32)
            .toNonIndexed()
            .scale(0.0255, 0.0225, 0.05) // the rim a few mm deep, not a goggle
            .translate(x, y, z),
        );
      } else {
        for (const [dx, dy, sx, sy] of [
          [0, 0.0185, 0.055, 0.003],
          [0, -0.0165, 0.053, 0.0022],
          [-0.0265, 0, 0.0022, 0.035],
          [0.0265, 0, 0.0022, 0.035],
        ] as const) {
          add('head', 'trim', true, block([x + dx, y + dy, z], sx, sy, 0.0035));
        }
        // Sunglasses: a dark lens filling the frame.
        if (shape.glasses === 'shades')
          add('head', 'trim', true, block([x, y, z], 0.051, 0.033, 0.0012));
      }
      const outer: V3 = [side * (ex + 0.027), y + 0.008, z];
      add('head', 'trim', true, tube(outer, [side * W * 1.0, y + 0.01, 0.012], 0.0016, 0.0016));
    }
    add(
      'head',
      'trim',
      true,
      block([0, y + 0.007, z], Math.max(0.006, ex * 2 - 0.052), 0.003, 0.003),
    );
  }

  // --- Torso: chest to the shoulders, the waist, the hips; deep about 0.6 of its width.
  const deep = 0.62 * (0.88 + 0.12 * g) + 0.02 * m;
  const chestProfile: [number, number][] = [
    [waist + 0.004 + 0.003 * curve, 0.64 * h],
    [(waist + shoulders) / 2 - 0.01 + 0.012 * m, 0.71 * h],
    [shoulders - 0.035, 0.79 * h],
    [shoulders - 0.075 + 0.01 * m, 0.818 * h],
    [0.06 + 0.01 * m, 0.832 * h],
    [0.048, 0.836 * h],
  ];
  // The bust (bustM): the chest's front rising at it and curving in to the waist below; a
  // muscled chest (muscle): two broad, flat rises higher up.
  const rises: Rise[] = [];
  if (shape.bustM > 0) {
    const knit = shape.neck === 'crew' || shape.neck === 'hood';
    rises.push({
      y: 0.716 * h,
      half: 0.075 * h,
      apart: 0.058,
      width: 0.08,
      out: shape.bustM + 0.012,
      shape: bustShape(h, shape.bustM, knit ? 0.55 : 0.85),
    });
    // The ribs under the bust, the waist curving up into them.
    chestProfile.splice(1, 0, [waist + 0.012 + 0.002 * curve, 0.672 * h]);
    // As wide at the bust as the build allows: from the front too, the waist goes in below it.
    const at = chestProfile[2];
    if (at) at[0] = Math.max(at[0], shoulders - 0.06 + shape.bustM * 0.3);
  }
  if (m > 0)
    rises.push({ y: 0.758 * h, half: 0.05 * h, apart: 0.062, width: 0.085, out: 0.022 * m });
  const chestR = radiusOf(chestProfile);
  /** The waist from the hips' top to the ribs: narrowest at the navel on a curved figure. */
  const waistLine: [number, number][] =
    curve > 0
      ? [
          [waist + 0.002 + 0.016 * curve, 0.57 * h],
          [waist, 0.613 * h],
          [waist + 0.004 + 0.007 * curve, 0.65 * h],
        ]
      : [
          [waist + 0.002, 0.57 * h],
          [waist + 0.004, 0.65 * h],
        ];
  /** On a curved figure, the small of the back curving in above the seat. */
  const smallOfBack: Rise[] =
    curve > 0
      ? [{ y: 0.605 * h, half: 0.04 * h, apart: 0, width: 0.11, out: -0.01 * curve, back: true }]
      : [];
  if (w.crop) {
    // A top ending under the bust (0.675 h), a rolled hem; the midriff bare below it.
    const hemY = 0.675 * h;
    const cropped: [number, number][] = [
      [chestR(hemY), hemY],
      ...chestProfile.filter(([, y]) => y > hemY + 0.005 * h),
    ];
    add('chest', 'top', false, lathe(cropped, deep, 0, rises));
    add(
      'chest',
      'top',
      false,
      lathe(
        [
          [chestR(hemY) + 0.003, hemY - 0.003],
          [chestR(hemY) + 0.003, hemY + 0.007],
        ],
        deep,
        0,
        rises,
      ),
    );
    add(
      'spine',
      'skin',
      false,
      lathe(
        [
          [waist + 0.016 * curve, 0.565 * h],
          [waist, 0.613 * h],
          [chestR(hemY) - 0.003, hemY + 0.004],
        ],
        deep,
      ),
    );
  } else {
    add('chest', 'top', false, lathe(chestProfile, deep, 0, rises));
    add('spine', 'top', false, lathe(waistLine, deep, 0, smallOfBack));
    // Folds: from under the arms down across the sides, and bunched over the waist.
    for (const side of [-1, 1]) {
      crease(
        'chest',
        'top',
        ringFold(chestR, deep, 0.7 * h, Math.PI + side * 1.35, Math.PI + side * 0.8, -0.05 * h),
      );
      crease(
        'spine',
        'top',
        ringFold(chestR, deep, 0.625 * h, Math.PI + side * 1.2, Math.PI + side * 0.55, 0.012 * h),
      );
    }
  }
  // Under a dress, its own cloth; under a pleated skirt, tights (or the bottom's shorts).
  const lower: Surface = dress
    ? 'top'
    : w.legs === 'pleated' && w.legwear === 'tights'
      ? 'legwear'
      : 'bottom';
  // Shorts are cut high: their leg ends just below the seat (Phú: more of the thigh bare).
  const pelvis: [number, number][] = [
    w.legs === 'shorts' && !dress ? [hips * 0.9, 0.492 * h] : [hips * 0.88, 0.47 * h],
    [hips, 0.515 * h],
    ...(curve > 0 ? [[hips - (hips - waist) * 0.4, 0.553 * h] as [number, number]] : []),
    [waist + 0.006 + 0.008 * curve, 0.585 * h],
  ];
  // The seat: rounded behind, fuller on a curvy figure.
  const seatRise: Rise = {
    y: 0.49 * h,
    half: 0.065 * h,
    apart: 0.055,
    width: 0.09,
    out: 0.008 + seat,
    back: true,
  };
  add('hips', lower, false, lathe(pelvis, deep + 0.08, 0, [seatRise]), pelvisWeigh);
  /** The chest's front (z) at height y. */
  const chestFront = (y: number) => {
    let r = waist;
    for (let i = 1; i < chestProfile.length; i++) {
      const [r0, y0] = chestProfile[i - 1] ?? [waist, 0];
      const [r1, y1] = chestProfile[i] ?? [waist, 0];
      if (y >= y0 && y <= y1) r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return -r * deep;
  };
  /** The chest's front surface (z) at x, y: its elliptic section, and the rise if any. */
  const onChest = (x: number, y: number) => {
    const r = -chestFront(y) / deep;
    const z = -deep * Math.sqrt(Math.max(0, r * r - x * x));
    return rises.reduce((at, rise) => at - rise.out * riseOf(rise, x, y), z);
  };
  if (shape.bustM > 0 && !w.crop) {
    // The fold under each side of the bust, as an anime draws a close top: an arc under its
    // round, rising at its two ends.
    const apex = 0.716 * h;
    const lower = 0.04 + shape.bustM * 0.6;
    const apart = 0.05 + shape.bustM * 0.25;
    for (const side of [-1, 1]) {
      const at = (u: number) => {
        const x = side * (apart - 0.045 + 0.11 * u);
        const y = apex - lower * (0.92 - 0.5 * (2 * u - 1) ** 2);
        return new THREE.Vector3(x, y, onChest(x, y) - 0.0016);
      };
      crease(
        'chest',
        'top',
        strip(
          at,
          () => new THREE.Vector3(0, 1, 0),
          () => new THREE.Vector3(0, 0, -1),
          0.0035,
          14,
        ).toNonIndexed(),
      );
    }
  }
  if (shape.neck === 'tie' || shape.neck === 'bow') {
    add(
      'chest',
      'top',
      false,
      lathe(
        [
          [0.062, 0.826 * h],
          [0.056, 0.842 * h],
        ],
        0.95,
      ),
    ); // collar
    const knot = 0.815 * h;
    if (shape.neck === 'tie') {
      add('chest', 'accent', false, block([0, knot, onChest(0, knot) - 0.008], 0.03, 0.026, 0.018));
      const blade = 0.71 * h;
      add(
        'chest',
        'accent',
        false,
        block([0, blade, onChest(0, blade) - 0.006], 0.045, 0.17 * h, 0.006),
      );
    } else {
      // A school bow at the throat: two loops either side of the knot, two short tails below;
      // buttons down the shirt.
      const z = onChest(0, knot) - 0.012;
      add('chest', 'accent', false, ellipsoid([0, knot, z], 0.009, 0.009, 0.007));
      for (const s of [-1, 1]) {
        add(
          'chest',
          'accent',
          false,
          ellipsoid([s * 0.022, knot + 0.002, z + 0.002], 0.019, 0.012, 0.006),
        );
        add(
          'chest',
          'accent',
          false,
          block([s * 0.012, knot - 0.03, z + 0.003], 0.013, 0.042, 0.004, s * 0.35),
        );
      }
      for (const y of [0.775, 0.735, 0.695, 0.655]) {
        add(
          'chest',
          'eyeWhite',
          false,
          ellipsoid([0, y * h, onChest(0, y * h) - 0.002], 0.005, 0.005, 0.0025),
        );
      }
    }
    // The shirt's collar points either side of the knot, and a breast pocket.
    for (const s of [-1, 1]) {
      const y = 0.822 * h;
      add(
        'chest',
        'top',
        false,
        block([s * 0.026, y, onChest(s * 0.026, y) - 0.006], 0.034, 0.024, 0.004, s * 0.75),
      );
    }
    const pocket = 0.755 * h;
    add(
      'chest',
      'top',
      false,
      block(
        [-0.085, pocket, onChest(-0.085, pocket) - 0.003],
        0.06,
        0.07,
        0.005,
        0,
        lying(-0.085, onChest(-0.085, pocket), deep),
      ),
    );
  } else if (shape.neck === 'collar') {
    // A collar trimmed in the accent: a V to the breastbone in short strips lying on the cloth,
    // a small stand-up band round the neck open at the front, a little knot at the V.
    add(
      'chest',
      'top',
      false,
      lathe(
        [
          [0.072, 0.818 * h],
          [0.06, 0.842 * h],
        ],
        deep + 0.2,
        1.1,
      ),
    );
    // The trim: one thin cord from each shoulder's collar down to the V, lying on the cloth.
    const steps = 8;
    for (const side of [-1, 1]) {
      let last: V3 | null = null;
      for (let i = 0; i <= steps; i++) {
        const x = side * 0.058 * (1 - i / steps);
        const y = (0.818 - (0.05 * i) / steps) * h;
        const point: V3 = [x, y, onChest(x, y) - 0.003];
        if (last) add('chest', 'accent', false, tube(last, point, 0.0035, 0.0035));
        last = point;
      }
    }
    const knot = 0.768 * h;
    add(
      'chest',
      'accent',
      false,
      block([0, knot, onChest(0, knot) - 0.003], 0.018, 0.018, 0.006, Math.PI / 4),
    );
    // Buttons down the front below the V.
    for (const y of [0.735, 0.695, 0.655]) {
      add(
        'chest',
        'accent',
        false,
        ellipsoid([0, y * h, onChest(0, y * h) - 0.002], 0.0055, 0.0055, 0.003),
      );
    }
  }
  const tucked = shape.neck === 'tie' || shape.neck === 'collar' || shape.neck === 'bow';
  if (
    !dress &&
    (w.legs === 'shorts' || w.legs === 'cargo' || (w.legs === 'trousers' && (tucked || w.crop)))
  ) {
    // Trousers with a shirt tucked in (shorts, cargo trousers, a bare midriff): the belt and its
    // buckle.
    add(
      'spine',
      'trim',
      false,
      lathe(
        [
          [waist + 0.01, 0.57 * h],
          [waist + 0.01, 0.585 * h],
        ],
        deep + 0.02,
      ),
    );
    const buckle: V3 = [0, 0.577 * h, -(waist + 0.01) * (deep + 0.02) - 0.004];
    add('spine', 'eyeWhite', false, block(buckle, 0.04, 0.026, 0.006));
  }
  if (shape.neck === 'crew' || shape.neck === 'hood') {
    // Knitwear: a ribbed band round the neck and at the hem; a small badge on the left breast.
    add(
      'chest',
      'top',
      false,
      lathe(
        [
          [0.066, 0.824 * h],
          [0.058, 0.84 * h],
        ],
        0.95,
      ),
    );
    // (A top ending under the bust has no hem down here.)
    if (!w.crop) {
      const band = (y: number) => radiusOf(waistLine)(y) + 0.008 + 0.006 * (1 - curve);
      add(
        'spine',
        'top',
        false,
        lathe(
          [
            [band(0.556 * h) + 0.004 * curve, 0.556 * h],
            [band(0.58 * h), 0.58 * h],
          ],
          deep + 0.03,
        ),
      );
    }
    const badge = 0.765 * h;
    add(
      'chest',
      'accent',
      false,
      block(
        [-0.075, badge, onChest(-0.075, badge) - 0.003],
        0.034,
        0.022,
        0.004,
        0,
        lying(-0.075, onChest(-0.075, badge), deep),
      ),
    );
  }
  if (shape.neck === 'hood' && !w.crop) {
    // The hood lying down behind the neck, its strings down the front, the front pocket.
    add('chest', 'top', false, back([0, 0.84 * h, 0.035], 0.12, 0.085, 0.085, 0, 0.62));
    for (const side of [-1, 1]) {
      const a: V3 = [side * 0.03, 0.826 * h, onChest(side * 0.03, 0.82 * h) - 0.006];
      const b: V3 = [side * 0.034, 0.75 * h, onChest(side * 0.034, 0.75 * h) - 0.005];
      add('chest', 'accent', false, tube(a, b, 0.0035, 0.0035));
      add('chest', 'trim', false, tube(b, [b[0], b[1] - 0.018, b[2] - 0.001], 0.0045, 0.004)); // the tip
    }
    // The front pocket: a panel of the cloth curving round the belly (a front arc of the body's
    // own section, a little out), its top edge rolled; in the accent with colour blocks.
    const pocketCloth: Surface = w.blocks ? 'accent' : 'top';
    const pocket = new THREE.LatheGeometry(
      [new THREE.Vector2(waist + 0.009, 0.565 * h), new THREE.Vector2(waist + 0.011, 0.63 * h)],
      14,
      Math.PI - 0.6,
      1.2,
    );
    solid('spine', pocketCloth, pocket.scale(1, 1, deep).toNonIndexed());
    solid(
      'spine',
      pocketCloth,
      new THREE.LatheGeometry(
        [new THREE.Vector2(waist + 0.011, 0.628 * h), new THREE.Vector2(waist + 0.013, 0.634 * h)],
        14,
        Math.PI - 0.6,
        1.2,
      )
        .scale(1, 1, deep)
        .toNonIndexed(),
    );
  }
  if (w.logo) {
    // A round emblem on the chest: a ring and a W inside it.
    const y = 0.74 * h;
    const z = onChest(0, y) - 0.004;
    add(
      'chest',
      'accent',
      false,
      new THREE.TorusGeometry(0.034, 0.0045, 6, 28).toNonIndexed().translate(0, y, z),
    );
    for (const [x, rz] of [
      [-0.014, 0.35],
      [-0.005, -0.35],
      [0.005, 0.35],
      [0.014, -0.35],
    ] as const) {
      add('chest', 'accent', false, block([x, y - 0.002, z - 0.001], 0.0045, 0.03, 0.003, rz));
    }
  }
  if (shape.skirt) {
    const skirt: [number, number][] = [
      [waist + 0.012, 0.565 * h],
      [(waist + hips) / 2 + 0.016, 0.545 * h], // over the seat under it, all the way round
      [hips + 0.02, 0.5 * h], // roomy enough over the thighs at the hips
      [hips + 0.05, 0.3 * h],
    ];
    // Over the seat; a waistband.
    add(
      'hips',
      'top',
      false,
      lathe(skirt, deep + 0.17, 0, [{ ...seatRise, out: seatRise.out + 0.006 }]),
      skirtWeigh,
    );
    add(
      'spine',
      'top',
      false,
      lathe(
        [
          [waist + 0.012, 0.565 * h],
          [waist + 0.01, 0.585 * h],
        ],
        deep + 0.04,
      ),
    );
    // Folds falling from the hips down the skirt.
    const skirtR = radiusOf(skirt);
    for (const phi of [Math.PI - 0.35, Math.PI + 0.4, Math.PI - 1.25, Math.PI + 1.2, 0.3, -0.4]) {
      crease(
        'hips',
        'top',
        lineDown(skirtR, deep + 0.17, phi, 0.32 * h, 0.47 * h, 0.005),
        skirtWeigh,
      );
    }
  } else if (w.legs === 'pleated') {
    // A pleated skirt to mid-thigh in the bottom's colour, a waistband; a pleat every 0.4 rad.
    const pleated: [number, number][] = [
      [waist + 0.014, 0.585 * h],
      [(waist + hips) / 2 + 0.02, 0.55 * h],
      [hips + 0.028, 0.5 * h],
      [hips + 0.055, 0.4 * h],
    ];
    // Inside the lab coat's skirt (its radius there about hips + 0.067, deep + 0.13).
    add(
      'hips',
      'bottom',
      false,
      lathe(pleated, deep + 0.12, 0, [{ ...seatRise, out: seatRise.out + 0.006 }]),
      skirtWeigh,
    );
    add(
      'spine',
      'bottom',
      false,
      lathe(
        [
          [waist + 0.014, 0.57 * h],
          [waist + 0.012, 0.592 * h],
        ],
        deep + 0.04,
      ),
    );
    const pleatR = radiusOf(pleated);
    for (let k = 0; k < 16; k++) {
      const phi = (k + 0.5) * ((2 * Math.PI) / 16);
      crease(
        'hips',
        'bottom',
        lineDown(pleatR, deep + 0.12, phi, 0.401 * h, 0.52 * h, 0.0035),
        skirtWeigh,
      );
    }
  }

  // The limbs' shapes, by build and muscle: a rounded shoulder, the upper arm fuller at the
  // biceps, the forearm full below the elbow and slim at the wrist.
  const armR = 0.039 * g + 0.006 * m;
  const upperArm = [
    [0, armR * 1.06],
    [0.4, armR * 1.04 + 0.011 * m],
    [0.8, armR * 0.92],
    [1, armR * 0.88],
  ] as const;
  const foreR = 0.036 * g + 0.004 * m;
  const foreArm = [
    [0, foreR],
    [0.22, foreR * 1.1 + 0.006 * m],
    [0.65, foreR * 0.9],
    [1, foreR * 0.76],
  ] as const;
  // Legs: the thigh full at the top (more on a curvy figure), narrowing to the knee; the calf
  // below it, the ankle slim — in tights or bare; trousers hang straighter.
  const slender = shape.skirt || bareLegs;
  const leg = (slender ? 0.88 : 1) * g;
  const thighR = 0.074 * leg + seat * 0.5 + 0.006 * m;
  // The thigh meets the pelvis at the top however slim the leg (the pelvis is the hips wide).
  const thighTop = Math.max(thighR * 1.05, hips * 0.46 + 0.002);
  // Its round top is small (it stays inside the pelvis, never out through a dress at the hip);
  // full a little below the hip joint.
  const thigh = [
    [0, thighTop * 0.68],
    [0.1, thighTop],
    [0.3, Math.max(thighR, thighTop * 0.88)],
    [0.75, thighR * 0.8],
    [1, thighR * 0.72],
  ] as const;
  const kneeR = 0.052 * leg + 0.004 * m;
  const shinShape: Profile = slender
    ? [
        [0, kneeR * 0.98],
        [0.28, kneeR * 1.12 + 0.008 * m],
        [0.6, kneeR * 0.9],
        [0.9, kneeR * 0.66],
        [1, kneeR * 0.66],
      ]
    : [
        [0, kneeR],
        [0.3, kneeR * 1.04 + 0.006 * m],
        [0.92, kneeR * 0.86],
        [1, kneeR * 0.9],
      ];
  // Trousers' cloth (C-10): joggers baggy and gathered above the ankle; cargo trousers roomy.
  const baggy = w.legs === 'joggers' ? 0.014 : w.legs === 'cargo' ? 0.009 : 0;
  const thighCloth: Profile = trousers ? over(thigh, baggy) : thigh;
  const shinCloth: Profile =
    trousers && w.legs === 'joggers'
      ? [
          [0, kneeR + 0.014],
          [0.4, kneeR * 1.04 + 0.016 + 0.006 * m],
          [0.78, kneeR * 0.94 + 0.01],
          [0.86, kneeR * 0.74],
          [1, kneeR * 0.74],
        ]
      : trousers
        ? over(shinShape, baggy)
        : shinShape;
  /** The legs' own surface: trousers', a dress's tights, or bare (tights or stockings if worn). */
  const thighSurface: Surface =
    dress || trousers ? 'bottom' : w.legwear === 'tights' ? 'legwear' : 'skin';
  const shinSurface: Surface =
    dress || trousers ? 'bottom' : w.legwear === 'none' ? 'skin' : 'legwear';
  const sleeveCloth: Surface = w.blocks ? 'accent' : 'top';
  const ahead = Math.PI; // a lathe's (or a limb's) turn at its front
  for (const [side, s] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    const shoulder = j[`upperArm${side}`];
    const elbow = j[`foreArm${side}`];
    const wrist = j[`hand${side}`];
    const arm: V3 = [shoulder[0], shoulder[1] - 0.02, shoulder[2]];
    // Sleeves (C-10): long, short (the upper arm's top half, a hem), none (bare arms).
    const long = w.sleeves === 'long';
    add(`upperArm${side}`, long ? 'top' : 'skin', false, limb(arm, elbow, upperArm));
    // The shoulder's round (the deltoid), in the sleeve.
    const delt: V3 = [shoulder[0] + s * 0.004, shoulder[1] - 0.045, 0];
    const deltR = armR * 1.06 + 0.009 * m;
    add(
      `upperArm${side}`,
      w.sleeves === 'none' ? 'skin' : 'top',
      false,
      ellipsoid(delt, deltR, deltR * 1.15, deltR),
    );
    if (w.sleeves === 'short') {
      add(`upperArm${side}`, 'top', false, segment(arm, elbow, upperArm, 0, 0.5, 0.007));
      const r = radiusAt(upperArm, 0.5) + 0.009;
      add(`upperArm${side}`, 'top', false, band(arm, elbow, 0.45, 0.52, r, r));
    }
    const jacketSleeves = w.jacket === 'zip' || w.jacket === 'cropped';
    if (long && !jacketSleeves) {
      // Folds at the inside of the elbow, on the sleeve above and below it.
      crease(
        `upperArm${side}`,
        'top',
        fold(arm, elbow, upperArm, 0.86, ahead - 1, ahead + 0.6, 0.1),
      );
      crease(
        `upperArm${side}`,
        'top',
        fold(arm, elbow, upperArm, 0.93, ahead - 0.4, ahead + 1.1, -0.08),
      );
    }
    // The forearm: the sleeve's (colour-blocked, or under a long glove), else bare.
    const longGlove = w.gloves === 'long';
    if (longGlove) {
      // Long gloves from the upper arm's middle down, a rolled top.
      solid(`upperArm${side}`, 'trim', segment(arm, elbow, upperArm, 0.45, 1, 0.0025));
      const r = radiusAt(upperArm, 0.45) + 0.004;
      solid(`upperArm${side}`, 'trim', band(arm, elbow, 0.43, 0.48, r, r));
      solid(`foreArm${side}`, 'trim', limb(elbow, wrist, over(foreArm, 0.0025)));
    } else if (long) {
      const forearm = limb(elbow, wrist, foreArm);
      if (w.blocks) solid(`foreArm${side}`, 'accent', forearm);
      else add(`foreArm${side}`, 'top', false, forearm);
      if (!jacketSleeves) {
        crease(
          `foreArm${side}`,
          sleeveCloth,
          fold(elbow, wrist, foreArm, 0.1, ahead - 0.9, ahead + 0.9, 0.12),
        );
        crease(
          `foreArm${side}`,
          sleeveCloth,
          fold(elbow, wrist, foreArm, 0.78, ahead - 1.6, ahead + 1.2, 0.06),
        );
      }
    } else {
      add(`foreArm${side}`, 'skin', false, limb(elbow, wrist, foreArm));
    }
    if (long && !longGlove && !jacketSleeves && (shape.neck === 'crew' || shape.neck === 'hood')) {
      // The knit's ribbed cuff at the wrist.
      add(
        `foreArm${side}`,
        sleeveCloth,
        false,
        tube(
          [wrist[0], wrist[1] + 0.045, 0],
          [wrist[0], wrist[1] + 0.008, 0],
          foreR * 0.86,
          foreR * 0.84,
        ),
      );
    }
    if (w.bandage && side === 'R') {
      // A bandage wound round the forearm, its turns overlapping, each edge a fine line.
      for (const t of [0.14, 0.27, 0.4, 0.53, 0.66, 0.79]) {
        const r0 = radiusAt(foreArm, t) + 0.003;
        const r1 = radiusAt(foreArm, t + 0.14) + 0.003;
        add('foreArmR', 'bandage', false, band(elbow, wrist, t, t + 0.14, r0, r1));
        crease(
          'foreArmR',
          'bandage',
          fold(elbow, wrist, over(foreArm, 0.003), t + 0.13, 0, 2 * Math.PI, 0.05, 0.0025),
        );
      }
    }
    if (shape.watch && side === 'L') {
      // A wristwatch: the strap round the wrist, the face on its back (outside).
      const y = wrist[1] + 0.03;
      add(
        'foreArmL',
        'trim',
        false,
        tube([wrist[0], y + 0.009, 0], [wrist[0], y - 0.009, 0], foreR * 0.86, foreR * 0.86),
      );
      add(
        'foreArmL',
        'trim',
        false,
        ellipsoid([wrist[0] - foreR * 0.86, y, 0], 0.006, 0.018, 0.016),
      );
      add(
        'foreArmL',
        'eyeWhite',
        false,
        ellipsoid([wrist[0] - foreR * 0.86 - 0.004, y, 0], 0.003, 0.014, 0.012),
      );
    }
    // The hand (the palm towards the thigh, fingers down): a rounded palm, four fingers side by
    // side front to back, the thumb in front; each digit in two pieces, one per joint. A
    // fingerless glove covers the palm, a band round the wrist.
    const palm: V3 = [wrist[0], wrist[1] - PALM_DROP, 0];
    const gloved = w.gloves !== 'none';
    add(
      `hand${side}`,
      gloved ? 'trim' : 'hands',
      false,
      ellipsoid(palm, PALM_HALF + (gloved ? 0.002 : 0), 0.045, 0.04 + (gloved ? 0.002 : 0)),
    );
    if (gloved) {
      add(
        `hand${side}`,
        'trim',
        false,
        tube(
          [wrist[0], wrist[1] + 0.012, 0],
          [wrist[0], wrist[1] - 0.012, 0],
          foreR * 0.8,
          foreR * 0.82,
        ),
      );
    }
    for (const [d, [root, tip]] of digitLines(wrist, s)) {
      const [r0, r1, r2] = d === 'thumb' ? [0.011, 0.0094, 0.0078] : [0.0085, 0.0077, 0.0068];
      add(`${d}${side}1`, 'hands', false, tube(root, mid(root, tip), r0, r1));
      add(`${d}${side}2`, 'hands', false, tube(mid(root, tip), tip, r1, r2));
    }

    const hip = j[`thigh${side}`];
    const knee = j[`shin${side}`];
    const ankle = j[`foot${side}`];
    const shin: V3 = [ankle[0], ankle[1] + 0.02, 0];
    add(`thigh${side}`, thighSurface, false, limb(hip, knee, thighCloth));
    add(`shin${side}`, shinSurface, false, limb(knee, shin, shinCloth));
    if (bareLegs && w.legwear === 'thighHighs') {
      // Stockings to mid-thigh, a band at the top.
      add(`thigh${side}`, 'legwear', false, segment(hip, knee, thigh, 0.45, 1, 0.0015));
      const r = radiusAt(thigh, 0.45) + 0.004;
      add(`thigh${side}`, 'legwear', false, band(hip, knee, 0.43, 0.49, r, r));
    }
    if (w.legs === 'shorts' && !dress) {
      // Shorts: the thigh's top fifth (short ones, Phú: the thighs bare below), a turned hem.
      add(`thigh${side}`, 'bottom', false, segment(hip, knee, thigh, 0, 0.13, 0.006));
      const r = radiusAt(thigh, 0.13) + 0.008;
      add(`thigh${side}`, 'bottom', false, band(hip, knee, 0.1, 0.14, r, r));
      crease(
        `thigh${side}`,
        'bottom',
        fold(hip, knee, over(thigh, 0.006), 0.07, ahead - 0.9, ahead + 0.5, 0.1),
      );
    }
    if (trousers) {
      // Folds: across the front of the knee, behind it, and the cloth bunched at the ankle
      // (joggers above their cuff, a few more).
      crease(
        `thigh${side}`,
        'bottom',
        fold(hip, knee, thighCloth, 0.9, ahead - 0.8, ahead + 0.6, 0.05),
      );
      crease(
        `shin${side}`,
        'bottom',
        fold(knee, shin, shinCloth, 0.07, ahead - 0.6, ahead + 0.8, -0.05),
      );
      crease(`shin${side}`, 'bottom', fold(knee, shin, shinCloth, 0.06, -0.8, 0.8, 0.04));
      const bunch = w.legs === 'joggers' ? [0.58, 0.66, 0.74] : [0.84, 0.92];
      for (const [i, t] of bunch.entries()) {
        const turn = i % 2 === 0 ? 1 : -1;
        crease(
          `shin${side}`,
          'bottom',
          fold(knee, shin, shinCloth, t, ahead - 1.1 * turn, ahead + 0.9 * turn, 0.05 * turn),
        );
      }
      if (w.legs === 'joggers') {
        // The ribbed cuff gathering them above the ankle.
        const r = kneeR * 0.74 + 0.004;
        add(`shin${side}`, 'bottom', false, band(knee, shin, 0.84, 0.97, r, r));
      }
      if (w.legs === 'cargo') {
        // A cargo pocket on the outside of each thigh, its flap's edge a fold.
        const at = lerp3(hip, knee, 0.52);
        const r = radiusAt(thighCloth, 0.52);
        const pocket: V3 = [at[0] + s * (r + 0.004), at[1], at[2]];
        add(`thigh${side}`, 'bottom', false, block(pocket, 0.016, 0.12, 0.1));
        crease(
          `thigh${side}`,
          'bottom',
          block([pocket[0] + s * 0.009, pocket[1] + 0.04, pocket[2]], 0.002, 0.004, 0.1),
        );
      }
      if (w.ripped && side === 'R') {
        // Torn open at the knee: the skin through a ragged hole, threads across it.
        const r = radiusAt(shinCloth, 0.04);
        const hole: V3 = [knee[0], knee[1] + 0.01, -r + 0.004];
        add('shinR', 'skin', false, ellipsoid(hole, 0.03, 0.026, 0.008));
        for (const [dy, tilt] of [
          [-0.012, 0.15],
          [0.002, -0.1],
          [0.014, 0.08],
        ] as const) {
          add(
            'shinR',
            'bandage',
            false,
            tube(
              [hole[0] - 0.028, hole[1] + dy - tilt * 0.03, hole[2] - 0.006],
              [hole[0] + 0.028, hole[1] + dy + tilt * 0.03, hole[2] - 0.006],
              0.0015,
              0.0015,
            ),
          );
        }
      }
    }

    // Shoes (C-10): trainers with laces; loafers; heels (a slim shoe on a heel); boots to mid-calf
    // (laced, a thick sole), below the knee (laced up the front), over the knee (heeled).
    const x = ankle[0];
    const fw = w.footwear;
    const heeled = fw === 'heels' || fw === 'thighBoots';
    if (fw === 'heels') {
      add(`foot${side}`, 'shoes', false, ellipsoid([x, 0.042, -0.07], 0.042, 0.032, 0.095));
      add(`foot${side}`, 'shoes', false, block([x, 0.05, 0.0], 0.074, 0.06, 0.1));
      add(`foot${side}`, 'shoes', false, ellipsoid([x, 0.06, 0.035], 0.04, 0.036, 0.03));
    } else {
      add(`foot${side}`, 'shoes', false, ellipsoid([x, 0.04, -0.07], 0.05, 0.04, 0.1));
      add(`foot${side}`, 'shoes', false, block([x, 0.04, 0.0], 0.09, 0.075, 0.12));
      add(`foot${side}`, 'shoes', false, ellipsoid([x, 0.05, 0.035], 0.046, 0.042, 0.035)); // the heel's round
    }
    if (heeled) {
      // A thin sole and a heel under the back.
      add(`foot${side}`, 'trim', false, ellipsoid([x, 0.008, -0.06], 0.046, 0.008, 0.1));
      add(`foot${side}`, 'trim', false, block([x, 0.024, 0.045], 0.022, 0.05, 0.024));
    } else if (fw === 'boots' || fw === 'kneeBoots') {
      add(`foot${side}`, 'trim', false, block([x, 0.012, -0.03], 0.104, 0.024, 0.25));
    } else {
      // The sole, rounded at toe and heel, a little wider than the shoe.
      add(`foot${side}`, 'trim', false, ellipsoid([x, 0.009, -0.045], 0.052, 0.01, 0.132));
    }
    if (fw === 'sneakers' || fw === 'boots') {
      for (const z of [-0.035, -0.055, -0.075]) {
        const y = 0.04 + 0.04 * Math.sqrt(1 - ((z + 0.07) / 0.1) ** 2) + 0.001;
        add(`foot${side}`, 'trim', false, block([x, y, z], 0.04, 0.004, 0.006));
      }
    }
    if (fw === 'sneakers') {
      // A stripe on the outer side.
      add(
        `foot${side}`,
        'accent',
        false,
        block([x + s * 0.046, 0.045, -0.02], 0.004, 0.014, 0.1, 0, 0),
      );
    } else if (fw === 'loafers' || fw === 'heels') {
      // A strap across the instep (a dress's flats, a small bow instead).
      if (shape.skirt) {
        add(`foot${side}`, 'accent', false, ellipsoid([x, 0.074, -0.1], 0.016, 0.008, 0.01));
      } else {
        add(`foot${side}`, 'trim', false, block([x, 0.07, -0.06], 0.07, 0.006, 0.012));
      }
    }
    // A boot's shaft over the leg (tucked trousers inside it), a band at its top.
    const shaftTop =
      fw === 'boots'
        ? 0.16 * h
        : fw === 'kneeBoots'
          ? 0.265 * h
          : fw === 'thighBoots'
            ? knee[1]
            : 0;
    if (shaftTop > 0) {
      const t0 = THREE.MathUtils.clamp((knee[1] - shaftTop) / (knee[1] - shin[1]), 0, 1);
      add(`shin${side}`, 'shoes', false, segment(knee, shin, shinCloth, t0, 1, 0.007));
      const r = radiusAt(shinCloth, t0) + 0.009;
      add(
        `shin${side}`,
        fw === 'thighBoots' ? 'shoes' : 'trim',
        false,
        band(knee, shin, t0, t0 + 0.06, r, r),
      );
      if (fw === 'kneeBoots') {
        // Laced up the front: crossing cords.
        for (let i = 0; i < 6; i++) {
          const ta = t0 + 0.08 + ((1 - t0 - 0.15) * i) / 6;
          const tb = ta + (1 - t0 - 0.15) / 6;
          const ra = radiusAt(shinCloth, ta) + 0.0085;
          const rb = radiusAt(shinCloth, tb) + 0.0085;
          const pa = lerp3(knee, shin, ta);
          const pb = lerp3(knee, shin, tb);
          for (const k of [-1, 1]) {
            add(
              `shin${side}`,
              'trim',
              false,
              tube(
                [pa[0] - k * 0.012, pa[1], -ra],
                [pb[0] + k * 0.012, pb[1], -rb],
                0.0016,
                0.0016,
              ),
            );
          }
        }
      }
      if (fw === 'thighBoots') {
        // Over the knee to below mid-thigh, a band at the top; with shorts or a skirt, a garter
        // strap on the left thigh from the hem down to the boot, a band round the bare thigh.
        add(`thigh${side}`, 'shoes', false, segment(hip, knee, thigh, 0.58, 1, 0.007));
        const rt = radiusAt(thigh, 0.58) + 0.009;
        add(`thigh${side}`, 'shoes', false, band(hip, knee, 0.56, 0.62, rt, rt));
        if (bareLegs && side === 'L') {
          const outside = -s * (Math.PI / 2);
          add(
            `thigh${side}`,
            'trim',
            false,
            lineAlong(hip, knee, over(thigh, 0.001), outside, 0.12, 0.58, 0.012),
          );
          const rg = radiusAt(thigh, 0.36) + 0.0025;
          add(`thigh${side}`, 'trim', false, band(hip, knee, 0.34, 0.38, rg, rg));
          const at = lerp3(hip, knee, 0.36);
          add(
            `thigh${side}`,
            'eyeWhite',
            false,
            block([at[0] + s * (rg + 0.002), at[1], at[2]], 0.003, 0.012, 0.012),
          );
        }
      }
      // Folds at the ankle where the boot bends.
      crease(
        `shin${side}`,
        'shoes',
        fold(knee, shin, over(shinCloth, 0.007), 0.9, ahead - 0.9, ahead + 0.9, 0.04),
      );
    }

    // The coat's sleeves over the shirt's (the sleeve's top covers the shoulder's round), a cuff
    // turned back at the wrist.
    add(
      `upperArm${side}`,
      'coat',
      false,
      limb(
        [arm[0], arm[1] - 0.012 + (sleeved ? 0.012 : 0), arm[2]],
        elbow,
        over(upperArm, 0.008 + 0.004 * m + (sleeved ? 0.006 : 0)),
      ),
    );
    const cuff: V3 = [wrist[0], wrist[1] + 0.01, 0];
    // The forearm's sleeve starts just inside the upper one's round end: no ragged ring.
    const upperEnd = armR * 0.88 + 0.008 + 0.004 * m + (sleeved ? 0.006 : 0);
    const sleeve = [
      [0, upperEnd - 0.003],
      [0.22, Math.max(upperEnd - 0.003, foreR * 1.1 + 0.006 * m + 0.01)],
      [1, foreR + 0.012 + (sleeved ? 0.006 : 0)],
    ] as const;
    add(`foreArm${side}`, 'coat', false, limb(elbow, cuff, sleeve));
    add(
      `foreArm${side}`,
      'coat',
      false,
      tube(
        [cuff[0], cuff[1] + 0.04, 0],
        cuff,
        foreR + 0.016 + (sleeved ? 0.006 : 0),
        foreR + 0.016 + (sleeved ? 0.006 : 0),
      ),
    );
  }

  // --- Over the top (C-10): an open zip jacket to the hips, a short jacket ending above the
  // waist, a sleeveless tactical vest, a knit V-neck vest; in the jacket's colour, with its trim.
  // Each under the lab coat's shapes, so the coat still goes on over it in a lab.
  let jacketAt: ((y: number) => number) | null = null;
  if (w.jacket !== 'none') {
    const roomyJ = 0.01 * m + 0.01 * (g - 1);
    const knit = w.jacket === 'sweaterVest';
    const vest = w.jacket === 'vest';
    // The short (leather) jacket is fitted: it lies on the top under it, over the bust (Phú:
    // smooth on the chest, not a stiff box).
    const fitted = w.jacket === 'cropped';
    const jd = knit ? deep + 0.025 : fitted ? deep + 0.02 : deep + (vest ? 0.11 : 0.1);
    const full: [number, number][] = fitted
      ? chestProfile.map(([r, y]): [number, number] => [r + 0.007 + 0.003 * m, y])
      : knit
        ? [
            [waist + 0.016, 0.565 * h],
            [waist + 0.014, 0.6 * h],
            [(waist + shoulders) / 2 + 0.004 + 0.012 * m, 0.71 * h],
            [shoulders - 0.03, 0.79 * h],
            [shoulders - 0.07 + 0.01 * m, 0.82 * h],
            [0.068 + 0.01 * m, 0.832 * h],
          ]
        : [
            [hips + (vest ? 0.026 : 0.022), 0.555 * h],
            [hips + (vest ? 0.028 : 0.024), 0.6 * h],
            [(hips + shoulders) / 2 + roomyJ - (vest ? 0.002 : 0.004), 0.7 * h],
            [shoulders - (vest ? 0.03 : 0.026) + roomyJ, 0.79 * h],
            [shoulders - (vest ? 0.072 : 0.066) + roomyJ, 0.822 * h],
            [0.07 + 0.01 * m, 0.838 * h],
          ];
    const rJ = radiusOf(full);
    jacketAt = rJ;
    const hemY = (w.jacket === 'cropped' ? 0.685 : knit ? 0.565 : 0.555) * h;
    const shell: [number, number][] = [
      [rJ(hemY), hemY],
      ...full.filter(([, y]) => y > hemY + 0.01),
    ];
    // Over a bust: a knit follows it; a jacket's fronts are carried out by it, as the coat's.
    const jRises: Rise[] =
      knit || fitted
        ? rises.map((rise) => ({ ...rise, out: rise.out + 0.004 }))
        : (() => {
            if (shape.bustM <= 0) return [];
            const apart = 0.05 + shape.bustM * 0.25;
            const apex = 0.716 * h;
            const plain = -jd * Math.sqrt(Math.max(0, rJ(apex) ** 2 - apart * apart));
            const lift = Math.max(0, plain - onChest(apart, apex) + 0.007);
            const fall = bustShape(h, shape.bustM, 1);
            return lift > 0 ? [{ y: apex, half: 0, apart, width: 0, out: lift, shape: fall }] : [];
          })();
    const gap = w.jacket === 'zip' ? 0.5 : w.jacket === 'cropped' ? 0.8 : 0;
    if (knit) {
      // Closed below the V, open above it to the collar; a ribbed hem.
      const v = 0.7 * h;
      add(
        'chest',
        'outer',
        false,
        lathe(
          [
            [rJ(hemY), hemY],
            [rJ(v), v],
          ],
          jd,
          0,
          jRises,
        ),
      );
      add(
        'chest',
        'outer',
        false,
        lathe([[rJ(v), v], ...full.filter(([, y]) => y > v + 0.01)], jd, 1.1, jRises),
      );
      add(
        'spine',
        'outer',
        false,
        lathe(
          [
            [rJ(hemY) + 0.003, hemY],
            [rJ(hemY + 0.02 * h) + 0.003, hemY + 0.02 * h],
          ],
          jd,
        ),
      );
      for (const side of [-1, 1]) {
        crease(
          'chest',
          'outer',
          ringFold(rJ, jd, 0.62 * h, Math.PI + side * 1.3, Math.PI + side * 0.6, 0.01 * h),
        );
      }
    } else {
      add('chest', 'outer', false, lathe(shell, jd, gap, jRises));
      // A band at the hem.
      add(
        'chest',
        'outer',
        false,
        lathe(
          [
            [rJ(hemY) + 0.003, hemY],
            [rJ(hemY + 0.022 * h) + 0.003, hemY + 0.022 * h],
          ],
          jd,
          gap,
        ),
      );
      for (const side of [-1, 1]) {
        crease(
          'chest',
          'outer',
          ringFold(rJ, jd, hemY + 0.06 * h, Math.PI + side * 1.4, Math.PI + side * 0.75, 0.03 * h),
        );
      }
    }
    if (w.jacket === 'zip') {
      // A stand-up collar, open at the front; the zip's edges in the trim down both fronts.
      add(
        'chest',
        'outer',
        false,
        lathe(
          [
            [0.08 + 0.01 * m, 0.83 * h],
            [0.074 + 0.01 * m, 0.872 * h],
          ],
          0.95,
          0.7,
        ),
      );
      for (const side of [-1, 1]) {
        add(
          'chest',
          'outerTrim',
          false,
          lineDown(rJ, jd, Math.PI + side * (gap / 2 + 0.06), hemY, 0.83 * h, 0.014),
        );
      }
    } else if (w.jacket === 'cropped') {
      // A small collar behind the neck (inside the lab coat's), and the opening's edges piped in
      // the trim, lying on the jacket over the bust.
      add(
        'chest',
        'outer',
        false,
        lathe(
          [
            [0.07 + 0.01 * m, 0.826 * h],
            [0.064 + 0.01 * m, 0.852 * h],
          ],
          0.95,
          1.3,
        ),
      );
      const shellZ = (x: number, y: number) =>
        jRises.reduce(
          (z, rise) => z - rise.out * riseOf(rise, x, y),
          -jd * Math.sqrt(Math.max(0, rJ(y) ** 2 - x * x)),
        );
      for (const side of [-1, 1]) {
        add(
          'chest',
          'outerTrim',
          false,
          strip(
            (u) => {
              const y = hemY + (0.815 * h - hemY) * u;
              const x = side * rJ(y) * Math.sin(gap / 2 + 0.05);
              return new THREE.Vector3(x, y, shellZ(x, y) - 0.0015);
            },
            () => new THREE.Vector3(1, 0, 0),
            () => new THREE.Vector3(0, 0, -1),
            0.008,
            14,
          ).toNonIndexed(),
        );
      }
    } else if (vest) {
      // A tactical vest: a zip down the front, pouches across the belly, straps up the chest, a
      // band at the neck.
      add('chest', 'outerTrim', false, lineDown(rJ, jd, Math.PI, hemY, 0.835 * h, 0.012));
      add(
        'chest',
        'outer',
        false,
        lathe(
          [
            [0.084 + 0.01 * m, 0.828 * h],
            [0.08 + 0.01 * m, 0.852 * h],
          ],
          0.95,
        ),
      );
      for (const x of [-0.085, -0.035, 0.035, 0.085]) {
        const y = 0.625 * h;
        const z = -jd * Math.sqrt(Math.max(0, rJ(y) ** 2 - x * x));
        const turn = lying(x, z, jd);
        add('spine', 'outer', false, block([x, y, z - 0.012], 0.044, 0.07, 0.026, 0, turn));
        crease('spine', 'outer', block([x, y + 0.024, z - 0.026], 0.044, 0.003, 0.002, 0, turn));
      }
      for (const x of [-0.07, 0.07]) {
        const phi = Math.PI - Math.asin(Math.min(1, x / rJ(0.75 * h)));
        add('chest', 'outerTrim', false, lineDown(rJ, jd, phi, 0.67 * h, 0.83 * h, 0.022));
      }
    }
    if (!vest && !knit) {
      // Sleeves over the arms; a cuff; the zip jacket's two stripes down the outside of each.
      for (const [side, s] of [
        ['L', -1],
        ['R', 1],
      ] as const) {
        const shoulder = j[`upperArm${side}`];
        const elbow = j[`foreArm${side}`];
        const wrist = j[`hand${side}`];
        const arm: V3 = [shoulder[0], shoulder[1] - 0.02, shoulder[2]]; // as the arm's own: over its round top
        const outU = 0.0045 + 0.003 * m;
        const upper = over(upperArm, outU);
        add(`upperArm${side}`, 'outer', false, limb(arm, elbow, upper));
        const delt: V3 = [shoulder[0] + s * 0.004, shoulder[1] - 0.045, 0];
        const deltR = armR * 1.06 + 0.009 * m + outU;
        add(`upperArm${side}`, 'outer', false, ellipsoid(delt, deltR, deltR * 1.15, deltR));
        const lower = over(foreArm, 0.0045);
        add(`foreArm${side}`, 'outer', false, segment(elbow, wrist, foreArm, 0, 1, 0.0045));
        const rc = radiusAt(foreArm, 0.88) + 0.0075;
        add(`foreArm${side}`, 'outer', false, band(elbow, wrist, 0.84, 0.97, rc, rc));
        crease(
          `upperArm${side}`,
          'outer',
          fold(arm, elbow, upper, 0.86, Math.PI - 1, Math.PI + 0.7, 0.1),
        );
        crease(
          `upperArm${side}`,
          'outer',
          fold(arm, elbow, upper, 0.94, Math.PI - 0.5, Math.PI + 1.1, -0.08),
        );
        crease(
          `foreArm${side}`,
          'outer',
          fold(elbow, wrist, lower, 0.1, Math.PI - 0.9, Math.PI + 0.9, 0.12),
        );
        crease(
          `foreArm${side}`,
          'outer',
          fold(elbow, wrist, lower, 0.72, Math.PI - 1.4, Math.PI + 1.0, 0.05),
        );
        if (w.jacket === 'zip') {
          // On a limb going down its local x is the world's −x: the outside is the turn −s·π/2.
          const outside = -s * (Math.PI / 2);
          for (const d of [-0.2, 0.2]) {
            add(
              `upperArm${side}`,
              'outerTrim',
              false,
              lineAlong(arm, elbow, upper, outside + d, 0.05, 1, 0.009),
            );
            add(
              `foreArm${side}`,
              'outerTrim',
              false,
              lineAlong(elbow, wrist, lower, outside + d, 0, 0.84, 0.009),
            );
          }
        } else {
          // The leather jacket's zips at the cuffs.
          add(
            `foreArm${side}`,
            'outerTrim',
            false,
            lineAlong(elbow, wrist, lower, -s * (Math.PI / 2), 0.7, 0.95, 0.004),
          );
        }
      }
    }
  }
  if (w.choker) {
    // A choker round the neck, a small ring at its front.
    const y = 0.86 * h;
    add(
      'neck',
      'trim',
      true,
      lathe(
        [
          [neckR + 0.0035, y - 0.008],
          [neckR + 0.0025, y + 0.008],
        ],
        1,
      ).translate(0, 0, 0.009),
    );
    add(
      'neck',
      'accent',
      true,
      new THREE.TorusGeometry(0.008, 0.0018, 6, 14)
        .toNonIndexed()
        .translate(0, y - 0.016, 0.003 - neckR),
    );
  }

  // --- The lab coat: to the knee, open at the front over the shirt; a collar, lapels, buttons,
  // pockets, a pen in the breast pocket, an ID badge. Fuller over a broad or muscled body.
  const roomy = 0.012 * m + 0.012 * (g - 1) + layer;
  // One depth for the chest and the skirt of the coat, so they meet in a clean seam. Over a dress
  // (its skirt is made deep + 0.17, roomy at the back) the coat is as roomy and a little more:
  // else the dress came through the coat's back at the hem (Phú, 2026-11-12).
  const coatDeep = deep + (shape.skirt ? 0.2 : 0.13) + layer;
  const coat: [number, number][] = [
    [hips + 0.036, 0.6 * h],
    [(hips + shoulders) / 2 + roomy, 0.7 * h],
    [shoulders - 0.02 + roomy, 0.79 * h],
    [shoulders - 0.06 + roomy, 0.822 * h],
    [0.075 + 0.01 * m, 0.838 * h],
  ];
  /** The coat's front without anything under it bulging it (its section at height y). */
  const coatPlain = (x: number, y: number) => {
    let r = hips + 0.036;
    for (let i = 1; i < coat.length; i++) {
      const [r0, y0] = coat[i - 1] ?? [r, 0];
      const [r1, y1] = coat[i] ?? [r, 0];
      if (y >= y0 && y <= y1) r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return -coatDeep * Math.sqrt(Math.max(0, r * r - x * x));
  };
  // Over a bust the coat's fronts are carried out by it, hanging straight down from its fullest
  // point (never the bust through the coat).
  const coatRises: Rise[] = [];
  if (shape.bustM > 0) {
    const apart = 0.05 + shape.bustM * 0.25;
    const apex = 0.716 * h;
    const under = onChest(apart, apex);
    const out = Math.max(0, coatPlain(apart, apex) - under + 0.008 + layer * 1.6);
    const fall = bustShape(h, shape.bustM, 1);
    if (out > 0) coatRises.push({ y: apex, half: 0, apart, width: 0, out, shape: fall });
  }
  add('chest', 'coat', false, lathe(coat, coatDeep, 0.5, coatRises));
  add(
    'chest',
    'coat',
    false,
    lathe(
      [
        [0.08 + 0.01 * m + layer, 0.83 * h],
        [0.072 + 0.01 * m + layer, 0.856 * h],
      ],
      0.9,
      1.7,
    ),
  ); // the collar
  const lowDeep = coatDeep;
  add(
    'hips',
    'coat',
    false,
    lathe(
      [
        [hips + 0.085, 0.29 * h],
        [hips + 0.032, 0.61 * h], // just inside the chest's hem
      ],
      lowDeep,
      0.45,
    ),
    skirtWeigh,
  );
  /** The coat's front (z) at x on its chest (its section at height y). */
  const onCoat = (x: number, y: number) =>
    coatRises.reduce((at, rise) => at - rise.out * riseOf(rise, x, y), coatPlain(x, y));
  for (const s of [-1, 1]) {
    // The lapel: folded back from the opening's edge, flat on the coat's chest.
    const lapel = 0.74 * h; // its top under the coat's shoulder, not standing out
    // Wholly on the cloth beside the opening (0.5 rad wide), never over the gap.
    const lx = s * ((-onCoat(0, lapel) / coatDeep) * Math.sin(0.25) + 0.019);
    add(
      'chest',
      'coat',
      false,
      block(
        [lx, lapel, onCoat(lx, lapel) - 0.005],
        0.034,
        0.09,
        0.006,
        s * 0.3,
        lying(lx, onCoat(lx, lapel), coatDeep),
      ),
    );
    // The side pockets, on the cloth where the skirt of the coat is (its section at 0.43 h).
    const pr = hips + 0.032 + (0.053 * (0.61 - 0.43)) / 0.32;
    const pz = -lowDeep * Math.sqrt(pr * pr - 0.0144);
    const turn = lying(s * 0.12, pz, lowDeep);
    const pocket: V3 = [s * 0.12, 0.43 * h, pz - 0.004];
    add('hips', 'coat', false, block(pocket, 0.11, 0.12, 0.006, 0, turn), skirtWeigh);
    add(
      'hips',
      'coat',
      false,
      block([pocket[0], pocket[1] + 0.058, pocket[2] - 0.004], 0.115, 0.012, 0.004, 0, turn),
      skirtWeigh,
    ); // its hem
  }
  // Buttons down the right front's edge; the breast pocket on the left with a pen; a badge.
  for (const y of [0.56, 0.48, 0.4]) {
    const r = hips + 0.032 + (0.053 * (0.61 - y)) / 0.32;
    const edge = r * Math.sin(0.225) + 0.016; // on the cloth beside the opening
    add(
      'hips',
      'coatTrim',
      false,
      ellipsoid(
        [edge, y * h, -lowDeep * Math.sqrt(r * r - edge * edge) - 0.003],
        0.007,
        0.007,
        0.003,
      ),
      skirtWeigh,
    );
  }
  const breast = 0.715 * h;
  const bx = -0.115;
  add(
    'chest',
    'coat',
    false,
    block(
      [bx, breast, onCoat(bx, breast) - 0.004],
      0.08,
      0.085,
      0.005,
      0,
      lying(bx, onCoat(bx, breast), coatDeep),
    ),
  );
  add(
    'chest',
    'coatTrim',
    false,
    tube(
      [bx + 0.018, breast + 0.03, onCoat(bx, breast) - 0.009],
      [bx + 0.018, breast + 0.075, onCoat(bx, breast) - 0.009],
      0.0045,
      0.0045,
    ),
  );
  add(
    'chest',
    'coatTrim',
    false,
    block([bx + 0.018, breast + 0.05, onCoat(bx, breast) - 0.013], 0.003, 0.03, 0.002),
  ); // its clip
  const badge = 0.73 * h;
  add(
    'chest',
    'coat',
    false,
    block(
      [0.115, badge, onCoat(0.115, badge) - 0.004],
      0.055,
      0.075,
      0.004,
      0,
      lying(0.115, onCoat(0.115, badge), coatDeep),
    ),
  );
  add(
    'chest',
    'coatTrim',
    false,
    block(
      [0.115, badge + 0.026, onCoat(0.115, badge) - 0.0065],
      0.055,
      0.018,
      0.002,
      0,
      lying(0.115, onCoat(0.115, badge), coatDeep),
    ),
  );

  // Goggles: a band round the head at the eyes; the face shield: a clear visor before the face.
  add(
    'head',
    'goggles',
    true,
    block([0, eyeY + 0.004, front(0, eyeY + 0.006) - 0.014], 0.17, 0.05, 0.03),
  );
  add('head', 'goggles', true, ellipsoid([0, eyeY + 0.008, 0], W * 1.1, 0.012, D * 1.12));
  add('head', 'shield', true, block([0, eyeY - 0.03, front(0, eyeY) - 0.05], 0.26, 0.29, 0.004));
  add('head', 'shield', true, block([0, top - 0.02, crown[2] - D * 0.6], 0.22, 0.025, 0.14));
  // How far out from the sides the arms must hang (rad, from straight down) to clear the body: the
  // hands the thighs (or, worn, the coat's skirt), the elbows the waist, the upper arms the bust.
  const shoulderX = shape.shoulderM / 2 - 0.045;
  const shoulderY = 0.815 * h;
  const handY = 0.483 * h - PALM_DROP;
  const clear = (from: number, need: number, drop: number) =>
    Math.asin(THREE.MathUtils.clamp((need - from) / drop, 0, 0.6));
  const hands = (outer: number) =>
    clear(shoulderX + 0.02, outer + PALM_HALF + 0.008, shoulderY - handY);
  const bare = Math.max(
    hands(hipJoint + thighTop * 0.95),
    clear(shoulderX + 0.012, waist + 0.004 + foreR * 1.1 + 0.006, shoulderY - 0.629 * h),
    // The upper arm beside the ribs under the bust, resting a quarter of its round against
    // them as a relaxed arm does (it was held clear of the bust's full width: arms out, Phú).
    clear(
      shoulderX,
      Math.max(-chestFront(0.69 * h) / deep, jacketAt ? jacketAt(0.69 * h) : 0) + armR * 0.78,
      shoulderY - 0.69 * h,
    ),
  );
  const coatAtHands = hips + 0.032 + (0.053 * (0.61 - handY / h)) / 0.32 + 0.006;
  return {
    parts: out,
    fit: {
      spread: { bare, coat: Math.max(bare, hands(coatAtHands)) },
      thighR: thighTop,
      kneeR,
      skirtLength: (SKIRT_Y - 0.29) * h,
      skirtHem: hips + 0.085,
    },
  };
}

/**
 * The anime look's materials (C-7). `toonGradient`: light in three flat steps (shadow, half,
 * lit), for MeshToonMaterial. `outlineMaterial`: a dark line round the figure — the body drawn
 * again from inside (its back faces), pushed out along its normals by `width` (m).
 */
export function toonGradient(tones: readonly number[] = [120, 190, 255]): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(tones), tones.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A cloth's toon material (C-10): its folds (vertex colour below 1) drawn darker on a light cloth
 * and lighter on a dark one — on black a darker line would not show; anime draws it light there.
 */
export function clothMaterial(color: string, gradientMap: THREE.Texture): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap, vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#if defined( USE_COLOR )
        float fold = 1.0 - vColor.r;
        float light = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
        diffuseColor.rgb = light < 0.045
          ? diffuseColor.rgb + fold * 0.22
          : diffuseColor.rgb * vColor.rgb;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'body-cloth';
  return material;
}

export function outlineMaterial(color: string, width: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  // Its width a uniform: an outline can swell (a person lit up on the character page).
  const uniform = { value: width };
  material.userData.outlineWidth = uniform;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = uniform;
    shader.vertexShader = `uniform float outlineWidth;
${shader.vertexShader.replace(
  '#include <skinning_vertex>',
  `#include <skinning_vertex>
      transformed += normalize( objectNormal ) * outlineWidth;`,
)}`;
  };
  material.customProgramCacheKey = () => 'body-outline';
  return material;
}

/** Sets an outline material's width (m). */
export function setOutlineWidth(material: THREE.Material, width: number): void {
  const uniform = material.userData.outlineWidth as { value: number } | undefined;
  if (uniform) uniform.value = width;
}

const BONE_INDEX = new Map(BONES.map((name, i) => [name, i]));

/** Skins `geometry` by `weigh` at each vertex: its four largest shares, adding up to 1. */
function skin(
  geometry: THREE.BufferGeometry,
  weigh: Weigh,
  shade = 1,
  textured = false,
): THREE.BufferGeometry {
  // No textures on the body but the photo's: texture coordinates would only cost memory (and the
  // face's sculpted parts have none, which every merged part must match).
  if (!textured) geometry.deleteAttribute('uv');
  const position = geometry.getAttribute('position');
  const count = position.count;
  // Every part a vertex colour (white: its material's own; a fold darker), for the materials'
  // `vertexColors`.
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(shade), 3),
  );
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const p = new THREE.Vector3();
  const shares: Influence[] = [];
  for (let i = 0; i < count; i++) {
    shares.length = 0;
    weigh(p.fromBufferAttribute(position, i), shares);
    shares.sort((a, b) => b[1] - a[1]);
    let total = 0;
    for (let k = 0; k < 4 && k < shares.length; k++) total += shares[k]?.[1] ?? 0;
    for (let k = 0; k < 4 && k < shares.length; k++) {
      const [bone, w] = shares[k] ?? ['root', 0];
      skinIndex[i * 4 + k] = BONE_INDEX.get(bone) ?? 0;
      skinWeight[i * 4 + k] = total > 0 ? w / total : 0;
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

/** Surfaces too small to matter in a shadow (left out of the shadow-only mesh). */
const NO_SHADOW = new Set<Surface>([
  'eyeWhite',
  'iris',
  'mouth',
  'blush',
  'accent',
  'trim',
  'coatTrim',
  'goggles',
  'shield',
  'outerTrim',
  'bandage',
  'photo',
]);

/**
 * Builds the skeleton and the meshes; materials by surface (the caller's, shared by its meshes),
 * `shadowMaterial` for the shadow-only meshes (it writes no colour).
 */
export function buildBody(
  shape: BodyShape,
  materials: Readonly<Record<Surface, THREE.Material>>,
  shadowMaterial: THREE.Material,
  outline?: THREE.Material,
): BodyModel {
  const at = joints(shape);
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    const parent = PARENT[name];
    const p = at[name];
    const q = parent ? at[parent] : ([0, 0, 0] as const);
    bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (parent) bones[parent].add(bone);
    bones[name] = bone;
  }
  const root = bones.root;
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((name) => bones[name]));

  const groups = new Map<string, THREE.BufferGeometry[]>();
  const shadowBody: THREE.BufferGeometry[] = [];
  const shadowCoat: THREE.BufferGeometry[] = [];
  const blends = new Map<BoneName, Weigh>();
  const { parts, fit } = partsOf(shape);
  for (const part of parts) {
    const blend = blends.get(part.bone) ?? blendOf(part.bone, at);
    blends.set(part.bone, blend);
    const geometry = skin(part.geometry, part.weigh ?? blend, part.shade, part.surface === 'photo');
    const key = `${part.surface}|${part.self ? 'self' : 'seen'}`;
    groups.set(key, [...(groups.get(key) ?? []), geometry]);
    // Folds lie on their cloth: never in a shadow or an outline of their own.
    if (part.shade !== undefined) continue;
    if (part.surface === 'coat') shadowCoat.push(geometry.clone());
    else if (part.shadow || !NO_SHADOW.has(part.surface)) shadowBody.push(geometry.clone());
  }
  const meshes: THREE.SkinnedMesh[] = [];
  for (const [key, list] of groups) {
    const [surface, seen] = key.split('|') as [Surface, string];
    const geometry = mergeGeometries(list);
    for (const g of list) g.dispose();
    const mesh = new THREE.SkinnedMesh(geometry, materials[surface]);
    mesh.name = `body-${surface}`;
    mesh.userData.surface = surface;
    if (seen === 'self') mesh.layers.set(SELF_LAYER);
    mesh.frustumCulled = false; // it is around the camera: always drawn when shown
    meshes.push(mesh);
  }
  const shadowOf = (list: THREE.BufferGeometry[], name: string) => {
    const mesh = new THREE.SkinnedMesh(mergeGeometries(list), shadowMaterial);
    for (const g of list) g.dispose();
    mesh.name = name;
    mesh.layers.set(SHADOW_LAYER);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  };
  const shadows = {
    body: shadowOf(shadowBody, 'body-shadow'),
    coat: shadowOf(shadowCoat, 'body-shadow-coat'),
  };
  const group = new THREE.Group();
  const outlineOf = (of: THREE.SkinnedMesh, name: string) => {
    const mesh = new THREE.SkinnedMesh(of.geometry, outline);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  };
  const outlines = outline
    ? {
        body: outlineOf(shadows.body, 'body-outline'),
        coat: outlineOf(shadows.coat, 'body-outline-coat'),
      }
    : null;
  const extra = outlines ? [outlines.body, outlines.coat] : [];
  group.add(root, ...meshes, shadows.body, shadows.coat, ...extra);
  group.updateMatrixWorld(true);
  for (const mesh of [...meshes, shadows.body, shadows.coat, ...extra]) mesh.bind(skeleton);
  return { group, root, bones, skeleton, meshes, shadows, fit, outlines };
}
