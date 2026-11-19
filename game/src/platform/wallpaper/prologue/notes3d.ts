import * as THREE from 'three';
import type { SwoopState } from '../../../simulation/rocketSwoop';
import { setOutlineWidth } from '../../render/body/BodyModel';
import type { PrologueRocket } from './rocket';

/*
 * What the opening's notes draw in the world (Phú 2026-11-18): by the flame, the molecules that
 * burn and those made (ball and stick, bond lengths 1.1 m per ångström, popped in one by one);
 * at the centre of mass, the forces as arrows (1 MN = 5 m), grown in turn and added tip to tail.
 * Their numbers are the swoop's (simulation/rocketSwoop.ts) at the notes' moment.
 */

const INK = '#111417';
/** The forces drawn: metres per newton (1 MN = 5 m); drag on its own ×10. */
const M_PER_N = 5e-6;
const DRAG_DRAWN = 10;

/** The force arrows' colours (rocketNotes.ts shows them by their names). */
export const FORCE_COLORS = {
  thrust: '#2fa8ff',
  weight: '#d8343c',
  drag: '#9a6a3c',
  net: '#111417',
} as const;

/** A force's arrow, flat, in the flight's plane, with an ink edge; over everything. */
class Arrow {
  readonly group = new THREE.Group();
  private readonly shaft: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly inkShaft: THREE.Mesh;
  private readonly inkHead: THREE.Mesh;
  private readonly fill: THREE.MeshBasicMaterial;
  private readonly ink: THREE.MeshBasicMaterial;
  /** Where it starts and what it is (world x, y, m) as last set. */
  readonly from = new THREE.Vector2();
  readonly vec = new THREE.Vector2();

  constructor(
    color: string,
    private readonly width: number,
    order: number,
    plane: THREE.BufferGeometry,
    triangle: THREE.BufferGeometry,
  ) {
    const material = (c: string) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    this.fill = material(color);
    this.ink = material(INK);
    this.inkShaft = new THREE.Mesh(plane, this.ink);
    this.inkHead = new THREE.Mesh(triangle, this.ink);
    this.shaft = new THREE.Mesh(plane, this.fill);
    this.head = new THREE.Mesh(triangle, this.fill);
    [this.inkShaft, this.inkHead, this.shaft, this.head].forEach((m, i) => {
      m.renderOrder = order + (i < 2 ? 0 : 1);
      m.frustumCulled = false;
      this.group.add(m);
    });
  }

  set(fx: number, fy: number, vx: number, vy: number, opacity: number): void {
    this.from.set(fx, fy);
    this.vec.set(vx, vy);
    const len = Math.hypot(vx, vy);
    this.group.visible = opacity > 0.001 && len > 0.01;
    if (!this.group.visible) return;
    this.fill.opacity = opacity;
    this.ink.opacity = opacity;
    this.group.position.set(fx, fy, 0);
    this.group.rotation.z = Math.atan2(-vx, vy);
    const e = 0.32;
    const hl = Math.min(this.width * 2.6, len * 0.75);
    const hw = (hl / 2.6) * 2.4;
    const w = Math.min(this.width, hw * 0.6);
    const shaftLen = Math.max(0.0001, len - hl);
    this.shaft.scale.set(w, shaftLen, 1);
    this.head.scale.set(hw, hl, 1);
    this.head.position.y = shaftLen;
    this.inkShaft.scale.set(w + 2 * e, shaftLen + e, 1);
    this.inkShaft.position.y = -e;
    this.inkHead.scale.set(hw + 2.8 * e, hl + 2.2 * e, 1);
    this.inkHead.position.y = shaftLen - 0.9 * e;
  }

  dispose(): void {
    this.fill.dispose();
    this.ink.dispose();
  }
}

type Element = 'C' | 'H' | 'O';
const ATOM: Record<Element, { color: string; r: number }> = {
  C: { color: '#3a3d42', r: 0.55 },
  H: { color: '#f4f5f6', r: 0.38 },
  O: { color: '#e0343a', r: 0.52 },
};
/** Bond lengths drawn 1.1 m per ångström. */
const ANGSTROM = 1.1;

/** A molecule's atoms (element, position) and bonds (atom pairs, how many). */
function moleculeShape(formula: 'CH₄' | 'O₂' | 'CO₂' | 'H₂O'): {
  atoms: [Element, THREE.Vector3][];
  bonds: [number, number, number][];
} {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  if (formula === 'CH₄') {
    const d = 1.09 * ANGSTROM;
    const dirs = [v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)];
    return {
      atoms: [
        ['C', v(0, 0, 0)],
        ...dirs.map((x): [Element, THREE.Vector3] => ['H', x.normalize().multiplyScalar(d)]),
      ],
      bonds: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [0, 4, 1],
      ],
    };
  }
  if (formula === 'O₂') {
    const h = (1.21 * ANGSTROM) / 2;
    return {
      atoms: [
        ['O', v(-h, 0, 0)],
        ['O', v(h, 0, 0)],
      ],
      bonds: [[0, 1, 2]],
    };
  }
  if (formula === 'CO₂') {
    const d = 1.16 * ANGSTROM;
    return {
      atoms: [
        ['C', v(0, 0, 0)],
        ['O', v(-d, 0, 0)],
        ['O', v(d, 0, 0)],
      ],
      bonds: [
        [0, 1, 2],
        [0, 2, 2],
      ],
    };
  }
  const d = 0.96 * ANGSTROM;
  const half = ((104.5 / 2) * Math.PI) / 180;
  return {
    atoms: [
      ['O', v(0, 0, 0)],
      ['H', v(-d * Math.sin(half), -d * Math.cos(half), 0)],
      ['H', v(d * Math.sin(half), -d * Math.cos(half), 0)],
    ],
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
    ],
  };
}

/** A small deterministic random in [0, 1) for a whole number. */
const hash = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The molecules by the flame (the rocket's frame, in front of the plume on the door's side), in
 * the order the chemistry notes bring them in (s into them).
 */
export const MOLECULES: {
  formula: 'CH₄' | 'O₂' | 'CO₂' | 'H₂O';
  at: [number, number, number];
  enter: number;
}[] = [
  { formula: 'CH₄', at: [-6.6, -28.2, 5], enter: 0.05 },
  { formula: 'O₂', at: [-4.2, -31.4, 5], enter: 0.3 },
  { formula: 'O₂', at: [-7.4, -33.6, 5], enter: 0.42 },
  { formula: 'CO₂', at: [4.4, -35.4, 5], enter: 0.95 },
  { formula: 'H₂O', at: [6.4, -31.2, 5], enter: 1.15 },
  { formula: 'H₂O', at: [7.6, -37.2, 5], enter: 1.27 },
];
/** The first molecule of each species, in the notes' order (CH₄, O₂, CO₂, H₂O). */
export const SPECIES_AT = [0, 1, 3, 4] as const;
/** When the flame flares (s into the chemistry notes): the burning, between the two sides. */
export const BURN = { from: 0.62, to: 1.05 };
/** The forces' entrances (s into the physics notes). */
export const FORCES = {
  thrust: 0,
  weight: 0.4,
  drag: 0.8,
  chain: [1.25, 1.8],
  net: [1.9, 2.4],
} as const;

/** A pop with a little overshoot, 0 before it starts. */
function popIn(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/** The flame's flare as the reactants burn (0–1), s into the chemistry notes. */
export function burnPulse(e: number): number {
  if (e < BURN.from || e > BURN.to) return 0;
  return Math.sin((Math.PI * (e - BURN.from)) / (BURN.to - BURN.from));
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

interface Vectors {
  readonly thrust: THREE.Vector2;
  readonly weight: THREE.Vector2;
  readonly drag: THREE.Vector2;
  readonly net: THREE.Vector2;
}

export class NoteVisuals {
  /** The molecules (children of the rocket's frame). */
  private readonly molecules: THREE.Group[] = [];
  /** The arrows (world-aligned, at the centre of mass, on the camera's side of it). */
  readonly forces = new THREE.Group();
  private readonly arrows: Arrow[] = [];
  private readonly atomInk: THREE.MeshBasicMaterial;
  private readonly bondInk: THREE.MeshBasicMaterial;
  private readonly owned: { dispose(): void }[] = [];
  private vectors: Vectors | null = null;

  constructor(rocket: PrologueRocket, gradient: THREE.Texture, ink: () => THREE.MeshBasicMaterial) {
    this.atomInk = ink();
    this.bondInk = ink();
    const toon = (color: string) => {
      const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
      this.owned.push(m);
      return m;
    };
    const inked = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      inkM: THREE.Material,
    ) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, inkM));
      return group;
    };
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const stick = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    this.owned.push(sphere, stick, this.atomInk, this.bondInk);
    const materials = {
      C: toon(ATOM.C.color),
      H: toon(ATOM.H.color),
      O: toon(ATOM.O.color),
      bond: toon('#aab4c0'),
    };
    const up = new THREE.Vector3(0, 1, 0);
    for (const spec of MOLECULES) {
      const group = new THREE.Group();
      const { atoms, bonds } = moleculeShape(spec.formula);
      for (const [element, at] of atoms) {
        const atom = inked(sphere, materials[element], this.atomInk);
        atom.scale.setScalar(ATOM[element].r);
        atom.position.copy(at);
        group.add(atom);
      }
      for (const [a, b, order] of bonds) {
        const pa = atoms[a]?.[1];
        const pb = atoms[b]?.[1];
        if (!pa || !pb) continue;
        const dir = pb.clone().sub(pa);
        const side = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
        if (side.lengthSq() < 0.5) side.set(0, 1, 0);
        for (let i = 0; i < order; i++) {
          const off = order === 1 ? 0 : (i - 0.5) * 0.34;
          const bond = inked(stick, materials.bond, this.bondInk);
          bond.position.copy(pa).add(pb).multiplyScalar(0.5).addScaledVector(side, off);
          bond.quaternion.setFromUnitVectors(up, dir.clone().normalize());
          bond.scale.set(0.12, dir.length(), 0.12);
          group.add(bond);
        }
      }
      group.position.set(...spec.at);
      const k = this.molecules.length;
      group.rotation.set(hash(k) * 3, hash(k + 1) * 3, 0);
      rocket.group.add(group);
      this.molecules.push(group);
    }
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const tri = new THREE.Shape();
    tri.moveTo(-0.5, 0);
    tri.lineTo(0.5, 0);
    tri.lineTo(0, 1);
    tri.closePath();
    const triangle = new THREE.ShapeGeometry(tri);
    this.owned.push(plane, triangle);
    const colors = [FORCE_COLORS.thrust, FORCE_COLORS.weight, FORCE_COLORS.drag, FORCE_COLORS.net];
    colors.forEach((color, i) => {
      const arrow = new Arrow(color, i === 3 ? 1.35 : 0.95, 20 + i * 2, plane, triangle);
      this.arrows.push(arrow);
      this.owned.push(arrow);
      this.forces.add(arrow.group);
    });
    const dot = (r: number, color: string, order: number) => {
      const geometry = new THREE.CircleGeometry(r, 32);
      const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      });
      this.owned.push(geometry, material);
      const m = new THREE.Mesh(geometry, material);
      m.renderOrder = order;
      this.forces.add(m);
    };
    dot(1.35, INK, 30);
    dot(0.95, '#ffd23f', 31);
  }

  /** The forces drawn are those of this moment (the physics notes'). */
  setForces(s: SwoopState): void {
    const w = (v: readonly [number, number, number]) =>
      new THREE.Vector2(v[0], v[1]).multiplyScalar(M_PER_N);
    this.vectors = { thrust: w(s.thrust), weight: w(s.weight), drag: w(s.drag), net: w(s.net) };
  }

  /**
   * The molecules for the chemistry notes (`chem` s into them, −1 when not shown; `chemFade`
   * 1…0 as they go), the arrows for the physics notes (likewise) at the centre of mass `com`.
   */
  update(
    chem: number,
    chemFade: number,
    phys: number,
    physFade: number,
    com: THREE.Vector3,
    realT: number,
    inkPerMetre: number,
    eye: THREE.Vector3,
  ): void {
    MOLECULES.forEach((spec, i) => {
      const group = this.molecules[i];
      if (!group) return;
      const s = chem < 0 ? 0 : popIn((chem - spec.enter) / 0.4) * chemFade;
      group.visible = s > 0.001;
      group.scale.setScalar(Math.max(s, 0.0001));
      group.rotation.y = realT * 0.5 + i;
    });
    const ink = 2.6 * inkPerMetre * eye.distanceTo(com);
    setOutlineWidth(this.atomInk, ink / 0.48);
    setOutlineWidth(this.bondInk, (0.6 * ink) / 0.12);
    const v = this.vectors;
    this.forces.visible = phys >= 0 && physFade > 0.001 && v !== null;
    if (!this.forces.visible || !v) return;
    this.forces.position.copy(com).setZ(com.z + 2.6);
    const e = phys;
    const grow = (from: number) => smooth((e - from) / 0.4);
    const chain = smooth((e - FORCES.chain[0]) / (FORCES.chain[1] - FORCES.chain[0]));
    const [aT, aP, aD, aF] = this.arrows;
    const gT = grow(FORCES.thrust);
    aT?.set(0, 0, v.thrust.x * gT, v.thrust.y * gT, physFade);
    const gP = grow(FORCES.weight);
    aP?.set(v.thrust.x * chain, v.thrust.y * chain, v.weight.x * gP, v.weight.y * gP, physFade);
    const gD = grow(FORCES.drag);
    const dScale = THREE.MathUtils.lerp(DRAG_DRAWN, 1, chain) * gD;
    aD?.set(
      (v.thrust.x + v.weight.x) * chain,
      (v.thrust.y + v.weight.y) * chain,
      v.drag.x * dScale,
      v.drag.y * dScale,
      physFade,
    );
    const gF = smooth((e - FORCES.net[0]) / (FORCES.net[1] - FORCES.net[0]));
    aF?.set(0, 0, v.net.x * gF, v.net.y * gF, physFade);
  }

  /** Where a molecule is (world), for its label's line. */
  molecule(i: number, out: THREE.Vector3): THREE.Vector3 {
    const group = this.molecules[i];
    return group ? group.getWorldPosition(out) : out.set(NaN, NaN, NaN);
  }

  /** An arrow's middle (world), or NaN when it is not drawn. */
  arrow(i: number, out: THREE.Vector3): THREE.Vector3 {
    const a = this.arrows[i];
    if (!a?.group.visible || !this.forces.visible) return out.set(NaN, NaN, NaN);
    return out.set(a.from.x + a.vec.x * 0.5, a.from.y + a.vec.y * 0.5, 0).add(this.forces.position);
  }

  /** An arrow's vector as drawn (m), or null. */
  arrowVector(i: number): THREE.Vector2 | null {
    const a = this.arrows[i];
    return a?.group.visible ? a.vec : null;
  }

  /** Everything shown once, for the shaders to be built before the opening plays. */
  showAll(on: boolean): void {
    for (const m of this.molecules) m.visible = on;
    this.forces.visible = on;
    for (const a of this.arrows) a.group.visible = on;
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
  }
}
