import { useEffect, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import type { GraphDef } from '@/physics/types';
import { SERIES_VARS } from '@/ui/charts/uplot';
import { phaseData } from './data';
import { equalScales, niceTicks, phaseBounds, splitAtWraps } from './phasePlot';
import { sim } from './runtime';
import { useSimStore } from './simStore';

const PAD = { left: 58, right: 12, top: 10, bottom: 36 };

/**
 * A phase portrait (v against x, ω against α): a canvas, not uPlot, because uPlot thins a line
 * by x pixel, which only works when x grows with time. Recorded states only, like the time graphs.
 */
export function PhaseChart({ graph }: { graph: GraphDef }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const theme = useResolvedTheme();
  const tier = useTierConfig();
  const params = useSimStore((s) => s.params);
  const dataVersion = useSimStore((s) => s.dataVersion);
  const scrubTime = useSimStore((s) => s.scrubTime);
  const ref = useRef<HTMLCanvasElement>(null);
  const lastDraw = useRef(0);
  const [now, setNow] = useState<[number, number][] | null>(null);
  const nf = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumSignificantDigits: 4,
  });
  const fmt = (v: number) => nf.format(Math.abs(v) < 1e-12 ? 0 : v);
  const xLabel = graph.x ? L(graph.x.label) : '';

  const draw = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const cs = getComputedStyle(document.documentElement);
    const css = (v: string) => cs.getPropertyValue(v).trim();
    const dpr = Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const p = useSimStore.getState().params;
    const data = phaseData(graph, p, useSimStore.getState().scrubTime);
    const guides = graph.guides?.(p) ?? [];
    setNow(data.current);
    const pw = Math.max(1, w - PAD.left - PAD.right);
    const ph = Math.max(1, h - PAD.top - PAD.bottom);
    let b = phaseBounds([...data.series, ...guides.map((g) => g.points)], graph.phasor === true);
    if (graph.phasor) b = equalScales(b, pw, ph);
    const X = (v: number) => PAD.left + ((v - b.xMin) / (b.xMax - b.xMin)) * pw;
    const Y = (v: number) => PAD.top + ((b.yMax - v) / (b.yMax - b.yMin)) * ph;
    const font = css('--font-sans') || 'sans-serif';
    ctx.font = `11px ${font}`;
    ctx.lineWidth = 1;
    // Grid and tick labels.
    ctx.strokeStyle = css('--stage-grid-major');
    ctx.fillStyle = css('--text-muted');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of niceTicks(b.xMin, b.xMax, Math.max(2, Math.round(pw / 70)))) {
      ctx.beginPath();
      ctx.moveTo(X(v), PAD.top);
      ctx.lineTo(X(v), PAD.top + ph);
      ctx.stroke();
      ctx.fillText(fmt(v), X(v), PAD.top + ph + 4);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of niceTicks(b.yMin, b.yMax, Math.max(3, Math.round(ph / 35)))) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, Y(v));
      ctx.lineTo(PAD.left + pw, Y(v));
      ctx.stroke();
      ctx.fillText(fmt(v), PAD.left - 6, Y(v));
    }
    // Axes through zero.
    ctx.strokeStyle = css('--text-muted');
    if (b.xMin < 0 && b.xMax > 0) {
      ctx.beginPath();
      ctx.moveTo(X(0), PAD.top);
      ctx.lineTo(X(0), PAD.top + ph);
      ctx.stroke();
    }
    if (b.yMin < 0 && b.yMax > 0) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, Y(0));
      ctx.lineTo(PAD.left + pw, Y(0));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, PAD.left + pw / 2, h - 2);
    ctx.save();
    ctx.translate(12, PAD.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(L(graph.yLabel), 0, 0);
    ctx.restore();
    // Everything else stays inside the plot.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, PAD.top, pw, ph);
    ctx.clip();
    const line = (pts: readonly [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(X(x), Y(y));
        else ctx.lineTo(X(x), Y(y));
      });
      ctx.stroke();
    };
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = css('--text-muted');
    guides.forEach((g) => {
      line(g.points);
    });
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    data.series.forEach((pts, k) => {
      ctx.strokeStyle = css(SERIES_VARS[k % SERIES_VARS.length] ?? '--chart-1');
      for (const run of splitAtWraps(pts, graph.x?.period)) line(run);
    });
    const first = data.current?.[0];
    if (graph.phasor && first) {
      // The rotating vector and its projection: the projection is the displacement x.
      const [x, y] = first;
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      line([
        [0, 0],
        [x, y],
      ]);
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      line([
        [x, y],
        [x, 0],
      ]);
      ctx.setLineDash([]);
      ctx.fillStyle = css('--accent');
      ctx.beginPath();
      ctx.arc(X(x), Y(0), 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    data.current?.forEach(([x, y], k) => {
      ctx.fillStyle = css(SERIES_VARS[k % SERIES_VARS.length] ?? '--chart-1');
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 4.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.restore();
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  // Drawn again when the canvas resizes, the theme or the language changes.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    drawRef.current();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      drawRef.current();
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
    };
  }, [graph, theme, locale, tier.pixelRatioCap]);

  // New data at the tier's graph rate, like the time graphs.
  useEffect(() => {
    const t0 = performance.now();
    if (t0 - lastDraw.current < 1000 / tier.graphHz && scrubTime === null) return;
    lastDraw.current = t0;
    drawRef.current();
  }, [dataVersion, scrubTime, params, tier.graphHz]);

  const guides = graph.guides?.(params) ?? [];
  const guideLabels = [...new Set(guides.map((g) => L(g.label)))];
  return (
    <div className="chart chart--legend-side">
      <canvas
        ref={ref}
        className="chart__plot chart__canvas"
        role="img"
        aria-label={t('phaseChart.label', {
          title: L(graph.title),
          y: L(graph.yLabel),
          x: xLabel,
        })}
      />
      <div className="chart__legend">
        <ul className="phase-legend">
          {graph.series.map((s, k) => {
            const pt = now?.[k];
            return (
              <li key={s.id}>
                <span
                  className="phase-legend__swatch"
                  style={{
                    background: `var(${SERIES_VARS[k % SERIES_VARS.length] ?? '--chart-1'})`,
                  }}
                />
                {L(s.label)}
                {pt && <strong>{` (${fmt(pt[0])}; ${fmt(pt[1])})`}</strong>}
              </li>
            );
          })}
          {guideLabels.map((label) => (
            <li key={label}>
              <span className="phase-legend__swatch phase-legend__swatch--dashed" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      {sim.history.length <= 1 && <p className="chart__empty muted">{t('graphs.noData')}</p>}
    </div>
  );
}
