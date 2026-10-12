import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  BookOpen,
  Bot,
  Brain,
  CircleAlert,
  CircleCheck,
  Download,
  ExternalLink,
  Globe,
  HardDrive,
  KeyRound,
  LoaderCircle,
  Play,
  Send,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_MODELS, PROVIDERS, modelFor, useAiStore } from '@/ai/aiStore';
import type { Provider } from '@/ai/types';
import { getTransport } from '@/ai/transport';
import { deleteWebGemma, downloadWebGemma, webGPUStatus, webGemmaStatus } from '@/ai/webGemma';
import { WEB_GEMMA_MODELS } from '@/ai/webGemmaModels';
import { formatNumber, useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { useChatStore, type MemoryLength } from './chatStore';
import { downloadErrorKey } from './downloadErrors';
import { GpuSettings } from './GpuSettings';
import { builtinKnowledge } from './knowledge';
import { listVoices, speak, speechSupported, stopSpeaking } from '@/teacher/voice/speak';
import { VOICE_SAMPLE, VOICE_STYLES, useVoiceStore } from '@/teacher/voice/voiceStore';
import './chat.css';

const GEMMA_LABELS: Record<string, MessageKey> = {
  'gemma3-270m': 'chatSettings.gemma270m',
  'gemma3-1b': 'chatSettings.gemma1b',
  'gemma4-e2b': 'chatSettings.gemmaE2b',
};

interface WebDownloadProgress {
  model: string;
  loaded: number;
  total: number | null;
  finished: boolean;
  /** 'gated': the host needs sign-in/terms (import by hand). Otherwise raw text. */
  error?: string | null;
}

function formatBytes(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`;
  if (value < 1_000_000) return `${Math.round(value / 1_000)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function GemmaProgress({
  progress,
  t,
}: {
  progress: WebDownloadProgress;
  t: ReturnType<typeof useT>;
}) {
  // All files are in, the model is being compiled for the GPU: no percent exists for that.
  const compiling =
    !progress.finished &&
    !progress.error &&
    progress.total !== null &&
    progress.total > 0 &&
    progress.loaded >= progress.total;
  const percent =
    progress.finished && !progress.error
      ? 100
      : compiling
        ? null
        : progress.total && progress.total > 0
          ? Math.min(99, Math.floor((progress.loaded / progress.total) * 100))
          : null;
  const errorKey = progress.error ? downloadErrorKey(progress.error) : null;
  const description = progress.error
    ? errorKey
      ? t(errorKey)
      : t('chatSettings.downloadFailed', { detail: progress.error })
    : progress.finished
      ? t('chatSettings.progressComplete')
      : compiling
        ? t('chatSettings.progressLoading')
        : percent === null
          ? t('chatSettings.progressDownloading')
          : `${t('chatSettings.progressDownloading')} · ${percent}% · ${formatBytes(progress.loaded)} / ${progress.total ? formatBytes(progress.total) : '?'}`;

  return (
    <div className="chat-settings__progress" role="status" aria-live="polite">
      <div className="chat-settings__progress-copy">
        <span>
          {progress.error ? (
            <CircleAlert size={15} />
          ) : progress.finished ? (
            <CircleCheck size={15} />
          ) : (
            <LoaderCircle size={15} className="spin" />
          )}
        </span>
        <strong>{description}</strong>
      </div>
      {progress.error || percent === null ? (
        progress.error ? null : (
          <div className="chat-settings__progress-track is-indeterminate">
            <span />
          </div>
        )
      ) : (
        <progress
          className="chat-settings__progress-track"
          max={100}
          value={percent}
          aria-label={description}
        />
      )}
    </div>
  );
}

/**
 * External page link. In the desktop app the system browser opens it through Rust
 * (`open_known_page`, fixed list of ids); in a browser it is a normal new-tab link.
 */
function KnownPageLink({
  id,
  href,
  className,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void invoke('open_known_page', { id });
      }}
    >
      {children}
    </a>
  );
}

/** "Trí nhớ hội thoại": how much conversation goes with each question (`memory.ts`). */
function MemorySettings() {
  const t = useT();
  const length = useChatStore((s) => s.memoryLength);
  const setLength = useChatStore((s) => s.setMemoryLength);
  const labelId = useId();
  return (
    <fieldset className="settings-group">
      <legend>
        <Brain size={15} aria-hidden="true" />
        {t('chatSettings.memory.title')}
      </legend>
      <p className="muted">{t('chatSettings.memory.intro')}</p>
      <div className="settings-row">
        <span id={labelId}>{t('chatSettings.memory.title')}</span>
        <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
          {MEMORY_LENGTHS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={length === item}
              className="segmented__item"
              onClick={() => {
                setLength(item);
              }}
            >
              {t(`chatSettings.memory.${item}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        {t(length === 'long' ? 'chatSettings.memory.longHint' : 'chatSettings.memory.mediumHint')}
      </p>
    </fieldset>
  );
}

const MEMORY_LENGTHS: MemoryLength[] = ['medium', 'long'];

/** "Giọng nói của thầy": style presets, OS voice picker and a sample preview. */
function VoiceSettings() {
  const t = useT();
  const style = useVoiceStore((s) => s.style);
  const setStyle = useVoiceStore((s) => s.setStyle);
  const voiceURI = useVoiceStore((s) => s.voiceURI);
  const setVoiceURI = useVoiceStore((s) => s.setVoiceURI);
  const speaking = useVoiceStore((s) => s.speaking);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
  const labelId = useId();
  const supported = speechSupported();

  useEffect(() => {
    const update = () => {
      setVoices(listVoices());
    };
    try {
      speechSynthesis.addEventListener('voiceschanged', update);
      return () => {
        speechSynthesis.removeEventListener('voiceschanged', update);
      };
    } catch {
      return;
    }
  }, []);

  useEffect(() => stopSpeaking, []);

  if (!supported) {
    return (
      <fieldset className="settings-group">
        <legend>
          <Volume2 size={15} aria-hidden="true" />
          {t('voice.title')}
        </legend>
        <p className="muted">{t('voice.noSpeech')}</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="settings-group">
      <legend>
        <Volume2 size={15} aria-hidden="true" />
        {t('voice.title')}
      </legend>
      <p className="muted">{t('voice.intro')}</p>
      <div className="settings-row">
        <span id={labelId}>{t('voice.style')}</span>
        <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
          {VOICE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              className="segmented__item"
              onClick={() => {
                setStyle(s);
              }}
            >
              {t(`voice.styles.${s}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>
      <label className="ai-settings__field">
        <span>{t('voice.voiceLabel')}</span>
        <select
          value={voiceURI}
          onChange={(e) => {
            setVoiceURI(e.target.value);
          }}
        >
          <option value="">{t('voice.auto')}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
      </label>
      <div className="chat-settings__actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={speaking}
          onClick={() => {
            void speak(VOICE_SAMPLE);
          }}
        >
          <Play size={14} />
          {t('voice.preview')}
        </button>
      </div>
    </fieldset>
  );
}

export function ChatAiSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const chat = useChatStore();
  const verifierProvider = useChatStore((s) => s.verifierProvider);
  const ai = useAiStore();
  const [gpu, setGpu] = useState<boolean | null>(null);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const [checkingModels, setCheckingModels] = useState(true);
  const [gemmaWorking, setGemmaWorking] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [key, setKey] = useState('');
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState('');
  const [docError, setDocError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [downloadProgress, setDownloadProgress] = useState<WebDownloadProgress | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const desktop = isTauri();
  // Claude cannot be called from a web page (Anthropic needs the desktop gateway), so in the
  // browser it cannot review answers; Gemini and Groq work with a key kept for this session.
  const reviewerUnavailable = (p: Provider) => !desktop && p === 'claude';

  const refreshModels = useCallback(async () => {
    setCheckingModels(true);
    try {
      setGpu(webGPUStatus() === 'webgpu');
      const entries = await Promise.all(
        WEB_GEMMA_MODELS.map(
          async (m) => [m.id, (await webGemmaStatus(m.id)) === 'ready'] as const,
        ),
      );
      setReadyMap(Object.fromEntries(entries));
    } finally {
      setCheckingModels(false);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.all(
      WEB_GEMMA_MODELS.map(async (m) => [m.id, (await webGemmaStatus(m.id)) === 'ready'] as const),
    ).then((entries) => {
      if (!alive) return;
      setGpu(webGPUStatus() === 'webgpu');
      setReadyMap(Object.fromEntries(entries));
      setCheckingModels(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onChanged = () => {
      void refreshModels();
    };
    window.addEventListener('stemsim:gemma-changed', onChanged);
    return () => {
      window.removeEventListener('stemsim:gemma-changed', onChanged);
    };
  }, [refreshModels]);
  useEffect(() => {
    const transport = getTransport();
    if (!transport.keyHint) return;
    let alive = true;
    void transport
      .keyHint(verifierProvider)
      .then((hint) => {
        if (alive) setKeyHint(hint);
      })
      .catch(() => {
        if (alive) setKeyHint(null);
      });
    return () => {
      alive = false;
    };
  }, [verifierProvider]);
  useEffect(() => {
    if (ai.provider !== 'off' && verifierProvider === ai.provider) {
      const next = PROVIDERS.find((p) => p !== ai.provider);
      if (next) useChatStore.getState().setVerifierProvider(next);
    }
  }, [ai.provider, verifierProvider]);

  const pullModel = async (modelId: string) => {
    chat.setGemmaModel(modelId);
    setGemmaWorking(modelId);
    setDownloadProgress({ model: modelId, loaded: 0, total: null, finished: false });
    const abort = new AbortController();
    downloadAbort.current = abort;
    try {
      await downloadWebGemma(
        modelId,
        (p) => {
          setDownloadProgress({
            model: modelId,
            loaded: p.loaded,
            total: p.total,
            finished: false,
          });
        },
        { signal: abort.signal },
      );
      setDownloadProgress((current) =>
        current?.model === modelId ? { ...current, finished: true } : current,
      );
      await refreshModels();
      window.dispatchEvent(new Event('stemsim:gemma-changed'));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The friendly text hides the engine's wording; keep the original for troubleshooting.
      console.warn('[gemma-download]', message);
      setDownloadProgress((current) =>
        current?.model === modelId ? { ...current, finished: true, error: message } : current,
      );
    } finally {
      downloadAbort.current = null;
      setGemmaWorking(null);
    }
  };
  const cancelDownload = () => {
    downloadAbort.current?.abort();
  };
  const removeModel = async (modelId: string) => {
    setGemmaWorking(modelId);
    try {
      await deleteWebGemma(modelId);
      await refreshModels();
      window.dispatchEvent(new Event('stemsim:gemma-changed'));
    } finally {
      setGemmaWorking(null);
    }
  };
  const saveVerifierKey = async () => {
    setWorking(true);
    setKeyStatus('');
    try {
      await getTransport().setKey(chat.verifierProvider, key.trim());
      window.dispatchEvent(new Event('stemsim:credentials-changed'));
      setKey('');
      const hint = await getTransport().keyHint?.(chat.verifierProvider);
      setKeyHint(hint ?? null);
      setKeyStatus(t('chatSettings.keySaved'));
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };
  const deleteVerifierKey = async () => {
    setWorking(true);
    try {
      await getTransport().deleteKey(chat.verifierProvider);
      window.dispatchEvent(new Event('stemsim:credentials-changed'));
      setKeyHint(null);
      setKeyStatus(t('chatSettings.keyDeleted'));
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };
  const testVerifierKey = async () => {
    setWorking(true);
    try {
      const result = await getTransport().testKey?.(
        chat.verifierProvider,
        chat.verifierModel.trim() || modelFor(ai.models, chat.verifierProvider),
      );
      setKeyStatus(
        result
          ? t(`chatSettings.keyTest.${result.status}` as MessageKey)
          : t('chatSettings.keyTest.failed'),
      );
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };
  const addDocument = (name: string, text: string) => {
    if (text.length > 120_000) throw new Error(t('chatSettings.fileTooLarge'));
    const total = chat.documents
      .filter((d) => d.name !== name)
      .reduce((n, d) => n + d.text.length, 0);
    if (total + text.length > 1_500_000) throw new Error(t('chatSettings.libraryFull'));
    chat.addDocument({ id: crypto.randomUUID(), name, text, addedAt: Date.now() });
  };

  const checkExtension = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    if (!extension || !['txt', 'md', 'csv', 'json'].includes(extension)) {
      throw new Error(t('chatSettings.supportedFiles'));
    }
  };

  const importDocument = async () => {
    setDocError('');
    try {
      if (!desktop) {
        fileInput.current?.click();
        return;
      }
      const opened = await invoke<{ name: string; text: string } | null>('open_text_file', {
        filterName: t('chatSettings.fileFilter'),
        extensions: ['txt', 'md', 'csv', 'json'],
      });
      if (!opened) return;
      checkExtension(opened.name);
      addDocument(opened.name, opened.text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The native dialog filter is advisory: it still reports very large or binary files.
      setDocError(
        message.toLowerCase().includes('file too large') ? t('chatSettings.fileTooLarge') : message,
      );
    }
  };

  const importBrowserFile = async (file?: File) => {
    if (!file) return;
    setDocError('');
    try {
      checkExtension(file.name);
      // Early-out for absurdly large files (reading megabytes into memory just to count
      // characters would freeze the UI). The precise per-file character limit is enforced
      // by addDocument below, so this message stays truthful.
      if (file.size > 2_000_000) throw new Error(t('chatSettings.fileTooLarge'));
      addDocument(file.name, await file.text());
    } catch (e) {
      setDocError(e instanceof Error ? e.message : String(e));
    }
  };

  const builtIn = builtinKnowledge(locale);
  const keyLocked =
    ai.provider === chat.verifierProvider || reviewerUnavailable(chat.verifierProvider);
  return (
    <fieldset className="settings-group" id="settings-teacher">
      <legend>
        <Bot size={15} aria-hidden="true" />
        {t('chatSettings.title')}
      </legend>
      <p className="muted">{t('chatSettings.intro')}</p>
      <p className="muted small">{t('chatSettings.gemmaWhere')}</p>
      <KnownPageLink
        id="gemma-terms"
        href="https://ai.google.dev/gemma/terms"
        className="btn chat-settings__terms"
      >
        <ExternalLink size={13} />
        {t('chatSettings.gemmaTerms')}
      </KnownPageLink>

      <fieldset className="chat-settings__models" aria-label={t('chatSettings.gemmaModel')}>
        <legend className="chat-settings__models-title">{t('chatSettings.gemmaModel')}</legend>
        {WEB_GEMMA_MODELS.map((item) => {
          const selected = chat.gemmaModel === item.id;
          const installed = readyMap[item.id] === true;
          const busy = gemmaWorking === item.id;
          const progress =
            downloadProgress && downloadProgress.model === item.id ? downloadProgress : null;
          return (
            <article
              key={item.id}
              className={`chat-settings__model${selected ? ' is-selected' : ''}`}
            >
              <label className="chat-settings__model-choice">
                <input
                  type="radio"
                  name="gemma-model"
                  value={item.id}
                  checked={selected}
                  disabled={gemmaWorking !== null}
                  onChange={() => {
                    chat.setGemmaModel(item.id);
                  }}
                />
                <span className="chat-settings__model-copy">
                  <strong>{t(GEMMA_LABELS[item.id] ?? 'chatSettings.gemma1b')}</strong>
                  <small>
                    {item.id} · {item.sizeLabel}
                  </small>
                </span>
                {item.id === 'gemma3-1b' && (
                  <span className="chat-settings__recommended">
                    {t('chatSettings.recommended')}
                  </span>
                )}
              </label>
              <div className="chat-settings__model-actions">
                {installed ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={gemmaWorking !== null}
                    onClick={() => void removeModel(item.id)}
                  >
                    <Trash2 size={14} />
                    {t('chatSettings.deleteModel')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--accent"
                    disabled={gemmaWorking !== null || gpu === false}
                    onClick={() => void pullModel(item.id)}
                    title={gpu === false ? t('chatSettings.webgpuRequired') : undefined}
                  >
                    {busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}
                    {busy ? t('chatSettings.downloadingShort') : t('chatSettings.download')}
                  </button>
                )}
                {busy && (
                  <button type="button" className="btn" onClick={cancelDownload}>
                    <X size={14} />
                    {t('chatSettings.cancelDownload')}
                  </button>
                )}
                {!installed && !busy && (
                  <KnownPageLink id={item.id} href={item.repoUrl} className="btn">
                    <ExternalLink size={14} />
                    {t('chatSettings.openRepo')}
                  </KnownPageLink>
                )}
              </div>
              {progress && (busy || progress.finished) && (
                <GemmaProgress progress={progress} t={t} />
              )}
              {busy && <p className="muted small">{t('chatSettings.downloading')}</p>}
            </article>
          );
        })}
      </fieldset>
      <p className="muted small">
        {checkingModels
          ? t('chatSettings.checking')
          : gpu === false
            ? t('chatSettings.webgpuRequired')
            : readyMap[chat.gemmaModel]
              ? t('chatSettings.modelReady')
              : t('chatSettings.modelMissing')}
      </p>

      <div className="chat-settings__divider" />
      <MemorySettings />

      <div className="chat-settings__divider" />
      <GpuSettings />

      <div className="chat-settings__divider" />
      <VoiceSettings />

      <div className="chat-settings__divider" />
      <div className="settings-row">
        <span>{t('chatSettings.verifier')}</span>
        <select
          value={chat.verifierProvider}
          disabled={working}
          onChange={(e) => {
            chat.setVerifierProvider(e.target.value as Provider);
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p} disabled={ai.provider === p || reviewerUnavailable(p)}>
              {t(`settings.aiProviders.${p}`)}
              {reviewerUnavailable(p) ? ` (${t('chatSettings.desktopOnly')})` : ''}
            </option>
          ))}
        </select>
      </div>
      <label className="ai-settings__field">
        <span>{t('chatSettings.verifierModel')}</span>
        <input
          value={chat.verifierModel}
          onChange={(e) => {
            chat.setVerifierModel(e.target.value);
          }}
          placeholder={DEFAULT_MODELS[chat.verifierProvider]}
        />
      </label>
      <label className="ai-settings__field">
        <span>{t('chatSettings.verifierKey')}</span>
        <input
          type="password"
          value={key}
          autoComplete="new-password"
          onChange={(e) => {
            setKey(e.target.value);
          }}
          placeholder={keyHint ?? t('chatSettings.keyPlaceholder')}
          disabled={keyLocked}
        />
      </label>
      <div className="chat-settings__actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={working || !key.trim() || keyLocked}
          onClick={() => void saveVerifierKey()}
        >
          <KeyRound size={14} />
          {t('chatSettings.saveKey')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={
            working ||
            !keyHint ||
            keyLocked ||
            // Without the desktop gateway only Gemini keys can be probed from the page.
            (!desktop && chat.verifierProvider !== 'gemini')
          }
          onClick={() => void testVerifierKey()}
        >
          {t('chatSettings.testKey')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={working || !keyHint || keyLocked}
          onClick={() => void deleteVerifierKey()}
        >
          <Trash2 size={14} />
          {t('chatSettings.deleteKey')}
        </button>
      </div>
      {keyStatus && (
        <p className="muted small" role="status">
          {keyStatus}
        </p>
      )}
      <p className="muted small">{t('chatSettings.keyPrivacy')}</p>
      {!desktop && (
        <p className="muted small" role="note">
          {t('chatSettings.browserKeyNote')}
        </p>
      )}

      <div className="chat-settings__divider" />
      <div className="chat-settings__library-heading">
        <div>
          <BookOpen size={15} />
          <strong>{t('chatSettings.library')}</strong>
          <span>{chat.documents.length}</span>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setLibraryOpen(!libraryOpen);
          }}
        >
          {libraryOpen ? t('chatSettings.hideLibrary') : t('chatSettings.openLibrary')}
        </button>
      </div>
      {libraryOpen && (
        <div className="chat-settings__library">
          <p className="muted small">{t('chatSettings.builtIn', { count: builtIn.length })}</p>
          <div className="chat-settings__builtin">
            {['physics', 'chemistry', 'biology'].map((subject) => (
              <span key={subject}>
                {t(`subjects.${subject}` as MessageKey)} ·{' '}
                {
                  builtIn.filter((d) =>
                    d.id.includes(
                      subject === 'physics' ? 'physics' : subject === 'chemistry' ? 'chem' : 'bio',
                    ),
                  ).length
                }{' '}
                {t('chatSettings.notes')}
              </span>
            ))}
          </div>
          <input
            ref={fileInput}
            className="chat-settings__file-input"
            type="file"
            accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
            onChange={(event) => {
              void importBrowserFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <div className="chat-settings__actions">
            <button type="button" className="btn btn--accent" onClick={() => void importDocument()}>
              <Upload size={14} />
              {t('chatSettings.addFile')}
            </button>
            <span className="muted small">{t('chatSettings.supportedFiles')}</span>
          </div>
          {docError && (
            <p className="chat-settings__error" role="alert">
              <CircleAlert size={14} />
              {docError}
            </p>
          )}
          {chat.documents.length === 0 ? (
            <p className="muted small">{t('chatSettings.noDocs')}</p>
          ) : (
            <ul className="chat-settings__documents">
              {chat.documents.map((doc) => (
                <li key={doc.id}>
                  <span>
                    <strong>{doc.name}</strong>
                    <small>
                      {formatNumber(locale, doc.text.length)} {t('chatSettings.characters')}
                    </small>
                  </span>
                  <button
                    type="button"
                    aria-label={`${t('chatSettings.removeFile')} ${doc.name}`}
                    onClick={() => {
                      chat.removeDocument(doc.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">{t('chatSettings.localLibraryPrivacy')}</p>
        </div>
      )}
      <label className={`chat-toggle chat-settings__web${chat.webLookup ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={chat.webLookup}
          onChange={(e) => {
            chat.setWebLookup(e.target.checked);
          }}
        />
        <span className="chat-toggle__track">
          <span />
        </span>
        <span>
          <strong>{t('chatSettings.webLookup')}</strong>
          <small>{t('chatSettings.webLookupHint')}</small>
        </span>
      </label>

      <div className="chat-settings__divider" />
      <DataFlow desktop={desktop} />
    </fieldset>
  );
}

/**
 * "Dữ liệu của em đi đâu?": what stays on this computer and what the current settings
 * may send online. Built from the live settings, so it never overstates privacy.
 */
function DataFlow({ desktop }: { desktop: boolean }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const chat = useChatStore();
  const provider = useAiStore((s) => s.provider);
  const engine = useAnalysisEngine() === 'cloud' ? 'cloud' : 'gemma';
  const name = (p: string) => t(`settings.aiProviders.${p}` as MessageKey);
  const sent: string[] = [];
  if (engine === 'cloud' && provider !== 'off') {
    sent.push(t('chatSettings.flowAnswer', { name: name(provider) }));
  }
  if (engine === 'gemma')
    sent.push(t('chatSettings.flowThinkOnly', { name: name(chat.verifierProvider) }));
  else sent.push(t('chatSettings.flowThink', { name: name(chat.verifierProvider) }));
  if (chat.webLookup) sent.push(t('chatSettings.flowWiki'));
  // The camera reads photos with the cloud API only in the browser (see photoVision.ts).
  if (!desktop && provider !== 'off')
    sent.push(t('chatSettings.flowPhoto', { name: name(provider) }));
  sent.push(t('chatSettings.flowModelDownload'));
  return (
    <section className="chat-settings__flow" aria-labelledby="chat-flow-title">
      <h4 id="chat-flow-title">{t('chatSettings.flowTitle')}</h4>
      <div className="chat-settings__flow-grid">
        <div>
          <strong>
            <HardDrive size={14} aria-hidden="true" /> {t('chatSettings.flowLocalTitle')}
          </strong>
          <ul>
            <li>{t('chatSettings.flowLocalChat')}</li>
            <li>{t('chatSettings.flowLocalDocs', { count: builtinKnowledge(locale).length })}</li>
            <li>{t('chatSettings.flowLocalModel')}</li>
            <li>{t('chatSettings.flowLocalSummary')}</li>
            <li>
              {desktop
                ? t('chatSettings.flowLocalKeyDesktop')
                : t('chatSettings.flowLocalKeyBrowser')}
            </li>
          </ul>
        </div>
        <div>
          <strong>
            <Send size={14} aria-hidden="true" /> {t('chatSettings.flowSentTitle')}
          </strong>
          <ul>
            {sent.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted small">
        <Globe size={13} aria-hidden="true" /> {t('chatSettings.flowScreen')}
      </p>
    </section>
  );
}
