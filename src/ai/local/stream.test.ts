import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Lines, MAX_ANSWER_BYTES, MAX_LINE_BYTES, MAX_MODELS, rustTrim, sseLine } from './stream';
import { TOO_LARGE } from './types';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const fixture = (name: string) => read(`src-tauri/tests/fixtures/local-ai/${name}`);
const enc = new TextEncoder();

function allLines(chunks: Uint8Array[], max?: number): string[] {
  const l = new Lines(max);
  const out: string[] = [];
  for (const c of chunks) out.push(...l.push(c));
  const last = l.finish();
  if (last !== null) out.push(last);
  return out;
}

describe('local runtime stream lines (same fixtures as src-tauri/src/ai/local/stream.rs)', () => {
  it('gives the same lines at any chunking, also inside a character', () => {
    const bytes = enc.encode(fixture('ollama-chat.ndjson'));
    const whole = allLines([bytes]);
    expect(whole.length).toBeGreaterThanOrEqual(4);
    // Every split point, also inside "ố" and "²".
    for (let i = 1; i < bytes.length; i++) {
      expect(allLines([bytes.subarray(0, i), bytes.subarray(i)]), `split at ${i}`).toEqual(whole);
    }
    expect(allLines([...bytes].map((b) => Uint8Array.of(b)))).toEqual(whole);
    expect(whole.join('\n')).not.toContain('�');
  });

  it('reads several lines in one chunk, CRLF, and a last line without newline', () => {
    expect(allLines([enc.encode('{"a":1}\r\n{"b":2}\n\n{"c":3}')])).toEqual([
      '{"a":1}',
      '{"b":2}',
      '',
      '{"c":3}',
    ]);
    const l = new Lines(64);
    expect(l.push(enc.encode('x\n'))).toEqual(['x']);
    expect(l.finish()).toBeNull();
    // Only whitespace left at the end is no line.
    expect(allLines([enc.encode('x\n \t\r')])).toEqual(['x']);
  });

  it('refuses a line over its cap, even before its newline', () => {
    const l = new Lines(16);
    expect(l.push(new Uint8Array(10).fill(97))).toEqual([]);
    expect(() => l.push(new Uint8Array(10).fill(97))).toThrow(
      expect.objectContaining({
        code: 'badResponse',
        message: `${TOO_LARGE}: line over 16 bytes`,
      }) as Error,
    );
    const long = new Uint8Array(41).fill(97);
    long[40] = 10;
    expect(() => new Lines(16).push(long)).toThrow(/too-large/);
  });

  it('classifies SSE lines as Rust does', () => {
    const kinds = fixture('openai-chat.sse').split('\n').map(sseLine);
    expect(kinds).toContainEqual({ kind: 'done' });
    expect(kinds.some((k) => k.kind === 'data')).toBe(true);
    expect(kinds).toContainEqual({ kind: 'ignore' });
    expect(sseLine('data:{"x":1}')).toEqual({ kind: 'data', data: '{"x":1}' });
    expect(sseLine('data: [DONE]')).toEqual({ kind: 'done' });
    expect(sseLine(': keep-alive')).toEqual({ kind: 'ignore' });
    expect(sseLine('event: message')).toEqual({ kind: 'ignore' });
    expect(sseLine('error: {"message":"boom"}')).toEqual({
      kind: 'error',
      data: '{"message":"boom"}',
    });
  });

  it('trims as Rust trims and uses the same caps', () => {
    // Rust: U+0085 is whitespace, U+FEFF is not (JavaScript's trim is the other way round).
    expect(rustTrim('\u0085 a 　')).toBe('a');
    expect(rustTrim('﻿a')).toBe('﻿a');
    expect(sseLine('data: ﻿[DONE]').kind).toBe('data');
    const rust = read('src-tauri/src/ai/local/stream.rs');
    expect(rust).toContain('pub const MAX_LINE_BYTES: usize = 1 << 20;');
    expect(rust).toContain('pub const MAX_ANSWER_BYTES: usize = 512 * 1024;');
    expect(rust).toContain('pub const MAX_MODELS: usize = 500;');
    expect([MAX_LINE_BYTES, MAX_ANSWER_BYTES, MAX_MODELS]).toEqual([1 << 20, 512 * 1024, 500]);
  });
});
