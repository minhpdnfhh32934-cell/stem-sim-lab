import { z } from 'zod';
import { ExtractionSchema, type Extraction } from './spec';

/**
 * Cache of CONFIRMED problem readings (PROMPT_PHAN_2 A2: "Cache kết quả đọc đề đã xác nhận
 * để không gọi lại API cho cùng một đề"). Only readings the user confirmed in the table are
 * stored, and only the AI's raw reading (topic + quoted quantities): when the same problem
 * is analysed again, the code checks (numbers present in the text, units, ranges) run again
 * and the confirmation table is shown again. Stored on this computer only (localStorage).
 */

export const READING_CACHE_KEY = 'stemsim.aiReadings';
export const READING_CACHE_MAX = 100;
/** Bump when prompts/schemas change in a way that makes old readings unusable. */
const CACHE_VERSION = 1;

export interface Reading {
  topic: string;
  unsupported_parts: string[];
  extraction: Extraction;
  /** Model that produced the reading. */
  model: string;
}

const ReadingSchema = z.object({
  topic: z.string(),
  unsupported_parts: z.array(z.string()),
  extraction: ExtractionSchema,
  model: z.string(),
});

const FileSchema = z.object({
  v: z.literal(CACHE_VERSION),
  /** Oldest first. */
  entries: z.array(z.tuple([z.string(), ReadingSchema])),
});

/** Same problem ⇔ same text up to spacing and Unicode normalization. */
export function normalizeProblem(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function load(): [string, Reading][] {
  try {
    const raw = localStorage.getItem(READING_CACHE_KEY);
    if (!raw) return [];
    const parsed = FileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.entries : [];
  } catch {
    return [];
  }
}

function save(entries: [string, Reading][]): void {
  try {
    localStorage.setItem(READING_CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, entries }));
  } catch {
    // Storage full or unavailable: the cache is only an optimization.
  }
}

export function getReading(problem: string): Reading | null {
  const key = normalizeProblem(problem);
  return load().find(([k]) => k === key)?.[1] ?? null;
}

/** Stores a confirmed reading (most recent last; the oldest are dropped beyond the limit). */
export function putReading(problem: string, reading: Reading): void {
  const key = normalizeProblem(problem);
  if (!key) return;
  const entries = load().filter(([k]) => k !== key);
  entries.push([key, reading]);
  save(entries.slice(-READING_CACHE_MAX));
}

export function readingCount(): number {
  return load().length;
}

export function forgetReading(problem: string): void {
  const key = normalizeProblem(problem);
  save(load().filter(([k]) => k !== key));
}

export function clearReadings(): void {
  try {
    localStorage.removeItem(READING_CACHE_KEY);
  } catch {
    // ignore
  }
}
