import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, flush, lookAt, placePlayer, untilIdle } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import type { LauncherView } from './StationSystem';

const H = 1 / 60;
const ROOM = 'projectile-range';
const LAUNCHER = `${ROOM}/launcher`;
const BALL = `${ROOM}/ball-1`;
const LAUNCH: Vec3 = [-0.9, 0.62, 11.75]; // launcher base (-1, 0, 11.75) + muzzle (0.1, 0.62, 0)
const R = 0.03; // ball radius
const DEG = Math.PI / 180;

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

/** Stands at `from` looking at `target` and checks what is focused. */
function face(game: Game, from: Vec3, target: Vec3, id: string) {
  placePlayer(game, from);
  lookAt(game, target);
  game.update(H);
  expect(game.interaction.focused?.id).toBe(id);
}

const press = (game: Game, key: 'interact' | 'secondary') => {
  untilIdle(game); // a press waits for an action acted out (the ball picked up off the floor)
  game.input.press(key);
  game.update(H);
  game.input.release(key);
};

const act = (game: Game, id: string, action: string) => game.interaction.perform(id, action);
const view = (game: Game): LauncherView => {
  const station = game.stations.view(LAUNCHER);
  if (station?.kind !== 'launcher') throw new Error(`${LAUNCHER} is not a launcher station`);
  return station;
};
const ballPose = (game: Game) => game.world.entity(BALL)!.pose.position;

/** New game, then the developer jump to the Physics Lab (setup only: doors are tested elsewhere). */
async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load('physics-lab');
  frames(booted.game, 1); // the balls settle on the cart
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

/** Takes ball-1 from the cart and loads it, through the real input path. */
function loadBall(game: Game) {
  face(game, [-3.85, 0, 10.5], [-3.85, 0.83, 9.5], BALL);
  press(game, 'interact');
  expect(game.interaction.heldId).toBe(BALL);
  face(game, [-2.3, 0, 11.75], [-1, 0.2, 11.75], LAUNCHER); // holding: the launcher takes the ball
  expect(game.interaction.primaryAction(LAUNCHER)?.label).toBe('Load into the launcher');
  press(game, 'interact');
  expect(game.interaction.heldId).toBeNull();
  expect(view(game).loaded).toBe(true);
}

/** Closed-form flight for the station's launch height (ball's lowest point above the floor). */
function theory(v: number, angle: number, g: number) {
  const h = LAUNCH[1] - R;
  const vy = v * Math.sin(angle * DEG);
  const T = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
  return { T, R: v * Math.cos(angle * DEG) * T, H: h + (vy * vy) / (2 * g) };
}

describe('projectile station', () => {
  it('binds the launcher to its experiment session and mirrors the configuration', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('projectile-motion');
    expect(v.session.state).toBe('idle');
    expect(v.loaded).toBe(false);
    expect(v.launch).toEqual([expect.closeTo(-0.9, 9), expect.closeTo(0.62, 9), 11.75]);
    expect(v.direction).toEqual([1, 0, 0]);
    expect(v.lane).toBeCloseTo(21.6, 9); // to the east wall (x 21) less 0.3 m
    expect(v.runBlock).toBe('Load a projectile ball into the launcher first.');
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false]);
    for (const [key, value] of [
      ['velocity', 8],
      ['angle', 45],
      ['gravity', 9.81],
    ] as const) {
      expect(game.entityStates.get(LAUNCHER, `param.${key}`)).toBe(value);
    }
    expect(game.entityStates.get(LAUNCHER, 'state')).toBe('idle');
  });

  it('loads a held projectile ball; anything else is simply dropped', async () => {
    const { game, blocked } = await lab();
    // Not holding: the launcher offers no Load (only Inspect).
    face(game, [-2.3, 0, 11.75], [-1, 0.2, 11.75], LAUNCHER);
    expect(game.interaction.primaryAction(LAUNCHER)?.id).toBe('inspect');
    // Holding the desk lamp (not a projectile): the launcher is not even targeted; E drops it.
    face(game, [-2.567, 0, -3.674], [-2.567, 1.1, -4.674], 'physics-lab/lamp'); // on the teacher's bench
    press(game, 'secondary'); // the lamp's E is "Turn on"; F grabs it
    expect(game.interaction.heldId).toBe('physics-lab/lamp');
    placePlayer(game, [-2.3, 0, 11.75]);
    lookAt(game, [-1, 0.2, 11.75]);
    game.update(H);
    expect(game.interaction.focused).toBeNull();
    press(game, 'interact');
    expect(game.interaction.heldId).toBeNull();

    loadBall(game);
    expect(game.physics.stats().driven).toBe(1);
    expect(ballPose(game)).toEqual([expect.closeTo(-0.9, 9), expect.closeTo(0.62, 9), 11.75]);
    frames(game, 0.5); // out of the simulation: it stays at the launch point
    expect(ballPose(game)[1]).toBeCloseTo(0.62, 9);
    expect(view(game).session.state).toBe('configured');
    expect(game.entityStates.get(LAUNCHER, 'loaded')).toBe(BALL);
    expect(act(game, BALL, 'grab')).toBe(false);
    expect(blocked.at(-1)).toBe('It is loaded: take it out of the launcher first.');
  });

  it('runs: the ball follows the model, lands where theory says, then belongs to physics', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    loadBall(game);
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(true);
    const run = view(game).session.run!;
    expect(run.inputs).toEqual({
      velocity: 8,
      angle: 45,
      gravity: 9.81,
      resolution: 0.01,
      height: 0.59,
    });
    // Every frame of the flight the drawn ball is exactly the model state.
    for (let i = 0; i < 600 && view(game).session.state === 'running'; i++) {
      game.update(H);
      const [x, y, z] = ballPose(game);
      expect(x).toBeCloseTo(LAUNCH[0] + run.value('x'), 9);
      expect(y).toBeCloseTo(R + run.value('y'), 9);
      expect(z).toBe(11.75);
    }
    const t = theory(8, 45, 9.81);
    expect(view(game).session.state).toBe('completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.results['flight-time']).toBeCloseTo(t.T, 9);
    expect(completed[0]?.results.range).toBeCloseTo(t.R, 9);
    expect(ballPose(game)[0]).toBeCloseTo(LAUNCH[0] + t.R, 9); // landed there
    expect(game.physics.stats().driven).toBe(0); // physics owns it again
    frames(game, 1);
    expect(ballPose(game)[1]).toBeCloseTo(R, 2); // resting on the floor
    expect(Math.abs(ballPose(game)[0] - (LAUNCH[0] + t.R))).toBeLessThan(0.05);
    expect(game.entityStates.get(LAUNCHER, 'loaded')).toBe('');
    expect(game.state.progression.completedExperiments).toContain('projectile-motion');
  });

  it('flies the same at any frame rate: samples, landing, final state, theory, real-time pace', async () => {
    // The Moon example (5 m/s, 45°, 1.62 m/s²) through the whole game loop. main.ts caps a frame
    // at 0.1 s, so 10 fps is the slowest real-time rate; 300 Hz is this project's laptop display.
    const rates: [string, number[]][] = [
      ...[300, 60, 30, 20, 15, 10].map((fps): [string, number[]] => [`${fps} fps`, [1 / fps]]),
      ['jittery', [1 / 144, 0.1, 1 / 60, 0.0371, 1 / 300, 0.08]],
    ];
    const t = theory(5, 45, 1.62);
    const flights = [];
    for (const [name, pattern] of rates) {
      const { game } = await lab();
      loadBall(game);
      for (let i = 0; i < 6; i++) act(game, `${ROOM}/dial-velocity`, 'lower'); // 8 → 5 m/s
      for (let i = 0; i < 2; i++) act(game, `${ROOM}/dial-gravity`, 'lower'); // Earth → Mars → Moon
      act(game, `${ROOM}/button-run`, 'run');
      const run = view(game).session.run!;
      expect(run.inputs).toEqual({
        velocity: 5,
        angle: 45,
        gravity: 1.62,
        resolution: 0.01,
        height: 0.59,
      });
      let elapsed = 0;
      for (let i = 0; view(game).session.state === 'running' && i < 5000; i++) {
        const dt = pattern[i % pattern.length] ?? H;
        game.update(dt);
        elapsed += dt;
        expect(game.physics.stats().driven).toBe(view(game).session.state === 'running' ? 1 : 0);
      }
      expect(view(game).session.state, name).toBe('completed');
      const landed = [...ballPose(game)];
      frames(game, 0.5); // physics owns the ball again: it must rest where the model landed it
      const count = run.sampleCount;
      flights.push({
        name,
        elapsed,
        longest: Math.max(...pattern),
        results: run.results,
        samples: [run.sampleTimes, ...run.sampleValues].map((s) =>
          Array.from(s.subarray(0, count)),
        ),
        final: ['x', 'y', 'vx', 'vy', 'speed'].map((v) => run.value(v)),
        landed,
        rested: [...ballPose(game)],
      });
    }
    const [reference] = flights;
    for (const f of flights) {
      // Bit-identical physics, whatever the frame rate: same samples, results, end state, landing.
      expect(f.samples, f.name).toEqual(reference?.samples);
      expect(f.results, f.name).toEqual(reference?.results);
      expect(f.final, f.name).toEqual(reference?.final);
      expect(f.landed, f.name).toEqual(reference?.landed);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs((f.rested[k] ?? NaN) - (f.landed[k] ?? NaN)), f.name).toBeLessThan(1e-3);
      }
      // The run took its flight time in game time, ending within the frame that contains it.
      expect(f.elapsed, f.name).toBeGreaterThanOrEqual(t.T);
      expect(f.elapsed - f.longest, f.name).toBeLessThan(t.T);
    }
    expect(reference?.results?.['flight-time']).toBeCloseTo(t.T, 9);
    expect(reference?.results?.range).toBeCloseTo(t.R, 9);
    expect(reference?.landed[0]).toBeCloseTo(LAUNCH[0] + t.R, 9);
    expect(reference?.samples[0]?.length).toBe(Math.floor(t.T / 0.01) + 2); // every 10 ms + landing
  });

  it('STOP keeps the data and the ball where the measurement stopped; RESET reloads it', async () => {
    const { game, blocked } = await lab();
    loadBall(game);
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 0.3);
    expect(act(game, `${ROOM}/button-stop`, 'stop')).toBe(true);
    const session = view(game).session;
    expect(session.state).toBe('stopped');
    const samples = session.run?.sampleCount ?? 0;
    expect(samples).toBeGreaterThan(15);
    const frozen = [...ballPose(game)];
    frames(game, 0.5);
    expect(ballPose(game)).toEqual(frozen); // neither model nor physics moves it
    expect(session.run?.sampleCount).toBe(samples);
    expect(act(game, BALL, 'grab')).toBe(false);
    expect(blocked.at(-1)).toBe('Press RESET to put it back into the launcher.');
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('Press RESET before the next run.');

    expect(act(game, `${ROOM}/button-reset`, 'reset')).toBe(true);
    expect(view(game).session.state).toBe('configured');
    expect(view(game).session.run).toBeNull();
    expect(ballPose(game)).toEqual([expect.closeTo(-0.9, 9), expect.closeTo(0.62, 9), 11.75]);
    expect(game.entityStates.get(LAUNCHER, 'loaded')).toBe(BALL);
  });

  it('RESET after a landing leaves a ball the player has picked up in their hands', async () => {
    const { game } = await lab();
    loadBall(game);
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 3);
    expect(view(game).session.state).toBe('completed');
    expect(act(game, BALL, 'grab')).toBe(true); // landed: an ordinary object again
    untilIdle(game); // on the floor: crouched to, taken once the hand is there
    act(game, `${ROOM}/button-reset`, 'reset');
    expect(view(game).session.state).toBe('idle');
    expect(game.interaction.heldId).toBe(BALL);
    expect(view(game).loaded).toBe(false);
  });

  it('RESET puts back the ball the world has now: one put away and taken out is a new entity', async () => {
    const { game } = await lab();
    /** A run that lands, then the ball grabbed, put away and taken out again (in the hands). */
    const landAndCarry = () => {
      act(game, `${ROOM}/button-run`, 'run');
      frames(game, 3);
      expect(view(game).session.state).toBe('completed');
      const landed = game.world.entity(BALL);
      expect(act(game, BALL, 'grab')).toBe(true);
      untilIdle(game);
      expect(game.inventory.stow()).toBe(true);
      expect(game.world.entity(BALL)).toBeUndefined();
      expect(game.inventory.takeOut(game.inventory.selected)).toBe(true);
      const ball = game.world.entity(BALL);
      expect(ball).not.toBe(landed);
      expect(game.interaction.heldEntity).toBe(ball);
    };

    loadBall(game);
    landAndCarry();
    act(game, `${ROOM}/button-reset`, 'reset'); // in the hands: it stays there
    expect(view(game).loaded).toBe(false);
    expect(game.interaction.heldId).toBe(BALL);
    expect(game.physics.stats().driven).toBe(0);

    face(game, [-2.3, 0, 11.75], [-1, 0.2, 11.75], LAUNCHER);
    press(game, 'interact'); // load the ball in hand
    expect(view(game).loaded).toBe(true);
    landAndCarry();
    frames(game, 0.3); // out of the player first: let go inside the capsule, it would go back in the bag
    game.interaction.drop();
    frames(game, 0.5);
    act(game, `${ROOM}/button-reset`, 'reset'); // lying in the range: back into the launcher
    expect(view(game).loaded).toBe(true);
    expect(game.entityStates.get(LAUNCHER, 'loaded')).toBe(BALL);
    expect(ballPose(game)).toEqual([expect.closeTo(-0.9, 9), expect.closeTo(0.62, 9), 11.75]);
    expect(game.physics.body(BALL)?.driven).toBe(true); // the live body, out of the simulation
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(true);
    frames(game, 3);
    expect(view(game).session.state).toBe('completed');
    expect(ballPose(game)[0]).toBeCloseTo(LAUNCH[0] + theory(8, 45, 9.81).R, 1); // the drawn ball flew
  });

  it('unloading hands the ball back to the player', async () => {
    const { game } = await lab();
    loadBall(game);
    expect(act(game, LAUNCHER, 'unload')).toBe(true);
    expect(game.interaction.heldId).toBe(BALL);
    expect(view(game).session.state).toBe('idle');
    expect(game.physics.stats().driven).toBe(0);
  });

  it('dials step parameters (and presets for g), refused while running or at a limit', async () => {
    const { game, blocked } = await lab();
    const changed: string[] = [];
    game.events.subscribe('ExperimentParameterChanged', (e) =>
      changed.push(`${e.parameterId}=${e.value}`),
    );
    act(game, `${ROOM}/dial-velocity`, 'raise');
    act(game, `${ROOM}/dial-angle`, 'lower');
    act(game, `${ROOM}/dial-gravity`, 'lower');
    expect(changed).toEqual(['velocity=8.5', 'angle=40', 'gravity=3.71']);
    expect(game.entityStates.get(LAUNCHER, 'param.gravity')).toBe(3.71);
    expect(view(game).session.parameters).toEqual({
      velocity: 8.5,
      angle: 40,
      gravity: 3.71,
      resolution: 0.01,
    });
    // Through the real keys: E raises, F lowers.
    face(game, [-1.6, 0, 13.2], [-1.6, 0.875, 14], `${ROOM}/dial-angle`);
    press(game, 'interact');
    press(game, 'interact');
    press(game, 'secondary');
    expect(view(game).session.parameters.angle).toBe(45);

    for (let i = 0; i < 20; i++) act(game, `${ROOM}/dial-velocity`, 'raise');
    expect(view(game).session.parameters.velocity).toBe(15);
    expect(act(game, `${ROOM}/dial-velocity`, 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('v₀ is already at its maximum: 15 m/s.');

    for (let i = 0; i < 4; i++) act(game, `${ROOM}/dial-velocity`, 'lower'); // 13 m/s
    act(game, `${ROOM}/dial-gravity`, 'raise'); // back to Earth: lands ≈ 17.7 m away
    loadBall(game);
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(true);
    expect(act(game, `${ROOM}/dial-angle`, 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('Stop the run before changing its parameters.');
  });

  it('refuses RUN with the reason: nothing loaded, out of range, too high', async () => {
    const { game, blocked } = await lab();
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('Load a projectile ball into the launcher first.');
    loadBall(game);
    const setTo = (dial: string, action: 'raise' | 'lower', times: number) => {
      for (let i = 0; i < times; i++) act(game, `${ROOM}/${dial}`, action);
    };
    setTo('dial-velocity', 'raise', 14); // 15 m/s
    setTo('dial-gravity', 'lower', 2); // Moon
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toMatch(
      /^Out of range: it would land \d+\.\d m away, beyond the 21\.6 m lane\. Lower v₀, or change θ or g\.$/,
    );
    setTo('dial-gravity', 'raise', 2); // Earth
    setTo('dial-angle', 'raise', 9); // 90°
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toMatch(
      /^Too high: it would rise to 12\.\d m, above the 5\.7 m the hall allows\./,
    );
    expect(view(game).session.state).toBe('configured'); // nothing was started
    setTo('dial-angle', 'lower', 4); // 70°: R 14.8 m, H 10.5 m — still too high
    setTo('dial-velocity', 'lower', 10); // 10 m/s at 70°: H ≈ 5.1 m
    expect(view(game).runBlock).toBeNull();
    expect(act(game, `${ROOM}/button-run`, 'run')).toBe(true);
  });

  it('protects the ball in flight', async () => {
    const { game, blocked } = await lab();
    loadBall(game);
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 0.2);
    expect(act(game, BALL, 'grab')).toBe(false);
    expect(blocked.at(-1)).toBe('It is in flight.');
  });

  it('walks the checklist: read, load, set, run, read the results', async () => {
    const { game, blocked } = await lab();
    const done = () => view(game).checklist.map((s) => s.done);
    expect(act(game, `${ROOM}/monitor`, 'view-results')).toBe(false);
    expect(blocked.at(-1)).toBe('No results yet: run the experiment first.');
    act(game, `${ROOM}/instructions`, 'inspect');
    expect(done()).toEqual([true, false, false, false, false]);
    loadBall(game);
    act(game, `${ROOM}/dial-angle`, 'lower');
    expect(view(game).next).toBe(3);
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 3);
    expect(done()).toEqual([true, true, true, true, false]);
    const viewed: string[] = [];
    game.events.subscribe('ExperimentResultsViewed', ({ stationId }) => viewed.push(stationId));
    expect(act(game, `${ROOM}/monitor`, 'view-results')).toBe(true);
    expect(viewed).toEqual([LAUNCHER]);
    expect(view(game).next).toBe(5);
  });

  it('leaving the scene stops a run but keeps its data and the configuration', async () => {
    const { game } = await lab();
    loadBall(game);
    act(game, `${ROOM}/dial-velocity`, 'raise');
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 0.2);
    await game.scenes.load('simlab-hub');
    expect(game.experiments.find(LAUNCHER)?.state).toBe('stopped');
    await game.scenes.load('physics-lab');
    game.update(H);
    expect(view(game).session.state).toBe('stopped');
    expect(view(game).session.run?.sampleCount).toBeGreaterThan(10);
    expect(view(game).session.parameters.velocity).toBe(8.5);
    expect(view(game).loaded).toBe(false); // the ball was in flight; it is back on the cart
    expect(game.physics.stats().driven).toBe(0);
  });

  it('Continue restores the configuration: parameters and the loaded ball, not runs', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    loadBall(game);
    act(game, `${ROOM}/dial-angle`, 'lower');
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 3);
    act(game, `${ROOM}/button-reset`, 'reset'); // ball back in the launcher
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    const v = view(again);
    expect(v.session.parameters).toEqual({
      velocity: 8,
      angle: 40,
      gravity: 9.81,
      resolution: 0.01,
    });
    expect(v.loaded).toBe(true);
    expect(v.session.state).toBe('configured');
    expect(v.session.run).toBeNull(); // runs are not saved: re-running reproduces them
    expect(again.world.entity(BALL)?.pose.position[1]).toBeCloseTo(0.62, 9);
    expect(again.physics.stats().driven).toBe(1);
    // The lab keeps working after Continue: physics runs on, and the restored ball flies.
    frames(again, 0.5);
    expect(again.systems.statuses().filter((s) => s.status === 'failed')).toEqual([]);
    expect(act(again, `${ROOM}/button-run`, 'run')).toBe(true);
    frames(again, 3);
    expect(again.stations.view(LAUNCHER)?.session.state).toBe('completed');
    expect(again.physics.stats().driven).toBe(0);
  });

  it('a new game forgets runs and checklists', async () => {
    const { game } = await lab();
    loadBall(game);
    act(game, `${ROOM}/button-run`, 'run');
    frames(game, 3);
    await game.newGame('researcher-female');
    expect(game.experiments.find(LAUNCHER)).toBeUndefined();
    await game.scenes.load('physics-lab');
    expect(view(game).session.state).toBe('idle');
    expect(view(game).checklist.some((s) => s.done)).toBe(false);
    expect(view(game).session.parameters.angle).toBe(45);
  });
});
