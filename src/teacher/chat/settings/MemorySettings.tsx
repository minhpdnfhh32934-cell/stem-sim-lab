import { Archive, Brain, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { STORED_MESSAGES, useChatStore, type MemoryLength } from '../chatStore';
import '../chat.css';

const MEMORY_LENGTHS: readonly MemoryLength[] = ['medium', 'long'];

/**
 * "Trí nhớ hội thoại": how much of the conversation goes with each question (a token budget per
 * engine; older turns are summarised, `memory.ts`), whether the conversation stays on this
 * computer, and a way to forget it.
 */
export function MemorySettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const length = useChatStore((s) => s.memoryLength);
  const setLength = useChatStore((s) => s.setMemoryLength);
  const saveHistory = useChatStore((s) => s.saveHistory);
  const setSaveHistory = useChatStore((s) => s.setSaveHistory);
  const count = useChatStore((s) => s.messages.length);
  const hasSummary = useChatStore((s) => s.summary !== null);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [confirming, setConfirming] = useState(false);
  const labelId = useId();

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Brain size={15} aria-hidden="true" />
          {t('chatSettings.memory.title')}
        </legend>
        <p className="muted small">{t('chatSettings.memory.intro')}</p>
        <div className="settings-row">
          <span id={labelId}>{t('chatSettings.memory.title')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
            {MEMORY_LENGTHS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={length === item}
                className="segmented__item"
                onClick={() => {
                  setLength(item);
                }}
              >
                {t(`chatSettings.memory.${item}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {t(length === 'long' ? 'chatSettings.memory.longHint' : 'chatSettings.memory.mediumHint')}
        </p>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Archive size={15} aria-hidden="true" />
          {t('memorySettings.storeTitle')}
        </legend>
        <label className={`chat-toggle chat-settings__web${saveHistory ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={saveHistory}
            onChange={(e) => {
              setSaveHistory(e.target.checked);
            }}
          />
          <span className="chat-toggle__track">
            <span />
          </span>
          <span>
            <strong>{t('memorySettings.save')}</strong>
            <small>
              {saveHistory
                ? t('memorySettings.saveOn', { max: formatNumber(locale, STORED_MESSAGES) })
                : t('memorySettings.saveOff')}
            </small>
          </span>
        </label>
        <p className="muted small" role="status">
          {t('memorySettings.count', { count: formatNumber(locale, count) })}
          {hasSummary ? ` ${t('memorySettings.hasSummary')}` : ''}
        </p>
        <div className="settings-actions">
          {confirming ? (
            <>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  clearMessages();
                  setConfirming(false);
                }}
              >
                <Trash2 size={14} />
                {t('memorySettings.confirmClear')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('memorySettings.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={count === 0}
              onClick={() => {
                setConfirming(true);
              }}
            >
              <Trash2 size={14} />
              {t('memorySettings.clear')}
            </button>
          )}
        </div>
      </fieldset>
    </>
  );
}
