import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlotType from 'uplot';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import type { GraphDef } from '@/physics/types';
import { EmptyState } from '@/ui/EmptyState';
import { ChartSpline } from 'lucide-react';
import { SERIES_VARS, loadUPlot } from '@/ui/charts/uplot';
import { graphData } from './data';
import { sim } from './runtime';
import { useSimStore } from './simStore';

/** Time-series graphs of the running simulation (uPlot, crosshair + live legend). */
export function GraphPanel() {
  const t = useT();
  const L = useLocalized();
  const scene = useSimStore((s) => s.scene);
  const [graphId, setGraphId] = useState<string | null>(null);
  const graph = useMemo(
    () => scene?.graphs.find((g) => g.id === graphId) ?? scene?.graphs[0] ?? null,
    [scene, graphId],
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
      <Chart key={`${scene.id}-${graph.id}`} graph={graph} />
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
  const plotRef = useRef<uPlotType | null>(null);
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
        legend: { live: true },
        cursor: { drag: { x: false, y: false }, points: { size: 8 } },
        axes: [
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke },
            label: t('graphs.time'),
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
          {
            stroke: axisStroke,
            grid: { stroke: gridStroke, width: 1 },
            ticks: { stroke: gridStroke },
            label: L(graph.yLabel),
            size: 60,
            values: (_u, vals) => vals.map((v) => nf.format(v)),
          },
        ],
        series: [
          { label: 't', value: (_u, v) => `${nf.format(v)} s` },
          ...graph.series.map((s, i) => ({
            label: L(s.label),
            stroke: css(SERIES_VARS[i % SERIES_VARS.length] ?? '--chart-1'),
            width: 2,
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
      plotRef.current = new UPlot(opts, data, host);
      ro = new ResizeObserver(() => {
        plotRef.current?.setSize({
          width: host.clientWidth,
          height: Math.max(120, host.clientHeight),
        });
      });
      ro.observe(host);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
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
    <div className="chart">
      {!hasData && <p className="chart__empty muted">{t('graphs.noData')}</p>}
      <div ref={hostRef} className="chart__plot" />
    </div>
  );
}
