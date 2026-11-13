import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { PHOTOSYNTHESIS } from '../../../simulation/models/photosynthesis';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { box, drum, part, rod, sphere } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Pondweed under a lamp (experiment `photosynthesis`, model biology.photosynthesis), in real sizes,
// from the plant at `bench.top` (the sprig's cut end above it), +z towards the viewer, the lamp
// towards −x. Frame: a 250 mL beaker of hydrogencarbonate solution, an Elodea sprig lying on its
// floor under an inverted 40 mm funnel, a graduated capillary on the funnel's stem held by a clamp
// stand (the body: its painted base, boss and jaws), a thermometer leaning on the rim, a thin
// water tank (the heat filter) between beaker and lamp, and a 600 mm steel rule along the light
// path, zero under the plant. Rig: the lamp (lit while a run collects), its front face — and the
// red index on the rule — `distance` from the plant; the thermometer's alcohol at `temperature`;
// the gas column at the capillary's closed top, as long as `volume` fills of its bore; the
// capillary's scale, a mark every δV (the `resolution` dial); and the bubbles, each counted one
// leaving the cut end when the run's volume passes a whole bubble.

/** The beaker: 250 mL low form, its solution's level. */
const BEAKER = { r: 0.035, h: 0.095, inner: 0.0335, floor: 0.003, level: 0.08 };
/** The inverted funnel: mouth just off the floor, a 60° cone, its stem up out of the solution. */
const FUNNEL = { mouth: 0.02, y: 0.005, throat: 0.0045, neck: 0.0318, top: 0.115, bore: 0.003 };
/** The capillary on the stem: bore radius, the gas gathering under its cap at `gasTop`. */
const CAP = { outer: 0.003, bore: 0.0015, bottom: 0.115, top: 0.315, gasTop: 0.31 };
const BORE_AREA = Math.PI * CAP.bore ** 2; // m²
const BORE_LENGTH = CAP.gasTop - CAP.bottom; // m
const ML = 1e-6; // m³
/**
 * The capillary's marks: one every δV mL down from `gasTop`, longer every 0.1 mL; from x = `from`
 * on the tube's front, inside its 3 mm radius, and thin enough to stay apart at the finest δV
 * (0.71 mm).
 */
const SCALE = { long: 0.003, short: 0.0018, major: 0.1, from: -0.0015, thick: 0.00025 };
/** The finest δV the dial gives (definition: resolution min 0.005 mL), and the marks it needs. */
const FINEST = 0.005;
const MARKS = Math.floor(BORE_LENGTH / ((FINEST * ML) / BORE_AREA) + 1e-9) + 1;
/** Where bubbles leave the sprig: its cut end, under the funnel's throat. */
const CUT = new THREE.Vector3(0, 0.026, 0);
/** Rise speed of a 2.7 mm bubble in water (m/s, illustrative: only where it is drawn, not when). */
const RISE = 0.2;
/** The draft definition's `timeStep` (s): the model's `elapsed` moves this much at once. */
const MODEL_STEP = 0.05;
/** A bubble of the model's volume, as a sphere (radius in m). */
const BUBBLE = Math.cbrt((3 * PHOTOSYNTHESIS.bubbleVolume * ML) / (4 * Math.PI));
/** Bubbles drawn at most at once (≈ 2 are in flight at the fastest rate the dials give). */
const POOL = 6;
/** The heat filter: a water tank this thick (outer, x), between the beaker and the closest lamp. */
const FILTER = { x: -0.0415, thick: 0.01, width: 0.12, height: 0.12, glass: 0.0015 };
/** The lamp's travel along the rule: the distance dial's range (m). */
const TRAVEL = { near: 0.05, far: 0.5 };
/** The lamp head: a reflector `depth` deep along +x, its axis at `axis` above the bench. */
const LAMP = { front: 0.046, rear: 0.019, depth: 0.072, axis: 0.075 };
const RULE = { from: 0.005, length: 0.61, width: 0.028, z: 0.075, thick: 0.001 };
/** The clamp stand behind the beaker: its rod and the clamp's height on it. */
const STAND = { x: 0, z: -0.11, rod: 0.006, top: 0.45, clamp: 0.25 };
/** The thermometer: where its foot rests, its length, a −10 to 110 °C scale 0.2 m long. */
const THERMO = { x: 0.018, z: 0.019, length: 0.25, r: 0.0035, zero: 0.03, span: 0.2 };
const THERMO_RANGE = { min: -10, max: 110 };
const COLUMN_FOOT = 0.014; // the alcohol column starts at the bulb's top
/** The thermometer's scale (m per °C). */
const DEGREE = THERMO.span / (THERMO_RANGE.max - THERMO_RANGE.min);

/** The sprig's stem, apex first, lying on the floor and rising to the cut end (m). */
const SPRIG = [
  new THREE.Vector3(-0.013, 0.0045, 0.008),
  new THREE.Vector3(0.009, 0.0048, 0.006),
  new THREE.Vector3(0.005, 0.009, -0.005),
  CUT,
];
/** The share of each stem segment that bears leaves (leaves are stripped near the cut). */
const LEAFY = [1, 1, 0.45];
const STEM = 0.0012; // stem radius
const LEAF = { length: 0.008, width: 0.0026, thick: 0.0003, whorl: 0.004 };

/** Where the plant stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The thermometer's pose: foot on the floor, leaning out until it rests on the rim. */
function thermometerMatrix(): THREE.Matrix4 {
  const foot = Math.hypot(THERMO.x, THERMO.z);
  const out = new THREE.Vector3(THERMO.x / foot, 0, THERMO.z / foot);
  const lean = Math.atan((BEAKER.inner - THERMO.r - foot) / (BEAKER.h - BEAKER.floor));
  const axis = new THREE.Vector3(out.z, 0, -out.x); // turning +y towards `out`
  return new THREE.Matrix4()
    .makeRotationAxis(axis, lean)
    .setPosition(THERMO.x, BEAKER.floor + 0.0005, THERMO.z);
}

const lathe = (profile: readonly (readonly [number, number])[], segments = 32) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

/** The lamp's distance (m) as drawn: the dial's, inside the rule's travel; none set: the far end. */
const lampDistance = (d: number | undefined) =>
  d === undefined || Number.isNaN(d) ? TRAVEL.far : Math.min(TRAVEL.far, Math.max(TRAVEL.near, d));

/** Leaves (flattened discs) and stem segments, as transforms of one unit cylinder. */
function sprigTransforms(): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  let arc = 0; // from the apex: leaves grow from tiny at the tip
  for (const [s, b] of SPRIG.slice(1).entries()) {
    const a = SPRIG[s] ?? b;
    const t = b.clone().sub(a);
    const length = t.length();
    t.normalize();
    const side = new THREE.Vector3().crossVectors(t, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, t);
    out.push(
      new THREE.Matrix4()
        .makeBasis(side, t, normal)
        .scale(new THREE.Vector3(STEM, length + STEM, STEM))
        .setPosition(a.clone().lerp(b, 0.5)),
    );
    const whorls = Math.floor((length * (LEAFY[s] ?? 0)) / LEAF.whorl);
    for (let k = 0; k < whorls; k++) {
      const along = (k + 0.5) * LEAF.whorl;
      const at = a.clone().addScaledVector(t, along);
      const size = Math.min(1, 0.45 + (arc + along) / 0.012);
      for (let j = 0; j < 3; j++) {
        // Whorls of three, each turned 60° from the last, leaning towards the tip and upwards.
        const phi = (j * 2 * Math.PI) / 3 + (k % 2) * (Math.PI / 3) + s;
        const dir = side
          .clone()
          .multiplyScalar(Math.cos(phi))
          .addScaledVector(normal, Math.sin(phi))
          .addScaledVector(t, -0.7)
          .addScaledVector(up, 0.35)
          .normalize();
        if (dir.y < 0.15) dir.setY(0.15).normalize(); // lying on the floor, not through it
        const x = new THREE.Vector3().crossVectors(t, dir).normalize();
        const y = new THREE.Vector3().crossVectors(dir, x);
        const l = LEAF.length * size;
        out.push(
          new THREE.Matrix4()
            .makeBasis(x, y, dir)
            .scale(new THREE.Vector3((LEAF.width * size) / 2, LEAF.thick, l / 2))
            .setPosition(at.clone().addScaledVector(dir, l * 0.45)),
        );
      }
    }
    arc += length;
  }
  return out;
}

/**
 * The fixed parts, merged by material: the clamp stand's base, boss and jaws (the entity's mesh);
 * glass (beaker, funnel, capillary, heat-filter tank, thermometer); the solution and the filter's
 * water; steel (stand rod, clamp arm, screws, rule, the sprig's paperclip); ink and rubber (rule and
 * scale marks, the capillary's sleeve and cap); the sprig (one instanced draw). Every painted part
 * is in the body, so the entity material needs no other mesh.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const merged = (pieces: THREE.BufferGeometry[]) => keep(part('body', false, pieces).geometry);
  const glass = own(
    new THREE.MeshStandardMaterial({ color: '#d5ecf2', ...GLASSWARE_LOOK, depthWrite: false }),
  );
  const solution = own(
    new THREE.MeshStandardMaterial({
      color: '#a8d3cc',
      roughness: 0.1,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1e2226', ...LOOKS.rubber }));
  const green = own(new THREE.MeshStandardMaterial({ color: '#4c9a3e', ...LOOKS.satin }));
  const plant = new THREE.Group();
  plant.position.copy(topOf(item));
  kit.group.add(plant);
  const thermo = thermometerMatrix();

  // The body: the clamp stand's base, the boss on its rod, the clamp's jaws on the capillary.
  const body = merged([
    slab(0.2, 0.13, 0.012, 0.012, 0.0025).translate(0.07, 0, STAND.z),
    box(0.028, 0.03, 0.03, STAND.x, STAND.clamp, STAND.z),
    ...[-1, 1].map((s) => box(0.006, 0.018, 0.018, s * 0.0065, STAND.clamp, -0.005)),
  ]);
  body.translate(plant.position.x, plant.position.y, plant.position.z);

  // Glass, drawn after the liquids inside it (both see-through, neither writes depth).
  const { r, h, inner, floor } = BEAKER;
  const f = FILTER;
  const pane = (w: number, y: number, d: number, x: number, z: number) =>
    box(w, y, d, f.x + x, y / 2, z);
  const glassMesh = mesh(
    merged([
      lathe([
        [0.0001, 0],
        [r - 0.002, 0],
        [r, 0.002],
        [r, h - 0.002],
        [r + 0.0012, h - 0.0002],
        [r + 0.0006, h + 0.0004],
        [inner, h - 0.001],
        [inner, floor],
        [0.0001, floor],
      ]),
      lathe([
        [FUNNEL.mouth, FUNNEL.y],
        [FUNNEL.throat, FUNNEL.neck],
        [FUNNEL.throat, FUNNEL.top],
        [FUNNEL.bore, FUNNEL.top],
        [FUNNEL.bore, FUNNEL.neck + 0.0007],
        [FUNNEL.mouth - 0.0014, FUNNEL.y],
        [FUNNEL.mouth, FUNNEL.y],
      ]),
      lathe(
        [
          [CAP.outer, CAP.bottom],
          [CAP.outer, CAP.top],
          [CAP.bore, CAP.top],
          [CAP.bore, CAP.bottom],
          [CAP.outer, CAP.bottom],
        ],
        16,
      ),
      lathe(
        [
          [0.0001, 0],
          [0.0028, 0.002],
          [THERMO.r, 0.014],
          [THERMO.r, THERMO.length - 0.002],
          [0.002, THERMO.length],
          [0.0001, THERMO.length],
        ],
        12,
      ).applyMatrix4(thermo),
      ...[-1, 1].map((s) => pane(f.glass, f.height, f.width, (s * (f.thick - f.glass)) / 2, 0)),
      ...[-1, 1].map((s) => pane(f.thick, f.height, f.glass, 0, (s * (f.width - f.glass)) / 2)),
      box(f.thick, f.glass, f.width, f.x, f.glass / 2, 0),
    ]),
    glass,
    plant,
  );
  glassMesh.name = 'glass';
  glassMesh.renderOrder = 2;
  glassMesh.castShadow = false; // see-through: no shadow (castsShadowIn)
  const liquid = mesh(
    merged([
      drum(inner - 0.0002, inner - 0.0002, floor, BEAKER.level),
      drum(FUNNEL.bore - 0.0002, FUNNEL.bore - 0.0002, BEAKER.level, FUNNEL.top, 12),
      box(
        f.thick - 2 * f.glass,
        f.height - 0.015,
        f.width - 2 * f.glass,
        f.x,
        f.glass + (f.height - 0.015) / 2,
        0,
      ),
    ]),
    solution,
    plant,
  );
  liquid.renderOrder = 1;
  liquid.castShadow = false;

  // Steel: the stand's rod, the boss's screw, the clamp's arm and jaw screw, the rule, the clip.
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const clip = new THREE.TorusGeometry(0.0035, 0.0004, 4, 12).scale(1.8, 1, 1);
  clip
    .rotateX(Math.PI / 2)
    .rotateY(0.4)
    .translate(0.002, 0.0055, 0.006);
  mesh(
    merged([
      drum(STAND.rod, STAND.rod, 0.012, STAND.top, 16).translate(STAND.x, 0, STAND.z),
      sphere(STAND.rod, STAND.x, STAND.top, STAND.z, 12),
      rod(0.0032, v(-0.014, STAND.clamp, STAND.z), v(-0.032, STAND.clamp, STAND.z)),
      rod(0.0065, v(-0.03, STAND.clamp, STAND.z), v(-0.036, STAND.clamp, STAND.z), 12),
      rod(0.004, v(0, STAND.clamp, STAND.z + 0.015), v(0, STAND.clamp, -0.013)),
      rod(0.0015, v(-0.013, STAND.clamp, -0.01), v(0.013, STAND.clamp, -0.01)),
      box(RULE.length, RULE.thick, RULE.width, RULE.from - RULE.length / 2, RULE.thick / 2, RULE.z),
      clip,
    ]),
    steel,
    plant,
  ).castShadow = false;

  // Ink and rubber: the rule's marks every cm (the zero under the plant), the thermometer's every
  // 1 °C (longer every 5 and 10 °C), the rubber sleeve joining capillary and stem, and the cap closing the capillary (from
  // just above the scale's zero, which stays in sight). The capillary's marks follow δV: rig.
  const ruleEdge = RULE.z - RULE.width / 2;
  const marks: THREE.BufferGeometry[] = [];
  for (let cm = 0; cm <= 60; cm++) {
    const l = cm % 10 === 0 ? 0.012 : cm % 5 === 0 ? 0.008 : 0.005;
    marks.push(box(0.0006, 0.0003, l, -cm / 100, RULE.thick + 0.00015, ruleEdge + l / 2));
  }
  for (let c = THERMO_RANGE.min; c <= THERMO_RANGE.max; c++) {
    const y = THERMO.zero + (c - THERMO_RANGE.min) * DEGREE;
    const [l, t] =
      c % 10 === 0 ? [0.003, 0.0004] : c % 5 === 0 ? [0.002, 0.0003] : [0.0012, 0.00025];
    marks.push(box(l, t, 0.0004, (l - 0.003) / 2, y, THERMO.r).applyMatrix4(thermo));
  }
  mesh(
    merged([
      ...marks,
      drum(0.0058, 0.0058, 0.105, 0.127, 16),
      drum(0.0045, 0.0045, CAP.gasTop + 0.0008, CAP.top + 0.007, 16),
    ]),
    ink,
    plant,
  ).castShadow = false;

  // The sprig: stem and leaves, one draw.
  copies(
    keep(new THREE.CylinderGeometry(1, 1, 1, 10)),
    green,
    sprigTransforms(),
    plant,
  ).castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/**
 * The lamp, the thermometer's alcohol, the capillary's water and gas, the bubbles; `pose` sets them
 * from the station, allocating nothing and skipping what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const shell = own(new THREE.MeshStandardMaterial({ color: '#33404c', ...LOOKS.painted }));
  const lens = own(
    new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.6, emissive: '#ffe6a6' }),
  );
  lens.emissiveIntensity = 0;
  const red = own(new THREE.MeshBasicMaterial({ color: '#d0312d' })); // reads at any light
  const water = own(
    new THREE.MeshStandardMaterial({
      color: '#a8d3cc',
      roughness: 0.1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  const gas = own(new THREE.MeshStandardMaterial({ color: '#f2f7fa', roughness: 0.15 }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1e2226', ...LOOKS.rubber }));

  // The lamp: its front face at the group's origin (on the bench), `distance` towards −x.
  const lamp = new THREE.Group();
  lamp.name = 'lamp';
  kit.group.add(lamp);
  const shade = lathe([
    [0.0001, -LAMP.depth],
    [LAMP.rear - 0.003, -LAMP.depth],
    [LAMP.rear, -LAMP.depth + 0.004],
    [LAMP.front - 0.001, -0.004],
    [LAMP.front, 0],
    [LAMP.front - 0.003, 0],
    [LAMP.rear - 0.002, -LAMP.depth + 0.008],
    [0.0001, -LAMP.depth + 0.008],
  ]);
  shade.rotateZ(-Math.PI / 2).translate(0, LAMP.axis, 0); // the lathe's axis (y) along +x
  const stemX = -0.11;
  const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  mesh(
    keep(
      part('body', false, [
        slab(0.14, 0.11, 0.014, 0.014, 0.003).translate(-0.075, 0, 0),
        drum(0.006, 0.006, 0.014, LAMP.axis, 12).translate(stemX, 0, 0),
        sphere(0.009, stemX, LAMP.axis, 0, 12),
        rod(0.0045, v(stemX, LAMP.axis), v(-LAMP.depth + 0.002, LAMP.axis)),
        shade,
      ]).geometry,
    ),
    shell,
    lamp,
  ).name = 'lamp-body';
  const glow = mesh(keep(new THREE.CircleGeometry(LAMP.front - 0.004, 24)), lens, lamp);
  glow.name = 'lamp-lens';
  glow.geometry.rotateY(Math.PI / 2); // facing the plant (+x)
  glow.position.set(-0.003, LAMP.axis, 0);
  glow.castShadow = false;
  // The index over the rule: its front edge in the lamp's front plane reads the distance.
  const index = mesh(keep(new THREE.BoxGeometry(0.006, 0.0015, 0.04)), red, lamp);
  index.name = 'lamp-index';
  index.position.set(-0.003, RULE.thick + 0.0012, RULE.z - 0.003);
  index.castShadow = false;

  // The thermometer's bulb and its alcohol column (a unit-high bar scaled to the reading).
  const thermo = new THREE.Group();
  thermometerMatrix().decompose(thermo.position, thermo.quaternion, thermo.scale);
  kit.group.add(thermo);
  const bulb = mesh(keep(new THREE.SphereGeometry(0.0024, 12, 8).scale(1, 2.6, 1)), red, thermo);
  bulb.position.y = 0.0085;
  bulb.castShadow = false;
  const column = mesh(keep(drum(0.0007, 0.0007, 0, 1, 8)), red, thermo);
  column.name = 'alcohol';
  column.position.y = COLUMN_FOOT;
  column.castShadow = false;
  column.visible = false; // until a pose gives a temperature

  // The capillary: water from its foot up, gas from its cap down (unit-high, scaled).
  const fill = CAP.bore - 0.0001;
  const bore = mesh(keep(drum(fill, fill, 0, 1, 12)), water, kit.group);
  bore.name = 'capillary-water';
  bore.position.y = CAP.bottom;
  bore.renderOrder = 1;
  bore.castShadow = false;
  const gasColumn = mesh(keep(drum(fill, fill, -1, 0, 12)), gas, kit.group);
  gasColumn.name = 'gas';
  gasColumn.position.y = CAP.gasTop;
  gasColumn.castShadow = false;
  const bubbles = copies(
    keep(new THREE.SphereGeometry(BUBBLE, 8, 6)),
    gas,
    Array.from({ length: POOL }, () => new THREE.Matrix4()),
  );
  bubbles.name = 'bubbles';
  bubbles.castShadow = false;
  bubbles.frustumCulled = false; // its instances move
  bubbles.count = 0;
  const place = new THREE.Matrix4();
  // The capillary's scale: a unit-wide mark per δV from `gasTop` down, placed when δV changes.
  const scale = copies(
    keep(new THREE.BoxGeometry(1, SCALE.thick, SCALE.thick)),
    ink,
    Array.from({ length: MARKS }, () => new THREE.Matrix4()),
  );
  scale.name = 'capillary-scale';
  scale.castShadow = false;
  scale.frustumCulled = false; // its instances move
  scale.count = 0;

  let lit: boolean | null = null;
  let drawnD = NaN;
  let drawnT = NaN;
  let drawnV = -1;
  let flying = false;
  let drawnN = NaN;
  let drawnE = NaN;
  let drawnR = NaN;
  let drawnStep = NaN;
  let since = 0; // render-only: s since `elapsed` last moved, while running (never a model value)
  const pose = ({ status, parameters, sample }: BenchPose, dt: number) => {
    const running = status === 'running';
    if (running !== lit) {
      lit = running;
      lens.emissiveIntensity = running ? 1.4 : 0;
    }
    const d = lampDistance(parameters.distance);
    if (d !== drawnD) {
      drawnD = d;
      lamp.position.x = -d;
    }
    const t = parameters.temperature ?? NaN;
    if (!Object.is(t, drawnT)) {
      drawnT = t;
      column.visible = Number.isFinite(t);
      if (column.visible) {
        const top = THERMO.zero + (Math.max(t, THERMO_RANGE.min) - THERMO_RANGE.min) * DEGREE;
        column.scale.y = Math.min(top, THERMO.length - 0.004) - COLUMN_FOOT;
      }
    }
    const dv = parameters.resolution ?? NaN;
    if (!Object.is(dv, drawnStep)) {
      drawnStep = dv;
      // None set (or finer than the dial gives): no scale, rather than a wrong or partial one.
      const marks = dv >= FINEST ? Math.floor(BORE_LENGTH / ((dv * ML) / BORE_AREA) + 1e-9) + 1 : 0;
      for (let k = 0; k < marks; k++) {
        const major = (k * dv) / SCALE.major;
        const w = Math.abs(major - Math.round(major)) < 1e-6 ? SCALE.long : SCALE.short;
        const y = CAP.gasTop - (k * dv * ML) / BORE_AREA;
        scale.setMatrixAt(
          k,
          place.makeScale(w, 1, 1).setPosition(SCALE.from + w / 2, y, CAP.outer + 0.0001),
        );
      }
      scale.count = marks;
      scale.instanceMatrix.needsUpdate = true;
    }
    // Gas fills the bore from the cap down: V mL is V·10⁻⁶/(πr²) m of it (NaN: no run, none).
    const volume = sample.volume ?? NaN;
    const gasLength = volume > 0 ? Math.min((volume * ML) / BORE_AREA, BORE_LENGTH) : 0;
    if (gasLength !== drawnV) {
      drawnV = gasLength;
      gasColumn.visible = gasLength > 0;
      gasColumn.scale.y = Math.max(gasLength, 1e-6);
      bore.visible = gasLength < BORE_LENGTH;
      bore.scale.y = Math.max(BORE_LENGTH - gasLength, 1e-6);
    }
    // Bubble k leaves the cut end when the volume passes k bubbles, at k·V_b/P s, and rises at
    // RISE until it meets the gas: drawn from the run's own time, never stepped here.
    const show = running || status === 'stopped' || status === 'completed'; // frozen once ended
    const n = sample.bubbles ?? NaN;
    const e = sample.elapsed ?? NaN;
    const p = sample.rate ?? NaN;
    // `elapsed` moves a model step (MODEL_STEP) at a time: between steps the bubbles keep rising on
    // the frame's clock, at most one step ahead of the run's own time, so they glide, not jump.
    if (!Object.is(e, drawnE)) since = 0;
    else if (running) since += dt;
    const same = Object.is(n, drawnN) && Object.is(e, drawnE) && Object.is(p, drawnR);
    if (!running && show === flying && same) return;
    flying = show;
    drawnN = n;
    drawnE = e;
    drawnR = p;
    const now = e + Math.min(since, MODEL_STEP); // `since` holds still once stopped: frozen
    let count = 0;
    if (show && n >= 1 && p > 0 && Number.isFinite(e)) {
      const reach = CAP.gasTop - gasLength - BUBBLE;
      const every = PHOTOSYNTHESIS.bubbleVolume / p;
      for (let k = n; k >= 1 && count < POOL; k--) {
        const y = CUT.y + Math.max(0, now - k * every) * RISE;
        if (y > reach) break; // older bubbles rose further: they have all arrived
        bubbles.setMatrixAt(count++, place.makeTranslation(0, y, 0));
      }
    }
    bubbles.count = count;
    bubbles.instanceMatrix.needsUpdate = true;
  };
  pose({ status: 'idle', parameters: {}, sample: {} }, 0); // until its station poses it
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const pondweedLamp: BenchModel = {
  frame,
  rig,
  reads: ['volume', 'bubbles', 'elapsed', 'rate'],
};

/** Layout the test checks against (m, from the plant). */
export const PONDWEED_LAYOUT = {
  CAP,
  BORE_AREA,
  BORE_LENGTH,
  CUT,
  RISE,
  THERMO,
  THERMO_RANGE,
  SCALE,
  MARKS,
  MODEL_STEP,
};
