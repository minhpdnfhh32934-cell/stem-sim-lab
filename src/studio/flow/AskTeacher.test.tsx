import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { fmtQty } from '@/physics/common/tex';
import { ChatBubble } from '@/teacher/chat/ChatBubble';
import { useChatStore } from '@/teacher/chat/chatStore';
import { screenContext } from '@/teacher/chat/context';
import { useTeacherStore } from '@/teacher/teacherStore';
import type { StudioScenario } from '../scenario';
import { physicsFreeFall as sc } from '../scenarios/physicsFreeFall';
import { createSession, withEngine, type EngineEvidence } from '../session';
import { useStudioStore } from '../studioStore';
import { AskTeacher } from './AskTeacher';
import { useStudioContext } from './useStudioContext';

// The AI is a scripted fake: these tests check what the app sends, not a real model.
let calls: ChatRequest[];
const fake: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    return Promise.resolve({ content: 'Trả lời', model: 'gemini-model', durationMs: 1 });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

const run: EngineEvidence = {
  id: 'comparison',
  key: 'comparison',
  at: 10,
  step: 'interact',
  kind: 'engine',
  model: 'phys.projectile',
  title: { vi: 'Rơi tự do', en: 'Free fall' },
  conditions: [],
  quantities: [
    {
      id: 'time_of_flight',
      label: { vi: 'Thời gian chuyển động', en: 'Time of flight' },
      unit: 's',
      condition: 'A',
      value: 3.0289,
      check: null,
    },
  ],
};

function Lesson({ scenario }: { scenario: StudioScenario }) {
  useStudioContext(scenario);
  return <AskTeacher scenario={scenario} step="observe" />;
}

const sent = (req: ChatRequest | undefined) => JSON.stringify(req ?? null);

describe('"Hỏi thầy" in Science Studio', () => {
  beforeEach(() => {
    calls = [];
    setTransportForTests(fake);
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      answering: false,
      includeScreen: false,
    });
    useTeacherStore.setState({ bubbleDraft: null, draft: null });
    useStudioStore.setState({
      sessions: { [sc.id]: withEngine(createSession(sc, 1), run, null) },
    });
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('opens the bubble with an editable question; lesson data goes only with screen context on', async () => {
    const user = userEvent.setup();
    const view = render(
      <>
        <Lesson scenario={sc} />
        <ChatBubble />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Hỏi thầy' }));

    const box = await screen.findByRole('textbox', { name: 'Nhập câu hỏi' });
    await waitFor(() => {
      expect((box as HTMLTextAreaElement).value).toContain('bước Quan sát');
    });
    expect((box as HTMLTextAreaElement).value).toContain('Rơi tự do: thả từ độ cao gấp đôi');
    // Nothing was sent by opening, and screen context starts off.
    expect(calls).toHaveLength(0);
    const toggle = screen.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' });
    expect(toggle).not.toBeChecked();

    // The learner edits the question, then sends it: no lesson data goes with it.
    await user.type(box, ' Cảm ơn thầy.{Enter}');
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(sent(calls[0])).toContain('Cảm ơn thầy.');
    expect(sent(calls[0])).not.toContain('[Science Studio');
    expect(sent(calls[0])).not.toContain(fmtQty('vi', 3.0289, 's'));

    // With screen context on, the studio's structured context replaces the lab's.
    await user.click(toggle);
    await waitFor(() => {
      expect(useChatStore.getState().answering).toBe(false);
    });
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Số đo nói gì?{Enter}');
    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    const withScreen = sent(calls[calls.length - 1]);
    expect(withScreen).toContain('[Science Studio');
    expect(withScreen).toContain('DỮ KIỆN DO MÔ PHỎNG TÍNH');
    expect(withScreen).toContain(fmtQty('vi', 3.0289, 's'));
    expect(withScreen).not.toContain('Môn học:');

    // Leaving the studio stops it describing itself.
    view.unmount();
    expect(screenContext('vi')).not.toContain('[Science Studio');
  });

  it('closing the bubble turns screen context off again', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Lesson scenario={sc} />
        <ChatBubble />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Hỏi thầy' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Lấy thông tin từ màn hình' }));
    expect(useChatStore.getState().includeScreen).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Đóng chat' }));
    expect(useChatStore.getState().includeScreen).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Hỏi thầy' }));
    expect(
      await screen.findByRole('checkbox', { name: 'Lấy thông tin từ màn hình' }),
    ).not.toBeChecked();
  });
});
