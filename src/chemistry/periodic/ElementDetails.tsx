import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ReviewBadge } from '@/ui/Badges';
import {
  ELEMENTS_SOURCE,
  elementByZ,
  formatAtomicWeight,
  isAufbauException,
  shorthand,
} from '../data/elements';
import { L } from '../common';
import { CATEGORY_LABEL } from './layout';
import { usePeriodicStore } from './store';

/** Data sheet of the selected element (every value from data/elements.json). */
export function ElementDetails() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const z = usePeriodicStore((s) => s.selected);
  const e = elementByZ(z);
  if (!e) return null;
  const num = (v: number | null, unit = '', digits = 4) =>
    v === null
      ? '—'
      : `${formatNumber(locale, v, { maximumSignificantDigits: digits })}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="el-card">
      <div className="el-card__head">
        <span className="el-card__tile pt-cell--cat" data-cat={e.category}>
          {e.symbol}
        </span>
        <div>
          <p className="el-card__name">
            {e.name}
            {e.aliases_vi.length > 0 && <span className="muted"> ({e.aliases_vi.join(', ')})</span>}
          </p>
          <ReviewBadge status={e.review_status} />
        </div>
      </div>
      <dl>
        <dt>{Lz(L('Số hiệu nguyên tử Z', 'Atomic number Z'))}</dt>
        <dd className="mono">{e.z}</dd>
        <dt>{Lz(L('Nguyên tử khối', 'Atomic weight'))}</dt>
        <dd className="mono">{formatAtomicWeight(e, locale)}</dd>
        <dt>{Lz(L('Chu kì / Nhóm', 'Period / Group'))}</dt>
        <dd className="mono">
          {e.period} / {e.group ?? '—'}
        </dd>
        <dt>{Lz(L('Khối', 'Block'))}</dt>
        <dd className="mono">{e.block}</dd>
        <dt>{Lz(L('Loại', 'Category'))}</dt>
        <dd>{Lz(CATEGORY_LABEL[e.category])}</dd>
        <dt>{Lz(L('Cấu hình electron', 'Electron configuration'))}</dt>
        <dd className="mono">
          {shorthand(e)}
          {isAufbauException(e) && (
            <span
              className="muted"
              data-tip={Lz(
                L(
                  'Cấu hình thực nghiệm khác với dự đoán theo quy tắc Aufbau',
                  'The measured configuration differs from the Aufbau prediction',
                ),
              )}
            >
              {' '}
              *
            </span>
          )}
        </dd>
        <dt>{Lz(L('Độ âm điện (Pauling)', 'Electronegativity (Pauling)'))}</dt>
        <dd className="mono">{num(e.en_pauling, '', 3)}</dd>
        <dt>{Lz(L('Bán kính cộng hóa trị', 'Covalent radius'))}</dt>
        <dd className="mono">{num(e.covalent_radius_pm, 'pm')}</dd>
        <dt>{Lz(L('Năng lượng ion hóa thứ nhất', 'First ionization energy'))}</dt>
        <dd className="mono">{num(e.ionization_energy_ev, 'eV', 5)}</dd>
      </dl>
      <p className="el-card__source">{ELEMENTS_SOURCE.citation}</p>
    </div>
  );
}
