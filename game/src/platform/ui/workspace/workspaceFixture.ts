import type { StationView } from '../../../gameplay/experiment/StationSystem';
import type { ExperimentWorkspace } from '../../../simulation/experiment';

/** A small workspace for tests: a burette that takes a titrant, a flask that takes an indicator. */
export const WORKSPACE: ExperimentWorkspace = {
  pieces: [
    {
      id: 'burette',
      kind: 'burette',
      slot: 'stand.clamp',
      label: 'Burette',
      owns: ['titrant'],
      shows: [],
    },
    { id: 'flask', kind: 'conical-flask', slot: 'tile', label: 'Flask', owns: [], shows: [] },
    { id: 'stand', kind: 'retort-stand', slot: 'stand', label: 'Stand', owns: [], shows: [] },
  ],
  materials: [
    {
      id: 'naoh',
      kind: 'solution',
      label: 'NaOH 0.1 mol/L',
      formula: 'NaOH',
      sets: { parameter: 'titrant', value: 0.1 },
    },
    { id: 'indicator', kind: 'indicator', label: 'Indicator' },
  ],
  setup: [
    {
      id: 'clamp',
      instruction: 'Clamp the burette on the stand.',
      refusal: 'Clamp the burette on the stand first.',
      place: 'burette',
      onto: 'stand',
      after: [],
      phase: 'before-run',
    },
    {
      id: 'fill',
      instruction: 'Fill the burette with NaOH.',
      refusal: 'The burette holds the titrant, NaOH, in this experiment.',
      place: 'naoh',
      onto: 'burette',
      after: ['clamp'],
      phase: 'before-run',
    },
    {
      id: 'add-indicator',
      instruction: 'Add the indicator to the flask.',
      refusal: 'Add the indicator to the flask first.',
      place: 'indicator',
      onto: 'flask',
      after: [],
      phase: 'before-run',
    },
  ],
};

/** The part of a station view the workspace logic reads: which setup steps are done. */
export const viewWith = (done: readonly string[]): StationView =>
  ({
    setup: WORKSPACE.setup.map((step) => ({ step, done: done.includes(step.id) })),
  }) as unknown as StationView;
