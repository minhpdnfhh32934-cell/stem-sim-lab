import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError, type ChatRequest, type ChatResponse } from '@/ai/types';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useTeacherStore } from '@/teacher/teacherStore';
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
    useTeacherStore.setState({ open: false, layout: 'talk' });
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

  it('the "sent to" line names the quota fallback only when it can be asked', async () => {
    useAiStore.setState({ fallback: 'groq' });
    let keys = ['gemini', 'groq'];
    const hasKey = vi.fn((p: string) => Promise.resolve(keys.includes(p)));
    setTransportForTests({ ...fake(), hasKey });
    const line = (text: RegExp) => screen.findByText(text);
    // Think off and Groq has a key: a question may go to Groq while Gemini is out of quota.
    let view = render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(
      await line(
        /sẽ được gửi tới: Gemini \(khuyên dùng\), Groq \(dự phòng khi Gemini hết lượt\)\.$/,
      ),
    ).toBeInTheDocument();
    view.unmount();
    // Think on: every call is sent without the fallback; the reviewer is named instead.
    useChatStore.setState({ thinkEnabled: true });
    view = render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(
      await line(/sẽ được gửi tới: Gemini \(khuyên dùng\), Groq \(miễn phí\) \(rà soát\)\.$/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dự phòng khi/)).not.toBeInTheDocument();
    view.unmount();
    // No key for Groq: the fallback is never asked, so it is not named.
    useChatStore.setState({ thinkEnabled: false });
    keys = ['gemini'];
    hasKey.mockClear();
    view = render(<ChatPanel teacherPage showScreenContext={false} />);
    // Its key was looked up and the answer has landed (the line is not read before that).
    await waitFor(() => {
      expect(hasKey).toHaveBeenCalledWith('groq');
    });
    await act(() => Promise.resolve());
    expect(screen.getByText(/sẽ được gửi tới: Gemini \(khuyên dùng\)\.$/)).toBeInTheDocument();
    view.unmount();
    // The fallback switched off in Settings.
    keys = ['gemini', 'groq'];
    useAiStore.setState({ fallback: 'off' });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(await line(/sẽ được gửi tới: Gemini \(khuyên dùng\)\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/dự phòng khi/)).not.toBeInTheDocument();
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
    // Think off and an answer that was not reviewed: the fallback stays available.
    expect(calls[0]?.noFallback).toBeUndefined();
  });

  it.each([
    ['Think on, a reviewed answer', true, true],
    ['Think on, an answer from before Think', true, false],
    ['Think off, a reviewed answer', false, true],
  ])(
    '"Viết tiếp" (%s) is never sent to the quota fallback',
    async (_case, thinkEnabled, reviewed) => {
      useAiStore.setState({ fallback: 'groq' });
      useChatStore.setState({
        messages: [
          { id: 'q', role: 'user', content: 'Giải chi tiết' },
          {
            id: 'a',
            role: 'assistant',
            content: 'Bước 1: đặt trục.',
            model: 'gemini-model',
            ...(reviewed ? { checkedBy: 'claude · claude-model' } : {}),
            truncated: true,
          },
        ],
        thinkEnabled,
        verifierProvider: 'claude',
      });
      replies = [{ content: 'Bước 2.' }];
      setTransportForTests(fake());
      const user = userEvent.setup();
      render(<ChatPanel teacherPage showScreenContext={false} />);
      await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
      await waitFor(() => {
        expect(useChatStore.getState().messages[1]?.content).toBe('Bước 1: đặt trục. Bước 2.');
      });
      // One request, to the answering provider, without the fallback (Settings → "Dữ liệu của em
      // đi đâu?": with Think nothing goes to the fallback).
      expect(calls.map((c) => [c.provider, c.noFallback])).toEqual([['gemini', true]]);
    },
  );

  it('the board layout streams the lesson as readable text, never its tags or LaTeX', async () => {
    useTeacherStore.setState({ open: true, layout: 'board' });
    const lesson = String.raw`Hôm nay mình xét bài <write id="t1" zone="title" role="heading">Định luật II Newton</write> nhé. <write id="f1" zone="steps" math="true">a = \frac{F}{m}</write><circle target="f1"/>`;
    let finish: (r: ChatResponse) => void = () => undefined;
    let push: (shown: string) => void = () => undefined;
    stream = (_req, onText) => {
      push = onText;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    setTransportForTests(fake());
    await askInPanel('Định luật II là gì?');
    const container = document.body;
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.system).toContain('TeachScript');
    push(lesson);
    const bubble = await waitFor(() => {
      const node = container.querySelector('.chat-message--streaming');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(bubble).toHaveTextContent('Hôm nay mình xét bài Định luật II Newton nhé.');
    expect(bubble).toHaveTextContent('a = F/m');
    expect(bubble.textContent).not.toMatch(/<write|\\frac|zone=|<circle/);
    // A write still being written stays out until it is whole.
    push(`${lesson} Thay số, <write id="r1" zone="steps" math="true">a = \\frac{10`);
    await waitFor(() => {
      expect(bubble.textContent).toContain('Thay số,');
    });
    expect(bubble.textContent).not.toMatch(/\\frac|frac|<write/);
    finish({ content: lesson, model: 'gemini-model', durationMs: 1 });
    await waitFor(() => {
      expect(container.querySelector('.chat-message--streaming')).toBeNull();
    });
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
    // Gemini did get the question here (text was already shown): the sentence never says it did
    // not; it says what is true either way.
    expect(alert).toHaveTextContent(/^Gemini chưa trả lời được vì kết nối mạng bị gián đoạn/);
    expect(alert.textContent).not.toMatch(/chưa nhận được câu hỏi|chưa được gửi/);
    expect(within(alert).getByRole('button', { name: /Hỏi lại/ })).toBeInTheDocument();
    expect(screen.queryByText('Lực là đại lượng')).not.toBeInTheDocument();
    // Nothing of it is stored, read aloud or taught on the board.
    expect(useChatStore.getState().messages.map((m) => m.role)).toEqual(['user']);
    expect(calls).toHaveLength(1);
  });
});
