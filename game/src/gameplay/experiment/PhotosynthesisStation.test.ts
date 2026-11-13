import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { readings } from '../../simulation/measurement';
import { photosynthesisModel } from '../../simulation/models/photosynthesis';
import type { BenchView } from './StationSystem';

// Pondweed under a lamp on the Biology Lab's lab bench (content: lab-placements.json), worked in its
// workspace as a player does: the apparatus' action opens it, the bench's choices are the `set`
// commands the host sends, then RUN ("Start"), the record, RESET. The rate is written
// out here from the inverse-square law and the light-response hyperbola with the model's stated
// teaching constants (their values copied, not imported), not taken from the model.

const H = 1 / 60;
const LAB = 'biology-lab';
const PLANT = `${LAB}/photosynthesis`;
/** The teaching constants (photosynthesis.ts, PHOTOSYNTHESIS) and the collection time. */
const I_REF = 10_000; // lux at 0.1 m
const ALPHA = 2e-6; // mL/s per lux
const P_MAX = 0.01; // mL/s
const K_C = 0.005; // mol/L
const BUBBLE = 0.01; // mL
const DURATION = 60; // s (experiments/photosynthesis.json)

/** The temperature factor: Q₁₀ = 2 below 30 °C, a straight fall to 0 at 45 °C above it. */
const heat = (t: number) => (t <= 30 ? 2 ** ((t - 30) / 10) : (45 - t) / 15);
/** I, the CO₂-and-warmth plateau P_c and the rate P with 1/P = 1/(αI) + 1/P_c. */
function rate(d: number, c: number, t: number) {
  const intensity = (I_REF * 0.1 ** 2) / d ** 2;
  const plateau = P_MAX * (c / (c + K_C)) * heat(t);
  return { intensity, plateau, rate: 1 / (1 / (ALPHA * intensity) + 1 / plateau) };
}

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: PLANT, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
const view = (game: Game): BenchView => {
  const station = game.stations.view(PLANT);
  if (station?.kind !== 'bench') throw new Error(`${PLANT} is not a bench station`);
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

describe('photosynthesis station (Biology Lab)', () => {
  it('opens from the pondweed and is ready at once: the lamp at 0.1 m, 0.05 mol/L NaHCO₃ at 25 °C', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('photosynthesis');
    expect(v.definition.presentation).toBe('observation');
    expect(v.model).toBe('pondweed-lamp');
    expect(v.setup).toEqual([]); // the specification asks for no setup before RUN
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({
      distance: 0.1,
      carbonate: 0.05,
      temperature: 25,
      resolution: 0.01,
    });
    expect(game.entityStates.get(PLANT, 'param.distance')).toBe(0.1);
    expect(Object.keys(v.pose.sample)).toEqual([...photosynthesisModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(6).fill(false));

    // E at the apparatus works at the bench (inspecting it is F); the player stands still; it
    // counts as looking at the apparatus.
    expect(game.interaction.primaryAction(PLANT)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(PLANT)?.id).toBe('inspect');
    expect(game.interaction.perform(PLANT, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(PLANT);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.moveIntent).toEqual([0, 0, 0]);
    game.input.release('moveForward');
    // The desk, its dials and buttons, its display and the wall monitor are gone from the room;
    // the apparatus and its board stay.
    for (const part of ['desk', 'run', 'stop', 'reset', 'display', 'monitor']) {
      expect(game.world.entity(`${LAB}/photosynthesis-${part}`)).toBeFalsy();
    }
    expect(game.world.entity(PLANT)).toBeTruthy();
    expect(game.world.entity(`${LAB}/photosynthesis-instructions`)).toBeTruthy();
    expect(game.workspace.close()).toBe(true);
  });

  it('collects for a minute with the lamp at 0.2 m and 30 °C: light limits; the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'photosynthesis-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(PLANT, 'open-workspace')).toBe(true);
    set(game, 'distance', 0.2); // 0.2 m
    set(game, 'temperature', 30); // 30 °C
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      duration: DURATION,
      distance: 0.2,
      carbonate: 0.05,
      temperature: 30,
      resolution: 0.01,
    });
    const { intensity, plateau, rate: p } = rate(0.2, 0.05, 30); // 2500 lux, 3.23 µL/s

    // The gas column and the bubble count are drawn from the model's own values this frame.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      expect(pose.sample.volume).toBe(run.value('volume'));
      expect(pose.sample.bubbles).toBe(run.value('bubbles'));
      expect(pose.sample.volume).toBeCloseTo(p * pose.sample.elapsed!, 12); // V = P·t
      expect(pose.sample.bubbles).toBe(Math.floor((p * pose.sample.elapsed!) / BUBBLE + 1e-9));
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(DURATION, 6);

    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.intensity).toBeCloseTo(2500, 9);
    expect(results.distanceSquared).toBeCloseTo(0.04, 12);
    expect(results.rate).toBeCloseTo(p, 15);
    expect(results.volume).toBeCloseTo(p * DURATION, 12); // 0.194 mL
    expect(results.bubbles).toBe(19);
    expect(results.inverseRate).toBeCloseTo(1 / p, 9);
    expect(ALPHA * intensity).toBeLessThan(plateau); // still on the light-limited part
    expect(results.limiting).toBe(1);
    expect(game.state.progression.completedExperiments).toEqual(['photosynthesis']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record!.theory()!.saturatedRate).toBeCloseTo(plateau, 15);
    // The limiting factor is named beside its code, in each language.
    const limiting = record!.definition.results.find((r) => r.id === 'limiting')!;
    expect(resultClass(limiting, results.limiting!)).toBe('Light');
    const vi = createTexts({}, () => 'vi');
    expect(resultClass(limiting, results.limiting!, vi)).toBe('Ánh sáng');
    // The capillary, in mL, reads the record's own volume to its own δV.
    expect(readings(record!.definition, record!)).toMatchObject([
      { result: 'volume', unit: 'mL', text: (Math.round(p * DURATION * 100) / 100).toFixed(2) },
    ]);

    send(game, { command: 'view' });
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true);
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('fits 1/rate against d²: the slope is the light alone, the intercept 1/P_c', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(PLANT, 'open-workspace')).toBe(true);
    set(game, 'carbonate', 0.005); // 0.005 mol/L: CO₂ limits up close
    for (const d of [0.05, 0.1, 0.2, 0.4]) {
      set(game, 'distance', d);
      send(game, { command: 'run' });
      runUntilDone(game);
      send(game, { command: 'reset' });
    }
    const { definition, history } = session(game);
    const distances = [0.05, 0.1, 0.2, 0.4];
    expect(history.map((r) => r.inputs.distance)).toEqual(distances);
    expect(history.map((r) => r.results!.inverseRate!)).toEqual(
      distances.map((d) => expect.closeTo(1 / rate(d, 0.005, 25).rate, 6) as number),
    );
    // Up to 0.2 m the light saturates and CO₂ limits (f_C = ½ < f_T = 0.71); at 0.4 m light does.
    expect(history.map((r) => r.results!.limiting)).toEqual([2, 2, 2, 1]);
    const light = definition.analyses.find((a) => a.id === 'light')!;
    const fit = fitLine(analysisRows(definition, light, history));
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(1 / (ALPHA * I_REF * 0.1 ** 2), 6); // 5000 s/(mL·m²)
    expect(fit.intercept).toBeCloseTo(1 / rate(1, 0.005, 25).plateau, 6);
    expect(history[0]!.theory()!.inverseRateSlope).toBeCloseTo(5000, 9);
  });

  it('offers only its presets, refuses the rest and a change while running, and the HUD follows it from the pondweed', async () => {
    const { game, blocked } = await lab();
    const presets = (id: string) =>
      view(game)
        .definition.parameters.find((p) => p.id === id)!
        .presets.map((p) => p.value);
    const stops: Record<string, number[]> = {};
    for (const parameter of Object.keys(session(game).parameters)) {
      stops[parameter] = presets(parameter);
      for (const value of stops[parameter]) {
        expect(game.stations.refusal(PLANT, 'set', parameter, value)).toBeNull();
        set(game, parameter, value);
        expect(session(game).parameters[parameter]).toBe(value);
        expect(view(game).runBlock).toBeNull();
      }
    }
    expect(stops).toEqual({
      distance: [0.05, 0.1, 0.2, 0.4],
      carbonate: [0.002, 0.005, 0.01, 0.05],
      temperature: [10, 20, 30, 40],
      resolution: [0.01, 0.05, 0.2],
    });
    expect(blocked).toEqual([]);
    expect(game.stations.refusal(PLANT, 'set', 'distance', 0.3)).toMatch(/cannot be set to 0.3/);
    send(game, { command: 'run' });
    expect(game.stations.refusal(PLANT, 'set', 'distance', 0.2)).toBe(
      'Stop the run before changing its parameters.',
    );
    // Where the e2e specs stand at the apparatus and its board (stationZones.test.ts): the old
    // points were stale, and T-6b's mark and recapture now stands nearer one of them.
    for (const at of [
      [-8.786, 0, -2.321], // its pondweed and lamp
      [-9.386, 0, -5.521], // its board
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe(PLANT);
    }
  });
});
