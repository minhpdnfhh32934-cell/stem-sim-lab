import { Download } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useT } from '@/app/i18n';
import { exportCsv } from '@/app/project/actions';
import { toCsv } from './csv';
import type uPlotType from 'uplot';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { SERIES_VARS, loadUPlot } from './uplot';

export interface XYSeries {
  label: string;
  /** y values aligned with `x`; null = gap. */
  y: (number | null)[];
  /** Draw as points only (e.g. Monte Carlo samples) instead of a line. */
  points?: boolean;
  /** Dashed line (e.g. theory curve next to simulation data). */
  dash?: boolean;
  /** Index into the categorical palette (defaults to the series index). */
  color?: number;
  /** Draw as bars (histograms). */
  bars?: boolean;
}

export interface XYChartProps {
  x: number[];
  series: XYSeries[];
  xLabel: string;
  yLabel: string;
  /** Vertical marker at this x (e.g. the selected element). */
  marker?: number | null;
  xUnit?: string;
  yUnit?: string;
  yMin?: number;
  yMax?: number;
  height?: number;
  /** Bumps when data changes without a new array identity. */
  version?: number;
  /** Base of the exported CSV file name (default: the y label). */
  csvName?: string;
}

/**
 * Small uPlot line chart used by the chemistry and biology modules: one y scale (never a
 * dual axis), fixed-order palette, crosshair with a live legend.
 */
export function XYChart(props: XYChartProps) {
  const { x, series, xLabel, yLabel, marker, xUnit, yUnit, yMin, yMax, height, version, csvName } =
    props;
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const theme = useResolvedTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlotType | null>(null);
  const markerRef = useRef<number | null | undefined>(marker);

  const shape = series
    .map((s) => `${s.label}|${s.points ? 1 : 0}|${s.dash ? 1 : 0}|${s.bars ? 1 : 0}`)
    .join(';');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let ro: ResizeObserver | undefined;
    void loadUPlot().then((UPlot) => {
      if (disposed) return;
      const cs = getComputedStyle(document.documentElement);
      const css = (v: string) => cs.getPropertyValue(v).trim();
      const axisStroke = css('--text-muted');
      const gridStroke = css('--stage-grid-major');
      const nf = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        maximumSignificantDigits: 4,
      });
      const fmt = (v: number | null | undefined, unit?: string) =>
        v === null || v === undefined ? '—' : `${nf.format(v)}${unit ? ` ${unit}` : ''}`;
      const opts: uPlotType.Options = {
        width: host.clientWidth || 600,
        height: height ?? Math.max(140, host.clientHeight || 200),
        scales: {
          x: { time: false },
          // A fixed bound where given; the other side follows the data (with 5 % headroom).
          y:
            yMin !== undefined || yMax !== undefined
              ? {
                  range: (_u, dMin, dMax): uPlotType.Range.MinMax => {
                    const lo = yMin ?? dMin;
                    const span = Math.max(1e-12, dMax - lo);
                    return [lo, yMax ?? dMax + 0.05 * span];
                  },
                }
              : {},
        },
        legend: { live: true },
        cursor: { drag: { x: false, y: false }, points: { size: 8 } },
        axes: [
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke },
            label: xLabel,
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke },
            label: yLabel,
            size: 60,
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
        ],
        series: [
          { label: xLabel, value: (_u, v) => fmt(v, xUnit) },
          ...series.map((s, i) => {
            const stroke = css(SERIES_VARS[(s.color ?? i) % SERIES_VARS.length] ?? '--chart-1');
            const bars = s.bars ? UPlot.paths.bars?.({ size: [0.9, 64] }) : undefined;
            return {
              label: s.label,
              stroke,
              width: s.points ? 0 : 2,
              ...(s.dash ? { dash: [6, 4] } : {}),
              ...(bars ? { fill: `${stroke}59`, paths: bars } : {}),
              points: s.points ? { show: true, size: 5, fill: stroke } : { show: false },
              value: (_u: uPlotType, v: number | null) => fmt(v, yUnit),
            };
          }),
        ],
        hooks: {
          draw: [
            (u) => {
              const m = markerRef.current;
              if (m === null || m === undefined) return;
              const px = u.valToPos(m, 'x', true);
              const ctx = u.ctx;
              ctx.save();
              ctx.strokeStyle = css('--accent');
              ctx.lineWidth = 1.5 * devicePixelRatio;
              ctx.setLineDash([4 * devicePixelRatio, 3 * devicePixelRatio]);
              ctx.beginPath();
              ctx.moveTo(px, u.bbox.top);
              ctx.lineTo(px, u.bbox.top + u.bbox.height);
              ctx.stroke();
              ctx.restore();
            },
          ],
        },
      };
      const plot = new UPlot(opts, [x, ...series.map((s) => s.y)] as uPlotType.AlignedData, host);
      plotRef.current = plot;
      // uPlot's height excludes the legend, so subtract it to keep the chart inside its box.
      const fit = () => {
        const legend = plot.root.querySelector<HTMLElement>('.u-legend');
        const avail = host.clientHeight - (legend?.offsetHeight ?? 0);
        plot.setSize({ width: host.clientWidth, height: height ?? Math.max(120, avail) });
      };
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(host);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
    // Recreate only when the chart's shape changes; data updates go through setData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, xLabel, yLabel, xUnit, yUnit, yMin, yMax, height, theme, locale]);

  useEffect(() => {
    markerRef.current = marker;
    plotRef.current?.setData([x, ...series.map((s) => s.y)] as uPlotType.AlignedData);
  }, [x, series, marker, version]);

  return (
    <div className="chart">
      <div ref={hostRef} className="chart__plot" />
      {x.length > 0 && (
        <button
          type="button"
          className="chart__csv"
          aria-label={t('project.exportCsv')}
          data-tip={t('project.exportCsv')}
          data-tip-side="left"
          onClick={() => {
            const unit = (u?: string) => (u ? ` (${u})` : '');
            const header = [
              `${xLabel}${unit(xUnit)}`,
              ...series.map((s) => `${s.label}${unit(yUnit)}`),
            ];
            const rows = x.map((xv, i) => [xv, ...series.map((s) => s.y[i] ?? null)]);
            void exportCsv(csvName ?? yLabel, toCsv(header, rows));
          }}
        >
          <Download size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
