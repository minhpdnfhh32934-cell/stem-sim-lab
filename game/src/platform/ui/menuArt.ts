import { type Attrs, el, svg } from './dom';
import { EMBLEM } from './emblemShape';

// Decorative art of the main menu, drawn here (no image files): the emblem above the name and
// the science glyphs that now and then cross the sky. Both are aria-hidden and take no clicks;
// their motion is CSS only (styles.css), off under prefers-reduced-motion, and stops when the
// menu is hidden. The emblem's numbers are in emblemShape.ts (the hub's 3D emblem shares them).

const { cyan: CYAN, pale: PALE, warm: WARM } = EMBLEM.colors;
const { size, inner, outer, ticks, satellite, tape, flight, ball } = EMBLEM;

const ring = (r: number, attrs: Attrs) =>
  svg('circle', { cx: size / 2, cy: size / 2, r, ...attrs });

/** A strobe image of the ball on the trajectory: lit `at` seconds into each sweep, else at rest. */
const strobe = (cx: number, cy: number, r: number, rest: number, at: number) =>
  svg('circle', {
    cx,
    cy,
    r,
    fill: CYAN,
    'fill-opacity': rest,
    class: 'emblem-strobe',
    style: `--rest: ${rest}; --at: ${at}s`,
  });

/**
 * The emblem: a measured flight — dial, floor tape, strobed trajectory and the ball at its top.
 * It works like the instrument it draws: every 3.6 s the strobe images light one after another
 * from launch to landing, the ball's glow flaring as the sweep passes the top; the trajectory's
 * dashes flow the same way, and a small satellite rounds the outer ring.
 */
export function emblem(): SVGSVGElement {
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, fill: 'none', class: 'menu-emblem' });
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  const orbit = svg('g', { class: 'emblem-orbit' });
  const { x, y } = satellite;
  orbit.append(
    svg('circle', { cx: x, cy: y, r: satellite.glow, fill: CYAN, 'fill-opacity': 0.22 }),
    svg('circle', { cx: x, cy: y, r: satellite.r, fill: PALE }),
  );
  root.append(
    ring(inner, { fill: CYAN, 'fill-opacity': 0.06 }),
    ring(outer.r, { stroke: CYAN, 'stroke-opacity': 0.35, 'stroke-width': outer.width }),
    ring(ticks.r, {
      stroke: CYAN,
      'stroke-opacity': 0.55,
      'stroke-width': ticks.length,
      'stroke-dasharray': `${ticks.dash} ${ticks.gap}`,
    }),
    ring(inner, { stroke: CYAN, 'stroke-opacity': 0.25 }),
    orbit,
    svg('path', {
      d: `M${tape.from} ${tape.y}H${tape.to}`,
      stroke: CYAN,
      'stroke-opacity': 0.7,
      'stroke-width': tape.width,
    }),
    svg('path', {
      d: tape.marks.map(([mx, length]) => `M${mx} ${tape.y}v${length}`).join(''),
      stroke: CYAN,
      'stroke-opacity': 0.5,
    }),
    svg('path', {
      d: `M${flight.from.join(' ')}Q${flight.control.join(' ')} ${flight.to.join(' ')}`,
      class: 'emblem-flight',
      stroke: PALE,
      'stroke-opacity': 0.85,
      'stroke-width': flight.width,
      'stroke-dasharray': `${flight.dash} ${flight.gap}`,
      'stroke-linecap': 'round',
    }),
    ...EMBLEM.strobes.map((s) => strobe(s.x, s.y, s.r, s.rest, s.at)),
    svg('circle', {
      cx: ball.x,
      cy: ball.y,
      r: ball.glow,
      fill: WARM,
      'fill-opacity': 0.18,
      class: 'emblem-glow',
    }),
    svg('circle', { cx: ball.x, cy: ball.y, r: ball.r, fill: WARM }),
  );
  return root;
}

/** Thin-line glyphs on a 24-unit grid, in the emblem's pale cyan: path data, and dashed parts. */
const GLYPHS: Readonly<Record<string, readonly (readonly [string, string?])[]>> = {
  // A laboratory flask with a liquid line.
  flask: [
    ['M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3'],
    ['M7.6 15.5h8.8', '1.5 1.5'],
  ],
  // A DNA double helix: two strands and their rungs.
  helix: [
    ['M7 2c0 5 10 5 10 10s-10 5-10 10M17 2c0 5-10 5-10 10s10 5 10 10'],
    ['M8.6 5.2h6.8M10.6 9.6h2.8M10.6 14.4h2.8M8.6 18.8h6.8'],
  ],
  // Newton's apple, and the way it falls.
  apple: [
    [
      'M12 8c-2-1.4-6-1-6.5 3-.4 3.6 2.2 9 4.2 9 .9 0 1.4-.5 2.3-.5s1.4.5 2.3.5c2 0 4.6-5.4 4.2-9C18 7 14 6.6 12 8z',
    ],
    ['M12 8c0-2 .8-3.4 2.2-4.2'],
    ['M21 3v6M19.5 7.5 21 9l1.5-1.5'],
  ],
  // A pendulum: pivot bar, rod, bob and the arc its centre swings on (radius 15.7).
  pendulum: [
    ['M5 3h14M12 3l4.3 12.8M19.2 17.9a2.2 2.2 0 1 0-4.4 0a2.2 2.2 0 1 0 4.4 0'],
    ['M4.15 16.6A15.7 15.7 0 0 0 19.85 16.6', '1 2'],
  ],
};

/**
 * The science "meteors": a fixed pool of four glyphs in the sky, each crossing it now and then
 * on its own long cycle (styles.css), reused every time — nothing is created while it runs.
 */
export function meteors(): HTMLElement[] {
  return Object.entries(GLYPHS).map(([name, parts]) => {
    const meteor = el('span', `menu-meteor ${name}`);
    const glyph = svg('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: PALE,
      'stroke-width': 1.1,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    glyph.setAttribute('focusable', 'false');
    for (const [d, dash] of parts) {
      glyph.append(svg('path', dash ? { d, 'stroke-dasharray': dash, opacity: 0.7 } : { d }));
    }
    meteor.append(glyph);
    return meteor;
  });
}
