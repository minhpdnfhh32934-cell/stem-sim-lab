/*
 * Mappings from a model value to what an instrument piece draws, shared by every subject's 2D
 * workspace (balance, timer, water bath…): pure numbers and text, no DOM, no three.js. Drawings of
 * the model's values, never measurements: NaN (no run) always maps to the idle look.
 */

/** A clock reading: `mm:ss` (`h:mm:ss` from an hour on); a dash for no time. */
export function clockText(seconds: number): string {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) return '—';
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Where `value` lies between `min` and `max`, 0–1 (0 for NaN or an empty range). */
export function fraction(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !(max > min)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

const COOL = [0x5b, 0x9f, 0xd0] as const;
const WARM = [0xe0, 0x8a, 0x3c] as const;
const hex2 = (n: number) => (n < 16 ? '0' : '') + n.toString(16);

/** A bath's water tint from cool (t = 0) to warm (t = 1), as `#rrggbb`. */
export function thermalTint(t: number): string {
  const k = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const mix = (i: 0 | 1 | 2) => Math.round(COOL[i] + (WARM[i] - COOL[i]) * k);
  return `#${hex2(mix(0))}${hex2(mix(1))}${hex2(mix(2))}`;
}
