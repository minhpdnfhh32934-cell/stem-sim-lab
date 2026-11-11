import { CloudDownload } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useUpdateStore } from './updater';

/**
 * "Có bản cập nhật {version}" in the bench header after "Để sau" (the classic status bar's
 * button): also when the new version needs the installer, so nobody misses it.
 */
export function UpdateReminder() {
  const t = useT();
  const update = useUpdateStore((s) =>
    s.phase === 'available' || s.phase === 'needsInstaller' ? s.manifest : null,
  );
  if (!update) return null;
  return (
    <button
      type="button"
      className="btn bench-header__update"
      onClick={() => {
        useUpdateStore.setState({ dialogOpen: true });
      }}
    >
      <CloudDownload size={16} strokeWidth={1.75} aria-hidden="true" />
      <span>{t('update.available', { version: update.webVersion })}</span>
    </button>
  );
}
