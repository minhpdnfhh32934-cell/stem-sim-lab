import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import characters from '../content/characters.json';
import { MESSAGE_MAX_CHARS, ROOM_CLIENT_HEADER, ROOM_PATH, type ServerMessage } from './protocol';
import type { LanServer } from './lanDiscovery';
import { roomRoutes } from './roomHttp';

// The room server over plain HTTP (roomHttp.ts) on a real Node server: what the Vite servers, and a
// packaged app's server later, mount. Two players, each a stream of Server-Sent Events and POSTs.

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

async function serve(lan?: () => LanServer[]): Promise<string> {
  const routes = roomRoutes(undefined, lan);
  const server = createServer((req, res) => {
    if (!routes(req, res)) res.writeHead(200, { 'content-type': 'text/html' }).end('<html>');
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}${ROOM_PATH}`;
}

/** A player: its stream read as it comes, its id from `hello`, and its POSTs. */
async function player(base: string) {
  const controller = new AbortController();
  const stream = await fetch(`${base}/events`, { signal: controller.signal });
  const reader = stream.body!.pipeThrough(new TextDecoderStream()).getReader();
  const got: ServerMessage[] = [];
  let id = '';
  let buffer = '';
  const pump = async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: '', done: true }));
      if (done) return;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = /^data: (.*)$/m.exec(event)?.[1];
        if (!data) continue;
        if (event.startsWith('event: hello')) id = (JSON.parse(data) as { id: string }).id;
        else got.push(JSON.parse(data) as ServerMessage);
      }
    }
  };
  void pump();
  await expect.poll(() => id).not.toBe('');
  const send = (message: unknown, as = id) =>
    fetch(`${base}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ROOM_CLIENT_HEADER]: as },
      body: typeof message === 'string' ? message : JSON.stringify(message),
    });
  const last = <T extends ServerMessage['t']>(t: T) =>
    got.findLast((m): m is Extract<ServerMessage, { t: T }> => m.t === t);
  return { got, send, last, close: () => controller.abort() };
}

describe('the room server over HTTP (Server-Sent Events down, POSTs up)', () => {
  it('says it is one, so a page tells it from a file server', async () => {
    const base = await serve();
    const hello = await fetch(`${base}/hello`);
    expect(hello.headers.get('content-type')).toContain('application/json');
    expect(await hello.json()).toEqual({ rooms: true });
    expect((await fetch(`${base}/nothing`)).status).toBe(404);
  });

  it('two players: a room created and listed, joined, a pose relayed, one closes and is gone', async () => {
    const base = await serve();
    const character = characters[0];
    const a = await player(base);
    const b = await player(base);
    expect((await a.send({ t: 'create', room: 'Lớp 11A', player: 'An', character })).status).toBe(
      204,
    );
    await expect.poll(() => a.last('joined')?.room.name).toBe('Lớp 11A');
    const id = a.last('joined')!.room.id;
    await expect.poll(() => b.last('rooms')?.rooms.map((r) => r.id)).toEqual([id]);
    await b.send({ t: 'join', roomId: id, player: 'Bình', character });
    await expect.poll(() => b.last('joined')?.peers.map((p) => p.name)).toEqual(['An']);
    await expect.poll(() => a.last('peer')?.peer.name).toBe('Bình');
    const pose = { scene: 'simlab-hub', x: 1, y: 0, z: 2, yaw: 0.5, speed: 1 };
    await a.send({ t: 'pose', pose });
    await expect.poll(() => b.last('pose')?.pose).toEqual(pose);
    // B's page closes: its stream ends, and A hears B is gone (the room counts one again).
    b.close();
    await expect.poll(() => a.last('gone')?.id).toBeDefined();
    await expect.poll(() => a.last('rooms')?.rooms[0]?.players).toBe(1);
    a.close();
  });

  it('drops what it cannot trust: a stranger, a broken body, an over-long one', async () => {
    const base = await serve();
    const a = await player(base);
    expect((await a.send({ t: 'list' }, 'not-a-player')).status).toBe(403);
    expect((await a.send('{not json')).status).toBe(204); // read, dropped: nothing answered
    await a
      .send({ t: 'create', room: 'x'.repeat(MESSAGE_MAX_CHARS), player: 'A' })
      .catch(() => null);
    await a.send({ t: 'list' });
    await expect.poll(() => a.last('rooms')?.rooms).toEqual([]);
    expect(a.got.some((m) => m.t === 'joined')).toBe(false);
    a.close();
  });
});

describe('another server of the LAN, through this one (/lan, /via/<at>/)', () => {
  it('lists the servers heard; a player here joins a room there, both ways, and leaves', async () => {
    const character = characters[0];
    const there = await serve();
    const at = there.slice('http://'.length, -ROOM_PATH.length);
    const heard: LanServer[] = [{ at, name: 'PC-B', rooms: [] }];
    const here = await serve(() => heard);
    expect(await (await fetch(`${here}/lan`)).json()).toEqual({ servers: heard });
    expect(await (await fetch(`${here}/via/${encodeURIComponent(at)}/hello`)).json()).toEqual({
      rooms: true,
    });

    const host = await player(there);
    await host.send({ t: 'create', room: 'Lớp 11A', player: 'An', character });
    await expect.poll(() => host.last('joined')?.room.id).toBeDefined();
    const id = host.last('joined')!.room.id;
    // POSTs go there and its stream comes back as it is written.
    const guest = await player(`${here}/via/${at}`);
    expect((await guest.send({ t: 'list' })).status).toBe(204);
    await expect.poll(() => guest.last('rooms')?.rooms.map((r) => r.id)).toEqual([id]);
    expect((await guest.send({ t: 'join', roomId: id, player: 'Bình', character })).status).toBe(
      204,
    );
    await expect.poll(() => guest.last('joined')?.peers.map((p) => p.name)).toEqual(['An']);
    await expect.poll(() => host.last('peer')?.peer.name).toBe('Bình');
    const pose = { scene: 'simlab-hub', x: 1, y: 0, z: 2, yaw: 0.5, speed: 1 };
    await guest.send({ t: 'pose', pose });
    await expect.poll(() => host.last('pose')?.pose).toEqual(pose);
    // The guest's page closes here: the stream there closes too, so the guest leaves the room.
    guest.close();
    await expect.poll(() => host.last('gone')?.id).toBeDefined();
    host.close();
  });

  it('is no open proxy: a server not heard now is not reached', async () => {
    const there = await serve();
    const at = there.slice('http://'.length, -ROOM_PATH.length);
    const here = await serve(() => []);
    expect(await (await fetch(`${here}/lan`)).json()).toEqual({ servers: [] });
    expect((await fetch(`${here}/via/${at}/hello`)).status).toBe(404);
    expect((await fetch(`${here}/via/${at}/send`, { method: 'POST', body: '{}' })).status).toBe(
      404,
    );
    const heard = await serve(() => [{ at, name: 'B', rooms: [] }]);
    expect((await fetch(`${heard}/via/${at}/other`)).status).toBe(404);
    // An answer of the other server is passed back as it is (a stranger's POST: 403).
    expect((await fetch(`${heard}/via/${at}/send`, { method: 'POST', body: '{}' })).status).toBe(
      403,
    );
  });
});
