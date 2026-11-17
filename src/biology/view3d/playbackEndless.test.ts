import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from './playback';

/** Manual requestAnimationFrame queue: each `frames(n)` advances n frames of 50 ms. */
let queue = new Map<number, FrameRequestCallback>();
let id = 0;
let now = 0;
function frames(n: number) {
  for (let i = 0; i < n; i++) {
    now += 50;
    const due = [...queue.values()];
    queue = new Map();
    act(() => {
      for (const cb of due) cb(now);
    });
  }
}

beforeEach(() => {
  queue = new Map();
  now = performance.now();
  // The loop reads its first time from performance.now(): on the test's own clock too, so the
  // first frame lasts 50 ms however busy the machine is (it was the real gap before, a flake).
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    id += 1;
    queue.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((k) => {
    queue.delete(k);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePlayback endless (#205 C5)', () => {
  it('stops at the end of the span without it, as before', () => {
    const { result } = renderHook(() => usePlayback(10, { start: 0, autoplay: true, seconds: 1 }));
    frames(30);
    expect(result.current.playing).toBe(false);
    expect(result.current.t).toBe(10);
    expect(result.current.page).toBe(0);
  });

  it('plays the next span from where the last one ended, and a new run starts at page 0', () => {
    let runKey = 'a';
    const { result, rerender } = renderHook(() =>
      usePlayback(10, { start: 0, autoplay: true, seconds: 1, endless: true, runKey }),
    );
    // 20 frames of 50 ms = one span of 10 in 1 s; 50 frames = 2.5 spans.
    frames(50);
    expect(result.current.playing).toBe(true);
    expect(result.current.page).toBe(2);
    expect(result.current.t).toBeCloseTo(5, 6);
    runKey = 'b';
    rerender();
    expect(result.current.page).toBe(0);
    frames(25);
    expect(result.current.page).toBe(1);
    act(() => {
      result.current.replay();
    });
    expect(result.current.page).toBe(0);
    expect(result.current.t).toBe(0);
  });
});
