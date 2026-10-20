import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { useBoardStore } from '@/teacher/board/boardStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useTeacherStore } from '@/teacher/teacherStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';

/**
 * The chat side of "Khoanh để hỏi" (item 2): a question about what the learner circled carries
 * it (the chip above the box, the board's "Hỏi thầy chỗ này"), is answered in the chat and aloud
 * as an aside (the board keeps its lesson), and "Viết tiếp" stays with the lesson's answer.
 */
const speech = vi.hoisted(() => ({ spoken: [] as string[] }));
vi.mock('@/teacher/voice/speak', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/teacher/voice/speak')>();
  return {
    ...real,
    speak: (text: string) => {
      speech.spoken.push(text);
      return Promise.resolve();
    },
    stopSpeaking: () => undefined,
  };
});
const asked = vi.hoisted(() => ({ options: [] as Record<string, unknown>[] }));
vi.mock('./chatService', async (importOriginal) => {
  const real = await importOriginal<typeof import('./chatService')>();
  return {
    ...real,
    askTeacher: (...args: Parameters<typeof real.askTeacher>) => {
      asked.options.push(args[3]);
      return real.askTeacher(...args);
    },
  };
});

const { ChatPanel } = await import('./ChatPanel');
const { useChatStore } = await import('./chatStore');

const FORMULA = 's = \\frac{1}{2} g t^2';
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
      text: FORMULA,
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

let calls: ChatRequest[];
let replies: { content: string; truncated?: boolean }[];
const fake: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    const next = replies.shift() ?? { content: 'Đây là quãng đường vật rơi.' };
    return Promise.resolve({ model: 'gemini-test', durationMs: 1, ...next });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

async function settled() {
  await waitFor(() => {
    expect(useChatStore.getState().answering).toBe(false);
  });
}

describe('asking about what was circled on the board', () => {
  beforeEach(() => {
    calls = [];
    replies = [];
    asked.options.length = 0;
    speech.spoken.length = 0;
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
    useVoiceStore.setState({ enabled: true, speaking: false });
    useTeacherStore.setState({ open: true, layout: 'board' });
    useBoardStore.setState({ selection: SELECTION, status: 'paused', pausedForAsk: true });
  });
  afterEach(() => {
    setTransportForTests(null);
    useVoiceStore.setState({ enabled: false });
    useTeacherStore.setState({ open: false, layout: 'talk' });
    useBoardStore.setState({ selection: null, status: 'idle', pausedForAsk: false });
  });

  it('the chip carries the selection: an aside answer, read in the chat, never a board lesson', async () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(view.getByText('Hỏi về: «s = 1/2 g t²»')).toBeInTheDocument();
    await waitFor(() => {
      expect(view.container).toHaveTextContent('kèm phần chữ em khoanh trên bảng');
    });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Vì sao có 1/2?{Enter}');
    await settled();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).toContain('<board_selection>');
    expect(calls[0]?.system).toContain(FORMULA);
    expect(calls[0]?.system).not.toContain('CHẾ ĐỘ BẢNG TRẮNG');
    const [question, answer] = useChatStore.getState().messages;
    expect(question).toMatchObject({
      role: 'user',
      content: 'Vì sao có 1/2?',
      boardRef: { face: 0, ids: ['f1'], excerpt: `$${FORMULA}$` },
    });
    expect(question?.prompt).toBeUndefined();
    expect(answer).toMatchObject({ role: 'assistant', mode: 'aside' });
    // Not taught on the board: the chat reads it aloud (the lesson waits, paused).
    expect(speech.spoken).toEqual(['Đây là quãng đường vật rơi.']);
    // The question shows what it was about.
    expect(view.container).toHaveTextContent('Về chỗ em khoanh');
    // The selection stays until the learner lets it go.
    expect(useBoardStore.getState().selection).not.toBeNull();
  });

  it('"Hỏi thầy chỗ này" with an empty box sends the default question, once (StrictMode)', async () => {
    render(
      <StrictMode>
        <ChatPanel teacherPage showScreenContext={false} />
      </StrictMode>,
    );
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await settled();
    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
    expect(calls).toHaveLength(1);
    expect(useChatStore.getState().messages[0]).toMatchObject({
      content: 'Thầy giải thích giúp em chỗ em vừa khoanh với ạ.',
      boardRef: { ids: ['f1'] },
    });
  });

  it('quick buttons say they are quick buttons, with or without a selection', async () => {
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Rơi tự do là gì?' },
        {
          id: 'a',
          role: 'assistant',
          content: 'Là chuyển động chỉ chịu trọng lực.',
          mode: 'board',
        },
      ],
    });
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    fireEvent.click(view.getByRole('button', { name: 'Em chưa hiểu chỗ này' }));
    await settled();
    expect(asked.options[0]).toMatchObject({ quickAction: true });
    expect(asked.options[0]?.boardSelection).toMatchObject({ selection: { hits: [{ id: 'f1' }] } });
    // Without a selection: still a quick button, now a request about the lesson.
    act(() => {
      useBoardStore.setState({ selection: null });
    });
    fireEvent.click(view.getByRole('button', { name: 'Em chưa hiểu chỗ này' }));
    await settled();
    await waitFor(() => {
      expect(asked.options).toHaveLength(2);
    });
    expect(asked.options[1]).toMatchObject({ quickAction: true, board: true });
    expect(asked.options[1]?.boardSelection).toBeUndefined();
    // A typed question is never a quick button, whatever it says.
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Chậm hơn{Enter}');
    await settled();
    await waitFor(() => {
      expect(asked.options).toHaveLength(3);
    });
    expect(asked.options[2]).toMatchObject({ quickAction: false });
  });

  it('"Viết tiếp" stays with the lesson’s answer after a question about the board', async () => {
    useChatStore.setState({
      messages: [
        { id: 'q', role: 'user', content: 'Giải bài rơi tự do' },
        {
          id: 'lesson',
          role: 'assistant',
          content: '# Rơi tự do\n1. Chọn chiều dương',
          mode: 'board',
          truncated: true,
          unverifiedNumbers: [],
        },
        {
          id: 'q2',
          role: 'user',
          content: 'Chỗ này là gì?',
          boardRef: { face: 0, ids: ['f1'], excerpt: `$${FORMULA}$` },
        },
        { id: 'aside', role: 'assistant', content: 'Đây là công thức.', mode: 'aside' },
      ],
    });
    replies = [{ content: '2. Viết công thức quãng đường.' }];
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    fireEvent.click(view.getByRole('button', { name: 'Viết tiếp' }));
    await settled();
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    // The rest of the lesson: asked with the lesson's history only, as a board lesson.
    expect(calls[0]?.messages.map((m) => m.content).join('\n')).not.toContain('Đây là công thức.');
    expect(calls[0]?.system).toContain('CHẾ ĐỘ BẢNG TRẮNG');
    const lesson = useChatStore.getState().messages.find((m) => m.id === 'lesson');
    expect(lesson?.content).toContain('2. Viết công thức quãng đường.');
    expect(useChatStore.getState().messages.find((m) => m.id === 'aside')?.content).toBe(
      'Đây là công thức.',
    );
  });

  it('the chip can be taken off; a picture for an AI that cannot read it is never offered', () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    fireEvent.click(view.getByRole('button', { name: 'Bỏ chỗ đã khoanh' }));
    expect(useBoardStore.getState().selection).toBeNull();
    expect(view.queryByText(/Hỏi về:/u)).toBeNull();
    act(() => {
      useBoardStore.setState({
        selection: { ...SELECTION, status: 'picture', hits: [], strokes: 1 },
      });
    });
    expect(view.queryByText(/Hỏi về:/u)).toBeNull();
    // Nor in the talk layout.
    act(() => {
      useBoardStore.setState({ selection: SELECTION });
      useTeacherStore.setState({ layout: 'talk' });
    });
    expect(view.queryByText(/Hỏi về:/u)).toBeNull();
  });
});
