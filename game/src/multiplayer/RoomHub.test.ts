import { describe, expect, it } from 'vitest';
import characters from '../content/characters.json';
import { CharacterDefinitionSchema } from '../gameplay/character';
import { MAX_PLAYERS, MESSAGE_MAX_CHARS, MESSAGES_PER_S, type ServerMessage } from './protocol';
import { RoomHub, type RoomClient } from './RoomHub';

const character = CharacterDefinitionSchema.parse(characters[0]);

class Client implements RoomClient {
  readonly got: ServerMessage[] = [];
  send(message: ServerMessage): void {
    this.got.push(message);
  }
  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | undefined {
    for (let i = this.got.length - 1; i >= 0; i--) {
      const m = this.got[i];
      if (m?.t === t) return m as Extract<ServerMessage, { t: T }>;
    }
    return undefined;
  }
}

function setup() {
  let time = 0;
  let n = 0; // a different ID for each room (a constant would never find a free one)
  const hub = new RoomHub(
    () => (n++ * 0.137) % 1,
    () => time,
  );
  const tick = () => (time += 1000);
  const connect = () => {
    const c = new Client();
    hub.connect(c);
    return c;
  };
  return { hub, tick, connect };
}

const pose = { scene: 'simlab-hub', x: 1, y: 0, z: 2, yaw: 0.5, speed: 1.2 };

describe('RoomHub (LAN rooms, Phase M)', () => {
  it('creates a room with an ID, lists it with its players, lets another join by that ID', () => {
    const { hub, connect } = setup();
    const a = connect();
    const b = connect();
    hub.receive(a, { t: 'create', room: '  Lớp 12A1 ', player: 'Phú', character });
    const joined = a.last('joined');
    expect(joined?.room.name).toBe('Lớp 12A1');
    expect(joined?.room.id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(b.last('rooms')?.rooms).toEqual([
      { id: joined?.room.id, name: 'Lớp 12A1', host: 'Phú', players: 1, max: MAX_PLAYERS },
    ]);
    hub.receive(b, { t: 'join', roomId: joined!.room.id.toLowerCase(), player: 'An', character });
    expect(b.last('joined')?.peers.map((p) => p.name)).toEqual(['Phú']);
    expect(a.last('peer')?.peer.name).toBe('An');
    expect(a.last('rooms')?.rooms[0]?.players).toBe(2);
  });

  it('takes a character with the largest face picture from a photo (F-8) to the others', () => {
    const { hub, connect } = setup();
    const a = connect();
    const b = connect();
    const prefix = 'data:image/jpeg;base64,';
    const withPhoto = CharacterDefinitionSchema.parse({
      ...character,
      appearance: {
        ...character.appearance,
        facePhoto: prefix + 'A'.repeat(10_000 - prefix.length),
      },
    });
    hub.receive(a, { t: 'create', room: 'Lab', player: 'Phú', character: withPhoto });
    const id = a.last('joined')?.room.id ?? '';
    hub.receive(b, { t: 'join', roomId: id, player: 'An', character });
    const seen = b.last('joined')?.peers[0]?.character as { appearance?: { facePhoto?: string } };
    expect(seen.appearance?.facePhoto).toBe(withPhoto.appearance.facePhoto);
  });

  it('relays poses to the others only; a late joiner gets the last ones', () => {
    const { hub, connect } = setup();
    const [a, b, c] = [connect(), connect(), connect()];
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    const id = a.last('joined')!.room.id;
    hub.receive(b, { t: 'join', roomId: id, player: 'B', character });
    hub.receive(a, { t: 'pose', pose });
    expect(b.last('pose')).toEqual({ t: 'pose', id: a.last('joined')!.you, pose });
    expect(a.last('pose')).toBeUndefined();
    hub.receive(c, { t: 'join', roomId: id, player: 'C', character });
    expect(c.last('pose')?.pose).toEqual(pose);
  });

  it('one player works a station: the other is refused and sees who; freed when they leave', () => {
    const { hub, connect } = setup();
    const [a, b] = [connect(), connect()];
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    const id = a.last('joined')!.room.id;
    hub.receive(b, { t: 'join', roomId: id, player: 'B', character });
    const command = { stationId: 'physics-lab/pendulum', command: 'run' as const };
    hub.receive(a, { t: 'command', command });
    const aId = a.last('joined')!.you;
    expect(b.last('locks')?.locks).toEqual({ 'physics-lab/pendulum': aId });
    expect(b.last('command')).toEqual({ t: 'command', id: aId, command });
    b.got.length = 0;
    hub.receive(b, { t: 'command', command });
    expect(b.last('refused')).toEqual({
      t: 'refused',
      reason: 'taken',
      stationId: 'physics-lab/pendulum',
    });
    expect(a.last('command')).toBeUndefined();
    hub.disconnect(a);
    expect(b.last('gone')?.id).toBe(aId);
    expect(b.last('locks')?.locks).toEqual({});
    expect(b.last('rooms')?.rooms[0]?.host).toBe('B'); // whoever is left hosts it
  });

  it('relays events; one player drives the teacher until they free him (Phase F-3)', () => {
    const { hub, connect } = setup();
    const [a, b] = [connect(), connect()];
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    const id = a.last('joined')!.room.id;
    hub.receive(b, { t: 'join', roomId: id, player: 'B', character });
    const aId = a.last('joined')!.you;
    const hit = { k: 'hit' as const, target: b.last('joined')!.you, speed: 3 };
    hub.receive(a, { t: 'event', event: hit });
    expect(b.last('event')).toEqual({ t: 'event', id: aId, event: hit });
    const npc = { k: 'npc' as const, npc: 'teacher', view: { x: 1 }, say: 'Xin chào', board: null };
    hub.receive(a, { t: 'event', event: npc });
    expect(b.last('locks')?.locks).toEqual({ 'npc:teacher': aId });
    expect(b.last('event')?.event).toEqual(npc);
    b.got.length = 0;
    hub.receive(b, { t: 'event', event: npc }); // he is A's now
    expect(b.last('refused')?.stationId).toBe('npc:teacher');
    expect(a.got.filter((m) => m.t === 'event')).toHaveLength(0);
    hub.receive(b, { t: 'event', event: { k: 'npcFree', npc: 'teacher' } }); // not B's to free
    expect(b.last('event')).toBeUndefined();
    hub.receive(a, { t: 'event', event: { k: 'npcFree', npc: 'teacher' } });
    expect(b.last('locks')?.locks).toEqual({});
    expect(b.last('event')?.event).toEqual({ k: 'npcFree', npc: 'teacher' });
  });

  it('a room closes when its last player leaves; a full room and an unknown ID are refused', () => {
    const { hub, connect } = setup();
    const a = connect();
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    const id = a.last('joined')!.room.id;
    for (let i = 1; i < MAX_PLAYERS; i++) {
      hub.receive(connect(), { t: 'join', roomId: id, player: `P${i}`, character });
    }
    const late = connect();
    hub.receive(late, { t: 'join', roomId: id, player: 'Late', character });
    expect(late.last('refused')?.reason).toBe('full');
    hub.receive(late, { t: 'join', roomId: 'ZZZZZZ', player: 'Late', character });
    expect(late.last('refused')?.reason).toBe('unknown-room');
    hub.receive(a, { t: 'leave' });
    expect(a.last('left')).toBeDefined();
    expect(hub.list()[0]?.players).toBe(MAX_PLAYERS - 1);
    const solo = connect();
    hub.receive(solo, { t: 'create', room: 'S', player: 'S', character });
    hub.disconnect(solo);
    expect(hub.list().map((r) => r.name)).toEqual(['R']);
  });

  it('drops what it cannot trust: bad shapes, empty or long names, huge messages, floods', () => {
    const { hub, tick, connect } = setup();
    const a = connect();
    for (const bad of [
      null,
      'create',
      { t: 'create', room: '', player: 'A', character },
      { t: 'create', room: 'R', player: 'x'.repeat(21), character },
      { t: 'create', room: 'R', player: '\u0007', character },
      { t: 'create', room: 'R', player: 'A', character: 'x' }, // checked in full by each browser
      { t: 'pose', pose: { ...pose, x: Number.NaN } },
      { t: 'nope' },
      { t: 'create', room: 'R', player: 'A', character, pad: 'x'.repeat(MESSAGE_MAX_CHARS) },
    ]) {
      hub.receive(a, bad);
    }
    expect(hub.roomCount).toBe(0);
    expect(a.got.filter((m) => m.t !== 'refused')).toEqual([]);
    tick();
    for (let i = 0; i < MESSAGES_PER_S; i++) hub.receive(a, { t: 'list' });
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    expect(hub.roomCount).toBe(0); // over the rate this second
    tick();
    hub.receive(a, { t: 'create', room: 'R', player: 'A', character });
    expect(hub.roomCount).toBe(1);
  });

  it('a pose or a claim from someone in no room is refused', () => {
    const { hub, connect } = setup();
    const a = connect();
    hub.receive(a, { t: 'pose', pose });
    expect(a.last('refused')?.reason).toBe('not-in-room');
  });

  it('chat (2026-11-12): a line to everyone in the room, its sender too, cleaned; none outside', () => {
    const { hub, connect } = setup();
    const [a, b, c] = [connect(), connect(), connect()];
    hub.receive(a, { t: 'create', room: 'Chat', player: 'An', character });
    hub.receive(b, { t: 'join', roomId: a.last('joined')!.room.id, player: 'Bình', character });
    hub.receive(b, { t: 'chat', text: '  xin chào ' });
    const line = { t: 'chat', id: b.last('joined')!.you, name: 'Bình', text: 'xin chào' };
    expect(a.last('chat')).toEqual(line);
    expect(b.last('chat')).toEqual(line);
    expect(c.last('chat')).toBeUndefined();
    const before = a.got.length;
    hub.receive(b, { t: 'chat', text: '   ' }); // nothing to say
    hub.receive(b, { t: 'chat', text: 'x'.repeat(201) }); // too long
    expect(a.got.length).toBe(before);
    hub.receive(c, { t: 'chat', text: 'hi' });
    expect(c.last('refused')?.reason).toBe('not-in-room');
  });

  it('voice set-up (2026-11-12): a signal reaches the one player named in the room, no one else', () => {
    const { hub, connect } = setup();
    const [a, b, c, d] = [connect(), connect(), connect(), connect()];
    hub.receive(a, { t: 'create', room: 'Voice', player: 'An', character });
    const roomId = a.last('joined')!.room.id;
    hub.receive(b, { t: 'join', roomId, player: 'Bình', character });
    hub.receive(c, { t: 'join', roomId, player: 'Chi', character });
    hub.receive(d, { t: 'create', room: 'Other', player: 'Dũng', character });
    const offer = { k: 'offer', sdp: 'v=0' } as const;
    hub.receive(a, { t: 'signal', to: b.last('joined')!.you, signal: offer });
    expect(b.last('signal')).toEqual({ t: 'signal', id: a.last('joined')!.you, signal: offer });
    expect(c.last('signal')).toBeUndefined();
    hub.receive(a, { t: 'signal', to: d.last('joined')!.you, signal: offer }); // another room
    expect(d.last('signal')).toBeUndefined();
  });
});
