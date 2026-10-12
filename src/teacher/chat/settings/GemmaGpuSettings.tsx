import { Gpu, MemoryStick, Ruler, Zap } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  ANSWER_LENGTHS,
  ANSWER_TOKENS,
  GPU_POWERS,
  UNLOAD_CHOICES,
  readGpuInfo,
  useGemmaPrefs,
  type GpuInfo,
} from '@/ai/gemmaPrefs';
import { freeGemmaMemory, loadedGemma, webGPUStatus } from '@/ai/webGemma';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { formatBytes } from './format';

/**
 * "GPU cho Gemma": what card WebGPU uses, which one to ask for, how long an answer may be and
 * when the model leaves the GPU memory. Every control changes how the engine really runs.
 */
export function GemmaGpuSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const prefs = useGemmaPrefs();
  const [info, setInfo] = useState<GpuInfo | null | 'checking'>('checking');
  const [loaded, setLoaded] = useState<string | null>(() => loadedGemma());
  const powerId = useId();
  const lengthId = useId();
  const unloadId = useId();
  const hasWebGpu = webGPUStatus() === 'webgpu';

  useEffect(() => {
    let alive = true;
    void readGpuInfo(prefs.power).then((next) => {
      if (alive) setInfo(next);
    });
    return () => {
      alive = false;
    };
  }, [prefs.power]);
  useEffect(() => {
    const update = () => {
      setLoaded(loadedGemma());
    };
    window.addEventListener('stemsim:gemma-memory', update);
    return () => {
      window.removeEventListener('stemsim:gemma-memory', update);
    };
  }, []);

  const card =
    info === 'checking'
      ? t('gpuSettings.checking')
      : info === null
        ? t('gpuSettings.none')
        : [info.vendor, info.architecture, info.description].filter(Boolean).join(' · ') ||
          t('gpuSettings.unnamed');

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Gpu size={15} aria-hidden="true" />
          {t('gpuSettings.cardTitle')}
        </legend>
        <dl className="settings-facts">
          <div>
            <dt>{t('gpuSettings.card')}</dt>
            <dd>{card}</dd>
          </div>
          {info !== 'checking' && info !== null && (
            <>
              <div>
                <dt>{t('gpuSettings.f16')}</dt>
                <dd>{info.shaderF16 ? t('gpuSettings.yes') : t('gpuSettings.no')}</dd>
              </div>
              <div>
                <dt>{t('gpuSettings.maxBuffer')}</dt>
                <dd className="mono">{formatBytes(info.maxBufferSize)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>{t('gpuSettings.loaded')}</dt>
            <dd>{loaded ?? t('gpuSettings.notLoaded')}</dd>
          </div>
        </dl>
        {info !== 'checking' && info !== null && info.fallback && (
          <p className="settings-warning" role="note">
            {t('gpuSettings.fallbackWarning')}
          </p>
        )}
        {!hasWebGpu && <p className="muted small">{t('chatSettings.webgpuRequired')}</p>}
        <p className="muted small">{t('gpuSettings.privacy')}</p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Zap size={15} aria-hidden="true" />
          {t('gpuSettings.powerTitle')}
        </legend>
        <div className="settings-row">
          <span id={powerId}>{t('gpuSettings.power')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={powerId}>
            {GPU_POWERS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={prefs.power === p}
                className="segmented__item"
                onClick={() => {
                  prefs.setPower(p);
                }}
              >
                {t(p === 'high-performance' ? 'gpuSettings.powerHigh' : 'gpuSettings.powerLow')}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">{t('gpuSettings.powerHint')}</p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Ruler size={15} aria-hidden="true" />
          {t('gpuSettings.lengthTitle')}
        </legend>
        <div className="settings-row">
          <span id={lengthId}>{t('gpuSettings.length')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={lengthId}>
            {ANSWER_LENGTHS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={prefs.answerLength === l}
                className="segmented__item"
                onClick={() => {
                  prefs.setAnswerLength(l);
                }}
              >
                {t(`gpuSettings.lengths.${l}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {t('gpuSettings.lengthHint', {
            tokens: formatNumber(locale, ANSWER_TOKENS[prefs.answerLength]),
          })}
        </p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <MemoryStick size={15} aria-hidden="true" />
          {t('gpuSettings.memoryTitle')}
        </legend>
        <div className="settings-row">
          <span id={unloadId}>{t('gpuSettings.unload')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={unloadId}>
            {UNLOAD_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={prefs.unloadAfterMin === m}
                className="segmented__item"
                onClick={() => {
                  prefs.setUnloadAfterMin(m);
                }}
              >
                {m === 0 ? t('gpuSettings.keep') : t('gpuSettings.after', { minutes: m })}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">{t('gpuSettings.unloadHint')}</p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            disabled={loaded === null}
            onClick={() => {
              freeGemmaMemory();
              setLoaded(loadedGemma());
            }}
          >
            {t('gpuSettings.freeNow')}
          </button>
        </div>
      </fieldset>
    </>
  );
}
