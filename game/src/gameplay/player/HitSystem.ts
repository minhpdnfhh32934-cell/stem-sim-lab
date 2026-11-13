import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { World } from '../../world/World';

/** Another player of the room as hits see them: their body in this world (feet), or null. */
export interface OtherBody {
  readonly id: string;
  readonly body: readonly [number, number, number] | null;
}

/** How long a thrown object is followed (s), and how soon after the throw it can hit (s). */
const FOLLOW_S = 3;
const ARMED_AFTER_S = 0.35;
/** The slowest a thrown object hits at (m/s): slower, it is only a touch. */
const HIT_SPEED = 1.5;
/** The player's capsule radius (m) beside the object's own size. */
const BODY_RADIUS = 0.3;

/** Another player's height for hits (m). */
const OTHER_HEIGHT = 1.8;
/** An impact this much (m) beyond their capsule's reach still struck them (a step's travel). */
const IMPACT_MARGIN = 0.1;

/** Within `reach` of a body's axis, between its feet and the top of its head. */
function touches(
  x: number,
  y: number,
  z: number,
  fx: number,
  fy: number,
  fz: number,
  height: number,
  reach: number,
): boolean {
  return Math.hypot(x - fx, z - fz) <= reach && y > fy - 0.05 && y < fy + height + 0.1;
}

interface Flight {
  readonly entityId: string;
  seconds: number;
  readonly last: [number, number, number];
}

/**
 * Being hit by what is thrown (Phú, Phase F-1): an object thrown (`ObjectReleased` "throw") is
 * followed for a few seconds; once it has left the hand, if it reaches the player's body moving
 * faster than HIT_SPEED, the player is hit (`PlayerHit`, once per throw): the screen flashes red
 * and a sleeper wakes with a start. Other players' throws reach the player through their own
 * game's hits (multiplayer sends them as `PeerHit`).
 */
export class HitSystem implements GameSystem {
  readonly id = 'hits';
  private readonly flights: Flight[] = [];
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly deps: {
      state: GameState;
      events: EventBus<GameEvents>;
      world: World;
      /** The room's other players (Phase F-3): what this player throws hits them too. */
      others?: () => readonly OtherBody[];
    },
  ) {}

  init(): void {
    this.subscriptions.add(
      this.deps.events.subscribe('ObjectReleased', ({ entityId, reason }) => {
        if (reason !== 'throw') return;
        const p = this.deps.world.entity(entityId)?.pose.position;
        if (!p) return;
        this.flights.push({ entityId, seconds: 0, last: [p[0], p[1], p[2]] });
      }),
    );
    // Another player's capsule stops what strikes it: physics' own impact (every step, so a fast
    // object bouncing off between two frames is not missed) beside their body is a hit.
    this.subscriptions.add(
      this.deps.events.subscribe('Impact', ({ entityId, speed, position }) => {
        const i = this.flights.findIndex((f) => f.entityId === entityId);
        const entity = this.deps.world.entity(entityId);
        if (i < 0 || !entity || speed < HIT_SPEED) return;
        const [w, h, d] = entity.item.visual.size;
        const reach = BODY_RADIUS + Math.max(w, h, d) / 2 + IMPACT_MARGIN;
        const [x, y, z] = position;
        for (const other of this.deps.others?.() ?? []) {
          const b = other.body;
          if (!b || !touches(x, y, z, b[0], b[1], b[2], OTHER_HEIGHT, reach)) continue;
          this.flights.splice(i, 1);
          this.deps.events.publish('PeerHit', { id: other.id, speed });
          return;
        }
      }),
    );
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.flights.length = 0;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const player = this.deps.state.player;
    const [px, py, pz] = player.position;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i];
      if (!flight) continue;
      flight.seconds += dt;
      const entity = this.deps.world.entity(flight.entityId);
      if (!entity || flight.seconds > FOLLOW_S) {
        this.flights.splice(i, 1);
        continue;
      }
      const [x, y, z] = entity.pose.position;
      const speed = Math.hypot(x - flight.last[0], y - flight.last[1], z - flight.last[2]) / dt;
      flight.last[0] = x;
      flight.last[1] = y;
      flight.last[2] = z;
      if (speed < HIT_SPEED) continue;
      const [w, h, d] = entity.item.visual.size;
      const reach = BODY_RADIUS + Math.max(w, h, d) / 2;
      // The thrower only once it has left the hand; another player at once (it cannot start in them).
      if (flight.seconds >= ARMED_AFTER_S && touches(x, y, z, px, py, pz, player.height, reach)) {
        this.flights.splice(i, 1);
        this.deps.events.publish('PlayerHit', { entityId: flight.entityId, speed });
        continue;
      }
      const others = this.deps.others?.() ?? [];
      for (const other of others) {
        const b = other.body;
        // Another player's height is not known here: a grown-up's (their capsule is the same).
        if (!b || !touches(x, y, z, b[0], b[1], b[2], OTHER_HEIGHT, reach)) continue;
        this.flights.splice(i, 1);
        this.deps.events.publish('PeerHit', { id: other.id, speed });
        break;
      }
    }
  }
}
