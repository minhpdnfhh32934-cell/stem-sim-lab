import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { Assembly, at } from '../assembly';
import { LOOKS } from '../looks';
import { box } from '../props/parts';
import {
  colorimeterParts,
  DASH,
  DIGITS,
  type FrameParts,
  type G,
  merged,
  onSlope,
  originOf,
  paint,
  POW10,
  segments,
  SLOPE,
  SLOT,
} from './colorimeter';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The dilution bench of the physical lab (model chemistry.dilution): a white tile that flasks are
// set down on, and the school colorimeter (`colorimeter.ts`'s own case, display and slot) whose
// cuvette is a receiver-only container of the item (`container` with a `mouth`, no `pour`): the
// glass and the sample in it are drawn by ContainerView from the container's state, not here. The
// tile is drawn where the item's `seats` stand on its `colliders` — a seat is a surface the physics
// has, so the picture and the surface cannot disagree. Laid out from `bench.top` as the other
// benches are (+z towards the player, real sizes in m). The bench itself has nothing that moves; its
// rig is the colorimeter's two readouts and its 590 nm lamp, one instanced mesh named `reading`,
// which ContainerView shows only while the cuvette holds a sample: a colorimeter reads what is in
// its cuvette. They show A (0.001) and C₂ (µmol/L, to the resolution d the dial set, as
// `measurement.ts` reads it) once the run has completed, dashes before.

/**
 * Where the cuvette stands for the item's `container` block, in the item's frame (from its centre):
 * its axis (x, z), the inner floor and the rim. A 12.5 mm square cuvette, 45 mm tall, 2 mm of
 * floor; the container's `mouth.center` and `profile` follow these.
 */
export function cuvetteOf(item: ItemDefinition): {
  readonly axis: readonly [number, number];
  readonly floor: number;
  readonly rim: number;
} {
  const o = originOf(item);
  return {
    axis: [o.x + SLOT.x, o.z + SLOT.z],
    floor: o.y + SLOT.bottom + 0.002,
    rim: o.y + SLOT.bottom + 0.045,
  };
}

const TILE_COLOR = '#f3f4f2';

/** The tile(s): each collider a seat stands on, white, in the frame's coordinates. */
function tiles(item: ItemDefinition, origin: THREE.Vector3, plastic: G[]): void {
  const { seats = [], colliders = [] } = item;
  const drawn = new Set<number>();
  for (const seat of seats) {
    const [sx, sy, sz] = seat.center;
    colliders.forEach((c, i) => {
      const [cx, cy, cz] = c.center;
      const [w, h, d] = c.size;
      const onTop =
        Math.abs(cy + h / 2 - sy) <= 1e-3 &&
        Math.abs(sx - cx) <= w / 2 + 1e-3 &&
        Math.abs(sz - cz) <= d / 2 + 1e-3;
      if (!onTop || drawn.has(i)) return;
      drawn.add(i);
      plastic.push(paint(box(w, h, d, cx - origin.x, cy - origin.y, cz - origin.z), TILE_COLOR));
    });
  }
}

/** The colorimeter and the tile; the body is the case (the entity's mesh), plastics one mesh. */
function frame(item: ItemDefinition): BenchFrame {
  const origin = originOf(item);
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(origin); // built from bench.top, as the rig is
  const parts: FrameParts = { body: [], plastic: [], glass: [] };
  colorimeterParts(parts, false); // the cuvette is the container's
  tiles(item, origin, parts.plastic);
  const body = keep(merged(parts.body));
  body.translate(origin.x, origin.y, origin.z);
  mesh(
    keep(merged(parts.plastic)),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
  ).name = 'plastic';
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A seven-segment readout on the sloped panel: s along the slope, its digits and colours. */
interface Readout {
  readonly s: number;
  readonly digits: number;
  readonly height: number;
  readonly pitch: number;
  readonly on: string;
  readonly off: string;
}

/** The two rows of the display window (88 × 34 mm), A above C₂. */
export const READOUTS = {
  /** The absorbance, red, 0.000–9.999. */
  absorbance: { s: 0.0535, digits: 4, height: 0.012, pitch: 0.0095, on: '#ff3b2f', off: '#3a0d0b' },
  /** C₂ in µmol/L, green, to the dial's resolution. */
  concentration: {
    s: 0.0365,
    digits: 4,
    height: 0.012,
    pitch: 0.0095,
    on: '#43e07a',
    off: '#0d2a17',
  },
} as const satisfies Record<string, Readout>;
type Row = keyof typeof READOUTS;
const ROWS = Object.keys(READOUTS) as Row[];
const PER_ROW = 4 * 7 + 1; // segments and the decimal point
/** Instance indices: a row's segments from `start`, then its point; the lamp last. */
export const INDICATORS = {
  start: { absorbance: 0, concentration: PER_ROW } as Record<Row, number>,
  lamp: 2 * PER_ROW,
  count: 2 * PER_ROW + 1,
};
/** The display's x centre on the panel, and the lamp's place (as colorimeter.ts's). */
const PANEL_X = 0.005;
const LAMP_ON = '#ffa62b'; // 590 nm: orange
const LAMP_OFF = '#3b2a10';

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(originOf(item));

  const cell = keep(new THREE.BoxGeometry(1, 1, 1));
  const matrices = Array.from({ length: INDICATORS.count }, () => new THREE.Matrix4());
  const led = kit.copies(cell, own(new THREE.MeshBasicMaterial()), matrices);
  led.name = 'reading';
  led.castShadow = false;
  led.receiveShadow = false;

  const on = {} as Record<Row, THREE.Color>;
  const off = {} as Record<Row, THREE.Color>;
  const set = (i: number, base: THREE.Matrix4, [lx, ly, w, h]: readonly number[]) =>
    led.setMatrixAt(
      i,
      base.clone().multiply(at(lx ?? 0, ly ?? 0, 0).scale(new THREE.Vector3(w, h, 0.0006))),
    );
  for (const row of ROWS) {
    const o: Readout = READOUTS[row];
    on[row] = new THREE.Color(o.on);
    off[row] = new THREE.Color(o.off);
    const base = at(...onSlope(PANEL_X, o.s, 0.0016), SLOPE);
    const left = (-(o.digits - 1) / 2) * o.pitch;
    for (let d = 0; d < o.digits; d++) {
      segments(o.height).forEach(([sx, sy, w, h], s) => {
        set(INDICATORS.start[row] + d * 7 + s, base, [left + d * o.pitch + sx, sy, w, h]);
        led.setColorAt(INDICATORS.start[row] + d * 7 + s, off[row]);
      });
    }
    led.setColorAt(INDICATORS.start[row] + o.digits * 7, on[row]); // the point, moved by `show`
  }
  const lampOn = new THREE.Color(LAMP_ON);
  const lampOff = new THREE.Color(LAMP_OFF);
  set(INDICATORS.lamp, at(...onSlope(-0.07, 0.045, 0.0012), SLOPE), [0, 0, 0.005, 0.005]);
  led.setColorAt(INDICATORS.lamp, lampOff);
  const colors = led.instanceColor as THREE.InstancedBufferAttribute; // made by setColorAt

  // Writes a number into a row to `places` decimals, leading zeros blank; dashes if unreadable.
  // The point is the row's last instance, moved to sit after the units digit.
  const shown: Record<Row, string> = { absorbance: '', concentration: '' };
  const show = (row: Row, value: number, places: number) => {
    const o: Readout = READOUTS[row];
    const n = Math.round(value * (POW10[places] ?? 1));
    const key = Number.isFinite(n) && n >= 0 && n < (POW10[o.digits] ?? 0) ? n : -1;
    const id = `${key}/${places}`;
    if (id === shown[row]) return;
    shown[row] = id;
    for (let d = 0; d < o.digits; d++) {
      const k = o.digits - 1 - d; // its power of ten
      const p = POW10[k] ?? 1;
      const mask =
        key < 0 ? DASH : k > places && key < p ? 0 : (DIGITS[Math.floor(key / p) % 10] ?? 0);
      for (let s = 0; s < 7; s++)
        led.setColorAt(INDICATORS.start[row] + d * 7 + s, mask & (1 << s) ? on[row] : off[row]);
    }
    const t = o.height * 0.12;
    const units = o.digits - 1 - places;
    const left = (-(o.digits - 1) / 2) * o.pitch;
    const base = at(...onSlope(PANEL_X, o.s, 0.0016), SLOPE);
    set(INDICATORS.start[row] + o.digits * 7, base, [
      left + units * o.pitch + o.height * 0.25 + t,
      -o.height / 2 + t / 2,
      places > 0 ? t : 1e-5, // no point on a whole number
      t,
    ]);
    led.instanceMatrix.needsUpdate = true;
    colors.needsUpdate = true;
  };
  show('absorbance', NaN, 3);
  show('concentration', NaN, 1);

  let complete: boolean | null = null;
  let readC = NaN;
  let readD = NaN;
  let micro = NaN;
  let places = 1;
  const pose = ({ status, parameters, sample }: BenchPose) => {
    const done = status === 'completed';
    if (done !== complete) {
      complete = done;
      led.setColorAt(INDICATORS.lamp, done ? lampOn : lampOff);
      colors.needsUpdate = true;
    }
    // A colorimeter reads the mixed solution, so only a completed run's: A over its 1 cm path is
    // the model's `absorbance`, C₂ its `concentration` read to the resolution d, as measurement.ts does.
    show('absorbance', done ? (sample.absorbance ?? NaN) : NaN, 3);
    const c = done ? (sample.concentration ?? NaN) : NaN;
    const d = parameters.concentrationResolution ?? NaN;
    if (!Object.is(c, readC) || !Object.is(d, readD)) {
      readC = c;
      readD = d;
      // quantize allocates: only on a change. shortcut: d finer than 1e-9 mol/L shows 3 places.
      const valid = Number.isFinite(d) && d > 0;
      places = valid ? Math.min(Math.max(decimals(d) - 6, 0), 3) : 1;
      micro = valid && Number.isFinite(c) ? quantize(c, d) * 1e6 : NaN;
    }
    show('concentration', micro, places);
  };
  pose({ status: 'idle', parameters: {}, sample: {} }); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const dilutionColorimeter: BenchModel = {
  frame,
  rig,
  reads: ['absorbance', 'concentration'],
};
