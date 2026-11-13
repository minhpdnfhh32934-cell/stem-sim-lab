import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { CharacterDefinition } from '../../gameplay/character';
import {
  CommandSchema,
  POSE_HZ,
  ROOM_CLIENT_HEADER,
  ROOM_PATH,
  RoomEventSchema,
  RoomSummarySchema,
  SHARED_STATE_KEYS,
  ServerMessageSchema,
  type ClientMessage,
  type Pose,
  type Refusal,
  type RoomEvent,
  type RoomSummary,
  type Signal,
} from '../../multiplayer/protocol';
import { z } from 'zod';
import { BURNING_KEY } from '../../gameplay/fire/FireSystem';
import { CIRCUIT_KEY } from '../../gameplay/circuit/CircuitSystem';

import { doingOf } from './doing';

const SHARED = new Set<string>(SHARED_STATE_KEYS);

/** The other game servers of the LAN are asked for their rooms this often (s), on the menu. */
const LAN_POLL_S = 2;

/**
 * A room in the list: one on this page's server, or (`at`, `server`) one on another computer of
 * the LAN, found by the servers themselves (`multiplayer/lanDiscovery.ts`) and reached through
 * this page's server (`/simlab-rooms/via/<at>/`): the page stays on this computer (a secure
 * page: the microphone works), its server does the LAN.
 */
export interface LanRoom extends RoomSummary {
  /** The other server's address (`192.168.1.5:5190`), or undefined: this page's server. */
  readonly at?: string;
  /** That computer's name. */
  readonly server?: string;
}

const LanAnswerSchema = z.object({
  servers: z
    .array(
      z.object({
        at: z.string().max(64),
        name: z.string().max(64),
        rooms: z.array(RoomSummarySchema).max(64),
      }),
    )
    .max(64),
});

/** A station no command touched for this long (s), with no run on it, is free again. */
const IDLE_RELEASE_S = 60;
/** A pose that has not changed is sent again this often (s): the others know the game is there. */
const POSE_KEEP_S = 1;
/** A person of the world this game drives is sent this often (a second). */
const NPC_HZ = 8;

/**
 * The browser's side of LAN rooms (Phase M): talks to the room server on the server that served
 * the page (`multiplayer/roomHttp.ts`: Server-Sent Events down, POSTs up, sent one after another
 * so they arrive in order). Served by one without rooms (a plain file server), `available` stays
 * false and the menu says how to start one. It writes what the server says
 * into `game.peers`; it sends this player's pose (POSE_HZ, in their scene's own frame), the
 * station commands they give (the others' copies of the station follow), and claims or frees the
 * stations they work. A command another player gives arrives as `ExperimentCommand` with `from`.
 */
export class LanRooms implements GameSystem {
  readonly id = 'lan-rooms';
  /** A room server answered, and the stream is open. */
  available = false;
  /** The open rooms, as last heard: this server's, then the other computers' of the LAN. */
  rooms: readonly LanRoom[] = [];
  /** This server's rooms, and the other servers' (`/lan`). */
  private local: readonly RoomSummary[] = [];
  private lan: readonly LanRoom[] = [];
  private lanClock = LAN_POLL_S;
  private lanAsking = false;
  /** The server this game's stream goes to: null, this page's; else another's (`at`). */
  private at: string | null = null;
  /** The stream connected (its `hello`), for whoever waits to send through it. */
  private ready: Promise<void> = Promise.resolve();
  /** Why the last create or join was refused, or null. */
  refusal: Refusal | null = null;
  /** The connection to the room server dropped: no rooms until the page reloads. */
  lost = false;
  private source: EventSource | null = null;
  /** This connection's name in the POSTs (the stream's `hello`). */
  private clientId: string | null = null;
  /** The POSTs, one after another. */
  private sending: Promise<unknown> = Promise.resolve();
  private readonly subscriptions = new Disposables();
  private readonly listeners = new Set<() => void>();
  /** Voice set-up from another player (`VoiceChat`). */
  private signalListener: ((from: string, signal: Signal) => void) | null = null;
  /** Stations this player works: seconds since their last command. */
  private readonly mine = new Map<string, number>();
  private poseClock = 0;
  private keepClock = 0;
  /** The last pose sent, as JSON; undefined: none yet (the first is always sent). */
  private last: string | undefined = undefined;
  /** A state another player changed is being set here: not sent back. */
  private applying = false;
  /** Entities whose fire the others were last told burns (sizes are each game's own). */
  private readonly alight = new Set<string>();
  private npcClock = 0;
  /** People of the world this game drives now, and the board version the others last got. */
  private readonly driving = new Set<string>();
  private boardSent = -1;
  /** What each person was last heard saying (from another player's game). */
  private readonly heard = new Map<string, string>();
  private sentCharacter: CharacterDefinition | null = null;
  private idleClock = 0;

  constructor(private readonly game: Game) {}

  init(): void {
    this.ready = this.connect();
    const { events, peers } = this.game;
    this.subscriptions.add(
      events.subscribe('ExperimentCommand', (command) => {
        if (command.from !== undefined || !peers.room) return;
        // Its settings now (the StationSystem heard the command first): the others follow them.
        const params = this.game.stations.view(command.stationId)?.session.parameters;
        const shared = CommandSchema.safeParse({ ...command, params });
        if (!shared.success) return; // `view`, `load`, `unload`: the player's own
        // Refused here (another works it): nothing changed, nothing to show the others.
        if (peers.holder(command.stationId) !== null) return;
        this.mine.set(command.stationId, 0);
        this.send({ t: 'command', command: shared.data });
      }),
    );
    // Phase F-3: what this player throws, hits and changes, the others see.
    this.subscriptions.add(
      events.subscribe('ObjectReleased', ({ entityId, reason, velocity }) => {
        const scene = this.game.state.session.sceneId;
        const entity = this.game.world.entity(entityId);
        if (reason !== 'throw' || !peers.room || !entity || scene === null) return;
        const o = this.game.scenes.origin;
        const p = entity.pose.position;
        this.event({
          k: 'throw',
          item: entity.item.id,
          scene,
          from: [r3(p[0] - o[0]), r3(p[1] - o[1]), r3(p[2] - o[2])],
          v: [r3(velocity[0]), r3(velocity[1]), r3(velocity[2])],
        });
      }),
    );
    this.subscriptions.add(
      events.subscribe('PeerHit', ({ id, speed }) =>
        this.event({ k: 'hit', target: id, speed: r3(speed) }),
      ),
    );
    this.subscriptions.add(
      events.subscribe('EntityStateChanged', ({ entityId, key, value }) => {
        if (this.applying || !peers.room || !SHARED.has(key)) return;
        if (key === BURNING_KEY) {
          // Only lit and put out: each game grows its own fire.
          const lit = typeof value === 'number' && value > 0;
          if (lit === this.alight.has(entityId)) return;
          if (lit) this.alight.add(entityId);
          else this.alight.delete(entityId);
        }
        const shared = RoomEventSchema.safeParse({ k: 'state', entityId, key, value });
        if (shared.success) this.event(shared.data);
      }),
    );
    // Out of the lab, its stations are free for the others.
    this.subscriptions.add(events.subscribe('SceneEntered', () => this.releaseAll()));
    this.subscriptions.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        if (kind === 'menu') this.releaseAll();
        else this.sendLook();
      }),
    );
  }

  /**
   * Asks the page's server for rooms (JSON at `hello`: a plain file server answers the page's
   * HTML instead, and no stream is opened), then opens the stream: its `hello` names this
   * connection; dropped after that, the rooms are lost until a reload.
   */
  private async connect(): Promise<void> {
    const base = this.base();
    try {
      const answer = await fetch(`${base}/hello`);
      if (!answer.ok || !answer.headers.get('content-type')?.includes('application/json')) return;
    } catch {
      return; // no server at all (the page from a file)
    }
    const source = new EventSource(`${base}/events`);
    this.source = source;
    let hello: () => void = () => undefined;
    const said = new Promise<void>((resolve) => (hello = resolve));
    source.addEventListener('hello', (event) => {
      const id = (JSON.parse((event as MessageEvent<string>).data) as { id?: unknown }).id;
      if (typeof id !== 'string') return;
      this.clientId = id;
      this.available = true;
      this.send({ t: 'list' });
      this.changed();
      hello();
    });
    source.onmessage = (event: MessageEvent<string>) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      this.receive(data);
    };
    const failed = new Promise<void>((resolve) =>
      source.addEventListener('error', () => resolve()),
    );
    await Promise.race([said, failed]);
    source.onerror = () => {
      source.close(); // no reconnecting: a new stream would be a new player, out of the room
      if (this.source !== source) return; // one this game closed itself
      if (this.at !== null) {
        // Another computer's server went away: out of its room, back to this one's.
        this.game.peers.left();
        this.refusal = 'unknown-room';
        void this.use(null);
        this.changed();
        return;
      }
      if (!this.available) return;
      this.lost = true;
      this.clientId = null;
      this.rooms = [];
      this.mine.clear();
      this.game.peers.left();
      this.changed();
    };
  }

  update(dt: number): void {
    const { peers, state, scenes } = this.game;
    this.lanClock += dt;
    if (this.lanClock >= LAN_POLL_S && this.available && state.session.phase !== 'playing') {
      this.lanClock = 0;
      void this.askLan();
    }
    if (!peers.room) return;
    this.poseClock += dt;
    this.keepClock += dt;
    if (this.poseClock >= 1 / POSE_HZ) {
      this.poseClock = 0;
      const { session, player } = state;
      const o = scenes.origin;
      const p = player.position;
      const rest = player.rest;
      const held =
        this.game.interaction.heldEntity?.item.id ?? (this.game.phone.out ? 'phone' : null);
      // Rounded to the millimetre and milliradian: an unchanged pose sends nothing new.
      const pose: Pose | null =
        session.phase === 'playing' && session.sceneId !== null
          ? {
              scene: session.sceneId,
              x: r3(p[0] - o[0]),
              y: r3(p[1] - o[1]),
              z: r3(p[2] - o[2]),
              yaw: r3(player.yaw),
              speed: r3(this.game.gait.gait.speed),
              // What the others see of them (Phase F-3).
              pitch: r3(player.pitch),
              gear: [...this.game.equipment.worn],
              held,
              rest: rest === null ? null : rest.asleep ? 'asleep' : rest.kind,
              ...(rest && {
                restAt: [
                  r3(rest.at[0] - o[0]),
                  r3(rest.at[1] - o[1]),
                  r3(rest.at[2] - o[2]),
                  r3(rest.facing),
                ],
              }),
              act: this.game.actions.current?.sequence.id ?? null,
              doing: doingOf(this.game),
            }
          : null;
      const key = JSON.stringify(pose);
      if (key !== this.last || this.keepClock >= POSE_KEEP_S) {
        this.last = key;
        this.keepClock = 0;
        this.send({ t: 'pose', pose });
      }
    }
    this.npcClock += dt;
    if (this.npcClock >= 1 / NPC_HZ) {
      this.npcClock = 0;
      this.sendPeople();
    }
    this.idleClock += dt;
    if (this.idleClock >= 1 && this.mine.size > 0) {
      for (const [stationId, idle] of this.mine) {
        const running = this.game.stations.view(stationId)?.session.state === 'running';
        const open = this.game.workspace.openStation === stationId;
        const now = running || open ? 0 : idle + this.idleClock;
        if (now >= IDLE_RELEASE_S) this.release(stationId);
        else this.mine.set(stationId, now);
      }
      this.idleClock = 0;
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.listeners.clear();
    if (this.game.peers.room) this.send({ t: 'leave' });
    this.source?.close(); // the server takes the closed stream as leaving too
  }

  /** Called whenever the rooms, this game's room or a refusal change (the menu redraws). */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refresh(): void {
    this.send({ t: 'list' });
  }

  /** A new room, always on this page's server (this computer's). */
  create(room: string, player: string, character: CharacterDefinition): void {
    this.refusal = null;
    this.sentCharacter = character;
    void this.use(null).then(() => this.send({ t: 'create', room, player, character }));
  }

  /** Into a room: on the server it is on (another computer's, through this one's). */
  join(roomId: string, player: string, character: CharacterDefinition): void {
    this.refusal = null;
    this.sentCharacter = character;
    const id = roomId.trim().toUpperCase();
    const at = this.rooms.find((room) => room.id === id)?.at ?? null;
    void this.use(at).then(() => this.send({ t: 'join', roomId, player, character }));
  }

  /** The stream to `at`'s server (null: this page's), opened anew if it goes elsewhere now. */
  private use(at: string | null): Promise<void> {
    if (at === this.at) return this.ready;
    if (this.game.peers.room) this.send({ t: 'leave' });
    this.source?.close(); // that server takes the closed stream as leaving
    this.source = null;
    this.clientId = null;
    this.mine.clear();
    this.at = at;
    this.ready = this.connect();
    return this.ready;
  }

  private base(): string {
    return this.at === null ? ROOM_PATH : `${ROOM_PATH}/via/${encodeURIComponent(this.at)}`;
  }

  /** The other computers' rooms, from this page's server (it hears their servers on the LAN). */
  private async askLan(): Promise<void> {
    if (this.lanAsking) return;
    this.lanAsking = true;
    try {
      const answer = await fetch(`${ROOM_PATH}/lan`);
      const parsed = LanAnswerSchema.safeParse(answer.ok ? await answer.json() : null);
      const lan = parsed.success
        ? parsed.data.servers.flatMap((server) =>
            server.rooms.map((room) => ({ ...room, at: server.at, server: server.name })),
          )
        : [];
      if (JSON.stringify(lan) !== JSON.stringify(this.lan)) {
        this.lan = lan;
        this.merge();
        this.changed();
      }
    } catch {
      // No answer this time: the list stays as it was.
    } finally {
      this.lanAsking = false;
    }
  }

  /** The list: this server's rooms first (the one the stream is on), then the LAN's. */
  private merge(): void {
    const here = this.at === null ? this.local : [];
    const there =
      this.at === null ? [] : this.local.map((room) => ({ ...room, at: this.at ?? '' }));
    const seen = new Set([...here, ...there].map((room) => room.id));
    this.rooms = [...here, ...there, ...this.lan.filter((room) => !seen.has(room.id))];
  }

  leave(): void {
    this.mine.clear();
    this.send({ t: 'leave' });
  }

  /** A chat line to the room (heard back from the server, in the room's order). */
  chat(text: string): void {
    if (this.game.peers.room) this.send({ t: 'chat', text });
  }

  /** Voice set-up for one other player of the room. */
  signal(to: string, signal: Signal): void {
    if (this.game.peers.room) this.send({ t: 'signal', to, signal });
  }

  /** Where voice set-up from the others goes (one listener: the voice chat). */
  onSignal(listener: ((from: string, signal: Signal) => void) | null): void {
    this.signalListener = listener;
  }

  private receive(data: unknown): void {
    const parsed = ServerMessageSchema.safeParse(data);
    if (!parsed.success) {
      this.game.log.warn('A room message was not understood', parsed.error.message);
      return;
    }
    const { peers, events } = this.game;
    const message = parsed.data;
    switch (message.t) {
      case 'rooms': {
        this.local = message.rooms;
        this.merge();
        const mine = peers.room && message.rooms.find((room) => room.id === peers.room?.id);
        if (mine) peers.summary(mine);
        break;
      }
      case 'joined':
        this.last = undefined;
        peers.joined(message.room, message.you, message.peers);
        this.sendLook();
        break;
      case 'left':
        peers.left();
        if (this.at !== null) void this.use(null); // back to this computer's server
        break;
      case 'refused':
        if (message.reason === 'taken' && message.stationId) {
          this.mine.delete(message.stationId);
          peers.refused(message.stationId);
        } else this.refusal = message.reason;
        break;
      case 'peer':
        peers.peer(message.peer);
        break;
      case 'gone':
        peers.gone(message.id);
        break;
      case 'pose':
        peers.pose(message.id, message.pose);
        return; // 15 a second from each: nothing for the menu
      case 'look':
        peers.look(message.id, message.character);
        return;
      case 'event':
        this.apply(message.id, message.event);
        return;
      case 'chat':
        events.publish('ChatHeard', {
          name: message.name,
          text: message.text,
          own: message.id === peers.you,
        });
        return;
      case 'signal':
        this.signalListener?.(message.id, message.signal);
        return;
      case 'locks':
        peers.setLocks(message.locks);
        for (const stationId of this.mine.keys()) {
          if (message.locks[stationId] !== peers.you) this.mine.delete(stationId);
        }
        return;
      case 'command': {
        const name = peers.players.find((p) => p.id === message.id)?.name ?? '?';
        const { stationId, command, parameter, direction, value, step, params } = message.command;
        events.publish('ExperimentCommand', {
          stationId,
          command,
          from: name,
          ...(parameter !== undefined && { parameter }),
          ...(direction !== undefined && { direction }),
          ...(value !== undefined && { value }),
          ...(step !== undefined && { step }),
          ...(params !== undefined && { params }),
        });
        return;
      }
    }
    this.changed();
  }

  /** In the world with a character other than the one the room knows: the others redraw them. */
  private sendLook(): void {
    const { peers, state, content } = this.game;
    if (!peers.room || state.session.phase !== 'playing') return;
    const id = state.player.characterId;
    const character = id === null ? undefined : content.characters.tryGet(id);
    if (!character || character === this.sentCharacter) return;
    this.sentCharacter = character;
    this.send({ t: 'look', character });
  }

  /**
   * The people of the world this player has now (talking, followed, at a board, on a job): where
   * they are and what they do, the line they say, the board as written. Done: freed for the others.
   */
  private sendPeople(): void {
    const { npcs } = this.game;
    for (const view of npcs.views) {
      const id = view.npc.id;
      if (!npcs.engaged(id)) {
        if (this.driving.delete(id)) this.event({ k: 'npcFree', npc: id });
        continue;
      }
      const snapshot = npcs.snapshot(id);
      if (!snapshot) continue;
      if (!this.driving.has(id)) this.boardSent = -1;
      this.driving.add(id);
      const b = npcs.board;
      const board =
        b.version === this.boardSent || b.boardId === null
          ? null
          : {
              boardId: b.boardId,
              lines: b.lines,
              shown: b.shown,
              title: b.title,
              answer: b.answer,
            };
      this.boardSent = b.version;
      const say = npcs.talkingWith?.id === id ? (npcs.say?.text.slice(0, 600) ?? null) : null;
      const shared = RoomEventSchema.safeParse({ k: 'npc', npc: id, view: snapshot, say, board });
      if (shared.success) this.event(shared.data);
    }
  }

  private event(event: RoomEvent): void {
    if (this.game.peers.room) this.send({ t: 'event', event });
  }

  /** Another player's event: hits and throws to `peers`; a state set here as they set it. */
  private apply(from: string, event: RoomEvent): void {
    if (event.k === 'npc') {
      const { npcs, peers, events } = this.game;
      npcs.mirror(event.npc, event.view);
      if (event.board) npcs.mirrorBoard(event.board);
      if (event.say !== null && event.say !== this.heard.get(event.npc)) {
        const name = peers.players.find((p) => p.id === from)?.name ?? '?';
        events.publish('NpcHeard', { npcId: event.npc, text: event.say, with: name });
      }
      this.heard.set(event.npc, event.say ?? '');
      return;
    }
    if (event.k === 'npcFree') {
      this.heard.delete(event.npc);
      return;
    }
    if (event.k !== 'state') {
      this.game.peers.event(from, event);
      return;
    }
    const { entityId, key, value } = event;
    if (key === BURNING_KEY) {
      if (typeof value === 'number' && value > 0) this.alight.add(entityId);
      else this.alight.delete(entityId);
    }
    this.applying = true;
    try {
      this.game.entityStates.set(entityId, key, value);
      if (key === CIRCUIT_KEY) this.game.circuits.adopt(entityId);
      if (key === BURNING_KEY) this.game.fires.adopt(entityId);
    } finally {
      this.applying = false;
    }
  }

  private release(stationId: string): void {
    this.mine.delete(stationId);
    this.send({ t: 'release', stationId });
  }

  private releaseAll(): void {
    for (const stationId of [...this.mine.keys()]) this.release(stationId);
  }

  /** One message to the server, after the ones before it (a POST each; lost ones are dropped). */
  private send(message: ClientMessage): void {
    const id = this.clientId;
    if (id === null) return;
    const body = JSON.stringify(message);
    const url = `${this.base()}/send`;
    this.sending = this.sending
      .then(() =>
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [ROOM_CLIENT_HEADER]: id },
          body,
          keepalive: true, // a leave as the page closes still goes
        }),
      )
      .catch(() => undefined);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
