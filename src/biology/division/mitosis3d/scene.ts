/**
 * three.js scene of the 3D mitosis view. Built ONCE per timeline (cell type × 2n): shared
 * geometries and materials, one set of meshes per chromatid, nothing allocated per frame —
 * `update(state)` only moves, scales, re-colours and shows/hides existing objects (the animal
 * membrane and the spindle write into their existing buffers). `dispose()` frees every
 * geometry, material and texture it created. Rendering (renderer, camera, controls) lives in the
 * view.
 *
 * Look (shared with meiosis, `../division3d/looks.ts`): environment-lit physical materials and a
 * key/fill/rim light rig, see-through shells outlined by a Fresnel rim over a faint lit back face
 * (the cell's volume), a membrane that undulates a little (always inwards), solid parts that fade
 * with alphaHash (they never blend or sort against the glass), light see-through spindle fibres
 * fading towards the poles (an InstancedMesh on the FX layer), chromatids shaded where sisters
 * touch, a soft contact shadow under the cell. In metaphase a faint dashed ring marks the
 * (imaginary) equatorial plane. A picked part glows in the highlight colour while the other parts
 * are dimmed.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { drawStats, type DrawStats } from '@/ui/three/drawStats';
import { LAYER } from '@/ui/three/layers';
import { contactShadow, disposeLightRig, lightRig } from '@/ui/three/lighting';
import type { Hull, LabelObstacles } from '@/ui/three/labelLayer';
import { roundedBox, setRimAlpha } from '@/ui/three/materials';
import { ChromosomeTube } from '../../view3d/primitives/chromosomeTube';
import { centrosomeMaker } from '../division3d/centrosomeMesh';
import { ILLUSTRATIVE_SCALE } from '../division3d/dimensions';
import { dashedRing } from '../division3d/guides';
import {
  SPINDLE_OPACITY,
  divisionLooks,
  setLookOpacity,
  type DivisionPalette,
  type Look,
} from '../division3d/looks';
import { cellRegions, tubeHull } from '../division3d/labelObstacles';
import { TwoSphereProfile } from '../division3d/membraneMesh';
import { placeNucleolus, writeEnvelopeParts } from '../division3d/nucleusMesh';
import { FIBRE, fibreGeometry, writeFibres } from '../division3d/spindleMesh';
import { CONTACT_SHADE, KINETOCHORE_RADIUS, tubeDetail } from '../division3d/tubes';
import { cameraFrame, cellBound, type CameraFrame } from './camera';
import {
  condensedShare,
  threadSamples,
  tubeProfile,
  writeCentreline,
  type CentrelineInput,
  type TubeProfile,
} from './chromatidShape';
import {
  componentVisible,
  type CameraMode,
  type ComponentId,
  type LabelId,
  type Selection,
} from './components';
import { envelopeBreakdown, plateSlots, plateVesicleSize, spherePointsEven } from './sceneParts';
import {
  ANIMAL,
  PLANT,
  ROD_RADIUS,
  ease,
  type ChromatidInfo,
  type Vec3,
  type CellType,
  type Mitosis3DState,
  type Timeline,
} from './timeline';

/** CSS colour strings (read from theme tokens by the view). */
export interface ScenePalette extends DivisionPalette {
  maternal: string;
  paternal: string;
  wall: string;
  plate: string;
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
  /** How much solids darken towards their silhouette (a theme token, `withEdgeShade`). */
  edgeShade?: number;
  /** Darker outline of see-through shells (a theme token: on in light, 0 in dark). */
  shellInk?: number;
  /** HDR path (High tier on a discrete GPU): glowing centrosome cores, the wall's fibres. */
  hdr?: boolean;
  /** Fill and rim lights, the cell's lit back face, clear coat (off with software WebGL). */
  accents?: boolean;
}

export type PickResult = Selection;

/** A part (or the metaphase guide) to name on the picture, a point on it and its colour. */
export interface LabelAnchor3D {
  id: LabelId;
  point: Vec3;
  /** The part's colour (the label's anchor ring). */
  color: string;
}
export type { CameraFrame, CameraMode, Selection };
/** Moved to the generic 3D kit (`@/ui/three/drawStats`); re-exported for existing imports. */
export { drawStats, type DrawStats };

export interface MitosisScene {
  scene: THREE.Scene;
  update(state: Mitosis3DState): void;
  setSelection(sel: Selection | null): void;
  /** The cell part under a ray (inner parts win over the membranes they sit in). */
  pick(raycaster: THREE.Raycaster): PickResult | null;
  /** Where the last `pick` ray met the part it picked (null when it picked nothing). */
  pickedPoint(): Vec3 | null;
  /** Some chromatids still wait for their new shape: update again with the same state. */
  pending(): boolean;
  /** Box to frame with the camera: the whole cell (after division too), or the chromosomes now. */
  frame(mode: CameraMode): CameraFrame;
  /**
   * Points of the parts that can be named at this moment, most important first (one per part:
   * a chromosome, a centromere, the spindle…), for the name labels.
   */
  labelAnchors(): LabelAnchor3D[];
  /** What the name labels keep clear of: the chromosomes, and each daughter cell (world space). */
  labelObstacles(): LabelObstacles;
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
  | 'vesicle'
  | 'pore'
  | 'membrane'
  | 'wall';

interface PartData {
  part: Part;
  chromatid?: number;
}

const CONTAINERS: ReadonlySet<Part> = new Set(['envelope', 'membrane', 'wall']);

/** Parts of a chromosome, and how far behind a fibre one may be and still be picked. */
const CHROMOSOME_PARTS: ReadonlySet<Part> = new Set(['arm', 'bead', 'thread']);
const FIBRE_SLACK = 0.35;

/**
 * A tube is rewritten only when its shape changes by more than can be seen: an arm turning by
 * more than about 0.4° (cosine), or a share (condensation, pinch, scale) changing by more than
 * 0.2 %. Settled poses are always drawn exactly.
 */
const SAME_DIRECTION = 0.999975;
const SAME_SHARE = 0.002;
/** Most tube rewrites in one update (every chromatid of the sets the view offers: 2n ≤ 8). */
const WRITE_BUDGET = 24;

/** A click this close to a condensed chromatid's centromere picks the centromere. */
const CENTROMERE_PICK = 0.26 * ILLUSTRATIVE_SCALE;

/** Depth of the membrane's undulation (share of its radius; illustrative, always inwards). */
const MEMBRANE_WAVE = 0.015;

/** The dashed equatorial-plate ring: radius (inside the cell, around the plate) and opacity. */
const GUIDE_RADIUS: Record<CellType, number> = {
  animal: 0.9 * ANIMAL.radius,
  plant: 0.92 * Math.min(PLANT.half[1], PLANT.half[2]),
};
const GUIDE_OPACITY = 0.6;

export function buildMitosisScene(
  tl: Timeline,
  palette: ScenePalette,
  opts: SceneOptions,
): MitosisScene {
  const seg = Math.max(8, Math.round(opts.segments));
  const tier: QualityTier = opts.tier ?? (seg >= 24 ? 'high' : seg >= 16 ? 'medium' : 'low');
  const rimStrength = opts.rimStrength ?? 0.7;
  const edgeShade = opts.edgeShade ?? 0;
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const animal = tl.cellType === 'animal';

  // Lights (no shadow maps: a soft contact shadow grounds the cell instead).
  const rig = lightRig({ size: 12, accents: opts.accents ?? true });
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

  // ---- materials (shared with meiosis: `../division3d/looks.ts`)
  const hdr = opts.hdr ?? false;
  const mats = divisionLooks(
    palette,
    {
      tier,
      membraneOpacity: opts.membraneOpacity ?? 0.16,
      rimStrength,
      edgeShade,
      shellInk: opts.shellInk ?? 0,
      hdr,
      plant: !animal,
      accents: opts.accents ?? true,
    },
    keep,
  );
  /** The finer parts (double envelope, pores, vesicles, centriole triplets): High tier only. */
  const detail = tier === 'high';

  // ---- shared geometries
  const sphere = keep(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
  // Kinetochore: a small disc on the outer face of each chromatid's centromere (unit height).
  const kinetoGeo = keep(
    new THREE.CylinderGeometry(KINETOCHORE_RADIUS, KINETOCHORE_RADIUS, 1, Math.max(10, seg)),
  );
  const { sides: tubeSides, ...rings } = tubeDetail(tier, tl.chromatids.length);
  const centrioleGeo = keep(
    new THREE.CylinderGeometry(0.1, 0.1, 0.42, Math.max(8, seg / 2), 1, true),
  );
  const torus = keep(new THREE.TorusGeometry(1, 0.06, 8, seg * 3));
  // Plant cell: a box with rounded edges (the wall's outline comes from the rim light).
  const rounded = keep(roundedBox(seg * 2, 10));
  const disc = keep(new THREE.CylinderGeometry(1, 1, 0.12, seg * 2));
  // Small parts drawn by the dozen: few triangles each (48 and 80).
  const poreGeo = keep(new THREE.TorusGeometry(0.075, 0.022, 3, 8));
  const blob = keep(new THREE.IcosahedronGeometry(1, 1));
  const tubuleGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true));
  const fibreShape = FIBRE[tier];
  // Unit fibre: radius 1, height 1 along +y (scaled per fibre), open ends, fading to its pole.
  const fibreGeo = keep(
    fibreGeometry(fibreShape.sides, SPINDLE_OPACITY.pole / SPINDLE_OPACITY.far),
  );
  // The imaginary equatorial plate (metaphase): a dashed ring, scaled to the cell.
  const guideGeo = keep(dashedRing(0.008));

  const pickables: THREE.Object3D[] = [];
  const mesh = <M extends THREE.Material>(geo: THREE.BufferGeometry, mat: M, data: PartData) => {
    const m = new THREE.Mesh(geo, mat);
    m.userData = data;
    scene.add(m);
    pickables.push(m);
    return m;
  };

  // ---- chromatids: one tube each (thread ↔ rod in place) and its kinetochore
  interface ChromatidObjects {
    info: ChromatidInfo;
    tube: ChromosomeTube;
    mesh: THREE.Mesh;
    kineto: THREE.Mesh;
    /** Thread samples and radius profile at the tube's rings (static); line / radii per update. */
    thread: Float32Array;
    profile: TubeProfile;
    centre: Float32Array;
    radii: Float32Array;
    /** Shape inputs of the last write: arm directions, shares, towards the sister. */
    key: Float64Array;
  }
  const originColour = { M: palette.maternal, P: palette.paternal };
  /** The model's G2 cell: every chromosome with both sister chromatids (DNA molecules). */
  const g2 = tl.model.find((m) => m.stage === 'g2')?.cells[0];
  const chromatids: ChromatidObjects[] = tl.chromatids.map((info, id) => {
    const tube = new ChromosomeTube({
      armA: info.armA,
      armB: info.armB,
      radius: ROD_RADIUS,
      sides: tubeSides,
      ...rings,
    });
    keep(tube);
    // Painted from the model's own DNA molecule, piece by piece (in mitosis one piece: no
    // crossing over), in the colour of each piece's origin.
    const segments = g2?.chromosomes[info.chromosome]?.chromatids[info.sister] ?? [
      { from: 0, to: 1, origin: info.origin },
    ];
    tube.setColours(
      segments.map((g) => ({ from: g.from, to: g.to, color: originColour[g.origin] })),
    );
    const m = mesh(tube.geometry, mats.tube.base, { part: 'thread', chromatid: id });
    m.frustumCulled = false;
    return {
      info,
      tube,
      mesh: m,
      kineto: mesh(kinetoGeo, mats.bead.base, { part: 'bead', chromatid: id }),
      thread: threadSamples(info, tube.stations),
      profile: tubeProfile(info, tube.stations),
      centre: new Float32Array(tube.rings * 3),
      radii: new Float32Array(tube.rings),
      key: new Float64Array(12).fill(Number.NaN),
    };
  });

  // ---- nuclei (at most two), each with a simple nucleolus (illustrative, no effect on counts)
  const envelopes = [0, 1].map(() => mesh(sphere, mats.envelope.base, { part: 'envelope' }));
  const nucleoli = [0, 1].map(() => mesh(sphere, mats.nucleolus.base, { part: 'nucleolus' }));
  // High: the envelope is a double membrane (an inner shell too) with pores, and it breaks into
  // vesicles in prophase (re-forming in telophase) instead of fading as one sheet.
  const innerEnvelopes = detail
    ? [0, 1].map(() => mesh(sphere, mats.envelope.base, { part: 'envelope' }))
    : [];
  const PORES = 32;
  const VESICLES = 40;
  const poreDirs = spherePointsEven(PORES);
  const vesicleDirs = spherePointsEven(VESICLES);
  const pores = detail ? new THREE.InstancedMesh(poreGeo, mats.pore.base, 2 * PORES) : null;
  const vesicles = detail ? new THREE.InstancedMesh(blob, mats.vesicle.base, 2 * VESICLES) : null;
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
    // Pores belong to the envelope; they are not picked on their own (the envelope is).
    pores.userData = { part: 'pore' } satisfies PartData;
    pores.raycast = () => undefined;
  }
  if (vesicles) {
    vesicles.userData = { part: 'vesicle' } satisfies PartData;
    pickables.push(vesicles);
  }

  // ---- centrosomes (animal): two centrioles at right angles + pericentriolar material
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
  const centrosomes = [0, 1].map(() => {
    const c = makeCentrosome();
    for (const m of c.parts) {
      m.userData = { part: 'centrosome' } satisfies PartData;
      pickables.push(m);
    }
    scene.add(c.group);
    return c;
  });

  // ---- spindle: thin tubes, one InstancedMesh sized for the most fibres the timeline can have
  const maxFibres = 12 + 16 + 2 * tl.chromatids.length;
  const spindle = new THREE.InstancedMesh(fibreGeo, mats.spindle.base, maxFibres);
  spindle.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spindle.count = 0;
  // See-through fibres: blended after the cytoplasm, before the membrane's front face, and kept
  // out of ambient occlusion (FX layer).
  spindle.userData = { part: 'fibre', layer: LAYER.FX };
  spindle.renderOrder = -0.25;
  spindle.frustumCulled = false;
  scene.add(spindle);
  pickables.push(spindle);

  // ---- cell body
  // Animal membrane: a surface of revolution about the spindle axis whose profile is the
  // union of two circles (one sphere → furrow → two daughter spheres).
  const profile = keep(new TwoSphereProfile(seg, { amplitude: MEMBRANE_WAVE, seed: 7 }));
  const memGeo = profile.geometry;
  const writeProfile = (offset: number, radius: number) => {
    profile.write(offset, radius);
  };
  const membrane = mesh(animal ? memGeo : rounded, mats.membrane.base, { part: 'membrane' });
  // The cell's volume: the membrane's lit back face (follows its furrow), drawn first.
  const inside = new THREE.Mesh(animal ? memGeo : rounded, mats.cytoplasm.base);
  inside.raycast = () => undefined;
  inside.renderOrder = -0.5;
  membrane.add(inside);
  if (animal) writeProfile(0, ANIMAL.radius);
  const ring = mesh(torus, mats.ring.base, { part: 'ring' });
  ring.rotation.y = Math.PI / 2; // axis along x
  const wall = mesh(rounded, mats.wall.base, { part: 'wall' });
  const plate = mesh(disc, mats.plate.base, { part: 'plate' });
  plate.rotation.z = Math.PI / 2; // disc normal along x
  // The equatorial plate guide: never picked, on the FX layer (no occlusion), shown in metaphase.
  const guide = new THREE.Mesh(guideGeo, mats.guide);
  guide.userData = { layer: LAYER.FX };
  guide.raycast = () => undefined;
  guide.renderOrder = -0.2;
  guide.visible = false;
  guide.scale.setScalar(GUIDE_RADIUS[tl.cellType]);
  scene.add(guide);
  // The cell plate grows as a disc and is clipped by the side walls (needs
  // renderer.localClippingEnabled; without it the disc simply shows unclipped).
  const [hx, hy, hz] = PLANT.half;
  const clip = [
    new THREE.Plane(new THREE.Vector3(0, -1, 0), hy),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), hy),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), hz),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), hz),
  ];
  // Golgi vesicles gather just beyond the growing plate's edge and fuse into it (plant only).
  const slots = animal
    ? []
    : plateSlots(detail ? 90 : 50, Math.hypot(PLANT.half[1], PLANT.half[2]), hy - 0.15, hz - 0.15);
  const plateVesicles = slots.length
    ? new THREE.InstancedMesh(blob, mats.plateVesicle.base, slots.length)
    : null;
  if (plateVesicles) {
    plateVesicles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    plateVesicles.count = 0;
    plateVesicles.frustumCulled = false;
    plateVesicles.userData = { part: 'plate' } satisfies PartData;
    scene.add(plateVesicles);
    pickables.push(plateVesicles);
    keep({
      dispose: () => {
        plateVesicles.dispose();
      },
    });
  }
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
  const IDENTITY_Q = new THREE.Quaternion();
  const tmpDir = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();
  let last: Mitosis3DState | null = null;
  /** Tubes whose new shape waits for the next update (a big set over its writing budget). */
  let pendingWrites = false;
  let writeCursor = 0;
  /** The direction `d` turned away from the one stored at `k[at…at+2]` by more than can be seen. */
  const turned = (k: Float64Array, d: Vec3, at: number) =>
    d[0] * (k[at] ?? 0) + d[1] * (k[at + 1] ?? 0) + d[2] * (k[at + 2] ?? 0) < SAME_DIRECTION;
  /** Inputs of one tube write, reused for every chromatid (no allocation per frame). */
  const lineInput: CentrelineInput = {
    // Tubes are written around their centromere (the mesh is moved there).
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
  let selection: Selection | null = null;

  const setOpacity = setLookOpacity;

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
      const d = (m: THREE.Object3D) => m.userData as PartData;
      o.mesh.material = choose(mats.tube, d(o.mesh), st);
      o.kineto.material = choose(mats.bead, d(o.kineto), st);
    }
    const pick = <M extends THREE.Material>(l: Look<M>, part: Part) => choose(l, { part }, st);
    for (const e of envelopes) e.material = pick(mats.envelope, 'envelope');
    for (const e of innerEnvelopes) e.material = pick(mats.envelope, 'envelope');
    if (pores) pores.material = pick(mats.pore, 'pore');
    if (vesicles) vesicles.material = pick(mats.vesicle, 'vesicle');
    if (plateVesicles) plateVesicles.material = pick(mats.plateVesicle, 'plate');
    for (const e of nucleoli) e.material = pick(mats.nucleolus, 'nucleolus');
    membrane.material = pick(mats.membrane, 'membrane');
    inside.material = pick(mats.cytoplasm, 'membrane');
    wall.material = pick(mats.wall, 'wall');
    ring.material = pick(mats.ring, 'ring');
    plate.material = pick(mats.plate, 'plate');
    spindle.material = pick(mats.spindle, 'fibre');
    for (const c of centrosomes) {
      for (const m of c.parts)
        m.material = pick(
          m === c.halo ? mats.pcm : m === c.core ? mats.core : mats.centriole,
          'centrosome',
        );
    }
  };

  const update = (st: Mitosis3DState) => {
    last = st;
    // Chromatids: one line from thread to rod (condensation), kinetochores once condensed.
    const m = condensedShare(st.condensation);
    const tubePart: Part = st.condensation < 0.5 ? 'thread' : 'arm';
    const kinetoO = ease(st.condensation, 0.4, 0.7);
    setOpacity(mats.bead, kinetoO);
    const late = st.stage === 'telophase' || st.stage === 'cytokinesis';
    const nucleusR = animal ? ANIMAL.nucleus : PLANT.nucleus;
    const telR = animal ? ANIMAL.telNucleusR : PLANT.telNucleusR;
    const threadScale = 0.75 * (late ? telR / nucleusR : 1);
    // Joined sisters touch at the centromere; after the split the pinch lets go early in anaphase.
    const letGo = st.stage === 'anaphase' ? 1 - ease(st.u, 0, 0.12) : 0;
    let writes = 0;
    pendingWrites = false;
    const count = chromatids.length;
    for (let step = 0; step < count; step++) {
      const i = (writeCursor + step) % count;
      const o = chromatids[i];
      if (!o) continue;
      const p = st.chromatids[i];
      const show = !!p?.present;
      o.mesh.visible = show;
      o.kineto.visible = show && kinetoO > 0.01;
      if (!p || !show) continue;
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
      // The tube is written around its centromere (local coordinates) and moved there: a
      // chromatid that only moves is never rewritten. Its shape is rewritten when it changes by
      // more than can be seen (a fraction of a degree, a fraction of a percent).
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
        // A settled pose is drawn exactly.
        (m === 1 && k[6] !== 1) ||
        (m === 0 && k[6] !== 0);
      // At most WRITE_BUDGET tubes per update, taken in turn (a big set spreads its rewrites
      // over a few frames; the view keeps updating until none is left).
      if (changed && writes >= WRITE_BUDGET) pendingWrites = true;
      if (changed && writes < WRITE_BUDGET) {
        writes++;
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
      // Kinetochore on the waist's outer face (away from the sister, or towards its pole).
      if (sister?.present && tmpDir.lengthSq() > 0) tmpDir.negate();
      else tmpDir.set(p.side, 0, 0);
      const r = o.radii[o.tube.centromereRing] ?? ROD_RADIUS;
      const w = o.tube.centromereRing;
      o.kineto.position.set(
        c[0] + (o.centre[3 * w] ?? 0) + tmpDir.x * r,
        c[1] + (o.centre[3 * w + 1] ?? 0) + tmpDir.y * r,
        c[2] + (o.centre[3 * w + 2] ?? 0) + tmpDir.z * r,
      );
      o.kineto.quaternion.setFromUnitVectors(UP, tmpDir);
      o.kineto.scale.set(1, 0.035, 1);
    }
    // The next update starts where this one's writing budget ran out.
    if (pendingWrites) writeCursor = (writeCursor + WRITE_BUDGET) % Math.max(1, count);

    envelopes.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.envelope > 0.01;
      if (!n) return;
      e.position.set(...n.center);
      e.scale.setScalar(n.radius);
    });
    const env = st.nuclei.reduce((m, n) => Math.max(m, n.envelope), 0);
    // High: the sheet goes first and its vesicles carry on; Medium: the sheet fades as one.
    const sheet = detail ? envelopeBreakdown(env).shell : env;
    setOpacity(mats.envelope, 0.3 * sheet);
    for (const m of [mats.envelope.base, mats.envelope.hi, mats.envelope.dim])
      setRimAlpha(m, 0.45 * sheet);
    innerEnvelopes.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && sheet > 0.01;
      if (!n) return;
      e.position.set(...n.center);
      e.scale.setScalar(0.92 * n.radius);
    });
    if (pores && vesicles) {
      writeEnvelopeParts(pores, vesicles, st.nuclei, poreDirs, vesicleDirs, 2, ANIMAL.nucleus);
      setOpacity(mats.pore, Math.min(1, sheet * 1.2));
      setOpacity(mats.vesicle, 1);
    }
    nucleoli.forEach((e, i) => {
      const n = st.nuclei[i];
      e.visible = !!n && n.nucleolus > 0.01;
      if (n) placeNucleolus(e, n);
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

    // Spindle fibres: one tube per fibre (unit cylinder moved, turned and stretched); light and
    // see-through once assembled.
    writeFibres(spindle, st.fibres, fibreShape.radius, maxFibres);
    setOpacity(mats.spindle, SPINDLE_OPACITY.far * Math.min(1, st.spindle * 1.5));

    // The imaginary equatorial plate: in metaphase, while the chromosomes line up on it.
    const guideOn = st.stage === 'metaphase' ? Math.min(1, st.u / 0.3) : 0;
    guide.visible = guideOn > 0.01;
    mats.guide.opacity = GUIDE_OPACITY * guideOn;

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
      if (plateVesicles) {
        const growing = sh.plate > 0.001 && sh.plate < 0.999;
        let nv = 0;
        for (const slot of slots) {
          const size = plateVesicleSize(slot.r, sh.plateRadius, growing);
          if (size < 0.02) continue;
          tmpPos.set(slot.x, slot.y, slot.z);
          tmpScale.setScalar(0.16 * size);
          plateVesicles.setMatrixAt(nv++, tmpMat.compose(tmpPos, IDENTITY_Q, tmpScale));
        }
        plateVesicles.count = nv;
        plateVesicles.visible = nv > 0;
        plateVesicles.instanceMatrix.needsUpdate = true;
        plateVesicles.boundingSphere = null;
      }
    }
    applyLooks(st);
  };

  let lastPoint: Vec3 | null = null;
  const pick = (raycaster: THREE.Raycaster): PickResult | null => {
    const st = last;
    lastPoint = null;
    if (!st) return null;
    const hits = raycaster.intersectObjects(pickables, false).filter((h) => {
      if (!h.object.visible || !h.object.parent?.visible) return false;
      const mat = (h.object as THREE.Mesh).material as THREE.Material;
      // Faded out (blended or alphaHash): not there to be picked.
      return !(mat.transparent || mat.alphaHash) || mat.opacity > 0.05;
    });
    const partOf = (h: THREE.Intersection) => (h.object.userData as PartData).part;
    const inners = hits.filter((h) => !CONTAINERS.has(partOf(h)));
    const nearest = inners[0];
    // A spindle fibre ends at each centromere: a chromosome just behind a thin fibre wins.
    const chromosome =
      nearest && partOf(nearest) === 'fibre'
        ? inners.find(
            (h) => CHROMOSOME_PARTS.has(partOf(h)) && h.distance - nearest.distance < FIBRE_SLACK,
          )
        : undefined;
    const inner = chromosome ?? nearest;
    // Where the ray met the part that is picked (the camera can turn to it).
    const chosen = inner ?? hits[0];
    lastPoint = chosen ? [chosen.point.x, chosen.point.y, chosen.point.z] : null;
    if (inner) {
      const data = inner.object.userData as PartData;
      const c = data.chromatid !== undefined ? st.chromatids[data.chromatid] : undefined;
      // The waist of a condensed chromatid is its centromere.
      const atWaist =
        data.part === 'arm' &&
        !!c &&
        inner.point.distanceTo(tmpPos.set(...c.centromere)) < CENTROMERE_PICK;
      switch (atWaist ? 'bead' : data.part) {
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
        case 'vesicle':
          return { component: 'nuclearEnvelope' };
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

  /** A point on the surface of a sphere (centre, radius) in a direction (normalised here). */
  const onSphere = (c: Vec3, r: number, d: Vec3): Vec3 => {
    const l = Math.hypot(...d) || 1;
    return [c[0] + (r * d[0]) / l, c[1] + (r * d[1]) / l, c[2] + (r * d[2]) / l];
  };
  /** Centre-line point of a chromatid's tube at ring `k`. */
  const ringPoint = (o: ChromatidObjects, k: number): Vec3 => [
    o.mesh.position.x + (o.centre[3 * k] ?? 0),
    o.mesh.position.y + (o.centre[3 * k + 1] ?? 0),
    o.mesh.position.z + (o.centre[3 * k + 2] ?? 0),
  ];
  const labelAnchors = (): LabelAnchor3D[] => {
    const st = last;
    if (!st) return [];
    const out: LabelAnchor3D[] = [];
    const add = (id: ComponentId, point: Vec3 | null, color: string) => {
      if (point && componentVisible(id, st)) out.push({ id, point, color });
    };
    // A chromosome: the middle of the first present chromatid's longer arm.
    const firstIdx = st.chromatids.findIndex((c) => c.present);
    const first = chromatids[firstIdx];
    const pose = st.chromatids[firstIdx];
    if (first && pose) {
      const k = Math.max(0, Math.floor(first.tube.centromereRing / 2));
      const id: ComponentId =
        st.condensation < 0.5 ? 'chromatin' : pose.joined ? 'doubleChromosome' : 'singleChromosome';
      add(id, ringPoint(first, k), originColour[pose.origin]);
    }
    // A centromere of another chromosome (labels spread over the picture).
    const cen = st.centromeres[st.centromeres.length - 1];
    if (cen) add('centromere', cen.position, palette.centromere);
    // The imaginary equatorial plate, while its ring is drawn (metaphase).
    if (guide.visible) {
      const r = GUIDE_RADIUS[tl.cellType];
      out.push({
        id: 'equator',
        point: [0, 0.74 * r, 0.67 * r],
        color: palette.guide ?? palette.spindle,
      });
    }
    const fibre = st.fibres.find((f) => f.kind === 'polar') ?? st.fibres[0];
    // A spindle fibre near its pole (clear of the chromosomes in the middle).
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
    if (animal)
      add('centrosome', st.centrosomes[st.centrosomes.length - 1] ?? null, palette.centrosome);
    const n0 = st.nuclei[0];
    if (n0) {
      add('nucleus', onSphere(n0.center, n0.radius, [-0.6, 0.65, 0.45]), palette.envelope);
      add('nucleolus', nucleoli[0]?.position.toArray() ?? null, palette.nucleolus);
      if (detail)
        add('nuclearEnvelope', onSphere(n0.center, n0.radius, [0.55, -0.6, 0.6]), palette.envelope);
    }
    const sh = st.shape;
    if (sh.type === 'animal') {
      if (sh.ring)
        add('cleavageFurrow', [0, sh.ringRadius * 0.72, sh.ringRadius * 0.69], palette.ring);
      const e = 1 + sh.elongation;
      add(
        'membrane',
        [-0.35 * ANIMAL.radius * e, (0.86 * ANIMAL.radius) / Math.sqrt(e), 0.36 * ANIMAL.radius],
        palette.membrane,
      );
    } else {
      const [px, py, pz] = PLANT.half;
      if (sh.plate > 0.001)
        add(
          'cellPlate',
          [0, Math.min(sh.plateRadius, py) * 0.62, Math.min(sh.plateRadius, pz) * 0.5],
          palette.plate,
        );
      add('membrane', [-0.45 * px, 0.98 * py, 0.4 * pz], palette.membrane);
      add('cellWall', [px + PLANT.wall, -0.35 * py, 0.45 * pz], palette.wall);
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
    // The animal cell's daughters once its furrow shows: a leader stays on its own cell's side.
    const sh = st.shape;
    const cells = sh.type === 'animal' ? cellRegions({ ...sh, center: [0, 0, 0], axis: 'x' }) : [];
    return { avoid, regions: cells.length > 1 ? cells : [] };
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
    labelAnchors,
    labelObstacles,
    pickedPoint: () => lastPoint,
    pending: () => pendingWrites,
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
