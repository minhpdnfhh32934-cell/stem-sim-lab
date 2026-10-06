import { useEffect, useRef } from 'react';
import { useT } from '@/app/i18n';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { toast } from '@/ui/toast';
import { BreakTimer } from './breakReminder';

const CHECK_MS = 30_000;

/** Shows "Bạn đã học khoảng 45 phút liên tục…" once per 45 minutes of continuous use. */
export function useBreakReminder(): void {
  const t = useT();
  // The timer must survive re-renders (and language changes): keep `t` in a ref.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    const timer = new BreakTimer();
    const remind = () => {
      toast(tRef.current('learn.breakReminder'), 'info', 20_000);
    };
    let lastSeen = 0;
    const onActivity = () => {
      const now = Date.now();
      // Pointer moves fire often: one activity per second is enough.
      if (now - lastSeen < 1000) return;
      lastSeen = now;
      if (timer.activity(now)) remind();
    };
    const tick = () => {
      const now = Date.now();
      const watching =
        document.visibilityState === 'visible' && useWorkspaceStore.getState().playing;
      if (watching ? timer.activity(now) : timer.check(now)) remind();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    const id = window.setInterval(tick, CHECK_MS);
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
      window.clearInterval(id);
    };
  }, []);
}
