import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GpuStatus } from '@/ai/gpu';
import { allowGemmaAgain, forgetGpuFault } from '@/ai/gpuSafety';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import {
  UNVERIFIED,
  type Cap,
  type LocalChatResponse,
  type LocalRuntimeClient,
} from '@/ai/local/types';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import type { AnalysisEngine } from '@/app/ai/engineChoice';
import { translate } from '@/app/i18n';
import { useAiStore } from '@/ai/aiStore';
import type { BoardSelection, SelectionHit } from '@/teacher/board/selection';
import { useChatStore, type ChatMessageRecord } from './chatStore';

/**
 * Item 2 in the chat service: a question about part of the board. The circled text goes in the
 * instruction (cloud) or right before the question (on this computer), is checked like anything
 * sent, never counts as given numbers, and a picture of an area without text goes only to an AI
 * on this computer that reads pictures, never online.
 */
interface GemmaCall {
  system: string;
  messages: { role: string; content: string }[];
  images?: ArrayBuffer[];
  model: string;
}
const gemmaCalls: GemmaCall[] = [];
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: (args: GemmaCall) => {
    gemmaCalls.push(args);
    return Promise.resolve({ content: 'Đây là hình em vẽ.', model: args.model, truncated: false });
  },
}));
const picked = { current: 'cloud' as AnalysisEngine };
vi.mock('@/app/ai/engineChoice', () => ({
  analysisEngine: () => Promise.resolve(picked.current),
  useAnalysisEngine: () => picked.current,
}));
const desktop = { status: null as GpuStatus | null };
vi.mock('@/ai/gpu', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gpu')>();
  return {
    ...real,
    loadGpuStatus: vi.fn(() => {
      real.useGpuStore.getState().setStatus(desktop.status);
      return Promise.resolve(desktop.status);
    }),
  };
});
const incidents: string[] = [];
vi.mock('@/safety/safetyStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/safety/safetyStore')>();
  return {
    ...real,
    logIncident: (kind: string) => {
      incidents.push(kind);
    },
  };
});

const { BOARD_ASK, BOARD_SYSTEM, TeacherError, askTeacher, contextPrompt } =
  await import('./chatService');
const { useGpuStore } = await import('@/ai/gpu');

const FORMULA = 's = \\frac{1}{2} g t^2';

function hit(id: string, text: string, extra: Partial<SelectionHit> = {}): SelectionHit {
  return {
    id,
    kind: 'text',
    column: 'center',
    role: 'body',
    text,
    math: false,
    whole: true,
    status: null,
    struck: false,
    coverage: 1,
    boxes: [],
    x: 340,
    y: 200,
    index: 1,
    ...extra,
  };
}

function selectionOf(hits: SelectionHit[], extra: Partial<BoardSelection> = {}): BoardSelection {
  return {
    face: 0,
    shape: 'closed',
    status: hits.length ? 'ok' : 'picture',
    points: [],
    bbox: { x: 300, y: 180, w: 300, h: 80 },
    hits,
    title: 'Rơi tự do',
    neighbours: [{ id: 's1', text: '2. Viết công thức quãng đường:', math: false, status: null }],
    strokes: hits.length ? 0 : 1,
    figures: [],
    ...extra,
  };
}

const formula = () => selectionOf([hit('f1', FORMULA, { math: true })]);
const picture = () => selectionOf([]);
/** PNG bytes (its signature and a few more), as the crop would make. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).buffer;

function transport(calls: ChatRequest[], reply = 'Đây là quãng đường rơi.'): LlmTransport {
  return {
    hasKey: () => Promise.resolve(true),
    setKey: () => Promise.resolve(),
    deleteKey: () => Promise.resolve(),
    chat: (req: ChatRequest) => {
      calls.push(req);
      return Promise.resolve({ content: reply, model: 'gemini-test', durationMs: 1 });
    },
    models: () => Promise.resolve([]),
  };
}

const RTX: GpuStatus = {
  supported: true,
  adapters: [
    {
      id: '10de:2d59:0',
      name: 'NVIDIA GeForce RTX 5060 Laptop GPU',
      vendorId: 0x10de,
      deviceId: 0x2d59,
      kind: 'discrete',
      dedicatedMb: 8151,
      sharedMb: 16000,
    },
  ],
  choice: null,
  choiceName: null,
  startupChoice: null,
  startupApplied: false,
  restartNeeded: false,
};
const AMD_IGPU: GpuStatus = {
  ...RTX,
  adapters: [
    {
      id: '1002:15bf:0',
      name: 'AMD Radeon 780M',
      vendorId: 0x1002,
      deviceId: 0x15bf,
      kind: 'integrated',
      dedicatedMb: 512,
      sharedMb: 16000,
    },
  ],
};

const calls: ChatRequest[] = [];
const ask = (
  question: string,
  extra: Partial<Parameters<typeof askTeacher>[3]> = {},
  records: ChatMessageRecord[] = [],
) => askTeacher(question, 'vi', records, { includeScreen: false, think: false, ...extra });

beforeEach(() => {
  calls.length = 0;
  gemmaCalls.length = 0;
  incidents.length = 0;
  picked.current = 'cloud';
  desktop.status = null;
  useGpuStore.setState({ status: null, gemmaInfo: null });
  useAiStore.setState({ provider: 'gemini', fallback: 'off' });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    gemmaModel: 'gemma3-1b',
    messages: [],
    summary: null,
    webLookup: false,
    thinkEnabled: false,
    verifierProvider: 'claude',
    verifierModel: '',
  });
  setTransportForTests(transport(calls));
});
afterEach(() => {
  setTransportForTests(null);
  setLocalClientForTests(null);
  allowGemmaAgain();
  forgetGpuFault();
  useLocalAiStore.setState({ selected: null, checks: {} });
});

describe('the circled part in the prompt', () => {
  it('cloud: a fenced block and BOARD_ASK in the instruction; a chat answer, not a lesson', async () => {
    await ask('Chỗ này nghĩa là gì ạ?', { board: true, boardSelection: { selection: formula() } });
    expect(calls).toHaveLength(1);
    const req = calls[0];
    expect(req?.system).toContain(BOARD_ASK.vi);
    expect(req?.system).toContain('<board_selection>');
    expect(req?.system).toContain(`$${FORMULA}$`);
    // Never a TeachScript lesson: the board keeps its own.
    expect(req?.system).not.toContain(BOARD_SYSTEM.vi);
    // The question is the learner's words only.
    expect(req?.messages.at(-1)?.content).toBe('Chỗ này nghĩa là gì ạ?');
  });

  it('on this computer: the capped block right before the question, not in the instruction', async () => {
    picked.current = 'gemma';
    useChatStore.setState({ engine: 'gemma' });
    const question = 'Chỗ này nghĩa là gì ạ?';
    for (const [status, cap] of [
      [RTX, 600],
      [AMD_IGPU, 300],
    ] as const) {
      gemmaCalls.length = 0;
      desktop.status = status;
      useGpuStore.setState({ status, gemmaInfo: null });
      await ask(question, { boardSelection: { selection: formula() } });
      const call = gemmaCalls[0];
      const turn = call?.messages.at(-1)?.content ?? '';
      expect(turn.endsWith(question)).toBe(true);
      const block = turn.slice(
        turn.indexOf('<board_selection>'),
        turn.indexOf('</board_selection>') + 18,
      );
      expect(block.startsWith('<board_selection>')).toBe(true);
      expect(block.length).toBeLessThanOrEqual(cap);
      expect(block).toContain(FORMULA);
      expect(call?.system).not.toContain('<board_selection>');
    }
  });

  it('a problem written on the board is data: "Tính cái này" around it is not missing data', async () => {
    const withData = await ask('Tính cái này giúp em', {
      boardSelection: { selection: selectionOf([hit('g1', 'Cho: v = 20 m/s, t = 3 s')]) },
    });
    expect(withData.metadata.missingData).toBe(false);
    const noData = await ask('Tính gia tốc', {
      boardSelection: { selection: selectionOf([hit('t1', 'Lực và chuyển động')]) },
    });
    expect(noData.metadata.missingData).toBe(true);
  });

  it('the library note follows what was circled', async () => {
    const question = 'Chỗ này là gì ạ?';
    const about = selectionOf([hit('s1', 'Nguyên phân tạo hai nhân con giống nhau')]);
    const prompt = await contextPrompt(question, 'vi', false, false, false, [], {
      boardSelection: about,
    });
    expect(prompt.references.some((r) => /Chu kì tế bào/u.test(r))).toBe(true);
    const plain = await contextPrompt(question, 'vi', false, false, false, []);
    expect(plain.references.some((r) => /Chu kì tế bào/u.test(r))).toBe(false);
  });

  it('board text with personal data is not sent; the learner is told it is the board text', async () => {
    const sel = selectionOf([hit('s1', 'Gọi 0912 345 678 hoặc gửi thư tới ban@example.com')]);
    await expect(ask('Chỗ này là gì?', { boardSelection: { selection: sel } })).rejects.toThrow(
      translate('vi', 'chat.errors.boardPersonal'),
    );
    expect(incidents).toEqual(['inputPersonalData']);
    expect(calls).toHaveLength(0);
  });

  it('a number the lesson flagged stays flagged in the answer about it', async () => {
    const records: ChatMessageRecord[] = [
      { id: 'q', role: 'user', content: 'Một vật rơi tự do. Tính quãng đường.' },
      {
        id: 'a',
        role: 'assistant',
        content: 'Quãng đường rơi là s = 45 m.',
        unverifiedNumbers: ['45 m'],
        mode: 'board',
      },
    ];
    setTransportForTests(transport(calls, 'Ở đây s = 45 m là quãng đường vật rơi.'));
    const reply = await ask(
      'Vì sao lại ra số này ạ?',
      { boardSelection: { selection: selectionOf([hit('r1', 's = 45 m')]) } },
      records,
    );
    expect(reply.metadata.unverifiedNumbers).toContain('45 m');
  });

  it('Think: the online reviewer reads the circled text the on-device draft read', async () => {
    picked.current = 'gemma';
    useChatStore.setState({ engine: 'gemma', thinkEnabled: true, verifierProvider: 'claude' });
    await ask('Chỗ này nghĩa là gì ạ?', {
      think: true,
      boardSelection: { selection: formula() },
    });
    expect(gemmaCalls).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.provider).toBe('claude');
    expect(calls[0]?.system).toContain('<board_selection>');
    expect(calls[0]?.system).toContain(FORMULA);
  });
});

describe('a picture of the circled area', () => {
  it('never goes online: a cloud engine gets text only, and a picture alone is not sent', async () => {
    await ask('Chỗ này là gì?', { boardSelection: { selection: formula(), image: PNG } });
    expect(JSON.stringify(calls)).not.toMatch(/images|iVBOR/);
    calls.length = 0;
    const answer = ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } });
    await expect(answer).rejects.toBeInstanceOf(TeacherError);
    await expect(answer).rejects.toThrow(translate('vi', 'chat.errors.boardNoPicture'));
    expect(calls).toHaveLength(0);
  });

  it('Gemma: only the chosen picture model on a known discrete card gets it, never 1B', async () => {
    picked.current = 'gemma';
    desktop.status = RTX;
    useGpuStore.setState({ status: RTX, gemmaInfo: { vendor: 'nvidia', architecture: '' } });
    // A text model chosen: never switched to the picture model behind the learner's back.
    useChatStore.setState({ engine: 'gemma', gemmaModel: 'gemma3-1b' });
    await expect(
      ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } }),
    ).rejects.toThrow(translate('vi', 'chat.errors.boardNoPicture'));
    expect(gemmaCalls).toHaveLength(0);
    // Text with a picture: the text goes, the picture does not.
    await ask('Chỗ này là gì?', { boardSelection: { selection: formula(), image: PNG } });
    expect(gemmaCalls[0]?.images).toBeUndefined();
    // E2B on the RTX card: the picture goes with the question.
    gemmaCalls.length = 0;
    useChatStore.setState({ gemmaModel: 'gemma4-e2b' });
    await ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } });
    expect(gemmaCalls[0]?.images).toHaveLength(1);
    expect(gemmaCalls[0]?.images?.[0]?.byteLength).toBe(PNG.byteLength);
    // E2B on an integrated card (BSOD history): no picture.
    gemmaCalls.length = 0;
    desktop.status = AMD_IGPU;
    useGpuStore.setState({ status: AMD_IGPU, gemmaInfo: { vendor: 'amd', architecture: '' } });
    await expect(
      ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } }),
    ).rejects.toThrow(translate('vi', 'chat.errors.boardNoPicture'));
    expect(gemmaCalls).toHaveLength(0);
  });

  it('a runtime on this computer: only a model seen reading pictures gets it', async () => {
    picked.current = 'local';
    const chat = vi.fn<LocalRuntimeClient['chat']>(() =>
      Promise.resolve<LocalChatResponse>({
        content: 'Đây là đồ thị em vẽ.',
        model: 'llava',
        runtime: 'ollama',
        durationMs: 1,
        firstPieceMs: 1,
        truncated: false,
        streamed: false,
      }),
    );
    setLocalClientForTests({
      detect: vi.fn(),
      probe: vi.fn(),
      models: vi.fn(),
      modelInfo: vi.fn(),
      test: vi.fn(),
      chat,
    });
    const selected = {
      kind: 'ollama' as const,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llava:7b',
      label: 'llava:7b',
    };
    useChatStore.setState({ engine: 'local' });
    const seen = (vision: Cap) => {
      useLocalAiStore.setState({ selected, checks: {} });
      useLocalAiStore.getState().recordCheck('ollama', selected.baseUrl, {
        model: 'llava:7b',
        contextLength: null,
        vision,
        thinking: 'no',
        loaded: null,
        remote: false,
        capabilities: { ...UNVERIFIED, vision },
        declared: UNVERIFIED,
      });
    };
    seen('unverified');
    await expect(
      ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } }),
    ).rejects.toThrow(translate('vi', 'chat.errors.boardNoPicture'));
    expect(chat).not.toHaveBeenCalled();
    seen('yes');
    await ask('Hình này là gì?', { boardSelection: { selection: picture(), image: PNG } });
    const [req] = chat.mock.calls[0] ?? [];
    expect(req?.vision).toBe(true);
    const last = req?.messages.at(-1);
    expect(last?.role).toBe('user');
    expect(last?.images).toHaveLength(1);
    expect(atob(last?.images?.[0] ?? '').charCodeAt(1)).toBe(0x50);
    expect(req?.messages.slice(0, -1).every((m) => m.images === undefined)).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
