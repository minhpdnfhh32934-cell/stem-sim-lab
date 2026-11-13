import type { Gesture, PersonView } from '../../render/body/person';

export type { Gesture, PersonView } from '../../render/body/person';

/*
 * The character page's room as a group, everyone in view (Phase C-9, Phú 2026-11-08): nobody walks
 * about any more. Each person has a place — an armchair, the sofa, a café table, a desk, or standing
 * — and keeps to what they do there: reading, a coffee, a phone, a laptop, or talking with the one
 * beside them, the two taking turns. The places run left to right across the view, and so does the
 * choice ("‹" "›"); the last is the silhouette that opens the customiser. The one chosen stays where
 * they are and looks at the camera (seated, putting down what they hold; standing, striking their
 * pose), lit up. Pure and seeded: the same room every time.
 */

export type SeatKind = 'armchair' | 'sofa' | 'chair' | 'desk' | 'stand';

export interface Seat {
  readonly x: number;
  readonly z: number;
  /** Where the body faces (rad): 0 away from the camera (−z), π towards it. */
  readonly heading: number;
  readonly kind: SeatKind;
  /** What they do there. */
  readonly gesture: Gesture;
  /** The seat they talk with, taking turns, looking at each other. */
  readonly partner?: number;
}

/** The places, left to right as the camera sees them (the camera at +z looking −z). */
export const SEATS: readonly Seat[] = [
  { x: -3.3, z: -1.9, heading: Math.PI + 0.55, kind: 'armchair', gesture: 'read' },
  { x: -2.4, z: -3.0, heading: Math.PI + 0.35, kind: 'stand', gesture: 'drink' },
  { x: -1.5, z: -3.4, heading: Math.PI + 0.25, kind: 'sofa', gesture: 'talk', partner: 3 },
  { x: -0.65, z: -3.4, heading: Math.PI - 0.25, kind: 'sofa', gesture: 'listen', partner: 2 },
  { x: 0.4, z: -2.2, heading: Math.PI + 0.95, kind: 'chair', gesture: 'talk', partner: 5 },
  { x: 1.45, z: -2.5, heading: Math.PI - 0.95, kind: 'chair', gesture: 'listen', partner: 4 },
  { x: 2.3, z: -3.3, heading: Math.PI - 0.25, kind: 'stand', gesture: 'phone' },
  { x: 3.15, z: -2.2, heading: Math.PI - 0.5, kind: 'desk', gesture: 'type' },
  { x: 3.95, z: -1.7, heading: Math.PI - 0.55, kind: 'stand', gesture: 'idle' },
];

/** How long one side of a talk speaks before the other answers (s), by turn. */
const TURNS = [3.2, 2.4, 4.1, 2.8, 3.6, 2.2, 4.4];

export class Seating {
  private time = 0;
  private chosen: number;

  /** `people`: who sits where, by seat (the last seat the silhouette's); `first`: chosen. */
  constructor(
    private readonly people: readonly string[],
    first: string,
  ) {
    if (people.length > SEATS.length) throw new Error(`Only ${SEATS.length} places in the room`);
    this.chosen = Math.max(0, people.indexOf(first));
  }

  /** Who is chosen. */
  get selected(): string {
    return this.people[this.chosen] ?? '';
  }

  /** Chooses `id` (if in the room). */
  select(id: string): void {
    const i = this.people.indexOf(id);
    if (i >= 0) this.chosen = i;
  }

  /** The next (1) or previous (−1) to the right or left, wrapping; returns who that is. */
  step(direction: 1 | -1): string {
    const n = this.people.length;
    this.chosen = (this.chosen + direction + n) % n;
    return this.selected;
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Whether the speaker of a pair (its first seat) talks now: they take turns. */
  private talking(seat: number): boolean {
    const pair = Math.min(seat, SEATS[seat]?.partner ?? seat);
    let t = this.time + pair * 1.7;
    let k = 0;
    let first = true;
    while (t > (TURNS[k % TURNS.length] ?? 3)) {
      t -= TURNS[k % TURNS.length] ?? 3;
      k++;
      first = !first;
    }
    return seat === pair ? first : !first;
  }

  /** Everyone as drawn now, in seat order. */
  view(): PersonView[] {
    return this.people.map((id, i): PersonView => {
      const seat = SEATS[i] as Seat; // never more people than places (the constructor)
      const chosen = i === this.chosen;
      const partner = seat.partner === undefined ? undefined : this.people[seat.partner];
      const sit = seat.kind !== 'stand';
      let gesture: Gesture = seat.gesture;
      if (partner !== undefined) gesture = this.talking(i) ? 'talk' : 'listen';
      // Chosen: seated, they put down what they hold and look up; standing, they strike a pose.
      if (chosen) gesture = sit ? 'idle' : 'pose';
      return {
        id,
        x: seat.x,
        z: seat.z,
        heading: seat.heading,
        speed: 0,
        sit,
        gesture,
        look: chosen ? 'camera' : (partner ?? null),
        called: chosen,
      };
    });
  }
}
