import { useEffect } from 'react';
import { useAiStatusPolling } from '@/app/ai/useAiStatus';
import { initHistory } from '@/app/project/history';
import { initUndo } from '@/app/project/undo';
import { useGlobalShortcuts } from '@/app/shortcuts/useGlobalShortcuts';
import { scheduleAutoCheck } from '@/app/update/updater';
import { useWhatsNewStartup } from '@/app/whatsnew/whatsNewStore';
import { useBreakReminder } from '@/learn/useBreakReminder';
import { useMemoryWatchdog } from '@/perf/useMemoryWatchdog';
import { installSlidingIndicators } from '@/ui/slidingIndicator';
import { loadGpuStatus } from '@/ai/gpu';
import { usePresentationFullscreen } from './usePresentationFullscreen';

/** Shortcuts, AI status, watchdogs, undo/history and update checks: one set for either shell. */
export function useShellServices(): void {
  useGlobalShortcuts();
  useAiStatusPolling();
  useMemoryWatchdog();
  usePresentationFullscreen();
  useBreakReminder();
  // "Có gì mới" after an update; it waits for the launch page or the lab home.
  useWhatsNewStartup();
  useEffect(() => {
    const offUndo = initUndo();
    const offHistory = initHistory();
    const offUpdate = scheduleAutoCheck();
    const offIndicators = installSlidingIndicators();
    // Desktop: which cards exist decides how short Gemma's prompt must be (audit GPU-01), so it
    // is known before the first question, not only after Settings → GPU was opened.
    void loadGpuStatus().catch(() => null);
    return () => {
      offUndo();
      offHistory();
      offUpdate();
      offIndicators();
    };
  }, []);
}
