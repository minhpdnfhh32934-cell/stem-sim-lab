import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { partialTagStart, stripWhole, ThinkFilter } from './thinkFilter';
import { applyStreamEvent } from './types';

interface Case {
  name: string;
  input: string;
  text: string;
  removed: boolean;
  unclosed: boolean;
}

/** The vectors shared with src-tauri/src/ai/reasoning.rs (and src/ai/reasoning.ts). */
const cases = (
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../tests/fixtures/reasoning-strip.json'), 'utf8'),
  ) as { cases: Case[] }
).cases;

/** What the stream must show for `raw`, computed the slow way (the whole text every time). */
function slowVisible(raw: string): string {
  return stripWhole(raw.slice(0, partialTagStart(raw))).text;
}

/** A complete reasoning tag, or the start of one at the end. */
function reasoningTagIn(s: string): boolean {
  return stripWhole(s).removed || partialTagStart(s) < s.length;
}

/** Feeds `pieces`; returns every text the learner saw, then the final text. */
function play(pieces: string[]): { seen: string[]; last: string } {
  const f = new ThinkFilter();
  let screen = '';
  const seen: string[] = [];
  for (const p of pieces) {
    const change = f.push(p);
    if (change) screen = applyStreamEvent(screen, change);
    expect(screen).toBe(f.shown);
    // The fast path gives what a full rescan gives.
    expect(screen, `after ${JSON.stringify(p)}`).toBe(slowVisible(f.received));
    seen.push(screen);
  }
  const fin = f.finish();
  if (fin.change) screen = applyStreamEvent(screen, fin.change);
  expect(screen).toBe(fin.text);
  return { seen, last: screen };
}

const chars = (s: string) => Array.from(s);

describe('reasoning filter for streamed answers (same rule as Rust)', () => {
  it('passes every shared vector on the whole text', () => {
    expect(cases.length).toBeGreaterThanOrEqual(19);
    for (const c of cases) {
      expect(stripWhole(c.input), c.name).toEqual({
        text: c.text,
        removed: c.removed,
        unclosed: c.unclosed,
      });
      const f = new ThinkFilter();
      f.push(c.input);
      const fin = f.finish();
      expect({ text: fin.text, removed: fin.removed, unclosed: fin.unclosed }, c.name).toEqual({
        text: c.text,
        removed: c.removed,
        unclosed: c.unclosed,
      });
    }
  });

  it('gives the same final text at every split, and never shows a tag', () => {
    for (const c of cases) {
      const { seen, last } = play(chars(c.input));
      expect(last, `char by char: ${c.name}`).toBe(c.text);
      for (let i = 1; i < c.input.length; i++) {
        expect(play([c.input.slice(0, i), c.input.slice(i)]).last, `split at ${i}: ${c.name}`).toBe(
          c.text,
        );
      }
      // Before the end the screen only shows the start of the final answer (an orphan closing
      // tag is the exception: the text before it could not be known to be reasoning).
      if (!c.name.includes('orphan')) {
        for (const s of seen) {
          expect(reasoningTagIn(s), `${c.name}: ${s}`).toBe(false);
          expect(c.text.trim().startsWith(s.trim()), `${c.name} showed ${s}`).toBe(true);
        }
      }
    }
  });

  it('never shows text inside a block, also when tags are cut between pieces', () => {
    const answer =
      'Ta có <think>BÍ MẬT: thử 3 kg</think> a = F/m = 5 m/s². ' +
      '<Thinking type="x">BÍ MẬT nữa</Thinking>Xong. <reasoning>BÍ MẬT bị cắt';
    for (const pieces of [
      chars(answer),
      [
        'Ta có <th',
        'ink>BÍ MẬT: thử',
        ' 3 kg</thi',
        'nk> a = F/m = 5 m/s². <Thinking type="x">BÍ ',
        'MẬT nữa</Thinking>Xong. <reasoning>BÍ MẬT bị cắt',
      ],
    ]) {
      const { seen, last } = play(pieces);
      expect(last).toBe('Ta có a = F/m = 5 m/s². Xong.');
      for (const s of seen) {
        expect(s).not.toContain('BÍ MẬT');
        expect(reasoningTagIn(s)).toBe(false);
      }
    }
  });

  it('takes back what was shown when a late orphan closing tag comes', () => {
    const f = new ThinkFilter();
    expect(f.push('Người dùng hỏi')).toEqual({ kind: 'delta', text: 'Người dùng hỏi' });
    expect(f.push(' về lực.</think>\nLực là')).toEqual({ kind: 'reset', text: 'Lực là' });
    expect(f.push(' tác dụng.')).toEqual({ kind: 'delta', text: ' tác dụng.' });
    const fin = f.finish();
    expect(fin.text).toBe('Lực là tác dụng.');
    expect(fin.change).toBeNull();
  });

  it('holds back only a possible tag start, and shows it if the answer ends there', () => {
    const f = new ThinkFilter();
    expect(f.push('Nếu $x')).toEqual({ kind: 'delta', text: 'Nếu $x' });
    expect(f.push('<')).toBeNull();
    expect(f.push('y$ thì')).toEqual({ kind: 'delta', text: '<y$ thì' });
    expect(f.finish().text).toBe('Nếu $x<y$ thì');
    const g = new ThinkFilter();
    g.push('Kết thúc <thi');
    expect(g.shown).toBe('Kết thúc ');
    const fin = g.finish();
    expect(fin.text).toBe('Kết thúc <thi');
    expect(fin.change).toEqual({ kind: 'delta', text: '<thi' });
  });

  it('removes the spaces after a closing tag even when they arrive later', () => {
    expect(play(['A <think>b</think>', '  ', '\tC']).last).toBe('A C');
  });

  it('streams long answers and answers full of "<" in linear time', () => {
    const run = (pieces: Iterable<string>) => {
      const f = new ThinkFilter();
      let screen = '';
      const started = performance.now();
      for (const p of pieces) {
        const change = f.push(p);
        if (change) screen = applyStreamEvent(screen, change);
      }
      const fin = f.finish();
      if (fin.change) screen = applyStreamEvent(screen, fin.change);
      expect(screen).toBe(fin.text);
      expect(fin.text).toBe(stripWhole(f.received).text);
      return performance.now() - started;
    };
    const rep = function* (p: string, n: number) {
      for (let i = 0; i < n; i++) yield p;
    };
    const n = 16_384;
    // 200 000 pieces of plain text.
    expect(run(rep('ab ', 200_000))).toBeLessThan(5000);
    for (const pieces of [
      [...rep('a<b ', n)],
      ['<think>', ...rep('a<b ', n), '</think> Xong.'],
      ['<', ...rep('abcd', n)],
      ['Đáp <think ', ...rep('x=1 ', n)],
      ['A </think', ...rep('    ', n)],
      [...rep('x</think>', n)],
      [...rep('a<think>b</think>', n)],
    ]) {
      expect(run(pieces)).toBeLessThan(2000);
    }
  });

  it('matches a full rescan after every piece of random streams', () => {
    const parts = [
      '<',
      '</',
      '>',
      'think',
      'Think',
      'THINKING',
      'reasoning',
      'reflection',
      'er',
      ' ',
      '\t',
      '\n',
      'a',
      'Lực',
      'ố',
      '$x<y$',
      ' type="x"',
      '<think>',
      '</think>',
      '<reasoning>',
      '</reasoning>',
      '﻿',
      '\u0085',
      '<thinker>',
    ];
    // A small deterministic generator (the same constants as the Rust test).
    let seed = 0x5eedn;
    const below = (n: number) => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
      return Number((seed >> 33n) % BigInt(n));
    };
    for (let k = 0; k < 1500; k++) {
      const len = 1 + below(24);
      let text = '';
      for (let i = 0; i < len; i++) text += parts[below(parts.length)] ?? '';
      const pieces: string[] = [];
      let from = 0;
      for (let i = 1; i < text.length; i++) {
        if (below(3) === 0) {
          pieces.push(text.slice(from, i));
          from = i;
        }
      }
      pieces.push(text.slice(from));
      expect(play(pieces).last, JSON.stringify(text)).toBe(stripWhole(text).text);
    }
  });
});
