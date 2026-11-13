import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { box, drum, part, type PropBuilder, rod } from './parts';

// Ceiling details shared by the rooms (UX3): a trim or housing round each ceiling light, supply
// diffusers, return and extract grilles, a service access panel, a lab cable tray, and the hub's
// coffer round its oculus. Each item's top is the ceiling (y = h/2) and its face looks down. None
// casts a shadow: each sits on the ceiling, and the room's key light hangs just under a fixture.

type G = THREE.BufferGeometry;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** A flat rectangular frame from y0 to y1, between half sizes (ox, oz) outside and (ix, iz) in. */
const frame = (ox: number, oz: number, ix: number, iz: number, y0: number, y1: number): G[] => [
  span(-ox, y0, iz, ox, y1, oz),
  span(-ox, y0, -oz, ox, y1, -iz),
  span(-ox, y0, -iz, -ix, y1, iz),
  span(ix, y0, -iz, ox, y1, iz),
];

/** The face of a trim or housing round its light (m); the light fills the opening. */
const TRIM = 0.04;
/** The dark shadow gap between a trim and its light (m). */
const REVEAL = 0.008;
/** The ceiling lights’ thickness (m): a reveal stops at the light’s face, a housing goes on below it. */
const LIGHT = 0.06;

/**
 * A light's trim or housing (the item's colour): a frame `TRIM` wide round an opening the size
 * of its light, as deep as the item — a flush trim, or a lab housing deeper than the light, which
 * then sits recessed — with a dark reveal line between frame and light, at the light’s face.
 */
const fixtureTrim: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [x, z] = [w / 2 - TRIM, d / 2 - TRIM]; // the light's half sizes
  return [
    part('body', false, frame(w / 2, d / 2, x + REVEAL, z + REVEAL, -h / 2, h / 2)),
    part(
      'trim',
      false,
      frame(x + REVEAL, z + REVEAL, x, z, Math.max(-h / 2 + 0.004, h / 2 - LIGHT), h / 2),
    ),
  ];
};

/**
 * A square four-way supply diffuser (the item's colour): an outer flange, three nested rings
 * stepping up into the ceiling and a centre plate dropped level with the flange, over a dark
 * throat that shows between them.
 */
const airDiffuser: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const step = Math.min(w, d) / 10;
  const [hw, hd, bottom] = [w / 2, d / 2, -h / 2];
  const t = Math.min(0.008, h / 4); // sheet
  const body: G[] = [...frame(hw, hd, hw - step, hd - step, bottom, bottom + t)];
  for (let k = 1; k <= 3; k++) {
    const [ox, oz] = [hw - k * step, hd - k * step];
    const y = bottom + Math.min(0.005 * k, h / 2);
    body.push(
      ...frame(ox - 0.15 * step, oz - 0.15 * step, ox - 0.7 * step, oz - 0.7 * step, y, y + t),
    );
  }
  body.push(span(-hw + 4 * step, bottom, -hd + 4 * step, hw - 4 * step, bottom + t, hd - 4 * step));
  return [
    part('body', false, body),
    part('trim', false, [span(-hw + step, h / 2 - 0.004, -hd + step, hw - step, h / 2, hd - step)]),
  ];
};

/**
 * A return or extract grille (the item's colour): a frame and blades along its length (x) every
 * 20 mm, over a dark plenum.
 */
const ceilingGrille: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const f = Math.min(0.03, d / 6, w / 6);
  const [hw, hd, bottom] = [w / 2, d / 2, -h / 2];
  const blade = Math.min(0.02, 0.7 * h);
  const n = Math.max(1, Math.floor((d - 2 * f) / 0.02));
  const body: G[] = frame(hw, hd, hw - f, hd - f, bottom, bottom + Math.min(0.01, h / 2));
  for (let i = 0; i < n; i++) {
    const z = -hd + f + ((i + 0.5) * (d - 2 * f)) / n;
    body.push(span(-hw + f, bottom + 0.002, z - 0.002, hw - f, bottom + blade, z + 0.002));
  }
  return [
    part('body', false, body),
    part('trim', false, [span(-hw + f, h / 2 - 0.004, -hd + f, hw - f, h / 2, hd - f)]),
  ];
};

/**
 * A service access panel: a hinged ceiling hatch in the item's colour, 2 mm up inside a slim
 * aluminium bezel, with two dark quarter-turn locks on its face.
 */
const accessPanel: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const f = Math.min(0.012, w / 10, d / 10);
  const bottom = -h / 2;
  const lock = (x: number) =>
    drum(0.008, 0.008, bottom + 0.001, bottom + 0.003, 12).translate(x, 0, 0);
  return [
    part('body', false, [
      span(-w / 2 + f, bottom + 0.002, -d / 2 + f, w / 2 - f, h / 2, d / 2 - f),
    ]),
    part('aluminium', false, frame(w / 2, d / 2, w / 2 - f, d / 2 - f, bottom, h / 2)),
    part('trim', false, [lock(-w / 2 + 0.06), lock(w / 2 - 0.06)]),
  ];
};

/**
 * A ladder cable tray along x (the item's colour, galvanised): two side rails and rungs every
 * 0.3 m, sitting on steel trapeze bars hung from the ceiling by threaded rods every ≈ 1.6 m,
 * carrying a few cables.
 */
const cableTray: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const y0 = bottom + 0.02; // the tray's floor, on the trapeze bars
  const side = Math.min(0.08, h / 3);
  const rail = d / 2 - 0.02; // the rails, inside the hangers
  const t = 0.004;
  const body: G[] = [
    span(-w / 2, y0, -rail, w / 2, y0 + side, -rail + t),
    span(-w / 2, y0, rail - t, w / 2, y0 + side, rail),
  ];
  const rungs = Math.max(2, Math.round(w / 0.3));
  for (let i = 0; i < rungs; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / rungs;
    body.push(span(x - 0.01, y0, -rail + t, x + 0.01, y0 + 0.012, rail - t));
  }
  const steel: G[] = [];
  const hangers = Math.max(2, Math.round(w / 1.6) + 1);
  for (let j = 0; j < hangers; j++) {
    const x = -w / 2 + 0.15 + (j * (w - 0.3)) / (hangers - 1);
    steel.push(span(x - 0.015, bottom, -d / 2, x + 0.015, y0, d / 2));
    for (const s of [-1, 1])
      steel.push(rod(0.005, v(x, bottom, s * (d / 2 - 0.008)), v(x, top, s * (d / 2 - 0.008)), 6));
  }
  const cables = (
    [
      [0.012, -0.08],
      [0.012, -0.05],
      [0.009, -0.01],
      [0.009, 0.015],
      [0.016, 0.07],
    ] as const
  ).map(([r, z]) =>
    rod(
      r,
      v(-w / 2 + 0.01, y0 + 0.012 + r, z * (d / 0.3)),
      v(w / 2 - 0.01, y0 + 0.012 + r, z * (d / 0.3)),
    ),
  );
  return [part('body', false, body), part('steel', false, steel), part('trim', false, cables)];
};

/** Reverses an open shape's faces, so its inside is drawn (and lit) instead of its outside. */
function inward(geometry: G): G {
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) {
    normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  }
  return geometry;
}

/** A flat ring from radius r0 to r1 at height y, facing down. */
const ringDown = (r0: number, r1: number, y: number) =>
  new THREE.RingGeometry(r0, r1, 96).rotateX(Math.PI / 2).translate(0, y, 0);

/** An upright band of radius r from y0 to y1, facing out (or in, toward the centre). */
const band = (r: number, y0: number, y1: number, facingIn = false) => {
  const geometry = drum(r, r, y0, y1, 96, true);
  return facingIn ? inward(geometry) : geometry;
};

/** The coffer's rings, inward from its outer edge (m): fascia, coffered soffit, inner lip. */
const FASCIA = 0.24;
const COFFER = 0.56;
const LIP = 0.18;
/** The coffer's ribs, round its soffit. */
const RIBS = 16;

/**
 * The hub's coffer round the oculus (a cylinder item, its top the ceiling): an outer fascia ring
 * hanging lowest, a soffit stepped up into the ceiling and cut into coffers by radial ribs, and
 * an inner lip that frames the oculus. A cove light (the clerestory’s cool white) runs round the fascia's inner face, just
 * under the soffit. Its opening is the oculus's, so the oculus and the emblem below it stay clear.
 */
const cofferRing: PropBuilder = ([w = 0, h = 0]) => {
  const r3 = w / 2;
  const [r2, r1, r0] = [r3 - FASCIA, r3 - FASCIA - COFFER, r3 - FASCIA - COFFER - LIP];
  const [bottom, top] = [-h / 2, h / 2];
  const soffit = top - 0.26 * h; // the coffers' ceiling
  const lip = top - 0.7 * h; // the inner lip's underside
  const cove = Math.min(0.05, (soffit - bottom) / 4);
  const ribs = Array.from({ length: RIBS }, (_, k) =>
    box(r2 - r1 + 0.04, soffit - lip, 0.08, (r1 + r2) / 2, (soffit + lip) / 2, 0).rotateY(
      (k * 2 * Math.PI) / RIBS,
    ),
  );
  return [
    part('body', false, [
      band(r0, lip, top, true),
      ringDown(r0, r1, lip),
      band(r1, lip, soffit),
      ringDown(r1, r2, soffit),
      band(r2, bottom, soffit - cove, true),
      ringDown(r2, r3, bottom),
      band(r3, bottom, top),
      ...ribs,
    ]),
    part('glow-cool', false, [band(r2, soffit - cove, soffit, true)]),
  ];
};

export const CEILING_PROPS = {
  'fixture-trim': fixtureTrim,
  'air-diffuser': airDiffuser,
  'ceiling-grille': ceilingGrille,
  'access-panel': accessPanel,
  'cable-tray': cableTray,
  'coffer-ring': cofferRing,
} satisfies Partial<Record<Prop, PropBuilder>>;
