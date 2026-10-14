import { ChevronRight, ExternalLink, ScrollText, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { openReleasesPage, updatesSupported } from '@/app/update/updater';
import { Skeleton } from '@/ui/Skeleton';
import { STATUS_KEY } from './format';
import { NOTE_CATEGORIES, type ReleaseEntry } from './releaseNotes';
import { HighlightList, NoteGroups, ReleaseDate, StatusBadge } from './VersionNotes';
import { loadReleaseNotes, openWhatsNew, useWhatsNewStore } from './whatsNewStore';
import './whatsnew.css';

/**
 * Settings → "Lịch sử phiên bản": every version of SimLab, newest first, with its status
 * (released / in review / unverified …) and its notes folded under it. Offline: the bundled
 * release-notes/versions.json.
 */
export function VersionHistory() {
  const t = useT();
  const notes = useWhatsNewStore((s) => s.notes);
  const loadState = useWhatsNewStore((s) => s.loadState);
  const current = useWhatsNewStore((s) => s.current);
  const hasPending = useWhatsNewStore((s) => s.pending.length > 0);

  useEffect(() => {
    void loadReleaseNotes();
  }, []);

  if (loadState === 'error')
    return <p className="version-history__empty">{t('whatsnew.history.unavailable')}</p>;
  if (!notes) return <Skeleton label={t('whatsnew.history.loading')} variant="lines" />;

  return (
    <div className="version-history">
      <fieldset className="settings-group">
        <legend>
          <ScrollText size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('whatsnew.history.current', { version: current })}
        </legend>
        <div className="version-history__actions">
          {hasPending && (
            <button type="button" className="btn" onClick={openWhatsNew}>
              <Sparkles size={15} aria-hidden="true" />
              {t('whatsnew.history.showWhatsNew')}
            </button>
          )}
          {updatesSupported() && (
            <button type="button" className="btn" onClick={() => void openReleasesPage()}>
              <ExternalLink size={15} aria-hidden="true" />
              {t('whatsnew.history.releasesPage')}
            </button>
          )}
        </div>
      </fieldset>
      <ol className="version-history__list" aria-label={t('whatsnew.history.listLabel')}>
        {notes.versions.map((v, i) => (
          <li key={v.version}>
            <VersionItem entry={v} current={v.version === current} open={i === 0} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function VersionItem({
  entry,
  current,
  open,
}: {
  entry: ReleaseEntry;
  current: boolean;
  open: boolean;
}) {
  const t = useT();
  const L = useLocalized();
  const n = entry.publicNotes;
  return (
    <details className="version-history__item" open={open}>
      <summary>
        <ChevronRight className="disclosure" size={16} aria-hidden="true" />
        <span className="version-history__version">
          {t('whatsnew.version', { version: entry.version })}
        </span>
        <StatusBadge status={entry.status} />
        {current && (
          <span className="badge release-badge release-badge--current">
            {t('whatsnew.history.currentBadge')}
          </span>
        )}
      </summary>
      <div className="version-history__body">
        {entry.status === 'released' ? (
          <ReleaseDate entry={entry} />
        ) : (
          <p className="whatsnew__date">{t(`whatsnew.statusHint.${STATUS_KEY[entry.status]}`)}</p>
        )}
        {!entry.notesReady && (
          <p className="version-history__draft">{t('whatsnew.history.draft')}</p>
        )}
        <p className="whatsnew__summary">{L(n.summary)}</p>
        <HighlightList items={entry.learnerHighlights} />
        <NoteGroups groups={NOTE_CATEGORIES.map((c) => ({ category: c, items: n[c] }))} />
      </div>
    </details>
  );
}
