import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useT } from '@/app/i18n';
import { dismissToast, useToastStore, type ToastKind } from './toast';

const ICON: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warn: TriangleAlert,
  error: CircleAlert,
};

export function Toaster() {
  const t = useT();
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((x) => {
        const Icon = ICON[x.kind];
        return (
          <div key={x.id} className={`toast toast--${x.kind}`}>
            <Icon size={16} aria-hidden="true" />
            <span>{x.text}</span>
            <button
              type="button"
              className="toast__close"
              aria-label={t('project.dismiss')}
              onClick={() => {
                dismissToast(x.id);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
