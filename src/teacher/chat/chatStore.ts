import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_MODELS, DEFAULT_PROVIDER, PROVIDERS } from '@/ai/aiStore';
import type { Provider } from '@/ai/types';

/**
 * Who answers: an online provider (`cloud`), the Gemma model inside the app (`gemma`) or a
 * runtime the learner runs on this computer (`local`: Ollama, LM Studio, llama.cpp…; chosen in
 * Settings → "AI trên máy khác", src/ai/local/localAiStore.ts).
 */
export type ChatEngine = 'cloud' | 'gemma' | 'local';
/** The engine in use before a local runtime was chosen ("Bỏ chọn" goes back to it). */
export interface PreviousEngine {
  engine: Exclude<ChatEngine, 'local'>;
  /** Whether the learner had picked it themselves (a pre-selected Gemma stays a suggestion). */
  chosen: boolean;
}
export type ChatRole = 'user' | 'assistant';
/**
 * How an answer was asked for: a board lesson (`board`), a chat answer (`talk`), or a question
 * about part of the board the learner circled (`aside`: read in the chat and aloud, never taught
 * on the board, which keeps its lesson). Answers saved before this field have none.
 */
export type AnswerMode = 'board' | 'talk' | 'aside';
/** The part of the board a question was about ("Khoanh để hỏi"). */
export interface BoardRef {
  face: number;
  /** The board elements circled. */
  ids: string[];
  /** What was circled, as the board holds it (short; '' for a drawing or handwriting). */
  excerpt: string;
}
/**
 * Why a Think answer was not reviewed: `picture` = a question about a picture of the circled area
 * (answered on this computer only; its reading of the learner's drawing never goes online).
 */
export type ReviewSkipped = 'picture';
/** How much of the conversation is sent with each question (Settings → "Trí nhớ hội thoại"). */
export type MemoryLength = 'medium' | 'long';
export interface ChatMessageRecord {
  id: string;
  role: ChatRole;
  /** What the learner sees. */
  content: string;
  /** What the AI received, when it differs from `content` (quick buttons send full instructions). */
  prompt?: string;
  model?: string;
  checkedBy?: string;
  /**
   * The quota fallback wrote the answer (or its continued part): the chosen provider was out of
   * quota or credit. The AI label says "dự phòng".
   */
  fallback?: boolean;
  /** A Think answer continued with "Viết tiếp": the continued part was not reviewed. */
  continuedUnreviewed?: boolean;
  /** Think was on but this answer was not reviewed, and why (the chat says so under it). */
  reviewSkipped?: ReviewSkipped;
  references?: string[];
  /**
   * Results SimLab computed for this question (exact chemical balancing…), shown by the app next
   * to the answer: a small model may garble them in its own text (benchmark 2026-10-13).
   */
  facts?: string[];
  /** The answer stopped at the output limit: the chat offers "Viết tiếp". */
  truncated?: boolean;
  /** The app found a calculation request without numbers and shows its own notice above. */
  missingData?: boolean;
  /** Values in the answer nobody gave the AI (provenance.ts), shown as "chưa kiểm chứng". */
  unverifiedNumbers?: string[];
  /** Answers: how it was asked for (an `aside` is never taught on the board). */
  mode?: AnswerMode;
  /**
   * Questions about part of the board: what was circled. Never in `content` or `prompt`: the
   * numbers there are the board's, not the learner's (provenance), and the board flags its own.
   */
  boardRef?: BoardRef;
}
/** AI-written summary of the turns that no longer fit the context budget (kept on this computer). */
export interface ChatSummary {
  text: string;
  /** Id of the last message the summary covers. */
  upto: string;
}
/** Messages kept on this computer (oldest dropped first). */
export const STORED_MESSAGES = 80;

export interface KnowledgeDocument {
  id: string;
  name: string;
  text: string;
  addedAt: number;
}

interface ChatState {
  engine: ChatEngine;
  /** True once the learner picked the engine themselves (the default is only a suggestion). */
  engineChosen: boolean;
  /** The engine before the local runtime was chosen; restored only by "Bỏ chọn". */
  previousEngine: PreviousEngine;
  gemmaModel: string;
  verifierProvider: Provider;
  verifierModel: string;
  thinkEnabled: boolean;
  includeScreen: boolean;
  /** Opt-in: send the question to Wikipedia for an extra excerpt. */
  webLookup: boolean;
  /** Keep the conversation on this computer between sessions (off: forgotten on exit). */
  saveHistory: boolean;
  messages: ChatMessageRecord[];
  documents: KnowledgeDocument[];
  memoryLength: MemoryLength;
  summary: ChatSummary | null;
  /**
   * The model that could not write a summary of this conversation ("writer|first message id"):
   * it is not asked again until the conversation or the model changes (not persisted).
   */
  summarySkip: string | null;
  /** A question is being answered (not persisted; the board shows "preparing"). */
  answering: boolean;
  /**
   * Stops the answer being written ("Dừng"), from whichever panel shows it (not persisted).
   * Set by the panel that asked; null when nothing is being answered.
   */
  stopAnswer: (() => void) | null;
  /** The last answer was stopped by the learner: the chat says so (not persisted). */
  stopped: boolean;
  /**
   * Which conversation this is: "Xóa cuộc trò chuyện" moves to the next one (not persisted). An
   * answer or summary that was being written for an earlier conversation is dropped.
   */
  epoch: number;
  /** The learner's own choice of engine (marks it as chosen). */
  setEngine: (engine: ChatEngine) => void;
  /**
   * "Bỏ chọn" in Settings → AI trên máy khác: back to the engine used before the local runtime
   * was chosen (as it was: chosen or only suggested). Never called on its own.
   */
  leaveLocal: () => void;
  setGemmaModel: (model: string) => void;
  setVerifierProvider: (provider: Provider) => void;
  setVerifierModel: (model: string) => void;
  setThinkEnabled: (enabled: boolean) => void;
  setIncludeScreen: (enabled: boolean) => void;
  setWebLookup: (enabled: boolean) => void;
  setSaveHistory: (enabled: boolean) => void;
  addMessage: (message: ChatMessageRecord) => void;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessageRecord, 'id' | 'role'>>) => void;
  /** Also forgets the summary (it describes the cleared messages) and starts a new epoch. */
  clearMessages: () => void;
  setMemoryLength: (length: MemoryLength) => void;
  setSummary: (summary: ChatSummary | null) => void;
  addDocument: (document: KnowledgeDocument) => void;
  removeDocument: (id: string) => void;
}

const defaultVerifier: Provider =
  DEFAULT_PROVIDER !== 'groq' && PROVIDERS.includes('groq')
    ? 'groq'
    : (PROVIDERS.find((p) => p !== DEFAULT_PROVIDER) ?? DEFAULT_PROVIDER);

const isEngine = (v: unknown): v is ChatEngine => v === 'cloud' || v === 'gemma' || v === 'local';

/** The engine to go back to from `local` (the one in use before it was chosen). */
function previousOf(engine: ChatEngine, chosen: boolean, kept: PreviousEngine): PreviousEngine {
  return engine === 'local' ? kept : { engine, chosen };
}

function sanitizePrevious(v: unknown, engine: ChatEngine, chosen: boolean): PreviousEngine {
  const o = (v ?? {}) as { engine?: unknown; chosen?: unknown };
  if ((o.engine === 'cloud' || o.engine === 'gemma') && typeof o.chosen === 'boolean')
    return { engine: o.engine, chosen: o.chosen };
  // Older versions: the engine itself (it cannot be `local` there).
  return engine === 'local' ? { engine: 'gemma', chosen: false } : { engine, chosen };
}

/**
 * v6 adds the local runtime engine and the engine to go back to; v4/v5 settings are kept as they
 * were (the engine included). An unknown engine (a newer version's) becomes the default.
 */
function migrateV6(state: unknown): Partial<ChatState> {
  const o = (state ?? {}) as Partial<ChatState> & { previousEngine?: unknown };
  const engine: ChatEngine = isEngine(o.engine) ? o.engine : 'gemma';
  const chosen = isEngine(o.engine) && o.engineChosen === true;
  return {
    ...o,
    engine,
    engineChosen: chosen,
    previousEngine: sanitizePrevious(o.previousEngine, engine, chosen),
  };
}

const GEMMA_ID_MAP: Record<string, string> = {
  'gemma3:270m': 'gemma3-270m',
  'gemma3:1b': 'gemma3-1b',
  'gemma3:4b': 'gemma4-e2b',
  'gemma3-270m': 'gemma3-270m',
  'gemma3-1b': 'gemma3-1b',
  'gemma3-4b': 'gemma4-e2b',
};

/**
 * v1 used Ollama tags (`gemma3:1b`); v2 in-browser ids; v3 retires the 4B slot for E2B;
 * v4 adds the opt-in Wikipedia lookup (off for everyone, including old installs that
 * used to query Wikipedia silently).
 */
function migrateChatSettings(old: unknown): {
  engine: ChatEngine;
  engineChosen: boolean;
  gemmaModel: string;
  verifierProvider: Provider;
  verifierModel: string;
  webLookup: boolean;
  messages: ChatMessageRecord[];
  documents: KnowledgeDocument[];
} {
  const o = (old ?? {}) as {
    engine?: unknown;
    gemmaModel?: unknown;
    verifierProvider?: unknown;
    verifierModel?: unknown;
    messages?: unknown;
    documents?: unknown;
  };
  const rawModel = typeof o.gemmaModel === 'string' ? o.gemmaModel : 'gemma3-1b';
  return {
    engine: o.engine === 'gemma' ? 'gemma' : 'cloud',
    // Older versions did not record whether the engine was picked or just the default.
    engineChosen: false,
    gemmaModel: GEMMA_ID_MAP[rawModel] ?? 'gemma3-1b',
    verifierProvider:
      typeof o.verifierProvider === 'string' &&
      (PROVIDERS as readonly string[]).includes(o.verifierProvider)
        ? (o.verifierProvider as Provider)
        : defaultVerifier,
    verifierModel:
      typeof o.verifierModel === 'string' ? o.verifierModel : DEFAULT_MODELS[defaultVerifier],
    webLookup: false,
    messages: Array.isArray(o.messages) ? (o.messages as ChatMessageRecord[]) : [],
    documents: Array.isArray(o.documents) ? (o.documents as KnowledgeDocument[]) : [],
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Gemma runs inside the app with nothing to install, so new installs start on it.
      engine: 'gemma',
      engineChosen: false,
      previousEngine: { engine: 'gemma', chosen: false },
      gemmaModel: 'gemma3-1b',
      verifierProvider: defaultVerifier,
      verifierModel: DEFAULT_MODELS[defaultVerifier],
      thinkEnabled: false,
      includeScreen: false,
      webLookup: false,
      saveHistory: true,
      messages: [],
      documents: [],
      memoryLength: 'medium',
      summary: null,
      summarySkip: null,
      answering: false,
      stopAnswer: null,
      stopped: false,
      epoch: 0,
      setEngine: (engine) => {
        const s = get();
        set({
          engine,
          engineChosen: true,
          // Choosing the local runtime remembers what was in use before it.
          previousEngine:
            engine === 'local'
              ? previousOf(s.engine, s.engineChosen, s.previousEngine)
              : { engine, chosen: true },
        });
      },
      leaveLocal: () => {
        const s = get();
        if (s.engine !== 'local') return;
        set({ engine: s.previousEngine.engine, engineChosen: s.previousEngine.chosen });
      },
      setGemmaModel: (gemmaModel) => set({ gemmaModel }),
      setVerifierProvider: (verifierProvider) =>
        set({ verifierProvider, verifierModel: DEFAULT_MODELS[verifierProvider] }),
      setVerifierModel: (verifierModel) => set({ verifierModel }),
      setThinkEnabled: (thinkEnabled) => set({ thinkEnabled }),
      setIncludeScreen: (includeScreen) => set({ includeScreen }),
      setWebLookup: (webLookup) => set({ webLookup }),
      setSaveHistory: (saveHistory) => set({ saveHistory }),
      addMessage: (message) =>
        set({ messages: [...get().messages, message].slice(-STORED_MESSAGES) }),
      updateMessage: (id, patch) =>
        set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      clearMessages: () =>
        set({ messages: [], summary: null, summarySkip: null, epoch: get().epoch + 1 }),
      setMemoryLength: (memoryLength) =>
        set({ memoryLength: memoryLength === 'long' ? 'long' : 'medium' }),
      setSummary: (summary) => set({ summary }),
      addDocument: (document) => {
        const docs = get().documents.filter((d) => d.name !== document.name);
        if (docs.length >= 20) docs.shift();
        set({ documents: [...docs, document] });
      },
      removeDocument: (id) => set({ documents: get().documents.filter((d) => d.id !== id) }),
    }),
    {
      name: 'stemsim.teacher-chat',
      // v5 adds the memory length, the summary and "save history"; v6 the local runtime engine.
      version: 6,
      storage: createJSONStorage(() => localStorage),
      migrate: (state, version) =>
        migrateV6(version >= 4 ? state : migrateChatSettings(state)) as ChatState,
      partialize: ({
        engine,
        engineChosen,
        previousEngine,
        gemmaModel,
        verifierProvider,
        verifierModel,
        webLookup,
        saveHistory,
        messages,
        documents,
        memoryLength,
        summary,
      }) => ({
        engine,
        engineChosen,
        previousEngine,
        gemmaModel,
        verifierProvider,
        verifierModel,
        webLookup,
        saveHistory,
        // "Không lưu lịch sử": the conversation (and its summary) lives only until the app closes.
        messages: saveHistory ? messages : [],
        documents,
        memoryLength,
        summary: saveHistory ? summary : null,
      }),
    },
  ),
);
