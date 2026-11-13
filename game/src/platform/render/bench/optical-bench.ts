import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, loft, slab, swaps, type Outline } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The optical bench (model optics.thin-lens): a 1 m aluminium rail on a 1.2 × 0.16 m patch of
 * bench, real sizes in metres. The rig's frame has its origin at `bench.top`: the scale's 0 mark
 * (the object's plane) on the rail's top; x runs along the rail to the 1 m mark, +z is the front.
 * Fixed (frame): the rail on two cast feet, a millimetre scale printed along its front (ticks
 * every mm, longer every 5 and 10 mm, figures every 10 cm in cm), the lamp housing behind the
 * 0 mark (with the feet, the entity's mesh in the item's colour: focus shows on it).
 * Moving (rig): the object slide at the 0 mark (an opaque mask with a translucent arrow 3 cm tall,
 * lit while a run exists); the lens rider at u (`objectDistance`), its biconvex lens 40 mm across
 * with its sag from the dialled f (A²/(8.4·f) a face, crown glass); the screen rider, its white
 * face toward the lens at u + s — s₀ (`screenStart`, 0.05 m) without a run, the run's
 * `screenDistance` with one; on the face, the image: the arrow at the model's lateral scale
 * `screenImageHeight`/h (negative: inverted), each edge softened over the blur-disc diameter
 * `blur` (crisp when it is 0, the sharp image), dimmer as the patch grows (a display cue,
 * brightness ∝ (h/|h_screen|)², floored so the patch stays visible), clipped to the face.
 * Nothing else is drawn from the run; `pose` assigns only when something changed.
 */

const AXIS = 0.12; // the optical axis above the rail's top
const OBJECT = { height: 0.03, shaft: 0.005, head: 0.011, headWidth: 0.016 }; // the arrow
const SCREEN_START = 0.05; // s₀, when the parameters do not say
const LENS = { radius: 0.02, sagPerInverseF: 0.04 ** 2 / 8.4 }; // a 40 mm lens: sag = A²/(8.4·f)
const RAIL = { from: -0.09, to: 1.08, width: 0.04, height: 0.038, flange: 0.008, web: 0.03 };
const FEET = { at: [-0.05, 1.03], width: 0.07, depth: 0.1, height: 0.012 };
const SCALE = { from: -0.03, to: 1.07, top: -0.01, height: 0.02, pxPerMetre: 2000 };
const RIDER = { width: 0.05, height: 0.02, depth: 0.056, skirt: 0.01, rod: 0.005 };
const LAMP = { x: -0.0515, width: 0.087, depth: 0.09, height: 0.2 };
const SLIDE = { size: 0.05, thick: 0.002 };
const SCREEN = { face: 0.14, frame: 0.156, thick: 0.008 };
const INDEX = '#d8302a'; // a rider's index mark, read against the scale

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

type Piece = readonly [geometry: THREE.BufferGeometry, color?: string];

/** Pieces merged into one geometry (one draw), each in its own vertex colour if it has one. */
function merge(pieces: readonly Piece[]): THREE.BufferGeometry {
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

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** A round bar of radius `r` from y0 to y1 at (x, z). */
const post = (r: number, y0: number, y1: number, x: number, z: number) =>
  new THREE.CylinderGeometry(r, r, y1 - y0, 12).translate(x, (y0 + y1) / 2, z);

/**
 * The scale printed along the rail's front, drawn once: a tick every mm, longer every 5 and
 * 10 mm, figures every 10 cm (in cm, 0 … 100). Null without a page (tests): the strip is plain.
 */
function scaleTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const px = SCALE.pxPerMetre;
  const w = Math.round((SCALE.to - SCALE.from) * px);
  const h = Math.round(SCALE.height * px);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = '#f4f3ee';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1d2731';
    c.font = `700 ${Math.round(h * 0.5)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (let mm = 0; mm <= 1000; mm++) {
      const x = Math.round((mm / 1000 - SCALE.from) * px);
      const ten = mm % 10 === 0;
      const five = mm % 5 === 0;
      const length = ten ? h * 0.35 : five ? h * 0.25 : h * 0.15;
      c.fillRect(x - (ten ? 1 : 0), 0, ten ? 2 : 1, length);
      if (mm % 100 === 0) c.fillText(String(mm / 10), x, h - 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; // read along the rail, at a grazing angle
  return texture;
}

/** The housing (the entity's mesh, with the feet): a chamfered block behind the 0 mark. */
const housing = () =>
  slab(LAMP.width, LAMP.depth, LAMP.height, 0.006, 0.002).translate(LAMP.x, 0, 0);

/**
 * The fixed parts: the lamp housing and the feet (the entity's mesh), the aluminium rail, the
 * dark plastic details (vents, switch, cable, the slide's lips) and the printed scale.
 */
function frame(item: ItemDefinition): BenchFrame {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const origin = topOf(item);
  kit.group.position.copy(origin);
  const texture = scaleTexture();
  const aluminium = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#24272b', ...LOOKS.plastic }));
  const printed = own(
    new THREE.MeshStandardMaterial(
      texture ? { color: '#ffffff', ...LOOKS.matte, map: texture } : { color: '#f4f3ee' },
    ),
  );

  const body = keep(
    merge([
      [housing()],
      ...FEET.at.map((x): Piece => [
        slab(FEET.width, FEET.depth, FEET.height, 0.01, 0.002).translate(
          x,
          -RAIL.height - FEET.height,
          0,
        ),
      ]),
    ]),
  );
  body.translate(origin.x, origin.y, origin.z);

  // The rail: a T profile, its flange on top, from behind the lamp to past the 1 m mark.
  const length = RAIL.to - RAIL.from;
  const mid = (RAIL.from + RAIL.to) / 2;
  const rail = mesh(
    keep(
      merge([
        [box(length, RAIL.flange, RAIL.width, mid, -RAIL.flange / 2, 0)],
        [
          box(
            length,
            RAIL.height - RAIL.flange,
            RAIL.web,
            mid,
            -(RAIL.height + RAIL.flange) / 2,
            0,
          ),
        ],
      ]),
    ),
    aluminium,
  );
  rail.name = 'rail';

  // Vents across the housing's top, its switch, the cable gland on its back, the slide's lips.
  const vents: Piece[] = [-2, -1, 0, 1, 2].map((i) => [
    box(0.05, 0.002, 0.004, LAMP.x, LAMP.height + 0.001, i * 0.009),
  ]);
  const back = LAMP.x - LAMP.width / 2;
  const details = mesh(
    keep(
      merge([
        ...vents,
        [box(0.012, 0.005, 0.02, LAMP.x + 0.03, LAMP.height + 0.0025, 0.03)],
        [
          new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 10)
            .rotateZ(Math.PI / 2)
            .translate(back - 0.002, 0.03, -0.025),
        ],
        [box(0.004, 0.06, 0.004, -0.002, AXIS, -SLIDE.size / 2 - 0.002)],
        [box(0.004, 0.06, 0.004, -0.002, AXIS, SLIDE.size / 2 + 0.002)],
        [box(0.004, 0.004, SLIDE.size + 0.012, -0.002, AXIS - SLIDE.size / 2 - 0.002, 0)],
      ]),
    ),
    dark,
  );
  details.name = 'details';
  details.castShadow = false;

  const strip = mesh(
    keep(
      new THREE.PlaneGeometry(SCALE.to - SCALE.from, SCALE.height).translate(
        (SCALE.from + SCALE.to) / 2,
        SCALE.top - SCALE.height / 2,
        RAIL.width / 2 + 0.0002,
      ),
    ),
    printed,
  );
  strip.name = 'scale';
  strip.castShadow = false;
  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      texture?.dispose();
    },
  };
}

/** A rider's cast base astride the rail, its rod up to `rodTop`, its red index at x = 0. */
function riderPieces(rodTop: number, baseX: number): Piece[] {
  const iron = '#1f2124';
  const { width: w, height: h, depth: d, skirt } = RIDER;
  return [
    [box(w, h, RAIL.width, baseX, h / 2, 0), iron],
    [box(w, h + skirt, (d - RAIL.width) / 2, baseX, (h - skirt) / 2, (d + RAIL.width) / 4), iron],
    [box(w, h + skirt, (d - RAIL.width) / 2, baseX, (h - skirt) / 2, -(d + RAIL.width) / 4), iron],
    [post(RIDER.rod, h, rodTop, 0, 0), '#c9ced3'],
    [box(0.0012, 0.006, 0.0012, 0, -skirt + 0.001, d / 2 + 0.0004), INDEX],
  ];
}

/** The object arrow's head (a triangle, counter-clockwise seen from +z), inset ignored. */
const head: Outline = () => {
  const { height: h, head: k, headWidth: w } = OBJECT;
  return [
    new THREE.Vector2(-w / 2, h - k),
    new THREE.Vector2(w / 2, h - k),
    new THREE.Vector2(0, h),
  ];
};

const IMAGE_VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The arrow's image on the screen: each screen point maps back to the object plane by the lateral
 * scale uM (signed); inside the arrow (shaft and head, each the least of its edges' distances) the
 * light is full, and every edge fades over the blur-disc diameter uBlur (half each side), never
 * narrower than a pixel.
 */
const IMAGE_FRAGMENT = /* glsl */ `
uniform float uM;
uniform float uBlur;
uniform float uGlow;
uniform float uHeight;
uniform vec3 uColor;
varying vec2 vP;
const float SHAFT = ${OBJECT.shaft / 2};
const float HEAD = ${OBJECT.head};
const vec2 EDGE = normalize(vec2(${OBJECT.head}, ${OBJECT.headWidth / 2}));
void main() {
  vec2 o = vP / uM;
  float base = uHeight - HEAD;
  float shaft = min(min(SHAFT - abs(o.x), o.y), base - o.y);
  float head = min(o.y - base, -dot(vec2(abs(o.x), o.y - uHeight), EDGE));
  float inside = max(shaft, head) * abs(uM);
  float w = max(0.5 * uBlur, fwidth(inside));
  gl_FragColor = vec4(uColor, smoothstep(-w, w, inside) * uGlow);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The object slide, the two riders with the lens and the screen, and the image on the screen;
 * `pose` places and lights them from the station, allocating nothing and assigning only when
 * something changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const cast = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.metal }),
  );
  const glass = own(
    new THREE.MeshStandardMaterial({
      color: '#dff3f5',
      ...LOOKS.glass,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const mask = own(new THREE.MeshStandardMaterial({ color: '#2e3033', ...LOOKS.plastic }));
  const frosted = own(new THREE.MeshStandardMaterial({ color: '#cfd0cc', ...LOOKS.matte }));
  const lit = own(new THREE.MeshBasicMaterial({ color: '#fff2c8' })); // reads at any light
  const white = own(new THREE.MeshStandardMaterial({ color: '#e6e6e0', ...LOOKS.matte }));
  const uniforms = {
    uM: { value: -1 },
    uBlur: { value: 0 },
    uGlow: { value: 1 },
    uHeight: { value: OBJECT.height },
    uColor: { value: new THREE.Color(1.6, 1.45, 1.1) }, // the lamp's light, brighter than white
  };
  const image = own(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: IMAGE_VERTEX,
      fragmentShader: IMAGE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );

  // The object slide in its lips at the 0 mark: the mask, its arrow window from the axis up.
  const slide = mesh(
    keep(box(SLIDE.thick, SLIDE.size, SLIDE.size, -SLIDE.thick / 2, AXIS, 0)),
    mask,
  );
  slide.name = 'slide';
  slide.castShadow = false;
  const { height: h, head: k, shaft } = OBJECT;
  const arrowShape = merge([
    [box(shaft, h - k, 0.0004, 0, (h - k) / 2, 0)],
    [
      loft(head, [
        [0, -0.0002],
        [0, 0.0002],
      ]),
    ],
  ]);
  // Drawn in its own plane (x across, y up); turned so it faces the lens and lies on the axis.
  const arrow = mesh(keep(arrowShape.rotateY(Math.PI / 2).translate(0.0003, AXIS, 0)), frosted);
  swaps(arrow, lit);
  arrow.name = 'object';
  arrow.castShadow = false;

  // The lens rider: its ring and clamp screw on the rod, the two faces of the lens in the ring.
  const lensRider = new THREE.Group();
  lensRider.name = 'lens-rider';
  kit.group.add(lensRider);
  const ring = new THREE.TorusGeometry(LENS.radius + 0.002, 0.0025, 8, 40)
    .rotateY(Math.PI / 2)
    .translate(0, AXIS, 0);
  const holder = mesh(
    keep(
      merge([
        ...riderPieces(AXIS - LENS.radius - 0.002, 0),
        [ring, '#1f2124'],
        [post(0.003, AXIS + LENS.radius + 0.002, AXIS + LENS.radius + 0.012, 0, 0), '#c9ced3'],
      ]),
    ),
    cast,
    lensRider,
  );
  holder.name = 'lens-holder';
  // A face: a cap of unit sag about +y (y = 1 − (r/R)² to the rim), scaled to the sag of f.
  const cap = keep(
    new THREE.LatheGeometry(
      Array.from({ length: 9 }, (_, i) => {
        const r = (LENS.radius * i) / 8;
        return new THREE.Vector2(r, 1 - (i / 8) ** 2);
      }),
      40,
    ),
  );
  const faces = [-1, 1].map((side) => {
    const face = mesh(cap, glass, lensRider);
    face.name = side > 0 ? 'lens-front' : 'lens-back';
    face.position.y = AXIS;
    face.rotation.z = (-side * Math.PI) / 2; // local +y along ±x
    face.castShadow = false;
    face.renderOrder = 1;
    return face;
  });

  // The screen rider: its base behind the face, the black frame, the white face toward the lens.
  const screenRider = new THREE.Group();
  screenRider.name = 'screen-rider';
  kit.group.add(screenRider);
  const frameMesh = mesh(
    keep(
      merge([
        ...riderPieces(0.05, 0.012),
        [box(SCREEN.thick, SCREEN.frame, SCREEN.frame, SCREEN.thick / 2, AXIS, 0), '#1f2124'],
      ]),
    ),
    cast,
    screenRider,
  );
  frameMesh.name = 'screen-frame';
  const facePlane = keep(new THREE.PlaneGeometry(SCREEN.face, SCREEN.face));
  const face = mesh(facePlane, white, screenRider);
  face.name = 'screen';
  face.rotation.y = -Math.PI / 2; // facing −x, the lens
  face.position.set(-0.0003, AXIS, 0);
  face.castShadow = false;
  const picture = mesh(facePlane, image, screenRider);
  picture.name = 'image';
  picture.rotation.y = -Math.PI / 2;
  picture.position.set(-0.0007, AXIS, 0);
  picture.castShadow = false;
  picture.receiveShadow = false;
  picture.visible = false;

  // What is drawn now: pose skips what has not changed.
  let on: boolean | null = null;
  let objectAt = NaN;
  let screenAt = NaN;
  let focal = NaN;
  let scale = NaN; // the image's lateral scale, NaN while none is shown
  let softness = NaN;
  const pose = ({ status, parameters, sample }: BenchPose) => {
    // A run exists while it is in progress, stopped or completed: the lamp is on and the screen
    // stands where the run has it; idle and RESET (configured) switch it off, the screen at s₀.
    const run = status === 'running' || status === 'stopped' || status === 'completed';
    const u = parameters.objectDistance ?? NaN;
    const s0 = parameters.screenStart ?? SCREEN_START;
    const travelled = sample.screenDistance ?? NaN;
    const s = run && Number.isFinite(travelled) ? travelled : s0;
    const f = parameters.focalLength ?? NaN;
    const height = parameters.objectHeight ?? OBJECT.height;
    const tip = sample.screenImageHeight ?? NaN;
    const blur = sample.blur ?? NaN;
    const shown = run && Number.isFinite(tip) && tip !== 0 && blur >= 0 && height > 0;
    const m = shown ? tip / height : NaN;
    const b = shown ? blur : NaN;
    if (
      run === on &&
      Object.is(u, objectAt) &&
      Object.is(s, screenAt) &&
      Object.is(f, focal) &&
      Object.is(m, scale) &&
      Object.is(b, softness)
    )
      return;
    on = run;
    objectAt = u;
    screenAt = s;
    focal = f;
    scale = m;
    softness = b;
    arrow.material = run ? lit : frosted;
    // The riders stand only where u is known (the dials give it); the screen's face is at u + s.
    const placed = Number.isFinite(u) && Number.isFinite(s);
    lensRider.visible = placed;
    screenRider.visible = placed;
    if (placed) {
      lensRider.position.x = u;
      screenRider.position.x = u + s;
    }
    const sag = f > 0 && Number.isFinite(f) ? LENS.sagPerInverseF / f : NaN;
    for (const lens of faces) {
      lens.visible = sag > 0;
      if (sag > 0) lens.scale.y = sag;
    }
    picture.visible = shown;
    if (shown) {
      uniforms.uM.value = m;
      uniforms.uBlur.value = b;
      uniforms.uHeight.value = height;
      // Dimmer as the light spreads over a larger patch: (h/|h_screen|)², floored to stay visible.
      uniforms.uGlow.value = Math.min(1, Math.max(0.2, 1 / (m * m)));
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const opticalBench: BenchModel = {
  frame,
  rig,
  reads: ['screenDistance', 'blur', 'screenImageHeight'],
};
