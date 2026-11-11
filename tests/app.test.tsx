import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { DriverGrid } from '@/app/bench/DriverGrid';
import { useCommandPalette } from '@/app/command/commands';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { openLab, openStudio } from '@/app/topics';
import { useNavigationStore } from '@/app/navigationStore';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';

// The bench ("Bàn thí nghiệm") is the only shell since B8 (#193): these run on it.
describe('App shell (Phase 0)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ ...DEFAULT_SETTINGS, theme: 'light' });
      useLayoutStore.getState().resetLayout();
      useLayoutStore.getState().setPresentation(false);
      useWorkspaceStore.setState({ subject: 'physics', problemText: '' });
      useNavigationStore.getState().setScreen('home');
      useCommandPalette.setState({ open: false });
    });
  });

  /** The lab workspace (library, subjects, home screen) lives behind the landing page. */
  function renderInLab() {
    act(() => {
      openLab();
    });
    return render(<App />);
  }

  it('starts on the landing page; the brand returns there; the lab home follows (A4.2)', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Chào mừng đến với SimLab' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Virtual Lab/ }));
    expect(screen.getByRole('radiogroup', { name: 'Môn học' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
    // The problem box opens from the shelf (and the header's "Đề bài").
    expect(screen.getByRole('button', { name: 'Gõ hoặc dán đề bài…' })).toBeInTheDocument();
    expect(screen.getAllByText('AI Teacher').length).toBeGreaterThan(0);
    // Nothing open yet: no stage, timeline, inspector or graphs.
    expect(screen.queryByRole('region', { name: 'Khung mô phỏng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Điều khiển thời gian' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /bảng thuộc tính/i }),
    ).not.toBeInTheDocument();
    // The "SimLab" brand goes back to the landing page.
    await user.click(screen.getByRole('button', { name: 'Về trang chủ' }));
    expect(screen.getByRole('heading', { name: 'Chào mừng đến với SimLab' })).toBeInTheDocument();
  });

  it('the landing page has clear Lab and Teacher entries', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^AI Teacher/ }));
    // The Teacher screen is a lazy module: its first import is slow when the whole suite runs.
    expect(
      await screen.findByRole('heading', { name: 'Dạy học bằng AI' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('Science Studio shows inside the lab (screen "studio"), the lab one step up', async () => {
    const user = userEvent.setup();
    // openStudio() is what every older caller uses (it also closes AI Teacher).
    act(() => {
      openStudio();
    });
    expect(useNavigationStore.getState().screen).toBe('studio');
    render(<App />);
    // The studio screen is a lazy module: its first import is slow when the whole suite runs.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Science Studio' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    // The bench's studio room: the breadcrumb leads back to the lab ("Virtual Lab", not the
    // current page); the lesson has the room to itself, no library column beside it (§9.7).
    const crumbs = screen.getByRole('navigation', { name: 'Vị trí' });
    expect(within(crumbs).getByRole('button', { name: 'Virtual Lab' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(
      screen.queryByRole('complementary', { name: 'Thư viện chủ đề' }),
    ).not.toBeInTheDocument();
    // A lesson takes the centre: no inspector, lab timeline or launch page around it. The bench
    // gives the lesson its own live stage with the edge player (§9.7): any run control is that one.
    expect(
      screen.queryByRole('complementary', { name: /bảng thuộc tính/i }),
    ).not.toBeInTheDocument();
    for (const edge of screen.queryAllByRole('group', { name: 'Điều khiển thời gian' }))
      expect(edge.closest('.bench-studio-live')).not.toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Chào mừng đến với SimLab' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Về Virtual Lab' }));
    expect(useNavigationStore.getState().screen).toBe('lab');
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
  });

  it('switching subject changes the library', async () => {
    const user = userEvent.setup();
    renderInLab();
    // The shelf ("Kệ bài"): topic cards in the main area, beside the library's filter column.
    const shelf = screen.getByRole('main');
    expect(within(shelf).getByText('Ném xiên')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hóa học' }));
    expect(within(shelf).queryByText('Ném xiên')).not.toBeInTheDocument();
    expect(within(shelf).getByText('Bảng tuần hoàn')).toBeInTheDocument();
  });

  it('library search ignores diacritics', async () => {
    const user = userEvent.setup();
    renderInLab();
    await user.type(screen.getByRole('searchbox'), 'con lac');
    expect(screen.getByText('Con lắc đơn')).toBeInTheDocument();
    expect(screen.queryByText('Rơi tự do')).not.toBeInTheDocument();
  });

  it('Ctrl+K quick search finds commands without accents and runs one with Enter', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Closed: the topic list is not in the page.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    // The palette's code loads on first use.
    const box = await screen.findByRole('combobox', { name: 'Tìm nhanh' }, { timeout: 5000 });
    expect(box).toHaveFocus();
    await user.type(box, 'con lac');
    expect(screen.getByRole('option', { name: /Con lắc đơn/ })).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'giao dien sang');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('theme toggle switches <html data-theme>', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Giao diện tối', pressed: false }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('the lab panels cannot be hidden (no buttons, Ctrl+B/I/J do nothing; removed in 0.4.3)', async () => {
    const user = userEvent.setup();
    renderInLab();
    await user.keyboard('{Control>}b{/Control}{Control>}j{/Control}{Control>}i{/Control}');
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ẩn \/ hiện/ })).not.toBeInTheDocument();
  });

  it('F5 enters presentation mode (side panels hidden) and Esc leaves it', async () => {
    const user = userEvent.setup();
    renderInLab();
    await user.keyboard('{F5}');
    // The bench hides its header (and, around a topic, the tray and notebook) with one way out.
    expect(document.querySelector('.bench-header')).toBeNull();
    expect(screen.getByRole('button', { name: 'Thoát trình chiếu (Esc)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(document.querySelector('.bench-header')).not.toBeNull();
  });

  it('language can be switched to English in Settings', async () => {
    const user = userEvent.setup();
    renderInLab();
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('radio', { name: 'Physics' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('Space on a focused subject button selects it (not Play/Pause)', async () => {
    const user = userEvent.setup();
    renderInLab();
    screen.getByRole('radio', { name: 'Sinh học' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Sinh học' })).toHaveAttribute('aria-checked', 'true');
  });

  it('app shortcuts are ignored while the Settings dialog is open', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
    await user.keyboard('{F5}');
    expect(useLayoutStore.getState().presentation).toBe(false);
  });

  it('play controls stay disabled until a simulation exists', () => {
    // The bench edge (D0 "Chạy", B2) replaced the classic timeline.
    render(<DriverGrid />);
    expect(screen.getByRole('button', { name: 'Chạy (Space)' })).toBeDisabled();
  });

  it('a subject card selects the subject and shows its topics in the library', async () => {
    const user = userEvent.setup();
    renderInLab();
    // The bench's subject choice is the "Môn học" radios (it has no subject cards, §9.3).
    await user.click(screen.getByRole('radio', { name: 'Sinh học' }));
    expect(screen.getByRole('radio', { name: 'Sinh học' })).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('main')).getByText('Nguyên phân')).toBeInTheDocument();
  });
});
