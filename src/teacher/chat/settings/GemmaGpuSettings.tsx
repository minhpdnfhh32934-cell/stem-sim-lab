import { MemoryStick, Ruler } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ANSWER_LENGTHS, ANSWER_TOKENS, UNLOAD_CHOICES, useGemmaPrefs } from '@/ai/gemmaPrefs';
import { freeGemmaMemory, loadedGemma } from '@/ai/webGemma';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { GpuSettings } from '../GpuSettings';

/**
 * "GPU cho Gemma": which graphics card runs the in-app AI (the desktop app switches WebView2 to
 * it at start-up, `GpuSettings`), how long an answer may be, and when the model leaves the GPU
 * memory. Every control changes how the engine really runs.
 */
export function GemmaGpuSettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const prefs = useGemmaPrefs();
  const [loaded, setLoaded] = useState<string | null>(() => loadedGemma());
  const lengthId = useId();
  const unloadId = useId();

  useEffect(() => {
    const update = () => {
      setLoaded(loadedGemma());
    };
    window.addEventListener('stemsim:gemma-memory', update);
    return () => {
      window.removeEventListener('stemsim:gemma-memory', update);
    };
  }, []);

  return (
    <>
      <GpuSettings />

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
        <p className="muted small">
          {t('gpuSettings.loaded')}: {loaded ?? t('gpuSettings.notLoaded')}
        </p>
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
