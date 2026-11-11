import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchLibrary } from '@/app/bench/Library';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
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
