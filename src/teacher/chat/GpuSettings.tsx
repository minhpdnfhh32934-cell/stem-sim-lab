import { isTauri } from '@tauri-apps/api/core';
import { CircleAlert, Cpu, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  compareWithWebGpu,
  loadGpuStatus,
  readWebGpuInfo,
  restartForGpu,
  saveGpuChoice,
  suggestedAdapter,
  useGpuStore,
  vramTooSmall,
  webGpuName,
  type GpuAdapter,
  type WebGpuInfo,
} from '@/ai/gpu';
import { webGemmaModel } from '@/ai/webGemmaModels';
import { formatNumber, useT, type TFunction } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { toast } from '@/ui/toast';
import { useChatStore } from './chatStore';
import './chat.css';

function formatVram(locale: Locale, mb: number): string {
  return mb >= 1024
    ? `${formatNumber(locale, mb / 1024, { maximumFractionDigits: 1 })} GB`
    : `${formatNumber(locale, mb)} MB`;
}

function kindLabel(t: TFunction, locale: Locale, adapter: GpuAdapter): string {
  if (adapter.kind === 'integrated') return t('chatSettings.gpu.integrated');
  if (adapter.kind === 'discrete')
    return t('chatSettings.gpu.discrete', { vram: formatVram(locale, adapter.dedicatedMb) });
  return t('chatSettings.gpu.unknownKind');
}

/** The "restart to apply" message with its button (Settings and the app-wide reminder). */
function RestartNotice({ onLater }: { onLater?: () => void }) {
  const t = useT();
  const status = useGpuStore((s) => s.status);
  const [error, setError] = useState('');
  if (!status?.restartNeeded) return null;
  const chosen = status.adapters.find((a) => a.id === status.choice);
  const text = status.choice
    ? t('chatSettings.gpu.restartNeeded', { name: chosen?.name ?? status.choiceName ?? '?' })
    : t('chatSettings.gpu.restartNeededAuto');
  return (
    <div className="gpu-notice gpu-notice--restart" role="alert">
      <p>
        <RotateCcw size={15} aria-hidden="true" />
        <span>{text}</span>
      </p>
      <div className="chat-settings__actions">
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            setError('');
            restartForGpu().catch((e: unknown) => {
              setError(String(e));
            });
          }}
        >
          <RotateCcw size={14} />
          {t('chatSettings.gpu.restartNow')}
        </button>
        {onLater && (
          <button type="button" className="btn" onClick={onLater}>
            <X size={14} />
            {t('chatSettings.gpu.later')}
          </button>
        )}
      </div>
      {error && <p className="chat-settings__error">{error}</p>}
    </div>
  );
}

/**
 * App-wide reminder after a GPU change (desktop): stays until the app restarts, or until the
 * learner closes it for this session.
 */
export function GpuRestartReminder() {
  const restartNeeded = useGpuStore((s) => s.status?.restartNeeded === true);
  const hidden = useGpuStore((s) => s.reminderHidden);
  const hide = useGpuStore((s) => s.hideReminder);
  if (!restartNeeded || hidden) return null;
  return (
    <div className="gpu-reminder">
      <RestartNotice onLater={hide} />
    </div>
  );
}

/** Settings → AI Teacher: which graphics card runs Gemma (and the whole app's WebGPU). */
export function GpuSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const desktop = isTauri();
  const status = useGpuStore((s) => s.status);
  const gemmaInfo = useGpuStore((s) => s.gemmaInfo);
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  const [loading, setLoading] = useState(desktop);
  const [scanError, setScanError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  /** undefined while reading. */
  const [webgpu, setWebgpu] = useState<WebGpuInfo | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void readWebGpuInfo().then((info) => {
      if (alive) setWebgpu(info);
    });
    if (desktop) {
      loadGpuStatus()
        .catch((e: unknown) => {
          if (alive) setScanError(String(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [desktop]);

  const choose = async (id: string | null) => {
    setSaving(true);
    setSaveError('');
    try {
      await saveGpuChoice(id);
      toast(t('chatSettings.gpu.saved'), 'info');
    } catch (e) {
      setSaveError(t('chatSettings.gpu.saveFailed', { detail: String(e) }));
    } finally {
      setSaving(false);
    }
  };

  const adapters = status?.adapters ?? [];
  const suggested = suggestedAdapter(adapters);
  const startupAdapter = adapters.find((a) => a.id === status?.startupChoice);
  const choiceAdapter = adapters.find((a) => a.id === status?.choice);
  // The saved card was not found when the app started (turned off, removed…).
  const missingName =
    status?.startupChoice && !status.startupApplied
      ? (status.choiceName ?? status.startupChoice)
      : null;
  // Only judge what WebGPU uses against a card that start-up really passed to WebView2.
  const observed = gemmaInfo ?? webgpu ?? null;
  const comparison =
    status?.startupApplied === true
      ? compareWithWebGpu(startupAdapter, observed, adapters)
      : 'unknown';
  const model = webGemmaModel(gemmaModel);
  const vramWarning = model && vramTooSmall(choiceAdapter, model.bytes);

  let picker: ReactNode;
  if (!desktop) {
    picker = <p className="muted small">{t('chatSettings.gpu.browserOnly')}</p>;
  } else if (loading) {
    picker = <p className="muted small">{t('chatSettings.gpu.scanning')}</p>;
  } else if (scanError) {
    picker = (
      <p className="chat-settings__error" role="alert">
        <CircleAlert size={14} />
        {t('chatSettings.gpu.scanFailed', { detail: scanError })}
      </p>
    );
  } else if (!status?.supported) {
    picker = <p className="muted small">{t('chatSettings.gpu.unsupported')}</p>;
  } else if (adapters.length === 0) {
    picker = <p className="muted small">{t('chatSettings.gpu.none')}</p>;
  } else {
    picker = (
      <fieldset className="chat-settings__models" aria-label={t('chatSettings.gpu.title')}>
        <article className={`chat-settings__model${status.choice === null ? ' is-selected' : ''}`}>
          <label className="chat-settings__model-choice">
            <input
              type="radio"
              name="gpu-choice"
              value=""
              checked={status.choice === null}
              disabled={saving}
              onChange={() => void choose(null)}
            />
            <span className="chat-settings__model-copy">
              <strong>{t('chatSettings.gpu.auto')}</strong>
              <small>{t('chatSettings.gpu.autoHint')}</small>
            </span>
          </label>
        </article>
        {adapters.map((a) => (
          <article
            key={a.id}
            className={`chat-settings__model${status.choice === a.id ? ' is-selected' : ''}`}
          >
            <label className="chat-settings__model-choice">
              <input
                type="radio"
                name="gpu-choice"
                value={a.id}
                checked={status.choice === a.id}
                disabled={saving}
                onChange={() => void choose(a.id)}
              />
              <span className="chat-settings__model-copy">
                <strong>{a.name}</strong>
                <small>{kindLabel(t, locale, a)}</small>
              </span>
              {suggested?.id === a.id && (
                <span className="chat-settings__recommended">
                  {t('chatSettings.gpu.suggested')}
                </span>
              )}
            </label>
          </article>
        ))}
      </fieldset>
    );
  }

  return (
    <fieldset className="settings-group chat-settings__gpu">
      <legend>
        <Cpu size={15} aria-hidden="true" />
        {t('chatSettings.gpu.title')}
      </legend>
      <p className="muted small">{t('chatSettings.gpu.intro')}</p>
      {picker}
      {saveError && (
        <p className="chat-settings__error" role="alert">
          <CircleAlert size={14} />
          {saveError}
        </p>
      )}
      {missingName && (
        <p className="gpu-notice gpu-notice--warn" role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>{t('chatSettings.gpu.missing', { name: missingName })}</span>
        </p>
      )}
      <RestartNotice />
      {vramWarning && choiceAdapter && (
        <p className="gpu-notice gpu-notice--warn" role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>
            {t('chatSettings.gpu.vramLow', {
              vram: formatVram(locale, choiceAdapter.dedicatedMb),
              model: model.id,
              size: model.sizeLabel,
            })}
          </span>
        </p>
      )}
      {desktop && status?.supported && adapters.length > 1 && (
        <p className="muted small">{t('chatSettings.gpu.wholeApp')}</p>
      )}
      {webgpu !== undefined && (
        <p className="muted small" data-testid="gpu-running-on">
          {webgpu
            ? t('chatSettings.gpu.runningOn', { name: webGpuName(webgpu, adapters) })
            : t('chatSettings.gpu.runningOnUnknown')}
        </p>
      )}
      {gemmaInfo && (
        <p className="muted small">
          {t('chatSettings.gpu.gemmaRanOn', { name: webGpuName(gemmaInfo, adapters) })}
        </p>
      )}
      {comparison === 'mismatch' && startupAdapter && observed && (
        <p className="gpu-notice gpu-notice--warn" role="alert">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>
            {t('chatSettings.gpu.mismatch', {
              wanted: startupAdapter.name,
              actual: webGpuName(observed, adapters),
            })}
          </span>
        </p>
      )}
    </fieldset>
  );
}
