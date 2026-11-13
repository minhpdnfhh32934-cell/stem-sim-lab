import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { Assembly, at, slab } from './assembly';
import { LOOKS } from './looks';

type SpringStand = NonNullable<ItemDefinition['springStand']>;

/** The coil: a fixed number of turns whose pitch follows its length, like a real spring. */
export const SPRING = {
  turns: 14, // closed, they would be 14 × 4.4 mm: shorter than the shortest held coil (tests)
  ringsPerTurn: 16, // cross-sections of the wire along one turn
  sides: 8,
  radius: 0.018, // of the coil, to the wire's centre; also of the end loops
  wire: 0.0022, // the wire's radius
} as const;
const RINGS = SPRING.turns * SPRING.ringsPerTurn;

const FOOT = 0.006; // rubber pads under the base
const BASE = 0.03; // the base's height on its pads (as the old base plate)
const BASE_W = 0.3;
const BASE_D = 0.45;
const FLANGE = 0.01; // the column's foot plate, bolted to the base
const COLUMN = 0.06; // the square column
const CAP = 0.012; // its top cap
const ARM = 0.035; // the arm's square section
const EYE = 0.008; // radius of the eyes the spring's loops hang in and from
const EYE_WIRE = 0.0016;
const ARM_ABOVE_HOOK = 0.035; // the arm's underside above the hook (the eye bolt between)
const POINTER = 0.025; // the pointer's drop below the spring's lower end
const BOARD_W = 0.085; // the scale board behind the ruler
const RULER_X = -0.115; // the ruler's centre from the hook, towards −x (as it always hung)

/**
 * Where the spring hangs and where the ruler reads it, in the item's frame (origin at the centre of
 * its box). The ruler's 0 is where the pointer rests with nothing hanging, so it reads the
 * extension from the natural length: pointer at hook − length − POINTER, 0 at hook − L₀ − POINTER.
 * ExperimentView draws the ruler there, the frame's board holds it, the tests read it.
 */
export function springLayout(item: ItemDefinition, stand: SpringStand) {
  const [, h] = item.visual.size;
  const [hx, hy, hz] = stand.hook;
  const hook = new THREE.Vector3(hx, hy - h / 2, hz);
  const zero = hook.y - stand.naturalLength - POINTER;
  // Marks every centimetre, down past the elastic limit.
  const length = Math.ceil((stand.elasticLimit + 0.05) * 10) / 10;
  return {
    hook,
    pointer: POINTER,
    ruler: {
      zero,
      length,
      width: 0.07,
      center: new THREE.Vector3(hx + RULER_X, zero - length / 2, hz),
    },
  };
}

/** The stand's fixed parts: base, column, arm, the spring's eye bolt and the scale board. */
export interface SpringFrame {
  /** The column: the entity's own mesh takes it (its material shows focus). */
  readonly body: THREE.BufferGeometry;
  readonly parts: THREE.Group;
  dispose(): void;
}

/**
 * The spring stand, in the item's frame (+z is where the arm reaches out): a chamfered base on
 * four rubber pads; the column on a foot plate bolted to it, capped; a boss clamp on the column
 * with its thumb screw, holding the arm, braced from below; at the arm's end an eye bolt (a nut
 * above and below) the spring's top loop hangs in; and the scale board, hung from the arm on a
 * bar, behind the ruler. Only the look: the collider is still the item's box, and the hook, the
 * lengths and the extension come from the item and the run.
 */
export function buildSpringFrame(
  item: ItemDefinition,
  stand: SpringStand,
  painted: THREE.MeshStandardMaterial,
): SpringFrame {
  const [, h] = item.visual.size;
  const { hook, ruler } = springLayout(item, stand);
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const floor = -h / 2;
  const top = h / 2;
  const baseTop = floor + BASE;
  const baseZ = hook.z / 2; // under the column and the spring, as the old plate lay

  // 1. The base on its pads, the column's foot plate bolted to it.
  const base = mesh(keep(slab(BASE_W, BASE_D, BASE - FOOT, 0.03, 0.006)), painted);
  base.name = 'base';
  base.position.set(0, floor + FOOT, baseZ);
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  copies(
    keep(new THREE.CylinderGeometry(0.02, 0.022, FOOT, 16)),
    rubber,
    [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        at(sx * (BASE_W / 2 - 0.035), floor + FOOT / 2, baseZ + sz * (BASE_D / 2 - 0.04)),
      ),
    ),
  ).castShadow = false;
  mesh(keep(slab(0.1, 0.1, FLANGE, 0.01, 0.002)), painted).position.set(0, baseTop, 0);
  const bolts = [-1, 1].flatMap((bx) =>
    [-1, 1].map((bz) => at(bx * 0.038, baseTop + FLANGE + 0.003, bz * 0.038)),
  );

  // 2. The column (the entity's mesh) and its cap.
  const columnBottom = baseTop + FLANGE;
  const body = keep(slab(COLUMN, COLUMN, top - CAP - columnBottom, 0.006, 0.002));
  body.translate(0, columnBottom, 0);
  mesh(keep(slab(COLUMN + 0.006, COLUMN + 0.006, CAP, 0.006, 0.003)), plastic).position.set(
    0,
    top - CAP,
    0,
  );

  // 3. The boss clamp on the column, its thumb screw, the arm out to the hook and its brace.
  const armBottom = hook.y + ARM_ABOVE_HOOK;
  const armTop = armBottom + ARM;
  const clamp = mesh(keep(slab(0.085, 0.085, ARM + 0.02, 0.008, 0.003)), painted);
  clamp.name = 'clamp';
  clamp.position.set(0, armBottom - 0.01, 0);
  const screw = mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8)), steel);
  screw.rotation.z = Math.PI / 2;
  screw.position.set(-0.0525, armBottom + ARM / 2, 0);
  screw.castShadow = false;
  const knob = mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12)), plastic);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-0.068, armBottom + ARM / 2, 0);
  const armFrom = 0.0425; // the clamp's front face
  const armTo = hook.z + 0.03;
  const arm = mesh(keep(slab(ARM, armTo - armFrom, ARM, 0.004, 0.002)), painted);
  arm.name = 'arm';
  arm.position.set(hook.x, armBottom, (armFrom + armTo) / 2);
  const braceFrom = new THREE.Vector2(COLUMN / 2, armBottom - 0.16); // (z, y) on the column
  const braceTo = new THREE.Vector2(0.19, armBottom); // under the arm
  const braceRun = braceTo.clone().sub(braceFrom);
  const brace = mesh(keep(new THREE.BoxGeometry(0.016, 0.016, braceRun.length())), painted);
  brace.name = 'brace';
  brace.rotation.x = -Math.atan2(braceRun.y, braceRun.x);
  brace.position.set(0, (braceFrom.y + braceTo.y) / 2, (braceFrom.x + braceTo.x) / 2);

  // 4. The eye bolt at the arm's end: the eye the spring's top loop rests in, its rod through the
  //    arm, a nut under and over the arm. The loop's wire (centred at the hook) lies in the eye's
  //    bottom.
  const eyeY = hook.y - SPRING.wire - EYE_WIRE + EYE;
  const eye = mesh(keep(new THREE.TorusGeometry(EYE, EYE_WIRE, 6, 16)), steel);
  eye.name = 'eye';
  eye.rotation.y = Math.PI / 2;
  eye.position.set(hook.x, eyeY, hook.z);
  eye.castShadow = false;
  const rodBottom = eyeY + EYE;
  const rodTop = armTop + 0.008;
  const rod = mesh(keep(new THREE.CylinderGeometry(0.003, 0.003, rodTop - rodBottom, 8)), steel);
  rod.position.set(hook.x, (rodTop + rodBottom) / 2, hook.z);
  rod.castShadow = false;
  const nut = keep(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 6));
  copies(nut, steel, [
    at(hook.x, armBottom - 0.0025, hook.z),
    at(hook.x, armTop + 0.0025, hook.z),
  ]).castShadow = false;

  // 5. The scale board behind the ruler, hung from the arm's side on a bar, two screws at its top.
  const boardTop = armBottom + ARM / 2 + 0.01;
  const boardBottom = ruler.zero - ruler.length - 0.01;
  const boardZ = hook.z - 0.0035; // its face 1 mm behind the ruler
  const board = mesh(keep(new THREE.BoxGeometry(BOARD_W, boardTop - boardBottom, 0.005)), painted);
  board.name = 'board';
  board.position.set(ruler.center.x, (boardTop + boardBottom) / 2, boardZ);
  const barFrom = hook.x - ARM / 2;
  const barTo = ruler.center.x - BOARD_W / 2;
  const barDepth = 0.039;
  const bar = mesh(keep(new THREE.BoxGeometry(barFrom - barTo, 0.02, barDepth)), painted);
  bar.name = 'bar';
  bar.position.set((barFrom + barTo) / 2, boardTop - 0.01, boardZ - 0.0025 - barDepth / 2);
  for (const s of [-1, 1])
    bolts.push(at(ruler.center.x + s * 0.025, boardTop - 0.01, hook.z, Math.PI / 2));
  copies(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6)), steel, bolts).castShadow = false;

  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** What hangs from the hook; `pose` sets it to the spring's length, allocating nothing. */
export interface SpringHanger {
  /** At the hook. */
  readonly group: THREE.Group;
  /** The spring's length (m), from its top loop to its bottom loop — as the run gives it. */
  pose(length: number): void;
  dispose(): void;
}

/**
 * What hangs: the spring — its top loop in the eye bolt, the coil, its bottom loop — and the mass
 * hanger on that loop: its eye, the stem with the pointer's collar, a stack of brass disc masses
 * on the hanger's base (as wide and tall as the item's `weight`; its look does not follow the mass
 * set). The coil keeps its turns and its round wire and is spread to the length in place; the rest
 * moves with the bottom loop: no geometry is made after this.
 */
export function buildSpringHanger(stand: SpringStand, hook: THREE.Vector3): SpringHanger {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const springSteel = own(new THREE.MeshStandardMaterial({ color: '#d0d5da', ...LOOKS.metal }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  const red = own(new THREE.MeshBasicMaterial({ color: '#d0312d' })); // reads at any light
  const group = kit.group;
  group.position.copy(hook);
  const R = SPRING.radius;

  // The loops: half turns of the wire in the x–y plane, their apex on the spring's ends.
  const loop = keep(new THREE.TorusGeometry(R, SPRING.wire, SPRING.sides, 12, Math.PI));
  const topLoop = mesh(loop, springSteel, group);
  topLoop.name = 'top-loop';
  topLoop.position.y = -R;
  const coil = mesh(keep(springGeometry()), springSteel, group);
  coil.name = 'coil';
  coil.position.y = -R;
  coil.frustumCulled = false; // its bounds change with its length

  const hanger = new THREE.Group();
  hanger.name = 'hanger';
  group.add(hanger);
  const bottomLoop = mesh(loop, springSteel, hanger);
  bottomLoop.name = 'bottom-loop';
  bottomLoop.rotation.z = Math.PI;
  bottomLoop.position.y = R;
  // The hanger's eye hangs on the bottom loop's wire (centred at the hanger's origin).
  const eyeY = SPRING.wire + EYE_WIRE - EYE;
  const eye = mesh(keep(new THREE.TorusGeometry(EYE, EYE_WIRE, 6, 16)), steel, hanger);
  eye.name = 'hanger-eye';
  eye.rotation.y = Math.PI / 2;
  eye.position.y = eyeY;
  eye.castShadow = false;
  const s = stand.weight;
  const plate = 0.004;
  const stackTop = -POINTER - 0.008;
  const stemTop = eyeY - EYE;
  const stemBottom = stackTop - s - 0.004;
  const stem = mesh(
    keep(new THREE.CylinderGeometry(0.0025, 0.0025, stemTop - stemBottom, 8)),
    steel,
    hanger,
  );
  stem.position.y = (stemTop + stemBottom) / 2;
  stem.castShadow = false;
  const collar = mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 8)), steel, hanger);
  collar.position.y = -POINTER;
  collar.castShadow = false;
  const pointer = mesh(
    keep(new THREE.BoxGeometry(-RULER_X - 0.035 - 0.006, 0.003, 0.003)),
    red,
    hanger,
  );
  pointer.name = 'pointer';
  pointer.position.set(-(-RULER_X - 0.035 + 0.006) / 2, -POINTER, 0);
  pointer.castShadow = false;
  const discs = 5;
  const disc = (s - plate) / discs;
  copies(
    keep(new THREE.CylinderGeometry(s / 2 - 0.002, s / 2 - 0.002, disc - 0.001, 24)),
    brass,
    Array.from({ length: discs }, (_, i) => at(0, stackTop - (i + 0.5) * disc, 0)),
    hanger,
  ).name = 'masses';
  const base = mesh(keep(new THREE.CylinderGeometry(s / 2, s / 2, plate, 24)), steel, hanger);
  base.name = 'hanger-base';
  base.position.y = stackTop - s + plate / 2;

  let drawn = NaN;
  const pose = (length: number) => {
    if (length === drawn) return;
    drawn = length;
    stretchSpring(coil.geometry, length - 2 * R);
    hanger.position.y = -length;
  };
  pose(stand.naturalLength); // until its session exists (the scene's stations attach after spawning)
  return { group, pose, dispose: () => kit.dispose() };
}

/** The coil's mesh: its rings of vertices and the faces between them; `stretchSpring` places them. */
function springGeometry(): THREE.BufferGeometry {
  const count = (RINGS + 1) * SPRING.sides;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const index: number[] = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SPRING.sides; j++) {
      const a = i * SPRING.sides + j;
      const b = i * SPRING.sides + ((j + 1) % SPRING.sides);
      index.push(a, b, a + SPRING.sides, b, b + SPRING.sides, a + SPRING.sides);
    }
  }
  geometry.setIndex(index);
  return geometry;
}

/**
 * Lays the coil out `length` long, hanging down from its origin: the helix (R cos a, −rise·a,
 * R sin a), each ring of the wire in the helix's own frame — the normal N toward the axis, the
 * binormal B = T × N — so the wire stays round however far the coil is stretched. Rewrites the
 * buffers in place: no allocation.
 */
function stretchSpring(geometry: THREE.BufferGeometry, length: number): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const { radius, wire, sides, turns } = SPRING;
  const rise = length / (2 * Math.PI * turns); // drop per radian of coil
  const speed = Math.hypot(radius, rise);
  for (let i = 0; i <= RINGS; i++) {
    const a = (i / RINGS) * turns * 2 * Math.PI;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const bx = (rise * sin) / speed;
    const by = -radius / speed;
    const bz = (-rise * cos) / speed;
    for (let j = 0; j < sides; j++) {
      const phi = (j / sides) * 2 * Math.PI;
      const n = Math.cos(phi);
      const b = Math.sin(phi);
      const nx = -n * cos + b * bx;
      const ny = b * by;
      const nz = -n * sin + b * bz;
      const v = i * sides + j;
      normal.setXYZ(v, nx, ny, nz);
      position.setXYZ(v, radius * cos + wire * nx, -rise * a + wire * ny, radius * sin + wire * nz);
    }
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
}
