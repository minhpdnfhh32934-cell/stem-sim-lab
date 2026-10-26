import {
  Atom,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  History,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { chapterProgress, topicProgress } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { memo, useMemo, useState } from 'react';
import { normalizeForSearch } from '@/app/catalog';
import { lessonRange } from '@/app/curriculum';
import { useT, type TFunction } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { openStudio, openTopic, useActiveTopic, useIsStudio } from '@/app/topics';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { HistoryList } from '@/app/project/HistoryList';
import { useProfileStore } from '@/app/learner/profileStore';
import { chaptersFor, GRADE_CHOICES, type LibraryChapter } from '@/app/levels';
import '@/app/learner/learner.css';
import { EmptyState } from '@/ui/EmptyState';
import { Tabs } from '@/ui/Tabs';
import { useLayoutStore, type LeftTab } from './layoutStore';

export const LeftSidebar = memo(function LeftSidebar() {
  const t = useT();
  const tab = useLayoutStore((s) => s.leftTab);
  const setTab = useLayoutStore((s) => s.setLeftTab);

  return (
    <aside className="panel sidebar" aria-label={t('sidebar.regionLabel')} data-tour="library">
      <Tabs<LeftTab>
        label={t('sidebar.regionLabel')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'library', label: t('sidebar.library'), icon: BookOpen },
          { id: 'history', label: t('sidebar.history'), icon: History },
        ]}
      />
      <StudioEntry t={t} />
      {tab === 'library' ? <Library t={t} /> : <HistoryList />}
    </aside>
  );
});

/** The lab's one way into Science Studio: every lesson, built-in or written by a teacher. */
function StudioEntry({ t }: { t: TFunction }) {
  const studio = useIsStudio();
  return (
    <button
      type="button"
      className="sidebar__studio"
      aria-current={studio ? 'page' : undefined}
      onClick={openStudio}
    >
      <Atom size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="sidebar__studio-copy">
        <strong>{t('sidebar.studio')}</strong>
        <span>{t('sidebar.studioHint')}</span>
      </span>
      <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const chapterTitle = (c: LibraryChapter, t: TFunction) =>
  'key' in c.title ? t(c.title.key) : c.title.text;

/** Chapters whose title or topics match the query (accent- and case-insensitive). */
function searchChapters(all: LibraryChapter[], query: string, t: TFunction): LibraryChapter[] {
  const q = normalizeForSearch(query);
  if (!q) return all;
  return all
    .map((c) => ({
      ...c,
      topics: c.topics.filter(
        (topic) =>
          normalizeForSearch(t(topic.titleKey)).includes(q) ||
          normalizeForSearch(chapterTitle(c, t)).includes(q),
      ),
    }))
    .filter((c) => c.topics.length > 0);
}

function Library({ t }: { t: TFunction }) {
  const subject = useWorkspaceStore((s) => s.subject);
  const grade = useProfileStore((s) => s.grade);
  const setGrade = useProfileStore((s) => s.setGrade);
  const [query, setQuery] = useState('');
  const SubjectIcon = SUBJECT_ICON[subject];

  const setSubject = useWorkspaceStore((s) => s.setSubject);
  // The search looks only in the chosen view (a grade, or every topic).
  const shelf = useMemo(() => chaptersFor(grade, subject), [grade, subject]);
  const chapters = useMemo(() => searchChapters(shelf, query, t), [shelf, query, t]);
  // Nothing here: does another subject have it? (gallery pattern 092, recover from no results)
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

  return (
    <>
      <div className="level-switch">
        <div className="segmented" role="radiogroup" aria-label={t('levels.label')}>
          {GRADE_CHOICES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              className="segmented__item"
              data-tip={g === 'all' ? t('levels.allDesc') : t('levels.gradeDesc', { grade: g })}
              onClick={() => {
                setGrade(g);
              }}
            >
              {g === 'all' ? t('levels.all') : t('levels.grade', { grade: g })}
            </button>
          ))}
        </div>
      </div>
      {grade !== 'all' && <p className="level-note">{t('levels.source')}</p>}
      <div className="sidebar__search">
        <Search size={14} strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          placeholder={t('sidebar.search')}
          aria-label={t('sidebar.search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </div>
      <div className="panel__scroll">
        <p className="sidebar__subject">
          <SubjectIcon size={14} strokeWidth={1.75} aria-hidden="true" />
          {t(`subjects.${subject}`)}
        </p>
        {chapters.length === 0 ? (
          // Never a dead end: a grade without topics here, or a search without results.
          <EmptyState icon={shelf.length === 0 ? BookOpen : SearchX} compact>
            <p>
              {shelf.length === 0 && grade !== 'all'
                ? t('levels.empty', { subject: t(`subjects.${subject}`), grade })
                : t('sidebar.noResults')}
            </p>
            <div className="sidebar__recover">
              {elsewhere.map((m) => {
                const Icon = SUBJECT_ICON[m.subject];
                return (
                  <button
                    key={m.subject}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSubject(m.subject);
                    }}
                  >
                    <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                    {t('sidebar.foundIn', {
                      count: m.count,
                      subject: t(`subjects.${m.subject}`),
                    })}
                  </button>
                );
              })}
              {grade !== 'all' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setGrade('all');
                  }}
                >
                  <BookOpen size={15} strokeWidth={1.75} aria-hidden="true" />
                  {t('levels.showAll')}
                </button>
              )}
              {query && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setQuery('');
                  }}
                >
                  <X size={15} strokeWidth={1.75} aria-hidden="true" />
                  {t('sidebar.clearSearch')}
                </button>
              )}
            </div>
          </EmptyState>
        ) : (
          <ul className="tree" aria-label={t(`subjects.${subject}`)}>
            {chapters.map((c) => (
              <ChapterNode key={c.id} chapter={c} t={t} forceOpen={query.length > 0} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ChapterNode({
  chapter,
  t,
  forceOpen,
}: {
  chapter: LibraryChapter;
  t: TFunction;
  forceOpen: boolean;
}) {
  const activeTopic = useActiveTopic();
  const progress = useProgressStore(
    useShallow((s) => ({
      visited: s.visited,
      challenges: s.challenges,
      predictions: s.predictions,
    })),
  );
  const chapterDone = chapterProgress(chapter.topics, progress);
  const [open, setOpen] = useState(true);
  const expanded = open || forceOpen;
  return (
    <li className="tree__chapter" data-expanded={expanded}>
      <button
        type="button"
        className="tree__chapter-btn"
        aria-expanded={expanded}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <ChevronRight className="tree__chevron" size={14} strokeWidth={2} aria-hidden="true" />
        <span>{chapterTitle(chapter, t)}</span>
        {chapterDone.done > 0 ? (
          <span
            className="tree__count tree__count--progress"
            aria-label={t('learn.progress', chapterDone)}
          >
            {chapterDone.done}/{chapterDone.total}
          </span>
        ) : (
          <span className="tree__count">{chapter.topics.length}</span>
        )}
      </button>
      {expanded && (
        <ul className="tree__topics">
          {chapter.topics.map((topic) =>
            topic.status === 'available' ? (
              <li key={topic.id} data-status={topic.status} className="tree__topic-item">
                <button
                  type="button"
                  className="tree__topic tree__topic--button"
                  aria-current={activeTopic === topic.id ? 'true' : undefined}
                  onClick={() => {
                    void openTopic(topic.id);
                  }}
                >
                  <span className="tree__topic-title">{t(topic.titleKey)}</span>
                  {topic.lessons.length > 0 && (
                    <>
                      {/* The space keeps "… đều Bài 4–5" apart in the accessible name. */}{' '}
                      <span className="tree__lessons">
                        {t('levels.lessons', { range: lessonRange(topic.lessons) })}
                      </span>
                    </>
                  )}
                  {topicProgress(topic.id, progress).complete && (
                    <CheckCircle2
                      className="tree__done"
                      size={14}
                      strokeWidth={2}
                      aria-label={t('learn.topicDone')}
                    />
                  )}
                </button>
              </li>
            ) : (
              <li
                key={topic.id}
                data-status={topic.status}
                className="tree__topic"
                data-tip={t('sidebar.comingSoonHint')}
                data-tip-side="right"
              >
                <span className="tree__topic-title">{t(topic.titleKey)}</span>
                <span className="tree__soon">{t('sidebar.comingSoon')}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  );
}
