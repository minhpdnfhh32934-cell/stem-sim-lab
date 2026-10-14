import { ChevronRight, ScrollText, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { ReleaseEntry } from './releaseNotes';
import { HighlightList, NoteGroups, ReleaseDate } from './VersionNotes';
import {
  closeWhatsNew,
  showVersionHistory,
  snoozeWhatsNew,
  useWhatsNewStore,
} from './whatsNewStore';
import './whatsnew.css';

/**
 * "SimLab đã được cập nhật": what is new in the version that now runs (and in every version
 * skipped since the last time). Opens by itself only at a calm moment (whatsNewStore.ts).
 * Đóng / Esc = seen; Để sau = not again by itself for this version; Xem chi tiết = seen and
 * Settings → Lịch sử phiên bản.
 */
export function WhatsNewDialog() {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const { open, pending } = useWhatsNewStore(
    useShallow((s) => ({ open: s.open, pending: s.pending })),
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Start on the title (read first by screen readers), not on a button that would close
      // the box on Enter or on the scroll area with a large focus ring.
      title.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog whatsnew"
      aria-labelledby="whatsnew-title"
      aria-describedby="whatsnew-intro"
      onCancel={(e) => {
        // Esc closes like "Đóng".
        e.preventDefault();
        closeWhatsNew();
      }}
      onClose={() => {
        if (useWhatsNewStore.getState().open) closeWhatsNew();
      }}
    >
      <header className="dialog__header">
        <h2 id="whatsnew-title" className="whatsnew__title" ref={title} tabIndex={-1}>
          <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
          {t('whatsnew.title')}
        </h2>
      </header>
      {/* Focusable so the notes can be scrolled with the keyboard. */}
      <div
        className="dialog__body whatsnew__body"
        role="region"
        aria-label={t('whatsnew.notesLabel')}
        tabIndex={0}
      >
        <p id="whatsnew-intro" className="whatsnew__intro">
          {t('whatsnew.intro')}
        </p>
        {open &&
          pending.map((v, i) => <VersionSection key={v.version} entry={v} first={i === 0} />)}
        <p className="whatsnew__where">{t('whatsnew.where')}</p>
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn" onClick={closeWhatsNew}>
          {t('whatsnew.close')}
        </button>
        <button type="button" className="btn" onClick={snoozeWhatsNew}>
          {t('whatsnew.later')}
        </button>
        <button type="button" className="btn btn--accent" onClick={showVersionHistory}>
          <ScrollText size={15} aria-hidden="true" />
          {t('whatsnew.details')}
        </button>
      </footer>
    </dialog>
  );
}

function VersionSection({ entry, first }: { entry: ReleaseEntry; first: boolean }) {
  const t = useT();
  const L = useLocalized();
  const { publicNotes: n } = entry;
  const headingId = `whatsnew-v-${entry.version.replace(/\./g, '-')}`;
  const highlights = entry.learnerHighlights;
  return (
    <section className="whatsnew__version" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('whatsnew.version', { version: entry.version })}</h3>
      <ReleaseDate entry={entry} />
      <p className="whatsnew__summary">{L(n.summary)}</p>
      {highlights.length > 0 && (
        <>
          <h4 className="sr-only">{t('whatsnew.highlights')}</h4>
          <HighlightList items={highlights} />
        </>
      )}
      {/* The newest version shows every group; older ones keep them folded. */}
      <details className="whatsnew__all" open={first || highlights.length === 0}>
        <summary>
          <ChevronRight className="disclosure" size={15} aria-hidden="true" />
          {t('whatsnew.allChanges')}
        </summary>
        <NoteGroups
          groups={[
            { category: 'added', items: n.added },
            { category: 'improved', items: [...n.improved, ...n.performance] },
            { category: 'fixed', items: n.fixed },
          ]}
        />
      </details>
    </section>
  );
}
