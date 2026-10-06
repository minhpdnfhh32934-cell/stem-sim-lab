import { cx } from '@/ui/cx';
import { useAiStatusView } from './aiStatusView';

/** Connection state of the AI (click → "Kết nối AI" in Settings). */
export function AiStatusPill({ onClick, className }: { onClick: () => void; className?: string }) {
  const { kind, label, hint, Icon } = useAiStatusView();
  return (
    <button
      type="button"
      className={cx('ai-status', className)}
      data-status={kind}
      aria-label={`${label}. ${hint}`}
      data-tip={hint}
      onClick={onClick}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="ai-status__label">{label}</span>
    </button>
  );
}
