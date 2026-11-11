import {
  Award,
  BookOpen,
  Check,
  Clock,
  FilePen,
  FileText,
  History,
  PencilRuler,
  Search,
  SearchX,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAiStore } from '@/ai/aiStore';
import { openManual } from '@/app/ai/analyze';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { normalizeForSearch } from '@/app/catalog';
import { useT } from '@/app/i18n';
import { chapterTitle, searchChapters } from '@/app/layout/libraryChapters';
import { Badges } from '@/app/learner/HomeScreen';
import { HistoryList } from '@/app/project/HistoryList';
import { useProjectUi } from '@/app/project/uiStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useProfileStore } from '@/app/learner/profileStore';
import { chaptersFor, GRADE_CHOICES, type LibraryTopic } from '@/app/levels';
import { lessonRange } from '@/app/curriculum';
import { openStudio, openTopic } from '@/app/topics';
import { SUBJECTS, useWorkspaceStore, type Subject } from '@/app/workspaceStore';
import { chapterProgress, topicStatus } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { useSafetyStore } from '@/safety/safetyStore';
import { useLessonsForTopic } from '@/studio/lessons';
import { useStudioStore } from '@/studio/studioStore';
import { cx } from '@/ui/cx';
import { hasScene } from '@/physics/registry';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { openProblemSheet } from './problemSheet';
import { SceneStill } from './SceneStill';

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
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const historyOpen = useProjectUi((s) => s.historyOpen);
  const setHistoryOpen = (open: boolean) => {
    useProjectUi.setState({ historyOpen: open });
  };
  const progress = useProgressStore(
    useShallow((s) => ({
      visited: s.visited,
      challenges: s.challenges,
      predictions: s.predictions,
    })),
  );
  const shelf = useMemo(() => chaptersFor(grade, subject), [grade, subject]);
  const chapters = useMemo(() => searchChapters(shelf, query, t), [shelf, query, t]);
  // Nothing found here: does another subject have it (§9.3 "Có 3 kết quả trong Hóa học")?
  const elsewhere = useMemo(
    () =>
      chapters.length > 0 || !normalizeForSearch(query)
        ? []
        : SUBJECTS.filter((s) => s !== subject)
            .map((s) => ({
              subject: s,
              count: searchChapters(chaptersFor(grade, s), query, t).reduce(
                (n, c) => n + c.topics.length,
                0,
              ),
            }))
            .filter((m) => m.count > 0),
    [chapters.length, query, subject, grade, t],
  );
  // The recovery buttons vanish once used: the keyboard focus goes to the grade they set.
  const allRef = useRef<HTMLButtonElement>(null);
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
        {/* "Lịch sử" at the bottom of the filters: Advanced (§9.3), or opened from Tệp → Lịch sử. */}
        {(advanced || historyOpen) && (
          <div className="shelf-history">
            <button
              type="button"
              className="btn btn--ghost"
              aria-expanded={historyOpen}
              onClick={() => {
                setHistoryOpen(!historyOpen);
              }}
            >
              <History size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('sidebar.history')}
            </button>
            {historyOpen && <HistoryList />}
            {advanced && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  useStudioStore.getState().setTab('authoring');
                  openStudio();
                }}
              >
                <FilePen size={16} strokeWidth={1.75} aria-hidden="true" />
                {t('studio.tabs.authoring')}
              </button>
            )}
          </div>
        )}
      </aside>

      <main className="shelf-main" aria-labelledby="shelf-title" data-subject-shelf={subject}>
        <header className="shelf-main__head">
          <h1 id="shelf-title">{t('home.title')}</h1>
          <div className="segmented shelf-grades" role="radiogroup" aria-label={t('levels.label')}>
            {GRADE_CHOICES.map((g) => (
              <button
                key={g}
                ref={g === 'all' ? allRef : undefined}
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
            <section className="shelf-start shelf-start--resume">
              {/* Thumbnail 160×96 (§9.3): the topic's own engine frame (physics only). */}
              {hasScene(lastTopic) && (
                <SceneStill topic={lastTopic} className="shelf-start__thumb" grid={false} />
              )}
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
          <ProblemCard />
        </div>

        {shelf.length === 0 && grade !== 'all' ? (
          // Never a dead end: a grade without topics in this subject leads back to every topic.
          <div className="shelf-empty" role="status">
            <BookOpen size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>{t('levels.empty', { subject: t(`subjects.${subject}`), grade })}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setGrade('all');
              }}
            >
              {t('levels.showAll')}
            </button>
          </div>
        ) : chapters.length === 0 ? (
          <div className="shelf-empty" role="status">
            <SearchX size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>{t('sidebar.noResults')}</p>
            {elsewhere.map((m) => (
              <button
                key={m.subject}
                type="button"
                className="btn"
                onClick={() => {
                  setSubject(m.subject);
                }}
              >
                {t('sidebar.foundIn', { count: m.count, subject: t(`subjects.${m.subject}`) })}
              </button>
            ))}
            {grade !== 'all' && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setGrade('all');
                  allRef.current?.focus();
                }}
              >
                {t('levels.showAll')}
              </button>
            )}
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
            // Progress counts the whole chapter, also while a search shows part of it.
            const whole = shelf.find((x) => x.id === c.id) ?? c;
            const done = chapterProgress(whole.topics, progress);
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
                      <ShelfCard
                        topic={topic}
                        subject={subject}
                        status={topicStatus(topic.id, progress)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <section className="shelf shelf-badges">
          <Badges />
        </section>
      </main>
    </div>
  );
}

function ShelfCard({
  topic,
  subject,
  status,
}: {
  topic: LibraryTopic;
  subject: Subject;
  status: ReturnType<typeof topicStatus>;
}) {
  const t = useT();
  const guided = useLessonsForTopic(topic.id).length;
  const soon = topic.status !== 'available';
  const descId = `shelf-card-${topic.id}-desc`;
  const Icon = SUBJECT_ICON[subject];
  // One button per card, named by its title only (its text): the lessons, the pending note and
  // the progress describe it. Its ::after covers the card, so the whole card is the target.
  return (
    <div className={cx('shelf-card', soon && 'shelf-card--soon')}>
      {/* Preview 88 (§9.3): a physics topic's own engine frame, else its subject's line art. */}
      <div className="shelf-card__preview" aria-hidden="true">
        {hasScene(topic.id) ? (
          <SceneStill topic={topic.id} className="shelf-card__still" grid={false} />
        ) : (
          <Icon size={32} strokeWidth={1.25} />
        )}
      </div>
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

/**
 * "Có đề bài?" (§9.3): "Phân tích đề" opens the Đề bài sheet (the screen's main action), or says
 * "Kết nối AI để phân tích đề" without a key (the same rule as the classic home); "Tự dựng cảnh"
 * beside it, filled instead for a learner who said they are under 18.
 */
function ProblemCard() {
  const t = useT();
  const ai = useAiStore(useShallow((s) => ({ provider: s.provider, status: s.status })));
  // Read on this computer (Gemma or a chosen local runtime): no API key needed.
  const onDevice = useAnalysisEngine() !== 'cloud';
  const needsKey = ai.provider !== 'off' && ai.status === 'noKey' && !onDevice;
  const minor = useSafetyStore((s) => s.status?.minor === true);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  return (
    <section className="shelf-start">
      <h2>{t('bench.haveProblem')}</h2>
      {/* The one-line field (§9.3) opens the Đề bài sheet. A button, not an input that opens it
          on focus: focus alone never changes the context (WCAG 3.2.1). */}
      {!minor && (
        <button type="button" className="shelf-start__field" onClick={openProblemSheet}>
          {t('bench.problemField')}
        </button>
      )}
      <div className="shelf-start__actions">
        {!minor && (
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              if (needsKey) openSettingsAt('ai');
              else openProblemSheet();
            }}
          >
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
            {needsKey ? t('home.connectFirst') : t('home.analyze')}
          </button>
        )}
        <button
          type="button"
          className={minor ? 'btn btn--accent' : 'btn btn--ghost'}
          aria-label={t('topbar.manual')}
          onClick={() => {
            void openManual();
          }}
        >
          <PencilRuler size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('home.manual')}
        </button>
      </div>
    </section>
  );
}
