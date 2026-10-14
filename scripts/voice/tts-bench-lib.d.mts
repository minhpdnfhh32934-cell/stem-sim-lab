/** What a mode asks the voice to say (`modeJobs`). */
export interface BenchJob<C> {
  text: string;
  /** A pause the player waits after it (the legacy timer pause; 0 when it is in the audio). */
  pauseAfterMs: number;
  /** The plan's chunk (natural mode). */
  chunk?: C;
}

export const LEGACY_COMMA_PAUSE_MS: number;

export function modeJobs<C extends { text: string }>(
  mode: 'legacy' | 'natural',
  plan: { text: string; chunks: readonly C[] },
  split: (spoken: string) => { text: string; pauseMs: number }[],
): BenchJob<C>[];

/** One rendered chunk as the benchmark page measured it. */
export interface BenchChunk {
  text: string;
  /** Time to render it (synthesis, plus shaping in the natural mode). */
  synthMs: number;
  /** Length of its audio buffer (with any pause embedded in it). */
  durationMs: number;
  /** A pause the player waits after it (the legacy timer pause; 0 when embedded). */
  pauseAfterMs: number;
  /** The planned pause inside the buffer (natural mode); recorded only (rtf uses voiced time). */
  embeddedPauseMs: number;
  leadMs: number;
  tailMs: number;
  rmsDb: number;
}

export interface Timeline {
  firstAudioMs: number;
  firstSoundMs: number;
  totalSynthMs: number;
  wallMs: number;
  /** When each chunk starts playing (ms from the request). */
  starts: number[];
  /** Time spent waiting for a chunk still rendering, beyond the planned pauses. */
  stallMs: number;
  gaps: number[];
  maxGapMs: number;
  gapsOverLong: number;
}

export const LONG_GAP_MS: number;

export function simulateTimeline(
  chunks: Pick<BenchChunk, 'synthMs' | 'durationMs' | 'pauseAfterMs' | 'leadMs' | 'tailMs'>[],
): Timeline;

export function heardAudio(
  parts: Float32Array[],
  starts: number[],
  sampleRate: number,
): Float32Array;

export interface BenchLayout {
  /** The folder given to listeners: the sheet and the blind recordings only. */
  listen: string;
  sheet: string;
  blind: string;
  byMode: string;
  keyDir: string;
  key: string;
  results: string;
}
export function benchLayout(out: string): BenchLayout;

export function wordsOf(text: string): string[];
export function syllableCount(text: string): number;

export interface WordIntegrity {
  preparedWords: number;
  saidWords: number;
  missing: number;
  extra: number;
  reordered: number;
  ok: boolean;
}
export function wordIntegrity(prepared: string, chunkTexts: string[]): WordIntegrity;

export function rmsSpreadDb(chunkDbs: number[]): number;

export interface ItemMetrics {
  chunks: number;
  firstAudioMs: number;
  firstSoundMs: number;
  totalSynthMs: number;
  rtf: number;
  voicedSeconds: number;
  audioSeconds: number;
  heardSeconds: number;
  stallMs: number;
  syllablesPerSecond: number;
  rmsSpreadDb: number;
  peak: number;
  maxGapMs: number;
  gapsOver600: number;
  clippingShare: number;
  nan: boolean;
  missingWords: number;
  extraWords: number;
  reorderedWords: number;
}

export function itemMetrics(input: {
  prepared: string;
  chunks: BenchChunk[];
  audioMs: number;
  peak: number;
  clippingShare: number;
  nan: boolean;
}): ItemMetrics;

export interface ModeSummary {
  items: number;
  failed: number;
  withNaN: number;
  withWordProblems: number;
  median: Record<string, number | null>;
}
export function summarize(
  rows: Record<string, unknown>[],
  modes: string[],
): Record<string, ModeSummary>;

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array;
export function floatsFromBase64(b64: string): Float32Array;

export function abKey(
  ids: string[],
  modes: [string, string],
  seed: number,
): Record<string, { A: string; B: string }>;

export function listeningSheet(items: { id: string; text: string }[], audioDir?: string): string;

export interface ProcessRow {
  pid: number;
  ppid: number;
  cpuMs: number;
  rssBytes: number;
  root: boolean;
}
export function parseSamplerLine(line: string): ProcessRow[] | null;
export function parsePs(text: string, profile: string): ProcessRow[];
export function processTree(rows: ProcessRow[]): ProcessRow[];

export interface TreeUsage {
  add(rows: ProcessRow[], at: number): void;
  now(): { at: number; cpuMs: number; rssBytes: number; processes: number };
  between(from: number, to: number): { cpuMs: number; peakRssBytes: number; samples: number };
}
export function treeUsage(): TreeUsage;

export function powershellSampler(profile: string, intervalMs: number): string;
