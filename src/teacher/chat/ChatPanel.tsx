import {
  ArrowDownToLine,
  Bot,
  Calculator,
  Check,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  FlaskConical,
  Globe,
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
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { getTransport } from '@/ai/transport';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { MessageBody } from './MessageBody';
import { boardAnswerText } from '@/teacher/board/lesson';
import {
  speak,
  speechSupported,
  stopSpeaking,
  vietnameseVoices,
  voicesWhenLoaded,
} from '@/teacher/voice/speak';
import { toast } from '@/ui/toast';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { AnswerStopped, askTeacher } from './chatService';
import { useTeacherStore } from '@/teacher/teacherStore';
import { CONTINUE_PROMPT, joinContinuation } from './memory';
import { cx } from '@/ui/cx';
import { useT, type MessageKey } from '@/app/i18n';
import { gemmaReady } from '@/ai/gemmaTransport';
import { webGPUStatus } from '@/ai/webGemma';
import { AiContentBar } from '@/safety/AiContentBar';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { openTopic, useActiveTopic } from '@/app/topics';
import { latestTopic } from './topicLink';
import { chipNumbers } from './provenance';

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
  // The engine that will really answer (a pre-selected Gemma without a model → the API).
  const engine = useAnalysisEngine() === 'cloud' ? 'cloud' : 'gemma';
  const voiceEnabled = useVoiceStore((s) => s.enabled);
  const setVoiceEnabled = useVoiceStore((s) => s.setEnabled);
  const voiceSpeaking = useVoiceStore((s) => s.speaking);
  const [draft, setDraft] = useState('');
  // On the board the lesson reads itself sentence by sentence, in step with the pen (Whiteboard).
  const board = useTeacherStore((s) => teacherPage && s.layout === 'board');
  const [busy, setLocalBusy] = useState(false);
  const setBusy = (value: boolean) => {
    setLocalBusy(value);
    useChatStore.setState({ answering: value });
  };
  const [error, setError] = useState('');
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
    const node = messagesEnd.current;
    if (node?.scrollIntoView) node.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat.messages, busy, error, streaming]);

  // Never keep reading after the panel goes away.
  useEffect(() => stopSpeaking, []);

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

  /**
   * Sends a question. `prompt` is what the AI receives when it differs from what the learner
   * sees (the quick buttons show "Chậm hơn" but send a full instruction).
   */
  const submit = async (text = draft, prompt?: string) => {
    const shown = text.trim();
    const question = (prompt ?? shown).trim();
    // Another panel (the bubble before "Mở rộng") may still be answering: a second answer would
    // take over its "Dừng", so the first one could no longer be stopped.
    if (!question || busy || useChatStore.getState().answering) return;
    stopSpeaking();
    setError('');
    const userMessage: ChatMessageRecord = {
      id: crypto.randomUUID(),
      role: 'user',
      content: shown,
      ...(prompt ? { prompt: question } : {}),
    };
    const prior = chat.messages;
    chat.addMessage(userMessage);
    setDraft('');
    setBusy(true);
    const answer = startAnswer();
    const controller = answer.controller;
    try {
      const result = await askTeacher(question, locale, prior, {
        includeScreen: showScreenContext && chat.includeScreen,
        think: chat.thinkEnabled,
        board,
        signal: controller.signal,
        // Only the quick buttons send a `prompt`: a request about the last answer, never an
        // answer to the teacher's check question that the answer may end with.
        quickAction: prompt !== undefined,
        onPartial: (text) => {
          if (!controller.signal.aborted) setStreaming(text || null);
        },
      });
      const meta = result.metadata;
      chat.addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        model: meta.model,
        ...(meta.checkedBy ? { checkedBy: meta.checkedBy } : {}),
        ...(meta.references.length ? { references: meta.references } : {}),
        ...(meta.facts.length ? { facts: meta.facts } : {}),
        ...(result.truncated ? { truncated: true } : {}),
        ...(meta.missingData ? { missingData: true } : {}),
        // Always set, even empty: an answer without the field (older versions) was never checked
        // and its numbers are not taken as given later (chatService.givenNumbers).
        unverifiedNumbers: meta.unverifiedNumbers,
      });
      endAnswer(answer);
      if (useVoiceStore.getState().enabled && !board) void speak(result.content);
    } catch (e) {
      if (!endAnswer(answer, e)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(null);
      setBusy(false);
      input.current?.focus();
    }
  };

  /** "Viết tiếp": asks for the rest of an answer that stopped at the output limit. */
  const continueAnswer = async (message: ChatMessageRecord) => {
    if (busy || useChatStore.getState().answering) return;
    stopSpeaking();
    setError('');
    setBusy(true);
    const answer = startAnswer();
    const controller = answer.controller;
    try {
      const upto = chat.messages.slice(0, chat.messages.indexOf(message) + 1);
      const result = await askTeacher(CONTINUE_PROMPT[locale], locale, upto, {
        includeScreen: showScreenContext && chat.includeScreen,
        think: false,
        board,
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
      });
      endAnswer(answer);
      if (useVoiceStore.getState().enabled && !board) void speak(result.content);
    } catch (e) {
      if (!endAnswer(answer, e)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const lastMessage = chat.messages[chat.messages.length - 1];
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

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
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
  const notice: { text: string; section: SettingsSection } | null = noApi
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
  const targets = [
    ...(engine === 'cloud' && provider !== 'off' ? [providerName(provider)] : []),
    ...(chat.thinkEnabled
      ? [t('chat.reviewTarget', { name: providerName(chat.verifierProvider) })]
      : []),
    ...(chat.webLookup ? ['Wikipedia'] : []),
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
                chat.setEngine(e.target.value as 'cloud' | 'gemma');
              }}
            >
              <option value="cloud">{t('chat.cloud')}</option>
              <option value="gemma">{t('chat.gemma')}</option>
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
      {!notice && targets.length > 0 && (
        <p className="chat-panel__local-note chat-panel__local-note--online">
          <Globe size={14} />{' '}
          {t(withScreen ? 'chat.sentToWithScreen' : 'chat.sentTo', {
            targets: targets.join(', '),
          })}
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
                  <p>{message.content}</p>
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
                  <AiContentBar {...(message.model ? { model: message.model } : {})} />
                )}
                {message.role === 'assistant' && message.checkedBy && (
                  <small className="chat-message__meta">
                    {t('chat.checkedMeta', { model: message.checkedBy })}
                  </small>
                )}
                {message.role === 'assistant' &&
                  message.references &&
                  message.references.length > 0 && (
                    <small className="chat-message__references">
                      {t('chat.references')}: {message.references.join(' · ')}
                    </small>
                  )}
                {message.role === 'assistant' && message.truncated && (
                  <div className="chat-message__continue">
                    <small>{t('chat.truncatedNote')}</small>
                    {message === lastMessage && (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void continueAnswer(message)}
                      >
                        <ArrowDownToLine size={14} aria-hidden="true" />
                        {t('chat.continue')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
        {busy && streaming !== null && (
          // Text being written by the on-device model: plain text until the answer is complete
          // (then it is laid out with formulas). Screen readers hear the finished answer only.
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
            {error}
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
                );
              }}
              disabled={busy}
            >
              {t(`teacher.chips.${key}` as MessageKey)}
            </button>
          ))}
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
            {chat.thinkEnabled && <span>{t('chat.twoApis')}</span>}
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
