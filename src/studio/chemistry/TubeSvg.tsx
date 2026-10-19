import { useId } from 'react';
import { formatFormula } from '@/chemistry/formula';

const BAND = 46;
const BOTTOM = 196;
const PPT = 16;

/**
 * Schematic test tube. Every solution is drawn with the same neutral fill and the precipitate
 * as a hatched layer: colours and amounts are not data, so none are suggested.
 */
export function TubeSvg({
  contents,
  mixed,
  precipitate,
  label,
}: {
  contents: readonly string[];
  mixed: boolean;
  precipitate: boolean;
  label: string;
}) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `tube-clip-${id}`;
  const hatch = `tube-hatch-${id}`;
  const tube = 'M44 12 V180 a26 26 0 0 0 52 0 V12';
  const bands = mixed
    ? [{ y: BOTTOM - BAND * contents.length, h: BAND * contents.length, text: null }]
    : contents.map((f, i) => ({
        y: BOTTOM - BAND * (i + 1),
        h: BAND,
        text: formatFormula(f),
      }));
  return (
    <svg className="chem-tube" viewBox="0 0 200 220" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <path d={`${tube} Z`} />
        </clipPath>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" className="chem-tube__hatch" />
        </pattern>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {bands.map((b, i) => (
          <rect
            key={i}
            x="40"
            y={b.y}
            width="60"
            height={b.h + (i === 0 ? 30 : 0)}
            className={
              i % 2 === 0 ? 'chem-tube__liquid' : 'chem-tube__liquid chem-tube__liquid--alt'
            }
          />
        ))}
        {mixed && precipitate && (
          <rect
            x="40"
            y={BOTTOM + 10 - PPT}
            width="60"
            height={PPT + 20}
            fill={`url(#${hatch})`}
            className="chem-tube__ppt"
          />
        )}
      </g>
      <path d={tube} className="chem-tube__glass" />
      {bands.map((b, i) =>
        b.text ? (
          <text key={i} x="106" y={b.y + b.h / 2 + 5} className="chem-tube__label">
            {b.text}
          </text>
        ) : null,
      )}
    </svg>
  );
}
