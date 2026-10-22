/**
 * The figures of the Hardy–Weinberg habitat: one low-poly creature per drawn slot (one draw call;
 * the body is tinted by its genotype's chart colour), its two gene copies as beads on two
 * antennae (A a small cube, a a small sphere, one draw call per allele: AA, Aa and aa read
 * without colour too), a soft contact shadow under each (one draw call) and a ring under the
 * picked one. Which genotype each slot shows comes from the model (`binding.ts`); the creature,
 * its hops and the hatching of a new generation are illustration.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { contactShadow } from '@/ui/three/lighting';
import { LAYER } from '@/ui/three/layers';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { roundedBox } from '@/ui/three/materials';
import { highlight } from '../../view3d/recipes';
import {
  ALLELES_OF,
  GENOTYPES,
  alleleToken,
  genotypeToken,
  type Allele,
  type Genotype,
} from './binding';
import type { Slot } from './layout';

/** Where the antennae end (the allele beads), in the creature's own frame (+z forward). */
export const TIP: readonly Vec3[] = [
  [-0.21, 1.24, 0.5],
  [0.21, 1.24, 0.5],
];
/** Radius of an antenna's allele bead (large enough to read the cube / sphere up close). */
export const TIP_SIZE = 0.15;
/** Seconds between two hops of one creature, how long a hop lasts and how high it goes. */
const HOP_EVERY = 2.8;
const HOP_SHARE = 0.16;
const HOP_HEIGHT = 0.22;
/** A new generation hatches from the centre out in this time (s). */
const HATCH = 0.75;

type Part = [THREE.BufferGeometry, number, Vec3, Vec3, Vec3?];

/**
 * An allele bead's shape cue (A a rounded cube, a a sphere: `alleleShape`) at a polygon budget for
 * its size on screen: a few pixels on an antenna, a little more in the jar. Unit size, like the
 * palette's class shapes.
 */
export function beadGeometry(
  kit: SceneKit,
  allele: Allele,
  size: 'tip' | 'pool',
): THREE.BufferGeometry {
  const fine = size === 'pool';
  return kit.shared(`hw-bead|${allele}|${size}`, () =>
    allele === 'A'
      ? roundedBox(fine ? 10 : 8, 6).scale(0.74, 0.74, 0.74)
      : fine
        ? new THREE.SphereGeometry(1, 10, 8)
        : new THREE.IcosahedronGeometry(1, 1),
  );
}

/** One merged creature: body and head (white, tinted per instance), dark eyes and antennae. */
export function creatureGeometry(): THREE.BufferGeometry {
  const ico = (d: number) => new THREE.IcosahedronGeometry(1, d);
  const parts: Part[] = [
    // Body, head, a short tail (shade 1: the instance colour shows as is).
    [ico(1), 1, [0, 0.43, -0.06], [0.44, 0.35, 0.56]],
    [ico(1), 1, [0, 0.66, 0.44], [0.29, 0.27, 0.28]],
    // (The tail stays inside the nose's reach: the footprint `layout.ts` spaces figures by.)
    [new THREE.ConeGeometry(0.1, 0.26, 5), 1, [0, 0.5, -0.62], [1, 1, 1], [-1.9, 0, 0]],
    // Eyes and nose (dark), feet (neutral).
    [ico(0), 0.06, [-0.12, 0.72, 0.66], [0.06, 0.06, 0.05]],
    [ico(0), 0.06, [0.12, 0.72, 0.66], [0.06, 0.06, 0.05]],
    [ico(0), 0.25, [0, 0.62, 0.72], [0.05, 0.04, 0.04]],
    ...[-1, 1].flatMap((sx): Part[] =>
      [-0.26, 0.24].map((z): Part => [
        new THREE.BoxGeometry(1, 1, 1),
        0.45,
        [sx * 0.23, 0.06, z],
        [0.12, 0.1, 0.16],
      ]),
    ),
  ];
  // Antennae: thin dark stalks from the top of the head to the bead tips.
  for (const tip of TIP) {
    const from = new THREE.Vector3(tip[0] * 0.4, 0.88, 0.45);
    const to = new THREE.Vector3(tip[0], tip[1] - TIP_SIZE * 0.6, tip[2]);
    const dir = to.clone().sub(from);
    const stalk = new THREE.CylinderGeometry(0.02, 0.026, dir.length(), 4);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    const e = new THREE.Euler().setFromQuaternion(q);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    parts.push([stalk, 0.16, [mid.x, mid.y, mid.z], [1, 1, 1], [e.x, e.y, e.z]]);
  }
  const flat = parts.map(([g, shade, at, scale, rot]) => {
    const f = g.toNonIndexed();
    g.dispose();
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
      const k = shade === 1 ? 0.8 + 0.2 * Math.min(1, Math.max(0, 0.5 + 0.5 * nor.getY(i))) : shade;
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

export interface Herd {
  /** The creatures (instance i = slot i). */
  body: THREE.InstancedMesh;
  /** Shows a generation: `classes[i]` is slot i's genotype index; `hatch` plays the hatching. */
  show(classes: Uint8Array, hatch: boolean): void;
  /** Idle motion and hatching (illustration). */
  tick(dt: number): void;
  /** Every figure grown and standing on the ground (the picture at rest). */
  rest(): void;
  select(slot: number | null): void;
  /** The slot under a ray, or null; `distance` of the hit. */
  pick(ray: THREE.Raycaster): { slot: number; distance: number } | null;
  /** Figures drawn per genotype now (read back from the scene, for tests). */
  drawn(): Record<Genotype, number>;
  /** Centre of a slot's creature (world), for tests, the info card and its name callout. */
  point(slot: number): Vec3 | null;
  /** Between the two allele beads of a slot's antennae (world, standing pose), or null. */
  tipPoint(slot: number): Vec3 | null;
  /** Slots drawn now and the genotype index each shows. */
  classes(): Uint8Array;
  /** A new generation is still hatching (its figures are growing). */
  hatching(): boolean;
}

export function herd(
  kit: SceneKit,
  slots: readonly Slot[],
  heightAt: (x: number, z: number) => number,
  /** Where a new generation hatches from first (the gene pool). */
  from: readonly [number, number] = [0, 0],
  /**
   * One body colour for every figure (a CSS colour; default: the genotype's chart colour). Genetic
   * drift's model counts gene copies only, so its figures carry the data on their beads alone.
   */
  bodyColor?: string,
): Herd {
  const cap = Math.max(1, slots.length);
  const material = kit.shared(
    'hw-creature-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        flatShading: true,
        vertexColors: true,
      }),
  );
  const body = kit.instanced(kit.shared('hw-creature', creatureGeometry), material, cap);
  body.name = 'hw-creatures';
  body.castShadow = kit.shadows;
  body.count = 0;
  const tips = Object.fromEntries(
    (['A', 'a'] as const).map((al) => {
      const m = kit.instanced(
        beadGeometry(kit, al, 'tip'),
        kit.solid(kit.color(alleleToken(al)), { roughness: 0.32, clearcoat: 0.6 }),
        cap * 2,
      );
      m.name = `hw-allele-${al}`;
      m.count = 0;
      m.raycast = () => undefined;
      return [al, m];
    }),
  ) as Record<Allele, THREE.InstancedMesh>;

  // Soft contact shadows: the kit's shadow look, one instanced draw.
  const shadowLook = kit.keep(contactShadow(0, 1, 1, 0.34));
  const shadows = kit.instanced(
    shadowLook.mesh.geometry,
    shadowLook.mesh.material as THREE.Material,
    cap,
  );
  shadows.name = 'hw-shadows';
  shadows.userData.layer = LAYER.FX;
  shadows.renderOrder = -1;
  shadows.raycast = () => undefined;
  shadows.count = 0;

  const ringMat = kit.own(
    highlight(
      kit,
      new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
    ),
  );
  const ring = kit.mesh(
    kit.geometry(
      new THREE.RingGeometry(0.62, 0.8, Math.max(24, kit.seg * 2)).rotateX(-Math.PI / 2),
    ),
    ringMat,
  );
  ring.name = 'hw-pick-ring';
  ring.visible = false;
  ring.raycast = () => undefined;

  const ground = slots.map((s) => heightAt(s.x, s.z));
  const away = (s: Slot) => Math.hypot(s.x - from[0], s.z - from[1]);
  const maxR = Math.max(1e-6, ...slots.map(away));
  const colors = GENOTYPES.map((g) => new THREE.Color(bodyColor ?? kit.color(genotypeToken(g))));
  let classes: Uint8Array = new Uint8Array(0);
  let clock = 0;
  let hatchAt = Infinity;
  let picked: number | null = null;
  let resting = false;

  const m = new THREE.Matrix4();
  const tipM = TIP.map((t) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(...t),
      new THREE.Quaternion(),
      new THREE.Vector3(TIP_SIZE, TIP_SIZE, TIP_SIZE),
    ),
  );
  const shadowRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Matrix4();

  const pose = () => {
    const n = classes.length;
    let nA = 0;
    let na = 0;
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      if (!s) continue;
      const y0 = ground[i] ?? 0;
      // Hatching: from the gene pool's side outwards; 0 → 1 with a small overshoot.
      const delay = 0.3 * (away(s) / maxR);
      const u = Math.min(1, Math.max(0, (clock - hatchAt - delay) / (HATCH - 0.3)));
      const grow = hatchAt === Infinity ? 1 : 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
      // A short hop now and then, and a slow look around.
      const w = (clock / HOP_EVERY + s.phase) % 1;
      const hop = !resting && w < HOP_SHARE ? Math.sin((Math.PI * w) / HOP_SHARE) : 0;
      const yaw = s.yaw + (resting ? 0 : 0.16 * Math.sin((clock / 5 + s.phase) * Math.PI * 2));
      const k = i === picked ? 1.15 : 1;
      pos.set(s.x, y0 + HOP_HEIGHT * hop, s.z);
      quat.setFromAxisAngle(up, yaw);
      scl.set(k * grow, k * grow * (1 + 0.06 * hop), k * grow);
      m.compose(pos, quat, scl);
      body.setMatrixAt(i, m);
      const [a0, a1] = ALLELES_OF[GENOTYPES[classes[i] ?? 0] ?? 'AA'];
      for (const [j, al] of [a0, a1].entries()) {
        tmp.multiplyMatrices(m, tipM[j] ?? m);
        if (al === 'A') tips.A.setMatrixAt(nA++, tmp);
        else tips.a.setMatrixAt(na++, tmp);
      }
      pos.set(s.x, y0 + 0.03, s.z);
      const sh = grow * (1 - 0.35 * hop) * k;
      scl.set(0.62 * sh, 0.8 * sh, 1);
      quat.setFromAxisAngle(up, yaw).multiply(shadowRot);
      m.compose(pos, quat, scl);
      shadows.setMatrixAt(i, m);
    }
    body.count = n;
    shadows.count = n;
    tips.A.count = nA;
    tips.a.count = na;
    body.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    tips.A.instanceMatrix.needsUpdate = true;
    tips.a.instanceMatrix.needsUpdate = true;
    if (picked !== null && picked < n) {
      const s = slots[picked];
      if (s) ring.position.set(s.x, (ground[picked] ?? 0) + 0.06, s.z);
    }
    ring.visible = picked !== null && picked < n;
  };

  return {
    body,
    show(next, hatch) {
      classes = next.length > cap ? next.subarray(0, cap) : next;
      for (let i = 0; i < classes.length; i++)
        body.setColorAt(i, colors[classes[i] ?? 0] ?? colors[0] ?? new THREE.Color());
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      hatchAt = hatch ? clock : Infinity;
      pose();
      body.boundingSphere = null;
    },
    tick(dt) {
      resting = false;
      clock += dt;
      if (hatchAt !== Infinity && clock - hatchAt > HATCH + 0.05) hatchAt = Infinity;
      pose();
    },
    rest() {
      resting = true;
      hatchAt = Infinity;
      pose();
    },
    select(slot) {
      picked = slot;
      pose();
    },
    pick(ray) {
      if (body.count === 0) return null;
      body.computeBoundingSphere();
      const hit = ray.intersectObject(body, false)[0];
      return hit?.instanceId !== undefined
        ? { slot: hit.instanceId, distance: hit.distance }
        : null;
    },
    drawn() {
      const out: Record<Genotype, number> = { AA: 0, Aa: 0, aa: 0 };
      for (let i = 0; i < body.count; i++) {
        const g = GENOTYPES[classes[i] ?? 0];
        if (g) out[g]++;
      }
      return out;
    },
    hatching: () => hatchAt !== Infinity,
    point(slot) {
      const s = slots[slot];
      if (!s || slot >= body.count) return null;
      return [s.x, (ground[slot] ?? 0) + 0.5, s.z];
    },
    tipPoint(slot) {
      const s = slots[slot];
      const t = TIP[0];
      if (!s || !t || slot >= body.count) return null;
      // The tips' midpoint (0, y, z) in the creature's frame, turned by its yaw about +y.
      return [
        s.x + Math.sin(s.yaw) * t[2],
        (ground[slot] ?? 0) + t[1],
        s.z + Math.cos(s.yaw) * t[2],
      ];
    },
    classes: () => classes.subarray(0, body.count),
  };
}
