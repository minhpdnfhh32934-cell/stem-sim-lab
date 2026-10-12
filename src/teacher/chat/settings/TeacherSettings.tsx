import { isTauri } from '@tauri-apps/api/core';
import { Brain, Globe, HardDrive, KeyRound, Send, ShieldQuestion, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_MODELS, PROVIDERS, modelFor, useAiStore } from '@/ai/aiStore';
import type { Provider } from '@/ai/types';
import { getTransport } from '@/ai/transport';
import { useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { useChatStore } from '../chatStore';
import { builtinKnowledge } from '../knowledge';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import '../chat.css';

/**
 * "AI Teacher": Think (a second, independent API reviews every draft) and the live
 * "Dữ liệu của em đi đâu?" box.
 */
export function TeacherSettings() {
  const t = useT();
  const chat = useChatStore();
  const verifierProvider = useChatStore((s) => s.verifierProvider);
  const ai = useAiStore();
  const [working, setWorking] = useState(false);
  const [key, setKey] = useState('');
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState('');
  const desktop = isTauri();
  // Claude cannot be called from a web page (Anthropic needs the desktop gateway), so in the
  // browser it cannot review answers; Gemini and Groq work with a key kept for this session.
  const reviewerUnavailable = (p: Provider) => !desktop && p === 'claude';

  useEffect(() => {
    const transport = getTransport();
    if (!transport.keyHint) return;
    let alive = true;
    void transport
      .keyHint(verifierProvider)
      .then((hint) => {
        if (alive) setKeyHint(hint);
      })
      .catch(() => {
        if (alive) setKeyHint(null);
      });
    return () => {
      alive = false;
    };
  }, [verifierProvider]);
  useEffect(() => {
    if (ai.provider !== 'off' && verifierProvider === ai.provider) {
      const next = PROVIDERS.find((p) => p !== ai.provider);
      if (next) useChatStore.getState().setVerifierProvider(next);
    }
  }, [ai.provider, verifierProvider]);

  const saveVerifierKey = async () => {
    setWorking(true);
    setKeyStatus('');
    try {
      await getTransport().setKey(chat.verifierProvider, key.trim());
      window.dispatchEvent(new Event('stemsim:credentials-changed'));
      setKey('');
      const hint = await getTransport().keyHint?.(chat.verifierProvider);
      setKeyHint(hint ?? null);
      setKeyStatus(t('chatSettings.keySaved'));
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };
  const deleteVerifierKey = async () => {
    setWorking(true);
    try {
      await getTransport().deleteKey(chat.verifierProvider);
      window.dispatchEvent(new Event('stemsim:credentials-changed'));
      setKeyHint(null);
      setKeyStatus(t('chatSettings.keyDeleted'));
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };
  const testVerifierKey = async () => {
    setWorking(true);
    try {
      const result = await getTransport().testKey?.(
        chat.verifierProvider,
        chat.verifierModel.trim() || modelFor(ai.models, chat.verifierProvider),
      );
      setKeyStatus(
        result
          ? t(`chatSettings.keyTest.${result.status}` as MessageKey)
          : t('chatSettings.keyTest.failed'),
      );
    } catch (e) {
      setKeyStatus(String(e));
    } finally {
      setWorking(false);
    }
  };

  const keyLocked =
    ai.provider === chat.verifierProvider || reviewerUnavailable(chat.verifierProvider);
  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Brain size={15} aria-hidden="true" />
          {t('chatSettings.thinkCard')}
        </legend>
        <p className="muted small">{t('chatSettings.thinkHint')}</p>
        <div className="settings-row">
          <span>{t('chatSettings.verifier')}</span>
          <select
            value={chat.verifierProvider}
            disabled={working}
            onChange={(e) => {
              chat.setVerifierProvider(e.target.value as Provider);
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p} disabled={ai.provider === p || reviewerUnavailable(p)}>
                {t(`settings.aiProviders.${p}`)}
                {reviewerUnavailable(p) ? ` (${t('chatSettings.desktopOnly')})` : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="ai-settings__field">
          <span>{t('chatSettings.verifierModel')}</span>
          <input
            value={chat.verifierModel}
            onChange={(e) => {
              chat.setVerifierModel(e.target.value);
            }}
            placeholder={DEFAULT_MODELS[chat.verifierProvider]}
          />
        </label>
        <label className="ai-settings__field">
          <span>{t('chatSettings.verifierKey')}</span>
          <input
            type="password"
            value={key}
            autoComplete="new-password"
            onChange={(e) => {
              setKey(e.target.value);
            }}
            placeholder={keyHint ?? t('chatSettings.keyPlaceholder')}
            disabled={keyLocked}
          />
        </label>
        <div className="chat-settings__actions">
          <button
            type="button"
            className="btn btn--accent"
            disabled={working || !key.trim() || keyLocked}
            onClick={() => void saveVerifierKey()}
          >
            <KeyRound size={14} />
            {t('chatSettings.saveKey')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={
              working ||
              !keyHint ||
              keyLocked ||
              // Without the desktop gateway only Gemini keys can be probed from the page.
              (!desktop && chat.verifierProvider !== 'gemini')
            }
            onClick={() => void testVerifierKey()}
          >
            {t('chatSettings.testKey')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={working || !keyHint || keyLocked}
            onClick={() => void deleteVerifierKey()}
          >
            <Trash2 size={14} />
            {t('chatSettings.deleteKey')}
          </button>
        </div>
        {keyStatus && (
          <p className="muted small" role="status">
            {keyStatus}
          </p>
        )}
        <p className="muted small">{t('chatSettings.keyPrivacy')}</p>
        {!desktop && (
          <p className="muted small" role="note">
            {t('chatSettings.browserKeyNote')}
          </p>
        )}
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <ShieldQuestion size={15} aria-hidden="true" />
          {t('chatSettings.flowTitle')}
        </legend>
        <DataFlow desktop={desktop} />
      </fieldset>
    </>
  );
}

/**
 * "Dữ liệu của em đi đâu?": what stays on this computer and what the current settings
 * may send online. Built from the live settings, so it never overstates privacy.
 */
function DataFlow({ desktop }: { desktop: boolean }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const chat = useChatStore();
  const provider = useAiStore((s) => s.provider);
  const engine = useAnalysisEngine() === 'cloud' ? 'cloud' : 'gemma';
  const voiceEnabled = useVoiceStore((s) => s.enabled);
  const voiceEngine = useVoiceStore((s) => s.engine);
  const name = (p: string) => t(`settings.aiProviders.${p}` as MessageKey);
  const sent: string[] = [];
  if (engine === 'cloud' && provider !== 'off') {
    sent.push(t('chatSettings.flowAnswer', { name: name(provider) }));
  }
  if (engine === 'gemma')
    sent.push(t('chatSettings.flowThinkOnly', { name: name(chat.verifierProvider) }));
  else sent.push(t('chatSettings.flowThink', { name: name(chat.verifierProvider) }));
  if (chat.webLookup) sent.push(t('chatSettings.flowWiki'));
  if (voiceEnabled && voiceEngine === 'gemini') sent.push(t('chatSettings.flowVoice'));
  // The camera reads photos with the cloud API only in the browser (see photoVision.ts).
  if (!desktop && provider !== 'off')
    sent.push(t('chatSettings.flowPhoto', { name: name(provider) }));
  sent.push(t('chatSettings.flowModelDownload'));
  return (
    <section className="chat-settings__flow" aria-label={t('chatSettings.flowTitle')}>
      <div className="chat-settings__flow-grid">
        <div>
          <strong>
            <HardDrive size={14} aria-hidden="true" /> {t('chatSettings.flowLocalTitle')}
          </strong>
          <ul>
            <li>
              {chat.saveHistory
                ? t('chatSettings.flowLocalChat')
                : t('chatSettings.flowLocalChatSession')}
            </li>
            <li>{t('chatSettings.flowLocalDocs', { count: builtinKnowledge(locale).length })}</li>
            <li>{t('chatSettings.flowLocalModel')}</li>
            <li>
              {desktop
                ? t('chatSettings.flowLocalKeyDesktop')
                : t('chatSettings.flowLocalKeyBrowser')}
            </li>
          </ul>
        </div>
        <div>
          <strong>
            <Send size={14} aria-hidden="true" /> {t('chatSettings.flowSentTitle')}
          </strong>
          <ul>
            {sent.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted small">
        <Globe size={13} aria-hidden="true" /> {t('chatSettings.flowScreen')}
      </p>
    </section>
  );
}
