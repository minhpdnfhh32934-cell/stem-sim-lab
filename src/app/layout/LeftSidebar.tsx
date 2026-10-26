import {
  Atom,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  History,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { chapterProgress, topicStatus, type TopicStatus } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { memo, useMemo, useState } from 'react';
import { normalizeForSearch, type ChapterEntry } from '@/app/catalog';
import { useT, type TFunction } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { openStudio, openTopic, useActiveTopic, useIsStudio } from '@/app/topics';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { HistoryList } from '@/app/project/HistoryList';
import { useProfileStore } from '@/app/learner/profileStore';
import { chaptersFor, LEVELS } from '@/app/levels';
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

/** Chapters whose title or topics match the query (accent- and case-insensitive). */
function searchChapters(all: ChapterEntry[], query: string, t: TFunction): ChapterEntry[] {
  const q = normalizeForSearch(query);
  if (!q) return all;
  return all
    .map((c) => ({
      ...c,
      topics: c.topics.filter(
        (topic) =>
          normalizeForSearch(t(topic.titleKey)).includes(q) ||
          normalizeForSearch(t(c.titleKey)).includes(q),
      ),
    }))
    .filter((c) => c.topics.length > 0);
}

function Library({ t }: { t: TFunction }) {
  const subject = useWorkspaceStore((s) => s.subject);
  const level = useProfileStore((s) => s.level);
  const setLevel = useProfileStore((s) => s.setLevel);
  const [query, setQuery] = useState('');
  const SubjectIcon = SUBJECT_ICON[subject];

  const setSubject = useWorkspaceStore((s) => s.setSubject);
  const chapters = useMemo<ChapterEntry[]>(
    () => searchChapters(chaptersFor(level, subject), query, t),
    [query, subject, level, t],
  );
  // Nothing here: does another subject have it? (gallery pattern 092, recover from no results)
  const elsewhere = useMemo(
    () =>
      chapters.length > 0 || !normalizeForSearch(query)
        ? []
        : SUBJECTS.filter((s) => s !== subject)
            .map((s) => ({
              subject: s,
              count: searchChapters(chaptersFor(level, s), query, t).reduce(
                (n, c) => n + c.topics.length,
                0,
              ),
            }))
            .filter((m) => m.count > 0),
    [chapters.length, query, subject, level, t],
  );

  return (
    <>
      <div className="level-switch">
        <div className="segmented" role="radiogroup" aria-label={t('levels.label')}>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              className="segmented__item"
              data-tip={t(l.status === 'planned' ? 'levels.plannedHint' : 'levels.foundationDesc')}
              onClick={() => {
                setLevel(l.id);
              }}
            >
              {t(`levels.${l.id}`)}
              {l.status === 'planned' && (
                <span className="sr-only">{` (${t('levels.soon')})`}</span>
              )}
            </button>
          ))}
        </div>
      </div>
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
        {level === 'general' ? (
          <p className="level-note">{t('levels.plannedHint')}</p>
        ) : chapters.length === 0 ? (
          <EmptyState icon={SearchX} compact>
            <p>{t('sidebar.noResults')}</p>
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

/** Hover text and screen-reader description of a topic's mark. */
function statusText(s: TopicStatus, t: TFunction): string {
  if (s.state === 'complete') return t('learn.topicDone');
  const left = [
    ...(s.predictLeft ? [t('learn.leftPredict')] : []),
    ...(s.challengesLeft > 0 ? [t('learn.leftChallenges', { count: s.challengesLeft })] : []),
  ];
  return left.length > 0
    ? t('learn.topicLearnedLeft', { done: s.done, total: s.total, left: left.join(', ') })
    : t('learn.topicLearned');
}

/**
 * A topic of the library. Opened → tick "Đã học" (every subject); a topic with steps left adds
 * "1/3"; every step done → a different "Hoàn thành" mark. The mark is the button's description,
 * so the button keeps the topic's name.
 */
function TopicButton({
  id,
  title,
  status,
  current,
  t,
}: {
  id: string;
  title: string;
  status: TopicStatus;
  current: boolean;
  t: TFunction;
}) {
  const text = status.state === 'new' ? null : statusText(status, t);
  const descId = `tree-status-${id}`;
  return (
    <button
      type="button"
      className="tree__topic tree__topic--button"
      aria-current={current ? 'true' : undefined}
      aria-describedby={text ? descId : undefined}
      data-tip={text ?? undefined}
      data-tip-side={text ? 'right' : undefined}
      onClick={() => {
        void openTopic(id);
      }}
    >
      <span className="tree__topic-title">{title}</span>
      {text && (
        <>
          <span className="tree__mark" data-state={status.state} aria-hidden="true">
            {status.state === 'opened' && status.total > 1 && (
              <span className="tree__steps">
                {status.done}/{status.total}
              </span>
            )}
            {status.state === 'complete' ? (
              <Award size={14} strokeWidth={2} />
            ) : (
              <Check size={14} strokeWidth={2.25} />
            )}
          </span>
          <span id={descId} hidden>
            {text}
          </span>
        </>
      )}
    </button>
  );
}

function ChapterNode({
  chapter,
  t,
  forceOpen,
}: {
  chapter: ChapterEntry;
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
        <span>{t(chapter.titleKey)}</span>
        {/* While searching, the count is the matching topics (progress needs the whole chapter). */}
        {chapterDone.done > 0 && !forceOpen ? (
          <span
            className="tree__count tree__count--progress"
            aria-label={t('learn.chapterLearned', chapterDone)}
            data-tip={t('learn.chapterLearned', chapterDone)}
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
                <TopicButton
                  id={topic.id}
                  title={t(topic.titleKey)}
                  status={topicStatus(topic.id, progress)}
                  current={activeTopic === topic.id}
                  t={t}
                />
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
