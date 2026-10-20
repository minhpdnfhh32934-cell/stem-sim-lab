import {
  COMPONENTS,
  componentsFor,
  type ComponentId,
} from '@/biology/division/mitosis3d/components';
import { timelineFor } from '@/biology/division/mitosis3d/store';
import {
  STAGES_3D,
  heldOnPlate,
  type Stage3D,
  type Timeline,
} from '@/biology/division/mitosis3d/timeline';
import type { LocalizedText } from '@/core/data/dataset';
import type { BiologyBinding, StudioScenario } from '../scenario';
import type { Prediction, Verdict } from '../session';

export function biologyOf(scenario: StudioScenario): BiologyBinding | null {
  return scenario.binding.kind === 'biology' ? scenario.binding : null;
}

export function isComponentId(id: string): id is ComponentId {
  return Object.hasOwn(COMPONENTS, id);
}

/** The binding's parts that the model knows, in the binding's order. */
export function taskParts(b: BiologyBinding): ComponentId[] {
  return b.parts.filter(isComponentId);
}

/**
 * Chromosome arrangement of a stage at its key moment. Every number comes from the model, none
 * from the drawn positions: the chromosomes and their state (double or single) from the
 * bookkeeping (`runDivision`), the plate from the stage's meaning in the model (`heldOnPlate`).
 */
export interface StageArrangement {
  stage: Stage3D;
  /** Chromosomes present in the whole picture (each has one centromere). */
  chromosomes: number;
  /** Of these, double chromosomes (two sister chromatids still joined at the centromere). */
  double: number;
  /** Centromeres the model holds on the equatorial plate (double chromosomes only). */
  onPlane: number;
}

export function arrangementAt(tl: Timeline, stage: Stage3D): StageArrangement {
  const time = tl.keyTime(stage);
  const cs = tl.stateAt(time).centromeres;
  const double = cs.filter((c) => c.sisters.length === 2).length;
  return {
    stage,
    chromosomes: cs.length,
    double,
    onPlane: heldOnPlate(stage, tl.stageAt(time).u) ? double : 0,
  };
}

/** "Double chromosomes line up in one row on the equatorial plane." */
function equatorRow(a: StageArrangement): boolean {
  return a.chromosomes > 0 && a.double === a.chromosomes && a.onPlane === a.chromosomes;
}

const STAGE_QUESTIONS: Record<BiologyBinding['stageQuestion'], (a: StageArrangement) => boolean> = {
  equatorRow,
};

export function questionHolds(q: BiologyBinding['stageQuestion'], a: StageArrangement): boolean {
  return STAGE_QUESTIONS[q](a);
}

/** Every stage where the model shows the arrangement the question asks about. */
export function stagesWhere(tl: Timeline, q: BiologyBinding['stageQuestion']): Stage3D[] {
  return STAGES_3D.filter((stage) => questionHolds(q, arrangementAt(tl, stage)));
}

/** The one stage the model singles out; null when none or several do (no answer is guessed). */
export function answerStage(tl: Timeline, q: BiologyBinding['stageQuestion']): Stage3D | null {
  const found = stagesWhere(tl, q);
  return found.length === 1 ? (found[0] ?? null) : null;
}

export function bioVerdict(
  answer: Stage3D | null,
  prediction: Prediction | null,
  labelOf: (stage: Stage3D) => LocalizedText,
): Verdict {
  return {
    correct: answer,
    correctText: answer ? labelOf(answer) : null,
    match: answer === null || !prediction ? null : prediction.choice === answer,
  };
}

export type BindingProblem = 'unknownPart' | 'wrongCell' | 'noAnswer';

/** What keeps a scenario from running on the model (empty = it runs). */
export function bindingProblems(b: BiologyBinding): BindingProblem[] {
  const out: BindingProblem[] = [];
  if (taskParts(b).length !== b.parts.length) out.push('unknownPart');
  const parts = componentsFor(b.cellType);
  if (taskParts(b).some((p) => !parts.includes(p))) out.push('wrongCell');
  if (answerStage(timelineFor(b.pairs, b.cellType), b.stageQuestion) === null) {
    out.push('noAnswer');
  }
  return out;
}
