import { describe, expect, it } from 'vitest';
import { FrameClock } from '../../core/FrameClock';
import { FrameMeter, frameLines } from './FrameMeter';

// The F3 overlay's frame rate (Phú 2026-11-08): what the game ran, apart from what the browser
// offered, so a capped game on a fast display reads as such.

/** `seconds` of display frames at `hz` through a clock capped at `cap`, read once at the end. */
function read(hz: number, cap: number, seconds = 10) {
  const clock = new FrameClock(0, 0.1);
  const meter = new FrameMeter(clock, 0);
  const frames = Math.round(seconds * hz);
  for (let i = 1; i <= frames; i++) clock.tick((i * 1000) / hz, cap);
  expect(meter.sample((frames * 1000) / hz, 0.25)).toBe(true);
  return meter.reading;
}

describe('FrameMeter', () => {
  it('tells the frames run from the display frames offered', () => {
    const capped = read(300, 60);
    expect(capped.fps).toBeCloseTo(60, 0);
    expect(capped.displayHz).toBeCloseTo(300, 0);
    expect(capped.frameMs).toBeCloseTo(1000 / 60, 0);
    const free = read(300, 0);
    expect(free.fps).toBeCloseTo(300, 0);
    // A browser holding the page at 60 Hz: 60 offered, 60 run, whatever the cap.
    const held = read(60, 0);
    expect([Math.round(held.fps), Math.round(held.displayHz)]).toEqual([60, 60]);
  });

  it('takes the slowest frame of the reading, then starts again', () => {
    const clock = new FrameClock(0, 0.1);
    const meter = new FrameMeter(clock, 0);
    for (const now of [10, 20, 65, 75]) clock.tick(now, 0);
    meter.sample(1000, 0.25);
    expect(meter.reading.slowestMs).toBe(45);
    clock.tick(1010, 0);
    meter.sample(2000, 0.25);
    expect(meter.reading.slowestMs).toBe(935); // 75 → 1010
    expect(meter.sample(2100, 0.25)).toBe(false); // too soon: the old reading stays
  });

  it('keeps the FPS line the e2e suite reads, and adds the frame, display and GPU lines', () => {
    const lines = frameLines(
      { fps: 59.6, displayHz: 300, frameMs: 16.7, slowestMs: 21 },
      60,
      'high',
      'NVIDIA',
    );
    expect(lines[0]).toBe('FPS:          60 (cap 60, graphics high)');
    expect(lines.slice(1)).toEqual([
      'Frame:        16.7 ms mean · 21.0 ms slowest',
      'Display:      300 Hz offered by the browser',
      'GPU:          NVIDIA',
    ]);
  });
});
