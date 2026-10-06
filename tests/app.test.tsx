import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { Inspector } from '@/app/layout/Inspector';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { Timeline } from '@/app/layout/Timeline';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';

describe('App shell (Phase 0)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ ...DEFAULT_SETTINGS, theme: 'light' });
      useLayoutStore.getState().resetLayout();
      useLayoutStore.getState().setPresentation(false);
      useWorkspaceStore.setState({ subject: 'physics', problemText: '' });
    });
  });

  it('starts on the home screen; the simulation regions appear with a topic (A4.2)', () => {
    render(<App />);
    expect(screen.getByRole('radiogroup', { name: 'Môn học' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nhập đề bài hoặc câu hỏi…' })).toBeInTheDocument();
    expect(screen.getByText('Dạy học bằng AI')).toBeInTheDocument();
    // Nothing open yet: no stage, timeline, inspector or graphs.
    expect(screen.queryByRole('region', { name: 'Khung mô phỏng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Điều khiển thời gian' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Bảng thuộc tính' }),
    ).not.toBeInTheDocument();
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
    render(<App />);
    const library = screen.getByRole('complementary', { name: 'Thư viện chủ đề' });
    expect(within(library).getByText('Ném xiên')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hóa học' }));
    expect(within(library).queryByText('Ném xiên')).not.toBeInTheDocument();
    expect(within(library).getByText('Bảng tuần hoàn')).toBeInTheDocument();
  });

  it('library search ignores diacritics', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('searchbox'), 'con lac');
    expect(screen.getByText('Con lắc đơn')).toBeInTheDocument();
    expect(screen.queryByText('Rơi tự do')).not.toBeInTheDocument();
  });

  it('theme toggle switches <html data-theme>', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Đổi giao diện sáng / tối' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('Ctrl+B hides and shows the library', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{Control>}b{/Control}');
    expect(
      screen.queryByRole('complementary', { name: 'Thư viện chủ đề' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Control>}b{/Control}');
    expect(screen.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeInTheDocument();
  });

  it('F5 enters presentation mode (side panels hidden) and Esc leaves it', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('radio', { name: 'Physics' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('Space on a focused subject button selects it (not Play/Pause)', async () => {
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole('radio', { name: 'Sinh học' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Sinh học' })).toHaveAttribute('aria-checked', 'true');
  });

  it('app shortcuts are ignored while the Settings dialog is open', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
    await user.keyboard('{Control>}b{/Control}');
    expect(useLayoutStore.getState().leftOpen).toBe(true);
  });

  it('play controls stay disabled until a simulation exists', () => {
    render(<Timeline />);
    expect(screen.getByRole('button', { name: 'Chạy (Space)' })).toBeDisabled();
  });

  it('a subject card selects the subject and shows its topics in the library', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Sinh học/ }));
    expect(screen.getByRole('radio', { name: 'Sinh học' })).toHaveAttribute('aria-checked', 'true');
    const library = screen.getByRole('complementary', { name: 'Thư viện chủ đề' });
    expect(within(library).getByText('Nguyên phân')).toBeInTheDocument();
  });
});
