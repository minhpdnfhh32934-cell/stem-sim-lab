import { isTauri } from '@tauri-apps/api/core';
import { Bot, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n';
import { useAiStore, type ProviderChoice } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';
import { toAiError, type Provider } from '@/ai/types';
import { checkAiStatus } from './useAiStatus';
import './ai.css';

const PROVIDERS: ProviderChoice[] = ['lmstudio', 'openai', 'anthropic', 'off'];

/** Settings → "AI đọc đề": provider, LM Studio address, model, API key, timeout. */
export function AiSettings() {
  const t = useT();
  const ai = useAiStore();
  const desktop = isTauri();
  const cloud = ai.provider === 'openai' || ai.provider === 'anthropic';

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
          {PROVIDERS.map((p) => (
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

      {ai.provider === 'lmstudio' && (
        <label className="ai-settings__field">
          <span>{t('settings.aiBaseUrl')}</span>
          <input
            type="url"
            spellCheck={false}
            value={ai.baseUrl}
            onChange={(e) => {
              ai.setBaseUrl(e.target.value.trim());
            }}
          />
        </label>
      )}

      {ai.provider !== 'off' && <ModelField provider={ai.provider} />}

      {cloud && !desktop && <p className="muted">{t('settings.aiCloudDesktopOnly')}</p>}
      {cloud && desktop && <KeyField provider={ai.provider as Provider} />}
      {cloud && <p className="muted small">{t('settings.aiPrivacy')}</p>}

      {ai.provider !== 'off' && (
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
          <div className="ai-settings__actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void checkAiStatus();
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
                ? ai.provider === 'lmstudio'
                  ? t('settings.aiStatusOk', { count: ai.availableModels.length })
                  : t('settings.aiKeyStored')
                : ai.status === 'noKey'
                  ? t('settings.aiKeyNone')
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

function ModelField({ provider }: { provider: Provider }) {
  const t = useT();
  const model = useAiStore((s) => s.models[provider]);
  const available = useAiStore((s) => s.availableModels);
  const setModel = useAiStore((s) => s.setModel);
  if (provider === 'lmstudio') {
    const options = available.filter((m) => !/embed/i.test(m));
    return (
      <label className="ai-settings__field">
        <span>{t('settings.aiModel')}</span>
        <select
          value={model}
          onChange={(e) => {
            setModel(provider, e.target.value);
          }}
        >
          <option value="">{t('settings.aiModelAuto')}</option>
          {model && !options.includes(model) && <option value={model}>{model}</option>}
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="ai-settings__field" data-tip={t('settings.aiModelHint')}>
      <span>{t('settings.aiModel')}</span>
      <input
        type="text"
        spellCheck={false}
        value={model}
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
      void checkAiStatus();
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
