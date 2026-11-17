import type { ReactNode } from 'react';

export interface Bar {
  id: string;
  label: ReactNode;
  value: number;
  /** The value as shown ("−3,040 V", "180,5 °C"). */
  text: string;
  /** Drawn in the accent colour (a chosen element, one above a threshold…). */
  strong?: boolean;
}

/**
 * Horizontal bars of one property, the book's order kept. Lengths follow |value| so negative
 * potentials read the same way; an optional mark shows a threshold (Be's melting point…).
 */
export function BarList({
  bars,
  mark,
  label,
}: {
  bars: readonly Bar[];
  mark?: { value: number; text: string };
  label: string;
}) {
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), mark ? Math.abs(mark.value) : 0);
  const pct = (v: number) => (max > 0 ? (Math.abs(v) / max) * 100 : 0);
  return (
    <figure className="bar-list" aria-label={label}>
      <ul>
        {bars.map((b) => (
          <li
            key={b.id}
            className={b.strong ? 'bar-list__row bar-list__row--strong' : 'bar-list__row'}
          >
            <span className="bar-list__label">{b.label}</span>
            <span className="bar-list__track">
              <span className="bar-list__bar" style={{ width: `${pct(b.value)}%` }} />
              {mark && <span className="bar-list__mark" style={{ left: `${pct(mark.value)}%` }} />}
            </span>
            <span className="bar-list__value mono">{b.text}</span>
          </li>
        ))}
      </ul>
      {mark && <figcaption className="bar-list__caption">{mark.text}</figcaption>}
    </figure>
  );
}
