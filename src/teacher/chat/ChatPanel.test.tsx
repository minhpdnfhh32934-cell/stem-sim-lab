import { render, screen, waitFor } from '@testing-library/react';
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
});
