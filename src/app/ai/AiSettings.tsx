import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Bot,
  CircleAlert,
  CircleCheck,
  CircleX,
  ExternalLink,
  Eye,
  EyeOff,
  Hourglass,
  KeyRound,
  LoaderCircle,
  PlugZap,
  ShieldAlert,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n';
import { DEFAULT_MODELS, PROVIDERS, useAiStore, type ProviderChoice } from '@/ai/aiStore';
import { clearReadings, readingCount } from '@/ai/cache';
import type { KeyStatus } from '@/ai/keyTest';
import { getTransport } from '@/ai/transport';
import { toAiError, type Provider } from '@/ai/types';
import { IconButton } from '@/ui/IconButton';
import { ArtCopyKey, ArtCreateKey, ArtPasteKey } from './GuideArt';
import { checkAiStatus } from './useAiStatus';
import { useSafetyStore } from '@/safety/safetyStore';
import './ai.css';

const CHOICES: readonly ProviderChoice[] = [...PROVIDERS, 'off'];
const GEMINI_KEY_PAGE = 'https://aistudio.google.com/apikey';

/** Opens Google AI Studio's key page in the system browser (fixed address, set in Rust). */
function openGeminiKeyPage() {
  if (isTauri()) void invoke('open_gemini_key_page');
  else window.open(GEMINI_KEY_PAGE, '_blank', 'noopener,noreferrer');
}

/** Settings → "Kết nối AI" (PROMPT_PHAN_2 A2): provider, key guide, model, key, test, limits. */
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

      {__EDITION__ === 'pilot' && <p className="ai-guide__note">{t('settings.aiPilotKey')}</p>}

      {on && <ModelField provider={ai.provider as Provider} />}

      {on && !desktop && <p className="muted">{t('settings.aiCloudDesktopOnly')}</p>}
      {on && <KeyArea provider={ai.provider as Provider} desktop={desktop} />}
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
        </>
      )}
    </fieldset>
  );
}

/**
 * Pilot edition: only the supervisor (open session, src/safety) may enter or delete the key;
 * Rust checks it again. The main edition shows the key field to the adult user.
 */
function KeyArea({ provider, desktop }: { provider: Provider; desktop: boolean }) {
  const t = useT();
  const unlockedUntil = useSafetyStore((s) => s.unlockedUntil);
  // The countdown is shown in the safety section; here a stale "unlocked" only means Rust
  // refuses the save and the error is shown.
  const locked = __EDITION__ === 'pilot' && unlockedUntil === 0;
  if (locked) {
    return (
      <>
        <p className="ai-guide__note">{t('settings.aiPilotLocked')}</p>
        <KeyTestRow />
      </>
    );
  }
  return <KeyField key={provider} provider={provider} desktop={desktop} />;
}

const RESULT_TEXT = {
  ok: 'settings.aiStatusOk',
  noKey: 'settings.aiKeyNone',
  badKey: 'settings.aiStatusBadKey',
  quota: 'settings.aiStatusQuota',
  badModel: 'settings.aiStatusBadModel',
  offline: 'settings.aiStatusOffline',
  error: 'settings.aiStatusError',
  notAllowed: 'settings.aiStatusNotAllowed',
} as const satisfies Record<KeyStatus, string>;

const RESULT_ICON = {
  ok: CircleCheck,
  noKey: KeyRound,
  badKey: CircleX,
  quota: Hourglass,
  badModel: CircleAlert,
  offline: WifiOff,
  error: CircleAlert,
  notAllowed: ShieldAlert,
} as const;

/**
 * "Kiểm tra key" (PROMPT_PHAN_2 A2): one tiny request, then a clear result — thành công / key
 * không hợp lệ / hết hạn mức / không có mạng (and no key / unknown model / server error).
 */
function KeyTestRow() {
  const t = useT();
  const detail = useAiStore((s) => s.statusDetail);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<KeyStatus | null>(null);
  const run = async () => {
    setChecking(true);
    setResult(null);
    const status = await checkAiStatus(true);
    setChecking(false);
    setResult(status === 'unknown' ? null : status);
  };
  const Icon = result ? RESULT_ICON[result] : null;
  return (
    <div className="ai-settings__actions">
      <button
        type="button"
        className="btn"
        disabled={checking}
        onClick={() => {
          void run();
        }}
      >
        {checking ? (
          <LoaderCircle className="spin" size={14} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <PlugZap size={14} strokeWidth={1.75} aria-hidden="true" />
        )}
        {t('settings.aiTest')}
      </button>
      <span className="ai-test" role="status" data-result={result ?? (checking ? 'checking' : '')}>
        {checking && t('settings.aiStatusChecking')}
        {result && Icon && (
          <>
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
            {t(RESULT_TEXT[result], { detail })}
          </>
        )}
      </span>
    </div>
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
          <li key={s}>
            {t(`settings.geminiGuide.${s}`)}
            {s === 'step3' && <ArtCreateKey />}
            {s === 'step4' && <ArtCopyKey />}
            {s === 'step5' && <ArtPasteKey />}
          </li>
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

/**
 * API key field: password input with a show/hide button (Ctrl+V works), save and delete. After
 * saving only "••••••••abcd" is shown; the key itself stays in the OS keychain (Rust).
 */
function KeyField({ provider, desktop }: { provider: Provider; desktop: boolean }) {
  const t = useT();
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [hint, setHint] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState('');

  const refreshHint = async () => {
    const transport = getTransport();
    try {
      const h = transport.keyHint
        ? await transport.keyHint(provider)
        : (await transport.hasKey(provider))
          ? '••••••••'
          : null;
      setHint(h);
    } catch {
      setHint(null);
    }
  };

  useEffect(() => {
    let alive = true;
    const transport = getTransport();
    (transport.keyHint ? transport.keyHint(provider) : Promise.resolve(null))
      .then(async (h) => h ?? ((await transport.hasKey(provider)) ? '••••••••' : null))
      .then((h) => {
        if (alive) setHint(h);
      })
      .catch(() => {
        if (alive) setHint(null);
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
      setShow(false);
      await refreshHint();
      void checkAiStatus();
    } catch (e) {
      setError(toAiError(e).message);
    }
  };
  const remove = async () => {
    setError('');
    try {
      await getTransport().deleteKey(provider);
      setHint(null);
      void checkAiStatus();
    } catch (e) {
      setError(toAiError(e).message);
    }
  };

  return (
    <>
      {desktop && (
        <div className="ai-settings__field">
          <label htmlFor="ai-key-input">{t('settings.aiKey')}</label>
          <div className="ai-key">
            <input
              id="ai-key-input"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={key}
              placeholder={hint ?? ''}
              onChange={(e) => {
                setKey(e.target.value);
              }}
            />
            <IconButton
              icon={show ? EyeOff : Eye}
              label={show ? t('settings.aiKeyHide') : t('settings.aiKeyShow')}
              active={show}
              onClick={() => {
                setShow((v) => !v);
              }}
              tooltipSide="left"
            />
          </div>
        </div>
      )}
      <div className="ai-settings__actions">
        {desktop && (
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
        )}
        {desktop && hint && (
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
        <span className="ai-settings__status" data-ok={hint ? 'true' : 'false'}>
          {hint === undefined
            ? ''
            : hint
              ? t('settings.aiKeyStoredHint', { hint })
              : t('settings.aiKeyNone')}
        </span>
      </div>
      <KeyTestRow />
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      {desktop && <p className="muted small">{t('settings.aiKeyHint')}</p>}
    </>
  );
}
