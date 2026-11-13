import type { Prop } from '../../../gameplay/props';
import { box, part, type PropBuilder, type PropPart } from './parts';

// The chemistry lab's reagent cabinet (physical lab, docs/physical-lab-architecture.md §3.2): a
// steel carcass with shelves the glassware stands on and two full-height doors that swing open
// (the leaves of its item's `hinged`). The AFFORDANCE is the user's direction, not the spec (G1):
// it holds only what the experiment's materials list. `reagentCabinetLayout` is the one source of
// its numbers: the item's `hinged.leaves` and `hinged.carcass` are copied from it, so what is
// drawn, what the physics collides with and what a bottle stands on are the same boxes (a test
// checks the drawn shelves against it). Back at −z, front +z, as the wardrobe.

type Box = {
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
};

export interface CabinetLayout {
  /** The carcass's front (z), where the doors hinge. */
  readonly face: number;
  /** The doors, closed, as `hinged.leaves` takes them. */
  readonly leaves: readonly (Box & {
    readonly hinge: readonly [number, number];
    readonly opens: 1 | -1;
  })[];
  /** Sides, back, floor, cornice and shelves, as `hinged.carcass` takes them. */
  readonly carcass: readonly Box[];
  /** The top of each surface glassware stands on, lowest first: the floor, then the shelves. */
  readonly shelves: readonly number[];
}

const PANEL = 0.018;
const FRONT = 0.018;
const HANDLE = 0.028;
const GAP = 0.006;
const PLINTH = 0.08;
const PLINTH_SET = 0.03;
const CORNICE = 0.035;
/** How far a shelf stops short of the doors' hinge line. */
const SHELF_SET = 0.02;

/** The cabinet at `size`, with `shelves` shelves between its floor and its cornice. */
export function reagentCabinetLayout(
  [w = 0, h = 0, d = 0]: readonly number[],
  shelves = 3,
): CabinetLayout {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const face = d / 2 - FRONT - HANDLE;
  const [y0, y1] = [bottom + PLINTH, top - CORNICE];
  const between = (
    x0: number,
    ya: number,
    z0: number,
    x1: number,
    yb: number,
    z1: number,
  ): Box => ({
    center: [(x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2],
    size: [x1 - x0, yb - ya, z1 - z0],
  });
  const floorTop = y0 + PANEL;
  const pitch = (y1 - floorTop) / (shelves + 1);
  const tops = Array.from({ length: shelves }, (_, i) => floorTop + pitch * (i + 1));
  const carcass: Box[] = [
    between(-w / 2, y0, back, -w / 2 + PANEL, y1, face),
    between(w / 2 - PANEL, y0, back, w / 2, y1, face),
    between(-w / 2 + PANEL, y0, back, w / 2 - PANEL, y1, back + PANEL),
    between(-w / 2 + PANEL, y0, back + PANEL, w / 2 - PANEL, floorTop, face),
    between(-w / 2, y1, back, w / 2, top, d / 2 - HANDLE),
    ...tops.map((y) =>
      between(-w / 2 + PANEL, y - PANEL, back + PANEL, w / 2 - PANEL, y, face - SHELF_SET),
    ),
  ];
  const leaves = ([-1, 1] as const).map((s) => {
    const [a, b] = s < 0 ? [-w / 2 + 0.002, -GAP / 2] : [GAP / 2, w / 2 - 0.002];
    return {
      ...between(a, y0 + 0.004, face, b, y1 - 0.004, face + FRONT),
      hinge: [(s * w) / 2, face] as const,
      opens: s,
    };
  });
  return { face, leaves, carcass, shelves: [floorTop, ...tops] };
}

/** Draws a layout's box. */
const drawn = ({ center: [x, y, z], size: [w, h, d] }: Box) => box(w, h, d, x, y, z);

/**
 * The reagent cabinet: painted steel in the item's colour, a recessed plinth, and two doors with
 * a vertical steel bar handle by the seam. Only the doors move: each is a leaf that swings out
 * about its hinge while the cabinet is open.
 */
const reagentCabinet: PropBuilder = (size) => {
  const [w = 0, h = 0, d = 0] = size;
  const layout = reagentCabinetLayout(size);
  const [bottom, back] = [-h / 2, -d / 2];
  const parts: PropPart[] = [
    part('body', true, layout.carcass.map(drawn)),
    part('trim', false, [
      box(
        w - 2 * PLINTH_SET,
        PLINTH,
        layout.face - PLINTH_SET - back,
        0,
        bottom + PLINTH / 2,
        (back + layout.face - PLINTH_SET) / 2,
      ),
    ]),
  ];
  const length = Math.min(0.35, (h - PLINTH - CORNICE) / 4);
  const hy = Math.min(bottom + 1.1, h / 2 - CORNICE - length / 2 - 0.05);
  for (const leaf of layout.leaves) {
    const hinge = { x: leaf.hinge[0], z: leaf.hinge[1], opens: leaf.opens } as const;
    const hx = leaf.opens * (GAP / 2 + 0.05);
    const front = layout.face + FRONT;
    parts.push(
      part('body', true, [drawn(leaf)], hinge),
      part(
        'steel',
        false,
        [
          box(0.014, length, 0.014, hx, hy, front + HANDLE - 0.007),
          box(0.01, 0.01, HANDLE - 0.014, hx, hy - length / 2 + 0.02, front + (HANDLE - 0.014) / 2),
          box(0.01, 0.01, HANDLE - 0.014, hx, hy + length / 2 - 0.02, front + (HANDLE - 0.014) / 2),
        ],
        hinge,
      ),
    );
  }
  return parts;
};

export const REAGENT_PROPS = { 'reagent-cabinet': reagentCabinet } satisfies Partial<
  Record<Prop, PropBuilder>
>;
