import {
  Activity,
  DraftingCompass,
  Hand,
  MousePointer2,
  MoveUpRight,
  Ruler,
  Scan,
  Spline,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { useWorkspaceStore, type StageTool } from '@/app/workspaceStore';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';

const TOOLS: { id: StageTool; icon: LucideIcon; group: number }[] = [
  { id: 'select', icon: MousePointer2, group: 0 },
  { id: 'drag', icon: Hand, group: 0 },
  { id: 'ruler', icon: Ruler, group: 1 },
  { id: 'protractor', icon: DraftingCompass, group: 1 },
  { id: 'stopwatch', icon: Timer, group: 1 },
  { id: 'vectors', icon: MoveUpRight, group: 2 },
  { id: 'trail', icon: Spline, group: 2 },
  { id: 'fitView', icon: Scan, group: 3 },
];

/**
 * Central simulation area. Phase 0: empty state + floating tool bar.
 * Phase 2 mounts the 2D canvas renderer here (render thread only; physics runs in a worker).
 */
export const Stage = memo(function Stage() {
  const t = useT();
  const { subject, activeTool, setActiveTool, hasSimulation } = useWorkspaceStore(
    useShallow((s) => ({
      subject: s.subject,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      hasSimulation: s.hasSimulation,
    })),
  );
  const SubjectIcon = SUBJECT_ICON[subject];

  return (
    <section className="stage" aria-label={t('stage.regionLabel')}>
      <div className="stage__grid" aria-hidden="true" />

      <div className="stage__toolbar" role="toolbar" aria-label={t('stage.toolbarLabel')}>
        {TOOLS.map((tool, i) => {
          const needsSim = tool.id !== 'select';
          const disabled = needsSim && !hasSimulation;
          const label = t(`stage.tools.${tool.id}`);
          const prev = TOOLS[i - 1];
          return (
            <div key={tool.id} className="stage__tool">
              {prev && prev.group !== tool.group && (
                <span className="stage__toolbar-sep" aria-hidden="true" />
              )}
              <IconButton
                icon={tool.icon}
                label={disabled ? `${label} — ${t('stage.toolUnavailable')}` : label}
                tooltipSide="right"
                active={activeTool === tool.id}
                disabled={disabled}
                onClick={() => {
                  setActiveTool(tool.id);
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="stage__axes" aria-hidden="true">
        <svg width="46" height="46" viewBox="0 0 46 46">
          <path d="M8 38 H40 M36 34 L40 38 L36 42" />
          <path d="M8 38 V6 M4 10 L8 6 L12 10" />
        </svg>
        <span className="stage__axis-x">x</span>
        <span className="stage__axis-y">y</span>
      </div>

      {!hasSimulation && (
        <div className="stage__empty">
          <EmptyState icon={SubjectIcon} title={t('stage.emptyTitle')}>
            <p>{t('stage.emptyBody')}</p>
            <p className="stage__phase-note">
              <Activity size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('stage.emptyNote')}
            </p>
          </EmptyState>
        </div>
      )}
    </section>
  );
});
