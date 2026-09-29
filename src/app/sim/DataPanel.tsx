import { Download, Table2 } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { EmptyState } from '@/ui/EmptyState';
import { exportCsv } from '@/app/project/actions';
import { columnsFor, toCsv } from './data';
import { sim } from './runtime';
import { useSimStore } from './simStore';

export function DataPanel() {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { scene, params, dataVersion } = useSimStore(
    useShallow((s) => ({ scene: s.scene, params: s.params, dataVersion: s.dataVersion })),
  );
  const table = useMemo(() => {
    if (!scene) return null;
    const cols = columnsFor(scene, L);
    const h = sim.history;
    const total = h.length;
    const stride = Math.max(1, Math.ceil(total / 200));
    const rows: number[][] = [];
    for (let i = 0; i < total; i += stride) {
      const s = h.states[i];
      const tt = h.times[i];
      if (!s || tt === undefined) continue;
      rows.push([tt, ...cols.map((c) => c.value(s, params))]);
    }
    return { cols, rows, total };
    // dataVersion drives refresh of the mutable history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, params, L, dataVersion]);

  if (!scene || !table || table.total === 0) {
    return (
      <EmptyState icon={Table2} compact>
        {t('data.noData')}
      </EmptyState>
    );
  }

  const onExport = () => {
    const cols = columnsFor(scene, L);
    const h = sim.history;
    const rows = h.states.map((s, i) => [h.times[i] ?? 0, ...cols.map((c) => c.value(s, params))]);
    const csv = toCsv(['t (s)', ...cols.map((c) => c.header)], rows);
    void exportCsv(scene.id, csv);
  };

  const nf = (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 5 });
  return (
    <div className="data-panel">
      <div className="data-panel__bar">
        <span className="muted small">
          {t('data.rows', { shown: table.rows.length, total: table.total })}
        </span>
        <button type="button" className="btn" onClick={onExport}>
          <Download size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('data.exportCsv')}
        </button>
      </div>
      <div className="data-panel__scroll">
        <table className="data-table mono">
          <thead>
            <tr>
              <th scope="col">t (s)</th>
              {table.cols.map((c) => (
                <th key={c.id} scope="col">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r[0]}>
                {r.map((v, i) => (
                  <td key={i}>{nf(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
