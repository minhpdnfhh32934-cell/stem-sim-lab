import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { Registry } from '../core/Registry';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { ExperimentRuntime } from '../simulation/ExperimentRuntime';
import { BUILT_IN_MODELS } from '../simulation/models';
import { buildContent } from './content';

// Every shipped experiment, at its defaults, through the runtime the game runs it in: it never
// fails (a model error or a non-finite state ends a run as failed — the models' own tests step them
// directly and would not see it).

const models = new Registry('simulation model', BUILT_IN_MODELS);
const content = buildContent(bundledContent, {
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models,
});

describe('shipped experiments in the runtime', () => {
  it.each(content.experiments.all().map((e) => [e.id, e] as const))(
    '%s runs at its defaults without failing',
    (_, experiment) => {
      const run = new ExperimentRuntime('test', experiment, models.get(experiment.model));
      run.start();
      const dt = experiment.simulation.timeStep;
      const steps = Math.ceil(experiment.simulation.maxDuration / dt) + 1;
      for (let i = 0; i < steps && run.status === 'running'; i++) run.advance(dt);
      expect(run.error).toBeNull();
      expect(run.status).not.toBe('failed');
    },
  );
});
