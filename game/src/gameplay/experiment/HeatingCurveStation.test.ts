import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { heatingModel } from '../../simulation/models/heating';
import type { BenchView } from './StationSystem';

// The heating curve of water on the hot plate by the Chemistry Lab's fume hood (content:
// rooms.json), worked at its bench-embedded workspace as a player does: the apparatus' action opens
// it, the beaker and the hot plate are set (the commands the host sends), RUN, the record, RESET.
// Each stage's time is written out here from Q = P·t, not taken from the model.

const H = 1 / 60;
const LAB = 'chemistry-lab';
const PLATE = `${LAB}/heating`;
const REFUSED = 'The model does not cover these settings: change a dial.';
/** The station's fixed inputs (experiments/heating-curve.json): textbook constants of water. */
const C_ICE = 2100; // J/(kg·K)
const L_F = 334_000; // J/kg
const C_W = 4180; // J/(kg·K)
const L_V = 2_257_000; // J/kg
const BOIL_OFF = 0.05;

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: PLATE, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
const view = (game: Game): BenchView => {
  const station = game.stations.view(PLATE);
  if (station?.kind !== 'bench') throw new Error(`${PLATE} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game, dt = 0.05) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** Each stage's heat over P: ice to 0 °C, melting, water to 100 °C, boiling f of it away. */
const stages = (p: number, m: number, t0: number) => {
  const ice = (m * C_ICE * (0 - t0)) / p;
  const melt = (m * L_F) / p;
  const water = (m * C_W * 100) / p;
  const boil = (BOIL_OFF * m * L_V) / p;
  return { ice, melt, water, boil, toBoil: ice + melt + water, total: ice + melt + water + boil };
};

/** New game, then the developer jump to the Chemistry Lab (setup only). */
async function lab(content = bundledContent) {
  const booted = await bootTestGame({ content });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('heating-curve station (Chemistry Lab)', () => {
  it('is ready at once: 0.1 kg of ice at −10 °C under 500 W, no sample yet', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('heating-curve');
    expect(v.definition.presentation).toBe('bench-embedded');
    expect(v.setup).toEqual([]); // the rig stands assembled: nothing to set up
    expect(v.model).toBe('hot-plate');
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({
      power: 500,
      mass: 0.1,
      startTemperature: -10,
      resolution: 0.1,
    });
    expect(game.entityStates.get(PLATE, 'param.mass')).toBe(0.1);
    expect(Object.keys(v.pose.sample)).toEqual([...heatingModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(8).fill(false));
  });

  it('opens from the hot plate, takes its settings at the beaker and the plate, runs and shows its results', async () => {
    const { game } = await lab();
    // E at the apparatus works at the bench; inspecting it is the other action (F).
    expect(game.interaction.primaryAction(PLATE)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(PLATE)?.id).toBe('inspect');
    expect(game.interaction.perform(PLATE, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(PLATE);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    // The beaker owns the ice, the plate the power, the stopwatch its resolution (the callouts).
    const owner = (parameter: string) =>
      view(game).definition.workspace!.pieces.find((p) => p.owns.includes(parameter))?.id;
    expect(['mass', 'startTemperature', 'power', 'resolution'].map(owner)).toEqual([
      'beaker',
      'beaker',
      'plate',
      'stopwatch',
    ]);
    set(game, 'mass', 0.05);
    set(game, 'power', 800);
    send(game, { command: 'run' });
    expect(session(game).state).toBe('running');
    runUntilDone(game);
    const s = stages(800, 0.05, -10);
    const [record] = session(game).history;
    expect(record?.results?.meltingTime).toBeCloseTo(s.melt, 6);
    expect(record?.results?.state).toBe(3);
    expect(game.workspace.close()).toBe(true);
  });

  it('heats 0.05 kg from −5 °C at 800 W: both plateaus, the stopwatch, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'heating-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(PLATE, 'open-workspace')).toBe(true);
    set(game, 'mass', 0.05);
    set(game, 'startTemperature', -5);
    set(game, 'power', 800);
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      iceHeatCapacity: C_ICE,
      fusionHeat: L_F,
      waterHeatCapacity: C_W,
      vaporisationHeat: L_V,
      meltingPoint: 0,
      boilingPoint: 100,
      boilOffFraction: BOIL_OFF,
      power: 800,
      mass: 0.05,
      startTemperature: -5,
      resolution: 0.1,
    });
    const s = stages(800, 0.05, -5); // 0.656 + 20.875 + 26.125 + 7.053 s

    // The thermometer and the ice are drawn from the model's own values this frame: the ice warms,
    // then holds at 0 °C while it melts.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      expect(pose.sample.temperature).toBe(run.value('temperature'));
      expect(pose.sample.iceFraction).toBe(run.value('iceFraction'));
      const t = run.time;
      const melted = Math.max(0, t - s.ice) / s.melt;
      expect(pose.sample.temperature).toBeCloseTo(
        t < s.ice ? -5 + (800 * t) / (0.05 * C_ICE) : 0,
        9,
      );
      expect(pose.sample.iceFraction).toBeCloseTo(1 - melted, 9);
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(s.total, 6); // 54.71 s: 5 % boiled away

    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.iceWarmingTime).toBeCloseTo(s.ice, 6);
    expect(results.meltingTime).toBeCloseTo(s.melt, 6);
    expect(results.waterWarmingTime).toBeCloseTo(s.water, 6);
    expect(results.boilStartTime).toBeCloseTo(s.toBoil, 6);
    expect(results.boilingTime).toBeCloseTo(s.boil, 6);
    expect(results.temperature).toBeCloseTo(100, 9);
    expect(results.heat).toBeCloseTo(800 * s.total, 3); // Q = P·t
    expect(results.vapourMass).toBeCloseTo(0.0025, 9);
    expect(results.waterMass).toBeCloseTo(0.0475, 9);
    expect(results.state).toBe(3);
    expect(game.state.progression.completedExperiments).toEqual(['heating-curve']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record!.theory()!.meltingTime).toBeCloseTo(s.melt, 9);
    expect(record!.theory()!.meltingSlope).toBeCloseTo(L_F / 800, 9); // t_f per kg: L_f/P
    // The end state is named beside its number, in each language.
    const state = record!.definition.results.find((r) => r.id === 'state')!;
    expect(resultClass(state, results.state!)).toBe('Boiling');
    expect(
      resultClass(
        state,
        results.state!,
        createTexts({}, () => 'vi'),
      ),
    ).toBe('Đang sôi');
    // Two stopwatch readings, in s, of the record's own times to its own d.
    expect(readings(record!.definition, record!)).toMatchObject([
      { result: 'meltingTime', unit: 's', reading: 20.9, text: '20.9', bound: 0.05 },
      { result: 'boilStartTime', unit: 's', reading: 47.7, text: '47.7', bound: 0.05 },
    ]);

    send(game, { command: 'view' });
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('offers only its presets, none refused, and the HUD follows it from the plate', async () => {
    const { game } = await lab();
    const stops: Record<string, number[]> = {};
    for (const parameter of ['mass', 'startTemperature', 'power', 'resolution']) {
      stops[parameter] = [];
      for (const preset of view(game).definition.parameters.find((p) => p.id === parameter)!
        .presets) {
        expect(game.stations.refusal(PLATE, 'set', parameter, preset.value)).toBeNull();
        set(game, parameter, preset.value);
        expect(view(game).runBlock).toBeNull();
        stops[parameter].push(session(game).parameters[parameter]!);
      }
    }
    expect(stops).toEqual({
      mass: [0.05, 0.07, 0.1],
      startTemperature: [-20, -10, -5, 0],
      power: [200, 500, 800],
      resolution: [0.01, 0.1, 1],
    });
    expect(game.stations.refusal(PLATE, 'set', 'power', 600)).toBe('P cannot be set to 600 W.');
    // The slowest corner (0.1 kg from −20 °C at 200 W) ends by the model inside its 600 s.
    expect(stages(200, 0.1, -20).total).toBeLessThan(view(game).definition.simulation.maxDuration);
    for (const at of [
      [5.743, 0, -7.353], // beside its bench
      [8.55, 0, -7.303], // its board
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe(PLATE);
    }
  });

  it('refuses ice above its melting point, with the reason, and runs once it is colder', async () => {
    // A content change no dial makes: a melting point of −20 °C leaves −10 °C ice already liquid.
    const experiments = (bundledContent.experiments as Record<string, unknown>[]).map((e) =>
      e.id === 'heating-curve'
        ? {
            ...e,
            initialConditions: {
              ...(e.initialConditions as Record<string, number>),
              meltingPoint: -20,
            },
          }
        : e,
    );
    // The question banks are written for the shipped values: not with this change.
    const { game, blocked } = await lab({ ...bundledContent, experiments, questions: [] });
    expect(view(game).runBlock).toBe(REFUSED);
    send(game, { command: 'run' });
    expect(blocked.at(-1)).toBe(REFUSED);
    expect(session(game).run).toBeNull();
    set(game, 'startTemperature', -20);
    expect(view(game).runBlock).toBeNull();
    send(game, { command: 'run' });
    expect(session(game).state).toBe('running');
  });
});
