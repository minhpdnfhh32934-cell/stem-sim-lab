/**
 * Meiosis in 3D — a pure, deterministic timeline (no three.js, no DOM). Animal germ cell only.
 *
 * What is EXACT: the chromosome bookkeeping. Every chromosome and chromatid shown comes from
 * `runDivision('meiosis', pairs, opts)` (division.ts) with the lesson's own options
 * (`meiosisOptions`: the metaphase I orientation of every pair and the crossover of pair 1), so
 * the 2D picture and the 3D view show the same run. Counts of each stage are read from that model;
 * each chromatid is painted from the model's DNA pieces (maternal / paternal), so a recombinant
 * chromatid shows exactly the exchanged piece; which pole each homologue faces in metaphase I is
 * the model's `orientation`; the chiasma sits at the model's crossover point.
 * What is ILLUSTRATIVE: sizes, shapes and positions (not to scale), the shape of the chiasma, the
 * spindle geometry, stage timing and the length of the pause between the two divisions.
 *
 * Coordinates: the spindle of meiosis I is along x (poles at −x and +x), y is up. Daughter cell 0
 * of meiosis I is at −x, cell 1 at +x. In meiosis II each cell has its own spindle at a right
 * angle to the first one: along y (a cell's "local" frame is the world turned by 90° about z, so
 * its local x is the world y). Sister chromatid 0 goes to the −y pole, sister 1 to the +y pole,
 * so the four final cells are, in the model's order: (cell 0, −y), (cell 0, +y), (cell 1, −y),
 * (cell 1, +y) — exactly `runDivision`'s telophase II cells [a1, b1, a2, b2].
 *
 * `stateAt(t)` is continuous in t. Discrete changes happen only at stage boundaries (positions
 * stay continuous across them), or are events of the model:
 *  - g1 → g2 (S phase, not its own step, as in the mitosis view): sister chromatids and the
 *    second centrosome exist from the start of G2;
 *  - prophase I: the crossing over (the model's prophase I) happens once the homologues are
 *    paired; from then on the inner chromatids carry the exchanged pieces;
 *  - metaphase II → anaphase II: every centromere splits;
 *  - cytokinesis I → prophase II: each cell has two centrosomes for its own spindle (drawing
 *    simplified, see the 3D card). There is NO replication here: the chromatids stay the same.
 */
import { rng } from '../../genetics/stats';
import {
  gameteSignature,
  runDivision,
  type Cell,
  type MeiosisOptions,
  type Origin,
  type Segment,
  type StageId,
  type StageState,
} from '../division';
import { stageClock, type StageWindow } from '../division3d/clock';
import { countsFromModel } from '../division3d/counts';
import { ROD_RADIUS, SISTER_OFFSET, SPLAY, pairLength } from '../division3d/dimensions';
import type { ChromatidShapeInfo } from '../division3d/chromatidShape';
import {
  X,
  add,
  basis,
  cross,
  dot,
  ease,
  len,
  lerp,
  lerpV,
  mul,
  norm,
  randomInBall,
  randomUnit,
  sub,
  v3,
  type Vec3,
} from '../division3d/math';
import { plateLayout } from '../division3d/plate';
import type {
  CentromereState,
  ChromatidPose,
  Counts3D,
  Fibre,
  GeometricCell,
  NucleusState,
} from '../division3d/types';

export type { Vec3 };
export { ROD_RADIUS, SISTER_OFFSET };

export type MeiosisStage3D =
  | 'g1'
  | 'g2'
  | 'prophase1'
  | 'metaphase1'
  | 'anaphase1'
  | 'telophase1'
  | 'cytokinesis1'
  | 'prophase2'
  | 'metaphase2'
  | 'anaphase2'
  | 'telophase2'
  | 'cytokinesis2';

export const MEIOSIS_STAGES_3D: readonly MeiosisStage3D[] = [
  'g1',
  'g2',
  'prophase1',
  'metaphase1',
  'anaphase1',
  'telophase1',
  'cytokinesis1',
  'prophase2',
  'metaphase2',
  'anaphase2',
  'telophase2',
  'cytokinesis2',
];

/**
 * Seconds per stage at 1× speed (illustrative; prophase I is drawn longer because pairing and
 * crossing over happen in it; real stages take hours to days, and the pause between the two
 * divisions varies by species).
 */
export const STAGE_SECONDS: Record<MeiosisStage3D, number> = {
  g1: 3,
  g2: 3,
  prophase1: 7,
  metaphase1: 4,
  anaphase1: 4,
  telophase1: 4,
  cytokinesis1: 4.5,
  prophase2: 4.5,
  metaphase2: 4,
  anaphase2: 4,
  telophase2: 4,
  cytokinesis2: 4.5,
};

/** Local progress where a stage shows its characteristic arrangement (stage stepping). */
export const STAGE_KEY_U: Record<MeiosisStage3D, number> = {
  g1: 0.5,
  g2: 0.6,
  // Bivalents with their chiasma, the envelope going.
  prophase1: 0.9,
  metaphase1: 0.7,
  anaphase1: 0.6,
  telophase1: 0.95,
  // Cells apart (the furrow closes at 0.85); 1 would be the start of prophase II.
  cytokinesis1: 0.95,
  prophase2: 0.95,
  metaphase2: 0.7,
  anaphase2: 0.6,
  telophase2: 0.95,
  cytokinesis2: 1,
};

/** The runDivision stage whose chromosome sets each 3D stage shows. */
export const MODEL_STAGE: Record<MeiosisStage3D, StageId> = {
  g1: 'g1',
  g2: 'g2',
  prophase1: 'prophase1',
  metaphase1: 'metaphase1',
  anaphase1: 'anaphase1',
  telophase1: 'telophase1',
  cytokinesis1: 'telophase1',
  prophase2: 'prophase2',
  metaphase2: 'metaphase2',
  anaphase2: 'anaphase2',
  telophase2: 'telophase2',
  cytokinesis2: 'telophase2',
};

/** Stages of the first division (one spindle along x); the rest belong to the second. */
const FIRST: ReadonlySet<MeiosisStage3D> = new Set([
  'g1',
  'g2',
  'prophase1',
  'metaphase1',
  'anaphase1',
  'telophase1',
  'cytokinesis1',
]);
export const divisionOf = (stage: MeiosisStage3D): 1 | 2 => (FIRST.has(stage) ? 1 : 2);

/** Illustrative dimensions (cell units). */
export const MEIOSIS = {
  radius: 5,
  nucleus: 2.4,
  pole: 4.2,
  poleAnaphase: 4.7,
  poleTelophase: 5,
  /** Stretch of a cell along its spindle at the end of anaphase (volume kept). */
  elongation: 0.18,
  clusterX: 3.5,
  telNucleusX: 3,
  telNucleusR: 1.6,
  /** Cell radius after meiosis I and after meiosis II (half the volume each time). */
  radius1: 5 * 2 ** (-1 / 3),
  radius2: 5 * 2 ** (-2 / 3),
  /** Meiosis II, in each cell's own frame. */
  pole2: 3.3,
  poleAnaphase2: 3.65,
  poleTelophase2: 3.9,
  clusterX2: 2.75,
  telNucleusX2: 2.35,
  telNucleusR2: 1.25,
} as const;

/** Centre (x) of each cell after meiosis I; (local x = world y) of each cell after meiosis II. */
export const DAUGHTER1_X = 1.2 * MEIOSIS.radius1;
export const DAUGHTER2_Y = 1.2 * MEIOSIS.radius2;
/** Where a cell's centrosome ends cytokinesis (from its new cell centre). */
const CENTROSOME_END1 = DAUGHTER1_X + 2.1;
const CENTROSOME_END2 = DAUGHTER2_Y + 0.53 * MEIOSIS.radius2;
/** Interphase centrosome gap (the copy made in S sits next to the first). */
const CENTROSOME_GAP = 0.45;

/**
 * Distance of each homologue's axis from the middle of its bivalent: tight while synapsed, then
 * apart except at the chiasma (diplotene) and on the metaphase I plate. Illustrative.
 */
const HOMO_SYNAPSIS = 0.33;
const HOMO_APART = 0.47;

/** Prophase I timing (fractions of the stage). */
const PRO1 = {
  condense: [0.05, 0.7],
  pair: [0.1, 0.42],
  /** Crossing over: the model's exchange, once the homologues are paired. */
  cross: 0.45,
  chiasma: [0.45, 0.55],
  apart: [0.5, 0.75],
  nucleolus: [0.05, 0.4],
  envelope: [0.5, 0.8],
  centrosomes: [0.35, 0.9],
  spindle: [0.6, 0.97],
} as const;
/** Prophase II timing (like mitotic prophase). */
const PRO2 = {
  move: [0, 0.6],
  condense: [0, 0.7],
  nucleolus: [0.02, 0.35],
  envelope: [0.2, 0.55],
  centrosomes: [0.05, 0.85],
  spindle: [0.3, 0.95],
} as const;
/** Metaphase: kinetochore fibres attach first, then pull the chromosomes to the plate. */
const META_ATTACH_END = 0.15;
const META_MOVE_END = 0.45;
const metaphasePull = (u: number) => ease(u, META_ATTACH_END, META_MOVE_END);
/** Telophase: spindle gone at 0.5, envelopes reach 0.5 at 0.55, nucleoli re-form late. */
const TEL_SPINDLE_END = 0.5;
const TEL_ENVELOPE = [0.25, 0.85] as const;
const TEL_NUCLEOLUS = [0.55, 0.95] as const;
/**
 * Condensation the chromosomes keep between the two divisions (telophase I → prophase II):
 * illustrative. The picture shows them decondensing in telophase I; in some species they hardly
 * do (Campbell). Either way their DNA is not replicated before meiosis II.
 */
const INTERKINESIS_CONDENSATION = 0.25;

/**
 * Centromere position (fraction along the chromatid from its arm-A tip) per pair. Pair 1 is drawn
 * with its centromere near one end, so the model's crossover point (0.35–0.65 of its length)
 * lies on an arm, clear of the centromere. Illustrative, like the lengths.
 */
const PAIR_CENTROMERE = [0.22, 0.4, 0.45, 0.33];

// ---------------------------------------------------------------- static data per chromatid

export interface MeiosisChromatidInfo extends ChromatidShapeInfo {
  /** Index of the chromosome in the model's G1 cell (pair-major, maternal first). */
  chromosome: number;
  sister: 0 | 1;
  pair: number;
  /** Parent of the homologue this chromatid belongs to. */
  origin: Origin;
  /** DNA pieces before and after the crossing over of prophase I (the model's own). */
  before: Segment[];
  after: Segment[];
  /** Its DNA changed in the crossing over. */
  recombinant: boolean;
  /** Faces the partner homologue in the bivalent (the model crosses inner chromatids over). */
  inner: boolean;
  /** Daughter cell of meiosis I (0 = −x pole), from the model's metaphase I orientation. */
  cell1: 0 | 1;
  /** Index of its final cell in the model's telophase II cells. */
  finalCell: number;
  // Illustrative layout.
  territory: Vec3;
  orient: Vec3;
  sisterAxis: Vec3;
  /** Bivalent of its pair: centre in the nucleus, long axis, and the axis from M to P. */
  bivalent: Vec3;
  bivalentAxis: Vec3;
  pairAxis: Vec3;
  /** Metaphase I slot of its pair (plane x = 0), the long axis on the plate, and a third axis. */
  plate1: Vec3;
  tangent1: Vec3;
  radial1: Vec3;
  /** Place in its meiosis I daughter nucleus (unit nucleus of radius MEIOSIS.nucleus). */
  territory1: Vec3;
  /** Meiosis II, in the cell's own frame: prophase orientation, sister axis, metaphase slot. */
  orient2: Vec3;
  sisterAxis2: Vec3;
  plate2: Vec3;
  tangent2: Vec3;
}

export interface MeiosisChromatidPose extends ChromatidPose {
  /** Its DNA already carries the exchanged pieces (from the crossing over in prophase I). */
  crossed: boolean;
  /** Synapsed with its homologue in a bivalent (end of pairing → end of metaphase I). */
  paired: boolean;
  /** Unit direction its kinetochore faces (towards its pole in this division). */
  kinetoDir: Vec3;
}

export interface Chiasma {
  pair: number;
  /** The model's crossover point (share of the chromosome's length from its arm-A tip). */
  point: number;
  /** The two inner (non-sister) chromatids that exchanged pieces: maternal first. */
  chromatids: [number, number];
  /** 0…1: forms after the exchange, resolves early in anaphase I. */
  weight: number;
}

/** One dividing membrane: two spheres about its centre along its spindle axis. */
export interface MembraneShape {
  center: Vec3;
  /** Spindle axis of this cell: x (meiosis I) or y (meiosis II). */
  axis: 'x' | 'y';
  /** Stretch along the axis (volume kept): axis × (1 + e), the others × 1/√(1 + e). */
  elongation: number;
  /** Two-sphere profile in the unstretched frame: centres at ±offset, radius. */
  offset: number;
  radius: number;
  /** Contractile ring radius (world units) and whether it is shown. */
  ringRadius: number;
  ring: boolean;
  separated: boolean;
}

export interface Meiosis3DState {
  t: number;
  stage: MeiosisStage3D;
  stageIndex: number;
  /** Progress inside the stage, 0…1. */
  u: number;
  /** 1 or 2: which division the stage belongs to. */
  division: 1 | 2;
  /** 0 = decondensed chromatin threads, 1 = fully condensed (metaphase). */
  condensation: number;
  /** Spindle assembly 0…1. */
  spindle: number;
  chromatids: MeiosisChromatidPose[];
  centromeres: CentromereState[];
  nuclei: NucleusState[];
  centrosomes: Vec3[];
  fibres: Fibre[];
  membranes: MembraneShape[];
  /** Cells as they are at this moment (1, then 2 after cytokinesis I, then 4). */
  cells: GeometricCell[];
  chiasmata: Chiasma[];
}

export type MeiosisStageWindow = StageWindow<MeiosisStage3D>;

export interface MeiosisTimeline {
  pairs: number;
  options: Required<MeiosisOptions>;
  stages: MeiosisStageWindow[];
  total: number;
  /** runDivision('meiosis', pairs, options) — the source of every count. */
  model: StageState[];
  chromatids: MeiosisChromatidInfo[];
  stageAt(t: number): { stage: MeiosisStage3D; index: number; u: number };
  keyTime(stage: MeiosisStage3D): number;
  stateAt(t: number): Meiosis3DState;
  counts(stage: MeiosisStage3D): Counts3D;
  /** Gamete signatures of the four final cells (the model's telophase II cells, in order). */
  gametes(): string[];
}

/** Local frame of meiosis II cell k: the world turned by 90° about z, centred on the cell. */
const rot = (v: Vec3): Vec3 => [-v[1], v[0], v[2]];
const rotInv = (v: Vec3): Vec3 => [v[1], -v[0], v[2]];
const cellCentre1 = (k: 0 | 1): Vec3 => v3((k === 0 ? -1 : 1) * DAUGHTER1_X, 0, 0);

/** Evenly spread unit directions (Fibonacci sphere), deterministic. */
function spread(n: number): Vec3[] {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    out.push([r * Math.cos(i * golden + 0.6), y, r * Math.sin(i * golden + 0.6)]);
  }
  return out;
}

/** A unit vector perpendicular to `d`, chosen from `hint` (fallback: any). */
function perpendicular(d: Vec3, hint: Vec3): Vec3 {
  const p = sub(hint, mul(d, dot(hint, d)));
  return len(p) > 1e-6 ? norm(p) : basis(d)[0];
}

// ---------------------------------------------------------------- timeline

/** Builds the 3D meiosis timeline for a diploid germ cell with `pairs` homologous pairs. */
export function buildMeiosisTimeline(
  pairs: number,
  opts: Required<MeiosisOptions>,
): MeiosisTimeline {
  const model = runDivision('meiosis', pairs, opts);
  const g2 = model.find((s) => s.stage === 'g2')?.cells[0];
  const p1 = model.find((s) => s.stage === 'prophase1')?.cells[0];
  const tel1 = model.find((s) => s.stage === 'telophase1');
  if (!g2 || !p1 || !tel1) throw new Error('meiosis model is missing a stage');
  const n2 = g2.chromosomes.length;
  const nucleusR = MEIOSIS.nucleus;
  const slots1 = plateLayout(pairs);
  const slots2 = plateLayout(pairs);
  const bivalentDirs = pairs > 1 ? spread(pairs) : [v3(0, 0, 0)];

  // Per pair: the bivalent's place and axes, and its metaphase I slot.
  const pairData = Array.from({ length: pairs }, (_, pair) => {
    const rand = rng(501 + 37 * pair);
    const mFirst = opts.orientation[pair] ?? true;
    // Side of the maternal homologue on the metaphase I plate (−1 = faces the −x pole).
    const sideM: -1 | 1 = mFirst ? -1 : 1;
    const bivalentAxis = randomUnit(rand);
    // The maternal homologue sits at −pairAxis: its x points away from the maternal pole side.
    let pairAxis = perpendicular(bivalentAxis, randomUnit(rand));
    if (dot(pairAxis, X) * -sideM < 0) pairAxis = mul(pairAxis, -1);
    const centre = mul(bivalentDirs[pair] ?? v3(0, 0, 0), pairs > 1 ? 0.95 : 0);
    const slot = slots1[pair] ?? { pos: v3(0, 0, 0), tangent: v3(0, 1, 0) };
    const tangent1 = dot(slot.tangent, bivalentAxis) < 0 ? mul(slot.tangent, -1) : slot.tangent;
    return {
      mFirst,
      bivalent: centre,
      bivalentAxis,
      pairAxis,
      plate1: slot.pos,
      tangent1,
      radial1: norm(cross(X, tangent1)),
    };
  });

  const chromatids: MeiosisChromatidInfo[] = [];
  g2.chromosomes.forEach((c, i) => {
    const rand = rng(97 + 31 * i);
    const territory = mul(randomInBall(rand), 0.55 * nucleusR);
    const orient = randomUnit(rand);
    let axis = norm(cross(orient, randomUnit(rand)), norm(cross(orient, [0, 0, 1])));
    if (dot(axis, X) < 0) axis = mul(axis, -1);
    const threadRotation: Vec3 = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
    const territory1 = mul(randomInBall(rand), 0.5 * nucleusR);
    const orient2 = randomUnit(rand);
    let axis2 = norm(cross(orient2, randomUnit(rand)), norm(cross(orient2, [0, 0, 1])));
    if (dot(axis2, X) < 0) axis2 = mul(axis2, -1);
    const pd = pairData[c.pair];
    if (!pd) throw new Error('pair out of range');
    const slot2 = slots2[c.pair] ?? { pos: v3(0, 0, 0), tangent: v3(0, 1, 0) };
    const tangent2 = dot(slot2.tangent, orient2) < 0 ? mul(slot2.tangent, -1) : slot2.tangent;
    const L = pairLength(c.pair, n2);
    const cf = PAIR_CENTROMERE[c.pair % PAIR_CENTROMERE.length] ?? 0.5;
    const mGoesFirst = (c.origin === 'M') === pd.mFirst;
    const cell1: 0 | 1 = mGoesFirst ? 0 : 1;
    const crossedChromosome = p1.chromosomes.find(
      (x) => x.pair === c.pair && x.origin === c.origin,
    );
    for (const sister of [0, 1] as const) {
      const before = (c.chromatids[sister] ?? []).map((s) => ({ ...s }));
      const after = (crossedChromosome?.chromatids[sister] ?? c.chromatids[sister] ?? []).map(
        (s) => ({ ...s }),
      );
      chromatids.push({
        chromosome: i,
        sister,
        pair: c.pair,
        origin: c.origin,
        before,
        after,
        recombinant: JSON.stringify(before) !== JSON.stringify(after),
        // The model exchanges the maternal homologue's sister 1 with the paternal's sister 0.
        inner: c.origin === 'M' ? sister === 1 : sister === 0,
        cell1,
        finalCell: 2 * cell1 + sister,
        armA: L * cf,
        armB: L * (1 - cf),
        threadVariant: i % 4,
        threadRotation,
        territory,
        orient,
        sisterAxis: axis,
        bivalent: pd.bivalent,
        bivalentAxis: pd.bivalentAxis,
        pairAxis: pd.pairAxis,
        plate1: pd.plate1,
        tangent1: pd.tangent1,
        radial1: pd.radial1,
        territory1,
        orient2,
        sisterAxis2: axis2,
        plate2: slot2.pos,
        tangent2,
      });
    }
  });

  const clock = stageClock(MEIOSIS_STAGES_3D, STAGE_SECONDS, STAGE_KEY_U);
  const { stages, total, stageAt, keyTime, timeAt } = clock;

  const crossovers = model.find((s) => s.stage === 'prophase1')?.crossovers ?? [];
  const chiasmaPairs = crossovers.flatMap((x) => {
    const m = chromatids.findIndex((c) => c.pair === x.pair && c.origin === 'M' && c.sister === 1);
    const p = chromatids.findIndex((c) => c.pair === x.pair && c.origin === 'P' && c.sister === 0);
    return m >= 0 && p >= 0
      ? [{ pair: x.pair, point: x.point, chromatids: [m, p] as [number, number] }]
      : [];
  });

  const stateAt = (t: number): Meiosis3DState => {
    const { stage, index, u } = stageAt(t);
    return computeState(Math.min(total, Math.max(0, t)), stage, index, u, chromatids, chiasmaPairs);
  };

  const countsCache = new Map<MeiosisStage3D, Counts3D>();
  const counts = (stage: MeiosisStage3D): Counts3D => {
    const hit = countsCache.get(stage);
    if (hit) return hit;
    const s = model.find((m) => m.stage === MODEL_STAGE[stage]);
    if (!s) throw new Error(`no model stage for ${stage}`);
    const k = Math.max(
      0,
      stages.findIndex((x) => x.id === stage),
    );
    // Nuclei per cell, read from the geometry at the stage's start and end (u = 1 is the
    // stage's own end, not the next stage's start).
    const nucleiPerCell = (uu: number) => {
      const st = computeState(timeAt(stage, uu), stage, k, uu, chromatids, chiasmaPairs);
      return st.nuclei.filter((x) => x.envelope >= 0.5).length / Math.max(1, st.cells.length);
    };
    const nuclei = { from: nucleiPerCell(0), to: nucleiPerCell(1) };
    const merge = stage === 'telophase1' || stage === 'telophase2' ? 2 : 1;
    const c = countsFromModel(s, merge, nuclei);
    countsCache.set(stage, c);
    return c;
  };

  const finalCells = model.find((s) => s.stage === 'telophase2')?.cells ?? [];
  const gametes = () => finalCells.map((cell: Cell) => gameteSignature(cell));

  return {
    pairs,
    options: opts,
    stages,
    total,
    model,
    chromatids,
    stageAt,
    keyTime,
    stateAt,
    counts,
    gametes,
  };
}

// ---------------------------------------------------------------- state at one moment

interface Frame {
  /** Spindle poles per spindle (world): one spindle in meiosis I, one per cell in meiosis II. */
  spindles: [Vec3, Vec3][];
  centrosomes: Vec3[];
  condensation: number;
  spindle: number;
  /** Kinetochore fibre attachment 0…1. */
  attach: number;
  nuclei: NucleusState[];
  membranes: MembraneShape[];
  /** Nucleus centres (local x) of telophase / cytokinesis of the current division. */
  daughterX: number;
}

/** A membrane in its cell's frame (offset f of the daughter distance, as in mitosis). */
function membrane(
  center: Vec3,
  axis: 'x' | 'y',
  e: number,
  f: number,
  r0: number,
  r1: number,
  distance: number,
  furrowing: boolean,
): MembraneShape {
  const offset = f * distance;
  const radius = lerp(r0, r1, f);
  const separated = offset >= radius;
  const ringLocal = separated ? 0 : Math.sqrt(radius * radius - offset * offset);
  return {
    center,
    axis,
    elongation: e,
    offset,
    radius,
    ringRadius: ringLocal / Math.sqrt(1 + e),
    ring: furrowing && !separated,
    separated,
  };
}

function firstFrame(stage: MeiosisStage3D, u: number): Frame {
  const M = MEIOSIS;
  const top = M.nucleus + 0.8;
  const gap = CENTROSOME_GAP;
  const O = v3(0, 0, 0);
  const pole = (x: number): [Vec3, Vec3] => [v3(-x, 0, 0), v3(x, 0, 0)];
  const one = (envelope: number, nucleolus = 1): NucleusState[] => [
    { center: O, radius: M.nucleus, envelope, nucleolus, cell: 0 },
  ];
  const cell = (e = 0, f = 0, furrowing = false) =>
    membrane(O, 'x', e, f, M.radius, M.radius1, DAUGHTER1_X, furrowing);
  switch (stage) {
    case 'g1':
      return {
        spindles: [],
        centrosomes: [v3(-gap, top, 0)],
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: one(1),
        membranes: [cell()],
        daughterX: 0,
      };
    case 'g2':
      return {
        spindles: [],
        centrosomes: [v3(-gap, top, 0), v3(gap, top, 0)],
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: one(1),
        membranes: [cell()],
        daughterX: 0,
      };
    case 'prophase1': {
      // The two centrosomes travel around the nucleus to opposite poles.
      const k = ease(u, ...PRO1.centrosomes);
      const r = lerp(Math.hypot(gap, top), M.pole, k);
      const a0 = Math.atan2(top, -gap);
      const a1 = Math.atan2(top, gap);
      const cs: [Vec3, Vec3] = [
        v3(r * Math.cos(lerp(a0, Math.PI, k)), r * Math.sin(lerp(a0, Math.PI, k)), 0),
        v3(r * Math.cos(lerp(a1, 0, k)), r * Math.sin(lerp(a1, 0, k)), 0),
      ];
      return {
        spindles: [cs],
        centrosomes: [...cs],
        condensation: 0.85 * ease(u, ...PRO1.condense),
        spindle: ease(u, ...PRO1.spindle),
        attach: 0,
        nuclei: one(1 - ease(u, ...PRO1.envelope), 1 - ease(u, ...PRO1.nucleolus)),
        membranes: [cell()],
        daughterX: 0,
      };
    }
    case 'metaphase1':
      return {
        spindles: [pole(M.pole)],
        centrosomes: pole(M.pole),
        condensation: lerp(0.85, 1, ease(u, 0, 0.4)),
        spindle: 1,
        attach: ease(u, 0, META_ATTACH_END),
        nuclei: [],
        membranes: [cell()],
        daughterX: 0,
      };
    case 'anaphase1': {
      const x = lerp(M.pole, M.poleAnaphase, ease(u, 0.2, 0.9));
      return {
        spindles: [pole(x)],
        centrosomes: pole(x),
        condensation: 1,
        spindle: 1,
        attach: 1,
        nuclei: [],
        membranes: [cell(M.elongation * ease(u, 0.2, 0.95))],
        daughterX: 0,
      };
    }
    case 'telophase1': {
      const x = lerp(M.poleAnaphase, M.poleTelophase, ease(u, 0, 0.6));
      const sp = 1 - ease(u, 0, TEL_SPINDLE_END);
      const r = M.telNucleusR * (0.6 + 0.4 * ease(u, 0.1, 0.85));
      const env = ease(u, ...TEL_ENVELOPE);
      const nl = ease(u, ...TEL_NUCLEOLUS);
      return {
        spindles: [pole(x)],
        centrosomes: pole(x),
        condensation: lerp(1, INTERKINESIS_CONDENSATION, ease(u, 0.1, 0.8)),
        spindle: sp,
        attach: sp,
        nuclei: [
          { center: v3(-M.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
          { center: v3(M.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
        ],
        membranes: [cell(M.elongation)],
        daughterX: M.telNucleusX,
      };
    }
    case 'cytokinesis1': {
      const f = ease(u, 0.05, 0.85);
      const m = cell(M.elongation * (1 - f), f, true);
      const nx = lerp(M.telNucleusX, DAUGHTER1_X, f);
      const cx = lerp(M.poleTelophase, CENTROSOME_END1, f);
      // Each centrosome ends beside its new nucleus, where meiosis II's spindle will start.
      const cy = -CENTROSOME_GAP * f;
      return {
        spindles: [],
        centrosomes: [v3(-cx, cy, 0), v3(cx, cy, 0)],
        condensation: INTERKINESIS_CONDENSATION,
        spindle: 0,
        attach: 0,
        nuclei: [
          { center: v3(-nx, 0, 0), radius: M.telNucleusR, envelope: 1, nucleolus: 1, cell: 0 },
          {
            center: v3(nx, 0, 0),
            radius: M.telNucleusR,
            envelope: 1,
            nucleolus: 1,
            cell: m.separated ? 1 : 0,
          },
        ],
        membranes: [m],
        daughterX: nx,
      };
    }
    default:
      throw new Error(`${stage} is not a stage of meiosis I`);
  }
}

/** Meiosis II frame of cell k (in world coordinates). */
function secondFrame(stage: MeiosisStage3D, u: number, k: 0 | 1): Frame {
  const M = MEIOSIS;
  const C = cellCentre1(k);
  const W = (p: Vec3): Vec3 => add(C, rot(p));
  const pole = (x: number): [Vec3, Vec3] => [W(v3(-x, 0, 0)), W(v3(x, 0, 0))];
  const one = (envelope: number, nucleolus: number): NucleusState[] => [
    { center: C, radius: M.telNucleusR, envelope, nucleolus, cell: k },
  ];
  const cell = (e = 0, f = 0, furrowing = false) =>
    membrane(C, 'y', e, f, M.radius1, M.radius2, DAUGHTER2_Y, furrowing);
  // Each cell's centrosome sits beside its nucleus, on the cell's outer side: world ∓x is
  // local ±y (cytokinesis I left it at local (−gap, top)).
  const top = (k === 0 ? 1 : -1) * (CENTROSOME_END1 - DAUGHTER1_X);
  const gap = CENTROSOME_GAP;
  switch (stage) {
    case 'prophase2': {
      // Two centrosomes (one spindle per cell; see the 3D card) travel to the new poles.
      const kk = ease(u, ...PRO2.centrosomes);
      const r = lerp(Math.hypot(gap, top), M.pole2, kk);
      const a0 = Math.atan2(top, -gap);
      const a1 = Math.atan2(top, gap);
      const end0 = top > 0 ? Math.PI : -Math.PI;
      const cs: [Vec3, Vec3] = [
        W(v3(r * Math.cos(lerp(a0, end0, kk)), r * Math.sin(lerp(a0, end0, kk)), 0)),
        W(v3(r * Math.cos(lerp(a1, 0, kk)), r * Math.sin(lerp(a1, 0, kk)), 0)),
      ];
      return {
        spindles: [cs],
        centrosomes: [...cs],
        condensation: lerp(INTERKINESIS_CONDENSATION, 0.85, ease(u, ...PRO2.condense)),
        spindle: ease(u, ...PRO2.spindle),
        attach: 0,
        nuclei: one(1 - ease(u, ...PRO2.envelope), 1 - ease(u, ...PRO2.nucleolus)),
        membranes: [cell()],
        daughterX: 0,
      };
    }
    case 'metaphase2':
      return {
        spindles: [pole(M.pole2)],
        centrosomes: pole(M.pole2),
        condensation: lerp(0.85, 1, ease(u, 0, 0.4)),
        spindle: 1,
        attach: ease(u, 0, META_ATTACH_END),
        nuclei: [],
        membranes: [cell()],
        daughterX: 0,
      };
    case 'anaphase2': {
      const x = lerp(M.pole2, M.poleAnaphase2, ease(u, 0.2, 0.9));
      return {
        spindles: [pole(x)],
        centrosomes: pole(x),
        condensation: 1,
        spindle: 1,
        attach: 1,
        nuclei: [],
        membranes: [cell(M.elongation * ease(u, 0.2, 0.95))],
        daughterX: 0,
      };
    }
    case 'telophase2': {
      const x = lerp(M.poleAnaphase2, M.poleTelophase2, ease(u, 0, 0.6));
      const sp = 1 - ease(u, 0, TEL_SPINDLE_END);
      const r = M.telNucleusR2 * (0.6 + 0.4 * ease(u, 0.1, 0.85));
      const env = ease(u, ...TEL_ENVELOPE);
      const nl = ease(u, ...TEL_NUCLEOLUS);
      return {
        spindles: [pole(x)],
        centrosomes: pole(x),
        condensation: 1 - ease(u, 0.1, 0.8),
        spindle: sp,
        attach: sp,
        nuclei: [-1, 1].map((s) => ({
          center: W(v3(s * M.telNucleusX2, 0, 0)),
          radius: r,
          envelope: env,
          nucleolus: nl,
          cell: k,
        })),
        membranes: [cell(M.elongation)],
        daughterX: M.telNucleusX2,
      };
    }
    case 'cytokinesis2': {
      const f = ease(u, 0.05, 0.85);
      const m = cell(M.elongation * (1 - f), f, true);
      const nx = lerp(M.telNucleusX2, DAUGHTER2_Y, f);
      const cx = lerp(M.poleTelophase2, CENTROSOME_END2, f);
      return {
        spindles: [],
        centrosomes: pole(cx),
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: [-1, 1].map((s, j) => ({
          center: W(v3(s * nx, 0, 0)),
          radius: M.telNucleusR2,
          envelope: 1,
          nucleolus: 1,
          // Cell indices are fixed by the caller (2 per parent cell once separated).
          cell: m.separated ? 2 * k + j : k,
        })),
        membranes: [m],
        daughterX: nx,
      };
    }
    default:
      throw new Error(`${stage} is not a stage of meiosis II`);
  }
}

/** Key poses of one chromatid (centromere + arm directions), world coordinates. */
interface Pose {
  c: Vec3;
  a: Vec3;
  b: Vec3;
}

function mix(p: Pose, q: Pose, k: number): Pose {
  return {
    c: lerpV(p.c, q.c, k),
    a: norm(lerpV(p.a, q.a, k), p.a),
    b: norm(lerpV(p.b, q.b, k), p.b),
  };
}

/** −1 for sister 0, +1 for sister 1 (sister 1 sits on the +sister-axis side). */
const sisterSide = (info: MeiosisChromatidInfo): -1 | 1 => (info.sister === 0 ? -1 : 1);
/** −1 = the −x pole of meiosis I (daughter cell 0). */
const pole1Side = (info: MeiosisChromatidInfo): -1 | 1 => (info.cell1 === 0 ? -1 : 1);
/** Offset of a chromatid from its bivalent's middle along the pair axis, in units of that axis. */
function pairOffset(info: MeiosisChromatidInfo, homo: number): number {
  const hom = info.origin === 'M' ? -1 : 1;
  return hom * (homo + (info.inner ? -SISTER_OFFSET : SISTER_OFFSET));
}

/** G1, G2, early prophase I: each chromosome in its own territory, sisters side by side. */
function territoryPose(info: MeiosisChromatidInfo): Pose {
  const s = sisterSide(info);
  const splay = mul(info.sisterAxis, SPLAY * s);
  return {
    c: add(info.territory, mul(info.sisterAxis, s * SISTER_OFFSET)),
    a: norm(add(info.orient, splay)),
    b: norm(add(mul(info.orient, -1), splay)),
  };
}

/**
 * Synapsed in its bivalent (four parallel chromatids), homologues `homo` from the middle. The
 * chromosome's middle (not its centromere) sits on the bivalent's place, so a long arm stays
 * inside the nucleus.
 */
function bivalentPose(info: MeiosisChromatidInfo, homo: number): Pose {
  const middle = mul(info.bivalentAxis, (info.armB - info.armA) / 2);
  return {
    c: add(add(info.bivalent, middle), mul(info.pairAxis, pairOffset(info, homo))),
    a: info.bivalentAxis,
    b: mul(info.bivalentAxis, -1),
  };
}

/** Metaphase I: the bivalent on the plate, each homologue facing the pole the model sends it to. */
function plate1Pose(info: MeiosisChromatidInfo): Pose {
  // pairOffset's sign is −1 for the maternal homologue; on the plate it must be its pole side.
  const offset = Math.abs(pairOffset(info, HOMO_APART)) * pole1Side(info);
  return {
    c: add(info.plate1, mul(X, offset)),
    a: info.tangent1,
    b: mul(info.tangent1, -1),
  };
}

/** End of anaphase I: the double chromosome near its pole, centromere first (V shape). */
function anaphase1Pose(info: MeiosisChromatidInfo): Pose {
  const side = pole1Side(info);
  const back = mul(X, -side * 0.85);
  const p = info.plate1;
  return {
    c: add(
      v3(side * MEIOSIS.clusterX, p[1] * 0.55, p[2] * 0.55),
      mul(info.radial1, (info.inner ? -1 : 1) * SISTER_OFFSET),
    ),
    a: norm(add(back, mul(info.tangent1, 0.5))),
    b: norm(add(back, mul(info.tangent1, -0.5))),
  };
}

/** In its meiosis I daughter nucleus, centred at (side · x, 0, 0). */
function daughter1Pose(info: MeiosisChromatidInfo, x: number): Pose {
  const end = anaphase1Pose(info);
  const scale = MEIOSIS.telNucleusR / MEIOSIS.nucleus;
  return {
    c: add(
      add(v3(pole1Side(info) * x, 0, 0), mul(info.territory1, scale)),
      mul(info.radial1, (info.inner ? -1 : 1) * SISTER_OFFSET),
    ),
    a: end.a,
    b: end.b,
  };
}

/** World pose from a pose in meiosis II cell `cell1`'s own frame. */
function toWorld2(info: MeiosisChromatidInfo, p: Pose): Pose {
  const C = cellCentre1(info.cell1);
  return { c: add(C, rot(p.c)), a: rot(p.a), b: rot(p.b) };
}

/** Prophase II: the double chromosome where it was, sisters turned for the new spindle. */
function prophase2Pose(info: MeiosisChromatidInfo): Pose {
  const s = sisterSide(info);
  const scale = MEIOSIS.telNucleusR / MEIOSIS.nucleus;
  const splay = mul(info.sisterAxis2, SPLAY * s);
  const local: Pose = {
    c: add(rotInv(mul(info.territory1, scale)), mul(info.sisterAxis2, s * SISTER_OFFSET)),
    a: norm(add(info.orient2, splay)),
    b: norm(add(mul(info.orient2, -1), splay)),
  };
  return toWorld2(info, local);
}

/** Metaphase II plate of its cell (local plane x = 0), sisters facing opposite poles. */
function plate2Pose(info: MeiosisChromatidInfo): Pose {
  const s = sisterSide(info);
  const splay = mul(X, SPLAY * s);
  return toWorld2(info, {
    c: add(info.plate2, mul(X, s * SISTER_OFFSET)),
    a: norm(add(info.tangent2, splay)),
    b: norm(add(mul(info.tangent2, -1), splay)),
  });
}

/** End of anaphase II (local frame): the single chromosome near its pole, centromere first. */
function anaphase2Local(info: MeiosisChromatidInfo): Pose {
  const s = sisterSide(info);
  const back = mul(X, -s * 0.85);
  return {
    c: v3(s * MEIOSIS.clusterX2, info.plate2[1] * 0.55, info.plate2[2] * 0.55),
    a: norm(add(back, mul(info.tangent2, 0.5))),
    b: norm(add(back, mul(info.tangent2, -0.5))),
  };
}

/** In its final nucleus (local x = side · x of its meiosis II cell). */
function daughter2Pose(info: MeiosisChromatidInfo, x: number): Pose {
  const end = anaphase2Local(info);
  const scale =
    (MEIOSIS.telNucleusR / MEIOSIS.nucleus) * (MEIOSIS.telNucleusR2 / MEIOSIS.telNucleusR);
  return toWorld2(info, {
    c: add(v3(sisterSide(info) * x, 0, 0), mul(rotInv(info.territory1), scale)),
    a: end.a,
    b: end.b,
  });
}

function chromatidPose(
  info: MeiosisChromatidInfo,
  stage: MeiosisStage3D,
  u: number,
  frame: Frame,
): Pose {
  switch (stage) {
    case 'g1':
    case 'g2':
      return territoryPose(info);
    case 'prophase1': {
      const paired = mix(
        territoryPose(info),
        bivalentPose(info, HOMO_SYNAPSIS),
        ease(u, ...PRO1.pair),
      );
      return mix(paired, bivalentPose(info, HOMO_APART), ease(u, ...PRO1.apart));
    }
    case 'metaphase1':
      return mix(bivalentPose(info, HOMO_APART), plate1Pose(info), metaphasePull(u));
    case 'anaphase1':
      return mix(plate1Pose(info), anaphase1Pose(info), ease(u, 0, 0.85));
    case 'telophase1':
      return mix(anaphase1Pose(info), daughter1Pose(info, MEIOSIS.telNucleusX), ease(u, 0, 0.8));
    case 'cytokinesis1':
      return daughter1Pose(info, frame.daughterX);
    case 'prophase2':
      return mix(daughter1Pose(info, DAUGHTER1_X), prophase2Pose(info), ease(u, ...PRO2.move));
    case 'metaphase2':
      return mix(prophase2Pose(info), plate2Pose(info), metaphasePull(u));
    case 'anaphase2':
      return mix(plate2Pose(info), toWorld2(info, anaphase2Local(info)), ease(u, 0, 0.85));
    case 'telophase2':
      return mix(
        toWorld2(info, anaphase2Local(info)),
        daughter2Pose(info, MEIOSIS.telNucleusX2),
        ease(u, 0, 0.8),
      );
    case 'cytokinesis2':
      return daughter2Pose(info, frame.daughterX);
  }
}

function computeState(
  t: number,
  stage: MeiosisStage3D,
  stageIndex: number,
  u: number,
  infos: MeiosisChromatidInfo[],
  chiasmaPairs: { pair: number; point: number; chromatids: [number, number] }[],
): Meiosis3DState {
  const division = divisionOf(stage);
  let frame: Frame;
  if (division === 1) {
    frame = firstFrame(stage, u);
  } else {
    // Both cells divide in step (the same frame in each cell's own frame).
    const f0 = secondFrame(stage, u, 0);
    const f1 = secondFrame(stage, u, 1);
    // Centrosomes 0 and 1 are the ones each cell had after meiosis I; 2 and 3 their partners.
    const pick = (f: Frame, i: number) => (f.centrosomes[i] ? [f.centrosomes[i]] : []);
    frame = {
      spindles: [...f0.spindles, ...f1.spindles],
      centrosomes: [...pick(f0, 0), ...pick(f1, 0), ...pick(f0, 1), ...pick(f1, 1)],
      condensation: f0.condensation,
      spindle: f0.spindle,
      attach: f0.attach,
      nuclei: [...f0.nuclei, ...f1.nuclei],
      membranes: [...f0.membranes, ...f1.membranes],
      daughterX: f0.daughterX,
    };
  }

  const crossed = stage !== 'g1' && stage !== 'g2' && !(stage === 'prophase1' && u < PRO1.cross);
  const paired = (stage === 'prophase1' && u >= PRO1.pair[1]) || stage === 'metaphase1';
  const split = stage === 'anaphase2' || stage === 'telophase2' || stage === 'cytokinesis2';
  const chromatids: MeiosisChromatidPose[] = infos.map((info, id) => {
    const pose = chromatidPose(info, stage, u, frame);
    const side = division === 1 ? pole1Side(info) : sisterSide(info);
    return {
      id,
      chromosome: info.chromosome,
      sister: info.sister,
      origin: info.origin,
      // Sister 1 is made in S (not its own step): it exists from the start of G2.
      present: stage !== 'g1' || info.sister === 0,
      joined: stage !== 'g1' && !split,
      centromere: pose.c,
      dirA: pose.a,
      dirB: pose.b,
      side,
      crossed,
      paired,
      kinetoDir: division === 1 ? v3(side, 0, 0) : v3(0, side, 0),
    };
  });

  // Centromeres: one per double chromosome (midpoint of the sisters), one per single one.
  const centromeres: CentromereState[] = [];
  for (let i = 0; i < chromatids.length; i += 2) {
    const s0 = chromatids[i];
    const s1 = chromatids[i + 1];
    if (!s0 || !s1) continue;
    if (!s1.present) {
      centromeres.push({ chromosome: s0.chromosome, sisters: [0], position: s0.centromere });
    } else if (s0.joined) {
      centromeres.push({
        chromosome: s0.chromosome,
        sisters: [0, 1],
        position: mul(add(s0.centromere, s1.centromere), 0.5),
      });
    } else {
      centromeres.push({ chromosome: s0.chromosome, sisters: [0], position: s0.centromere });
      centromeres.push({ chromosome: s1.chromosome, sisters: [1], position: s1.centromere });
    }
  }

  const fibres = spindleFibres(frame, chromatids, infos, stage, division);

  // Cells at this moment: membranes that have separated count as two.
  const present = chromatids.filter((c) => c.present);
  const cells: GeometricCell[] = [];
  if (division === 1) {
    const m = frame.membranes[0];
    if (m?.separated) {
      for (const k of [0, 1] as const) {
        cells.push({
          center: v3((k === 0 ? -1 : 1) * m.offset * (1 + m.elongation), 0, 0),
          chromatids: present.filter((c) => infos[c.id]?.cell1 === k).map((c) => c.id),
        });
      }
    } else {
      cells.push({ center: v3(0, 0, 0), chromatids: present.map((c) => c.id) });
    }
  } else {
    frame.membranes.forEach((m, k) => {
      const mine = present.filter((c) => infos[c.id]?.cell1 === k);
      if (m.separated) {
        for (const s of [0, 1] as const) {
          const d = (s === 0 ? -1 : 1) * m.offset * (1 + m.elongation);
          cells.push({
            center: add(m.center, v3(0, d, 0)),
            chromatids: mine.filter((c) => c.sister === s).map((c) => c.id),
          });
        }
      } else {
        cells.push({ center: m.center, chromatids: mine.map((c) => c.id) });
      }
    });
  }

  const weight =
    stage === 'prophase1'
      ? ease(u, ...PRO1.chiasma)
      : stage === 'metaphase1'
        ? 1
        : stage === 'anaphase1'
          ? 1 - ease(u, 0, 0.1)
          : 0;
  const chiasmata: Chiasma[] =
    weight > 0 ? chiasmaPairs.map((x) => ({ ...x, chromatids: x.chromatids, weight })) : [];

  return {
    t,
    stage,
    stageIndex,
    u,
    division,
    condensation: frame.condensation,
    spindle: frame.spindle,
    chromatids,
    centromeres,
    nuclei: frame.nuclei,
    centrosomes: frame.centrosomes,
    fibres,
    membranes: frame.membranes,
    cells,
    chiasmata,
  };
}

function spindleFibres(
  frame: Frame,
  chromatids: MeiosisChromatidPose[],
  infos: MeiosisChromatidInfo[],
  stage: MeiosisStage3D,
  division: 1 | 2,
): Fibre[] {
  const out: Fibre[] = [];
  const sp = frame.spindle;
  if (sp <= 1e-4) return out;
  for (const poles of frame.spindles) {
    for (const k of [0, 1] as const) {
      const p = poles[k];
      const q = poles[k === 0 ? 1 : 0];
      const d = sub(q, p);
      if (len(d) < 1e-6) continue;
      const dh = norm(d);
      const [e1, e2] = basis(dh);
      // Polar (interpolar) fibres: from each pole past the equator, overlapping in the middle.
      for (let j = 0; j < 6; j++) {
        const th = (j * Math.PI) / 3 + k * (Math.PI / 6);
        const ring = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th)));
        const end = add(add(p, mul(d, 0.6)), mul(ring, division === 1 ? 1.5 : 1.2));
        out.push({ kind: 'polar', from: p, to: lerpV(p, end, sp), pole: k });
      }
      // Astral microtubules radiate from the centrosomes.
      for (let j = 0; j < 8; j++) {
        const ph = (j * Math.PI) / 4;
        const dir = norm(
          add(mul(dh, -0.55), mul(add(mul(e1, Math.cos(ph)), mul(e2, Math.sin(ph))), 0.85)),
        );
        out.push({ kind: 'astral', from: p, to: add(p, mul(dir, 0.9 * sp)), pole: k });
      }
    }
  }
  // Kinetochore fibres. Meiosis I: both sister kinetochores of a homologue face the same pole
  // (the one the model sends it to). Meiosis II: sister 0 to its cell's first pole, sister 1 to
  // the second.
  const attach = frame.attach;
  const pulling =
    stage === 'metaphase1' ||
    stage === 'anaphase1' ||
    stage === 'telophase1' ||
    stage === 'metaphase2' ||
    stage === 'anaphase2' ||
    stage === 'telophase2';
  if (attach > 1e-4 && pulling) {
    for (const c of chromatids) {
      if (!c.present) continue;
      const k: 0 | 1 = c.side === -1 ? 0 : 1;
      // Meiosis II: the spindle of the chromatid's own cell.
      const spindle = frame.spindles[division === 1 ? 0 : (infos[c.id]?.cell1 ?? 0)];
      const p = spindle?.[k];
      if (!p) continue;
      out.push({
        kind: 'kinetochore',
        from: p,
        to: lerpV(p, c.centromere, attach),
        chromatid: c.id,
        pole: k,
      });
    }
  }
  return out;
}

/** True when a point lies inside one of the membranes (tests: nothing drawn outside a cell). */
export function insideMembranes(membranes: readonly MembraneShape[], p: Vec3, margin = 0): boolean {
  return membranes.some((m) => {
    const d = sub(p, m.center);
    const l = m.axis === 'x' ? d : rotInv(d);
    const s = 1 + m.elongation;
    const x = l[0] / s;
    const r = Math.hypot(l[1], l[2]) * Math.sqrt(s);
    const inside = (cx: number) => Math.hypot(x - cx, r) <= m.radius - margin;
    return inside(-m.offset) || inside(m.offset);
  });
}
