import {
  CircleAlert,
  CircleCheck,
  Cpu,
  Download,
  ExternalLink,
  LoaderCircle,
  Power,
  RotateCcw,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useBuiltinStore } from '@/ai/builtin/builtinStore';
import type { BuiltinStatus, DownloadFailure, Ineligible } from '@/ai/builtin/types';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { NEEDS_APP_UPDATE } from '@/ai/local/types';
import { useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { formatEta } from '@/ui/eta';
import { ProgressBar } from '@/ui/ProgressBar';
import { useChatStore } from '../chatStore';
import { formatBytes } from './format';
import { KnownPageLink } from './KnownPageLink';
import '../chat.css';

type T = ReturnType<typeof useT>;

/** Gigabytes of a card's own memory, as the learner reads it ("16 GB"). */
const gb = (mb: number) => String(Math.round(mb / 1024));

function ineligibleText(t: T, why: Ineligible): string {
  switch (why.reason) {
    case 'noDiscrete':
      return t('builtinAi.ineligible.noDiscrete');
    case 'tooSmall':
      return t('builtinAi.ineligible.tooSmall', { name: why.name, gb: gb(why.dedicatedMb) });
    case 'notListed':
      return t('builtinAi.ineligible.notListed', { name: why.name });
    case 'unknownKind':
      return t('builtinAi.ineligible.unknownKind', { name: why.name });
  }
}

const DOWNLOAD_KEYS: Record<DownloadFailure['kind'], MessageKey> = {
  noSpace: 'builtinAi.downloadError.noSpace',
  offline: 'builtinAi.downloadError.offline',
  stalled: 'builtinAi.downloadError.stalled',
  http: 'builtinAi.downloadError.http',
  badHost: 'builtinAi.downloadError.badFile',
  badSize: 'builtinAi.downloadError.badFile',
  badHash: 'builtinAi.downloadError.badFile',
  cancelled: 'builtinAi.downloadError.cancelled',
  disk: 'builtinAi.downloadError.disk',
};

/** The learner's sentence for a failed action (Rust's tag, and its JSON detail for a download). */
function errorText(t: T, message: string, locale: 'vi' | 'en'): string {
  const [tag = '', ...rest] = message.split(':');
  const detail = rest.join(':').trim();
  if (tag === 'builtin-download') {
    try {
      const f = JSON.parse(detail) as DownloadFailure;
      return t(DOWNLOAD_KEYS[f.kind], {
        need: f.kind === 'noSpace' ? formatBytes(f.need, locale) : '',
        free: f.kind === 'noSpace' ? formatBytes(f.free, locale) : '',
        status: f.kind === 'http' ? String(f.status) : '',
        detail: f.kind === 'disk' ? f.detail : '',
      });
    } catch {
      // Not the expected detail: the general sentence below.
    }
  }
  const keys: Record<string, MessageKey> = {
    'builtin-unsupported': 'chat.errors.builtinUnsupported',
    'builtin-no-runtime': 'chat.errors.builtinNoRuntime',
    'builtin-no-card': 'chat.errors.builtinNoCard',
    'builtin-no-model': 'chat.errors.builtinNoModel',
    'builtin-gpu-fault': 'chat.errors.builtinGpuFault',
    'builtin-start-failed': 'chat.errors.builtinStartFailed',
    'builtin-busy': 'chat.errors.builtinBusy',
  };
  const key = keys[tag];
  return key ? t(key) : t('builtinAi.failed', { detail: message });
}

function Terms({ t }: { t: T }) {
  return (
    <>
      <p className="muted small">{t('builtinAi.terms')}</p>
      <div className="settings-actions">
        <KnownPageLink
          id="qwen-model"
          href="https://huggingface.co/Qwen/Qwen3.5-9B"
          className="btn"
        >
          <ExternalLink size={13} />
          {t('builtinAi.openModel')}
        </KnownPageLink>
        <KnownPageLink
          id="apache-2"
          href="https://www.apache.org/licenses/LICENSE-2.0"
          className="btn"
        >
          <ExternalLink size={13} />
          {t('builtinAi.openApache')}
        </KnownPageLink>
        <KnownPageLink
          id="llama-cpp-licence"
          href="https://github.com/ggml-org/llama.cpp/blob/master/LICENSE"
          className="btn"
        >
          <ExternalLink size={13} />
          {t('builtinAi.openLlama')}
        </KnownPageLink>
      </div>
    </>
  );
}

/** Why Qwen cannot run here, before anything else is offered (null: it can). */
function blockedText(t: T, s: BuiltinStatus): string | null {
  if (!s.supported) return t('builtinAi.notDesktop');
  if (!s.runtime) return t('builtinAi.noRuntime');
  if (s.ineligible) return ineligibleText(t, s.ineligible);
  return null;
}

/**
 * "Qwen 3.5 9B (mạnh hơn Gemma)" on Settings → AI trong SimLab (#190): download size, what the
 * computer needs, the terms, download (resume, cancel), choose for AI Teacher, free the card,
 * delete, and "Bật lại" after a card fault. Only a discrete card with 8 GB or more may run it;
 * otherwise the card says why and offers nothing to download or run.
 */
export function QwenSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const { status, statusError, progress, busy, error } = useBuiltinStore();
  const store = useBuiltinStore.getState();
  const chosen = useLocalAiStore((s) => s.selected?.builtin === true);
  const engine = useChatStore((s) => s.engine);
  const inUse = chosen && engine === 'local';
  useEffect(() => {
    void useBuiltinStore.getState().refresh();
  }, []);

  const unselect = () => {
    useLocalAiStore.getState().select(null);
    useChatStore.getState().leaveLocal();
  };

  // A newer web part on an older desktop app: it has no llama-server, so no Qwen card at all
  // (only a new installer brings it).
  if (statusError === NEEDS_APP_UPDATE) return null;

  let body: ReactNode;
  if (!status) {
    body = (
      <p className="muted small" role="status">
        {statusError ? errorText(t, statusError, locale) : t('builtinAi.checking')}
      </p>
    );
  } else {
    const blocked = blockedText(t, status);
    const ready = status.model.state === 'ready';
    const partial = status.model.state === 'partial' ? status.model.bytes : null;
    const downloading = busy === 'download' || status.downloading;
    const percent =
      progress && status.size > 0
        ? Math.min(99, Math.floor((progress.bytes / status.size) * 100))
        : null;
    const progressText =
      progress === null
        ? t('builtinAi.progress')
        : [
            t('builtinAi.progress'),
            percent !== null ? `${String(percent)}%` : '',
            `${formatBytes(progress.bytes, locale)} / ${formatBytes(status.size, locale)}`,
            progress.eta !== null ? formatEta(t, progress.eta) : '',
          ]
            .filter(Boolean)
            .join(' · ');
    body = (
      <>
        <p className="muted small">
          {status.freeBytes !== null
            ? t('builtinAi.size', {
                size: formatBytes(status.size, locale),
                free: formatBytes(status.freeBytes, locale),
              })
            : t('builtinAi.sizeOnly', { size: formatBytes(status.size, locale) })}
        </p>
        <p className="muted small">
          {status.card
            ? t('builtinAi.needsHere', { name: status.card.name, gb: gb(status.card.dedicatedMb) })
            : t('builtinAi.needs')}
        </p>
        {blocked !== null && (
          <p className="chat-settings__error" role="status">
            <CircleAlert size={15} aria-hidden="true" />
            {blocked}
          </p>
        )}
        {status.gpuFault && (
          <p className="chat-settings__error" role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {t('builtinAi.gpuFault')}
          </p>
        )}
        {downloading && (
          <div className="chat-settings__progress" role="status" aria-live="polite">
            <div className="chat-settings__progress-copy">
              <span>
                <LoaderCircle size={15} className="spin" />
              </span>
              <strong>{progressText}</strong>
            </div>
            <ProgressBar value={percent} label={progressText} done={false} />
          </div>
        )}
        {ready && !status.gpuFault && (
          <p className="chat-settings__success" role="status">
            <CircleCheck size={15} aria-hidden="true" />
            {inUse
              ? status.server === 'running' && status.card
                ? t('builtinAi.running', { name: status.card.name })
                : status.server === 'starting' || busy === 'start'
                  ? t('builtinAi.starting')
                  : t('builtinAi.inUse')
              : t('builtinAi.ready')}
          </p>
        )}
        {error && (
          <p className="chat-settings__error" role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {errorText(t, error, locale)}
          </p>
        )}
        <div className="settings-actions">
          {status.gpuFault && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy !== null}
              onClick={() => void store.enable()}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('builtinAi.enable')}
            </button>
          )}
          {blocked === null && !ready && !downloading && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy !== null}
              onClick={() => void store.download()}
            >
              <Download size={15} aria-hidden="true" />
              {partial !== null
                ? t('builtinAi.resume', {
                    done: formatBytes(partial, locale),
                    size: formatBytes(status.size, locale),
                  })
                : t('builtinAi.download')}
            </button>
          )}
          {downloading && (
            <button type="button" className="btn" onClick={() => void store.cancel()}>
              <X size={14} aria-hidden="true" />
              {t('builtinAi.cancel')}
            </button>
          )}
          {blocked === null && ready && !status.gpuFault && !inUse && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy !== null}
              onClick={() => void store.choose()}
            >
              <Cpu size={14} aria-hidden="true" />
              {t('builtinAi.use')}
            </button>
          )}
          {inUse && (
            <button type="button" className="btn" disabled={busy !== null} onClick={unselect}>
              <Unplug size={14} aria-hidden="true" />
              {t('builtinAi.unselect')}
            </button>
          )}
          {status.server === 'running' && (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => void store.stop()}
            >
              <Power size={14} aria-hidden="true" />
              {t('builtinAi.stop')}
            </button>
          )}
          {(ready || partial !== null) && !downloading && (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => void store.remove()}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t('builtinAi.remove')}
            </button>
          )}
        </div>
        <Terms t={t} />
      </>
    );
  }

  return (
    <fieldset className="settings-group">
      <legend>
        <Cpu size={15} aria-hidden="true" />
        {t('builtinAi.title')}
      </legend>
      <p className="muted small">{t('builtinAi.intro')}</p>
      {body}
    </fieldset>
  );
}
