import type { LocalizedText } from '@/core/data/dataset';
import type { StudioScenario } from '../../scenario';

/** `{ vi, en }` text. Defined here, with no runtime import, so E2E specs can read a lesson file. */
export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/**
 * What every descriptive SH10 lesson shares: a guided lesson with no engine (model 'guided'),
 * every step of the flow, and every requirement on (prediction, checked activities, the learner's
 * own explanation and conclusion). The teaching text is pending a teacher's review (SH10-GL-*).
 */
export const GUIDED_BASE: Pick<
  StudioScenario,
  | 'schemaVersion'
  | 'subject'
  | 'level'
  | 'difficulty'
  | 'tools'
  | 'models'
  | 'initial'
  | 'steps'
  | 'completion'
  | 'review_status'
> = {
  schemaVersion: 1,
  subject: 'biology',
  level: 'foundation',
  difficulty: 'intro',
  tools: ['match', 'science-card', 'report'],
  models: ['guided'],
  initial: {},
  steps: ['predict', 'interact', 'observe', 'explain', 'conclude', 'report'],
  completion: {
    prediction: true,
    observation: true,
    explanationMinChars: 20,
    conclusion: true,
    activity: true,
  },
  review_status: 'pending',
};
