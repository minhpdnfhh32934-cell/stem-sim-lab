import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useNavigationStore } from '@/app/navigationStore';
import { loadSafety } from '@/safety/safetyStore';
import { Tour } from './Tour';
import { startTour, useProjectUi } from './uiStore';

const esc = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
};

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
});
