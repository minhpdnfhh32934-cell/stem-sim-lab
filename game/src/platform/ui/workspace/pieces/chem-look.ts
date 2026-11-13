import {
  bedShare,
  deliveredShown,
  hexToLinear,
  indicatorFor,
  type Indicator,
  indicatorTint,
  INDICATORS,
  precipitateOpacity,
  precipitateRgb,
  violetLinear,
  WATER,
} from '../../../labVisuals/chemistry';
import { p, v, type Frame } from './chem-kit';

/*
 * What a Chemistry piece draws, from a `Frame` (the pure part: numbers in, numbers out, no DOM).
 * Colours and levels come from `labVisuals/chemistry.ts`, the same maps the 3D benches use. A
 * quantity the piece does not show, or a model value that is NaN (no run), gives the idle look.
 */

const first = (a: number, b: number): number => (Number.isFinite(a) ? a : b);

// ---- the liquid's colour ----------------------------------------------------------------------

export type TintKind = 'none' | 'indicator' | 'violet';

export interface Tint {
  kind: TintKind;
  /** Linear RGB, as the 3D renderer is given it. */
  rgb: [number, number, number];
  opacity: number;
  /** For an indicator: 0 below its colour-change range (acid form), 1 inside it, 2 above (base form). */
  form: 0 | 1 | 2;
}

export const newTint = (): Tint => ({ kind: 'none', rgb: [...WATER], opacity: 1, form: 0 });

/**
 * The liquid's colour: an indicator's at the model's pH when the endpoint setting names which
 * indicator it is, else the dye's at the model's absorbance, else the clear solution's own tint.
 * The indicator is found again only when its setting changes.
 */
export function tintReader(): (f: Frame, out: Tint) => void {
  let endpoint = Number.NaN;
  let indicator: Indicator = INDICATORS[0];
  return (f, out) => {
    const pH = v(f, 'pH');
    const end = p(f, 'endpointPH');
    if (Number.isFinite(pH) && Number.isFinite(end)) {
      if (end !== endpoint) {
        endpoint = end;
        indicator = indicatorFor(end);
      }
      indicatorTint(indicator, pH, out.rgb);
      out.kind = 'indicator';
      out.opacity = 1;
      const [lo, hi] = indicator.range;
      out.form = pH < lo ? 0 : pH > hi ? 2 : 1;
      return;
    }
    const a = v(f, 'absorbance');
    if (Number.isFinite(a)) {
      out.opacity = violetLinear(a, out.rgb);
      out.kind = 'violet';
      return;
    }
    out.rgb[0] = WATER[0];
    out.rgb[1] = WATER[1];
    out.rgb[2] = WATER[2];
    out.kind = 'none';
    out.opacity = 1;
  };
}

/** The precipitate in the liquid: its colour (by the model's product code) and how much shows (0 for none). */
export function precipitateTint(f: Frame, rgb: [number, number, number]): number {
  const product = v(f, 'product');
  const hex = precipitateRgb(product);
  if (hex === null) return 0;
  hexToLinear(hex, rgb);
  return precipitateOpacity(v(f, 'precipitatedPercent'));
}

// ---- what a vessel holds ----------------------------------------------------------------------

/**
 * The liquid in a vessel (mL), NaN for none. A vessel with a sample of its own (a pipetted acid, a
 * measured test solution) holds it plus what has run in; one without holds the model's volume.
 */
export function contentsMl(f: Frame): number {
  const own = first(first(p(f, 'acidVolume'), p(f, 'sampleVolume')), p(f, 'waterVolume'));
  if (Number.isFinite(own)) return own + deliveredShown(first(v(f, 'volumeAdded'), v(f, 'volume')));
  return v(f, 'volume');
}

/** The share (0-1) of `whole` that `part` is; 0 where either is not a number. */
export function share(part: number, whole: number): number {
  return part >= 0 && whole > 0 ? Math.min(part / whole, 1) : 0;
}

/** The crystal bed's share (0-1) of the fullest one, the 3D bench's map: none after the run, none without a solid. */
export const bedOf = (f: Frame): number =>
  f.completed ? 0 : bedShare(v(f, 'undissolved'), p(f, 'solute'));
/** The share of the weighed salt crystallised (separation); NaN-safe. */
export const crystalShare = (f: Frame): number => share(v(f, 'crystalMass'), p(f, 'saltMass'));

// ---- a burette --------------------------------------------------------------------------------

/** Standard burette sizes (mL). */
export const BURETTES = [10, 25, 50] as const;

/** The burette's scale: the smallest standard size holding the reagent volume the definition names, else 50 mL. */
export function buretteScale(initial: Readonly<Record<string, number>>): number {
  const volume = initial.reagentVolume;
  return BURETTES.find((size) => volume !== undefined && size >= volume) ?? 50;
}

/** The mL delivered: from the volume the model reports, 0 without a run. */
export const delivered = (f: Frame): number =>
  deliveredShown(first(v(f, 'volume'), v(f, 'volumeAdded')));

// ---- a pH meter -------------------------------------------------------------------------------

/** How far the electrode is lowered (0-1): the time immersed over the time the meter is given to settle. */
export function electrodeDepth(f: Frame): number {
  const t = v(f, 'immersionTime');
  if (!Number.isFinite(t)) return 0;
  const settle = p(f, 'readTime');
  return settle > 0 ? Math.min(Math.max(t / settle, 0), 1) : f.running ? 1 : 0;
}

// ---- setup progress ---------------------------------------------------------------------------

/** What the before-run setup steps onto a piece say: none apply, none done yet, or one is done. */
export const NO_STEPS = 0;
export const PENDING = 1;
export const DONE = 2;
export function intoState(f: Frame, pieceId: string): 0 | 1 | 2 {
  let state: 0 | 1 | 2 = NO_STEPS;
  for (const { step, done } of f.view.setup) {
    if (step.onto !== pieceId || step.phase !== 'before-run') continue;
    if (done) return DONE;
    state = PENDING;
  }
  return state;
}

/** Whether a piece that something was put into has been emptied (the step that moves it on is done). */
export function emptied(f: Frame, pieceId: string): boolean {
  let any = false;
  for (const { step, done } of f.view.setup) {
    if (step.place !== pieceId || step.phase !== 'before-run') continue;
    any = true;
    if (!done) return false;
  }
  return any;
}
