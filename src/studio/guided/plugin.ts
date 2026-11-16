import type { SubjectPlugin } from '../flow/types';
import { knttSource } from './card';
import { GUIDED_STEPS, guidedOf } from './check';
import { Interact, Observe, ObserveWithCard, Predict } from './GuidedSteps';

/**
 * A descriptive textbook lesson in the shared POE flow: the prediction, the checked activities and
 * the lesson's answers stand where other subjects have their model. Every wording that would speak
 * of a simulation or of measurements is replaced (`studio.guided.*`).
 */
const base: SubjectPlugin = {
  Predict,
  Interact,
  Observe,
  modelSources: (scenario) => {
    const b = guidedOf(scenario);
    const source = b ? knttSource(b.kntt) : null;
    return Promise.resolve(source ? [source] : []);
  },
  steps: GUIDED_STEPS,
  titles: {
    predict: 'studio.guided.titles.predict',
    interact: 'studio.guided.titles.interact',
    observe: 'studio.guided.titles.observe',
    explain: 'studio.guided.titles.explain',
  },
  leads: {
    predict: 'studio.guided.leads.predict',
    interact: 'studio.guided.leads.interact',
    observe: 'studio.guided.leads.observe',
    explain: 'studio.guided.leads.explain',
    conclude: 'studio.guided.leads.conclude',
  },
  blockers: {
    observation: 'studio.guided.blockers.activity',
    activity: 'studio.guided.blockers.activity',
  },
};

/** In Science Studio: the Science Card is shown inline at Observe (nothing else shows it there). */
export const guidedPlugin: SubjectPlugin = {
  ...base,
  Observe: ObserveWithCard,
};

/** In the lab's own topic: the Inspector already shows the Science Card. */
export const guidedLabPlugin: SubjectPlugin = base;
