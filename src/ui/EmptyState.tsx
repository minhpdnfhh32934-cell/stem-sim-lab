import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  children: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, children, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'empty empty--compact' : 'empty'}>
      <Icon className="empty__icon" size={compact ? 20 : 30} strokeWidth={1.4} aria-hidden="true" />
      {title && <p className="empty__title">{title}</p>}
      <div className="empty__body">{children}</div>
    </div>
  );
}
