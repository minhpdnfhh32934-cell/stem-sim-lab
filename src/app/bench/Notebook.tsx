import {
  BadgeInfo,
  ChartSpline,
  ListOrdered,
  MessageCircle,
  Table2,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT, type MessageKey } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { LAYOUT_LIMITS, useLayoutStore, type NotebookTab } from '@/app/layout/layoutStore';
import { Splitter } from '@/app/layout/Splitter';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { DataPanel } from '@/app/sim/DataPanel';
import { GraphPanel } from '@/app/sim/GraphPanel';
import { SolutionPanel } from '@/app/sim/SolutionPanel';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { ChallengePanel } from '@/learn/ChallengePanel';
import { useModuleStore } from '@/modules/moduleStore';
import { ScienceCard } from '@/science-card/ScienceCard';
import { ChatPanel } from '@/teacher/chat/ChatPanel';
import { openTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';

const ICON: Record<NotebookTab, LucideIcon> = {
  challenge: Target,
  graphs: ChartSpline,
  solution: ListOrdered,
  data: Table2,
  module: Table2,
  science: BadgeInfo,
  ai: MessageCircle,
};
const LABEL: Record<Exclude<NotebookTab, 'module'>, MessageKey> = {
  challenge: 'bottom.challenge',
  graphs: 'bottom.graphs',
  solution: 'bottom.solution',
  data: 'bottom.data',
  science: 'bench.science',
  ai: 'bench.ai',
};

/**
 * The notebook on the left: an always-visible rail of tabs (same names as the classic bottom
 * panel's) and a drawer with the chosen tab, pushed beside the stage or over it (`push`).
 */
export function Notebook({ push }: { push: boolean }) {
  const t = useT();
  const L = useLocalized();
  const subject = useWorkspaceStore((s) => s.subject);
  const mod = useModuleStore((s) => s.active);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const { open, width, tabBySubject, setOpen, setTab, setSize } = useLayoutStore(
    useShallow((s) => ({
      open: s.notebookOpen,
      width: s.notebookWidth,
      tabBySubject: s.notebookTabBySubject,
      setOpen: s.setNotebookOpen,
      setTab: s.setNotebookTab,
      setSize: s.setSize,
    })),
  );
  const main: NotebookTab[] = mod
    ? mod.view.Bottom
      ? ['module']
      : []
    : ['challenge', 'graphs', 'solution', ...(advanced ? (['data'] as const) : [])];
  const tabs: NotebookTab[] = [...main, 'science', 'ai'];
  const stored = tabBySubject[subject];
  const tab = stored && tabs.includes(stored) ? stored : (main[0] ?? 'science');
  const label = (id: NotebookTab) =>
    id === 'module'
      ? L(mod?.view.bottomTitle ?? mod?.view.title ?? { vi: '', en: '' })
      : t(LABEL[id]);
  const choose = (id: NotebookTab) => {
    setTab(subject, id);
    setOpen(true);
  };
  const rail = useRef<(HTMLButtonElement | null)[]>([]);
  const close = () => {
    setOpen(false);
    // The drawer leaves the page: the keyboard focus goes back to its tab on the rail.
    rail.current[tabs.indexOf(tab)]?.focus();
  };
  // A vertical tab list: arrows, Home and End move the focus; Enter or Space opens the tab.
  const onRailKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const next =
      e.key === 'ArrowDown'
        ? (i + 1) % n
        : e.key === 'ArrowUp'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    rail.current[next]?.focus();
  };

  // A question written on another screen (askInBubble) opens "Hỏi AI", as it opened the bubble.
  const asked = useTeacherStore((s) => s.bubbleDraft !== null);
  useEffect(() => {
    if (asked) {
      useLayoutStore.getState().setNotebookTab(useWorkspaceStore.getState().subject, 'ai');
      useLayoutStore.getState().setNotebookOpen(true);
    }
  }, [asked]);

  return (
    <section className="notebook" aria-label={t('bottom.regionLabel')}>
      <div
        className="notebook__rail"
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('bottom.regionLabel')}
      >
        {tabs.map((id, i) => {
          const Icon = ICON[id];
          return (
            <button
              key={id}
              ref={(el) => {
                rail.current[i] = el;
              }}
              id={`notebook-tab-${id}`}
              tabIndex={id === tab ? 0 : -1}
              onKeyDown={(e) => {
                onRailKey(e, i);
              }}
              type="button"
              role="tab"
              className="notebook__tab"
              data-pinned={id === 'science' || id === 'ai' || undefined}
              aria-selected={open && id === tab}
              aria-controls={open ? 'notebook-panel' : undefined}
              onClick={() => {
                if (open && id === tab) close();
                else choose(id);
              }}
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{label(id)}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div
          className="notebook__drawer"
          data-mode={push ? 'push' : 'overlay'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div
            id="notebook-panel"
            className="panel notebook__panel"
            role="tabpanel"
            aria-labelledby={`notebook-tab-${tab}`}
          >
            {tab === 'ai' ? (
              <ChatPanel
                compact
                onClose={() => {
                  // Screen context is opt-in every time the chat opens (as in the bubble).
                  useChatStore.getState().setIncludeScreen(false);
                  close();
                }}
                onExpand={() => {
                  useChatStore.getState().setIncludeScreen(false);
                  close();
                  openTeacher();
                }}
              />
            ) : (
              <>
                <header className="panel__header">
                  <h2 className="panel__title">{label(tab)}</h2>
                  <IconButton icon={X} label={t('bench.closeNotebook')} onClick={close} />
                </header>
                <div className="panel__scroll">
                  <TabContent tab={tab} />
                </div>
              </>
            )}
          </div>
          <Splitter
            orientation="vertical"
            value={width}
            min={LAYOUT_LIMITS.notebook.min}
            max={LAYOUT_LIMITS.notebook.max}
            direction={1}
            onResize={(px) => {
              setSize('notebook', px);
            }}
            onReset={() => {
              setSize('notebook', LAYOUT_LIMITS.notebook.default);
            }}
            label={t('bench.resizeNotebook')}
          />
        </div>
      )}
    </section>
  );
}

function TabContent({ tab }: { tab: NotebookTab }): ReactNode {
  const t = useT();
  const card = useWorkspaceStore((s) => s.scienceCard);
  const mod = useModuleStore((s) => s.active);
  const Bottom = mod?.view.Bottom;
  switch (tab) {
    case 'challenge':
      return <ChallengePanel />;
    case 'graphs':
      return <GraphPanel />;
    case 'solution':
      return <SolutionPanel />;
    case 'data':
      return <DataPanel />;
    case 'module':
      return Bottom ? <Bottom /> : null;
    case 'science':
      return card ? (
        <ScienceCard card={card} />
      ) : (
        <EmptyState icon={BadgeInfo} compact>
          {t('inspector.scienceCardIntro')}
        </EmptyState>
      );
    case 'ai':
      return null;
  }
}
