import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { translate } from '@/app/i18n';
import { useTeacherStore } from '@/teacher/teacherStore';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

/**
 * The chat panel and the input check: a blocked question is never kept (it would travel as
 * history and be saved), and "Xóa cuộc trò chuyện" stops the answer being written. The online
 * provider is a scripted fake (no real API); an answer may be held until the test releases it.
 */
let calls: ChatRequest[];
let hold: Promise<void> | null;

const fake = (): LlmTransport => ({
  chat: async (req) => {
    calls.push(req);
    if (hold) await hold;
    return { content: 'Lực là đại lượng vectơ.', model: 'gemini-model', durationMs: 1 };
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
});

describe('AI Teacher chat panel: blocked questions and clearing', () => {
  beforeEach(() => {
    calls = [];
    hold = null;
    useAiStore.setState({ provider: 'gemini', fallback: 'off', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      webLookup: false,
      answering: false,
      stopped: false,
    });
    setTransportForTests(fake());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    setTransportForTests(null);
    useTeacherStore.setState({ open: false, layout: 'talk' });
    vi.restoreAllMocks();
  });

  it('a blocked question is not kept, so the next question never carries it', async () => {
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    const box = screen.getByRole('textbox', { name: 'Nhập câu hỏi' });
    const blocked = 'Số điện thoại của em là 0912345678, lực là gì?';
    await user.type(box, `${blocked}{Enter}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      translate('vi', 'chat.errors.personal'),
    );
    expect(calls).toHaveLength(0);
    expect(useChatStore.getState().messages).toEqual([]);
    // It stays in the box, so the learner can take the personal data out.
    expect(box).toHaveValue(blocked);

    await user.clear(box);
    await user.type(box, 'Gia tốc là gì?{Enter}');
    expect(await screen.findByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    const sent = calls[0]?.messages.map((m) => m.content).join(' ') ?? '';
    expect(sent).not.toContain('0912345678');
    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual([
      'Gia tốc là gì?',
      'Lực là đại lượng vectơ.',
    ]);
  });

  it('"Xóa cuộc trò chuyện" while an answer is written stops it: nothing comes back', async () => {
    let release: () => void = () => undefined;
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    await user.click(screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' }));
    release();
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
    // Let the held answer settle: it must not land in the new, empty conversation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().stopped).toBe(false);
    expect(screen.queryByText('Lực là đại lượng vectơ.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
