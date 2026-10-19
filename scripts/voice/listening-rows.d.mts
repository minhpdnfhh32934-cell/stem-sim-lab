/** One sentence of src/teacher/voice/pronounceGolden.json. */
export interface ListeningItem {
  id: string;
  text: string;
  reading: string;
  pending?: true;
}

/** What the page measured for one synthesised sentence (the WAV is written separately). */
export interface ListeningMetrics {
  spoken: string;
  sampleRate: number;
  seconds: number;
  synthMs: number;
  rms: number;
  peak: number;
  clippedShare: number;
  leadMs: number;
  tailMs: number;
  syllablesPerSecond: number;
  nan: boolean;
}

export type ListeningRow<T extends ListeningItem = ListeningItem> =
  | (T & ListeningMetrics & { checks: Record<string, boolean> })
  | (T & { error: string; checks: { synthesized: false } });

export function rowChecks(metrics: ListeningMetrics, item: ListeningItem): Record<string, boolean>;

export function collectRows<T extends ListeningItem>(
  items: T[],
  measure: (item: T) => Promise<ListeningMetrics>,
  onRow?: (row: ListeningRow<T>, rows: ListeningRow<T>[]) => unknown,
): Promise<ListeningRow<T>[]>;

export function failedChecks(row: { checks: Record<string, boolean> }): string[];
