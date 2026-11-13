import { describe, expect, it } from 'vitest';
import { FrameClock } from '../core/FrameClock';
import type { FrameCap } from '../persistence/settings';
import type { Game } from './Game';
import { bootTestGame } from './testing';

// The frame-rate cap (Settings) in the game's own loop: main.ts runs FrameClock exactly like
// `drive` below, on display frames at 144 Hz. The cap changes how often frames run, never what
// the simulation does with time: physics takes its fixed steps for the time that passed, and an
// experiment run ends at the same simulated time with the same results.

const LAB = 'physics-lab';
const STAND = `${LAB}/spring`;
const HZ = 144;

/** `seconds` of 144 Hz display frames through FrameClock under `cap`, as main.ts runs them. */
function drive(game: Game, cap: FrameCap, seconds: number, start = 0) {
  const clock = new FrameClock(start, 0.1);
  let frames = 0;
  let steps = 0;
  let simulated = 0;
  let longest = 0;
  const count = Math.round(seconds * HZ);
  for (let i = 1; i <= count; i++) {
    const dt = clock.tick(start + (i * 1000) / HZ, cap);
    if (dt === null) continue;
    game.update(dt);
    frames++;
    simulated += dt;
    longest = Math.max(longest, dt);
    steps += game.physics.stats().stepsLastFrame;
  }
  return { frames, steps, simulated, longest };
}

async function lab() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load(LAB);
  return game;
}

describe('the frame-rate cap paces frames, not the simulation', () => {
  it('physics takes the same fixed steps per second of real time under every cap', async () => {
    const fixed = (await lab()).config.physics.fixedStep;
    for (const cap of [0, 30, 60, 90, 120] as const) {
      const game = await lab();
      const { frames, steps, simulated } = drive(game, cap, 4);
      if (cap > 0) expect(frames / 4).toBeLessThanOrEqual(cap + 0.5);
      // The steps cover the simulated time, which is the real time (to the last frame run).
      expect(simulated).toBeGreaterThan(4 - 1 / 30 - 1e-9);
      expect(Math.abs(steps - simulated / fixed)).toBeLessThanOrEqual(1);
      game.dispose();
    }
  }, 20_000); // six Physics Lab boots, as above

  it("a Hooke's law run ends at the same simulated time with the same results under every cap", async () => {
    const outcomes = [];
    for (const cap of [0, 30, 60, 120] as const) {
      const game = await lab();
      expect(game.interaction.perform(`${LAB}/spring-run`, 'run')).toBe(true);
      drive(game, cap, 40);
      const run = game.experiments.find(STAND)?.run;
      expect(run?.status).toBe('completed');
      expect(run?.endReason).toBe('model');
      outcomes.push({ time: run?.time, results: run?.results, samples: run?.sampleCount });
      expect(game.state.progression.completedExperiments).toEqual(['hookes-law']);
      game.dispose();
    }
    for (const outcome of outcomes) expect(outcome).toEqual(outcomes[0]);
  }, 20_000); // four Physics Lab boots: about 1 s alone, past 5 s in a full parallel run

  it('a pause under a cap stops the run, and resuming takes one ordinary step: no catch-up', async () => {
    const game = await lab();
    game.interaction.perform(`${LAB}/spring-run`, 'run');
    drive(game, 30, 0.5);
    const run = game.experiments.find(STAND)?.run;
    game.pause();
    const before = run?.time ?? 0;
    drive(game, 30, 3, 500);
    expect(run?.time).toBe(before); // paused: frames ran, the run did not
    game.resume();
    const { longest } = drive(game, 30, 0.1, 3500);
    expect(longest).toBeLessThanOrEqual(1 / 30 + 0.002); // the cap's own step, never the pause
    expect((run?.time ?? 0) - before).toBeLessThanOrEqual(0.1 + 0.002);
    game.dispose();
  });
});
