import { translate, type MessageKey, type MessageParams } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import { formatFormula } from '@/chemistry/formula';
import type { ChemistryBinding, StudioScenario } from '../scenario';
import type { EngineEvidence, EngineFact, Prediction, Verdict } from '../session';
import {
  equationString,
  LIBRARY_MODEL,
  libraryModelId,
  mixKey,
  mixOutcome,
  type MixOutcome,
} from './library';

/** Prediction choices of a precipitation question. */
export const CHEM_CHOICES = ['precipitate', 'noPrecipitate'] as const;
export type ChemChoice = (typeof CHEM_CHOICES)[number];

export function chemistryOf(scenario: StudioScenario): ChemistryBinding | null {
  return scenario.binding.kind === 'chemistry' ? scenario.binding : null;
}

/** True when the tube holds exactly the question's two solutions (any order). */
export function isTargetMix(b: ChemistryBinding, contents: readonly string[]): boolean {
  return contents.length === b.target.length && mixKey(contents) === mixKey(b.target);
}

/** The scenario's target mix finds exactly the library record it names (else: binding error). */
export function targetMatchesLibrary(b: ChemistryBinding): boolean {
  const o = mixOutcome(b.target);
  return o.kind === 'library' && o.reaction.id === b.reaction;
}

/** Same solutions, added in the order the procedure gives. */
export function followsProcedure(b: ChemistryBinding, contents: readonly string[]): boolean {
  return contents.length === b.target.length && contents.every((f, i) => f === b.target[i]);
}

/**
 * The choice the library supports. Only a record classified as a precipitation confirms
 * "precipitate"; the library never records the absence of one, so nothing confirms the other.
 */
export function correctChoice(o: MixOutcome): ChemChoice | null {
  return o.kind === 'library' && o.precipitate ? 'precipitate' : null;
}

export function chemVerdict(
  o: MixOutcome,
  prediction: Prediction | null,
  labelOf: (c: ChemChoice) => LocalizedText,
): Verdict {
  const correct = correctChoice(o);
  return {
    correct,
    correctText: correct ? labelOf(correct) : null,
    match: correct === null || !prediction ? null : prediction.choice === correct,
  };
}

function both(key: MessageKey, params?: MessageParams): LocalizedText {
  return { vi: translate('vi', key, params), en: translate('en', key, params) };
}

const same = (text: string): LocalizedText => ({ vi: text, en: text });

/**
 * Evidence of one mix. Every text is either copied from the library record or is fixed UI
 * wording; nothing is computed or rephrased, and no quantity is reported.
 */
export function mixEvidence(
  contents: readonly string[],
  outcome: MixOutcome,
  at: number,
): EngineEvidence {
  const key = `mix:${mixKey(contents)}`;
  const names = contents.map((f) => formatFormula(f));
  const facts: EngineFact[] = [
    {
      id: 'order',
      label: both('studio.chem.facts.order'),
      text: both('studio.chem.orderText', { list: names.join(' → ') }),
    },
  ];
  if (outcome.kind === 'library') {
    const r = outcome.reaction;
    const c = outcome.check;
    facts.push(
      { id: 'equation', label: both('studio.chem.facts.equation'), text: same(equationString(r)) },
      {
        id: 'balance',
        label: both('studio.chem.facts.balance'),
        text: c.conserved
          ? both('studio.chem.balanceOk')
          : both('studio.chem.balanceBad', { list: c.unbalanced.join(', ') }),
      },
      { id: 'observation', label: both('studio.chem.facts.observation'), text: r.observation },
      { id: 'conditions', label: both('studio.chem.facts.conditions'), text: r.conditions },
      {
        id: 'review',
        label: both('studio.chem.facts.review'),
        text: both(`studio.chem.review.${r.review_status}`),
      },
    );
  } else {
    facts.push({
      id: 'result',
      label: both('studio.chem.facts.result'),
      text:
        outcome.kind === 'unknown'
          ? both('studio.chem.unknown')
          : both('studio.chem.ambiguous', { n: outcome.reactions.length }),
    });
  }
  return {
    id: key,
    at,
    step: 'interact',
    kind: 'engine',
    key,
    model: outcome.kind === 'library' ? libraryModelId(outcome.reaction) : LIBRARY_MODEL,
    title: outcome.kind === 'library' ? outcome.reaction.name : same(names.join(' + ')),
    conditions: [],
    quantities: [],
    facts,
    ...(outcome.kind === 'library' ? { review_status: outcome.reaction.review_status } : {}),
  };
}
