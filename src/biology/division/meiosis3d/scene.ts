/**
 * three.js scene of the 3D meiosis view (animal germ cell). Built ONCE per timeline (2n ×
 * crossing over × seed): shared geometries and materials, one tube per chromatid, nothing
 * allocated per frame — `update(state)` only moves, scales, re-colours and shows/hides existing
 * objects (membranes and the spindle write into their existing buffers). `dispose()` frees every
 * geometry, material and texture it created. Renderer, camera and controls live in the view.
 *
 * Built from the shared division pieces (`../division3d/`): chromatid tubes painted per DNA piece
 * from the model (a recombinant chromatid shows exactly its maternal / paternal pieces, from the
 * crossing over on), two-sphere membranes (one per dividing cell: one in meiosis I, two in
 * meiosis II — four cells at the end), centrosomes, spindles and nuclei. The chiasma is drawn as
 * a small X between the two inner chromatids, at the model's crossover point, ringed by a small
 * glowing ring (shape and glow are illustrative); the change from maternal to paternal colour on a
 * recombinant chromatid is a sharp seam at the model's own crossover share. Materials, membranes
 * and spindles look exactly as in mitosis (`../division3d/looks.ts`). A picked part glows in the
 * highlight colour while the other parts are dimmed.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { LAYER } from '@/ui/three/layers';
import { contactShadow, disposeLightRig, lightRig } from '@/ui/three/lighting';
import type { Hull, LabelObstacles } from '@/ui/three/labelLayer';
import { setRimAlpha } from '@/ui/three/materials';
import { ChromosomeTube } from '../../view3d/primitives/chromosomeTube';
import { centrosomeMaker } from '../division3d/centrosomeMesh';
import { ILLUSTRATIVE_SCALE } from '../division3d/dimensions';
import {
  SPINDLE_OPACITY,
  divisionLooks,
  setLookOpacity,
  type DivisionPalette,
  type Look,
} from '../division3d/looks';
import {
  condensedShare,
  threadSamples,
  tubeProfile,
  writeCentreline,
  type CentrelineInput,
  type TubeProfile,
} from '../division3d/chromatidShape';
import { ease } from '../division3d/math';
import { cellRegions, tubeHull } from '../division3d/labelObstacles';
import { TwoSphereProfile } from '../division3d/membraneMesh';
import { placeNucleolus, writeEnvelopeParts } from '../division3d/nucleusMesh';
import { envelopeBreakdown, spherePointsEven } from '../division3d/sceneParts';
import { FIBRE, fibreGeometry, writeFibres } from '../division3d/spindleMesh';
import { CONTACT_SHADE, KINETOCHORE_RADIUS, tubeDetail } from '../division3d/tubes';
import { meiosisFrame, type CameraFrame } from './camera';
import {
  chromosomePart,
  homologuesTogether,
  meiosisPartVisible,
  type MeiosisCameraMode,
  type MeiosisComponentId,
  type MeiosisSelection,
} from './components';
import {
  DAUGHTER2_Y,
  MEIOSIS,
  ROD_RADIUS,
  type Meiosis3DState,
  type MeiosisChromatidInfo,
  type MeiosisTimeline,
  type Vec3,
} from './timeline';

/** CSS colour strings (read from theme tokens by the view). */
export interface MeiosisPalette extends DivisionPalette {
  maternal: string;
  paternal: string;
  chiasma: string;
}

export interface MeiosisSceneOptions {
  /** Sphere segments from the quality tier. */
  segments: number;
  tier?: QualityTier;
  /** Opacity of the membranes (a theme token: higher in the dark theme). */
  membraneOpacity?: number;
  /** Strength of the Fresnel outline of see-through shells (a theme token). */
  rimStrength?: number;
  /** How much solids darken towards their silhouette (a theme token, `withEdgeShade`). */
  edgeShade?: number;
  /** Darker outline of see-through shells (a theme token: on in light, 0 in dark). */
  shellInk?: number;
  /** HDR path (High tier on a discrete GPU): glowing centrosome cores and chiasma ring. */
  hdr?: boolean;
}

/** A part to name on the picture, a point on it (world units) and its colour (anchor ring). */
export interface MeiosisLabelAnchor {
  id: MeiosisComponentId;
  point: Vec3;
  color: string;
}

export interface MeiosisScene {
  scene: THREE.Scene;
  update(state: Meiosis3DState): void;
  setSelection(sel: MeiosisSelection | null): void;
  /** The cell part under a ray (inner parts win over the membranes they sit in). */
  pick(raycaster: THREE.Raycaster): MeiosisSelection | null;
  /** Where the last `pick` ray met the part it picked (null when it picked nothing). */
  pickedPoint(): Vec3 | null;
  frame(mode: MeiosisCameraMode): CameraFrame;
  /** Points of the parts that can be named now, most important first (for the name labels). */
  labelAnchors(): MeiosisLabelAnchor[];
  /** What the name labels keep clear of: the chromosomes, and each cell (world space). */
  labelObstacles(): LabelObstacles;
  stats(): { objects: number; meshes: number; geometries: number; materials: number };
  drawStats(): DrawStats;
  dispose(): void;
}

type Part =
  | 'arm'
  | 'bead'
  | 'thread'
  | 'chiasma'
  /** The glowing ring around a chiasma (picks and highlights as the chiasma). */
  | 'chiasmaRing'
  | 'fibre'
  | 'centrosome'
  | 'ring'
  | 'nucleolus'
  | 'envelope'
  | 'vesicle'
  | 'pore'
  | 'membrane';

interface PartData {
  part: Part;
  chromatid?: number;
  pair?: number;
}

const CONTAINERS: ReadonlySet<Part> = new Set(['envelope', 'membrane']);
const CHROMOSOME_PARTS: ReadonlySet<Part> = new Set([
  'arm',
  'bead',
  'thread',
  'chiasma',
  'chiasmaRing',
]);
/** How far behind a thin fibre a chromosome may be and still be picked. */
const FIBRE_SLACK = 0.35;
/** A tube is rewritten only when its shape changes by more than can be seen (as in mitosis). */
const SAME_DIRECTION = 0.999975;
const SAME_SHARE = 0.002;
/** A click this close to a condensed chromatid's centromere picks the centromere. */
const CENTROMERE_PICK = 0.26 * ILLUSTRATIVE_SCALE;
/** Half the length of each bar of the chiasma's X, along the chromatids. */
const CHIASMA_HALF = 0.26 * ILLUSTRATIVE_SCALE;
/**
 * The glowing ring around a chiasma (illustrative): radius, tube, and how far it is drawn towards
 * the viewer (it always faces the camera and sits just in front of the chromatids it rings).
 */
const CHIASMA_RING = { radius: 0.36 * ILLUSTRATIVE_SCALE, tube: 0.028, lift: 0.35 } as const;
/** Depth of the membranes' undulation (share of the radius; illustrative, always inwards). */
const MEMBRANE_WAVE = 0.015;
/** Nuclei at once (telophase II: two in each of two cells). */
const NUCLEI = 4;
const PORES = 32;
const VESICLES = 40;

export function buildMeiosisScene(
  tl: MeiosisTimeline,
  palette: MeiosisPalette,
  opts: MeiosisSceneOptions,
): MeiosisScene {
  const seg = Math.max(8, Math.round(opts.segments));
  const tier: QualityTier = opts.tier ?? (seg >= 24 ? 'high' : seg >= 16 ? 'medium' : 'low');
  const rimStrength = opts.rimStrength ?? 0.7;
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const rig = lightRig({ size: 14 });
  scene.add(rig);
  disposables.push({
    dispose: () => {
      disposeLightRig(rig);
    },
  });
  // Under the lowest of the four final cells.
  const shadow = contactShadow(-(DAUGHTER2_Y + MEIOSIS.radius2 + 0.6), 10.5, 5.5, 0.24);
  scene.add(shadow.mesh);
  disposables.push(shadow);

  // ---- materials (shared with mitosis: `../division3d/looks.ts`)
  const hdr = opts.hdr ?? false;
  const mats = divisionLooks(
    palette,
    {
      tier,
      membraneOpacity: opts.membraneOpacity ?? 0.16,
      rimStrength,
      edgeShade: opts.edgeShade ?? 0,
      shellInk: opts.shellInk ?? 0,
      hdr,
    },
    keep,
  );
  const detail = tier === 'high';

  // ---- shared geometries
  const sphere = keep(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
  const kinetoGeo = keep(
    new THREE.CylinderGeometry(KINETOCHORE_RADIUS, KINETOCHORE_RADIUS, 1, Math.max(10, seg)),
  );
  const { sides: tubeSides, ...rings } = tubeDetail(tier, tl.chromatids.length);
  const centrioleGeo = keep(
    new THREE.CylinderGeometry(0.1, 0.1, 0.42, Math.max(8, seg / 2), 1, true),
  );
  const torus = keep(new THREE.TorusGeometry(1, 0.06, 8, seg * 3));
  const poreGeo = keep(new THREE.TorusGeometry(0.075, 0.022, 3, 8));
  const blob = keep(new THREE.IcosahedronGeometry(1, 1));
  const tubuleGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true));
  const fibreShape = FIBRE[tier];
  const fibreGeo = keep(
    fibreGeometry(fibreShape.sides, SPINDLE_OPACITY.pole / SPINDLE_OPACITY.far),
  );
  // A bar of the chiasma's X: a unit capsule-like cylinder (radius 1, height 1 along +y).
  const barGeo = keep(new THREE.CylinderGeometry(1, 1, 1, Math.max(8, seg / 2)));
  // The ring around a chiasma (axis z before it is turned).
  const chiasmaRingGeo = keep(
    new THREE.TorusGeometry(CHIASMA_RING.radius, CHIASMA_RING.tube, 6, Math.max(16, seg)),
  );

  const pickables: THREE.Object3D[] = [];
  const mesh = <M extends THREE.Material>(geo: THREE.BufferGeometry, mat: M, data: PartData) => {
    const m = new THREE.Mesh(geo, mat);
    m.userData = data;
    scene.add(m);
    pickables.push(m);
    return m;
  };

  // ---- chromatids: one tube each (thread ↔ rod in place), painted from the model's pieces
  interface ChromatidObjects {
    info: MeiosisChromatidInfo;
    tube: ChromosomeTube;
    mesh: THREE.Mesh;
    kineto: THREE.Mesh;
    thread: Float32Array;
    profile: TubeProfile;
    centre: Float32Array;
    radii: Float32Array;
    key: Float64Array;
    /** Which pieces are painted now: before (false) or after (true) the crossing over. */
    painted: boolean;
  }
  const originColour = { M: palette.maternal, P: palette.paternal };
  const paint = (o: ChromatidObjects, crossed: boolean) => {
    const pieces = crossed ? o.info.after : o.info.before;
    o.tube.setColours(
      pieces.map((g) => ({ from: g.from, to: g.to, color: originColour[g.origin] })),
    );
    o.painted = crossed;
  };
  const chromatids: ChromatidObjects[] = tl.chromatids.map((info, id) => {
    const tube = keep(
      new ChromosomeTube({
        armA: info.armA,
        armB: info.armB,
        radius: ROD_RADIUS,
        sides: tubeSides,
        ...rings,
        // Where the model's pieces meet (after the crossing over): a sharp colour seam.
        seams: info.after.slice(1).map((g) => g.from),
      }),
    );
    const m = mesh(tube.geometry, mats.tube.base, { part: 'thread', chromatid: id });
    m.frustumCulled = false;
    const o: ChromatidObjects = {
      info,
      tube,
      mesh: m,
      kineto: mesh(kinetoGeo, mats.bead.base, { part: 'bead', chromatid: id }),
      thread: threadSamples(info, tube.stations),
      profile: tubeProfile(info, tube.stations),
      centre: new Float32Array(tube.rings * 3),
      radii: new Float32Array(tube.rings),
      key: new Float64Array(12).fill(Number.NaN),
      painted: false,
    };
    paint(o, false);
    return o;
  });

  // ---- chiasmata: an X of two bars between the two inner chromatids (per crossover)
  const chiasmaPairs = tl.options.crossovers.flatMap((x) => {
    const a = tl.chromatids.findIndex(
      (c) => c.pair === x.pair && c.origin === 'M' && c.sister === 1,
    );
    const b = tl.chromatids.findIndex(
      (c) => c.pair === x.pair && c.origin === 'P' && c.sister === 0,
    );
    return a >= 0 && b >= 0 ? [{ pair: x.pair, point: x.point, a, b }] : [];
  });
  /** Ring of a chromatid's tube nearest a station (signed distance from the centromere). */
  const ringNear = (o: ChromatidObjects | undefined, station: number) => {
    const st = o?.tube.stations ?? [];
    let best = 0;
    for (let i = 1; i < st.length; i++)
      if (Math.abs((st[i] ?? 0) - station) < Math.abs((st[best] ?? 0) - station)) best = i;
    return best;
  };
  const chiasmata = chiasmaPairs.map((x) => {
    const a = chromatids[x.a];
    const b = chromatids[x.b];
    // The crossover point (share of the length from the arm-A tip) as a signed distance from the
    // centromere; homologous chromatids have the same arms, so it is the same on both.
    const armA = a?.info.armA ?? 0;
    const at = x.point * (armA + (a?.info.armB ?? 0)) - armA;
    return {
      ...x,
      /** Rings of the X's two bars: a before → b after, b before → a after. */
      ends: [
        [ringNear(a, at - CHIASMA_HALF), ringNear(b, at + CHIASMA_HALF)],
        [ringNear(b, at - CHIASMA_HALF), ringNear(a, at + CHIASMA_HALF)],
      ] as const,
      bars: [0, 1].map(() => mesh(barGeo, mats.chiasma.base, { part: 'chiasma', pair: x.pair })),
      /** The crossover rings of both chromatids (the X's centre lies between them). */
      at: [ringNear(a, at), ringNear(b, at)] as const,
      ring: mesh(chiasmaRingGeo, mats.chiasmaRing.base, { part: 'chiasmaRing', pair: x.pair }),
      /** The X's centre (world), written by update. */
      centre: new THREE.Vector3(),
    };
  });
  // Each ring faces the camera, lifted towards it (set just before it is drawn: no allocation).
  const toViewer = new THREE.Vector3();
  for (const x of chiasmata) {
    x.ring.onBeforeRender = (_renderer, _scene, camera) => {
      x.ring.quaternion.copy(camera.quaternion);
      toViewer.set(0, 0, 1).applyQuaternion(camera.quaternion);
      x.ring.position.copy(x.centre).addScaledVector(toViewer, CHIASMA_RING.lift);
      x.ring.updateMatrixWorld();
    };
  }

  // ---- nuclei (up to four), each with a nucleolus
  const envelopes = Array.from({ length: NUCLEI }, () =>
    mesh(sphere, mats.envelope.base, { part: 'envelope' }),
  );
  const nucleoli = Array.from({ length: NUCLEI }, () =>
    mesh(sphere, mats.nucleolus.base, { part: 'nucleolus' }),
  );
  const innerEnvelopes = detail
    ? Array.from({ length: NUCLEI }, () => mesh(sphere, mats.envelope.base, { part: 'envelope' }))
    : [];
  const poreDirs = spherePointsEven(PORES);
  const vesicleDirs = spherePointsEven(VESICLES);
  const pores = detail ? new THREE.InstancedMesh(poreGeo, mats.pore.base, NUCLEI * PORES) : null;
  const vesicles = detail
    ? new THREE.InstancedMesh(blob, mats.vesicle.base, NUCLEI * VESICLES)
    : null;
  for (const im of [pores, vesicles]) {
    if (!im) continue;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0;
    im.frustumCulled = false;
    scene.add(im);
    keep({
      dispose: () => {
        im.dispose();
      },
    });
  }
  if (pores) {
    pores.userData = { part: 'pore' } satisfies PartData;
    pores.raycast = () => undefined;
  }
  if (vesicles) {
    vesicles.userData = { part: 'vesicle' } satisfies PartData;
    pickables.push(vesicles);
  }

  // ---- centrosomes (four at most: two per cell in meiosis II)
  const makeCentrosome = centrosomeMaker({
    detail,
    sphere,
    centrioleGeo,
    tubuleGeo,
    centriole: mats.centriole.base,
    pcm: mats.pcm.base,
    ...(hdr ? { core: mats.core.base } : {}),
    keep,
  });
  const centrosomes = [0, 1, 2, 3].map(() => {
    const c = makeCentrosome();
    for (const m of c.parts) {
      m.userData = { part: 'centrosome' } satisfies PartData;
      pickables.push(m);
    }
    scene.add(c.group);
    return c;
  });

  // ---- spindles: one InstancedMesh for every fibre (two spindles in meiosis II)
  const maxFibres = 2 * (12 + 16) + tl.chromatids.length;
  const spindle = new THREE.InstancedMesh(fibreGeo, mats.spindle.base, maxFibres);
  spindle.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spindle.count = 0;
  // See-through fibres on the FX layer (no ambient occlusion), before the membranes' front faces.
  spindle.userData = { part: 'fibre', layer: LAYER.FX };
  spindle.renderOrder = -0.25;
  spindle.frustumCulled = false;
  scene.add(spindle);
  pickables.push(spindle);

  // ---- membranes: one two-sphere profile per dividing cell, and its contractile ring
  const membranes = [0, 1].map((i) => {
    const profile = keep(new TwoSphereProfile(seg, { amplitude: MEMBRANE_WAVE, seed: 7 + 4 * i }));
    profile.write(0, MEIOSIS.radius);
    const m = mesh(profile.geometry, mats.membrane.base, { part: 'membrane' });
    // The cell's volume: the membrane's lit back face, drawn first.
    const inside = new THREE.Mesh(profile.geometry, mats.cytoplasm.base);
    inside.raycast = () => undefined;
    inside.renderOrder = -0.5;
    m.add(inside);
    const ring = mesh(torus, mats.ring.base, { part: 'ring' });
    return { profile, mesh: m, inside, ring };
  });

  // ---- update (no allocation: temporaries live here)
  const UP = new THREE.Vector3(0, 1, 0);
  const IDENTITY = new THREE.Quaternion();
  // A torus lies in its xy plane (axis z): turned so its axis is the cell's spindle axis.
  const RING_Y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const Z_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const RING_X = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const tmpDir = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let last: Meiosis3DState | null = null;
  const turned = (k: Float64Array, d: Vec3, at: number) =>
    d[0] * (k[at] ?? 0) + d[1] * (k[at + 1] ?? 0) + d[2] * (k[at + 2] ?? 0) < SAME_DIRECTION;
  const lineInput: CentrelineInput = {
    centromere: [0, 0, 0],
    dirA: [1, 0, 0],
    dirB: [-1, 0, 0],
    thread: new Float32Array(0),
    profile: { tip: new Float32Array(0), waist: new Float32Array(0) },
    threadScale: 1,
    m: 0,
    towardSister: [0, 0, 0],
    pinch: 0,
  };
  /** Contact shade of one tube write (reused: no allocation per frame). */
  const contact = {
    towards: new Float32Array(3),
    strength: 0,
    reach: CONTACT_SHADE.reach,
  };
  let selection: MeiosisSelection | null = null;

  const setOpacity = setLookOpacity;

  const isSelected = (data: PartData, st: Meiosis3DState): boolean => {
    if (!selection) return false;
    const sel = selection;
    const c = data.chromatid !== undefined ? st.chromatids[data.chromatid] : undefined;
    const info = data.chromatid !== undefined ? tl.chromatids[data.chromatid] : undefined;
    const sameChromosome = sel.chromosome === undefined || c?.chromosome === sel.chromosome;
    const sameSister = sel.sister === undefined || c?.sister === sel.sister;
    const samePair = sel.pair === undefined || (info?.pair ?? data.pair) === sel.pair;
    switch (sel.component) {
      case 'membrane':
        return data.part === 'membrane';
      case 'nucleus':
        return (
          data.part === 'envelope' ||
          data.part === 'vesicle' ||
          data.part === 'pore' ||
          data.part === 'thread' ||
          data.part === 'nucleolus'
        );
      case 'nuclearEnvelope':
        return data.part === 'envelope' || data.part === 'vesicle' || data.part === 'pore';
      case 'nucleolus':
        return data.part === 'nucleolus';
      case 'chromatin':
        return data.part === 'thread';
      case 'bivalent':
        // The four chromatids of the pair and its chiasma.
        return (
          (data.part === 'arm' && !!c?.paired && samePair) ||
          ((data.part === 'chiasma' || data.part === 'chiasmaRing') && samePair)
        );
      case 'homologousChromosome':
        // Only while both homologues are in one group (G1 … metaphase I).
        return data.part === 'arm' && !!c?.joined && sameChromosome && homologuesTogether(st.stage);
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
      case 'chiasma':
        return (data.part === 'chiasma' || data.part === 'chiasmaRing') && samePair;
      case 'centromere':
        return data.part === 'bead' && sameChromosome && (!!c?.joined || sameSister);
      case 'spindle':
        return data.part === 'fibre';
      case 'centrosome':
        return data.part === 'centrosome';
      case 'cleavageFurrow':
        return data.part === 'ring';
    }
  };

  const choose = <M extends THREE.Material>(l: Look<M>, data: PartData, st: Meiosis3DState): M =>
    !selection ? l.base : isSelected(data, st) ? l.hi : l.dim;

  const applyLooks = (st: Meiosis3DState) => {
    const d = (m: THREE.Object3D) => m.userData as PartData;
    for (const o of chromatids) {
      o.mesh.material = choose(mats.tube, d(o.mesh), st);
      o.kineto.material = choose(mats.bead, d(o.kineto), st);
    }
    for (const x of chiasmata) {
      for (const b of x.bars) b.material = choose(mats.chiasma, d(b), st);
      x.ring.material = choose(mats.chiasmaRing, d(x.ring), st);
    }
    const pick = <M extends THREE.Material>(l: Look<M>, part: Part) => choose(l, { part }, st);
    for (const e of envelopes) e.material = pick(mats.envelope, 'envelope');
    for (const e of innerEnvelopes) e.material = pick(mats.envelope, 'envelope');
    if (pores) pores.material = pick(mats.pore, 'pore');
    if (vesicles) vesicles.material = pick(mats.vesicle, 'vesicle');
    for (const e of nucleoli) e.material = pick(mats.nucleolus, 'nucleolus');
    for (const m of membranes) {
      m.mesh.material = pick(mats.membrane, 'membrane');
      m.inside.material = pick(mats.cytoplasm, 'membrane');
      m.ring.material = pick(mats.ring, 'ring');
    }
    spindle.material = pick(mats.spindle, 'fibre');
    for (const c of centrosomes)
      for (const m of c.parts)
        m.material = pick(
          m === c.halo ? mats.pcm : m === c.core ? mats.core : mats.centriole,
          'centrosome',
        );
  };

  /** Centre-line point of a chromatid's tube at ring k (world units). */
  const pointAt = (o: ChromatidObjects, k: number, out: THREE.Vector3) =>
    out.set(
      o.mesh.position.x + (o.centre[3 * k] ?? 0),
      o.mesh.position.y + (o.centre[3 * k + 1] ?? 0),
      o.mesh.position.z + (o.centre[3 * k + 2] ?? 0),
    );
  /** A bar from p to q (unit cylinder moved, turned and stretched). */
  const bar = (m: THREE.Mesh, p: THREE.Vector3, q: THREE.Vector3, r: number) => {
    tmpDir.subVectors(q, p);
    const l = tmpDir.length();
    if (l < 1e-6) {
      m.visible = false;
      return;
    }
    m.position.addVectors(p, q).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, tmpDir.divideScalar(l));
    m.scale.set(r, l, r);
  };

  const update = (st: Meiosis3DState) => {
    last = st;
    const m = condensedShare(st.condensation);
    const tubePart: Part = st.condensation < 0.5 ? 'thread' : 'arm';
    const kinetoO = ease(st.condensation, 0.4, 0.7);
    setOpacity(mats.bead, kinetoO);
    // Thread size follows the nucleus the chromatin is in (smaller nuclei after each division);
    // it changes only while the chromosomes are fully condensed (anaphase → telophase).
    const nucleusR =
      st.stage === 'telophase2' || st.stage === 'cytokinesis2'
        ? MEIOSIS.telNucleusR2
        : st.division === 2 || st.stage === 'telophase1' || st.stage === 'cytokinesis1'
          ? MEIOSIS.telNucleusR
          : MEIOSIS.nucleus;
    const threadScale = 0.75 * (nucleusR / MEIOSIS.nucleus);
    const letGo = st.stage === 'anaphase2' ? 1 - ease(st.u, 0, 0.12) : 0;
    chromatids.forEach((o, i) => {
      const p = st.chromatids[i];
      const show = !!p?.present;
      o.mesh.visible = show;
      o.kineto.visible = show && kinetoO > 0.01;
      if (!p || !show) return;
      if (p.crossed !== o.painted) paint(o, p.crossed);
      (o.mesh.userData as PartData).part = tubePart;
      const sister = st.chromatids[i ^ 1];
      const c = p.centromere;
      tmpDir.set(0, 0, 0);
      if (sister?.present) {
        tmpDir.set(
          sister.centromere[0] - c[0],
          sister.centromere[1] - c[1],
          sister.centromere[2] - c[2],
        );
        if (tmpDir.lengthSq() > 1e-9) tmpDir.normalize();
      }
      const pinch = sister?.present ? (p.joined ? 1 : letGo) : 0;
      o.mesh.position.set(c[0], c[1], c[2]);
      const k = o.key;
      const changed =
        Number.isNaN(k[0]) ||
        turned(k, p.dirA, 0) ||
        turned(k, p.dirB, 3) ||
        Math.abs(m - (k[6] ?? 0)) > SAME_SHARE ||
        Math.abs(threadScale - (k[7] ?? 0)) > SAME_SHARE ||
        Math.abs(pinch - (k[8] ?? 0)) > SAME_SHARE ||
        (pinch > 0 &&
          tmpDir.x * (k[9] ?? 0) + tmpDir.y * (k[10] ?? 0) + tmpDir.z * (k[11] ?? 0) <
            SAME_DIRECTION) ||
        (m === 1 && k[6] !== 1) ||
        (m === 0 && k[6] !== 0);
      if (changed) {
        k[0] = p.dirA[0];
        k[1] = p.dirA[1];
        k[2] = p.dirA[2];
        k[3] = p.dirB[0];
        k[4] = p.dirB[1];
        k[5] = p.dirB[2];
        k[6] = m;
        k[7] = threadScale;
        k[8] = pinch;
        k[9] = tmpDir.x;
        k[10] = tmpDir.y;
        k[11] = tmpDir.z;
        const inp = lineInput;
        inp.dirA[0] = p.dirA[0];
        inp.dirA[1] = p.dirA[1];
        inp.dirA[2] = p.dirA[2];
        inp.dirB[0] = p.dirB[0];
        inp.dirB[1] = p.dirB[1];
        inp.dirB[2] = p.dirB[2];
        inp.towardSister[0] = tmpDir.x;
        inp.towardSister[1] = tmpDir.y;
        inp.towardSister[2] = tmpDir.z;
        inp.thread = o.thread;
        inp.profile = o.profile;
        inp.threadScale = threadScale;
        inp.m = m;
        inp.pinch = pinch;
        writeCentreline(o.info, o.tube.stations, inp, o.centre, o.radii);
        // Sisters still touching: the facing sides are shaded near the centromere.
        const touch = pinch * m;
        contact.towards[0] = tmpDir.x;
        contact.towards[1] = tmpDir.y;
        contact.towards[2] = tmpDir.z;
        contact.strength = CONTACT_SHADE.strength * touch;
        o.tube.write(o.centre, o.radii, touch > 0.05 ? contact : undefined);
      }
      // Kinetochore on the waist. Meiosis I: on the face towards the pole the homologue goes to
      // (both sisters face the same pole); meiosis II: away from its sister (or to its pole).
      if (st.division === 2 && sister?.present && p.joined && tmpDir.lengthSq() > 0)
        tmpDir.negate();
      else tmpDir.set(p.kinetoDir[0], p.kinetoDir[1], p.kinetoDir[2]);
      const r = o.radii[o.tube.centromereRing] ?? ROD_RADIUS;
      const w = o.tube.centromereRing;
      o.kineto.position.set(
        c[0] + (o.centre[3 * w] ?? 0) + tmpDir.x * r,
        c[1] + (o.centre[3 * w + 1] ?? 0) + tmpDir.y * r,
        c[2] + (o.centre[3 * w + 2] ?? 0) + tmpDir.z * r,
      );
      o.kineto.quaternion.setFromUnitVectors(UP, tmpDir);
      o.kineto.scale.set(1, 0.035, 1);
    });

    // Chiasmata: an X between the two inner chromatids at the model's crossover point.
    for (const x of chiasmata) {
      const now = st.chiasmata.find((c) => c.pair === x.pair);
      const a = chromatids[x.a];
      const b = chromatids[x.b];
      const on = !!now && now.weight > 0.01 && !!a && !!b && a.mesh.visible && b.mesh.visible;
      for (const bm of x.bars) bm.visible = on;
      x.ring.visible = on;
      if (!on) continue;
      const r = 0.065 * ILLUSTRATIVE_SCALE * Math.max(0.4, m);
      const [b0, b1] = x.bars;
      const [[a0, b0r], [b1r, a1]] = x.ends;
      if (b0) bar(b0, pointAt(a, a0, tmpA), pointAt(b, b0r, tmpB), r);
      if (b1) bar(b1, pointAt(b, b1r, tmpA), pointAt(a, a1, tmpB), r);
      // The ring: centred between the two chromatids' crossover points (it turns to the camera
      // when drawn).
      pointAt(a, x.at[0], tmpA);
      pointAt(b, x.at[1], tmpB);
      x.centre.addVectors(tmpA, tmpB).multiplyScalar(0.5);
      x.ring.position.copy(x.centre);
      x.ring.scale.setScalar(Math.max(0.4, m));
    }
    const chiasmaOn = Math.min(
      1,
      st.chiasmata.reduce((w, c) => Math.max(w, c.weight), 0),
    );
    setOpacity(mats.chiasma, chiasmaOn);
    setOpacity(mats.chiasmaRing, chiasmaOn);

    // Nuclei.
    envelopes.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.envelope > 0.01;
      if (!n) return;
      e.position.set(...n.center);
      e.scale.setScalar(n.radius);
    });
    const env = st.nuclei.reduce((mx, n) => Math.max(mx, n.envelope), 0);
    const sheet = detail ? envelopeBreakdown(env).shell : env;
    setOpacity(mats.envelope, 0.3 * sheet);
    for (const mt of [mats.envelope.base, mats.envelope.hi, mats.envelope.dim])
      setRimAlpha(mt, 0.45 * sheet);
    innerEnvelopes.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && sheet > 0.01;
      if (!n) return;
      e.position.set(...n.center);
      e.scale.setScalar(0.92 * n.radius);
    });
    if (pores && vesicles) {
      writeEnvelopeParts(
        pores,
        vesicles,
        st.nuclei,
        poreDirs,
        vesicleDirs,
        NUCLEI,
        MEIOSIS.nucleus,
      );
      setOpacity(mats.pore, Math.min(1, sheet * 1.2));
      setOpacity(mats.vesicle, 1);
    }
    nucleoli.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.nucleolus > 0.01;
      if (n) placeNucleolus(e, n);
    });
    setOpacity(
      mats.nucleolus,
      st.nuclei.reduce((mx, n) => Math.max(mx, n.nucleolus), 0),
    );

    centrosomes.forEach((c, i) => {
      const p = st.centrosomes[i];
      c.group.visible = !!p;
      if (p) c.group.position.set(...p);
    });

    writeFibres(spindle, st.fibres, fibreShape.radius, maxFibres);
    setOpacity(mats.spindle, SPINDLE_OPACITY.far * Math.min(1, st.spindle * 1.5));

    membranes.forEach((mm, i) => {
      const sh = st.membranes[i];
      mm.mesh.visible = !!sh;
      mm.ring.visible = !!sh && sh.ring && sh.ringRadius > 0.02;
      if (!sh) return;
      mm.profile.write(sh.offset, sh.radius);
      const e = 1 + sh.elongation;
      mm.mesh.position.set(...sh.center);
      // The profile's axis is local x: meiosis II cells turn it to y (their own spindle).
      mm.mesh.quaternion.copy(sh.axis === 'x' ? IDENTITY : Z_TURN);
      mm.mesh.scale.set(e, 1 / Math.sqrt(e), 1 / Math.sqrt(e));
      mm.ring.position.set(...sh.center);
      mm.ring.quaternion.copy(sh.axis === 'x' ? RING_X : RING_Y);
      mm.ring.scale.setScalar(Math.max(0.001, sh.ringRadius));
    });
    applyLooks(st);
  };
  let lastPoint: Vec3 | null = null;
  const pick = (raycaster: THREE.Raycaster): MeiosisSelection | null => {
    const st = last;
    lastPoint = null;
    if (!st) return null;
    const hits = raycaster.intersectObjects(pickables, false).filter((h) => {
      if (!h.object.visible || !h.object.parent?.visible) return false;
      const mat = (h.object as THREE.Mesh).material as THREE.Material;
      return !(mat.transparent || mat.alphaHash) || mat.opacity > 0.05;
    });
    const partOf = (h: THREE.Intersection) => (h.object.userData as PartData).part;
    const inners = hits.filter((h) => !CONTAINERS.has(partOf(h)));
    const nearest = inners[0];
    const chromosome =
      nearest && partOf(nearest) === 'fibre'
        ? inners.find(
            (h) => CHROMOSOME_PARTS.has(partOf(h)) && h.distance - nearest.distance < FIBRE_SLACK,
          )
        : undefined;
    const inner = chromosome ?? nearest;
    const chosen = inner ?? hits[0];
    lastPoint = chosen ? [chosen.point.x, chosen.point.y, chosen.point.z] : null;
    if (inner) {
      const data = inner.object.userData as PartData;
      const c = data.chromatid !== undefined ? st.chromatids[data.chromatid] : undefined;
      const info = data.chromatid !== undefined ? tl.chromatids[data.chromatid] : undefined;
      const atWaist =
        data.part === 'arm' &&
        !!c &&
        inner.point.distanceTo(tmpA.set(...c.centromere)) < CENTROMERE_PICK;
      switch (atWaist ? 'bead' : data.part) {
        case 'arm':
          if (!c || !info) return null;
          if (c.paired)
            return {
              component: 'bivalent',
              pair: info.pair,
              chromosome: c.chromosome,
              sister: c.sister,
            };
          // A double chromosome is "NST tương đồng" only while its partner is in the same group.
          return {
            component: chromosomePart(c, st.stage),
            chromosome: c.chromosome,
            sister: c.sister,
          };
        case 'bead':
          if (!c) return null;
          return c.joined
            ? { component: 'centromere', chromosome: c.chromosome }
            : { component: 'centromere', chromosome: c.chromosome, sister: c.sister };
        case 'thread':
          return { component: 'chromatin' };
        case 'chiasma':
        case 'chiasmaRing':
          return data.pair === undefined
            ? { component: 'chiasma' }
            : { component: 'chiasma', pair: data.pair };
        case 'fibre':
          return { component: 'spindle' };
        case 'centrosome':
          return { component: 'centrosome' };
        case 'ring':
          return { component: 'cleavageFurrow' };
        case 'nucleolus':
          return { component: 'nucleolus' };
        case 'vesicle':
          return { component: 'nuclearEnvelope' };
        default:
          return null;
      }
    }
    const envelope = hits.find((h) => (h.object.userData as PartData).part === 'envelope');
    if (envelope?.face) {
      const n = envelope.face.normal.clone().transformDirection(envelope.object.matrixWorld);
      return Math.abs(n.dot(raycaster.ray.direction)) < 0.45
        ? { component: 'nuclearEnvelope' }
        : { component: 'nucleus' };
    }
    if (hits.some((h) => (h.object.userData as PartData).part === 'membrane'))
      return { component: 'membrane' };
    return null;
  };

  const onSphere = (c: Vec3, r: number, d: Vec3): Vec3 => {
    const l = Math.hypot(...d) || 1;
    return [c[0] + (r * d[0]) / l, c[1] + (r * d[1]) / l, c[2] + (r * d[2]) / l];
  };
  const ringPoint = (o: ChromatidObjects, k: number): Vec3 => [
    o.mesh.position.x + (o.centre[3 * k] ?? 0),
    o.mesh.position.y + (o.centre[3 * k + 1] ?? 0),
    o.mesh.position.z + (o.centre[3 * k + 2] ?? 0),
  ];
  const labelAnchors = (): MeiosisLabelAnchor[] => {
    const st = last;
    if (!st) return [];
    const out: MeiosisLabelAnchor[] = [];
    const add = (id: MeiosisComponentId, point: Vec3 | null, color: string) => {
      if (point && meiosisPartVisible(id, st)) out.push({ id, point, color });
    };
    // A chromosome: the middle of the first present chromatid's longer arm.
    const firstIdx = st.chromatids.findIndex((c) => c.present);
    const first = chromatids[firstIdx];
    const pose = st.chromatids[firstIdx];
    if (first && pose) {
      const k = Math.max(0, Math.floor(first.tube.centromereRing / 2));
      const id: MeiosisComponentId =
        st.condensation < 0.5 ? 'chromatin' : chromosomePart(pose, st.stage);
      const piece = first.info.before[0]?.origin ?? pose.origin;
      add(id, ringPoint(first, k), originColour[piece]);
    }
    const x = chiasmata[0];
    const b0 = x?.bars[0];
    if (b0?.visible) add('chiasma', [b0.position.x, b0.position.y, b0.position.z], palette.chiasma);
    const cen = st.centromeres[st.centromeres.length - 1];
    if (cen) add('centromere', cen.position, palette.centromere);
    const fibre = st.fibres.find((f) => f.kind === 'polar') ?? st.fibres[0];
    if (fibre)
      add(
        'spindle',
        [
          fibre.from[0] + 0.28 * (fibre.to[0] - fibre.from[0]),
          fibre.from[1] + 0.28 * (fibre.to[1] - fibre.from[1]),
          fibre.from[2] + 0.28 * (fibre.to[2] - fibre.from[2]),
        ],
        palette.spindle,
      );
    add('centrosome', st.centrosomes[st.centrosomes.length - 1] ?? null, palette.centrosome);
    const n0 = st.nuclei[0];
    if (n0) {
      add('nucleus', onSphere(n0.center, n0.radius, [-0.6, 0.65, 0.45]), palette.envelope);
      add('nucleolus', nucleoli[0]?.position.toArray() ?? null, palette.nucleolus);
      if (detail)
        add('nuclearEnvelope', onSphere(n0.center, n0.radius, [0.55, -0.6, 0.6]), palette.envelope);
    }
    const ringed = st.membranes.findIndex((mm) => mm.ring);
    const ring = st.membranes[ringed];
    if (ring) {
      const r = ring.ringRadius;
      add(
        'cleavageFurrow',
        ring.axis === 'x'
          ? [ring.center[0], r * 0.72, r * 0.69]
          : [ring.center[0] + r * 0.72, ring.center[1], r * 0.69],
        palette.ring,
      );
    }
    const mem = st.membranes[st.membranes.length - 1];
    if (mem) {
      const e = 1 + mem.elongation;
      const R = mem.offset + mem.radius;
      add(
        'membrane',
        mem.axis === 'x'
          ? [mem.center[0] - 0.35 * R * e, (0.86 * mem.radius) / Math.sqrt(e), 0.36 * mem.radius]
          : [
              mem.center[0] + (0.86 * mem.radius) / Math.sqrt(e),
              mem.center[1] + 0.35 * R * e,
              0.36 * mem.radius,
            ],
        palette.membrane,
      );
    }
    return out;
  };

  const labelObstacles = (): LabelObstacles => {
    const st = last;
    if (!st) return {};
    // Condensed chromosomes only (counted data); the chromatin thread fills the nucleus.
    const avoid: Hull[] = [];
    if (st.condensation >= 0.5)
      chromatids.forEach((o, i) => {
        if (!st.chromatids[i]?.present || !o.mesh.visible) return;
        const hull = tubeHull(o.mesh.position, o.centre, o.radii);
        if (hull) avoid.push(hull);
      });
    // Separate cells (a furrow, or meiosis II): a leader stays on its own cell's side.
    const cells = st.membranes.flatMap(cellRegions);
    const regions = cells.length > 1 ? cells : [];
    return { avoid, regions };
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
    pickedPoint: () => lastPoint,
    frame: (mode) => meiosisFrame(mode, last),
    labelAnchors,
    labelObstacles,
    stats,
    drawStats: () => drawStats(scene),
    dispose() {
      for (const d of disposables) d.dispose();
      disposables.length = 0;
      pickables.length = 0;
      scene.clear();
      last = null;
    },
  };
}
