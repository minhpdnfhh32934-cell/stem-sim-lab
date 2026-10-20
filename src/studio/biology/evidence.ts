import { translate, type MessageKey, type MessageParams } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import {
  card3d,
  CELL_TYPE_NAME,
  COMPONENTS,
  STAGE3D_NAME,
  stageNote,
  type ComponentId,
} from '@/biology/division/mitosis3d/components';
import type { CellType, Stage3D, Timeline } from '@/biology/division/mitosis3d/timeline';
import { ACTIVITY_KEY, type EngineEvidence, type EngineQuantity } from '../session';
import { scoreMatch, type Answers } from './match';
import { arrangementAt } from './model';

export const STAGE_MODEL = 'mitosis3d';
export const PARTS_MODEL = 'mitosis3d.components';

function both(key: MessageKey, params?: MessageParams): LocalizedText {
  return { vi: translate('vi', key, params), en: translate('en', key, params) };
}

export const stageKey = (stage: Stage3D) => `stage:${stage}`;

/**
 * Review status of the model's stage notes and part descriptions: the 3D model's Science Card
 * carries one status for all of them (the same for both cell types).
 */
const DESCRIPTIONS_REVIEW = card3d('animal').reviewStatus;
/** The visible review fact says what the data says; without a status it is never "verified". */
const REVIEW_TEXT = both(
  DESCRIPTIONS_REVIEW === 'verified' ? 'studio.bio.verified' : 'studio.bio.pending',
);

/** Inverse of `stageKey` (null for any other record). */
export function stageOfKey(key: string): Stage3D | null {
  const id = key.startsWith('stage:') ? key.slice(6) : '';
  return id in STAGE3D_NAME ? (id as Stage3D) : null;
}

function count(id: string, key: MessageKey, value: number, condition = 'A'): EngineQuantity {
  return { id, label: both(key), unit: '1', condition, value, check: null };
}

/**
 * One observed stage. The counts are read from the 3D model at the stage's key moment; the
 * stage note is copied from the model's data. Nothing here is typed in by hand.
 */
export function stageEvidence(
  tl: Timeline,
  stage: Stage3D,
  cellType: CellType,
  at: number,
): EngineEvidence {
  const a = arrangementAt(tl, stage);
  return {
    id: stageKey(stage),
    at,
    step: 'interact',
    kind: 'engine',
    key: stageKey(stage),
    model: STAGE_MODEL,
    title: STAGE3D_NAME[stage],
    conditions: [{ id: 'A', inputs: [count('2n', 'studio.bio.q.diploid', 2 * tl.pairs)] }],
    quantities: [
      count('chromosomes', 'studio.bio.q.chromosomes', a.chromosomes),
      count('double', 'studio.bio.q.double', a.double),
      count('onPlane', 'studio.bio.q.onPlane', a.onPlane),
    ],
    facts: [
      { id: 'cell', label: both('studio.bio.facts.cell'), text: CELL_TYPE_NAME[cellType] },
      { id: 'note', label: both('studio.bio.facts.note'), text: stageNote(stage, cellType) },
      { id: 'review', label: both('studio.bio.facts.review'), text: REVIEW_TEXT },
    ],
    review_status: DESCRIPTIONS_REVIEW,
  };
}

/**
 * The checked answer sheet. Each line names the task's part, says whether the learner's pick
 * is that part, and copies the function text from the data; no score number is stored.
 */
export function matchEvidence(
  tasks: readonly ComponentId[],
  answers: Answers,
  at: number,
): EngineEvidence {
  const score = scoreMatch(tasks, answers);
  return {
    id: ACTIVITY_KEY,
    at,
    step: 'interact',
    kind: 'engine',
    key: ACTIVITY_KEY,
    model: PARTS_MODEL,
    title: both('studio.bio.match.title'),
    conditions: [],
    quantities: [],
    facts: score.results.map((r) => {
      const info = COMPONENTS[r.task];
      const chosen = r.chosen ? COMPONENTS[r.chosen].name : null;
      const line = (lang: 'vi' | 'en') =>
        translate(lang, 'studio.bio.match.fact', {
          result: translate(lang, r.correct ? 'studio.bio.match.right' : 'studio.bio.match.wrong'),
          chosen: chosen ? chosen[lang] : translate(lang, 'studio.bio.match.unanswered'),
          role: info.role[lang],
        });
      return { id: r.task, label: info.name, text: { vi: line('vi'), en: line('en') } };
    }),
    review_status: DESCRIPTIONS_REVIEW,
  };
}
