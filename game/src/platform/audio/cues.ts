import type { Disposables } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { handPoint } from '../../gameplay/action/handPoint';
import { arrivalRoom, type HungPlacement, hungUnder } from '../../gameplay/emergency/hung';
import type { ResponderSquad } from '../../gameplay/emergency/squad';
import { LIGHTS_OFF } from '../../gameplay/interaction/behaviors';
import type { RoomDefinition } from '../../world/definitions';
import type { Bank, Cue } from './bank';
import { roomRt60 } from './synth';

/** What the cues ask of the sound engine (AudioView; a recorder in tests). */
export interface SoundOut {
  /** Plays a sound once: at a point of the world (or everywhere), after `delay` s, `gain` × its volume. */
  play(soundId: string, at: Vec3 | null, delay?: number, gain?: number): void;
  /** The room the player is in: its air (a looped sound, or none) and its reverberation time (s). */
  room(roomId: string, ambience: string | null, rt60: number): void;
  /** Rooms the player may soon walk into (a scene coming in), as `room` takes them: made ahead. */
  prepare(rooms: readonly { roomId: string; ambience: string | null; rt60: number }[]): void;
}

/** The helicopter's distance (m) from its hover at which its rotor starts to swell. */
const APPROACH_M = 120;
/** A footstep at walking speed (config's 2.2 m/s) is heard at its own volume; running, louder. */
const WALK = 2.2;
/** How far to the side of the feet's centre (m) each foot comes down. */
const FOOT_SIDE = 0.1;
/** An impact at this change of speed (m/s: a ball dropped from about 45 cm) is at its volume. */
const IMPACT_FULL = 3;
/** The gain of the faintest knock and of the hardest (a throw against a wall). */
const IMPACT_QUIETEST = 0.15;
const IMPACT_LOUDEST = 1.3;

/**
 * When the game makes which sound, and where (Phase S): read from game events and entity states,
 * never from the views. Doors: the card reader beeps where the card is tapped (the reader on the
 * side of whoever tapped it: the player, or the teacher), the leaf slides where it is; hinged
 * leaves click open, and shut when their swing ends; switches click; feet — the player's and the
 * world's people's — step on the floor of the room they are in; the interface chimes for task steps and refusals,
 * and the portal sounds as the player goes into a world from the menu. Sounds of the world
 * wait until a scene has settled, so loading one (its doors and switches set) is silent.
 */
export class SoundCues {
  private settled = false;
  private readonly at: Vec3 = [0, 0, 0];
  private readonly doorStates = new Map<string, string>();
  private roomId: string | null = null;
  /** Frames since the cues began, and the frame and place of the last sliding door's sound. */
  private frame = 0;
  private readonly lastSlid = { frame: -1, x: 0, z: 0 };
  /** Seconds to the next roar, alarm beep, jet hiss and siren cycle. */
  private readonly beats = [{ left: 0 }, { left: 0 }, { left: 0 }, { left: 0 }];
  /** The door leaf last asked to open (its reader is where the card was tapped). */
  private asked: string | null = null;
  /** An emergency call: seconds to the rotor's next beat, what was last heard of it. */
  private readonly call = {
    rotor: 0,
    phaseT: 0,
    blast: false,
    stun: 0,
    line: 0,
    down: [false, false, false, false],
    ringing: false,
    /** What hangs under the squad's hole (it shatters as it lands), for `hungFor`. */
    hungFor: null as ResponderSquad | null,
    hung: [] as HungPlacement[],
  };

  constructor(
    private readonly game: Game,
    private readonly bank: Bank,
    private readonly out: SoundOut,
  ) {}

  attach(s: Disposables): void {
    const { events } = this.game;
    const unsettle = () => {
      this.settled = false;
      this.doorStates.clear();
    };
    for (const type of ['SceneLoading', 'SceneLoaded', 'SceneEntered', 'GameLoaded'] as const) {
      s.add(events.subscribe(type, unsettle));
    }
    s.add(
      events.subscribe('SceneAttaching', ({ sceneId }) =>
        this.out.prepare(
          this.game.world.roomsOf(sceneId).map((room) => ({
            roomId: room.id,
            ambience: room.ambience ?? null,
            rt60: rt60(room),
          })),
        ),
      ),
    );
    s.add(events.subscribe('DoorRequested', ({ entityId }) => (this.asked = entityId)));
    s.add(events.subscribe('DoorChanged', ({ doorIds, state }) => this.door(doorIds, state)));
    s.add(
      events.subscribe('ActionBlocked', ({ entityId, actionId }) => {
        const entity = this.game.world.entity(entityId);
        if (entity?.item.door && actionId === 'travel') {
          this.cue('card-refused', handPoint(entity, this.game.world, this.at));
        } else {
          this.cue('ui-refused', null);
        }
      }),
    );
    s.add(
      events.subscribe('EntityStateChanged', ({ entityId, key, value }) => {
        if (!this.settled) return;
        const entity = this.game.world.entity(entityId);
        if (!entity) return;
        if (key === 'open' && entity.item.hinged) {
          const at = entity.pose.position;
          // Opening: the latch as it starts; closing: the latch as the leaf meets its frame.
          if (value === true) this.cue('hinge-open', at);
          else this.cue('hinge-close', at, entity.item.hinged.swingS);
        } else if (key === LIGHTS_OFF || key === 'active') {
          this.cue('switch', entity.pose.position);
        }
      }),
    );
    s.add(
      events.subscribe('Footstep', ({ foot, speed, floor }) => {
        if (!this.settled) return;
        const p = this.game.state.player;
        const side = foot === 'left' ? -FOOT_SIDE : FOOT_SIDE;
        this.at[0] = p.position[0] + Math.cos(p.yaw) * side;
        this.at[1] = p.position[1];
        this.at[2] = p.position[2] - Math.sin(p.yaw) * side;
        const gain = Math.max(0.5, Math.min(1.5, speed / WALK));
        this.out.play(this.bank.footsteps[floor], this.at, 0, gain);
      }),
    );
    s.add(
      events.subscribe('NpcFootstep', ({ speed, position }) => {
        if (!this.settled) return;
        const room = this.game.world.roomAt(position[0], position[2]);
        this.at[0] = position[0];
        this.at[1] = position[1];
        this.at[2] = position[2];
        const gain = Math.max(0.5, Math.min(1.5, speed / WALK));
        this.out.play(this.bank.footsteps[room?.floor ?? 'vinyl'], this.at, 0, gain);
      }),
    );
    s.add(
      events.subscribe('Impact', ({ entityId, speed, position }) => {
        if (!this.settled) return;
        const entity = this.game.world.entity(entityId);
        if (!entity) return;
        const gain = Math.max(IMPACT_QUIETEST, Math.min(IMPACT_LOUDEST, speed / IMPACT_FULL));
        this.out.play(this.bank.impacts[entity.item.visual.material], position, 0, gain);
      }),
    );
    s.add(
      events.subscribe('DoorSlid', ({ open, position }) => {
        if (!this.settled) return;
        // A door's two leaves start together: one hiss for the door.
        const last = this.lastSlid;
        const same = Math.hypot(position[0] - last.x, position[2] - last.z) < 0.5;
        if (last.frame === this.frame && same) return;
        last.frame = this.frame;
        last.x = position[0];
        last.z = position[2];
        this.cue(open ? 'slide-open' : 'slide-close', position);
      }),
    );
    s.add(
      events.subscribe('ExperimentStarted', ({ sessionId }) => {
        // The station's apparatus beeps as its run starts (Phú, 2026-11-05).
        if (!this.settled) return;
        this.cue('run-start', this.game.world.entity(sessionId)?.pose.position ?? null);
      }),
    );
    s.add(
      events.subscribe('CircuitIncident', ({ boardId, what }) => {
        // A part or lead giving way cracks (Phase E-2); smoke starts quietly.
        if (!this.settled || what === 'smoke') return;
        this.cue('spark', this.game.world.entity(boardId)?.pose.position ?? null);
      }),
    );
    s.add(
      events.subscribe('PlayerHit', ({ entityId }) => {
        if (entityId.startsWith('responder:')) this.cue('slap', null);
      }),
    );
    s.add(
      events.subscribe('WorldEntry', ({ step }) =>
        this.cue(step === 'opening' ? 'enter-portal' : 'enter-arrive', null),
      ),
    );
    // A call ringing in the ear (Phú 2026-11-14): its ringback as it starts to ring.
    s.add(
      events.subscribe('PhoneChanged', ({ call }) => {
        if (call === 'ringing' && !this.call.ringing) this.cue('phone-ring', null);
        this.call.ringing = call === 'ringing';
      }),
    );
    s.add(events.subscribe('TaskStepCompleted', () => this.cue('ui-step', null)));
    s.add(events.subscribe('TaskCompleted', () => this.cue('ui-task', null)));
  }

  /** A click of the interface (a menu button, a choice). */
  click(): void {
    this.cue('ui-click', null);
  }

  /**
   * Fire (Phase E-2): the flames roar where the nearest fire is, a smoke alarm beeps over it, the
   * jet hisses while sprayed, and a siren comes in the brigade's last seconds — each repeated on
   * its own beat.
   */
  private burning(dt: number): void {
    const fires = this.game.fires;
    const [roar, alarm, hiss] = this.beats;
    // Its own three beats only: the siren's is counted down by the call (counted here too, its
    // cycles came twice as fast and two sirens overlapped).
    if (roar) roar.left -= dt;
    if (alarm) alarm.left -= dt;
    if (hiss) hiss.left -= dt;
    const p = this.game.state.player.position;
    let nearest: Vec3 | null = null;
    let best = Infinity;
    for (const fire of fires.list) {
      const d = Math.hypot(fire.position[0] - p[0], fire.position[2] - p[2]);
      if (d < best) {
        best = d;
        nearest = fire.position;
      }
    }
    if (nearest && roar && roar.left <= 0) {
      roar.left = 0.75;
      this.cue('fire', nearest);
    }
    if (nearest && alarm && alarm.left <= 0) {
      alarm.left = 1;
      this.at[0] = nearest[0];
      this.at[1] = nearest[1] + 2.5;
      this.at[2] = nearest[2];
      this.cue('alarm', this.at);
    }
    if (fires.spraying && hiss && hiss.left <= 0) {
      hiss.left = 0.25;
      this.cue('spray', fires.sprayFrom);
    }
  }

  /** Each frame: settles the scene once it plays, and follows the room the player is in. */
  update(dt = 1 / 60): void {
    this.frame++;
    if (this.settled) {
      this.burning(dt);
      this.emergency(dt);
    }
    const { state, world } = this.game;
    if (state.session.phase !== 'playing') {
      this.settled = false;
      if (this.roomId !== null) this.out.room('', null, 0.4);
      this.roomId = null;
      return;
    }
    this.settled = true;
    const id = state.player.roomId;
    if (id === this.roomId) return;
    this.roomId = id;
    const room = world.roomAt(state.player.position[0], state.player.position[2]);
    if (room) this.out.room(room.id, room.ambience ?? null, rt60(room));
  }

  /**
   * An emergency call answered (Phú 2026-11-13): the rotor beating where the helicopter is, the
   * charge's three beeps and the blast at the ceiling, the debris landing, a rope's run as each
   * one goes down it, a radio's squelch before each of the squad's lines.
   */
  private emergency(dt: number): void {
    const e = this.game.emergency;
    const squad = e.squad;
    const c = this.call;
    if (!squad) {
      c.blast = false;
      c.stun = 0;
      c.down.fill(false);
      return;
    }
    const at = this.game.scenes.offsetOf(squad.arrival.scene);
    if (!at) return;
    const [ax, az] = squad.arrival.at;
    const h = e.heli;
    // Coming in, the rotor swells with the nearness (on top of the distance's own fall-off: Phú
    // 2026-11-14, it should be heard clearly coming), full from the hover on.
    const away = Math.hypot(h.x - ax, h.y - squad.arrival.ceiling, h.z - az);
    const near = 1 - Math.min(1, away / APPROACH_M);
    const swell = e.phase === 'inbound' ? 0.35 + 0.95 * near * near : 1.3;
    c.rotor -= dt;
    if (h.visible && c.rotor <= 0) {
      c.rotor += 1; // the sound's own second: the next one runs on from it
      if (c.rotor < 0) c.rotor = 1;
      this.at[0] = h.x + at[0];
      this.at[1] = h.y + at[1];
      this.at[2] = h.z + at[2];
      this.out.play(this.bank.cues.rotor, this.at, 0, h.rotor * swell);
    }
    // Its siren while it comes in, from where it is: each cycle as long as its sound.
    const siren = this.beats[3];
    if (siren) siren.left -= dt;
    if (e.phase === 'inbound' && h.visible && siren && siren.left <= 0) {
      siren.left = squad.siren === 'wail' ? 4.6 : 3;
      this.at[0] = h.x + at[0];
      this.at[1] = h.y + at[1];
      this.at[2] = h.z + at[2];
      this.cue(squad.siren === 'wail' ? 'siren-wail' : 'siren-yelp', this.at);
    } else if (e.phase !== 'inbound' && siren) siren.left = 0;
    this.at[0] = ax + at[0];
    this.at[1] = squad.arrival.ceiling + at[1];
    this.at[2] = az + at[2];
    if (e.phase === 'breach') {
      // Three beeps before the blast (at 1.8 s): 0.6, 1.0, 1.4 s.
      for (const beep of [0.6, 1.0, 1.4]) {
        if (c.phaseT < beep && e.t >= beep) this.cue('charge', this.at);
      }
    }
    c.phaseT = e.t;
    if (e.blast >= 0 && !c.blast) {
      c.blast = true;
      if (e.blast < 0.5) {
        this.cue('blast', this.at);
        this.at[1] = at[1];
        this.cue('debris', this.at, 0.45);
        // What hung under the hole shatters like glass where it lands (render/emergency/fall.ts):
        // the crash, then its shards ringing as they scatter.
        for (const h of this.hungOf(squad)) {
          this.at[0] = h.position[0] + at[0];
          this.at[1] = at[1];
          this.at[2] = h.position[2] + at[2];
          const lands = Math.max(0, h.lands - e.blast);
          this.cue('shatter', this.at, lands);
          for (const d of SHARDS_S) this.cue('shard', this.at, lands + d);
        }
      }
    } else if (e.blast < 0) c.blast = false;
    // Stunned (the blast, a slap): the ears ring, as loud as the stun.
    if (e.stun > c.stun + 0.05) this.out.play(this.bank.cues.tinnitus, null, 0.1, e.stun);
    c.stun = e.stun;
    for (let i = 0; i < e.views.length && i < c.down.length; i++) {
      const v = e.views[i];
      if (!v) continue;
      const sliding = v.action === 'rappel' || v.action === 'climb';
      if (sliding && !c.down[i]) {
        this.at[0] = v.x + at[0];
        this.at[1] = v.y + at[1] + 1;
        this.at[2] = v.z + at[2];
        this.cue('rope', this.at);
      }
      c.down[i] = sliding;
    }
    const line = e.line;
    if (line && line.n !== c.line) {
      c.line = line.n;
      const off = this.game.scenes.offsetOf(line.sceneId);
      if (off && line.who === this.game.texts.of(squad, 'title')) {
        this.at[0] = line.x + off[0];
        this.at[1] = off[1] + 1.4;
        this.at[2] = line.z + off[2];
        this.cue('radio', this.at);
      }
    }
  }

  private door(doorIds: readonly [string, string], state: string): void {
    const entity = this.game.world.entity(doorIds[0]) ?? this.game.world.entity(doorIds[1]);
    if (!entity) return;
    // Kept by the pair (its first leaf), whichever leaf is in the world now: a scene behind it
    // comes and goes.
    const was = this.doorStates.get(doorIds[0]) ?? 'closed';
    this.doorStates.set(doorIds[0], state);
    if (!this.settled) return;
    if (was === 'closed' && (state === 'preparing' || state === 'opening')) {
      // The reader the card was tapped on: the leaf asked, when it is this door's.
      const asked = this.asked !== null && doorIds.includes(this.asked) ? this.asked : null;
      const reader = (asked !== null && this.game.world.entity(asked)) || entity;
      this.cue('card-accepted', handPoint(reader, this.game.world, this.at));
    }
    if (state !== 'closed') this.asked = null;
    const at = entity.pose.position;
    if (state === 'opening') this.cue('door-opening', at, was === 'closed' ? 0.15 : 0);
    else if (state === 'closing') this.cue('door-closing', at);
    else if (state === 'closed' && was === 'closing') this.cue('door-closed', at);
  }

  /** What hangs under `squad`'s hole (`hungUnder`), found once per squad. */
  private hungOf(squad: ResponderSquad): readonly HungPlacement[] {
    const c = this.call;
    if (c.hungFor !== squad) {
      const { content } = this.game;
      const scene = content.scenes.tryGet(squad.arrival.scene);
      const room =
        scene?.kind === 'world'
          ? arrivalRoom(
              scene.rooms.map((id) => content.rooms.tryGet(id)),
              squad,
            )
          : undefined;
      c.hung = room ? hungUnder(room, (id) => content.items.tryGet(id), squad) : [];
      c.hungFor = squad;
    }
    return c.hung;
  }

  private cue(cue: Cue, at: Vec3 | null, delay = 0): void {
    this.out.play(this.bank.cues[cue], at, delay);
  }
}

/** The shards ringing after the crash (s after it). */
const SHARDS_S = [0.04, 0.11, 0.19, 0.3, 0.44, 0.62];

function rt60(room: RoomDefinition): number {
  const [x0, y0, z0] = room.bounds.min;
  const [x1, y1, z1] = room.bounds.max;
  return roomRt60(x1 - x0, y1 - y0, z1 - z0);
}
