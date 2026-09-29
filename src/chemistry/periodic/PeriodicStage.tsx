import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import { CATEGORIES, ELEMENTS, type ElementData } from '../data/elements';
import { CATEGORY_LABEL, COLOR_BY, gridPosition, matchesQuery } from './layout';
import { L } from '../common';
import {
  PROPERTIES,
  isNumeric,
  propertyRange,
  selectElement,
  usePeriodicStore,
  type ColorBy,
} from './store';
import '../chem.css';

/** Interactive periodic table (§6.3): click an element, colour by a property. */
export function PeriodicStage() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { selected, colorBy, query } = usePeriodicStore(
    useShallow((s) => ({ selected: s.selected, colorBy: s.colorBy, query: s.query })),
  );
  const range = useMemo(() => (isNumeric(colorBy) ? propertyRange(colorBy) : null), [colorBy]);
  const numeric = isNumeric(colorBy) ? PROPERTIES[colorBy] : null;

  /** Position of the value on the sequential ramp (0…1), null when there is no value. */
  const rampOf = (e: ElementData): number | null => {
    if (!numeric || !range) return null;
    const v = numeric.value(e);
    return v === null ? null : (v - range[0]) / (range[1] - range[0] || 1);
  };

  return (
    <div className="pt">
      <div className="pt__toolbar">
        <label className="pt__search">
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            placeholder={Lz(L('Tìm nguyên tố: Fe, sắt, 26…', 'Find an element: Fe, iron, 26…'))}
            value={query}
            onChange={(e) => {
              const q = e.target.value;
              usePeriodicStore.setState({ query: q });
              const hit = ELEMENTS.find((el) => matchesQuery(el, q));
              if (hit) selectElement(hit.z);
            }}
          />
        </label>
        <div className="segmented" role="radiogroup" aria-label={Lz(L('Tô màu theo', 'Colour by'))}>
          {COLOR_BY.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={colorBy === c.id}
              className="segmented__item"
              onClick={() => {
                usePeriodicStore.setState({ colorBy: c.id });
              }}
            >
              {Lz(c.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="pt__grid" role="grid" aria-label={Lz(L('Bảng tuần hoàn', 'Periodic table'))}>
        {ELEMENTS.map((e) => {
          const { row, col } = gridPosition(e);
          const v = numeric?.value(e) ?? null;
          const ramp = rampOf(e);
          return (
            <button
              key={e.z}
              type="button"
              role="gridcell"
              aria-selected={selected === e.z}
              aria-label={`${e.z} ${e.symbol} ${e.name}`}
              data-tip={`${e.name}${e.aliases_vi[0] ? ` (${e.aliases_vi[0]})` : ''} · Z = ${e.z}${
                numeric
                  ? ` · ${Lz(numeric.label)}: ${v === null ? '—' : formatNumber(locale, v)}${numeric.unit && v !== null ? ` ${numeric.unit}` : ''}`
                  : ''
              }`}
              className={cx(
                'pt-cell',
                colorBy === 'category' && `pt-cell--cat`,
                colorBy === 'block' && `pt-cell--block`,
                numeric && (v === null ? 'pt-cell--missing' : 'pt-cell--seq'),
                ramp !== null && ramp > 0.62 && 'is-dark',
                selected === e.z && 'is-selected',
                query && matchesQuery(e, query) && 'is-match',
              )}
              data-cat={e.category}
              data-block={e.block}
              style={{
                gridRow: row + 1,
                gridColumn: col,
                ...(ramp !== null ? { '--t': ramp.toFixed(3) } : {}),
              }}
              onClick={() => {
                selectElement(e.z);
              }}
            >
              <span className="pt-cell__z">{e.z}</span>
              <span className="pt-cell__symbol">{e.symbol}</span>
            </button>
          );
        })}
        <span
          className="pt__f-gap"
          style={{ gridRow: 9, gridColumn: '1 / -1' }}
          aria-hidden="true"
        />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((g) => (
          <span
            key={g}
            className="pt__group"
            style={{ gridRow: 1, gridColumn: g }}
            aria-hidden="true"
          >
            {g}
          </span>
        ))}
      </div>

      <Legend colorBy={colorBy} range={range} />
    </div>
  );
}

function Legend({ colorBy, range }: { colorBy: ColorBy; range: [number, number] | null }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  if (colorBy === 'category') {
    return (
      <ul className="pt__legend">
        {CATEGORIES.map((c) => (
          <li key={c}>
            <span className="pt-swatch pt-cell--cat" data-cat={c} aria-hidden="true" />
            {Lz(CATEGORY_LABEL[c])}
          </li>
        ))}
      </ul>
    );
  }
  if (colorBy === 'block') {
    return (
      <ul className="pt__legend">
        {(['s', 'p', 'd', 'f'] as const).map((b) => (
          <li key={b}>
            <span className="pt-swatch pt-cell--block" data-block={b} aria-hidden="true" />
            {Lz(L(`Khối ${b}`, `${b}-block`))}
          </li>
        ))}
      </ul>
    );
  }
  if (!range || !isNumeric(colorBy)) return null;
  const p = PROPERTIES[colorBy];
  return (
    <div className="pt__legend pt__legend--seq">
      <span>{Lz(p.label)}</span>
      <span className="mono">
        {formatNumber(locale, range[0], { maximumSignificantDigits: 4 })}
      </span>
      <span className="pt__ramp" aria-hidden="true" />
      <span className="mono">
        {formatNumber(locale, range[1], { maximumSignificantDigits: 4 })} {p.unit}
      </span>
      <span className="pt-swatch pt-cell--missing" aria-hidden="true" />
      <span>{Lz(L('không có số liệu', 'no data'))}</span>
    </div>
  );
}
