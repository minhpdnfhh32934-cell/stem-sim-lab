import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bundledContent } from '../../content';
import type { RawContent } from '../../game/content';
import { bootTestGame, flush, placePlayer } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { ellipticK } from '../../simulation/models/pendulum';
import { type PendulumView, swingAngle, swingLength } from './StationSystem';

const H = 1 / 60;
const BAY = 'pendulum-bay';
const PENDULUM = `${BAY}/pendulum`;
const LAUNCHER = 'projectile-range/launcher';
const DEG = Math.PI / 180;

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) => game.interaction.perform(id, action);
const dial = (game: Game, parameter: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, `${BAY}/dial-${parameter}`, action);
};
const view = (game: Game): PendulumView => {
  const station = game.stations.view(PENDULUM);
  if (station?.kind !== 'pendulum') throw new Error(`${PENDULUM} is not a pendulum station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game, dt = H) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** The exact period of the ideal pendulum, written out independently of the station. */
const exactPeriod = (length: number, angleDeg: number, g: number) =>
  4 * Math.sqrt(length / g) * ellipticK(Math.sin((angleDeg * DEG) / 2));

/** New game, then the developer jump to the Physics Lab (setup only: entry paths are tested below). */
async function lab(storage = new MemorySaveStorage(), content?: RawContent) {
  const booted = await bootTestGame({ storage, ...(content && { content }) });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load('physics-lab');
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('pendulum station', () => {
  it('is ready at once: the bob hangs there, nothing to load, configuration mirrored', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('pendulum');
    expect(v.session.state).toBe('configured');
    expect(v.session.parameters).toEqual({ length: 1, angle: 10, gravity: 9.81, resolution: 0.01 });
    expect(game.entityStates.get(PENDULUM, 'param.length')).toBe(1);
    expect(game.entityStates.get(PENDULUM, 'state')).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
    // Drawn from the session before any run: held at the release angle, the dial's length.
    expect(swingAngle(v.session)).toBeCloseTo(10 * DEG, 12);
    expect(swingLength(v.session)).toBe(1);
  });

  it('dials step L and θ₀ on their grid and g through the presets; each marks its own step', async () => {
    const { game } = await lab();
    dial(game, 'length', 'raise', 2);
    expect(session(game).parameters.length).toBe(1.5);
    expect(view(game).checklist[1]?.done).toBe(true); // "set the length"
    expect(view(game).checklist[2]?.done).toBe(false); // the angle is its own step
    dial(game, 'angle', 'lower', 4);
    expect(session(game).parameters.angle).toBe(-10);
    expect(view(game).checklist[2]?.done).toBe(true);
    dial(game, 'gravity', 'lower', 2); // Earth → Mars → Moon
    expect(session(game).parameters.gravity).toBe(1.62);
    expect(game.entityStates.get(PENDULUM, 'param.angle')).toBe(-10);
    expect(swingAngle(session(game))).toBeCloseTo(-10 * DEG, 12); // the bob is drawn there
  });

  it('refuses RUN with the reason: at 0°, while running, before RESET; dials wait too', async () => {
    const { game, blocked } = await lab();
    dial(game, 'angle', 'lower', 2); // 10° → 0°
    expect(view(game).runBlock).toBe('Set a release angle: at 0° the pendulum just hangs there.');
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('Set a release angle: at 0° the pendulum just hangs there.');
    expect(session(game).state).toBe('configured');
    dial(game, 'angle', 'raise', 6); // 30°
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(true);
    expect(session(game).state).toBe('running');
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('The run is in progress.');
    expect(act(game, `${BAY}/dial-length`, 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('Stop the run before changing its parameters.');
    runUntilDone(game);
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('Press RESET before the next run.');
    expect(act(game, `${BAY}/dial-length`, 'raise')).toBe(true); // allowed once completed
  });

  it('runs: the bob is drawn at the model angle, no physics body; the period is the exact one', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    dial(game, 'angle', 'raise', 4); // 30°
    const bodies = game.physics.stats().bodies;
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      length: 1,
      angle: 30,
      gravity: 9.81,
      resolution: 0.01,
      mass: 0.5,
      omega0: 0,
    });
    let swung = 0;
    for (let i = 0; i < 1000 && session(game).state === 'running'; i++) {
      game.update(H);
      expect(swingAngle(session(game))).toBe(run.value('theta')); // one source of truth
      swung = Math.min(swung, run.value('theta'));
    }
    expect(swung).toBeCloseTo(-30 * DEG, 4); // it swung to the far side
    expect(game.physics.stats()).toMatchObject({ bodies, driven: 0 }); // Rapier never saw it
    const T = exactPeriod(1, 30, 9.81);
    expect(session(game).state).toBe('completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.results.period).toBeCloseTo(T, 7);
    expect(completed[0]?.results['period-small-angle']).toBeCloseTo(T, 7); // same measurement
    expect(run.theory()?.smallAnglePeriod).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.81), 12);
    expect(swingAngle(session(game))).toBeCloseTo(30 * DEG, 7); // three swings: back at release
    expect(view(game).checklist[3]?.done).toBe(true);
    expect(game.state.progression.completedExperiments).toContain('pendulum');
  });

  it('STOP freezes the bob where the measurement stopped; RESET makes it ready again', async () => {
    const { game } = await lab();
    act(game, `${BAY}/button-run`, 'run');
    frames(game, 0.4);
    expect(act(game, `${BAY}/button-stop`, 'stop')).toBe(true);
    expect(session(game).state).toBe('stopped');
    const frozen = swingAngle(session(game));
    const samples = session(game).run?.sampleCount ?? 0;
    frames(game, 0.5);
    expect(swingAngle(session(game))).toBe(frozen);
    expect(session(game).run?.sampleCount).toBe(samples); // the data so far is kept
    expect(session(game).run?.results).toBeNull(); // no period from a stopped run
    expect(act(game, `${BAY}/button-reset`, 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(session(game).run).toBeNull();
    expect(swingAngle(session(game))).toBeCloseTo(10 * DEG, 12); // ready at the release angle
    expect(view(game).checklist[5]?.done).toBe(true); // "RESET, change one setting…"
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(true);
  });

  it('draws the run’s own length until RESET, whatever the dial says meanwhile', async () => {
    const { game } = await lab();
    act(game, `${BAY}/button-run`, 'run');
    runUntilDone(game);
    dial(game, 'length', 'raise', 4); // 1 m → 2 m after the run
    expect(session(game).parameters.length).toBe(2);
    expect(swingLength(session(game))).toBe(1);
    act(game, `${BAY}/button-reset`, 'reset');
    expect(swingLength(session(game))).toBe(2);
  });

  it('swings the same at any frame rate: samples, results, end state, real-time pace', async () => {
    // L 0.5 m, θ₀ 40°, Earth: three periods ≈ 4.4 s. main.ts caps a frame at 0.1 s, so 10 fps is
    // the slowest real-time rate; 300 Hz is the project's laptop display.
    const rates: [string, number[]][] = [
      ...[300, 60, 30, 20, 15, 10].map((fps): [string, number[]] => [`${fps} fps`, [1 / fps]]),
      ['jittery', [1 / 144, 0.1, 1 / 60, 0.0371, 1 / 300, 0.08]],
    ];
    const T = exactPeriod(0.5, 40, 9.81);
    const runs = [];
    for (const [name, pattern] of rates) {
      const { game } = await lab();
      dial(game, 'length', 'lower', 2);
      dial(game, 'angle', 'raise', 6);
      act(game, `${BAY}/button-run`, 'run');
      const run = session(game).run!;
      let elapsed = 0;
      for (let i = 0; session(game).state === 'running' && i < 5000; i++) {
        const dt = pattern[i % pattern.length] ?? H;
        game.update(dt);
        elapsed += dt;
      }
      expect(session(game).state, name).toBe('completed');
      const count = run.sampleCount;
      runs.push({
        name,
        elapsed,
        longest: Math.max(...pattern),
        results: run.results,
        samples: [run.sampleTimes, ...run.sampleValues].map((s) =>
          Array.from(s.subarray(0, count)),
        ),
        final: ['theta', 'omega', 'clock', 'crossings', 'turns', 'period'].map((v) => run.value(v)),
      });
    }
    const [reference] = runs;
    for (const r of runs) {
      expect(r.samples, r.name).toEqual(reference?.samples);
      expect(r.results, r.name).toEqual(reference?.results);
      expect(r.final, r.name).toEqual(reference?.final);
      // It took its three periods in game time, ending within the frame that contains them.
      expect(r.elapsed, r.name).toBeGreaterThanOrEqual(3 * T - 1e-9);
      expect(r.elapsed - r.longest, r.name).toBeLessThan(3 * T);
    }
    expect(reference?.results?.period).toBeCloseTo(T, 7);
  });

  it('Continue: ready at once with its saved dials, runs not saved; RUN works beside a loaded launcher', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    dial(game, 'length', 'raise', 1);
    dial(game, 'angle', 'raise', 2);
    act(game, `${BAY}/button-run`, 'run');
    frames(game, 2);
    // A ball in the launcher too: Continue then disables a body in a fresh Rapier world.
    placePlayer(game, [-3.85, 0, 10.5] as Vec3);
    expect(act(game, 'projectile-range/ball-1', 'grab')).toBe(true);
    expect(act(game, LAUNCHER, 'load')).toBe(true);
    placePlayer(game, [2.4, 0, -8.4] as Vec3); // at the pendulum desk
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    frames(again, 0.5);
    expect(again.systems.statuses().filter((s) => s.status === 'failed')).toEqual([]);
    expect(again.stations.activeStation()?.id).toBe(PENDULUM); // the player is in the bay
    const s = session(again);
    expect(s.parameters).toEqual({ length: 1.25, angle: 20, gravity: 9.81, resolution: 0.01 });
    expect(s.state).toBe('configured');
    expect(s.run).toBeNull();
    expect(act(again, `${BAY}/button-run`, 'run')).toBe(true);
    expect(act(again, 'projectile-range/button-run', 'run')).toBe(true);
    frames(again, 8);
    expect(session(again).state).toBe('completed');
    expect(again.stations.view(LAUNCHER)?.session.state).toBe('completed');
    expect(again.systems.statuses().filter((s) => s.status === 'failed')).toEqual([]);
  });

  it('leaving the scene stops a run but keeps its data and the configuration', async () => {
    const { game } = await lab();
    dial(game, 'gravity', 'lower', 2);
    act(game, `${BAY}/button-run`, 'run');
    frames(game, 0.5);
    await game.scenes.load('simlab-hub');
    await game.scenes.load('physics-lab');
    expect(session(game).state).toBe('stopped');
    expect(session(game).run?.sampleCount).toBeGreaterThan(40);
    expect(session(game).parameters.gravity).toBe(1.62);
    expect(act(game, `${BAY}/button-reset`, 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
  });

  it('refuses a swing the stand cannot hold: too wide, too long, over the top', async () => {
    // The shipped stand (pivot 3.6 m up, mid-bay) and ranges never reach these limits, so this
    // stand is lower (pivot 2 m), 1 m from the east wall, and θ₀ may go to 180°.
    const content = structuredClone(bundledContent);
    const items = content.items as { id: string; pendulum?: { pivot: number[] } }[];
    items.find((i) => i.id === 'pendulum-stand')!.pendulum!.pivot = [0, 2, 0];
    const rooms = content.rooms as { id: string; placements: { id: string; position: Vec3 }[] }[];
    const bay = rooms.find((r) => r.id === BAY)!;
    bay.placements.find((p) => p.id === 'pendulum')!.position = [4, 0, -12.1];
    const experiments = content.experiments as { id: string; parameters: { max: number }[] }[];
    experiments.find((e) => e.id === 'pendulum')!.parameters[1]!.max = 180;
    const { game, blocked } = await lab(undefined, content);

    expect(view(game).runBlock).toBeNull(); // 1 m at 10°: 0.23 m out of 0.7 m
    dial(game, 'angle', 'raise', 10); // 60°
    const wide =
      'Too wide: the bob would swing 0.9 m out, beyond the 0.7 m free on each side. ' +
      'Shorten L or lower θ₀.';
    expect(view(game).runBlock).toBe(wide);
    dial(game, 'length', 'raise', 4); // 2 m
    const long = 'Too long: the bob would hit the floor. This stand takes L up to 1.89 m.';
    expect(view(game).runBlock).toBe(long);
    expect(act(game, `${BAY}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe(long);
    dial(game, 'angle', 'raise', 24); // 180°: balanced upright, an infinite period
    expect(view(game).runBlock).toBe('It would swing over the top: lower θ₀.');
    expect(session(game).state).toBe('configured');
    expect(session(game).run).toBeNull();
  });

  it('the HUD and debug panel follow the station in the player’s room', async () => {
    const { game } = await lab();
    // From the lab's door the nearest station is the air track's (Newton's second law), next to it.
    expect(game.stations.activeStation()?.id).toBe('physics-lab/newton');
    placePlayer(game, [2.4, 0, -8.4] as Vec3);
    expect(game.stations.activeStation()?.id).toBe(PENDULUM);
    placePlayer(game, [-1.2, 0, 13.1] as Vec3);
    expect(game.stations.activeStation()?.id).toBe(LAUNCHER);
    placePlayer(game, [-2, 0, 7.6] as Vec3); // in the doorway to the range: in no room's bounds
    expect(game.stations.activeStation()?.id).toBe('physics-lab/tower'); // the scene's first
  });

  it('runs beside the projectile without either noticing: same results as alone', async () => {
    const alone = await lab();
    act(alone.game, `${BAY}/button-run`, 'run');
    runUntilDone(alone.game);
    const pendulumAlone = session(alone.game).run?.results;

    const both = await lab();
    placePlayer(both.game, [-3.85, 0, 10.5] as Vec3);
    act(both.game, 'projectile-range/ball-1', 'grab');
    act(both.game, LAUNCHER, 'load');
    act(both.game, `${BAY}/button-run`, 'run');
    act(both.game, 'projectile-range/button-run', 'run');
    frames(both.game, 7); // three periods of 1 m at 10°: 6.03 s
    expect(session(both.game).state).toBe('completed');
    expect(session(both.game).run?.results).toEqual(pendulumAlone);
    expect(both.game.stations.view(LAUNCHER)?.session.state).toBe('completed');
  });
});
