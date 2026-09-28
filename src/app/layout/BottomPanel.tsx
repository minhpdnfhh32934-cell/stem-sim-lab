import { memo } from 'react';
import { ChartSpline, ListOrdered, Table2, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Tabs } from '@/ui/Tabs';
import { useLayoutStore, type BottomTab } from './layoutStore';

const EMPTY = {
  graphs: { icon: ChartSpline, text: 'bottom.graphsEmpty' },
  solution: { icon: ListOrdered, text: 'bottom.solutionEmpty' },
  data: { icon: Table2, text: 'bottom.dataEmpty' },
} as const;

/** Graphs (uPlot, Phase 1–2), step-by-step solution, and data table. */
export const BottomPanel = memo(function BottomPanel() {
  const t = useT();
  const tab = useLayoutStore((s) => s.bottomTab);
  const setTab = useLayoutStore((s) => s.setBottomTab);
  const toggle = useLayoutStore((s) => s.toggle);
  const empty = EMPTY[tab];

  return (
    <section className="panel bottom-panel" aria-label={t('bottom.regionLabel')}>
      <Tabs<BottomTab>
        label={t('bottom.regionLabel')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'graphs', label: t('bottom.graphs'), icon: ChartSpline },
          { id: 'solution', label: t('bottom.solution'), icon: ListOrdered },
          { id: 'data', label: t('bottom.data'), icon: Table2 },
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
        <EmptyState icon={empty.icon} compact>
          {t(empty.text)}
        </EmptyState>
      </div>
    </section>
  );
});
