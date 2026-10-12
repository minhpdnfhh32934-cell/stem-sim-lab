import { X } from 'lucide-react';
import { useState } from 'react';
import { openTeacher } from '@/teacher/teacherStore';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { ScreenScan } from './ScreenScan';
import { useChatStore } from './chatStore';
import { useT } from '@/app/i18n';
import { ChatPanel } from './ChatPanel';
import './chat.css';

export function ChatBubble() {
  const t = useT();
  const setIncludeScreen = useChatStore((s) => s.setIncludeScreen);
  const [open, setOpen] = useState(false);
  const expand = () => {
    setIncludeScreen(false);
    setOpen(false);
    openTeacher();
  };
  return (
    <div className="chat-bubble-root">
      <ScreenScan />
      {open && (
        <ChatPanel
          compact
          onClose={() => {
            setOpen(false);
          }}
          onExpand={expand}
        />
      )}
      <button
        type="button"
        className="chat-bubble"
        onClick={() => {
          // Screen context is opt-in every time the bubble opens.
          if (!open) setIncludeScreen(false);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label={open ? t('chat.close') : t('chat.title')}
      >
        {open ? <X size={22} /> : <TeacherFace className="chat-bubble__face" trackCursor={false} />}
        {!open && <span>{t('chat.title')}</span>}
      </button>
    </div>
  );
}
