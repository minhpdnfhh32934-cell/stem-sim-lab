import { useMemo } from 'react';
import type { Molecule } from '../data/molecules';
import { lewisLayout } from './lewis';

const DOT_R = 2.6;
const DOT_AT = 21;
const TRIM = 15;
const LINE_GAP = 6;

/**
 * Lewis-style drawing (illustration) of a structure from data/molecules.json: bonds as 1–3 lines,
 * non-bonding electrons as dots (pairs and a lone unpaired electron), formal charges, and rings
 * around `highlight` atoms. `bondLabels` writes a short text at each bond's middle (σ/π).
 */
export function LewisDrawing({
  molecule,
  label,
  highlight = [],
  bondLabels,
}: {
  molecule: Molecule;
  label: string;
  highlight?: readonly number[];
  bondLabels?: readonly string[];
}) {
  const layout = useMemo(() => lewisLayout(molecule), [molecule]);
  const { points, width, height, dots } = layout;
  return (
    <svg
      className="lewis"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={Math.round(width * 1.6)}
      height={Math.round(height * 1.6)}
      role="img"
      aria-label={label}
    >
      {molecule.bonds.map((b, k) => {
        const p = points[b.a];
        const q = points[b.b];
        if (!p || !q) return null;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const lines = Array.from({ length: b.order }, (_, i) => (i - (b.order - 1) / 2) * LINE_GAP);
        const text = bondLabels?.[k];
        // Far enough from the bond that a wide label beside a steep bond does not cross it.
        const labelOff = text ? 9 + Math.abs(uy) * text.length * 3.6 + Math.abs(ux) * 6 : 0;
        return (
          <g key={k}>
            {lines.map((off) => (
              <line
                key={off}
                className="lewis__bond"
                x1={p.x + ux * TRIM - uy * off}
                y1={p.y + uy * TRIM + ux * off}
                x2={q.x - ux * TRIM - uy * off}
                y2={q.y - uy * TRIM + ux * off}
              />
            ))}
            {text && (
              <text
                className="lewis__bond-label"
                x={(p.x + q.x) / 2 + uy * labelOff}
                y={(p.y + q.y) / 2 - ux * labelOff}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {text}
              </text>
            )}
          </g>
        );
      })}
      {molecule.atoms.map((a, i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <g key={i}>
            {highlight.includes(i) && <circle className="lewis__ring" cx={p.x} cy={p.y} r={30} />}
            {(dots[i] ?? []).map((g, k) => {
              const cx = p.x + Math.cos(g.angle) * DOT_AT;
              const cy = p.y - Math.sin(g.angle) * DOT_AT;
              // A pair sits side by side, across the direction it points to.
              const tx = Math.sin(g.angle) * 3.4;
              const ty = Math.cos(g.angle) * 3.4;
              return g.electrons === 2 ? (
                <g key={k} className="lewis__pair">
                  <circle className="lewis__dot" cx={cx - tx} cy={cy - ty} r={DOT_R} />
                  <circle className="lewis__dot" cx={cx + tx} cy={cy + ty} r={DOT_R} />
                </g>
              ) : (
                <circle
                  key={k}
                  className="lewis__dot lewis__dot--single"
                  cx={cx}
                  cy={cy}
                  r={DOT_R + 0.6}
                />
              );
            })}
            <text
              className="lewis__atom"
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {a.el}
            </text>
            {a.charge !== 0 && (
              <text
                className="lewis__charge"
                x={p.x + Math.cos(layout.chargeAngle[i] ?? 0) * 22}
                y={p.y - Math.sin(layout.chargeAngle[i] ?? 0) * 22}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {a.charge > 0 ? '+' : '−'}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
