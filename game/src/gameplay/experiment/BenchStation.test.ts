import { describe, expect, it } from 'vitest';
import { createTexts } from '../../core/i18n';
import { benchFixture, ohmModel } from '../../game/benchFixture';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { BUILT_IN_MODELS } from '../../simulation/models';
import type { BenchView } from './StationSystem';

// A bench station end to end, with a fixture (game/benchFixture.ts: in no content file): Ohm's
// law on a board drawn by the reference bench model, through the same controls as every station.

const H = 1 / 60;
const LAB = 'physics-lab';
const BOARD = `${LAB}/demo-board-station`;
const MODELS = [...BUILT_IN_MODELS, ohmModel];
const REFUSED = 'The model does not cover these settings: change a dial.';

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const view = (game: Game): BenchView => {
  const station = game.stations.view(BOARD);
  if (station?.kind !== 'bench') throw new Error(`${BOARD} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;

/** New game with the fixture, then the developer jump to the Physics Lab (setup only). */
async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage, content: benchFixture(), models: MODELS });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('bench station (fixture: Ohm’s law on the demo board)', () => {
  it('is ready at once, its pose the dials and no sample before a run', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('fixture-ohm');
    expect(v.model).toBe('demo-board');
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({ resistance: 10, voltage: 2, resolution: 0.01 });
    expect(game.entityStates.get(BOARD, 'param.voltage')).toBe(2);
    expect(v.pose.status).toBe('configured');
    expect(v.pose.parameters).toBe(v.session.parameters); // the dials themselves, not a copy
    expect(v.pose.sample).toEqual({ v: NaN, i: NaN, level: NaN }); // every model variable
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false]);
  });

  it('runs from its controls: a dial, RUN, live samples, the record with its class, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'demo-instructions', 'inspect')).toBe(true);
    expect(act(game, 'demo-dial-voltage', 'raise')).toBe(true); // U = 3 V
    expect(session(game).parameters.voltage).toBe(3);
    expect(game.entityStates.get(BOARD, 'param.voltage')).toBe(3);
    expect(
      view(game)
        .checklist.slice(0, 2)
        .map((s) => s.done),
    ).toEqual([true, true]);

    expect(act(game, 'demo-run', 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({ resistance: 10, voltage: 3, resolution: 0.01, rampRate: 2 });
    const pose = view(game).pose; // one live object: each read is the session now
    expect(pose.status).toBe('running');
    expect(pose.parameters).toBe(run.inputs); // the run's own settings while it exists
    let frame = 0;
    for (; session(game).state === 'running' && frame < 600; frame++) {
      game.update(H);
      if (session(game).state !== 'running') break;
      // What the rig is drawn from is the model's state, by name, this frame.
      expect(pose.sample.v).toBe(run.value('v'));
      expect(pose.sample.i).toBe(run.value('i'));
      expect(pose.sample.level).toBe(run.value('v') / 3);
      expect(pose.sample.i).toBeCloseTo(pose.sample.v! / 10, 12); // I = U/R
    }
    expect(frame).toBeGreaterThan(60); // 1.5 s of ramp at 60 frames a second
    expect(session(game).state).toBe('completed');
    expect(view(game).pose).toBe(pose);
    expect(pose.status).toBe('completed');
    expect(pose.sample).toEqual({ v: 3, i: 0.3, level: 1 }); // at rest where the run ended

    expect(completed).toHaveLength(1);
    expect(completed[0]!.results.current).toBeCloseTo(3 / 10, 12);
    expect(completed[0]!.results['ramp-time']).toBeCloseTo(3 / 2, 9);
    expect(game.state.progression.completedExperiments).toEqual(['fixture-ohm']);

    // The record stays numeric, as every record; its class is named from the value, in each
    // language (shown beside the number: platform/ui/results.test.ts).
    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results?.current).toBe(completed[0]!.results.current);
    expect(record?.theory()?.current).toBeCloseTo(0.3, 12);
    const result = record!.definition.results[1]!;
    expect(resultClass(result, record!.results!.current!)).toBe('Strong');
    expect(
      resultClass(
        result,
        record!.results!.current!,
        createTexts({}, () => 'vi'),
      ),
    ).toBe('Mạnh');
    // The ammeter, in A, reads the record's own current to its own d.
    expect(readings(record!.definition, record!)).toMatchObject([
      { result: 'current', unit: 'A', reading: 0.3, text: '0.30', bound: 0.005 },
    ]);

    expect(act(game, 'demo-monitor', 'view-results')).toBe(true);
    expect(act(game, 'demo-reset', 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(pose.status).toBe('configured');
    expect(pose.parameters).toBe(session(game).parameters); // the dials again
    expect(pose.sample).toEqual({ v: NaN, i: NaN, level: NaN });
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('refuses settings its model refuses, with the reason; the model’s own message goes to the log', async () => {
    const { game, blocked, logs } = await lab();
    const said = () => logs.filter((l) => l.message.includes('draws no finite current'));
    expect(act(game, 'demo-dial-resistance', 'lower')).toBe(true); // R = 0 Ω: predict throws
    expect(session(game).parameters.resistance).toBe(0);
    for (let i = 0; i < 5; i++) expect(view(game).runBlock).toBe(REFUSED); // still a usable view
    // The HUD asks the guards on every prompt refresh: asking is not pressing.
    const runButton = `${LAB}/demo-run`;
    const runAction = game.interaction.primaryAction(runButton);
    expect(runAction?.id).toBe('run');
    for (let i = 0; i < 5; i++) {
      expect(game.interaction.blockedReason(runButton, runAction!)).toBe(REFUSED);
    }
    expect(said()).toEqual([]); // reading a view or a prompt logs nothing
    expect(act(game, 'demo-run', 'run')).toBe(false);
    expect(blocked.at(-1)).toBe(REFUSED);
    expect(session(game).run).toBeNull();
    expect(view(game).pose.sample).toEqual({ v: NaN, i: NaN, level: NaN });
    const warning = {
      level: 'warn',
      channel: 'Stations',
      message: `${BOARD}: Model "fixture.ohm" refuses: a resistance of 0 Ω draws no finite current`,
    };
    expect(said()).toEqual([warning]);
    expect(act(game, 'demo-run', 'run')).toBe(false); // each press is logged
    expect(said()).toEqual([warning, warning]);
    // No range check of its own beyond the dials: back to 10 Ω, it runs.
    expect(act(game, 'demo-dial-resistance', 'raise')).toBe(true);
    expect(view(game).runBlock).toBeNull();
    expect(act(game, 'demo-run', 'run')).toBe(true);
    expect(session(game).state).toBe('running');
  });

  it('keeps its configuration in the save, as every station does', async () => {
    const { game, storage } = await lab();
    act(game, 'demo-dial-voltage', 'raise');
    act(game, 'demo-dial-voltage', 'raise'); // 4 V
    expect(game.save()?.ok).toBe(true);
    game.dispose();
    const { game: again } = await bootTestGame({
      storage,
      content: benchFixture(),
      models: MODELS,
    });
    expect((await again.continueGame()).ok).toBe(true);
    frames(again, 0.1);
    expect(session(again).parameters).toEqual({ resistance: 10, voltage: 4, resolution: 0.01 });
    expect(view(again).pose.parameters).toBe(session(again).parameters);
  });
});
