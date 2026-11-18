import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/ui/EmptyState';
import { openTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { ScreenScan } from './ScreenScan';
import { useChatStore } from './chatStore';
import { useT } from '@/app/i18n';
import { teacherLocked, useSafetyStore } from '@/safety/safetyStore';
import { ChatPanel } from './ChatPanel';
import './chat.css';

export function ChatBubble() {
  const t = useT();
  const setIncludeScreen = useChatStore((s) => s.setIncludeScreen);
  const [open, setOpen] = useState(false);
  // Under 18 AI Teacher stays closed (#246): the bubble says so instead of opening the chat.
  const locked = useSafetyStore(teacherLocked);
  // A question another screen wrote (askInBubble) opens the bubble; the panel takes the text.
  const asked = useTeacherStore((s) => s.bubbleDraft !== null);
  const [wasAsked, setWasAsked] = useState(false);
  if (asked !== wasAsked) {
    setWasAsked(asked);
    if (asked && !open) setOpen(true);
  }
  const expand = () => {
    setIncludeScreen(false);
    setOpen(false);
    openTeacher();
  };
  return (
    <div className="chat-bubble-root">
      <ScreenScan />
      {open && locked && (
        <section className="chat-panel chat-panel--compact" aria-label={t('chat.label')}>
          <header className="chat-panel__header">
            <strong>{t('chat.title')}</strong>
            <button
              type="button"
              className="chat-panel__icon-button"
              onClick={() => {
                setOpen(false);
              }}
              aria-label={t('chat.close')}
            >
              <X size={18} />
            </button>
          </header>
          <EmptyState icon={Lock} title={t('teacher.ageLocked')} compact>
            <p>{t('safety.gate.minorNote')}</p>
          </EmptyState>
        </section>
      )}
      {open && !locked && (
        <ChatPanel
          compact
          onClose={() => {
            // Screen context is opt-in every time the bubble opens, also when a screen opens it.
            setIncludeScreen(false);
            setOpen(false);
          }}
          onExpand={expand}
        />
      )}
      {/* While the chat is open its own header has the close button. */}
      {!open && (
        <button
          type="button"
          className="chat-bubble"
          onClick={() => {
            // Screen context is opt-in every time the bubble opens.
            setIncludeScreen(false);
            setOpen(true);
          }}
          aria-expanded={false}
          aria-label={t('chat.title')}
          data-tip={t('chat.title')}
          data-tip-side="left"
        >
          <TeacherFace className="chat-bubble__face" trackCursor={false} />
        </button>
      )}
    </div>
  );
}
