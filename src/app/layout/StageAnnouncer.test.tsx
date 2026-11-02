import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { StageAnnouncer } from './StageAnnouncer';

const set = (playing: boolean, simTime: number) => {
  act(() => {
    useWorkspaceStore.setState({ playing, simTime });
  });
};

describe('StageAnnouncer', () => {
  afterEach(() => {
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

    // Paused: togglePlay writes the engine's time with the pause, so one line, with that time.
    set(false, 1.234);
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,234 s.');

    // "Bước tiếp": one step while stopped.
    set(false, 1.244);
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,244 s.');
  });
});
