import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, loopbackUrl, loopbackV4, parseLoopback, tryLoopback } from './endpoint';
import { NOT_LOOPBACK } from './types';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/** The table shared with `parse_loopback` in src-tauri/src/ai/local/endpoint.rs. */
const table = JSON.parse(read('src-tauri/tests/fixtures/local-ai/endpoints.json')) as {
  accept: { input: string; base: string }[];
  reject: string[];
};

describe('local runtime addresses (same table as Rust)', () => {
  it('accepts exactly the loopback addresses of the shared table, normalised', () => {
    expect(table.accept.length).toBeGreaterThanOrEqual(8);
    for (const c of table.accept) {
      expect(parseLoopback(c.input).base, JSON.stringify(c.input)).toBe(c.base);
    }
  });

  it('refuses every other address of the shared table as not-loopback', () => {
    expect(table.reject.length).toBeGreaterThanOrEqual(20);
    for (const input of table.reject) {
      expect(() => parseLoopback(input), JSON.stringify(input)).toThrow(
        expect.objectContaining({ code: 'notAllowed', message: NOT_LOOPBACK }) as Error,
      );
      expect(tryLoopback(input)).toBeNull();
    }
    // Stored data of any type is refused, never trusted.
    for (const v of [undefined, null, 11434, { baseUrl: 'http://127.0.0.1:1' }]) {
      expect(tryLoopback(v)).toBeNull();
    }
  });

  it('only knows the three usual addresses of Rust (no other port is ever tried)', () => {
    const rust = read('src-tauri/src/ai/local/endpoint.rs');
    const block = /pub const DEFAULTS[^=]*=\s*\[([^\]]*)\]/.exec(rust)?.[1] ?? '';
    const ports = [...block.matchAll(/RuntimeKind::(\w+),\s*(\d+)/g)].map((m) => [
      m[1],
      Number(m[2]),
    ]);
    expect(ports).toEqual([
      ['Ollama', 11434],
      ['LmStudio', 1234],
      ['LlamaCpp', 8080],
    ]);
    expect(DEFAULTS.map((d) => [d.kind, d.port])).toEqual([
      ['ollama', 11434],
      ['lmStudio', 1234],
      ['llamaCpp', 8080],
    ]);
    expect(loopbackUrl(loopbackV4(1234), '/v1/models')).toBe('http://127.0.0.1:1234/v1/models');
    expect(parseLoopback(loopbackV4(8080).base)).toEqual(loopbackV4(8080));
  });
});
