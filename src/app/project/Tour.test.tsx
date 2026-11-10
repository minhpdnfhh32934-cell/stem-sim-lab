import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useNavigationStore } from '@/app/navigationStore';
import { BenchContext } from '@/app/bench/shellMode';
import { useSimStore } from '@/app/sim/simStore';
import { freeFall } from '@/physics/projectile/scenes';
import { loadSafety } from '@/safety/safetyStore';
import { FileMenu } from './FileMenu';
import { Tour } from './Tour';
import { startTour, useProjectUi } from './uiStore';

const esc = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
};

describe('the bench tour (docs/BENCH_DESIGN.md §9.2 "Then")', () => {
  beforeEach(async () => {
    useProfileStore.setState({ onboarded: true, connectSeen: true });
    await loadSafety();
    startTour();
  });

  it('waits on the shelf; on the first topic: play, tray, notebook, "Bỏ qua hướng dẫn"', () => {
    useNavigationStore.setState({ screen: 'lab' });
    useSimStore.setState({ scene: null, loading: false, error: null });
    const view = render(
      <BenchContext.Provider value={true}>
        <Tour />
      </BenchContext.Provider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useSimStore.setState({ scene: freeFall });
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('1/3');
    expect(screen.getByRole('heading', { name: 'Chạy thí nghiệm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' })).toBeInTheDocument();
    view.unmount();
    act(() => {
      useSimStore.setState({ scene: null });
    });
  });
});

describe('first-run tour', () => {
  beforeEach(async () => {
    useProfileStore.setState({ onboarded: true, connectSeen: true });
    await loadSafety();
    startTour();
  });

  it('waits until the learner opens the lab (the launch page has nothing to point at)', () => {
    useNavigationStore.setState({ screen: 'home' });
    render(<Tour />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useNavigationStore.setState({ screen: 'lab' });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Esc pressed elsewhere while it waits does not end it unseen', () => {
    useNavigationStore.setState({ screen: 'teacher' });
    render(<Tour />);
    esc();
    expect(useProjectUi.getState().tourStep).toBe(0);
    act(() => {
      useNavigationStore.setState({ screen: 'lab' });
    });
    esc();
    expect(useProjectUi.getState().tourStep).toBeNull();
  });

  it.each(['home', 'studio', 'teacher'] as const)(
    '"Hướng dẫn nhanh" in the menu on the %s screen opens the lab and shows the tour there',
    async (from) => {
      useProjectUi.setState({ tourStep: null });
      useNavigationStore.setState({ screen: from });
      const user = userEvent.setup();
      const { container } = render(
        <>
          <FileMenu />
          <Tour />
        </>,
      );
      const menu = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
      if (!menu) throw new Error('no menu button');
      await user.click(menu);
      await user.click(screen.getByRole('menuitem', { name: 'Hướng dẫn nhanh' }));
      expect(useNavigationStore.getState().screen).toBe('lab');
      expect(useProjectUi.getState().tourStep).toBe(0);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
  );
});
