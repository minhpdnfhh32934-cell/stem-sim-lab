import { describe, expect, it } from 'vitest';
import vectors from '../../tests/fixtures/reasoning-strip.json';
import { hideUnfinishedReasoning, stripAllReasoning, stripReasoning } from './reasoning';

describe('hidden reasoning: the shared vectors (same file as the Rust test)', () => {
  it.each(vectors.cases)('$name', (c) => {
    expect(stripReasoning(c.input)).toEqual({
      text: c.text,
      removed: c.removed,
      unclosed: c.unclosed,
    });
    // Repeating until nothing changes agrees with one pass on every vector.
    expect(stripAllReasoning(c.input)).toEqual({
      text: c.text,
      removed: c.removed,
      unclosed: c.unclosed,
    });
  });

  it('the app version ends a nested block at the tag that balances it', () => {
    const nested = '<think>a<think>b</think>c</think>d';
    // The shared rule closes at the first closing tag and leaves the rest.
    expect(stripReasoning(nested).text).toBe('c</think>d');
    expect(stripAllReasoning(nested)).toEqual({ text: 'd', removed: true, unclosed: false });
    expect(stripAllReasoning('Đáp án. <think>a<think>b</think>c')).toEqual({
      text: 'Đáp án.',
      removed: true,
      unclosed: true,
    });
  });

  it('a closing tag left after a block goes as a tag; the words around it stay', () => {
    const text = 'Đáp số 4. <think>x</think> Thêm </think> Hết.';
    expect(stripReasoning(text).text).toBe('Đáp số 4. Thêm </think> Hết.');
    expect(stripAllReasoning(text)).toEqual({
      text: 'Đáp số 4. Thêm Hết.',
      removed: true,
      unclosed: false,
    });
  });

  it('never leaves a reasoning tag, so a second call changes nothing', () => {
    for (const text of [
      // Removing the stray tag joins "<thi" and "nk>" into a new opening tag.
      '<think>x</think>a<thi</think>nk>bí mật',
      'a <think>x</think> b </thinking> c',
      ...vectors.cases.map((c) => c.input),
    ]) {
      const once = stripAllReasoning(text).text;
      expect(once).not.toMatch(/<\/?(?:think|thinking|reasoning|reflection)[\s>]/i);
      expect(stripAllReasoning(once)).toEqual({ text: once, removed: false, unclosed: false });
    }
  });
});

describe('streaming preview', () => {
  it('never shows text inside an unfinished reasoning block', () => {
    const answer = 'Đáp án: <think>nháp 3 kg</think> a = 2 m/s².';
    for (let n = 0; n <= answer.length; n++) {
      const shown = hideUnfinishedReasoning(answer.slice(0, n));
      expect(shown).not.toMatch(/nháp|3 kg|<|think/u);
    }
    expect(hideUnfinishedReasoning(answer)).toBe('Đáp án: a = 2 m/s².');
  });

  it('hides a tag still being typed only while it may open a reasoning block', () => {
    expect(hideUnfinishedReasoning('Vậy <thi')).toBe('Vậy ');
    expect(hideUnfinishedReasoning('Vậy <think type="a')).toBe('Vậy ');
    expect(hideUnfinishedReasoning('Vậy <')).toBe('Vậy ');
    // A comparison or another tag stays.
    expect(hideUnfinishedReasoning('a < b')).toBe('a < b');
    expect(hideUnfinishedReasoning('$x<y')).toBe('$x<y');
    expect(hideUnfinishedReasoning('Ta viết <write id="s1"')).toBe('Ta viết <write id="s1"');
  });

  it('leaves text without reasoning exactly as it is (spaces included)', () => {
    expect(hideUnfinishedReasoning('Rơi tự do ')).toBe('Rơi tự do ');
  });
});
