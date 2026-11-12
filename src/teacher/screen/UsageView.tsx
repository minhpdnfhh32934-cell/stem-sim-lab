import { Gauge, Settings2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useAiStatusView } from '@/app/ai/aiStatusView';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';
import './teacherViews.css';

/** Today's count: read once when the view opens (null while reading; 'none' outside the app). */
type Count = number | null | 'none';

/**
 * "Lượt dùng" (#234 step 5, Advanced): today's online AI calls, in plain words. The count is the
 * Rust gateway's own (`ai_usage`, the counter `count_call` raises for every online chat or speech
 * call) and the cap is the learner's setting (`dailyCap`, 0 = none); nothing is estimated. The
 * provider's own free-tier limits are not known to SimLab, and the view says so.
 */
export function UsageView() {
  const t = useT();
  const titleId = useId();
  const locale = useSettingsStore((s) => s.locale);
  const cap = useAiStore((s) => s.dailyCap);
  const local = useAiStatusView().kind === 'local';
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const [count, setCount] = useState<Count>(() => (getTransport().usageToday ? null : 'none'));

  useEffect(() => {
    const transport = getTransport();
    if (!transport.usageToday) return;
    let alive = true;
    transport
      .usageToday()
      .then((n) => {
        if (alive) setCount(n);
      })
      .catch(() => {
        if (alive) setCount('none');
      });
    return () => {
      alive = false;
    };
  }, []);

  const n = (value: number) => formatNumber(locale, value);
  return (
    <section className="teacher-view" aria-labelledby={titleId}>
      <h2 id={titleId} className="teacher-view__title">
        <Gauge size={18} strokeWidth={1.75} aria-hidden="true" />
        {t('teacherViews.usage.title')}
      </h2>
      <p className="teacher-view__lead" role="status">
        {count === null
          ? t('teacherViews.usage.reading')
          : count === 'none'
            ? t('teacherViews.usage.unavailable')
            : cap > 0
              ? t('teacherViews.usage.today', { count: n(count), cap: n(cap) })
              : t('teacherViews.usage.todayNoCap', { count: n(count) })}
      </p>
      {typeof count === 'number' && cap > 0 && (
        <p>
          {count >= cap
            ? t('teacherViews.usage.used')
            : t('teacherViews.usage.left', { left: n(cap - count) })}
        </p>
      )}
      {local && <p>{t('teacherViews.usage.local')}</p>}
      <p>{t('teacherViews.usage.what')}</p>
      <p className="teacher-view__note">{t('teacherViews.usage.provider')}</p>
      <button
        type="button"
        className="btn teacher-view__action"
        onClick={() => {
          openSettingsAt('ai');
        }}
      >
        <Settings2 size={16} strokeWidth={1.75} aria-hidden="true" />
        {t('teacherViews.usage.settings')}
      </button>
    </section>
  );
}
