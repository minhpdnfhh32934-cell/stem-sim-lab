import { describe, expect, it } from 'vitest';
import { FrameClock } from './FrameClock';

/** Runs `seconds` of display frames at `hz` (with a little jitter) and counts the ones that run. */
function play(hz: number, cap: number, seconds = 10) {
  const clock = new FrameClock(0, 0.1);
  let ran = 0;
  let simulated = 0;
  const frames = Math.round(seconds * hz);
  for (let i = 1; i <= frames; i++) {
    const now = (i * 1000) / hz + (i % 3 === 0 ? 0.3 : -0.2); // ±0.3 ms rAF jitter
    const dt = clock.tick(now, cap);
    if (dt === null) continue;
    ran++;
    simulated += dt;
  }
  return { fps: ran / seconds, simulated };
}

describe('FrameClock', () => {
  it('with no cap runs every display frame', () => {
    expect(play(144, 0).fps).toBe(144);
    expect(play(60, 0).fps).toBe(60);
  });

  it.each([
    [144, 30, 30],
    [144, 60, 60],
    [144, 90, 90],
    [144, 120, 120],
    [60, 30, 30],
    [120, 60, 60],
    [60, 90, 60], // a cap above the display rate changes nothing
    [60, 120, 60],
  ])('a %i Hz display capped at %i runs %i frames a second', (hz, cap, expected) => {
    const { fps } = play(hz, cap);
    expect(fps).toBeGreaterThanOrEqual(expected * 0.98);
    expect(fps).toBeLessThanOrEqual(expected + 0.5);
  });

  it('advances the simulation by real time whatever the cap', () => {
    for (const cap of [0, 30, 60, 90, 120]) {
      // 10 s of frames: the time steps add up to the time that passed (to the last frame run).
      expect(play(144, cap).simulated).toBeCloseTo(10, 1);
    }
  });

  it('after a stall runs one frame, then keeps to the cap: no burst', () => {
    const clock = new FrameClock(0, 0.1);
    for (let now = 16.7; now < 1000; now += 16.7) clock.tick(now, 30);
    // The tab was hidden for 2 s: the first frame back gets the capped step, not 2 s.
    expect(clock.tick(3000, 30)).toBe(0.1);
    let ran = 0;
    for (let now = 3006.9; now < 3100; now += 6.94) if (clock.tick(now, 30) !== null) ran++;
    expect(ran).toBeLessThanOrEqual(3); // 100 ms at 30 FPS
  });

  it('takes a new cap at once, and dropping it runs every frame again', () => {
    const clock = new FrameClock(0, 0.1);
    expect(clock.tick(10, 30)).not.toBeNull();
    expect(clock.tick(17, 30)).toBeNull();
    expect(clock.tick(24, 0)).not.toBeNull();
    expect(clock.tick(31, 0)).not.toBeNull();
  });
});
