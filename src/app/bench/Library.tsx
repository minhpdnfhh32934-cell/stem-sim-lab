import { Award, Check, Clock, FileText, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { chapterTitle, searchChapters } from '@/app/layout/libraryChapters';
import { useProfileStore } from '@/app/learner/profileStore';
import { chaptersFor, GRADE_CHOICES, type LibraryTopic } from '@/app/levels';
import { lessonRange } from '@/app/curriculum';
import { openStudio, openTopic } from '@/app/topics';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { chapterProgress, topicStatus } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { useLessonsForTopic } from '@/studio/lessons';
import { cx } from '@/ui/cx';
import { openProblemSheet } from './problemSheet';

/**
 * "Kệ bài" (docs/BENCH_DESIGN.md §9.3): a filter column (subject, kind of lesson, search) and
 * shelves of topic cards by chapter, under "Hôm nay học gì?" with the grade switch and the
 * "Có đề bài?" card. The filter column keeps the "Thư viện chủ đề" landmark; a card's name is its
 * topic's name (the lessons, the pending note and the progress describe it).
 */
export function BenchLibrary() {
  const t = useT();
  const subject = useWorkspaceStore((s) => s.subject);
  const setSubject = useWorkspaceStore((s) => s.setSubject);
  const grade = useProfileStore((s) => s.grade);
  const setGrade = useProfileStore((s) => s.setGrade);
  const lastTopic = useProfileStore((s) => s.lastTopic);
  const [query, setQuery] = useState('');
  const progress = useProgressStore(
    useShallow((s) => ({
      visited: s.visited,
      challenges: s.challenges,
      predictions: s.predictions,
    })),
  );
  const shelf = useMemo(() => chaptersFor(grade, subject), [grade, subject]);
  const chapters = useMemo(() => searchChapters(shelf, query, t), [shelf, query, t]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SUBJECTS.map((s) => [
          s,
          chaptersFor(grade, s).reduce(
            (n, c) => n + c.topics.filter((x) => x.status === 'available').length,
            0,
          ),
        ]),
      ),
    [grade],
  );

  return (
    <div className="shelf-room">
      <aside className="shelf-filters" aria-label={t('sidebar.regionLabel')} data-tour="library">
        <h2 className="shelf-filters__title">{t('subjects.label')}</h2>
        <div className="shelf-subjects" role="radiogroup" aria-label={t('subjects.label')}>
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={subject === s}
              className="home__subject shelf-subject"
              data-subject={s}
              onClick={() => {
                setSubject(s);
              }}
            >
              <span className="shelf-subject__dot" aria-hidden="true" />
              <span className="shelf-subject__name">{t(`subjects.${s}`)}</span>
              <span className="shelf-subject__count" aria-hidden="true">
                {t('home.topicCount', { count: counts[s] ?? 0 })}
              </span>
            </button>
          ))}
        </div>
        <h2 className="shelf-filters__title">{t('bench.lessonKind')}</h2>
        <div className="segmented" role="radiogroup" aria-label={t('bench.lessonKind')}>
          <button type="button" role="radio" aria-checked className="segmented__item">
            {t('bench.lessonFree')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={false}
            className="segmented__item"
            onClick={openStudio}
          >
            {t('bench.lessonGuided')}
          </button>
        </div>
        <label className="shelf-search">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t('sidebar.search')}
            aria-label={t('sidebar.search')}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </label>
      </aside>

      <main className="shelf-main" aria-labelledby="shelf-title" data-subject-shelf={subject}>
        <header className="shelf-main__head">
          <h1 id="shelf-title">{t('home.title')}</h1>
          <div className="segmented shelf-grades" role="radiogroup" aria-label={t('levels.label')}>
            {GRADE_CHOICES.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={grade === g}
                className="segmented__item"
                onClick={() => {
                  setGrade(g);
                }}
              >
                {g === 'all' ? t('levels.all') : t('levels.grade', { grade: g })}
              </button>
            ))}
          </div>
          <p className="shelf-main__note">
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('levels.sourceNote')}
          </p>
        </header>

        <div className="shelf-cards">
          {lastTopic && (
            <section className="shelf-start">
              <h2>{t('home.continue')}</h2>
              <p className="shelf-start__topic">
                {t(`topics.${lastTopic}` as Parameters<typeof t>[0])}
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void openTopic(lastTopic);
                }}
              >
                {t('bench.reopen')}
              </button>
            </section>
          )}
          <section className="shelf-start">
            <h2>{t('bench.haveProblem')}</h2>
            <button type="button" className="btn btn--accent" onClick={openProblemSheet}>
              <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('home.analyze')}
            </button>
          </section>
        </div>

        {chapters.length === 0 ? (
          <div className="shelf-empty" role="status">
            <SearchX size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>{t('sidebar.noResults')}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery('');
              }}
            >
              {t('sidebar.clearSearch')}
            </button>
          </div>
        ) : (
          chapters.map((c) => {
            const done = chapterProgress(c.topics, progress);
            return (
              <section key={c.id} className="shelf" aria-labelledby={`shelf-${c.id}`}>
                <h2 id={`shelf-${c.id}`} className="shelf__title">
                  {chapterTitle(c, t)}
                  <span className="shelf__count">
                    {t('bench.chapterOpened', { done: done.done, total: done.total })}
                  </span>
                </h2>
                <ul className="shelf__grid">
                  {c.topics.map((topic) => (
                    <li key={topic.id}>
                      <ShelfCard topic={topic} status={topicStatus(topic.id, progress)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

function ShelfCard({
  topic,
  status,
}: {
  topic: LibraryTopic;
  status: ReturnType<typeof topicStatus>;
}) {
  const t = useT();
  const guided = useLessonsForTopic(topic.id).length;
  const soon = topic.status !== 'available';
  const descId = `shelf-card-${topic.id}-desc`;
  // One button per card, named by its title only (its text): the lessons, the pending note and
  // the progress describe it. Its ::after covers the card, so the whole card is the target.
  return (
    <div className={cx('shelf-card', soon && 'shelf-card--soon')}>
      <button
        type="button"
        className="shelf-card__open"
        aria-describedby={descId}
        aria-disabled={soon || undefined}
        onClick={() => {
          if (!soon) void openTopic(topic.id);
        }}
      >
        <span className="shelf-card__title">{t(topic.titleKey)}</span>
      </button>
      <span id={descId} className="shelf-card__meta">
        {soon && <span className="shelf-card__soon">{t('sidebar.comingSoon')}</span>}
        {topic.lessons.length > 0 && (
          <span className="shelf-card__lessons">
            {t(topic.lessons.length === 1 ? 'levels.lessonOne' : 'levels.lessons', {
              range: lessonRange(topic.lessons),
            })}{' '}
            · {t('bench.pendingTeacher')}
          </span>
        )}
        {status.state !== 'new' && (
          <span className="shelf-card__mark" data-state={status.state}>
            {status.state === 'complete' ? (
              <Award size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Check size={14} strokeWidth={2.25} aria-hidden="true" />
            )}
            {t(status.state === 'complete' ? 'bench.topicComplete' : 'bench.topicOpened')}
          </span>
        )}
        {guided > 0 && (
          <span className="shelf-card__guided">{t('bench.guidedCount', { count: guided })}</span>
        )}
      </span>
    </div>
  );
}
