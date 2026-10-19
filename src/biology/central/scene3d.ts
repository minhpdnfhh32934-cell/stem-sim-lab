/**
 * 3D figures of "ADN → mARN → Protein" and "Đột biến điểm". The sequences, base pairs, codons and
 * amino acids are the lesson's (the learner's DNA, its complement, the mRNA, the translation by
 * the standard code); the helix shape, the ribosome and the bead chain are illustration.
 *
 * - Dogma: the double helix (coding strand on top), the mRNA under it, the ribosome on the
 *   active codon and the polypeptide grown so far.
 * - Mutation: the normal and the mutated double helix one above the other, the changed bases
 *   glowing, and under each its protein as a chain of beads (changed residues glowing).
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import type { Translation } from './dogma';

/** Most base pairs drawn (the view says when a longer sequence is cut). */
export const MAX_BP = 60;

/** Colour tokens of the bases (the legend uses the same). */
export const BASE_TOKEN: Record<string, string> = {
  A: '--chart-3',
  T: '--chart-4',
  U: '--chart-5',
  G: '--chart-2',
  C: '--chart-1',
};
const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };

const RISE = 0.5;
const RADIUS = 1;
/** Base pairs per turn of B-DNA (≈ 10.5). */
const PER_TURN = 10.5;

/** One shared material per base, and the rung shape. */
class Bases {
  private readonly mats = new Map<string, THREE.Material>();
  constructor(private readonly kit: SceneKit) {}
  mat(base: string, glow?: string): THREE.Material {
    const key = `${base}|${glow ?? ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = this.kit.solid(this.kit.color(BASE_TOKEN[base] ?? '--text-muted'), {
        roughness: 0.4,
        clearcoat: 0.4,
        ...(glow ? { emissive: glow, emissiveIntensity: 0.9 } : {}),
      });
      this.mats.set(key, m);
    }
    return m;
  }
}

/** A cylinder from a to b (unit cylinder scaled). */
function rod(kit: SceneKit, mat: THREE.Material, a: Vec3, b: Vec3, r: number): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const m = kit.mesh(kit.cylinder(8), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.scale.set(r, Math.max(1e-4, len), r);
  return m;
}

/** A smooth tube through points. */
function backbone(kit: SceneKit, pts: Vec3[], color: string, r = 0.11): void {
  if (pts.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = kit.geometry(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 6, false));
  kit.mesh(geo, kit.solid(color, { roughness: 0.45, sheen: 0.4 }));
}

export interface HelixOptions {
  coding: string;
  y: number;
  /** Positions (0-based, on the coding strand) whose pair glows. */
  glow?: ReadonlySet<number>;
  glowColor?: string;
  labels: { five: string; three: string };
}

/** The double helix along x, base pair i at x = (i − (n−1)/2)·RISE. Returns the x of a base. */
function helix(
  kit: SceneKit,
  bases: Bases,
  o: HelixOptions,
  offset: number,
): (i: number) => number {
  const seq = o.coding.slice(0, MAX_BP);
  const n = seq.length;
  const xOf = (i: number) => (i - (n - 1) / 2 + offset) * RISE;
  const strand1: Vec3[] = [];
  const strand2: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / PER_TURN) * Math.PI * 2;
    // The two strands are not opposite: the minor and the major groove (illustrative angle).
    const b = a + Math.PI * 0.78;
    const x = xOf(i);
    const p1: Vec3 = [x, o.y + RADIUS * Math.cos(a), RADIUS * Math.sin(a)];
    const p2: Vec3 = [x, o.y + RADIUS * Math.cos(b), RADIUS * Math.sin(b)];
    strand1.push(p1);
    strand2.push(p2);
    const mid: Vec3 = [x, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
    const base = seq[i] ?? 'N';
    const pair = COMPLEMENT[base] ?? 'N';
    const glow = o.glow?.has(i) ? o.glowColor : undefined;
    rod(kit, bases.mat(base, glow), p1, mid, 0.13);
    rod(kit, bases.mat(pair, glow), mid, p2, 0.13);
  }
  backbone(kit, strand1, kit.color('--text-muted'));
  backbone(kit, strand2, kit.color('--text-faint'));
  if (n > 0) {
    // Coding strand 5′ → 3′ (left to right); the template strand runs the other way.
    kit.label(o.labels.five, [xOf(0) - 0.8, o.y + 1.2, 0], 'muted');
    kit.label(o.labels.three, [xOf(n - 1) + 0.8, o.y + 1.2, 0], 'muted');
    kit.label(o.labels.three, [xOf(0) - 0.8, o.y - 1.2, 0], 'muted');
    kit.label(o.labels.five, [xOf(n - 1) + 0.8, o.y - 1.2, 0], 'muted');
  }
  if (o.glow?.size && o.glowColor) {
    // A glowing ring around each changed base pair: seen at any zoom.
    const ringGeo = kit.geometry(new THREE.TorusGeometry(RADIUS * 1.3, 0.07, 8, 32));
    const ringMat = kit.solid(o.glowColor, { emissive: o.glowColor, emissiveIntensity: 0.9 });
    for (const i of o.glow) {
      if (i >= n) continue;
      const ring = kit.mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(xOf(i), o.y, 0);
    }
  }
  return xOf;
}

/** Beads of a polypeptide along a gentle arc; returns nothing (labels are the residues'). */
function chain(
  kit: SceneKit,
  residues: { name: string; glow: boolean }[],
  start: Vec3,
  o: { color: string; glowColor: string; spacing?: number; labels?: boolean },
): void {
  const sp = o.spacing ?? 1;
  const base = kit.solid(o.color, { roughness: 0.35, clearcoat: 0.5 });
  const glow = kit.solid(o.color, {
    roughness: 0.35,
    clearcoat: 0.5,
    emissive: o.glowColor,
    emissiveIntensity: 0.9,
  });
  residues.forEach((r, k) => {
    const b = kit.mesh(kit.sphere(), r.glow ? glow : base);
    b.scale.setScalar(0.32);
    b.position.set(start[0] + k * sp, start[1] + 0.25 * Math.sin(k * 0.9), start[2]);
    if (o.labels !== false && residues.length <= 30)
      kit.label(
        r.name,
        // Above and below in turn, so neighbouring names do not overlap.
        [start[0] + k * sp, start[1] + 0.25 * Math.sin(k * 0.9) + (k % 2 ? 0.62 : -0.62), start[2]],
        'muted',
      );
  });
}

export interface DogmaSceneInput {
  coding: string;
  mrna: string;
  t: Translation;
  /** Active codon (index in `t.codons`), or −1 without a start codon. */
  active: number;
  texts: { five: string; three: string; stop: string; ribosome: string };
}

export function buildDogmaScene(kit: SceneKit, input: DogmaSceneInput): Bio3DScene {
  const bases = new Bases(kit);
  const n = Math.min(MAX_BP, input.coding.length);
  const xOf = helix(kit, bases, { coding: input.coding, y: 1.6, labels: input.texts }, 0);
  // mRNA under the DNA: a backbone and one stick per base.
  const mY = -1.4;
  const rna = input.mrna.slice(0, MAX_BP);
  const back: Vec3[] = [];
  for (let i = 0; i < rna.length; i++) {
    const x = xOf(i);
    back.push([x, mY, 0]);
    rod(kit, bases.mat(rna[i] ?? 'N'), [x, mY, 0], [x, mY + 0.75, 0], 0.12);
  }
  backbone(kit, back, kit.color('--chart-5'), 0.1);
  kit.label('mRNA 5′', [xOf(0) - 1.4, mY, 0], 'muted');

  const codon = input.t.codons[input.active];
  const top = 3.2;
  if (codon && codon.pos + 2 < n) {
    const cx = (xOf(codon.pos) + xOf(codon.pos + 2)) / 2;
    // Ribosome on the active codon (two subunits, illustrative shape).
    const glassy = kit.glass(kit.color('--chart-7'), {
      opacity: 0.32,
      rim: { color: kit.color('--chart-7'), strength: 0.6, alpha: 0.4 },
    });
    const big = kit.mesh(kit.sphere(), glassy);
    big.scale.set(1.15, 0.85, 0.95);
    big.position.set(cx, mY + 1.0, 0);
    const small = kit.mesh(kit.sphere(), glassy);
    small.scale.set(0.95, 0.5, 0.8);
    small.position.set(cx, mY - 0.45, 0);
    kit.label(input.texts.ribosome, [cx, mY - 1.4, 0], 'muted');
    // The polypeptide made so far (stop codons add nothing), leaving the ribosome.
    const made = input.t.codons
      .slice(0, input.active + 1)
      .filter((c) => !c.entry?.stop)
      .map((c, k, all) => ({ name: c.entry?.three ?? '?', glow: k === all.length - 1 }));
    if (codon.entry?.stop) kit.label(input.texts.stop, [cx, mY + 2.3, 0], 'strong');
    chain(kit, made, [cx - (made.length - 1) * 1, -3.4, 1.2], {
      color: kit.color('--chart-2'),
      glowColor: kit.color('--m3d-highlight'),
    });
  }
  const halfX = (n * RISE) / 2 + 1.6;
  const pts: Vec3[] = [];
  for (const x of [-halfX, halfX])
    for (const y of [-4.6, top]) for (const z of [-1.4, 1.6]) pts.push([x, y, z]);
  return {
    kit,
    bounds: { center: [0, -0.6, 0], radius: Math.hypot(halfX, 4), points: pts },
  };
}

export interface MutationSceneInput {
  coding: string;
  mutated: string;
  /** Positions changed on the mutated strand (inserted or substituted bases). */
  changed: ReadonlySet<number>;
  /** Where bases were deleted (a gap marker on the mutated strand), or −1. */
  deletedAt: number;
  normal: { name: string; glow: boolean }[];
  mutant: { name: string; glow: boolean }[];
  texts: { five: string; three: string; normal: string; mutant: string };
}

export function buildMutationScene(kit: SceneKit, input: MutationSceneInput): Bio3DScene {
  const bases = new Bases(kit);
  const glow = kit.color('--m3d-highlight');
  const n = Math.min(MAX_BP, Math.max(input.coding.length, input.mutated.length));
  // Both helices start at the same x so equal positions line up.
  const shift = (len: number) => (Math.min(MAX_BP, len) - n) / 2;
  const xTop = helix(
    kit,
    bases,
    { coding: input.coding, y: 3.3, labels: input.texts },
    shift(input.coding.length),
  );
  const xBot = helix(
    kit,
    bases,
    { coding: input.mutated, y: -1.9, glow: input.changed, glowColor: glow, labels: input.texts },
    shift(input.mutated.length),
  );
  kit.label(input.texts.normal, [xTop(0) - 2.4, 3.3, 0], 'strong');
  kit.label(input.texts.mutant, [xBot(0) - 2.4, -1.9, 0], 'strong');
  if (input.deletedAt >= 0) {
    const x = xBot(input.deletedAt) - RISE / 2;
    const ring = kit.mesh(
      kit.geometry(new THREE.TorusGeometry(1.25, 0.06, 8, 32)),
      kit.solid(glow, { emissive: glow, emissiveIntensity: 0.9 }),
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, -1.9, 0);
  }
  const accent = kit.color('--chart-2');
  chain(kit, input.normal, [xTop(0), 0.75, 1.4], { color: accent, glowColor: glow });
  chain(kit, input.mutant, [xBot(0), -4.45, 1.4], { color: accent, glowColor: glow });
  const halfX = (n * RISE) / 2 + 3.4;
  const pts: Vec3[] = [];
  for (const x of [-halfX, halfX])
    for (const y of [-5.3, 4.6]) for (const z of [-1.2, 1.8]) pts.push([x, y, z]);
  return {
    kit,
    bounds: { center: [0, 0.4, 0], radius: Math.hypot(halfX, 6.5), points: pts },
  };
}
