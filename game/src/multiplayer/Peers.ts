import type { EventBus } from '../core/EventBus';
import type { GameSystem } from '../core/SystemRunner';
import type { Texts } from '../core/i18n';
import type { GameEvents } from '../game/GameEvents';
import { CharacterDefinitionSchema, type CharacterDefinition } from '../gameplay/character';
import type { Vec3 } from '../core/math';
import type { PeerInfo, Pose, RoomEvent, RoomSummary } from './protocol';

/** Another player in the room, as drawn: where they are now, eased towards their last pose. */
export interface RemotePlayer {
  readonly id: string;
  readonly name: string;
  /** A new object when it changes: the renderer builds their body again. */
  character: CharacterDefinition;
  /** Their scene, or null (on the menu, or nothing heard yet). */
  sceneId: string | null;
  /** Feet in their scene's own frame (m), facing (rad), walk speed (m/s). */
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  /** Their last pose heard, or null (what they wear, hold and do: read from it). */
  target: Pose | null;
  /** Their body in this game's world (m, feet), while their scene is resident here; else null. */
  body: Vec3 | null;
  /** A capsule stands for them in physics (no one walks through them). */
  bodied: boolean;
}

/** Something another player threw, flying as thrown in this game (drawn; it touches nothing). */
export interface ThrownGhost {
  readonly item: string;
  /** World position (m) and velocity (m/s). */
  readonly at: [number, number, number];
  readonly v: [number, number, number];
  seconds: number;
}

/** The physics port: a kinematic capsule per person (`PhysicsSystem.placeAgent`). */
export interface AgentsPort {
  placeAgent(id: string, x: number, z: number, height: number): void;
  removeAgent(id: string): void;
}

export interface PeersDeps {
  events: EventBus<GameEvents>;
  texts: Texts;
  /** Drawn for a player whose character this game does not accept. */
  fallback: CharacterDefinition;
  /** Where a scene is in this game's world, or null while it is not resident. */
  offsetOf?: (sceneId: string) => Readonly<Vec3> | null;
  agents?: AgentsPort;
}

/** A ghost of a throw is followed this long (s); it rests on the floor once it gets there. */
const GHOST_S = 2.5;
const GRAVITY = 9.81;

/** How fast a drawn player catches up with their last pose (1/s): ~0.1 s behind at 15 poses/s. */
const EASE = 14;
/** Farther than this (m) from their last pose, a player is placed there at once (a door, a load). */
const SNAP_M = 3;

/**
 * The room this game is in and the other players in it (Phase M), runtime only — never saved.
 * The platform's room client writes what the server says; the renderer draws `players`; the
 * StationSystem asks `holder` whether another player works a station. Who is in the room, who
 * works which station: the server's word, never guessed here.
 */
export class Peers implements GameSystem {
  readonly id = 'peers';
  room: RoomSummary | null = null;
  /** This game's id in the room. */
  you: string | null = null;
  private readonly byId = new Map<string, RemotePlayer>();
  /** The others, in the order they came (read every frame by the renderer). */
  readonly players: RemotePlayer[] = [];
  private locks: Readonly<Record<string, string>> = {};
  /** The others' throws, flying here (read every frame by the renderer). */
  readonly ghosts: ThrownGhost[] = [];

  constructor(private readonly deps: PeersDeps) {}

  dispose(): void {
    this.clear();
  }

  joined(room: RoomSummary, you: string, peers: readonly PeerInfo[]): void {
    this.clear();
    this.room = room;
    this.you = you;
    for (const peer of peers) this.add(peer);
    this.changed();
  }

  left(): void {
    if (!this.room) return;
    this.clear();
    this.changed();
  }

  /** The room list's newer count of this room. */
  summary(room: RoomSummary): void {
    if (this.room?.id !== room.id) return;
    this.room = room;
    this.changed();
  }

  peer(info: PeerInfo): void {
    if (this.byId.has(info.id) || info.id === this.you) return;
    this.add(info);
    this.deps.events.publish('PeerJoined', { name: info.name });
    this.changed();
  }

  gone(id: string): void {
    const player = this.byId.get(id);
    if (!player) return;
    this.byId.delete(id);
    this.players.splice(this.players.indexOf(player), 1);
    this.unbody(player);
    this.deps.events.publish('PeerLeft', { name: player.name });
    this.changed();
  }

  pose(id: string, pose: Pose | null): void {
    const player = this.byId.get(id);
    if (!player) return;
    player.target = pose;
    const jump =
      pose === null ||
      player.sceneId !== pose.scene ||
      Math.hypot(pose.x - player.x, pose.z - player.z) > SNAP_M;
    player.sceneId = pose?.scene ?? null;
    if (pose && jump) {
      player.x = pose.x;
      player.y = pose.y;
      player.z = pose.z;
      player.heading = pose.yaw;
      player.speed = pose.speed;
    }
  }

  look(id: string, character: unknown): void {
    const player = this.byId.get(id);
    if (player) player.character = this.character(character);
  }

  setLocks(locks: Readonly<Record<string, string>>): void {
    this.locks = locks;
  }

  /** The name of the other player who works `stationId`, or null (no one, or this game). */
  holder(stationId: string): string | null {
    const id = this.locks[stationId];
    if (id === undefined || id === this.you) return null;
    return this.byId.get(id)?.name ?? null;
  }

  /** The station `stationId` is someone else's: the player reads whose. */
  refused(stationId: string): void {
    const name = this.holder(stationId);
    // A person of the world: their talk action says who has them.
    if (name === null || stationId.startsWith('npc:')) return;
    this.deps.events.publish('ActionBlocked', {
      entityId: stationId,
      actionId: 'shared',
      reason: this.deps.texts.ui('room.stationTaken', '{name} is working this apparatus.', {
        name,
      }),
    });
  }

  /**
   * Another player's event (Phase F-3): a hit on this player (`PlayerHit`), a throw (a ghost
   * flies here). States and the world's people are the room client's (it holds the systems).
   */
  event(from: string, event: RoomEvent): void {
    if (!this.byId.has(from)) return;
    if (event.k === 'hit' && event.target === this.you) {
      this.deps.events.publish('PlayerHit', { entityId: `peer:${from}`, speed: event.speed });
    } else if (event.k === 'throw') {
      const offset = this.deps.offsetOf?.(event.scene);
      if (!offset) return;
      const [x, y, z] = event.from;
      if (this.ghosts.length >= 8) this.ghosts.shift();
      this.ghosts.push({
        item: event.item,
        at: [x + offset[0], y + offset[1], z + offset[2]],
        v: [event.v[0], event.v[1], event.v[2]],
        seconds: 0,
      });
    }
  }

  update(dt: number): void {
    const step = Math.max(dt, 0);
    const k = 1 - Math.exp(-EASE * step);
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      if (!g) continue;
      g.seconds += step;
      if (g.seconds > GHOST_S) {
        this.ghosts.splice(i, 1);
        continue;
      }
      if (g.at[1] <= 0.05 && g.v[1] <= 0) continue; // on the floor
      g.v[1] -= GRAVITY * step;
      g.at[0] += g.v[0] * step;
      g.at[1] = Math.max(0.05, g.at[1] + g.v[1] * step);
      g.at[2] += g.v[2] * step;
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const t = p?.target;
      if (!p) continue;
      this.place(p);
      if (!t) continue;
      p.x += (t.x - p.x) * k;
      p.y += (t.y - p.y) * k;
      p.z += (t.z - p.z) * k;
      p.speed += (t.speed - p.speed) * k;
      let turn = t.yaw - p.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      p.heading += turn * k;
    }
  }

  private add(info: PeerInfo): void {
    const player: RemotePlayer = {
      id: info.id,
      name: info.name,
      character: this.character(info.character),
      sceneId: null,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      speed: 0,
      target: null,
      body: null,
      bodied: false,
    };
    this.byId.set(info.id, player);
    this.players.push(player);
  }

  /** Another player's character, checked in full (the server only relays it). */
  private character(data: unknown): CharacterDefinition {
    return CharacterDefinitionSchema.safeParse(data).data ?? this.deps.fallback;
  }

  /** Their body in this world and their capsule in physics, while their scene is resident. */
  private place(p: RemotePlayer): void {
    const offset = p.sceneId && p.target ? this.deps.offsetOf?.(p.sceneId) : null;
    if (!offset) {
      p.body = null;
      this.unbody(p);
      return;
    }
    const x = p.x + offset[0];
    const y = p.y + offset[1];
    const z = p.z + offset[2];
    if (p.body) {
      p.body[0] = x;
      p.body[1] = y;
      p.body[2] = z;
    } else p.body = [x, y, z];
    this.deps.agents?.placeAgent(`peer:${p.id}`, x, z, p.character.appearance.heightM);
    p.bodied = this.deps.agents !== undefined;
  }

  private unbody(p: RemotePlayer): void {
    if (!p.bodied) return;
    this.deps.agents?.removeAgent(`peer:${p.id}`);
    p.bodied = false;
  }

  private clear(): void {
    for (const p of this.players) this.unbody(p);
    this.ghosts.length = 0;
    this.room = null;
    this.you = null;
    this.byId.clear();
    this.players.length = 0;
    this.locks = {};
  }

  private changed(): void {
    this.deps.events.publish('RoomChanged', {});
  }
}
