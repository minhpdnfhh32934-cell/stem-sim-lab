/**
 * three.js scene of the 3D mitosis view. Built ONCE per timeline (cell type × 2n): shared
 * geometries and materials, one set of meshes per chromatid, nothing allocated per frame —
 * `update(state)` only moves, scales, re-colours and shows/hides existing objects (the animal
 * membrane and the spindle write into their existing vertex buffers). `dispose()` frees every
 * geometry and material it created. Rendering (renderer, camera, controls) lives in the view.
 */
import * as THREE from 'three';
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

/** Half length (x) of the two animal daughter cells together at the end of cytokinesis. */
const ANIMAL_EXTENT = 1.06 * ANIMAL.daughterRadius + ANIMAL.daughterRadius;

/** CSS colour strings (read from theme tokens by the view). */
export interface ScenePalette {
  maternal: string;
  paternal: string;
  centromere: string;
  membrane: string;
  envelope: string;
  wall: string;
  spindle: string;
  centrosome: string;
  plate: string;
  ring: string;
  highlight: string;
}

export interface SceneOptions {
  /** Sphere segments from the quality tier. */
  segments: number;
}

export type PickResult = Selection;
export type { CameraMode, Selection };

/** What the camera must show: points (relative to `center`) that have to be in view. */
export interface CameraFrame {
  center: Vec3;
  points: Vec3[];
}

/** 26 points on a sphere (axes, edge and corner directions of a cube). */
function spherePoints(c: Vec3, r: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        if (i === 0 && j === 0 && k === 0) continue;
        const l = Math.hypot(i, j, k);
        out.push([c[0] + (r * i) / l, c[1] + (r * j) / l, c[2] + (r * k) / l]);
      }
  return out;
}

export interface MitosisScene {
  scene: THREE.Scene;
  update(state: Mitosis3DState): void;
  setSelection(sel: Selection | null): void;
  /** The cell part under a ray (inner parts win over the membranes they sit in). */
  pick(raycaster: THREE.Raycaster): PickResult | null;
  /** Box to frame with the camera: the whole cell (after division too), or the chromosomes now. */
  frame(mode: CameraMode): CameraFrame;
  stats(): { objects: number; meshes: number; geometries: number; materials: number };
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
  | 'envelope'
  | 'membrane'
  | 'wall';

interface PartData {
  part: Part;
  chromatid?: number;
}

const CONTAINERS: ReadonlySet<Part> = new Set(['envelope', 'membrane', 'wall']);

/** Two materials per look: normal and highlighted (swapped, never re-created). */
interface Look<M extends THREE.Material> {
  base: M;
  hi: M;
}

export function buildMitosisScene(
  tl: Timeline,
  palette: ScenePalette,
  opts: SceneOptions,
): MitosisScene {
  const seg = Math.max(8, Math.round(opts.segments));
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // Lights (no shadows).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(6, 9, 12);
  scene.add(sun);

  // ---- materials
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra }));
  const look = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => ({
    base: std(color, extra),
    hi: std(color, { ...extra, emissive: palette.highlight, emissiveIntensity: 0.75 }),
  });
  const lineLook = (color: string, opacity: number): Look<THREE.LineBasicMaterial> => ({
    base: keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity })),
    hi: keep(
      new THREE.LineBasicMaterial({ color: palette.highlight, transparent: true, opacity: 1 }),
    ),
  });
  const glass = { transparent: true, depthWrite: false };
  const mats = {
    rod: {
      M: look(palette.maternal, { transparent: true }),
      P: look(palette.paternal, { transparent: true }),
    },
    thread: {
      M: look(palette.maternal, { transparent: true }),
      P: look(palette.paternal, { transparent: true }),
    },
    bead: look(palette.centromere, { transparent: true }),
    envelope: look(palette.envelope, { ...glass, opacity: 0.3, side: THREE.DoubleSide }),
    membrane: look(palette.membrane, {
      ...glass,
      opacity: tl.cellType === 'animal' ? 0.16 : 0.08,
    }),
    wall: look(palette.wall, { ...glass, opacity: 0.2 }),
    centriole: look(palette.centrosome),
    pcm: look(palette.centrosome, { ...glass, opacity: 0.25 }),
    ring: look(palette.ring),
    plate: look(palette.plate, { ...glass, opacity: 0.75, side: THREE.DoubleSide }),
    spindle: lineLook(palette.spindle, 0.75),
    wallEdge: lineLook(palette.wall, 0.9),
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
      keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg * 5, 0.07, 5, false)),
    );
  }
  const centrioleGeo = keep(new THREE.CylinderGeometry(0.09, 0.09, 0.44, Math.max(6, seg / 2)));
  const torus = keep(new THREE.TorusGeometry(1, 0.045, 6, seg * 3));
  const box = keep(new THREE.BoxGeometry(2, 2, 2));
  const edges = keep(new THREE.EdgesGeometry(box));
  const disc = keep(new THREE.CylinderGeometry(1, 1, 0.12, seg * 2));

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

  // ---- nuclei (at most two)
  const envelopes = [0, 1].map(() => mesh(sphere, mats.envelope.base, { part: 'envelope' }));

  // ---- centrosomes (animal): two centrioles at right angles + pericentriolar material
  const centrosomes = [0, 1].map(() => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(centrioleGeo, mats.centriole.base);
    const b = new THREE.Mesh(centrioleGeo, mats.centriole.base);
    b.rotation.z = Math.PI / 2;
    b.position.x = 0.16;
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

  // ---- spindle: one LineSegments, buffer sized for the most fibres the timeline can have
  const maxFibres = 12 + 16 + 2 * tl.chromatids.length;
  const fibrePos = new Float32Array(maxFibres * 6);
  const fibreGeo = keep(new THREE.BufferGeometry());
  const fibreAttr = new THREE.BufferAttribute(fibrePos, 3);
  fibreAttr.setUsage(THREE.DynamicDrawUsage);
  fibreGeo.setAttribute('position', fibreAttr);
  fibreGeo.setDrawRange(0, 0);
  const spindle = new THREE.LineSegments(fibreGeo, mats.spindle.base);
  spindle.userData = { part: 'fibre' } satisfies PartData;
  spindle.frustumCulled = false;
  scene.add(spindle);
  pickables.push(spindle);

  // ---- cell body
  const animal = tl.cellType === 'animal';
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
  const membrane = mesh(animal ? memGeo : box, mats.membrane.base, { part: 'membrane' });
  if (animal) writeProfile(0, ANIMAL.radius);
  const ring = mesh(torus, mats.ring.base, { part: 'ring' });
  ring.rotation.y = Math.PI / 2; // axis along x
  const wall = mesh(box, mats.wall.base, { part: 'wall' });
  const wallEdges = new THREE.LineSegments(edges, mats.wallEdge.base);
  wallEdges.userData = { part: 'wall' } satisfies PartData;
  scene.add(wallEdges);
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
  if (animal) {
    wall.visible = false;
    wallEdges.visible = false;
    plate.visible = false;
  } else {
    membrane.scale.set(hx, hy, hz);
    wall.scale.set(hx + PLANT.wall, hy + PLANT.wall, hz + PLANT.wall);
    wallEdges.scale.copy(wall.scale);
    ring.visible = false;
    for (const c of centrosomes) c.group.visible = false;
  }

  // ---- update (no allocation: temporaries live here)
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();
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
        return data.part === 'envelope' || data.part === 'thread';
      case 'nuclearEnvelope':
        return data.part === 'envelope';
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

  const applyLooks = (st: Mitosis3DState) => {
    for (const o of chromatids) {
      const origin = o.info.origin;
      const d = (m: THREE.Object3D) => m.userData as PartData;
      o.armA.material = isSelected(d(o.armA), st) ? mats.rod[origin].hi : mats.rod[origin].base;
      o.armB.material = o.armA.material;
      o.bead.material = isSelected(d(o.bead), st) ? mats.bead.hi : mats.bead.base;
      o.thread.material = isSelected(d(o.thread), st)
        ? mats.thread[origin].hi
        : mats.thread[origin].base;
    }
    const pick = <M extends THREE.Material>(l: Look<M>, part: Part) =>
      isSelected({ part }, st) ? l.hi : l.base;
    for (const e of envelopes) e.material = pick(mats.envelope, 'envelope');
    membrane.material = pick(mats.membrane, 'membrane');
    wall.material = pick(mats.wall, 'wall');
    wallEdges.material = pick(mats.wallEdge, 'wall');
    ring.material = pick(mats.ring, 'ring');
    plate.material = pick(mats.plate, 'plate');
    spindle.material = pick(mats.spindle, 'fibre');
    const cs = isSelected({ part: 'centrosome' }, st);
    for (const c of centrosomes) {
      const [a, b, halo] = c.parts;
      if (a) a.material = cs ? mats.centriole.hi : mats.centriole.base;
      if (b) b.material = cs ? mats.centriole.hi : mats.centriole.base;
      if (halo) halo.material = cs ? mats.pcm.hi : mats.pcm.base;
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

    if (animal) {
      centrosomes.forEach((c, i) => {
        const p = st.centrosomes[i];
        c.group.visible = !!p;
        if (p) c.group.position.set(...p);
      });
    }

    // Spindle fibres
    let n = 0;
    for (const f of st.fibres) {
      if (n >= maxFibres) break;
      const k = n * 6;
      fibrePos[k] = f.from[0];
      fibrePos[k + 1] = f.from[1];
      fibrePos[k + 2] = f.from[2];
      fibrePos[k + 3] = f.to[0];
      fibrePos[k + 4] = f.to[1];
      fibrePos[k + 5] = f.to[2];
      n++;
    }
    fibreGeo.setDrawRange(0, n * 2);
    fibreAttr.needsUpdate = true;
    fibreGeo.computeBoundingSphere();
    spindle.visible = n > 0;
    mats.spindle.base.opacity = 0.75 * Math.min(1, st.spindle * 1.5);

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
      return !mat.transparent || mat.opacity > 0.05;
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

  const frame = (mode: CameraMode): CameraFrame => {
    if (mode === 'overview' || !last) {
      if (!animal) {
        const w = PLANT.wall;
        const corners: Vec3[] = [];
        for (const sx of [-1, 1])
          for (const sy of [-1, 1])
            for (const sz of [-1, 1]) corners.push([sx * (hx + w), sy * (hy + w), sz * (hz + w)]);
        return { center: [0, 0, 0], points: corners };
      }
      // The mother cell and, at the end, the two daughter cells.
      const d = ANIMAL_EXTENT - ANIMAL.daughterRadius;
      return {
        center: [0, 0, 0],
        points: [
          ...spherePoints([0, 0, 0], ANIMAL.radius * (1 + ANIMAL.elongation / 2)),
          ...spherePoints([-d, 0, 0], ANIMAL.daughterRadius),
          ...spherePoints([d, 0, 0], ANIMAL.daughterRadius),
        ],
      };
    }
    const pts = last.chromatids.filter((c) => c.present).map((c) => c.centromere);
    if (pts.length === 0) return { center: [0, 0, 0], points: spherePoints([0, 0, 0], 4) };
    const lo: Vec3 = [Infinity, Infinity, Infinity];
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k] ?? 0, p[k] ?? 0);
        hi[k] = Math.max(hi[k] ?? 0, p[k] ?? 0);
      }
    }
    const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    // Every centromere plus a margin for the arms around it.
    return {
      center,
      points: pts.flatMap((p) =>
        spherePoints([p[0] - center[0], p[1] - center[1], p[2] - center[2]], 1.2),
      ),
    };
  };

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
