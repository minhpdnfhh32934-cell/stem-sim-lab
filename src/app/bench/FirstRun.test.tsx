import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { Onboarding } from '@/app/learner/Onboarding';
import { useProfileStore } from '@/app/learner/profileStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { AgeGate } from '@/safety/AgeGate';
import { BrowserSafety, setSafetyBackendForTests } from '@/safety/safety';
import { loadSafety, useSafetyStore } from '@/safety/safetyStore';
import { BenchContext } from './shellMode';

const bench = (node: React.ReactNode) => (
  <BenchContext.Provider value={true}>{node}</BenchContext.Provider>
);

beforeEach(() => {
  useProfileStore.setState({ onboarded: false, connectSeen: false, interests: [], grade: 'all' });
  useAiStore.setState({ status: 'noKey' });
});
afterEach(() => {
  act(() => {
    useWorkspaceStore.setState({ settingsOpen: false, subject: 'physics' });
    useSafetyStore.setState({ gateRequested: false, gateFirstRun: false });
  });
});

describe('bench first run (docs/BENCH_DESIGN.md §9.2)', () => {
  it('step 1/3: grade and subjects on one page, one filled "Tiếp"', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await loadSafety();
    });
    render(bench(<Onboarding />));
    expect(screen.getByText('Bước 1/3')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Lớp 11' }));
    await user.click(screen.getByRole('button', { name: 'Sinh học', pressed: false }));
    expect(document.querySelectorAll('dialog .btn--accent')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Tiếp' }));
    expect(useProfileStore.getState()).toMatchObject({
      grade: 11,
      interests: ['biology'],
      onboarded: true,
    });
    expect(useWorkspaceStore.getState().subject).toBe('biology');
  });

  it('step 3/3: three choices; Gemma opens its Settings page, nothing downloads here', async () => {
    const user = userEvent.setup();
    useProfileStore.setState({ onboarded: true });
    await act(async () => {
      await loadSafety();
    });
    render(bench(<Onboarding />));
    expect(screen.getByText('Bước 3/3')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await user.click(screen.getByRole('radio', { name: /Dùng Gemma trên máy này/ }));
    await user.click(screen.getByRole('button', { name: 'Tiếp' }));
    expect(useProfileStore.getState().connectSeen).toBe(true);
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'local',
    });
  });

  it('step 3/3: "Quay lại" asks the 18+ question again, still as step 2/3', async () => {
    const user = userEvent.setup();
    useProfileStore.setState({ onboarded: true });
    await act(async () => {
      await loadSafety();
    });
    render(bench(<Onboarding />));
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(useSafetyStore.getState()).toMatchObject({ gateRequested: true, gateFirstRun: true });
    render(<AgeGate />);
    await screen.findByRole('button', { name: 'Tôi chưa đủ 18 tuổi' });
    expect(screen.getByText('Bước 2/3')).toBeInTheDocument();
    // Nothing was saved or skipped: step 3 is still to come.
    expect(useProfileStore.getState().connectSeen).toBe(false);
  });

  it('the gate is step 2/3 on the bench’s first run only', async () => {
    setSafetyBackendForTests(new BrowserSafety());
    const { unmount } = render(<AgeGate />);
    await screen.findByRole('button', { name: 'Tôi chưa đủ 18 tuổi' });
    expect(screen.getByText('Bước 2/3')).toBeInTheDocument();
    unmount();
    // Reopened from Settings (not the first run): no step number.
    act(() => {
      useSafetyStore.setState({ gateRequested: true, gateFirstRun: false });
    });
    render(<AgeGate />);
    await screen.findByRole('button', { name: 'Tôi chưa đủ 18 tuổi' });
    expect(screen.queryByText(/Bước/)).toBeNull();
  });
});
