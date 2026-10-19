import type { ComponentType } from 'react';
import type { MessageKey } from '@/app/i18n';
import type { Source } from '@/core/data/dataset';
import type { FlowStep, StudioScenario } from '../scenario';
import type { Blocker, StudioSession } from '../session';

export interface StepProps {
  scenario: StudioScenario;
  session: StudioSession;
  /** Applies a pure session change (see `session.ts`) and saves it. */
  update: (change: (s: StudioSession) => StudioSession) => void;
}

/**
 * What a subject plugs into the shared POE flow. The flow owns navigation, the learner's
 * explanation and conclusion, and the report; the subject owns its model and its numbers.
 */
export interface SubjectPlugin {
  Predict: ComponentType<StepProps>;
  Interact: ComponentType<StepProps>;
  Observe: ComponentType<StepProps>;
  /** Short engine facts repeated next to the conclusion (optional). */
  Facts?: ComponentType<StepProps>;
  /** Sources of the model behind the numbers, listed in the report. */
  modelSources?: (scenario: StudioScenario, session: StudioSession) => Promise<Source[]>;
  /** Subject wording for a step's lead line (default `studio.flow.leads.<step>`). */
  leads?: Partial<Record<FlowStep, MessageKey>>;
  /** Subject wording for why a step is blocked (default `studio.flow.blockers.<blocker>`). */
  blockers?: Partial<Record<Blocker, MessageKey>>;
}
