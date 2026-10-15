import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError, type ChatRequest, type ChatResponse } from '@/ai/types';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

/**
 * The chat panel with an online provider (a scripted fake, no real API): failures in the
 * learner's words, the fallback label, "Viết tiếp" on a reviewed answer, and a streamed answer.
 */
let calls: ChatRequest[];
let replies: (Partial<ChatResponse> | AiError)[];
let stream: ((req: ChatRequest, onText: (shown: string) => void) => Promise<ChatResponse>) | null;

const fake = (): LlmTransport => ({
  chat: (req) => {
    calls.push(req);
    const next = replies.shift() ?? {};
    if (next instanceof AiError) return Promise.reject(next);
    return Promise.resolve({ content: 'Trả lời', model: 'gemini-model', durationMs: 1, ...next });
  },
  ...(stream
    ? {
        chatStream: (req: ChatRequest, onText: (shown: string) => void) => {
          calls.push(req);
          if (!stream) throw new Error('no stream');
          return stream(req, onText);
        },
      }
    : {}),
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
});

async function askInPanel(question: string) {
  const user = userEvent.setup();
  render(<ChatPanel teacherPage showScreenContext={false} />);
  await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), `${question}{Enter}`);
  return user;
}

describe('AI Teacher chat panel with an online provider', () => {
  beforeEach(() => {
    calls = [];
    replies = [];
    stream = null;
    useAiStore.setState({ provider: 'gemini', fallback: 'off', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      webLookup: false,
      answering: false,
      verifierProvider: 'groq',
    });
    useWorkspaceStore.setState({ settingsOpen: false, settingsSection: 'appearance' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    setTransportForTests(null);
    vi.restoreAllMocks();
  });

  it('the day’s limit is explained in the learner’s words, with the Settings page', async () => {
    replies = [new AiError('dailyLimit', '100/100')];
    setTransportForTests(fake());
    const user = await askInPanel('Lực là gì?');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/số lượt AI tối đa mỗi ngày/);
    expect(alert).not.toHaveTextContent('100/100');
    // Asking again cannot help today: no "Hỏi lại", but the page that can.
    expect(within(alert).queryByRole('button', { name: /Hỏi lại/ })).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /Cài đặt/ }));
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'ai',
    });
  });

  it('a quota error shows no machine text; "Hỏi lại" asks once more, on the learner’s click', async () => {
    replies = [
      new AiError('http', '429 Too Many Requests: {"error":{"status":"RESOURCE_EXHAUSTED"}}'),
      { content: 'Lực là đại lượng vectơ.' },
    ];
    setTransportForTests(fake());
    const user = await askInPanel('Lực là gì?');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Gemini báo đã hết lượt dùng/);
    expect(alert.textContent).not.toMatch(/[{}]|429|RESOURCE_EXHAUSTED/);
    expect(calls).toHaveLength(1);
    await user.click(within(alert).getByRole('button', { name: /Hỏi lại/ }));
    expect(await screen.findByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
    // The failed question was taken back and asked once: it is not shown twice.
    expect(useChatStore.getState().messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('a fallback answer is labelled "dự phòng" with the provider that wrote it', async () => {
    useAiStore.setState({ fallback: 'groq' });
    replies = [{ content: 'Lực là vectơ.', provider: 'groq', fallback: true, model: 'qwen-t' }];
    setTransportForTests(fake());
    await askInPanel('Lực là gì?');
    expect(await screen.findByText('Lực là vectơ.')).toBeInTheDocument();
    expect(screen.getByText(/mô hình Groq · qwen-t · dự phòng/)).toBeInTheDocument();
    expect(useChatStore.getState().messages[1]).toMatchObject({
      fallback: true,
      model: 'Groq · qwen-t',
    });
  });

  it('an ordinary answer has no "dự phòng" label', async () => {
    setTransportForTests(fake());
    await askInPanel('Lực là gì?');
    expect(await screen.findByText('Trả lời')).toBeInTheDocument();
    expect(screen.queryByText(/dự phòng/)).not.toBeInTheDocument();
    expect(useChatStore.getState().messages[1]?.fallback).toBeUndefined();
  });

  it('"Viết tiếp" on a reviewed answer says the continued part was not reviewed', async () => {
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Giải chi tiết' },
        {
          id: 'a',
          role: 'assistant',
          content: 'Bước 1: đặt trục.',
          model: 'gemini-model',
          checkedBy: 'groq · groq-model',
          truncated: true,
        },
      ],
      thinkEnabled: true,
    });
    replies = [{ content: 'Bước 2: viết phương trình.' }];
    setTransportForTests(fake());
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.queryByText('Phần viết tiếp chưa được rà soát.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
    expect(await screen.findByText('Phần viết tiếp chưa được rà soát.')).toBeInTheDocument();
    // The continuation is written without a review (one request, to the answering provider).
    expect(calls.map((c) => c.provider)).toEqual(['gemini']);
    const message = useChatStore.getState().messages[1];
    expect(message).toMatchObject({
      continuedUnreviewed: true,
      checkedBy: 'groq · groq-model',
      content: 'Bước 1: đặt trục. Bước 2: viết phương trình.',
    });
  });

  it('"Viết tiếp" written by the fallback names both models and keeps the "dự phòng" mark', async () => {
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Giải chi tiết' },
        {
          id: 'a',
          role: 'assistant',
          content: 'Bước 1: đặt trục.',
          model: 'gemini-model',
          truncated: true,
        },
      ],
    });
    replies = [{ content: 'Bước 2.', provider: 'groq', fallback: true, model: 'qwen-t' }];
    setTransportForTests(fake());
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
    await waitFor(() => {
      expect(useChatStore.getState().messages[1]).toMatchObject({
        model: 'gemini-model + Groq · qwen-t',
        fallback: true,
      });
    });
    expect(useChatStore.getState().messages[1]?.continuedUnreviewed).toBeUndefined();
  });

  it('a streamed answer shows while it is written; an unsafe piece takes it back', async () => {
    let finish: (r: ChatResponse) => void = () => undefined;
    let push: (shown: string) => void = () => undefined;
    stream = (_req, onText) => {
      push = onText;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    setTransportForTests(fake());
    await askInPanel('Lực là gì?');
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    push('Lực là đại');
    expect(await screen.findByText('Lực là đại')).toBeInTheDocument();
    // Provisional: a reset replaces it.
    push('Lực là');
    await waitFor(() => {
      expect(screen.queryByText('Lực là đại')).not.toBeInTheDocument();
    });
    push('Lực là gọi số 0912345678');
    await waitFor(() => {
      expect(screen.queryByText(/0912345678/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Lực là')).not.toBeInTheDocument();
    finish({ content: 'Lực là gọi số 0912345678', model: 'gemini-model', durationMs: 1 });
    expect(await screen.findByRole('alert')).toHaveTextContent(/bộ lọc an toàn/);
    expect(useChatStore.getState().messages.map((m) => m.role)).toEqual(['user']);
  });

  it('a stream that breaks off: the partial text is not kept, the failure says what to do', async () => {
    stream = (_req, onText) => {
      onText('Lực là đại lượng');
      return Promise.reject(new AiError('network', 'connection reset'));
    };
    setTransportForTests(fake());
    await askInPanel('Lực là gì?');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Gemini chưa nhận được câu hỏi vì mạng/);
    expect(within(alert).getByRole('button', { name: /Hỏi lại/ })).toBeInTheDocument();
    expect(screen.queryByText('Lực là đại lượng')).not.toBeInTheDocument();
    // Nothing of it is stored, read aloud or taught on the board.
    expect(useChatStore.getState().messages.map((m) => m.role)).toEqual(['user']);
    expect(calls).toHaveLength(1);
  });
});
