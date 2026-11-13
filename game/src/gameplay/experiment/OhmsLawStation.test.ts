import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { circuitModel } from '../../simulation/models/circuit';
import type { BenchView } from './StationSystem';

// Ohm's law on the projectile range's circuit board (content: rooms.json), played through its
// desk as every station is: the board read, the dials, RUN, the record, RESET. The theory is
// written out here from Ohm's and Kirchhoff's laws, not taken from the model.

const H = 1 / 60;
const LAB = 'physics-lab';
const ROOM = 'physics-lab'; // Phase T-1a: on the lab's south wall
const BOARD = `${ROOM}/circuit`;

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${ROOM}/${id}`, action);
const dial = (game: Game, id: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, id, action);
};
const view = (game: Game): BenchView => {
  const station = game.stations.view(BOARD);
  if (station?.kind !== 'bench') throw new Error(`${BOARD} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(H);
};

/** R1 and R2 in parallel: 1/R = 1/R1 + 1/R2. */
const parallel = (r1: number, r2: number) => 1 / (1 / r1 + 1 / r2);

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab() {
  const booted = await bootTestGame();
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  return booted;
}

describe('Ohm’s law station (projectile range)', () => {
  it('is ready at once: 6 V across 100 Ω and 220 Ω in series, no sample before a run', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('ohms-law');
    expect(v.model).toBe('circuit-board');
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({
      voltage: 6,
      resistance1: 100,
      resistance2: 220,
      configuration: 1,
    });
    expect(game.entityStates.get(BOARD, 'param.configuration')).toBe(1);
    expect(Object.keys(v.pose.sample)).toEqual([...circuitModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
  });

  it('closes the switch at 0.5 s: 12 V across 100 Ω ∥ 220 Ω, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'ohm-instructions', 'inspect')).toBe(true);
    expect(act(game, 'ohm-dial-configuration', 'raise')).toBe(true); // parallel
    expect(act(game, 'ohm-dial-voltage', 'raise')).toBe(true); // 12 V
    expect(act(game, 'ohm-run', 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      voltage: 12,
      resistance1: 100,
      resistance2: 220,
      configuration: 2,
      switchTime: 0.5,
      duration: 3,
    });
    const r = parallel(100, 220); // 68.75 Ω
    const pose = view(game).pose;
    let open = 0;
    let closed = 0;
    while (session(game).state === 'running') {
      game.update(H);
      // The board's needle and switch are drawn from the model's own values this frame.
      expect(pose.sample.current).toBe(run.value('current'));
      expect(pose.sample.switch).toBe(run.value('switch'));
      if (run.time < 0.5) {
        open++;
        expect([pose.sample.switch, pose.sample.current, pose.sample.voltage]).toEqual([0, 0, 0]);
      } else {
        closed++;
        expect(pose.sample.switch).toBe(1);
        expect(pose.sample.current).toBeCloseTo(12 / r, 12);
      }
    }
    expect([open, closed].every((n) => n > 20)).toBe(true);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(3, 9);

    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.networkVoltage).toBe(12);
    expect(results.current).toBeCloseTo(12 / r, 12);
    expect(results.resistance).toBeCloseTo(r, 9); // U/I is R1·R2/(R1 + R2)
    expect(results.power).toBeCloseTo(144 / r, 12);
    expect(results.energy).toBeCloseTo((144 / r) * 2.5, 9); // closed for 2.5 s
    expect([results.voltage1, results.voltage2]).toEqual([12, 12]); // one voltage
    expect(results.current1).toBeCloseTo(0.12, 12);
    expect(results.current2).toBeCloseTo(12 / 220, 12);
    expect(results.current1! + results.current2!).toBeCloseTo(results.current!, 12);
    expect(game.state.progression.completedExperiments).toEqual(['ohms-law']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record?.theory()?.equivalentResistance).toBeCloseTo(r, 9);

    expect(act(game, 'ohm-monitor', 'view-results')).toBe(true);
    expect(act(game, 'ohm-reset', 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('splits the voltage in series and leaves R2 dead when R1 is alone', async () => {
    const { game } = await lab();
    act(game, 'ohm-run', 'run'); // 6 V, 100 Ω + 220 Ω in series
    runUntilDone(game);
    const series = session(game).history.at(-1)!.results!;
    expect(series.current).toBeCloseTo(6 / 320, 12); // one current
    expect(series.voltage1).toBeCloseTo((6 * 100) / 320, 12);
    expect(series.voltage2).toBeCloseTo((6 * 220) / 320, 12);
    expect(series.voltage1! + series.voltage2!).toBeCloseTo(6, 12);
    act(game, 'ohm-reset', 'reset');
    act(game, 'ohm-dial-configuration', 'lower'); // R1 alone
    act(game, 'ohm-run', 'run');
    runUntilDone(game);
    const single = session(game).history.at(-1)!.results!;
    expect(single.current).toBeCloseTo(6 / 100, 12);
    expect([single.voltage2, single.current2]).toEqual([0, 0]);
  });

  it('fits U against I over four voltages: the slope is R_eq', async () => {
    const { game } = await lab();
    act(game, 'ohm-dial-configuration', 'raise'); // 100 Ω ∥ 220 Ω
    dial(game, 'ohm-dial-voltage', 'lower', 2); // 1.5 V
    for (let k = 0; k < 4; k++) {
      act(game, 'ohm-run', 'run');
      runUntilDone(game);
      act(game, 'ohm-reset', 'reset');
      act(game, 'ohm-dial-voltage', 'raise'); // 3, 6, 12 V
    }
    const { definition, history } = session(game);
    const rows = analysisRows(definition, definition.analyses[0]!, history);
    // Each point is (I, U) of one run: U = I·R_eq at 1.5, 3, 6 and 12 V.
    expect(rows.map((row) => Number((row.x * parallel(100, 220)).toFixed(9)))).toEqual([
      1.5, 3, 6, 12,
    ]);
    const fit = fitLine(rows);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(parallel(100, 220), 9);
    expect(fit.intercept).toBeCloseTo(0, 9);
  });

  it('offers only its presets, none refused, and the HUD follows it from its desk', async () => {
    const { game } = await lab();
    const stops: Record<string, number[]> = {};
    for (const [dialId, parameter, presets] of [
      ['ohm-dial-voltage', 'voltage', 4],
      ['ohm-dial-resistance1', 'resistance1', 4],
      ['ohm-dial-resistance2', 'resistance2', 4],
      ['ohm-dial-configuration', 'configuration', 3],
    ] as const) {
      dial(game, dialId, 'lower', presets);
      stops[parameter] = [];
      for (let i = 0; i < presets; i++) {
        expect(view(game).runBlock).toBeNull();
        stops[parameter].push(session(game).parameters[parameter]!);
        act(game, dialId, 'raise');
      }
      expect(act(game, dialId, 'raise')).toBe(false); // at the top already
    }
    expect(stops).toEqual({
      voltage: [1.5, 3, 6, 12],
      resistance1: [100, 220, 470, 1000],
      resistance2: [100, 220, 470, 1000],
      configuration: [0, 1, 2],
    });
    placePlayer(game, [2.73, 0, 5.6]); // at its desk
    expect(game.stations.activeStation()?.id).toBe(BOARD);
    for (const at of [
      [-1.2, 0, 11.3], // the projectile desk and monitor: the launcher's, as before
      [2.2, 0, 12.3],
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe('projectile-range/launcher');
    }
  });
});
