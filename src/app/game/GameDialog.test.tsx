import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { GameDialog } from './GameDialog';
import { closeGame, openGame, useGameStore } from './gameStore';

afterEach(() => {
  act(() => {
    closeGame();
  });
  localStorage.removeItem('simlab.settings.language');
});

describe('SimLab 3D window (docs/GAME.md)', () => {
  it('shows nothing until opened, then the game in a frame of the app', () => {
    render(<GameDialog />);
    expect(document.querySelector('iframe')).toBeNull();
    act(() => {
      openGame('vi');
    });
    const frame = screen.getByTitle('Trò chơi SimLab 3D');
    expect(frame.getAttribute('src')).toMatch(/game\/index\.html$/);
    // The released game (user decision 13/11/2026): the bar is the way back and the title only.
    expect(screen.queryByText('Bản thử nghiệm')).toBeNull();
    expect(screen.queryByText(/đang chờ giáo viên duyệt/)).toBeNull();
    const bar = document.querySelector('.game-dialog__bar');
    expect(bar?.children).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'SimLab 3D' })).toBeInTheDocument();
  });

  it('"Về SimLab" closes it and drops the frame (its GPU context goes with it)', async () => {
    render(<GameDialog />);
    act(() => {
      openGame('vi');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Về SimLab' }));
    expect(useGameStore.getState().open).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('the game starts in the app language once; a choice made in the game stays', () => {
    openGame('vi');
    expect(localStorage.getItem('simlab.settings.language')).toBe('vi');
    localStorage.setItem('simlab.settings.language', 'en');
    openGame('vi');
    expect(localStorage.getItem('simlab.settings.language')).toBe('en');
  });
});
