import { BookOpen, CheckCircle2, ChevronRight, History, Search, SearchX } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { chapterProgress, topicProgress } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { memo, useMemo, useState } from 'react';
import { normalizeForSearch, type ChapterEntry } from '@/app/catalog';
import { useT, type TFunction } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { openTopic, useActiveTopic } from '@/app/topics';
import { useWorkspaceStore } from '@/app/workspaceStore';
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
      {tab === 'library' ? <Library t={t} /> : <HistoryList />}
    </aside>
  );
});

function Library({ t }: { t: TFunction }) {
  const subject = useWorkspaceStore((s) => s.subject);
  const level = useProfileStore((s) => s.level);
  const setLevel = useProfileStore((s) => s.setLevel);
  const [query, setQuery] = useState('');
  const SubjectIcon = SUBJECT_ICON[subject];

  const chapters = useMemo<ChapterEntry[]>(() => {
    const q = normalizeForSearch(query);
    const all = chaptersFor(level, subject);
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
  }, [query, subject, level, t]);

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
            {t('sidebar.noResults')}
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
