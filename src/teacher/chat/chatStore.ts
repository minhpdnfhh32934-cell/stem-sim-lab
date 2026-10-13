import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_MODELS, DEFAULT_PROVIDER, PROVIDERS } from '@/ai/aiStore';
import type { Provider } from '@/ai/types';

export type ChatEngine = 'cloud' | 'gemma';
export type ChatRole = 'user' | 'assistant';
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
  references?: string[];
  /** The answer stopped at the output limit: the chat offers "Viết tiếp". */
  truncated?: boolean;
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
  /** A question is being answered (not persisted; the board shows "preparing"). */
  answering: boolean;
  /** The learner's own choice of engine (marks it as chosen). */
  setEngine: (engine: ChatEngine) => void;
  setGemmaModel: (model: string) => void;
  setVerifierProvider: (provider: Provider) => void;
  setVerifierModel: (model: string) => void;
  setThinkEnabled: (enabled: boolean) => void;
  setIncludeScreen: (enabled: boolean) => void;
  setWebLookup: (enabled: boolean) => void;
  setSaveHistory: (enabled: boolean) => void;
  addMessage: (message: ChatMessageRecord) => void;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessageRecord, 'id' | 'role'>>) => void;
  /** Also forgets the summary (it describes the cleared messages). */
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
      answering: false,
      setEngine: (engine) => set({ engine, engineChosen: true }),
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
      clearMessages: () => set({ messages: [], summary: null }),
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
      // v5 adds the memory length, the summary and "save history"; v4 settings are kept.
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (state, version) =>
        (version >= 4 ? state : migrateChatSettings(state)) as Partial<ChatState>,
      partialize: ({
        engine,
        engineChosen,
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
