import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { loadSafety } from '@/safety/safetyStore';
import StudioScreen from './StudioScreen';
import { GUIDE_STEPS } from './guideSteps';
import { useStudioStore } from './studioStore';

// uPlot needs a real canvas; the studio's charts are tested elsewhere.
vi.mock('@/ui/charts/XYChart', () => ({ XYChart: () => <div data-testid="xy-chart" /> }));

const esc = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
};
const savedSeen = () =>
  (
    JSON.parse(localStorage.getItem('stemsim.studio') ?? '{}') as {
      state?: { guideSeen?: boolean };
    }
  ).state?.guideSeen;

beforeEach(async () => {
  // The first-run questions are answered (onboarding phase "done"), as in Tour.test.tsx.
  await loadSafety();
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useNavigationStore.setState({ screen: 'studio' });
  useStudioStore.setState({ tab: 'physics', sessions: {}, guideSeen: false, guideStep: null });
});

describe('"Cách học" guide in Science Studio', () => {
  it('opens by itself on the first visit, once: closed, it stays closed when the studio reopens', () => {
    const first = render(<StudioScreen />);
    expect(screen.getByRole('dialog', { name: 'Học trong Science Studio' })).toBeInTheDocument();
    expect(savedSeen()).toBe(true);
    esc();
    expect(screen.queryByRole('dialog')).toBeNull();
    first.unmount();
    render(<StudioScreen />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the button opens it again and Next walks every step to the end', async () => {
    useStudioStore.setState({ guideSeen: true });
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cách học' }));
    for (let i = 1; i < GUIDE_STEPS.length; i++) {
      expect(screen.getByRole('dialog')).toHaveTextContent(`${i}/${GUIDE_STEPS.length}`);
      await user.click(screen.getByRole('button', { name: 'Tiếp' }));
    }
    expect(screen.getByRole('dialog', { name: 'Soạn bài' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('points at real parts of the studio (every target but the welcome card exists)', () => {
    useStudioStore.setState({ guideSeen: true });
    const { container } = render(<StudioScreen />);
    for (const s of GUIDE_STEPS.slice(1))
      expect(container.querySelector(s.target ?? ''), s.target).not.toBeNull();
    // "Lưu báo cáo" points at the last step of the flow, not the first one.
    const report = GUIDE_STEPS.find((s) => s.title === 'studio.guide.reportTitle');
    expect(container.querySelector(report?.target ?? '')).toHaveTextContent('Báo cáo');
  });

  it('keeps the keyboard inside the card and gives the focus back to "Cách học" on close', async () => {
    useStudioStore.setState({ guideSeen: true });
    const user = userEvent.setup();
    render(<StudioScreen />);
    const button = screen.getByRole('button', { name: 'Cách học' });
    await user.click(button);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(/sáu bước/);
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    esc();
    expect(button).toHaveFocus();
  });

  it('leaves the keyboard alone outside the card (chat bubble, Ctrl+K palette)', async () => {
    useStudioStore.setState({ guideSeen: true });
    const user = userEvent.setup();
    render(
      <>
        <StudioScreen />
        <input aria-label="Ô chat" />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Cách học' }));
    const input = screen.getByRole('textbox', { name: 'Ô chat' });
    input.focus();
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveFocus();
  });

  it('opened from Soạn bài, it shows a subject tab (its steps point at a lesson)', () => {
    useStudioStore.setState({ guideSeen: true, tab: 'authoring' });
    useStudioStore.getState().openGuide();
    expect(useStudioStore.getState().tab).toBe('physics');
  });

  it('waits for the first-run questions before opening', () => {
    useProfileStore.setState({ onboarded: false });
    render(<StudioScreen />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useStudioStore.getState().guideSeen).toBe(false);
  });
});
