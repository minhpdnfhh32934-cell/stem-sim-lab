/**
 * Splits a streamed answer of a local runtime into lines, whatever the network chunks look like:
 * a line may be cut across chunks (and a Vietnamese character across bytes), several lines may
 * share a chunk, and the last line may have no newline. Lines are decoded only when complete, so
 * multi-byte characters are never cut. Every size is capped. The web-side mirror of
 * src-tauri/src/ai/local/stream.rs (same fixtures: ollama-chat.ndjson, openai-chat.sse).
 */
import { concatBytes, decodeUtf8 } from '../sse';
import { AiError } from '../types';
import { TOO_LARGE } from './types';

/** Longest line accepted (one NDJSON object or one SSE line). */
export const MAX_LINE_BYTES = 1 << 20;
/** Longest answer text accepted (reasoning included). */
export const MAX_ANSWER_BYTES = 512 * 1024;
/** Most models listed from one runtime. */
export const MAX_MODELS = 500;

const EMPTY = new Uint8Array(0);
const NEWLINE = 10;
const CR = 13;

/** Rust's `char::is_whitespace` (Unicode White_Space): unlike JS, U+0085 yes and U+FEFF no. */
const RUST_SPACE = '\t\n\u000b\f\r \u0085   -     　';
const RUST_TRIM = new RegExp(`^[${RUST_SPACE}]+|[${RUST_SPACE}]+$`, 'g');

/** Rust's `str::trim` (runtime data is compared as Rust compares it). */
export function rustTrim(s: string): string {
  return s.replace(RUST_TRIM, '');
}

/** Rust's `u8::is_ascii_whitespace`: space, \t, \n, \f and \r. */
function isAsciiSpace(b: number): boolean {
  return b === 32 || b === 9 || b === 10 || b === 12 || b === 13;
}

/** Bytes in, complete lines out (without "\n" or "\r\n"). */
export class Lines {
  private buf: Uint8Array = EMPTY;
  /** `buf[..scanned]` holds no newline (a long line in small chunks is scanned once). */
  private scanned = 0;

  constructor(private readonly maxLine = MAX_LINE_BYTES) {}

  private tooLong(): AiError {
    return new AiError('badResponse', `${TOO_LARGE}: line over ${this.maxLine} bytes`);
  }

  /** Adds a network chunk; returns the lines it completed, in order. */
  push(chunk: Uint8Array): string[] {
    this.buf = concatBytes(this.buf, chunk);
    const lines: string[] = [];
    let start = 0;
    let from = this.scanned;
    for (;;) {
      const end = this.buf.indexOf(NEWLINE, from);
      if (end < 0) break;
      if (end - start > this.maxLine) throw this.tooLong();
      let line = this.buf.subarray(start, end);
      if (line.length > 0 && line[line.length - 1] === CR) line = line.subarray(0, -1);
      lines.push(decodeUtf8(line));
      start = end + 1;
      from = start;
    }
    this.buf = this.buf.slice(start);
    this.scanned = this.buf.length;
    if (this.buf.length > this.maxLine) throw this.tooLong();
    return lines;
  }

  /** The stream ended: the last line if it had no newline. */
  finish(): string | null {
    let rest = this.buf;
    this.buf = EMPTY;
    this.scanned = 0;
    if (rest.length > 0 && rest[rest.length - 1] === CR) rest = rest.subarray(0, -1);
    return rest.every(isAsciiSpace) ? null : decodeUtf8(rest);
  }
}

/** One line of a server-sent event stream, as the OpenAI-compatible servers send them. */
export type Sse =
  /** `data: {json}` */
  | { kind: 'data'; data: string }
  /** `data: [DONE]` */
  | { kind: 'done' }
  /** `error: {json}` (llama.cpp reports errors in the stream this way). */
  | { kind: 'error'; data: string }
  /** Blank line, `: comment`, `event:`, `id:` or `retry:`. */
  | { kind: 'ignore' };

export function sseLine(line: string): Sse {
  if (line === '' || line.startsWith(':')) return { kind: 'ignore' };
  if (line.startsWith('data:')) {
    const rest = line.slice(5);
    const data = rest.startsWith(' ') ? rest.slice(1) : rest;
    return rustTrim(data) === '[DONE]' ? { kind: 'done' } : { kind: 'data', data };
  }
  if (line.startsWith('error:')) return { kind: 'error', data: rustTrim(line.slice(6)) };
  return { kind: 'ignore' };
}
