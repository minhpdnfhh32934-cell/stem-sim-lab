import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest, ChatResponse } from '@/ai/types';
import { useBoardStore } from '@/teacher/board/boardStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';

/**
 * Who reads an answer aloud on the teacher page (item 5): on the board the lesson reads itself,
 * in the talk layout the chat does. The learner may switch layouts while the AI is answering,
 * so this is decided when the answer arrives. Asking a question on the board never stops the
 * voice from the chat: the board pauses its own lesson (Whiteboard) and reads the cut sentence
 * again on "Tiếp tục". The voice is a fake that records what it was asked to do.
 */
const speech = vi.hoisted(() => ({ spoken: [] as string[], stops: 0 }));
vi.mock('@/teacher/voice/speak', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/teacher/voice/speak')>();
  return {
    ...real,
    speak: (text: string) => {
      speech.spoken.push(text);
      return Promise.resolve();
    },
    stopSpeaking: () => {
      speech.stops += 1;
    },
  };
});

const { ChatPanel } = await import('./ChatPanel');
const { useChatStore } = await import('./chatStore');

let calls: ChatRequest[];
let pending: ((reply: Partial<ChatResponse>) => void)[];

/** An AI that answers only when the test says so. */
const slow: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    return new Promise<ChatResponse>((resolve) => {
      pending.push((reply) => {
        resolve({ content: 'Trả lời', model: 'gemini-model', durationMs: 1, ...reply });
      });
    });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

async function ask(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), `${text}{Enter}`);
  await waitFor(() => {
    expect(calls).toHaveLength(1);
  });
}

async function answer(content: string) {
  await act(async () => {
    pending.shift()?.({ content });
    await Promise.resolve();
  });
}

describe('teacher page: who reads the answer aloud', () => {
  beforeEach(() => {
    calls = [];
    pending = [];
    setTransportForTests(slow);
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      answering: false,
    });
    useVoiceStore.setState({ enabled: true, speaking: false });
    useTeacherStore.setState({ open: true, layout: 'board' });
    speech.spoken.length = 0;
    speech.stops = 0;
  });
  afterEach(() => {
    setTransportForTests(null);
    useVoiceStore.setState({ enabled: false });
    useTeacherStore.setState({ open: false, layout: 'talk' });
    useBoardStore.setState({ status: 'idle' });
  });

  it('asked on the board, answered after switching to "Trò chuyện": the chat reads it once', async () => {
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await ask('Rơi tự do là gì?');
    act(() => {
      useTeacherStore.setState({ layout: 'talk' });
    });
    await answer('Là chuyển động chỉ dưới tác dụng của trọng lực.');
    await waitFor(() => {
      expect(speech.spoken).toEqual(['Là chuyển động chỉ dưới tác dụng của trọng lực.']);
    });
    // The board was asked for a board lesson: the layout when the question was sent.
    expect(calls[0]?.system).toContain('CHẾ ĐỘ BẢNG TRẮNG');
  });

  it('asked in "Trò chuyện", answered after switching to the board: only the board reads it', async () => {
    useTeacherStore.setState({ layout: 'talk' });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await ask('Rơi tự do là gì?');
    act(() => {
      useTeacherStore.setState({ layout: 'board' });
    });
    await answer('Là chuyển động chỉ dưới tác dụng của trọng lực.');
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
    expect(speech.spoken).toEqual([]);
  });

  it('a question asked during a board lesson leaves the board’s voice to the board', async () => {
    useBoardStore.setState({ status: 'playing' });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await ask('Vì sao?');
    expect(speech.stops).toBe(0);
    await answer('Vì vậy.');
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
  });

  it('without a board lesson speaking, asking stops whatever is being read (both layouts)', async () => {
    for (const layout of ['board', 'talk'] as const) {
      calls = [];
      speech.stops = 0;
      useBoardStore.setState({ status: layout === 'board' ? 'done' : 'playing' });
      useTeacherStore.setState({ layout });
      const view = render(<ChatPanel teacherPage showScreenContext={false} />);
      await ask('Còn gì nữa?');
      expect(speech.stops).toBe(1);
      await answer('Hết.');
      await waitFor(() => {
        expect(useChatStore.getState().answering).toBe(false);
      });
      view.unmount();
    }
  });
});
