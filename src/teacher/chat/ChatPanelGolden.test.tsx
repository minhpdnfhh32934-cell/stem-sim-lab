import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest, ChatResponse } from '@/ai/types';
import { useBoardStore } from '@/teacher/board/boardStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useTeacherStore } from '@/teacher/teacherStore';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

/**
 * Golden requests: what the chat panel sends to the model for each way of asking (a starter, a
 * typed question, "Viết tiếp", a quick button, a question about the circled board), byte for
 * byte. Refactors of ChatPanel.tsx must leave this file untouched.
 */
let calls: ChatRequest[];
let replies: Partial<ChatResponse>[];
const fake: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    const next = replies.shift() ?? {};
    return Promise.resolve({ content: 'Trả lời.', model: 'gemini-test', durationMs: 1, ...next });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

const SELECTION: BoardSelection = {
  face: 0,
  shape: 'closed',
  status: 'ok',
  points: [],
  bbox: { x: 340, y: 200, w: 300, h: 60 },
  hits: [
    {
      id: 'f1',
      kind: 'text',
      column: 'center',
      role: 'body',
      text: 's = \\frac{1}{2} g t^2',
      math: true,
      whole: true,
      status: null,
      struck: false,
      coverage: 1,
      boxes: [{ x: 340, y: 200, w: 300, h: 60 }],
      x: 340,
      y: 200,
      index: 2,
    },
  ],
  title: 'Rơi tự do',
  neighbours: [],
  strokes: 0,
  figures: [],
};

async function asked(n: number) {
  await waitFor(() => {
    expect(calls).toHaveLength(n);
    expect(useChatStore.getState().answering).toBe(false);
  });
}

function dump(): string {
  return `${JSON.stringify(
    calls.map(({ requestId: _id, ...rest }) => rest),
    null,
    2,
  )}\n`;
}

describe('golden requests from the chat panel', () => {
  beforeEach(() => {
    calls = [];
    replies = [];
    setTransportForTests(fake);
    useAiStore.setState({ provider: 'gemini', status: 'ok', fallback: 'off' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      answering: false,
      webLookup: false,
    });
  });
  afterEach(() => {
    setTransportForTests(null);
    useTeacherStore.setState({ open: false, layout: 'talk' });
    useBoardStore.setState({ selection: null, status: 'idle', pausedForAsk: false });
  });

  it('talk: a starter, a typed question, "Viết tiếp" and a quick button', async () => {
    const user = userEvent.setup();
    replies = [{}, { content: 'Bước 1: đặt trục.', truncated: true }, { content: 'Bước 2.' }];
    render(<ChatPanel teacherPage showScreenContext={false} />);
    const starter = screen.getAllByRole('button').find((b) => b.closest('.chat-panel__starters'));
    if (!starter) throw new Error('no starter button');
    await user.click(starter);
    await asked(1);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Giải chi tiết{Enter}');
    await asked(2);
    await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
    await asked(3);
    await user.click(screen.getByRole('button', { name: 'Chậm hơn' }));
    await asked(4);
    await expect(dump()).toMatchFileSnapshot('__golden__/chatPanel.talk.txt');
  });

  it('board: a question and a quick button about the circled part', async () => {
    useTeacherStore.setState({ open: true, layout: 'board' });
    useBoardStore.setState({ selection: SELECTION, status: 'paused', pausedForAsk: true });
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Rơi tự do là gì?' },
        { id: 'a', role: 'assistant', content: 'Là chuyển động chỉ dưới tác dụng của trọng lực.' },
      ],
    });
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Vì sao có 1/2?{Enter}');
    await asked(1);
    await user.click(screen.getByRole('button', { name: 'Gợi ý từng bước' }));
    await asked(2);
    await expect(dump()).toMatchFileSnapshot('__golden__/chatPanel.board.txt');
  });
});
