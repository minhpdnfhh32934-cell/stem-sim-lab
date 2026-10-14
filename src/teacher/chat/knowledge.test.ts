import { describe, expect, it, vi } from 'vitest';
import heldOut from '../../../tests/teaching/retrieval-heldout.json';
import { useChatStore } from './chatStore';
import {
  bestSentences,
  builtinKnowledge,
  builtinPendingCount,
  excerptBody,
  searchKnowledge,
  unambiguousNote,
} from './knowledge';

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

const ids = (query: string, locale: 'vi' | 'en' = 'vi') =>
  searchKnowledge(query, locale).map((d) => d.id.replace('builtin:', ''));

describe('note retrieval', () => {
  it('finds the right note for the held-out questions and nothing for unrelated ones', () => {
    // A separate set from the evaluation (tests/teaching/teaching-eval.json): retrieval is never
    // tuned on the questions the AI Teacher is graded on.
    const { items } = heldOut as {
      items: { locale: 'vi' | 'en'; q: string; expected: string; alsoOk?: string[] }[];
    };
    const topics = items.filter((it) => it.expected !== 'none');
    const unrelated = items.filter((it) => it.expected === 'none');
    const hits = topics.filter((it) =>
      [it.expected, ...(it.alsoOk ?? [])].includes(ids(it.q, it.locale)[0] ?? ''),
    );
    const silent = unrelated.filter((it) => ids(it.q, it.locale).length === 0);
    expect(topics.length).toBeGreaterThanOrEqual(30);
    // 2026-10-14: 49/49 (old scorer 38/49) and 6/8 (old scorer 0/8: it always injected a note).
    expect(hits.length / topics.length).toBeGreaterThanOrEqual(0.95);
    expect(silent.length).toBeGreaterThanOrEqual(6);
  });

  it('the one note of the on-device prompt: the held-out questions, nothing on a tie', () => {
    const { items } = heldOut as {
      items: { locale: 'vi' | 'en'; q: string; expected: string; alsoOk?: string[] }[];
    };
    const one = (q: string, locale: 'vi' | 'en') =>
      unambiguousNote(q, locale).map((d) => d.id.replace('builtin:', ''));
    const topics = items.filter((it) => it.expected !== 'none');
    const hits = topics.filter((it) =>
      [it.expected, ...(it.alsoOk ?? [])].includes(one(it.q, it.locale)[0] ?? ''),
    );
    const wrong = topics.filter((it) => {
      const id = one(it.q, it.locale)[0];
      return id !== undefined && ![it.expected, ...(it.alsoOk ?? [])].includes(id);
    });
    // 2026-10-14: 48/49 (one long exercise has its two best notes 2 % apart: no note) and no
    // wrong note at all.
    expect(hits.length / topics.length).toBeGreaterThanOrEqual(0.95);
    expect(wrong).toEqual([]);
    // "kì" alone is in the lead of the periodic-table and of the cell-cycle note.
    expect(one('Kì giữa là gì?', 'vi')).toEqual([]);
  });

  it('keeps short meaningful words and drops function words', () => {
    expect(ids('pH là gì?')).toContain('chem-acidbase');
    expect(ids('Phiên mã là gì?')[0]).toBe('bio-genetics');
    // "Tính", "được", "đi" are not a topic: no note at all rather than the reaction-rate one.
    expect(ids('Tính quãng đường ô tô đi được.')).toEqual([]);
  });

  it('reads tone marks and "y"/"i" either way, and questions typed without accents', () => {
    expect(ids('Chu kỳ con lắc lò xo phụ thuộc gì?')[0]).toBe('physics-waves');
    expect(ids('Chu kì con lắc lò xo phụ thuộc gì?')[0]).toBe('physics-waves');
    expect(ids('Phản ứng xà phòng hoá là gì?')[0]).toBe('chem-ester');
    expect(ids('dong luong la gi')[0]).toBe('physics-momentum');
  });

  it('scores syllable pairs and never matches half of a known word elsewhere', () => {
    expect(ids('Lực ma sát là gì?')[0]).toBe('physics-newton');
    expect(ids('Định luật II Newton nói gì?')[0]).toBe('physics-newton');
    // "thời gian" is known to the notes, so its "gian" must not find "không gian" (orbital).
    expect(ids('Đo thời gian rơi của hòn đá')).not.toContain('chem-orbital');
    expect(ids('Hai gen nằm trên cùng một NST di truyền thế nào?')[0]).toBe('bio-linkage');
  });

  it('still searches the files the learner added', () => {
    useChatStore.setState({
      documents: [
        { id: 'doc-1', name: 'Ôn tập quang phổ', text: 'Quang phổ vạch phát xạ.', addedAt: 1 },
      ],
    });
    expect(searchKnowledge('quang phổ vạch', 'vi')[0]?.id).toBe('doc-1');
    useChatStore.setState({ documents: [] });
  });
});

describe('excerpt for the small on-device prompt', () => {
  const motion = builtinKnowledge('vi').find((n) => n.id === 'builtin:physics-motion');

  it('keeps the best-matching sentences, without the source and status lines', () => {
    if (!motion) throw new Error('note missing');
    const text = bestSentences(motion, 'Rơi tự do là gì?');
    expect(text).toContain('Rơi tự do gần mặt đất');
    expect(text).not.toMatch(/Nguồn|Trạng thái/);
    expect(text.length).toBeLessThanOrEqual(400);
  });

  it('cuts a long excerpt at a word, never above the limit', () => {
    if (!motion) throw new Error('note missing');
    const text = bestSentences(motion, 'chuyển động thẳng biến đổi đều', 60);
    expect(text.length).toBeLessThanOrEqual(60);
    expect(text.endsWith('…')).toBe(true);
    expect(excerptBody(motion.text)).not.toContain('Nguồn:');
  });
});

describe('notes the small prompt can trust (review 2)', () => {
  const motion = builtinKnowledge('vi').find((n) => n.id === 'builtin:physics-motion');

  it('no excerpt at all when no sentence of the note matches the question', () => {
    if (!motion) throw new Error('note missing');
    expect(bestSentences(motion, 'Thuật toán sắp xếp nổi bọt')).toBe('');
  });

  it('keeps the terms of each language apart (same note id, same text length)', async () => {
    vi.resetModules();
    const fresh = await import('./knowledge');
    const id = 'builtin:bio-plant-resp';
    const viNote = fresh.builtinKnowledge('vi').find((n) => n.id === id);
    const enNote = fresh.builtinKnowledge('en').find((n) => n.id === id);
    expect(viNote?.text.length).toBe(enNote?.text.length);
    // Both questions typed without accents: the same comparison mode in both languages.
    expect(fresh.searchKnowledge('ho hap o thuc vat', 'vi')[0]?.id).toBe(id);
    expect(
      fresh.searchKnowledge('What do stomata and lenticels do in plant respiration?', 'en')[0]?.id,
    ).toBe(id);
  });
});
