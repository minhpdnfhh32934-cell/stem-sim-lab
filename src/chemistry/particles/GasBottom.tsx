import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { XYChart } from '@/ui/charts/XYChart';
import { L } from '../common';
import { mb2d } from './gas';
import { eaReduced, gasRuntime, sigmaReal, useGasStore } from './gasStore';

const BINS = 30;
const VMAX = 4; // reduced units (4σ)

/** Maxwell–Boltzmann: speed histogram vs 2D theory. Collision theory: counts vs time. */
export function GasBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { mode, version, gas, T, eaKJ } = useGasStore();
  const f = (v: number, d = 3) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const sigma = sigmaReal(gas, T);

  const histogram = useMemo(() => {
    const speeds = gasRuntime.history.speeds;
    const counts = new Array<number>(BINS).fill(0);
    for (const v of speeds) {
      if (v >= VMAX) continue;
      const b = Math.floor((v / VMAX) * BINS);
      counts[b] = (counts[b] ?? 0) + 1;
    }
    const width = VMAX / BINS;
    const x = counts.map((_, i) => (i + 0.5) * width * sigma);
    // Density per (m/s): counts / (N · Δv_real)
    const y = counts.map((c) => (speeds.length ? c / (speeds.length * width * sigma) : 0));
    const theory = x.map((v) => mb2d(v / sigma) / sigma);
    const mean = speeds.reduce((s, v) => s + v, 0) / Math.max(1, speeds.length);
    return { x, y, theory, mean: mean * sigma };
    // version drives the refresh; the history is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, sigma]);

  const timeSeries = useMemo(() => {
    const h = gasRuntime.history;
    return { x: [...h.t], a: [...h.counts[0]], c: [...h.counts[2]] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (mode === 'maxwell') {
    return (
      <div className="gas-bottom">
        <XYChart
          x={histogram.x}
          series={[
            { label: Lz(L('Mô phỏng', 'Simulation')), y: histogram.y, bars: true },
            { label: Lz(L('Lý thuyết 2D', '2D theory')), y: histogram.theory, color: 3 },
          ]}
          xLabel={Lz(L('Tốc độ v (m/s)', 'Speed v (m/s)'))}
          yLabel="f(v) (s/m)"
          xUnit="m/s"
          version={version}
        />
        <table className="chem-table gas-bottom__stats">
          <tbody>
            <tr>
              <th scope="row">{Lz(L('Tốc độ trung bình (đo)', 'Mean speed (measured)'))}</th>
              <td className="num">{f(histogram.mean, 4)} m/s</td>
            </tr>
            <tr>
              <th scope="row">{Lz(L('Lý thuyết 2D: σ√(π/2)', '2D theory: σ√(π/2)'))}</th>
              <td className="num">{f(sigma * Math.sqrt(Math.PI / 2), 4)} m/s</td>
            </tr>
            <tr>
              <th scope="row">{Lz(L('Khí thật 3D: √(8RT/πM)', 'Real 3D gas: √(8RT/πM)'))}</th>
              <td className="num">{f(sigma * Math.sqrt(8 / Math.PI), 4)} m/s</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const g = gasRuntime.gas;
  const measured = g && g.pairCollisions > 0 ? g.energeticCollisions / g.pairCollisions : null;
  return (
    <div className="gas-bottom">
      <XYChart
        x={timeSeries.x}
        series={[
          { label: Lz(L('Số hạt A', 'A particles')), y: timeSeries.a },
          { label: Lz(L('Số hạt C', 'C particles')), y: timeSeries.c, color: 2 },
        ]}
        xLabel={Lz(L('Thời gian (τ, đơn vị rút gọn)', 'Time (τ, reduced units)'))}
        yLabel={Lz(L('Số hạt', 'Particles'))}
        version={version}
      />
      <table className="chem-table gas-bottom__stats">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Va chạm A–B đã đếm', 'A–B collisions counted'))}</th>
            <td className="num">{g?.pairCollisions ?? 0}</td>
          </tr>
          <tr>
            <th scope="row">
              {Lz(L('Tỉ lệ đủ năng lượng (đo)', 'Energetic fraction (measured)'))}
            </th>
            <td className="num">{measured === null ? '—' : f(measured)}</td>
          </tr>
          <tr>
            <th scope="row">e^(−Eₐ/RT)</th>
            <td className="num">{f(Math.exp(-eaReduced(eaKJ, T)))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
