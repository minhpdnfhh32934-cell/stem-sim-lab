import { randomUUID } from 'node:crypto';
import { request, type IncomingMessage, type ServerResponse } from 'node:http';
import type { LanServer } from './lanDiscovery.ts';
import {
  MESSAGE_MAX_CHARS,
  ROOM_CLIENT_HEADER,
  ROOM_PATH,
  type ServerMessage,
} from './protocol.ts';
import { RoomHub, type RoomClient } from './RoomHub.ts';

/** A comment line keeps an idle stream open through anything that times connections out (ms). */
const KEEP_ALIVE_MS = 20_000;

/**
 * The LAN room server over plain HTTP (Phase M), for any Node server that serves the game: the
 * Vite dev and preview servers (`roomsPlugin.ts`) now, a packaged app's own server later. No
 * dependency: Server-Sent Events down, POSTs up.
 *
 * - `GET  ROOM_PATH/hello`: JSON, so a page can tell a room server from a plain file server.
 * - `GET  ROOM_PATH/events`: the stream of a connection; its first event, `hello`, names it.
 *   Closed (the page closed or reloaded), it leaves its room (`RoomHub.disconnect`).
 * - `POST ROOM_PATH/send`: one message, its connection named by ROOM_CLIENT_HEADER; over
 *   MESSAGE_MAX_CHARS it is dropped unread. RoomHub checks the rest (rate, schema).
 *
 * - `GET  ROOM_PATH/lan`: the game servers heard on the LAN (`lanDiscovery.ts`), not this one.
 * - `ROOM_PATH/via/<at>/(hello|events|send)`: the same, on the server `at` (IP:port), proxied so
 *   the page stays on localhost. Only to a server heard now: never an open proxy.
 *
 * Returns whether it answered the request (false: not its path).
 */
export function roomRoutes(hub = new RoomHub(), lan: () => LanServer[] = () => []) {
  const clients = new Map<string, RoomClient>();
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = req.url ?? '';
    if (!url.startsWith(`${ROOM_PATH}/`)) return false;
    const path = url.slice(ROOM_PATH.length).split('?')[0] ?? '';
    const via = /^\/via\/([^/]+)\/(hello|events|send)$/.exec(path);
    if (via) {
      const at = decode(via[1] ?? '');
      if (lan().some((server) => server.at === at)) proxy(req, res, at, via[2] ?? '');
      else res.writeHead(404).end();
    } else if (req.method === 'GET' && path === '/lan') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ servers: lan() }));
    } else if (req.method === 'GET' && path === '/hello') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"rooms":true}');
    } else if (req.method === 'GET' && path === '/events') {
      const id = randomUUID();
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const client: RoomClient = {
        send: (message: ServerMessage) => res.write(`data: ${JSON.stringify(message)}\n\n`),
      };
      clients.set(id, client);
      hub.connect(client);
      res.write(`event: hello\ndata: ${JSON.stringify({ id })}\n\n`);
      const keep = setInterval(() => res.write(':\n\n'), KEEP_ALIVE_MS);
      req.on('close', () => {
        clearInterval(keep);
        clients.delete(id);
        hub.disconnect(client);
      });
    } else if (req.method === 'POST' && path === '/send') {
      const client = clients.get(String(req.headers[ROOM_CLIENT_HEADER] ?? ''));
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
        if (body.length > MESSAGE_MAX_CHARS) req.destroy(); // dropped unread
      });
      req.on('end', () => {
        res.writeHead(client ? 204 : 403).end();
        if (!client) return;
        let data: unknown;
        try {
          data = JSON.parse(body);
        } catch {
          return;
        }
        hub.receive(client, data);
      });
    } else {
      res.writeHead(404).end();
    }
    return true;
  };
}

/** Longer than the stream's keep-alive: a server gone quiet this long is gone. */
const PROXY_IDLE_MS = 45_000;

/** One request to the room server `at`, its answer piped back as it comes (SSE unbuffered). */
function proxy(req: IncomingMessage, res: ServerResponse, at: string, what: string): void {
  const colon = at.lastIndexOf(':');
  const headers: Record<string, string> = {};
  for (const name of ['content-type', 'accept', ROOM_CLIENT_HEADER]) {
    const value = req.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  const forward = (body?: string) => {
    const upstream = request(
      {
        host: at.slice(0, colon),
        port: Number(at.slice(colon + 1)),
        method: req.method,
        path: `${ROOM_PATH}/${what}`,
        headers:
          body === undefined ? headers : { ...headers, 'content-length': Buffer.byteLength(body) },
        timeout: PROXY_IDLE_MS,
      },
      (answer) => {
        const back: Record<string, string> = {};
        for (const name of ['content-type', 'cache-control']) {
          const value = answer.headers[name];
          if (typeof value === 'string') back[name] = value;
        }
        res.writeHead(answer.statusCode ?? 502, back);
        res.flushHeaders();
        answer.pipe(res);
        answer.on('close', () => res.end());
      },
    );
    upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502).end();
      else res.destroy();
    });
    // The page closed (or reloaded): the other server's stream closes too, so it leaves the room.
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy();
    });
    upstream.end(body);
  };
  if (req.method !== 'POST') {
    forward();
    return;
  }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => {
    body += chunk;
    if (body.length > MESSAGE_MAX_CHARS) req.destroy(); // dropped unread
  });
  req.on('end', () => forward(body));
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return '';
  }
}
