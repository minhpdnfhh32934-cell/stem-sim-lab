import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useBoardStore } from '@/teacher/board/boardStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useTeacherStore } from '@/teacher/teacherStore';
import type { ReplyResult } from './chatService';

/**
 * A drawing or the learner's handwriting circled while the AI in use cannot read pictures (an
 * online API): the learner asks about it in their own words (0.7 fix). No picture is made or
 * sent; the question goes with the steps around the circled area, and it is an ordinary question
 * afterwards (not kept on this computer as a picture reading).
 */
vi.mock('@/app/ai/engineChoice', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/ai/engineChoice')>();
  return {
    ...real,
    analysisEngine: () => Promise.resolve('cloud'),
    useAnalysisEngine: () => 'cloud',
  };
});
vi.mock('./pictureReader', async (importOriginal) => {
  const real = await importOriginal<typeof import('./pictureReader')>();
  return { ...real, usePictureReader: () => null, pictureReaderNow: () => null };
});
const made = vi.hoisted(() => ({ pictures: 0 }));
vi.mock('@/teacher/board/selectionImage', () => ({
  selectionPicture: () => {
    made.pictures += 1;
    return Promise.resolve(new ArrayBuffer(8));
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
        content: 'Đó là hình vẽ minh họa cho bước trước.',
        metadata: {
          model: 'gemini',
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
const { asksAboutPicture } = await import('./memory');

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

const fake: LlmTransport = {
  chat: () => Promise.reject(new Error('askTeacher is stubbed')),
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

beforeEach(() => {
  asked.calls.length = 0;
  made.pictures = 0;
  setTransportForTests(fake);
  useAiStore.setState({ provider: 'gemini', status: 'ok', fallback: 'off' });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    messages: [],
    summary: null,
    thinkEnabled: false,
    webLookup: false,
    answering: false,
  });
  useTeacherStore.setState({ open: true, layout: 'board' });
  useBoardStore.setState({ selection: PICTURE, status: 'paused', pausedForAsk: true });
});
afterEach(() => {
  setTransportForTests(null);
  useTeacherStore.setState({ open: false, layout: 'talk' });
  useBoardStore.setState({ selection: null, status: 'idle', pausedForAsk: false });
});

describe('a circled picture with an AI that cannot read pictures (0.7 fix)', () => {
  it('the learner asks in words: no picture, the question goes with the circled area', async () => {
    const view = render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(view.container).toHaveTextContent('Hỏi bằng lời về hình em khoanh');
    // Nothing says a picture goes along.
    expect(view.container).not.toHaveTextContent('Kèm ảnh vùng khoanh');
    // "Hỏi thầy chỗ này" without words asks about nothing the AI could see: nothing is sent.
    act(() => {
      window.dispatchEvent(new Event('stemsim:board-ask'));
    });
    expect(asked.calls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), {
      target: { value: 'Hình này vẽ lực nào ạ?' },
    });
    fireEvent.submit(screen.getByLabelText('Nhập câu hỏi').closest('form') as HTMLFormElement);
    await waitFor(() => {
      expect(asked.calls).toHaveLength(1);
    });
    expect(made.pictures).toBe(0);
    const options = asked.calls[0]?.[3] as {
      boardSelection?: { selection: BoardSelection; image?: ArrayBuffer; inWords?: boolean };
    };
    expect(options.boardSelection?.selection).toBe(PICTURE);
    expect(options.boardSelection?.image).toBeUndefined();
    expect(options.boardSelection?.inWords).toBe(true);
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
    const question = useChatStore.getState().messages.find((m) => m.role === 'user');
    expect(question?.boardRef?.inWords).toBe(true);
    // An ordinary question afterwards: not a picture reading kept on this computer.
    expect(asksAboutPicture(question)).toBe(false);
  });
});
