import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { rippleWaves } from '../../../simulation/models/rippleTank';
import { Assembly, at, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The ripple tank: a shallow glass-bottomed tank on four legs, a bar over the water on two posts,
// a stroboscope lamp on an arm above, a ruler on the floor along S1S2. The rig: the two dippers at
// the dialled separation, the probe at the run's `probe` position, and the water — the two waves'
// sum from the model's own wavenumber, k(r1 − r2) and k(r1 + r2) worked out per texel when f or
// S1S2 change, one cosine per texel a frame while the vibrator runs, seen through the stroboscope
// (the ripples drift at STROBE_HZ, not at f: a 20 Hz wave would only flicker on screen).

const BASE = 0.02;
const LEG = 0.1;
const TANK = { width: 0.8, depth: 0.48, wall: 0.03, glass: 0.006 };
const WATER = { width: 0.76, depth: 0.44, y: LEG + 0.012 };
const SOURCES_Z = -0.1; // the line S1S2 across the tank, towards its back
const BAR_Y = WATER.y + 0.07;
const LAMP_Y = 0.42;
const TEXELS = { x: 384, z: 224 }; // ~2 mm a texel: 5 a wavelength at 25 Hz
const STROBE_HZ = 0.8;
const CALM = 0.15; // the still water's brightness, of the crests' 1

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the tank, its legs, the bar's posts, the lamp, the ruler. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const ruler = own(new THREE.MeshStandardMaterial({ color: '#efe9d6', ...LOOKS.matte }));
  const glow = own(new THREE.MeshBasicMaterial({ color: '#f6f1df' })); // the lamp's face, lit
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  // Four legs at the tank's corners (one draw).
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      at((sx * (TANK.width - 0.04)) / 2, y0 + LEG / 2, (sz * (TANK.depth - 0.04)) / 2),
    ),
  );
  copies(keep(new THREE.CylinderGeometry(0.008, 0.008, LEG, 10)), steel, legs);
  // The tank: its frame in the item's colour (focus shows on it), the glass floor beneath the water.
  const sideX = keep(new THREE.BoxGeometry(TANK.width, TANK.wall, TANK.wall));
  const sideZ = keep(new THREE.BoxGeometry(TANK.wall, TANK.wall, TANK.depth - 2 * TANK.wall));
  const rim = y0 + LEG + TANK.wall / 2;
  for (const s of [-1, 1]) {
    mesh(sideX, painted).position.set(0, rim, (s * (TANK.depth - TANK.wall)) / 2);
    mesh(sideZ, painted).position.set((s * (TANK.width - TANK.wall)) / 2, rim, 0);
  }
  mesh(keep(new THREE.BoxGeometry(WATER.width, TANK.glass, WATER.depth)), dark).position.set(
    0,
    y0 + LEG + TANK.glass / 2,
    0,
  );
  // The ruler on the floor along S1S2, just in front of the line.
  const strip = mesh(keep(new THREE.BoxGeometry(0.3, 0.001, 0.012)), ruler);
  strip.position.set(0, y0 + LEG + TANK.glass + 0.0005, SOURCES_Z + 0.02);
  strip.castShadow = false;
  // Two posts carrying the bar over the water (the bar itself: the rig's, it carries the dippers).
  const post = keep(new THREE.BoxGeometry(0.02, BAR_Y + 0.01, 0.02));
  for (const s of [-1, 1]) {
    mesh(post, dark).position.set(
      (s * (TANK.width + 0.04)) / 2,
      y0 + (BAR_Y + 0.01) / 2,
      SOURCES_Z,
    );
  }
  mesh(keep(new THREE.BoxGeometry(TANK.width + 0.06, 0.012, 0.016)), steel).position.set(
    0,
    y0 + BAR_Y,
    SOURCES_Z,
  );
  // The vibrator's motor on the bar, the stroboscope on an arm from the back.
  mesh(
    keep(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16).rotateZ(Math.PI / 2)),
    dark,
  ).position.set(0, y0 + BAR_Y + 0.025, SOURCES_Z);
  const back = -TANK.depth / 2 - 0.02;
  mesh(keep(new THREE.BoxGeometry(0.02, LAMP_Y, 0.02)), dark).position.set(
    TANK.width / 2 - 0.05,
    y0 + LAMP_Y / 2,
    back,
  );
  mesh(keep(new THREE.BoxGeometry(0.012, 0.012, 0.25)), steel).position.set(
    TANK.width / 2 - 0.05,
    y0 + LAMP_Y,
    back + 0.125,
  );
  mesh(keep(new THREE.CylinderGeometry(0.035, 0.05, 0.05, 20)), dark).position.set(
    TANK.width / 2 - 0.05,
    y0 + LAMP_Y - 0.03,
    back + 0.25,
  );
  const face = mesh(keep(new THREE.CircleGeometry(0.045, 20).rotateX(Math.PI / 2)), glow);
  face.position.set(TANK.width / 2 - 0.05, y0 + LAMP_Y - 0.056, back + 0.25);
  face.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The water and its waves, the dippers, the probe. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.plastic }));
  // The water: what the stroboscope shows of it, crests bright and troughs dark, at any room light.
  const n = TEXELS.x * TEXELS.z;
  const pixels = new Uint8Array(n * 4);
  const texture = new THREE.DataTexture(pixels, TEXELS.x, TEXELS.z);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  const surface = own(new THREE.MeshBasicMaterial({ map: texture }));
  const water = mesh(
    keep(new THREE.PlaneGeometry(WATER.width, WATER.depth).rotateX(-Math.PI / 2)),
    surface,
  );
  water.name = 'water';
  water.castShadow = false;
  water.position.set(0, y0 + WATER.y, 0);
  // Per texel: cos(k(r1 − r2)/2), the standing amplitude, and k(r1 + r2)/2, the travelling phase.
  const amplitude = new Float32Array(n);
  const phase = new Float32Array(n);
  const paint = (i: number, bright: number) => {
    // Teal water, from the still level to the crests' light.
    pixels[i * 4] = 18 + 150 * bright;
    pixels[i * 4 + 1] = 52 + 180 * bright;
    pixels[i * 4 + 2] = 62 + 182 * bright;
    pixels[i * 4 + 3] = 255;
  };
  const calm = () => {
    for (let i = 0; i < n; i++) paint(i, CALM);
    texture.needsUpdate = true;
  };
  calm();

  const dipper = keep(
    new THREE.CylinderGeometry(0.003, 0.0015, BAR_Y - WATER.y, 8).translate(
      0,
      (BAR_Y - WATER.y) / 2,
      0,
    ),
  );
  const dippers = [-1, 1].map((s) => {
    const m = mesh(dipper, steel);
    m.name = s < 0 ? 'dipper-1' : 'dipper-2';
    m.position.set(0, y0 + WATER.y - 0.002, SOURCES_Z);
    return m;
  });
  const probe = mesh(
    keep(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 8).translate(0, 0.03, 0)),
    red,
  );
  probe.name = 'probe';
  probe.castShadow = false;
  probe.position.set(0, y0 + WATER.y - 0.004, SOURCES_Z);

  const drawn = { f: NaN, d: NaN };
  let k = 0;
  let strobe = 0;
  let still = true;
  let x = NaN;
  const pose = ({ status, parameters, sample }: BenchPose, dt: number) => {
    const f = parameters.frequency ?? 20;
    const d = parameters.sourceSeparation ?? 0.06;
    if (f !== drawn.f || d !== drawn.d) {
      drawn.f = f;
      drawn.d = d;
      k = rippleWaves({ frequency: f, sourceSeparation: d, depth: 0.005, scanTime: 6 }).k;
      for (const [i, m] of dippers.entries()) m.position.x = ((i === 0 ? -1 : 1) * d) / 2;
      for (let j = 0; j < TEXELS.z; j++) {
        // Texel rows run from the tank's front (+z) to its back, as the plane's v.
        const z = WATER.depth / 2 - ((j + 0.5) * WATER.depth) / TEXELS.z - SOURCES_Z;
        for (let i = 0; i < TEXELS.x; i++) {
          const px = -WATER.width / 2 + ((i + 0.5) * WATER.width) / TEXELS.x;
          const r1 = Math.hypot(px + d / 2, z);
          const r2 = Math.hypot(px - d / 2, z);
          amplitude[j * TEXELS.x + i] = Math.cos((k * (r1 - r2)) / 2);
          phase[j * TEXELS.x + i] = (k * (r1 + r2)) / 2;
        }
      }
      still = false; // repainted below, running or still
    }
    if (status === 'running') {
      strobe = (strobe + 2 * Math.PI * STROBE_HZ * dt) % (2 * Math.PI);
      for (let i = 0; i < n; i++) {
        const a = (amplitude[i] ?? 0) * Math.cos((phase[i] ?? 0) - strobe); // −1 … 1
        paint(i, CALM + (1 - CALM) * 0.5 * (a + 1) * Math.abs(amplitude[i] ?? 0));
      }
      texture.needsUpdate = true;
      still = false;
    } else if (!still) {
      calm();
      still = true;
    }
    const next = Number.isFinite(sample.probe) ? (sample.probe ?? 0) : -d / 2;
    if (next !== x) {
      x = next;
      probe.position.x = x;
    }
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      texture.dispose();
      kit.dispose();
    },
  };
}

export const rippleTankBench: BenchModel = {
  frame,
  rig,
  reads: ['probe'],
  fullScale: { probe: 0.04 },
};
