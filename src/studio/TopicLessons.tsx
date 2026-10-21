import { Atom, ChevronRight } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { Section } from '@/ui/Section';
import { openLesson, useLessonsForTopic } from './lessons';

/** Inspector card of an open lab topic: its Science Studio lessons, if it has any. */
export function TopicLessons({ topicId }: { topicId: string | null }) {
  const t = useT();
  const L = useLocalized();
  const lessons = useLessonsForTopic(topicId);
  if (lessons.length === 0) return null;
  return (
    <Section title={t('studio.lessons.title')}>
      <div className="topic-lessons">
        <p className="muted small">{t('studio.lessons.intro')}</p>
        {lessons.map((s) => (
          <button
            key={s.id}
            type="button"
            className="btn topic-lessons__open"
            onClick={() => {
              openLesson(s);
            }}
          >
            <Atom size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="topic-lessons__title">
              {t('studio.lessons.open', { title: L(s.title) })}
              {s.author === 'teacher' && (
                <span className="muted small">{t('studio.lessons.teacher')}</span>
              )}
            </span>
            <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ))}
      </div>
    </Section>
  );
}
