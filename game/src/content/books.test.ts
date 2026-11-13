import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BookSchema, BOOK_IDS } from './books';

// Every book on the laptop: its shape, its lessons numbered in order, its labs real experiments.
const dir = new URL('./books/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const experiments = new Set(
  readdirSync(new URL('./experiments/', import.meta.url)).map((f) => f.replace('.json', '')),
);

describe('the laptop’s books', () => {
  it.each(files)('%s fits the book shape, ids in order, labs real', (file) => {
    const book = BookSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    expect(`${book.id}.json`).toBe(file);
    expect(BOOK_IDS).toContain(book.id);
    const lessons = book.chapters.flatMap((c) => c.lessons);
    lessons.forEach((lesson, i) => {
      expect(lesson.id).toBe(`${book.id}-${String(i + 1).padStart(2, '0')}`);
      if (lesson.lab) expect(experiments.has(lesson.lab), lesson.lab).toBe(true);
    });
  });
});
