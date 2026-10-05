import { describe, expect, it } from 'vitest';
import {
  READING_CACHE_KEY,
  READING_CACHE_MAX,
  clearReadings,
  forgetReading,
  getReading,
  normalizeProblem,
  putReading,
  readingCount,
  type Reading,
} from './cache';

const reading = (topic = 'freeFall'): Reading => ({
  topic,
  unsupported_parts: [],
  extraction: {
    quantities: [{ key: 'h0', value: 20, unit: 'm', quote: '20 m' }],
    questions: [],
    assumptions: [],
    unsupported_parts: [],
    clarifications: [],
  },
  model: 'm',
});

describe('cache of confirmed readings', () => {
  it('finds the same problem up to spacing', () => {
    putReading('Một vật rơi  tự do\ntừ 20 m.', reading());
    expect(getReading('  Một vật rơi tự do từ 20 m. ')?.topic).toBe('freeFall');
    expect(getReading('Một vật rơi tự do từ 30 m.')).toBeNull();
    expect(normalizeProblem(' a \n b ')).toBe('a b');
  });

  it('keeps the most recent entries only', () => {
    for (let i = 0; i < READING_CACHE_MAX + 5; i++) putReading(`đề ${i}`, reading());
    expect(readingCount()).toBe(READING_CACHE_MAX);
    expect(getReading('đề 0')).toBeNull();
    expect(getReading(`đề ${READING_CACHE_MAX + 4}`)).not.toBeNull();
    // Re-confirming moves an entry to the end instead of duplicating it.
    putReading('đề 10', reading('incline'));
    expect(readingCount()).toBe(READING_CACHE_MAX);
    expect(getReading('đề 10')?.topic).toBe('incline');
  });

  it('forgets and clears, and ignores damaged storage', () => {
    putReading('a', reading());
    forgetReading('a');
    expect(getReading('a')).toBeNull();
    putReading('b', reading());
    clearReadings();
    expect(readingCount()).toBe(0);
    localStorage.setItem(READING_CACHE_KEY, '{broken');
    expect(getReading('b')).toBeNull();
    localStorage.setItem(READING_CACHE_KEY, JSON.stringify({ v: 1, entries: [['b', { x: 1 }]] }));
    expect(getReading('b')).toBeNull();
  });
});
