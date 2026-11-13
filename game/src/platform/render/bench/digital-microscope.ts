import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { SPECIMENS } from '../../../simulation/models/microscope';
import { arc, Assembly, at, loft, type Outline, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import {
  blurLevel,
  CELLS,
  createFieldPainter,
  fieldIsLive,
  FINE_PITCH,
  INK,
  NOSEPIECE,
  PATCH_INK,
  PATCH_SHAPE,
  scaleBar,
} from '../../labVisuals/specimenPicture';
import { box, drum, rod } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The microscope bench (model biology.microscope): a school compound microscope whose eyepiece
 * camera feeds the 7-inch monitor beside it, in real sizes (m) from the item's base centre, +z the
 * front where the student stands. Fixed (frame): the foot, the cast arm and the inclined monocular
 * head (the entity's mesh, in the item's colour); in black plastic the foot's pads, the stage, the
 * lamp's port, the coarse-focus and stage knobs, the eyepiece camera and its cable, and the
 * monitor's case on its stand; in steel the condenser, the eyepiece tube, the stage clips and the
 * stage knobs' shaft; in glass the slide and the coverslip. Moving (rig, posed from the station
 * only): the revolving nosepiece with its three DIN objectives (4× red, 10× yellow, 40× blue band;
 * parfocal, each tip its working distance above the specimen), turned to the dialled objective;
 * the specimen under the coverslip, shaped and tinted by slide and stain, lit from below while a
 * run exists; the lamp; the fine-focus knobs, turning 0.2 mm a turn with the stage's offset; and
 * the monitor's screen: standby grey without a run, else the field the camera sees, drawn on a
 * canvas for the slide, the stain and the run's field of view, magnification and contrast, blurred
 * to its sharpness in a few levels, and redrawn only when one of these changes.
 */

const X = -0.125; // the optical axis; the stage's centre is on it, at z 0
const FOOT = 0.006; // the rubber pads under the foot
const BASE = { w: 0.15, d: 0.2, h: 0.028, z: -0.018 };
const BASE_TOP = FOOT + BASE.h;
const ARM = { w: 0.046, back: -0.112 }; // the cast arm's width (x) and its back face (z)
const STAGE = { y: 0.12, size: 0.11, h: 0.008 };
const STAGE_TOP = STAGE.y + STAGE.h;
const SLIDE = { w: 0.075, d: 0.025, h: 0.001 }; // 75 × 25 × 1 mm
const COVERSLIP = { size: 0.018, h: 0.0002 };
/** The specimen's focal plane: on the slide, under the coverslip (m above the base). */
export const FOCAL_PLANE = STAGE_TOP + SLIDE.h;
const PARFOCAL = 0.045; // DIN: an objective's shoulder to the specimen in focus
/** The nosepiece's plate, its axis `reach` behind the stage centre: the active slot is over it. */
const TURRET = { r: 0.036, top: 0.026, h: 0.012, reach: 0.024 };
const TURRET_BOTTOM = FOCAL_PLANE + PARFOCAL; // the objectives' shoulders
const TILT = (15 * Math.PI) / 180; // the nosepiece's inclination
/** The arm's limb over the nosepiece. */
const LIMB = {
  bottom: TURRET_BOTTOM + TURRET.h,
  top: TURRET_BOTTOM + TURRET.h + 0.036,
  front: 0.025,
};
const AXIS = new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2); // the head's tube: 45° to the front
const KNOB = { y: 0.07, z: -0.085, coarse: 0.02, fine: 0.012, h: 0.012, fineH: 0.01 };
const LAMP = { r: 0.015, y: BASE_TOP + 0.005 };
const MONITOR = { x: 0.105, y: 0.1, z: -0.02, w: 0.19, h: 0.125, tilt: -0.2 }; // 7 in, tilted back
const SCREEN = { w: 0.155, h: 0.087, px: 512 }; // the 16:9 panel; its canvas is 512 × 288

const SLOT = (2 * Math.PI) / NOSEPIECE.length;

/** The specimen's tint under the coverslip, by slide (SPECIMENS order) and stain (STAINS order). */
export const PATCH = PATCH_INK.map((row) => row.map((hex) => new THREE.Color(hex)));

const STANDBY = '#2a2e33';
const BLACK = '#07080a';

export { blurLevel, CELLS, FINE_PITCH, INK, NOSEPIECE, PATCH_SHAPE, scaleBar };

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

// ---- geometry -------------------------------------------------------------------------------

type G = THREE.BufferGeometry;
type Piece = readonly [geometry: G, color?: string];

/** Pieces merged into one geometry (one draw), each in its vertex colour if it has one. */
function merge(pieces: readonly Piece[]): G {
  const color = new THREE.Color();
  for (const [g, hex] of pieces) {
    g.deleteAttribute('uv');
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    if (hex === undefined) continue;
    color.set(hex);
    const count = g.getAttribute('position').count;
    const rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(rgb, 3 * i);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  }
  const merged = mergeGeometries(pieces.map(([g]) => g));
  for (const [g] of pieces) g.dispose();
  return merged;
}

/** A solid of revolution about +y through the profile's (r, y) points, listed bottom up. */
function lathe(profile: readonly (readonly [number, number])[], segments = 24): G {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  // three's lathe leaves its last ring's normals unnormalised.
  const normal = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let i = 0; i < normal.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** A knob r × h on the x axis, its rims chamfered by c. */
const knob = (r: number, h: number, c: number) =>
  lathe(
    [
      [0, -h / 2],
      [r - c, -h / 2],
      [r, -h / 2 + c],
      [r, h / 2 - c],
      [r - c, h / 2],
      [0, h / 2],
    ],
    28,
  ).rotateZ(Math.PI / 2);

/** A convex polygon (counter-clockwise) with its corners rounded to `corner`, shrunk by the inset. */
function rounded(points: readonly THREE.Vector2[], corner: number): Outline {
  const n = points.length;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % n] ?? p;
    return new THREE.Vector2(q.y - p.y, p.x - q.x).normalize(); // outward
  });
  const corners = points.map((p, i) => {
    const a = normals[(i + n - 1) % n] ?? new THREE.Vector2();
    const b = normals[i] ?? a;
    // The arc's centre: `corner` inside both edges meeting at p.
    const centre = p.clone().addScaledVector(a.clone().add(b), -corner / (1 + a.dot(b)));
    const from = a.angle();
    const to = b.angle() < from ? b.angle() + 2 * Math.PI : b.angle();
    return { centre, from, to };
  });
  return (inset) =>
    corners.flatMap(({ centre, from, to }) =>
      arc(centre.x, centre.y, Math.max(0.0005, corner - inset), from, to, 4),
    );
}

/**
 * A solid of the convex side profile (z, y), `width` wide along x about the optical axis, its
 * corners rounded and its edges chamfered: the cast arm's parts.
 */
function prism(
  profile: readonly (readonly [z: number, y: number])[],
  width: number,
  corner: number,
  bevel: number,
): G {
  // The loft's outline (u, v) = (−z, y): rotateY(π/2) takes its (u, v, s) to (s, v, −u).
  const points = profile.map(([z, y]) => new THREE.Vector2(-z, y));
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    return sum + p.x * q.y - q.x * p.y;
  }, 0);
  if (area < 0) points.reverse();
  const w = width / 2;
  return loft(rounded(points, corner), [
    [bevel, -w],
    [0, -w + bevel],
    [0, w - bevel],
    [bevel, w],
  ])
    .rotateY(Math.PI / 2)
    .translate(X, 0, 0);
}

/** n + 1 points along the cubic Bézier a → b with control points p, q. */
function bezier(a: THREE.Vector3, p: THREE.Vector3, q: THREE.Vector3, b: THREE.Vector3, n: number) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const s = 1 - t;
    return new THREE.Vector3()
      .addScaledVector(a, s * s * s)
      .addScaledVector(p, 3 * s * s * t)
      .addScaledVector(q, 3 * s * t * t)
      .addScaledVector(b, t * t * t);
  });
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---- frame ----------------------------------------------------------------------------------

/**
 * The fixed parts: the body (foot, the cast arm — upright, limb and the fillet between — the
 * stage's and the condenser's brackets, the head and its inclined tube: the entity's mesh, the
 * largest part, so focus shows) and, merged by material, the plastics, the steel and the glass.
 */
function frame(item: ItemDefinition): BenchFrame {
  const [, h] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.y = -h / 2; // the parts are laid out from the base
  const plastic = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.plastic }),
  );
  const metal = own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal }));
  // See-through: no depth write, so the specimen under the coverslip shows (palette.ts).
  const glass = own(
    new THREE.MeshStandardMaterial({
      color: '#dfeef3',
      ...GLASSWARE_LOOK,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const dark = '#1f2327';
  const black = '#121416';

  // 1. The body. The head's front is sloped at 45°: its tube rises from that face's centre.
  const face = v(X, LIMB.top + 0.019, 0.009);
  const tubeTop = face.clone().addScaledVector(AXIS, 0.069);
  const body = keep(
    merge([
      [slab(BASE.w, BASE.d, BASE.h, 0.03, 0.005).translate(X, FOOT, BASE.z)],
      // The upright, deeper at the foot; the limb over the nosepiece; the fillet between them.
      [
        prism(
          [
            [ARM.back, BASE_TOP - 0.004],
            [-0.056, BASE_TOP - 0.004],
            [-0.07, 0.2],
            [ARM.back, 0.2],
          ],
          ARM.w,
          0.008,
          0.003,
        ),
      ],
      [
        prism(
          [
            [ARM.back, LIMB.bottom],
            [LIMB.front, LIMB.bottom],
            [LIMB.front - 0.006, LIMB.top],
            [ARM.back, LIMB.top],
          ],
          ARM.w + 0.004,
          0.01,
          0.003,
        ),
      ],
      [
        prism(
          [
            [-0.072, 0.162],
            [-0.058, LIMB.bottom + 0.004],
            [-0.072, LIMB.bottom + 0.004],
          ],
          ARM.w,
          0.002,
          0.002,
        ),
      ],
      // The head on the limb.
      [
        prism(
          [
            [-0.05, LIMB.top - 0.004],
            [0.022, LIMB.top - 0.004],
            [0.022, LIMB.top + 0.006],
            [-0.004, LIMB.top + 0.032],
            [-0.05, LIMB.top + 0.032],
          ],
          0.048,
          0.006,
          0.002,
        ),
      ],
      [rod(0.017, face.clone().addScaledVector(AXIS, -0.006), tubeTop, 24)],
      // The stage's bracket, and the condenser's under it, on the upright's front.
      [slab(0.06, 0.03, 0.02, 0.004, 0.0015).translate(X, STAGE.y - 0.02, -0.055)],
      [slab(0.026, 0.06, 0.008, 0.004, 0.0015).translate(X, 0.09, -0.04)],
    ]),
  );
  body.translate(0, -h / 2, 0);

  // 2. The plastics, in their vertex colours.
  const shell: Piece[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      shell.push([
        drum(0.011, 0.011, 0, FOOT, 12).translate(X + sx * 0.055, 0, BASE.z + sz * 0.08),
        black,
      ]);
  shell.push([slab(STAGE.size, STAGE.size, STAGE.h, 0.006, 0.0015).translate(X, STAGE.y, 0), dark]);
  // The stage's light hole over the condenser, under the slide.
  shell.push([
    drum(0.01, 0.01, STAGE_TOP - 0.001, STAGE_TOP + 0.0001, 24).translate(X, 0, 0),
    BLACK,
  ]);
  // The lamp's port in the foot: a chamfered collar round the lens (rig).
  shell.push([
    lathe(
      [
        [LAMP.r, BASE_TOP - 0.001],
        [0.021, BASE_TOP - 0.001],
        [0.021, LAMP.y - 0.0015],
        [0.0195, LAMP.y],
        [LAMP.r, LAMP.y],
      ],
      28,
    ).translate(X, 0, 0),
    dark,
  ]);
  // The coarse-focus knobs on the upright's sides (the fine ones, outside them, turn: rig).
  for (const s of [-1, 1]) {
    shell.push([
      knob(KNOB.coarse, KNOB.h, 0.0025).translate(X + s * (ARM.w / 2 + KNOB.h / 2), KNOB.y, KNOB.z),
      dark,
    ]);
  }
  // The stage's coaxial X–Y knobs, hanging under its right front.
  const ctrl = { x: X + 0.045, z: 0.03 };
  shell.push([
    lathe(
      [
        [0, 0.06],
        [0.0055, 0.06],
        [0.006, 0.0605],
        [0.006, 0.0715],
        [0.009, 0.072],
        [0.009, 0.0835],
        [0.0085, 0.084],
        [0, 0.084],
      ],
      20,
    ).translate(ctrl.x, 0, ctrl.z),
    dark,
  ]);
  // The eyepiece camera on the eyepiece tube, its end cap, and its cable from the side, hanging
  // to the bench and along it into the monitor's stand.
  const camEnd = tubeTop.clone().addScaledVector(AXIS, 0.052);
  shell.push([rod(0.0175, tubeTop.clone().addScaledVector(AXIS, 0.016), camEnd, 24), black]);
  shell.push([rod(0.015, camEnd, tubeTop.clone().addScaledVector(AXIS, 0.056), 24), '#3a3f45']);
  const plug = camEnd
    .clone()
    .addScaledVector(AXIS, -0.01)
    .setX(X + 0.016);
  const cable = [
    ...bezier(
      plug,
      v(X + 0.07, plug.y, plug.z),
      v(X + 0.12, 0.06, 0.08),
      v(X + 0.13, 0.0026, 0.04),
      12,
    ),
    // Behind the monitor's foot, then up into its case's back.
    v(X + 0.15, 0.0026, -0.07),
    v(MONITOR.x - 0.01, 0.0026, -0.085),
    v(MONITOR.x + 0.03, 0.02, -0.08),
    v(MONITOR.x + 0.03, 0.065, -0.024),
  ];
  for (let i = 0; i + 1 < cable.length; i++) {
    shell.push([rod(0.0025, cable[i] ?? plug, cable[i + 1] ?? plug, 8), black]);
  }
  // The monitor: its case (a flat slab stood up and tilted back), neck and foot.
  shell.push([
    slab(MONITOR.w, MONITOR.h, 0.014, 0.008, 0.002)
      .rotateX(-Math.PI / 2)
      .applyMatrix4(at(MONITOR.x, MONITOR.y, MONITOR.z, MONITOR.tilt)),
    '#24282d',
  ]);
  shell.push([slab(0.03, 0.012, 0.074, 0.004, 0.001).translate(MONITOR.x, FOOT, -0.036), dark]);
  shell.push([slab(0.1, 0.075, 0.006, 0.012, 0.002).translate(MONITOR.x, 0, -0.025), dark]);
  // The slide's frosted end.
  shell.push([
    box(0.018, 0.0002, SLIDE.d - 0.002, X - SLIDE.w / 2 + 0.009, FOCAL_PLANE + 0.0001, 0),
    '#f2f1ec',
  ]);

  // 3. The steel: the eyepiece tube, the condenser, the stage knobs' shaft, the clips on their pins.
  const steel: Piece[] = [
    [
      rod(
        0.0135,
        tubeTop.clone().addScaledVector(AXIS, -0.004),
        tubeTop.clone().addScaledVector(AXIS, 0.02),
        24,
      ),
    ],
    [
      lathe(
        [
          [0, 0.086],
          [0.011, 0.086],
          [0.014, 0.096],
          [0.017, 0.11],
          [0.017, STAGE.y],
          [0, STAGE.y],
        ],
        28,
      ).translate(X, 0, 0),
    ],
    [drum(0.002, 0.002, 0.084, STAGE.y, 8).translate(ctrl.x, 0, ctrl.z)],
  ];
  for (const s of [-1, 1]) {
    const x = X + s * 0.031;
    steel.push([drum(0.003, 0.003, STAGE_TOP, STAGE_TOP + 0.005, 10).translate(x, 0, -0.024)]);
    steel.push([box(0.004, 0.0008, 0.04, x, FOCAL_PLANE + 0.0008, -0.004)]);
  }

  // 4. The glass: the slide and, a hair above it (the specimen between), the coverslip.
  const glassPieces: Piece[] = [
    [box(SLIDE.w, SLIDE.h, SLIDE.d, X, STAGE_TOP + SLIDE.h / 2, 0)],
    [box(COVERSLIP.size, COVERSLIP.h, COVERSLIP.size, X, FOCAL_PLANE + 0.0004, 0)],
  ];

  const part = (name: string, pieces: Piece[], material: THREE.Material, casts = true) => {
    const m = mesh(keep(merge(pieces)), material);
    m.name = name;
    m.castShadow = casts;
    return m;
  };
  part('plastic', shell, plastic);
  part('metal', steel, metal);
  // Before the specimen (rig): the slide under it must not veil it; the 0.2 mm coverslip's veil
  // over it would not show.
  part('glass', glassPieces, glass, false).renderOrder = 2;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

// ---- the monitor's picture --------------------------------------------------------------------

interface Screen {
  /** Null without a page or a 2D context (tests): the screen is then a plain dark panel. */
  readonly texture: THREE.CanvasTexture | null;
  /**
   * Draws the field (`live`) or standby, when what it shows changed: the slide, stain, field of
   * view and contrast (the sharp picture), the magnification (its overlay) or the blur level.
   */
  show(
    live: boolean,
    specimen: number,
    stain: number,
    fieldOfView: number,
    magnification: number,
    contrast: number,
    level: number,
  ): void;
  dispose(): void;
}

function makeScreen(): Screen {
  const none: Screen = { texture: null, show: () => undefined, dispose: () => undefined };
  if (typeof document === 'undefined') return none;
  const w = SCREEN.px;
  const h = (w * 9) / 16;
  const canvasOf = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  };
  const canvas = canvasOf();
  const field = canvasOf(); // the sharp picture, composited onto the screen through the blur
  const c = canvas.getContext('2d');
  const f = field.getContext('2d');
  if (!c || !f) return none;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; // seen at an angle from the desk
  const paint = createFieldPainter({
    screen: c,
    buffer: f,
    bufferImage: field,
    width: w,
    height: h,
  });
  const show: Screen['show'] = (...args) => {
    if (paint(...args)) texture.needsUpdate = true;
  };
  return { texture, show, dispose: () => texture.dispose() };
}

// ---- rig ------------------------------------------------------------------------------------

/**
 * The parts drawn from the station; `pose` turns the nosepiece and the fine-focus knobs, lights
 * the lamp and the specimen, shapes and tints the specimen and asks the screen to redraw — each
 * only when what it shows changes — and allocates nothing.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  // Its parts are laid out from the base centre, as the frame's.
  const base = new THREE.Group();
  const [tx, ty, tz] = item.bench?.top ?? [0, 0, 0];
  base.position.set(-tx, -ty, -tz);
  kit.group.add(base);

  // The nosepiece: a chrome plate on its axis behind the stage centre, the objectives under it —
  // each a chrome shoulder, black body with its DIN colour band, and a narrower chrome tip —
  // slot 0 forward. Inclined as a real one: its axis leans back by TILT and each objective leans
  // out from it by TILT, so the one in use hangs plumb over the specimen and the others splay
  // back. An empty marks each tip for the tests.
  const shoulder = -TURRET.h / 2;
  const mount = new THREE.Group();
  mount.rotation.x = TILT;
  // Placed so the forward slot's shoulder centre is on the optical axis at TURRET_BOTTOM.
  mount.position
    .set(0, shoulder, TURRET.reach)
    .applyEuler(mount.rotation)
    .negate()
    .add(new THREE.Vector3(X, TURRET_BOTTOM, 0));
  base.add(mount);
  const turret = new THREE.Group();
  turret.name = 'nosepiece';
  mount.add(turret);
  const chrome = '#c9ced3';
  const pieces: Piece[] = [[drum(TURRET.r, TURRET.top, shoulder, -shoulder, 32), chrome]];
  const socket = new THREE.Matrix4();
  NOSEPIECE.forEach(({ magnification, workingDistance, radius: r, band }, i) => {
    // The objective's own frame: its shoulder at the origin, its axis down −y.
    socket
      .makeRotationY(i * SLOT)
      .multiply(new THREE.Matrix4().makeTranslation(0, shoulder, TURRET.reach))
      .multiply(new THREE.Matrix4().makeRotationX(-TILT));
    const tip = -(PARFOCAL - workingDistance);
    pieces.push(
      // The shoulder reaches into the plate: no gap shows where the leaning objective meets it.
      [drum(r + 0.0015, r + 0.0015, -0.006, 0.004, 16).applyMatrix4(socket), chrome],
      [drum(r, r, tip + 0.004, -0.006, 16).applyMatrix4(socket), '#121416'],
      [drum(r + 0.0004, r + 0.0004, -0.02, -0.015, 16).applyMatrix4(socket), band],
      [drum(r * 0.6, r * 0.6, tip, tip + 0.004, 12).applyMatrix4(socket), chrome],
    );
    const marker = new THREE.Object3D();
    marker.name = `objective-${magnification}`;
    marker.position.set(0, tip, 0).applyMatrix4(socket);
    turret.add(marker);
  });
  // Satin, not metal: lit only by lights, a metal would darken the colour bands that tell the
  // objectives apart; the vertex colours give the chrome its tone.
  const plate = mesh(
    keep(merge(pieces)),
    own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.satin })),
    turret,
  );
  plate.name = 'turret';

  // The specimen under the coverslip: a thin disc shaped and tinted by slide and stain.
  const tint = own(
    new THREE.MeshStandardMaterial({ ...LOOKS.matte, transparent: true, depthWrite: false }),
  );
  const patch = mesh(keep(drum(0.006, 0.006, 0, 0.0002, 20)), tint, base);
  patch.name = 'specimen';
  patch.position.set(X, FOCAL_PLANE, 0);
  patch.renderOrder = 3; // after the glass (frame): the slide's top face lies under it
  patch.castShadow = false;
  patch.receiveShadow = false;
  patch.visible = false;

  // The lamp's lens in the foot: frosted, or lit (reads at any light).
  const lit = own(new THREE.MeshBasicMaterial({ color: '#fff3d8' }));
  const frosted = own(new THREE.MeshStandardMaterial({ color: '#d9d3c6', ...LOOKS.matte }));
  const lamp = mesh(keep(drum(LAMP.r, LAMP.r, -0.0015, 0.0005, 24)), frosted, base);
  lamp.name = 'lamp';
  lamp.position.set(X, LAMP.y, 0);
  lamp.castShadow = false;
  swaps(lamp, lit);

  // The fine-focus knobs outside the coarse ones, an index mark on each rim: one draw.
  const knobX = [-1, 1].map((s) => X + s * (ARM.w / 2 + KNOB.h + KNOB.fineH / 2));
  const knobs = kit.copies(
    keep(
      merge([
        [knob(KNOB.fine, KNOB.fineH, 0.002), '#1f2327'],
        [box(KNOB.fineH * 0.6, 0.002, 0.004, 0, KNOB.fine - 0.0005, 0), '#eceff1'],
      ]),
    ),
    own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.plastic })),
    knobX.map((x) => at(x, KNOB.y, KNOB.z)),
    base,
  );
  knobs.name = 'fine-focus';
  knobs.castShadow = false;

  // The monitor's panel, a hair in front of its case.
  const screen = makeScreen();
  const panel = mesh(
    keep(
      new THREE.PlaneGeometry(SCREEN.w, SCREEN.h)
        .translate(0, 0, 0.0005)
        .applyMatrix4(at(MONITOR.x, MONITOR.y, MONITOR.z, MONITOR.tilt)),
    ),
    own(
      new THREE.MeshBasicMaterial(
        screen.texture ? { map: screen.texture, toneMapped: false } : { color: STANDBY },
      ),
    ),
    base,
  );
  panel.name = 'screen';
  panel.castShadow = false;
  panel.receiveShadow = false;

  // What is drawn now: pose skips what has not changed.
  const m = new THREE.Matrix4();
  let on: boolean | null = null;
  let slot = -1;
  let shownSpecimen = NaN;
  let shownStain = NaN;
  let turns = NaN;
  const pose = ({ status, parameters, sample }: BenchPose) => {
    // A run exists while it is in progress, stopped or completed: the lamp is on and the camera
    // shows its field; idle and RESET (configured) switch both off.
    const run = status === 'running' || status === 'stopped' || status === 'completed';
    if (run !== on) {
      on = run;
      lamp.material = run ? lit : frosted;
      tint.emissiveIntensity = run ? 0.6 : 0; // the slide lit from below
    }
    const objective = parameters.objective ?? NaN;
    let next = -1;
    for (let i = 0; i < NOSEPIECE.length; i++) {
      if (NOSEPIECE[i]?.magnification === objective) next = i;
    }
    if (next >= 0 && next !== slot) {
      slot = next;
      turret.rotation.y = -slot * SLOT;
    }
    const specimen = parameters.specimen ?? NaN;
    const stain = parameters.stain ?? NaN;
    if (!Object.is(specimen, shownSpecimen) || !Object.is(stain, shownStain)) {
      shownSpecimen = specimen;
      shownStain = stain;
      const color = PATCH[specimen]?.[stain];
      const contrast = SPECIMENS[specimen]?.contrast[stain];
      const shape = PATCH_SHAPE[specimen];
      patch.visible = color !== undefined && contrast !== undefined && shape !== undefined;
      if (color && contrast !== undefined && shape) {
        tint.color.copy(color);
        tint.emissive.copy(color);
        tint.opacity = 0.25 + 0.7 * contrast;
        patch.scale.set(shape[0], 1, shape[1]);
      }
    }
    // The fine focus turned since the run started: the stage's offset from where it started
    // (the run's own input), FINE_PITCH µm a turn; at its start, and without a run, 0.
    const offset = sample.offset ?? NaN;
    const start = parameters.focusStart ?? NaN;
    const turned =
      run && Number.isFinite(offset) && Number.isFinite(start) ? (start - offset) / FINE_PITCH : 0;
    if (turned !== turns) {
      turns = turned;
      for (let i = 0; i < knobX.length; i++) {
        m.makeRotationX(turned * 2 * Math.PI).setPosition(knobX[i] ?? X, KNOB.y, KNOB.z);
        knobs.setMatrixAt(i, m);
      }
      knobs.instanceMatrix.needsUpdate = true;
    }
    const fov = sample.fieldOfView ?? NaN;
    const sharpness = sample.sharpness ?? NaN;
    const live = fieldIsLive(run, fov, sharpness);
    screen.show(
      live,
      specimen,
      stain,
      fov,
      sample.magnification ?? NaN,
      sample.contrast ?? NaN,
      live ? blurLevel(sharpness) : 0,
    );
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      kit.dispose();
      screen.dispose();
    },
  };
}

export const digitalMicroscope: BenchModel = {
  frame,
  rig,
  reads: ['offset', 'sharpness', 'fieldOfView', 'magnification', 'contrast'],
};
