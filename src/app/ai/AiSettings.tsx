import { invoke, isTauri } from '@tauri-apps/api/core';
import { Bot, ExternalLink, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n';
import { DEFAULT_MODELS, PROVIDERS, useAiStore, type ProviderChoice } from '@/ai/aiStore';
import { clearReadings, readingCount } from '@/ai/cache';
import { getTransport } from '@/ai/transport';
import { toAiError, type Provider } from '@/ai/types';
import { checkAiStatus } from './useAiStatus';
import './ai.css';

const CHOICES: readonly ProviderChoice[] = [...PROVIDERS, 'off'];
const GEMINI_KEY_PAGE = 'https://aistudio.google.com/apikey';

/** Opens Google AI Studio's key page in the system browser (fixed address, set in Rust). */
function openGeminiKeyPage() {
  if (isTauri()) void invoke('open_gemini_key_page');
  else window.open(GEMINI_KEY_PAGE, '_blank', 'noopener,noreferrer');
}

/** Settings → "AI đọc đề": provider, Gemini key guide, model, API key, timeout, daily cap. */
export function AiSettings() {
  const t = useT();
  const ai = useAiStore();
  const desktop = isTauri();
  const on = ai.provider !== 'off';

  return (
    <fieldset className="settings-group">
      <legend>
        <Bot size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('settings.ai')}
      </legend>
      <p className="muted">{t('settings.aiRule')}</p>

      <div className="settings-row">
        <span id="ai-provider-label">{t('settings.aiProvider')}</span>
        <div className="segmented" role="radiogroup" aria-labelledby="ai-provider-label">
          {CHOICES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={ai.provider === p}
              className="segmented__item"
              onClick={() => {
                ai.setProvider(p);
              }}
            >
              {t(`settings.aiProviders.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Gemini exists only in the main edition (the pilot bundle drops this branch). */}
      {__EDITION__ === 'main' && ai.provider === 'gemini' && (
        <GeminiGuide openByDefault={ai.status === 'noKey'} />
      )}

      {on && <ModelField provider={ai.provider as Provider} />}

      {on && !desktop && <p className="muted">{t('settings.aiCloudDesktopOnly')}</p>}
      {on && desktop && <KeyField provider={ai.provider as Provider} />}
      {on && <p className="muted small">{t('settings.aiPrivacy')}</p>}

      {on && (
        <>
          <label className="ai-settings__field">
            <span>{t('settings.aiTimeout')}</span>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={ai.timeoutSecs}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) ai.setTimeoutSecs(v);
              }}
            />
          </label>
          <label className="ai-settings__field" data-tip={t('settings.aiDailyCapHint')}>
            <span>{t('settings.aiDailyCap')}</span>
            <input
              type="number"
              min={0}
              max={10000}
              step={10}
              value={ai.dailyCap}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0) ai.setDailyCap(v);
              }}
            />
          </label>
          <UsageLine cap={ai.dailyCap} />
          <ReadingCacheLine />
          <div className="ai-settings__actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void checkAiStatus(true);
              }}
            >
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" /> {t('settings.aiTest')}
            </button>
            <span
              className="ai-settings__status"
              role="status"
              data-ok={ai.status === 'ok' ? 'true' : 'false'}
            >
              {ai.status === 'ok'
                ? t('settings.aiStatusOk')
                : ai.status === 'noKey'
                  ? t('settings.aiKeyNone')
                  : ai.status === 'badKey'
                    ? t('settings.aiStatusBadKey')
                    : ai.status === 'offline'
                      ? t('settings.aiStatusOffline')
                      : ''}
            </span>
          </div>
        </>
      )}
    </fieldset>
  );
}

/** "Hôm nay đã dùng x/y lượt" (counted by the Rust gateway; desktop app only). */
function UsageLine({ cap }: { cap: number }) {
  const t = useT();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const transport = getTransport();
    if (!transport.usageToday) return;
    transport
      .usageToday()
      .then((n) => {
        if (alive) setCount(n);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (count === null) return null;
  return (
    <p className="muted small">
      {cap > 0
        ? t('settings.aiUsageToday', { count, cap })
        : t('settings.aiUsageTodayNoCap', { count })}
    </p>
  );
}

/** Saved confirmed readings (src/ai/cache.ts), with a button to clear them. */
function ReadingCacheLine() {
  const t = useT();
  const [count, setCount] = useState(() => readingCount());
  if (count === 0) return null;
  return (
    <div className="ai-settings__actions" data-tip={t('settings.aiClearCacheHint')}>
      <button
        type="button"
        className="btn"
        onClick={() => {
          clearReadings();
          setCount(0);
        }}
      >
        <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
        {t('settings.aiClearCache', { count })}
      </button>
    </div>
  );
}

/** Step-by-step guide for students: how to create a free Gemini API key. */
function GeminiGuide({ openByDefault }: { openByDefault: boolean }) {
  const t = useT();
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;
  return (
    <details className="ai-guide" open={openByDefault}>
      <summary>{t('settings.geminiGuide.title')}</summary>
      <p className="ai-guide__note">{t('settings.geminiGuide.age')}</p>
      <ol className="ai-guide__steps">
        {steps.map((s) => (
          <li key={s}>{t(`settings.geminiGuide.${s}`)}</li>
        ))}
      </ol>
      <div className="ai-settings__actions">
        <button type="button" className="btn" onClick={openGeminiKeyPage}>
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.geminiGuide.open')}
        </button>
      </div>
      <p className="muted small">{t('settings.geminiGuide.free')}</p>
      <p className="muted small">{t('settings.geminiGuide.safety')}</p>
    </details>
  );
}

function ModelField({ provider }: { provider: Provider }) {
  const t = useT();
  const model = useAiStore((s) => s.models[provider]);
  const setModel = useAiStore((s) => s.setModel);
  return (
    <label className="ai-settings__field" data-tip={t('settings.aiModelHint')}>
      <span>{t('settings.aiModel')}</span>
      <input
        type="text"
        spellCheck={false}
        value={model}
        placeholder={DEFAULT_MODELS[provider]}
        onChange={(e) => {
          setModel(provider, e.target.value.trim());
        }}
      />
    </label>
  );
}

function KeyField({ provider }: { provider: Provider }) {
  const t = useT();
  const [key, setKey] = useState('');
  const [has, setHas] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getTransport()
      .hasKey(provider)
      .then((v) => {
        if (alive) setHas(v);
      })
      .catch(() => {
        if (alive) setHas(false);
      });
    return () => {
      alive = false;
    };
  }, [provider]);

  const save = async () => {
    setError('');
    try {
      await getTransport().setKey(provider, key.trim());
      setKey('');
      setHas(true);
      void checkAiStatus(true);
    } catch (e) {
      setError(toAiError(e).message);
    }
  };
  const remove = async () => {
    setError('');
    try {
      await getTransport().deleteKey(provider);
      setHas(false);
      void checkAiStatus();
    } catch (e) {
      setError(toAiError(e).message);
    }
  };

  return (
    <>
      <label className="ai-settings__field">
        <span>{t('settings.aiKey')}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          placeholder={has ? '••••••••' : ''}
          onChange={(e) => {
            setKey(e.target.value);
          }}
        />
      </label>
      <div className="ai-settings__actions">
        <button
          type="button"
          className="btn"
          disabled={!key.trim()}
          onClick={() => {
            void save();
          }}
        >
          <KeyRound size={14} strokeWidth={1.75} aria-hidden="true" /> {t('settings.aiKeySave')}
        </button>
        {has && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              void remove();
            }}
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> {t('settings.aiKeyDelete')}
          </button>
        )}
        <span className="ai-settings__status" data-ok={has ? 'true' : 'false'}>
          {has === null ? '' : has ? t('settings.aiKeyStored') : t('settings.aiKeyNone')}
        </span>
      </div>
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">{t('settings.aiKeyHint')}</p>
    </>
  );
}
