import { describe, expect, it } from 'vitest';
import raw from '@data/curriculum_kntt.json';
import { loadScene } from '../registry';
import { VL10_LESSONS, sgk10 } from './sources';

interface Lesson {
  number: number;
  title: string;
  page: number;
}
const book = raw.books.find((b) => b.id === 'VL10');
const toc: Lesson[] = (book?.chapters ?? []).flatMap((c) => c.lessons as Lesson[]);
const placements = raw.items.filter((i) => i.book === 'VL10');

describe('Vật lí 10 KNTT lessons cited by the Science Cards (user rule 15/11/2026)', () => {
  it('titles and pages follow the table of contents', () => {
    for (const [key, [title, from, to]] of Object.entries(VL10_LESSONS)) {
      const n = Number(key);
      const lesson = toc.find((l) => l.number === n);
      expect(lesson, `Bài ${key}`).toBeDefined();
      expect(title, `Bài ${key}`).toBe(lesson?.title);
      expect(from, `Bài ${key}`).toBe(lesson?.page);
      const next = toc.find((l) => l.number === n + 1);
      // The last lesson of the book has no next one: its last page was read in the e-book.
      if (next) expect(to, `Bài ${key}`).toBe(next.page - 1);
      else expect(to, `Bài ${key}`).toBeGreaterThanOrEqual(from);
    }
  });

  it('every VL10 placement cites each of its lessons, with pages', async () => {
    const cited = new Set<number>();
    for (const item of placements) {
      const scene = await loadScene(item.topic);
      const p = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
      const ids = scene.scienceCard(p).sources.map((s) => s.id);
      for (const n of item.lessons) {
        expect(ids, `${item.topic} → Bài ${String(n)}`).toContain(sgk10(n).id);
        cited.add(n);
      }
    }
    // No lesson in the table without a lesson placed on it.
    expect([...cited].sort((a, b) => a - b)).toEqual(
      Object.keys(VL10_LESSONS)
        .map(Number)
        .sort((a, b) => a - b),
    );
  });

  it('a citation names the book, the lesson and its pages', () => {
    expect(sgk10(34).citation).toBe(
      'Sách giáo khoa Vật lí 10, bộ Kết nối tri thức với cuộc sống, NXB Giáo dục Việt Nam — Bài 34 “Khối lượng riêng. Áp suất chất lỏng”, tr. 131–135',
    );
    expect(() => sgk10(6)).toThrow();
  });
});
