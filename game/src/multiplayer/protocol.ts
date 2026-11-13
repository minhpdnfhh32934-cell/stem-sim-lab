import { z } from 'zod';

/**
 * LAN rooms (Phase M): the messages between a game in a browser and the room server
 * (`roomHttp.ts`), over plain HTTP under ROOM_PATH on the server that serves the game — the
 * server's to the browser as Server-Sent Events, the browser's as POSTs. Every message either way
 * is checked against these schemas: the server trusts no browser, a browser trusts nothing it did
 * not check.
 */
export const ROOM_PATH = '/simlab-rooms';
/** The header a browser names its connection by in its POSTs (given in the stream's `hello`). */
export const ROOM_CLIENT_HEADER = 'x-room-client';

/** Players in one room, at most. */
export const MAX_PLAYERS = 8;
/** Rooms open on one server, at most. */
export const MAX_ROOMS = 32;
export const PLAYER_NAME_MAX = 20;
export const ROOM_NAME_MAX = 32;
/** A chat line, at most (characters). */
export const CHAT_MAX = 200;
/** A message longer than this (JSON characters) is dropped unread. */
export const MESSAGE_MAX_CHARS = 16_000;
/** Poses a browser sends per second while in a world. */
export const POSE_HZ = 15;
/** Messages a browser may send per second; past it, the rest of that second's are dropped. Poses
 * (15) and a teacher driven (8) leave room for bursts of shared states (Phase F-3). */
export const MESSAGES_PER_S = 80;
/** A room ID: 6 letters and digits, none that read alike (no I, O, 0, 1). */
export const ROOM_ID = /^[A-HJ-NP-Z2-9]{6}$/;
export const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const id = z.string().min(1).max(128);
// Zod 4 numbers are finite (no NaN, no ±Infinity).
const finite = z.number();
/** Names: trimmed, no control characters (shown as text, never as markup). */
const name = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\p{Cc}/gu, '').trim())
    .pipe(z.string().min(1).max(max));

export const PlayerNameSchema = name(PLAYER_NAME_MAX);
export const RoomNameSchema = name(ROOM_NAME_MAX);
/** A chat line: trimmed, no control characters, shown as text (never markup), not translated. */
export const ChatTextSchema = name(CHAT_MAX);
export const RoomIdSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(ROOM_ID));

/**
 * Where a player is: their scene, feet in that scene's own frame (m), facing (rad), walk speed —
 * and (Phase F-3) what the others see of them: where they look (`pitch`), what they wear (`gear`:
 * item ids: the lab coat, goggles, gloves), what their hands hold (`held`: an item id, the phone
 * as "phone"), sitting, lying or asleep (`rest`), and the action their hands act out (`act`).
 */
export const PoseSchema = z.object({
  scene: id,
  x: finite.min(-1000).max(1000),
  y: finite.min(-1000).max(1000),
  z: finite.min(-1000).max(1000),
  yaw: finite,
  speed: finite.min(0).max(20),
  pitch: finite.min(-2).max(2).optional(),
  gear: z.array(id).max(8).optional(),
  held: id.nullable().optional(),
  rest: z.enum(['sit', 'lie', 'asleep']).nullable().optional(),
  /** Seated or lying: where (the seat, the pillow) in the scene's frame, and the body's facing. */
  restAt: z.tuple([finite, finite, finite, finite]).optional(),
  act: id.nullable().optional(),
  /** What they are doing, drawn as such (`DOINGS`), or null. */
  doing: z.enum(['paper', 'talk', 'work', 'call', 'dial', 'hands']).nullable().optional(),
});
/** A test paper, a conversation, a station's work, a call, dialling, looking at one's hands. */
export type Doing = NonNullable<z.infer<typeof PoseSchema>['doing']>;
export type Pose = z.infer<typeof PoseSchema>;

const COMMANDS = ['run', 'stop', 'reset', 'adjust', 'set', 'setup', 'clear'] as const;

/**
 * A station command (`ExperimentCommand`) followed on the others' copies of the station, with the
 * sender's settings of it after the command (`params`). Not `view` (a results page is the
 * player's own), nor `load`/`unload` (they move what the player's hand holds: objects are each
 * player's own).
 */
export const CommandSchema = z.object({
  stationId: id,
  command: z.enum(COMMANDS),
  parameter: id.optional(),
  direction: z.union([z.literal(1), z.literal(-1)]).optional(),
  value: finite.optional(),
  step: id.optional(),
  params: z.record(id, finite).optional(),
});
export type SharedCommand = z.infer<typeof CommandSchema>;

const Vec = z.tuple([
  finite.min(-1000).max(1000),
  finite.min(-1000).max(1000),
  finite.min(-1000).max(1000),
]);
/** An entity state kept alike in every game of the room (doors, taps, lights, circuits, fire). */
export const SHARED_STATE_KEYS = [
  'open',
  'running',
  'active',
  'lightsOff',
  'circuit',
  'burning',
  'burningAt',
  'charred',
  'broken',
] as const;

/**
 * What one game tells the others beside its pose (Phase F-3), relayed as it is:
 * - `hit`: something it threw hit player `target` (their screen flashes; a sleeper wakes);
 * - `throw`: it threw item `item` from `from` at `v` (m/s) in `scene`: the others see it fly;
 * - `state`: an entity state it changed (one of SHARED_STATE_KEYS);
 * - `npc`: a person of the world it drives now (it holds their lock `npc:<id>`): where they are,
 *   what they do, the line they say, the board they write — the others draw the same;
 * - `npcFree`: it no longer drives that person.
 */
export const RoomEventSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('hit'), target: id, speed: finite.min(0).max(100) }),
  z.object({ k: z.literal('throw'), item: id, scene: id, from: Vec, v: Vec }),
  z.object({
    k: z.literal('state'),
    entityId: id,
    key: z.enum(SHARED_STATE_KEYS),
    value: z.union([z.boolean(), finite, z.string().max(8000)]),
  }),
  z.object({
    k: z.literal('npc'),
    npc: id,
    view: z.record(id, z.union([z.boolean(), finite, z.string().max(200), z.null()])),
    say: z.string().max(600).nullable(),
    /** The board as written now (sent when it changed, else null). */
    board: z
      .object({
        boardId: id.nullable(),
        lines: z.array(z.string().max(400)).max(40),
        shown: z.array(z.number().int().min(0).max(400)).max(40),
        title: z.number().int().min(-1).max(40),
        answer: z.number().int().min(-1).max(40),
      })
      .nullable(),
  }),
  z.object({ k: z.literal('npcFree'), npc: id }),
]);
export type RoomEvent = z.infer<typeof RoomEventSchema>;

/**
 * Voice (2026-11-12): what two browsers say to set up their call (WebRTC), relayed by the server
 * to the one player named, never read by it. The audio then goes between the two browsers.
 */
export const SignalSchema = z.discriminatedUnion('k', [
  z.object({ k: z.enum(['offer', 'answer']), sdp: z.string().max(12_000) }),
  z.object({
    k: z.literal('ice'),
    candidate: z.string().max(2000),
    mid: z.string().max(64).nullable(),
    index: z.number().int().min(0).max(64).nullable(),
  }),
]);
export type Signal = z.infer<typeof SignalSchema>;

/**
 * A player's character as it travels: an object the server only relays (it imports nothing of the
 * game, so the Vite config loads it alone); each browser checks it in full (`Peers`).
 */
const CharacterData = z.record(z.string(), z.unknown());
export type CharacterData = z.infer<typeof CharacterData>;

const Join = { player: PlayerNameSchema, character: CharacterData };

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('list') }),
  z.object({ t: z.literal('create'), room: RoomNameSchema, ...Join }),
  z.object({ t: z.literal('join'), roomId: RoomIdSchema, ...Join }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('pose'), pose: PoseSchema.nullable() }),
  z.object({ t: z.literal('claim'), stationId: id }),
  z.object({ t: z.literal('release'), stationId: id }),
  z.object({ t: z.literal('command'), command: CommandSchema }),
  /** The player's character changed (a saved game's own): the others draw them anew. */
  z.object({ t: z.literal('look'), character: CharacterData }),
  z.object({ t: z.literal('event'), event: RoomEventSchema }),
  /** A chat line to everyone in the room (the sender hears it back, in the room's order). */
  z.object({ t: z.literal('chat'), text: ChatTextSchema }),
  /** Voice set-up for one other player of the room. */
  z.object({ t: z.literal('signal'), to: z.string().max(32), signal: SignalSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const RoomSummarySchema = z.object({
  id: z.string().regex(ROOM_ID),
  name: z.string(),
  host: z.string(),
  players: z.number().int().min(0),
  max: z.number().int().min(1),
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const PeerSchema = z.object({
  id: z.string(),
  name: z.string(),
  character: CharacterData,
});
export type PeerInfo = z.infer<typeof PeerSchema>;

/** Why the server refused: the browser shows its own text for each. */
export const REFUSALS = ['full', 'unknown-room', 'too-many-rooms', 'not-in-room', 'taken'] as const;
export type Refusal = (typeof REFUSALS)[number];

export const ServerMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('rooms'), rooms: z.array(RoomSummarySchema) }),
  z.object({
    t: z.literal('joined'),
    room: RoomSummarySchema,
    you: z.string(),
    peers: z.array(PeerSchema),
  }),
  z.object({ t: z.literal('left') }),
  z.object({ t: z.literal('refused'), reason: z.enum(REFUSALS), stationId: id.optional() }),
  z.object({ t: z.literal('peer'), peer: PeerSchema }),
  z.object({ t: z.literal('gone'), id: z.string() }),
  z.object({ t: z.literal('pose'), id: z.string(), pose: PoseSchema.nullable() }),
  z.object({ t: z.literal('locks'), locks: z.record(z.string(), z.string()) }),
  z.object({ t: z.literal('command'), id: z.string(), command: CommandSchema }),
  z.object({ t: z.literal('look'), id: z.string(), character: CharacterData }),
  z.object({ t: z.literal('event'), id: z.string(), event: RoomEventSchema }),
  z.object({ t: z.literal('chat'), id: z.string(), name: z.string(), text: z.string() }),
  z.object({ t: z.literal('signal'), id: z.string(), signal: SignalSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
