import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { readings } from '../../simulation/measurement';
import { springExtension, type SpringView } from './StationSystem';

const H = 1 / 60;
const LAB = 'physics-lab';
const STAND = `${LAB}/spring`;

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const dial = (game: Game, id: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, id, action);
};
const view = (game: Game): SpringView => {
  const station = game.stations.view(STAND);
  if (station?.kind !== 'spring') throw new Error(`${STAND} is not a spring station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game, dt = H) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** Hooke's law at rest, written out independently of the model: k·Δl = m·g. */
const stretch = (m: number, k: number) => (m * 9.81) / k;

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('Hooke’s law station', () => {
  it('is ready at once: the mass held at y₀ = 0.1 m below its rest position', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('hookes-law');
    expect(v.session.state).toBe('configured');
    expect(v.session.parameters).toEqual({
      mass: 0.5,
      stiffness: 20,
      resolution: 0.001,
      offset: 0.1,
      damping: 0.1,
    });
    expect(game.entityStates.get(STAND, 'param.mass')).toBe(0.5);
    expect(v.runBlock).toBeNull();
    expect(v.naturalLength).toBe(0.2);
    expect(v.elasticLimit).toBe(0.6);
    expect(v.held).toBeCloseTo(stretch(0.5, 20) + 0.1, 12); // drawn there until RUN
    expect(springExtension(v.session)).toBe(0); // no run yet
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false]);
  });

  it('dials m, k, y₀ and ζ through their presets, d too, and moves the held mass', async () => {
    const { game, blocked } = await lab();
    const masses: number[] = [];
    for (let i = 0; i < 4; i++) {
      act(game, 'dial-mass', 'raise');
      masses.push(session(game).parameters.mass!);
    }
    expect(masses).toEqual([1, 2, 3, 5]);
    expect(view(game).checklist[1]?.done).toBe(true); // "set the hanging mass"
    expect(act(game, 'dial-mass', 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('m is already at its maximum: 5 kg.');
    dial(game, 'dial-mass', 'lower', 8); // 3, 2, 1, 0.5, 0.3, 0.2, 0.1, 0.05
    expect(session(game).parameters.mass).toBe(0.05);
    expect(act(game, 'dial-mass', 'lower')).toBe(false);
    expect(blocked.at(-1)).toBe('m is already at its minimum: 0.05 kg.');
    dial(game, 'dial-stiffness', 'raise', 3); // 20 → 50 → 100 → 200 N/m
    expect(session(game).parameters.stiffness).toBe(200);
    expect(act(game, 'dial-stiffness', 'raise')).toBe(false);
    dial(game, 'dial-stiffness', 'lower', 5); // … 10 → 5 N/m
    expect(session(game).parameters.stiffness).toBe(5);
    dial(game, 'dial-ruler', 'raise', 2); // 1 mm → 5 mm → 1 cm
    expect(session(game).parameters.resolution).toBe(0.01);
    const offsets: number[] = [];
    for (let i = 0; i < 7; i++) {
      act(game, 'dial-offset', 'lower');
      offsets.push(session(game).parameters.offset!);
    }
    expect(offsets).toEqual([0.05, 0.02, 0, -0.02, -0.05, -0.1, -0.1]);
    expect(view(game).held).toBeCloseTo(stretch(0.05, 5) - 0.1, 12);
    dial(game, 'dial-damping', 'raise', 5); // 0.1 → 0.2 → 0.5 → 1 → 2, then the top
    expect(session(game).parameters.damping).toBe(2);
    dial(game, 'dial-damping', 'lower', 9);
    expect(session(game).parameters.damping).toBe(0.05);
    expect(game.entityStates.get(STAND, 'param.damping')).toBe(0.05);
  });

  it('lets the mass go at y₀: it swings about rest, each swing smaller, then rests at k·Δl = m·g', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'spring-run', 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      mass: 0.5,
      stiffness: 20,
      resolution: 0.001,
      offset: 0.1,
      damping: 0.1,
      gravity: 9.81,
      naturalLength: 0.2,
    });
    const dl = stretch(0.5, 20);
    expect(springExtension(session(game))).toBeCloseTo(dl + 0.1, 12); // held at y₀, then let go
    const drawn: number[] = [];
    for (let i = 0; i < 60 * 60 && session(game).state === 'running'; i++) {
      game.update(H);
      const x = springExtension(session(game));
      expect(x).toBe(run.value('extension')); // the drawn spring is the model's
      drawn.push(x);
    }
    expect(session(game).state).toBe('completed');
    // Up past rest from y₀ below it, then back down past rest: a swing, not a slide.
    expect(drawn[0]).toBeLessThan(dl + 0.1);
    const highest = drawn.indexOf(Math.min(...drawn));
    expect(drawn[highest]).toBeLessThan(dl - 0.05);
    expect(Math.max(...drawn.slice(highest))).toBeGreaterThan(dl + 0.02);
    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.load).toBeCloseTo(0.5 * 9.81, 12);
    expect(Math.abs(results.extension! - dl)).toBeLessThanOrEqual(1e-3 * dl); // at rest
    expect(results.length).toBeCloseTo(0.2 + results.extension!, 12);
    expect(results.stiffness).toBeCloseTo(20, 1);
    expect(springExtension(session(game))).toBe(results.extension); // it rests there until RESET
    expect(game.state.progression.completedExperiments).toEqual(['hookes-law']);
    expect(view(game).checklist[2]?.done).toBe(true); // "press RUN"
    expect(session(game).history).toHaveLength(1);

    // The ruler, zeroed at the natural length, reads Δl at rest to its d; the value stays exact.
    const [ruler] = readings(view(game).definition, run);
    expect(ruler).toMatchObject({
      result: 'extension',
      resolution: 0.001,
      simulated: results.extension,
      text: (Math.round(results.extension! / 0.001) * 0.001).toFixed(3),
      uncertainty: 0.001 / Math.sqrt(12),
      bound: 0.0005,
    });
  });

  it('runs the same at 30 and 144 frames per second: the model keeps its own fixed step', async () => {
    const results = [];
    for (const fps of [30, 144]) {
      const { game } = await lab();
      act(game, 'spring-run', 'run');
      runUntilDone(game, 1 / fps);
      const record = session(game).history.at(-1)!;
      results.push({ results: record.results, samples: [...record.sampleValues[1]!] });
      game.dispose();
    }
    expect(results[0]?.results).toBeDefined();
    expect(results[0]).toEqual(results[1]); // results and every recorded displacement
  });

  it('STOP freezes the mass where it is; RESET takes it back to y₀', async () => {
    const { game } = await lab();
    act(game, 'spring-run', 'run');
    frames(game, 0.4); // swinging
    expect(act(game, 'spring-stop', 'stop')).toBe(true);
    expect(session(game).state).toBe('stopped');
    const x = springExtension(session(game));
    expect(x).toBeGreaterThan(0);
    frames(game, 1);
    expect(springExtension(session(game))).toBe(x); // frozen mid-swing
    expect(session(game).history.at(-1)?.status).toBe('stopped');
    expect(act(game, 'spring-reset', 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(springExtension(session(game))).toBe(0); // no run …
    expect(view(game).held).toBeCloseTo(stretch(0.5, 20) + 0.1, 12); // … held at y₀ again
    expect(game.state.progression.completedExperiments).toEqual([]); // stopped is not completed
  });

  it('refuses a swing that could pass the elastic limit or slacken the spring, with the reason', async () => {
    const { game, blocked } = await lab();
    dial(game, 'dial-mass', 'raise', 2); // 2 kg on 20 N/m: at rest already 0.98 m
    const beyond =
      'This load is beyond the elastic limit of the spring: let go, the mass could stretch it to 1.08 m (0.98 m at rest), more than the 0.60 m it can take. Lower m or y₀, or use a stiffer spring.';
    expect(view(game).runBlock).toBe(beyond);
    expect(act(game, 'spring-run', 'run')).toBe(false);
    expect(blocked.at(-1)).toBe(beyond);
    expect(session(game).run).toBeNull();
    dial(game, 'dial-mass', 'lower'); // 1 kg: rests at 0.49 m and y₀ = 0.1 m keeps it under 0.60 m
    expect(view(game).runBlock).toBeNull();
    dial(game, 'dial-offset', 'raise'); // y₀ = 0.2 m: it could reach 0.69 m
    expect(view(game).runBlock).toContain('could stretch it to 0.69 m (0.49 m at rest)');
    dial(game, 'dial-offset', 'lower', 2); // back to 0.05 m …
    dial(game, 'dial-mass', 'lower', 5); // … 0.05 kg rests at 0.025 m: a 0.05 m swing slackens it
    expect(view(game).runBlock).toBe(
      'Too far for this load: at rest the spring stretches 0.025 m, so a swing of 0.050 m could take it shorter than its natural length, which this model does not cover. Choose a smaller y₀ or a heavier mass.',
    );
    dial(game, 'dial-offset', 'lower'); // 0.02 m: within the 0.025 m
    expect(view(game).runBlock).toBeNull();
  });

  it('two springs, one load: the stiffer stretches less, and each run keeps its own spring', async () => {
    const { game } = await lab();
    dial(game, 'dial-offset', 'lower', 3); // held at rest: a static measurement
    act(game, 'spring-run', 'run');
    runUntilDone(game);
    act(game, 'spring-reset', 'reset');
    dial(game, 'dial-stiffness', 'raise'); // 50 N/m
    act(game, 'spring-run', 'run');
    runUntilDone(game);
    const [a, b] = session(game).history;
    expect(a?.inputs.stiffness).toBe(20);
    expect(b?.inputs.stiffness).toBe(50);
    expect(b!.results!.extension! / a!.results!.extension!).toBeCloseTo(20 / 50, 6);
    expect(b?.results?.load).toBe(a!.results!.load!); // the same load
    expect(game.state.progression.completedExperiments).toEqual(['hookes-law']); // once
  });

  it('shares the room with the free-fall tower: the HUD follows the station the player is at', async () => {
    const { game } = await lab();
    placePlayer(game, [12.417, 0, -5.35]); // at the Hooke desk
    expect(game.stations.activeStation()?.id).toBe(STAND);
    placePlayer(game, [2.017, 0, -5.35]); // at the free-fall desk
    expect(game.stations.activeStation()?.id).toBe(`${LAB}/tower`);
  });

  it('keeps its configuration in the save: Continue restores m, k, y₀ and ζ, held', async () => {
    const { game, storage } = await lab();
    dial(game, 'dial-mass', 'raise', 2); // 2 kg
    dial(game, 'dial-stiffness', 'raise', 2); // 100 N/m
    dial(game, 'dial-offset', 'lower'); // 0.05 m
    dial(game, 'dial-damping', 'lower'); // 0.05
    expect(game.save()?.ok).toBe(true);
    game.dispose();
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    frames(again, 0.1);
    expect(session(again).parameters).toEqual({
      mass: 2,
      stiffness: 100,
      resolution: 0.001,
      offset: 0.05,
      damping: 0.05,
    });
    expect(session(again).state).toBe('configured');
    expect(view(again).held).toBeCloseTo(stretch(2, 100) + 0.05, 12);
  });
});
