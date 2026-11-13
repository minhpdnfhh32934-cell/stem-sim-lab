// The city under the hub's glass floor (Phase V-2): where each downloaded piece stands. Pure and
// deterministic (no three.js): the same city every time. City coordinates: metres, x east, z south,
// y 0 the street, the origin an intersection straight under the glass's centre.
//
// Streets run on a grid, one every PERIOD m each way: a 4-lane street (18 m) with a 3 m sidewalk
// each side, then a block. A block has four buildings, two facing the street on its north side and
// two on its south side. Blocks come in rings round the origin: the inner `full` rings' buildings
// keep every part (Ultra), the rest up to `rings` keep their walls, windows and roofs (`simple`).

/** A block's side (m): two building slots of 21 m along each street. */
export const BLOCK = 42;
/** A street's full width with its sidewalks (m): the kit's intersection piece. */
export const STREET = 24.6;
/** From one street's centre line to the next. */
export const PERIOD = BLOCK + STREET;
/** The kit's 4-lane street piece: 6 m along, 18 m across. */
const LANE_PIECE = 6;
/** The kit's sidewalk tile (3 m square) and where its centre lies off the street's centre line. */
const WALK_PIECE = 3;
const WALK_OFF = 10.5;

export const BUILDINGS = ['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2'] as const;
export type Building = (typeof BUILDINGS)[number];
export type Kind = Building | 'Street_4Lane' | 'Street_4WayIntersection' | 'Sidewalk_Straight_3m';

/** One piece: its model, where its origin stands, its turn about y (rad), and its detail. */
export interface Placed {
  readonly kind: Kind;
  readonly x: number;
  readonly z: number;
  readonly turn: number;
  /** Every part (Ultra's inner rings), or only its walls, windows and roof. */
  readonly full: boolean;
}

/**
 * The city: `rings` rings of blocks round the origin (2 rings: a 4 × 4 block square), the inner
 * `full` rings in full detail.
 */
export function cityPlan(rings: number, full: number): Placed[] {
  const out: Placed[] = [];
  // Blocks: their centres at (i + ½, j + ½) periods, i and j from −rings to rings − 1.
  for (let i = -rings; i < rings; i++) {
    for (let j = -rings; j < rings; j++) {
      const ring = Math.max(i < 0 ? -i - 1 : i, j < 0 ? -j - 1 : j);
      const detail = ring < full;
      const [cx, cz] = [(i + 0.5) * PERIOD, (j + 0.5) * PERIOD];
      for (let slot = 0; slot < 4; slot++) {
        const north = slot < 2;
        const along = slot % 2 === 0 ? -BLOCK / 4 : BLOCK / 4;
        out.push({
          kind: BUILDINGS[pick(i, j, slot)] ?? 'Building_Small_1',
          x: cx + along,
          // A building's front is its local +z: south side as made, north side turned half round.
          z: north ? cz - BLOCK / 2 : cz + BLOCK / 2,
          turn: north ? Math.PI : 0,
          full: detail,
        });
      }
    }
  }
  // Streets: every line from −rings to rings periods, each way; an intersection at each crossing,
  // 4-lane pieces and sidewalks along each block's length between them.
  for (let a = -rings; a <= rings; a++) {
    for (let b = -rings; b <= rings; b++) {
      out.push({
        kind: 'Street_4WayIntersection',
        x: a * PERIOD,
        z: b * PERIOD,
        turn: 0,
        full: true,
      });
      if (b === rings) continue;
      // Along z (the street at x = a·P) and along x (the street at z = a·P), from crossing b to b + 1.
      for (let k = 0; k < BLOCK / LANE_PIECE; k++) {
        const s = b * PERIOD + STREET / 2 + LANE_PIECE * (k + 0.5);
        out.push({ kind: 'Street_4Lane', x: a * PERIOD, z: s, turn: Math.PI / 2, full: true });
        out.push({ kind: 'Street_4Lane', x: s, z: a * PERIOD, turn: 0, full: true });
      }
      for (let k = 0; k < BLOCK / WALK_PIECE; k++) {
        const s = b * PERIOD + STREET / 2 + WALK_PIECE * (k + 0.5);
        for (const side of [-1, 1]) {
          out.push({
            kind: 'Sidewalk_Straight_3m',
            x: a * PERIOD + side * WALK_OFF,
            z: s,
            turn: 0,
            full: true,
          });
          out.push({
            kind: 'Sidewalk_Straight_3m',
            x: s,
            z: a * PERIOD + side * WALK_OFF,
            turn: 0,
            full: true,
          });
        }
      }
    }
  }
  return out;
}

/** Which building a slot gets: a fixed hash of where it is, so neighbours differ. */
function pick(i: number, j: number, slot: number): number {
  let h = (i * 73856093) ^ (j * 19349663) ^ (slot * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % BUILDINGS.length;
}

/** A street light: where its pole stands, and which way its arm reaches (rad about y). */
export interface Lamp {
  readonly x: number;
  readonly z: number;
  readonly turn: number;
}

/** How far a lamp's pole stands off its street's centre line (m): the sidewalk's kerb side. */
const LAMP_OFF = 9.6;

/**
 * Street lights along both sidewalks of every street between its crossings, `perBlock` to a block's
 * length (evenly spaced), their arms over the road. A lamp at +x of a street along z reaches −x.
 */
export function lampPlan(rings: number, perBlock: number): Lamp[] {
  const out: Lamp[] = [];
  for (let a = -rings; a <= rings; a++) {
    for (let b = -rings; b < rings; b++) {
      for (let k = 0; k < perBlock; k++) {
        const s = b * PERIOD + STREET / 2 + (BLOCK * (k + 0.5)) / perBlock;
        for (const side of [-1, 1]) {
          // The street along z at x = a·P, then the one along x at z = a·P.
          out.push({ x: a * PERIOD + side * LAMP_OFF, z: s, turn: side > 0 ? Math.PI : 0 });
          out.push({
            x: s,
            z: a * PERIOD + side * LAMP_OFF,
            turn: side > 0 ? Math.PI / 2 : -Math.PI / 2,
          });
        }
      }
    }
  }
  return out;
}

/** A traffic lane: along x or z, at `offset` across from the city's origin, driven + or −. */
export interface Lane {
  readonly alongX: boolean;
  readonly offset: number;
  readonly direction: 1 | -1;
}

/** Each street's four lanes (4.5 m wide), two each way, driven on the right. */
export function lanePlan(rings: number): Lane[] {
  const out: Lane[] = [];
  for (let a = -rings; a <= rings; a++) {
    for (const alongX of [true, false]) {
      for (const across of [2.25, 6.75]) {
        // Along +x the right is +z; along +z the right is −x.
        out.push({ alongX, offset: a * PERIOD + (alongX ? across : -across), direction: 1 });
        out.push({ alongX, offset: a * PERIOD - (alongX ? across : -across), direction: -1 });
      }
    }
  }
  return out;
}
