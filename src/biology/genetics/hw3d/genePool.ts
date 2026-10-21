/**
 * The gene pool of the Hardy–Weinberg habitat: a glass jar on a stone plinth beside the meadow,
 * holding the generation's gene copies as beads (A small cubes, a small spheres, mixed; one bead
 * per `perBead` copies, `binding.ts`), and a dial on the plinth's top whose two arcs are exactly
 * p and q of the generation. The jar, the plinth and the bead places are illustration.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { glassMeshes, glassware, highlight } from '../../view3d/recipes';
import { alleleToken, slotClasses, type Allele, type HwModel3D } from './binding';
import type { PoolLayout } from './layout';
import { beadGeometry } from './organisms';

/** A jar of radius `r` and height `h`: foot, outer wall, rounded lip, inner wall, floor. */
export function jarGeometry(r: number, h: number, sides: number): THREE.BufferGeometry {
  const t = r * 0.06;
  const pts: [number, number][] = [
    [0, t],
    [r - t - r * 0.05, t],
    [r - t, t + r * 0.05],
    [r - t, h - r * 0.02],
    [r - t * 0.5, h + r * 0.025],
    [r + r * 0.01, h - r * 0.015],
    [r, h - r * 0.09],
    [r, r * 0.08],
    [r - r * 0.05, 0],
    [0, 0],
  ];
  return new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    sides,
  );
}

/** Seed of the bead mix of generation g (another mix than the figures'). */
const beadKeys = (n: number, g: number): Float64Array => {
  let s = 1 + 104729 * (g + 1);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    out[i] = s / 2147483647;
  }
  return out;
};

export interface GenePool {
  /** Everything a tap on the pool can hit (plinth and dial; the glass is not pickable). */
  pickables: THREE.Object3D[];
  show(g: number): void;
  select(on: boolean): void;
  /** Beads drawn per allele now (read back from the scene). */
  drawn(): Record<Allele, number>;
  /** Top of the plinth (world y) and the jar's top, for labels. */
  top: number;
  jarTop: number;
  /** The jar on its plinth (world points): what name callouts keep clear of. */
  hull: Vec3[];
  /** Front of the bead pile in the jar (world), or null when the jar is empty. */
  beadsPoint(): Vec3 | null;
  /** A point on the p / q ring's front (world), or null when no ring is drawn (no individuals). */
  dialPoint(): Vec3 | null;
}

export function genePool(
  kit: SceneKit,
  model: HwModel3D,
  L: PoolLayout,
  heightAt: (x: number, z: number) => number,
): GenePool {
  // The plinth sits on the lowest ground under it (sunk a little), level.
  let base = Infinity;
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rr = k === 8 ? 0 : L.plinthR;
    base = Math.min(base, heightAt(L.x + Math.cos(a) * rr, L.z + Math.sin(a) * rr));
  }
  base -= 0.08;
  const sides = Math.max(24, kit.seg * 2);
  const stone = kit.solid(kit.color('--bio3d-rock'), { roughness: 0.85 });
  const plinth = kit.mesh(kit.cylinder(sides), stone);
  plinth.name = 'hw-plinth';
  plinth.scale.set(L.plinthR, L.plinthH + 0.08, L.plinthR);
  plinth.position.set(L.x, base + (L.plinthH + 0.08) / 2, L.z);
  plinth.castShadow = kit.shadows;
  plinth.receiveShadow = kit.shadows;
  const top = base + L.plinthH + 0.08;
  // A bevelled cap ring: the plinth reads as cut stone.
  const cap = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(L.plinthR - 0.06, 0.07, 6, sides).rotateX(Math.PI / 2)),
    stone,
  );
  cap.position.set(L.x, top - 0.03, L.z);
  cap.raycast = () => undefined;
  kit
    .shadow(base + 0.1, L.plinthR * 1.35, L.plinthR * 1.35, 0.3)
    .position.set(L.x, base + 0.1, L.z);

  // The p / q dial: one arc per allele for every generation, made once (setTime only swaps).
  const arcSeg = Math.max(32, kit.seg * 3);
  const arcs = model.generations.map((gen) => {
    // An empty generation has no gene pool to split: no arcs (its p = 0 is a 0 / 0 guard).
    if (gen.n === 0) return { A: null, a: null };
    const { p } = gen;
    const make = (start: number, len: number) =>
      len > 1e-9
        ? kit.geometry(
            new THREE.RingGeometry(
              L.dialIn,
              L.dialOut,
              Math.max(2, Math.ceil(arcSeg * (len / (2 * Math.PI)))),
              1,
              start,
              len,
            ).rotateX(-Math.PI / 2),
          )
        : null;
    // Centred on the front (+z, towards the camera): the ring angle −π/2 points to +z.
    return {
      A: make(-Math.PI / 2 - Math.PI * p, 2 * Math.PI * p),
      a: make(-Math.PI / 2 + Math.PI * p, 2 * Math.PI * (1 - p)),
    };
  });
  const dialMats = {
    A: kit.own(
      new THREE.MeshStandardMaterial({ color: kit.color(alleleToken('A')), roughness: 0.45 }),
    ),
    a: kit.own(
      new THREE.MeshStandardMaterial({ color: kit.color(alleleToken('a')), roughness: 0.45 }),
    ),
  };
  const empty = kit.geometry(new THREE.BufferGeometry());
  const dial = (['A', 'a'] as const).map((al) => {
    const mesh = kit.mesh(empty, dialMats[al]);
    mesh.name = `hw-dial-${al}`;
    mesh.position.set(L.x, top + 0.012, L.z);
    return mesh;
  });

  // The picked pool: a glowing ring round the plinth (the data colours never change).
  const ring = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(L.plinthR + 0.18, 0.06, 6, sides).rotateX(Math.PI / 2)),
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
      ),
    ),
  );
  ring.name = 'hw-pool-ring';
  ring.position.set(L.x, top - 0.02, L.z);
  ring.visible = false;
  ring.raycast = () => undefined;

  // The jar (see-through glass, never pickable) and its beads.
  const jarBase = top;
  const glass = glassMeshes(
    kit,
    glassware(kit, { ink: true }),
    kit.geometry(jarGeometry(L.jarR, L.jarH, sides)),
    5,
    kit.tier === 'high',
  );
  for (const g of glass) g.position.set(L.x, jarBase, L.z);
  const floor = L.jarR * 0.06;
  const beads = Object.fromEntries(
    (['A', 'a'] as const).map((al) => {
      const m = kit.instanced(
        beadGeometry(kit, al, 'pool'),
        kit.solid(kit.color(alleleToken(al)), { roughness: 0.3, clearcoat: 0.6 }),
        Math.max(1, model.beadSlots),
      );
      m.name = `hw-pool-${al}`;
      m.count = 0;
      m.raycast = () => undefined;
      return [al, m];
    }),
  ) as Record<Allele, THREE.InstancedMesh>;
  const keys = model.generations.map((_, g) => beadKeys(model.beadSlots, g));
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(L.beadR, L.beadR, L.beadR);
  let shown = { A: 0, a: 0 };
  /** Height of the bead pile now (above the jar's floor) and whether the ring is drawn. */
  let pile = 0;
  let ringShown = false;
  const jarTop = jarBase + L.jarH;

  return {
    pickables: [plinth, ...dial],
    top,
    jarTop,
    hull: [
      [L.x - L.plinthR, base, L.z - L.plinthR],
      [L.x + L.plinthR, base, L.z + L.plinthR],
      [L.x - L.jarR, jarTop, L.z - L.jarR],
      [L.x + L.jarR, jarTop, L.z + L.jarR],
    ],
    show(g) {
      const gen = model.generations[g];
      if (!gen) return;
      const arc = arcs[g];
      for (const [i, al] of (['A', 'a'] as const).entries()) {
        const mesh = dial[i];
        const geo = arc?.[al] ?? null;
        if (!mesh) continue;
        mesh.geometry = geo ?? empty;
        mesh.visible = geo !== null;
      }
      ringShown = dial.some((m) => m.visible);
      const cls = slotClasses([gen.beads.A, gen.beads.a], keys[g] ?? new Float64Array(0));
      let nA = 0;
      let na = 0;
      pile = 0;
      for (let i = 0; i < cls.length; i++) {
        const b = L.beads[i];
        if (!b) continue;
        pile = Math.max(pile, b[1] + L.beadR);
        // Each bead lies at its own angle (seeded by its place), as poured.
        e.set(i * 1.7, i * 2.3, i * 0.9);
        q.setFromEuler(e);
        v.set(L.x + b[0], jarBase + floor + b[1], L.z + b[2]);
        mat.compose(v, q, s);
        if (cls[i] === 0) beads.A.setMatrixAt(nA++, mat);
        else beads.a.setMatrixAt(na++, mat);
      }
      beads.A.count = nA;
      beads.a.count = na;
      beads.A.instanceMatrix.needsUpdate = true;
      beads.a.instanceMatrix.needsUpdate = true;
      shown = { A: nA, a: na };
    },
    select(on) {
      ring.visible = on;
    },
    drawn: () => ({ ...shown }),
    beadsPoint: () =>
      shown.A + shown.a > 0 ? [L.x, jarBase + floor + pile / 2, L.z + L.jarR * 0.8] : null,
    // Front right on the ring: clear of its two-line label in front of the plinth.
    dialPoint: () => {
      const mid = ((L.dialIn + L.dialOut) / 2) * Math.SQRT1_2;
      return ringShown ? [L.x + mid, top + 0.02, L.z + mid] : null;
    },
  };
}
