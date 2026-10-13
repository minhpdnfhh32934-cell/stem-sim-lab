import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { useCommandPalette } from '@/app/command/commands';
import { Inspector } from '@/app/layout/Inspector';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { Timeline } from '@/app/layout/Timeline';
import { openLab } from '@/app/topics';
import { useNavigationStore } from '@/app/navigationStore';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';

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
    await user.click(screen.getByRole('button', { name: /Phòng thí nghiệm/ }));
    expect(screen.getByRole('radiogroup', { name: 'Môn học' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nhập đề bài hoặc câu hỏi…' })).toBeInTheDocument();
    expect(screen.getAllByText('AI Teacher').length).toBeGreaterThan(0);
    // Nothing open yet: no stage, timeline, inspector or graphs.
    expect(screen.queryByRole('region', { name: 'Khung mô phỏng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Điều khiển thời gian' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Bảng thuộc tính' }),
    ).not.toBeInTheDocument();
    // The "SimLab" brand goes back to the landing page.
    await user.click(screen.getByRole('button', { name: 'Về trang chủ' }));
    expect(screen.getByRole('heading', { name: 'Chào mừng đến với SimLab' })).toBeInTheDocument();
  });

  it('the landing page has clear Lab and Teacher entries', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /cùng kiểm tra kiến thức/ }));
    // The Teacher screen is a lazy module: its first import is slow when the whole suite runs.
    expect(
      await screen.findByRole('heading', { name: 'Dạy học bằng AI' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows the three Science Card confidence levels', () => {
    render(<Inspector />);
    const inspector = screen.getByRole('complementary', { name: 'Bảng thuộc tính' });
    expect(within(inspector).getByText('Định lượng chính xác')).toBeInTheDocument();
    expect(within(inspector).getByText('Định lượng gần đúng')).toBeInTheDocument();
    expect(within(inspector).getByText('Định tính / minh họa')).toBeInTheDocument();
  });

  it('switching subject changes the library', async () => {
    const user = userEvent.setup();
    renderInLab();
    const library = screen.getByRole('complementary', { name: 'Thư viện chủ đề' });
    expect(within(library).getByText('Ném xiên')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hóa học' }));
    expect(within(library).queryByText('Ném xiên')).not.toBeInTheDocument();
    expect(within(library).getByText('Bảng tuần hoàn')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Đổi giao diện sáng / tối' }));
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
    expect(
      screen.queryByRole('complementary', { name: 'Thư viện chủ đề' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
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
    render(<Timeline />);
    expect(screen.getByRole('button', { name: 'Chạy (Space)' })).toBeDisabled();
  });

  it('a subject card selects the subject and shows its topics in the library', async () => {
    const user = userEvent.setup();
    renderInLab();
    await user.click(screen.getByRole('button', { name: /^Sinh học/ }));
    expect(screen.getByRole('radio', { name: 'Sinh học' })).toHaveAttribute('aria-checked', 'true');
    const library = screen.getByRole('complementary', { name: 'Thư viện chủ đề' });
    expect(within(library).getByText('Nguyên phân')).toBeInTheDocument();
  });
});
