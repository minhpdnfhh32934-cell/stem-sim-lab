import { cx } from './cx';

/**
 * Loading placeholders (gallery pattern 079): soft shapes in the layout of what is coming,
 * with a slow shimmer, instead of an empty area or a lone spinner. `label` is announced to
 * screen readers; the shapes themselves are hidden from them.
 */
export function Skeleton({
  label,
  variant = 'stage',
  className,
}: {
  label: string;
  /** stage: a simulation area; board: a whiteboard; lines: a few lines of text. */
  variant?: 'stage' | 'board' | 'lines';
  className?: string;
}) {
  return (
    <div className={cx('skeleton', `skeleton--${variant}`, className)} role="status">
      <span className="sr-only">{label}</span>
      {variant === 'stage' && (
        <div className="skeleton__stage" aria-hidden="true">
          <span className="skeleton__block skeleton__block--canvas" />
          <span className="skeleton__row">
            <span className="skeleton__block skeleton__block--pill" />
            <span className="skeleton__block skeleton__block--bar" />
          </span>
        </div>
      )}
      {variant === 'board' && (
        <div className="skeleton__board" aria-hidden="true">
          <span className="skeleton__block skeleton__block--title" />
          <span className="skeleton__block skeleton__block--line" />
          <span className="skeleton__block skeleton__block--line skeleton__block--short" />
          <span className="skeleton__block skeleton__block--formula" />
          <span className="skeleton__block skeleton__block--line" />
        </div>
      )}
      {variant === 'lines' && (
        <div className="skeleton__lines" aria-hidden="true">
          <span className="skeleton__block skeleton__block--line" />
          <span className="skeleton__block skeleton__block--line" />
          <span className="skeleton__block skeleton__block--line skeleton__block--short" />
        </div>
      )}
    </div>
  );
}
