/**
 * The figures of the logistic-growth habitat: one low-poly grazer per drawn slot (one draw call,
 * tinted in the population's chart colour), a soft contact shadow under each (one draw call) and
 * a ring under the picked one. How many stand comes from the model (`binding.ts`); the creature
 * (no species: long ears, a round body, a puff of a tail), its hops and nibbles, a newcomer
 * growing in and a figure that leaves shrinking away are illustration.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { contactShadow } from '@/ui/three/lighting';
import { LAYER } from '@/ui/three/layers';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { highlight } from '../../view3d/recipes';
import type { Slot } from './layout';

/** Seconds between two hops of one figure, the hop's share of that and its height. */
const HOP_EVERY = 3.4;
const HOP_SHARE = 0.14;
const HOP_HEIGHT = 0.2;
/** Seconds between two nibbles (head down to the grass) and the nibble's share of that. */
const NIBBLE_EVERY = 4.6;
const NIBBLE_SHARE = 0.3;
/** A newcomer grows in, a figure that leaves shrinks away, in these times (s). */
export const BIRTH = 0.45;
export const LEAVE = 0.35;

/**
 * A part of a merged figure: shape, shade (1: the instance tint, a little darker underneath; below
 * 1 a fixed dark shade such as eyes or feet; above 1 a fixed pale shade of the tint), position,
 * scale and rotation (Euler).
 */
export type Part = [THREE.BufferGeometry, number, Vec3, Vec3, Vec3?];

/** Merges `parts` into one flat-shaded, vertex-coloured figure (white tinted per instance). */
export function mergeFigure(parts: readonly Part[]): THREE.BufferGeometry {
  const flat = parts.map(([g, shade, at, scale, rot]) => {
    // Icosahedra are already non-indexed (no copy, no three.js warning).
    const f = g.index ? g.toNonIndexed() : g;
    if (f !== g) g.dispose();
    f.deleteAttribute('uv');
    f.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...at),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))),
        new THREE.Vector3(...scale),
      ),
    );
    f.computeVertexNormals();
    const nor = f.attributes.normal as THREE.BufferAttribute;
    const n = nor.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Tinted parts are a little darker underneath (a belly in shade, not a second colour).
      const k =
        shade === 1 ? 0.78 + 0.22 * Math.min(1, Math.max(0, 0.5 + 0.5 * nor.getY(i))) : shade;
      colors[i * 3] = k;
      colors[i * 3 + 1] = k;
      colors[i * 3 + 2] = k;
    }
    f.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return f;
  });
  const merged = mergeGeometries(flat);
  for (const f of flat) f.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * One merged grazer, standing at the origin facing +z: body, head, ears (tinted per instance),
 * darker inner ears, dark eyes and nose, a pale tail puff and feet. Nose to tail it fits the
 * Hardy–Weinberg figure's footprint (`FIGURE_CLEARANCE`), so the same spacing keeps them apart.
 */
export function grazerGeometry(): THREE.BufferGeometry {
  const ico = (d: number) => new THREE.IcosahedronGeometry(1, d);
  const parts: Part[] = [
    // Body and head (shade 1: the instance colour as is, a little darker underneath).
    [ico(1), 1, [0, 0.4, -0.08], [0.42, 0.36, 0.52]],
    [ico(1), 1, [0, 0.66, 0.38], [0.26, 0.25, 0.27]],
    // Cheeks: a softer muzzle.
    [ico(0), 0.92, [0, 0.58, 0.55], [0.17, 0.13, 0.13]],
    // Long ears, swept back a little (tinted), with darker inner faces.
    ...[-1, 1].flatMap((sx): Part[] => [
      [ico(0), 1, [sx * 0.11, 1.0, 0.27], [0.065, 0.27, 0.11], [-0.35, 0, sx * -0.18]],
      [ico(0), 0.62, [sx * 0.11, 1.0, 0.31], [0.035, 0.2, 0.06], [-0.35, 0, sx * -0.18]],
    ]),
    // Eyes and nose (dark).
    [ico(0), 0.06, [-0.12, 0.73, 0.57], [0.055, 0.06, 0.045]],
    [ico(0), 0.06, [0.12, 0.73, 0.57], [0.055, 0.06, 0.045]],
    [ico(0), 0.2, [0, 0.6, 0.67], [0.045, 0.035, 0.035]],
    // Tail puff (pale: a fixed light shade of the tint, never a data colour of its own).
    [ico(0), 1.35, [0, 0.46, -0.6], [0.12, 0.12, 0.12]],
    // Feet.
    ...[-1, 1].flatMap((sx): Part[] =>
      [-0.3, 0.2].map((z): Part => [
        new THREE.BoxGeometry(1, 1, 1),
        0.5,
        [sx * 0.2, 0.06, z],
        [0.13, 0.11, z < 0 ? 0.24 : 0.15],
      ]),
    ),
  ];
  return mergeFigure(parts);
}

export interface Flock {
  body: THREE.InstancedMesh;
  /** `count` figures stand (the first slots); `animate`: newcomers grow in, leavers shrink. */
  show(count: number, animate: boolean): void;
  /** Idle motion, births and departures (illustration). */
  tick(dt: number): void;
  /** Every figure grown and standing still (the picture at rest). */
  rest(): void;
  select(slot: number | null): void;
  /** The slot under a ray, or null; `distance` of the hit. */
  pick(ray: THREE.Raycaster): { slot: number; distance: number } | null;
  /** Figures standing now (the model's count at the scale; leavers excluded). */
  drawn(): number;
  /** Centre of a slot's figure (world), or null when the slot is empty. */
  point(slot: number): Vec3 | null;
  /** Newcomers still growing in or leavers still shrinking. */
  settling(): boolean;
}

/**
 * How a flock looks and moves (defaults: the logistic habitat's grazers). `prefix` names its
 * meshes (`<prefix>-figures`, `<prefix>-shadows`, `<prefix>-pick-ring`); `shape` is its merged
 * figure (shared by `key`); `gait` 'hop' hops and nibbles, 'prowl' never hops, sniffs the ground
 * and looks round more slowly; `size` scales every figure (illustration).
 */
export interface FlockOptions {
  prefix?: string;
  shape?: { key: string; make: () => THREE.BufferGeometry };
  gait?: 'hop' | 'prowl';
  size?: number;
}

export function flock(
  kit: SceneKit,
  slots: readonly Slot[],
  heightAt: (x: number, z: number) => number,
  color: string,
  o: FlockOptions = {},
): Flock {
  const cap = Math.max(1, slots.length);
  const prefix = o.prefix ?? 'logi';
  const prowl = o.gait === 'prowl';
  const base = o.size ?? 1;
  const material = kit.shared(
    'logi-grazer-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.62,
        flatShading: true,
        vertexColors: true,
      }),
  );
  const shape = o.shape ?? { key: 'logi-grazer', make: grazerGeometry };
  const body = kit.instanced(kit.shared(shape.key, shape.make), material, cap);
  body.name = `${prefix}-figures`;
  body.castShadow = kit.shadows;
  body.count = 0;
  const tint = new THREE.Color(color);
  for (let i = 0; i < cap; i++) body.setColorAt(i, tint);
  if (body.instanceColor) body.instanceColor.needsUpdate = true;

  // Soft contact shadows: the kit's shadow look, one instanced draw.
  const shadowLook = kit.keep(contactShadow(0, 1, 1, 0.34));
  const shadows = kit.instanced(
    shadowLook.mesh.geometry,
    shadowLook.mesh.material as THREE.Material,
    cap,
  );
  shadows.name = `${prefix}-shadows`;
  shadows.userData.layer = LAYER.FX;
  shadows.renderOrder = -1;
  shadows.raycast = () => undefined;
  shadows.count = 0;

  const ring = kit.mesh(
    kit.geometry(
      new THREE.RingGeometry(0.62 * base, 0.8 * base, Math.max(24, kit.seg * 2)).rotateX(
        -Math.PI / 2,
      ),
    ),
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
      ),
    ),
  );
  ring.name = `${prefix}-pick-ring`;
  ring.visible = false;
  ring.raycast = () => undefined;

  const ground = slots.map((s) => heightAt(s.x, s.z));
  /** Clock time a slot's figure arrived (−∞: standing all along) or started to leave (∞: not). */
  const born = new Float64Array(cap).fill(-Infinity);
  const gone = new Float64Array(cap).fill(Infinity);
  let target = 0;
  /** Instances posed: the standing figures and any still shrinking away after them. */
  let posed = 0;
  let clock = 0;
  let picked: number | null = null;
  let resting = false;

  const m = new THREE.Matrix4();
  const shadowRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const nod = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(1, 0, 0);

  /** 0 → 1 with a small overshoot (a newcomer pops in). */
  const grow = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;

  const pose = () => {
    // Leavers past their shrink are gone: the posed range ends at the last one still shrinking.
    let end = target;
    for (let i = target; i < cap; i++) {
      const g = gone[i] ?? Infinity;
      if (g !== Infinity && clock - g < LEAVE) end = i + 1;
    }
    posed = end;
    for (let i = 0; i < posed; i++) {
      const s = slots[i];
      if (!s) continue;
      const y0 = ground[i] ?? 0;
      const b = born[i] ?? -Infinity;
      const g = gone[i] ?? Infinity;
      const inK = b === -Infinity ? 1 : grow(Math.min(1, Math.max(0, (clock - b) / BIRTH)));
      const outK = i < target || g === Infinity ? 1 : Math.max(0, 1 - (clock - g) / LEAVE);
      const size = inK * outK;
      // A short hop now and then, a nibble (head down), a slow look around; a prowler never
      // hops, sniffs the ground longer and looks round more widely and slowly.
      const w = (clock / HOP_EVERY + s.phase) % 1;
      const hop = !prowl && !resting && w < HOP_SHARE ? Math.sin((Math.PI * w) / HOP_SHARE) : 0;
      const every = prowl ? NIBBLE_EVERY * 1.4 : NIBBLE_EVERY;
      const v = (clock / every + s.phase * 1.7) % 1;
      const bite =
        !resting && hop === 0 && v < NIBBLE_SHARE ? Math.sin((Math.PI * v) / NIBBLE_SHARE) : 0;
      const look = prowl
        ? 0.34 * Math.sin((clock / 9 + s.phase) * Math.PI * 2)
        : 0.18 * Math.sin((clock / 6 + s.phase) * Math.PI * 2);
      const yaw = s.yaw + (resting ? 0 : look);
      const k = (i === picked ? 1.15 : 1) * base;
      pos.set(s.x, y0 + HOP_HEIGHT * hop, s.z);
      quat.setFromAxisAngle(up, yaw).multiply(nod.setFromAxisAngle(side, 0.22 * bite));
      scl.set(k * size, k * size * (1 + 0.06 * hop), k * size);
      m.compose(pos, quat, scl);
      body.setMatrixAt(i, m);
      pos.set(s.x, y0 + 0.03, s.z);
      const sh = size * (1 - 0.35 * hop) * k;
      scl.set(0.6 * sh, 0.78 * sh, 1);
      quat.setFromAxisAngle(up, yaw).multiply(shadowRot);
      m.compose(pos, quat, scl);
      shadows.setMatrixAt(i, m);
    }
    body.count = posed;
    shadows.count = posed;
    body.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    const p = picked;
    const s = p !== null && p < target ? slots[p] : undefined;
    if (p !== null && s) ring.position.set(s.x, (ground[p] ?? 0) + 0.06, s.z);
    ring.visible = s !== undefined;
    body.boundingSphere = null;
  };

  return {
    body,
    show(count, animate) {
      const n = Math.max(0, Math.min(cap, Math.floor(count)));
      if (n > target) {
        for (let i = target; i < n; i++) {
          born[i] = animate ? clock : -Infinity;
          gone[i] = Infinity;
        }
      } else if (n < target) {
        for (let i = n; i < target; i++) gone[i] = animate ? clock : -Infinity;
      }
      target = n;
      pose();
    },
    tick(dt) {
      resting = false;
      clock += dt;
      pose();
    },
    rest() {
      resting = true;
      born.fill(-Infinity);
      for (let i = target; i < cap; i++) gone[i] = -Infinity;
      pose();
    },
    select(slot) {
      picked = slot;
      pose();
    },
    pick(ray) {
      if (target === 0) return null;
      // Only standing figures can be picked (not one that is leaving).
      const was = body.count;
      body.count = target;
      body.computeBoundingSphere();
      const hit = ray.intersectObject(body, false)[0];
      body.count = was;
      return hit?.instanceId !== undefined
        ? { slot: hit.instanceId, distance: hit.distance }
        : null;
    },
    drawn: () => target,
    point(slot) {
      const s = slots[slot];
      if (!s || slot >= target) return null;
      return [s.x, (ground[slot] ?? 0) + 0.5 * base, s.z];
    },
    settling() {
      for (let i = 0; i < posed; i++) {
        if (clock - (born[i] ?? -Infinity) < BIRTH) return true;
        if (i >= target && clock - (gone[i] ?? Infinity) < LEAVE) return true;
      }
      return false;
    },
  };
}
