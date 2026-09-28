import { BookOpen, ChevronRight, History, Search, SearchX } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { CATALOG, normalizeForSearch, type ChapterEntry } from '@/app/catalog';
import { useT, type TFunction } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { EmptyState } from '@/ui/EmptyState';
import { Tabs } from '@/ui/Tabs';
import { useLayoutStore, type LeftTab } from './layoutStore';

export const LeftSidebar = memo(function LeftSidebar() {
  const t = useT();
  const tab = useLayoutStore((s) => s.leftTab);
  const setTab = useLayoutStore((s) => s.setLeftTab);

  return (
    <aside className="panel sidebar" aria-label={t('sidebar.regionLabel')}>
      <Tabs<LeftTab>
        label={t('sidebar.regionLabel')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'library', label: t('sidebar.library'), icon: BookOpen },
          { id: 'history', label: t('sidebar.history'), icon: History },
        ]}
      />
      {tab === 'library' ? (
        <Library t={t} />
      ) : (
        <div className="panel__scroll">
          <EmptyState icon={History} compact>
            {t('sidebar.historyEmpty')}
          </EmptyState>
        </div>
      )}
    </aside>
  );
});

function Library({ t }: { t: TFunction }) {
  const subject = useWorkspaceStore((s) => s.subject);
  const [query, setQuery] = useState('');
  const SubjectIcon = SUBJECT_ICON[subject];

  const chapters = useMemo<ChapterEntry[]>(() => {
    const q = normalizeForSearch(query);
    const all = CATALOG[subject];
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
  }, [query, subject, t]);

  return (
    <>
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
        <span className="tree__count">{chapter.topics.length}</span>
      </button>
      {expanded && (
        <ul className="tree__topics">
          {chapter.topics.map((topic) => (
            <li
              key={topic.id}
              data-status={topic.status}
              className="tree__topic"
              data-tip={topic.status === 'planned' ? t('sidebar.comingSoonHint') : undefined}
              data-tip-side="right"
            >
              <span className="tree__topic-title">{t(topic.titleKey)}</span>
              {topic.status === 'planned' && (
                <span className="tree__soon">{t('sidebar.comingSoon')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
