import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { StageAnnouncer } from './StageAnnouncer';

const set = (playing: boolean, simTime: number) => {
  act(() => {
    useWorkspaceStore.setState({ playing, simTime });
  });
};

const settle = () => {
  act(() => {
    vi.advanceTimersByTime(150);
  });
};

describe('StageAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    useWorkspaceStore.setState({ playing: false, simTime: 0 });
    useSimStore.setState({ finished: false, scrubTime: null, intervened: false });
  });

  it('speaks a state change once, never the running clock; a pause and each step are spoken', () => {
    set(false, 0);
    render(<StageAnnouncer title="Ném xiên" />);
    const live = screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite');
    expect(live).toHaveTextContent('');

    set(true, 0.1);
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
    set(true, 0.5);
    set(true, 0.9);
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');

    // Paused: spoken once the time has settled, with that time.
    set(false, 1.234);
    settle();
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,234 s.');

    // "Bước tiếp": one step while stopped.
    set(false, 1.244);
    settle();
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,244 s.');
  });

  it('a step while running is one line, with the time after the step', () => {
    set(true, 0.9);
    render(<StageAnnouncer title="Ném xiên" />);
    const live = screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite');
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
    // step(): `playing: false` first (the old time), then the stepped frame's time.
    set(false, 0.9);
    set(false, 0.91);
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
    settle();
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 0,910 s.');
  });

  it('a frame still in flight after the pause moves the time: still one line, the last time', () => {
    set(true, 1.2);
    render(<StageAnnouncer title="Ném xiên" />);
    const live = screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite');
    // togglePlay writes the engine's latest time; the worker's next frame lands 30 ms later.
    set(false, 1.234);
    act(() => {
      vi.advanceTimersByTime(30);
    });
    set(false, 1.25);
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
    settle();
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,250 s.');
    // Running again within the wait: nothing about the pause is said.
    set(false, 2);
    set(true, 2.01);
    settle();
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
  });
});
