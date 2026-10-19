/**
 * three.js scene of the 3D mitosis view. Built ONCE per timeline (cell type × 2n): shared
 * geometries and materials, one set of meshes per chromatid, nothing allocated per frame —
 * `update(state)` only moves, scales, re-colours and shows/hides existing objects (the animal
 * membrane and the spindle write into their existing buffers). `dispose()` frees every
 * geometry, material and texture it created. Rendering (renderer, camera, controls) lives in the
 * view.
 *
 * Look: environment-lit physical materials and a key/fill/rim light rig (`../../view3d/look`),
 * see-through shells outlined by a Fresnel rim, solid parts that fade with alphaHash (they never
 * blend or sort against the glass), spindle fibres as real thin tubes (an InstancedMesh, width
 * per quality tier), a soft contact shadow under the cell. A picked part glows in the highlight
 * colour while the other parts are dimmed.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { contactShadow, disposeLightRig, lightRig } from '@/ui/three/lighting';
import { glass, roundedBox, setRimAlpha, solid } from '@/ui/three/materials';
import { cameraFrame, cellBound, type CameraFrame } from './camera';
import type { CameraMode, Selection } from './components';
import {
  ANIMAL,
  PLANT,
  ROD_RADIUS,
  ease,
  type ChromatidInfo,
  type Mitosis3DState,
  type Timeline,
  type Vec3,
} from './timeline';

/** CSS colour strings (read from theme tokens by the view). */
export interface ScenePalette {
  maternal: string;
  paternal: string;
  centromere: string;
  membrane: string;
  envelope: string;
  nucleolus: string;
  wall: string;
  spindle: string;
  centrosome: string;
  plate: string;
  ring: string;
  highlight: string;
  /** Colour unpicked parts fade towards while a part is picked (the stage's colour). */
  backdrop?: string;
}

export interface SceneOptions {
  /** Sphere segments from the quality tier. */
  segments: number;
  /** Quality tier (High: physical materials with sheen; fibre width and detail). */
  tier?: QualityTier;
  /** Opacity of the animal membrane (a theme token: higher in the dark theme). */
  membraneOpacity?: number;
  /** Strength of the Fresnel outline of see-through shells (a theme token). */
  rimStrength?: number;
}

/** Spindle fibre radius and sides per tier (world units; the cell radius is 5). */
const FIBRE: Record<QualityTier, { radius: number; sides: number }> = {
  low: { radius: 0.03, sides: 5 },
  medium: { radius: 0.034, sides: 6 },
  high: { radius: 0.038, sides: 8 },
};

export type PickResult = Selection;
export type { CameraFrame, CameraMode, Selection };
/** Moved to the generic 3D kit (`@/ui/three/drawStats`); re-exported for existing imports. */
export { drawStats, type DrawStats };

export interface MitosisScene {
  scene: THREE.Scene;
  update(state: Mitosis3DState): void;
  setSelection(sel: Selection | null): void;
  /** The cell part under a ray (inner parts win over the membranes they sit in). */
  pick(raycaster: THREE.Raycaster): PickResult | null;
  /** Box to frame with the camera: the whole cell (after division too), or the chromosomes now. */
  frame(mode: CameraMode): CameraFrame;
  stats(): { objects: number; meshes: number; geometries: number; materials: number };
  /** Draw calls and triangles of the current moment (see `drawStats`). */
  drawStats(): DrawStats;
  dispose(): void;
}

type Part =
  | 'arm'
  | 'bead'
  | 'thread'
  | 'fibre'
  | 'centrosome'
  | 'ring'
  | 'plate'
  | 'nucleolus'
  | 'envelope'
  | 'membrane'
  | 'wall';

interface PartData {
  part: Part;
  chromatid?: number;
}

const CONTAINERS: ReadonlySet<Part> = new Set(['envelope', 'membrane', 'wall']);

/**
 * Three materials per look, swapped and never re-created: normal, highlighted (glows in the
 * highlight colour) and dimmed (another part is picked: greyer, see-through parts fainter).
 */
interface Look<M extends THREE.Material> {
  base: M;
  hi: M;
  dim: M;
}

/** Colour unpicked parts fade towards when the palette names none. */
const DIM_TOWARDS = '#8f949e';

export function buildMitosisScene(
  tl: Timeline,
  palette: ScenePalette,
  opts: SceneOptions,
): MitosisScene {
  const seg = Math.max(8, Math.round(opts.segments));
  const tier: QualityTier = opts.tier ?? (seg >= 24 ? 'high' : seg >= 16 ? 'medium' : 'low');
  const rimStrength = opts.rimStrength ?? 0.7;
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const animal = tl.cellType === 'animal';

  // Lights (no shadow maps: a soft contact shadow grounds the cell instead).
  const rig = lightRig({ size: 12 });
  scene.add(rig);
  disposables.push({
    dispose: () => {
      disposeLightRig(rig);
    },
  });
  const bound = cellBound(tl.cellType);
  const shadow = contactShadow(
    animal ? -(ANIMAL.radius + 0.9) : -(PLANT.half[1] + PLANT.wall + 0.8),
    animal ? bound * 0.95 : bound * 0.85,
    animal ? ANIMAL.radius * 0.9 : PLANT.half[2] * 1.1,
    0.28,
  );
  scene.add(shadow.mesh);
  disposables.push(shadow);

  // ---- materials
  const towards = new THREE.Color(palette.backdrop ?? DIM_TOWARDS);
  const dimHex = (color: string) => `#${new THREE.Color(color).lerp(towards, 0.5).getHexString()}`;
  const look = <M extends THREE.MeshStandardMaterial>(
    color: string,
    make: (c: string) => M,
  ): Look<M> => {
    const base = keep(make(color));
    const hi = keep(make(color));
    hi.emissive.set(palette.highlight);
    hi.emissiveIntensity = 0.85;
    hi.userData.look = 'hi';
    const dim = keep(make(dimHex(color)));
    dim.userData.look = 'dim';
    const scale = dim.transparent ? 0.55 : 1;
    dim.opacity *= scale;
    dim.userData.opacityScale = scale;
    return { base, hi, dim };
  };
  const organic = (c: string) => solid(c, tier, { roughness: 0.5, sheen: 0.6, fades: true });
  const firm = (c: string) => solid(c, tier, { roughness: 0.35, clearcoat: 0.3, fades: true });
  const shell =
    (opacity: number, rimAlpha: number, side: THREE.Side = THREE.FrontSide) =>
    (c: string) =>
      glass(c, { opacity, side, rim: { color: c, strength: rimStrength, alpha: rimAlpha } });
  const membraneOpacity = opts.membraneOpacity ?? 0.16;
  const mats = {
    rod: { M: look(palette.maternal, organic), P: look(palette.paternal, organic) },
    thread: { M: look(palette.maternal, organic), P: look(palette.paternal, organic) },
    bead: look(palette.centromere, firm),
    // One pass for the see-through double-sided parts (one draw call each, not two).
    envelope: look(palette.envelope, shell(0.3, 0.45, THREE.DoubleSide)),
    nucleolus: look(palette.nucleolus, (c) =>
      solid(c, tier, { roughness: 0.55, sheen: 0.4, fades: true }),
    ),
    membrane: look(palette.membrane, shell(animal ? membraneOpacity : membraneOpacity * 0.5, 0.55)),
    wall: look(palette.wall, shell(0.16, 0.6)),
    // Hollow barrels (seen inside from the open ends), as centrioles are drawn in textbooks.
    centriole: look(palette.centrosome, (c) =>
      solid(c, tier, { roughness: 0.35, clearcoat: 0.3, fades: true, side: THREE.DoubleSide }),
    ),
    pcm: look(palette.centrosome, shell(0.22, 0.35)),
    ring: look(palette.ring, firm),
    plate: look(palette.plate, (c) =>
      glass(c, { opacity: 0.75, side: THREE.DoubleSide, roughness: 0.4 }),
    ),
    spindle: look(palette.spindle, (c) => solid(c, tier, { roughness: 0.4, fades: true })),
  };

  // ---- shared geometries
  const sphere = keep(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
  const capsules = new Map<string, THREE.CapsuleGeometry>();
  const capsule = (length: number) => {
    const key = length.toFixed(3);
    let g = capsules.get(key);
    if (!g) {
      g = keep(
        new THREE.CapsuleGeometry(
          ROD_RADIUS,
          Math.max(0.01, length - 2 * ROD_RADIUS),
          3,
          Math.max(6, seg / 2),
        ),
      );
      capsules.set(key, g);
    }
    return g;
  };
  // Chromatin threads: four fixed random curves (illustrative), each fits in a unit ball.
  const threads: THREE.TubeGeometry[] = [];
  for (let v = 0; v < 4; v++) {
    let s = 1234 + v * 977;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const pts: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      p.set(p.x + (r() - 0.5) * 0.9, p.y + (r() - 0.5) * 0.9, p.z + (r() - 0.5) * 0.9);
      if (p.length() > 1) p.setLength(0.9);
      pts.push(p.clone());
    }
    threads.push(
      keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg * 3, 0.085, 5, false)),
    );
  }
  const centrioleGeo = keep(
    new THREE.CylinderGeometry(0.1, 0.1, 0.42, Math.max(8, seg / 2), 1, true),
  );
  const torus = keep(new THREE.TorusGeometry(1, 0.06, 8, seg * 3));
  // Plant cell: a box with rounded edges (the wall's outline comes from the rim light).
  const rounded = keep(roundedBox(seg * 2, 10));
  const disc = keep(new THREE.CylinderGeometry(1, 1, 0.12, seg * 2));
  const fibreShape = FIBRE[tier];
  // Unit fibre: radius 1, height 1 along +y (scaled per fibre), open ends.
  const fibreGeo = keep(new THREE.CylinderGeometry(1, 1, 1, fibreShape.sides, 1, true));

  const pickables: THREE.Object3D[] = [];
  const mesh = <M extends THREE.Material>(geo: THREE.BufferGeometry, mat: M, data: PartData) => {
    const m = new THREE.Mesh(geo, mat);
    m.userData = data;
    scene.add(m);
    pickables.push(m);
    return m;
  };

  // ---- chromatids: arm A, arm B, centromere bead, chromatin thread
  interface ChromatidObjects {
    info: ChromatidInfo;
    armA: THREE.Mesh;
    armB: THREE.Mesh;
    bead: THREE.Mesh;
    thread: THREE.Mesh;
  }
  const chromatids: ChromatidObjects[] = tl.chromatids.map((info, id) => {
    const rod = mats.rod[info.origin].base;
    const thread = mesh(threads[info.threadVariant] ?? sphere, mats.thread[info.origin].base, {
      part: 'thread',
      chromatid: id,
    });
    thread.rotation.set(...info.threadRotation);
    return {
      info,
      armA: mesh(capsule(info.armA), rod, { part: 'arm', chromatid: id }),
      armB: mesh(capsule(info.armB), rod, { part: 'arm', chromatid: id }),
      bead: mesh(sphere, mats.bead.base, { part: 'bead', chromatid: id }),
      thread,
    };
  });

  // ---- nuclei (at most two), each with a simple nucleolus (illustrative, no effect on counts)
  const envelopes = [0, 1].map(() => mesh(sphere, mats.envelope.base, { part: 'envelope' }));
  const nucleoli = [0, 1].map(() => mesh(sphere, mats.nucleolus.base, { part: 'nucleolus' }));

  // ---- centrosomes (animal): two centrioles at right angles + pericentriolar material
  const centrosomes = [0, 1].map(() => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(centrioleGeo, mats.centriole.base);
    const b = new THREE.Mesh(centrioleGeo, mats.centriole.base);
    // The second centriole at a right angle to the first, near its base (an L, in depth).
    b.rotation.x = Math.PI / 2;
    b.position.set(0, -0.12, 0.2);
    const halo = new THREE.Mesh(sphere, mats.pcm.base);
    halo.scale.setScalar(0.38);
    for (const m of [a, b, halo]) {
      m.userData = { part: 'centrosome' } satisfies PartData;
      g.add(m);
      pickables.push(m);
    }
    scene.add(g);
    return { group: g, parts: [a, b, halo] };
  });

  // ---- spindle: thin tubes, one InstancedMesh sized for the most fibres the timeline can have
  const maxFibres = 12 + 16 + 2 * tl.chromatids.length;
  const spindle = new THREE.InstancedMesh(fibreGeo, mats.spindle.base, maxFibres);
  spindle.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spindle.count = 0;
  spindle.userData = { part: 'fibre' } satisfies PartData;
  spindle.frustumCulled = false;
  scene.add(spindle);
  pickables.push(spindle);

  // ---- cell body
  // Animal membrane: a surface of revolution about the spindle axis whose profile is the
  // union of two circles (one sphere → furrow → two daughter spheres).
  const H = seg; // profile rows per half
  const A = seg * 2; // segments around the axis
  const rows = 2 * (H + 1);
  const memPos = new Float32Array(rows * (A + 1) * 3);
  const memNor = new Float32Array(rows * (A + 1) * 3);
  const memGeo = keep(new THREE.BufferGeometry());
  const memPosAttr = new THREE.BufferAttribute(memPos, 3);
  const memNorAttr = new THREE.BufferAttribute(memNor, 3);
  memPosAttr.setUsage(THREE.DynamicDrawUsage);
  memNorAttr.setUsage(THREE.DynamicDrawUsage);
  memGeo.setAttribute('position', memPosAttr);
  memGeo.setAttribute('normal', memNorAttr);
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let a = 0; a < A; a++) {
      const i0 = r * (A + 1) + a;
      const i1 = i0 + 1;
      const j0 = i0 + (A + 1);
      const j1 = j0 + 1;
      // Counter-clockwise seen from outside (front faces point outwards).
      index.push(i0, i1, j0, i1, j1, j0);
    }
  }
  memGeo.setIndex(index);
  let memKey = '';
  const writeProfile = (offset: number, radius: number) => {
    const key = `${offset.toFixed(4)}|${radius.toFixed(4)}`;
    if (key === memKey) return;
    memKey = key;
    const phiEnd = offset < radius ? Math.acos(offset / radius) : 0;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const left = r <= H;
      const i = left ? r : r - (H + 1);
      // Left circle: angle π → phiEnd; right circle: π − phiEnd → 0 (both measured from +x).
      const phi = left
        ? Math.PI + ((phiEnd - Math.PI) * i) / H
        : Math.PI - phiEnd - ((Math.PI - phiEnd) * i) / H;
      const cx = left ? -offset : offset;
      const x = cx + radius * Math.cos(phi);
      const rr = radius * Math.sin(phi);
      for (let a = 0; a <= A; a++) {
        const th = (2 * Math.PI * a) / A;
        const c = Math.cos(th);
        const s = Math.sin(th);
        memPos[k] = x;
        memPos[k + 1] = rr * c;
        memPos[k + 2] = rr * s;
        memNor[k] = Math.cos(phi);
        memNor[k + 1] = Math.sin(phi) * c;
        memNor[k + 2] = Math.sin(phi) * s;
        k += 3;
      }
    }
    memPosAttr.needsUpdate = true;
    memNorAttr.needsUpdate = true;
    memGeo.computeBoundingSphere();
  };
  const membrane = mesh(animal ? memGeo : rounded, mats.membrane.base, { part: 'membrane' });
  if (animal) writeProfile(0, ANIMAL.radius);
  const ring = mesh(torus, mats.ring.base, { part: 'ring' });
  ring.rotation.y = Math.PI / 2; // axis along x
  const wall = mesh(rounded, mats.wall.base, { part: 'wall' });
  const plate = mesh(disc, mats.plate.base, { part: 'plate' });
  plate.rotation.z = Math.PI / 2; // disc normal along x
  // The cell plate grows as a disc and is clipped by the side walls (needs
  // renderer.localClippingEnabled; without it the disc simply shows unclipped).
  const [hx, hy, hz] = PLANT.half;
  const clip = [
    new THREE.Plane(new THREE.Vector3(0, -1, 0), hy),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), hy),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), hz),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), hz),
  ];
  mats.plate.base.clippingPlanes = clip;
  mats.plate.hi.clippingPlanes = clip;
  mats.plate.dim.clippingPlanes = clip;
  if (animal) {
    wall.visible = false;
    plate.visible = false;
  } else {
    membrane.scale.set(hx, hy, hz);
    wall.scale.set(hx + PLANT.wall, hy + PLANT.wall, hz + PLANT.wall);
    ring.visible = false;
    for (const c of centrosomes) c.group.visible = false;
  }

  // ---- update (no allocation: temporaries live here)
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();
  let last: Mitosis3DState | null = null;
  let selection: Selection | null = null;

  const placeArm = (m: THREE.Mesh, c: Vec3, d: Vec3, length: number) => {
    tmpDir.set(d[0], d[1], d[2]);
    m.position.set(
      c[0] + (d[0] * length) / 2,
      c[1] + (d[1] * length) / 2,
      c[2] + (d[2] * length) / 2,
    );
    m.quaternion.setFromUnitVectors(UP, tmpDir);
  };

  const setOpacity = (l: Look<THREE.Material>, o: number) => {
    l.base.opacity = o;
    l.hi.opacity = Math.max(o, Math.min(1, o + 0.25));
    l.dim.opacity = o * ((l.dim.userData.opacityScale as number | undefined) ?? 1);
  };

  const isSelected = (data: PartData, st: Mitosis3DState): boolean => {
    if (!selection) return false;
    const sel = selection;
    const c = data.chromatid !== undefined ? st.chromatids[data.chromatid] : undefined;
    const sameChromosome = sel.chromosome === undefined || c?.chromosome === sel.chromosome;
    // After the centromere splits (anaphase on) the two sisters are two separate chromosomes:
    // a picked single chromosome or its centromere is only that sister.
    const sameSister = sel.sister === undefined || c?.sister === sel.sister;
    switch (sel.component) {
      case 'membrane':
        return data.part === 'membrane';
      case 'cellWall':
        return data.part === 'wall';
      case 'nucleus':
        return data.part === 'envelope' || data.part === 'thread' || data.part === 'nucleolus';
      case 'nuclearEnvelope':
        return data.part === 'envelope';
      case 'nucleolus':
        return data.part === 'nucleolus';
      case 'chromatin':
        return data.part === 'thread';
      case 'doubleChromosome':
        return data.part === 'arm' && !!c?.joined && sameChromosome;
      case 'sisterChromatid':
        return (
          data.part === 'arm' && !!c?.joined && sameChromosome && c.sister === (sel.sister ?? 0)
        );
      case 'singleChromosome':
        return (
          (data.part === 'arm' || data.part === 'thread') &&
          !!c &&
          !c.joined &&
          sameChromosome &&
          sameSister
        );
      case 'centromere':
        // Still joined: the two sisters' beads are one shared centromere.
        return data.part === 'bead' && sameChromosome && (!!c?.joined || sameSister);
      case 'spindle':
        return data.part === 'fibre';
      case 'centrosome':
        return data.part === 'centrosome';
      case 'cleavageFurrow':
        return data.part === 'ring';
      case 'cellPlate':
        return data.part === 'plate';
    }
  };

  /** The look's material for a part: highlighted, dimmed (another part is picked) or normal. */
  const choose = <M extends THREE.Material>(l: Look<M>, data: PartData, st: Mitosis3DState): M =>
    !selection ? l.base : isSelected(data, st) ? l.hi : l.dim;

  const applyLooks = (st: Mitosis3DState) => {
    for (const o of chromatids) {
      const origin = o.info.origin;
      const d = (m: THREE.Object3D) => m.userData as PartData;
      o.armA.material = choose(mats.rod[origin], d(o.armA), st);
      o.armB.material = o.armA.material;
      o.bead.material = choose(mats.bead, d(o.bead), st);
      o.thread.material = choose(mats.thread[origin], d(o.thread), st);
    }
    const pick = <M extends THREE.Material>(l: Look<M>, part: Part) => choose(l, { part }, st);
    for (const e of envelopes) e.material = pick(mats.envelope, 'envelope');
    for (const e of nucleoli) e.material = pick(mats.nucleolus, 'nucleolus');
    membrane.material = pick(mats.membrane, 'membrane');
    wall.material = pick(mats.wall, 'wall');
    ring.material = pick(mats.ring, 'ring');
    plate.material = pick(mats.plate, 'plate');
    spindle.material = pick(mats.spindle, 'fibre');
    for (const c of centrosomes) {
      const [a, b, halo] = c.parts;
      if (a) a.material = pick(mats.centriole, 'centrosome');
      if (b) b.material = pick(mats.centriole, 'centrosome');
      if (halo) halo.material = pick(mats.pcm, 'centrosome');
    }
  };

  const update = (st: Mitosis3DState) => {
    last = st;
    const rodO = ease(st.condensation, 0.25, 0.7);
    const threadO = 1 - ease(st.condensation, 0.15, 0.6);
    for (const l of [mats.rod.M, mats.rod.P]) setOpacity(l, rodO);
    for (const l of [mats.thread.M, mats.thread.P]) setOpacity(l, threadO);
    setOpacity(mats.bead, rodO);
    const late = st.stage === 'telophase' || st.stage === 'cytokinesis';
    const nucleusR = animal ? ANIMAL.nucleus : PLANT.nucleus;
    const telR = animal ? ANIMAL.telNucleusR : PLANT.telNucleusR;
    const threadScale = 0.75 * (late ? telR / nucleusR : 1);
    chromatids.forEach((o, i) => {
      const p = st.chromatids[i];
      const show = !!p?.present;
      o.armA.visible = show && rodO > 0.01;
      o.armB.visible = o.armA.visible;
      o.bead.visible = o.armA.visible;
      o.thread.visible = show && threadO > 0.01;
      if (!p || !show) return;
      placeArm(o.armA, p.centromere, p.dirA, o.info.armA);
      placeArm(o.armB, p.centromere, p.dirB, o.info.armB);
      o.bead.position.set(...p.centromere);
      o.bead.scale.setScalar(ROD_RADIUS * 1.25);
      o.thread.position.set(...p.centromere);
      o.thread.scale.setScalar(threadScale);
    });

    envelopes.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.envelope > 0.01;
      if (!n) return;
      e.position.set(...n.center);
      e.scale.setScalar(n.radius);
    });
    const env = st.nuclei.reduce((m, n) => Math.max(m, n.envelope), 0);
    setOpacity(mats.envelope, 0.3 * env);
    for (const m of [mats.envelope.base, mats.envelope.hi, mats.envelope.dim])
      setRimAlpha(m, 0.45 * env);
    nucleoli.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.nucleolus > 0.01;
      if (!n) return;
      // Off-centre inside its nucleus, a quarter of its radius.
      e.position.set(
        n.center[0] + 0.3 * n.radius,
        n.center[1] + 0.25 * n.radius,
        n.center[2] - 0.2 * n.radius,
      );
      e.scale.setScalar(0.24 * n.radius);
    });
    // Fully there = fully opaque (a hashed fade at 0.9 looked like noise).
    const nl = st.nuclei.reduce((m, n) => Math.max(m, n.nucleolus), 0);
    setOpacity(mats.nucleolus, nl);

    if (animal) {
      centrosomes.forEach((c, i) => {
        const p = st.centrosomes[i];
        c.group.visible = !!p;
        if (p) c.group.position.set(...p);
      });
    }

    // Spindle fibres: one tube per fibre (unit cylinder moved, turned and stretched).
    let n = 0;
    for (const f of st.fibres) {
      if (n >= maxFibres) break;
      tmpDir.set(f.to[0] - f.from[0], f.to[1] - f.from[1], f.to[2] - f.from[2]);
      const len = tmpDir.length();
      if (len < 1e-6) continue;
      tmpPos.set((f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2, (f.from[2] + f.to[2]) / 2);
      tmpQuat.setFromUnitVectors(UP, tmpDir.divideScalar(len));
      tmpScale.set(fibreShape.radius, len, fibreShape.radius);
      spindle.setMatrixAt(n, tmpMat.compose(tmpPos, tmpQuat, tmpScale));
      n++;
    }
    spindle.count = n;
    spindle.instanceMatrix.needsUpdate = true;
    // Picking re-measures the moved fibres when it needs to (no work per frame).
    spindle.boundingSphere = null;
    spindle.visible = n > 0;
    setOpacity(mats.spindle, 0.85 * Math.min(1, st.spindle * 1.5));

    const sh = st.shape;
    if (sh.type === 'animal') {
      writeProfile(sh.offset, sh.radius);
      const e = 1 + sh.elongation;
      membrane.scale.set(e, 1 / Math.sqrt(e), 1 / Math.sqrt(e));
      ring.visible = sh.ring && sh.ringRadius > 0.02;
      ring.scale.setScalar(Math.max(0.001, sh.ringRadius));
    } else {
      plate.visible = sh.plate > 0.001;
      const r = Math.max(0.001, sh.plateRadius);
      plate.scale.set(r, 1, r);
    }
    applyLooks(st);
  };

  const pick = (raycaster: THREE.Raycaster): PickResult | null => {
    const st = last;
    if (!st) return null;
    const hits = raycaster.intersectObjects(pickables, false).filter((h) => {
      if (!h.object.visible || !h.object.parent?.visible) return false;
      const mat = (h.object as THREE.Mesh).material as THREE.Material;
      // Faded out (blended or alphaHash): not there to be picked.
      return !(mat.transparent || mat.alphaHash) || mat.opacity > 0.05;
    });
    const inner = hits.find((h) => !CONTAINERS.has((h.object.userData as PartData).part));
    if (inner) {
      const data = inner.object.userData as PartData;
      const c = data.chromatid !== undefined ? st.chromatids[data.chromatid] : undefined;
      switch (data.part) {
        case 'arm':
          if (!c) return null;
          return c.joined
            ? { component: 'doubleChromosome', chromosome: c.chromosome, sister: c.sister }
            : { component: 'singleChromosome', chromosome: c.chromosome, sister: c.sister };
        case 'bead':
          if (!c) return null;
          // A split centromere belongs to one sister (now its own single chromosome).
          return c.joined
            ? { component: 'centromere', chromosome: c.chromosome }
            : { component: 'centromere', chromosome: c.chromosome, sister: c.sister };
        case 'thread':
          return { component: 'chromatin' };
        case 'fibre':
          return { component: 'spindle' };
        case 'centrosome':
          return { component: 'centrosome' };
        case 'ring':
          return { component: 'cleavageFurrow' };
        case 'plate':
          return { component: 'cellPlate' };
        case 'nucleolus':
          return { component: 'nucleolus' };
        default:
          return null;
      }
    }
    const envelope = hits.find((h) => (h.object.userData as PartData).part === 'envelope');
    if (envelope?.face) {
      // Near the rim (grazing ray) = the envelope itself; through the middle = the nucleus.
      const n = envelope.face.normal.clone().transformDirection(envelope.object.matrixWorld);
      return Math.abs(n.dot(raycaster.ray.direction)) < 0.45
        ? { component: 'nuclearEnvelope' }
        : { component: 'nucleus' };
    }
    if (hits.some((h) => (h.object.userData as PartData).part === 'wall'))
      return { component: 'cellWall' };
    if (hits.some((h) => (h.object.userData as PartData).part === 'membrane'))
      return { component: 'membrane' };
    return null;
  };

  const frame = (mode: CameraMode): CameraFrame => cameraFrame(mode, last, tl.cellType);

  const stats = () => {
    let objects = 0;
    let meshes = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((o) => {
      objects++;
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        meshes++;
        geometries.add(o.geometry as THREE.BufferGeometry);
        materials.add(o.material as THREE.Material);
      }
    });
    return { objects, meshes, geometries: geometries.size, materials: materials.size };
  };

  return {
    scene,
    update,
    setSelection(sel) {
      selection = sel;
      if (last) applyLooks(last);
    },
    pick,
    frame,
    stats,
    drawStats: () => drawStats(scene),
    dispose() {
      for (const d of disposables) d.dispose();
      disposables.length = 0;
      capsules.clear();
      pickables.length = 0;
      scene.clear();
      last = null;
    },
  };
}
