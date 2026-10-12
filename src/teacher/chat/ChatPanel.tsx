import {
  Bot,
  Check,
  CircleAlert,
  Globe,
  LoaderCircle,
  Maximize2,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useAiStore } from '@/ai/aiStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { getTransport } from '@/ai/transport';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { MessageBody } from './MessageBody';
import { speak, speechSupported, stopSpeaking } from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { askTeacher } from './chatService';
import { cx } from '@/ui/cx';
import { useT, type MessageKey } from '@/app/i18n';
import { gemmaReady } from '@/ai/gemmaTransport';
import { webGPUStatus } from '@/ai/webGemma';
import { AiContentBar } from '@/safety/AiContentBar';
import { useAnalysisEngine } from '@/app/ai/engineChoice';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  }, [chat.messages, busy, error]);

  // Never keep reading after the panel goes away.
  useEffect(() => stopSpeaking, []);

  const submit = async (text = draft) => {
    const question = text.trim();
    if (!question || busy) return;
    stopSpeaking();
    setError('');
    const userMessage: ChatMessageRecord = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };
    const prior = chat.messages;
    chat.addMessage(userMessage);
    setDraft('');
    setBusy(true);
    try {
      const result = await askTeacher(question, locale, prior, {
        includeScreen: showScreenContext && chat.includeScreen,
        think: chat.thinkEnabled,
      });
      chat.addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        model: result.metadata.model,
        ...(result.metadata.checkedBy ? { checkedBy: result.metadata.checkedBy } : {}),
        ...(result.metadata.references.length ? { references: result.metadata.references } : {}),
      });
      if (useVoiceStore.getState().enabled) void speak(result.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

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
  const notice: { text: string; section: 'ai' | 'teacher' } | null = noApi
    ? { text: t('chat.noApi'), section: 'ai' }
    : noWebGpu
      ? { text: t('chat.noWebgpuNotice'), section: 'teacher' }
      : gemmaUnavailable
        ? { text: t('chat.gemmaMissingNotice'), section: 'teacher' }
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
          <span>
            <strong>{t('chat.title')}</strong>
            <small>
              {engine === 'gemma' ? t('chat.model', { model: chat.gemmaModel }) : t('chat.product')}
            </small>
          </span>
        </div>
        <div className="chat-panel__header-actions">
          {speechSupported() && (
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
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

      <div className="chat-panel__toolbar">
        {showScreenContext && (
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
        )}
        <label className="chat-engine">
          <span>{t('chat.engineLabel')}</span>
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
      </div>

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
          chat.messages.map((message) => (
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
                {message.role === 'assistant' ? (
                  <MessageBody content={message.content} />
                ) : (
                  <p>{message.content}</p>
                )}
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
              </div>
            </article>
          ))
        )}
        {busy && (
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
        <div ref={messagesEnd} />
      </div>

      {teacherPage && (
        <div className="teacher__quick-actions" role="group" aria-label={t('teacher.chipsLabel')}>
          {(['again', 'slower', 'example', 'simpler', 'lost'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                void submit(t(`teacher.chips.${key}` as MessageKey));
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
          <span className="chat-panel__composer-hint">{t('chat.enterHint')}</span>
          <button
            type="submit"
            className="btn btn--accent chat-panel__send"
            disabled={!draft.trim() || busy}
            aria-label={t('chat.send')}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      <footer className="chat-panel__footer">{t('chat.footer')}</footer>
    </section>
  );
}
