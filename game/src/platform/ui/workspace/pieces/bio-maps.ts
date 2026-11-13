import type { SetupProgress } from '../../../../gameplay/experiment/StationSystem';
import type { ExperimentWorkspace } from '../../../../simulation/experiment';
import {
  CAPILLARY_ML,
  cylinderLength,
  GAS_SYRINGE_CAPACITY,
  TUBE_LENGTH,
} from '../../../labVisuals/biology';
import { fraction } from '../../../labVisuals/readouts';

/*
 * Pure mappings of the Biology pieces (no DOM): from the station's values to the numbers a piece
 * draws. Everything is a drawing of a model value; none computes biology.
 */

/** What of a prepared slide is done: a stage no applying setup step covers is taken as already so (a prepared slide). */
export interface SlideStages {
  /** The slide lies on the prep tile. */
  tile: boolean;
  specimen: boolean;
  stained: boolean;
  covered: boolean;
  /** The slide lies on the microscope's stage. */
  onStage: boolean;
}

/**
 * The stages of a slide from the setup steps that apply now (`view.setup`) and the workspace's
 * pieces and materials: a step placing the slide piece is the tile, one placing a material that
 * sets `specimen` / `stain` (or the stain bottles themselves) is that stage, one placing a
 * coverslip piece is the cover, and one placing the slide onto the stage piece is the stage.
 */
export function slideStages(
  setup: readonly SetupProgress[],
  workspace: ExperimentWorkspace | undefined,
  out: SlideStages,
): SlideStages {
  out.tile = out.specimen = out.stained = out.covered = out.onStage = true;
  for (const { step, done } of setup) {
    if (done) continue;
    const piece = workspace?.pieces.find((p) => p.id === step.place);
    const onto = workspace?.pieces.find((p) => p.id === step.onto);
    const sets = workspace?.materials.find((m) => m.id === step.place)?.sets?.parameter;
    if (onto?.kind === 'microscope-stage') out.onStage = false;
    else if (piece?.kind === 'slide') out.tile = false;
    else if (piece?.kind === 'coverslip') out.covered = false;
    else if (sets === 'specimen') out.specimen = false;
    else if (sets === 'stain' || piece?.kind === 'stain-bottle') out.stained = false;
  }
  return out;
}

/** A bubble rises for `riseTime` model seconds after the volume passes a whole bubble. */
export const RISE_TIME = 2;
/** At most this many bubbles are drawn at once. */
export const BUBBLE_POOL = 6;

/**
 * Bubbles leaving the plant: one per increment of the model's bubble count, born at the model's
 * time of that increment and rising for `RISE_TIME` model seconds, so they move when the run does
 * and are the same every time. A count that falls, or no count, empties the ring.
 */
export class BubbleRing {
  readonly born: number[] = [];
  private last = Number.NaN;

  /** Notes the count at model time `now`. */
  update(count: number, now: number): void {
    if (!Number.isFinite(count) || !Number.isFinite(now) || count < this.last) this.born.length = 0;
    if (Number.isFinite(count) && Number.isFinite(now)) {
      // A count first seen part-way through a run starts no bubbles: they begin at the next one.
      const fresh = Number.isFinite(this.last) ? Math.min(BUBBLE_POOL, count - this.last) : 0;
      for (let i = 0; i < fresh; i++) {
        if (this.born.length === BUBBLE_POOL) this.born.shift();
        this.born.push(now);
      }
      this.last = count;
    } else this.last = Number.NaN;
  }

  /** How far bubble `i` has risen, 0–1, or −1 when it is gone (or never was). */
  progress(i: number, now: number): number {
    const born = this.born[i];
    if (born === undefined || !Number.isFinite(now)) return -1;
    const k = (now - born) / RISE_TIME;
    return k >= 1 || k < 0 ? -1 : k;
  }
}

/** The largest value of a quantity within one run, forgotten when the run ends or another starts. */
export class RunMax {
  value = 0;
  private run: unknown = null;

  update(run: unknown, value: number): number {
    if (run !== this.run) {
      this.run = run;
      this.value = 0;
    }
    if (Number.isFinite(value) && value > this.value) this.value = value;
    return this.value;
  }
}

/** The share of a bubble pool shown at `rate`: √(rate/max), as the 3D rig's froth; none without a rate. */
export function bubbleShare(rate: number, max: number): number {
  return rate > 0 && max > 0 ? Math.sqrt(Math.min(rate / max, 1)) : 0;
}

/** A potato cylinder's length (mass `grams`, began at `initial`) as a fraction of the boiling tube's length. */
export const cylinderFraction = (grams: number, initial: number): number => {
  const length = cylinderLength(grams, initial);
  return Number.isFinite(length) ? Math.min(1, length / TUBE_LENGTH) : 0;
};

/** The gas syringe's plunger position: the oxygen collected as a fraction of its scale. */
export const plungerFraction = (millilitres: number): number =>
  fraction(millilitres, 0, GAS_SYRINGE_CAPACITY);

/** The gas column in the photosynthesis capillary as a fraction of its length. */
export const columnFraction = (millilitres: number): number =>
  fraction(millilitres, 0, CAPILLARY_ML);

/** Units a resolution or a scale may be given in, in metres or mL (a capillary's marks are drawn only where the units are known). */
const UNIT: Readonly<Record<string, number>> = { m: 1, mm: 1e-3, mL: 1 };

/** `unit` as a multiple of `of`, or NaN where either is unknown (then no scale is drawn). */
export function unitRatio(unit: string, of: string): number {
  const a = UNIT[unit];
  const b = UNIT[of];
  return a !== undefined && b !== undefined ? a / b : Number.NaN;
}

/** Scale marks: the positions (0–1) of a mark every `step` along a scale of `length`, at most `max`; none for a step that is not a fraction of it. */
export function scaleMarks(step: number, length: number, out: number[], max = 400): number[] {
  out.length = 0;
  if (!(step > 0) || !(length > 0) || length / step > max) return out;
  for (let i = 0; i * step <= length * (1 + 1e-9); i++) out.push((i * step) / length);
  return out;
}
