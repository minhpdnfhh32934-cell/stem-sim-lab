import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useLayoutStore } from './layoutStore';

async function setFullscreen(on: boolean): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(on);
    return;
  }
  if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
  if (!on && document.fullscreenElement) await document.exitFullscreen();
}

/**
 * Presentation mode is full screen (MASTER_PROMPT §7.2). Leaving full screen from outside
 * (Esc handled by the browser) also leaves presentation mode.
 */
export function usePresentationFullscreen(): void {
  const presentation = useLayoutStore((s) => s.presentation);

  useEffect(() => {
    setFullscreen(presentation).catch(() => {
      // Full screen can be refused (no user gesture, embedded view): the layout still works.
    });
  }, [presentation]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && useLayoutStore.getState().presentation && !isTauri()) {
        useLayoutStore.getState().setPresentation(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);
}
