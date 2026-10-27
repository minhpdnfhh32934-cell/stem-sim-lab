import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from './cx';

interface SectionProps {
  title: string;
  /** Keep the title's own case (a lesson name such as "ADN → mARN → Protein"); others are upper case. */
  keepCase?: boolean;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}

/** Collapsible inspector section with a disclosure button. */
export function Section({
  title,
  keepCase = false,
  defaultOpen = true,
  trailing,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="section">
      <header className="section__header">
        <button
          type="button"
          className="section__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          <ChevronRight className="section__chevron" size={14} strokeWidth={2} aria-hidden="true" />
          <h3 className={cx('section__title', keepCase && 'section__title--keep-case')}>{title}</h3>
        </button>
        {trailing}
      </header>
      <div id={bodyId} className="section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
