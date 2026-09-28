import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}

/** Collapsible inspector section with a disclosure button. */
export function Section({ title, defaultOpen = true, trailing, children }: SectionProps) {
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
          <h3 className="section__title">{title}</h3>
        </button>
        {trailing}
      </header>
      <div id={bodyId} className="section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
