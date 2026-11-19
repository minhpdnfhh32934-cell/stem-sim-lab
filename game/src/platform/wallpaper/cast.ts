import * as THREE from 'three';
import characters from '../../content/characters.json';
import { type CharacterDefinition, CharacterDefinitionSchema } from '../../gameplay/character';
import { Actor } from '../render/body/actor';
import { type BoneName, setOutlineWidth } from '../render/body/BodyModel';
import { HUG_EASE, SIT_IN, TOGETHER } from './cycle';
import { Director, type Playing } from './director';
import { at, footAt, smooth, type Steps, type Track } from './keys';
import { jointCaps } from './caps';
import { type Build, type Capsule, depthIn, type Part, Solids } from './contact';
import { dressUp, type Neon } from './look';
import { type KhoaAction, KHOA_CLIPS, type LinhAction, LINH_CLIPS, type Pose } from './poses';
import { blackCard, karambit, type Prop } from './props';
import { HairDrape } from './drape';
import { BustPress } from './press';
import { type Intent, LIMB_NAMES, type LimbName, makeIntent, Rig } from './rig';
import { STUNT } from './prologue/plan';
import { HANG, HANG_OUT, SKID_S, type StuntFrame } from './prologue/stunt';
import { LEDGE } from './rooftop';
import { wander } from './spring';

/*
 * Linh and Khoa on the roof (Phase W): the game's two, raised for the wallpaper — rim light, hair
 * and clothes in the wind (`look.ts`), each body twice (day clothes; glowing night ones, swapped by
 * a scan of light), moved by `rig.ts`: springs on every joint, limbs solved to what they touch.
 *
 * What they do is written here as intents, every frame:
 * - Linh sits on the ledge, legs over the drop swinging unevenly, palms flat on the ledge beside
 *   her; she leans back, leans on her knees, spins her karambit, stretches, hugs a knee (night).
 * - Khoa stands, his feet planted, his weight shifting, hands in his pockets; he flips his black
 *   card (its hologram by night), kicks a pebble, glances at the lab, rolls his neck; when he has
 *   stood long his legs tire: he walks to the ledge, sits on it, lies back along it and lays his
 *   head on Linh's lap, and she strokes his hair; later he gets up.
 * - At sunset he walks to the ledge, steps up onto it and sits down by her; she leans her head on
 *   his shoulder and puts her arm round his back, his left hand on her waist (Phú). Later he lets
 *   go, gets up and steps back down.
 * - The blast turns them both to the lab.
 * Every contact is solved on the real skeletons (`ik.ts`): feet on the roof or the ledge, palms on
 * the ledge, her thigh or his hair, a hand at a waist; where they rest on each other (her head on
 * his shoulder, his head on her lap) the pose is solved once, from the bodies, when they are made.
 */

export interface CastFrame {
  /** Where the lab is (world): what they look at. */
  readonly lab: THREE.Vector3;
  /** 0 day … 1 night: what they choose to do, the props' glow, the rim's colour. */
  readonly night: number;
  /** 0 day clothes … 1 night clothes; between, the scan has reached that far up. */
  readonly outfit: number;
  /** Towards the light (world). */
  readonly sun: THREE.Vector3;
  /** The wind (world). */
  readonly wind: THREE.Vector3;
  readonly camera: THREE.Camera;
  /** Seconds into the sunset scene (`cycle.ts`), or −1. */
  readonly together: number;
  /** Whether Khoa may go and lie down now (no sunset scene coming soon). */
  readonly canLap: boolean;
  /** How big one pixel of the picture is a metre from the eye (m): the ink drawn to a width on it. */
  readonly inkPx: number;
  /** The opening's stunt (prologue/): Khoa's part of it, or none. */
  readonly stunt: StuntFrame | null;
  /** What Linh watches instead of her own choice (the opening's rocket, Khoa landing), or none. */
  readonly attention: THREE.Vector3 | null;
}

export interface Cast {
  readonly group: THREE.Group;
  update(dt: number, time: number, frame: CastFrame): void;
  /** The blast: both turn to it. */
  startle(time: number): void;
  /** Both put where the scene has them at once at the next update (a scene jumped to). */
  snap(): void;
  /** What the tests measure: the bodies showing, and how far into each scene they are. */
  readonly probe: {
    readonly linh: () => Actor;
    readonly khoa: () => Actor;
    readonly scene: () => { hug: number; lap: number; chat: number; sit: number; acts: string };
    /** Her bust as it gives way, and the bodies as solids (0 hers, 1 his). */
    readonly bust: () => BustPress | null;
    readonly solids: () => readonly (readonly Capsule[])[];
  };
  dispose(): void;
}

/** Where Linh sits, Khoa stands and sits (the roof's frame). */
const LINH_AT = { x: 0.35, z: -0.12 } as const;
const KHOA_STAND = { x: 1.05, z: 0.5, heading: 0.32 } as const;
const KHOA_SEAT = { x: 0.76, z: -0.12 } as const;
/** How far she moves over to him for the hug (m): close enough for her chest to rest on his side. */
const HUG_SCOOT = 0;
/** The scan's travel (world y): from below Linh's hanging feet to over Khoa's head. */
const SCAN = { from: -0.65, to: 2.0 } as const;
/** The ledge's top, its middle (z) and how high a palm's wrist rides over a surface. */
const TOP = LEDGE.top;
const LEDGE_MID = (LEDGE.outer + LEDGE.inner) / 2;
const WRIST = 0.03;

const LINH_DAY: readonly LinhAction[] = ['lean', 'hair', 'forward', 'chat', 'karambit', 'stretch'];
const LINH_NIGHT: readonly LinhAction[] = ['knee', 'hair', 'chat', 'karambit', 'lean'];
/** Hers while he is not there to talk to (the opening: he is in the rocket). */
const LINH_ALONE: readonly LinhAction[] = LINH_DAY.filter((a) => a !== 'chat');
const KHOA_DAY: readonly KhoaAction[] = ['card', 'kick', 'glance', 'neck', 'tired'];
const KHOA_NIGHT: readonly KhoaAction[] = ['holo', 'kick', 'glance', 'neck', 'tired'];
/** His menus when he may not go and lie down (the sunset scene near). */
const KHOA_DAY_STAY = KHOA_DAY.filter((a) => a !== 'tired');
const KHOA_NIGHT_STAY = KHOA_NIGHT.filter((a) => a !== 'tired');
/** Lying with his head on her lap: how long he takes to get there, and how long he stays. */
const LAP_IN = 8;
const LAP_HOLD = 44;

function definition(id: string): CharacterDefinition {
  const raw = (characters as unknown[]).find((c) => (c as { id?: string }).id === id);
  if (!raw) throw new Error(`no character ${id}`);
  return CharacterDefinitionSchema.parse(raw);
}

/**
 * Linh as the wallpaper draws her (Phú, after a reference render he likes): her hair long past
 * her shoulders (waved and drawn in strands by look.ts), her figure curvier — a slimmer waist,
 * fuller hips and bust, slighter limbs. Her clothes and colours stay hers; the game's Linh is
 * unchanged.
 */
function wallpaperLinh(c: CharacterDefinition): CharacterDefinition {
  return {
    ...c,
    appearance: {
      ...c.appearance,
      hair: 'long',
      waistM: 0.205,
      hipM: 0.405,
      bustM: 0.05,
      build: 0.9,
    },
  };
}

/** Their night clothes: black, trimmed in neon (the trims glow). */
function nightOf(
  c: CharacterDefinition,
  clothes: Partial<CharacterDefinition['appearance']['clothes']>,
): CharacterDefinition {
  return {
    ...c,
    appearance: { ...c.appearance, clothes: { ...c.appearance.clothes, ...clothes } },
  };
}

/** Their thicknesses as solids (m; `contact.ts`), from their bodies: hers slighter, his broader. */
const LINH_BUILD: Build = {
  // (Measured in her clothes: her back 0.15 m behind the chest bone's axis, her flanks ~0.19 out;
  // the bust in front gives way instead, `press.ts`.)
  trunk: 0.13,
  apart: 0.06,
  head: 0.1,
  upperArm: 0.042,
  foreArm: 0.036,
  thigh: 0.068,
  shin: 0.05,
};
const KHOA_BUILD: Build = {
  // (Measured in his jacket: 0.15 m behind the chest bone's axis, 0.17 before it, ~0.19 out.)
  trunk: 0.15,
  apart: 0.045,
  head: 0.105,
  upperArm: 0.048,
  foreArm: 0.04,
  thigh: 0.072,
  shin: 0.052,
};

/** Parts not of the trunk (for what may only keep clear of a trunk). */
const notTrunk = (_list: number, part: Part): boolean => part !== 'belly' && part !== 'chest';

/** The ink line's width on the picture (px; Phú's reference: bold, as drawn). */
const INK_PX = 2.6;

/** The surfaces that glow on the night clothes. */
const NEON = new Set(['outerTrim', 'accent']);

/** One of the two: both bodies, their rig, look, props and scan ring. */
class Person<A extends string> {
  readonly day: Actor;
  readonly night: Actor;
  readonly rig: Rig;
  readonly looks: ReturnType<typeof dressUp>[];
  readonly props: [Prop, Prop];
  readonly ring: THREE.Mesh;
  readonly caps: THREE.SkinnedMesh[];
  /** Her bust giving way where pressed (none for him). */
  readonly press: BustPress | null;
  /** Her long hair hanging and lying on what is under it (none for him). */
  readonly drape: HairDrape | null;
  readonly intent: Intent = makeIntent();
  /** Body measures from the bind pose (m). */
  readonly hipY: number;
  readonly hipX: number;
  readonly ankleY: number;

  constructor(
    /** The two bodies, in day and night clothes (each built in a step of its own: `castSteps`). */
    [day, night]: [Actor, Actor],
    makeProp: () => Prop,
    readonly director: Director<A>,
    ringMaterial: THREE.Material,
    neon: Neon,
    /** Long hair in waves and strands (her). */
    strands = false,
  ) {
    this.day = day;
    this.night = night;
    // Elbows and knees kept whole when bent far (caps.ts), made while the bodies are unmoved.
    this.caps = [...jointCaps(this.day), ...jointCaps(this.night)];
    this.press = BustPress.of(this.day);
    this.drape = strands ? new HairDrape(this.day) : null;
    this.looks = [
      dressUp(this.day, undefined, this.press?.uniforms, this.drape?.uniforms),
      dressUp(this.night, neon, this.press?.uniforms, this.drape?.uniforms),
    ];
    for (const actor of [this.day, this.night]) {
      actor.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
    // Waved hair takes no shadow: its waves stand out of the shadow its unwaved self casts, and
    // that showed as bright patches. (It is lit by its own turn to the light, as toon hair is.)
    if (strands) {
      for (const actor of [this.day, this.night]) {
        for (const mesh of actor.model.meshes) {
          if (mesh.userData.surface === 'hair') mesh.receiveShadow = false;
        }
      }
    }
    for (const mesh of this.night.model.meshes) {
      if (!NEON.has(mesh.userData.surface as string)) continue;
      const m = mesh.material as THREE.MeshToonMaterial;
      m.emissive.copy(m.color);
      // The trims burn; the small accents (earrings, laces) glow less, or an earring reads as an eye.
      m.emissiveIntensity = mesh.userData.surface === 'accent' ? 0.9 : 2.6;
    }
    this.props = [makeProp(), makeProp()];
    this.day.model.bones.handR.add(this.props[0].group);
    this.night.model.bones.handR.add(this.props[1].group);
    this.rig = new Rig(this.day, this.night);
    for (const p of this.props) this.rig.held.add(p.group);
    this.ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.03, 48, 1, true),
      ringMaterial,
    );
    this.ring.visible = false;
    const b = this.day.model.bones;
    const v = new THREE.Vector3();
    this.hipY = b.thighL.getWorldPosition(v).y;
    this.hipX = Math.abs(b.thighR.getWorldPosition(v).x);
    this.ankleY = b.footL.getWorldPosition(v).y;
  }

  /** Every material of both bodies clipped by its own plane (the scan). */
  clipBy(dayPlane: THREE.Plane, nightPlane: THREE.Plane): void {
    for (const [actor, plane] of [
      [this.day, dayPlane],
      [this.night, nightPlane],
    ] as const) {
      actor.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          (m as THREE.Material).clippingPlanes = [plane];
        }
      });
    }
  }

  /** The body showing (its bones are this frame's). */
  get body(): Actor {
    return this.day.group.visible ? this.day : this.night;
  }

  /** Where a bone of the showing body is (world, into `out`). */
  bone(name: BoneName, out: THREE.Vector3): THREE.Vector3 {
    return this.body.model.bones[name].getWorldPosition(out);
  }

  dispose(): void {
    this.day.dispose();
    this.night.dispose();
    for (const p of this.props) p.dispose();
    this.ring.geometry.dispose();
    for (const g of new Set(this.caps.map((c) => c.geometry))) g.dispose();
  }
}

/** Sets a joint's angles in a pose (its array reused). */
function put(pose: Pose, bone: BoneName, x: number, y: number, z: number): void {
  const v = pose[bone];
  if (v) {
    v[0] = x;
    v[1] = y;
    v[2] = z;
    v[3] = 1;
  } else pose[bone] = [x, y, z, 1];
}

/** Lays an action's pose over the rest: each joint it sets weighed in by `w`. */
function lay(pose: Pose, bone: BoneName, x: number, y: number, z: number, w: number): void {
  const v = pose[bone];
  if (!v || v[3] !== 1) {
    put(pose, bone, x * w, y * w, z * w);
    return;
  }
  v[0] += (x - v[0]) * w;
  v[1] += (y - v[1]) * w;
  v[2] += (z - v[2]) * w;
}

/** Turns (x, z) by a heading (rad: 0 faces −z, + to the left), as a body's frame turns. */
function turn(x: number, z: number, heading: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return out.set(x * c + z * s, 0, -x * s + z * c);
}

/** A reach's hand flat, palm down on a surface, its fingers along `fingers` (world, level). */
function palmDown(intent: Intent, name: 'handL' | 'handR', fingers: THREE.Vector3): void {
  const r = intent.reaches[name];
  r.along?.copy(fingers);
  // The right palm faces the hand's −x, the left its +x (the body's bind pose): x up or down.
  r.xAxis?.set(0, name === 'handR' ? 1 : -1, 0);
  intent.turned[name] = true;
  // Flat on it: the fingers all but straight (curled, the index read as pointing), as much as
  // the hand is on it.
  const shape = intent.hands[name === 'handR' ? 'R' : 'L'];
  shape.curl += (0.1 - shape.curl) * r.weight;
  shape.thumb += (0.12 - shape.thumb) * r.weight;
}

/** A reach's foot flat on the ground, its toes along `toes` (world, level). */
function footFlat(intent: Intent, name: 'footL' | 'footR', toes: THREE.Vector3): void {
  const r = intent.reaches[name];
  r.along?.set(0, -1, 0);
  // The foot's +x is the body's right: square to the toes, level.
  r.xAxis?.set(-toes.z, 0, toes.x);
  intent.turned[name] = true;
}

/** `lapAt`, `chatAt`: when Khoa lies down, Linh turns to talk, anyway (s; stills of those scenes). */
/** Props made for the two (tests give plain ones: no canvas there). */
export interface Props {
  readonly karambit: () => Prop;
  readonly card: () => Prop;
}

export function cast(
  debug: { lapAt?: number; chatAt?: number } = {},
  props: Props = { karambit, card: blackCard },
): Cast {
  const steps = castSteps(debug, props);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/**
 * The same, built a step at a time, `step` awaited between (the game's menu: a frame given back each
 * time; each body is a tenth of a second or more of work, and all four at once froze the menu).
 */
export async function castAsync(
  debug: { lapAt?: number; chatAt?: number },
  props: Props,
  step: () => Promise<void>,
): Promise<Cast> {
  const steps = castSteps(debug, props);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    await step();
  }
}

/** The two and their scenes, made in steps (a `yield` between): `cast` and `castAsync` run it. */
function* castSteps(
  debug: { lapAt?: number; chatAt?: number },
  props: Props,
): Generator<void, Cast> {
  const scene = { hug: 0, lap: 0, chat: 0, sit: -1, acts: '' };
  let chatForced = false;
  const group = new THREE.Group();
  group.name = 'wallpaper-cast';
  const shadows: THREE.Material[] = [];
  const shadow = () => {
    const m = new THREE.MeshBasicMaterial({ colorWrite: false });
    shadows.push(m);
    return m;
  };
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#7ff6ff',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const linhDef = wallpaperLinh(definition('intern-linh'));
  const khoaDef = definition('researcher-male');
  const linhDay = new Actor(linhDef, shadow(), 5);
  yield;
  const linhNight = new Actor(
    nightOf(linhDef, {
      top: '#0d0e12',
      bottom: '#121318',
      shoes: '#111216',
      accent: '#19e6ff',
      jacketColour: '#15161d',
      jacketTrim: '#ff2fd0',
    }),
    shadow(),
    5,
  );
  yield;
  const linh = new Person<LinhAction>(
    [linhDay, linhNight],
    props.karambit,
    new Director(LINH_CLIPS, 11, [7, 16], 4),
    ringMaterial,
    { color: '#ff2fd0', sleeves: true },
    true,
  );
  yield;
  const khoaDay = new Actor(khoaDef, shadow(), 6);
  yield;
  const khoaNight = new Actor(
    nightOf(khoaDef, {
      top: '#16181d',
      bottom: '#14161b',
      shoes: '#101114',
      accent: '#ff3b8b',
      jacketColour: '#0f1116',
      jacketTrim: '#19f0ff',
    }),
    shadow(),
    6,
  );
  yield;
  const khoa = new Person<KhoaAction>(
    [khoaDay, khoaNight],
    props.card,
    new Director(KHOA_CLIPS, 23, [6, 14], 7),
    ringMaterial,
    { color: '#19f0ff', sleeves: false },
  );
  // Their bodies as solids, each keeping its reaching limbs out of its own and the other's.
  const linhSolids = new Solids(LINH_BUILD);
  const khoaSolids = new Solids(KHOA_BUILD);
  linh.rig.solids = { own: linhSolids, other: khoaSolids };
  khoa.rig.solids = { own: khoaSolids, other: linhSolids };
  const pressing = [linhSolids.capsules, khoaSolids.capsules] as const;
  const dayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100);
  const nightPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -100);
  for (const p of [linh, khoa]) {
    p.clipBy(dayPlane, nightPlane);
    group.add(p.day.group, p.night.group, p.ring);
  }
  khoa.ring.scale.setScalar(0.85);
  const linhSeatY = TOP - linh.hipY + 0.085;
  const khoaSeatY = TOP - khoa.hipY + 0.085;

  // Khoa's pebble: where it rests by his right foot, and how it moves once kicked.
  const pebble = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.035, 1),
    new THREE.MeshStandardMaterial({ color: '#4f4a44', roughness: 0.95, flatShading: true }),
  );
  pebble.scale.set(1.2, 0.75, 1);
  pebble.castShadow = true;
  group.add(pebble);
  const home = new THREE.Vector3(KHOA_STAND.x + 0.1, 0.026, KHOA_STAND.z - 0.32);
  pebble.position.copy(home);
  const pebbleV = new THREE.Vector2();
  let restSince = 0;
  let kicked = false;

  // Scratch (nothing allocated per frame).
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const foot = { x: 0, y: 0, z: 0 };
  const sunView = new THREE.Vector3();
  const windLocal = new THREE.Vector3();
  const dayRim = new THREE.Color('#ffd7a3');
  const nightRim = new THREE.Color('#78d8ff');
  const UP = new THREE.Vector3(0, 1, 0);
  const lookAt = { linh: new THREE.Vector3(), khoa: new THREE.Vector3() };
  const qTmp = new THREE.Quaternion();
  const held = new THREE.Vector3();
  const heldPole = new THREE.Vector3();
  const sideOf = new THREE.Vector3();
  const frontOf = new THREE.Vector3();
  const over = new THREE.Vector3();

  // ── Khoa's walks and climbs, as keyframes (the roof's frame) ──────────────────────────────
  const standFeet = (side: -1 | 1): [number, number, number] => {
    turn(side * khoa.hipX, 0, KHOA_STAND.heading, v1);
    return [KHOA_STAND.x + v1.x, khoa.ankleY, KHOA_STAND.z + v1.z];
  };
  const A = khoa.ankleY;
  const onLedge = TOP + A;
  /** To the ledge by her, up onto it, and down to sit (played backwards to get up). */
  const SIT = {
    x: [
      [0, KHOA_STAND.x],
      [1.8, 0.8],
      [4.6, 0.78],
      [6.4, KHOA_SEAT.x],
    ] as Track,
    z: [
      [0, KHOA_STAND.z],
      [1.8, 0.34],
      [2.6, 0.34],
      [3.3, 0.31],
      [3.6, 0.06],
      [4.6, -0.17],
      [5.4, -0.16],
      [6.4, KHOA_SEAT.z],
    ] as Track,
    y: [
      [0, 0],
      [1.8, 0],
      [2.6, -0.06],
      [3.6, 0.06],
      [4.6, onLedge - 0.36],
      [5.3, onLedge - 0.62],
      [6.4, khoaSeatY],
    ] as Track,
    heading: [
      [0, KHOA_STAND.heading],
      [1.8, 0],
    ] as Track,
    lean: [
      [0, 0.02],
      [2.0, 0.08],
      [2.6, 0.38],
      [4.6, 0.3],
      [5.4, 0.2],
      [6.4, 0.06],
    ] as Track,
    look: [
      [0, 0],
      [1.6, 0.2],
      [2.4, -0.55],
      [4.6, -0.5],
      [5.6, -0.2],
      [6.6, 0],
    ] as Track,
    pocket: [
      [0, 1],
      [0.6, 1],
      [1.4, 0],
    ] as Track,
    hands: [
      [0, 0],
      [1.6, 0],
      [2.4, 1],
      [4.6, 1],
      [4.9, 0.6],
      [5.4, 1],
      [7.2, 1],
    ] as Track,
    sitLegs: [
      [0, 0],
      [5.0, 0],
      [6.4, 1],
    ] as Track,
    feet: [
      [0, 1],
      [5.2, 1],
      [6.3, 0],
    ] as Track,
    footL: {
      start: standFeet(-1),
      lift: 0.12,
      steps: [
        { from: 0.2, to: 0.9, at: [0.7, A, 0.4] },
        { from: 3.8, to: 4.6, at: [0.68, onLedge, -0.2], lift: 0.36 },
        { from: 5.0, to: 6.0, at: [0.66, TOP - 0.1, -0.66], lift: 0.22 },
      ],
    } as Steps,
    footR: {
      start: standFeet(1),
      lift: 0.12,
      steps: [
        { from: 0.9, to: 1.6, at: [0.9, A, 0.38] },
        { from: 2.8, to: 3.6, at: [0.9, onLedge, -0.18], lift: 0.36 },
        { from: 5.0, to: 6.0, at: [0.88, TOP - 0.1, -0.66], lift: 0.22 },
      ],
    } as Steps,
  };
  /** To the ledge, sat on it facing the roof, then back along it, head on her lap. */
  const lap = { x: 2.1, y: TOP + 0.11, z: LEDGE_MID, neck: 0.3 };
  const LAP = {
    x: [
      [0, KHOA_STAND.x],
      [2.2, 0.98],
      [3.4, 0.98],
      [4.0, 0.98],
      [6.6, 0],
    ] as [number, number][],
    z: [
      [0, KHOA_STAND.z],
      [2.2, 0.4],
      [3.4, -0.08],
      [4.0, -0.1],
      [6.6, 0],
    ] as [number, number][],
    y: [
      [0, 0],
      [2.2, 0],
      [3.4, khoaSeatY],
      [4.0, khoaSeatY],
      [6.6, 0],
    ] as [number, number][],
    heading: [
      [0, KHOA_STAND.heading],
      [1.1, 1.7],
      [2.2, Math.PI],
      [4.0, Math.PI],
      [6.6, 1.5 * Math.PI],
    ] as Track,
    pitch: [
      [0, 0],
      [4.0, 0],
      [6.6, Math.PI / 2],
    ] as Track,
    sit: [
      [0, 0],
      [2.3, 0],
      [3.4, 1],
      [4.0, 1],
      [5.4, 0],
    ] as Track,
    lie: [
      [0, 0],
      [4.0, 0],
      [6.6, 1],
    ] as Track,
    pocket: [
      [0, 1],
      [0.4, 1],
      [1.2, 0],
    ] as Track,
    // The hands: on the ledge as he sits and lowers himself (from 3.2), carried onto his belly as
    // he turns to lie (`chest`); held all the way (a hand let go swung through him).
    hands: [
      [0, 0],
      [2.4, 0],
      [3.2, 1],
    ] as Track,
    chest: [
      [0, 0],
      [3.6, 0],
      [4.6, 1],
    ] as Track,
    feet: [
      [0, 1],
      [8, 1],
    ] as Track,
    footL: {
      start: standFeet(-1),
      lift: 0.1,
      steps: [{ from: 1.0, to: 1.7, at: [1.1, A, 0.4] }],
    } as Steps,
    footR: {
      start: standFeet(1),
      lift: 0.1,
      steps: [
        { from: 0.3, to: 1.0, at: [0.95, A, 0.62] },
        { from: 1.7, to: 2.3, at: [0.86, A, 0.38] },
      ],
    } as Steps,
  };

  // ── The poses where they rest on each other, solved once on the bodies ───────────────────
  // Her head on his shoulder: her spine, neck and head tilted until her right temple rests on his
  // left shoulder (sat by her), her head kept clear of his neck.
  const hugLean = {
    spine: -0.04,
    chest: -0.05,
    neck: -0.24,
    head: -0.38,
    pitch: 0.04,
    twist: 0,
    roll: 0,
    // Where she sits for it (m): a little ahead of him (her shoulder before his, his arm round
    // behind her) and over to him.
    ahead: 0,
    over: 0,
  };
  // His head on her lap: lying along the ledge, his back on it, the back of his head on her right
  // thigh; where he lies and how far his neck bends.
  yield;
  solveRests();

  /** Poses a body directly (no springs): its place, its joints. */
  function setBody(
    p: Person<string>,
    x: number,
    y: number,
    z: number,
    heading: number,
    pitch: number,
    pose: Pose,
  ): void {
    const a = p.day;
    a.group.position.set(x, y, z);
    a.group.rotation.set(pitch, heading, 0, 'YXZ');
    for (const k in pose) {
      const t = pose[k as BoneName];
      if (t && t[3] === 1) a.model.bones[k as BoneName].rotation.set(t[0], t[1], t[2]);
    }
    a.group.updateMatrixWorld(true);
  }

  function solveRests(): void {
    const pose: Pose = {};
    // Linh sat, still (as when he lies on her lap).
    linhSitPose(pose, 0, 0);
    setBody(linh, LINH_AT.x, linhSeatY, LINH_AT.z, 0, 0, pose);
    const kb = khoa.day.model.bones;
    const lb = linh.day.model.bones;
    // Her right thigh's top, a hand's breadth from her hip: where his head goes.
    lb.thighR.getWorldPosition(v1);
    lb.shinR.getWorldPosition(v2);
    const lapPoint = v3.copy(v2).sub(v1).normalize().multiplyScalar(0.14).add(v1);
    lapPoint.y += 0.085;
    const lapAt = lapPoint.clone();
    const lie: Pose = {};
    for (let it = 0; it < 40; it++) {
      khoaLiePose(lie, 0, lap.neck);
      setBody(khoa, lap.x, lap.y, lap.z, 1.5 * Math.PI, Math.PI / 2, lie);
      // His back on the ledge: the chest's back (0.11 behind its bone) at the ledge's top.
      kb.chest.getWorldPosition(v1);
      lap.y += TOP - (v1.y - 0.11);
      // The back of his head (0.1 towards his crown, 0.095 behind) on her thigh.
      kb.head.getWorldPosition(v1);
      v2.set(0, 0.1, 0.1).applyQuaternion(kb.head.getWorldQuaternion(new THREE.Quaternion()));
      v1.add(v2);
      lap.x += lapAt.x - v1.x;
      lap.z += (lapAt.z - v1.z) * 0.5;
      lap.neck = Math.min(1.1, Math.max(-0.2, lap.neck + (lapAt.y - v1.y) * 2.5));
    }
    for (const k of LAP.y) if (k[0] < 6.6) k[1] += khoa.hipY;
    LAP.x[4] = [6.6, lap.x - khoa.hipY];
    LAP.z[4] = [6.6, lap.z];
    LAP.y[4] = [6.6, lap.y];
    // Sat by her for the hug: her head's lean found against his shoulder.
    khoaSatPose(pose, 0);
    setBody(khoa, KHOA_SEAT.x, khoaSeatY, KHOA_SEAT.z, 0, 0, pose);
    kb.upperArmL.getWorldPosition(v1);
    const shoulder = v1.clone().add(new THREE.Vector3(-0.03, 0.07, 0));
    kb.neck.getWorldPosition(v1);
    const neck = v1.clone();
    khoaSolids.update(khoa.day);
    const cost = () => {
      linhSitPose(pose, 0, 0);
      put(pose, 'spine', -0.1 + hugLean.spine, hugLean.twist, hugLean.spine * 2 + hugLean.roll);
      put(pose, 'chest', 0.06, 0, hugLean.chest);
      put(pose, 'neck', 0.02, 0, hugLean.neck);
      put(pose, 'head', hugLean.pitch, -0.1, hugLean.head);
      setBody(
        linh,
        LINH_AT.x + HUG_SCOOT + hugLean.over,
        linhSeatY,
        LINH_AT.z - hugLean.ahead,
        0,
        0,
        pose,
      );
      lb.head.getWorldPosition(v1);
      v2.set(0.075, 0.085, 0).applyQuaternion(lb.head.getWorldQuaternion(new THREE.Quaternion()));
      const temple = v1.clone().add(v2);
      const head = v1
        .add(v2.multiplyScalar(0))
        .add(
          new THREE.Vector3(0, 0.09, 0).applyQuaternion(
            lb.head.getWorldQuaternion(new THREE.Quaternion()),
          ),
        );
      let c = temple.distanceToSquared(shoulder);
      const clear = 0.16 - head.distanceTo(neck);
      if (clear > 0) c += 40 * clear * clear;
      // Turned in to him, her chest pressed against his side a couple of centimetres (Phú: held
      // close, it gives way there).
      if (linh.press) {
        linh.press.place(linh.day);
        const pressed = linh.press.deepest([[], khoaSolids.capsules]) - 0.024;
        c += 20 * pressed * pressed;
      }
      // Her shoulder by his, not in him; and his shoulder (where his arm goes round her) not in
      // her: leaning on him she had sunk her upper back 4–5 cm into his shoulder and arm.
      lb.upperArmR.getWorldPosition(v1);
      const into = depthIn(v1, LINH_BUILD.upperArm, [khoaSolids.capsules], notTrunk, 0.015);
      c += 40 * into * into;
      // (His shoulder joint only: his arm here hangs as when sat alone; held, it goes round
      // behind her, solved then.)
      linhSolids.update(linh.day);
      kb.upperArmL.getWorldPosition(v1);
      const his = depthIn(v1, KHOA_BUILD.upperArm, [linhSolids.capsules], notTrunk, 0.01);
      c += 40 * his * his;
      return c;
    };
    let best = cost();
    const keys = [
      'spine',
      'chest',
      'neck',
      'head',
      'pitch',
      'twist',
      'roll',
      'ahead',
      'over',
    ] as const;
    const bounds: Partial<Record<(typeof keys)[number], [number, number]>> = {
      ahead: [0, 0.12],
      over: [-0.03, 0.06],
    };
    for (const step of [0.08, 0.04, 0.02, 0.01]) {
      for (let round = 0; round < 30; round++) {
        let moved = false;
        for (const k of keys) {
          for (const dir of [1, -1]) {
            const was = hugLean[k];
            const [lo, hi] = bounds[k] ?? [-0.7, 0.5];
            hugLean[k] = Math.max(lo, Math.min(hi, was + dir * step));
            const c = cost();
            if (c < best - 1e-9) {
              best = c;
              moved = true;
            } else hugLean[k] = was;
          }
        }
        if (!moved) break;
      }
    }
  }

  // ── Poses (joint angles; arms and legs that touch something are solved after) ────────────
  /** Linh sat on the ledge: her thighs along it, her legs over the drop swinging by `swing`. */
  function linhSitPose(pose: Pose, t: number, swing: number): void {
    const breath = Math.sin(t * 1.6) * 0.012;
    // The legs swing out of step and unevenly, as idle legs do.
    const a = swing * (0.6 + 0.4 * wander(t * 0.5, 1));
    // Now and then her ankles cross, the left over the right, and the two swing together.
    const cross = smooth((wander(t * 0.07, 9) - 0.15) / 0.3);
    const r = Math.sin(t * 1.15 + 2.2 + wander(t * 0.3, 5) * 0.8);
    const l = Math.sin(t * 1.15 + wander(t * 0.3, 2) * 0.8) * (1 - cross) + r * cross;
    put(pose, 'hips', 0, 0, 0);
    // Thighs level along the ledge (sloping, their undersides sank into its edge).
    put(pose, 'thighL', 1.5, 0, -0.1 + 0.15 * cross);
    put(pose, 'thighR', 1.53, 0, 0.07 - 0.03 * cross);
    put(pose, 'shinL', Math.max(-1.42, -1.3 + 0.26 * a * l), 0, 0);
    put(pose, 'shinR', Math.max(-1.48, -1.26 + 0.26 * a * r), 0, 0);
    put(pose, 'footL', 0.35 + 0.12 * a * l, 0, 0.05 - 0.2 * cross);
    put(pose, 'footR', 0.38 + 0.12 * a * r, 0, -0.05);
    // Sat tall and easy: the small of her back arched a little, her chest up, her head tipped.
    put(pose, 'spine', -0.11 + breath + 0.02 * wander(t, 3), 0.03 * wander(t * 0.7, 4), 0);
    put(pose, 'chest', 0.09 + breath, 0, 0);
    put(pose, 'neck', 0.04, 0, 0);
    put(pose, 'head', 0.05, 0, -0.08 + 0.04 * wander(t * 0.35, 6));
    put(pose, 'upperArmL', -0.42, 0, -0.26);
    put(pose, 'upperArmR', -0.42, 0, 0.26);
    put(pose, 'foreArmL', 0.12, 0, 0);
    put(pose, 'foreArmR', 0.12, 0, 0);
    put(pose, 'handL', 0, 0, 0);
    put(pose, 'handR', 0, 0, 0);
  }

  /** Khoa standing: his weight on one leg then the other, breathing; legs follow their planted feet. */
  function khoaStandPose(pose: Pose, t: number): void {
    const breath = Math.sin(t * 1.4 + 1) * 0.01;
    put(pose, 'hips', 0, 0.02 * wander(t * 0.4, 7), 0.035 * wander(t * 0.25, 8));
    put(pose, 'spine', 0.02 + breath, 0.03 * wander(t * 0.5, 9), -0.02);
    put(pose, 'chest', breath, 0, 0);
    put(pose, 'neck', 0, 0, 0);
    put(pose, 'head', -0.03, 0, 0);
    put(pose, 'upperArmL', -0.15, 0, -0.15);
    put(pose, 'upperArmR', -0.15, 0, 0.15);
    put(pose, 'foreArmL', 0.4, 0, 0);
    put(pose, 'foreArmR', 0.4, 0, 0);
    put(pose, 'handL', 0, 0, 0);
    put(pose, 'handR', 0, 0, 0);
    for (const b of ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'] as const)
      put(pose, b, 0, 0, 0);
  }

  /** Khoa sat on the ledge by her, legs over the drop. */
  function khoaSatPose(pose: Pose, t: number): void {
    const breath = Math.sin(t * 1.4 + 1) * 0.01;
    const a = 0.4 + 0.3 * wander(t * 0.5, 11);
    put(pose, 'hips', 0, 0, 0);
    put(pose, 'thighL', 1.52, 0, -0.06);
    put(pose, 'thighR', 1.53, 0, 0.06);
    put(pose, 'shinL', -1.3 + 0.12 * a * Math.sin(t * 0.9), 0, 0);
    put(pose, 'shinR', -1.34 + 0.12 * a * Math.sin(t * 0.9 + 2.4), 0, 0);
    put(pose, 'footL', 0.3, 0, 0);
    put(pose, 'footR', 0.3, 0, 0);
    put(pose, 'spine', 0.06 + breath, 0, 0);
    put(pose, 'chest', breath, 0, 0);
    put(pose, 'neck', 0, 0, 0.05);
    put(pose, 'head', -0.02, 0, 0.06);
  }

  /** Khoa lying on his back along the ledge, right knee up, neck bent by `neck` (to her lap). */
  function khoaLiePose(pose: Pose, t: number, neck: number): void {
    const breath = Math.sin(t * 1.3) * 0.014;
    put(pose, 'hips', 0, 0, 0);
    put(pose, 'spine', -0.04 + breath, 0, 0);
    put(pose, 'chest', breath * 0.6, 0, 0);
    put(pose, 'neck', -neck * 0.45, 0, 0);
    put(pose, 'head', -neck * 0.55, 0, 0);
    put(pose, 'thighL', 0.06, 0, -0.03);
    put(pose, 'shinL', -0.1, 0, 0);
    put(pose, 'thighR', 1.0 + 0.04 * wander(t * 0.3, 13), 0, 0.12);
    put(pose, 'shinR', -1.85, 0, 0);
    put(pose, 'footL', -0.6, 0, 0);
    put(pose, 'footR', 0.25, 0, 0);
  }

  // ── Reaches (hands and feet on things) ───────────────────────────────────────────────────
  function reachTo(
    intent: Intent,
    name: LimbName,
    x: number,
    y: number,
    z: number,
    px: number,
    py: number,
    pz: number,
    w: number,
  ): void {
    const r = intent.reaches[name];
    r.target.set(x, y, z);
    r.pole.set(px, py, pz);
    r.weight = w;
    intent.turned[name] = false;
  }

  /**
   * `reachTo` laid over what the limb already reaches for (her palms on the ledge): carried by
   * `w` of the way from there and held all along. (Weighed in from nothing, a hand on its way
   * fell back towards its hanging pose and went through her thigh, his body or the ledge.)
   */
  function reachOver(
    intent: Intent,
    name: LimbName,
    x: number,
    y: number,
    z: number,
    px: number,
    py: number,
    pz: number,
    w: number,
  ): void {
    const r = intent.reaches[name];
    if (r.weight <= 0) {
      reachTo(intent, name, x, y, z, px, py, pz, w);
      return;
    }
    // On its way it arcs up, over what lies between.
    r.target.lerp(over.set(x, y, z), w).y += 0.1 * Math.sin(Math.PI * Math.min(1, w));
    r.pole.lerp(over.set(px, py, pz), w);
    r.weight = Math.max(r.weight, w);
    if (w >= 0.5) intent.turned[name] = false;
  }

  /** Both of Linh's palms flat on the ledge beside her hips, fingers forward and out. */
  function linhHandsOnLedge(intent: Intent, w: number, back: number): void {
    const x = LINH_AT.x;
    reachTo(intent, 'handL', x - 0.25, TOP + WRIST, -0.03 + back, x - 0.6, 1.0, 0.45, w);
    palmDown(intent, 'handL', fwd.set(-0.35, 0, -1).normalize());
    reachTo(intent, 'handR', x + 0.25, TOP + WRIST, -0.03 + back, x + 0.6, 1.0, 0.45, w);
    palmDown(intent, 'handR', fwd.set(0.35, 0, -1).normalize());
  }

  // ── The scenes' state ───────────────────────────────────────────────────────────────────
  /** Khoa's lap scene: when it started (−1: not on), and the 'tired' action that leads to it. */
  let lapStart = -1;
  const gaze = { linhNext: 0, linhAt: 0 };
  const playing = (p: Playing<string> | null, name: string) =>
    p && p.clip.name === name ? p : null;

  function linhIntent(
    t: number,
    frame: CastFrame,
    lp: Playing<LinhAction> | null,
    hug: number,
    lapW: number,
    lapPrep: number,
  ): void {
    const I = linh.intent;
    const pose = I.pose;
    // Held, she has moved over to him (her hip by his).
    I.root.x = LINH_AT.x + (HUG_SCOOT + hugLean.over) * hug;
    I.root.y = linhSeatY;
    I.root.z = LINH_AT.z - hugLean.ahead * hug;
    I.root.heading = 0;
    I.root.pitch = 0;
    I.rootFreq = 4;
    I.gesture = 'idle';
    I.pocket[0] = I.pocket[1] = 0;
    I.hands.L.curl = I.hands.R.curl = 0.32;
    I.hands.L.thumb = I.hands.R.thumb = 0.25;
    const still = Math.max(hug * 0.6, lapW);
    linhSitPose(pose, t, (1 - still) * (1 - 0.8 * (playing(lp, 'knee')?.w ?? 0)));
    linhHandsOnLedge(I, 1, 0);
    for (const n of ['footL', 'footR'] as const) I.reaches[n].weight = 0;
    // Her gaze wanders: mostly the lab, sometimes the streets below, the sky.
    if (t >= gaze.linhNext) {
      gaze.linhAt = (gaze.linhAt + 1 + Math.floor(Math.abs(Math.sin(t * 12.9898)) * 4)) % 5;
      gaze.linhNext = t + 4 + 5 * Math.abs(Math.sin(t * 78.233));
    }
    const target = lookAt.linh;
    if (gaze.linhAt === 1) target.set(LINH_AT.x - 20, -60, -120);
    else if (gaze.linhAt === 2) target.set(frame.lab.x * 0.6, frame.lab.y + 80, frame.lab.z);
    else if (gaze.linhAt === 3) khoa.bone('head', target);
    else target.copy(frame.lab);
    I.look = target;
    I.lookWeight = 0.75;

    const w = lp?.w ?? 0;
    if (lp?.clip.name === 'chat') {
      linhChat(I, t, lp.u * LINH_CLIPS.chat.length);
      return;
    }
    switch (lp?.clip.name) {
      case 'lean':
        lay(pose, 'spine', -0.34, 0, 0, w);
        lay(pose, 'chest', -0.08, 0, 0, w);
        lay(pose, 'head', 0.3, 0, 0, w);
        I.look = v3.set(frame.lab.x * 0.4, frame.lab.y + 300, frame.lab.z);
        break;
      case 'forward':
        lay(pose, 'spine', 0.4, 0, 0, w);
        lay(pose, 'chest', 0.14, 0, 0, w);
        // Forearms on her thighs: the palms on them by her knees.
        linh.bone('shinL', v1);
        linh.bone('shinR', v2);
        reachOver(
          I,
          'handL',
          v1.x + 0.01,
          v1.y + 0.07,
          v1.z + 0.12,
          v1.x - 0.5,
          v1.y + 0.3,
          v1.z + 0.2,
          w,
        );
        palmDown(I, 'handL', fwd.set(0.2, 0, -1).normalize());
        reachOver(
          I,
          'handR',
          v2.x - 0.01,
          v2.y + 0.07,
          v2.z + 0.12,
          v2.x + 0.5,
          v2.y + 0.3,
          v2.z + 0.2,
          w,
        );
        palmDown(I, 'handR', fwd.set(-0.2, 0, -1).normalize());
        I.look = v3.set(LINH_AT.x - 15, -100, -60);
        I.lookWeight = 0.9;
        break;
      case 'karambit': {
        // The right hand up before her chest, the blade turning on her finger; she watches it.
        linh.bone('chest', v1);
        reachOver(
          I,
          'handR',
          v1.x + 0.1,
          v1.y - 0.06,
          v1.z - 0.28,
          v1.x + 0.6,
          v1.y - 0.3,
          v1.z + 0.3,
          w,
        );
        I.turned.handR = false;
        put(pose, 'handR', 0.15 * w, 0.4 * w, -0.25 * w);
        I.hands.R.curl = 0.32 + 0.35 * w;
        I.hands.R.thumb = 0.25 + 0.4 * w;
        I.gesture = 'lance';
        I.look = linh.bone('handR', v3);
        I.lookWeight = 0.9;
        break;
      }
      case 'hair': {
        // A hand through her hair, tucking it behind her right ear; her head tips to it.
        linh.bone('head', v1);
        const sweep = smooth((lp.u - 0.25) / 0.45);
        v2.set(0.08, 0.07 - 0.05 * sweep, 0.03 + 0.04 * sweep).applyQuaternion(
          linh.body.model.bones.head.getWorldQuaternion(qTmp),
        );
        reachOver(
          I,
          'handR',
          v1.x + v2.x,
          v1.y + v2.y,
          v1.z + v2.z,
          v1.x + 0.5,
          v1.y - 0.4,
          v1.z + 0.2,
          w,
        );
        I.hands.R.curl = 0.22;
        I.hands.R.thumb = 0.35;
        lay(pose, 'head', 0.06, 0.12, -0.14, w);
        lay(pose, 'chest', 0.1, -0.05, 0, w);
        I.look = khoa.bone('head', v3);
        I.lookWeight = 0.5 * w;
        break;
      }
      case 'stretch':
        lay(pose, 'spine', -0.16, 0, 0, w);
        lay(pose, 'upperArmL', 2.75, 0, -0.18, w);
        lay(pose, 'upperArmR', 2.75, 0, 0.18, w);
        lay(pose, 'foreArmL', 0.35, 0, 0, w);
        lay(pose, 'foreArmR', 0.35, 0, 0, w);
        lay(pose, 'head', 0.25, 0, 0, w);
        // The palms lifted off the ledge as the arms go up (let go where they were, they swept
        // through it).
        I.reaches.handL.target.y += 0.3 * w;
        I.reaches.handR.target.y += 0.3 * w;
        I.reaches.handL.weight = I.reaches.handR.weight = 1 - w;
        I.hands.L.curl = I.hands.R.curl = 0.32 - 0.2 * w;
        break;
      case 'knee': {
        // Her right knee drawn up, its foot on the ledge, her hands folded on top of it (round
        // the shin, the forearms went through it); the knee up to her chest, not into it (drawn
        // closer, the thigh went through her).
        // Sat back towards the ledge's inner edge for room, the knee fallen a little out to her
        // right, beside her chest.
        I.root.z += 0.05 * w;
        lay(pose, 'thighR', 2.25, 0, 0.2, w);
        lay(pose, 'shinR', -2.3, 0, 0, w);
        lay(pose, 'spine', 0.04, 0, 0, w);
        reachTo(
          I,
          'footR',
          LINH_AT.x + 0.16,
          TOP + linh.ankleY * 0.85 + 0.22 * Math.sin(Math.PI * w),
          -0.37,
          LINH_AT.x + 0.6,
          1.4,
          -0.55,
          w,
        );
        footFlat(I, 'footR', fwd.set(0, 0, -1));
        linh.bone('shinR', v1);
        reachOver(
          I,
          'handL',
          v1.x - 0.03,
          v1.y + 0.1,
          v1.z - 0.01,
          v1.x - 0.5,
          v1.y - 0.15,
          v1.z + 0.1,
          w,
        );
        reachOver(
          I,
          'handR',
          v1.x + 0.05,
          v1.y + 0.09,
          v1.z + 0.01,
          v1.x + 0.5,
          v1.y - 0.15,
          v1.z + 0.1,
          w,
        );
        I.hands.L.curl = I.hands.R.curl = 0.32 + 0.2 * w;
        break;
      }
      case 'startle':
        lay(pose, 'spine', 0.05 - 0.12 * smooth(1 - lp.u * 6), 0, 0, w);
        I.look = frame.lab;
        I.lookWeight = 1;
        I.hands.L.curl = I.hands.R.curl = 0.55;
        break;
      default:
        break;
    }

    // Sat with him: her head on his shoulder, her right arm round his back, her left hand
    // resting on her own thigh.
    if (hug > 0) {
      held.copy(I.reaches.handR.target);
      heldPole.copy(I.reaches.handR.pole);
      lay(
        pose,
        'spine',
        -0.08 + hugLean.spine,
        hugLean.twist,
        hugLean.spine * 2 + hugLean.roll,
        hug,
      );
      lay(pose, 'chest', 0.05, 0, hugLean.chest, hug);
      lay(pose, 'neck', 0.02, 0, hugLean.neck, hug);
      lay(pose, 'head', hugLean.pitch, -0.1, hugLean.head, hug);
      I.lookWeight *= 1 - hug;
      khoa.bone('spine', v1);
      reachTo(
        I,
        'handR',
        // Her palm on the middle of his back, on his jacket (0.15 m behind his spine's axis): her
        // arm bent round behind him. (To his far side, or to his belt, the arm went near straight
        // and its line from her shoulder crossed his flank: through his back, as Phú saw.)
        v1.x,
        v1.y + 0.12,
        v1.z + 0.2 + 0.7 * Math.sin(Math.PI * hug),
        LINH_AT.x + 0.1,
        v1.y - 0.3,
        0.9 + 0.5 * Math.sin(Math.PI * hug),
        hug,
      );
      // Fingers across his back, the palm against it.
      I.reaches.handR.along?.set(1, -0.3, 0).normalize();
      I.reaches.handR.xAxis?.set(0, 0, 1);
      I.turned.handR = true;
      // From the ledge to his back the hand keeps hold of where it is going (released, it swung
      // through him by way of its hanging pose).
      I.reaches.handR.target.lerpVectors(held, I.reaches.handR.target, hug);
      I.reaches.handR.pole.lerpVectors(heldPole, I.reaches.handR.pole, hug);
      I.reaches.handR.weight = 1;
      linh.bone('thighL', v1);
      linh.bone('shinL', v2);
      v1.lerp(v2, 0.55);
      reachOver(
        I,
        'handL',
        v1.x + 0.01,
        v1.y + 0.07 + WRIST * 0.5,
        v1.z + 0.04,
        v1.x - 0.5,
        v1.y + 0.4,
        v1.z + 0.3,
        hug,
      );
      palmDown(I, 'handL', fwd.set(0.25, 0, -1).normalize());
      I.hands.L.curl = 0.28;
      I.hands.R.curl = 0.4 + 0.15 * hug;
    }
    // He is coming to lie by her: her right hand off the ledge (where his shoulders go) onto
    // her own thigh.
    if (lapPrep > 0) {
      linh.bone('thighR', v1);
      linh.bone('shinR', v2);
      v1.lerp(v2, 0.5);
      reachOver(
        I,
        'handR',
        v1.x - 0.01,
        v1.y + 0.085 + WRIST * 0.5,
        v1.z + 0.04,
        v1.x + 0.5,
        v1.y + 0.4,
        v1.z + 0.3,
        lapPrep,
      );
      palmDown(I, 'handR', fwd.set(-0.25, 0, -1).normalize());
    }
    // His head on her lap: her legs still, her right hand stroking his hair, eyes on his face.
    if (lapW > 0) {
      khoa.bone('head', v1);
      const stroke = Math.sin(t * 2.1) * 0.035;
      reachOver(
        I,
        'handR',
        v1.x - 0.05 + stroke,
        v1.y + 0.12,
        v1.z - 0.06,
        LINH_AT.x + 0.15,
        v1.y + 0.45,
        -0.6,
        lapW,
      );
      palmDown(I, 'handR', fwd.set(1, -0.15, 0.05).normalize());
      I.hands.R.curl = 0.25;
      lay(pose, 'spine', 0.14, 0, -0.04, lapW);
      lay(pose, 'head', -0.25, -0.15, -0.05, lapW);
      I.look = v1;
      I.lookWeight = Math.max(I.lookWeight, 0.9 * lapW);
    }
  }

  /** How far round to sit along the ledge she is, `T` s into the chat (0 legs over the drop … 1). */
  function chatSide(T: number): number {
    const L = LINH_CLIPS.chat.length;
    return smooth((T - 1.3) / 1.5) * (1 - smooth((T - (L - 3.2)) / 1.5));
  }

  /**
   * Linh turned to talk to Khoa (Phú): legs drawn up over the ledge's edge, round to sit along it
   * facing him, propped back on her left hand, her right knee up and its foot on the ledge, her
   * left leg along it, loose; her right hand moving with what she says, sometimes resting on her
   * knee. And back again at the end. `T`: seconds into it.
   */
  function linhChat(I: Intent, t: number, T: number): void {
    const L = LINH_CLIPS.chat.length;
    const pose = I.pose;
    const side = chatSide(T);
    // Feet tucked up while she turns (above the ledge: they never pass through it).
    const tuck =
      smooth(T / 0.9) * (1 - smooth((T - 2.9) / 0.6)) +
      smooth((T - (L - 3.7)) / 0.5) * (1 - smooth((T - (L - 1.2)) / 0.9));
    I.root.x = LINH_AT.x - 0.03 * side;
    I.root.y = linhSeatY;
    I.root.z = LINH_AT.z + (LEDGE_MID + 0.01 - LINH_AT.z) * side;
    I.root.heading = (-Math.PI / 2) * side;
    I.root.pitch = 0;
    linhSitPose(pose, t, 1 - Math.max(side, tuck));
    // Leant back a little while her knees are drawn up (upright, they met her chest).
    lay(pose, 'spine', -0.28, 0, 0, tuck);
    lay(pose, 'thighL', 1.95, 0, -0.04, tuck);
    lay(pose, 'thighR', 1.95, 0, 0.04, tuck);
    lay(pose, 'shinL', -0.9, 0, 0, tuck);
    lay(pose, 'shinR', -0.95, 0, 0, tuck);
    const settled = side * (1 - tuck);
    // Along the ledge: her right leg long and loose towards him, toes pointed; her left knee up,
    // fallen out over the drop (on the side she leans on: with the right knee up, her chest and
    // her talking hand went through it, Phú).
    lay(pose, 'thighR', 1.5, 0, 0.04, settled);
    lay(pose, 'shinR', -0.14 - 0.05 * wander(t * 0.4, 31), 0, 0, settled);
    lay(pose, 'footR', 0.55, 0, 0, settled);
    lay(pose, 'thighL', 2.0, 0, -0.3, settled);
    lay(pose, 'shinL', -1.2, 0, 0, settled);
    // Leant back on her left hand, turned to him (her right), her chest lifted.
    const talk = 0.5 + 0.5 * Math.sin(t * 0.85 + 1.3 * wander(t * 0.2, 33));
    lay(pose, 'spine', -0.36, -0.32, 0.06, side);
    lay(pose, 'chest', 0.1, -0.16, 0, side);
    lay(pose, 'neck', 0.02, 0, 0, side);
    lay(
      pose,
      'head',
      0.04 + 0.04 * Math.sin(t * 2.4) * talk,
      0,
      -0.1 + 0.08 * wander(t * 0.7, 35),
      side,
    );
    I.look = khoa.bone('head', lookAt.linh);
    I.lookWeight = 0.95 * side + 0.75 * (1 - side);
    // (Her palms stay on the ledge from where she sat; her hands are carried off it by `side`.)
    // Her left palm behind her on the ledge (by its outer edge), fingers pointing away.
    turn(-0.2, 0.15, I.root.heading, v1);
    if (side > 0.01) {
      reachOver(
        I,
        'handL',
        I.root.x + v1.x,
        TOP + WRIST,
        I.root.z + v1.z,
        I.root.x - 0.5,
        1.0,
        I.root.z - 0.6,
        side,
      );
      palmDown(I, 'handL', fwd.set(-1, 0, -0.25).normalize());
    }
    // Her feet held over the ledge the whole turn, never through it: ahead of her (in her own
    // frame), lifted while tucked; the right reaching out along the ledge as it settles, its heel
    // on it and the knee a little raised; the left drawn in, planted, its knee fallen out to her
    // left (`splay`: where its knee is sent, across).
    const hold = Math.max(tuck, side);
    for (const [name, out, across, splay] of [
      ['footR', 0.5 * (1 - side) + (0.36 + 0.34 * settled) * side, 0.07, 0],
      ['footL', 0.5 * (1 - side) + 0.44 * side, -0.1, -0.45 * side],
    ] as const) {
      turn(across, -out, I.root.heading, v1);
      turn(across + splay, -out - 0.1, I.root.heading, v2);
      const y = TOP + linh.ankleY * 0.75 + 0.08 * tuck;
      reachTo(
        I,
        name,
        I.root.x + v1.x,
        y,
        I.root.z + v1.z,
        I.root.x + v2.x,
        y + 0.6,
        I.root.z + v2.z,
        hold,
      );
    }
    footFlat(I, 'footL', fwd.set(1, 0, 0));
    // Her right hand: with her words, out before her right shoulder towards him (in her own
    // frame), or resting on her long right thigh between them.
    linh.bone('chest', v1);
    linh.bone('thighR', v2);
    linh.bone('shinR', frontOf);
    // Up off her thigh square to it (as the knee draws up the thigh tilts; lifted straight up,
    // the hand sank into it): resting on it, or on top of the knee.
    sideOf.subVectors(frontOf, v2).normalize();
    sideOf.multiplyScalar(-sideOf.y).add(UP).normalize();
    v2.lerp(frontOf, 0.45).addScaledVector(sideOf, 0.085 + WRIST * 0.5);
    frontOf.addScaledVector(sideOf, 0.12);
    const gesture = side * talk;
    const beat = Math.abs(Math.sin(t * 3.1)) * 0.05;
    turn(0.17 + 0.04 * wander(t * 1.6, 37), -0.27 - 0.04 * Math.sin(t * 2.2), I.root.heading, v3);
    const hx = v1.x + v3.x;
    const hy = v1.y - 0.04 + beat + 0.04 * wander(t * 1.1, 38);
    const hz = v1.z + v3.z;
    let rx = hx + (v2.x - hx) * (1 - talk);
    let ry = hy + (v2.y - hy) * (1 - talk);
    let rz = hz + (v2.z - hz) * (1 - talk);
    // While her knees are drawn up to turn, her hand rests on top of the right one (reaching
    // for her words through them, it went into her thigh).
    rx += (frontOf.x - rx) * tuck;
    ry += (frontOf.y - ry) * tuck;
    rz += (frontOf.z - rz) * tuck;
    if (side > 0.01) {
      // The elbow out to her right and down (up, over her knee while it is drawn up).
      turn(0.5, 0.15, I.root.heading, v3);
      reachOver(I, 'handR', rx, ry, rz, v1.x + v3.x, v1.y - 0.4 + 0.55 * tuck, v1.z + v3.z, side);
      I.turned.handR = false;
      put(pose, 'handR', -0.2 * gesture, 0.6 * gesture, -0.3 * gesture);
    }
    I.hands.R.curl = 0.32 - 0.18 * gesture;
    I.hands.R.thumb = 0.25 - 0.1 * gesture;
    I.hands.L.curl = 0.25;
  }

  function khoaIntent(
    t: number,
    frame: CastFrame,
    kp: Playing<KhoaAction> | null,
    sitSeq: number,
    hug: number,
    lapSeq: number,
    listen: number,
  ): void {
    const I = khoa.intent;
    const pose = I.pose;
    I.gesture = 'idle';
    I.rootFreq = 5;
    I.exact = false;
    I.root.frame = null;
    I.hands.L.curl = I.hands.R.curl = 0.35;
    I.hands.L.thumb = I.hands.R.thumb = 0.3;
    for (const n of LIMB_NAMES) I.reaches[n].weight = 0;
    I.look = frame.lab;
    I.lookWeight = 0.4;

    if (sitSeq >= 0) {
      // To the ledge, up onto it, down to sit (or the same backwards).
      const s = sitSeq;
      I.root.x = at(SIT.x, s);
      I.root.y = at(SIT.y, s);
      I.root.z = at(SIT.z, s);
      I.root.heading = at(SIT.heading, s);
      I.root.pitch = 0;
      I.rootFreq = 7;
      const sat = at(SIT.sitLegs, s);
      khoaStandPose(pose, t);
      if (sat > 0) {
        const sp: Pose = SAT_POSE;
        khoaSatPose(sp, t);
        for (const b of [
          'thighL',
          'thighR',
          'shinL',
          'shinR',
          'footL',
          'footR',
          'spine',
          'neck',
          'head',
        ] as const) {
          const v = sp[b];
          if (v) lay(pose, b, v[0], v[1], v[2], sat);
        }
      }
      lay(pose, 'spine', at(SIT.lean, s), 0, 0, 1);
      const feet = at(SIT.feet, s);
      for (const [name, steps] of [
        ['footL', SIT.footL],
        ['footR', SIT.footR],
      ] as const) {
        footAt(steps, s, foot);
        turn(0, -1, I.root.heading, fwd);
        reachTo(
          I,
          name,
          foot.x,
          foot.y,
          foot.z,
          foot.x + fwd.x * 0.6,
          foot.y + 0.7,
          foot.z + fwd.z * 0.6,
          feet,
        );
        footFlat(I, name, fwd);
      }
      I.pocket[0] = I.pocket[1] = at(SIT.pocket, s);
      const hands = at(SIT.hands, s);
      // Palms on the ledge: as he climbs, outside his feet (by them, a hand went under the knee
      // stepping up); as he sits, beside his hips.
      const back = s > 4.9 ? 0.1 : -0.06;
      const seated = smooth((s - 4.6) / 0.6);
      const out = 0.4 - 0.16 * seated;
      const hx = I.root.x;
      // (His left, by her: out there it came down on her; ahead of him on the ledge, clear of her
      // thigh, until he sits.)
      reachTo(
        I,
        'handL',
        hx - 0.22 - 0.02 * seated,
        TOP + WRIST,
        -0.34 + 0.32 * seated,
        hx - 0.6,
        1.2,
        0.5,
        hands * (1 - hug),
      );
      palmDown(I, 'handL', fwd.set(-0.3, 0, -1).normalize());
      reachTo(
        I,
        'handR',
        hx + out,
        TOP + WRIST,
        -0.12 + back,
        hx + 0.6,
        1.2,
        0.5,
        hands * (1 - hug),
      );
      palmDown(I, 'handR', fwd.set(0.3, 0, -1).normalize());
      I.look = s < 1.8 ? linh.bone('head', v3) : null;
      I.lookWeight = s < 1.8 ? 0.5 : 0;
      lay(pose, 'head', at(SIT.look, s), 0, 0, 1);
      if (hug > 0) {
        held.copy(I.reaches.handL.target);
        heldPole.copy(I.reaches.handL.pole);
        const heldW = hands;
        // His left hand round her waist (her far side), his right on his thigh; his head leant
        // towards hers.
        linh.bone('spine', v1);
        reachTo(
          I,
          'handL',
          // Round her back to her waist: the palm at the small of her back, towards her far
          // side (reached across to her far hip, his arm went through her), on her back's
          // surface (0.15–0.18 m behind her spine's axis in her clothes: at 0.12, his upper arm
          // swept through her shoulder blade); the elbow round well behind her.
          v1.x - 0.06,
          v1.y + 0.03,
          v1.z + 0.21 + 0.55 * Math.sin(Math.PI * hug),
          v1.x + 0.15,
          v1.y + 0.05,
          1.0 + 0.5 * Math.sin(Math.PI * hug),
          hug,
        );
        I.reaches.handL.along?.set(-1, -0.3, -0.2).normalize();
        I.reaches.handL.xAxis?.set(0, 0, -1);
        I.turned.handL = true;
        I.reaches.handL.target.lerpVectors(held, I.reaches.handL.target, hug);
        I.reaches.handL.pole.lerpVectors(heldPole, I.reaches.handL.pole, hug);
        I.reaches.handL.weight = heldW + (1 - heldW) * hug;
        khoa.bone('thighR', v1);
        khoa.bone('shinR', v2);
        v1.lerp(v2, 0.55);
        reachTo(
          I,
          'handR',
          v1.x - 0.01,
          v1.y + 0.08 + WRIST * 0.5,
          v1.z + 0.04,
          v1.x + 0.6,
          v1.y + 0.4,
          v1.z + 0.3,
          hug,
        );
        palmDown(I, 'handR', fwd.set(-0.2, 0, -1).normalize());
        I.hands.L.curl = 0.45;
        I.hands.R.curl = 0.3;
        lay(pose, 'neck', 0, 0.05, 0.12, hug);
        lay(pose, 'head', 0, 0.1, 0.1, hug);
        I.look = frame.lab;
        I.lookWeight = 0.35 * hug;
      }
      return;
    }

    if (lapSeq >= 0) {
      const s = lapSeq;
      // The hips are keyed (so the body turns about them as it lies back, never dipping into the
      // ledge); the place of the feet (the root) follows from the turn.
      const heading = at(LAP.heading, s);
      const pitch = at(LAP.pitch, s);
      const hy = khoa.hipY;
      I.root.x = at(LAP.x, s) - hy * Math.sin(heading) * Math.sin(pitch);
      I.root.y = at(LAP.y, s) - hy * Math.cos(pitch);
      I.root.z = at(LAP.z, s) - hy * Math.cos(heading) * Math.sin(pitch);
      I.root.heading = heading;
      I.root.pitch = pitch;
      I.rootFreq = 6;
      const sit = at(LAP.sit, s);
      const lie = at(LAP.lie, s);
      khoaStandPose(pose, t);
      // Sat on the ledge facing the roof, thighs out over the roof, feet on it.
      lay(pose, 'thighL', 1.5, 0, -0.06, sit);
      lay(pose, 'thighR', 1.5, 0, 0.06, sit);
      lay(pose, 'shinL', -1.5, 0, 0, sit);
      lay(pose, 'shinR', -1.5, 0, 0, sit);
      const lp: Pose = LIE_POSE;
      khoaLiePose(lp, t, lap.neck);
      for (const k in lp) {
        const v = lp[k as BoneName];
        if (v && v[3] === 1) lay(pose, k as BoneName, v[0], v[1], v[2], lie);
      }
      // Feet: walked to the ledge, planted while he sits, then up onto the ledge as he lies.
      const lifted = smooth((s - 4.4) / 1.4);
      for (const [name, steps, side] of [
        ['footL', LAP.footL, -1],
        ['footR', LAP.footR, 1],
      ] as const) {
        footAt(steps, s, foot);
        turn(0, -1, I.root.heading, fwd);
        if (lifted > 0) {
          // Up onto the ledge: the left leg along it, the right knee raised.
          const lx = lap.x - (side < 0 ? 0.04 : 0.42);
          const over = smooth((lifted - 0.35) / 0.5);
          foot.x += (lx - foot.x) * over;
          foot.y +=
            (TOP + khoa.ankleY * (side < 0 ? 0.9 : 1) - foot.y) * smooth(lifted / 0.6) +
            0.32 * Math.sin(Math.PI * Math.min(1, lifted * 1.15));
          foot.z += (lap.z + side * 0.06 - foot.z) * over;
        }
        reachTo(
          I,
          name,
          foot.x,
          foot.y,
          foot.z,
          foot.x + fwd.x * 0.6,
          foot.y + 0.5,
          foot.z + fwd.z * 0.6,
          1,
        );
        if (lifted < 0.5) footFlat(I, name, fwd);
      }
      I.pocket[0] = I.pocket[1] = at(LAP.pocket, s);
      // Palms on the ledge as he sits and lowers himself; lying, on his belly, each on its own
      // side, the forearm over his front and the elbow out by his flank. Carried from the ledge
      // there over his front, never let go on the way (released, a hand swung through him by its
      // hanging pose; laid on his chest's middle, the forearms lay inside him — Phase W).
      const hands = at(LAP.hands, s);
      const onChest = at(LAP.chest, s);
      // The palms beside his hips in his own turn (fixed on the roof, as he turned to lie along
      // the ledge they ended under his back and thighs).
      const hipX = at(LAP.x, s);
      const hipZ = at(LAP.z, s);
      for (const [name, sign] of [
        ['handL', -1],
        ['handR', 1],
      ] as const) {
        turn(sign * 0.26, 0.03, heading, v1);
        turn(sign * 0.6, 0.4, heading, v2);
        reachTo(
          I,
          name,
          hipX + v1.x,
          TOP + WRIST,
          hipZ + v1.z,
          hipX + v2.x,
          1.0,
          hipZ + v2.z,
          hands,
        );
        palmDown(I, name, turn(sign * 0.2, -1, heading, fwd).normalize());
      }
      if (onChest > 0) {
        const bones = khoa.body.model.bones;
        bones.chest.getWorldQuaternion(qTmp);
        // His right and his front (the body's +x and −z).
        sideOf.set(1, 0, 0).applyQuaternion(qTmp);
        frontOf.set(0, 0, -1).applyQuaternion(qTmp);
        khoa.bone('spine', v2);
        const arc = 0.12 * Math.sin(Math.PI * onChest);
        // (High on his front, clear of his knees as they swing up onto the ledge.)
        for (const [name, sign, up] of [
          ['handL', -1, 0.17],
          ['handR', 1, 0.09],
        ] as const) {
          const r = I.reaches[name];
          // On his belly: a hand's width out from his middle, over his front.
          v1.copy(v2)
            .addScaledVector(sideOf, sign * 0.08)
            .addScaledVector(frontOf, 0.17 + arc);
          bones.chest.getWorldPosition(v3).sub(v2).normalize();
          v1.addScaledVector(v3, up);
          r.target.lerp(v1, onChest);
          // The elbow out by his flank, up off the ledge.
          v1.copy(v2)
            .addScaledVector(sideOf, sign * 0.55)
            .addScaledVector(frontOf, 0.3);
          r.pole.lerp(v1, onChest);
          r.weight = Math.max(hands, onChest);
          if (onChest > 0.5) I.turned[name] = false;
        }
        I.hands.L.curl = I.hands.R.curl = 0.3;
      }
      I.look = lie > 0.5 ? linh.bone('head', v3) : null;
      // A glance up at her only (his head lies on her lap: turned far, it would leave it).
      I.lookWeight = lie > 0.5 ? 0.25 * lie : 0;
      return;
    }

    // Standing: feet planted where he stands, the body over them swaying, hands in his pockets.
    I.root.x = KHOA_STAND.x + 0.02 * wander(t * 0.25, 21);
    I.root.y = -0.012 - 0.008 * Math.abs(wander(t * 0.25, 22));
    I.root.z = KHOA_STAND.z + 0.015 * wander(t * 0.2, 23);
    I.root.heading = KHOA_STAND.heading;
    I.root.pitch = 0;
    khoaStandPose(pose, t);
    for (const [name, side] of [
      ['footL', -1],
      ['footR', 1],
    ] as const) {
      const [fx, fy, fz] = standFeet(side);
      turn(0, -1, KHOA_STAND.heading, fwd);
      reachTo(I, name, fx, fy, fz, fx + fwd.x * 0.6, 0.55, fz + fwd.z * 0.6, 1);
      footFlat(I, name, fwd);
    }
    pocketHands(I, 1, 1);
    if (listen > 0) {
      // Turned to her while she talks: his chest round to her, eyes on her, a nod now and then,
      // his right hand out of his pocket to answer her.
      const answer = listen * (0.5 - 0.5 * Math.sin(t * 0.85 + 1.3 * wander(t * 0.2, 33)));
      lay(pose, 'spine', 0.02, 0.36, 0, listen);
      lay(pose, 'chest', 0, 0.16, 0, listen);
      lay(
        pose,
        'head',
        -0.05 + 0.07 * Math.max(0, Math.sin(t * 1.9)) * (listen - answer),
        0,
        0.05,
        listen,
      );
      I.look = linh.bone('head', v3);
      I.lookWeight = 0.9 * listen;
      khoa.bone('chest', v1);
      turn(0.05 + 0.04 * wander(t * 1.4, 41), -0.3, KHOA_STAND.heading + 0.5, v2);
      // The elbow out to his right and back, in his own turn (a pole fixed on the roof put it
      // into his side as he turned to her).
      turn(0.55, 0.25, KHOA_STAND.heading + 0.5, v3);
      reachTo(
        I,
        'handR',
        v1.x + v2.x,
        v1.y - 0.16 + 0.05 * Math.abs(Math.sin(t * 2.7)),
        v1.z + v2.z,
        v1.x + v3.x,
        v1.y - 0.4,
        v1.z + v3.z,
        answer,
      );
      I.pocket[1] = 1 - smooth(answer * 3);
      I.hands.R.curl = 0.25;
    }
    const w = kp?.w ?? 0;
    switch (kp?.clip.name) {
      case 'card':
      case 'holo': {
        // His right hand out to before his chest, the black card turning in it.
        khoa.bone('chest', v1);
        turn(0.12, -0.3, KHOA_STAND.heading, v2);
        reachTo(
          I,
          'handR',
          v1.x + v2.x,
          v1.y - 0.08,
          v1.z + v2.z,
          v1.x + 0.6,
          v1.y - 0.35,
          v1.z + 0.4,
          w,
        );
        put(pose, 'handR', 0.1 * w, 0.5 * w, -0.2 * w);
        I.pocket[1] = 1 - smooth(w * 3);
        I.hands.R.curl = 0.35 + 0.15 * w;
        I.hands.R.thumb = 0.3 + 0.3 * w;
        I.gesture = 'lance';
        I.look = khoa.bone('handR', v3);
        I.lookWeight = 0.8 * w;
        break;
      }
      case 'kick': {
        // The right foot drawn back, swung through the pebble, set back down.
        const u = kp.u;
        const [fx, , fz] = standFeet(1);
        turn(0, -1, KHOA_STAND.heading, fwd);
        const back = smooth(u / 0.35) * (1 - smooth((u - 0.35) / 0.12));
        const through = smooth((u - 0.35) / 0.12) * (1 - smooth((u - 0.65) / 0.3));
        const reachOut = -0.22 * back + 0.32 * through;
        reachTo(
          I,
          'footR',
          fx + fwd.x * reachOut,
          khoa.ankleY + 0.09 * back + 0.05 * through,
          fz + fwd.z * reachOut,
          fx + fwd.x * 0.6,
          0.55,
          fz + fwd.z * 0.6,
          1,
        );
        lay(pose, 'spine', 0.08 * through, 0, 0, w);
        I.root.x -= 0.03 * (back + through) * w;
        I.look = pebble.position;
        I.lookWeight = 0.8 * w;
        break;
      }
      case 'glance':
        I.look = linh.bone('head', v3);
        I.lookWeight = 0.4 + 0.5 * w;
        break;
      case 'neck':
        lay(pose, 'neck', 0.1, 0, 0.3 * Math.sin(kp.u * Math.PI * 2), w);
        lay(pose, 'head', 0.12, 0, 0.25 * Math.sin(kp.u * Math.PI * 2), w);
        break;
      case 'tired':
        // His legs tired: weight onto one leg, a hand to the small of his back, a stretch.
        lay(pose, 'spine', -0.12, 0, 0.05, w);
        lay(pose, 'hips', 0, 0, 0.06, w);
        khoa.bone('spine', v1);
        // His palm at the small of his back: behind him, by the spine's base.
        turn(0.1, 0.17, KHOA_STAND.heading, v2);
        turn(0.5, 0.35, KHOA_STAND.heading, v3);
        reachTo(
          I,
          'handR',
          v1.x + v2.x,
          v1.y - 0.08,
          v1.z + v2.z,
          v1.x + v3.x,
          v1.y + 0.25,
          v1.z + v3.z,
          w,
        );
        I.pocket[1] = 1 - smooth(w * 3);
        I.look = linh.bone('head', v3);
        I.lookWeight = 0.6 * w;
        break;
      case 'startle':
        lay(pose, 'spine', 0, 0.32, 0, w);
        lay(pose, 'chest', 0, 0.12, 0, w);
        I.look = frame.lab;
        I.lookWeight = 0.4 + 0.6 * w;
        break;
      default:
        break;
    }
    // A hand coming out of its pocket (or going back) travels from the pocket to where it goes,
    // not by way of its hanging pose (it showed before his crotch).
    for (const [k, name] of [
      [0, 'handL'],
      [1, 'handR'],
    ] as const) {
      const r = I.reaches[name];
      if (r.weight >= 1) continue;
      r.target.lerpVectors(pocketAt[k], r.target, r.weight);
      r.pole.lerpVectors(pocketPole[k], r.pole, r.weight);
      r.weight = 1;
    }
  }

  /** His hands slid into his front pockets: the wrists at the pockets' mouths, the hands hidden. */
  function pocketHands(I: Intent, left: number, right: number): void {
    for (const [name, side, w] of [
      ['handL', -1, left],
      ['handR', 1, right],
    ] as const) {
      khoa.bone(side < 0 ? 'thighL' : 'thighR', v1);
      turn(side * 0.07, -0.08, KHOA_STAND.heading, v2);
      turn(side * 0.45, 0.25, KHOA_STAND.heading, v3);
      reachTo(
        I,
        name,
        v1.x + v2.x,
        v1.y + 0.02,
        v1.z + v2.z,
        v1.x + v3.x,
        v1.y + 0.45,
        v1.z + v3.z,
        w,
      );
      I.pocket[side < 0 ? 0 : 1] = w;
      pocketAt[side < 0 ? 0 : 1].copy(I.reaches[name].target);
      pocketPole[side < 0 ? 0 : 1].copy(I.reaches[name].pole);
    }
  }
  const pocketAt = [new THREE.Vector3(), new THREE.Vector3()] as const;
  const pocketPole = [new THREE.Vector3(), new THREE.Vector3()] as const;

  // ── The opening's stunt (prologue/, Phú 2026-11-18) ─────────────────────────────────────────
  // In the rocket's cabin, pressed to the window, the door opened; out, hanging from the bar
  // over it; letting go over the roof, landing in a skid, rising, watching the rocket go, walking
  // to his place by Linh, where the sunset sit takes over (its first keys are where this ends).
  const sA = new THREE.Vector3();
  const sB = new THREE.Vector3();
  const sC = new THREE.Vector3();
  const upright = new THREE.Quaternion();
  const swung = new THREE.Quaternion();
  /** His walk from where the skid stopped him to his place (made at its first frame). */
  let walk: { footL: Steps; footR: Steps; heading: number } | null = null;
  /** Gravity's pull while falling (m/s²) for his flight's spot. */
  const GRAVITY = 9.80665;

  /** His feet on spots of the cabin's floor (its up), knees towards the door (out). */
  function stuntFeet(I: Intent, l: THREE.Vector3, r: THREE.Vector3, s: StuntFrame, w: number) {
    const { up, out } = s;
    for (const [name, at] of [
      ['footL', l],
      ['footR', r],
    ] as const) {
      reachTo(
        I,
        name,
        at.x + up.x * A,
        at.y + up.y * A,
        at.z + up.z * A,
        at.x + up.x * 0.7 + out.x * 0.6,
        at.y + up.y * 0.7 + out.y * 0.6,
        at.z + up.z * 0.7 + out.z * 0.6,
        w,
      );
    }
  }

  /** His feet either side of a spot on the roof, for a heading (level, his ankles' height). */
  function feetAt(
    x: number,
    z: number,
    heading: number,
    spread: number,
    outL: THREE.Vector3,
    outR: THREE.Vector3,
  ) {
    turn(-khoa.hipX * spread, 0, heading, sA);
    outL.set(x + sA.x, 0, z + sA.z);
    turn(khoa.hipX * spread, 0, heading, sA);
    outR.set(x + sA.x, 0, z + sA.z);
  }

  function makeWalk(
    from: THREE.Vector3,
    h0: number,
  ): { footL: Steps; footR: Steps; heading: number } {
    const to = new THREE.Vector3(KHOA_STAND.x, 0, KHOA_STAND.z);
    const dir = to.clone().sub(from);
    const heading = Math.atan2(-dir.x, -dir.z);
    const along = (f: number, side: -1 | 1): [number, number, number] => {
      turn(side * khoa.hipX, 0, heading, sA);
      return [from.x + dir.x * f + sA.x, A, from.z + dir.z * f + sA.z];
    };
    const startL = new THREE.Vector3();
    const startR = new THREE.Vector3();
    feetAt(from.x, from.z, h0, 1, startL, startR);
    const t0 = STUNT.watched;
    const span = STUNT.standing - t0 - 0.15;
    const at = (i: number) => t0 + (span * i) / 6;
    return {
      heading,
      footL: {
        start: [startL.x, A, startL.z],
        lift: 0.13,
        steps: [
          { from: at(0), to: at(1.15), at: along(0.22, -1) },
          { from: at(2), to: at(3.15), at: along(0.58, -1) },
          { from: at(4), to: at(5.15), at: standFeet(-1) },
        ],
      },
      footR: {
        start: [startR.x, A, startR.z],
        lift: 0.13,
        steps: [
          { from: at(1), to: at(2.15), at: along(0.4, 1) },
          { from: at(3), to: at(4.15), at: along(0.76, 1) },
          { from: at(4.85), to: at(6), at: standFeet(1) },
        ],
      },
    };
  }

  function khoaStunt(t: number, s: StuntFrame): void {
    const I = khoa.intent;
    const pose = I.pose;
    const tau = s.tau;
    I.gesture = 'idle';
    I.exact = true;
    I.rootFreq = 5;
    I.hands.L.curl = I.hands.R.curl = 0.35;
    I.hands.L.thumb = I.hands.R.thumb = 0.3;
    for (const n of LIMB_NAMES) {
      I.reaches[n].weight = 0;
      I.turned[n] = false;
    }
    I.pocket[0] = I.pocket[1] = 0;
    I.root.pitch = 0;
    I.root.frame = null;
    I.look = null;
    I.lookWeight = 0;
    khoaStandPose(pose, t);

    if (tau < STUNT.toSill) {
      // In the cabin, facing the door, standing as it stands (its floor is his). Pressed to the
      // porthole; then his right hand on the handle, his left braced on the doorway's rear edge;
      // gathering himself, he wrenches the door open, drawn back and to his left with it, and lets
      // the handle go as the door runs on (Phú 2026-11-18).
      I.root.frame = s.cabin;
      I.root.heading = Math.PI;
      const grip = smooth((tau - STUNT.grip) / 0.08);
      const press = smooth((tau - STUNT.press) / 0.3) * (1 - grip);
      const brace = smooth((tau - (STUNT.doorFrom - 0.07)) / 0.07);
      const pull = smooth((tau - STUNT.doorFrom) / (STUNT.handleOff - STUNT.doorFrom));
      const free = smooth((tau - STUNT.handleOff) / 0.07);
      const back = 0.07 * brace * (1 - free) + 0.05 * pull * (1 - free);
      const along = 0.18 * pull;
      const bend = 0.06 * brace * (1 - free);
      sC.copy(s.stand)
        .addScaledVector(s.out, 0.1 * press - back)
        .addScaledVector(s.side, along)
        .addScaledVector(s.up, -bend);
      I.root.x = sC.x;
      I.root.y = sC.y;
      I.root.z = sC.z;
      // Leaning in to look out; leaning back into the pull; upright again as the door runs.
      // (Forward is a negative turn of the spine.)
      lay(pose, 'spine', -0.04 - 0.2 * press + 0.18 * brace * (1 - free), 0, 0, 1);
      lay(pose, 'chest', -0.05 * press + 0.06 * brace * (1 - free), 0, 0, 1);
      stuntFeet(I, s.footL, s.footR, s, 1);
      I.look = grip > 0.5 && free < 0.5 ? s.handle : s.view;
      I.lookWeight = 0.8;
      // Pressed: both palms by the porthole. Then the right hand on the handle (riding with the
      // door as he pulls), the left braced flat on the doorway's rear edge.
      const right = grip > 0 ? s.handle : s.palmR;
      sA.copy(right)
        .addScaledVector(s.up, -0.55)
        .addScaledVector(s.side, -0.35)
        .addScaledVector(s.out, -0.3);
      reachTo(
        I,
        'handR',
        right.x,
        right.y,
        right.z,
        sA.x,
        sA.y,
        sA.z,
        Math.max(press, grip * (1 - free)),
      );
      const left = grip > 0 ? s.frameRear : s.palmL;
      sB.copy(left)
        .addScaledVector(s.up, -0.55)
        .addScaledVector(s.side, 0.35)
        .addScaledVector(s.out, -0.3);
      reachTo(I, 'handL', left.x, left.y, left.z, sB.x, sB.y, sB.z, Math.max(press, grip));
      I.hands.R.curl = 0.2 + 0.75 * grip * (1 - free);
      I.hands.R.thumb = 0.3 + 0.6 * grip * (1 - free);
      I.hands.L.curl = 0.12;
      return;
    }

    if (tau < STUNT.out) {
      // To the doorway's edge, his left hand on its front edge; then his right hand up and out to
      // the bar over it, up on his toes, leaning out.
      I.root.frame = s.cabin;
      I.root.heading = Math.PI;
      const d = STUNT.reach - STUNT.toSill;
      const step = smooth((tau - STUNT.toSill) / d);
      const reach = smooth((tau - STUNT.reach) / (STUNT.out - STUNT.reach));
      sC.copy(s.stand)
        .lerp(s.sill, step)
        .addScaledVector(s.up, 0.05 * reach);
      I.root.x = sC.x;
      I.root.y = sC.y;
      I.root.z = sC.z;
      const kL = smooth((tau - STUNT.toSill) / (0.55 * d));
      const kR = smooth((tau - STUNT.toSill - 0.45 * d) / (0.55 * d));
      sA.copy(s.footL)
        .lerp(s.sillL, kL)
        .addScaledVector(s.up, 0.08 * Math.sin(Math.PI * kL));
      sB.copy(s.footR)
        .lerp(s.sillR, kR)
        .addScaledVector(s.up, 0.08 * Math.sin(Math.PI * kR));
      stuntFeet(I, sA, sB, s, 1);
      lay(pose, 'spine', -0.04 - 0.12 * reach, 0, 0, 1);
      sA.copy(s.frameFront)
        .addScaledVector(s.up, -0.5)
        .addScaledVector(s.side, 0.3)
        .addScaledVector(s.out, -0.35);
      reachTo(
        I,
        'handL',
        s.frameFront.x,
        s.frameFront.y,
        s.frameFront.z,
        sA.x,
        sA.y,
        sA.z,
        smooth(step / 0.6),
      );
      I.hands.L.curl = 0.75;
      sB.copy(s.grip)
        .addScaledVector(s.up, -0.6)
        .addScaledVector(s.side, -0.35)
        .addScaledVector(s.out, 0.2);
      reachTo(I, 'handR', s.grip.x, s.grip.y, s.grip.z, sB.x, sB.y, sB.z, reach);
      const closing = smooth((reach - 0.7) / 0.3);
      I.hands.R.curl = 0.3 + 0.7 * closing;
      I.hands.R.thumb = 0.3 + 0.6 * closing;
      I.look = reach > 0.05 ? s.grip : s.view;
      I.lookWeight = 0.75;
      return;
    }

    if (tau < STUNT.hang) {
      // Out: the bar in his right hand, he swings out of the doorway and down below it, his left
      // hand leaving the frame; turned upright as he leaves the cabin.
      const k = smooth((tau - STUNT.out) / (STUNT.hang - STUNT.out));
      swung.slerpQuaternions(s.cabin, upright, k);
      I.root.frame = swung;
      I.root.heading = Math.PI;
      sA.copy(s.grip).addScaledVector(s.out, HANG_OUT);
      sA.y -= HANG;
      I.root.x = s.sill.x + (sA.x - s.sill.x) * k + s.out.x * 0.25 * Math.sin(Math.PI * k);
      I.root.y = s.sill.y + (sA.y - s.sill.y) * k + 0.08 * Math.sin(Math.PI * k);
      I.root.z = s.sill.z + (sA.z - s.sill.z) * k + s.out.z * 0.25 * Math.sin(Math.PI * k);
      sB.copy(s.grip).addScaledVector(s.side, -0.3).addScaledVector(s.out, 0.5);
      reachTo(I, 'handR', s.grip.x, s.grip.y, s.grip.z, sB.x, sB.y - 0.3, sB.z, 1);
      I.hands.R.curl = 1;
      I.hands.R.thumb = 0.9;
      sC.copy(s.frameFront)
        .addScaledVector(s.up, -0.5)
        .addScaledVector(s.side, 0.3)
        .addScaledVector(s.out, -0.35);
      reachTo(
        I,
        'handL',
        s.frameFront.x,
        s.frameFront.y,
        s.frameFront.z,
        sC.x,
        sC.y,
        sC.z,
        1 - smooth(k / 0.45),
      );
      stuntFeet(I, s.sillL, s.sillR, s, 1 - smooth((k - 0.1) / 0.35));
      lay(pose, 'upperArmL', 0.25, 0, -1.2, k);
      lay(pose, 'foreArmL', 0.55, 0, 0, k);
      lay(pose, 'thighL', 0.3, 0, 0, k);
      lay(pose, 'shinL', -0.6, 0, 0, k);
      lay(pose, 'thighR', -0.05, 0, 0, k);
      lay(pose, 'shinR', -0.25, 0, 0, k);
      I.look = s.land;
      I.lookWeight = 0.6 * k;
      return;
    }

    if (tau < STUNT.release) {
      // Hanging from the bar by his right hand, swaying, his left arm out; looking down at the roof.
      sA.copy(s.grip).addScaledVector(s.out, HANG_OUT);
      sA.y -= HANG;
      const sway = Math.sin((tau - STUNT.hang) * 9);
      I.root.x = sA.x + s.ahead.x * 0.06 * sway;
      I.root.y = sA.y;
      I.root.z = sA.z + s.ahead.z * 0.06 * sway;
      I.root.heading = Math.PI + 0.12 * sway;
      sB.copy(s.grip).addScaledVector(s.side, -0.3).addScaledVector(s.out, 0.5);
      reachTo(I, 'handR', s.grip.x, s.grip.y, s.grip.z, sB.x, sB.y - 0.3, sB.z, 1);
      I.hands.R.curl = 1;
      I.hands.R.thumb = 0.9;
      put(pose, 'upperArmL', 0.25, 0, -1.25 + 0.1 * sway);
      put(pose, 'foreArmL', 0.55, 0, 0);
      put(pose, 'thighL', 0.32 + 0.08 * sway, 0, -0.04);
      put(pose, 'shinL', -0.65, 0, 0);
      put(pose, 'thighR', -0.06 - 0.06 * sway, 0, 0.04);
      put(pose, 'shinR', -0.28, 0, 0);
      lay(pose, 'spine', 0.03, 0, 0, 1);
      I.look = s.land;
      I.lookWeight = 0.85;
      return;
    }

    // From here on he is free of the rocket: on the roof's frame.
    const lvx = s.velocity.x;
    const lvz = s.velocity.z;
    const skidHeading = Math.atan2(-lvx, -lvz);

    if (tau < STUNT.land) {
      // Flying: ballistic from the bar to the roof, his arms out, knees drawn up, then reaching
      // down for the landing; turning to face the way he is going.
      const u = tau - STUNT.release;
      const k = u / (STUNT.land - STUNT.release);
      I.root.x = s.release.x + s.velocity.x * u;
      I.root.y = s.release.y + s.velocity.y * u - 0.5 * GRAVITY * u * u;
      I.root.z = s.release.z + s.velocity.z * u;
      const turnK = smooth(k / 0.8);
      I.root.heading = Math.PI + (skidHeading - Math.PI) * turnK;
      const tuck = Math.sin(Math.PI * Math.min(1, k * 1.25));
      put(pose, 'upperArmL', 0.5, 0, -1.5);
      put(pose, 'upperArmR', 0.5, 0, 1.5);
      put(pose, 'foreArmL', 0.5, 0, 0);
      put(pose, 'foreArmR', 0.5, 0, 0);
      put(pose, 'thighL', 0.35 + 0.65 * tuck, 0, -0.05);
      put(pose, 'thighR', 0.25 + 0.75 * tuck, 0, 0.05);
      put(pose, 'shinL', -0.4 - 1.0 * tuck, 0, 0);
      put(pose, 'shinR', -0.5 - 1.0 * tuck, 0, 0);
      lay(pose, 'spine', -0.18, 0, 0, 1);
      I.look = s.land;
      I.lookWeight = 0.7;
      return;
    }

    if (tau < STUNT.watched) {
      // The landing (Phú 2026-11-18, "something cooler"): the three-point landing, skidding to a
      // stop: his left foot planted ahead, his right knee driven down by the roof, his right fist
      // struck on it, his left arm swept back; head down at the impact, then lifted to look
      // straight at the camera; then rising and turning to watch the rocket climb away.
      const u = Math.min(1, (tau - STUNT.land) / SKID_S);
      const slid = 1 - (1 - u) * (1 - u);
      const x = s.land.x + (s.stop.x - s.land.x) * slid;
      const z = s.land.z + (s.stop.z - s.land.z) * slid;
      const impact = smooth((tau - STUNT.land) / 0.07);
      const rise = smooth((tau - STUNT.crouch) / (STUNT.risen - STUNT.crouch));
      const crouch = impact * (1 - rise);
      const watch = smooth((tau - STUNT.risen) / (STUNT.watched - STUNT.risen));
      sB.copy(s.rocket).sub(sC.set(x, 0, z));
      const toRocket = Math.atan2(-sB.x, -sB.z);
      let dh = toRocket - skidHeading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const heading = skidHeading + dh * 0.45 * watch;
      I.root.x = x;
      I.root.z = z;
      // The impact: driven down past the crouch, then back up into it.
      const hit = tau - STUNT.land;
      const squash = hit > 0 ? 0.15 * Math.exp(-hit / 0.09) * Math.min(1, hit / 0.02) : 0;
      I.root.y = -(0.7 * crouch + squash);
      I.root.heading = heading;
      turn(0, -1, heading, fwd);
      // The left foot planted ahead, its knee up; side by side again as he stands.
      turn(-0.14, -0.42, heading, sA);
      turn(-khoa.hipX, 0, heading, sB);
      sC.set(x + sA.x * crouch + sB.x * (1 - crouch), A, z + sA.z * crouch + sB.z * (1 - crouch));
      reachTo(I, 'footL', sC.x, sC.y, sC.z, sC.x + fwd.x * 0.6, 0.75, sC.z + fwd.z * 0.6, 1);
      footFlat(I, 'footL', fwd);
      // The right foot well back on its toes, the knee pulled down to the roof.
      turn(0.17, 0.8, heading, sA);
      turn(khoa.hipX, 0, heading, sB);
      sC.set(
        x + sA.x * crouch + sB.x * (1 - crouch),
        A + 0.04 * crouch,
        z + sA.z * crouch + sB.z * (1 - crouch),
      );
      reachTo(
        I,
        'footR',
        sC.x,
        sC.y,
        sC.z,
        sC.x + fwd.x * 0.7,
        0.7 - 0.62 * crouch,
        sC.z + fwd.z * 0.7,
        1,
      );
      if (crouch < 0.5) footFlat(I, 'footR', fwd);
      // His right fist struck on the roof, by his left foot.
      turn(0.22, -0.32, heading, sA);
      turn(0.7, 0.3, heading, sB);
      reachTo(
        I,
        'handR',
        x + sA.x,
        0.07,
        z + sA.z,
        x + sB.x,
        0.7,
        z + sB.z,
        crouch * smooth((tau - STUNT.land) / 0.04),
      );
      I.hands.R.curl = 1;
      I.hands.R.thumb = 0.9;
      // His left arm swept back and out.
      lay(pose, 'upperArmL', -0.95, 0, -0.55, crouch);
      lay(pose, 'foreArmL', 0.15, 0, 0, crouch);
      lay(pose, 'handL', 0, 0, -0.2, crouch);
      lay(pose, 'spine', -0.62 - squash, 0, 0, crouch);
      lay(pose, 'chest', -0.22, 0, 0, crouch);
      // Head down at the impact, at the ground ahead; then up, straight at the camera; up at
      // the rocket once he rises.
      const glare = smooth((tau - (STUNT.land + 0.32)) / 0.3);
      sC.set(x + fwd.x * 1.6, 0.05, z + fwd.z * 1.6);
      I.look = tau > STUNT.crouch ? s.rocket : glare > 0.5 ? s.camera : sC;
      I.lookWeight = 0.85;
      walk = null;
      return;
    }

    // The walk to his place by Linh, his hands going into his pockets as he arrives (as the
    // sunset sit begins).
    walk ??= makeWalk(sC.set(s.stop.x, 0, s.stop.z), skidHeading);
    const k = smooth((tau - STUNT.watched) / (STUNT.standing - STUNT.watched));
    I.root.x = s.stop.x + (KHOA_STAND.x - s.stop.x) * k;
    I.root.z = s.stop.z + (KHOA_STAND.z - s.stop.z) * k;
    I.root.y = 0;
    const toPath = smooth(k / 0.25);
    const toStand = smooth((k - 0.75) / 0.25);
    let a = walk.heading - skidHeading;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    let b = KHOA_STAND.heading - walk.heading;
    b = Math.atan2(Math.sin(b), Math.cos(b));
    I.root.heading = skidHeading + a * toPath + b * toStand;
    I.rootFreq = 7;
    turn(0, -1, I.root.heading, fwd);
    for (const [name, steps] of [
      ['footL', walk.footL],
      ['footR', walk.footR],
    ] as const) {
      footAt(steps, tau, foot);
      reachTo(
        I,
        name,
        foot.x,
        foot.y,
        foot.z,
        foot.x + fwd.x * 0.6,
        foot.y + 0.7,
        foot.z + fwd.z * 0.6,
        1,
      );
      footFlat(I, name, fwd);
    }
    I.pocket[0] = I.pocket[1] = smooth((k - 0.7) / 0.3);
    I.look = linh.bone('head', v3);
    I.lookWeight = 0.5 * smooth((k - 0.4) / 0.4);
  }

  const SAT_POSE: Pose = {};
  const LIE_POSE: Pose = {};

  return {
    group,
    update(dt, time, frame) {
      // The outfits and the scan between them.
      const h = SCAN.from + (SCAN.to - SCAN.from) * frame.outfit;
      const scanning = frame.outfit > 0 && frame.outfit < 1;
      dayPlane.constant = frame.outfit <= 0 ? 100 : frame.outfit >= 1 ? -100 : -h;
      nightPlane.constant = frame.outfit <= 0 ? -100 : frame.outfit >= 1 ? 100 : h;
      for (const p of [linh, khoa]) {
        p.day.group.visible = frame.outfit < 1;
        p.night.group.visible = frame.outfit > 0;
        p.ring.visible = scanning;
        p.ring.position.y = h;
      }
      ringMaterial.opacity = 0.9 * smooth(Math.min(frame.outfit, 1 - frame.outfit) * 12);

      if (
        debug.lapAt !== undefined &&
        lapStart < 0 &&
        time >= debug.lapAt &&
        time < debug.lapAt + 1
      )
        lapStart = debug.lapAt;
      if (debug.chatAt !== undefined && !chatForced && time >= debug.chatAt) {
        chatForced = true;
        linh.director.play('chat', debug.chatAt);
      }
      // Which scene Khoa is in: the sunset sit, the lap, or standing.
      const tg = frame.together;
      const stay = TOGETHER.until - TOGETHER.from;
      let sitSeq = -1;
      let hug = 0;
      if (tg >= 0) {
        if (tg < SIT_IN) sitSeq = tg;
        else if (tg < stay + HUG_EASE) {
          sitSeq = SIT_IN;
          hug = smooth((tg - SIT_IN) / HUG_EASE) * (1 - smooth((tg - stay) / HUG_EASE));
        } else sitSeq = Math.max(0, SIT_IN - (tg - stay - HUG_EASE));
        lapStart = -1;
      }
      let lapSeq = -1;
      let lapW = 0;
      if (lapStart >= 0) {
        const s = time - lapStart;
        const out = LAP_IN + LAP_HOLD;
        if (s < LAP_IN) lapSeq = s;
        else if (s < out) lapSeq = LAP_IN;
        else if (s < out + LAP_IN) lapSeq = LAP_IN - (s - out);
        else lapStart = -1;
        // Her hand comes to his hair once he lies; it leaves before he starts to get up.
        lapW =
          lapSeq < 0 ? 0 : s >= out ? smooth((lapSeq - 7.2) / 0.6) : smooth((lapSeq - 5.8) / 1.4);
      }
      // The directors: actions only while each is free.
      const free = sitSeq < 0 && lapSeq < 0;
      const stunt = frame.stunt;
      const lp = free
        ? linh.director.update(time, stunt ? LINH_ALONE : frame.night > 0.5 ? LINH_NIGHT : LINH_DAY)
        : null;
      // While she talks to him he listens: his own actions wait.
      const chatting = playing(lp, 'chat');
      const night = frame.night > 0.5;
      const kp =
        free && !chatting && !stunt
          ? khoa.director.update(
              time,
              frame.canLap
                ? night
                  ? KHOA_NIGHT
                  : KHOA_DAY
                : night
                  ? KHOA_NIGHT_STAY
                  : KHOA_DAY_STAY,
            )
          : null;
      const listen = chatting ? chatSide(chatting.u * LINH_CLIPS.chat.length) : 0;
      scene.hug = hug;
      scene.lap = lapW;
      scene.chat = listen;
      scene.sit = sitSeq;
      scene.acts = `${lp?.clip.name ?? '-'}@${((lp?.u ?? 0) * (lp?.clip.length ?? 0)).toFixed(1)}/${kp?.clip.name ?? '-'}/${sitSeq >= 0 ? 'sit' : lapSeq >= 0 ? 'lap' : ''}`;
      // The 'tired' action ends in the lap scene.
      if (kp?.clip.name === 'tired' && kp.u > 0.92 && lapStart < 0 && frame.canLap) lapStart = time;

      linhIntent(time, frame, lp, hug, lapW, lapSeq < 0 ? 0 : smooth((lapSeq - 3.4) / 1.0));
      if (frame.attention) {
        linh.intent.look = frame.attention;
        linh.intent.lookWeight = 0.85;
      }
      if (stunt) khoaStunt(time, stunt);
      else khoaIntent(time, frame, kp, sitSeq, hug, lapSeq, listen);
      linh.rig.apply(linh.intent, dt, time);
      khoa.rig.apply(khoa.intent, dt, time);
      // Her bust giving way where her arms, her knees or he press on it.
      linh.press?.update(linh.body, pressing);
      linh.drape?.update(linh.body, pressing);
      // The ink as wide on the picture however far each is from the eye.
      for (const p of [linh, khoa]) {
        const width = INK_PX * p.bone('chest', v1).distanceTo(frame.camera.position) * frame.inkPx;
        for (const a of [p.day, p.night]) {
          const outline = a.model.outlines?.body.material;
          if (outline) setOutlineWidth(outline as THREE.Material, width);
        }
      }
      for (const p of [linh, khoa]) {
        p.ring.position.x = p.body.group.position.x;
        p.ring.position.z = p.body.group.position.z;
      }

      // Props: Linh's karambit spinning in bursts on her finger, Khoa's card flipped over.
      const blade = playing(lp, 'karambit');
      for (const prop of linh.props) {
        prop.group.position.set(-0.015, -0.075, -0.02);
        prop.group.rotation.set(0, Math.PI / 2, 0.4);
        prop.group.visible = blade !== null && blade.u > 0.13 && blade.u < 0.87;
        if (blade) {
          const x = Math.max(0, (blade.u - 0.15) / 0.7) * 6;
          prop.turn.rotation.z = -Math.PI * 2 * (2 * Math.floor(x) + 2 * smooth((x % 1) / 0.4));
        }
        prop.setNight(frame.night, time);
      }
      const card = playing(kp, 'card') ?? playing(kp, 'holo');
      for (const prop of khoa.props) {
        prop.group.position.set(-0.03, -0.06, 0);
        prop.group.rotation.set(0, 0, 0);
        prop.group.visible = card !== null && card.u > 0.12 && card.u < 0.88;
        if (card && card.clip.name === 'card') {
          const x = Math.max(0, (card.u - 0.14) / 0.72) * 7;
          prop.turn.rotation.y = Math.PI * (Math.floor(x) + smooth((x % 1) / 0.35));
          prop.turn.rotation.x =
            Math.floor(x) % 3 === 2 ? Math.PI * 2 * smooth(((x % 1) - 0.4) / 0.5) : 0;
        } else prop.turn.rotation.set(0, Math.sin(time * 1.3) * 0.15, 0);
        prop.setNight(card?.clip.name === 'holo' ? card.w * frame.night : 0, time);
      }

      // The pebble: kicked when his foot comes through it, then sliding and bouncing to rest.
      const kick = playing(kp, 'kick');
      if (kick && kick.u > 0.45 && !kicked) {
        kicked = true;
        khoa.bone('footR', v1);
        if (Math.hypot(v1.x - pebble.position.x, v1.z - pebble.position.z) < 0.4) {
          const a = KHOA_STAND.heading - 0.35;
          pebbleV.set(-Math.sin(a), -Math.cos(a)).multiplyScalar(2.2);
        }
      }
      if (!kick) kicked = false;
      const speed = pebbleV.length();
      if (speed > 0) {
        const next = Math.max(0, speed - 2.4 * dt);
        pebbleV.multiplyScalar(next / speed);
        pebble.position.x += pebbleV.x * dt;
        pebble.position.z += pebbleV.y * dt;
        // The ledge's inner face (z 0) throws it back.
        if (pebble.position.z < 0.04) {
          pebble.position.z = 0.04;
          pebbleV.y = Math.abs(pebbleV.y) * 0.45;
        }
        pebble.rotation.x -= (pebbleV.y * dt) / 0.035;
        pebble.rotation.z += (pebbleV.x * dt) / 0.035;
        restSince = time;
      } else if (pebble.position.distanceTo(home) > 0.6 && time - restSince > 25 && free) {
        // Long at rest away from his feet: back by them (another pebble from the gravel).
        pebble.position.copy(home);
      }

      // Light and wind on them.
      sunView.copy(frame.sun).transformDirection(frame.camera.matrixWorldInverse);
      for (const p of [linh, khoa]) {
        windLocal.copy(frame.wind).applyAxisAngle(UP, -p.body.group.rotation.y);
        for (const lookOf of p.looks) {
          lookOf.update(dt, time);
          lookOf.uniforms.uSunView.value.copy(sunView);
          lookOf.uniforms.uWind.value.copy(windLocal);
          lookOf.uniforms.uRimColor.value.lerpColors(dayRim, nightRim, frame.night);
          lookOf.uniforms.uRim.value = 0.22 + 0.13 * frame.night;
        }
      }
    },
    probe: {
      linh: () => linh.body,
      khoa: () => khoa.body,
      scene: () => scene,
      bust: () => linh.press,
      solids: () => pressing,
    },
    startle(time) {
      linh.director.play('startle', time + 0.12);
      khoa.director.play('startle', time);
    },
    snap() {
      linh.rig.reset();
      khoa.rig.reset();
    },
    dispose: () => {
      linh.dispose();
      khoa.dispose();
      for (const m of shadows) m.dispose();
      ringMaterial.dispose();
      pebble.geometry.dispose();
      (pebble.material as THREE.Material).dispose();
    },
  };
}
