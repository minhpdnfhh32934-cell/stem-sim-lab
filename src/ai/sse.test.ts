// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readChunk, SseReader, utf8Length, type SseEvent } from './sse';

const enc = new TextEncoder();

function fixture(name: string): string {
  return readFileSync(
    resolve(import.meta.dirname, '../../src-tauri/tests/fixtures/cloud-ai', name),
    'utf8',
  );
}

function events(chunks: Uint8Array[], max?: number): SseEvent[] {
  const r = new SseReader(max);
  const out: SseEvent[] = [];
  for (const c of chunks) out.push(...r.push(c));
  const last = r.finish();
  if (last) out.push(last);
  return out;
}

describe('server-sent events over bytes (as SseReader in src-tauri/src/ai/stream.rs)', () => {
  it('frames the same events at every split point, LF or CRLF, also inside a character', () => {
    for (const name of ['gemini-stream.sse', 'claude-stream.sse', 'groq-stream.sse']) {
      for (const text of [fixture(name), fixture(name).replace(/\r?\n/g, '\r\n')]) {
        const bytes = enc.encode(text);
        const whole = events([bytes]);
        expect(whole.length, name).toBeGreaterThanOrEqual(4);
        for (let i = 1; i < bytes.length; i++) {
          expect(
            events([bytes.subarray(0, i), bytes.subarray(i)]),
            `${name} split at ${i}`,
          ).toEqual(whole);
        }
        const singles = [...bytes].map((b) => Uint8Array.of(b));
        expect(events(singles)).toEqual(whole);
      }
    }
  });

  it('reads event names, joins data lines and skips comments and other fields', () => {
    const got = events([
      enc.encode(
        ': keep-alive\nevent: message_start\ndata: {"a":1}\n\nid: 7\nretry: 10\ndata:x\ndata: y\n\nevent: only\n\n',
      ),
    ]);
    expect(got).toEqual([
      { event: 'message_start', data: '{"a":1}' },
      { event: 'message', data: 'x\ny' },
    ]);
    // Vietnamese text cut between two chunks stays whole.
    const bytes = enc.encode('data: Gia tốc\n\n');
    const cut = bytes.indexOf(0xe1);
    expect(events([bytes.subarray(0, cut + 1), bytes.subarray(cut + 1)])).toEqual([
      { event: 'message', data: 'Gia tốc' },
    ]);
  });

  it('reads a last event without its blank line, but drops a cut line', () => {
    expect(events([enc.encode('data: a\n')])).toEqual([{ event: 'message', data: 'a' }]);
    expect(events([enc.encode('data: a\n\ndata: cut')])).toEqual([{ event: 'message', data: 'a' }]);
  });

  it('refuses an event over its size cap, also before its line ends', () => {
    const r = new SseReader(16);
    expect(r.push(enc.encode('data: 0123456789'))).toEqual([]);
    expect(() => r.push(enc.encode('abcdefgh'))).toThrow(/event over 16 bytes/);
    expect(() => events([enc.encode('data: 0123456789\ndata: 0123456789\n\n')], 16)).toThrow(
      /event over 16 bytes/,
    );
  });

  it('counts UTF-8 bytes as Rust does', () => {
    expect(utf8Length('a')).toBe(1);
    expect(utf8Length('ố')).toBe(3);
    expect(utf8Length('²')).toBe(2);
    expect(utf8Length('😀')).toBe(4);
    expect(utf8Length('Lực')).toBe(enc.encode('Lực').length);
  });

  it('reads a chunk, times out, or stops at once', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(Uint8Array.of(1));
      },
    });
    const reader = stream.getReader();
    expect(await readChunk(reader, performance.now() + 1000)).toMatchObject({ done: false });
    // Nothing more arrives.
    expect(await readChunk(reader, performance.now() + 20)).toBe('timeout');
    const ctl = new AbortController();
    const pending = readChunk(reader, performance.now() + 10_000, ctl.signal);
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await reader.cancel();
  });
});
