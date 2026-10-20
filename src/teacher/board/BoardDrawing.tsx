import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { DrawElement } from './layout';
import { forceAngle } from './diagram';
import { sample } from './plot';
import * as rough from './rough';

/**
 * Hand-drawn diagrams on the board (PROMPT_PHAN_2 B7.4): tables, function graphs (computed by
 * code from the formula), axes, free-body diagrams, vectors and process flows. The AI gives
 * labels and formulas only; sizes, positions and every plotted number come from this code.
 */
export function BoardDrawing({ element: e, shown }: { element: DrawElement; shown: boolean }) {
  const cls = shown ? 'board__draw is-shown' : 'board__draw';
  switch (e.type) {
    case 'table':
      return <TableDrawing element={e} shown={shown} />;
    case 'plot':
    case 'axes':
      return <PlotDrawing element={e} className={cls} />;
    case 'free_body':
      return <FreeBody element={e} className={cls} />;
    case 'vector':
      return <VectorDrawing element={e} className={cls} />;
    case 'flow':
      return <FlowDrawing element={e} className={cls} />;
  }
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/** A table at its natural size, scaled like its box when it was too wide for its place. */
function TableDrawing({ element: e, shown }: { element: DrawElement; shown: boolean }) {
  const header = strings(e.spec.header);
  const rows = Array.isArray(e.spec.rows) ? e.spec.rows.map(strings) : [];
  return (
    <div className="board__table-scale" style={{ transform: `scale(${String(e.scale)})` }}>
      <table className={shown ? 'board__table is-shown' : 'board__table'}>
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlotDrawing({ element: e, className }: { element: DrawElement; className: string }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const W = e.w;
  const H = e.h;
  const pad = 36;
  const fn = typeof e.spec.fn === 'string' ? e.spec.fn : '';
  const domain = Array.isArray(e.spec.domain) ? (e.spec.domain as [number, number]) : null;
  const series = fn && domain ? sample(fn, domain) : null;
  const seed = rough.seedOf(e.id);
  const xLabel = typeof e.spec.x === 'string' ? e.spec.x : 'x';
  const yLabel = typeof e.spec.y === 'string' ? e.spec.y : 'y';
  if (!series) {
    return (
      <svg className={className} width={W} height={H} role="img" aria-label={t('board.axes')}>
        <path d={rough.line(pad, H - pad, W - 10, H - pad, seed)} pathLength={1} />
        <path d={rough.head(W - 10, H - pad, Math.PI)} pathLength={1} />
        <path d={rough.line(pad, H - pad, pad, 10, seed + 1)} pathLength={1} />
        <path d={rough.head(pad, 10, Math.PI / 2)} pathLength={1} />
        <text x={W - 24} y={H - pad + 26}>
          {xLabel}
        </text>
        <text x={pad - 26} y={22}>
          {yLabel}
        </text>
        {fn && (
          <text x={pad + 10} y={H / 2}>
            {t('board.plotUnreadable')}
          </text>
        )}
      </svg>
    );
  }
  const sx = (x: number) =>
    pad + ((x - series.xMin) / (series.xMax - series.xMin)) * (W - pad - 14);
  const sy = (y: number) =>
    H - pad - ((y - series.yMin) / (series.yMax - series.yMin)) * (H - pad - 14);
  const x0 = sx(Math.min(Math.max(0, series.xMin), series.xMax));
  const y0 = sy(0);
  let d = '';
  let prev: number | null = null;
  for (const [x, y] of series.points) {
    // Break the line where the function jumps (e.g. tan, 1/x).
    const jump = prev !== null && Math.abs(sy(y) - prev) > H * 0.8;
    d += `${d && !jump ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)} `;
    prev = sy(y);
  }
  const fmt = (v: number) => formatNumber(locale, Number(v.toPrecision(3)));
  return (
    <svg
      className={className}
      width={W}
      height={H}
      role="img"
      aria-label={t('board.plotOf', { fn })}
    >
      <path d={rough.line(pad - 6, y0, W - 10, y0, seed)} pathLength={1} />
      <path d={rough.head(W - 10, y0, Math.PI)} pathLength={1} />
      <path d={rough.line(x0, H - 10, x0, 8, seed + 1)} pathLength={1} />
      <path d={rough.head(x0, 8, Math.PI / 2)} pathLength={1} />
      <path className="board__curve" d={d} pathLength={1} />
      <text x={W - 22} y={y0 + 24}>
        {xLabel}
      </text>
      <text x={x0 + 8} y={18}>
        {yLabel}
      </text>
      <text className="board__tick" x={pad} y={H - 8}>
        {fmt(series.xMin)}
      </text>
      <text className="board__tick" x={W - 60} y={H - 8}>
        {fmt(series.xMax)}
      </text>
      <text className="board__curve-label" x={pad + 12} y={28}>
        {typeof e.spec.label === 'string' ? e.spec.label : `y = ${fn}`}
      </text>
    </svg>
  );
}

function FreeBody({ element: e, className }: { element: DrawElement; className: string }) {
  const W = e.w;
  const H = e.h;
  const cx = W / 2;
  const cy = H / 2;
  const box = 70;
  const forces = strings(e.spec.forces).slice(0, 6);
  const body = typeof e.spec.body === 'string' ? e.spec.body : '';
  const seed = rough.seedOf(e.id);
  return (
    <svg className={className} width={W} height={H} role="img" aria-label={forces.join(', ')}>
      <path
        d={rough.rect({ x: cx - box / 2 + 8, y: cy - box / 2 + 8, w: box - 16, h: box - 16 }, seed)}
        pathLength={1}
      />
      {body && (
        <text x={cx} y={cy + 6} textAnchor="middle" className="board__tick">
          {body}
        </text>
      )}
      {forces.map((f, i) => {
        const ang = forceAngle(f);
        const len = Math.min(W, H) * 0.36;
        const sx = cx + Math.cos(ang) * (box / 2);
        const sy = cy + Math.sin(ang) * (box / 2);
        const ex = cx + Math.cos(ang) * (box / 2 + len);
        const ey = cy + Math.sin(ang) * (box / 2 + len);
        return (
          <g key={f} className="board__force">
            <path d={rough.line(sx, sy, ex, ey, seed + i + 2)} pathLength={1} />
            <path d={rough.head(ex, ey, ang + Math.PI)} pathLength={1} />
            <text x={ex + Math.cos(ang) * 18 - 10} y={ey + Math.sin(ang) * 18 + 8}>
              {f}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function VectorDrawing({ element: e, className }: { element: DrawElement; className: string }) {
  const label = typeof e.spec.label === 'string' ? e.spec.label : '';
  const seed = rough.seedOf(e.id);
  const y = e.h / 2 + 10;
  return (
    <svg className={className} width={e.w} height={e.h} role="img" aria-label={label}>
      <path d={rough.line(20, y, e.w - 24, y - 10, seed)} pathLength={1} />
      <path d={rough.head(e.w - 24, y - 10, Math.PI - 0.04)} pathLength={1} />
      <text x={e.w / 2} y={y - 24} textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}

function FlowDrawing({ element: e, className }: { element: DrawElement; className: string }) {
  const steps = strings(e.spec.steps).slice(0, 8);
  const seed = rough.seedOf(e.id);
  const rowH = e.h / Math.max(1, steps.length);
  return (
    <svg className={className} width={e.w} height={e.h} role="img" aria-label={steps.join(' → ')}>
      {steps.map((s, i) => {
        const y = i * rowH;
        return (
          <g key={i}>
            <path
              d={rough.rect({ x: 16, y: y + 10, w: e.w - 32, h: rowH - 34 }, seed + i)}
              pathLength={1}
            />
            <text x={e.w / 2} y={y + rowH / 2 - 2} textAnchor="middle">
              {s}
            </text>
            {i < steps.length - 1 && (
              <>
                <path
                  d={rough.line(e.w / 2, y + rowH - 18, e.w / 2, y + rowH + 6, seed + 20 + i)}
                  pathLength={1}
                />
                <path d={rough.head(e.w / 2, y + rowH + 6, -Math.PI / 2, 9)} pathLength={1} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
