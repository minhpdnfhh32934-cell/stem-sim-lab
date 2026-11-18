import { AlertTriangle, Info, NotebookPen } from 'lucide-react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import type { ParamDef } from '@/physics/types';
import { EmptyState } from '@/ui/EmptyState';
import { Subscripted } from '@/ui/Subscripted';
import { RUN_LOG_MAX, useRunLog, type RunEntry } from './runLog';
import { useSimStore } from './simStore';

const NO_ROWS: RunEntry[] = [];

/** "Sổ ghi" tab (#195 step 4): the runs of the open physics lesson, newest first. */
export function RunLogPanel() {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const scene = useSimStore((s) => s.scene);
  const rows = useRunLog((s) => (scene ? s.rows[scene.id] : undefined)) ?? NO_ROWS;

  if (!scene) {
    return (
      <EmptyState icon={NotebookPen} compact>
        {t('runLog.noScene')}
      </EmptyState>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState icon={NotebookPen} compact>
        {t('runLog.empty')}
      </EmptyState>
    );
  }

  const defs = new Map(scene.params.map((d) => [d.key, d]));
  const clock = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const value = (d: ParamDef, v: number) => {
    if (d.kind === 'choice') {
      const choice = d.choices?.find((c) => c.value === v);
      return choice ? L(choice.label) : formatNumber(locale, v);
    }
    if (d.kind === 'toggle') return t(v ? 'runLog.on' : 'runLog.off');
    return d.unit ? fmtQty(locale, v, d.unit, 4) : formatNumber(locale, v);
  };

  return (
    <div className="run-log">
      <div className="run-log__head">
        <p className="solution__note">
          <Info size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('runLog.note', { max: String(RUN_LOG_MAX) })}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            useRunLog.getState().clear(scene.id);
          }}
        >
          {t('runLog.clear')}
        </button>
      </div>
      <table className="run-log__table">
        <thead>
          <tr>
            <th scope="col">{t('runLog.run')}</th>
            <th scope="col">{t('runLog.time')}</th>
            <th scope="col">{t('runLog.changed')}</th>
            <th scope="col">{t('runLog.answers')}</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .map((row, i) => ({ row, n: i + 1 }))
            .reverse()
            .map(({ row, n }) => (
              <tr key={n}>
                <td className="mono">{n}</td>
                <td className="mono">{clock.format(row.at)}</td>
                <td>
                  {row.changed.length === 0 ? (
                    <span className="muted">{t('runLog.defaults')}</span>
                  ) : (
                    <ul className="run-log__list">
                      {row.changed.map(({ key, value: v }) => {
                        const d = defs.get(key);
                        return d ? (
                          <li key={key}>
                            <Subscripted text={L(d.label)} />:{' '}
                            <span className="mono">{value(d, v)}</span>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  )}
                </td>
                <td>
                  {row.intervened ? (
                    <span className="run-log__warn" data-tip={t('runLog.intervenedHint')}>
                      <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
                      {t('runLog.intervened')}
                    </span>
                  ) : row.answers ? (
                    <ul className="run-log__list">
                      {row.answers.map((a) => (
                        <li key={a.id}>
                          <Subscripted text={L(a.label)} />:{' '}
                          <span className="mono">{fmtQty(locale, a.value, a.unit, 4)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="muted">{t('runLog.noAnswers')}</span>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
