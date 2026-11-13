import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { withSmallParts } from '../detail';
import { box, part, type PropBuilder } from './parts';

// A 16-inch gaming laptop, open on the hub's reception counter (Phase F-2), drawn in the item's
// box [w, h, d] (front +z, the keyboard towards the player, the lid at the back tipped ~108°).
// Its look follows a modern gaming laptop: a gunmetal deck with a full keyboard and a wide
// touchpad, angular vents on the rear corners and the sides, a slim-bezel lid with its camera and
// a light bar along the front edge (lit by the view: render/laptopView.ts). No maker's logo.
// Ultra adds the small parts (render/detail.ts): screws, rubber feet, the speaker grilles, the
// ports along the sides, the vents' fins.

/** The lid's tip back from upright (rad): open a little past square. */
export const LID_TILT = 0.31;
/** The deck's thickness and the lid's. */
const DECK = 0.026;
const LID = 0.008;
/** How far (m) the shell's back and sides stand in from the box: the vents' slots stand out of it. */
const SHELL_IN = 0.001;

/** The parts' layout at a size: the lid's height, the deck's depth, the hinge's line. */
function layout([, h = 0, d = 0]: readonly number[]) {
  const lidHeight = (h - DECK) / Math.cos(LID_TILT);
  const lean = Math.sin(LID_TILT) * lidHeight + LID / Math.cos(LID_TILT);
  const deckDepth = d - lean;
  return { lidHeight, deckDepth, deckZ: d / 2 - deckDepth / 2, hingeZ: d / 2 - deckDepth + 0.012 };
}

/** Where the screen is in the item's frame: its centre, size and tilt (for the view). */
export function laptopScreen(size: readonly number[]): {
  center: THREE.Vector3;
  width: number;
  height: number;
  tilt: number;
} {
  const [w = 0, h = 0] = size;
  const { lidHeight, hingeZ } = layout(size);
  const bottom = -h / 2 + DECK;
  const mid = (lidHeight + 0.006) / 2;
  return {
    // The lid's middle, a hair before its inner face (the lid tipped back about the hinge).
    center: new THREE.Vector3(
      0,
      bottom + Math.cos(LID_TILT) * mid + Math.sin(LID_TILT) * 0.0006,
      hingeZ - Math.sin(LID_TILT) * mid + Math.cos(LID_TILT) * 0.0006,
    ),
    width: w - 0.016,
    height: lidHeight - 0.026,
    tilt: LID_TILT,
  };
}

/** The keyboard's rows: the first row's centre (z), the row pitch, and the keys' left edge. */
const KEY_PITCH = 0.0185;
const KEY_ROWS = 6;
const KEY_FIRST = 0.045;
const KEY_MARGIN = 0.03;

/**
 * The keyboard's area on the deck (for the backlight): its centre (over the keys' tops) and its
 * size, from the first row to the last and from the left keys to the number pad's right edge.
 */
export function laptopKeyboard(size: readonly number[]): {
  center: THREE.Vector3;
  width: number;
  depth: number;
} {
  const [w = 0, h = 0, d = 0] = size;
  const back = d / 2 - layout(size).deckDepth;
  const first = back + KEY_FIRST - KEY_PITCH / 2;
  const last = back + KEY_FIRST + (KEY_ROWS - 1) * KEY_PITCH + KEY_PITCH / 2;
  // Over the keys' tops (the deck's surface, then the keys 2 mm), a hair above.
  const top = -h / 2 + DECK * 0.7 + 0.003 + 0.002 + 0.0006;
  return {
    center: new THREE.Vector3(0, top, (first + last) / 2),
    width: w - 2 * KEY_MARGIN + 0.008,
    depth: last - first + 0.004,
  };
}

/** The light bar along the deck's front edge: its centre and length (for the view). */
export function laptopLightBar([w = 0, h = 0, d = 0]: readonly number[]): {
  center: THREE.Vector3;
  length: number;
} {
  return { center: new THREE.Vector3(0, -h / 2 + 0.006, d / 2 - 0.0012), length: w - 0.03 };
}

const laptop: PropBuilder = (size) => {
  const [w = 0, h = 0, d = 0] = size;
  const bottom = -h / 2;
  const deckTop = bottom + DECK;
  const { lidHeight, deckDepth, deckZ, hingeZ } = layout(size);
  const back = deckZ - deckDepth / 2;
  // The deck: a slab, its front a little thinner (a wedge), its rear (the vents' block) full.
  const deck = [
    box(
      w - 2 * SHELL_IN,
      DECK * 0.7,
      deckDepth - 0.03,
      0,
      bottom + (DECK * 0.7) / 2,
      deckZ + 0.015,
    ),
    box(w - 2 * SHELL_IN, DECK, 0.03 - SHELL_IN, 0, bottom + DECK / 2, back + 0.015 + SHELL_IN / 2),
    box(w - 0.004, 0.003, deckDepth - 0.034, 0, bottom + DECK * 0.7 + 0.0015, deckZ + 0.013),
  ];
  // The lid, tipped back about the hinge: its shell (the bezel is the screen's own margin).
  const lid = new THREE.BoxGeometry(w, lidHeight, LID)
    .translate(0, lidHeight / 2, -LID / 2)
    .rotateX(-LID_TILT)
    .translate(0, deckTop, hingeZ);
  const hinge = new THREE.CylinderGeometry(0.006, 0.006, w * 0.82, 12)
    .rotateZ(Math.PI / 2)
    .translate(0, deckTop, hingeZ);
  // The keyboard: six rows of keys (the space bar long), a number pad on the right.
  const keys: THREE.BufferGeometry[] = [];
  const deckSurface = bottom + DECK * 0.7 + 0.003;
  const pitch = KEY_PITCH;
  const left = -w / 2 + KEY_MARGIN;
  const rowsZ = Array.from({ length: KEY_ROWS }, (_, r) => back + KEY_FIRST + r * pitch);
  rowsZ.forEach((z, r) => {
    const count = r === 5 ? 0 : 14;
    for (let c = 0; c < count; c++) {
      const width = r === 0 ? 0.014 : pitch - 0.003;
      keys.push(
        box(
          width,
          0.002,
          r === 0 ? 0.01 : pitch - 0.003,
          left + c * pitch + width / 2,
          deckSurface + 0.001,
          z,
        ),
      );
    }
    if (r === 5) {
      keys.push(box(0.016, 0.002, pitch - 0.003, left + 0.008, deckSurface + 0.001, z));
      keys.push(box(0.11, 0.002, pitch - 0.003, left + 0.13, deckSurface + 0.001, z));
      for (let c = 0; c < 4; c++) {
        keys.push(
          box(0.016, 0.002, pitch - 0.003, left + 0.2 + c * 0.0185, deckSurface + 0.001, z),
        );
      }
    }
    // The number pad.
    if (r > 0) {
      for (let c = 0; c < 4; c++) {
        keys.push(
          box(
            pitch - 0.003,
            0.002,
            pitch - 0.003,
            w / 2 - 0.085 + c * pitch,
            deckSurface + 0.001,
            z,
          ),
        );
      }
    }
  });
  const touchpad = box(0.12, 0.0008, 0.075, -0.02, deckSurface + 0.0004, d / 2 - 0.06);
  // Vents: slots on the rear corners and both sides, standing out of the shell by SHELL_IN (in its
  // plane, the two faces fought for the same depth and the slots flickered, Phú 2026-11-12).
  const vents: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      vents.push(
        box(
          0.004,
          DECK * 0.55,
          0.0012,
          s * (w / 2 - 0.06 + i * 0.007),
          bottom + DECK / 2,
          back + 0.0006,
        ),
      );
      vents.push(
        box(
          0.0012,
          DECK * 0.45,
          0.006,
          s * (w / 2 - 0.0006),
          bottom + DECK / 2,
          back + 0.04 + i * 0.01,
        ),
      );
    }
  }
  const fittings = part('trim', true, [hinge, ...keys, touchpad, ...vents]);
  withSmallParts(fittings.geometry, () => {
    const small: THREE.BufferGeometry[] = [];
    // Screws under the deck's edge, rubber feet, speaker grilles beside the keyboard, ports.
    for (const [x, z] of [
      [-w / 2 + 0.02, back + 0.02],
      [w / 2 - 0.02, back + 0.02],
      [-w / 2 + 0.02, d / 2 - 0.02],
      [w / 2 - 0.02, d / 2 - 0.02],
    ] as const) {
      small.push(
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.001, 10).translate(x, bottom - 0.0005, z),
      );
      small.push(box(0.05, 0.002, 0.008, x * 0.7, bottom - 0.001, z));
    }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 18; i++) {
        small.push(
          new THREE.CylinderGeometry(0.0008, 0.0008, 0.0006, 6).translate(
            s * (w / 2 - 0.012),
            deckSurface + 0.0003,
            back + 0.05 + i * 0.006,
          ),
        );
      }
      // Ports: USB-C, USB-A, HDMI, the jack along each side.
      [0.012, 0.007, 0.016, 0.006].forEach((width, i) => {
        small.push(
          box(
            0.0012,
            0.004,
            width,
            s * (w / 2 + 0.0006),
            bottom + DECK * 0.45,
            back + 0.12 + i * 0.022,
          ),
        );
      });
    }
    return small;
  });
  return [part('body', true, [...deck, lid]), fittings];
};

export const LAPTOP_PROPS = { 'gaming-laptop': laptop } satisfies Partial<
  Record<Prop, PropBuilder>
>;
