import { Brain, Settings2 } from 'lucide-react';
import { useId } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { AiContentBar } from '@/safety/AiContentBar';
import { STORED_MESSAGES, useChatStore } from '@/teacher/chat/chatStore';
import './teacherViews.css';

/**
 * "Ghi nhớ" (#234 step 5, Advanced): what AI Teacher keeps of this conversation, in plain words.
 * Only what the chat store really holds: how many messages, the memory level, whether they stay
 * on this computer, and the AI-written summary of older turns (checked by `outputIsSafe` before
 * it was stored, summary.ts), labelled as AI content with its report button.
 */
export function MemoryView() {
  const t = useT();
  const titleId = useId();
  const locale = useSettingsStore((s) => s.locale);
  const count = useChatStore((s) => s.messages.length);
  const summary = useChatStore((s) => s.summary?.text.trim() ?? '');
  const length = useChatStore((s) => s.memoryLength);
  const saveHistory = useChatStore((s) => s.saveHistory);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);

  return (
    <section className="teacher-view" aria-labelledby={titleId}>
      <h2 id={titleId} className="teacher-view__title">
        <Brain size={18} strokeWidth={1.75} aria-hidden="true" />
        {t('teacherViews.memory.title')}
      </h2>
      <p className="teacher-view__lead">
        {count === 0
          ? t('teacherViews.memory.empty')
          : t('memorySettings.count', { count: formatNumber(locale, count) })}
      </p>
      <p>
        {t('teacherViews.memory.level', { level: t(`chatSettings.memory.${length}`) })}{' '}
        {saveHistory
          ? t('memorySettings.saveOn', { max: formatNumber(locale, STORED_MESSAGES) })
          : t('memorySettings.saveOff')}
      </p>
      {summary ? (
        <div className="teacher-view__card">
          <h3 className="teacher-view__subtitle">{t('teacherViews.memory.summaryTitle')}</h3>
          <p className="teacher-view__summary">{summary}</p>
          <AiContentBar />
        </div>
      ) : (
        count > 0 && <p>{t('teacherViews.memory.noSummary')}</p>
      )}
      <button
        type="button"
        className="btn teacher-view__action"
        onClick={() => {
          openSettingsAt('memory');
        }}
      >
        <Settings2 size={16} strokeWidth={1.75} aria-hidden="true" />
        {t('teacherViews.memory.settings')}
      </button>
    </section>
  );
}
