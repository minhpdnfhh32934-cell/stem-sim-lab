import { Play, Volume2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { listVoices, speak, speechSupported, stopSpeaking } from './speak';
import { VOICE_SAMPLE, VOICE_STYLES, useVoiceStore } from './voiceStore';

/** "Giọng nói của thầy": style presets, OS voice picker and a sample preview. */
export function VoiceSettings() {
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
