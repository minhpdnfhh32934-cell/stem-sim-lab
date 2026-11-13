import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import type { GameEvents } from '../game/GameEvents';
import { captureLogger } from '../game/testing';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { ExperimentSession } from './ExperimentSession';
import { ExperimentSystem } from './ExperimentSystem';
import { BUILT_IN_MODELS } from './models';
import { projectileModel } from './models/projectile';
import type { SimulationModel } from './SimulationModel';

const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'projectile-motion'),
);

const session = () => new ExperimentSession('station', definition, projectileModel);
/** Advances a running session until it ends (real-time frames). */
const finish = (s: ExperimentSession) => {
  for (let i = 0; s.state === 'running' && i < 10_000; i++) s.advance(1 / 60);
};

describe('ExperimentSession states', () => {
  it('idle → configured → running → completed → reset → configured', () => {
    const s = session();
    expect(s.state).toBe('idle');
    expect(s.parameters).toEqual({ velocity: 8, angle: 45, gravity: 9.81, resolution: 0.01 });
    expect(s.setReady(true)).toBe(true);
    expect(s.state).toBe('configured');
    expect(s.start()).toBeNull();
    expect(s.state).toBe('running');
    finish(s);
    expect(s.state).toBe('completed');
    expect(s.run?.results?.range).toBeCloseTo((64 * Math.sin(Math.PI / 2)) / 9.81, 9);
    expect(s.reset()).toBe(true);
    expect(s.state).toBe('configured');
    expect(s.run).toBeNull();
  });

  it('running → stopped keeps the data collected so far; reset discards it', () => {
    const s = session();
    s.setReady(true);
    s.start();
    s.advance(0.3);
    expect(s.stop()).toBe(true);
    expect(s.state).toBe('stopped');
    const samples = s.run?.sampleCount ?? 0;
    expect(samples).toBeGreaterThan(20);
    const stoppedAt = s.run?.time ?? NaN;
    // Whole 1 ms steps only (a sub-step remainder waits for the next frame).
    expect(stoppedAt).toBeGreaterThan(0.298);
    expect(stoppedAt).toBeLessThanOrEqual(0.3 + 1e-12);
    s.advance(1); // stopped: time no longer moves
    expect(s.run?.sampleCount).toBe(samples);
    expect(s.run?.time).toBe(stoppedAt);
    expect(s.run?.results).toBeNull(); // nothing is claimed for an unfinished flight
    expect(s.reset()).toBe(true);
    expect(s.run).toBeNull();
  });

  it('only starts from configured, with a reason otherwise', () => {
    const s = session();
    expect(s.start()).toBe('The apparatus is not ready.');
    s.setReady(true);
    s.start();
    expect(s.start()).toBe('A run is already in progress.');
    s.stop();
    expect(s.start()).toBe('Press RESET before the next run.');
    s.reset();
    s.start();
    finish(s);
    expect(s.start()).toBe('Press RESET before the next run.');
    expect(s.stop()).toBe(false); // nothing running
  });

  it('can reset a running run, and goes back to idle if the apparatus is no longer ready', () => {
    const s = session();
    s.setReady(true);
    s.start();
    s.setReady(false); // e.g. the projectile was taken out after the run
    expect(s.reset()).toBe(true);
    expect(s.state).toBe('idle');
    expect(s.reset()).toBe(false); // nothing left to reset
  });

  it('numbers runs and passes the apparatus inputs to model and theory', () => {
    const s = session();
    s.setReady(true);
    s.start({ height: 0.48 });
    expect(s.run?.runId).toBe('station#1');
    expect(s.run?.inputs).toEqual({
      velocity: 8,
      angle: 45,
      gravity: 9.81,
      resolution: 0.01,
      height: 0.48,
    });
    expect(s.run?.value('y')).toBe(0.48);
    const theory = s.run?.theory();
    const vy = 8 * Math.SQRT1_2;
    expect(theory?.flightTime).toBeCloseTo((vy + Math.sqrt(vy * vy + 2 * 9.81 * 0.48)) / 9.81, 12);
    s.reset();
    s.start({ height: 0.48 });
    expect(s.run?.runId).toBe('station#2');
  });

  it('refuses to start when the apparatus check rejects the predicted shot', () => {
    const s = session();
    s.setReady(true);
    const seen: Record<string, number>[] = [];
    const check = (
      _inputs: Readonly<Record<string, number>>,
      theory: Readonly<Record<string, number>>,
    ) => {
      seen.push({ ...theory });
      return (theory.range ?? 0) > 5 ? 'Out of range.' : null;
    };
    expect(s.start({}, check)).toBe('Out of range.');
    expect(s.state).toBe('configured');
    expect(seen[0]?.range).toBeCloseTo(64 / 9.81, 9);
    s.setParameter('velocity', 4);
    expect(s.start({}, check)).toBeNull();
  });
});

describe('ExperimentSession theory and samples', () => {
  /** The projectile model, refusing any v₀ above 10 m/s as a model refuses what it does not cover. */
  const refusing: SimulationModel = {
    ...projectileModel,
    predict: (inputs) => {
      if ((inputs.velocity ?? 0) > 10) throw new Error('v₀ above 10 m/s is outside this model');
      return projectileModel.predict!(inputs);
    },
  };
  const REFUSED = 'Model "kinematics.projectile" refuses: v₀ above 10 m/s is outside this model';

  it('never throws for settings its model refuses: no theory, the model’s message, no run', () => {
    const s = new ExperimentSession('station', definition, refusing);
    s.setReady(true);
    expect(s.setParameter('velocity', 12)).toBeNull();
    expect(s.predict({ height: 0.48 })).toBeNull();
    expect(s.prediction({ height: 0.48 })).toEqual({ ok: false, error: REFUSED });
    expect(s.start({ height: 0.48 })).toBe(REFUSED);
    expect(s.state).toBe('configured');
    expect(s.run).toBeNull();
    expect(s.setParameter('velocity', 8)).toBeNull();
    const theory = s.prediction({ height: 0.48 });
    const expected = projectileModel.predict!(s.inputs({ height: 0.48 })).range;
    expect(Number.isFinite(expected)).toBe(true);
    expect(theory.ok && theory.value?.range).toBe(expected);
    expect(s.predict({ height: 0.48 })?.range).toBe(expected);
    expect(s.start({ height: 0.48 })).toBeNull();
    expect(s.state).toBe('running');
  });

  it('lets a model bug through: only a plain Error is a refusal', () => {
    const buggy: SimulationModel = {
      ...projectileModel,
      predict: () => {
        throw new TypeError('cannot read properties of undefined');
      },
    };
    const s = new ExperimentSession('station', definition, buggy);
    expect(() => s.prediction()).toThrow(TypeError);
    expect(() => s.predict()).toThrow(TypeError);
  });

  it('samples every model variable by name into one object: the run’s now, NaN without a run', () => {
    const s = session();
    s.setReady(true);
    const out: Record<string, number> = {};
    s.sample(out);
    expect(Object.keys(out)).toEqual(projectileModel.variables);
    expect(Object.values(out).every(Number.isNaN)).toBe(true);
    s.start({ height: 0.48 });
    s.advance(0.2);
    s.sample(out);
    for (const v of projectileModel.variables) expect(out[v]).toBe(s.run!.value(v));
    expect(out.x).toBeGreaterThan(0);
    s.reset();
    s.sample(out);
    expect(Object.values(out).every(Number.isNaN)).toBe(true);
  });
});

describe('ExperimentSession parameters', () => {
  it('accepts values in range and rejects others with the reason', () => {
    const s = session();
    expect(s.setParameter('velocity', 12.25)).toBeNull();
    expect(s.parameters.velocity).toBe(12.25);
    expect(s.setParameter('velocity', 0.5)).toBe('Initial velocity must be within 1–15 m/s.');
    expect(s.setParameter('angle', 91)).toBe('Launch angle must be within 0–90 °.');
    expect(s.setParameter('gravity', Number.NaN)).toMatch(/must be within/);
    expect(s.setParameter('mass', 1)).toBe('"Projectile motion" has no parameter "mass".');
    expect(s.parameters).toEqual({ velocity: 12.25, angle: 45, gravity: 9.81, resolution: 0.01 });
  });

  it('refuses changes while running, allows them once stopped or completed', () => {
    const s = session();
    s.setReady(true);
    s.start();
    expect(s.setParameter('angle', 30)).toBe('Stop the run before changing its parameters.');
    s.stop();
    expect(s.setParameter('angle', 30)).toBeNull();
    expect(s.run?.inputs.angle).toBe(45); // the stopped run keeps the values it ran with
  });

  it('steps a dial on the step grid and clamps at the range ends', () => {
    const s = session();
    expect(s.nextValue('velocity', 1)).toBe(8.5);
    expect(s.nextValue('velocity', -1)).toBe(7.5);
    s.setParameter('velocity', 15);
    expect(s.nextValue('velocity', 1)).toBe(15);
    s.setParameter('velocity', 1);
    expect(s.nextValue('velocity', -1)).toBe(1);
    s.setParameter('velocity', 7.3); // off the grid (e.g. an old save): snaps to it
    expect(s.nextValue('velocity', 1)).toBe(7.5);
    s.setParameter('angle', 90);
    expect(s.nextValue('angle', 1)).toBe(90);
    expect(s.nextValue('angle', -1)).toBe(85);
  });

  it('steps through presets when a parameter has them', () => {
    const s = session();
    expect(s.nextValue('gravity', 1)).toBe(24.79); // Earth → Jupiter
    expect(s.nextValue('gravity', -1)).toBe(3.71); // Earth → Mars
    s.setParameter('gravity', 1.62);
    expect(s.nextValue('gravity', -1)).toBe(1.62); // already the lowest
    s.setParameter('gravity', 5); // between presets: to the next one either way
    expect(s.nextValue('gravity', 1)).toBe(9.81);
    expect(s.nextValue('gravity', -1)).toBe(3.71);
  });

  it('does not drift over many decimal steps', () => {
    const def = ExperimentDefinitionSchema.parse({
      ...definition,
      parameters: [
        { id: 'velocity', label: 'v', unit: 'm/s', default: 1, min: 1, max: 3, step: 0.1 },
      ],
      initialConditions: { angle: 45, gravity: 9.81, height: 0 },
      instruments: [], // its tape's resolution parameter is gone
    });
    const s = new ExperimentSession('s', def, projectileModel);
    for (let i = 0; i < 10; i++) s.setParameter('velocity', s.nextValue('velocity', 1) ?? NaN);
    expect(s.parameters.velocity).toBe(2);
  });
});

describe('ExperimentSystem sessions and events', () => {
  function system(models: readonly SimulationModel[] = BUILT_IN_MODELS) {
    const { log } = captureLogger();
    const events = new EventBus<GameEvents>(log);
    const seen: string[] = [];
    events.subscribe('ExperimentStarted', (e) => seen.push(`started ${e.runId}`));
    events.subscribe('ExperimentStateChanged', (e) => seen.push(`state ${e.state}`));
    events.subscribe('ExperimentParameterChanged', (e) => seen.push(`${e.parameterId}=${e.value}`));
    events.subscribe('ExperimentCompleted', (e) => seen.push(`completed ${e.endReason}`));
    events.subscribe('ExperimentFailed', (e) => seen.push(`failed ${e.error}`));
    const experiments = new ExperimentSystem({
      experiments: new Registry('experiment', [definition]),
      models: new Registry('simulation model', models),
      events,
      log,
    });
    return { experiments, seen };
  }

  it('announces each transition and parameter change once', () => {
    const { experiments, seen } = system();
    experiments.session('lab/launcher', 'projectile-motion');
    expect(experiments.adjust('lab/launcher', 'angle', -1)).toBeNull();
    experiments.setReady('lab/launcher', true);
    experiments.setReady('lab/launcher', true); // no change, no event
    expect(experiments.start('lab/launcher', { height: 0.48 })).toBeNull();
    for (let i = 0; i < 300; i++) experiments.update(1 / 60);
    expect(experiments.reset('lab/launcher')).toBeNull();
    expect(experiments.stop('lab/launcher')).toBe('Nothing is running.');
    expect(seen).toEqual([
      'angle=40',
      'state configured',
      'started lab/launcher#1',
      'state running',
      'completed model',
      'state completed',
      'state configured',
    ]);
    expect(experiments.latest?.id).toBe('lab/launcher');
  });

  it('reports a failing model as failed and stopped, never as a result', () => {
    const broken: SimulationModel = {
      ...projectileModel,
      step: () => {
        throw new Error('broken');
      },
    };
    const { experiments, seen } = system([broken]);
    experiments.session('s', 'projectile-motion');
    experiments.setReady('s', true);
    experiments.start('s');
    experiments.update(1 / 60);
    expect(seen.slice(-2)).toEqual([
      'failed Model "kinematics.projectile" threw: broken',
      'state stopped',
    ]);
    expect(experiments.find('s')?.run?.results).toBeNull();
  });

  it('forgets every session for a new playthrough', () => {
    const { experiments } = system();
    experiments.session('s', 'projectile-motion');
    experiments.clear();
    expect(experiments.find('s')).toBeUndefined();
    expect(experiments.latest).toBeNull();
  });
});

describe('ExperimentSession set and preview (workspace controls)', () => {
  it('sets only a preset where there are presets, else a step-grid value in range', () => {
    const s = session();
    expect(s.set('gravity', 3.71)).toBeNull(); // Mars, a preset
    expect(s.parameters.gravity).toBe(3.71);
    expect(s.set('gravity', 5)).toBe('5 m/s² is not a setting of Gravitational acceleration.');
    expect(s.parameters.gravity).toBe(3.71);
    expect(s.set('gravity', 3.7100000001)).toBeNull(); // stored as the preset itself
    expect(s.parameters.gravity).toBe(3.71);
    expect(s.set('velocity', 9.5000000001)).toBeNull(); // stored as the grid point
    expect(s.parameters.velocity).toBe(9.5);
    expect(s.set('velocity', 9.5)).toBeNull(); // 1 + 17 × 0.5
    expect(s.set('velocity', 9.7)).not.toBeNull();
    expect(s.set('velocity', 16)).not.toBeNull(); // beyond max
    expect(s.set('velocity', Number.NaN)).not.toBeNull();
    expect(s.set('angle', 90)).toBeNull(); // max
    expect(s.set('nope', 1)).toBe('"Projectile motion" has no parameter "nope".');
    expect(s.parameters.velocity).toBe(9.5);
    s.setReady(true);
    s.start();
    expect(s.set('velocity', 10)).toBe('Stop the run before changing its parameters.');
  });

  it('previews the model at t = 0 for the settings, without a run or a record', () => {
    const s = session();
    s.set('angle', 90);
    const preview = s.preview({ height: 0.5 });
    expect(preview?.preview).toBe(true);
    expect(preview?.sample).toEqual({
      x: 0,
      y: 0.5,
      vx: 8 * Math.cos(Math.PI / 2),
      vy: 8,
      speed: 8,
    });
    expect(s.run).toBeNull();
    expect(s.history).toEqual([]);
    expect(s.state).toBe('idle');
  });

  it('is announced by the system like a dial change; refused, nothing is announced', () => {
    const { log } = captureLogger();
    const events = new EventBus<GameEvents>(log);
    const changed: GameEvents['ExperimentParameterChanged'][] = [];
    events.subscribe('ExperimentParameterChanged', (e) => changed.push(e));
    const experiments = new ExperimentSystem({
      experiments: new Registry('experiment', [definition]),
      models: new Registry('simulation model', BUILT_IN_MODELS),
      events,
      log,
    });
    experiments.session('s', definition.id);
    expect(experiments.set('s', 'gravity', 1.62)).toBeNull();
    expect(experiments.set('s', 'gravity', 2)).not.toBeNull();
    expect(changed).toEqual([{ sessionId: 's', parameterId: 'gravity', value: 1.62 }]);
    expect(experiments.preview('s')?.sample.vy).toBeCloseTo(8 * Math.SQRT1_2, 12);
    expect(experiments.preview('none')).toBeNull();
  });
});
