import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('voice list that loads late (Chromium/WebView2: [] until "voiceschanged")', () => {
    const voice = (lang: string) => ({
      name: lang,
      lang,
      voiceURI: lang,
      localService: true,
      default: false,
    });
    let voices: ReturnType<typeof voice>[];
    let listeners: (() => void)[];
    const toastText = () =>
      useToastStore
        .getState()
        .toasts.map((t) => t.text)
        .join(' ');
    const loadVoices = (list: ReturnType<typeof voice>[]) => {
      voices = list;
      act(() => {
        for (const listener of listeners) listener();
      });
    };

    beforeEach(() => {
      voices = [];
      listeners = [];
      vi.stubGlobal('speechSynthesis', {
        getVoices: () => voices,
        addEventListener: (type: string, listener: () => void) => {
          if (type === 'voiceschanged') listeners.push(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          listeners = listeners.filter((l) => l !== listener);
        },
        cancel: () => undefined,
        speak: () => undefined,
      });
      useVoiceStore.setState({ enabled: false, engine: 'system' });
      useToastStore.setState({ toasts: [] });
      act(() => {
        openTeacher();
      });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      useVoiceStore.setState({ enabled: false });
    });

    it('no warning when the list then brings a Vietnamese voice', async () => {
      const user = userEvent.setup();
      render(<TeacherScreen />);
      await user.click(screen.getByRole('button', { name: 'Thầy đọc to câu trả lời' }));
      expect(useVoiceStore.getState().enabled).toBe(true);
      expect(toastText()).not.toContain('chưa có giọng đọc tiếng Việt');
      loadVoices([voice('en-US'), voice('vi-VN')]);
      await act(async () => {
        await Promise.resolve();
      });
      expect(toastText()).not.toContain('chưa có giọng đọc tiếng Việt');
    });

    it('warns once the list arrives without a Vietnamese voice', async () => {
      const user = userEvent.setup();
      render(<TeacherScreen />);
      await user.click(screen.getByRole('button', { name: 'Thầy đọc to câu trả lời' }));
      expect(toastText()).not.toContain('chưa có giọng đọc tiếng Việt');
      loadVoices([voice('en-US')]);
      await waitFor(() => {
        expect(toastText()).toContain('chưa có giọng đọc tiếng Việt');
      });
    });

    it('warns when the list is still empty after a short wait', async () => {
      vi.useFakeTimers();
      render(<TeacherScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Thầy đọc to câu trả lời' }));
      expect(toastText()).not.toContain('chưa có giọng đọc tiếng Việt');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(toastText()).toContain('chưa có giọng đọc tiếng Việt');
    });
  });
});
