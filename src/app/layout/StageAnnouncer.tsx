import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { stageAnnouncement } from './stageAnnouncement';

/** Screen-reader-only live line of the stage; changes only with play / pause / end / replay. */
export function StageAnnouncer({ title }: { title: string }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const playing = useWorkspaceStore((s) => s.playing);
  const { finished, replay, intervened } = useSimStore(
    useShallow((s) => ({
      finished: s.finished,
      replay: s.scrubTime !== null,
      intervened: s.intervened,
    })),
  );
  // The time is read once, when the state changes; this line never follows the clock.
  const key = [title, playing, finished, replay, intervened, locale].join('|');
  const [said, setSaid] = useState({ key: '', message: '' });
  if (said.key !== key) {
    const time = useSimStore.getState().scrubTime ?? useWorkspaceStore.getState().simTime;
    const status = { title, playing, finished, replay, intervened, time };
    setSaid({ key, message: stageAnnouncement(status, t, locale) });
  }
  return (
    <p className="sr-only" aria-live="polite">
      {said.message}
    </p>
  );
}
