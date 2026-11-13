import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import type { Finish } from '../palette';
import { box, drum, part, type PropBuilder, type PropPart, rod, sphere } from './parts';
import { REAGENT_PROPS } from './reagent';

// The circuit bench's plug-in parts (Phase E-1): a module on a dark base, its two terminals at
// its ends (x ±), its `a` (+) end at −x — red on a part with a polarity. Drawn in the item's box
// [w, h, d] (x along the edge it plugs into, front +z, floor at −h/2). A switch and a rheostat
// come in variants for the board (`switchParts`, `rheostatParts`): what a mounted one shows.

type G = THREE.BufferGeometry;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The plug-in base's thickness. */
export const BASE = 0.012;
/** How far in from each end a terminal post stands. */
const POST_IN = 0.008;

/** The length every part is drawn at; an item's own length scales it uniformly. */
const NOMINAL = 0.09;

/** A part drawn at the nominal length, then scaled uniformly to the item's size. */
function uniform<A extends unknown[]>(
  build: (size: readonly number[], ...args: A) => PropPart[],
): (size: readonly number[], ...args: A) => PropPart[] {
  return (size, ...args) => {
    const k = (size[0] ?? NOMINAL) / NOMINAL;
    const parts = build(
      size.map((x) => x / k),
      ...args,
    );
    for (const { geometry } of parts) geometry.scale(k, k, k);
    return parts;
  };
}

/** The pieces of one part by finish, merged one part per finish. */
function parts(pieces: Partial<Record<Finish | 'body', G[]>>): PropPart[] {
  return Object.entries(pieces)
    .filter(([, list]) => list.length > 0)
    .map(([finish, list]) => part(finish as Finish | 'body', finish !== 'glass', list));
}

/** The base under every part, and its two terminal posts (the + one red when it has a polarity). */
function base([w = 0, h = 0, d = 0]: readonly number[]) {
  const bottom = -h / 2;
  const post = (s: number) =>
    drum(0.0045, 0.0045, bottom + BASE, bottom + BASE + 0.006, 12).translate(
      s * (w / 2 - POST_IN),
      0,
      d / 2 - 0.01,
    );
  return { base: box(w, BASE, d, 0, bottom + BASE / 2, 0), plus: post(-1), minus: post(1) };
}

const resistor: PropBuilder = uniform((size) => {
  const [w = 0, h = 0] = size;
  const b = base(size);
  const y = -h / 2 + BASE + 0.008;
  const lead = w / 2 - POST_IN;
  return parts({
    body: [
      drum(0.007, 0.007, -0.02, 0.02, 16)
        .rotateZ(Math.PI / 2)
        .translate(0, y, 0),
    ],
    trim: [b.base],
    steel: [b.plus, b.minus, rod(0.0012, v(-lead, y, 0), v(lead, y, 0), 6)],
  });
});

const lamp: PropBuilder = uniform((size) => {
  const [, h = 0] = size;
  const b = base(size);
  const bottom = -h / 2 + BASE;
  return parts({
    body: [drum(0.013, 0.012, bottom, bottom + 0.018, 16)],
    trim: [b.base],
    steel: [b.plus, b.minus, drum(0.009, 0.009, bottom + 0.018, bottom + 0.024, 16)],
    glass: [sphere(0.018, 0, bottom + 0.04, 0, 16)],
  });
});

/** A knife switch, its blade closed onto its far contact or swung up open. */
export const switchParts = uniform((size: readonly number[], closed: boolean): PropPart[] => {
  const [w = 0, h = 0] = size;
  const b = base(size);
  const bottom = -h / 2 + BASE;
  const pivot = v(-w / 2 + 0.016, bottom + 0.012, 0);
  const angle = closed ? 0 : 0.4;
  const tip = v(pivot.x + 0.05 * Math.cos(angle), pivot.y + 0.05 * Math.sin(angle), 0);
  return parts({
    body: [b.base],
    steel: [
      b.plus,
      b.minus,
      box(0.008, 0.012, 0.016, pivot.x, bottom + 0.006, 0),
      box(0.008, 0.012, 0.016, w / 2 - 0.02, bottom + 0.006, 0),
      rod(0.0025, pivot, tip, 6),
    ],
    trim: [sphere(0.005, tip.x, tip.y, 0, 8)],
  });
});

const knifeSwitch: PropBuilder = (size) => switchParts(size, false);

const cell: PropBuilder = uniform((size) => {
  const [w = 0, h = 0, d = 0] = size;
  const b = base(size);
  const r = Math.min((h - BASE) / 2, d / 2) - 0.001;
  const y = -h / 2 + BASE + r;
  const length = w - 2 * POST_IN - 0.01;
  return parts({
    body: [
      drum(r, r, -length / 2, length / 2, 20)
        .rotateZ(Math.PI / 2)
        .translate(0, y, 0),
    ],
    trim: [b.base, b.minus],
    'alarm-red': [
      b.plus,
      drum(r * 0.45, r * 0.45, 0, 0.003, 12)
        .rotateZ(Math.PI / 2)
        .translate(-length / 2 - 0.0015, y, 0),
    ],
  });
});

/** A digital meter: its housing, the dark window its reading shows in, red + and black − posts. */
const meter: PropBuilder = uniform((size) => {
  const [w = 0, h = 0, d = 0] = size;
  const b = base(size);
  const bottom = -h / 2 + BASE;
  const housing = h - BASE - 0.001;
  return parts({
    body: [box(w - 0.03, housing, d - 0.006, 0, bottom + housing / 2, -0.003)],
    trim: [b.base, b.minus, box(w - 0.04, 0.001, d - 0.02, 0, h / 2 - 0.0005, -0.003)],
    'alarm-red': [b.plus],
  });
});

/** A slide rheostat: its wound drum, the slider's bar and (unless the board poses it) its knob. */
export const rheostatParts = uniform((size: readonly number[], knob: boolean): PropPart[] => {
  const [w = 0, h = 0] = size;
  const b = base(size);
  const bottom = -h / 2 + BASE;
  const length = w - 2 * POST_IN - 0.012;
  const bar = h / 2 - 0.004;
  return parts({
    body: [
      drum(0.009, 0.009, -length / 2, length / 2, 16)
        .rotateZ(Math.PI / 2)
        .translate(0, bottom + 0.01, -0.006),
    ],
    trim: [b.base, ...(knob ? [rheostatKnob([NOMINAL, h], 1)] : [])],
    steel: [
      b.plus,
      b.minus,
      rod(0.002, v(-length / 2, bar, 0.012), v(length / 2, bar, 0.012), 6),
      box(0.004, h / 2 - bottom, 0.004, -length / 2, (bottom + h / 2) / 2, 0.012),
      box(0.004, h / 2 - bottom, 0.004, length / 2, (bottom + h / 2) / 2, 0.012),
    ],
  });
});

/** The rheostat's slider knob at `share` of its track (0: one end, 1: the other). */
export function rheostatKnob(size: readonly number[], share: number): G {
  const k = (size[0] ?? NOMINAL) / NOMINAL;
  const h = (size[1] ?? 0) / k;
  const length = NOMINAL - 2 * POST_IN - 0.012;
  return box(
    0.01,
    0.008,
    0.014,
    -length / 2 + 0.005 + share * (length - 0.01),
    h / 2 - 0.0045,
    0.006,
  ).scale(k, k, k);
}

const rheostat: PropBuilder = (size) => rheostatParts(size, true);

const fuse: PropBuilder = uniform((size) => {
  const [, h = 0] = size;
  const b = base(size);
  const y = -h / 2 + BASE + 0.008;
  return parts({
    body: [b.base],
    steel: [
      b.plus,
      b.minus,
      box(0.006, 0.014, 0.012, -0.02, -h / 2 + BASE + 0.006, 0),
      box(0.006, 0.014, 0.012, 0.02, -h / 2 + BASE + 0.006, 0),
      drum(0.0055, 0.0055, -0.024, -0.016, 12)
        .rotateZ(Math.PI / 2)
        .translate(0, y, 0),
      drum(0.0055, 0.0055, 0.016, 0.024, 12)
        .rotateZ(Math.PI / 2)
        .translate(0, y, 0),
      rod(0.0006, v(-0.016, y, 0), v(0.016, y, 0), 4),
    ],
    glass: [
      drum(0.005, 0.005, -0.016, 0.016, 12)
        .rotateZ(Math.PI / 2)
        .translate(0, y, 0),
    ],
  });
});

export const CIRCUIT_PROPS = {
  // The reagent cabinet as built, holding the circuit bench's parts (not an experiment's glassware).
  'parts-cabinet': REAGENT_PROPS['reagent-cabinet'],
  'part-resistor': resistor,
  'part-lamp': lamp,
  'part-switch': knifeSwitch,
  'part-cell': cell,
  'part-meter': meter,
  'part-rheostat': rheostat,
  'part-fuse': fuse,
} satisfies Partial<Record<Prop, PropBuilder>>;
