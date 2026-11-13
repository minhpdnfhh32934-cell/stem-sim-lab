import type { Disposables } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { handPoint } from '../../gameplay/action/handPoint';
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
}

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
 * world's people's — step on the floor of the room they are in; the interface chimes for task steps and refusals. Sounds of the world
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
  /** Seconds to the next roar, alarm beep, jet hiss and siren sweep. */
  private readonly beats = [{ left: 0 }, { left: 0 }, { left: 0 }, { left: 0 }];
  /** The door leaf last asked to open (its reader is where the card was tapped). */
  private asked: string | null = null;

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
    for (const beat of this.beats) beat.left -= dt;
    const [roar, alarm, hiss, siren] = this.beats;
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
    if (fires.brigadeIn !== null && fires.brigadeIn < 10 && siren && siren.left <= 0) {
      siren.left = 1.4;
      this.cue('siren', null);
    }
  }

  /** Each frame: settles the scene once it plays, and follows the room the player is in. */
  update(dt = 1 / 60): void {
    this.frame++;
    if (this.settled) this.burning(dt);
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

  private door(doorIds: readonly [string, string], state: string): void {
    const entity = this.game.world.entity(doorIds[0]) ?? this.game.world.entity(doorIds[1]);
    if (!entity) return;
    const was = this.doorStates.get(entity.id) ?? 'closed';
    this.doorStates.set(entity.id, state);
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

  private cue(cue: Cue, at: Vec3 | null, delay = 0): void {
    this.out.play(this.bank.cues[cue], at, delay);
  }
}

function rt60(room: RoomDefinition): number {
  const [x0, y0, z0] = room.bounds.min;
  const [x1, y1, z1] = room.bounds.max;
  return roomRt60(x1 - x0, y1 - y0, z1 - z0);
}
