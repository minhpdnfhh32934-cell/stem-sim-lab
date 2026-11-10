import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatMessage, ChatRequest } from '@/ai/types';
import type { AnalysisEngine } from '@/app/ai/engineChoice';
import type { Locale } from '@/app/i18n';
import { useProfileStore, type Level } from '@/app/learner/profileStore';
import type { BoardSelection } from '@/teacher/board/selection';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { provideScreenContext } from './context';

/**
 * Golden prompts: every text the AI Teacher builds for a model, byte for byte. A change here is a
 * prompt change: on-device prompts must be benchmarked before they ship (CLAUDE.md, "Gemma answer
 * quality"). Refactors of chatService.ts must leave these files untouched.
 */
interface GemmaCall {
  system: string;
  messages: ChatMessage[];
  echo?: string;
}
const gemmaCalls = vi.hoisted(() => [] as GemmaCall[]);
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: (args: GemmaCall) => {
    gemmaCalls.push(args);
    return Promise.resolve({ content: 'Câu trả lời.', model: 'gemma-test', truncated: false });
  },
}));
const picked = { current: 'cloud' as AnalysisEngine };
vi.mock('@/app/ai/engineChoice', () => ({
  analysisEngine: () => Promise.resolve(picked.current),
}));

const { askTeacher, contextPrompt, turnKind } = await import('./chatService');

type Kind = 'question' | 'premise' | 'learnerReply';
type Excerpts = 'none' | 'library' | 'imported';
type Turn = { role: string; content: string; prompt?: string };
interface Case {
  question: string;
  history: Turn[];
}

const LEVEL: Record<Locale, Level> = { vi: 'foundation', en: 'general' };

/** "none" asks a calculation without numbers (MISSING_DATA); "imported" adds a document + Wikipedia. */
const CASES: Record<Locale, Record<Excerpts, Record<Kind, Case>>> = {
  vi: {
    none: {
      question: { question: 'Tính quãng đường ô tô đi được.', history: [] },
      premise: {
        question: 'Có phải phải biết vận tốc mới tính được quãng đường ô tô đi được không?',
        history: [],
      },
      learnerReply: {
        question: 'Em chưa có số liệu ạ.',
        history: [
          { role: 'user', content: 'Tính quãng đường ô tô đi được.' },
          {
            role: 'assistant',
            content: 'Em cần biết vận tốc và thời gian. Em đã có các số đó chưa?',
          },
        ],
      },
    },
    library: {
      question: { question: 'Lực ma sát là gì?', history: [] },
      premise: { question: 'Có phải lực ma sát luôn cản trở chuyển động không?', history: [] },
      learnerReply: {
        question: 'Gia tốc tăng gấp đôi ạ.',
        history: [
          { role: 'user', content: 'Định luật II Newton nói gì?' },
          {
            role: 'assistant',
            content: 'a = F/m. Nếu khối lượng tăng gấp đôi mà lực giữ nguyên thì gia tốc thế nào?',
          },
        ],
      },
    },
    imported: {
      question: { question: 'Định luật Hooke cho lò xo nói gì?', history: [] },
      premise: {
        question: 'Có phải định luật Hooke đúng với mọi độ biến dạng của lò xo không?',
        history: [],
      },
      learnerReply: {
        question: 'Lực đàn hồi cũng tăng gấp đôi ạ.',
        history: [
          { role: 'user', content: 'Định luật Hooke cho lò xo nói gì?' },
          {
            role: 'assistant',
            content:
              'Lực đàn hồi tỉ lệ với độ biến dạng của lò xo. Nếu độ biến dạng tăng gấp đôi thì lực đàn hồi thế nào?',
          },
        ],
      },
    },
  },
  en: {
    none: {
      question: { question: 'Calculate the speed of the car.', history: [] },
      premise: {
        question: 'Is it true that I need the time to calculate the speed of the car?',
        history: [],
      },
      learnerReply: {
        question: 'No, I only have the distance.',
        history: [
          { role: 'user', content: 'Calculate the speed of the car.' },
          {
            role: 'assistant',
            content: 'You need the distance and the time. Do you have those numbers?',
          },
        ],
      },
    },
    library: {
      question: { question: 'What is friction?', history: [] },
      premise: { question: 'Is it true that friction always slows things down?', history: [] },
      learnerReply: {
        question: 'Yes, static friction holds it.',
        history: [
          { role: 'user', content: 'What is friction?' },
          {
            role: 'assistant',
            content:
              'Friction resists motion. If you push a heavy box and it does not move, is there friction?',
          },
        ],
      },
    },
    imported: {
      question: { question: "What does Hooke's law say about a spring?", history: [] },
      premise: {
        question: "Is it true that Hooke's law holds for any stretch of the spring?",
        history: [],
      },
      learnerReply: {
        question: 'The force doubles too.',
        history: [
          { role: 'user', content: "What does Hooke's law say about a spring?" },
          {
            role: 'assistant',
            content:
              'The spring force is proportional to the stretch. If the stretch doubles, what happens to the force?',
          },
        ],
      },
    },
  },
};

/** An earlier exchange: the note then moves from the instruction into the question's turn. */
const GREETING: Record<Locale, Turn[]> = {
  vi: [
    { role: 'user', content: 'Chào thầy ạ.' },
    { role: 'assistant', content: 'Chào em! Hôm nay em muốn học gì?' },
  ],
  en: [
    { role: 'user', content: 'Hello.' },
    { role: 'assistant', content: 'Hello! What would you like to learn today?' },
  ],
};

const DOCUMENT: Record<Locale, { name: string; text: string }> = {
  vi: {
    name: 'Ghi chép lò xo',
    text: 'Định luật Hooke: trong giới hạn đàn hồi, lực đàn hồi của lò xo tỉ lệ với độ biến dạng, F = k·Δl. Vượt quá giới hạn đàn hồi thì lò xo không trở lại hình dạng ban đầu.',
  },
  en: {
    name: 'Spring notes',
    text: "Hooke's law: within the elastic limit, the spring force is proportional to the stretch, F = k·Δl. Beyond the elastic limit the spring does not return to its shape.",
  },
};

/** Wikipedia answers with one fixed page (no network). */
function stubWikipedia(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('list=search')
              ? { query: { search: [{ title: 'Hooke' }] } }
              : {
                  query: {
                    pages: {
                      1: {
                        extract:
                          'Hooke’s law states that the force needed to extend a spring is proportional to the distance.',
                      },
                    },
                  },
                },
          ),
        ),
      ),
    ),
  );
}

function setExcerpts(locale: Locale, excerpts: Excerpts): void {
  const imported = excerpts === 'imported';
  useChatStore.setState({
    webLookup: imported,
    documents: imported ? [{ id: 'doc-1', ...DOCUMENT[locale], addedAt: 1 }] : [],
  });
  if (imported) stubWikipedia();
}

const SELECTION: BoardSelection = {
  face: 0,
  shape: 'closed',
  status: 'ok',
  points: [],
  bbox: { x: 300, y: 180, w: 300, h: 80 },
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
      boxes: [],
      x: 340,
      y: 200,
      index: 1,
    },
  ],
  title: 'Rơi tự do',
  neighbours: [{ id: 's1', text: '2. Viết công thức quãng đường:', math: false, status: null }],
  strokes: 0,
  figures: [],
};

const block = (title: string, parts: [string, string][]) =>
  [`===== ${title} =====`, ...parts.map(([name, text]) => `----- ${name} -----\n${text}`)].join(
    '\n',
  );

const messagesText = (messages: readonly ChatMessage[]) =>
  messages.map((m) => `[${m.role}]\n${m.content}`).join('\n');

type Prompt = Awaited<ReturnType<typeof contextPrompt>>;
const promptText = (title: string, p: Prompt) =>
  block(title, [
    ['system', p.system],
    ['note', p.note],
    ['selection', p.selection],
    ['references', p.references.join('\n')],
    ['missingData', JSON.stringify(p.missingData)],
  ]);

const records = (turns: readonly Turn[]): ChatMessageRecord[] =>
  turns.map((t, i) => ({
    id: `r${i}`,
    role: t.role as ChatMessageRecord['role'],
    content: t.content,
    createdAt: i,
  }));

beforeEach(() => {
  gemmaCalls.length = 0;
  picked.current = 'cloud';
  useAiStore.setState({ provider: 'gemini', fallback: 'groq' });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    verifierProvider: 'groq',
    verifierModel: '',
    messages: [],
    summary: null,
    webLookup: false,
    documents: [],
  });
});
afterEach(() => {
  setTransportForTests(null);
  vi.unstubAllGlobals();
  useChatStore.setState({ webLookup: false, documents: [] });
});

describe('golden contextPrompt', () => {
  it.each(['vi', 'en'] as const)('%s: locale × size × turn kind × excerpts', async (locale) => {
    useProfileStore.setState({ level: LEVEL[locale] });
    const out: string[] = [];
    for (const size of ['full', 'compact', 'tight'] as const) {
      for (const excerpts of ['none', 'library', 'imported'] as const) {
        for (const kind of ['question', 'premise', 'learnerReply'] as const) {
          const { question, history } = CASES[locale][excerpts][kind];
          // The matrix really covers each opening.
          expect(turnKind(question, history), `${locale}.${excerpts}.${kind}`).toBe(kind);
          setExcerpts(locale, excerpts);
          const p = await contextPrompt(
            question,
            locale,
            false,
            excerpts === 'imported',
            size,
            history,
          );
          out.push(promptText(`${size} · ${excerpts} · ${kind}`, p));
          vi.unstubAllGlobals();
        }
      }
    }
    // Board lesson, the circled part, a quick button and the shared screen.
    const library = CASES[locale].library.question.question;
    for (const size of ['full', 'compact'] as const) {
      out.push(
        promptText(
          `${size} · board`,
          await contextPrompt(library, locale, false, false, size, [], { board: true }),
        ),
        promptText(
          `${size} · board selection`,
          await contextPrompt(
            locale === 'vi' ? 'Công thức này ở đâu ra?' : 'Where does this formula come from?',
            locale,
            false,
            false,
            size,
            [],
            { board: true, boardSelection: SELECTION },
          ),
        ),
      );
      const remove = provideScreenContext(() =>
        locale === 'vi' ? 'Chủ đề: Rơi tự do. h = 20 m.' : 'Topic: Free fall. h = 20 m.',
      );
      out.push(
        promptText(`${size} · screen`, await contextPrompt(library, locale, true, false, size, [])),
      );
      remove();
    }
    const learnerReply = CASES[locale].library.learnerReply;
    out.push(
      promptText(
        'compact · quick action',
        await contextPrompt(
          locale === 'vi' ? 'Giảng lại chậm hơn, từng bước một.' : 'Explain again, more slowly.',
          locale,
          false,
          false,
          'compact',
          learnerReply.history,
          { quickAction: true },
        ),
      ),
    );
    await expect(`${out.join('\n\n')}\n`).toMatchFileSnapshot(
      `./__golden__/contextPrompt.${locale}.txt`,
    );
  });
});

/** What an online provider receives: the draft and Think's review. */
function cloudTransport(calls: ChatRequest[]): LlmTransport {
  return {
    chat: (req) => {
      calls.push(req);
      return Promise.resolve({
        content: 'Bước 1: lực ma sát cản trở chuyển động.',
        model: `${req.provider}-model`,
        durationMs: 1,
      });
    },
    models: () => Promise.resolve([]),
    setKey: () => Promise.resolve(),
    hasKey: () => Promise.resolve(true),
    deleteKey: () => Promise.resolve(),
  };
}

const requestText = (title: string, req: ChatRequest) =>
  block(title, [
    ['system', req.system],
    ['messages', messagesText(req.messages)],
  ]);

const gemmaText = (title: string, call: GemmaCall) =>
  block(title, [
    ['system', call.system],
    ['messages', messagesText(call.messages)],
    ['echo', call.echo ?? ''],
  ]);

describe('golden askTeacher requests', () => {
  it('sends byte-identical drafts, reviews and on-device turns', async () => {
    const out: string[] = [];
    for (const locale of ['vi', 'en'] as const) {
      useProfileStore.setState({ level: LEVEL[locale] });
      const { question } = CASES[locale].library.question;
      const { question: reply, history } = CASES[locale].library.learnerReply;

      // Online answer with Think: the draft (gemini) and the review (groq).
      picked.current = 'cloud';
      const calls: ChatRequest[] = [];
      setTransportForTests(cloudTransport(calls));
      await askTeacher(reply, locale, records(history), { includeScreen: false, think: true });
      const [draft, review] = calls;
      if (!draft || !review) throw new Error('expected a draft and a review');
      out.push(requestText(`${locale} · cloud draft`, draft));
      out.push(requestText(`${locale} · cloud review`, review));

      // Online board lesson (TeachScript) and a question about the circled part.
      calls.length = 0;
      await askTeacher(question, locale, [], { includeScreen: false, think: false, board: true });
      await askTeacher(
        locale === 'vi' ? 'Công thức này ở đâu ra?' : 'Where does this formula come from?',
        locale,
        [],
        {
          includeScreen: false,
          think: false,
          board: true,
          boardSelection: { selection: SELECTION },
        },
      );
      const [board, circled] = calls;
      if (!board || !circled) throw new Error('expected two cloud requests');
      out.push(requestText(`${locale} · cloud board`, board));
      out.push(requestText(`${locale} · cloud board selection`, circled));

      // On-device Gemma: the note last in the instruction, then in the turn after older turns.
      picked.current = 'gemma';
      useChatStore.setState({ engine: 'gemma' });
      await askTeacher(question, locale, [], { includeScreen: false, think: false });
      await askTeacher(reply, locale, records(history), { includeScreen: false, think: false });
      await askTeacher(question, locale, records(GREETING[locale]), {
        includeScreen: false,
        think: false,
      });
      await askTeacher(question, locale, [], { includeScreen: false, think: false, board: true });
      await askTeacher(
        locale === 'vi' ? 'Công thức này ở đâu ra?' : 'Where does this formula come from?',
        locale,
        [],
        { includeScreen: false, think: false, boardSelection: { selection: SELECTION } },
      );
      // Think on a Gemma draft: the reviewer reads the note that went into the turn.
      calls.length = 0;
      await askTeacher(question, locale, records(GREETING[locale]), {
        includeScreen: false,
        think: true,
      });
      const names = [
        'gemma',
        'gemma with history',
        'gemma note in turn',
        'gemma board',
        'gemma board selection',
        'gemma draft for Think',
      ];
      gemmaCalls.forEach((call, i) => out.push(gemmaText(`${locale} · ${names[i] ?? i}`, call)));
      expect(gemmaCalls).toHaveLength(names.length);
      const [gemmaReview] = calls;
      if (!gemmaReview || calls.length !== 1) throw new Error('expected one review request');
      out.push(requestText(`${locale} · review of the gemma draft`, gemmaReview));
      gemmaCalls.length = 0;
      useChatStore.setState({ engine: 'cloud' });
    }
    await expect(`${out.join('\n\n')}\n`).toMatchFileSnapshot('./__golden__/askTeacher.txt');
  });
});
