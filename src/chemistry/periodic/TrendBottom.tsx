import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { XYChart } from '@/ui/charts/XYChart';
import { ELEMENTS } from '../data/elements';
import { PROPERTIES, isNumeric, usePeriodicStore } from './store';

/** Periodic trend of the property the table is coloured by (EN when colouring by category). */
export function TrendBottom() {
  const Lz = useLocalized();
  const colorBy = usePeriodicStore((s) => s.colorBy);
  const selected = usePeriodicStore((s) => s.selected);
  const prop = isNumeric(colorBy) ? colorBy : 'en';
  const p = PROPERTIES[prop];
  const { x, y } = useMemo(() => {
    const els = ELEMENTS.filter((e) => e.z <= 103);
    return { x: els.map((e) => e.z), y: els.map((e) => p.value(e)) };
  }, [p]);
  const series = useMemo(() => [{ label: Lz(p.label), y }], [Lz, p, y]);
  return (
    <XYChart
      x={x}
      series={series}
      xLabel="Z"
      yLabel={`${p.short}${p.unit ? ` (${p.unit})` : ''}`}
      yUnit={p.unit}
      marker={selected}
    />
  );
}
