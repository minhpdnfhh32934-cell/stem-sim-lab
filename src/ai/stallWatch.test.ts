import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchStall } from './stallWatch';

describe('stalled on-device answers (audit AI-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up when the first piece never comes', () => {
    const onStall = vi.fn();
    watchStall({ firstMs: 10_000, gapMs: 3_000, onStall });
    vi.advanceTimersByTime(9_000);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(onStall).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('waits as long as pieces keep coming, then notices the silence', () => {
    const onStall = vi.fn();
    const watch = watchStall({ firstMs: 10_000, gapMs: 3_000, onStall });
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(2_000);
      watch.touch();
    }
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('does nothing once stopped (the answer finished)', () => {
    const onStall = vi.fn();
    const watch = watchStall({ firstMs: 1_000, gapMs: 1_000, onStall });
    watch.stop();
    vi.advanceTimersByTime(10_000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
