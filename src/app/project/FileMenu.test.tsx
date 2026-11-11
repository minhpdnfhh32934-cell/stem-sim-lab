import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchLibrary } from '@/app/bench/Library';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePerfStore } from '@/perf/perfStore';
import { FileMenu } from './FileMenu';
import { useProjectUi } from './uiStore';

afterEach(() => {
  act(() => {
    useLayoutStore.getState().setPresentation(false);
    useProjectUi.setState({ historyOpen: false, historyFocus: false });
    useSettingsStore.getState().setUiMode('basic');
  });
});

function openMenu() {
  render(<FileMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Tệp' }));
}

describe('Tệp menu on the bench (docs/BENCH_DESIGN.md: Lịch sử, Chế độ trình chiếu)', () => {
  it('"Chế độ trình chiếu (F5)" turns presentation on (the bench has no other button for it)', () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chế độ trình chiếu (F5)' }));
    expect(useLayoutStore.getState().presentation).toBe(true);
  });

  it('"Lịch sử" goes to the shelf and opens its list, in Basic too', () => {
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
      useNavigationStore.getState().setScreen('home');
    });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Lịch sử' }));
    expect(useNavigationStore.getState().screen).toBe('lab');
    expect(useProjectUi.getState().historyOpen).toBe(true);
    render(<BenchLibrary />);
    const toggle = screen.getByRole('button', { name: 'Lịch sử', expanded: true });
    // The menu item is gone: the focus follows the list it opened, once.
    expect(toggle).toHaveFocus();
    expect(useProjectUi.getState().historyFocus).toBe(false);
    // Basic keeps "Soạn bài" for Advanced; closing the list hides the section again, and the
    // focus goes to the search field instead of <body>.
    expect(screen.queryByRole('button', { name: 'Soạn bài' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Lịch sử' })).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Tìm chủ đề…' })).toHaveFocus();
  });
});

describe('"Thông tin máy" in Tệp: quality, FPS and RAM for Advanced (#201)', () => {
  afterEach(() => {
    act(() => {
      usePerfStore.setState({ benchmark: null, fps: null, memoryMB: null, preference: 'auto' });
    });
  });

  it('Basic has no "Thông tin máy"', () => {
    openMenu();
    expect(screen.queryByRole('menuitem', { name: 'Thông tin máy' })).toBeNull();
  });

  it('Advanced: the tier with its measurement, FPS and RAM; no live region; closing returns to Tệp', () => {
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
      usePerfStore.setState({
        preference: 'auto',
        benchmarking: false,
        benchmark: {
          cpuScore: 8,
          drawScore: 100,
          webgl2: true,
          cores: 8,
          tier: 'medium',
          measuredAt: '2026-11-12T01:30:00.000Z',
          durationMs: 1200,
        },
        fps: 58.6,
        memoryMB: 212.4,
      });
    });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thông tin máy' }));
    const dialog = screen.getByRole('dialog', { name: 'Thông tin máy' });
    expect(within(dialog).getByText('Tự động (Trung bình)')).toBeInTheDocument();
    expect(within(dialog).getByText(/^đo lúc /)).toBeInTheDocument();
    // formatNumber: whole frames per second, whole megabytes (vi).
    expect(within(dialog).getByText('59')).toBeInTheDocument();
    expect(within(dialog).getByText('RAM 212 MB')).toBeInTheDocument();
    // The numbers change all the time: never a live region.
    expect(within(dialog).queryByRole('status')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: 'Thông tin máy' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tệp' })).toHaveFocus();
  });

  it('nothing measured or running yet: "chưa đo" and dashes, never a made-up number', () => {
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
    });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thông tin máy' }));
    const dialog = screen.getByRole('dialog', { name: 'Thông tin máy' });
    expect(dialog).toHaveTextContent('chưa đo');
    expect(within(dialog).getAllByText('—')).toHaveLength(2);
  });
});
