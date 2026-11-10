import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/ui/cx';

/** The first-run steps' modal dialog (classic onboarding and the bench's first run). */
export function ModalCard({
  labelledBy,
  onCancel,
  className,
  children,
}: {
  labelledBy: string;
  onCancel: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal() focuses the first option, whose focus ring then looks like a second choice.
    d?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={cx('dialog onboarding', className)}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      {children}
    </dialog>
  );
}
