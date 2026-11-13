import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import { box, part } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The adjustable inclined plane (model `mechanics.incline`): a ramp hinged at its foot on a base
// board, its raised side resting on the cross rod of a boss clamp on a retort stand beside the
// base; a clear protractor quadrant at the hinge; a ruler along the ramp's front edge reading from
// the light gate up to the release stop's index; the gate and the end stop at the foot; the block,
// a wooden carrier with a face pad of the chosen surface, under brass plates on its peg. The stand
// is tall (two rods) because the dial reaches 60°; its large base reaches back under the ramp.
//
// Item frame: origin at the centre of the item's box, +z the front (ruler and protractor side),
// `bench.top` the hinge line (from the base centre), the ramp rising towards −x. The ramp's
// angle, surface pair, mass and the release stop come from the pose's parameters (the run's own
// inputs, else the dials); the block slides by the model's `distance`.

const DEG = Math.PI / 180;
const FOOT = 0.006; // rubber pads under the base board
const BASE_W = 0.2; // the base board's depth (z)
const RAMP = { length: 1.8, width: 0.15, thick: 0.018 } as const;
const STRIP = 0.003; // the surface strip on the ramp, between the rails
const RAIL = { width: 0.008, height: 0.015 } as const;
const DECK = RAMP.thick + STRIP; // the strip's top above the ramp's underside
/** The light gate's beam, along the ramp from the hinge: the block's centre reaches it at s = L. */
const GATE_U = 0.2;
const BLOCK = { length: 0.08, width: 0.05, height: 0.04, pad: 0.003 } as const;
const STOP = 0.015; // the release stop's bar, along the ramp
const PROTRACTOR = 0.14; // its radius, centred on the hinge line
/**
 * The retort stand: its rod `reach` m up-ramp of the hinge, `z` behind the ramp's centre, its top
 * `height` over the hinge line: just above the clamp at the dial's 60°. That is ~1.5 m of rod, so
 * it is two rods screwed end to end (the joint shows as a seam), on a large cast-iron base.
 */
const STAND = { reach: 0.85, z: -0.14, rod: 0.006, height: 1.52 } as const;
/**
 * The stand's base: the ramp pushes the rod down and away from the hinge (−x), so the base reaches
 * `back` m behind the rod under that push, `front` m towards the hinge, and forward (+z) under the
 * cross rod's load.
 */
const PLATE = { back: 0.28, front: 0.04, depth: 0.3, height: 0.012, z: -0.03 } as const;
const ROD = 0.006; // the clamp's cross rod the ramp rests on (radius)
// The block: a 0.08 × 0.05 × 0.04 m wooden carrier, about 0.1 kg; the rest of m in 0.1 kg brass
// plates of the block's footprint on a peg in its top (8.5 g/cm³ over 78 × 48 mm → 3.1 mm thick),
// at most 19 for the 2 kg dial maximum: a low stack held on the peg, not a tower of loose discs.
const CARRIER_KG = 0.1;
const MASS_KG = 0.1;
const MASS = { length: 0.078, width: 0.048, thick: 0.0031 } as const;
const MASSES = 19;
const PEG = { radius: 0.004, above: 0.008 } as const; // it stands `above` m over the top plate
/** The tallest stack's top, peg included, above the carrier's underside. */
const STACK_TOP = BLOCK.height + MASSES * MASS.thick + PEG.above;
/** The idle setup until the station gives its dials: the definition's defaults. */
const IDLE = { angle: 30, surface: 3, mass: 0.5, length: 1 } as const;

/**
 * The surface pairs `surface` 1–4 selects (`SURFACES` in the model): the ramp's strip and the
 * block's face pad, the same material on both: white Teflon, oiled metal (dark and warm under its
 * film), wood, dry steel (bare, light): the two metals differ in tone, not only in sheen.
 */
const SURFACE_LOOKS: readonly THREE.MeshStandardMaterialParameters[] = [
  { color: '#f3f2ec', ...LOOKS.satin },
  { color: '#6f6656', ...LOOKS.metal },
  { color: '#c9a273', ...LOOKS.matte },
  { color: '#b4bcc4', ...LOOKS.metal },
];

/** The hinge line, in the item's frame: `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** Pieces merged into one geometry (one draw). */
const merged = (pieces: THREE.BufferGeometry[]) => part('body', true, pieces).geometry;

/** A canvas texture painted by `draw`; null outside a browser (tests): the part stays plain. */
function painted2d(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, ctx };
}

/**
 * The fixed parts: the base board and the stand's plate (the entity's mesh), rubber pads, the
 * steel (stand rod, hinge, protractor bracket), the clear protractor and the gate's timer.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const [, h] = item.visual.size;
  const floor = -h / 2;
  const hinge = topOf(item);
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const lcd = own(new THREE.MeshBasicMaterial({ color: '#1c3326' })); // an unlit display
  const textures: THREE.Texture[] = [];

  // 1. The base board (its top is the hinge line) beside the retort stand's plate.
  const postX = hinge.x - STAND.reach;
  const postZ = hinge.z + STAND.z;
  const from = postX + PLATE.front + 0.01;
  const to = hinge.x + 0.05;
  const baseH = hinge.y - floor - FOOT;
  const body = keep(
    merged([
      slab(to - from, BASE_W, baseH, 0.012, 0.003).translate(
        (from + to) / 2,
        floor + FOOT,
        hinge.z,
      ),
      slab(PLATE.back + PLATE.front, PLATE.depth, PLATE.height, 0.012, 0.003).translate(
        postX + (PLATE.front - PLATE.back) / 2,
        floor,
        hinge.z + PLATE.z,
      ),
    ]),
  );
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  copies(
    keep(new THREE.CylinderGeometry(0.015, 0.017, FOOT, 12)),
    rubber,
    [from + 0.04, to - 0.04].flatMap((x) =>
      [-1, 1].map((s) => at(x, floor + FOOT / 2, hinge.z + s * (BASE_W / 2 - 0.03))),
    ),
  ).castShadow = false;

  // 2. Steel: the stand's rod, the hinge's knuckle and its leaf on the base, the protractor's
  //    bracket on the base's front face.
  const postBottom = floor + PLATE.height;
  const postTop = hinge.y + STAND.height;
  const knuckle = new THREE.CylinderGeometry(0.005, 0.005, RAMP.width - 0.01, 12);
  knuckle.rotateX(Math.PI / 2).translate(hinge.x, hinge.y, hinge.z);
  const front = hinge.z + BASE_W / 2;
  mesh(
    keep(
      merged([
        new THREE.CylinderGeometry(STAND.rod, STAND.rod, postTop - postBottom, 12).translate(
          postX,
          (postTop + postBottom) / 2,
          postZ,
        ),
        new THREE.SphereGeometry(STAND.rod, 10, 6).translate(postX, postTop, postZ),
        // The joint of the two rods: a seam just proud of the rod, half-way up.
        new THREE.CylinderGeometry(STAND.rod + 0.0004, STAND.rod + 0.0004, 0.003, 12).translate(
          postX,
          (postTop + postBottom) / 2,
          postZ,
        ),
        knuckle,
        box(0.03, 0.002, RAMP.width - 0.01, hinge.x + 0.015, hinge.y + 0.001, hinge.z),
        box(
          PROTRACTOR + 0.01,
          0.022,
          0.002,
          hinge.x - PROTRACTOR / 2,
          hinge.y - 0.011,
          front + 0.001,
        ),
      ]),
    ),
    steel,
  ).name = 'stand';

  // 3. The protractor: clear acrylic, a quarter disc about the hinge line (0° along the base, 90°
  //    straight up), ticks every degree, figures every 10°. See-through: no depth write.
  const scale = painted2d(512, 512, (ctx) => {
    const c = 256;
    const s = c / PROTRACTOR; // px per metre
    ctx.fillStyle = 'rgba(232, 242, 247, 0.3)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1d2731';
    ctx.fillStyle = '#1d2731';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let a = 0; a <= 90; a++) {
      const t = a * DEG;
      const long = a % 10 === 0;
      const inner = c - (long ? 0.025 : a % 5 === 0 ? 0.017 : 0.01) * s;
      ctx.lineWidth = long ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(c - Math.cos(t) * inner, c - Math.sin(t) * inner);
      ctx.lineTo(c - Math.cos(t) * (c - 2), c - Math.sin(t) * (c - 2));
      ctx.stroke();
      if (long) {
        const r = c - 0.037 * s;
        ctx.fillText(`${a}°`, c - Math.cos(t) * r, c - Math.sin(t) * r + 8);
      }
    }
  });
  if (scale) textures.push(scale.texture);
  const protractor = mesh(
    keep(new THREE.CircleGeometry(PROTRACTOR, 32, Math.PI / 2, Math.PI / 2)),
    own(
      new THREE.MeshStandardMaterial({
        color: scale ? '#ffffff' : '#e8f2f7',
        map: scale?.texture ?? null,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: scale ? 1 : 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
  protractor.name = 'protractor';
  protractor.position.set(hinge.x, hinge.y, front + 0.003);
  protractor.castShadow = false;

  // 4. The light gate's timer, on the bench in front of the base, its display facing the player
  //    (blank: the results show the run's time).
  const timerX = hinge.x - 0.3;
  const timerZ = front + 0.04;
  mesh(keep(slab(0.12, 0.06, 0.05, 0.006, 0.002)), plastic).position.set(timerX, floor, timerZ);
  const screen = mesh(keep(new THREE.PlaneGeometry(0.08, 0.022)), lcd);
  screen.name = 'timer-display';
  screen.position.set(timerX, floor + 0.03, timerZ + 0.0306);
  screen.castShadow = false;

  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

/**
 * What the run sets: the ramp (tilted about the hinge, with its strip, ruler, light gate, end stop
 * and release stop), the clamp's cross rod under it, and the block with its masses and label.
 * `pose` only assigns, skipping what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const textures: THREE.Texture[] = [];
  kit.group.position.copy(topOf(item));
  const aluminium = own(new THREE.MeshStandardMaterial({ color: '#c6ccd2', ...LOOKS.satin }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const wood = own(new THREE.MeshStandardMaterial({ color: '#8a6239', ...LOOKS.matte }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  const surfaces = SURFACE_LOOKS.map((look) => own(new THREE.MeshStandardMaterial(look)));
  const idle = surfaces[IDLE.surface - 1] ?? wood;
  const L = RAMP.length;
  const half = RAMP.width / 2;
  const inner = RAMP.width - 2 * RAIL.width;

  // The ramp turns about the hinge line; in its frame the underside is y = 0, up-ramp is −x.
  const tilt = new THREE.Group();
  tilt.name = 'ramp';
  kit.group.add(tilt);
  mesh(
    keep(
      merged([
        slab(L, RAMP.width, RAMP.thick, 0.004, 0.0015),
        ...[-1, 1].map((s) =>
          slab(L, RAIL.width, RAIL.height, 0.002, 0.001).translate(
            0,
            RAMP.thick,
            s * (half - RAIL.width / 2),
          ),
        ),
      ]).translate(-L / 2, 0, 0),
    ),
    aluminium,
    tilt,
  ).name = 'ramp-board';
  const strip = mesh(
    keep(box(L - 0.004, STRIP, inner, -L / 2, RAMP.thick + STRIP / 2)),
    idle,
    tilt,
  );
  strip.name = 'strip';
  swaps(strip, ...surfaces);
  strip.castShadow = false; // inside the board's shadow

  // The ruler on the front edge: 0 at the gate's beam, up the ramp to 1.5 m (the release stop's
  // index points at the mark L), centimetres, figures every 0.1 m.
  const u0 = GATE_U - 0.01;
  const u1 = L - 0.04;
  const rulerH = DECK + RAIL.height - 0.006;
  const rulerPx = Math.round((2048 * rulerH) / (u1 - u0)); // the plane's proportions: no stretch
  const marks = painted2d(2048, rulerPx, (ctx) => {
    const s = 2048 / (u1 - u0); // px per metre
    const k = rulerPx / 48; // sizes drawn for a 48 px tall strip
    ctx.fillStyle = '#f2d75a';
    ctx.fillRect(0, 0, 2048, rulerPx);
    ctx.fillStyle = '#1d2731';
    ctx.font = `600 ${Math.round(20 * k)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let cm = 0; GATE_U + cm / 100 <= u1; cm++) {
      const x = (u1 - GATE_U - cm / 100) * s; // the canvas's left edge is the ramp's top end
      const tall = (cm % 10 === 0 ? 18 : cm % 5 === 0 ? 12 : 7) * k;
      ctx.fillRect(x - 1, 0, 2, tall);
      if (cm % 10 === 0 && cm > 0) ctx.fillText((cm / 100).toFixed(1), x, rulerPx - 6 * k);
    }
  });
  if (marks) textures.push(marks.texture);
  const ruler = mesh(
    keep(new THREE.PlaneGeometry(u1 - u0, rulerH)),
    own(
      new THREE.MeshStandardMaterial({
        color: marks ? '#ffffff' : '#f2d75a',
        map: marks?.texture ?? null,
        ...LOOKS.satin,
      }),
    ),
    tilt,
  );
  ruler.name = 'ruler';
  ruler.position.set(-(u0 + u1) / 2, rulerH / 2 + 0.003, half + 0.0006);
  ruler.castShadow = false;

  // The light gate straddling the ramp (its sensors face each other over the rails), the end stop
  // the block comes to rest against, and the index along the ramp's underside line that reads the
  // angle on the protractor: one dark part.
  const top = DECK + STACK_TOP + 0.012; // the crossbar's underside, over the tallest stack
  mesh(
    keep(
      merged([
        ...[-1, 1].flatMap((s) => [
          box(0.02, top, 0.008, -GATE_U, top / 2, s * (half + 0.004)),
          box(0.014, 0.014, 0.012, -GATE_U, DECK + 0.024, s * (half - 0.006)),
        ]),
        box(0.02, 0.012, RAMP.width + 0.024, -GATE_U, top + 0.006, 0),
        box(0.02, 0.025, inner, -(GATE_U - BLOCK.length / 2 - 0.01), DECK + 0.0125, 0),
        box(PROTRACTOR - 0.02, 0.002, 0.022, -(PROTRACTOR / 2 + 0.01), 0.001, half + 0.012),
      ]),
    ),
    plastic,
    tilt,
  ).name = 'light-gate';

  // The release stop: a bar across the strip, clamped to both rails, the block against it; a tongue
  // from its front clamp over the ruler ends at the block's centre: the index that reads L.
  const tip = BLOCK.length / 2 + STOP / 2;
  const stop = mesh(
    keep(
      merged([
        box(STOP, 0.02, inner, 0, DECK + 0.01, 0),
        ...[-1, 1].map((s) =>
          box(
            0.03,
            0.012,
            0.014,
            0,
            DECK + RAIL.height - STRIP + 0.006,
            s * (half - RAIL.width / 2),
          ),
        ),
        new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12)
          .rotateX(Math.PI / 2)
          .translate(0, DECK + 0.01, half + 0.006),
        box(tip - 0.015, 0.002, 0.014, (tip + 0.015) / 2, DECK + RAIL.height - STRIP + 0.001, half),
      ]),
    ),
    steel,
    tilt,
  );
  stop.name = 'release-stop';

  // The block on the strip: its face pad (the surface pair), the wooden carrier, the brass plates;
  // each plate carries the peg's piece up to `PEG.above` over it, hidden by the plate above.
  const block = new THREE.Group();
  block.name = 'block';
  block.position.y = DECK;
  tilt.add(block);
  const pad = mesh(keep(slab(BLOCK.length, BLOCK.width, BLOCK.pad, 0.004, 0.0008)), idle, block);
  pad.name = 'block-pad';
  swaps(pad, ...surfaces);
  pad.castShadow = false;
  // The carrier with its peg's foot (just inside the plates' peg pieces): the peg shows unloaded.
  const carrierH = BLOCK.height - BLOCK.pad;
  const carrier = mesh(
    keep(
      merged([
        slab(BLOCK.length, BLOCK.width, carrierH, 0.004, 0.002),
        new THREE.CylinderGeometry(
          PEG.radius - 0.0002,
          PEG.radius - 0.0002,
          PEG.above,
          12,
        ).translate(0, carrierH + PEG.above / 2, 0),
      ]),
    ),
    wood,
    block,
  );
  carrier.name = 'block-carrier';
  carrier.position.y = BLOCK.pad;
  const discs = copies(
    keep(
      merged([
        slab(MASS.length, MASS.width, MASS.thick - 0.0002, 0.003, 0.0006),
        new THREE.CylinderGeometry(PEG.radius, PEG.radius, MASS.thick + PEG.above, 12).translate(
          0,
          (MASS.thick + PEG.above) / 2,
          0,
        ),
      ]),
    ),
    brass,
    Array.from({ length: MASSES }, (_, i) => at(0, BLOCK.height + i * MASS.thick, 0)),
    block,
  );
  discs.name = 'masses';
  // Bounds of the tallest stack, before `count` shows fewer: what culling and boxes use.
  discs.computeBoundingBox();
  discs.computeBoundingSphere();
  // Its mass on the carrier's front face (repainted only when the mass changes).
  const tagW = BLOCK.length - 0.012;
  const tagH = 0.022;
  const tagPx = Math.round((128 * tagH) / tagW); // the plane's proportions: no stretch
  const tagFont = `700 ${Math.round(tagPx * 0.63)}px system-ui, sans-serif`;
  const tag = painted2d(128, tagPx, () => undefined);
  if (tag) textures.push(tag.texture);
  const label = tag
    ? mesh(
        keep(new THREE.PlaneGeometry(tagW, tagH)),
        own(new THREE.MeshStandardMaterial({ map: tag.texture, ...LOOKS.matte })),
        block,
      )
    : null;
  if (label) {
    label.name = 'mass-label';
    label.position.set(0, BLOCK.pad + (BLOCK.height - BLOCK.pad) / 2, BLOCK.width / 2 + 0.0006);
    label.castShadow = false;
  }

  // The clamp on the stand's rod and its cross rod under the ramp (it rises with the angle).
  const support = new THREE.Group();
  support.name = 'support';
  support.position.x = -STAND.reach;
  kit.group.add(support);
  mesh(
    keep(
      merged([
        slab(0.03, 0.03, 0.04, 0.004, 0.0015).translate(0, -0.008, STAND.z),
        new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8)
          .rotateZ(Math.PI / 2)
          .translate(0.025, 0.012, STAND.z),
        new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12)
          .rotateZ(Math.PI / 2)
          .translate(0.038, 0.012, STAND.z),
        new THREE.CylinderGeometry(ROD, ROD, half + 0.015 - STAND.z, 12)
          .rotateX(Math.PI / 2)
          .translate(0, 0, (half + 0.015 + STAND.z) / 2),
      ]),
    ),
    steel,
    support,
  ).name = 'cross-rod';

  let angle = NaN;
  let surface = -1;
  let mass = NaN;
  let length = NaN;
  let slid = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const a = finite(parameters.angle, IDLE.angle);
    if (a !== angle) {
      angle = a;
      const t = a * DEG;
      tilt.rotation.z = -t;
      // The rod's top touches the ramp's underside, `reach` m out from the hinge.
      support.position.y = STAND.reach * Math.tan(t) - ROD / Math.cos(t);
    }
    const k = surfaceIndex(parameters.surface);
    if (k !== surface) {
      surface = k;
      strip.material = pad.material = surfaces[k] ?? idle;
    }
    const m = finite(parameters.mass, IDLE.mass);
    if (m !== mass) {
      mass = m;
      discs.count = Math.min(MASSES, Math.max(0, Math.round((m - CARRIER_KG) / MASS_KG)));
      if (tag) {
        const { ctx } = tag;
        ctx.fillStyle = '#f4efe0';
        ctx.fillRect(0, 0, 128, tagPx);
        ctx.fillStyle = '#1d2731';
        ctx.font = tagFont;
        ctx.textAlign = 'center';
        ctx.fillText(`${+m.toFixed(2)} kg`, 64, Math.round(tagPx * 0.73));
        tag.texture.needsUpdate = true;
      }
    }
    const l = finite(parameters.length, IDLE.length);
    const s = finite(sample.distance, 0); // NaN: no run, the block waits at the stop
    if (l !== length) stop.position.x = -(GATE_U + l + BLOCK.length / 2 + STOP / 2);
    if (l !== length || s !== slid) block.position.x = -(GATE_U + l - s);
    length = l;
    slid = s;
  };
  pose({ status: 'idle', parameters: {}, sample: {} });
  return {
    group: kit.group,
    pose,
    dispose: () => {
      kit.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

const finite = (value: number | undefined, otherwise: number) =>
  value !== undefined && Number.isFinite(value) ? value : otherwise;

/** The index into SURFACE_LOOKS of a `surface` dial value; the idle pair for anything else. */
function surfaceIndex(value: number | undefined): number {
  const i = Math.round(value ?? NaN) - 1;
  return i >= 0 && i < SURFACE_LOOKS.length ? i : IDLE.surface - 1;
}

export const inclineRamp: BenchModel = { frame, rig, reads: ['distance'] };
