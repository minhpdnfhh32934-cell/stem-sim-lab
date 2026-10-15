import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useBoardStore } from '@/teacher/board/boardStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useTeacherStore } from '@/teacher/teacherStore';
import { stopSpeaking } from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import type { ChatMessageRecord } from './chatStore';
import type { ReplyResult } from './chatService';

/**
 * A question about a picture of the circled area (item 2) in the chat panel, with the in-app
 * Gemma that reads pictures: the "sent to" line never names the Think reviewer or Wikipedia for
 * it (nothing about the picture goes online), the answer says it was not reviewed, and a second
 * click while the picture is being made never sends the question twice.
 */
/** The engine that answers ('gemma' unless a test says otherwise). */
const engineNow = vi.hoisted((): { value: 'gemma' | 'cloud' } => ({ value: 'gemma' }));
vi.mock('@/app/ai/engineChoice', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/ai/engineChoice')>();
  return {
    ...real,
    analysisEngine: () => Promise.resolve(engineNow.value),
    useAnalysisEngine: () => engineNow.value,
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
/** The next answer: by default the on-device reading of the picture, which must stay here. */
const asked = vi.hoisted(() => ({
  calls: [] as unknown[][],
  /** The next answer (the on-device reading of a picture unless a test says otherwise). */
  reply: null as { content: string; picture: boolean } | null,
}));
vi.mock('./chatService', async (importOriginal) => {
  const real = await importOriginal<typeof import('./chatService')>();
  return {
    ...real,
    askTeacher: (...args: unknown[]): Promise<ReplyResult> => {
      asked.calls.push(args);
      const reply = asked.reply ?? {
        content: 'Em vẽ một hình tam giác có ghi chữ PRIVATE-HANDWRITING.',
        picture: true,
      };
      return Promise.resolve({
        content: reply.content,
        metadata: {
          model: 'gemma4-e2b',
          ...(reply.picture ? { reviewSkipped: 'picture' as const } : {}),
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

/** Texts sent to the online Gemini voice. */
let ttsTexts: string[] = [];
const fake: LlmTransport = {
  chat: () => Promise.reject(new Error('nothing goes online here')),
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
  tts: (req) => {
    ttsTexts.push(req.text);
    return Promise.reject(new Error('no audio in tests'));
  },
};

beforeEach(() => {
  asked.calls.length = 0;
  asked.reply = null;
  ttsTexts = [];
  engineNow.value = 'gemma';
  picture.made = 0;
  useVoiceStore.setState({ enabled: false, engine: 'system', voiceURI: '' });
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
  stopSpeaking();
  useVoiceStore.setState({ enabled: false, engine: 'system' });
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

/** A lesson, then a question about a picture whose on-device answer stopped at the limit. */
function cutPictureAnswer(): ChatMessageRecord[] {
  return [
    { id: 'q1', role: 'user', content: 'Giải bài rơi tự do' },
    {
      id: 'a1',
      role: 'assistant',
      content: 'BÀI GIẢNG RƠI TỰ DO hoàn chỉnh.',
      unverifiedNumbers: [],
      mode: 'board',
    },
    {
      id: 'pq',
      role: 'user',
      content: 'Về chỗ em khoanh',
      boardRef: { face: 0, ids: [], excerpt: '' },
    },
    {
      id: 'pa',
      role: 'assistant',
      content: 'Em vẽ một hình tam giác có',
      model: 'gemma4-e2b',
      unverifiedNumbers: [],
      mode: 'aside',
      truncated: true,
    },
  ];
}

describe('the answer about a picture stays on this computer', () => {
  it('the online Gemini voice never reads it; the chat says it was not read aloud', async () => {
    useVoiceStore.setState({ enabled: true, engine: 'gemini' });
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    // Said before asking, next to "chỉ trên máy".
    expect(view.container).toHaveTextContent('Giọng Gemini sẽ không đọc to câu trả lời này');
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await waitFor(() => {
      expect(picture.made).toBe(1);
    });
    await act(async () => {
      picture.release(PNG);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(view.container).toHaveTextContent('Mình không đọc to câu trả lời này');
    });
    expect(view.container).toHaveTextContent('PRIVATE-HANDWRITING');
    expect(ttsTexts).toEqual([]);
    expect(screen.getByRole('button', { name: /Chọn giọng/ })).toBeInTheDocument();

    // The same voice still reads an answer about circled text (the fake records it): the check
    // above is real.
    asked.reply = { content: 'Công thức này cho quãng đường rơi.', picture: false };
    act(() => {
      useBoardStore.setState({ selection: TEXT });
    });
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    await waitFor(() => {
      expect(ttsTexts.join(' ')).toContain('Công thức này cho quãng đường rơi');
    });
    expect(ttsTexts.join(' ')).not.toContain('PRIVATE-HANDWRITING');
  });

  it('"Viết tiếp" of it is written on this computer and never read by the online voice', async () => {
    useVoiceStore.setState({ enabled: true, engine: 'gemini' });
    useBoardStore.setState({ selection: null });
    useChatStore.setState({ messages: cutPictureAnswer() });
    asked.reply = { content: 'ghi chữ PRIVATE-HANDWRITING ở giữa.', picture: false };
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Viết tiếp' }));
    await waitFor(() => {
      expect(useChatStore.getState().messages.at(-1)?.content).toContain('PRIVATE-HANDWRITING');
    });
    expect(asked.calls[0]?.[3]).toMatchObject({ continues: true });
    await waitFor(() => {
      expect(view.container).toHaveTextContent('Mình không đọc to câu trả lời này');
    });
    expect(ttsTexts).toEqual([]);
  });

  it('with the API chosen, "Viết tiếp" is not offered for it; with Gemma it is', async () => {
    engineNow.value = 'cloud';
    useBoardStore.setState({ selection: null });
    useChatStore.setState({ engine: 'cloud', thinkEnabled: false, messages: cutPictureAnswer() });
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    await waitFor(() => {
      expect(view.container).toHaveTextContent(
        'Câu trả lời về hình em khoanh chỉ viết tiếp được khi em chọn “Gemma cục bộ” hoặc “AI trên máy khác”.',
      );
    });
    expect(screen.queryByRole('button', { name: 'Viết tiếp' })).toBeNull();
    // The lesson's own cut answer is still continued online as before.
    act(() => {
      useChatStore.setState({
        messages: cutPictureAnswer().map((m) => (m.id === 'a1' ? { ...m, truncated: true } : m)),
      });
    });
    expect(screen.getAllByRole('button', { name: 'Viết tiếp' })).toHaveLength(1);
    // On this computer the picture answer can be continued too.
    engineNow.value = 'gemma';
    view.rerender(<ChatPanel teacherPage showScreenContext={false} />);
    expect(screen.getAllByRole('button', { name: 'Viết tiếp' })).toHaveLength(2);
    expect(view.container).not.toHaveTextContent('chỉ viết tiếp được khi em chọn');
    expect(asked.calls).toHaveLength(0);
  });
});
