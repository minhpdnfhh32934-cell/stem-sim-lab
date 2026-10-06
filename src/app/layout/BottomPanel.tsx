import { memo } from 'react';
import { ChartSpline, ListOrdered, Table2, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { DataPanel } from '@/app/sim/DataPanel';
import { GraphPanel } from '@/app/sim/GraphPanel';
import { SolutionPanel } from '@/app/sim/SolutionPanel';
import { useLocalized } from '@/app/i18n/localized';
import { useModuleStore } from '@/modules/moduleStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Tabs } from '@/ui/Tabs';
import { useLayoutStore, type BottomTab } from './layoutStore';

/** Graphs (uPlot, Phase 1–2), step-by-step solution, and data table. */
export const BottomPanel = memo(function BottomPanel() {
  const t = useT();
  const storedTab = useLayoutStore((s) => s.bottomTab);
  // Basic mode: Đồ thị · Lời giải only; the data table and CSV are in Advanced (A4.2).
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const tab = !advanced && storedTab === 'data' ? 'graphs' : storedTab;
  const setTab = useLayoutStore((s) => s.setBottomTab);
  const toggle = useLayoutStore((s) => s.toggle);
  const mod = useModuleStore((s) => s.active);
  const L = useLocalized();

  if (mod) {
    const Bottom = mod.view.Bottom;
    return (
      <section className="panel bottom-panel" aria-label={t('bottom.regionLabel')}>
        <header className="panel__header">
          <h2 className="panel__title">{L(mod.view.bottomTitle ?? mod.view.title)}</h2>
          <IconButton
            icon={X}
            size="sm"
            label={t('layout.toggleBottom')}
            tooltipSide="left"
            onClick={() => {
              toggle('bottom');
            }}
          />
        </header>
        <div className="panel__scroll">
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
          ...(advanced ? [{ id: 'data' as const, label: t('bottom.data'), icon: Table2 }] : []),
        ]}
        trailing={
          <IconButton
            icon={X}
            size="sm"
            label={t('layout.toggleBottom')}
            tooltipSide="left"
            onClick={() => {
              toggle('bottom');
            }}
          />
        }
      />
      <div className="panel__scroll" role="tabpanel" aria-label={t(`bottom.${tab}`)}>
        {tab === 'graphs' && <GraphPanel />}
        {tab === 'solution' && <SolutionPanel />}
        {tab === 'data' && <DataPanel />}
      </div>
    </section>
  );
});
