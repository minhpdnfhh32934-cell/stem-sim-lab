import { CloudDownload } from 'lucide-react';
import { useT } from '@/app/i18n';
import { IconButton } from '@/ui/IconButton';
import { useUpdateStore } from './updater';

/**
 * "Có bản cập nhật {version}" in the bench header after "Để sau" (the classic status bar's
 * button): also when the new version needs the installer, so nobody misses it. An icon with a
 * dot, its name in the tooltip: a text button took the topic name's room (review of #198).
 */
export function UpdateReminder() {
  const t = useT();
  const update = useUpdateStore((s) =>
    s.phase === 'available' || s.phase === 'needsInstaller' ? s.manifest : null,
  );
  if (!update) return null;
  return (
    <IconButton
      icon={CloudDownload}
      label={t('update.available', { version: update.webVersion })}
      className="bench-header__update"
      onClick={() => {
        useUpdateStore.setState({ dialogOpen: true });
      }}
    />
  );
}
