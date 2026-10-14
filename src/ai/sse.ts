/**
 * Server-sent events over raw bytes, as `SseReader` in src-tauri/src/ai/stream.rs reads them: a
 * line ends in "\n" or "\r\n", an event ends at a blank line, and an event's bytes are decoded
 * only once the event is complete, so a Vietnamese character cut between two network chunks
 * stays whole. Used by the browser transport (src/ai/transport.ts) and, for its time limits, by
 * the browser client for local runtimes (src/ai/local/client.ts).
 */
import { AiError } from './types';

/** Largest single event (as Rust). */
export const MAX_EVENT_BYTES = 1 << 20;

/** One server-sent event. */
export interface SseEvent {
  /** The `event:` field ("message" when there is none). */
  event: string;
  /** The `data:` lines, joined with "\n". */
  data: string;
}

const EMPTY: Uint8Array = new Uint8Array(0);
const NEWLINE = 10;
const CR = 13;
const COLON = 58;
const SPACE = 32;

// Invalid bytes become U+FFFD (as Rust's from_utf8_lossy); a byte order mark is kept, as Rust
// keeps it.
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });

/** UTF-8 text of `bytes` (invalid sequences replaced). */
export function decodeUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** `a` followed by `b`. */
export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Length of `s` in UTF-8 bytes (the size caps are in bytes, as in Rust). */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

function sameBytes(a: Uint8Array, ascii: string): boolean {
  if (a.length !== ascii.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== ascii.charCodeAt(i)) return false;
  return true;
}

/** The fields of the event being read, still as bytes. */
class Pending {
  private event: Uint8Array = EMPTY;
  private data: Uint8Array[] = [];
  private dataSize = 0;
  private hasData = false;

  size(): number {
    return this.event.length + this.dataSize;
  }

  /** The event is complete: decoded now, and the fields start again. */
  dispatch(): SseEvent | null {
    const { event, data, hasData } = this;
    this.event = EMPTY;
    this.data = [];
    this.dataSize = 0;
    this.hasData = false;
    // An event without a `data:` line is not an event (the SSE format).
    if (!hasData) return null;
    let bytes: Uint8Array = EMPTY;
    for (const part of data) bytes = concatBytes(bytes, part);
    return {
      event: event.length === 0 ? 'message' : decodeUtf8(event),
      data: decodeUtf8(bytes),
    };
  }

  /** Reads one complete line (without its line end). */
  line(line: Uint8Array): SseEvent | null {
    if (line.length === 0) return this.dispatch();
    // A comment (keep-alive).
    if (line[0] === COLON) return null;
    const colon = line.indexOf(COLON);
    let name = line;
    let value: Uint8Array = EMPTY;
    if (colon >= 0) {
      name = line.subarray(0, colon);
      value = line.subarray(colon + 1);
      if (value[0] === SPACE) value = value.subarray(1);
    }
    if (sameBytes(name, 'data')) {
      if (this.hasData) {
        this.data.push(Uint8Array.of(NEWLINE));
        this.dataSize += 1;
      }
      this.data.push(value.slice());
      this.dataSize += value.length;
      this.hasData = true;
    } else if (sameBytes(name, 'event')) {
      this.event = value.slice();
    }
    // `id`, `retry` and unknown fields are ignored.
    return null;
  }
}

/** Bytes in, complete server-sent events out, whatever the network chunks look like. */
export class SseReader {
  private buf: Uint8Array = EMPTY;
  /** `buf[..scanned]` holds no line end (a long line in small chunks is scanned once). */
  private scanned = 0;
  private readonly pending = new Pending();

  constructor(private readonly maxEvent = MAX_EVENT_BYTES) {}

  private tooLarge(): AiError {
    return new AiError('badResponse', `event over ${this.maxEvent} bytes`);
  }

  /** Adds a network chunk; returns the events it completed, in order. */
  push(chunk: Uint8Array): SseEvent[] {
    this.buf = concatBytes(this.buf, chunk);
    const events: SseEvent[] = [];
    let start = 0;
    let from = this.scanned;
    for (;;) {
      const k = this.buf.indexOf(NEWLINE, from);
      if (k < 0) break;
      let line = this.buf.subarray(start, k);
      if (line.length > 0 && line[line.length - 1] === CR) line = line.subarray(0, -1);
      const ev = this.pending.line(line);
      if (ev) events.push(ev);
      if (this.pending.size() > this.maxEvent) throw this.tooLarge();
      start = k + 1;
      from = start;
    }
    this.buf = this.buf.slice(start);
    this.scanned = this.buf.length;
    if (this.buf.length + this.pending.size() > this.maxEvent) throw this.tooLarge();
    return events;
  }

  /**
   * The stream ended. An event whose lines all arrived is still read (a server may leave out the
   * last blank line); a line cut off by the end of the stream is dropped, so the answer then
   * misses its end mark and is reported as incomplete.
   */
  finish(): SseEvent | null {
    this.buf = EMPTY;
    this.scanned = 0;
    return this.pending.dispatch();
  }
}

/**
 * Reads the next chunk of a response body, or 'timeout' when nothing arrives before `until` (a
 * `performance.now()` time). A stop (`signal`) rejects with an AbortError at once, whatever the
 * body does. The caller cancels the reader after a timeout or a stop.
 */
export function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  until: number,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array> | 'timeout'> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      done();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(
      () => {
        done();
        resolve('timeout');
      },
      Math.max(0, until - performance.now()),
    );
    signal?.addEventListener('abort', onAbort, { once: true });
    reader.read().then(
      (r) => {
        done();
        resolve(r);
      },
      (e: unknown) => {
        done();
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
