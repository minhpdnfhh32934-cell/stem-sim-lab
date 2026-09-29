import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { XYChart } from '@/ui/charts/XYChart';
import { L } from '../common';
import { meanRadius, orbitalById, radialProbability, radiusContaining } from './hydrogen';
import { useOrbitalStore } from './orbitalStore';

/** Radial probability density P(r) = r²R² of the selected orbital. */
export function RadialBottom() {
  const Lz = useLocalized();
  const { n, orbital } = useOrbitalStore();
  const l = orbitalById(orbital).l;
  const { x, series } = useMemo(() => {
    const rMax = radiusContaining(n, l, 0.999);
    const N = 400;
    const xs = Array.from({ length: N + 1 }, (_, i) => (i * rMax) / N);
    return {
      x: xs,
      series: [{ label: `P(r), n = ${n}, l = ${l}`, y: xs.map((r) => radialProbability(n, l, r)) }],
    };
  }, [n, l]);
  return (
    <XYChart
      x={x}
      series={series}
      xLabel={Lz(L('r (đơn vị a₀)', 'r (units of a₀)'))}
      yLabel="P(r) (1/a₀)"
      marker={meanRadius(n, l)}
    />
  );
}
