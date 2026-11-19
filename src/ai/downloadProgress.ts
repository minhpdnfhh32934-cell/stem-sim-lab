/** One progress event of Transformers.js (`progress_callback`). */
export interface ProgressInfo {
  status?: string;
  name?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

/**
 * The model's download as one number: the sum over its files. A file's `done` event may come
 * without its size: it keeps the size its `progress` events gave, so a finished file never drops
 * out of the total (machine B's E2B download 19/11/2026: 3.93 GB became 1.86 GB at 98 %).
 * `expected` (the model's known size) is the least total: small files finish before the large
 * ones are counted, and the bar flashed 99 % then fell back to 0 % (machine B, E2B from OPFS).
 * Returns null for an event that changes nothing.
 */
export function downloadTotals(
  expected = 0,
): (info: ProgressInfo) => { loaded: number; total: number | null } | null {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info) => {
    const file = info.file ?? info.name ?? '';
    if (!file) return null;
    const known = files.get(file)?.total ?? 0;
    if (info.status === 'progress') {
      files.set(file, { loaded: info.loaded ?? 0, total: info.total ?? known });
    } else if (info.status === 'done') {
      const size = info.total ?? known;
      files.set(file, { loaded: size, total: size });
    } else {
      return null;
    }
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    total = Math.max(total, expected);
    return { loaded, total: total > 0 ? total : null };
  };
}
