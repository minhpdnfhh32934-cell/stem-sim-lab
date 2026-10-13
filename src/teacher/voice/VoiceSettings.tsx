import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  AudioLines,
  CircleAlert,
  CircleCheck,
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  LoaderCircle,
  Monitor,
  Play,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getTransport } from '@/ai/transport';
import { formatNumber, useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { KnownPageLink } from '@/teacher/chat/settings/KnownPageLink';
import { formatBytes } from '@/teacher/chat/settings/format';
import { createEtaTracker, formatEta } from '@/ui/eta';
import { ProgressBar } from '@/ui/ProgressBar';
import {
  LOCAL_VOICE,
  deleteLocalVoice,
  downloadLocalVoice,
  localVoiceStatus,
  type LocalVoiceStatus,
} from './localVoice';
import {
  listVoices,
  speak,
  speechSupported,
  stopSpeaking,
  toSpokenText,
  vietnameseVoices,
} from './speak';
import {
  GEMINI_TTS_MODELS,
  GEMINI_VOICES,
  SPEED_MAX,
  SPEED_MIN,
  VOICE_ENGINES,
  VOICE_SAMPLE,
  VOICE_STYLES,
  useVoiceStore,
  type VoiceEngine,
} from './voiceStore';
import { voiceChoices } from './voiceChoices';
import '@/teacher/chat/chat.css';
import './voice.css';

const ENGINE_ICONS = { system: Monitor, gemini: Cloud, local: HardDrive } as const;

/** Friendly words for the reasons a voice could not speak (`useVoiceStore.lastError`). */
function errorKey(error: string): MessageKey {
  if (error.includes('no-key') || error.toLowerCase().includes('missingkey'))
    return 'voice.errors.noKey';
  if (error.includes('voice-model-missing')) return 'voice.errors.noModel';
  if (/quota|429|resource_exhausted/i.test(error)) return 'voice.errors.quota';
  if (/network|offline|failed to fetch/i.test(error)) return 'voice.errors.offline';
  if (/notallowed|agegate/i.test(error)) return 'voice.errors.notAllowed';
  return 'voice.errors.other';
}

function useOsVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
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
  return voices;
}

/** Settings → "Giọng nói": the voice source, how it reads, and a preview. */
export function VoiceSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const voice = useVoiceStore();
  const speedId = useId();
  const styleId = useId();
  const [showText, setShowText] = useState(false);

  useEffect(() => stopSpeaking, []);

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Volume2 size={15} aria-hidden="true" />
          {t('voice.readAloudCard')}
        </legend>
        <label className={`chat-toggle chat-settings__web${voice.enabled ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={voice.enabled}
            onChange={(e) => {
              voice.setEnabled(e.target.checked);
            }}
          />
          <span className="chat-toggle__track">
            <span />
          </span>
          <span>
            <strong>{t('voice.readAloud')}</strong>
            <small>{t('voice.readAloudHint')}</small>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <AudioLines size={15} aria-hidden="true" />
          {t('voice.sourceCard')}
        </legend>
        <div className="voice-engines" role="radiogroup" aria-label={t('voice.sourceCard')}>
          {VOICE_ENGINES.map((engine) => (
            <EngineCard key={engine} engine={engine} />
          ))}
        </div>
        {voice.lastError && (
          <p className="chat-settings__error" role="alert">
            <CircleAlert size={14} />
            {t(errorKey(voice.lastError))}
          </p>
        )}
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Volume2 size={15} aria-hidden="true" />
          {t('voice.howCard')}
        </legend>
        <div className="settings-row">
          <span id={styleId}>{t('voice.style')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={styleId}>
            {VOICE_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={voice.style === s}
                className="segmented__item"
                onClick={() => {
                  voice.setStyle(s);
                }}
              >
                {t(`voice.styles.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label htmlFor={speedId}>{t('voice.speed')}</label>
          <span className="voice-speed">
            <input
              id={speedId}
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={0.05}
              value={voice.speed}
              onChange={(e) => {
                voice.setSpeed(Number(e.target.value));
              }}
            />
            <output className="mono" htmlFor={speedId}>
              {formatNumber(locale, voice.speed, { maximumFractionDigits: 2 })}×
            </output>
          </span>
        </div>
        <p className="muted small">{t('voice.howHint')}</p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Play size={15} aria-hidden="true" />
          {t('voice.previewCard')}
        </legend>
        <p className="muted small">“{VOICE_SAMPLE}”</p>
        <div className="settings-actions">
          {voice.speaking ? (
            <button type="button" className="btn" onClick={stopSpeaking}>
              <Square size={14} />
              {t('voice.stop')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                void speak(VOICE_SAMPLE);
              }}
            >
              <Play size={14} />
              {t('voice.preview')}
            </button>
          )}
          <button
            type="button"
            className="btn"
            aria-expanded={showText}
            onClick={() => {
              setShowText(!showText);
            }}
          >
            {t('voice.showText')}
          </button>
        </div>
        {showText && (
          <p className="voice-spoken" aria-label={t('voice.showText')}>
            {toSpokenText(VOICE_SAMPLE)}
          </p>
        )}
      </fieldset>
    </>
  );
}

/** One voice source: what it is, whether it is ready on this computer, and its options. */
function EngineCard({ engine }: { engine: VoiceEngine }) {
  const t = useT();
  const selected = useVoiceStore((s) => s.engine === engine);
  const setEngine = useVoiceStore((s) => s.setEngine);
  const Icon = ENGINE_ICONS[engine];
  return (
    <article className={`chat-settings__model voice-engine${selected ? ' is-selected' : ''}`}>
      <label className="chat-settings__model-choice">
        <input
          type="radio"
          name="voice-engine"
          value={engine}
          checked={selected}
          onChange={() => {
            setEngine(engine);
          }}
        />
        <span className="chat-settings__model-copy">
          <strong>
            <Icon size={14} aria-hidden="true" /> {t(`voice.engines.${engine}.title`)}
          </strong>
          <small>{t(`voice.engines.${engine}.hint`)}</small>
        </span>
      </label>
      <div className="voice-engine__body" hidden={!selected}>
        {engine === 'system' && <SystemVoice />}
        {engine === 'gemini' && <GeminiVoice />}
        {engine === 'local' && <LocalVoice />}
      </div>
    </article>
  );
}

function SystemVoice() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const voices = useOsVoices();
  const voiceURI = useVoiceStore((s) => s.voiceURI);
  const setVoiceURI = useVoiceStore((s) => s.setVoiceURI);
  const desktop = isTauri();
  if (!speechSupported()) return <p className="muted small">{t('voice.noSpeech')}</p>;
  const vietnamese = vietnameseVoices(voices);
  const choices = voiceChoices(voices, locale);
  return (
    <>
      {vietnamese.length > 0 ? (
        <p className="voice-status is-ok">
          <CircleCheck size={14} aria-hidden="true" />
          {t('voice.systemFound', { names: vietnamese.map((v) => v.name).join(', ') })}
        </p>
      ) : (
        <div className="voice-status is-warn" role="note">
          <p>
            <CircleAlert size={14} aria-hidden="true" />
            {t('voice.systemMissing')}
          </p>
          <ol className="ai-guide__steps">
            <li>{t('voice.installStep1')}</li>
            <li>{t('voice.installStep2')}</li>
            <li>{t('voice.installStep3')}</li>
            <li>{t('voice.installStep4')}</li>
          </ol>
          {desktop && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                void invoke('open_known_page', { id: 'windows-speech' });
              }}
            >
              <ExternalLink size={14} />
              {t('voice.openWindowsSpeech')}
            </button>
          )}
        </div>
      )}
      <label className="ai-settings__field">
        <span>{t('voice.voiceLabel')}</span>
        <select
          value={voiceURI}
          onChange={(e) => {
            setVoiceURI(e.target.value);
          }}
        >
          <option value="">{t('voice.auto')}</option>
          {choices.vietnamese.length > 0 && (
            <optgroup label={t('voice.groupVietnamese')}>
              {choices.vietnamese.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.label}
                </option>
              ))}
            </optgroup>
          )}
          {choices.others.length > 0 && (
            <optgroup label={t('voice.groupOther')}>
              {choices.others.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
    </>
  );
}

function GeminiVoice() {
  const t = useT();
  const geminiVoice = useVoiceStore((s) => s.geminiVoice);
  const setGeminiVoice = useVoiceStore((s) => s.setGeminiVoice);
  const geminiModel = useVoiceStore((s) => s.geminiModel);
  const setGeminiModel = useVoiceStore((s) => s.setGeminiModel);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => {
      void getTransport()
        .hasKey('gemini')
        .then((k) => {
          if (alive) setHasKey(k);
        })
        .catch(() => {
          if (alive) setHasKey(false);
        });
    };
    check();
    window.addEventListener('stemsim:credentials-changed', check);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:credentials-changed', check);
    };
  }, []);
  return (
    <>
      {hasKey === false && (
        <div className="voice-status is-warn" role="note">
          <p>
            <CircleAlert size={14} aria-hidden="true" />
            {t('voice.geminiNoKey')}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              openSettingsAt('ai');
            }}
          >
            {t('voice.openConnect')}
          </button>
        </div>
      )}
      <label className="ai-settings__field">
        <span>{t('voice.geminiVoice')}</span>
        <select
          value={geminiVoice}
          onChange={(e) => {
            setGeminiVoice(e.target.value);
          }}
        >
          {GEMINI_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id} · {t(`voice.traits.${v.trait}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="ai-settings__field">
        <span>{t('voice.geminiModel')}</span>
        <select
          value={geminiModel}
          onChange={(e) => {
            const m = GEMINI_TTS_MODELS.find((x) => x === e.target.value);
            if (m) setGeminiModel(m);
          }}
        >
          {GEMINI_TTS_MODELS.map((m) => (
            <option key={m} value={m}>
              {m === 'gemini-3.8-flash-tts' ? t('voice.modelFlash') : t('voice.modelLite')} · {m}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">{t('voice.geminiPrivacy')}</p>
    </>
  );
}

function LocalVoice() {
  const t = useT();
  const [status, setStatus] = useState<LocalVoiceStatus | 'checking'>('checking');
  const [progress, setProgress] = useState<{
    loaded: number;
    total: number | null;
    eta: number | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    setStatus(await localVoiceStatus());
  }, []);
  useEffect(() => {
    let alive = true;
    void localVoiceStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const download = async () => {
    setBusy(true);
    setError('');
    setProgress({ loaded: 0, total: null, eta: null });
    const ctrl = new AbortController();
    abort.current = ctrl;
    const eta = createEtaTracker();
    try {
      await downloadLocalVoice((loaded, total) => {
        setProgress({ loaded, total, eta: eta(loaded, total ?? LOCAL_VOICE.bytes) });
      }, ctrl.signal);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[voice-download]', message);
      setError(message === 'cancelled' ? t('voice.downloadCancelled') : t('voice.downloadFailed'));
    } finally {
      abort.current = null;
      setBusy(false);
      setProgress(null);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deleteLocalVoice();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const percent =
    progress?.total && progress.total > 0
      ? Math.min(99, Math.floor((progress.loaded / progress.total) * 100))
      : null;
  const eta =
    progress && progress.eta !== null && percent !== null ? formatEta(t, progress.eta) : null;
  const progressText =
    percent === null || !progress
      ? t('voice.localPreparing')
      : [
          `${String(percent)}%`,
          `${formatBytes(progress.loaded)} / ${formatBytes(progress.total ?? LOCAL_VOICE.bytes)}`,
          eta,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <>
      <p className="muted small">
        {t('voice.localLicence', { licence: LOCAL_VOICE.licence, size: LOCAL_VOICE.sizeLabel })}
      </p>
      <div className="settings-actions">
        {status === 'ready' ? (
          <>
            <span className="voice-status is-ok">
              <CircleCheck size={14} aria-hidden="true" />
              {t('voice.localReady')}
            </span>
            <button type="button" className="btn" disabled={busy} onClick={() => void remove()}>
              <Trash2 size={14} />
              {t('voice.localDelete')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--accent"
            disabled={busy || status === 'checking'}
            onClick={() => void download()}
          >
            {busy ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}
            {busy
              ? t('voice.localDownloading')
              : t('voice.localDownload', { size: LOCAL_VOICE.sizeLabel })}
          </button>
        )}
        {busy && progress && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              abort.current?.abort();
            }}
          >
            <X size={14} />
            {t('chatSettings.cancelDownload')}
          </button>
        )}
        <KnownPageLink
          id={LOCAL_VOICE.pageId}
          href="https://huggingface.co/facebook/mms-tts-vie"
          className="btn"
        >
          <ExternalLink size={14} />
          {t('voice.localModelPage')}
        </KnownPageLink>
        <KnownPageLink
          id="cc-by-nc-4"
          href="https://creativecommons.org/licenses/by-nc/4.0/"
          className="btn"
        >
          <ExternalLink size={14} />
          {t('voice.localLicencePage')}
        </KnownPageLink>
      </div>
      {busy && progress && (
        <div className="chat-settings__progress" role="status" aria-live="polite">
          <div className="chat-settings__progress-copy">
            <LoaderCircle size={15} className="spin" />
            <strong>{progressText}</strong>
          </div>
          <ProgressBar value={percent} label={progressText} />
        </div>
      )}
      {error && (
        <p className="chat-settings__error" role="alert">
          <CircleAlert size={14} />
          {error}
        </p>
      )}
      <p className="muted small">{t('voice.localHint')}</p>
    </>
  );
}
