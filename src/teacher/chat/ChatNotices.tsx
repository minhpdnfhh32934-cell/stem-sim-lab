import { CircleAlert, Globe, Settings2, ShieldCheck, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAiStore } from '@/ai/aiStore';
import { gemmaReady } from '@/ai/gemmaTransport';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { getTransport } from '@/ai/transport';
import { webGPUStatus } from '@/ai/webGemma';
import { PROVIDER_NAME } from '@/app/ai/aiStatusView';
import { engineKind, type AnalysisEngine } from '@/app/ai/engineChoice';
import { runtimeName } from '@/app/ai/localRuntime';
import { useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { useChatStore } from './chatStore';

/**
 * What the chat says before a question is asked: what is missing to answer (a key, a model, the
 * reviewer's key) with the Settings page that helps, or where the next question goes.
 */
export function ChatNotices({
  chosenEngine,
  withScreen,
  withBoard,
  pictureAsk,
}: {
  chosenEngine: AnalysisEngine;
  /** The screen's content goes with the question. */
  withScreen: boolean;
  /** The circled part of the board goes with the question. */
  withBoard: boolean;
  /** The circled part goes as a picture, to the AI on this computer only. */
  pictureAsk: boolean;
}) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const provider = useAiStore((s) => s.provider);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const chat = useChatStore();
  const engine = engineKind(chosenEngine);

  const fallbackChoice = useAiStore((s) => s.fallback);
  // The quota fallback (Settings → Kết nối AI): while the provider is out of quota the gateway asks
  // it instead, for a while without trying the provider first. Never with Think (every Think call
  // is sent without it), nor for another engine.
  const fallbackProvider =
    engine === 'cloud' &&
    provider !== 'off' &&
    !chat.thinkEnabled &&
    fallbackChoice !== 'off' &&
    fallbackChoice !== provider
      ? fallbackChoice
      : null;
  const localSelection = useLocalAiStore((s) => s.selected);
  // The Gemini voice reads every answer (chat and board) through Google: the text goes online.
  const voiceOnline = useVoiceStore((s) => s.enabled && s.engine === 'gemini');
  /** Latest cloud-key lookup, tagged so a stale answer never overrides a newer engine/provider. */
  const [keyLookup, setKeyLookup] = useState<{ id: string; available: boolean } | null>(null);
  /** Latest Gemma readiness lookup, tagged by model name for the same reason. */
  const [gemmaLookup, setGemmaLookup] = useState<{ model: string; ready: boolean } | null>(null);
  /** Think needs a key for the reviewing provider; checked up front so the learner knows why. */
  const [verifierLookup, setVerifierLookup] = useState<{ id: string; available: boolean } | null>(
    null,
  );
  /** Whether the quota fallback has a key (it can only be asked then), tagged by provider. */
  const [fallbackLookup, setFallbackLookup] = useState<{ id: string; available: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (engine !== 'cloud' || provider === 'off') return;
    const id = `${engine}/${provider}`;
    let alive = true;
    void getTransport()
      .hasKey(provider)
      .then((v) => {
        if (alive) setKeyLookup({ id, available: v });
      })
      .catch(() => {
        if (alive) setKeyLookup({ id, available: false });
      });
    return () => {
      alive = false;
    };
  }, [engine, chat.gemmaModel, provider]);

  useEffect(() => {
    const refreshKey = () => {
      if (engine === 'cloud' && provider !== 'off') {
        const id = `${engine}/${provider}`;
        void getTransport()
          .hasKey(provider)
          .then((available) => {
            setKeyLookup({ id, available });
          })
          .catch(() => {
            setKeyLookup({ id, available: false });
          });
      }
    };
    window.addEventListener('stemsim:credentials-changed', refreshKey);
    return () => {
      window.removeEventListener('stemsim:credentials-changed', refreshKey);
    };
  }, [engine, provider]);

  useEffect(() => {
    if (engine !== 'gemma') return;
    const model = chat.gemmaModel;
    let alive = true;
    void gemmaReady(model)
      .then((ready) => {
        if (alive) setGemmaLookup({ model, ready });
      })
      .catch(() => {
        if (alive) setGemmaLookup({ model, ready: false });
      });
    return () => {
      alive = false;
    };
  }, [engine, chat.gemmaModel]);

  useEffect(() => {
    if (engine !== 'gemma') return;
    const model = chat.gemmaModel;
    const refreshGemma = () => {
      void gemmaReady(model)
        .then((ready) => {
          setGemmaLookup({ model, ready });
        })
        .catch(() => {
          setGemmaLookup({ model, ready: false });
        });
    };
    window.addEventListener('stemsim:gemma-changed', refreshGemma);
    return () => {
      window.removeEventListener('stemsim:gemma-changed', refreshGemma);
    };
  }, [engine, chat.gemmaModel]);

  useEffect(() => {
    if (!chat.thinkEnabled) return;
    const checker = chat.verifierProvider;
    let alive = true;
    const lookup = () => {
      void getTransport()
        .hasKey(checker)
        .then((available) => {
          if (alive) setVerifierLookup({ id: checker, available });
        })
        .catch(() => {
          if (alive) setVerifierLookup({ id: checker, available: false });
        });
    };
    lookup();
    window.addEventListener('stemsim:credentials-changed', lookup);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:credentials-changed', lookup);
    };
  }, [chat.thinkEnabled, chat.verifierProvider]);

  useEffect(() => {
    if (fallbackProvider === null) return;
    const id = fallbackProvider;
    let alive = true;
    const lookup = () => {
      void getTransport()
        .hasKey(id)
        .then((available) => {
          if (alive) setFallbackLookup({ id, available });
        })
        .catch(() => {
          if (alive) setFallbackLookup({ id, available: false });
        });
    };
    lookup();
    window.addEventListener('stemsim:credentials-changed', lookup);
    return () => {
      alive = false;
      window.removeEventListener('stemsim:credentials-changed', lookup);
    };
  }, [fallbackProvider]);

  const lookupId = `${engine}/${provider}`;
  const keyAvailable: boolean | null =
    engine === 'cloud' && provider !== 'off' && keyLookup?.id === lookupId
      ? keyLookup.available
      : null;
  let gemmaReadyState: boolean | null = null;
  if (engine === 'gemma') {
    gemmaReadyState = gemmaLookup?.model === chat.gemmaModel ? gemmaLookup.ready : null;
  }
  const noApi = engine === 'cloud' && (provider === 'off' || keyAvailable === false);
  const noWebGpu = engine === 'gemma' && webGPUStatus() !== 'webgpu';
  const gemmaUnavailable = engine === 'gemma' && gemmaReadyState === false;
  const verifierMissing =
    chat.thinkEnabled && verifierLookup?.id === chat.verifierProvider && !verifierLookup.available;
  const localMissing = chosenEngine === 'local-missing';
  const notice: { text: string; section: SettingsSection } | null = localMissing
    ? { text: t('chat.localMissingNotice'), section: 'runtimes' }
    : noApi
      ? { text: t('chat.noApi'), section: 'ai' }
      : noWebGpu
        ? { text: t('chat.noWebgpuNotice'), section: 'local' }
        : gemmaUnavailable
          ? { text: t('chat.gemmaMissingNotice'), section: 'local' }
          : verifierMissing
            ? { text: t('chat.thinkNoVerifier'), section: 'teacher' }
            : null;
  // Where the next question goes, from the current settings (nothing is guessed).
  const providerName = (p: string) => t(`settings.aiProviders.${p}` as MessageKey);
  // The fallback is named only when it can really be asked (it has a key).
  const fallbackTarget =
    fallbackProvider !== null &&
    provider !== 'off' &&
    fallbackLookup?.id === fallbackProvider &&
    fallbackLookup.available
      ? t('chat.fallbackTarget', {
          name: PROVIDER_NAME[fallbackProvider],
          provider: PROVIDER_NAME[provider],
        })
      : null;
  const targets = [
    ...(engine === 'cloud' && provider !== 'off' ? [providerName(provider)] : []),
    ...(fallbackTarget ? [fallbackTarget] : []),
    ...(chat.thinkEnabled && !pictureAsk
      ? [t('chat.reviewTarget', { name: providerName(chat.verifierProvider) })]
      : []),
    ...(chat.webLookup && !withBoard ? ['Wikipedia'] : []),
  ];
  return (
    <>
      {notice && (
        <div className="chat-panel__notice" role="status">
          <CircleAlert size={17} />
          <span>{notice.text}</span>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              openSettingsAt(notice.section);
            }}
          >
            <Settings2 size={14} /> {t('chat.settings')}
          </button>
        </div>
      )}
      {!notice && targets.length === 0 && engine === 'gemma' && gemmaReadyState === true && (
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} /> {t('chat.localOnly')}
        </p>
      )}
      {!notice && targets.length === 0 && engine === 'local' && localSelection && (
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} />{' '}
          {/* "không gửi lên mạng" only while nothing else goes online (the voice below). */}
          {t(voiceOnline ? 'chat.localRuntimeHere' : 'chat.localOnlyRuntime', {
            name: runtimeName(locale, localSelection.kind),
            address: localSelection.baseUrl.replace(/^http:\/\//, ''),
          })}
          {/* SimLab promises only what it sends itself: a generic server may relay online. */}
          {localSelection.kind === 'openAiCompatible' && ` ${t('localRuntime.relayNote')}`}
        </p>
      )}
      {!notice && targets.length > 0 && (
        <p className="chat-panel__local-note chat-panel__local-note--online">
          <Globe size={14} />{' '}
          {t(
            withScreen
              ? 'chat.sentToWithScreen'
              : withBoard
                ? 'chat.sentToWithBoard'
                : 'chat.sentTo',
            { targets: targets.join(', ') },
          )}
        </p>
      )}
      {!notice && pictureAsk && (
        // A picture of the circled area: only to the AI on this computer (pictureReader.ts). Its
        // answer stays here too, so the Gemini voice does not read it (readAloud).
        <p className="chat-panel__local-note">
          <ShieldCheck size={14} />{' '}
          {t(voiceOnline ? 'board.ask.pictureLocalQuiet' : 'board.ask.pictureLocal')}
        </p>
      )}
      {!notice && voiceOnline && (
        <p className="chat-panel__local-note chat-panel__local-note--online">
          <Volume2 size={14} /> {t('chat.voiceOnline')}
        </p>
      )}
    </>
  );
}
