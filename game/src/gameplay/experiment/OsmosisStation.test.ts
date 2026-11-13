import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { osmosisModel } from '../../simulation/models/osmosis';
import type { BenchView } from './StationSystem';

// Osmosis in potato on the Biology Lab's west wall bench (content: lab-placements.json), worked in
// its workspace as a player does: the rack's action opens it, the bench's choices are the `set`
// commands the host sends, then RUN ("Soak"), the record, RESET. The water flow is written out here
// from van 't Hoff and the stated tissue constants, not taken from the model.

const H = 1 / 60;
const LAB = 'biology-lab';
const RACK = `${LAB}/osmosis`;
/** The station's fixed inputs (experiments/osmosis.json). */
const THETA = 20; // °C
const C_ISO = 0.25; // mol/L
const E = 5000; // kPa
const TAU = 2700; // s
const LAPSE = 240; // soak seconds per run second
// J/(mol·K): N_A·k_B, exact in the SI (the model rounds it to 8.314462618: 2·10⁻¹¹ apart)
const R = 6.02214076e23 * 1.380649e-23;
const RT = R * (THETA + 273.15); // kPa·L/mol: R·T·C in kPa for C in mol/L

/** Δm/m₀ after soaking t s in C mol/L: ΔΨ₀/E·(1 − e^(−t/τ)), ΔΨ₀ = R·T·(C_iso − C). */
const fraction = (c: number, t: number) => ((RT * (C_ISO - c)) / E) * (1 - Math.exp(-t / TAU));

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: RACK, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
const view = (game: Game): BenchView => {
  const station = game.stations.view(RACK);
  if (station?.kind !== 'bench') throw new Error(`${RACK} is not a bench station`);
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

describe('osmosis station (Biology Lab)', () => {
  it('opens from the rack and is ready at once: 0.4 mol/L, a 4 h soak, a 3 g cylinder, no sample', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('osmosis');
    expect(v.definition.presentation).toBe('2d-workspace');
    expect(v.model).toBe('osmosis-rack');
    // No setup in the definition or the specification: nothing to do before RUN.
    expect(v.setup).toEqual([]);
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({
      concentration: 0.4,
      soakTime: 14400,
      initialMass: 3,
      balanceResolution: 0.01,
    });
    expect(game.entityStates.get(RACK, 'param.concentration')).toBe(0.4);
    expect(Object.keys(v.pose.sample)).toEqual([...osmosisModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(6).fill(false));

    // E at the rack works at the bench (inspecting it is F); the player stands still; it counts
    // as looking at the apparatus.
    expect(game.interaction.primaryAction(RACK)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(RACK)?.id).toBe('inspect');
    expect(game.interaction.perform(RACK, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(RACK);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.moveIntent).toEqual([0, 0, 0]);
    game.input.release('moveForward');
    // The desk, its dials and buttons, its display and the wall monitor are gone from the room;
    // the apparatus and its board stay.
    for (const id of ['desk', 'run', 'stop', 'reset', 'display', 'monitor', 'dial-soak']) {
      expect(game.world.entity(`${RACK}-${id}`)).toBeFalsy();
    }
    expect(game.world.entity(RACK)).toBeTruthy();
    expect(game.world.entity(`${LAB}/osmosis-instructions`)).toBeTruthy();
    expect(game.workspace.close()).toBe(true);
  });

  it('loses water in 0.5 mol/L over 2 h: the mass, the balance, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'osmosis-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(RACK, 'open-workspace')).toBe(true);
    set(game, 'concentration', 0.5);
    set(game, 'soakTime', 7200); // 2 h
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      temperature: THETA,
      isotonicConcentration: C_ISO,
      tissueModulus: E,
      timeConstant: TAU,
      timeLapse: LAPSE,
      concentration: 0.5,
      soakTime: 7200,
      initialMass: 3,
      balanceResolution: 0.01,
    });

    // The tube's cylinder, the balance and the timer are drawn from the model's own values this frame.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      expect(pose.sample.labTime).toBe(run.value('labTime'));
      expect(pose.sample.mass).toBe(run.value('mass'));
      expect(pose.sample.labTime).toBeCloseTo(LAPSE * run.time, 6);
      expect(pose.sample.mass).toBeCloseTo(3 * (1 + fraction(0.5, LAPSE * run.time)), 9);
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(7200 / LAPSE, 6); // 30 s for 2 h

    const u = fraction(0.5, 7200); // −11.3 %
    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.solutionPotential).toBeCloseTo(-0.5 * RT, 6); // −1219 kPa
    expect(results.finalMass).toBeCloseTo(3 * (1 + u), 9);
    expect(results.percentChange).toBeCloseTo(100 * u, 9);
    expect(results.direction).toBe(-1);
    expect(game.state.progression.completedExperiments).toEqual(['osmosis']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record!.theory()!.finalMass).toBeCloseTo(3 * (1 + u), 9);
    expect(record!.theory()!.equilibriumPercent).toBeCloseTo((100 * RT * (C_ISO - 0.5)) / E, 9);
    // The flow is named beside its sign, in each language.
    const direction = record!.definition.results.find((r) => r.id === 'direction')!;
    expect(resultClass(direction, results.direction!)).toBe('Loses water');
    const vi = createTexts({}, () => 'vi');
    expect(resultClass(direction, results.direction!, vi)).toBe('Mất nước');
    // The balance, in g, reads the record's own mass to its own d.
    const m = 3 * (1 + u);
    expect(readings(record!.definition, record!)).toMatchObject([
      {
        result: 'finalMass',
        unit: 'g',
        text: (Math.round(m / 0.01) * 0.01).toFixed(2),
        bound: 0.005,
      },
    ]);

    send(game, { command: 'view' });
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('crosses 0 % at the isotonic concentration: four runs of one soak, fitted', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(RACK, 'open-workspace')).toBe(true);
    for (const [n, c] of [0, 0.2, 0.5, 1].entries()) {
      set(game, 'concentration', c);
      if (n === 2) set(game, 'initialMass', 5); // 5 g: the percent does not mind
      send(game, { command: 'run' });
      runUntilDone(game);
      send(game, { command: 'reset' });
    }
    const { definition, history } = session(game);
    expect(history.map((r) => r.inputs.concentration)).toEqual([0, 0.2, 0.5, 1]);
    expect(history.map((r) => r.results!.percentChange!)).toEqual(
      [0, 0.2, 0.5, 1].map((c) => expect.closeTo(100 * fraction(c, 14400), 8) as number),
    );
    // Water in below C_iso, out above it.
    expect(history.map((r) => r.results!.direction)).toEqual([1, 1, -1, -1]);
    const isotonic = definition.analyses.find((a) => a.id === 'isotonic')!;
    const fit = fitLine(analysisRows(definition, isotonic, history));
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    const slope = (-100 * RT * (1 - Math.exp(-14400 / TAU))) / E; // %/(mol/L)
    expect(fit.slope).toBeCloseTo(slope, 8);
    expect(-fit.intercept / fit.slope).toBeCloseTo(C_ISO, 9); // where it crosses 0 %
    expect(history[0]!.theory()!.percentSlope).toBeCloseTo(slope, 8);
  });

  it('offers only its presets, refuses the rest and a change while running, and the HUD follows it from the rack', async () => {
    const { game, blocked } = await lab();
    const presets = (id: string) =>
      view(game)
        .definition.parameters.find((p) => p.id === id)!
        .presets.map((p) => p.value);
    expect({
      concentration: presets('concentration'),
      soakTime: presets('soakTime'),
      initialMass: presets('initialMass'),
      balanceResolution: presets('balanceResolution'),
    }).toEqual({
      concentration: [0, 0.2, 0.5, 1],
      soakTime: [1800, 3600, 7200, 14400],
      initialMass: [2, 3, 5],
      balanceResolution: [0.001, 0.01, 0.1],
    });
    for (const parameter of Object.keys(session(game).parameters)) {
      for (const value of presets(parameter)) {
        expect(game.stations.refusal(RACK, 'set', parameter, value)).toBeNull();
        set(game, parameter, value);
        expect(session(game).parameters[parameter]).toBe(value);
        expect(view(game).runBlock).toBeNull();
      }
    }
    expect(blocked).toEqual([]);
    // Anything else is refused with the reason, and nothing changes.
    expect(game.stations.refusal(RACK, 'set', 'concentration', 0.3)).toMatch(
      /cannot be set to 0.3/,
    );
    set(game, 'concentration', 0.3);
    expect(blocked).toHaveLength(1);
    expect(session(game).parameters.concentration).toBe(1);
    // The longest soak ends by the model inside the run's 65 s.
    expect(14400 / LAPSE).toBeLessThan(view(game).definition.simulation.maxDuration);
    send(game, { command: 'run' });
    expect(game.stations.refusal(RACK, 'set', 'concentration', 0.2)).toBe(
      'Stop the run before changing its parameters.',
    );
    for (const at of [
      [-14, 0, 0.389], // its rack
      [-14, 0, -1.211], // its board
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe(RACK);
    }
  });
});
