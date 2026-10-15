import type { SettingsSection } from '@/app/workspaceStore';
import { cx } from '@/ui/cx';
import { useAiStatusView } from './aiStatusView';

/**
 * State of the AI the learner chose (click → Settings: the page of that AI — "AI trên máy khác",
 * Gemma — or the page Settings last showed for the online API).
 */
export function AiStatusPill({
  onClick,
  className,
}: {
  onClick: (section: SettingsSection | null) => void;
  className?: string;
}) {
  const { kind, label, hint, Icon, section } = useAiStatusView();
  return (
    <button
      type="button"
      className={cx('ai-status', className)}
      data-status={kind}
      aria-label={`${label}. ${hint}`}
      data-tip={hint}
      onClick={() => {
        onClick(section);
      }}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="ai-status__label">{label}</span>
    </button>
  );
}
