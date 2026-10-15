import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useBoardStore } from '@/teacher/board/boardStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useTeacherStore } from '@/teacher/teacherStore';
import type { ReplyResult } from './chatService';

/**
 * A question about a picture of the circled area (item 2) in the chat panel, with the in-app
 * Gemma that reads pictures: the "sent to" line never names the Think reviewer or Wikipedia for
 * it (nothing about the picture goes online), the answer says it was not reviewed, and a second
 * click while the picture is being made never sends the question twice.
 */
vi.mock('@/app/ai/engineChoice', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/ai/engineChoice')>();
  return {
    ...real,
    analysisEngine: () => Promise.resolve('gemma'),
    useAnalysisEngine: () => 'gemma',
  };
});
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: () => Promise.reject(new Error('not used: askTeacher is stubbed')),
}));
vi.mock('./pictureReader', async (importOriginal) => {
  const real = await importOriginal<typeof import('./pictureReader')>();
  return { ...real, usePictureReader: () => 'gemma', pictureReaderNow: () => 'gemma' };
});
/** The circled area's PNG, made when the test says so. */
const picture = vi.hoisted(() => ({ release: (_: ArrayBuffer | null) => undefined, made: 0 }));
vi.mock('@/teacher/board/selectionImage', () => ({
  selectionPicture: () => {
    picture.made += 1;
    return new Promise<ArrayBuffer | null>((resolve) => {
      picture.release = (png) => {
        resolve(png);
        return undefined;
      };
    });
  },
}));
const asked = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('./chatService', async (importOriginal) => {
  const real = await importOriginal<typeof import('./chatService')>();
  return {
    ...real,
    askTeacher: (...args: unknown[]): Promise<ReplyResult> => {
      asked.calls.push(args);
      return Promise.resolve({
        content: 'Đây là hình tam giác em vẽ.',
        metadata: {
          model: 'gemma4-e2b',
          reviewSkipped: 'picture',
          references: [],
          facts: [],
          missingData: false,
          unverifiedNumbers: [],
        },
        truncated: false,
      });
    },
  };
});

const { ChatPanel } = await import('./ChatPanel');
const { useChatStore } = await import('./chatStore');

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
const PICTURE: BoardSelection = {
  face: 0,
  shape: 'closed',
  status: 'picture',
  points: [],
  bbox: { x: 300, y: 300, w: 200, h: 120 },
  hits: [],
  title: 'Rơi tự do',
  neighbours: [],
  strokes: 2,
  figures: [],
};
const TEXT: BoardSelection = {
  ...PICTURE,
  status: 'ok',
  strokes: 0,
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
      boxes: [{ x: 300, y: 300, w: 200, h: 60 }],
      x: 300,
      y: 300,
      index: 1,
    },
  ],
};

const fake: LlmTransport = {
  chat: () => Promise.reject(new Error('nothing goes online here')),
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

beforeEach(() => {
  asked.calls.length = 0;
  picture.made = 0;
  setTransportForTests(fake);
  useAiStore.setState({ provider: 'gemini', status: 'ok', fallback: 'off' });
  useChatStore.setState({
    engine: 'gemma',
    engineChosen: true,
    gemmaModel: 'gemma4-e2b',
    messages: [],
    summary: null,
    thinkEnabled: true,
    verifierProvider: 'claude',
    webLookup: true,
    answering: false,
  });
  useTeacherStore.setState({ open: true, layout: 'board' });
  useBoardStore.setState({ selection: PICTURE, status: 'paused', pausedForAsk: true });
});
afterEach(() => {
  setTransportForTests(null);
  useChatStore.setState({ thinkEnabled: false, webLookup: false, answering: false });
  useTeacherStore.setState({ open: false, layout: 'talk' });
  useBoardStore.setState({ selection: null, status: 'idle', pausedForAsk: false });
});

describe('a question about a picture of the circled area', () => {
  it('the "sent to" line names neither the reviewer nor Wikipedia; text names the reviewer only', async () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    await waitFor(() => {
      expect(view.container).toHaveTextContent('Câu hỏi được xử lý cục bộ trên máy này.');
    });
    expect(view.container).toHaveTextContent('chỉ trên máy, không gửi lên mạng');
    expect(view.container).not.toHaveTextContent('(rà soát)');
    expect(view.container).not.toHaveTextContent('Wikipedia');
    // The circled text: the reviewer reads it (Think), Wikipedia never gets it.
    act(() => {
      useBoardStore.setState({ selection: TEXT });
    });
    await waitFor(() => {
      expect(view.container).toHaveTextContent('kèm phần chữ em khoanh trên bảng');
    });
    expect(view.container).toHaveTextContent('(rà soát)');
    expect(view.container).not.toHaveTextContent('Wikipedia');
    // Nothing circled: the learner's own Wikipedia lookup is named again.
    act(() => {
      useBoardStore.setState({ selection: null });
    });
    await waitFor(() => {
      expect(view.container).toHaveTextContent('Wikipedia');
    });
  });

  it('asked twice while the picture is made, it is sent once; the answer says it was not reviewed', async () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await waitFor(() => {
      expect(picture.made).toBe(1);
    });
    // A third try (Enter on the box) while the first one waits for its picture.
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await act(async () => {
      picture.release(PNG);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
    expect(picture.made).toBe(1);
    expect(asked.calls).toHaveLength(1);
    const messages = useChatStore.getState().messages;
    expect(messages.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', reviewSkipped: 'picture' });
    expect(view.container).toHaveTextContent(
      'Chưa rà soát: câu hỏi về hình em khoanh chỉ được trả lời trên máy này',
    );
  });

  it('a picture that could not be made lets the learner ask again', async () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await waitFor(() => {
      expect(picture.made).toBe(1);
    });
    await act(async () => {
      picture.release(null);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(view.container).toHaveTextContent('Mình chưa tạo được ảnh vùng em khoanh');
    });
    expect(useChatStore.getState().answering).toBe(false);
    expect(asked.calls).toHaveLength(0);
    // Not stuck busy: the next try makes a picture again.
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await waitFor(() => {
      expect(picture.made).toBe(2);
    });
  });
});
