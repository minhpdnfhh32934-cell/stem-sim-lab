import { svg } from './dom';

// The art of Play's pages (Phú 2026-11-12: "professional, complete, gripping"), drawn here as the
// menu's emblem is (no image files): a lab bench for Single player, linked players for Multiplayer,
// a radar while the LAN is searched. All aria-hidden; motion is CSS only (playPages.css), off under
// prefers-reduced-motion.

const CYAN = '#4fb3d9';
const PALE = '#b3e6f7';
const WARM = '#ffbe6e';

function frame(cls: string): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 400 220', fill: 'none', class: `play-art ${cls}` });
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  root.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  return root;
}

/** A floor in perspective: the room the scene stands in. */
function floor(color: string): SVGGElement {
  const g = svg('g', { stroke: color, 'stroke-opacity': 0.14, 'stroke-width': 1 });
  for (let i = 0; i < 4; i++) {
    const y = 176 + i * i * 6;
    g.append(svg('path', { d: `M0 ${y}H400` }));
  }
  for (let i = -5; i <= 5; i++)
    g.append(svg('path', { d: `M${200 + i * 26} 176L${200 + i * 90} 230` }));
  return g;
}

/** Single player: a flask bubbling on the bench, a pendulum swinging, a tracer in orbit. */
export function soloArt(): SVGSVGElement {
  const root = frame('solo');
  const glow = svg('radialGradient', { id: 'solo-glow' });
  glow.append(
    svg('stop', { offset: '0', 'stop-color': WARM, 'stop-opacity': 0.55 }),
    svg('stop', { offset: '1', 'stop-color': WARM, 'stop-opacity': 0 }),
  );
  const defs = svg('defs', {});
  defs.append(glow);
  const bubbles = svg('g', { fill: WARM });
  for (const [x, r, d] of [
    [192, 3, 0],
    [204, 2.2, 0.7],
    [198, 2.6, 1.4],
    [209, 1.8, 2.1],
  ] as const) {
    bubbles.append(svg('circle', { cx: x, cy: 132, r, class: 'art-bubble', style: `--d: ${d}s` }));
  }
  const swing = svg('g', { class: 'art-swing' });
  swing.append(
    svg('path', { d: 'M318 58V128', stroke: PALE, 'stroke-opacity': 0.7 }),
    svg('circle', { cx: 318, cy: 134, r: 8, fill: CYAN, 'fill-opacity': 0.9 }),
  );
  const orbit = svg('g', { class: 'art-orbit' });
  orbit.append(svg('circle', { cx: 268, cy: 104, r: 3.5, fill: PALE }));
  root.append(
    defs,
    floor(WARM),
    svg('circle', { cx: 200, cy: 118, r: 92, fill: 'url(#solo-glow)', class: 'art-pulse' }),
    svg('ellipse', {
      cx: 200,
      cy: 104,
      rx: 72,
      ry: 22,
      stroke: PALE,
      'stroke-opacity': 0.25,
      'stroke-dasharray': '3 6',
    }),
    orbit,
    // The bench.
    svg('rect', { x: 70, y: 160, width: 260, height: 6, rx: 3, fill: PALE, 'fill-opacity': 0.25 }),
    svg('path', { d: 'M86 166V196M314 166V196', stroke: PALE, 'stroke-opacity': 0.18 }),
    // The flask and its glowing liquid.
    svg('path', {
      d: 'M188 78H212M192 78V112L166 152C163 157 166 160 171 160H229C234 160 237 157 234 152L208 112V78',
      stroke: PALE,
      'stroke-opacity': 0.85,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    }),
    svg('path', {
      d: 'M180 132H220L232 152C234 156 232 158 228 158H172C168 158 166 156 168 152Z',
      fill: WARM,
      'fill-opacity': 0.75,
      class: 'art-liquid',
    }),
    bubbles,
    // The pendulum's stand.
    svg('path', {
      d: 'M290 58H340M296 58V160',
      stroke: PALE,
      'stroke-opacity': 0.35,
      'stroke-width': 2,
    }),
    swing,
    // A beaker beside the flask.
    svg('path', {
      d: 'M104 120V156C104 158 105 160 108 160H132C135 160 136 158 136 156V120',
      stroke: PALE,
      'stroke-opacity': 0.55,
      'stroke-width': 1.5,
    }),
    svg('rect', { x: 106, y: 140, width: 28, height: 18, rx: 2, fill: CYAN, 'fill-opacity': 0.35 }),
  );
  return root;
}

/** Multiplayer: players linked through the room, one chatting, one talking. */
export function multiArt(): SVGSVGElement {
  const root = frame('multi');
  const glow = svg('radialGradient', { id: 'multi-glow' });
  glow.append(
    svg('stop', { offset: '0', 'stop-color': CYAN, 'stop-opacity': 0.5 }),
    svg('stop', { offset: '1', 'stop-color': CYAN, 'stop-opacity': 0 }),
  );
  const defs = svg('defs', {});
  defs.append(glow);
  const hub = { x: 200, y: 112 };
  const players = [
    { x: 84, y: 70, color: WARM },
    { x: 318, y: 66, color: PALE },
    { x: 96, y: 170, color: PALE },
    { x: 306, y: 168, color: '#8ee0a6' },
  ];
  const links = svg('g', { stroke: CYAN, 'stroke-width': 1.6 });
  const people = svg('g', {});
  players.forEach((p, i) => {
    links.append(
      svg('path', {
        d: `M${hub.x} ${hub.y}L${p.x} ${p.y}`,
        'stroke-opacity': 0.55,
        'stroke-dasharray': '4 7',
        class: 'art-link',
        style: `--d: ${i * 0.35}s`,
      }),
    );
    const person = svg('g', { class: 'art-person', style: `--d: ${i * 0.5}s` });
    person.append(
      svg('circle', {
        cx: p.x,
        cy: p.y,
        r: 22,
        fill: '#0b1522',
        stroke: p.color,
        'stroke-opacity': 0.8,
      }),
      svg('circle', { cx: p.x, cy: p.y - 5, r: 6.5, fill: p.color, 'fill-opacity': 0.9 }),
      svg('path', {
        d: `M${p.x - 11} ${p.y + 13}C${p.x - 10} ${p.y + 3} ${p.x + 10} ${p.y + 3} ${p.x + 11} ${p.y + 13}`,
        fill: p.color,
        'fill-opacity': 0.9,
      }),
    );
    people.append(person);
  });
  // A chat bubble by one player, the waves of a voice by another.
  const chat = svg('g', { class: 'art-chat' });
  chat.append(
    svg('rect', { x: 112, y: 30, width: 46, height: 24, rx: 8, fill: PALE, 'fill-opacity': 0.9 }),
    svg('path', { d: 'M120 54L116 62L128 54Z', fill: PALE, 'fill-opacity': 0.9 }),
    svg('circle', { cx: 124, cy: 42, r: 2.5, fill: '#0b1522' }),
    svg('circle', { cx: 135, cy: 42, r: 2.5, fill: '#0b1522' }),
    svg('circle', { cx: 146, cy: 42, r: 2.5, fill: '#0b1522' }),
  );
  const voice = svg('g', { stroke: '#8ee0a6', 'stroke-width': 2, 'stroke-linecap': 'round' });
  for (const [r, d] of [
    [30, 0],
    [38, 0.25],
    [46, 0.5],
  ] as const) {
    voice.append(
      svg('path', {
        d: `M${306 + r * 0.7} ${168 - r * 0.7}A${r} ${r} 0 0 1 ${306 + r * 0.7} ${168 + r * 0.7}`,
        class: 'art-wave',
        style: `--d: ${d}s`,
      }),
    );
  }
  root.append(
    defs,
    floor(CYAN),
    svg('circle', { cx: hub.x, cy: hub.y, r: 96, fill: 'url(#multi-glow)', class: 'art-pulse' }),
    links,
    svg('circle', {
      cx: hub.x,
      cy: hub.y,
      r: 34,
      stroke: CYAN,
      'stroke-opacity': 0.3,
      class: 'art-ring',
    }),
    svg('circle', {
      cx: hub.x,
      cy: hub.y,
      r: 20,
      fill: '#0b1522',
      stroke: CYAN,
      'stroke-width': 2,
    }),
    svg('path', {
      d: `M${hub.x - 10} ${hub.y + 6}Q${hub.x} ${hub.y - 14} ${hub.x + 10} ${hub.y + 6}`,
      stroke: PALE,
      'stroke-width': 1.6,
      'stroke-dasharray': '2 3',
    }),
    svg('circle', { cx: hub.x, cy: hub.y - 4, r: 3, fill: WARM }),
    people,
    chat,
    voice,
  );
  return root;
}

/** A radar sweeping: the LAN being searched for rooms. */
export function radarArt(): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 120 120', fill: 'none', class: 'play-radar' });
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  const sweep = svg('g', { class: 'radar-sweep' });
  sweep.append(
    svg('path', { d: 'M60 60L60 8A52 52 0 0 1 105 34Z', fill: CYAN, 'fill-opacity': 0.22 }),
  );
  root.append(
    ...[52, 36, 20].map((r) =>
      svg('circle', { cx: 60, cy: 60, r, stroke: CYAN, 'stroke-opacity': 0.3 }),
    ),
    svg('path', { d: 'M8 60H112M60 8V112', stroke: CYAN, 'stroke-opacity': 0.15 }),
    sweep,
    svg('circle', { cx: 60, cy: 60, r: 3, fill: PALE }),
    svg('circle', { cx: 84, cy: 40, r: 2.5, fill: PALE, class: 'radar-blip' }),
  );
  return root;
}
