import { describe, expect, it } from 'vitest';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { analysisRows, fitLine } from '../../simulation/analysis';
import { resultClass } from '../../simulation/experiment';
import { inclineModel } from '../../simulation/models/incline';
import type { BenchView } from './StationSystem';

// The inclined plane on the projectile range's bench (content: rooms.json), played through its
// desk: the board read, the dials, RUN (the block stays or slides to the gate), the record with its
// class, RESET. Newton's second law along the ramp is written out here, with the coefficients of
// the table the model cites (Serway & Jewett, Table 5.1).

const H = 1 / 60;
const LAB = 'physics-lab';
const ROOM = 'physics-lab'; // Phase T-1a: on the lab's south island
const RAMP = `${ROOM}/incline`;
const DEG = Math.PI / 180;
const G = 9.81;
const STEEL = { us: 0.74, uk: 0.57 }; // dry steel on steel, surface 4

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${ROOM}/${id}`, action);
const dial = (game: Game, id: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, id, action);
};
const view = (game: Game): BenchView => {
  const station = game.stations.view(RAMP);
  if (station?.kind !== 'bench') throw new Error(`${RAMP} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(H);
};

/** a = g(sinθ − μk·cosθ) while it slides. */
const slide = (deg: number, uk: number) => G * (Math.sin(deg * DEG) - uk * Math.cos(deg * DEG));

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab() {
  const booted = await bootTestGame();
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  return booted;
}

describe('inclined plane station (projectile range)', () => {
  it('is ready at once: 0.5 kg of wood on wood at 30°, L = 1 m, no sample before a run', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('inclined-plane');
    expect(v.model).toBe('incline-ramp');
    expect(v.session.state).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.session.parameters).toEqual({ angle: 30, surface: 3, mass: 0.5, length: 1 });
    expect(game.entityStates.get(RAMP, 'param.surface')).toBe(3);
    expect(Object.keys(v.pose.sample)).toEqual([...inclineModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(6).fill(false));
  });

  it('slides steel on steel at 45° to the gate: a, t, v, energy and heat, the record, RESET', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'incline-instructions', 'inspect')).toBe(true);
    expect(act(game, 'incline-dial-surface', 'raise')).toBe(true); // dry steel
    expect(act(game, 'incline-dial-angle', 'raise')).toBe(true); // 45°
    expect(act(game, 'incline-run', 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({ angle: 45, surface: 4, mass: 0.5, length: 1, gravity: G });
    const pose = view(game).pose;
    const slid: number[] = [];
    while (session(game).state === 'running') {
      game.update(H);
      expect(pose.sample.distance).toBe(run.value('distance')); // drawn from the run, by name
      slid.push(pose.sample.distance!);
    }
    const a = slide(45, STEEL.uk);
    const t = Math.sqrt(2 / a); // s = ½·a·t² over L = 1 m
    expect(slid.length).toBe(Math.ceil(t / H)); // the frames it takes, the last one partly
    expect(slid.every((s, k) => s > 0 && s <= 1 && (k === 0 || s > slid[k - 1]!))).toBe(true);
    expect(slid.at(-1)).toBe(1); // stopped exactly at the gate
    expect(session(game).state).toBe('completed');

    const m = 0.5;
    const normal = m * G * Math.cos(45 * DEG);
    const results = completed[0]!.results;
    expect(results.slides).toBe(1);
    expect([results.staticFriction, results.kineticFriction]).toEqual([STEEL.us, STEEL.uk]);
    expect(results.acceleration).toBeCloseTo(a, 12);
    expect(results.frictionForce).toBeCloseTo(STEEL.uk * normal, 12);
    expect(results.distance).toBe(1);
    expect(results.travelTime).toBeCloseTo(t, 9);
    expect(results.finalSpeed).toBeCloseTo(Math.sqrt(2 * a), 9);
    expect(results.potentialEnergyLost).toBeCloseTo(m * G * Math.sin(45 * DEG), 12);
    expect(results.kineticEnergy).toBeCloseTo(m * a, 9); // Eₖ = F_net·L
    expect(results.frictionWork).toBeCloseTo(STEEL.uk * normal, 12); // Q = μk·N·L
    expect(results.kineticEnergy! + results.frictionWork!).toBeCloseTo(
      results.potentialEnergyLost!,
      9,
    );
    expect(game.state.progression.completedExperiments).toEqual(['inclined-plane']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record?.theory()?.criticalAngle).toBeCloseTo(Math.atan(STEEL.us) / DEG, 9); // 36.5°
    const slides = record!.definition.results.find((x) => x.id === 'slides')!;
    expect(resultClass(slides, 1)).toBe('Slides');
    expect(
      resultClass(
        slides,
        1,
        createTexts({}, () => 'vi'),
      ),
    ).toBe('Trượt xuống');

    expect(act(game, 'incline-monitor', 'view-results')).toBe(true);
    expect(act(game, 'incline-reset', 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(Object.values(pose.sample).every(Number.isNaN)).toBe(true); // the block back at L
    expect(session(game).history).toHaveLength(1);
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
  });

  it('holds steel on steel at 30°, below arctan μs: at rest at once, static friction m·g·sinθ', async () => {
    const { game } = await lab();
    act(game, 'incline-dial-surface', 'raise'); // dry steel, 30°
    act(game, 'incline-run', 'run');
    runUntilDone(game);
    const record = session(game).history.at(-1)!;
    expect(record.status).toBe('completed');
    expect(record.time).toBe(0); // nothing moves: the run ends where it starts
    const results = record.results!;
    expect(results.slides).toBe(0);
    expect([results.acceleration, results.distance, results.finalSpeed]).toEqual([0, 0, 0]);
    expect(results.frictionForce).toBeCloseTo(0.5 * G * Math.sin(30 * DEG), 12);
    expect(results.frictionForce).toBeLessThan(STEEL.us * 0.5 * G * Math.cos(30 * DEG));
    expect(view(game).pose.sample.distance).toBe(0); // the block stays at the stop
    const slides = record.definition.results.find((x) => x.id === 'slides')!;
    expect(resultClass(slides, 0)).toBe('Stays at rest');
  });

  it('fits Eₖ against L and Q against s at 45° steel: slopes m·a and μk·N', async () => {
    const { game } = await lab();
    act(game, 'incline-dial-surface', 'raise'); // dry steel
    act(game, 'incline-dial-angle', 'raise'); // 45°
    act(game, 'incline-dial-length', 'lower'); // 0.5 m
    for (let k = 0; k < 3; k++) {
      act(game, 'incline-run', 'run');
      runUntilDone(game);
      act(game, 'incline-reset', 'reset');
      act(game, 'incline-dial-length', 'raise'); // 1 m, 1.5 m
    }
    const { definition, history } = session(game);
    expect(history.map((h) => h.inputs.length)).toEqual([0.5, 1, 1.5]);
    const slope = (id: string) => {
      const analysis = definition.analyses.find((x) => x.id === id)!;
      const fit = fitLine(analysisRows(definition, analysis, history));
      return fit.status === 'fitted' ? fit.slope : NaN;
    };
    expect(slope('work-energy')).toBeCloseTo(0.5 * slide(45, STEEL.uk), 9);
    expect(slope('heat')).toBeCloseTo(STEEL.uk * 0.5 * G * Math.cos(45 * DEG), 9);
  });

  it('offers only its presets, none refused, and the HUD follows it from its desk', async () => {
    const { game } = await lab();
    const stops: Record<string, number[]> = {};
    for (const [dialId, parameter, presets] of [
      ['incline-dial-angle', 'angle', 4],
      ['incline-dial-surface', 'surface', 4],
      ['incline-dial-mass', 'mass', 4],
      ['incline-dial-length', 'length', 3],
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
      angle: [10, 20, 30, 45],
      surface: [1, 2, 3, 4],
      mass: [0.1, 0.5, 1, 2],
      length: [0.5, 1, 1.5],
    });
    placePlayer(game, [10.2, 0, 1.132]); // at its desk
    expect(game.stations.activeStation()?.id).toBe(RAMP);
    placePlayer(game, [8.4, 0, 1.132]); // at its monitor, beside the bench's west end
    expect(game.stations.activeStation()?.id).toBe(RAMP);
  });
});
