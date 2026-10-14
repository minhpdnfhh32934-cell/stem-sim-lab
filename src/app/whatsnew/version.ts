/**
 * Version numbers of SimLab (`major.minor.patch`, numbers only — the web part's package.json
 * version, which is what `__APP_VERSION__` reports). Compared numerically: 0.10.0 > 0.9.0.
 */
export type VersionTriple = readonly [number, number, number];

const PATTERN = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;

/** The three numbers of a version, or null for anything that is not `x.y.z`. */
export function parseVersion(value: unknown): VersionTriple | null {
  if (typeof value !== 'string') return null;
  const m = PATTERN.exec(value);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export const isVersion = (value: unknown): value is string => parseVersion(value) !== null;

/**
 * Negative when `a` is older than `b`, 0 when equal, positive when newer. Throws on a value that
 * is not a version: callers check with `isVersion` first (stored data can be anything).
 */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`not a version: ${!x ? a : b}`);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
