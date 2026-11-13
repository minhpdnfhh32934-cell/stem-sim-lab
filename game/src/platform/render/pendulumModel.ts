import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { arc, Assembly, at, loft, type Outline, slab } from './assembly';
import { LOOKS } from './looks';

type Pendulum = NonNullable<ItemDefinition['pendulum']>;

const FOOT = 0.01; // rubber pads under the base
const POST = 0.07; // square steel posts
const BEAM = 0.08; // the top beam, square
const FOOT_PLATE = 0.012; // plates the posts stand on, bolted to the base
const BRACKET = 0.008; // hanger plates holding the axle
const BRACKET_R = 0.03; // their round lower ends, about the pivot
const HUB = 0.025; // half the length of the swinging hub on the axle
const HUB_GAP = 0.005; // between the hub and each hanger plate
const PROTRACTOR = 0.42; // radius of the angle scale (ExperimentView draws it)
const RULER_OFFSET = 0.5; // the length scale hangs this far from the pivot, towards −x

/**
 * Where the angle and length scales hang, in the item's frame (origin at the centre of its box):
 * both behind the swing plane, clear of the bob passing in front. ExperimentView draws them there,
 * the frame holds them there, and the tests check the swing against them.
 */
export function scaleLayout(item: ItemDefinition, pendulum: Pendulum) {
  const [, h] = item.visual.size;
  const [px, py, pz] = pendulum.pivot;
  const pivotY = py - h / 2;
  const z = pz - pendulum.bobRadius - 0.03;
  const height = PROTRACTOR + 0.08; // the protractor's canvas: 4 cm above the pivot, 4 below the arc
  const rulerLength = Math.max(0.5, pivotY + h / 2 - 0.1);
  return {
    z,
    protractor: {
      radius: PROTRACTOR,
      center: new THREE.Vector3(px, pivotY - PROTRACTOR / 2, z),
      width: 2 * (PROTRACTOR + 0.04),
      height,
    },
    ruler: {
      length: rulerLength,
      center: new THREE.Vector3(px - RULER_OFFSET, pivotY - rulerLength / 2, z),
      width: 0.07,
    },
  };
}

/** The stand's fixed parts: base, posts, beam, the axle's bearing and the scales' mounts. */
export interface PendulumFrame {
  /** The base: the entity's own mesh takes it (its material shows focus). */
  readonly body: THREE.BufferGeometry;
  readonly parts: THREE.Group;
  dispose(): void;
}

/**
 * The pendulum stand as a gantry, in the item's frame (+x is where positive angles swing): a
 * chamfered base on four rubber pads; at each end a foot plate bolted to it, a steel post on it
 * and a diagonal brace from the base's edge; the beam resting on both posts with a knee gusset
 * at each joint; under the beam's middle two hanger plates bolted to it, round at the bottom about
 * the pivot, carrying the axle (a nut at each end); a clip holding the protractor under the beam
 * and an arm carrying the length scale. The swing plane (z = pivot) stays clear: the posts stand
 * at the base's ends, the hangers and the axle's nuts beside the hub. Only the look: the collider
 * is still the item's box, and the pivot, length and angle come from the item and the run.
 */
export function buildPendulumFrame(
  item: ItemDefinition,
  pendulum: Pendulum,
  painted: THREE.MeshStandardMaterial,
): PendulumFrame {
  const [w, h, d] = item.visual.size;
  const [px, py, pz] = pendulum.pivot;
  const pivot = new THREE.Vector3(px, py - h / 2, pz);
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));

  const floor = -h / 2;
  const baseTop = h / 2;
  const postZ = d / 2 - 0.06; // as the posts always stood
  const beamBottom = pivot.y + 0.05;
  const beamTop = beamBottom + BEAM;
  const plateTop = baseTop + FOOT_PLATE;

  // 1. The base on its pads (the base is the entity's mesh), foot plates bolted to it.
  const body = keep(slab(w - 0.004, d - 0.004, h - FOOT, 0.02, 0.005));
  body.translate(0, floor + FOOT, 0);
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  const pad = keep(new THREE.CylinderGeometry(0.022, 0.024, FOOT, 16));
  copies(
    pad,
    rubber,
    [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => at(sx * (w / 2 - 0.04), floor + FOOT / 2, sz * (d / 2 - 0.05))),
    ),
  ).castShadow = false;
  const footPlate = keep(slab(0.13, 0.13, FOOT_PLATE, 0.012, 0.002));
  const bolt = keep(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 6));
  const bolts: THREE.Matrix4[] = []; // the foot plates' and the hangers' (§3), one draw call
  for (const sz of [-1, 1])
    for (const bx of [-1, 1])
      for (const bz of [-1, 1])
        bolts.push(at(pivot.x + bx * 0.047, plateTop + 0.003, sz * postZ + bz * 0.047));
  copies(
    footPlate,
    painted,
    [-1, 1].map((sz) => at(pivot.x, baseTop, sz * postZ)),
  );

  // 2. Posts, braces, the beam on top and the knee gussets under its ends.
  const post = keep(slab(POST, POST, beamBottom - plateTop, 0.008, 0.003));
  copies(
    post,
    painted,
    [-1, 1].map((sz) => at(pivot.x, plateTop, sz * postZ)),
  ).name = 'posts';
  const braceFrom = w / 2 - 0.02;
  const braceRise = 0.3;
  const braceRun = braceFrom - POST / 2;
  const braceLength = Math.hypot(braceRun, braceRise);
  const brace = keep(new THREE.BoxGeometry(braceLength, 0.022, 0.022));
  copies(
    brace,
    painted,
    [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        at(
          pivot.x + sx * (POST / 2 + braceRun / 2),
          baseTop + braceRise / 2,
          sz * postZ,
          0,
          0,
          sx > 0 ? -Math.atan2(braceRise, braceRun) : Math.atan2(braceRise, braceRun),
        ),
      ),
    ),
  ).name = 'braces';
  const beam = keep(slab(BEAM, 2 * postZ + POST, BEAM, 0.008, 0.003));
  const beamMesh = mesh(beam, painted);
  beamMesh.name = 'beam';
  beamMesh.position.set(pivot.x, beamBottom, pivot.z);
  const knee = keep(knee3d(0.18, 0.01));
  copies(
    knee,
    painted,
    [-1, 1].map((sz) => at(pivot.x, beamBottom, sz * (postZ - POST / 2), 0, sz > 0 ? Math.PI : 0)),
  ).name = 'knees';

  // 3. The bearing: hanger plates bolted under the beam, the axle through them, a nut each end.
  const hangerZ = HUB + HUB_GAP + BRACKET / 2;
  const hanger = keep(hangerGeometry(beamBottom - pivot.y, BRACKET));
  copies(
    hanger,
    painted,
    [-1, 1].map((s) => at(pivot.x, pivot.y, pivot.z + s * hangerZ)),
  ).name = 'hangers';
  for (const bx of [-1, 1])
    for (const s of [-1, 1])
      bolts.push(at(pivot.x + bx * 0.018, beamTop + 0.003, pivot.z + s * hangerZ));
  copies(bolt, steel, bolts).castShadow = false;
  const axleHalf = hangerZ + BRACKET / 2 + 0.008;
  const axle = keep(new THREE.CylinderGeometry(0.008, 0.008, 2 * axleHalf, 16));
  const axleMesh = mesh(axle, steel);
  axleMesh.name = 'axle';
  axleMesh.rotation.x = Math.PI / 2;
  axleMesh.position.copy(pivot);
  const nut = keep(new THREE.CylinderGeometry(0.013, 0.013, 0.007, 6));
  const nuts = copies(
    nut,
    steel,
    [-1, 1].map((s) =>
      at(pivot.x, pivot.y, pivot.z + s * (hangerZ + BRACKET / 2 + 0.0035), Math.PI / 2),
    ),
  );
  nuts.name = 'nuts';
  nuts.castShadow = false;

  // 4. The scales' mounts, behind the swing plane: a clip from the beam to the protractor's top,
  //    an arm from the beam's side out to the length scale and a plate holding the scale's top.
  const layout = scaleLayout(item, pendulum);
  const mountZ = layout.z - 0.006;
  const protractorTop = layout.protractor.center.y + layout.protractor.height / 2;
  const clipHeight = beamBottom - (protractorTop - 0.012);
  const clip = keep(new THREE.BoxGeometry(0.05, clipHeight, 0.006));
  const clipMesh = mesh(clip, painted);
  clipMesh.castShadow = false;
  clipMesh.position.set(pivot.x, beamBottom - clipHeight / 2, mountZ);
  const armStart = pivot.x - BEAM / 2;
  const armEnd = layout.ruler.center.x - 0.045;
  const arm = keep(new THREE.BoxGeometry(armStart - armEnd, 0.02, 0.012));
  const armMesh = mesh(arm, painted);
  armMesh.name = 'scale-arm';
  armMesh.position.set((armStart + armEnd) / 2, beamBottom + 0.01, mountZ);
  const rulerTop = layout.ruler.center.y + layout.ruler.length / 2;
  const holderHeight = beamBottom + 0.02 - (rulerTop - 0.03);
  const holder = keep(new THREE.BoxGeometry(0.09, holderHeight, 0.006));
  mesh(holder, painted).position.set(
    layout.ruler.center.x,
    beamBottom + 0.02 - holderHeight / 2,
    mountZ,
  );

  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The swinging parts, about the pivot; `pose` sets them from the run, allocating nothing. */
export interface PendulumSwing {
  /** At the pivot; turned about z by the angle. */
  readonly swing: THREE.Group;
  /** The rod's length (m) and the angle (rad) — what the model gives, as it gives it. */
  pose(length: number, angle: number): void;
  dispose(): void;
}

/**
 * What swings: a hub on the axle with a clamp below it holding the rod; the rod, a thin steel bar
 * from the pivot to the bob's centre; the brass bob, with the rod's lock nut on top and the
 * through-bolt's nut underneath (the same, so the bob still reads as centred where the model has
 * it). The rod's length is a scale of a unit rod, the bob is placed at its end: no geometry is
 * made after this.
 */
export function buildPendulumSwing(pendulum: Pendulum, pivot: THREE.Vector3): PendulumSwing {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  const rodSteel = own(new THREE.MeshStandardMaterial({ color: '#6b737c', ...LOOKS.metal })); // P3.4
  const swing = kit.group;
  swing.position.copy(pivot);

  const hub = keep(new THREE.CylinderGeometry(0.016, 0.016, 2 * HUB, 20));
  const hubMesh = mesh(hub, steel, swing);
  hubMesh.name = 'hub';
  hubMesh.rotation.x = Math.PI / 2;
  const clamp = keep(new THREE.BoxGeometry(0.026, 0.03, 0.03));
  const clampMesh = mesh(clamp, steel, swing);
  clampMesh.name = 'clamp';
  clampMesh.position.y = -0.03;
  const screw = keep(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8));
  const screwMesh = mesh(screw, steel, swing);
  screwMesh.rotation.z = Math.PI / 2;
  screwMesh.castShadow = false;
  screwMesh.position.set(0.017, -0.03, 0);
  const rodGeometry = keep(new THREE.CylinderGeometry(0.006, 0.006, 1, 8));
  rodGeometry.translate(0, -0.5, 0); // from the pivot down; scaled to the length
  const rod = mesh(rodGeometry, rodSteel, swing);
  rod.name = 'rod';
  const r = pendulum.bobRadius;
  const bob = mesh(keep(new THREE.SphereGeometry(r, 24, 16)), brass, swing);
  bob.name = 'bob';
  const boss = keep(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 6));
  for (const s of [1, -1]) {
    const nutMesh = mesh(boss, steel, bob);
    nutMesh.castShadow = false;
    nutMesh.position.y = s * (r + 0.004);
  }

  let drawn = NaN;
  const pose = (length: number, angle: number) => {
    if (length !== drawn) {
      drawn = length;
      rod.scale.y = length;
      bob.position.y = -length;
    }
    swing.rotation.z = angle;
  };
  pose(1, 0); // until its session exists (the scene's stations attach after spawning)
  return { swing, pose, dispose: () => kit.dispose() };
}

/**
 * A hanger plate in the x–y plane about the pivot (origin), `thickness` thick and centred in z:
 * from the beam's underside (`top` above the pivot) down to a round end about the pivot.
 */
function hangerGeometry(top: number, thickness: number) {
  const outline: Outline = (inset) => [
    new THREE.Vector2(-BRACKET_R + inset, top - inset),
    ...arc(0, 0, BRACKET_R - inset, Math.PI, 2 * Math.PI, 12),
    new THREE.Vector2(BRACKET_R - inset, top - inset),
  ];
  const bevel = 0.0012;
  return loft(outline, [
    [bevel, -thickness / 2],
    [0, -thickness / 2 + bevel],
    [0, thickness / 2 - bevel],
    [bevel, thickness / 2],
  ]);
}

/**
 * A knee gusset in the post–beam plane: a right triangle with its corner at the origin (the post's
 * inner face under the beam), one leg along +z under the beam, one down the post; `thickness` in x.
 */
function knee3d(leg: number, thickness: number) {
  const outline: Outline = () => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, -leg),
    new THREE.Vector2(leg, 0),
  ];
  const geometry = loft(outline, [
    [0, -thickness / 2],
    [0, thickness / 2],
  ]);
  geometry.rotateY(-Math.PI / 2); // the outline's x along +z, its thickness along x
  return geometry;
}
