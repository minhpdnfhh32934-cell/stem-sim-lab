import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/app/catalog';
import { SUBJECTS } from '@/app/workspaceStore';
import { CURRICULUM, GRADES, gradeView, lessonRange, type Curriculum } from './curriculum';

const catalogIds = (subject: (typeof SUBJECTS)[number]) =>
  CATALOG[subject].flatMap((c) => c.topics.map((t) => t.id));

describe('KNTT curriculum data (generated, pending a teacher)', () => {
  it('is pending review as a whole and item by item, with its source', () => {
    expect(CURRICULUM.review_status).toBe('pending');
    expect(CURRICULUM.generated_by).toBe('scripts/data/gen_curriculum_kntt.py');
    expect(CURRICULUM.source.url).toMatch(/^https:\/\/taphuan\.nxbgd\.vn\//);
    for (const p of [...CURRICULUM.items, ...CURRICULUM.unplaced])
      expect(p.review_status, p.topic).toBe('pending');
  });

  it('has the nine books, one per subject and grade, numbered 1…N without gaps', () => {
    expect(CURRICULUM.books).toHaveLength(9);
    for (const subject of SUBJECTS)
      for (const grade of GRADES)
        expect(
          CURRICULUM.books.filter((b) => b.subject === subject && b.grade === grade),
          `${subject} ${grade}`,
        ).toHaveLength(1);
    for (const book of CURRICULUM.books) {
      expect(book.url, book.id).toMatch(/^https:\/\/taphuan\.nxbgd\.vn\/tap-huan\/doc-sach\//);
      const numbers = book.chapters.flatMap((c) => c.lessons.map((l) => l.number));
      const numbered = numbers.filter((n): n is number => n !== null);
      expect(numbered, book.id).toEqual(numbered.map((_, i) => i + 1));
      expect(book.counts.total, book.id).toBe(numbered.length);
      const theory = book.chapters.flatMap((c) => c.lessons).filter((l) => l.kind === 'theory');
      expect(book.counts.theory, book.id).toBe(theory.length);
    }
  });

  it('places only real topics, in the right subject and grade, on lessons that exist', () => {
    for (const p of CURRICULUM.items) {
      expect(catalogIds(p.subject), p.topic).toContain(p.topic);
      const book = CURRICULUM.books.find((b) => b.id === p.book);
      expect(book, p.topic).toBeDefined();
      expect(book?.subject).toBe(p.subject);
      expect(book?.grade).toBe(p.grade);
      const chapter = book?.chapters.find((c) => c.label === p.chapter);
      expect(chapter, `${p.topic}: ${p.chapter}`).toBeDefined();
      const inChapter = chapter?.lessons.map((l) => l.number) ?? [];
      for (const n of p.lessons) expect(inChapter, `${p.topic}: Bài ${n}`).toContain(n);
    }
  });

  it('every catalog topic is placed or left unplaced with a reason (forgetting one fails)', () => {
    for (const subject of SUBJECTS)
      for (const id of catalogIds(subject)) {
        const placed = CURRICULUM.items.some((p) => p.topic === id);
        const unplaced = CURRICULUM.unplaced.filter((u) => u.topic === id);
        expect(placed || unplaced.length === 1, `${subject}/${id}`).toBe(true);
        expect(placed && unplaced.length > 0, `${id} both placed and unplaced`).toBe(false);
      }
    for (const u of CURRICULUM.unplaced) expect(catalogIds(u.subject), u.topic).toContain(u.topic);
  });
});

describe('gradeView', () => {
  const data: Curriculum = {
    ...CURRICULUM,
    books: [
      {
        id: 'T10',
        subject: 'physics',
        grade: 10,
        title: 'Test 10',
        url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/t10',
        tocPages: [4],
        chapters: [
          {
            label: 'Chương I. A',
            printed: 'CHƯƠNG I. A',
            lessons: [
              { number: 1, title: 'a', page: 5, kind: 'theory' },
              { number: 2, title: 'b', page: 6, kind: 'theory' },
            ],
          },
          {
            label: 'Chương II. B',
            printed: 'CHƯƠNG II. B',
            lessons: [{ number: 3, title: 'c', page: 7, kind: 'theory' }],
          },
          {
            label: 'Chương III. C',
            printed: 'CHƯƠNG III. C',
            lessons: [{ number: 4, title: 'd', page: 8, kind: 'theory' }],
          },
        ],
        counts: { total: 4, theory: 4 },
      },
      {
        id: 'T11',
        subject: 'physics',
        grade: 11,
        title: 'Test 11',
        url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/t11',
        tocPages: [4],
        chapters: [
          {
            label: 'Chương I. D',
            printed: 'CHƯƠNG I. D',
            lessons: [{ number: 1, title: 'e', page: 5, kind: 'theory' }],
          },
        ],
        counts: { total: 1, theory: 1 },
      },
    ],
    items: [
      { topic: 'z', subject: 'physics', grade: 10, book: 'T10', chapter: 'Chương III. C', lessons: [4], reason: 'r', review_status: 'pending' },
      { topic: 'y', subject: 'physics', grade: 10, book: 'T10', chapter: 'Chương I. A', lessons: [2], reason: 'r', review_status: 'pending' },
      { topic: 'x', subject: 'physics', grade: 10, book: 'T10', chapter: 'Chương I. A', lessons: [1, 2], reason: 'r', review_status: 'pending' },
      { topic: 'x', subject: 'physics', grade: 11, book: 'T11', chapter: 'Chương I. D', lessons: [1], reason: 'r', review_status: 'pending' },
    ],
  };

  it('follows the book: chapter order, then topics by first lesson; empty chapters are left out', () => {
    expect(gradeView(10, 'physics', data)).toEqual([
      {
        label: 'Chương I. A',
        topics: [
          { topic: 'x', lessons: [1, 2] },
          { topic: 'y', lessons: [2] },
        ],
      },
      { label: 'Chương III. C', topics: [{ topic: 'z', lessons: [4] }] },
    ]);
  });

  it('shows a topic placed in two grades in both, and nothing for a grade without topics', () => {
    expect(gradeView(11, 'physics', data)).toEqual([
      { label: 'Chương I. D', topics: [{ topic: 'x', lessons: [1] }] },
    ]);
    expect(gradeView(12, 'physics', data)).toEqual([]);
    expect(gradeView(10, 'biology', data)).toEqual([]);
  });

  it('works on the real data: every placed topic shows up in its grade', () => {
    for (const p of CURRICULUM.items)
      expect(
        gradeView(p.grade, p.subject).some((c) => c.topics.some((t) => t.topic === p.topic)),
        p.topic,
      ).toBe(true);
  });
});

describe('lessonRange', () => {
  it('writes consecutive lessons as a range', () => {
    expect(lessonRange([31, 32])).toBe('31–32');
    expect(lessonRange([4, 5, 7])).toBe('4–5, 7');
    expect(lessonRange([18, 14, 15, 16])).toBe('14–16, 18');
    expect(lessonRange([10])).toBe('10');
    expect(lessonRange([3, 3, 1])).toBe('1, 3');
  });
});
