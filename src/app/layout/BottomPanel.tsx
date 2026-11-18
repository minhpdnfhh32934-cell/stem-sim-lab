import { memo } from 'react';
import { ChartSpline, ListOrdered, NotebookPen, Spline, Table2, Target } from 'lucide-react';
import { useT } from '@/app/i18n';
import { DataPanel } from '@/app/sim/DataPanel';
import { GraphPanel } from '@/app/sim/GraphPanel';
import { RunLogPanel } from '@/app/sim/RunLogPanel';
import { SolutionPanel } from '@/app/sim/SolutionPanel';
import { SweepPanel } from '@/app/sim/SweepPanel';
import { useLocalized } from '@/app/i18n/localized';
import { useModuleStore } from '@/modules/moduleStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ChallengePanel } from '@/learn/ChallengePanel';
import { EmptyState } from '@/ui/EmptyState';
import { Tabs } from '@/ui/Tabs';
import { useScrollCue } from '@/ui/useScrollCue';
import { useLayoutStore, type BottomTab } from './layoutStore';

/** Graphs (uPlot, Phase 1–2), step-by-step solution, challenge, run log and data table. */
export const BottomPanel = memo(function BottomPanel() {
  const t = useT();
  const storedTab = useLayoutStore((s) => s.bottomTab);
  // The data table, CSV and the parameter sweep are Advanced tools (A4.2, #195).
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const tab = !advanced && (storedTab === 'data' || storedTab === 'sweep') ? 'graphs' : storedTab;
  const setTab = useLayoutStore((s) => s.setBottomTab);
  const mod = useModuleStore((s) => s.active);
  const L = useLocalized();
  const cue = useScrollCue();

  if (mod) {
    const Bottom = mod.view.Bottom;
    return (
      <section className="panel bottom-panel" aria-label={t('bottom.regionLabel')}>
        <header className="panel__header">
          <h2 className="panel__title">{L(mod.view.bottomTitle ?? mod.view.title)}</h2>
        </header>
        <div ref={cue} className="panel__scroll scroll-cue">
          {Bottom ? (
            <Bottom />
          ) : (
            <EmptyState icon={ChartSpline} compact>
              {t('bottom.moduleEmpty')}
            </EmptyState>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel bottom-panel" aria-label={t('bottom.regionLabel')}>
      <Tabs<BottomTab>
        label={t('bottom.regionLabel')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'graphs', label: t('bottom.graphs'), icon: ChartSpline },
          { id: 'solution', label: t('bottom.solution'), icon: ListOrdered },
          { id: 'challenge', label: t('bottom.challenge'), icon: Target },
          { id: 'log', label: t('bottom.log'), icon: NotebookPen },
          ...(advanced
            ? [
                { id: 'sweep' as const, label: t('bottom.sweep'), icon: Spline },
                { id: 'data' as const, label: t('bottom.data'), icon: Table2 },
              ]
            : []),
        ]}
      />
      <div
        ref={cue}
        className="panel__scroll scroll-cue"
        role="tabpanel"
        aria-label={t(`bottom.${tab}`)}
      >
        {tab === 'graphs' && <GraphPanel />}
        {tab === 'solution' && <SolutionPanel />}
        {tab === 'challenge' && <ChallengePanel />}
        {tab === 'log' && <RunLogPanel />}
        {tab === 'sweep' && <SweepPanel />}
        {tab === 'data' && <DataPanel />}
      </div>
    </section>
  );
});
