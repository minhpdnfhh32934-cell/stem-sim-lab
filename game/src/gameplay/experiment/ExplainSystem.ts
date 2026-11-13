import { Disposables, type EventBus } from '../../core/EventBus';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import type { Texts } from '../../core/i18n';
import type { InputState } from '../player/InputState';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { Explain } from '../../simulation/experiment';
import type { WorldEntity } from '../../world/World';
import type { StationView } from './StationSystem';

/** How far (m, on the floor) from a station's apparatus its Explain view can be opened. */
export const EXPLAIN_REACH = 4;
/** How far (m) along the view an apparatus or its bench is looked for. */
const AIM_M = 5;
/** A point looked at this near (m, on the floor) a station's apparatus is on its bench. */
const BENCH_M = 1.2;
/** Lower than this (m), the point looked at is the floor, not a bench. */
const FLOOR_M = 0.3;
/** A solid this much (m) nearer than an apparatus looked through hides it (a wall, a screen). */
const HIDES_M = 0.3;

export interface ExplainSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  input: InputState;
  texts: Texts;
  world: { entity(id: string): WorldEntity | undefined };
  stations: {
    view(stationId: string): StationView | null;
    stationOf(entityId: string): StationView | null;
    stationNear(x: number, z: number, radius: number): StationView | null;
    stationAlong(
      eye: Readonly<Vec3>,
      dir: Readonly<Vec3>,
      max: number,
    ): { readonly station: StationView; readonly distance: number } | null;
  };
  /**
   * True while the teacher follows to explain one (Phú 2026-11-10): H and its hint wait, the player
   * points him at an experiment with E instead.
   */
  suspended?: () => boolean;
  /** What the crosshair is on: an interactable, and the first solid along the view. */
  interaction: { readonly focused: { readonly id: string } | null };
  lineOfSight?: {
    castRay(
      origin: Readonly<Vec3>,
      dir: Readonly<Vec3>,
      maxDistance: number,
    ): { readonly entityId: string | null; readonly distance: number } | null;
  };
}

/**
 * The Explain view (Phase X, Phú 2026-11-08): at a station, its apparatus' parts named and its
 * principle shown step by step, the camera close on the apparatus — and the door the hub's teacher
 * will come in by (`open`, `show`, `close` are its commands). One at a time
 * (`state.session.explain`, never saved). H opens it at the nearest station in reach, H or Esc
 * closes it; it closes when the scene changes, a workspace opens or its station goes away. While
 * it is open the player stands still (PlayerSystem); a run goes on. What it shows is the
 * experiment's `explain` data; it changes nothing in the world.
 */
export class ExplainSystem implements GameSystem {
  readonly id = 'explain';
  private readonly subscriptions = new Disposables();
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly dir: Vec3 = [0, 0, -1];

  constructor(private readonly deps: ExplainSystemDeps) {}

  /** The open view's station and step, or null. */
  get current(): { readonly stationId: string; readonly step: number } | null {
    return this.deps.state.session.explain ?? null;
  }

  /** The open view's experiment data, or null. */
  get explain(): Explain | null {
    const open = this.current;
    return open ? (this.deps.stations.view(open.stationId)?.definition.explain ?? null) : null;
  }

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(events.subscribe('SceneLoading', () => this.close()));
    s.add(events.subscribe('WorkspaceOpened', () => this.close()));
    s.add(
      events.subscribe('SceneDetached', () => {
        const open = this.current;
        if (open && this.deps.stations.view(open.stationId) === null) this.close();
      }),
    );
  }

  update(): void {
    const { input, state } = this.deps;
    if (!input.wasPressed('explain')) return;
    if (this.current) this.close();
    else if (this.deps.suspended?.() === true) {
      const reason = this.deps.texts.ui(
        'explain.askTeacher',
        'The teacher is with you: look at an experiment and press E to ask him.',
      );
      this.deps.events.publish('ActionBlocked', { entityId: '', actionId: 'explain', reason });
    } else if (state.session.phase === 'playing' && !state.session.paused) this.openAimed();
  }

  /**
   * The station whose view H would open now (Phú, 2026-11-09): the one the crosshair is on — its
   * apparatus or a piece of it, or the bench it stands on — within reach; null when the view is
   * elsewhere.
   */
  aimed(): StationView | null {
    if (this.deps.suspended?.() === true) return null;
    const station = this.lookedAt();
    if (!station?.definition.explain) return null;
    const entity = this.deps.world.entity(station.id);
    if (!entity) return null;
    const [px, , pz] = this.deps.state.player.position;
    const [x, , z] = entity.pose.position;
    return Math.hypot(x - px, z - pz) <= EXPLAIN_REACH ? station : null;
  }

  /** Opens the view at the station looked at, in reach; returns why it cannot, or null. */
  openAimed(): string | null {
    const station = this.aimed();
    if (station) return this.open(station.id);
    const reason = this.deps.texts.ui(
      'explain.none',
      'Look at an experiment to have it explained.',
    );
    this.deps.events.publish('ActionBlocked', { entityId: '', actionId: 'explain', reason });
    return reason;
  }

  /** The station the crosshair is on: an apparatus or its piece, else the bench under one. */
  private lookedAt(): StationView | null {
    const { stations, interaction, lineOfSight, state } = this.deps;
    const focused = interaction.focused?.id;
    const own = focused ? stations.stationOf(focused) : null;
    if (own) return own;
    const { player } = state;
    this.eye[0] = player.position[0];
    this.eye[1] = player.position[1] + player.eyeHeight;
    this.eye[2] = player.position[2];
    directionFromYawPitch(player.yaw, player.pitch, this.dir);
    const hit = lineOfSight?.castRay(this.eye, this.dir, AIM_M) ?? null;
    const solid = hit?.entityId ? stations.stationOf(hit.entityId) : null;
    if (solid) return solid;
    // The apparatus (or its bench) in the view, unless a solid in front of it hides it.
    const along = stations.stationAlong(this.eye, this.dir, AIM_M);
    if (along && (!hit || hit.distance >= along.distance - HIDES_M)) return along.station;
    if (!hit) return null;
    const y = this.eye[1] + this.dir[1] * hit.distance;
    if (y < FLOOR_M) return null;
    const x = this.eye[0] + this.dir[0] * hit.distance;
    const z = this.eye[2] + this.dir[2] * hit.distance;
    return stations.stationNear(x, z, BENCH_M);
  }

  /** Opens station `stationId`'s view at its first step (closing another); why not, or null. */
  open(stationId: string): string | null {
    const view = this.deps.stations.view(stationId);
    if (!view?.definition.explain) {
      const reason = this.deps.texts.ui(
        'explain.missing',
        'This experiment has no explanation yet.',
      );
      this.deps.events.publish('ActionBlocked', {
        entityId: stationId,
        actionId: 'explain',
        reason,
      });
      return reason;
    }
    if (this.current?.stationId !== stationId) this.close();
    this.deps.state.session.explain = { stationId, step: 0 };
    this.deps.events.publish('ExplainOpened', { stationId });
    this.deps.events.publish('ExplainStepChanged', { stationId, step: 0 });
    return null;
  }

  /** Shows step `step` of the open view's principle (kept in range). */
  show(step: number): void {
    const open = this.current;
    const explain = this.explain;
    if (!open || !explain) return;
    const next = Math.min(Math.max(0, Math.round(step)), explain.steps.length - 1);
    if (next === open.step) return;
    this.deps.state.session.explain = { stationId: open.stationId, step: next };
    this.deps.events.publish('ExplainStepChanged', { stationId: open.stationId, step: next });
  }

  /** Closes the open view; false if none was open. */
  close(): boolean {
    const open = this.current;
    if (!open) return false;
    this.deps.state.session.explain = null;
    this.deps.events.publish('ExplainClosed', { stationId: open.stationId });
    return true;
  }

  dispose(): void {
    this.subscriptions.dispose();
  }
}
