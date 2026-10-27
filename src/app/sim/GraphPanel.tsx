import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type uPlotType from 'uplot';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import type { GraphDef } from '@/physics/types';
import { EmptyState } from '@/ui/EmptyState';
import { ChartSpline } from 'lucide-react';
import { X_AXIS_SIZE, yTickSpace } from '@/ui/charts/axes';
import { SERIES_VARS, loadUPlot } from '@/ui/charts/uplot';
import { graphData, visibleSeries } from './data';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Time-series graphs of the running simulation (uPlot, crosshair + live legend). */
export function GraphPanel() {
  const t = useT();
  const L = useLocalized();
  const scene = useSimStore((s) => s.scene);
  const [graphId, setGraphId] = useState<string | null>(null);
  const params = useSimStore((s) => s.params);
  const picked = scene?.graphs.find((g) => g.id === graphId) ?? scene?.graphs[0] ?? null;
  // A new chart only when the shown series change (uPlot's series are fixed at creation).
  const shownKey = picked
    ? visibleSeries(picked, params)
        .map((s) => s.id)
        .join(' ')
    : '';
  const graph = useMemo(
    () =>
      picked && {
        ...picked,
        series: picked.series.filter((s) => shownKey.split(' ').includes(s.id)),
      },
    [picked, shownKey],
  );
  if (!scene || !graph) {
    return (
      <EmptyState icon={ChartSpline} compact>
        {t('bottom.graphsEmpty')}
      </EmptyState>
    );
  }
  return (
    <div className="graph-panel">
      <div
        className="graph-panel__picker segmented"
        role="radiogroup"
        aria-label={t('graphs.choose')}
      >
        {scene.graphs.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={g.id === graph.id}
            className="segmented__item"
            onClick={() => {
              setGraphId(g.id);
            }}
          >
            {L(g.title)}
          </button>
        ))}
      </div>
      <Chart key={`${scene.id}-${graph.id}-${shownKey}`} graph={graph} />
    </div>
  );
}

function Chart({ graph }: { graph: GraphDef }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const theme = useResolvedTheme();
  const tier = useTierConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlotType | null>(null);
  // uPlot's plot area: the "no data" note goes there, never over the axes.
  const [plotArea, setPlotArea] = useState<HTMLElement | null>(null);
  const cursorT = useRef<number | null>(null);
  const dataVersion = useSimStore((s) => s.dataVersion);
  const scrubTime = useSimStore((s) => s.scrubTime);
  const params = useSimStore((s) => s.params);
  const hasData = sim.history.length > 1;
  const lastDraw = useRef(0);

  // Create the plot (again on theme/locale/graph change).
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
      const opts: uPlotType.Options = {
        width: host.clientWidth || 600,
        height: Math.max(120, host.clientHeight || 180),
        scales: { x: { time: false } },
        // Top: room for half the highest y value only (uPlot's automatic 17 px).
        padding: [8, null, null, null],
        // The live legend is a column beside the plot: the plot keeps the panel's whole height
        // whatever the number of series (a row under or above it took 24–48 px of a 144 px box).
        legend: {
          live: true,
          mount: (_u, el) => {
            legendRef.current?.appendChild(el);
          },
        },
        cursor: { drag: { x: false, y: false }, points: { size: 8 } },
        axes: [
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke, size: 6 },
            // Compact, as in the shared XYChart: uPlot's 50 + 30 px left a 35 px plot.
            ...X_AXIS_SIZE,
            label: t('graphs.time'),
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke },
            label: L(graph.yLabel),
            size: 60,
            labelSize: 20,
            space: (_u, _axis, _min, _max, plotHeight) => yTickSpace(plotHeight),
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
        ],
        series: [
          // No cursor: a dash, not "0 s" (Intl formats null as 0).
          {
            label: 't',
            value: (_u: uPlotType, v: number | null) => (v === null ? '—' : `${nf.format(v)} s`),
          },
          ...graph.series.map((s, i) => ({
            label: L(s.label),
            stroke: css(SERIES_VARS[i % SERIES_VARS.length] ?? '--chart-1'),
            width: 2,
            ...(s.dash ? { dash: s.dash } : {}),
            points: { show: false },
            value: (_u: uPlotType, v: number | null) => (v === null ? '—' : nf.format(v)),
          })),
        ],
        hooks: {
          draw: [
            (u) => {
              const tt = cursorT.current;
              if (tt === null) return;
              const x = u.valToPos(tt, 'x', true);
              const ctx = u.ctx;
              ctx.save();
              ctx.strokeStyle = css('--accent');
              ctx.lineWidth = 1.5 * devicePixelRatio;
              ctx.beginPath();
              ctx.moveTo(x, u.bbox.top);
              ctx.lineTo(x, u.bbox.top + u.bbox.height);
              ctx.stroke();
              ctx.restore();
            },
          ],
        },
      };
      const data = graphData(graph, useSimStore.getState().params) as uPlotType.AlignedData;
      const plot = new UPlot(opts, data, host);
      plotRef.current = plot;
      setPlotArea(plot.over);
      ro = new ResizeObserver(() => {
        plot.setSize({ width: host.clientWidth, height: Math.max(120, host.clientHeight) });
      });
      ro.observe(host);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      setPlotArea(null);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [graph, theme, locale, t, L]);

  // Refresh data at the tier's graph rate.
  useEffect(() => {
    const now = performance.now();
    if (now - lastDraw.current < 1000 / tier.graphHz && scrubTime === null) return;
    lastDraw.current = now;
    cursorT.current = scrubTime;
    plotRef.current?.setData(graphData(graph, params) as uPlotType.AlignedData);
  }, [dataVersion, scrubTime, params, graph, tier.graphHz]);

  return (
    <div className="chart chart--legend-side">
      <div ref={hostRef} className="chart__plot" />
      <div ref={legendRef} className="chart__legend" />
      {!hasData &&
        plotArea &&
        createPortal(<p className="chart__empty muted">{t('graphs.noData')}</p>, plotArea)}
    </div>
  );
}
