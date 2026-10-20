/**
 * Addresses of local runtimes: only this computer, never the network. The web-side mirror of
 * `parse_loopback` in src-tauri/src/ai/local/endpoint.rs; both are tested with the same table
 * (src-tauri/tests/fixtures/local-ai/endpoints.json).
 *
 * An address is accepted only when ALL of these hold:
 * - after trimming (String.prototype.trim) at most 200 UTF-8 bytes, no space or control character;
 * - scheme `http` (any case);
 * - host written exactly `127.0.0.1`, `[::1]` or `localhost` (any case): no other spelling of
 *   loopback, no `0.0.0.0`, no LAN or internet address, no `localhost.evil`, no `[::ffff:…]`;
 * - an explicit port 1–65535 without a leading zero;
 * - path empty, `/`, `/v1` or `/v1/` (normalised away); no user info, query or fragment;
 * - the standard URL parser reads the same scheme, host and port.
 *
 * In the desktop app Rust checks again on every call; the page check only fails fast.
 */
import { utf8Length } from '../sse';
import { AiError } from '../types';
import { NOT_LOOPBACK, type RuntimeKind } from './types';

/** Longest address accepted (bytes, as Rust). */
const MAX_URL_LEN = 200;

export type LoopHost = 'v4' | 'v6' | 'localhost';

/** A checked runtime address on this computer. */
export interface Loopback {
  host: LoopHost;
  port: number;
  /** `http://127.0.0.1:11434` (no trailing slash). */
  base: string;
}

const HOST_TEXT: Record<LoopHost, string> = {
  v4: '127.0.0.1',
  v6: '[::1]',
  localhost: 'localhost',
};

function loopback(host: LoopHost, port: number): Loopback {
  return { host, port, base: `http://${HOST_TEXT[host]}:${port}` };
}

/** The usual IPv4 address of a runtime on `port`. */
export function loopbackV4(port: number): Loopback {
  return loopback('v4', port);
}

/** The base plus a fixed path of the adapters (`/api/tags`, `/v1/models`, …). */
export function loopbackUrl(base: Loopback, path: string): string {
  return `${base.base}${path}`;
}

/**
 * The usual address of each runtime. Detection only looks here: no other port is tried, no
 * file is read and no process is listed.
 */
export const DEFAULTS: readonly { kind: RuntimeKind; port: number }[] = [
  { kind: 'ollama', port: 11434 },
  { kind: 'lmStudio', port: 1234 },
  { kind: 'llamaCpp', port: 8080 },
];

function refuse(): AiError {
  return new AiError('notAllowed', NOT_LOOPBACK);
}

/** Lower case for ASCII letters only (Rust's `to_ascii_lowercase`). */
export function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Rust's `char::is_control` (Unicode Cc) or a space. */
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE = /[\u0000- \u007f-\u009f]/;

/** Checks a runtime address typed by the user or stored by the page; throws `not-loopback`. */
export function parseLoopback(input: string): Loopback {
  const s = input.trim();
  if (s === '' || utf8Length(s) > MAX_URL_LEN || CONTROL_OR_SPACE.test(s)) throw refuse();
  if (asciiLower(s.slice(0, 7)) !== 'http://') throw refuse();
  const rest = s.slice(7);
  // The authority as written, up to the first '/', '\', '?' or '#'.
  const cut = rest.search(/[/\\?#]/);
  const end = cut < 0 ? rest.length : cut;
  const authority = rest.slice(0, end);
  const tail = rest.slice(end);
  if (authority.includes('@')) throw refuse();
  let hostText: string;
  let portText: string;
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close < 0) throw refuse();
    const after = authority.slice(close + 1);
    if (!after.startsWith(':')) throw refuse();
    hostText = authority.slice(0, close + 1);
    portText = after.slice(1);
  } else {
    const colon = authority.lastIndexOf(':');
    if (colon < 0) throw refuse();
    hostText = authority.slice(0, colon);
    portText = authority.slice(colon + 1);
  }
  const lower = asciiLower(hostText);
  const host: LoopHost | undefined =
    lower === '127.0.0.1'
      ? 'v4'
      : lower === '[::1]'
        ? 'v6'
        : lower === 'localhost'
          ? 'localhost'
          : undefined;
  if (host === undefined) throw refuse();
  if (!/^[1-9][0-9]{0,4}$/.test(portText)) throw refuse();
  const port = Number(portText);
  if (port > 65535) throw refuse();
  if (!['', '/', '/v1', '/v1/'].includes(tail)) throw refuse();
  // The URL parser must read the same thing (defense in depth against parser differences).
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw refuse();
  }
  const urlPort = url.port === '' ? 80 : Number(url.port);
  if (
    url.protocol !== 'http:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.hostname !== HOST_TEXT[host] ||
    urlPort !== port
  ) {
    throw refuse();
  }
  return loopback(host, port);
}

/** The checked address, or null (stored data, never trusted). */
export function tryLoopback(input: unknown): Loopback | null {
  if (typeof input !== 'string') return null;
  try {
    return parseLoopback(input);
  } catch {
    return null;
  }
}
