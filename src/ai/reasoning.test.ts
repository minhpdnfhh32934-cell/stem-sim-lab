import { describe, expect, it } from 'vitest';
import vectors from '../../tests/fixtures/reasoning-strip.json';
import {
  hideUnfinishedReasoning,
  stripAllReasoning,
  stripReasoning,
  stripReasoningOutsideCode,
} from './reasoning';

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
    // The shared rule closes at the first closing tag; the one left after it is an orphan
    // (rule 3), as Rust and the stream filters read it (the "after_block" vectors).
    expect(stripReasoning(nested).text).toBe('d');
    expect(stripAllReasoning(nested)).toEqual({ text: 'd', removed: true, unclosed: false });
    expect(stripAllReasoning('Đáp án. <think>a<think>b</think>c')).toEqual({
      text: 'Đáp án.',
      removed: true,
      unclosed: true,
    });
  });

  it('a closing tag left after a block goes as a tag; the words around it stay', () => {
    const text = 'Đáp số 4. <think>x</think> Thêm </think> Hết.';
    // The shared rule reads it as an orphan (rule 3), as Rust does.
    expect(stripReasoning(text).text).toBe('Hết.');
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

describe('a reasoning tag written as code', () => {
  it('without code it is exactly the app rule (every shared vector)', () => {
    for (const c of vectors.cases) {
      expect(stripReasoningOutsideCode(c.input)).toEqual(stripAllReasoning(c.input));
    }
  });

  it('an opening tag in inline code or a closed fence is code, not reasoning', () => {
    for (const text of [
      'Qwen dùng thẻ `<think>` để suy nghĩ. Bước 1: a = 2 m/s².',
      '```html\n<think>\n```\nVậy a = 2.',
      '~~~\n<reasoning type="x">\n~~~\nHết.',
    ]) {
      expect(stripReasoningOutsideCode(text)).toEqual({ text, removed: false, unclosed: false });
      // The plain rule cuts these at the tag.
      expect(stripAllReasoning(text).removed).toBe(true);
    }
  });

  it('reasoning around or holding code still goes; a closing tag always counts', () => {
    expect(stripReasoningOutsideCode('<think>dùng `<think>` nhé</think>Đáp số 4.').text).toBe(
      'Đáp số 4.',
    );
    expect(stripReasoningOutsideCode('Viết `<think>` thế này. <think>nháp</think>Hết.').text).toBe(
      'Viết `<think>` thế này. Hết.',
    );
    expect(stripReasoningOutsideCode('<think>x ` y</think> Ta có `a` b.').text).toBe(
      'Ta có `a` b.',
    );
    expect(stripReasoningOutsideCode('Đáp số 4. <think>thử `x` và')).toEqual({
      text: 'Đáp số 4.',
      removed: true,
      unclosed: true,
    });
    expect(stripReasoningOutsideCode('nháp riêng `</think>` Lực.').text).not.toContain(
      'nháp riêng',
    );
  });

  it('a closing tag alone in a code span takes its backticks with it (review round 2)', () => {
    expect(stripReasoningOutsideCode('`</think>` là thẻ đóng. Đáp số 12.')).toEqual({
      text: 'là thẻ đóng. Đáp số 12.',
      removed: true,
      unclosed: false,
    });
    expect(stripReasoningOutsideCode('nháp riêng `</think>` Lực.').text).toBe('Lực.');
    expect(stripReasoningOutsideCode('<think>nháp `</ThinK >` Đáp số 12.').text).toBe('Đáp số 12.');
    // A span holding more than the tag is read as the plain rule reads it (its pairing is unsure).
    expect(stripReasoningOutsideCode('<think>x ` y</think> Ta có `a` b.').text).toBe(
      'Ta có `a` b.',
    );
  });

  it('the streaming preview shows a tag written as code once its code span is closed', () => {
    expect(hideUnfinishedReasoning('Qwen dùng thẻ `<think>` để')).toBe(
      'Qwen dùng thẻ `<think>` để',
    );
    expect(hideUnfinishedReasoning('Qwen dùng thẻ `<think>')).toBe('Qwen dùng thẻ `');
  });
});

describe('code and self-closing tags (shared vectors, review 2026-10-15)', () => {
  it.each(vectors.code)('$name', (c) => {
    const expected = { text: c.text, removed: c.removed, unclosed: c.unclosed };
    expect(stripReasoning(c.input)).toEqual(expected);
    // The page's pass reads code the same way (none of these has nested or stray tags).
    expect(stripReasoningOutsideCode(c.input)).toEqual(expected);
  });

  it.each(vectors.after_block)('$name (shared rule only)', (c) => {
    expect(stripReasoning(c.input)).toEqual({
      text: c.text,
      removed: c.removed,
      unclosed: c.unclosed,
    });
  });

  it('the three inputs of the review keep their lesson text', () => {
    // A fence holding only a closing tag goes with it (it used to leave an unclosed fence).
    expect(stripReasoningOutsideCode('Ví dụ:\n```\n</think>\n```\nĐáp số 12.').text).toBe(
      'Đáp số 12.',
    );
    // A closing tag in code after an opening tag in code is code (it used to cut the sentence).
    const quoted = 'Qwen viết suy nghĩ giữa `<think>` và `</think>`. Đáp số 12.';
    expect(stripReasoningOutsideCode(quoted)).toEqual({
      text: quoted,
      removed: false,
      unclosed: false,
    });
    // A self-closing tag is an empty block (it used to cut the rest of the answer).
    expect(stripReasoningOutsideCode('Dùng <think /> để đánh dấu. Đáp số 12.').text).toBe(
      'Dùng để đánh dấu. Đáp số 12.',
    );
  });

  it('a closing tag in code counts until an opening tag of its name was written in code', () => {
    // Another name opened in code does not protect it.
    expect(stripReasoning('`<reasoning>` rồi `</think>` Hết.').text).toBe('Hết.');
    // The same name opened in code after it does not either.
    expect(stripReasoning('nháp `</think>` rồi `<think>` Hết.').text).toBe('rồi `<think>` Hết.');
  });

  it('code found in a long text with many fence-like lines stays linear', () => {
    const lines = Array.from({ length: 20_000 }, (_, i) => `\`\`\`x${String(i)}`).join('\n');
    const started = performance.now();
    expect(stripReasoning(`${lines}\n<think>a</think>Hết.`).text).toBe(`${lines}\nHết.`);
    expect(performance.now() - started).toBeLessThan(2000);
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
