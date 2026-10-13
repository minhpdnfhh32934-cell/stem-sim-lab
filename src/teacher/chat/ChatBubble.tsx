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
