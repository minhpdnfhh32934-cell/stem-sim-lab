import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { XYChart } from '@/ui/charts/XYChart';
import { L, usePublishCard } from '../common';
import { HYDRIDES } from '../data/hydrides';
import { prettyFormula } from '../data/molecules';
import { FORCES_CARD } from './cards';
import {
  boilingPointIn,
  HYDRIDE_GROUPS,
  hydrideSeries,
  period2Anomaly,
  PERIODS,
  type HydrideGroup,
} from './hydrides';
import { useBondingStore, type TempUnit } from './store';
import '../chem.css';
import './bonding.css';

/** Group names as SGK writes them (IVA … VIIA). */
const GROUP_NAME: Record<HydrideGroup, string> = { 14: 'IVA', 15: 'VA', 16: 'VIA', 17: 'VIIA' };

const unitText = (unit: TempUnit) => (unit === 'K' ? 'K' : '°C');

export function ForcesStage() {
  const Lz = useLocalized();
  const unit = useBondingStore((s) => s.unit);
  usePublishCard(FORCES_CARD);
  const series = useMemo(
    () =>
      HYDRIDE_GROUPS.map((g) => {
        const s = hydrideSeries(g);
        return {
          label: `${Lz(L('Nhóm', 'Group'))} ${GROUP_NAME[g]}`,
          y: PERIODS.map((p) => {
            const h = s.find((q) => q.period === p)?.hydride;
            return h ? boilingPointIn(h, unit) : null;
          }),
          markers: true,
        };
      }),
    [Lz, unit],
  );
  const anomalous = HYDRIDE_GROUPS.filter((g) => period2Anomaly(g) === true).map((g) =>
    prettyFormula(hydrideSeries(g)[0]?.hydride.formula ?? ''),
  );
  const missing = HYDRIDES.filter((h) => !h.boiling_point).map((h) => prettyFormula(h.formula));
  return (
    <div className="chem-view bond-view bond-view--chart">
      <div className="bond-view__chips">
        <span className="chem-chip chem-chip--qual">
          {Lz(L('Sôi cao bất thường ở chu kì 2: ', 'Unusually high at period 2: '))}
          {anomalous.join(', ')}
        </span>
        {missing.length > 0 && (
          <span className="chem-chip">
            {Lz(L('Chưa có số liệu có nguồn: ', 'No sourced value: '))}
            {missing.join(', ')}
          </span>
        )}
      </div>
      <XYChart
        x={[...PERIODS]}
        series={series}
        xLabel={Lz(L('Chu kì', 'Period'))}
        yLabel={Lz(L('Nhiệt độ sôi', 'Boiling point'))}
        yUnit={unitText(unit)}
        xIntegers
        csvName={Lz(L('nhiet-do-soi-hydride', 'hydride-boiling-points'))}
      />
    </div>
  );
}

export function ForcesPanel() {
  const Lz = useLocalized();
  const unit = useBondingStore((s) => s.unit);
  return (
    <div className="chem-form">
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Đơn vị nhiệt độ', 'Temperature unit'))}
      >
        {(['C', 'K'] as const).map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={unit === u}
            className="segmented__item"
            onClick={() => {
              useBondingStore.setState({ unit: u });
            }}
          >
            {unitText(u)}
          </button>
        ))}
      </div>
      <p>
        {Lz(
          L(
            'Từ chu kì 3 trở đi, phân tử càng lớn thì tương tác van der Waals càng mạnh nên nhiệt độ sôi tăng dần. NH₃, H₂O và HF đi ngược xu hướng đó: giữa các phân tử có liên kết hydrogen.',
            'From period 3 on, the larger the molecule, the stronger the van der Waals forces, so the boiling point rises. NH₃, H₂O and HF break that trend: there are hydrogen bonds between their molecules.',
          ),
        )}
      </p>
      <p className="small muted">
        {Lz(
          L(
            'CH₄ không có liên kết hydrogen: nhóm IVA tăng đều từ chu kì 2. Bảng số liệu và nguồn ở khung dưới.',
            'CH₄ has no hydrogen bonds: group IVA rises steadily from period 2. The data and their sources are in the bottom panel.',
          ),
        )}
      </p>
    </div>
  );
}

/** Every value as its source gives it, converted for the chart, with the reference. */
export function ForcesBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const unit = useBondingStore((s) => s.unit);
  const rows = HYDRIDE_GROUPS.flatMap((g) => hydrideSeries(g).map((p) => ({ g, p })));
  return (
    <div className="chem-block">
      <table className="chem-table bond-sources">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Chất', 'Compound'))}</th>
            <th scope="col">{Lz(L('Nhóm', 'Group'))}</th>
            <th scope="col" className="num">
              {Lz(L('Chu kì', 'Period'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Nhiệt độ sôi', 'Boiling point'))} ({unitText(unit)})
            </th>
            <th scope="col">{Lz(L('Nguồn ghi', 'As given'))}</th>
            <th scope="col">{Lz(L('Nguồn', 'Source'))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, p }) => {
            const bp = p.hydride.boiling_point;
            const v = boilingPointIn(p.hydride, unit);
            return (
              <tr key={p.hydride.id}>
                <th scope="row">{prettyFormula(p.hydride.formula)}</th>
                <td>{GROUP_NAME[g]}</td>
                <td className="num">{p.period}</td>
                <td className="num">
                  {v === null ? '—' : formatNumber(locale, v, { maximumFractionDigits: 2 })}
                </td>
                <td className="num">{bp ? bp.as_given : '—'}</td>
                <td className="small">
                  {bp
                    ? `${bp.source === 'nist' ? 'NIST WebBook' : 'PubChem (HSDB)'}: ${bp.reference === 'N/A' ? bp.note : bp.reference}`
                    : Lz(
                        L(
                          'Chưa có số liệu có nguồn (NIST, PubChem)',
                          'No sourced value (NIST, PubChem)',
                        ),
                      )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
