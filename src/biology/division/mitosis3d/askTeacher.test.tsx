import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { closeTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { setDivisionState } from '../stageIndex';
import { COMPONENTS, STAGE3D_NAME } from './components';
import { Mitosis3DView, type RendererFactory } from './Mitosis3DView';
import { Mitosis3DParts } from './panels';
import { timelineFor, useMitosis3D } from './store';

/**
 * "Hỏi thầy về bộ phận này" (item 2 outside the board): the part picked in the 3D mitosis view
 * opens AI Teacher (talk layout) with a question written into the box from the module's own
 * texts (the part's name, the stage, the cell type). Nothing is sent until the learner presses
 * send, and the question carries no picture and no screen data.
 */
const asked = vi.hoisted(() => ({ options: [] as Record<string, unknown>[] }));
vi.mock('@/teacher/chat/chatService', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/teacher/chat/chatService')>();
  return {
    ...real,
    askTeacher: (...args: Parameters<typeof real.askTeacher>) => {
      asked.options.push(args[3]);
      return real.askTeacher(...args);
    },
  };
});

const { ChatPanel } = await import('@/teacher/chat/ChatPanel');
const { useChatStore } = await import('@/teacher/chat/chatStore');
const { default: TeacherScreen } = await import('@/teacher/screen/TeacherScreen');

/** jsdom has no WebGL: a renderer that draws nothing. */
const fakeRenderer: RendererFactory = () => ({
  domElement: document.createElement('canvas'),
  localClippingEnabled: false,
  setPixelRatio: () => undefined,
  setSize: () => undefined,
  render: () => undefined,
  dispose: () => undefined,
  info: {
    memory: { geometries: 0, textures: 0 },
    programs: [],
    render: { calls: 0, triangles: 0 },
  },
});

let calls: ChatRequest[];
const fake: LlmTransport = {
  chat: (req) => {
    calls.push(req);
    return Promise.resolve({
      content: 'Tâm động giữ hai cromatit.',
      model: 'gemini-test',
      durationMs: 1,
    });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

const ASK = 'Hỏi thầy về bộ phận này';
const QUESTION =
  'Thầy giải thích giúp em: bộ phận “Tâm động” làm gì ở bước “Kì giữa” của nguyên phân (tế bào động vật) ạ?';

function renderView() {
  return render(
    <>
      <Mitosis3DView createRenderer={fakeRenderer} />
      <Mitosis3DParts />
    </>,
  );
}

function pick(name: string) {
  const parts = screen.getByRole('group', { name: 'Bộ phận tế bào' });
  fireEvent.click(within(parts).getByRole('button', { name }));
}

beforeEach(() => {
  calls = [];
  asked.options.length = 0;
  setTransportForTests(fake);
  closeTeacher();
  useNavigationStore.setState({ screen: 'lab', previousScreen: null });
  useSettingsStore.setState({ locale: 'vi' });
  useAiStore.setState({ provider: 'gemini', status: 'ok', fallback: 'off' });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    messages: [],
    summary: null,
    thinkEnabled: false,
    answering: false,
    webLookup: false,
    includeScreen: true,
  });
  setDivisionState('mitosis', { pairs: 2, index: 0, cellType: 'animal', view3d: true, speed: 1 });
  useMitosis3D.setState({
    t: timelineFor(2, 'animal').keyTime('metaphase'),
    playing: false,
    selected: null,
    camera: 'overview',
    viewNonce: 0,
    webglFailed: false,
    active: false,
  });
});

afterEach(() => {
  setTransportForTests(null);
  closeTeacher();
  useSettingsStore.setState({ locale: 'vi' });
});

describe('"Hỏi thầy về bộ phận này" in the 3D mitosis view', () => {
  it('appears only while a part is picked, as a full-size button', () => {
    renderView();
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
    pick('Tâm động');
    const ask = screen.getByRole('button', { name: ASK });
    expect(within(screen.getByRole('complementary')).getByRole('button', { name: ASK })).toBe(ask);
    // `.btn` is var(--target) high (≥ 40 px); it shows the short label, the name says it all.
    expect(ask).toHaveClass('btn');
    expect(ask).toHaveTextContent('Hỏi thầy');
    expect(ask).toHaveAttribute('data-tip', ASK);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
  });

  it('opens AI Teacher (talk) with the part and stage written into the box, nothing sent', () => {
    useTeacherStore.setState({ layout: 'board' });
    renderView();
    pick('Tâm động');
    fireEvent.click(screen.getByRole('button', { name: ASK }));
    // The usual way into AI Teacher (openTeacher): its page, talk layout, screen data off.
    expect(useTeacherStore.getState()).toMatchObject({ open: true, layout: 'talk' });
    expect(useNavigationStore.getState().screen).toBe('teacher');
    expect(useChatStore.getState().includeScreen).toBe(false);
    // Built from the module's own texts, never from an AI.
    expect(useTeacherStore.getState().draft).toBe(QUESTION);
    expect(QUESTION).toContain(COMPONENTS.centromere.name.vi);
    expect(QUESTION).toContain(STAGE3D_NAME.metaphase.vi);
    // No request yet: opening the page only writes the question.
    expect(calls).toHaveLength(0);
    expect(asked.options).toHaveLength(0);
  });

  it('the teacher page puts the question in the box once and waits for "Gửi" (StrictMode)', async () => {
    renderView();
    pick('Tâm động');
    fireEvent.click(screen.getByRole('button', { name: ASK }));
    render(
      <StrictMode>
        <TeacherScreen />
      </StrictMode>,
    );
    const box = screen.getByRole('textbox', { name: 'Nhập câu hỏi' });
    await waitFor(() => {
      expect(box).toHaveValue(QUESTION);
    });
    // Taken once: going back and opening AI Teacher again shows an empty box.
    expect(useTeacherStore.getState().draft).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(calls).toHaveLength(0);
    expect(asked.options).toHaveLength(0);
    expect(useChatStore.getState().messages).toHaveLength(0);

    // The learner presses send: one question, as written, with no picture and no screen data.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
    expect(calls).toHaveLength(1);
    expect(asked.options).toHaveLength(1);
    expect(asked.options[0]?.boardSelection).toBeUndefined();
    expect(asked.options[0]?.includeScreen).toBe(false);
    expect(calls[0]?.messages.at(-1)?.content).toContain(QUESTION);
    for (const m of calls[0]?.messages ?? []) expect(m).not.toHaveProperty('images');
    expect(useChatStore.getState().messages[0]).toMatchObject({ role: 'user', content: QUESTION });
  });

  it('the learner can change the question before sending it', async () => {
    renderView();
    pick('Thoi phân bào');
    fireEvent.click(screen.getByRole('button', { name: ASK }));
    render(<TeacherScreen />);
    const box = screen.getByRole('textbox', { name: 'Nhập câu hỏi' });
    await waitFor(() => {
      expect(box).toHaveValue(
        'Thầy giải thích giúp em: bộ phận “Thoi phân bào” làm gì ở bước “Kì giữa” của nguyên phân (tế bào động vật) ạ?',
      );
    });
    const user = userEvent.setup();
    await user.clear(box);
    await user.type(box, 'Thoi phân bào làm từ gì?{Enter}');
    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
    expect(calls).toHaveLength(1);
    expect(useChatStore.getState().messages[0]?.content).toBe('Thoi phân bào làm từ gì?');
  });

  it('names the plant cell and the stage on screen, in English too', () => {
    useSettingsStore.setState({ locale: 'en' });
    setDivisionState('mitosis', { cellType: 'plant' });
    useMitosis3D.setState({ t: timelineFor(2, 'plant').keyTime('cytokinesis') });
    renderView();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Cell parts' })).getByRole('button', {
        name: 'Cell plate',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ask the teacher about this part' }));
    expect(useTeacherStore.getState().draft).toBe(
      'Could you explain what the “Cell plate” does at the “Cytokinesis” step of mitosis (plant cell)?',
    );
    expect(calls).toHaveLength(0);
  });

  it('a held Enter that pressed "Hỏi thầy" never sends the question in the box', async () => {
    renderView();
    pick('Tâm động');
    const user = userEvent.setup();
    screen.getByRole('button', { name: ASK }).focus();
    // Enter goes down on the button (which clicks it) and stays down.
    await user.keyboard('{Enter>}');
    expect(useTeacherStore.getState().draft).toBe(QUESTION);
    render(<TeacherScreen />);
    const box = screen.getByRole('textbox', { name: 'Nhập câu hỏi' });
    await waitFor(() => {
      expect(box).toHaveFocus();
    });
    expect(box).toHaveValue(QUESTION);
    // The key repeats while it is held: the repeats land in the box, which now has the focus.
    fireEvent.keyDown(box, { key: 'Enter', repeat: true });
    fireEvent.keyDown(box, { key: 'Enter', repeat: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(calls).toHaveLength(0);
    expect(asked.options).toHaveLength(0);
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(box).toHaveValue(QUESTION);
    // Released and pressed again on purpose: the question goes, once.
    await user.keyboard('{/Enter}');
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
    expect(calls).toHaveLength(1);
    expect(useChatStore.getState().messages[0]).toMatchObject({ role: 'user', content: QUESTION });
  });

  it('only the teacher page takes the question; the chat bubble leaves it alone', () => {
    useTeacherStore.setState({ draft: QUESTION });
    render(<ChatPanel compact />);
    expect(screen.getByRole('textbox', { name: 'Nhập câu hỏi' })).toHaveValue('');
    expect(useTeacherStore.getState().draft).toBe(QUESTION);
  });

  it('closing AI Teacher drops a question it never showed', () => {
    useTeacherStore.setState({ draft: QUESTION });
    closeTeacher();
    expect(useTeacherStore.getState().draft).toBeNull();
  });
});
