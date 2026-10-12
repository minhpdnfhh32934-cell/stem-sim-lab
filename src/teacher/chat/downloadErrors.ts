import type { MessageKey } from '@/app/i18n';

/** Turns raw engine/network errors into a sentence a learner can act on. */
export function downloadErrorKey(message: string): MessageKey | null {
  const m = message.toLowerCase();
  if (m === 'cancelled') return 'chatSettings.downloadCancelled';
  if (m.includes('webgpu')) return 'chatSettings.webgpuRequired';
  if (m.includes('quota') || m.includes('storage') || m.includes('disk'))
    return 'chatSettings.downloadNoSpace';
  if (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('load failed') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
    return 'chatSettings.downloadNetwork';
  if (m.includes('worker-crashed') || m.includes('memory') || m.includes('device'))
    return 'chatSettings.downloadMemory';
  return null;
}
