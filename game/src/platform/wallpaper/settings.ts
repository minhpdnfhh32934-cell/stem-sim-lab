/*
 * The wallpaper's settings (Phase W, Phú 2026-11-17: "nút chỉnh sáng, chiều và tối"): brightness,
 * the time of day (the seven-minute day, or held at afternoon, sunset or night), the frame rate
 * and the quality. Lively shows them in its Customise panel (LivelyProperties.json, written by
 * `scripts/wallpaper-pack.mjs` with these names) and calls `livelyPropertyListener` with each.
 * Pure (tested).
 */

export type TimeMode = 'auto' | 'afternoon' | 'sunset' | 'night';
export type Quality = 'high' | 'low';

export interface Settings {
  /** A multiplier on the exposure (0.5–1.5). */
  brightness: number;
  time: TimeMode;
  /** Frames a second; 0 follows the screen. */
  fps: number;
  quality: Quality;
}

export const defaults = (): Settings => ({ brightness: 1, time: 'auto', fps: 60, quality: 'high' });

/** Where in the day each held time is (s into the loop, `cycle.ts`). */
export const TIME_AT: Readonly<Record<Exclude<TimeMode, 'auto'>, number>> = {
  afternoon: 100,
  sunset: 186,
  night: 300,
};

/** The dropdowns' items, in order (the index is what Lively sends). */
export const TIME_ITEMS: readonly TimeMode[] = ['auto', 'afternoon', 'sunset', 'night'];
export const FPS_ITEMS: readonly number[] = [30, 60, 120, 0];
export const QUALITY_ITEMS: readonly Quality[] = ['high', 'low'];

/** Lively's property names (LivelyProperties.json). */
export const PROPERTY = {
  brightness: 'brightness',
  time: 'timeOfDay',
  fps: 'frameRate',
  quality: 'quality',
} as const;

/** Applies one of Lively's properties (a slider's number, a dropdown's index). Unknown: ignored. */
export function applyProperty(s: Settings, name: string, value: unknown): void {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return;
  switch (name) {
    case PROPERTY.brightness:
      s.brightness = Math.min(1.5, Math.max(0.5, n / 100));
      break;
    case PROPERTY.time:
      s.time = TIME_ITEMS[n] ?? s.time;
      break;
    case PROPERTY.fps:
      s.fps = FPS_ITEMS[n] ?? s.fps;
      break;
    case PROPERTY.quality:
      s.quality = QUALITY_ITEMS[n] ?? s.quality;
      break;
  }
}

/** The loop's time to show at `clock` (s): the clock itself, or the held moment. */
export function cycleTime(s: Settings, clock: number): number {
  return s.time === 'auto' ? clock : TIME_AT[s.time];
}

/**
 * Whether to draw a frame `now` (ms) after the last one at `last`, at `fps` (0: every frame the
 * screen gives). A millisecond's slack so a 60 Hz frame on a 60 Hz screen is never skipped.
 */
export function due(now: number, last: number, fps: number): boolean {
  return fps <= 0 || now - last >= 1000 / fps - 1;
}
