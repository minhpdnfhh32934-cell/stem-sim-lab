import { CloudDownload, ExternalLink, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { IconButton } from '@/ui/IconButton';
import {
  applyUpdate,
  checkForUpdate,
  openReleasesPage,
  resetToBuiltIn,
  restartApp,
  useUpdateStore,
} from './updater';

/** "Cập nhật phần mềm": check, download and apply a signed update of the web part. */
export function UpdateDialog() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const ref = useRef<HTMLDialogElement>(null);
  const { dialogOpen, phase, status, manifest, error } = useUpdateStore();
  const close = () => {
    useUpdateStore.setState({ dialogOpen: false });
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (dialogOpen && !d.open) d.showModal();
    if (!dialogOpen && d.open) d.close();
  }, [dialogOpen]);

  const mb = (bytes: number) => formatNumber(locale, bytes / 2 ** 20, { maximumFractionDigits: 1 });
  const busy = phase === 'checking' || phase === 'downloading';

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="update-title" onClose={close}>
      <header className="dialog__header">
        <h2 id="update-title">{t('update.title')}</h2>
        <IconButton icon={X} label={t('update.close')} onClick={close} tooltipSide="left" />
      </header>
      <div className="dialog__body update">
        {status && (
          <p className="small muted">
            {t('update.current', { version: status.running, native: status.native })}
            {status.downloaded ? ` · ${t('update.downloaded')}` : ''}
          </p>
        )}

        {busy && (
          <p className="update__line" role="status">
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
            {phase === 'checking' ? t('update.checking') : t('update.downloading')}
          </p>
        )}
        {phase === 'upToDate' && <p className="update__line">{t('update.upToDate')}</p>}
        {(phase === 'available' || phase === 'needsInstaller') && manifest && (
          <>
            <p className="update__line">
              <strong>{t('update.newVersion', { version: manifest.webVersion })}</strong>
              <span className="small muted">
                {manifest.date} · {mb(manifest.size)} MB
              </span>
            </p>
            {manifest.notes && <p className="update__notes">{manifest.notes}</p>}
            {phase === 'needsInstaller' && (
              <p className="update__warn">
                {t('update.needsInstaller', { native: manifest.minNative })}
              </p>
            )}
          </>
        )}
        {phase === 'ready' && <p className="update__line">{t('update.ready')}</p>}
        {phase === 'error' && (
          <p className="update__warn" role="alert">
            {t('update.error')} {error}
          </p>
        )}
        <p className="small muted">{t('update.safety')}</p>
      </div>
      <footer className="dialog__footer">
        {status?.downloaded && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void resetToBuiltIn()}
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t('update.reset')}
          </button>
        )}
        <span className="update__spacer" />
        {phase === 'available' && (
          <button type="button" className="btn btn--accent" onClick={() => void applyUpdate()}>
            <CloudDownload size={15} aria-hidden="true" />
            {t('update.install')}
          </button>
        )}
        {phase === 'needsInstaller' && (
          <button type="button" className="btn btn--accent" onClick={() => void openReleasesPage()}>
            <ExternalLink size={15} aria-hidden="true" />
            {t('update.openReleases')}
          </button>
        )}
        {phase === 'ready' && (
          <button type="button" className="btn btn--accent" onClick={() => void restartApp()}>
            <RotateCcw size={15} aria-hidden="true" />
            {t('update.restart')}
          </button>
        )}
        {(phase === 'upToDate' || phase === 'error' || phase === 'idle') && (
          <button type="button" className="btn" onClick={() => void checkForUpdate()}>
            {t('update.checkAgain')}
          </button>
        )}
      </footer>
    </dialog>
  );
}
