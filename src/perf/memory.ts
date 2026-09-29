/**
 * Memory watchdog (MASTER_PROMPT §5): watches the JS heap and, near the limit, releases
 * caches and warns the user. The heap size is available in Chromium-based webviews
 * (WebView2 on Windows); elsewhere the watchdog stays idle.
 */

export interface MemorySample {
  usedMB: number;
  /** Heap limit reported by the engine (MB), when known. */
  limitMB: number | null;
}

interface ChromiumMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function readMemory(): MemorySample | null {
  const m = (performance as Performance & { memory?: ChromiumMemory }).memory;
  if (!m || !(m.usedJSHeapSize > 0)) return null;
  return {
    usedMB: m.usedJSHeapSize / 2 ** 20,
    limitMB: m.jsHeapSizeLimit > 0 ? m.jsHeapSizeLimit / 2 ** 20 : null,
  };
}

/** App RAM budget without the LLM (MASTER_PROMPT §4.2); the JS heap is only part of it. */
export const RAM_BUDGET_MB = 300;
/** Warn when the JS heap alone passes this share of the budget, or of the heap limit. */
export const HIGH_FRACTION = 0.8;
/** Re-arm after the heap falls back below this share of the threshold. */
export const REARM_FRACTION = 0.8;

export function thresholdMB(s: MemorySample): number {
  const byBudget = RAM_BUDGET_MB * HIGH_FRACTION;
  return s.limitMB === null ? byBudget : Math.min(byBudget, s.limitMB * HIGH_FRACTION);
}

/** Hysteresis: fires once when crossing the threshold, again only after recovering. */
export class MemoryWatchdog {
  private armed = true;

  check(s: MemorySample): 'high' | 'ok' {
    const limit = thresholdMB(s);
    if (this.armed && s.usedMB >= limit) {
      this.armed = false;
      return 'high';
    }
    if (!this.armed && s.usedMB < limit * REARM_FRACTION) this.armed = true;
    return 'ok';
  }
}

const releasers = new Set<() => void>();

/** Registers a function that frees a cache; returns an unregister function. */
export function registerCacheRelease(fn: () => void): () => void {
  releasers.add(fn);
  return () => releasers.delete(fn);
}

export function releaseCaches(): number {
  let n = 0;
  for (const fn of releasers) {
    try {
      fn();
      n++;
    } catch (e) {
      console.error('cache release failed', e);
    }
  }
  return n;
}
