import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bundledContent } from '../../content';
import type { RawContent } from '../../game/content';
import { bootTestGame } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { readings } from '../../simulation/measurement';
import { type DropView, dropHeight, releaseHeight } from './StationSystem';

const H = 1 / 60;
const LAB = 'physics-lab';
const TOWER = `${LAB}/tower`;

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) => game.interaction.perform(id, action);
const dial = (game: Game, parameter: string, action: 'raise' | 'lower', times = 1) => {
  for (let i = 0; i < times; i++) act(game, `${LAB}/dial-${parameter}`, action);
};
const view = (game: Game): DropView => {
  const station = game.stations.view(TOWER);
  if (station?.kind !== 'drop') throw new Error(`${TOWER} is not a free-fall station`);
  return station;
};
const session = (game: Game) => view(game).session;
const runUntilDone = (game: Game, dt = H) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** A release from rest, written out independently of the model and the station. */
const fallTime = (h: number, g: number) => Math.sqrt((2 * h) / g);
const impactVelocity = (h: number, g: number) => -Math.sqrt(2 * g * h);

/** New game, then the developer jump to the Physics Lab (setup only). */
async function lab(storage = new MemorySaveStorage(), content?: RawContent) {
  const booted = await bootTestGame({ storage, ...(content && { content }) });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load('physics-lab');
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('free-fall station', () => {
  it('is ready at once: the ball waits in the clamp at h, the configuration mirrored', async () => {
    const { game } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('free-fall');
    expect(v.session.state).toBe('configured');
    expect(v.session.parameters).toEqual({ height: 1.5, gravity: 9.81, resolution: 0.01 });
    expect(game.entityStates.get(TOWER, 'param.height')).toBe(1.5);
    expect(game.entityStates.get(TOWER, 'state')).toBe('configured');
    expect(v.runBlock).toBeNull();
    expect(v.ballRadius).toBe(0.025);
    expect(v.checklist.map((s) => s.done)).toEqual([false, false, false, false, false]);
    // Drawn from the session before any run: ball and clamp at the dial's height.
    expect(dropHeight(v.session)).toBe(1.5);
    expect(releaseHeight(v.session)).toBe(1.5);
  });

  it('dials step h on its 0.1 m grid within 0.2–3 m, g and d through their presets', async () => {
    const { game, blocked } = await lab();
    dial(game, 'height', 'raise', 5);
    expect(session(game).parameters.height).toBe(2);
    expect(view(game).checklist[1]?.done).toBe(true); // "set the drop height"
    expect(dropHeight(session(game))).toBe(2); // the ball and the clamp follow the dial
    expect(releaseHeight(session(game))).toBe(2);
    dial(game, 'height', 'raise', 20);
    expect(session(game).parameters.height).toBe(3);
    expect(act(game, `${LAB}/dial-height`, 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('h is already at its maximum: 3 m.');
    dial(game, 'height', 'lower', 40);
    expect(session(game).parameters.height).toBe(0.2);
    dial(game, 'gravity', 'lower', 2); // Earth → Mars → Moon
    expect(session(game).parameters.gravity).toBe(1.62);
    dial(game, 'resolution', 'raise');
    expect(session(game).parameters.resolution).toBe(0.1);
    expect(game.entityStates.get(TOWER, 'param.height')).toBe(0.2);
    expect(game.entityStates.get(TOWER, 'param.gravity')).toBe(1.62);
  });

  it('refuses RUN while running and before RESET; dials wait for the run', async () => {
    const { game, blocked } = await lab();
    expect(act(game, `${LAB}/button-run`, 'run')).toBe(true);
    expect(session(game).state).toBe('running');
    expect(act(game, `${LAB}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('The run is in progress.');
    expect(act(game, `${LAB}/dial-height`, 'raise')).toBe(false);
    expect(blocked.at(-1)).toBe('Stop the run before changing its parameters.');
    runUntilDone(game);
    expect(act(game, `${LAB}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe('Press RESET before the next run.');
    expect(act(game, `${LAB}/dial-height`, 'raise')).toBe(true); // allowed once completed
  });

  it('runs: the ball is drawn at the model height, no physics body; t and v are the theory', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    const bodies = game.physics.stats().bodies;
    expect(act(game, `${LAB}/button-run`, 'run')).toBe(true);
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      height: 1.5,
      gravity: 9.81,
      resolution: 0.01,
      initialVelocity: 0,
    });
    let lowest = Infinity;
    for (let i = 0; i < 200 && session(game).state === 'running'; i++) {
      game.update(H);
      expect(dropHeight(session(game))).toBe(run.value('y')); // one source of truth
      expect(releaseHeight(session(game))).toBe(1.5); // the clamp stays where it let go
      lowest = Math.min(lowest, run.value('y'));
    }
    expect(session(game).state).toBe('completed');
    expect(lowest).toBe(0); // on the floor
    expect(game.physics.stats()).toMatchObject({ bodies, driven: 0 }); // Rapier never saw it
    const t = fallTime(1.5, 9.81);
    const v = impactVelocity(1.5, 9.81);
    expect(completed).toHaveLength(1);
    expect(completed[0]?.results['fall-time']).toBeCloseTo(t, 12);
    expect(completed[0]?.results['impact-velocity']).toBeCloseTo(v, 10);
    expect(run.theory()?.fallTime).toBeCloseTo(t, 14);
    expect(run.theory()?.impactVelocity).toBeCloseTo(v, 13);
    expect(game.state.progression.completedExperiments).toEqual(['free-fall']);
    expect(view(game).checklist[2]?.done).toBe(true); // "press RUN"

    // The timer reads the run's own fall time at its recorded d; the simulated value stays exact.
    const [timer] = readings(view(game).definition, run);
    expect(timer).toMatchObject({
      result: 'fall-time',
      instrument: 'Timer (light gates)',
      resolution: 0.01,
      simulated: completed[0]?.results['fall-time'],
      text: (Math.round(t / 0.01) * 0.01).toFixed(2),
      uncertainty: 0.01 / Math.sqrt(12),
      bound: 0.005,
    });
  });

  it('STOP freezes the ball where the measurement stopped; RESET puts it back in the clamp', async () => {
    const { game } = await lab();
    dial(game, 'height', 'raise', 10); // 2.5 m
    act(game, `${LAB}/button-run`, 'run');
    frames(game, 0.3);
    expect(act(game, `${LAB}/button-stop`, 'stop')).toBe(true);
    expect(session(game).state).toBe('stopped');
    const stoppedAt = dropHeight(session(game));
    expect(stoppedAt).toBeGreaterThan(0);
    expect(stoppedAt).toBeLessThan(2.5);
    frames(game, 0.5);
    expect(dropHeight(session(game))).toBe(stoppedAt);
    expect(act(game, `${LAB}/button-reset`, 'reset')).toBe(true);
    expect(session(game).state).toBe('configured');
    expect(session(game).run).toBeNull();
    expect(dropHeight(session(game))).toBe(2.5);
    expect(view(game).checklist[4]?.done).toBe(true); // "press RESET"
  });

  it('refuses a release higher than its room and column allow, with the reason', async () => {
    // The same lab with a 2.7 m ceiling: the clamp reaches 2.7 − 0.3 − 2 × 0.025 = 2.35 m.
    const content = structuredClone(bundledContent);
    const rooms = content.rooms as { id: string; bounds: { max: number[] } }[];
    rooms.find((r) => r.id === LAB)!.bounds.max[1] = 2.7;
    const { game, blocked } = await lab(undefined, content);
    dial(game, 'height', 'raise', 9); // 2.4 m
    const high = 'Too high: this tower releases from up to 2.35 m. Lower h.';
    expect(view(game).runBlock).toBe(high);
    expect(act(game, `${LAB}/button-run`, 'run')).toBe(false);
    expect(blocked.at(-1)).toBe(high);
    expect(session(game).run).toBeNull();
    dial(game, 'height', 'lower'); // 2.3 m
    expect(view(game).runBlock).toBeNull();
  });

  it('keeps its configuration in the save: Continue restores h and g, the ball drawn there', async () => {
    const { game, storage } = await lab();
    dial(game, 'height', 'raise', 8); // 2.3 m
    dial(game, 'gravity', 'lower', 2); // Moon
    expect(game.save()?.ok).toBe(true);
    game.dispose();
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    frames(again, 0.1);
    expect(session(again).parameters).toEqual({ height: 2.3, gravity: 1.62, resolution: 0.01 });
    expect(session(again).state).toBe('configured');
    expect(dropHeight(session(again))).toBe(2.3);
  });
});
