import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { DILUTION_FIXTURE } from '../game/physicalLabFixture';
import { fromStoredRun, toStoredRun } from '../persistence/runHistory';
import { runCsv } from './csv';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { checkExperimentAgainstModel, ExperimentRuntime } from './ExperimentRuntime';
import { ExperimentSession } from './ExperimentSession';
import { dilutionModel } from './models/dilution';

// Driven runs (docs/physical-lab-architecture.md §2.9): a physical-lab run fed by the player.

const definition = ExperimentDefinitionSchema.parse(DILUTION_FIXTURE);
const INPUTS = {
  stockConcentration: 2e-5,
  stockVolume: 5,
  finalVolume: 50,
  concentrationResolution: 1e-7,
  fillTime: 10,
  absorptivity: 1e7,
  pathLength: 0.01,
};
const H = 1 / 60;

function running(def: ExperimentDefinition = definition) {
  const run = new ExperimentRuntime('r#1', def, dilutionModel, INPUTS);
  expect(run.start()).toBe(true);
  return run;
}

describe('driven runtime', () => {
  it('is driven only for a physical-lab definition whose model has the mode', () => {
    expect(running().driven).toBe(true);
    const workspace = { ...definition.workspace!, drive: undefined };
    const stepped = { ...definition, presentation: '2d-workspace' as const, workspace };
    expect(new ExperimentRuntime('s', stepped, dilutionModel, INPUTS).driven).toBe(false);
    // A drive and the mode go together.
    expect(checkExperimentAgainstModel(definition, dilutionModel)).toEqual([]);
    expect(
      checkExperimentAgainstModel({ ...definition, workspace }, dilutionModel).join(),
    ).toContain('needs a "drive"');
  });

  it('has no time limit and no no-progress check: a long pause leaves it running', () => {
    const run = running();
    for (let i = 0; i < 60 * 60; i++) run.advance(H); // a minute, five times maxDuration (12 s)
    expect(run.status).toBe('running');
    expect(run.feed(20)).toBe(true);
    for (let i = 0; i < 60 * 30; i++) run.advance(H); // no feed for 1800 ticks
    expect(run.status).toBe('running');
    expect(run.value('volume')).toBe(20);
    expect(() => run.runToCompletion()).toThrow(/driven/);
  });

  it('completes by the model at the mark, on its next tick, with the theory’s numbers', () => {
    const run = running();
    for (let v = 6; v < 50; v += 1) {
      expect(run.feed(v)).toBe(true);
      run.advance(H);
    }
    expect(run.status).toBe('running');
    expect(run.feed(50)).toBe(true);
    expect(run.status).toBe('running'); // applied on the next tick, where it is announced
    expect(run.feed(50)).toBe(false); // nothing more once ended
    run.advance(H);
    expect(run.status).toBe('completed');
    expect(run.endReason).toBe('model');
    const theory = dilutionModel.predict!(INPUTS);
    expect(run.results?.finalConcentration).toBe(theory.finalConcentration);
    expect(run.results?.amount).toBeCloseTo(theory.amount ?? NaN, 20); // n = C·V/1000: 1e-7 mol
    // The last sample is the end itself; the samples' times only stamp lab time.
    const n = run.sampleCount;
    expect(run.sampleValues[0]?.[n - 1]).toBe(50);
    for (let i = 1; i < n; i++) expect(run.sampleTimes[i]).toBeGreaterThan(run.sampleTimes[i - 1]!);
  });

  it('ends as the player’s finish with readings at the last fed value; STOP keeps none', () => {
    const run = running();
    run.feed(30);
    expect(run.finish()).toBe(true);
    run.advance(H);
    expect(run.status).toBe('completed');
    expect(run.endReason).toBe('player');
    expect(run.results?.finalConcentration).toBeCloseTo((2e-5 * 5) / 30, 18);
    const stopped = running();
    stopped.feed(30);
    expect(stopped.stop()).toBe(true);
    expect(stopped.status).toBe('stopped');
    expect(stopped.results).toBeNull();
  });

  it('fails, on its next tick, a value the model refuses (past the mark)', () => {
    const run = running();
    expect(run.feed(51)).toBe(false);
    expect(run.status).toBe('running');
    run.advance(H);
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/outside V₁…V₂/);
  });

  it('keeps every other sample when its buffer fills, values as recorded, never averaged', () => {
    const run = running();
    const capacity = run.sampleTimes.length;
    let v = 5;
    for (let i = 0; i < capacity * 3; i++) {
      run.advance(0.05);
      v = Math.min(49.9, v + 0.01);
      run.feed(v);
    }
    expect(run.status).toBe('running');
    expect(run.sampleCount).toBeLessThanOrEqual(capacity);
    for (let i = 1; i < run.sampleCount; i++) {
      expect(run.sampleTimes[i]).toBeGreaterThan(run.sampleTimes[i - 1]!);
      expect(run.sampleValues[0]![i]).toBeGreaterThanOrEqual(run.sampleValues[0]![i - 1]!);
    }
  });
});

describe('driven session and run history', () => {
  it('records a player-finished run, and the record round-trips through the store', () => {
    const session = new ExperimentSession('lab/station', definition, dilutionModel);
    session.setReady(true);
    expect(session.driven).toBe(true);
    expect(session.start()).toBeNull();
    expect(session.feed(25)).toBe(true);
    expect(session.finish()).toBe(true);
    session.advance(H);
    expect(session.state).toBe('completed');
    const record = session.history.at(-1);
    if (record?.status !== 'completed') throw new Error('no completed record');
    expect(record.endReason).toBe('player');
    const stored = structuredClone(toStoredRun(record));
    const back = fromStoredRun(stored, new Registry('experiment', [definition]));
    if (!back.ok) throw new Error(back.error);
    expect(back.value.status).toBe('completed');
    expect(back.value.status === 'completed' && back.value.endReason).toBe('player');
    expect(back.value.results).toEqual(record.results);
  });

  it('writes a CSV that says the run was fed, not stepped', () => {
    const session = new ExperimentSession('lab/station', definition, dilutionModel);
    session.setReady(true);
    session.start();
    session.feed(50);
    session.advance(H);
    const record = session.history.at(-1);
    if (!record) throw new Error('no record');
    const samples = runCsv(record)
      .split('\r\n')
      .find((l) => l.startsWith('# Samples:'));
    expect(samples).toMatch(/computed from the volume poured/);
    expect(samples).not.toMatch(/model steps/);
  });

  it('records a run a refused feed failed', () => {
    const session = new ExperimentSession('lab/station', definition, dilutionModel);
    session.setReady(true);
    session.start();
    session.feed(4); // below V₁
    session.advance(H);
    expect(session.run?.status).toBe('failed');
    expect(session.state).toBe('stopped'); // a failed run is ended, as a stopped one
    expect(session.history.at(-1)?.status).toBe('failed');
  });
});
