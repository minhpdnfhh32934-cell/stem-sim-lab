import { createSocket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { FORGET_MS, LanDiscovery, broadcastOf, type LanDiscoveryOptions } from './lanDiscovery';
import type { RoomSummary } from './protocol';

// LAN discovery (lanDiscovery.ts) with real UDP on loopback: each instance on a port of its own,
// beacons sent straight to the other's port (a broadcast is not testable on one loopback).

const started: LanDiscovery[] = [];
afterEach(() => {
  for (const lan of started.splice(0)) lan.stop();
});

const room: RoomSummary = { id: 'ABCDEF', name: 'Lớp 11A', host: 'An', players: 1, max: 8 };

async function discovery(options: Partial<LanDiscoveryOptions> & { to?: () => number }) {
  const lan = new LanDiscovery({
    port: 5190,
    announce: true,
    rooms: () => [],
    log: () => {},
    listenPort: 0,
    bindAddress: '127.0.0.1',
    everyMs: 30,
    targets: () => (options.to?.() ? [{ address: '127.0.0.1', port: options.to() }] : []),
    ...options,
  });
  started.push(lan);
  await lan.start();
  return lan;
}

/** Sends one raw datagram to `port` on loopback. */
async function sendRaw(port: number, data: string | Buffer): Promise<void> {
  const socket = createSocket('udp4');
  await new Promise<void>((done) => socket.send(data, port, '127.0.0.1', () => done()));
  socket.close();
}

describe('LAN discovery (UDP beacons)', () => {
  it('two servers hear each other, keyed by the sender address, each ignoring its own beacon', async () => {
    let bPort = 0;
    const a = await discovery({ port: 5190, rooms: () => [room], to: () => bPort });
    const b = await discovery({ port: 5191, to: () => a.listenPort });
    bPort = b.listenPort;
    await expect
      .poll(() => b.servers())
      .toEqual([{ at: '127.0.0.1:5190', name: expect.any(String) as string, rooms: [room] }]);
    await expect.poll(() => a.servers().map((s) => s.at)).toEqual(['127.0.0.1:5191']);
    // Its own beacon, sent back to itself, is not a server.
    let selfPort = 0;
    const self = await discovery({ port: 5192, to: () => selfPort });
    selfPort = self.listenPort;
    await new Promise((done) => setTimeout(done, 150));
    expect(self.servers()).toEqual([]);
  });

  it('drops what it cannot trust, and never takes an address from the payload', async () => {
    const a = await discovery({ announce: false });
    const beacon = { app: 'simlab-rooms', v: 1, id: 'x', port: 6000, name: 'PC', rooms: [] };
    await sendRaw(a.listenPort, '{not json');
    await sendRaw(a.listenPort, JSON.stringify({ ...beacon, app: 'other' }));
    await sendRaw(a.listenPort, JSON.stringify({ ...beacon, port: 70_000 }));
    await sendRaw(a.listenPort, JSON.stringify({ ...beacon, rooms: [{ ...room, id: 'bad' }] }));
    await sendRaw(a.listenPort, JSON.stringify({ ...beacon, name: 'x'.repeat(33) }));
    await sendRaw(a.listenPort, Buffer.alloc(20_000, 32)); // over the size cap
    await sendRaw(a.listenPort, JSON.stringify({ ...beacon, port: 6001, address: '10.0.0.9' }));
    await expect.poll(() => a.servers().map((s) => s.at)).toEqual(['127.0.0.1:6001']);
  });

  it('forgets a server unheard for FORGET_MS', async () => {
    let now = 1_000;
    const a = await discovery({ announce: false, now: () => now });
    const beacon = { app: 'simlab-rooms', v: 1, id: 'x', port: 6000, name: 'PC', rooms: [] };
    await sendRaw(a.listenPort, JSON.stringify(beacon));
    await expect.poll(() => a.servers().length).toBe(1);
    now += FORGET_MS - 1;
    expect(a.servers().length).toBe(1);
    now += 2;
    expect(a.servers()).toEqual([]);
  });

  it('logs a port it cannot bind once, and does not throw', async () => {
    const logs: string[] = [];
    const a = await discovery({ announce: false });
    const taken = new LanDiscovery({
      port: 5190,
      announce: true,
      rooms: () => [],
      log: (message) => logs.push(message),
      listenPort: a.listenPort,
      bindAddress: '127.0.0.1',
      socket: () => createSocket('udp4'), // no reuseAddr: the port is taken
    });
    await taken.start();
    expect(logs).toHaveLength(1);
    expect(taken.servers()).toEqual([]);
    taken.stop();
  });

  it('announces to the directed broadcast address of each network', () => {
    expect(broadcastOf('192.168.1.5', '255.255.255.0')).toBe('192.168.1.255');
    expect(broadcastOf('10.1.2.3', '255.0.0.0')).toBe('10.255.255.255');
    expect(broadcastOf('172.16.5.4', '255.255.252.0')).toBe('172.16.7.255');
  });
});
