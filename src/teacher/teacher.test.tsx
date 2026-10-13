import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goHome, openTopic } from '@/app/topics';
import { useAiStore } from '@/ai/aiStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useChatStore } from './chat/chatStore';
import { useToastStore } from '@/ui/toast';
import { useVoiceStore } from './voice/voiceStore';
import TeacherScreen from './screen/TeacherScreen';
import { closeTeacher, openTeacher, useTeacherStore } from './teacherStore';

describe('"Dạy học bằng AI" screen', () => {
  beforeEach(() => {
    closeTeacher();
    useAiStore.setState({ status: 'ok' });
    useChatStore.setState({ engine: 'cloud', messages: [] });
    useWorkspaceStore.setState({ settingsOpen: false });
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

  it('is clearly labelled as an AI assistant with a working chat panel', () => {
    openTeacher();
    render(<TeacherScreen />);
    // Honest that it is an AI, never a person.
    expect(screen.getAllByText('AI Teacher').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Trò chuyện với AI Teacher' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nhập câu hỏi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeInTheDocument();
  });

  it('switches between the talk and board layouts', async () => {
    const user = userEvent.setup();
    openTeacher();
    const { container } = render(<TeacherScreen />);
    const root = container.querySelector('.teacher');
    expect(root).toHaveAttribute('data-layout', 'talk');
    expect(
      screen.queryByRole('region', { name: 'Bảng trắng của AI Teacher' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Giảng trên bảng' }));
    expect(root).toHaveAttribute('data-layout', 'board');
    // The board is a real lesson area next to the chat, not only a different background.
    // The board is a lazy chunk (fonts, KaTeX): give the import time when the suite is busy.
    expect(
      await screen.findByRole('region', { name: 'Bảng trắng của AI Teacher' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trò chuyện với AI Teacher' })).toBeInTheDocument();
  });

  it('without a cloud key: a notice that opens Settings (never a fake reply)', async () => {
    const user = userEvent.setup();
    useAiStore.setState({ status: 'noKey' });
    openTeacher();
    render(<TeacherScreen />);
    expect(
      await screen.findByText('Chưa có API. Kết nối API trong Cài đặt hoặc chọn Gemma đã tải về.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
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

  it('Esc that closes a dialog (e.g. Settings) does not also leave the page', () => {
    openTeacher();
    render(
      <>
        <TeacherScreen />
        <dialog open>Cài đặt</dialog>
      </>,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(useTeacherStore.getState().open).toBe(true);
  });

  it('warns when the voice is turned on but the computer has no Vietnamese voice', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [
        {
          name: 'Microsoft David',
          lang: 'en-US',
          voiceURI: 'david',
          localService: true,
          default: true,
        },
      ],
      cancel: () => undefined,
      speak: () => undefined,
    });
    useVoiceStore.setState({ enabled: false, engine: 'system' });
    useToastStore.setState({ toasts: [] });
    act(() => {
      openTeacher();
    });
    render(<TeacherScreen />);
    await user.click(screen.getByRole('button', { name: 'Thầy đọc to câu trả lời' }));
    expect(useVoiceStore.getState().enabled).toBe(true);
    expect(
      useToastStore
        .getState()
        .toasts.map((t) => t.text)
        .join(' '),
    ).toContain('chưa có giọng đọc tiếng Việt');
    vi.unstubAllGlobals();
    useVoiceStore.setState({ enabled: false });
  });
});
