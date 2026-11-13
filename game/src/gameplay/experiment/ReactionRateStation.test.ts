import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { kineticsModel } from '../../simulation/models/kinetics';
import type { BenchView } from './StationSystem';

// Crystal violet fading on the Chemistry Lab's north wall bench (content: rooms.json), worked in
// its workspace as a player does: the apparatus' action opens it, the flasks and the cuvette are
// placed (the commands the host sends), RUN, the record, RESET. The rate is written out here from
// the rate law, Beer–Lambert and Arrhenius, not taken from the model.

const H = 1 / 60;
const LAB = 'chemistry-lab';
const COLORIMETER = `${LAB}/kinetics`;
const REFUSED = 'The model does not cover these settings: change a dial.';
const FLASK = 'Put the crystal violet flask in the water bath first.';
/** The station's fixed inputs (experiments/reaction-rate.json). */
const K25 = 0.1; // L/(mol·s) at 25 °C
const EA = 60_000; // J/mol
const R = 6.02214076e23 * 1.380649e-23; // J/(mol·K): N_A·k_B, exact in the SI
const EPSILON_L = 1e7 * 0.01; // ε·l, L/mol

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const view = (game: Game): BenchView => {
  const station = game.stations.view(COLORIMETER);
  if (station?.kind !== 'bench') throw new Error(`${COLORIMETER} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: COLORIMETER, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
/** Does every before-run setup step the station lists and has not done, in order. */
const prepare = (game: Game) => {
  for (const { step } of view(game).setup) {
    if (step.phase === 'before-run' && !view(game).setup.find((s) => s.step.id === step.id)?.done) {
      send(game, { command: 'setup', step: step.id });
    }
  }
};
const runUntilDone = (game: Game, dt = 0.05) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** 1/T₂₅ − 1/T in kelvin, for θ in °C. */
const shift = (theta: number) => 1 / 298.15 - 1 / (theta + 273.15);
/** k′ = k₂₅·exp((Eₐ/R)(1/T₂₅ − 1/T))·[OH⁻]₀ (1/s). */
const pseudoRate = (theta: number, oh: number) => K25 * Math.exp((EA / R) * shift(theta)) * oh;

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

describe('reaction-rate station (Chemistry Lab)', () => {
  it('opens from the colorimeter, holds RUN until the bench is set up, then runs and shows its results', async () => {
    const { game, blocked } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('reaction-rate');
    expect(v.definition.presentation).toBe('2d-workspace');
    expect(v.model).toBe('colorimeter');
    // Not ready: the flasks are not in the bath, the cuvette is not in the colorimeter. Only the
    // steps of the flasks chosen are listed (10 µmol/L of dye, 0.2 mol/L of NaOH).
    expect(v.session.state).toBe('idle');
    expect(v.setup.map((s) => s.step.id)).toEqual(['dye-10', 'naoh-020', 'cuvette']);
    expect(v.runBlock).toBe(FLASK);
    expect(v.session.parameters).toEqual({
      initialConcentration: 1e-5,
      naoh: 0.2,
      temperature: 25,
      timerResolution: 0.1,
    });
    expect(game.entityStates.get(COLORIMETER, 'param.temperature')).toBe(25);
    expect(Object.keys(v.pose.sample)).toEqual([...kineticsModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(7).fill(false));

    // E at the apparatus works at the bench; inspecting it is the other action (F).
    expect(game.interaction.primaryAction(COLORIMETER)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(COLORIMETER)?.id).toBe('inspect');
    expect(game.interaction.perform(COLORIMETER, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(COLORIMETER);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    send(game, { command: 'run' });
    expect(blocked).toEqual([FLASK]);
    expect(session(game).state).toBe('idle');

    // Another dye flask: its own step is asked for, the first one's is not.
    set(game, 'initialConcentration', 5e-6);
    expect(view(game).setup.map((s) => s.step.id)).toEqual(['dye-5', 'naoh-020', 'cuvette']);
    prepare(game);
    expect(view(game).session.state).toBe('configured');
    expect(view(game).runBlock).toBeNull();
    expect(view(game).checklist[3]).toMatchObject({ done: true }); // the cuvette step
    send(game, { command: 'run' });
    expect(session(game).state).toBe('running');
    runUntilDone(game);
    const [record] = session(game).history;
    expect(record?.results?.rateConstant).toBeCloseTo(pseudoRate(25, 0.2), 9);
    expect(game.workspace.close()).toBe(true);
  });

  it('fades at 45 °C in 0.25 mol/L NaOH: k′, t½ and its class, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'kinetics-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(COLORIMETER, 'open-workspace')).toBe(true);
    set(game, 'temperature', 45);
    set(game, 'naoh', 0.25);
    prepare(game);
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      referenceRate: K25,
      referenceTemperature: 25,
      activationEnergy: EA,
      absorptivity: 1e7,
      pathLength: 0.01,
      endFraction: 0.25,
      initialConcentration: 1e-5,
      naoh: 0.25,
      temperature: 45,
      timerResolution: 0.1,
    });
    const k = pseudoRate(45, 0.25); // 0.1145 1/s
    const a0 = EPSILON_L * 1e-5; // A₀ = ε·l·c₀ = 1

    // The colorimeter's reading and timer are drawn from the model's own values this frame.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      expect(pose.sample.absorbance).toBe(run.value('absorbance'));
      expect(pose.sample.elapsed).toBe(run.value('elapsed'));
      expect(pose.sample.absorbance).toBeCloseTo(a0 * Math.exp(-k * run.time), 9);
      expect(pose.sample.lnAbsorbance).toBeCloseTo(Math.log(a0) - k * run.time, 9); // a line
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(Math.log(4) / k, 6); // a quarter of the dye left

    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.initialAbsorbance).toBeCloseTo(a0, 12);
    expect(results.rateConstant).toBeCloseTo(k, 9);
    expect(results.halfLife).toBeCloseTo(Math.LN2 / k, 6); // 6.05 s
    expect(results.finalAbsorbance).toBeCloseTo(a0 / 4, 9);
    expect(results.finalConcentration).toBeCloseTo(2.5e-6, 15);
    expect(results.lnRateRatio).toBeCloseTo((EA / R) * shift(45), 6);
    expect(results.inverseTemperatureShift).toBeCloseTo(shift(45), 12);
    expect(game.state.progression.completedExperiments).toEqual(['reaction-rate']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record!.theory()!.rateConstant).toBeCloseTo(k, 12);
    expect(record!.theory()!.activationTemperature).toBeCloseTo(EA / R, 6);
    // The half-life is named beside its number, in each language.
    const halfLife = record!.definition.results.find((r) => r.id === 'halfLife')!;
    expect(resultClass(halfLife, results.halfLife!)).toBe('Fast');
    const vi = createTexts({}, () => 'vi');
    expect(resultClass(halfLife, results.halfLife!, vi)).toBe('Nhanh');
    // The timer, in s, reads the record's own half-life to its own d.
    expect(readings(record!.definition, record!)).toMatchObject([
      { result: 'halfLife', unit: 's', reading: 6.1, text: '6.1', bound: 0.05 },
    ]);

    send(game, { command: 'view' });
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured'); // the bench stays set up
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('fits k′ against [OH⁻] at 45 °C: the slope is k, whatever the dye', async () => {
    const { game } = await lab();
    set(game, 'temperature', 45);
    const ohs = [0.15, 0.2, 0.25];
    const dyes = [1e-5, 5e-6, 2e-6]; // k′ does not depend on it
    for (let n = 0; n < 3; n++) {
      set(game, 'naoh', ohs[n]!);
      set(game, 'initialConcentration', dyes[n]!);
      prepare(game);
      send(game, { command: 'run' });
      runUntilDone(game);
      send(game, { command: 'reset' });
    }
    const { definition, history } = session(game);
    expect(history.map((r) => r.inputs.naoh)).toEqual(ohs);
    expect(history.map((r) => r.results!.halfLife!)).toEqual(
      ohs.map((oh) => expect.closeTo(Math.LN2 / pseudoRate(45, oh), 6) as number),
    );
    const order = definition.analyses.find((a) => a.id === 'order')!;
    const fit = fitLine(analysisRows(definition, order, history));
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(pseudoRate(45, 1), 9); // k at 45 °C, L/(mol·s)
    expect(fit.intercept).toBeCloseTo(0, 9);
  });

  it('offers only its presets, none refused, and the HUD follows it from the colorimeter', async () => {
    const { game } = await lab();
    const stops: Record<string, number[]> = {};
    for (const parameter of ['initialConcentration', 'naoh', 'temperature', 'timerResolution']) {
      stops[parameter] = [];
      for (const preset of view(game).definition.parameters.find((p) => p.id === parameter)!
        .presets) {
        expect(game.stations.refusal(COLORIMETER, 'set', parameter, preset.value)).toBeNull();
        set(game, parameter, preset.value);
        prepare(game);
        expect(view(game).runBlock).toBeNull();
        stops[parameter].push(session(game).parameters[parameter]!);
      }
    }
    expect(stops).toEqual({
      initialConcentration: [2e-6, 5e-6, 1e-5],
      naoh: [0.1, 0.15, 0.2, 0.25],
      temperature: [20, 25, 35, 45],
      timerResolution: [0.1, 1, 5],
    });
    expect(game.stations.refusal(COLORIMETER, 'set', 'naoh', 0.3)).toBe(
      '[OH⁻]₀ cannot be set to 0.3 mol/L.',
    );
    // The slowest corner (20 °C, 0.1 mol/L) ends by the model well inside its 300 s.
    expect(Math.log(4) / pseudoRate(20, 0.1)).toBeLessThan(
      view(game).definition.simulation.maxDuration,
    );
    placePlayer(game, [-4.379, 0, -9.9]); // at its board
    expect(game.stations.activeStation()?.id).toBe(COLORIMETER);
  });

  it('refuses a dye too dark to read, with the reason, and runs once it is diluted', async () => {
    // A content change no setting makes: ε 2.5·10⁷ L/(mol·m) puts A₀ at 2.5 for 10 µmol/L.
    const experiments = (bundledContent.experiments as Record<string, unknown>[]).map((e) =>
      e.id === 'reaction-rate'
        ? {
            ...e,
            initialConditions: {
              ...(e.initialConditions as Record<string, number>),
              absorptivity: 2.5e7,
            },
          }
        : e,
    );
    // The question banks are written for the shipped values: not with this change.
    const { game, blocked } = await lab({ ...bundledContent, experiments, questions: [] });
    prepare(game);
    expect(view(game).runBlock).toBe(REFUSED);
    send(game, { command: 'run' });
    expect(blocked.at(-1)).toBe(REFUSED);
    expect(session(game).run).toBeNull();
    set(game, 'initialConcentration', 5e-6); // A₀ = 1.25
    prepare(game);
    expect(view(game).runBlock).toBeNull();
    send(game, { command: 'run' });
    expect(session(game).state).toBe('running');
  });
});
