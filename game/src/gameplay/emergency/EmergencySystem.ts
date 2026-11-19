import type { EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Vec3 } from '../../core/math';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { DoorPair } from '../../world/campus';
import type { RoomDefinition, SceneDefinition } from '../../world/definitions';
import type { ItemDefinition } from '../item';
import { buildNavGrid, type NavGrid } from '../../world/navGrid';
import type { WorldEntity } from '../../world/World';
import type { DoorState } from '../door/DoorSystem';
import type { NpcDefinition } from '../npc/npc';
import { Walker, type WalkView } from '../npc/walker';
import { stepLength } from '../player/gait';
import type { ResponderSquad, SquadLine } from './squad';

/**
 * Emergency calls answered in the world (Phú 2026-11-13): a number on the player's phone (114 the
 * fire brigade; 113 or 911 the police) brings that squad by helicopter. It hovers over the hub,
 * blows a hole in the ceiling, and four of them slide down ropes. The fire brigade runs to every
 * fire and puts it out with their hoses; with nothing burning they find the caller, tell them off
 * and give them a slap. The police look round, puzzled, ask the nearest person of the world what is
 * wrong (nothing), then find the caller and warn them. Then all of them go back up the ropes, the
 * helicopter flies off, and the ceiling mends itself, slowly. A game, not a protocol.
 *
 * Gameplay only: where everyone and everything is, as numbers (`views`, `heli`, `breach`...); the
 * renderer and the interface draw and voice them. In a LAN room the caller's game drives it and the
 * others draw it from its snapshots (`snapshot`, `mirror`), as the teacher is shared.
 */

/** What a responder is doing (the renderer poses them by it). */
export type ResponderAction =
  'none' | 'rappel' | 'land' | 'walk' | 'look' | 'spray' | 'talk' | 'hit' | 'climb';

/** A responder as drawn: walked as a person of the world is, and up and down a rope. */
export interface ResponderView extends WalkView {
  readonly index: number;
  /** Height of their feet over their scene's floor (m): on a rope, over 0. */
  y: number;
  action: ResponderAction;
  /** Out of the helicopter (drawn), or not. */
  visible: boolean;
  /** What their hands or hose aim at (their scene's coordinates, m): the fire, the face slapped. */
  aimX: number;
  aimY: number;
  aimZ: number;
}

/** The helicopter, in the arrival scene's coordinates (m). */
export interface HelicopterView {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  /** The nose's heading (rad: 0 faces −z, as people's). */
  yaw: number;
  /** Bank and pitch while flying (rad), for the look. */
  bank: number;
  pitch: number;
  /** The rotor's speed, 0 (stopped) … 1 (flying). */
  rotor: number;
}

/** A line said now: who (as the subtitles name them), what, where (for its loudness); `n` counts. */
export interface EmergencyLine {
  readonly who: string;
  readonly text: string;
  readonly n: number;
  readonly sceneId: string;
  readonly x: number;
  readonly z: number;
}

export type EmergencyPhase =
  | 'idle'
  | 'inbound'
  | 'breach'
  | 'rappel'
  | 'mission'
  | 'regroup'
  | 'ascend'
  | 'outbound'
  | 'repair';

/** What travels to the other games of a LAN room, eight times a second. */
export interface EmergencySnapshot {
  squad: string;
  phase: EmergencyPhase;
  t: number;
  breach: number;
  blast: number;
  ropes: number;
  shake: number;
  heli: [number, number, number, number, number, number, number];
  /** Each responder: scene, x, y, z, heading, speed, action, visible, aim x, y, z, gesture. */
  people: [
    string,
    number,
    number,
    number,
    number,
    number,
    string,
    boolean,
    number,
    number,
    number,
    string,
  ][];
  line: { who: string; text: string; n: number; sceneId: string; x: number; z: number } | null;
}

export interface EmergencyDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  texts: Texts;
  squads: Registry<ResponderSquad>;
  scenes: Registry<SceneDefinition>;
  rooms: Registry<RoomDefinition>;
  itemOf: (id: string) => ItemDefinition | undefined;
  offsetOf: (sceneId: string) => Readonly<Vec3> | null;
  doorPairs?: readonly DoorPair[];
  doors?: DoorState;
  world?: {
    entity(id: string): WorldEntity | undefined;
    roomAt(x: number, z: number): RoomDefinition | null;
  };
  barred?: ReadonlySet<string>;
  /** The fires burning now (session frame) and a way to put water on one. */
  fires: {
    readonly list: readonly {
      readonly entityId: string;
      readonly position: Vec3;
      readonly radius: number;
    }[];
    douse(entityId: string, amount: number): void;
  };
  /** The other players of a LAN room: where they are (their scene's frame); none alone. */
  others?: () => readonly {
    readonly id: string;
    readonly sceneId: string | null;
    readonly x: number;
    readonly z: number;
  }[];
  /** The people of the world: where they are, and having one answer a responder. */
  people: {
    readonly views: readonly {
      readonly npc: NpcDefinition;
      readonly sceneId: string;
      readonly x: number;
      readonly z: number;
    }[];
    aside(npcId: string, sceneId: string, x: number, z: number, seconds: number): boolean;
    /** Everyone near (x, z) of `sceneId` startled by a blast, guarded for `seconds`. */
    startle(sceneId: string, x: number, z: number, seconds: number): void;
    /** `npcId` tells the player `text` once they come where they are (walking up to them). */
    remind(npcId: string, text: () => string): void;
    /** Everyone of `sceneId` (not otherwise taken) stands and watches (x, z) for `seconds`. */
    watch(sceneId: string, x: number, z: number, seconds: number): void;
  };
}

// ---- the timeline (s) --------------------------------------------------------------------------

/** From the call to the hover over the hole. */
const INBOUND_S = 8;
/** Hovering: the charge's three beeps, the blast at BLAST_AT, the dust. */
const BREACH_S = 3.4;
const BLAST_AT = 1.8;
/** The squad in the building: the people watch them; each word holds a moment (s). */
const WATCHED: ReadonlySet<EmergencyPhase> = new Set(['rappel', 'mission', 'regroup', 'ascend']);
const WATCH_HOLD_S = 1.5;
/** The ropes thrown down, then each one down after the one before. */
const ROPES_S = 0.7;
const STAGGER_S = 0.35;
const DESCENT_S = 2.6;
const UNCLIP_S = 0.7;
/** Back up: each climbs (winched) after the one before; the ropes come in after the last. */
const CLIMB_S = 3;
const RETRACT_S = 1;
const OUTBOUND_S = 7;
/** The ceiling mending itself, once the helicopter has gone. */
const REPAIR_S = 24;
/** Gone longer than this on a mission or on their way back (s), they are brought back. */
const MISSION_LIMIT_S = 150;
const REGROUP_LIMIT_S = 45;

/** Their pace (m/s): urgent, there and back. */
const RUN = 3.1;
/** Moved farther than this (m) in a frame, they were put there: not a walk. */
const JUMP_M = 1;
/** Slower than this (m/s), eased, they stand. */
const STILL_MPS = 0.05;
/** Slower than this (m/s) the feet shuffle: no footfall heard (as `Gait`). */
const STEPPING_MPS = 0.35;
/** Where in the swing a foot comes down (as `Gait`): at its ends, the legs farthest apart. */
const TURN = 2 * Math.PI;
const LEFT_DOWN = Math.PI / 2;
const RIGHT_DOWN = (3 * Math.PI) / 2;
/** Each responder's id in footsteps and walks (one per rope). */
const RESPONDER_IDS = ['responder-0', 'responder-1', 'responder-2', 'responder-3'];
/** A hose's knock on a fire, per second (each firefighter): a little over the extinguisher's. */
const HOSE_PER_S = 0.45;
/** How far from the fire's edge they stand to spray (m). */
const HOSE_STAND_M = 1.5;
/** Hover height over the ceiling (m); the skids' top under the hover point (where they step off). */
const HOVER_OVER_M = 5;
/** Telling off: within this (m) they talk; to slap, this close; past FLED_M the player ran off. */
const REACH_M = 0.95;
/** Stunned by the blast: none this far (m) from under the hole; it fades over STUN_S (s). */
const STUN_M = 18;
const STUN_S = 7;
const KEEP_M = 1.8;
const SLAP_M = 1.1;
const FLED_M = 10;
/** How long (s) they chase a player who is not yet near before calling after them instead. */
const CHASE_S = 12;
export const DOOR_UNDER_M = 1.1;
/**
 * Where the ropes hang from, in the helicopter's frame (m: right, forward): outside the skids, at
 * the front and back of each open door. Over the hub a body on one stays half a metre or more clear
 * of the emblem's two rings (the planes x = 0 and z = −3 of the hall).
 */
export const ROPES: readonly [number, number][] = [
  [-1.45, 0.8],
  [-1.45, -0.8],
  [1.45, 0.8],
  [1.45, -0.8],
];

const smooth = (u: number) => {
  const v = Math.min(1, Math.max(0, u));
  return v * v * (3 - 2 * v);
};

/** How long a line stays up (s): long enough to read (and to be said). */
const lineSeconds = (text: string) => Math.max(2.6, text.length / 13);

/** One responder's job, step by step (the driver's game only). */
interface Plan {
  step:
    | 'down'
    | 'unclip'
    | 'look'
    | 'go-fire'
    | 'spray'
    | 'go-ask'
    | 'ask'
    | 'go-caller'
    | 'scold'
    | 'hit'
    | 'follow'
    | 'back'
    | 'ready'
    | 'up'
    | 'gone';
  timer: number;
  fire: string | null;
}

export class EmergencySystem implements GameSystem {
  readonly id = 'emergency';
  squad: ResponderSquad | null = null;
  phase: EmergencyPhase = 'idle';
  /** Seconds into the phase. */
  t = 0;
  /** The hole in the ceiling, 0 (whole) … 1 (blown open); it mends back to 0. */
  breach = 0;
  /** Seconds since the blast (−1: none in this call): the flash, the debris, the dust. */
  blast = -1;
  /** The ropes let down, 0 … 1 (their length). */
  ropes = 0;
  /** The camera's shake, 0 … 1 (the blast, a slap). */
  shake = 0;
  /**
   * How stunned this game's player is, 0 … 1 (Phú 2026-11-14): by the blast, the nearer the more
   * (1 under the hole, none past STUN_M or in another scene); a little by a slap. Fades over
   * STUN_S. Their own: never sent to the room.
   */
  stun = 0;
  readonly heli: HelicopterView = {
    visible: false,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    bank: 0,
    pitch: 0,
    rotor: 0,
  };
  readonly views: ResponderView[] = [];
  /** Where each rope hangs (the arrival scene's x, z). */
  readonly ropeAt: [number, number][] = ROPES.map(() => [0, 0]);
  line: EmergencyLine | null = null;
  /** The other player of the LAN room whose call this is (their game drives it), or null. */
  drivenBy: string | null = null;
  /** The people startled for this blast; the scenes told to watch this frame (scratch). */
  private reacted = false;
  private readonly watched = new Set<string>();
  private sinceSnapshot = 0;
  private lines = 0;
  private lineLeft = 0;
  private readonly plans: Plan[] = [];
  private readonly walkers: Walker[] = [];
  private readonly placements: { resident: boolean; ox: number; oz: number }[] = [];
  /** Where each one's feet were last frame (session frame) and the pace they really went at. */
  private readonly feet: { x: number; z: number; speed: number; known: boolean }[] = [];
  /** A footstep heard (reused: read during the call). */
  private readonly step: GameEvents['NpcFootstep'] & { position: Vec3 } = {
    npcId: '',
    foot: 'left',
    speed: 0,
    position: [0, 0, 0],
  };
  private readonly grids = new Map<string, NavGrid | null>();
  /** The mission: the leader's progress through it (the others follow the leader). */
  private stage = 0;
  private stageT = 0;
  private sinceMission = 0;

  constructor(private readonly deps: EmergencyDeps) {}

  /** Seconds until they come down the ropes (the phone shows it), or null. */
  get eta(): number | null {
    if (this.phase === 'inbound') return INBOUND_S - this.t + BREACH_S + ROPES_S + DESCENT_S;
    if (this.phase === 'breach') return BREACH_S - this.t + ROPES_S + DESCENT_S;
    return null;
  }

  /** On a call now (from the call until the ceiling has mended). */
  get active(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * The phone's call: a squad's number sends them (unless one is already on a call); 115 is a
   * service the game does not have; any other number does not answer.
   */
  call(number: string): GameEvents['EmergencyCall']['outcome'] {
    const digits = number.replace(/\D/g, '');
    const squad = this.deps.squads.all().find((s) => s.numbers.includes(digits));
    let outcome: GameEvents['EmergencyCall']['outcome'];
    if (squad) {
      if (this.active) outcome = 'already-coming';
      else {
        // The how-manieth call to them (saved): what they say goes by it.
        const calls = this.deps.state.progression.calls;
        calls[squad.id] = (calls[squad.id] ?? 0) + 1;
        this.callNo = calls[squad.id] ?? 1;
        this.start(squad);
        outcome = 'dispatched';
      }
    } else if (digits === '115') outcome = 'other-service';
    else outcome = 'no-answer';
    this.deps.events.publish('EmergencyCall', { number: digits, outcome });
    return outcome;
  }

  update(dt: number): void {
    const { state } = this.deps;
    if (state.session.phase !== 'playing' || state.session.sceneId === null) {
      if (this.active) this.stop();
      return;
    }
    if (!this.squad || dt <= 0) return;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.stun = Math.max(0, this.stun - dt / STUN_S);
    if (this.blast >= 0) this.blast += dt;
    this.lineLeft -= dt;
    if (this.lineLeft <= 0) this.line = null;
    for (let i = 0; i < this.views.length; i++) this.place(i);
    this.react();
    if (this.drivenBy !== null) {
      // Drawn from the driver's snapshots; none for a while (they left the room): over.
      this.legs(dt);
      this.sinceSnapshot += dt;
      if (this.sinceSnapshot > 3) this.stop();
      return;
    }
    this.t += dt;
    this.fly();
    switch (this.phase) {
      case 'inbound':
        if (this.t >= INBOUND_S) this.next('breach');
        break;
      case 'breach':
        if (this.blast < 0 && this.t >= BLAST_AT) {
          this.blast = 0;
          this.breach = 1;
          this.shake = 1;
        }
        if (this.t >= BREACH_S) this.next('rappel');
        break;
      case 'rappel':
        this.rappel();
        break;
      case 'mission':
        this.sinceMission += dt;
        this.mission(dt);
        break;
      case 'regroup':
        this.regroup(dt);
        break;
      case 'ascend':
        this.ascend();
        break;
      case 'outbound':
        if (this.t >= OUTBOUND_S) {
          this.heli.visible = false;
          this.next('repair');
        }
        break;
      case 'repair':
        this.breach = Math.max(0, 1 - this.t / REPAIR_S);
        if (this.t >= REPAIR_S) this.stop();
        break;
      case 'idle':
        break;
    }
    this.legs(dt);
  }

  dispose(): void {
    this.stop();
  }

  // ---- LAN rooms ----------------------------------------------------------------------------------

  /** What the other games draw (the driver's game sends it). */
  snapshot(): EmergencySnapshot | null {
    const squad = this.squad;
    if (!squad) return null;
    const h = this.heli;
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    return {
      squad: squad.id,
      phase: this.phase,
      t: r3(this.t),
      breach: r3(this.breach),
      blast: r3(this.blast),
      ropes: r3(this.ropes),
      shake: r3(this.shake),
      heli: [h.visible ? 1 : 0, r3(h.x), r3(h.y), r3(h.z), r3(h.yaw), r3(h.bank), r3(h.rotor)],
      people: this.views.map((v) => [
        v.sceneId,
        r3(v.x),
        r3(v.y),
        r3(v.z),
        r3(v.heading),
        r3(v.speed),
        v.action,
        v.visible,
        r3(v.aimX),
        r3(v.aimY),
        r3(v.aimZ),
        v.gesture,
      ]),
      line: this.line && { ...this.line },
    };
  }

  /** Draws the call as the driver's game has it (`from`, another player of the room, called). */
  mirror(s: Readonly<EmergencySnapshot>, from: string): void {
    if (this.active && this.drivenBy === null) return; // this game's own call goes first
    if (s.phase === 'idle') {
      if (this.active) this.stop();
      return;
    }
    const squad = this.deps.squads.tryGet(s.squad);
    if (!squad) return;
    if (this.squad !== squad) this.start(squad);
    this.drivenBy = from;
    this.sinceSnapshot = 0;
    this.phase = s.phase;
    this.t = s.t;
    this.breach = s.breach;
    if (s.blast >= 0 && this.blast < 0) this.shake = Math.max(this.shake, s.shake);
    this.blast = s.blast;
    this.ropes = s.ropes;
    const [visible, x, y, z, yaw, bank, rotor] = s.heli;
    Object.assign(this.heli, { visible: visible === 1, x, y, z, yaw, bank, rotor });
    s.people.forEach((p, i) => {
      const v = this.views[i];
      if (!v) return;
      const [sceneId, px, py, pz, heading, speed, action, shown, ax, ay, az, gesture] = p;
      v.sceneId = sceneId;
      v.x = px;
      v.y = py;
      v.z = pz;
      v.heading = heading;
      v.speed = speed;
      v.action = action as ResponderAction;
      v.visible = shown;
      v.aimX = ax;
      v.aimY = ay;
      v.aimZ = az;
      v.gesture = gesture as WalkView['gesture'];
    });
    if (s.line && s.line.n !== this.line?.n) {
      this.line = { ...s.line };
      this.lineLeft = lineSeconds(s.line.text);
    }
  }

  /**
   * The people of the world react (Phú 2026-11-14), in every game — the one that calls and the
   * ones that draw it: whichever drives a person moves them (`people` leaves the others'). At the
   * blast they are startled, guarded until the first of the squad is seen on a rope; while the
   * squad is in the building they stand and watch them where they are, their own business left
   * (a book put down); once the squad has gone back up, their day goes on.
   */
  private react(): void {
    const squad = this.squad;
    if (!squad) return;
    if (this.blast >= 0 && !this.reacted) {
      this.reacted = true;
      const [ax, az] = squad.arrival.at;
      this.deps.people.startle(squad.arrival.scene, ax, az, BREACH_S - BLAST_AT + ROPES_S + 0.5);
      // This game's player, stunned by it if in the hall (a game joining later is not).
      const self = this.caller();
      if (self && self.sceneId === squad.arrival.scene && this.blast < 0.5) {
        const d = Math.hypot(self.x - ax, self.z - az);
        this.stun = Math.max(this.stun, Math.min(1, Math.max(0, 1.15 - (1.15 * d) / STUN_M)));
      }
    } else if (this.blast < 0) this.reacted = false;
    if (!WATCHED.has(this.phase)) return;
    // Each scene the squad is in: where they are, on the whole.
    for (const v of this.views) {
      if (!v.visible || this.watched.has(v.sceneId)) continue;
      let x = 0;
      let z = 0;
      let n = 0;
      for (const o of this.views) {
        if (!o.visible || o.sceneId !== v.sceneId) continue;
        x += o.x;
        z += o.z;
        n++;
      }
      this.watched.add(v.sceneId);
      this.deps.people.watch(v.sceneId, x / n, z / n, WATCH_HOLD_S);
    }
    this.watched.clear();
  }

  // ---- the call ----------------------------------------------------------------------------------

  private start(squad: ResponderSquad): void {
    this.stop();
    this.squad = squad;
    this.targetId = undefined;
    const { arrival } = squad;
    this.phase = 'inbound';
    this.t = 0;
    this.breach = 0;
    this.blast = -1;
    this.ropes = 0;
    this.stage = 0;
    this.stageT = 0;
    this.sinceMission = 0;
    this.said.clear();
    const yaw = 0;
    ROPES.forEach(([right, forward], i) => {
      const at = this.ropeAt[i];
      if (!at) return;
      at[0] = arrival.at[0] + right * Math.cos(yaw) - forward * Math.sin(yaw);
      at[1] = arrival.at[1] - forward * Math.cos(yaw) - right * Math.sin(yaw);
    });
    const walk = {
      events: this.deps.events,
      offsetOf: (sceneId: string) => this.deps.offsetOf(sceneId),
      grid: (sceneId: string) => this.grid(sceneId),
      doorPairs: this.deps.doorPairs ?? [],
      doors: this.deps.doors,
      world: this.deps.world,
      barred: this.deps.barred ?? new Set<string>(),
    };
    for (let i = 0; i < 4; i++) {
      const [x, z] = this.ropeAt[i] ?? [0, 0];
      const view: ResponderView = {
        index: i,
        sceneId: arrival.scene,
        x,
        z,
        y: arrival.ceiling + HOVER_OVER_M - DOOR_UNDER_M,
        heading: Math.PI, // facing out of the door, towards +z
        speed: 0,
        sit: 0,
        gesture: 'idle',
        looking: false,
        lookX: 0,
        lookZ: 0,
        talking: false,
        point: null,
        card: false,
        reaching: false,
        reachX: 0,
        reachY: 0,
        reachZ: 0,
        stride: 0,
        progress: null,
        paper: 'none',
        paperX: 0,
        paperY: 0,
        paperZ: 0,
        pen: 'none',
        action: 'none',
        visible: false,
        aimX: 0,
        aimY: 0,
        aimZ: 0,
      };
      const placement = { resident: false, ox: 0, oz: 0 };
      this.views.push(view);
      this.placements.push(placement);
      this.feet.push({ x: 0, z: 0, speed: 0, known: false });
      const walker = new Walker(RESPONDER_IDS[i] ?? `responder-${i}`, view, placement, walk);
      walker.queue = i; // through a door the leader first, then one behind another
      this.walkers.push(walker);
      this.plans.push({ step: 'down', timer: 0, fire: null });
    }
    this.heli.visible = true;
    this.fly();
  }

  /** Over: everyone gone, the ceiling whole again (also when the player leaves the world). */
  private stop(): void {
    this.squad = null;
    this.drivenBy = null;
    this.phase = 'idle';
    this.t = 0;
    this.breach = 0;
    this.blast = -1;
    this.ropes = 0;
    this.shake = 0;
    this.stun = 0;
    this.heli.visible = false;
    this.line = null;
    this.views.length = 0;
    this.walkers.length = 0;
    this.placements.length = 0;
    this.feet.length = 0;
    this.plans.length = 0;
  }

  private next(phase: EmergencyPhase): void {
    this.phase = phase;
    this.t = 0;
  }

  /** Each responder's scene: resident (and where it starts) or not, for their walk. */
  private place(i: number): void {
    const v = this.views[i];
    const p = this.placements[i];
    if (!v || !p) return;
    const offset = this.deps.offsetOf(v.sceneId);
    p.resident = offset !== null;
    p.ox = offset?.[0] ?? 0;
    p.oz = offset?.[2] ?? 0;
  }

  /**
   * Their legs (Phú 2026-11-19: step for step with the ground they cover, never sliding): the
   * swing goes on by the distance each one really moved this frame, at the step length the body
   * draws for the pace (`stepLength`). In the game that drives the call the pace is the one they
   * really went at (eased), and none at once where they were stopped (a card to a reader, the
   * slap); the others' games keep the driver's pace and step by the snapshots' moves.
   */
  private legs(dt: number): void {
    const drives = this.drivenBy === null;
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      const feet = this.feet[i];
      if (!v || !feet) continue;
      const offset = this.deps.offsetOf(v.sceneId);
      if (!offset || !v.visible || v.action === 'rappel' || v.action === 'climb') {
        feet.known = false; // not on their feet here (or not drawn): nothing walked
        continue;
      }
      const x = v.x + offset[0];
      const z = v.z + offset[2];
      const moved = feet.known ? Math.hypot(x - feet.x, z - feet.z) : 0;
      feet.x = x;
      feet.z = z;
      feet.known = true;
      if (moved > JUMP_M) continue; // put there (back under a rope): not walked
      if (drives) {
        const eased = feet.speed + (moved / dt - feet.speed) * Math.min(1, dt * 10);
        feet.speed = v.speed === 0 ? 0 : eased; // stopped by their job: at once
        v.speed = moved === 0 && feet.speed < STILL_MPS ? 0 : feet.speed;
      }
      // Every bit of ground covered is stepped, however slow; a foot heard as it comes down.
      if (moved === 0) continue;
      const from = v.stride;
      const to = from + (moved * Math.PI) / stepLength(v.speed);
      v.stride = to % (2 * Math.PI);
      const down = (at: number) => (from < at && to >= at) || (from < at + TURN && to >= at + TURN);
      const foot = down(LEFT_DOWN) ? 'left' : down(RIGHT_DOWN) ? 'right' : null;
      if (!foot || v.speed < STEPPING_MPS) continue;
      const step = this.step;
      step.npcId = RESPONDER_IDS[i] ?? 'responder';
      step.foot = foot;
      step.speed = v.speed;
      step.position[0] = x;
      step.position[1] = offset[1];
      step.position[2] = z;
      this.deps.events.publish('NpcFootstep', step);
    }
  }

  // ---- the helicopter ----------------------------------------------------------------------------

  /** Where the helicopter is: coming in on a long curve, hovering (a little bob), flying off. */
  private fly(): void {
    const squad = this.squad;
    if (!squad) return;
    const h = this.heli;
    const [ax, az] = squad.arrival.at;
    const hoverY = squad.arrival.ceiling + HOVER_OVER_M;
    const bob = Math.sin(this.t * 1.3) * 0.12;
    if (this.phase === 'inbound') {
      const u = smooth(this.t / INBOUND_S);
      // From far off, high, coming in over the roof and slowing down to the hover.
      const fromX = ax + 90;
      const fromZ = az - 80;
      h.x = fromX + (ax - fromX) * u;
      h.z = fromZ + (az - fromZ) * u;
      h.y = hoverY + 26 * (1 - u) * (1 - u);
      const travel = Math.atan2(-(ax - fromX), -(az - fromZ));
      const turn = smooth((this.t - (INBOUND_S - 2.5)) / 2.5);
      h.yaw = travel + wrap(0 - travel) * turn;
      h.pitch = 0.18 * (1 - u) - 0.1 * smooth((this.t - (INBOUND_S - 1.6)) / 1.6);
      h.bank = 0.2 * Math.sin(Math.PI * u);
      h.rotor = 1;
    } else if (this.phase === 'outbound') {
      const u = smooth(this.t / OUTBOUND_S);
      h.x = ax - 110 * u * u;
      h.z = az + 60 * u * u;
      h.y = hoverY + 30 * u * u;
      h.yaw = wrap(0 + 1.0 * smooth(this.t / 2));
      h.pitch = 0.2 * smooth(this.t / 1.5);
      h.bank = -0.25 * Math.sin(Math.PI * Math.min(1, this.t / 3));
      h.rotor = 1;
    } else if (this.phase !== 'repair' && this.phase !== 'idle') {
      h.x = ax + Math.sin(this.t * 0.7) * 0.08;
      h.z = az;
      h.y = hoverY + bob;
      h.yaw = 0;
      h.pitch = 0;
      h.bank = Math.sin(this.t * 0.9) * 0.015;
      h.rotor = 1;
    }
  }

  // ---- down the ropes ----------------------------------------------------------------------------

  private rappel(): void {
    const squad = this.squad;
    if (!squad) return;
    this.ropes = Math.min(1, this.t / ROPES_S);
    const top = squad.arrival.ceiling + HOVER_OVER_M - DOOR_UNDER_M;
    let down = 0;
    this.views.forEach((v, i) => {
      const start = ROPES_S + i * STAGGER_S;
      const s = this.t - start;
      if (s < 0) return;
      v.visible = true;
      if (s < DESCENT_S) {
        // Fast down the rope, braking hard for the last metres.
        const u = s / DESCENT_S;
        const eased = u < 0.75 ? (u / 0.75) * 0.88 : 0.88 + 0.12 * smooth((u - 0.75) / 0.25);
        v.y = top * (1 - eased);
        v.action = 'rappel';
        v.speed = 0;
      } else if (s < DESCENT_S + UNCLIP_S) {
        v.y = 0;
        v.action = 'land';
      } else {
        v.y = 0;
        v.action = 'none';
        down++;
      }
    });
    if (down === this.views.length) {
      this.next('mission');
      this.stage = 0;
      this.stageT = 0;
      this.sayLine(0, 'arrive');
    }
  }

  // ---- the job ------------------------------------------------------------------------------------

  private mission(dt: number): void {
    const squad = this.squad;
    if (!squad) return;
    this.stageT += dt;
    if (this.sinceMission > MISSION_LIMIT_S) {
      this.leave();
      return;
    }
    if (squad.behavior === 'fire-rescue') this.fireRescue(dt, squad);
    else this.policeCheck(dt, squad);
  }

  /** The fire brigade: every fire out; with none, the caller told off, and slapped. */
  private fireRescue(dt: number, squad: ResponderSquad): void {
    const fires = this.deps.fires.list;
    if (this.stage === 0) {
      // Just landed: the fires, if any (one each, nearest first), else the caller.
      if (this.stageT < 1.2) {
        this.lookRound(dt);
        return;
      }
      this.stage = fires.length > 0 ? 1 : 10;
      this.stageT = 0;
    }
    if (this.stage === 1) {
      let busy = 0;
      this.views.forEach((v, i) => {
        const fire = this.fireFor(v, i);
        if (!fire) {
          this.follow(i, 0, dt);
          return;
        }
        busy++;
        const scene = this.sceneOf(fire.entityId);
        const offset = scene ? this.deps.offsetOf(scene) : null;
        if (!scene || !offset) return;
        const fx = fire.position[0] - offset[0];
        const fz = fire.position[2] - offset[2];
        const there = this.walkers[i]?.to(scene, fx, fz, RUN, dt, fire.radius + HOSE_STAND_M);
        if (there) {
          v.action = 'spray';
          v.speed = 0;
          v.aimX = fx;
          v.aimY = Math.max(0.2, fire.position[1] - offset[1] - 0.1);
          v.aimZ = fz;
          v.heading = Math.atan2(-(fx - v.x), -(fz - v.z));
          this.deps.fires.douse(fire.entityId, HOSE_PER_S * dt);
          if (this.stage === 1 && !this.said.has('work')) {
            this.said.add('work');
            this.sayLine(i, 'work');
          }
        } else v.action = 'walk';
      });
      if (busy === 0 && fires.length === 0) {
        this.views.forEach((v) => (v.action = 'none'));
        this.sayLine(0, 'done');
        this.stage = 20;
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 20) {
      if (this.stageT > 3) this.leave();
      return;
    }
    // No fire: to the caller, the telling off, the lesson, the slap.
    this.tellOff(dt, squad, true);
  }

  /** The police: puzzled, ask the nearest person of the world, then warn the caller. */
  private policeCheck(dt: number, squad: ResponderSquad): void {
    if (this.stage === 0) {
      this.lookRound(dt);
      if (this.stageT > 1.6 && this.lineFor('work') && !this.said.has('work')) {
        this.said.add('work');
        this.sayLine(1, 'work');
      }
      if (this.stageT > 4.5) {
        this.stage = 1;
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 1) {
      const person = this.nearestPerson();
      if (!person) {
        this.stage = 10;
        this.stageT = 0;
        return;
      }
      const leader = this.views[0];
      const there = this.walkers[0]?.to(person.sceneId, person.x, person.z, RUN, dt, 1.3);
      for (let i = 1; i < this.views.length; i++) this.follow(i, 0, dt);
      if (leader) leader.action = there ? 'talk' : 'walk';
      if (there && leader && this.lineFor('ask')) {
        leader.heading = Math.atan2(-(person.x - leader.x), -(person.z - leader.z));
        this.sayLine(0, 'ask');
        this.stage = 2;
        this.stageT = 0;
      } else if (there) {
        this.stage = 10;
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 2) {
      const person = this.nearestPerson();
      const leader = this.views[0];
      const ask = this.lineFor('ask');
      const answerLine = this.lineFor('answer');
      const wait = ask ? lineSeconds(this.deps.texts.of(ask, 'text')) : 2;
      if (this.stageT > wait && person && leader && answerLine) {
        const seconds = lineSeconds(this.deps.texts.of(answerLine, 'text'));
        this.deps.people.aside(person.npc.id, leader.sceneId, leader.x, leader.z, seconds + 0.5);
        this.sayAs(
          this.deps.texts.of(person.npc, 'title'),
          answerLine,
          person.sceneId,
          person.x,
          person.z,
        );
        this.stage = 3;
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 3) {
      const answerLine = this.lineFor('answer');
      const wait = answerLine ? lineSeconds(this.deps.texts.of(answerLine, 'text')) + 0.4 : 1;
      if (this.stageT > wait) {
        this.stage = 10;
        this.stageT = 0;
      }
      return;
    }
    this.tellOff(dt, squad, false);
  }

  /**
   * Off to the player they tell off — the one nearest them in the hall where they came down (Phú
   * 2026-11-14: who they can see; in a LAN room another player may be nearer than the caller);
   * the leader tells them off, then the lesson (a slap). With no player in the hall (in a lab, in
   * the teacher's room) they ask the person of the world there instead (`nobodyThere`).
   */
  private tellOff(dt: number, squad: ResponderSquad, slap: boolean): void {
    const leader = this.views[0];
    if (!leader) return;
    if (this.stage === 10 && this.targetId === undefined) {
      this.targetId = this.nearestPlayer();
      if (this.targetId === undefined) {
        this.stage = 30;
        this.stageT = 0;
      }
    }
    if (this.stage >= 30) {
      this.nobodyThere(dt, squad);
      return;
    }
    const caller = this.targetOf(this.targetId ?? null);
    if (!caller) {
      this.leave(); // the one they came for has gone (left the room)
      return;
    }
    for (let i = 1; i < this.views.length; i++) this.follow(i, 0, dt);
    const same = caller.sceneId === leader.sceneId;
    const away = same ? Math.hypot(caller.x - leader.x, caller.z - leader.z) : Infinity;
    const seconds = (l: SquadLine | undefined) =>
      l ? lineSeconds(this.deps.texts.of(l, 'text')) : 1;
    // Run off too far (or out of the hall) while they come or talk: told off from where they stand.
    if (this.stage !== 14 && away > FLED_M && (this.stage > 10 || this.stageT > CHASE_S)) {
      this.sayLine(0, 'fled');
      this.stage = 14;
      this.stageT = 0;
    }
    if (same) {
      leader.heading = Math.atan2(-(caller.x - leader.x), -(caller.z - leader.z));
      leader.looking = true;
      leader.lookX = caller.x;
      leader.lookZ = caller.z;
    }
    if (this.stage === 14) {
      // Stood calling after them, then off.
      leader.action = 'talk';
      leader.speed = 0;
      if (this.stageT > seconds(this.lineFor('fled'))) this.leave();
      return;
    }
    // Up to them; while talking, kept close: they step away, he steps after, at their pace (to the
    // same distance, so he walks beside a walking caller instead of running in and stopping).
    const keep =
      this.stage === 10
        ? REACH_M
        : this.stage === 13 && !this.said.has('swing')
          ? SLAP_M - 0.1
          : KEEP_M;
    const near =
      away <= keep ||
      (this.walkers[0]?.to(caller.sceneId, caller.x, caller.z, RUN, dt, keep) ?? false);
    if (this.stage === 10) {
      leader.action = near ? 'talk' : 'walk';
      if (near) {
        this.sayLine(0, 'scold');
        this.stage = 11;
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 11 || this.stage === 12) leader.action = near ? 'talk' : 'walk';
    if (this.stage === 11 && this.stageT > seconds(this.lineFor('scold'))) {
      this.sayLine(0, 'lesson');
      this.stage = 12;
      this.stageT = 0;
      return;
    }
    if (this.stage === 12 && this.stageT > seconds(this.lineFor('lesson'))) {
      if (!slap) {
        this.leave();
        return;
      }
      this.stage = 13;
      this.stageT = 0;
    }
    if (this.stage === 13) {
      // The slap, only up close (Phú 2026-11-14): run in first; there, the hand drawn back, then
      // across the face (their screen flashes).
      if (!this.said.has('swing') && away > SLAP_M) {
        leader.action = 'walk';
        this.stageT = 0;
        return;
      }
      this.said.add('swing');
      leader.action = 'hit';
      leader.speed = 0;
      leader.aimX = caller.x;
      leader.aimY = 1.5;
      leader.aimZ = caller.z;
      if (this.stageT > 0.42 && !this.said.has('slap')) {
        this.said.add('slap');
        if (away > SLAP_M + 0.6) {
          // Stepped back out of reach in the swing: it misses; no flash.
        } else if (this.targetId) {
          // Another player's: their game flashes their screen (`PeerHit` goes to them).
          this.deps.events.publish('PeerHit', { id: this.targetId, speed: 4 });
        } else {
          this.shake = Math.max(this.shake, 0.7);
          this.stun = Math.max(this.stun, 0.35);
          const p = this.deps.state.player;
          p.yaw += 0.22;
          p.pitch = Math.max(-1.2, p.pitch - 0.08);
          this.deps.events.publish('PlayerHit', { entityId: `responder:${squad.id}`, speed: 4 });
        }
      }
      if (this.stageT > 1.1) this.leave();
    }
  }

  private readonly said = new Set<string>();
  /** This call's number to its squad: 1 the first ever (progression.calls). */
  private callNo = 1;

  /** Squad line `key` for this call (the 1st call's, the 2nd's…; past the last, the last). */
  private lineFor(key: keyof ResponderSquad['lines']): SquadLine | undefined {
    const list = this.squad?.lines[key];
    return list ? list[Math.min(this.callNo, list.length) - 1] : undefined;
  }

  /** Responder `i` says this call's line `key` (if the squad has one). */
  private sayLine(i: number, key: keyof ResponderSquad['lines']): void {
    const l = this.lineFor(key);
    if (l) this.say(i, l);
  }
  /** Who they tell off: undefined not chosen yet, null this game's player, else another's id. */
  private targetId: string | null | undefined = undefined;

  /**
   * No player in the hall: to the person of the world there (the teacher); the fire brigade asks
   * them first (the police have asked already) and hears the answer; then they ask them to keep an
   * eye on the students, and that person will tell the caller off when they come (`remind`).
   */
  private nobodyThere(dt: number, squad: ResponderSquad): void {
    const leader = this.views[0];
    const person = this.nearestPerson();
    if (!leader || !person) {
      this.leave();
      return;
    }
    for (let i = 1; i < this.views.length; i++) this.follow(i, 0, dt);
    const seconds = (l: SquadLine | undefined) =>
      l ? lineSeconds(this.deps.texts.of(l, 'text')) : 0;
    const face = () => {
      if (person.sceneId !== leader.sceneId) return;
      leader.heading = Math.atan2(-(person.x - leader.x), -(person.z - leader.z));
      leader.looking = true;
      leader.lookX = person.x;
      leader.lookZ = person.z;
    };
    if (this.stage === 30) {
      const there = this.walkers[0]?.to(person.sceneId, person.x, person.z, RUN, dt, 1.3);
      leader.action = there ? 'talk' : 'walk';
      if (!there && this.stageT < 30) return;
      face();
      const asks = squad.behavior === 'fire-rescue' && this.lineFor('ask') && !this.said.has('ask');
      if (asks && this.lineFor('ask')) {
        this.said.add('ask');
        this.sayLine(0, 'ask');
        this.stage = 31;
      } else this.stage = 33;
      this.stageT = 0;
      return;
    }
    face();
    if (this.stage === 31 && this.stageT > seconds(this.lineFor('ask'))) {
      const answerLine = this.lineFor('answer');
      if (answerLine) {
        const answer = seconds(answerLine);
        this.deps.people.aside(person.npc.id, leader.sceneId, leader.x, leader.z, answer + 0.5);
        this.sayAs(
          this.deps.texts.of(person.npc, 'title'),
          answerLine,
          person.sceneId,
          person.x,
          person.z,
        );
      }
      this.stage = 32;
      this.stageT = 0;
      return;
    }
    if (this.stage === 32 && this.stageT > seconds(this.lineFor('answer')) + 0.4) {
      this.stage = 33;
      this.stageT = 0;
      return;
    }
    if (this.stage === 33) {
      const remind = this.lineFor('remind');
      if (remind) {
        this.say(0, remind);
        // They listen to it, turned to the leader; and will see to the caller.
        this.deps.people.aside(person.npc.id, leader.sceneId, leader.x, leader.z, seconds(remind));
      }
      const followUp = this.lineFor('followUp');
      if (followUp)
        this.deps.people.remind(person.npc.id, () => this.deps.texts.of(followUp, 'text'));
      this.stage = 34;
      this.stageT = 0;
      return;
    }
    if (this.stage === 34 && this.stageT > seconds(this.lineFor('remind')) + 0.4) this.leave();
  }

  /** The player nearest the leader in the hall they came down into: null this game's, an id another's; undefined none. */
  private nearestPlayer(): string | null | undefined {
    const leader = this.views[0];
    const scene = this.squad?.arrival.scene;
    if (!leader || !scene) return undefined;
    let best: string | null | undefined = undefined;
    let near = Infinity;
    const self = this.caller();
    if (self && self.sceneId === scene) {
      best = null;
      near = Math.hypot(self.x - leader.x, self.z - leader.z);
    }
    for (const other of this.deps.others?.() ?? []) {
      if (other.sceneId !== scene) continue;
      const d = Math.hypot(other.x - leader.x, other.z - leader.z);
      if (d < near) {
        near = d;
        best = other.id;
      }
    }
    return best;
  }

  /** Where the player `id` is now (null this game's), in their scene's frame; null if gone. */
  private targetOf(id: string | null): { sceneId: string; x: number; z: number } | null {
    if (id === null) return this.caller();
    const other = (this.deps.others?.() ?? []).find((o) => o.id === id);
    return other?.sceneId ? { sceneId: other.sceneId, x: other.x, z: other.z } : null;
  }

  /** The job done: the leader calls them back to the ropes. */
  private leave(): void {
    const squad = this.squad;
    if (!squad) return;
    this.sayLine(0, 'leave');
    for (const v of this.views) {
      v.action = 'walk';
      v.looking = false;
    }
    this.next('regroup');
  }

  /** Each to their rope, then up. */
  private regroup(dt: number): void {
    const squad = this.squad;
    if (!squad) return;
    let ready = 0;
    this.views.forEach((v, i) => {
      const [x, z] = this.ropeAt[i] ?? [0, 0];
      const there =
        this.t > REGROUP_LIMIT_S ||
        (this.walkers[i]?.to(squad.arrival.scene, x, z, RUN, dt, 0) ?? false);
      if (there) {
        if (this.t > REGROUP_LIMIT_S) {
          // Lost on the way (a door that would not open): back under their rope.
          v.sceneId = squad.arrival.scene;
          v.x = x;
          v.z = z;
        }
        v.action = 'none';
        v.speed = 0;
        v.heading = Math.PI;
        ready++;
      } else v.action = 'walk';
    });
    if (ready === this.views.length) this.next('ascend');
  }

  private ascend(): void {
    const squad = this.squad;
    if (!squad) return;
    const top = squad.arrival.ceiling + HOVER_OVER_M - DOOR_UNDER_M;
    let up = 0;
    this.views.forEach((v, i) => {
      const s = this.t - i * STAGGER_S;
      if (s <= 0) return;
      v.action = 'climb';
      v.speed = 0;
      // Winched up: slow to start, steady, slowing into the door.
      v.y = top * smooth(s / CLIMB_S);
      if (s >= CLIMB_S) {
        v.visible = false;
        up++;
      }
    });
    const last = (this.views.length - 1) * STAGGER_S + CLIMB_S;
    this.ropes = up === this.views.length ? Math.max(0, 1 - (this.t - last) / RETRACT_S) : 1;
    if (up === this.views.length && this.ropes <= 0) this.next('outbound');
  }

  // ---- what they go to ---------------------------------------------------------------------------

  /** Looking round, puzzled: turning this way and that, where they stand. */
  private lookRound(dt: number): void {
    this.views.forEach((v, i) => {
      v.action = 'look';
      v.speed = 0;
      v.heading += Math.sin(this.stageT * 1.7 + i * 1.9) * dt * 1.4;
      v.gesture = 'listen';
    });
  }

  /** Responder `i` keeps by the leader (or the one given), a little behind and aside. */
  private follow(i: number, of: number, dt: number): void {
    const v = this.views[i];
    const lead = this.views[of];
    if (!v || !lead || i === of) return;
    const side = (i % 2 === 0 ? 1 : -1) * (0.8 + 0.3 * i);
    const back = 1.1 + 0.4 * i;
    const x = lead.x - Math.sin(lead.heading) * -back + Math.cos(lead.heading) * side;
    const z = lead.z - Math.cos(lead.heading) * -back - Math.sin(lead.heading) * side;
    const there = this.walkers[i]?.to(lead.sceneId, x, z, RUN, dt, 0.3) ?? false;
    v.action = there ? 'none' : 'walk';
    if (there) {
      v.looking = true;
      v.lookX = lead.lookX || lead.x;
      v.lookZ = lead.lookZ || lead.z;
    }
  }

  /** The fire responder `i` sees to: theirs while it burns, else the nearest one left. */
  private fireFor(v: ResponderView, i: number) {
    const fires = this.deps.fires.list;
    const plan = this.plans[i];
    if (!plan) return null;
    const kept = fires.find((f) => f.entityId === plan.fire);
    if (kept) return kept;
    let best: (typeof fires)[number] | null = null;
    let near = Infinity;
    const offset = this.deps.offsetOf(v.sceneId);
    for (let k = 0; k < fires.length; k++) {
      const f = fires[(k + i) % fires.length];
      if (!f) continue;
      const d = offset
        ? Math.hypot(f.position[0] - (v.x + offset[0]), f.position[2] - (v.z + offset[2]))
        : k;
      if (d < near) {
        near = d;
        best = f;
      }
    }
    plan.fire = best?.entityId ?? null;
    return best;
  }

  /** The person of the world nearest the leader (in the same scene first). */
  private nearestPerson() {
    const leader = this.views[0];
    let best: EmergencyDeps['people']['views'][number] | null = null;
    let near = Infinity;
    for (const person of this.deps.people.views) {
      const d =
        leader && person.sceneId === leader.sceneId
          ? Math.hypot(person.x - leader.x, person.z - leader.z)
          : 1000;
      if (d < near) {
        near = d;
        best = person;
      }
    }
    return best;
  }

  /** The caller: the player, in their scene's coordinates. */
  private caller(): { sceneId: string; x: number; z: number } | null {
    const { player } = this.deps.state;
    const roomId = player.roomId;
    const scene = roomId
      ? this.deps.scenes.all().find((s) => s.kind === 'world' && s.rooms.includes(roomId))
      : undefined;
    const sceneId = scene?.id ?? this.deps.state.session.sceneId;
    const offset = sceneId ? this.deps.offsetOf(sceneId) : null;
    if (!sceneId || !offset) return null;
    return { sceneId, x: player.position[0] - offset[0], z: player.position[2] - offset[2] };
  }

  /** The scene a fire's entity is in (its room's). */
  private sceneOf(entityId: string): string | null {
    const roomId = entityId.split('/')[0] ?? '';
    return (
      this.deps.scenes.all().find((s) => s.kind === 'world' && s.rooms.includes(roomId))?.id ?? null
    );
  }

  // ---- lines --------------------------------------------------------------------------------------

  private say(i: number, line: SquadLine): void {
    const v = this.views[i];
    const squad = this.squad;
    if (!v || !squad) return;
    this.sayAs(this.deps.texts.of(squad, 'title'), line, v.sceneId, v.x, v.z);
  }

  private sayAs(who: string, line: SquadLine, sceneId: string, x: number, z: number): void {
    const text = this.deps.texts.of(line, 'text');
    this.line = { who, text, n: ++this.lines, sceneId, x, z };
    this.lineLeft = lineSeconds(text);
  }

  private grid(sceneId: string): NavGrid | null {
    if (this.grids.has(sceneId)) return this.grids.get(sceneId) ?? null;
    const scene = this.deps.scenes.tryGet(sceneId);
    const rooms =
      scene?.kind === 'world' ? scene.rooms.flatMap((id) => this.deps.rooms.tryGet(id) ?? []) : [];
    const grid = rooms.length > 0 ? buildNavGrid(rooms, this.deps.itemOf) : null;
    this.grids.set(sceneId, grid);
    return grid;
  }
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
