import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ModuleEdge } from '@/app/bench/DriverGrid';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { ELEMENTS } from '../data/elements';
import { ElementPicker } from './ElementPicker';
import { selectElement, usePeriodicStore } from './store';

/** Vietnamese name from the data's aliases (first letter up), else the data's English name. */
function elementName(z: number, locale: string): string {
  const e = ELEMENTS.find((x) => x.z === z);
  if (!e) return '';
  const vi = locale === 'vi' ? e.aliases_vi[0] : undefined;
  return vi ? vi.charAt(0).toLocaleUpperCase('vi') + vi.slice(1) : e.name;
}

/**
 * The periodic table's bench edge (docs/BENCH_DESIGN.md §9.10): an element stepper
 * "‹ 26 · Fe · Sắt ›" in D0–D3 and the element finder. Nothing here is filled.
 */
export function PeriodicDriver() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const z = usePeriodicStore((s) => s.selected);
  const e = ELEMENTS.find((x) => x.z === z);
  const last = ELEMENTS.length;
  return (
    <ModuleEdge label={Lz(L('Chọn nguyên tố', 'Choose an element'))}>
      <div className="bench-edge__stepper">
        <IconButton
          icon={ChevronLeft}
          label={Lz(L('Nguyên tố trước', 'Previous element'))}
          tooltipSide="top"
          disabled={z <= 1}
          onClick={() => {
            selectElement(z - 1);
          }}
        />
        <span aria-live="polite">
          {e ? `${e.z} · ${e.symbol} · ${elementName(z, locale)}` : ''}
        </span>
        <IconButton
          icon={ChevronRight}
          label={Lz(L('Nguyên tố sau', 'Next element'))}
          tooltipSide="top"
          disabled={z >= last}
          onClick={() => {
            selectElement(z + 1);
          }}
        />
      </div>
      <div className="bench-edge__find">
        <ElementPicker />
      </div>
    </ModuleEdge>
  );
}
