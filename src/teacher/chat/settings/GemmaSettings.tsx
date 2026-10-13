import {
  CircleAlert,
  CircleCheck,
  Cpu,
  Download,
  ExternalLink,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteWebGemma, downloadWebGemma, webGPUStatus, webGemmaStatus } from '@/ai/webGemma';
import { WEB_GEMMA_MODELS } from '@/ai/webGemmaModels';
import { useT, type MessageKey } from '@/app/i18n';
import { useChatStore } from '../chatStore';
import { downloadErrorKey } from '../downloadErrors';
import { formatBytes } from './format';
import { KnownPageLink } from './KnownPageLink';
import '../chat.css';

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
 * "AI local": the Gemma models that run inside the app (download with real progress, cancel,
 * delete, terms). The panel stays mounted while Settings shows another page, so a download
 * keeps its progress and its Cancel button.
 */
export function GemmaSettings() {
  const t = useT();
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  const setGemmaModel = useChatStore((s) => s.setGemmaModel);
  const [gpu, setGpu] = useState<boolean | null>(null);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const [checkingModels, setCheckingModels] = useState(true);
  const [gemmaWorking, setGemmaWorking] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<WebDownloadProgress | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);

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

  const pullModel = async (modelId: string) => {
    setGemmaModel(modelId);
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

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Cpu size={15} aria-hidden="true" />
          {t('chatSettings.gemmaModel')}
        </legend>
        <p className="muted small">{t('chatSettings.gemmaWhere')}</p>
        <div
          className="chat-settings__models"
          role="radiogroup"
          aria-label={t('chatSettings.gemmaModel')}
        >
          {WEB_GEMMA_MODELS.map((item) => {
            const selected = gemmaModel === item.id;
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
                      setGemmaModel(item.id);
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
        </div>
        <p className="muted small" role="status">
          {checkingModels
            ? t('chatSettings.checking')
            : gpu === false
              ? t('chatSettings.webgpuRequired')
              : readyMap[gemmaModel]
                ? t('chatSettings.modelReady')
                : t('chatSettings.modelMissing')}
        </p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <ExternalLink size={15} aria-hidden="true" />
          {t('chatSettings.gemmaTermsCard')}
        </legend>
        <p className="muted small">{t('chatSettings.gemmaTermsHint')}</p>
        <div className="settings-actions">
          <KnownPageLink id="gemma-terms" href="https://ai.google.dev/gemma/terms" className="btn">
            <ExternalLink size={13} />
            {t('chatSettings.gemmaTerms')}
          </KnownPageLink>
        </div>
      </fieldset>
    </>
  );
}
