import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest, ChatResponse } from '@/ai/types';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

// The AI is a scripted fake: these tests check the chat screen, not a real model.
let calls: ChatRequest[];
let replies: Partial<ChatResponse>[];

const fake: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    const next = replies.shift() ?? {};
    return Promise.resolve({ content: 'Trả lời', model: 'gemini-model', durationMs: 1, ...next });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

describe('AI Teacher chat panel', () => {
  beforeEach(() => {
    calls = [];
    replies = [];
    setTransportForTests(fake);
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      answering: false,
    });
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('quick buttons ("Chậm hơn"…) wait until there is an answer to rework', () => {
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.queryByRole('button', { name: 'Chậm hơn' })).not.toBeInTheDocument();
  });

  it('a quick button shows its short label but sends a full instruction', async () => {
    const user = userEvent.setup();
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Rơi tự do là gì?' },
        { id: 'a', role: 'assistant', content: 'Là chuyển động chỉ dưới tác dụng của trọng lực.' },
      ],
    });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.click(screen.getByRole('button', { name: 'Chậm hơn' }));
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.messages.at(-1)?.content).toMatch(/chia thành nhiều bước nhỏ/);
    const shown = useChatStore.getState().messages[2];
    expect(shown?.content).toBe('Chậm hơn');
    expect(shown?.prompt).toMatch(/chia thành nhiều bước nhỏ/);
  });

  it('a cut answer offers "Viết tiếp", which appends the rest to the same message', async () => {
    const user = userEvent.setup();
    replies = [
      { content: 'Bước 1: đặt trục.', truncated: true },
      { content: 'Bước 2: viết phương trình.' },
    ];
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Giải chi tiết{Enter}');
    expect(await screen.findByText('Câu trả lời dài nên đã dừng giữa chừng.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Viết tiếp' })).not.toBeInTheDocument();
    });
    // The continuation request carries the cut answer, so the model knows where it stopped.
    expect(calls[1]?.messages.some((m) => m.content === 'Bước 1: đặt trục.')).toBe(true);
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1]?.content).toBe('Bước 1: đặt trục. Bước 2: viết phương trình.');
    expect(messages[1]?.truncated).toBe(false);
  });

  it('stores and shows an answer without its hidden reasoning or echoed prompt labels', async () => {
    const user = userEvent.setup();
    replies = [{ content: '<think>thử 7 kg</think>**GHI CHÚ:**\nLực là đại lượng vectơ.' }];
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    expect(await screen.findByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    expect(useChatStore.getState().messages[1]?.content).toBe('Lực là đại lượng vectơ.');
    expect(view.container.textContent).not.toMatch(/thử 7 kg|GHI CHÚ/u);
  });

  it('an older saved Think answer is shown without the reviewer notes or hidden reasoning', () => {
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Lực là gì?' },
        {
          id: 'a',
          role: 'assistant',
          content:
            '<think>nháp riêng</think>Nhận xét về bản nháp: đúng hướng.\n\nBản đã sửa:\nLực là đại lượng vectơ.',
          checkedBy: 'groq · groq-model',
        },
      ],
    });
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.getByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/nháp riêng|Nhận xét về bản nháp|Bản đã sửa/u);
  });

  it('"Xem mô phỏng" follows the latest question, not an older one', () => {
    useChatStore.setState({
      messages: [
        { id: 'q1', role: 'user', content: 'Vì sao NST nhân đôi trước nguyên phân?' },
        { id: 'a1', role: 'assistant', content: 'Để mỗi tế bào con nhận đủ bộ NST.' },
        { id: 'q2', role: 'user', content: 'Lực ma sát nghỉ là gì?' },
        { id: 'a2', role: 'assistant', content: 'Là lực giữ vật đứng yên.' },
      ],
    });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.queryByRole('button', { name: /Xem mô phỏng/ })).not.toBeInTheDocument();
  });

  it('no "Xem mô phỏng" for a question still being answered in another panel', () => {
    // The bubble sent the question, then the learner expanded it: this panel is new (not busy
    // itself) but the answer is still on its way.
    useChatStore.setState({
      answering: true,
      messages: [
        { id: 'q1', role: 'user', content: 'Rơi tự do là gì?' },
        { id: 'a1', role: 'assistant', content: 'Là chuyển động chỉ dưới tác dụng của trọng lực.' },
        { id: 'q2', role: 'user', content: 'Vì sao NST nhân đôi trước nguyên phân?' },
      ],
    });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.queryByRole('button', { name: /Xem mô phỏng/ })).not.toBeInTheDocument();
    act(() => {
      useChatStore.setState({ answering: false });
    });
    expect(screen.getByRole('button', { name: 'Xem mô phỏng: Nguyên phân' })).toBeInTheDocument();
  });
});
