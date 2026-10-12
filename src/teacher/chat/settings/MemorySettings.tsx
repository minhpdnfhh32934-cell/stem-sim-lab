import { Archive, History, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { GEMMA_MEMORY_CAP, MEMORY_SIZES, STORED_MESSAGES, useChatStore } from '../chatStore';
import '../chat.css';

/**
 * "Trí nhớ hội thoại": how many earlier messages go with a new question, whether the
 * conversation stays on this computer, and a way to forget it.
 */
export function MemorySettings() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const memorySize = useChatStore((s) => s.memorySize);
  const setMemorySize = useChatStore((s) => s.setMemorySize);
  const saveHistory = useChatStore((s) => s.saveHistory);
  const setSaveHistory = useChatStore((s) => s.setSaveHistory);
  const count = useChatStore((s) => s.messages.length);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const [confirming, setConfirming] = useState(false);
  const sizeId = useId();

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <History size={15} aria-hidden="true" />
          {t('memorySettings.contextTitle')}
        </legend>
        <div className="settings-row">
          <span id={sizeId}>{t('memorySettings.size')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby={sizeId}>
            {MEMORY_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={memorySize === n}
                className="segmented__item"
                onClick={() => {
                  setMemorySize(n);
                }}
              >
                {n === 0 ? t('memorySettings.none') : formatNumber(locale, n)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {memorySize === 0
            ? t('memorySettings.sizeNone')
            : t('memorySettings.sizeHint', { count: formatNumber(locale, memorySize) })}
        </p>
        <p className="muted small">
          {t('memorySettings.gemmaCap', { count: formatNumber(locale, GEMMA_MEMORY_CAP) })}
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
