import { randomUUID } from 'node:crypto';
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { hostname, networkInterfaces } from 'node:os';
import { z } from 'zod';
import { MAX_ROOMS, RoomSummarySchema, type RoomSummary } from './protocol.ts';

/** The UDP port every game server of the LAN announces on and listens to. */
export const DISCOVERY_PORT = 5188;
export const BEACON_MS = 2_000;
/** A server unheard this long is forgotten (a few beacons lost in a row). */
export const FORGET_MS = 7_000;
export const MAX_SERVERS = 32;
/** A datagram longer than this is dropped unread (32 full rooms fit well under it). */
const BEACON_MAX_BYTES = 16_000;
const NAME_MAX = 32;

const BeaconSchema = z.object({
  app: z.literal('simlab-rooms'),
  v: z.literal(1),
  id: z.string().min(1).max(64),
  port: z.number().int().min(1).max(65_535),
  name: z.string().max(NAME_MAX),
  rooms: z.array(RoomSummarySchema).max(MAX_ROOMS),
});

/** A game server heard on the LAN: `at` is the sender's own IP (never one it claims) and port. */
export interface LanServer {
  readonly at: string;
  readonly name: string;
  readonly rooms: RoomSummary[];
}

export interface Target {
  readonly address: string;
  readonly port: number;
}

export interface LanDiscoveryOptions {
  /** This server's HTTP port, announced. */
  readonly port: number;
  /** Announce (the HTTP server is reachable from the LAN); otherwise only listen. */
  readonly announce: boolean;
  readonly rooms: () => RoomSummary[];
  readonly log: (message: string) => void;
  // Injectable for tests: loopback targets, a port of their own, a clock, a faster beat.
  readonly listenPort?: number;
  readonly bindAddress?: string;
  readonly targets?: () => Target[];
  readonly now?: () => number;
  readonly everyMs?: number;
  readonly socket?: () => Socket;
}

/**
 * LAN discovery (Phase M): each game server (Node, `roomsPlugin.ts`) broadcasts a small UDP
 * beacon every BEACON_MS and keeps the servers it hears, so a game finds the others' rooms
 * without typing an IP. The page stays on localhost; its server lists them (`/simlab-rooms/lan`)
 * and proxies to them (`roomHttp.ts`). Errors are logged once and never stop the server.
 */
export class LanDiscovery {
  private readonly id = randomUUID();
  private readonly heard = new Map<string, { name: string; rooms: RoomSummary[]; time: number }>();
  private readonly now: () => number;
  private socket: Socket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warned = false;

  constructor(private readonly options: LanDiscoveryOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Binds and starts beating; resolves once bound (or failed, logged). */
  start(): Promise<void> {
    const { listenPort = DISCOVERY_PORT, bindAddress, everyMs = BEACON_MS } = this.options;
    const socket = (
      this.options.socket ?? (() => createSocket({ type: 'udp4', reuseAddr: true }))
    )();
    this.socket = socket;
    socket.on('message', (data, from) => this.receive(data, from));
    return new Promise((done) => {
      const failed = (error: Error) => {
        this.warn(`LAN discovery off (UDP ${listenPort}): ${error.message}`);
        this.stop();
        done();
      };
      socket.once('error', failed);
      socket.bind(listenPort, bindAddress, () => {
        socket.off('error', failed);
        socket.on('error', (error) => this.warn(`LAN discovery: ${error.message}`));
        if (this.options.announce) {
          socket.setBroadcast(true);
          this.beat();
          this.timer = setInterval(() => this.beat(), everyMs);
          this.timer.unref();
        }
        done();
      });
    });
  }

  /** The UDP port it listens on (0 before it is bound). */
  get listenPort(): number {
    try {
      return this.socket?.address().port ?? 0;
    } catch {
      return 0;
    }
  }

  /** The servers heard within FORGET_MS, this one excluded. */
  servers(): LanServer[] {
    const now = this.now();
    const found: LanServer[] = [];
    for (const [at, server] of this.heard) {
      if (now - server.time > FORGET_MS) this.heard.delete(at);
      else found.push({ at, name: server.name, rooms: server.rooms });
    }
    return found;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      this.socket?.close();
    } catch {
      // already closed
    }
    this.socket = null;
    this.heard.clear();
  }

  private beat(): void {
    const socket = this.socket;
    if (!socket) return;
    const beacon = JSON.stringify({
      app: 'simlab-rooms',
      v: 1,
      id: this.id,
      port: this.options.port,
      name: hostname().slice(0, NAME_MAX),
      rooms: this.options.rooms().slice(0, MAX_ROOMS),
    });
    for (const { address, port } of (this.options.targets ?? broadcastTargets)()) {
      socket.send(beacon, port, address, (error) => {
        if (error) this.warn(`LAN discovery: cannot announce to ${address} (${error.message})`);
      });
    }
  }

  private receive(data: Buffer, from: RemoteInfo): void {
    if (data.length > BEACON_MAX_BYTES) return;
    let json: unknown;
    try {
      json = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    const beacon = BeaconSchema.safeParse(json);
    if (!beacon.success || beacon.data.id === this.id) return;
    const at = `${from.address}:${beacon.data.port}`;
    if (!this.heard.has(at) && this.servers().length >= MAX_SERVERS) return;
    this.heard.set(at, { name: beacon.data.name, rooms: beacon.data.rooms, time: this.now() });
  }

  private warn(message: string): void {
    if (this.warned) return;
    this.warned = true;
    this.options.log(message);
  }
}

/** The directed broadcast address of each IPv4 network this computer is on. */
export function broadcastTargets(): Target[] {
  const found: Target[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        found.push({ address: broadcastOf(net.address, net.netmask), port: DISCOVERY_PORT });
      }
    }
  }
  return found;
}

/** 192.168.1.5 / 255.255.255.0 → 192.168.1.255. */
export function broadcastOf(address: string, netmask: string): string {
  const mask = toInt(netmask);
  return fromInt((toInt(address) & mask) | ~mask);
}

const toInt = (ip: string) => ip.split('.').reduce((n, part) => (n << 8) | Number(part), 0);
const fromInt = (n: number) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
