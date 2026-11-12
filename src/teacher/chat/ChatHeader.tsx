import { Maximize2, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import {
  speechSupported,
  stopSpeaking,
  vietnameseVoices,
  voicesWhenLoaded,
} from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { toast } from '@/ui/toast';
import { useChatStore, type ChatEngine } from './chatStore';

/** The chat's title bar: who answers, the voice, "Xóa cuộc trò chuyện", expand and close. */
export function ChatHeader({
  teacherPage,
  busy,
  engine,
  compact,
  onClear,
  onExpand,
  onClose,
}: {
  teacherPage: boolean;
  busy: boolean;
  engine: ChatEngine;
  compact: boolean;
  onClear: () => void;
  onExpand: (() => void) | undefined;
  onClose: (() => void) | undefined;
}) {
  const t = useT();
  const setEngine = useChatStore((s) => s.setEngine);
  const voiceEnabled = useVoiceStore((s) => s.enabled);
  const setVoiceEnabled = useVoiceStore((s) => s.setEnabled);
  const voiceSpeaking = useVoiceStore((s) => s.speaking);
  return (
    <header className="chat-panel__header">
      <div className="chat-panel__identity">
        {/* The big teacher face on the teacher page already identifies the
            teacher, so the small header face only shows in bubble mode. */}
        {!teacherPage && (
          <span className="chat-panel__avatar">
            <TeacherFace
              mood={busy ? 'thinking' : voiceSpeaking ? 'speaking' : 'idle'}
              trackCursor
            />
          </span>
        )}
        {/* On the teacher page the header's h1 says it (#205 B5). */}
        {!teacherPage && <strong>{t('chat.title')}</strong>}
      </div>
      <div className="chat-panel__header-actions">
        <label className="chat-engine" data-tip={t('chat.engineLabel')} data-tip-side="bottom">
          <span className="sr-only">{t('chat.engineLabel')}</span>
          <select
            aria-label={t('chat.engineLabel')}
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value as ChatEngine);
            }}
          >
            <option value="cloud">{t('chat.cloud')}</option>
            <option value="gemma">{t('chat.gemma')}</option>
            <option value="local">{t('chat.local')}</option>
          </select>
        </label>
        {speechSupported() && (
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={() => {
              if (voiceEnabled) stopSpeaking();
              setVoiceEnabled(!voiceEnabled);
              // Without a Vietnamese voice the Windows voice reads with the wrong accent
              // (seen on a test machine with only English voices, 2026-10-14). The list may
              // still be loading (WebView2: empty until "voiceschanged"), so wait for it.
              if (
                !voiceEnabled &&
                useVoiceStore.getState().engine === 'system' &&
                speechSupported()
              ) {
                void voicesWhenLoaded().then((voices) => {
                  const { enabled, engine: voiceEngine } = useVoiceStore.getState();
                  if (
                    enabled &&
                    voiceEngine === 'system' &&
                    vietnameseVoices(voices).length === 0
                  ) {
                    toast(t('voice.noVietnameseOnEnable'), 'warn');
                  }
                });
              }
            }}
            aria-pressed={voiceEnabled}
            aria-label={t('chat.voice')}
            title={t('chat.voiceHint')}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}
        <button
          type="button"
          className="chat-panel__icon-button"
          onClick={onClear}
          aria-label={t('chat.clear')}
          title={t('chat.clear')}
        >
          <Trash2 size={16} />
        </button>
        {compact && onExpand && (
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={onExpand}
            aria-label={t('chat.expand')}
          >
            <Maximize2 size={16} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="chat-panel__icon-button"
            onClick={onClose}
            aria-label={t('chat.close')}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
