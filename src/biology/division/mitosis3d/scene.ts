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
import { glass, roundedBox, setRimAlpha, solid, withTint } from '@/ui/three/materials';
import { withEdgeShade, withRelief } from '@/ui/three/relief';
import { ChromosomeTube, TUBE_SURFACE_ATTRIBUTE } from '../../view3d/primitives/chromosomeTube';
import { centrosomeMaker } from '../division3d/centrosomeMesh';
import { TwoSphereProfile } from '../division3d/membraneMesh';
import { placeNucleolus, writeEnvelopeParts } from '../division3d/nucleusMesh';
import { FIBRE, writeFibres } from '../division3d/spindleMesh';
import { cameraFrame, cellBound, type CameraFrame } from './camera';
import {
  condensedShare,
  threadSamples,
  tubeProfile,
  writeCentreline,
  type CentrelineInput,
  type TubeProfile,
} from './chromatidShape';
import { componentVisible, type CameraMode, type ComponentId, type Selection } from './components';
import { envelopeBreakdown, plateSlots, plateVesicleSize, spherePointsEven } from './sceneParts';
import {
  ANIMAL,
  PLANT,
  ROD_RADIUS,
  ease,
  type ChromatidInfo,
  type Vec3,
  type Mitosis3DState,
  type Timeline,
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
  /** How much solids darken towards their silhouette (a theme token, `withEdgeShade`). */
  edgeShade?: number;
}

export type PickResult = Selection;

/** A part to name on the picture and a point on it (world units). */
export interface LabelAnchor3D {
  id: ComponentId;
  point: Vec3;
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
const CENTROMERE_PICK = 0.26;

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
  const edgeShade = opts.edgeShade ?? 0;
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
  /**
   * Surface relief (illustration, `relief.ts`): fine grain on the chromatids (it stays on each
   * one as it moves) and granules on the nucleolus. Light only — no shape, size or count
   * changes. Small parts only: on the membranes, which fill much of the picture, it cost a
   * quarter more frame time in software rendering for a barely visible ripple.
   */
  const RELIEF = {
    chromatid: { frequency: 11, height: 0.028, attribute: TUBE_SURFACE_ATTRIBUTE },
    nucleolus: { frequency: 7, height: 0.025 },
  } as const;
  const relief =
    <M extends THREE.MeshStandardMaterial>(
      o: (typeof RELIEF)[keyof typeof RELIEF],
      make: (c: string) => M,
    ) =>
    (c: string) =>
      withRelief(make(c), o);
  const firm = (c: string) => solid(c, tier, { roughness: 0.35, clearcoat: 0.3, fades: true });
  const shell =
    (opacity: number, rimAlpha: number, side: THREE.Side = THREE.FrontSide) =>
    (c: string) =>
      glass(c, { opacity, side, rim: { color: c, strength: rimStrength, alpha: rimAlpha } });
  const membraneOpacity = opts.membraneOpacity ?? 0.16;
  /**
   * Chromatid tubes carry their colours per vertex (maternal / paternal, piece by piece): the
   * material is white. Dimmed: the colour mixed halfway towards the stage colour in the shader,
   * the same fade towards the backdrop as the other parts.
   */
  const tubeLook = (): Look<THREE.MeshStandardMaterial> => {
    // The chromosome look: soft sheen, a faint clear coat, fine relief and a light darkening
    // towards the silhouette (a rod, not a flat ribbon); the maternal / paternal colours stay
    // exact as albedo (vertex colours) where the surface faces the viewer.
    const make = () => {
      const m = keep(
        withEdgeShade(
          withRelief(
            solid('#ffffff', tier, { roughness: 0.55, sheen: 0.7, clearcoat: 0.1, fades: true }),
            RELIEF.chromatid,
          ),
          { strength: 0.6 * edgeShade },
        ),
      );
      m.vertexColors = true;
      return m;
    };
    const base = make();
    const hi = make();
    hi.emissive.set(palette.highlight);
    hi.emissiveIntensity = 0.85;
    hi.userData.look = 'hi';
    // Halfway to the stage colour, as the other parts' dimmed looks.
    const dim = withTint(make(), towards, 0.5);
    dim.userData.look = 'dim';
    return { base, hi, dim };
  };
  const mats = {
    tube: tubeLook(),
    bead: look(palette.centromere, firm),
    // One pass for the see-through double-sided parts (one draw call each, not two).
    envelope: look(palette.envelope, shell(0.3, 0.45, THREE.DoubleSide)),
    nucleolus: look(
      palette.nucleolus,
      relief(RELIEF.nucleolus, (c) => solid(c, tier, { roughness: 0.55, sheen: 0.4, fades: true })),
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
    // Fragments of the nuclear envelope, its pores, and the Golgi vesicles of the cell plate.
    vesicle: look(palette.envelope, (c) =>
      solid(c, tier, { roughness: 0.3, clearcoat: 0.4, fades: true }),
    ),
    pore: look(palette.envelope, firm),
    plateVesicle: look(palette.plate, (c) =>
      solid(c, tier, { roughness: 0.3, clearcoat: 0.4, fades: true }),
    ),
  };
  /**
   * The cytoplasm (illustrative): a faint tint on the inside of the cell's far side, so the cell
   * reads as a filled volume. Not a part of its own (never picked or highlighted).
   */
  const cytoplasm = keep(
    new THREE.MeshBasicMaterial({
      color: palette.membrane,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  /** The finer parts (double envelope, pores, vesicles, centriole triplets): High tier only. */
  const detail = tier === 'high';

  // ---- shared geometries
  const sphere = keep(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
  // Kinetochore: a small disc on the outer face of each chromatid's centromere (unit height).
  const kinetoGeo = keep(new THREE.CylinderGeometry(0.085, 0.085, 1, Math.max(10, seg)));
  /**
   * Sides and ring density of a chromatid tube per tier. A big chromosome set (more than 16
   * chromatids: 2n > 8, which the view does not offer but a timeline can hold) gets the lightest
   * tubes, so a playback frame stays cheap however many chromatids move (smoothness first).
   */
  const many = tl.chromatids.length > 16;
  const tubeSides = many ? 6 : tier === 'high' ? 10 : tier === 'medium' ? 8 : 6;
  const rings = many
    ? { ringsPerUnit: 4, tipRings: 3, waistRings: 4 }
    : { ringsPerUnit: 7, tipRings: 6, waistRings: 8 };
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
  spindle.userData = { part: 'fibre' } satisfies PartData;
  spindle.frustumCulled = false;
  scene.add(spindle);
  pickables.push(spindle);

  // ---- cell body
  // Animal membrane: a surface of revolution about the spindle axis whose profile is the
  // union of two circles (one sphere → furrow → two daughter spheres).
  const profile = keep(new TwoSphereProfile(seg));
  const memGeo = profile.geometry;
  const writeProfile = (offset: number, radius: number) => {
    profile.write(offset, radius);
  };
  const membrane = mesh(animal ? memGeo : rounded, mats.membrane.base, { part: 'membrane' });
  // The cytoplasm tint shares the membrane's shape (and follows its furrow), drawn first.
  const inside = new THREE.Mesh(animal ? memGeo : rounded, cytoplasm);
  inside.raycast = () => undefined;
  inside.renderOrder = -0.5;
  membrane.add(inside);
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
  let selection: Selection | null = null;

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
    wall.material = pick(mats.wall, 'wall');
    ring.material = pick(mats.ring, 'ring');
    plate.material = pick(mats.plate, 'plate');
    spindle.material = pick(mats.spindle, 'fibre');
    for (const c of centrosomes) {
      for (const m of c.parts)
        m.material = pick(m === c.halo ? mats.pcm : mats.centriole, 'centrosome');
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
        o.tube.write(o.centre, o.radii);
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

    // Spindle fibres: one tube per fibre (unit cylinder moved, turned and stretched).
    writeFibres(spindle, st.fibres, fibreShape.radius, maxFibres);
    // Fully opaque once assembled (a hashed fade below 1 shows as grain on thin fibres).
    setOpacity(mats.spindle, Math.min(1, st.spindle * 1.5));

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
    const add = (id: ComponentId, point: Vec3 | null) => {
      if (point && componentVisible(id, st)) out.push({ id, point });
    };
    // A chromosome: the middle of the first present chromatid's longer arm.
    const firstIdx = st.chromatids.findIndex((c) => c.present);
    const first = chromatids[firstIdx];
    const pose = st.chromatids[firstIdx];
    if (first && pose) {
      const k = Math.max(0, Math.floor(first.tube.centromereRing / 2));
      const id: ComponentId =
        st.condensation < 0.5 ? 'chromatin' : pose.joined ? 'doubleChromosome' : 'singleChromosome';
      add(id, ringPoint(first, k));
    }
    // A centromere of another chromosome (labels spread over the picture).
    const cen = st.centromeres[st.centromeres.length - 1];
    if (cen) add('centromere', cen.position);
    const fibre = st.fibres.find((f) => f.kind === 'polar') ?? st.fibres[0];
    // A spindle fibre near its pole (clear of the chromosomes in the middle).
    if (fibre)
      add('spindle', [
        fibre.from[0] + 0.28 * (fibre.to[0] - fibre.from[0]),
        fibre.from[1] + 0.28 * (fibre.to[1] - fibre.from[1]),
        fibre.from[2] + 0.28 * (fibre.to[2] - fibre.from[2]),
      ]);
    if (animal) add('centrosome', st.centrosomes[st.centrosomes.length - 1] ?? null);
    const n0 = st.nuclei[0];
    if (n0) {
      add('nucleus', onSphere(n0.center, n0.radius, [-0.6, 0.65, 0.45]));
      add('nucleolus', nucleoli[0]?.position.toArray() ?? null);
      if (detail) add('nuclearEnvelope', onSphere(n0.center, n0.radius, [0.55, -0.6, 0.6]));
    }
    const sh = st.shape;
    if (sh.type === 'animal') {
      if (sh.ring) add('cleavageFurrow', [0, sh.ringRadius * 0.72, sh.ringRadius * 0.69]);
      const e = 1 + sh.elongation;
      add('membrane', [
        -0.35 * ANIMAL.radius * e,
        (0.86 * ANIMAL.radius) / Math.sqrt(e),
        0.36 * ANIMAL.radius,
      ]);
    } else {
      const [px, py, pz] = PLANT.half;
      if (sh.plate > 0.001)
        add('cellPlate', [
          0,
          Math.min(sh.plateRadius, py) * 0.62,
          Math.min(sh.plateRadius, pz) * 0.5,
        ]);
      add('membrane', [-0.45 * px, 0.98 * py, 0.4 * pz]);
      add('cellWall', [px + PLANT.wall, -0.35 * py, 0.45 * pz]);
    }
    return out;
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
