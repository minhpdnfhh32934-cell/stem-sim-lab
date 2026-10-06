import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { goHome, openTopic } from '@/app/topics';
import { useAiStore } from '@/ai/aiStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import TeacherScreen from './screen/TeacherScreen';
import { closeTeacher, openTeacher, useTeacherStore } from './teacherStore';

describe('"Dạy học bằng AI" route (T0 sketch)', () => {
  beforeEach(() => {
    closeTeacher();
    useAiStore.setState({ status: 'ok' });
  });

  it('opening a topic or going home leaves the teacher screen', async () => {
    openTeacher();
    expect(useTeacherStore.getState().open).toBe(true);
    await openTopic('freeFall');
    expect(useTeacherStore.getState().open).toBe(false);
    openTeacher();
    goHome();
    expect(useTeacherStore.getState().open).toBe(false);
  });

  it('is clearly labelled as a sketch and as an AI; controls do nothing yet', () => {
    openTeacher();
    render(<TeacherScreen />);
    expect(screen.getByText('Bản phác thảo — chưa hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Thầy/cô AI')).toBeInTheDocument();
    const toolbar = screen.getByRole('toolbar', { name: 'Điều khiển buổi học' });
    for (const b of toolbar.querySelectorAll('button')) {
      expect(b).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByRole('button', { name: 'Giơ tay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Em chưa hiểu chỗ này' })).toBeInTheDocument();
  });

  it('previews both layouts: ring in the centre, then ring + whiteboard', async () => {
    const user = userEvent.setup();
    openTeacher();
    const { container } = render(<TeacherScreen />);
    const root = container.querySelector('.teacher');
    expect(root).toHaveAttribute('data-layout', 'talk');
    expect(screen.getByText('Hôm nay muốn học gì?')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Giảng trên bảng' }));
    expect(root).toHaveAttribute('data-layout', 'board');
    expect(screen.getByRole('img', { name: 'Bảng trắng' })).toBeInTheDocument();
  });

  it('without a key: a friendly invitation that opens "Kết nối AI" (B4.1b)', async () => {
    const user = userEvent.setup();
    useAiStore.setState({ status: 'noKey' });
    useWorkspaceStore.setState({ settingsOpen: false });
    openTeacher();
    render(<TeacherScreen />);
    await user.click(screen.getByRole('button', { name: 'Mở Kết nối AI' }));
    expect(useWorkspaceStore.getState().settingsOpen).toBe(true);
  });

  it('Esc goes back', () => {
    openTeacher();
    render(<TeacherScreen />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(useTeacherStore.getState().open).toBe(false);
  });
});
