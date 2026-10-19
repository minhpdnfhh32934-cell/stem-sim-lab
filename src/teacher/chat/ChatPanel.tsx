import {
  ArrowDownToLine,
  Bot,
  Calculator,
  Check,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  RotateCcw,
  FlaskConical,
  Globe,
  LassoSelect,
  LoaderCircle,
  Maximize2,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useAiStore } from '@/ai/aiStore';
import { PROVIDER_NAME } from '@/app/ai/aiStatusView';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { getTransport } from '@/ai/transport';
import { useChatStore, type ChatEngine, type ChatMessageRecord } from './chatStore';
import { MessageBody } from './MessageBody';
import { boardAnswerText, subtitleText } from '@/teacher/board/lesson';
import { useBoardStore } from '@/teacher/board/boardStore';
import { askable, cut, selectionExcerpt, type BoardSelection } from '@/teacher/board/selection';
import { BOARD_ASK_EVENT } from '@/teacher/board/boardAsk';
import {
  canSpeakOnDevice,
  speak,
  speechSupported,
  stopSpeaking,
  vietnameseVoices,
  voicesWhenLoaded,
} from '@/teacher/voice/speak';
import { toast } from '@/ui/toast';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { AnswerStopped, TeacherError, askTeacher, type ReplyMetadata } from './chatService';
import { useTeacherStore } from '@/teacher/teacherStore';
import { CONTINUE_PROMPT, answersPicture, asksAboutPicture, joinContinuation } from './memory';
import { cx } from '@/ui/cx';
import { useT, type MessageKey } from '@/app/i18n';
import { gemmaReady } from '@/ai/gemmaTransport';
import { webGPUStatus } from '@/ai/webGemma';
import { AiContentBar } from '@/safety/AiContentBar';
import { engineKind, useAnalysisEngine } from '@/app/ai/engineChoice';
import { runtimeName } from '@/app/ai/localRuntime';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { openTopic, useActiveTopic } from '@/app/topics';
import { latestTopic } from './topicLink';
import { chipNumbers } from './provenance';
import { usePictureReader } from './pictureReader';

/**
 * What went wrong with the last answer: the learner's sentence, the Settings page that helps,
 * and "Hỏi lại" when asking again may work (one click, one new request — never automatic).
 */
interface ChatFailure {
  text: string;
  section: SettingsSection | null;
  /** What "Hỏi lại" asks again (null: asking again would not help). */
  retry: RetryAsk | null;
}
/** A failed question (it has no answer) or a failed "Viết tiếp" of an answer. */
type RetryAsk =
  | { kind: 'ask'; id: string; shown: string; prompt: string | undefined; options: SubmitOptions }
  | { kind: 'continue'; id: string };

/** How a question is sent, besides its text. */
interface SubmitOptions {
  /**
   * Sent by a quick button ("Giải thích lại", "Chậm hơn"…): a request about the last answer,
   * never an answer to the teacher's check question (turnKind). Said by the caller, never guessed
   * from the instruction it sends.
   */
  quickAction?: boolean;
  /** About part of the board the learner circled ("Khoanh để hỏi"): answered in the chat. */
  selection?: BoardSelection;
}

export function ChatPanel({
  compact = false,
  showScreenContext = true,
  teacherPage = false,
  onClose,
  onExpand,
}: {
  compact?: boolean;
  showScreenContext?: boolean;
  teacherPage?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
}) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const provider = useAiStore((s) => s.provider);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const chat = useChatStore();
  // The engine that will really answer (a pre-selected Gemma without a model → the API; a chosen
  // local runtime stays local, also before one is picked).
  const chosenEngine = useAnalysisEngine();
  const engine = engineKind(chosenEngine);
  const fallbackChoice = useAiStore((s) => s.fallback);
  // The quota fallback (Settings → Kết nối AI): while the provider is out of quota the gateway asks
  // it instead, for a while without trying the provider first. Never with Think (every Think call
  // is sent without it), nor for another engine.
  const fallbackProvider =
    engine === 'cloud' &&
    provider !== 'off' &&
    !chat.thinkEnabled &&
    fallbackChoice !== 'off' &&
    fallbackChoice !== provider
      ? fallbackChoice
      : null;
  const localSelection = useLocalAiStore((s) => s.selected);
  const voiceEnabled = useVoiceStore((s) => s.enabled);
  // The Gemini voice reads every answer (chat and board) through Google: the text goes online.
  const voiceOnline = useVoiceStore((s) => s.enabled && s.engine === 'gemini');
  const setVoiceEnabled = useVoiceStore((s) => s.setEnabled);
  const voiceSpeaking = useVoiceStore((s) => s.speaking);
  const [draft, setDraft] = useState('');
  // What the learner circled on the board, when a question can carry it (the board layout of the
  // teacher page; readable text, or a picture for an AI on this computer that reads pictures).
  const pictureReader = usePictureReader(chosenEngine);
  const circled = useBoardStore((s) => s.selection);
  // On the board the lesson reads itself sentence by sentence, in step with the pen (Whiteboard).
  // `board` asks the AI for a board lesson; who reads an answer is decided when it arrives
  // (`boardOwnsVoice`), because the learner may switch layouts while the AI is answering.
  const board = useTeacherStore((s) => teacherPage && s.layout === 'board');
  const boardOwnsVoice = () => teacherPage && useTeacherStore.getState().layout === 'board';
  /**
   * Who reads an answer aloud, decided when it arrives: the chat, unless the board reads it as a
   * lesson. An answer about part of the board (an aside) is never taught on the board, so the
   * chat reads it, while the board's lesson waits (paused); not over a lesson that goes on.
   */
  const speaksInChat = (aside: boolean) =>
    aside ? useBoardStore.getState().status !== 'playing' : !boardOwnsVoice();
  /**
   * Quiet before a new question. A board lesson that is speaking is left alone: the board pauses
   * it when the chat starts answering (Whiteboard), so the sentence it cuts is read again on
   * "Tiếp tục"; stopping the voice here would lose that sentence.
   */
  const quietBeforeAsking = () => {
    if (boardOwnsVoice() && useBoardStore.getState().status === 'playing') return;
    stopSpeaking();
  };
  /** Answers about a circled picture that were not read aloud (the chosen voice reads online). */
  const [unread, setUnread] = useState<readonly string[]>([]);
  /**
   * Reads an answer aloud. An answer about a circled picture is the on-device model's reading of
   * the learner's strokes and stays on this computer: only a voice that reads here says it (the
   * on-device voice, a Windows voice that is not an online one), never the Gemini voice or an
   * online Windows voice. Otherwise it is not read, and the chat says so under the answer.
   */
  const readAloud = (text: string, id: string, aside: boolean, staysHere: boolean) => {
    if (!useVoiceStore.getState().enabled || !speaksInChat(aside)) return;
    if (!staysHere) {
      void speak(text);
      return;
    }
    void canSpeakOnDevice().then((ok) => {
      if (!ok) {
        setUnread((ids) => (ids.includes(id) ? ids : [...ids, id]));
        return;
      }
      // Asked again once the voice list is known (it may take a moment to load): a newer question,
      // or the lesson that went on meanwhile, is heard instead of this answer.
      if (
        useVoiceStore.getState().enabled &&
        !useChatStore.getState().answering &&
        speaksInChat(aside)
      ) {
        void speak(text, { onDevice: true });
      }
    });
  };
  const [busy, setLocalBusy] = useState(false);
  const setBusy = (value: boolean) => {
    setLocalBusy(value);
    useChatStore.setState({ answering: value });
  };
  const [error, setError] = useState<ChatFailure | null>(null);
  /** The on-device answer as it is being written (null when nothing is streaming). */
  const [streaming, setStreaming] = useState<string | null>(null);
  /** Latest cloud-key lookup, tagged so a stale answer never overrides a newer engine/provider. */
  const [keyLookup, setKeyLookup] = useState<{ id: string; available: boolean } | null>(null);
  /** Latest Gemma readiness lookup, tagged by model name for the same reason. */
  const [gemmaLookup, setGemmaLookup] = useState<{ model: string; ready: boolean } | null>(null);
  /** Think needs a key for the reviewing provider; checked up front so the learner knows why. */
  const [verifierLookup, setVerifierLookup] = useState<{ id: string; available: boolean } | null>(
    null,
  );
  /** Whether the quota fallback has a key (it can only be asked then), tagged by provider. */
  const [fallbackLookup, setFallbackLookup] = useState<{ id: string; available: boolean } | null>(
    null,
  );
  const messagesEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (engine !== 'cloud' || provider === 'off') return;
    const id = `${engine}/${provider}`;
    let alive = true;
    void getTransport()
      .hasKey(provider)
      .then((v) => {
        if (alive) setKeyLookup({ id, available: v });
      })
      .catch(() => {
        if (alive) setKeyLookup({ id, available: false });
      });
    return () => {
      alive = false;
    };
  }, [engine, chat.gemmaModel, provider]);

  useEffect(() => {
    const refreshKey = () => {
      if (engine === 'cloud' && provider !== 'off') {
        const id = `${engine}/${provider}`;
        void getTransport()
          .hasKey(provider)
          .then((available) => {
            setKeyLookup({ id, available });
          })
          .catch(() => {
            setKeyLookup({ id, available: false });
          });
      }
    };
    window.addEventListener('stemsim:credentials-changed', refreshKey);
    return () => {
      window.removeEventListener('stemsim:credentials-changed', refreshKey);
    };
  }, [engine, provider]);

  useEffect(() => {
    if (engine !== 'gemma') return;
    const model = chat.gemmaModel;
    let alive = true;
    void gemmaReady(model)
      .then((ready) => {
        if (alive) setGemmaLookup({ model, ready });
      })
      .catch(() => {
        if (alive) setGemmaLookup({ model, ready: false });
      });
    return () => {
      alive = false;
    };
  }, [engine, chat.gemmaModel]);

  useEffect(() => {
    if (engine !== 'gemma') return;
    const model = chat.gemmaModel;
    const refreshGemma = () => {
      void gemmaReady(model)
        .then((ready) => {
          setGemmaLookup({ model, ready });
        })
        .catch(() => {
          setGemmaLookup({ model, ready: false });
        });
    };
    window.addEventListener('stemsim:gemma-changed', refreshGemma);
    return () => {
      window.removeEventListener('stemsim:gemma-changed', refreshGemma);
    };
  }, [engine, chat.gemmaModel]);

  useEffect(() => {
    if (!chat.thinkEnabled) return;
    const checker = chat.verifierProvider;
    let alive = true;
    const lookup = () => {
      void getTransport()
        .hasKey(checker)
        .then((available) => {
          if (alive) setVerifierLookup({ id: checker, available });
        })
        .catch(() => {
          if (alive) setVerifierLookup({ id: checker, available: false });
        });
    };
    lookup();
    window.addEventListener('stemsim:credentials-changed', lookup);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:credentials-changed', lookup);
    };
  }, [chat.thinkEnabled, chat.verifierProvider]);

  useEffect(() => {
    if (fallbackProvider === null) return;
    const id = fallbackProvider;
    let alive = true;
    const lookup = () => {
      void getTransport()
        .hasKey(id)
        .then((available) => {
          if (alive) setFallbackLookup({ id, available });
        })
        .catch(() => {
          if (alive) setFallbackLookup({ id, available: false });
        });
    };
    lookup();
    window.addEventListener('stemsim:credentials-changed', lookup);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:credentials-changed', lookup);
    };
  }, [fallbackProvider]);

  useEffect(() => {
    const node = messagesEnd.current;
    if (node?.scrollIntoView) node.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat.messages, busy, error, streaming]);

  // Never keep reading after the panel goes away.
  useEffect(() => stopSpeaking, []);

  // A question another screen wrote for the learner (openTeacherWithQuestion, e.g. "Hỏi thầy về
  // bộ phận này" in the 3D mitosis view; askInBubble for the bubble, e.g. "Hỏi thầy" in Science
  // Studio): put into this panel's box once, never sent here.
  // The learner reads it, may change it, and presses send. The box takes it while rendering (a
  // change of the store's value), then the store forgets it so it is not offered twice.
  const offered = useTeacherStore((s) => (teacherPage ? s.draft : s.bubbleDraft));
  const [lastOffered, setLastOffered] = useState<string | null>(null);
  if (offered !== lastOffered) {
    setLastOffered(offered);
    if (offered !== null) setDraft(offered);
  }
  useEffect(() => {
    if (offered === null) return;
    useTeacherStore.setState(teacherPage ? { draft: null } : { bubbleDraft: null });
    input.current?.focus();
  }, [offered, teacherPage]);

  /**
   * "Dừng": one controller per answer, reachable from any open panel through the store (the
   * bubble may have asked before the learner expanded it). A stopped answer leaves no message,
   * only the app's line saying it was stopped.
   */
  const startAnswer = () => {
    const controller = new AbortController();
    const stop = () => {
      controller.abort();
    };
    useChatStore.setState({ stopAnswer: stop, stopped: false });
    return { controller, stop };
  };
  /** True when the answer ended because the learner stopped it (no error is shown then). */
  const endAnswer = (answer: ReturnType<typeof startAnswer>, e?: unknown): boolean => {
    const stopped =
      e !== undefined && (e instanceof AnswerStopped || answer.controller.signal.aborted);
    useChatStore.setState((s) => ({
      // Only this answer's "Dừng" is removed (another panel may have started a newer one).
      stopAnswer: s.stopAnswer === answer.stop ? null : s.stopAnswer,
      stopped,
    }));
    return stopped;
  };

  /** The failure to show; "Hỏi lại" is offered only when asking again may work. */
  const failureOf = (e: unknown, again: RetryAsk): ChatFailure => ({
    text: e instanceof Error ? e.message : String(e),
    section: e instanceof TeacherError ? e.section : null,
    retry: e instanceof TeacherError && e.retry ? again : null,
  });

  /**
   * Sends a question. `prompt` is what the AI receives when it differs from what the learner
   * sees (the quick buttons show "Chậm hơn" but send a full instruction). With a selection, the
   * question is about that part of the board: the answer is an aside (chat and voice), and the
   * board keeps its lesson.
   */
  const submit = async (text = draft, prompt?: string, options: SubmitOptions = {}) => {
    const shown = text.trim();
    const question = (prompt ?? shown).trim();
    // Another panel (the bubble before "Mở rộng") may still be answering: a second answer would
    // take over its "Dừng", so the first one could no longer be stopped.
    if (!question || busy || useChatStore.getState().answering) return;
    quietBeforeAsking();
    // Busy at once (in the store too): a second click or Enter while the picture below is made
    // would otherwise send the same question twice.
    setBusy(true);
    const selection = options.selection;
    // A part of the board without text goes as a picture, only to an AI on this computer that
    // reads pictures (pictureReader.ts); the picture is made before anything is sent.
    let image: ArrayBuffer | undefined;
    if (selection?.status === 'picture') {
      const made = await import('@/teacher/board/selectionImage')
        .then(({ selectionPicture }) =>
          selectionPicture(selection, useBoardStore.getState().strokes),
        )
        .catch(() => null);
      if (!made) {
        setBusy(false);
        setError({ text: t('chat.errors.boardPicture'), section: null, retry: null });
        return;
      }
      image = made;
    }
    setError(null);
    const userMessage: ChatMessageRecord = {
      id: crypto.randomUUID(),
      role: 'user',
      content: shown,
      ...(prompt ? { prompt: question } : {}),
      ...(selection
        ? {
            boardRef: {
              face: selection.face,
              ids: selection.hits.map((h) => h.id),
              excerpt: selectionExcerpt(selection),
            },
          }
        : {}),
    };
    // Read now, not from the last render: "Hỏi lại" may run right after taking the failed
    // question back.
    const prior = useChatStore.getState().messages;
    chat.addMessage(userMessage);
    setDraft('');
    const answer = startAnswer();
    const controller = answer.controller;
    try {
      const result = await askTeacher(question, locale, prior, {
        includeScreen: showScreenContext && chat.includeScreen,
        think: chat.thinkEnabled,
        // A question about part of the board is answered in the chat, never as a new lesson.
        board: board && !selection,
        signal: controller.signal,
        quickAction: options.quickAction === true,
        onPartial: (text) => {
          if (!controller.signal.aborted) setStreaming(text || null);
        },
        ...(selection ? { boardSelection: { selection, ...(image ? { image } : {}) } } : {}),
      });
      const meta = result.metadata;
      const answerId = crypto.randomUUID();
      chat.addMessage({
        id: answerId,
        role: 'assistant',
        content: result.content,
        model: meta.model,
        ...(meta.checkedBy ? { checkedBy: meta.checkedBy } : {}),
        ...(meta.reviewSkipped ? { reviewSkipped: meta.reviewSkipped } : {}),
        ...(meta.fallback ? { fallback: true } : {}),
        ...(meta.references.length ? { references: meta.references } : {}),
        ...(meta.facts.length ? { facts: meta.facts } : {}),
        ...(result.truncated ? { truncated: true } : {}),
        ...(meta.missingData ? { missingData: true } : {}),
        // Always set, even empty: an answer without the field (older versions) was never checked
        // and its numbers are not taken as given later (chatService.givenNumbers).
        unverifiedNumbers: meta.unverifiedNumbers,
        mode: selection ? 'aside' : board ? 'board' : 'talk',
      });
      endAnswer(answer);
      readAloud(
        result.content,
        answerId,
        selection !== undefined,
        asksAboutPicture(userMessage) || meta.reviewSkipped === 'picture',
      );
    } catch (e) {
      if (!endAnswer(answer, e)) {
        setError(failureOf(e, { kind: 'ask', id: userMessage.id, shown, prompt, options }));
      }
    } finally {
      setStreaming(null);
      setBusy(false);
      input.current?.focus();
    }
  };

  /** "Viết tiếp": asks for the rest of an answer that stopped at the output limit. */
  const continueAnswer = async (message: ChatMessageRecord) => {
    if (busy || useChatStore.getState().answering) return;
    quietBeforeAsking();
    setError(null);
    setBusy(true);
    const answer = startAnswer();
    const controller = answer.controller;
    try {
      const messages = useChatStore.getState().messages;
      const index = messages.findIndex((m) => m.id === message.id);
      const upto = messages.slice(0, index + 1);
      // The rest of an answer about a circled picture stays on this computer like its start.
      const staysHere = answersPicture(messages, index) || message.reviewSkipped === 'picture';
      const result = await askTeacher(CONTINUE_PROMPT[locale], locale, upto, {
        includeScreen: showScreenContext && chat.includeScreen,
        think: false,
        continues: true,
        // The rest of a reviewed answer, or any while Think is on, goes to the answering
        // provider only, never to the quota fallback (Settings → "Dữ liệu của em đi đâu?").
        noFallback: useChatStore.getState().thinkEnabled || message.checkedBy !== undefined,
        // The rest of an answer about part of the board stays a chat answer.
        board: board && message.mode !== 'aside',
        signal: controller.signal,
      });
      // An answer saved before the check existed stays unchecked as a whole (it is checked again
      // when it is used as history); otherwise both parts' lists are kept.
      const unverified = message.unverifiedNumbers && [
        ...new Set([...message.unverifiedNumbers, ...result.metadata.unverifiedNumbers]),
      ];
      chat.updateMessage(message.id, {
        content: joinContinuation(message.content, result.content),
        truncated: result.truncated,
        ...(unverified ? { unverifiedNumbers: unverified } : {}),
        // The rest is written without Think: a reviewed answer says its new part was not.
        ...(message.checkedBy ? { continuedUnreviewed: true } : {}),
        ...continuationLabel(message, result.metadata),
      });
      endAnswer(answer);
      readAloud(result.content, message.id, message.mode === 'aside', staysHere);
    } catch (e) {
      if (!endAnswer(answer, e)) {
        setError(failureOf(e, { kind: 'continue', id: message.id }));
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * "Hỏi lại" (the learner's click; never automatic): a failed question, which has no answer, is
   * taken back and asked once more, so the conversation does not show it twice; a failed
   * "Viết tiếp" is tried once more.
   */
  const askAgain = (retry: RetryAsk) => {
    const { messages } = useChatStore.getState();
    if (retry.kind === 'continue') {
      const message = messages.find((m) => m.id === retry.id);
      if (message) void continueAnswer(message);
      return;
    }
    if (messages.at(-1)?.id === retry.id)
      useChatStore.setState({ messages: messages.slice(0, -1) });
    void submit(retry.shown, retry.prompt, retry.options);
  };
  const lastMessage = chat.messages[chat.messages.length - 1];
  // "Viết tiếp" belongs to the lesson's answer even after questions about the board (asides).
  const lastLessonAnswer = chat.messages.findLast(
    (m) => m.role === 'assistant' && m.mode !== 'aside',
  );
  /** The circled part a question carries now (the chip above the box), or undefined. */
  const boardAsk =
    teacherPage && board && askable(circled, pictureReader !== null) && circled
      ? circled
      : undefined;
  const withBoard = boardAsk !== undefined;
  // "Hỏi thầy chỗ này" on the board (BOARD_ASK_EVENT): the draft, or the default question, about
  // what was circled. One listener at a time (React StrictMode mounts effects twice in
  // development); it calls the latest render's question so it never sends a stale draft.
  const askAboutBoard = useRef<() => void>(() => undefined);
  useEffect(() => {
    askAboutBoard.current = () => {
      if (!boardAsk) return;
      void submit(draft.trim() || t('board.ask.defaultQuestion'), undefined, {
        selection: boardAsk,
      });
    };
  });
  useEffect(() => {
    if (!teacherPage) return;
    const onAsk = () => {
      askAboutBoard.current();
    };
    window.addEventListener(BOARD_ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener(BOARD_ASK_EVENT, onAsk);
    };
  }, [teacherPage]);
  const hasAnswer = chat.messages.some((m) => m.role === 'assistant');
  // The simulation the last question names (audit EDU-03): found in the catalog, not by the AI.
  const activeTopic = useActiveTopic();
  // The latest question's topic: a short reply ("Ở kì giữa ạ.") keeps the link of the question
  // it follows; an unrelated new question drops it.
  const simLink = hasAnswer ? latestTopic(chat.messages, locale) : null;
  // A question may still be answered by another panel (the bubble before "Mở rộng").
  const answering = useChatStore((s) => s.answering);
  const pending = busy || answering;
  const stopAnswer = useChatStore((s) => s.stopAnswer);
  const stopped = useChatStore((s) => s.stopped);

  /** The typed question, with the circled part when the chip is there. */
  const submitDraft = () => {
    void submit(draft, undefined, boardAsk ? { selection: boardAsk } : {});
  };
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    submitDraft();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      // Only a fresh press sends. A held Enter repeats: one that opened this page from a button
      // (e.g. "Hỏi thầy về bộ phận này", which writes a question into this box and focuses it)
      // must not send that question on its own; a held key never sends twice either.
      if (e.repeat) return;
      submitDraft();
    }
  };

  const lookupId = `${engine}/${provider}`;
  const keyAvailable: boolean | null =
    engine === 'cloud' && provider !== 'off' && keyLookup?.id === lookupId
      ? keyLookup.available
      : null;
  let gemmaReadyState: boolean | null = null;
  if (engine === 'gemma') {
    gemmaReadyState = gemmaLookup?.model === chat.gemmaModel ? gemmaLookup.ready : null;
  }
  const noApi = engine === 'cloud' && (provider === 'off' || keyAvailable === false);
  const noWebGpu = engine === 'gemma' && webGPUStatus() !== 'webgpu';
  const gemmaUnavailable = engine === 'gemma' && gemmaReadyState === false;
  const verifierMissing =
    chat.thinkEnabled && verifierLookup?.id === chat.verifierProvider && !verifierLookup.available;
  const localMissing = chosenEngine === 'local-missing';
  const notice: { text: string; section: SettingsSection } | null = localMissing
    ? { text: t('chat.localMissingNotice'), section: 'runtimes' }
    : noApi
      ? { text: t('chat.noApi'), section: 'ai' }
      : noWebGpu
        ? { text: t('chat.noWebgpuNotice'), section: 'local' }
        : gemmaUnavailable
          ? { text: t('chat.gemmaMissingNotice'), section: 'local' }
          : verifierMissing
            ? { text: t('chat.thinkNoVerifier'), section: 'teacher' }
            : null;
  // Where the next question goes, from the current settings (nothing is guessed).
  const providerName = (p: string) => t(`settings.aiProviders.${p}` as MessageKey);
  // The fallback is named only when it can really be asked (it has a key).
  const fallbackTarget =
    fallbackProvider !== null &&
    provider !== 'off' &&
    fallbackLookup?.id === fallbackProvider &&
    fallbackLookup.available
      ? t('chat.fallbackTarget', {
          name: PROVIDER_NAME[fallbackProvider],
          provider: PROVIDER_NAME[provider],
        })
      : null;
  // A question about a picture of the circled area is never reviewed online (askTeacher), and a
  // question about the circled board is never looked up on Wikipedia.
  const pictureAsk = boardAsk?.status === 'picture';
  const targets = [
    ...(engine === 'cloud' && provider !== 'off' ? [providerName(provider)] : []),
    ...(fallbackTarget ? [fallbackTarget] : []),
    ...(chat.thinkEnabled && !pictureAsk
      ? [t('chat.reviewTarget', { name: providerName(chat.verifierProvider) })]
      : []),
    ...(chat.webLookup && !withBoard ? ['Wikipedia'] : []),
  ];
  const withScreen = showScreenContext && chat.includeScreen;
  return (
    <section
      className={cx('chat-panel', compact && 'chat-panel--compact')}
      aria-label={t('chat.label')}
    >
      <header className="chat-panel__header">
        <div className="chat-panel__identity">
          {/* The big teacher face on the teacher page already identifies the
              teacher, so the small header face only shows in bubble mode. */}
          {!teacherPage && (
            <span className="chat-panel__avatar">
              <TeacherFace
                mood={busy ? 'thinking' : voiceSpeaking ? 'speaking' : 'idle'}
                trackCursor
              />
            </span>
          )}
          <strong>{t('chat.title')}</strong>
        </div>
        <div className="chat-panel__header-actions">
          <label className="chat-engine" data-tip={t('chat.engineLabel')} data-tip-side="bottom">
            <span className="sr-only">{t('chat.engineLabel')}</span>
            <select
              aria-label={t('chat.engineLabel')}
              value={engine}
              onChange={(e) => {
                chat.setEngine(e.target.value as ChatEngine);
              }}
            >
              <option value="cloud">{t('chat.cloud')}</option>
              <option value="gemma">{t('chat.gemma')}</option>
              <option value="local">{t('chat.local')}</option>
            </select>
          </label>
          {speechSupported() && (
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
                // Without a Vietnamese voice the Windows voice reads with the wrong accent
                // (seen on a test machine with only English voices, 2026-10-14). The list may
                // still be loading (WebView2: empty until "voiceschanged"), so wait for it.
                if (
                  !voiceEnabled &&
                  useVoiceStore.getState().engine === 'system' &&
                  speechSupported()
                ) {
                  void voicesWhenLoaded().then((voices) => {
                    const { enabled, engine: voiceEngine } = useVoiceStore.getState();
                    if (
                      enabled &&
                      voiceEngine === 'system' &&
                      vietnameseVoices(voices).length === 0
                    ) {
                      toast(t('voice.noVietnameseOnEnable'), 'warn');
                    }
                  });
                }
              }}
              aria-pressed={voiceEnabled}
              aria-label={t('chat.voice')}
              title={t('chat.voiceHint')}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={() => {
              stopSpeaking();
              chat.clearMessages();
              useChatStore.setState({ stopped: false });
            }}
            aria-label={t('chat.clear')}
            title={t('chat.clear')}
          >
            <Trash2 size={16} />
          </button>
          {compact && onExpand && (
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={onExpand}
              aria-label={t('chat.expand')}
            >
              <Maximize2 size={16} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={onClose}
              aria-label={t('chat.close')}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {showScreenContext && (
        <div className="chat-panel__toolbar">
          <label
            className={cx('chat-toggle', chat.includeScreen && 'is-on')}
            title={t('chat.contextHint')}
          >
            <input
              type="checkbox"
              checked={chat.includeScreen}
              onChange={(e) => {
                if (e.target.checked) window.dispatchEvent(new Event('stemsim:screen-scan'));
                chat.setIncludeScreen(e.target.checked);
              }}
            />
            <span className="chat-toggle__track">
              <span />
            </span>
            <span>{t('chat.contextToggle')}</span>
          </label>
        </div>
      )}

      {notice && (
        <div className="chat-panel__notice" role="status">
          <CircleAlert size={17} />
          <span>{notice.text}</span>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              openSettingsAt(notice.section);
            }}
          >
            <Settings2 size={14} /> {t('chat.settings')}
          </button>
        </div>
      )}
      {!notice && targets.length === 0 && engine === 'gemma' && gemmaReadyState === true && (
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} /> {t('chat.localOnly')}
        </p>
      )}
      {!notice && targets.length === 0 && engine === 'local' && localSelection && (
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} />{' '}
          {/* "không gửi lên mạng" only while nothing else goes online (the voice below). */}
          {t(voiceOnline ? 'chat.localRuntimeHere' : 'chat.localOnlyRuntime', {
            name: runtimeName(locale, localSelection.kind),
            address: localSelection.baseUrl.replace(/^http:\/\//, ''),
          })}
          {/* SimLab promises only what it sends itself: a generic server may relay online. */}
          {localSelection.kind === 'openAiCompatible' && ` ${t('localRuntime.relayNote')}`}
        </p>
      )}
      {!notice && targets.length > 0 && (
        <p className="chat-panel__local-note chat-panel__local-note--online">
          <Globe size={14} />{' '}
          {t(
            withScreen
              ? 'chat.sentToWithScreen'
              : withBoard
                ? 'chat.sentToWithBoard'
                : 'chat.sentTo',
            { targets: targets.join(', ') },
          )}
        </p>
      )}
      {!notice && boardAsk?.status === 'picture' && (
        // A picture of the circled area: only to the AI on this computer (pictureReader.ts). Its
        // answer stays here too, so the Gemini voice does not read it (readAloud).
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} />{' '}
          {t(voiceOnline ? 'board.ask.pictureLocalQuiet' : 'board.ask.pictureLocal')}
        </p>
      )}
      {!notice && voiceOnline && (
        <p className="chat-panel__local-note chat-panel__local-note--online">
          <Volume2 size={14} /> {t('chat.voiceOnline')}
        </p>
      )}

      <div className="chat-panel__messages" aria-live="polite" aria-relevant="additions text">
        {chat.messages.length === 0 ? (
          <div className="chat-panel__welcome">
            <div className="chat-panel__welcome-icon">
              <Bot size={27} />
            </div>
            <h2>{t('chat.welcomeTitle')}</h2>
            <p>{t(showScreenContext ? 'chat.welcomeBody' : 'chat.welcomeBodyTeacher')}</p>
            <div className="chat-panel__starters">
              {(['one', 'two', 'three'] as const).map((key) => {
                const item = t(`chat.starters.${key}`);
                return (
                  <button key={key} type="button" onClick={() => void submit(item)}>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          chat.messages.map((message, index) => (
            <article
              key={message.id}
              className={cx('chat-message', `chat-message--${message.role}`)}
            >
              {message.role === 'assistant' && (
                <span className="chat-message__avatar">
                  <Bot size={15} />
                </span>
              )}
              <div className="chat-message__body">
                {message.role === 'assistant' && message.missingData && (
                  // Written by the app (missingData.ts), set apart from the AI's text above it.
                  <div className="chat-message__app-notice" role="note">
                    <strong>
                      <ClipboardList size={14} aria-hidden="true" />
                      {t('chat.missingDataTitle')}
                    </strong>
                    <span>{t('chat.missingData')}</span>
                  </div>
                )}
                {message.role === 'assistant' ? (
                  <MessageBody
                    content={boardAnswerText(message.content, {
                      reviewed: message.checkedBy !== undefined,
                      question: questionBefore(chat.messages, index),
                    })}
                  />
                ) : (
                  <>
                    <p>{message.content}</p>
                    {message.boardRef && (
                      // What the question was about: the board's own text, as it was circled.
                      <small className="chat-message__board-ref">
                        <LassoSelect size={13} aria-hidden="true" />{' '}
                        {message.boardRef.excerpt
                          ? t('chat.boardRef', {
                              excerpt: cut(subtitleText(message.boardRef.excerpt), 120),
                            })
                          : t('chat.boardRefPicture')}
                      </small>
                    )}
                  </>
                )}
                {message.role === 'assistant' && message.facts && message.facts.length > 0 && (
                  <div className="chat-message__facts" role="note">
                    <strong>
                      <Calculator size={14} aria-hidden="true" />
                      {t('chat.factsTitle')}
                    </strong>
                    <ul>
                      {message.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {message.role === 'assistant' &&
                  message.unverifiedNumbers &&
                  message.unverifiedNumbers.length > 0 &&
                  (() => {
                    // provenance.ts: values nobody gave the AI. Unverified, not "wrong". Written
                    // by the app, so labelled as SimLab's like the missing-data notice.
                    const chip = chipNumbers(message.unverifiedNumbers);
                    const numbers = chip.shown.join(', ');
                    return (
                      <div
                        className="chat-message__unverified"
                        role="note"
                        title={t('chat.unverifiedHint')}
                      >
                        <strong>
                          <CircleHelp size={14} aria-hidden="true" />
                          {t('chat.unverifiedTitle')}
                        </strong>
                        <span>
                          {t('chat.unverifiedNumbers', {
                            numbers: chip.more
                              ? `${numbers} ${t('chat.unverifiedMore', { count: chip.more })}`
                              : numbers,
                          })}
                        </span>
                      </div>
                    );
                  })()}
                {message.role === 'assistant' && (
                  <AiContentBar
                    {...(message.model ? { model: message.model } : {})}
                    fallback={message.fallback === true}
                  />
                )}
                {message.role === 'assistant' && message.checkedBy && (
                  <small className="chat-message__meta">
                    {t('chat.checkedMeta', { model: message.checkedBy })}
                  </small>
                )}
                {message.role === 'assistant' && message.continuedUnreviewed && (
                  <small className="chat-message__meta">{t('chat.continuedUnreviewed')}</small>
                )}
                {message.role === 'assistant' && message.reviewSkipped === 'picture' && (
                  <small className="chat-message__meta">{t('chat.reviewSkippedPicture')}</small>
                )}
                {message.role === 'assistant' && unread.includes(message.id) && (
                  <div className="chat-message__quiet" role="note">
                    <VolumeX size={14} aria-hidden="true" />
                    <small>{t('chat.notReadAloud')}</small>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => {
                        openSettingsAt('voice');
                      }}
                    >
                      <Settings2 size={14} aria-hidden="true" /> {t('chat.voiceSettings')}
                    </button>
                  </div>
                )}
                {message.role === 'assistant' &&
                  message.references &&
                  message.references.length > 0 && (
                    <small className="chat-message__references">
                      {t('chat.references')}: {message.references.join(' · ')}
                    </small>
                  )}
                {message.role === 'assistant' &&
                  message.truncated &&
                  (() => {
                    const offered = message === lastMessage || message === lastLessonAnswer;
                    // The rest of an answer about a circled picture is written on this computer
                    // only: an online AI never sees that answer (withoutPictureAsks), so it would
                    // write the rest of something else.
                    const staysHere =
                      answersPicture(chat.messages, index) || message.reviewSkipped === 'picture';
                    return (
                      <div className="chat-message__continue">
                        <small>{t('chat.truncatedNote')}</small>
                        {offered && staysHere && engine === 'cloud' ? (
                          <small>{t('chat.continuePictureLocal')}</small>
                        ) : (
                          offered && (
                            <button
                              type="button"
                              className="btn"
                              disabled={busy}
                              onClick={() => void continueAnswer(message)}
                            >
                              <ArrowDownToLine size={14} aria-hidden="true" />
                              {t('chat.continue')}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })()}
              </div>
            </article>
          ))
        )}
        {busy && streaming !== null && (
          // Text being written (on this computer, or streamed by an online provider): plain text
          // until the answer is complete (then it is laid out with formulas). It is provisional:
          // never stored, read aloud or taught on the board; if the answer fails, it goes. Screen
          // readers hear the finished answer only.
          <div className="chat-message chat-message--assistant chat-message--streaming">
            <span className="chat-message__avatar">
              <Bot size={15} />
            </span>
            <div className="chat-message__body">
              <span className="sr-only">{t('chat.thinking')}</span>
              <p aria-hidden="true">
                {streaming}
                <span className="chat-message__caret" />
              </p>
            </div>
          </div>
        )}
        {busy && streaming === null && (
          <div className="chat-message chat-message--assistant">
            <span className="chat-message__avatar">
              <Bot size={15} />
            </span>
            <div className="chat-message__body chat-message__thinking">
              <LoaderCircle size={16} className="spin" />{' '}
              {chat.thinkEnabled ? t('chat.reviewing') : t('chat.thinking')}
            </div>
          </div>
        )}
        {error && (
          <div className="chat-panel__error" role="alert">
            <CircleAlert size={15} />
            <span className="chat-panel__error-text">{error.text}</span>
            {(error.retry || error.section) && (
              <span className="chat-panel__error-actions">
                {error.retry && (
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={pending}
                    onClick={() => {
                      if (error.retry) askAgain(error.retry);
                    }}
                  >
                    <RotateCcw size={14} aria-hidden="true" /> {t('chat.retry')}
                  </button>
                )}
                {error.section && (
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => {
                      if (error.section) openSettingsAt(error.section);
                    }}
                  >
                    <Settings2 size={14} aria-hidden="true" /> {t('chat.settings')}
                  </button>
                )}
              </span>
            )}
          </div>
        )}
        {stopped && !pending && !error && (
          <p className="chat-panel__stopped" role="status">
            <Square size={13} aria-hidden="true" />
            {t('chat.stopped')}
          </p>
        )}
        {!pending && simLink && simLink.id !== activeTopic && (
          <div className="chat-panel__sim-link">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void openTopic(simLink.id);
              }}
            >
              <FlaskConical size={14} aria-hidden="true" />
              {t('chat.openSimulation', { title: simLink.title })}
            </button>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* "Giải thích lại", "Chậm hơn"… only make sense once there is an answer to rework. */}
      {teacherPage && hasAnswer && (
        <div className="teacher__quick-actions" role="group" aria-label={t('teacher.chipsLabel')}>
          {(['hint', 'again', 'slower', 'example', 'simpler', 'lost'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                // Shown as the short label, sent as a full instruction (a bare "Chậm hơn"
                // was misread by small models).
                void submit(
                  t(`teacher.chips.${key}` as MessageKey),
                  t(`teacher.chipPrompts.${key}` as MessageKey),
                  { quickAction: true, ...(boardAsk ? { selection: boardAsk } : {}) },
                );
              }}
              disabled={busy}
            >
              {t(`teacher.chips.${key}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      {boardAsk && (
        // The question goes with what was circled; the learner can take it off.
        <div className="chat-panel__board-chip">
          <LassoSelect size={14} aria-hidden="true" />
          <span className="chat-panel__board-chip-text">
            {boardAsk.status === 'picture'
              ? t('chat.boardChipPicture')
              : t('chat.boardChip', {
                  excerpt: cut(subtitleText(selectionExcerpt(boardAsk, 160)), 60),
                })}
          </span>
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={() => {
              useBoardStore.getState().set({ selection: null });
            }}
            aria-label={t('chat.boardChipRemove')}
            title={t('chat.boardChipRemove')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <form className="chat-panel__composer" onSubmit={onSubmit}>
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={4000}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.inputLabel')}
        />
        <div className="chat-panel__composer-actions">
          <button
            type="button"
            className={cx('chat-panel__think', chat.thinkEnabled && 'is-on')}
            aria-pressed={chat.thinkEnabled}
            onClick={() => {
              chat.setThinkEnabled(!chat.thinkEnabled);
            }}
            title={t('chat.thinkTitle')}
          >
            <Check size={14} /> {t('chat.think')}{' '}
            {/* A draft written on this computer is reviewed by one API only. */}
            {chat.thinkEnabled && (
              <span>{engine === 'cloud' ? t('chat.twoApis') : t('chat.oneApiReview')}</span>
            )}
          </button>
          <span className="chat-panel__composer-spacer" />
          {pending && stopAnswer ? (
            // While an answer is being written, the main action is to stop it.
            <button
              type="button"
              className="btn chat-panel__stop"
              onClick={() => {
                stopSpeaking();
                stopAnswer();
              }}
              aria-label={t('chat.stopLabel')}
              title={t('chat.stopLabel')}
            >
              <Square size={14} aria-hidden="true" />
              {t('chat.stop')}
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn--accent chat-panel__send"
              disabled={!draft.trim() || busy}
              aria-label={t('chat.send')}
              data-tip={t('chat.enterHint')}
              data-tip-side="top"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
      <footer className="chat-panel__footer">{t('chat.footer')}</footer>
    </section>
  );
}

/**
 * The AI label of an answer after "Viết tiếp": when another model wrote the rest (the quota
 * fallback, or a provider changed in Settings), both are named, and a fallback part keeps the
 * "dự phòng" mark.
 */
function continuationLabel(
  message: ChatMessageRecord,
  next: Pick<ReplyMetadata, 'model' | 'fallback'>,
): Pick<ChatMessageRecord, 'model' | 'fallback'> {
  const models = message.model ? message.model.split(' + ') : [];
  const model = models.includes(next.model) ? message.model : [...models, next.model].join(' + ');
  return {
    ...(model ? { model } : {}),
    ...(message.fallback === true || next.fallback === true ? { fallback: true } : {}),
  };
}

/**
 * The learner's question that the message at `index` answers (the user message before it), or
 * ''. A Think answer to a question about the learner's own draft keeps its words about a draft.
 */
function questionBefore(messages: readonly ChatMessageRecord[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') return m.content;
  }
  return '';
}
