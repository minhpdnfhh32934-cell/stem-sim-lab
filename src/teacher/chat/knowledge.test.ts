import { describe, expect, it } from 'vitest';
import { builtinKnowledge, builtinPendingCount } from './knowledge';

describe('built-in knowledge notes (scientific content, docs/DATA_REVIEW.md #14)', () => {
  it('has 66 notes with unique ids in both languages', () => {
    const vi = builtinKnowledge('vi');
    const en = builtinKnowledge('en');
    expect(vi).toHaveLength(66);
    expect(en).toHaveLength(66);
    expect(new Set(vi.map((n) => n.id)).size).toBe(66);
  });

  it('every note waits for a teacher and says so wherever it is used', () => {
    // Nothing may be shown as checked before a teacher has reviewed it.
    expect(builtinPendingCount()).toBe(66);
    for (const note of builtinKnowledge('vi')) {
      expect(note.text).toContain('chưa được giáo viên duyệt');
    }
    for (const note of builtinKnowledge('en')) {
      expect(note.text).toContain('not yet reviewed by a teacher');
    }
  });
});
