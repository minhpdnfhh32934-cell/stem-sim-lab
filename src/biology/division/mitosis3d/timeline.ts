/**
 * Mitosis in 3D — a pure, deterministic timeline (no three.js, no DOM).
 *
 * What is EXACT: the chromosome bookkeeping. Every chromosome and chromatid shown comes from
 * `runDivision('mitosis', pairs)` (division.ts); the counts of each stage are read from that
 * model, never typed in. What is ILLUSTRATIVE: sizes, shapes, positions and timing (not to
 * scale). Positions are interpolated between hand-placed key poses with smooth easing.
 *
 * Coordinates: the spindle axis is x (poles at −x and +x), the equatorial (metaphase) plane is
 * x = 0, y is up. Units are arbitrary "cell units" (animal cell radius 5).
 *
 * Sister chromatid 0 of every chromosome goes to the −x pole and daughter cell 0, sister 1 to
 * the +x pole and daughter cell 1 — exactly the split made by `splitSisters` in division.ts.
 *
 * `stateAt(t)` is continuous in t. The only discrete changes happen at stage boundaries,
 * where the biology changes topology (positions stay continuous across them):
 *  - g1 → g2 (S phase): S is not shown as its own step, because the model has no S stage —
 *    `runDivision` builds its g2 cell as `replicate(g1)`, and a half-replicated cell has no
 *    textbook count. So the result of S is shown at once: at the start of G2 every chromosome
 *    already has its sister chromatid (sister 1 appears side by side with sister 0, which has
 *    been in that place since G1) and the animal cell already has its second centrosome (next
 *    to the first one). Nothing duplicates or splits inside the G2 window.
 *  - prophase → metaphase: the nucleus entry disappears (its envelope has already faded to 0).
 *  - metaphase → anaphase: every centromere splits — each sister becomes a single chromosome.
 *  - anaphase → telophase: two nuclei start to form (envelope opacity starts at 0).
 *  - telophase → cytokinesis: the counts switch to "per daughter cell after division"; the
 *    cell itself separates during cytokinesis, when the furrow closes (animal) or the cell
 *    plate reaches the wall (plant).
 */
import { rng } from '../../genetics/stats';
import { runDivision, type Origin, type StageId, type StageState } from '../division';
import { stageClock, type StageWindow as Window } from '../division3d/clock';
import { countsFromModel } from '../division3d/counts';
import { PAIR_LENGTH, ROD_RADIUS, SISTER_OFFSET, SPLAY } from '../division3d/dimensions';
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

// Shared with the meiosis view (`../division3d/`), re-exported for existing imports.
export { ease, type Vec3 };
export type {
  CentromereState,
  ChromatidPose,
  Counts3D,
  Fibre,
  FibreKind,
  GeometricCell,
  NucleusState,
} from '../division3d/types';

export type CellType = 'animal' | 'plant';
export type Stage3D =
  'g1' | 'g2' | 'prophase' | 'metaphase' | 'anaphase' | 'telophase' | 'cytokinesis';

export const STAGES_3D: readonly Stage3D[] = [
  'g1',
  'g2',
  'prophase',
  'metaphase',
  'anaphase',
  'telophase',
  'cytokinesis',
];

/** Seconds per stage at 1× speed (illustrative; real stages take minutes to hours). */
export const STAGE_SECONDS: Record<Stage3D, number> = {
  g1: 3,
  g2: 3,
  prophase: 5,
  metaphase: 4,
  anaphase: 4,
  telophase: 4,
  cytokinesis: 4.5,
};

/** Local progress where a stage shows its characteristic arrangement (stage stepping). */
export const STAGE_KEY_U: Record<Stage3D, number> = {
  g1: 0.5,
  g2: 0.6,
  prophase: 0.97,
  metaphase: 0.7,
  anaphase: 0.6,
  telophase: 0.95,
  cytokinesis: 1,
};

/** The runDivision stage whose chromosome sets each 3D stage shows. */
export const MODEL_STAGE: Record<Stage3D, StageId> = {
  g1: 'g1',
  g2: 'g2',
  prophase: 'prophase',
  metaphase: 'metaphase',
  anaphase: 'anaphase',
  telophase: 'telophase',
  cytokinesis: 'telophase',
};

/** Illustrative dimensions (cell units). */
export const ANIMAL = {
  radius: 5,
  nucleus: 2.4,
  pole: 4.2,
  poleAnaphase: 4.7,
  poleTelophase: 5,
  /** Stretch of the cell along the spindle axis at the end of anaphase (volume kept). */
  elongation: 0.18,
  clusterX: 3.5,
  telNucleusX: 3,
  telNucleusR: 1.6,
  /** Daughter radius for half the volume: R · 2^(−1/3). */
  daughterRadius: 5 * 2 ** (-1 / 3),
} as const;

export const PLANT = {
  /** Half extents of the (box-like) cell inside the wall. */
  half: [5.4, 3.8, 3.8] as const,
  wall: 0.3,
  nucleus: 2.4,
  pole: 4.4,
  poleAnaphase: 4.6,
  clusterX: 3.6,
  telNucleusX: 2.9,
  telNucleusR: 1.5,
} as const;

export { ROD_RADIUS, SISTER_OFFSET };
/**
 * Centre (x) of each animal daughter cell at the end of cytokinesis: far enough apart that the
 * two cells show a clear gap once the furrow has closed (they touched at 1.06 radii).
 */
export const ANIMAL_DAUGHTER_X = 1.2 * ANIMAL.daughterRadius;
const ANIMAL_CENTROSOME_END = ANIMAL_DAUGHTER_X + 2.1;
/** Interphase centrosome x: the G1 one sits at −x; S adds its copy at +x (both near the nucleus). */
const CENTROSOME_GAP = 0.45;
/**
 * Metaphase timing (fractions of the stage): kinetochore fibres reach the centromeres first
 * (attachment done at ATTACH_END), and only then pull the chromosomes to the equatorial plane
 * (motion from MOVE_START to MOVE_END). Shared by the animal and plant frames.
 */
const META_ATTACH_END = 0.15;
const META_MOVE_START = META_ATTACH_END;
const META_MOVE_END = 0.45;
/** How far the kinetochore fibres have pulled the chromosomes to the plate (0…1). */
const metaphasePull = (u: number) => ease(u, META_MOVE_START, META_MOVE_END);

/**
 * Stage meaning of the equatorial plate in this model, not a reading of the drawn positions:
 * the double chromosomes are held on the plate by kinetochore fibres from both poles once the
 * metaphase pull is complete (u ≥ META_MOVE_END) and until metaphase ends. Before that, and in
 * every other stage, no chromosome is held there (anaphase starts by pulling the sisters
 * apart). The poses use the same pull, so the drawn centromeres sit on x = 0 exactly then.
 */
export function heldOnPlate(stage: Stage3D, u: number): boolean {
  return stage === 'metaphase' && metaphasePull(u) === 1;
}
/**
 * Prophase timing (fractions of the stage). The nucleolus fades first; the nuclear envelope
 * breaks down (opacity below 0.5 from u = 0.375) before the spindle has grown far enough to
 * reach the nucleus, so no fibre is ever drawn inside an intact envelope (tested).
 */
const PRO_NUCLEOLUS = [0.02, 0.35] as const;
const PRO_ENVELOPE = [0.2, 0.55] as const;
const PRO_SPINDLE = [0.3, 0.95] as const;
/**
 * Telophase: the spindle has disassembled (u = 0.5) before the new envelopes reach 0.5 opacity
 * (u = 0.55), and the nucleoli re-form inside the new nuclei once the chromosomes decondense.
 */
const TEL_SPINDLE_END = 0.5;
const TEL_NUCLEOLUS = [0.55, 0.95] as const;

/** Centromere position (fraction along the chromatid) per pair; lengths: `PAIR_LENGTH`. */
const PAIR_CENTROMERE = [0.5, 0.4, 0.45, 0.33];

/** Static, per-chromatid data (built once per timeline). */
export interface ChromatidInfo {
  /** Index of the chromosome in the G1 cell of the model (pair-major, maternal first). */
  chromosome: number;
  sister: 0 | 1;
  pair: number;
  origin: Origin;
  /** Condensed arm lengths (arm A, arm B) from the centromere. */
  armA: number;
  armB: number;
  /** Interphase territory offset from the nucleus centre (G1/G2 nucleus). */
  territory: Vec3;
  /** Random orientation of the condensed chromosome in prophase. */
  orient: Vec3;
  /** Unit vector from sister 0 to sister 1 in prophase (x component ≥ 0). */
  sisterAxis: Vec3;
  /** Metaphase plate position (y, z) and in-plate direction of the long axis. */
  plate: Vec3;
  tangent: Vec3;
  /** Which of the pre-built chromatin thread shapes to use, and its fixed rotation. */
  threadVariant: number;
  threadRotation: Vec3;
}

export interface AnimalShape {
  type: 'animal';
  /** Stretch along x (volume kept): x × (1 + e), y and z × 1/√(1 + e). */
  elongation: number;
  /** Two-sphere profile in the unstretched frame: centres at ±offset, radius. */
  offset: number;
  radius: number;
  /** Contractile ring radius (world units) and whether it is shown. */
  ringRadius: number;
  ring: boolean;
  separated: boolean;
}

export interface PlantShape {
  type: 'plant';
  half: Vec3;
  wall: number;
  /** Cell plate growth 0…1 and its radius (clipped by the wall). */
  plate: number;
  plateRadius: number;
  separated: boolean;
}

export type CellShape = AnimalShape | PlantShape;

export interface Mitosis3DState {
  t: number;
  stage: Stage3D;
  stageIndex: number;
  /** Progress inside the stage, 0…1. */
  u: number;
  cellType: CellType;
  /** 0 = decondensed chromatin threads, 1 = fully condensed (metaphase). */
  condensation: number;
  /** Spindle assembly 0…1. */
  spindle: number;
  chromatids: ChromatidPose[];
  centromeres: CentromereState[];
  nuclei: NucleusState[];
  /** Animal only (plants have no centrosomes): 1 in G1, 2 from the start of G2 (copied in S). */
  centrosomes: Vec3[];
  fibres: Fibre[];
  shape: CellShape;
  /** Cells as they are at this moment (1 until cytokinesis completes, then 2). */
  cells: GeometricCell[];
}

export type StageWindow = Window<Stage3D>;

export interface Timeline {
  pairs: number;
  cellType: CellType;
  stages: StageWindow[];
  total: number;
  /** runDivision('mitosis', pairs) — the source of every count. */
  model: StageState[];
  chromatids: ChromatidInfo[];
  stageAt(t: number): { stage: Stage3D; index: number; u: number };
  /** Time at which a stage shows its characteristic arrangement. */
  keyTime(stage: Stage3D): number;
  stateAt(t: number): Mitosis3DState;
  counts(stage: Stage3D): Counts3D;
}

// ---------------------------------------------------------------- timeline

/** Builds the 3D mitosis timeline for a diploid cell with `pairs` homologous pairs. */
export function buildTimeline(pairs: number, cellType: CellType): Timeline {
  const model = runDivision('mitosis', pairs);
  const g2 = model.find((s) => s.stage === 'g2')?.cells[0];
  if (!g2) throw new Error('mitosis model has no G2 cell');
  const n2 = g2.chromosomes.length; // 2n
  const lengthScale = n2 > 8 ? Math.sqrt(8 / n2) : 1;
  const slots = plateLayout(n2);
  const nucleusR = cellType === 'animal' ? ANIMAL.nucleus : PLANT.nucleus;

  const chromatids: ChromatidInfo[] = [];
  g2.chromosomes.forEach((c, i) => {
    const rand = rng(97 + 31 * i);
    const territory = mul(randomInBall(rand), 0.55 * nucleusR);
    const orient = randomUnit(rand);
    // Sister axis: perpendicular to the long axis, pointing towards +x (sister 1 side).
    let axis = norm(cross(orient, randomUnit(rand)), norm(cross(orient, [0, 0, 1])));
    if (dot(axis, X) < 0) axis = mul(axis, -1);
    // No pairing in mitosis: maternal and paternal chromosomes alternate on the plate (even and
    // odd slots), and a paternal homologue sits about a quarter turn from its maternal partner
    // (never a half-ring of each origin; homologues are not neighbours when there is room).
    const slotIndex =
      c.origin === 'M' ? 2 * c.pair : 2 * ((c.pair + Math.floor(pairs / 2)) % pairs) + 1;
    const slot = slots[slotIndex] ?? slots[i] ?? { pos: v3(0, 0, 0), tangent: v3(0, 1, 0) };
    // Orient the plate direction like the prophase one, so the turn is at most 90°.
    const tangent = dot(slot.tangent, orient) < 0 ? mul(slot.tangent, -1) : slot.tangent;
    const L = (PAIR_LENGTH[c.pair % PAIR_LENGTH.length] ?? 1) * lengthScale;
    const cf = PAIR_CENTROMERE[c.pair % PAIR_CENTROMERE.length] ?? 0.5;
    const threadRotation: Vec3 = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
    for (const sister of [0, 1] as const) {
      const seg = c.chromatids[sister]?.[0];
      chromatids.push({
        chromosome: i,
        sister,
        pair: c.pair,
        origin: seg?.origin ?? c.origin,
        armA: L * cf,
        armB: L * (1 - cf),
        territory,
        orient,
        sisterAxis: axis,
        plate: slot.pos,
        tangent,
        // Sisters share the thread shape: the two daughter nuclei look alike (they are).
        threadVariant: i % 4,
        threadRotation,
      });
    }
  });

  const { stages, total, stageAt, keyTime, timeAt } = stageClock(
    STAGES_3D,
    STAGE_SECONDS,
    STAGE_KEY_U,
  );

  const stateAt = (t: number): Mitosis3DState => {
    const { stage, index, u } = stageAt(t);
    return computeState(Math.min(total, Math.max(0, t)), stage, index, u, cellType, chromatids);
  };

  const countsCache = new Map<Stage3D, Counts3D>();
  const counts = (stage: Stage3D): Counts3D => {
    const hit = countsCache.get(stage);
    if (hit) return hit;
    // Evaluated inside the stage (u = 1 is the stage's own end, not the next stage's start).
    const c = counts3d(stage, model, (s, u) => {
      const k = stages.findIndex((x) => x.id === s);
      return computeState(timeAt(s, u), s, Math.max(0, k), u, cellType, chromatids);
    });
    countsCache.set(stage, c);
    return c;
  };

  return { pairs, cellType, stages, total, model, chromatids, stageAt, keyTime, stateAt, counts };
}

/**
 * Counts of a 3D stage, read from the runDivision model. Telophase is shown as ONE cell with
 * TWO nuclei (each holding one of the two sets the model produces); cytokinesis gives the
 * model's two daughter cells. Nuclei per cell are read from the geometry at the stage's
 * start and end.
 */
export function counts3d(
  stage: Stage3D,
  model: StageState[],
  stateOf: (stage: Stage3D, u: number) => Mitosis3DState,
): Counts3D {
  const s = model.find((m) => m.stage === MODEL_STAGE[stage]);
  if (!s) throw new Error(`no model stage for ${stage}`);
  const nucleiPerCell = (u: number) => {
    const st = stateOf(stage, u);
    const nuclei = st.nuclei.filter((x) => x.envelope >= 0.5).length;
    return nuclei / Math.max(1, st.cells.length);
  };
  const nuclei = { from: nucleiPerCell(0), to: nucleiPerCell(1) };
  // Telophase: one cell holding both sets (the model lists them as its two future daughters).
  return countsFromModel(s, stage === 'telophase' ? 2 : 1, nuclei);
}

// ---------------------------------------------------------------- state at one moment

interface Frame {
  /** Spindle poles (fibre anchors): animal = centrosomes, plant = broad polar regions. */
  poles: [Vec3, Vec3];
  centrosomes: Vec3[];
  condensation: number;
  spindle: number;
  /** Kinetochore fibre attachment 0…1. */
  attach: number;
  nuclei: NucleusState[];
  shape: CellShape;
  /** Daughter nucleus centres (x) for telophase / cytokinesis. */
  daughterX: number;
}

function animalFrame(stage: Stage3D, u: number): Frame {
  const A = ANIMAL;
  const top = A.nucleus + 0.8;
  const pole = (x: number): [Vec3, Vec3] => [v3(-x, 0, 0), v3(x, 0, 0)];
  const shape = (e: number, f = 0): AnimalShape => {
    const offset = f * ANIMAL_DAUGHTER_X;
    const radius = lerp(A.radius, A.daughterRadius, f);
    const separated = offset >= radius;
    const ringLocal = separated ? 0 : Math.sqrt(radius * radius - offset * offset);
    return {
      type: 'animal',
      elongation: e,
      offset,
      radius,
      ringRadius: ringLocal / Math.sqrt(1 + e),
      ring: stage === 'cytokinesis' && !separated,
      separated,
    };
  };
  const one = (envelope: number, nucleolus = 1): NucleusState[] => [
    { center: v3(0, 0, 0), radius: A.nucleus, envelope, nucleolus, cell: 0 },
  ];
  const gap = CENTROSOME_GAP;
  switch (stage) {
    case 'g1':
      return {
        poles: [v3(-gap, top, 0), v3(-gap, top, 0)],
        centrosomes: [v3(-gap, top, 0)],
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: one(1),
        shape: shape(0),
        daughterX: 0,
      };
    case 'g2': {
      // Already duplicated in S (between G1 and G2): the copy sits next to the original.
      const cs: [Vec3, Vec3] = [v3(-gap, top, 0), v3(gap, top, 0)];
      return {
        poles: cs,
        centrosomes: [...cs],
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: one(1),
        shape: shape(0),
        daughterX: 0,
      };
    }
    case 'prophase': {
      // The two centrosomes travel around the nucleus to opposite poles.
      const k = ease(u, 0.05, 0.85);
      const r0 = Math.hypot(gap, top);
      const r = lerp(r0, A.pole, k);
      const a0 = Math.atan2(top, -gap);
      const a1 = Math.atan2(top, gap);
      const cs: [Vec3, Vec3] = [
        v3(r * Math.cos(lerp(a0, Math.PI, k)), r * Math.sin(lerp(a0, Math.PI, k)), 0),
        v3(r * Math.cos(lerp(a1, 0, k)), r * Math.sin(lerp(a1, 0, k)), 0),
      ];
      return {
        poles: cs,
        centrosomes: [...cs],
        condensation: 0.85 * ease(u, 0, 0.7),
        spindle: ease(u, ...PRO_SPINDLE),
        attach: 0,
        nuclei: one(1 - ease(u, ...PRO_ENVELOPE), 1 - ease(u, ...PRO_NUCLEOLUS)),
        shape: shape(0),
        daughterX: 0,
      };
    }
    case 'metaphase':
      return {
        poles: pole(A.pole),
        centrosomes: pole(A.pole),
        condensation: lerp(0.85, 1, ease(u, 0, 0.4)),
        spindle: 1,
        // Fibres attach before the chromosomes move (see META_MOVE_START in computeState).
        attach: ease(u, 0, META_ATTACH_END),
        nuclei: [],
        shape: shape(0),
        daughterX: 0,
      };
    case 'anaphase': {
      const x = lerp(A.pole, A.poleAnaphase, ease(u, 0.2, 0.9));
      return {
        poles: pole(x),
        centrosomes: pole(x),
        condensation: 1,
        spindle: 1,
        attach: 1,
        nuclei: [],
        shape: shape(A.elongation * ease(u, 0.2, 0.95)),
        daughterX: 0,
      };
    }
    case 'telophase': {
      const x = lerp(A.poleAnaphase, A.poleTelophase, ease(u, 0, 0.6));
      const sp = 1 - ease(u, 0, TEL_SPINDLE_END);
      const r = A.telNucleusR * (0.6 + 0.4 * ease(u, 0.1, 0.85));
      const env = ease(u, 0.25, 0.85);
      const nl = ease(u, ...TEL_NUCLEOLUS);
      return {
        poles: pole(x),
        centrosomes: pole(x),
        condensation: 1 - ease(u, 0.1, 0.8),
        spindle: sp,
        attach: sp,
        nuclei: [
          { center: v3(-A.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
          { center: v3(A.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
        ],
        shape: shape(A.elongation),
        daughterX: A.telNucleusX,
      };
    }
    case 'cytokinesis': {
      const f = ease(u, 0.05, 0.85);
      const s = shape(A.elongation * (1 - f), f);
      const nx = lerp(A.telNucleusX, ANIMAL_DAUGHTER_X, f);
      const cx = lerp(A.poleTelophase, ANIMAL_CENTROSOME_END, f);
      return {
        poles: pole(cx),
        centrosomes: pole(cx),
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: [
          { center: v3(-nx, 0, 0), radius: A.telNucleusR, envelope: 1, nucleolus: 1, cell: 0 },
          {
            center: v3(nx, 0, 0),
            radius: A.telNucleusR,
            envelope: 1,
            nucleolus: 1,
            cell: s.separated ? 1 : 0,
          },
        ],
        shape: s,
        daughterX: nx,
      };
    }
  }
}

function plantFrame(stage: Stage3D, u: number): Frame {
  const P = PLANT;
  const pole = (x: number): [Vec3, Vec3] => [v3(-x, 0, 0), v3(x, 0, 0)];
  const shape = (p = 0): PlantShape => ({
    type: 'plant',
    half: [...P.half],
    wall: P.wall,
    plate: p,
    plateRadius: p * Math.hypot(P.half[1], P.half[2]),
    separated: p >= 1,
  });
  const one = (envelope: number, nucleolus = 1): NucleusState[] => [
    { center: v3(0, 0, 0), radius: P.nucleus, envelope, nucleolus, cell: 0 },
  ];
  const base = { centrosomes: [] as Vec3[], poles: pole(P.pole), daughterX: 0 };
  switch (stage) {
    case 'g1':
    case 'g2':
      return { ...base, condensation: 0, spindle: 0, attach: 0, nuclei: one(1), shape: shape() };
    case 'prophase':
      return {
        ...base,
        condensation: 0.85 * ease(u, 0, 0.7),
        spindle: ease(u, ...PRO_SPINDLE),
        attach: 0,
        nuclei: one(1 - ease(u, ...PRO_ENVELOPE), 1 - ease(u, ...PRO_NUCLEOLUS)),
        shape: shape(),
      };
    case 'metaphase':
      return {
        ...base,
        condensation: lerp(0.85, 1, ease(u, 0, 0.4)),
        spindle: 1,
        // Fibres attach before the chromosomes move (see META_MOVE_START in computeState).
        attach: ease(u, 0, META_ATTACH_END),
        nuclei: [],
        shape: shape(),
      };
    case 'anaphase':
      return {
        ...base,
        poles: pole(lerp(P.pole, P.poleAnaphase, ease(u, 0.2, 0.9))),
        condensation: 1,
        spindle: 1,
        attach: 1,
        nuclei: [],
        shape: shape(),
      };
    case 'telophase': {
      const sp = 1 - ease(u, 0, TEL_SPINDLE_END);
      const r = P.telNucleusR * (0.6 + 0.4 * ease(u, 0.1, 0.85));
      const env = ease(u, 0.25, 0.85);
      const nl = ease(u, ...TEL_NUCLEOLUS);
      return {
        ...base,
        poles: pole(P.poleAnaphase),
        condensation: 1 - ease(u, 0.1, 0.8),
        spindle: sp,
        attach: sp,
        nuclei: [
          { center: v3(-P.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
          { center: v3(P.telNucleusX, 0, 0), radius: r, envelope: env, nucleolus: nl, cell: 0 },
        ],
        shape: shape(),
        daughterX: P.telNucleusX,
      };
    }
    case 'cytokinesis': {
      const p = ease(u, 0.05, 0.85);
      const s = shape(p);
      const nx = lerp(P.telNucleusX, P.half[0] / 2, p);
      return {
        ...base,
        poles: pole(P.poleAnaphase),
        condensation: 0,
        spindle: 0,
        attach: 0,
        nuclei: [
          { center: v3(-nx, 0, 0), radius: P.telNucleusR, envelope: 1, nucleolus: 1, cell: 0 },
          {
            center: v3(nx, 0, 0),
            radius: P.telNucleusR,
            envelope: 1,
            nucleolus: 1,
            cell: s.separated ? 1 : 0,
          },
        ],
        shape: s,
        daughterX: nx,
      };
    }
  }
}

/** Key poses of one chromatid (centromere + arm directions). */
interface Pose {
  c: Vec3;
  a: Vec3;
  b: Vec3;
}

/**
 * Pose inside the nucleus, from G1 to the end of prophase: sisters side by side around the
 * territory. Sister 0 already sits here in G1, so the sister made in S (shown from the start
 * of G2) appears next to it without anything jumping.
 */
function prophasePose(info: ChromatidInfo, side: -1 | 1): Pose {
  const off = mul(info.sisterAxis, side * SISTER_OFFSET);
  const splay = mul(info.sisterAxis, SPLAY * side);
  return {
    c: add(info.territory, off),
    a: norm(add(info.orient, splay)),
    b: norm(add(mul(info.orient, -1), splay)),
  };
}

function platePose(info: ChromatidInfo, side: -1 | 1): Pose {
  const splay = mul(X, SPLAY * side);
  return {
    c: add(info.plate, mul(X, side * SISTER_OFFSET)),
    a: norm(add(info.tangent, splay)),
    b: norm(add(mul(info.tangent, -1), splay)),
  };
}

function anaphaseEndPose(info: ChromatidInfo, side: -1 | 1, clusterX: number): Pose {
  // Pulled by the centromere: both arms trail towards the equator (V shape).
  const back = mul(X, -side * 0.85);
  return {
    c: v3(side * clusterX, info.plate[1] * 0.55, info.plate[2] * 0.55),
    a: norm(add(back, mul(info.tangent, 0.5))),
    b: norm(add(back, mul(info.tangent, -0.5))),
  };
}

function mix(p: Pose, q: Pose, k: number): Pose {
  return {
    c: lerpV(p.c, q.c, k),
    a: norm(lerpV(p.a, q.a, k), p.a),
    b: norm(lerpV(p.b, q.b, k), p.b),
  };
}

function computeState(
  t: number,
  stage: Stage3D,
  stageIndex: number,
  u: number,
  cellType: CellType,
  infos: ChromatidInfo[],
): Mitosis3DState {
  const frame = cellType === 'animal' ? animalFrame(stage, u) : plantFrame(stage, u);
  const nucleusR = cellType === 'animal' ? ANIMAL.nucleus : PLANT.nucleus;
  const telR = cellType === 'animal' ? ANIMAL.telNucleusR : PLANT.telNucleusR;
  const clusterX = cellType === 'animal' ? ANIMAL.clusterX : PLANT.clusterX;
  const telX = cellType === 'animal' ? ANIMAL.telNucleusX : PLANT.telNucleusX;

  const chromatids: ChromatidPose[] = infos.map((info, id) => {
    const side: -1 | 1 = info.sister === 0 ? -1 : 1;
    const inDaughter = (x: number): Pose => {
      const end = anaphaseEndPose(info, side, clusterX);
      return {
        c: add(v3(side * x, 0, 0), mul(info.territory, telR / nucleusR)),
        a: end.a,
        b: end.b,
      };
    };
    let pose: Pose;
    let joined = true;
    let present = true;
    switch (stage) {
      case 'g1':
        // Sister 1 is made in S (not its own step): it exists from the start of G2.
        present = info.sister === 0;
        pose = prophasePose(info, side);
        break;
      case 'g2':
      case 'prophase':
        pose = prophasePose(info, side);
        break;
      case 'metaphase':
        // Pulled to the plate by the kinetochore fibres, which are attached by META_MOVE_START.
        pose = mix(prophasePose(info, side), platePose(info, side), metaphasePull(u));
        break;
      case 'anaphase':
        joined = false;
        pose = mix(platePose(info, side), anaphaseEndPose(info, side, clusterX), ease(u, 0, 0.85));
        break;
      case 'telophase':
        joined = false;
        pose = mix(anaphaseEndPose(info, side, clusterX), inDaughter(telX), ease(u, 0, 0.8));
        break;
      case 'cytokinesis':
        joined = false;
        pose = inDaughter(frame.daughterX);
        break;
    }
    return {
      id,
      chromosome: info.chromosome,
      sister: info.sister,
      origin: info.origin,
      present,
      joined: joined && stage !== 'g1',
      centromere: pose.c,
      dirA: pose.a,
      dirB: pose.b,
      side,
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

  const fibres = spindleFibres(cellType, frame, chromatids, stage);
  const separated = frame.shape.separated;
  const present = chromatids.filter((c) => c.present);
  const cells: GeometricCell[] = separated
    ? [-1, 1].map((side) => ({
        center: v3(
          side *
            (frame.shape.type === 'animal'
              ? frame.shape.offset * (1 + frame.shape.elongation)
              : frame.shape.half[0] / 2),
          0,
          0,
        ),
        chromatids: present.filter((c) => c.side === side).map((c) => c.id),
      }))
    : [{ center: v3(0, 0, 0), chromatids: present.map((c) => c.id) }];

  return {
    t,
    stage,
    stageIndex,
    u,
    cellType,
    condensation: frame.condensation,
    spindle: frame.spindle,
    chromatids,
    centromeres,
    nuclei: frame.nuclei,
    centrosomes: frame.centrosomes,
    fibres,
    shape: frame.shape,
    cells,
  };
}

function spindleFibres(
  cellType: CellType,
  frame: Frame,
  chromatids: ChromatidPose[],
  stage: Stage3D,
): Fibre[] {
  const out: Fibre[] = [];
  const sp = frame.spindle;
  if (sp <= 1e-4) return out;
  const plant = cellType === 'plant';
  for (const k of [0, 1] as const) {
    const p = frame.poles[k];
    const q = frame.poles[k === 0 ? 1 : 0];
    const d = sub(q, p);
    if (len(d) < 1e-6) continue;
    const dh = norm(d);
    const [e1, e2] = basis(dh);
    // Polar (interpolar) fibres: from each pole past the equator, overlapping in the middle.
    for (let j = 0; j < 6; j++) {
      const th = (j * Math.PI) / 3 + k * (Math.PI / 6);
      const ring = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th)));
      const from = plant ? add(p, mul(ring, 1.1)) : p;
      const end = add(add(p, mul(d, 0.6)), mul(ring, plant ? 1.6 : 1.5));
      out.push({ kind: 'polar', from, to: lerpV(from, end, sp), pole: k });
    }
    // Astral microtubules radiate from centrosomes (animal cells only).
    if (!plant) {
      for (let j = 0; j < 8; j++) {
        const ph = (j * Math.PI) / 4;
        const dir = norm(
          add(mul(dh, -0.55), mul(add(mul(e1, Math.cos(ph)), mul(e2, Math.sin(ph))), 0.85)),
        );
        out.push({ kind: 'astral', from: p, to: add(p, mul(dir, 0.9 * sp)), pole: k });
      }
    }
  }
  // Kinetochore fibres: sister 0 to the −x pole, sister 1 to the +x pole (both poles reach
  // every double chromosome in metaphase).
  const attach = frame.attach;
  if (attach > 1e-4 && (stage === 'metaphase' || stage === 'anaphase' || stage === 'telophase')) {
    for (const c of chromatids) {
      if (!c.present) continue;
      const k: 0 | 1 = c.sister === 0 ? 0 : 1;
      const p = frame.poles[k];
      const from = plant ? add(p, v3(0, c.centromere[1] * 0.45, c.centromere[2] * 0.45)) : p;
      out.push({
        kind: 'kinetochore',
        from,
        to: lerpV(from, c.centromere, attach),
        chromatid: c.id,
        pole: k,
      });
    }
  }
  return out;
}

/** True when a point lies inside the cell (tests: nothing is drawn outside the cell). */
export function insideCell(shape: CellShape, p: Vec3, margin = 0): boolean {
  if (shape.type === 'plant') {
    return (
      Math.abs(p[0]) <= shape.half[0] - margin &&
      Math.abs(p[1]) <= shape.half[1] - margin &&
      Math.abs(p[2]) <= shape.half[2] - margin
    );
  }
  const s = 1 + shape.elongation;
  const x = p[0] / s;
  const r = Math.hypot(p[1], p[2]) * Math.sqrt(s);
  const inside = (cx: number) => Math.hypot(x - cx, r) <= shape.radius - margin;
  return inside(-shape.offset) || inside(shape.offset);
}
