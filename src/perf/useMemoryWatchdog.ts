import { useEffect } from 'react';
import { translate } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { toast } from '@/ui/toast';
import { MemoryWatchdog, readMemory, releaseCaches } from './memory';
import { usePerfStore } from './perfStore';

const POLL_MS = 10_000;

/** Polls the heap; near the limit it frees caches and tells the user once. */
export function useMemoryWatchdog(): void {
  useEffect(() => {
    if (!readMemory()) return;
    const dog = new MemoryWatchdog();
    const tick = () => {
      const s = readMemory();
      if (!s) return;
      usePerfStore.setState({ memoryMB: Math.round(s.usedMB) });
      if (dog.check(s) === 'high') {
        releaseCaches();
        const locale = useSettingsStore.getState().locale;
        toast(translate(locale, 'perf.memoryHigh', { mb: Math.round(s.usedMB) }), 'warn');
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);
}
