import type { PieceViewFactory } from '../types';
import {
  balance,
  boilingTube,
  bufferBottle,
  dispensingSyringe,
  gasSyringe,
  membraneLens,
  reactionTube,
  solutionBottle,
  stopwatch,
  timer,
  tissueSample,
  waterBath,
} from './bio-lab';
import {
  eyepieceField,
  focusKnob,
  lampIndicator,
  microscopeStage,
  nosepiece,
  coverslip,
  slide,
  specimen,
  stainBottle,
} from './bio-microscope';
import {
  capillaryScale,
  fan,
  heatFilter,
  hygrometer,
  lamp,
  lampRule,
  plant,
  stomataLens,
} from './bio-plants';
import { parentPlant, punnettBoard, seedCounter, seedTray } from './bio-genetics';
import './bio.css';

/*
 * The Biology workspace piece views by kind (docs/experiment-workspace-design.md, Biology D).
 * The measure overlay and the Inspect legend are part of the eyepiece field, not kinds of their own.
 */
export const BIO_PIECES: Readonly<Record<string, PieceViewFactory>> = {
  specimen,
  'stain-bottle': stainBottle,
  slide,
  coverslip,
  'microscope-stage': microscopeStage,
  nosepiece,
  'focus-knob': focusKnob,
  'lamp-indicator': lampIndicator,
  'eyepiece-field': eyepieceField,
  'solution-bottle': solutionBottle,
  'buffer-bottle': bufferBottle,
  'tissue-sample': tissueSample,
  'boiling-tube': boilingTube,
  'membrane-lens': membraneLens,
  timer,
  balance,
  'dispensing-syringe': dispensingSyringe,
  'water-bath': waterBath,
  'reaction-tube': reactionTube,
  'gas-syringe': gasSyringe,
  stopwatch,
  'lamp-rule': lampRule,
  'heat-filter': heatFilter,
  plant,
  'capillary-scale': capillaryScale,
  fan,
  hygrometer,
  'stomata-lens': stomataLens,
  lamp,
  'parent-plant': parentPlant,
  'punnett-board': punnettBoard,
  'seed-tray': seedTray,
  'seed-counter': seedCounter,
};

/**
 * Kinds Chemistry draws too (an instrument in the other subject's look). The host's registry is
 * one record by kind, so these are registered here under a `bio-` kind so neither subject
 * overwrites the other; a host that registers a subject's pieces separately can take `BIO_PIECES`.
 */
const SHARED = ['balance', 'timer', 'stopwatch', 'water-bath', 'boiling-tube'] as const;

/** What the host's registry collects (`pieces`): every Biology kind, the shared ones as `bio-<kind>`. */
export const pieces: Readonly<Record<string, PieceViewFactory>> = Object.fromEntries(
  Object.entries(BIO_PIECES).map(([kind, view]) => [
    (SHARED as readonly string[]).includes(kind) ? `bio-${kind}` : kind,
    view,
  ]),
);
