import { cx } from './cx';

/**
 * A download bar (gallery pattern 083): a moving stripe while the size is unknown, then a filled
 * bar that glides to each new value and turns green when done. The text next to it says what is
 * happening; this is the visual half.
 */
export function ProgressBar({
  value,
  label,
  done = false,
}: {
  /** 0–100, or null while there is no percent yet. */
  value: number | null;
  label: string;
  done?: boolean;
}) {
  const indeterminate = value === null && !done;
  const pct = done ? 100 : Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cx('progress-bar', indeterminate && 'is-indeterminate', done && 'is-done')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(indeterminate ? {} : { 'aria-valuenow': Math.round(pct) })}
    >
      <span
        className="progress-bar__fill"
        style={indeterminate ? undefined : { width: `${String(pct)}%` }}
      />
    </div>
  );
}
