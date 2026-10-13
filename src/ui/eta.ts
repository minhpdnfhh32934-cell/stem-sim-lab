import type { useT } from '@/app/i18n';

type Translate = ReturnType<typeof useT>;

/** One reading of a download: time (ms) and bytes received so far. */
export interface EtaSample {
  t: number;
  loaded: number;
}

/** Only the last few seconds count, so a slow start or a pause does not skew the estimate. */
export const ETA_WINDOW_MS = 8000;
/** Below this much history the speed is too noisy to promise anything. */
export const ETA_MIN_SPAN_MS = 2000;

/**
 * Seconds left at the recent average speed, or null while there is too little data (or no total,
 * or no progress). Shown as "about …": it is an estimate, never a promise.
 */
export function etaSeconds(samples: readonly EtaSample[], total: number | null): number | null {
  const last = samples.at(-1);
  if (!last || total === null || total <= 0 || last.loaded >= total) return null;
  const first = samples.find((s) => last.t - s.t <= ETA_WINDOW_MS);
  if (!first) return null;
  const span = last.t - first.t;
  const bytes = last.loaded - first.loaded;
  if (span < ETA_MIN_SPAN_MS || bytes <= 0) return null;
  return (total - last.loaded) / (bytes / (span / 1000));
}

/** Rounded for reading: 5-second steps under a minute, whole minutes above. */
export function roundEta(seconds: number): { unit: 'seconds' | 'minutes'; n: number } {
  if (seconds < 55) return { unit: 'seconds', n: Math.max(5, Math.ceil(seconds / 5) * 5) };
  return { unit: 'minutes', n: Math.max(1, Math.round(seconds / 60)) };
}

/**
 * One tracker per download: call it from the progress callback (not during render) with the bytes
 * so far; it remembers the recent samples and returns the seconds left, or null.
 */
export function createEtaTracker(now: () => number = Date.now) {
  const samples: EtaSample[] = [];
  return (loaded: number, total: number | null): number | null => {
    const t = now();
    const last = samples.at(-1);
    if (!last || loaded !== last.loaded) samples.push({ t, loaded });
    while (samples.length > 2 && t - (samples[0]?.t ?? t) > ETA_WINDOW_MS * 2) samples.shift();
    return etaSeconds(samples, total);
  };
}

/** "còn khoảng 3 phút" (an estimate, so always "about"). */
export function formatEta(t: Translate, seconds: number): string {
  const { unit, n } = roundEta(seconds);
  return t(unit === 'seconds' ? 'progress.etaSeconds' : 'progress.etaMinutes', { n: String(n) });
}
