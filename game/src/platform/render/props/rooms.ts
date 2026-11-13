import type * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { box, part, type PropBuilder } from './parts';

// The other rooms' furniture (docs: Z3 §4.2, Appendix A): the teacher room's bookcase and
// whiteboard. Sizes come from the items; boards and frames are in metres, inside the box. Their
// backs are on a wall (−z).

type G = THREE.BufferGeometry;

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** The books' finishes, and how a shelf's row is drawn: the same every time (a fixed seed). */
const BOOKS = ['book-a', 'book-b', 'book-c'] as const;
const SEED = 7;

/**
 * A wooden bookcase (its back at −z) in the item's colour: sides, top, a kick board, a back panel
 * and shelves, filled with books in three colours — upright, here and there a gap or a few lying
 * flat at a row's end.
 */
const bookshelf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, t] = [-h / 2, h / 2, 0.02];
  const [kick, back] = [0.07, -d / 2 + 0.008]; // the kick board's height; the back panel's front
  const [floor, ceiling] = [bottom + kick + t, top - t]; // the lowest shelf's top; the top's underside
  const n = Math.max(1, Math.round((ceiling - floor) / 0.34));
  const step = (ceiling - floor) / n;
  const [x0, x1] = [-w / 2 + t, w / 2 - t];
  const body: G[] = [
    span(-w / 2, bottom, -d / 2, x0, top, d / 2),
    span(x1, bottom, -d / 2, w / 2, top, d / 2),
    span(x0, ceiling, -d / 2, x1, top, d / 2),
    span(x0, bottom, d / 2 - 0.03, x1, bottom + kick, d / 2 - 0.01),
    span(x0, bottom, -d / 2, x1, ceiling, back),
  ];
  const books: G[][] = BOOKS.map(() => []);
  let seed = SEED;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const y = floor + i * step; // the shelf's top
    body.push(span(x0, y - t, back, x1, y, d / 2 - 0.005));
    const room = step - (i < n - 1 ? t : 0) - 0.015; // the clear height over the shelf, less a gap
    const deep = Math.min(0.24, d - 0.04);
    let x = x0 + 0.01;
    const end = x1 - 0.01 - (0.1 + 0.15 * random()) * (x1 - x0); // a row fills 75–90 % of the shelf
    while (x < end) {
      if (random() < 0.08) x += 0.03 + 0.05 * random(); // a gap
      const thick = 0.02 + 0.03 * random();
      const tall = Math.min(room, (0.62 + 0.3 * random()) * (step - t));
      const depth = deep * (0.7 + 0.3 * random());
      const front = d / 2 - 0.02 - 0.012 * random();
      if (x + thick > x1 - 0.01) break;
      books[Math.floor(random() * BOOKS.length)]?.push(
        span(x, y, front - depth, x + thick, y + tall, front),
      );
      x += thick + 0.002;
    }
    // Now and then a few lying flat at the row's end.
    if (random() < 0.6) {
      let base = y;
      const long = Math.min(0.22, x1 - 0.01 - x - 0.02);
      for (let k = 0, count = 2 + Math.floor(2 * random()); k < count && long > 0.12; k++) {
        const thick = Math.min(0.025 + 0.02 * random(), y + room - base);
        if (thick <= 0.005) break;
        const depth = deep * (0.75 + 0.25 * random());
        books[Math.floor(random() * BOOKS.length)]?.push(
          span(
            x + 0.02,
            base,
            d / 2 - 0.02 - depth,
            x + 0.02 + long * (0.85 + 0.15 * random()),
            base + thick,
            d / 2 - 0.02,
          ),
        );
        base += thick;
      }
    }
  }
  return [
    part('body', true, body),
    ...BOOKS.flatMap((finish, i) => (books[i]?.length ? [part(finish, false, books[i])] : [])),
  ];
};

/**
 * A whiteboard on the wall (its back at −z): a white board in a slim steel frame over a steel
 * marker tray along its bottom. Blank: nothing is written on it.
 */
const whiteboard: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const f = Math.min(0.022, w / 20, h / 20); // the frame's face
  const deep = Math.min(0.022, d); // the frame's depth off the wall
  const tray = Math.min(0.035, h / 10);
  const y0 = bottom + tray; // the frame's bottom, on the tray
  return [
    part('body', false, [span(-w / 2 + f, y0 + f, back, w / 2 - f, top - f, back + deep - 0.006)]),
    part('steel', false, [
      span(-w / 2, top - f, back, w / 2, top, back + deep),
      span(-w / 2, y0, back, w / 2, y0 + f, back + deep),
      span(-w / 2, y0 + f, back, -w / 2 + f, top - f, back + deep),
      span(w / 2 - f, y0 + f, back, w / 2, top - f, back + deep),
      span(-w / 2 + f, bottom, back, w / 2 - f, bottom + 0.008, d / 2),
      span(-w / 2 + f, bottom, d / 2 - 0.006, w / 2 - f, y0, d / 2),
    ]),
  ];
};

export const ROOM_PROPS = {
  bookshelf,
  whiteboard,
} satisfies Partial<Record<Prop, PropBuilder>>;
