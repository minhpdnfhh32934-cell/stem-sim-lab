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

  it('speaks a state change once, never the running clock; a step or the settled pause time is spoken', () => {
    set(false, 0);
    render(<StageAnnouncer title="Ném xiên" />);
    const live = screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite');
    expect(live).toHaveTextContent('');

    set(true, 0.1);
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');
    set(true, 0.5);
    set(true, 0.9);
    expect(live).toHaveTextContent('Ném xiên: đang chạy.');

    // Paused: the HUD time may still settle once after the pause; the line follows it.
    set(false, 1.2);
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,200 s.');
    set(false, 1.234);
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,234 s.');

    // "Bước tiếp": one step while stopped.
    set(false, 1.244);
    expect(live).toHaveTextContent('Ném xiên: tạm dừng ở t = 1,244 s.');
  });
});
