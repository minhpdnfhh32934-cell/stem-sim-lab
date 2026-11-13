import {
  ClientMessageSchema,
  MAX_PLAYERS,
  MAX_ROOMS,
  MESSAGE_MAX_CHARS,
  MESSAGES_PER_S,
  ROOM_ID_CHARS,
  type CharacterData,
  type ClientMessage,
  type PeerInfo,
  type Pose,
  type RoomSummary,
  type ServerMessage,
} from './protocol.ts';

/** One browser's connection, as the server sees it. */
export interface RoomClient {
  send(message: ServerMessage): void;
}

interface Member {
  readonly id: string;
  readonly name: string;
  character: CharacterData;
  readonly client: RoomClient;
  readonly room: Room;
  pose: Pose | null;
}

interface Room {
  readonly id: string;
  readonly name: string;
  hostId: string;
  readonly members: Map<string, Member>;
  /** Station id → the member who works it; the others only watch. */
  readonly locks: Map<string, string>;
}

/**
 * The room server's state (Phase M): rooms, who is in each, where they are, who works which
 * station. Pure: the Vite plugin feeds it the parsed messages and sends what it answers. A room
 * lives while someone is in it; whoever is left becomes its host. A member's stations are free
 * again when they leave or their connection closes. Every message is checked first (size, rate,
 * schema); a bad one is dropped.
 */
export class RoomHub {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<RoomClient, Member>();
  /** Every connection: each hears the room list when it changes. */
  private readonly clients = new Set<RoomClient>();
  private readonly rate = new Map<RoomClient, { second: number; count: number }>();
  private next = 1;

  constructor(
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  connect(client: RoomClient): void {
    this.clients.add(client);
  }

  disconnect(client: RoomClient): void {
    this.leave(client);
    this.clients.delete(client);
    this.rate.delete(client);
  }

  receive(client: RoomClient, data: unknown): void {
    this.clients.add(client);
    if (!this.allowed(client)) return;
    let size: number;
    try {
      size = (JSON.stringify(data) as string | undefined)?.length ?? 0; // undefined: nothing sent
    } catch {
      return;
    }
    if (size > MESSAGE_MAX_CHARS) return;
    const parsed = ClientMessageSchema.safeParse(data);
    if (parsed.success) this.handle(client, parsed.data);
  }

  /** The open rooms, for the list (allocates). */
  list(): RoomSummary[] {
    return [...this.rooms.values()].map(summary);
  }

  private handle(client: RoomClient, message: ClientMessage): void {
    switch (message.t) {
      case 'list':
        client.send({ t: 'rooms', rooms: this.list() });
        return;
      case 'create': {
        if (this.rooms.size >= MAX_ROOMS) {
          client.send({ t: 'refused', reason: 'too-many-rooms' });
          return;
        }
        this.leave(client);
        const room: Room = {
          id: this.roomId(),
          name: message.room,
          hostId: '',
          members: new Map(),
          locks: new Map(),
        };
        this.rooms.set(room.id, room);
        this.enter(client, room, message.player, message.character);
        return;
      }
      case 'join': {
        const room = this.rooms.get(message.roomId);
        if (!room) {
          client.send({ t: 'refused', reason: 'unknown-room' });
          return;
        }
        if (this.members.get(client)?.room === room) return;
        if (room.members.size >= MAX_PLAYERS) {
          client.send({ t: 'refused', reason: 'full' });
          return;
        }
        this.leave(client);
        this.enter(client, room, message.player, message.character);
        return;
      }
      case 'leave':
        if (this.leave(client)) client.send({ t: 'left' });
        return;
    }
    const member = this.members.get(client);
    if (!member) {
      client.send({ t: 'refused', reason: 'not-in-room' });
      return;
    }
    const room = member.room;
    switch (message.t) {
      case 'pose':
        member.pose = message.pose;
        this.others(member, { t: 'pose', id: member.id, pose: message.pose });
        return;
      case 'look':
        member.character = message.character;
        this.others(member, { t: 'look', id: member.id, character: message.character });
        return;
      case 'claim':
        this.claim(member, message.stationId);
        return;
      case 'event':
        // Relayed as it is (checked here and by each browser); a person of the world is driven
        // only by who holds their lock (claimed when they began to drive them).
        if (message.event.k === 'npc' && !this.claim(member, `npc:${message.event.npc}`)) return;
        if (message.event.k === 'npcFree') {
          const lock = `npc:${message.event.npc}`;
          if (room.locks.get(lock) !== member.id) return;
          room.locks.delete(lock);
          this.locks(room);
        }
        this.others(member, { t: 'event', id: member.id, event: message.event });
        return;
      case 'release':
        if (room.locks.get(message.stationId) === member.id) {
          room.locks.delete(message.stationId);
          this.locks(room);
        }
        return;
      case 'chat': {
        const line: ServerMessage = {
          t: 'chat',
          id: member.id,
          name: member.name,
          text: message.text,
        };
        for (const other of room.members.values()) other.client.send(line);
        return;
      }
      case 'signal':
        room.members
          .get(message.to)
          ?.client.send({ t: 'signal', id: member.id, signal: message.signal });
        return;
      case 'command':
        // Only who works a station shows changes to it (a free one is theirs from now on).
        if (!this.claim(member, message.command.stationId)) return;
        this.others(member, { t: 'command', id: member.id, command: message.command });
        return;
    }
  }

  /** The station is the member's (it was, or was free); else refused, with who has it. */
  private claim(member: Member, stationId: string): boolean {
    const room = member.room;
    const holder = room.locks.get(stationId);
    if (holder === member.id) return true;
    if (holder !== undefined) {
      member.client.send({ t: 'refused', reason: 'taken', stationId });
      member.client.send({ t: 'locks', locks: Object.fromEntries(room.locks) });
      return false;
    }
    room.locks.set(stationId, member.id);
    this.locks(room);
    return true;
  }

  private enter(client: RoomClient, room: Room, name: string, character: CharacterData): void {
    const member: Member = { id: `p${this.next++}`, name, character, client, room, pose: null };
    if (room.members.size === 0) room.hostId = member.id;
    room.members.set(member.id, member);
    this.members.set(client, member);
    client.send({
      t: 'joined',
      room: summary(room),
      you: member.id,
      peers: [...room.members.values()].filter((m) => m !== member).map(peer),
    });
    for (const other of room.members.values()) {
      if (other !== member && other.pose)
        client.send({ t: 'pose', id: other.id, pose: other.pose });
    }
    if (room.locks.size > 0) client.send({ t: 'locks', locks: Object.fromEntries(room.locks) });
    this.others(member, { t: 'peer', peer: peer(member) });
    this.listChanged();
  }

  /** Out of their room, if in one: their stations free, the others told; an empty room closes. */
  private leave(client: RoomClient): boolean {
    const member = this.members.get(client);
    if (!member) return false;
    this.members.delete(client);
    const room = member.room;
    room.members.delete(member.id);
    let freed = false;
    for (const [stationId, holder] of room.locks) {
      if (holder === member.id) {
        room.locks.delete(stationId);
        freed = true;
      }
    }
    if (room.members.size === 0) {
      this.rooms.delete(room.id);
    } else {
      if (room.hostId === member.id) room.hostId = room.members.keys().next().value ?? '';
      this.others(member, { t: 'gone', id: member.id });
      if (freed) this.locks(room);
    }
    this.listChanged();
    return true;
  }

  private others(member: Member, message: ServerMessage): void {
    for (const other of member.room.members.values()) {
      if (other !== member) other.client.send(message);
    }
  }

  private locks(room: Room): void {
    const message: ServerMessage = { t: 'locks', locks: Object.fromEntries(room.locks) };
    for (const member of room.members.values()) member.client.send(message);
  }

  private listChanged(): void {
    const message: ServerMessage = { t: 'rooms', rooms: this.list() };
    for (const client of this.clients) client.send(message);
  }

  /** At most MESSAGES_PER_S messages a second from one connection. */
  private allowed(client: RoomClient): boolean {
    const second = Math.floor(this.now() / 1000);
    const rate = this.rate.get(client);
    if (!rate || rate.second !== second) {
      this.rate.set(client, { second, count: 1 });
      return true;
    }
    rate.count++;
    return rate.count <= MESSAGES_PER_S;
  }

  private roomId(): string {
    for (;;) {
      let id = '';
      for (let i = 0; i < 6; i++) {
        id += ROOM_ID_CHARS[Math.floor(this.random() * ROOM_ID_CHARS.length)] ?? 'A';
      }
      if (!this.rooms.has(id)) return id;
    }
  }
}

function summary(room: Room): RoomSummary {
  return {
    id: room.id,
    name: room.name,
    host: room.members.get(room.hostId)?.name ?? '',
    players: room.members.size,
    max: MAX_PLAYERS,
  };
}

function peer(member: Member): PeerInfo {
  return { id: member.id, name: member.name, character: member.character };
}
