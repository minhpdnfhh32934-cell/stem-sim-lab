import { useEffect, useEffectEvent, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { stageAnnouncement } from './stageAnnouncement';

/**
 * How long a stopped state must hold before it is spoken: a step while running, or a frame still
 * in flight from the worker when the pause lands, moves the time once more just after.
 */
const SETTLE_MS = 150;

/**
 * Screen-reader-only live line of the stage; changes only with play / pause / step / end / replay.
 * While running, the time is not part of the state, so this line never follows the clock. A pause
 * or a step is spoken once, with the time it settles on.
 */
export function StageAnnouncer({ title }: { title: string }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const playing = useWorkspaceStore((s) => s.playing);
  // Stopped, the time is state: a step changes it, and the pause settles on its final value.
  const stoppedTime = useWorkspaceStore((s) => (s.playing ? null : s.simTime));
  const { finished, replay, intervened } = useSimStore(
    useShallow((s) => ({
      finished: s.finished,
      replay: s.scrubTime !== null,
      intervened: s.intervened,
    })),
  );
  const key = [
    title,
    playing,
    finished,
    replay,
    intervened,
    locale,
    replay ? '' : stoppedTime,
  ].join('|');
  const [said, setSaid] = useState({ key: '', message: '' });
  const settling = !playing && !finished && !replay;
  const say = () => {
    const time = replay
      ? (useSimStore.getState().scrubTime ?? 0)
      : (stoppedTime ?? useWorkspaceStore.getState().simTime);
    const status = { title, playing, finished, replay, intervened, time };
    setSaid({ key, message: stageAnnouncement(status, t, locale) });
  };
  if (said.key !== key && !settling) say();
  const sayLater = useEffectEvent(say);
  const pending = settling && said.key !== key;
  useEffect(() => {
    if (!pending) return;
    // Every new stopped key restarts the wait, so close writes become one line.
    const id = window.setTimeout(sayLater, SETTLE_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [pending, key]);
  return (
    <p className="sr-only" aria-live="polite">
      {said.message}
    </p>
  );
}
