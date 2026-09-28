import type { LucideIcon } from 'lucide-react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** Extra controls rendered at the right end of the tab strip. */
  trailing?: ReactNode;
  className?: string;
}

/** Accessible tab strip (WAI-ARIA tabs pattern: arrow keys move between tabs). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  trailing,
  className,
}: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (index + delta + items.length) % items.length;
    const item = items[next];
    if (!item) return;
    onChange(item.id);
    refs.current[next]?.focus();
  };

  return (
    <div className={cx('tabs', className)}>
      <div role="tablist" aria-label={label} className="tabs__list">
        {items.map((item, i) => {
          const selected = item.id === value;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-${item.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={cx('tabs__tab', selected && 'is-selected')}
              onClick={() => {
                onChange(item.id);
              }}
              onKeyDown={(e) => {
                onKeyDown(e, i);
              }}
            >
              {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {trailing && <div className="tabs__trailing">{trailing}</div>}
    </div>
  );
}
