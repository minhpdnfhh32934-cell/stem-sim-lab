import { describe, expect, it } from 'vitest';
import { type Stepped, SteppedMotion } from './steppedMotion';

// The menu's looping CSS animations moved on a few times a second (Phú 2026-11-18: the still menu
// kept the integrated GPU busy): paused once, then advanced by the time since their last step.

function fake(start = 0): Stepped & { paused: number; playState: AnimationPlayState } {
  return {
    paused: 0,
    playState: 'paused',
    currentTime: start,
    pause() {
      this.paused++;
    },
  };
}

describe('SteppedMotion', () => {
  it('pauses each animation once and moves it on only every 1/hz s, by the time gone', () => {
    const a = fake(1000);
    const b = fake(250);
    let looked = 0;
    const motion = new SteppedMotion(() => {
      looked++;
      return [a, b];
    }, 30);
    motion.update(0.01); // looked up and paused; 10 ms is under a step (33 ms)
    expect([a.paused, b.paused, looked]).toEqual([1, 1, 1]);
    expect([a.currentTime, b.currentTime]).toEqual([1000, 250]);
    motion.update(0.01);
    motion.update(0.02); // 30 ms since found: under a step
    expect(a.currentTime).toBe(1000);
    motion.update(0.01); // 40 ms: one step of all of it
    expect(a.currentTime).toBeCloseTo(1040, 6);
    expect(b.currentTime).toBeCloseTo(290, 6);
    for (let i = 0; i < 300; i++) motion.update(1 / 300); // a second at 300 Hz
    expect(Number(a.currentTime) - 1040).toBeCloseTo(1000, 0); // kept to real time
    expect([a.paused, looked]).toEqual([1, 1]); // never looked up again unasked
  });

  it('looks the animations up again after refresh (shown again: made anew)', () => {
    const first = fake();
    const second = fake(500);
    let list: Stepped[] = [first];
    const motion = new SteppedMotion(() => list, 30);
    motion.update(0.05);
    expect(first.currentTime).toBe(0); // found: the browser ran it up to now
    motion.update(0.05);
    expect(first.currentTime).toBeCloseTo(50, 6);
    list = [second];
    motion.refresh();
    motion.update(0.05);
    expect(second.paused).toBe(1);
    expect(second.currentTime).toBe(500);
    motion.update(0.05);
    expect(second.currentTime).toBeCloseTo(550, 6);
    expect(first.currentTime).toBeCloseTo(50, 6); // the old one left alone
  });

  it('never brings back an animation its CSS took away (reduced motion), and looks again', () => {
    const star = fake(100);
    let list: Stepped[] = [star];
    let looked = 0;
    const motion = new SteppedMotion(() => {
      looked++;
      return list;
    }, 30);
    motion.update(0.05);
    motion.update(0.05);
    expect(star.currentTime).toBeCloseTo(150, 6);
    star.playState = 'idle'; // animation: none
    list = [];
    motion.update(0.05);
    expect(star.currentTime).toBeCloseTo(150, 6); // not moved: it stays away
    motion.update(0.05);
    expect(looked).toBe(2); // looked up again, nothing there now
  });
});
