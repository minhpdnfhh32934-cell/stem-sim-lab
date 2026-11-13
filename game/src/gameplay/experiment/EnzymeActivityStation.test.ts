import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { enzymeModel } from '../../simulation/models/enzyme';
import type { BenchView } from './StationSystem';

// Catalase and hydrogen peroxide on the Biology Lab's north wall bench (content:
// lab-placements.json), worked in its workspace as a player does: the rig's action opens it, the
// bench's choices are the `set` commands the host sends, then RUN ("Start"), the record, RESET, and
// the activity against temperature and pH across the runs. The rate is written out here from Michaelis–Menten, its integrated law (solved by
// bisection) and the stated temperature and pH factors (the optimum found by search), not taken
// from the model.

const H = 1 / 60;
const LAB = 'biology-lab';
const RIG = `${LAB}/enzyme`;
/** The station's fixed inputs (experiments/enzyme-activity.json). */
const KM = 0.1; // mol/L
const A = 0.01; // mol/(L·s) per mL of extract at the optimum
const Q10 = 2;
const TM = 41; // °C
const W = 3; // °C
const PH_OPT = 7;
const SIGMA = 1.5;
const V_MIX = 5; // mL
const V_M = 24.06; // L/mol
const WINDOW = 10; // s
const COLLECT = 60; // s

/** The rate's speed-up times the folded share: Q₁₀^((T − Tm)/10)/(1 + e^((T − Tm)/w)). */
const g = (t: number) => Q10 ** ((t - TM) / 10) / (1 + Math.exp((t - TM) / W));
/** Where g peaks, by ternary search over liquid water (g has one peak). */
const T_OPT = (() => {
  let [lo, hi] = [0, 100];
  for (let i = 0; i < 200; i++) {
    const [a, b] = [lo + (hi - lo) / 3, hi - (hi - lo) / 3];
    if (g(a) < g(b)) lo = a;
    else hi = b;
  }
  return (lo + hi) / 2;
})();
const activity = (t: number, pH: number) =>
  (g(t) / g(T_OPT)) * Math.exp(-((pH - PH_OPT) ** 2) / (2 * SIGMA ** 2));
const vmax = (t: number, pH: number, e: number) => A * e * activity(t, pH);
/** S after t s: the root of K_m·ln(S₀/S) + S₀ − S = V_max·t, by bisection on (0, S₀]. */
function substrate(s0: number, vm: number, t: number) {
  const f = (s: number) => KM * Math.log(s0 / s) + s0 - s - vm * t;
  let [lo, hi] = [Number.MIN_VALUE, s0];
  for (let i = 0; i < 2000 && hi - lo > 1e-16; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** O₂ collected (mL) once ΔS mol/L is broken down: ½·ΔS·V_mix·V_m. */
const oxygen = (broken: number) => 0.5 * broken * V_MIX * V_M;

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: RIG, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
const view = (game: Game): BenchView => {
  const station = game.stations.view(RIG);
  if (station?.kind !== 'bench') throw new Error(`${RIG} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game, dt = 0.05) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** New game, then the developer jump to the Biology Lab (setup only). */
async function lab() {
  const booted = await bootTestGame({ content: bundledContent });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('enzyme activity station (Biology Lab)', () => {
  it('opens from the rig and is ready at once: 0.5 mol/L H₂O₂ at 30 °C and pH 6 with 1 mL of extract', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('enzyme-activity');
    expect(v.definition.presentation).toBe('2d-workspace');
    expect(v.model).toBe('gas-syringe-rig');
    expect(v.setup).toEqual([]); // the specification asks for no setup before RUN
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({
      substrate: 0.5,
      temperature: 30,
      pH: 6,
      enzymeVolume: 1,
    });
    expect(game.entityStates.get(RIG, 'param.pH')).toBe(6);
    expect(Object.keys(v.pose.sample)).toEqual([...enzymeModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(9).fill(false));

    // E at the apparatus works at the bench (inspecting it is F); the player stands still; it
    // counts as looking at the apparatus.
    expect(game.interaction.primaryAction(RIG)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(RIG)?.id).toBe('inspect');
    expect(game.interaction.perform(RIG, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(RIG);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.moveIntent).toEqual([0, 0, 0]);
    game.input.release('moveForward');
    // The desk, its dials and buttons, its display and the wall monitor are gone from the room;
    // the apparatus and its board stay.
    for (const part of ['desk', 'run', 'stop', 'reset', 'display', 'monitor']) {
      expect(game.world.entity(`${LAB}/enzyme-${part}`)).toBeFalsy();
    }
    expect(game.world.entity(RIG)).toBeTruthy();
    expect(game.world.entity(`${LAB}/enzyme-instructions`)).toBeTruthy();
    expect(game.workspace.close()).toBe(true);
  });

  it('collects O₂ for 60 s at 40 °C and pH 7: the rates, the activity, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'enzyme-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(RIG, 'open-workspace')).toBe(true);
    set(game, 'substrate', 1); // 1 mol/L
    set(game, 'temperature', 40); // 40 °C
    set(game, 'pH', 7); // pH 7
    set(game, 'enzymeVolume', 1.5); // 1.5 mL
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      km: KM,
      specificActivity: A,
      q10: Q10,
      meltTemperature: TM,
      meltWidth: W,
      optimumPH: PH_OPT,
      pHWidth: SIGMA,
      mixtureVolume: V_MIX,
      molarVolume: V_M,
      window: WINDOW,
      collectionTime: COLLECT,
      substrate: 1,
      temperature: 40,
      pH: 7,
      enzymeVolume: 1.5,
    });
    const vm = vmax(40, 7, 1.5);

    // The plunger, the bubbles and the stopwatch are drawn from the model's own values this frame.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      expect(pose.sample.oxygen).toBe(run.value('oxygen'));
      expect(pose.sample.clock).toBe(run.value('clock'));
      const left = substrate(1, vm, run.value('clock'));
      expect(pose.sample.oxygen).toBeCloseTo(oxygen(1 - left), 9);
      expect(pose.sample.rate).toBeCloseTo((vm * left) / (KM + left), 12);
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(COLLECT, 6); // the model ends it on the collection time

    const [s10, s60] = [substrate(1, vm, WINDOW), substrate(1, vm, COLLECT)];
    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.initialRate).toBeCloseTo(vm / (KM + 1), 12); // v₀ = V_max·S₀/(K_m + S₀)
    expect(results.windowOxygen).toBeCloseTo(oxygen(1 - s10), 9);
    expect(results.windowRate).toBeCloseTo((1 - s10) / WINDOW, 12);
    expect(results.inverseWindowRate).toBeCloseTo(WINDOW / (1 - s10), 6);
    expect(results.oxygen).toBeCloseTo(oxygen(1 - s60), 9); // 42 mL: inside the 100 mL syringe
    expect(results.oxygen).toBeLessThan(100);
    expect(results.conversion).toBeCloseTo(100 * (1 - s60), 9);
    expect(results.activity).toBeCloseTo(activity(40, 7), 12);
    expect(results.inverseSubstrate).toBe(1);
    expect(game.state.progression.completedExperiments).toEqual(['enzyme-activity']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    const theory = record!.theory()!;
    expect(theory.optimumTemperature).toBeCloseTo(T_OPT, 6); // 37.0 °C
    expect(theory.finalOxygen).toBeCloseTo(oxygen(1 - s60), 9);
    expect(theory.ratePerEnzyme).toBeCloseTo(vm / (KM + 1) / 1.5, 12);
    // The activity is named beside its number, in each language.
    const named = record!.definition.results.find((r) => r.id === 'activity')!;
    expect(resultClass(named, results.activity!)).toBe('Near the optimum'); // 0.906
    const vi = createTexts({}, () => 'vi');
    expect(resultClass(named, results.activity!, vi)).toBe('Gần tối ưu');

    send(game, { command: 'view' });
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('fits the mean rate over the first 10 s against the extract added', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(RIG, 'open-workspace')).toBe(true);
    for (const e of [0.5, 1, 1.5, 2]) {
      set(game, 'enzymeVolume', e);
      send(game, { command: 'run' });
      runUntilDone(game);
      send(game, { command: 'reset' });
    }
    const { definition, history } = session(game);
    const volumes = [0.5, 1, 1.5, 2];
    expect(history.map((r) => r.inputs.enzymeVolume)).toEqual(volumes);
    const rates = volumes.map((e) => (0.5 - substrate(0.5, vmax(30, 6, e), WINDOW)) / WINDOW);
    expect(history.map((r) => r.results!.windowRate!)).toEqual(
      rates.map((v) => expect.closeTo(v, 12) as number),
    );
    const amount = definition.analyses.find((a) => a.id === 'enzyme-amount')!;
    const fit = fitLine(analysisRows(definition, amount, history));
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    // The least-squares line through the points written out here.
    const mx = volumes.reduce((s, x) => s + x, 0) / 4;
    const my = rates.reduce((s, y) => s + y, 0) / 4;
    const sxy = volumes.reduce((s, x, i) => s + (x - mx) * (rates[i]! - my), 0);
    const sxx = volumes.reduce((s, x) => s + (x - mx) ** 2, 0);
    expect(fit.slope).toBeCloseTo(sxy / sxx, 12);
    // Against v₀/E: the mean over 10 s falls a little behind the initial rate, more with more
    // extract (up to 2 % at 2 mL).
    const v0PerMl = vmax(30, 6, 1) * (0.5 / (KM + 0.5));
    expect(history[0]!.theory()!.ratePerEnzyme).toBeCloseTo(v0PerMl, 12);
    expect(fit.slope / v0PerMl).toBeGreaterThan(0.97);
    expect(fit.slope / v0PerMl).toBeLessThan(1);
  });

  it('plots the activity against temperature and against pH from the runs alone (spec 25)', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(RIG, 'open-workspace')).toBe(true);
    for (const [temperature, pH] of [
      [20, 7],
      [30, 7],
      [40, 7],
      [50, 7],
      [40, 6],
      [40, 8],
      [40, 4],
    ] as const) {
      set(game, 'temperature', temperature);
      set(game, 'pH', pH);
      send(game, { command: 'run' });
      runUntilDone(game);
      send(game, { command: 'reset' });
    }
    const { definition, history } = session(game);
    // Two scatters, no fit: x a parameter, y the relative activity, one point per completed run.
    expect(definition.scatters.map((p) => [p.id, p.x, p.y])).toEqual([
      ['activity-temperature', 'temperature', 'activity'],
      ['activity-ph', 'pH', 'activity'],
    ]);
    expect(history).toHaveLength(7);
    expect(history.map((r) => r.inputs.temperature)).toEqual([20, 30, 40, 50, 40, 40, 40]);
    expect(history.map((r) => r.inputs.pH)).toEqual([7, 7, 7, 7, 6, 8, 4]);
    expect(history.map((r) => r.results!.activity!)).toEqual(
      history.map(
        (r) => expect.closeTo(activity(r.inputs.temperature!, r.inputs.pH!), 12) as number,
      ),
    );
    // The optimum lies between the temperatures run, at pH 7; pH 6 and 8 give equal activity.
    const at = (t: number, pH: number) =>
      history.find((r) => r.inputs.temperature === t && r.inputs.pH === pH)!.results!.activity!;
    expect(at(40, 7)).toBeGreaterThan(at(30, 7));
    expect(at(40, 7)).toBeGreaterThan(at(50, 7));
    expect(at(40, 6)).toBeCloseTo(at(40, 8), 12);
    expect(at(40, 7)).toBeGreaterThan(at(40, 6));
  });

  it('offers only its presets, refuses the rest and a change while running, and the HUD follows it from the rig', async () => {
    const { game, blocked } = await lab();
    const presets = (id: string) =>
      view(game)
        .definition.parameters.find((p) => p.id === id)!
        .presets.map((p) => p.value);
    const stops: Record<string, number[]> = {};
    for (const parameter of Object.keys(session(game).parameters)) {
      stops[parameter] = presets(parameter);
      for (const value of stops[parameter]) {
        expect(game.stations.refusal(RIG, 'set', parameter, value)).toBeNull();
        set(game, parameter, value);
        expect(session(game).parameters[parameter]).toBe(value);
        expect(view(game).runBlock).toBeNull();
      }
    }
    expect(stops).toEqual({
      substrate: [0.05, 0.1, 0.5, 1],
      temperature: [20, 30, 40, 50],
      pH: [4, 6, 7, 8, 10],
      enzymeVolume: [0.5, 1, 1.5, 2],
    });
    expect(blocked).toEqual([]);
    expect(game.stations.refusal(RIG, 'set', 'pH', 5)).toMatch(/cannot be set to 5/);
    send(game, { command: 'run' });
    expect(game.stations.refusal(RIG, 'set', 'pH', 7)).toBe(
      'Stop the run before changing its parameters.',
    );
    // Where the e2e specs stand at the rig and its board (stationZones.test.ts): the old points
    // were stale, and T-6b's mark and recapture now stands nearer them.
    for (const at of [
      [1, 0, -5.9], // its rig
      [3.2, 0, -6.5], // its board
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe(RIG);
    }
  });
});
