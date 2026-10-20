/**
 * The DNA helix primitive shared by the 3D views of "ADN → mARN → Protein" and "Đột biến điểm":
 * the theme palette, the shapes of a base (purines are slabs, pyrimidines bars — the shape cue of
 * `palette.ts`), backbones and beads, and a writer of instance matrices from end points (scratch
 * objects only: nothing is allocated per call). Positions come from each view's own layout; the
 * helix proportions are the one B-DNA constant of `bdna.ts`.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import type { SceneKit } from '../../view3d/kit';
import { roundedBox, solid } from '../../view3d/materials';
import { ROLES } from '../../view3d/palette';
import type { Vec3 } from './layout';

/** Theme colours of the picture (values of CSS tokens). */
export interface DogmaPalette {
  bases: Record<'A' | 'T' | 'G' | 'C' | 'U', string>;
  coding: string;
  template: string;
  mrna: string;
  polymerase: string;
  ribosome: string;
  trna: string;
  peptide: string;
  highlight: string;
}

/** Reads the palette from the theme (base colours are the lesson's, `palette.ts` roles). */
export function readDogmaPalette(token: (name: string) => string): DogmaPalette {
  return {
    bases: {
      A: token(ROLES.baseA.token),
      T: token(ROLES.baseT.token),
      G: token(ROLES.baseG.token),
      C: token(ROLES.baseC.token),
      U: token(ROLES.baseU.token),
    },
    coding: token('--dna3d-coding'),
    template: token('--dna3d-template'),
    mrna: token('--dna3d-mrna'),
    polymerase: token('--dna3d-polymerase'),
    ribosome: token('--dna3d-ribosome'),
    trna: token('--dna3d-trna'),
    peptide: token('--dna3d-peptide'),
    highlight: token('--m3d-highlight'),
  };
}

/** Purines (two rings) are drawn as wide slabs, pyrimidines as bars (shape cue, `palette.ts`). */
export const PURINE: ReadonlySet<string> = new Set(['A', 'G']);
export const SLAB = 0.36;
export const BAR = 0.2;
export const THICK = 0.13;
export const BACKBONE_R = 0.1;
export const NODE_R = 0.15;
export const BEAD_R = 0.3;

/** Width of a base's half rung (slab for a purine, bar for a pyrimidine). */
export const baseWidth = (b: string | undefined): number => (PURINE.has(b ?? '') ? SLAB : BAR);

const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Writes instance matrices from end points (scratch objects only). */
export class Writer {
  private readonly m = new THREE.Matrix4();
  private readonly u = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  /**
   * A base: a rounded box from `p` (backbone) to `q` (tip), `thick` along x, `width` across.
   * `pad` grows it on every side (an outline around the base).
   */
  slab(
    mesh: THREE.InstancedMesh,
    id: number,
    p: Vec3,
    q: Vec3,
    width: number,
    thick = THICK,
    pad = 0,
  ): void {
    const u = this.u.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const len = u.length();
    if (len < 1e-6) {
      this.hide(mesh, id);
      return;
    }
    u.divideScalar(len);
    const w = this.w.crossVectors(u, X_AXIS);
    if (w.lengthSq() < 1e-9) w.set(0, 0, 1);
    w.normalize();
    // The thickness runs along the axis left over (x for a rung across the helix).
    const v = this.a.crossVectors(w, u).normalize();
    const sx = len / 2 + pad;
    const sy = thick / 2 + pad;
    const sz = width / 2 + pad;
    this.m.set(
      u.x * sx,
      v.x * sy,
      w.x * sz,
      (p[0] + q[0]) / 2,
      u.y * sx,
      v.y * sy,
      w.y * sz,
      (p[1] + q[1]) / 2,
      u.z * sx,
      v.z * sy,
      w.z * sz,
      (p[2] + q[2]) / 2,
      0,
      0,
      0,
      1,
    );
    mesh.setMatrixAt(id, this.m);
  }

  /** A unit cylinder (radius 1, height 1 along y) stretched from p to q. */
  rod(mesh: THREE.InstancedMesh, id: number, p: Vec3, q: Vec3, r: number): void {
    const d = this.u.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const len = d.length();
    if (len < 1e-6) {
      this.hide(mesh, id);
      return;
    }
    d.divideScalar(len);
    const helper = Math.abs(d.y) < 0.9 ? this.w.set(0, 1, 0) : this.w.set(0, 0, 1);
    const a = this.a.crossVectors(d, helper).normalize();
    const b = this.b.crossVectors(a, d);
    this.m.set(
      a.x * r,
      d.x * len,
      b.x * r,
      (p[0] + q[0]) / 2,
      a.y * r,
      d.y * len,
      b.y * r,
      (p[1] + q[1]) / 2,
      a.z * r,
      d.z * len,
      b.z * r,
      (p[2] + q[2]) / 2,
      0,
      0,
      0,
      1,
    );
    mesh.setMatrixAt(id, this.m);
  }

  ball(mesh: THREE.InstancedMesh, id: number, p: Vec3, r: number): void {
    this.m.makeScale(r, r, r).setPosition(p[0], p[1], p[2]);
    mesh.setMatrixAt(id, this.m);
  }

  hide(mesh: THREE.InstancedMesh, id: number): void {
    this.m.makeScale(0, 0, 0);
    mesh.setMatrixAt(id, this.m);
  }
}

/** The shared shapes of a helix picture (owned by the kit). */
export interface HelixShapes {
  /** Rounded box spanning [−1, 1]³: a half rung. */
  half: THREE.BufferGeometry;
  /** Unit cylinder: backbone segments and bonds. */
  rod: THREE.BufferGeometry;
  /** Unit spheres: backbone nodes and amino acid beads. */
  node: THREE.BufferGeometry;
  bead: THREE.BufferGeometry;
}

export function helixShapes(kit: SceneKit, tier: QualityTier): HelixShapes {
  const detail = tier === 'high';
  return {
    half: kit.geometry(roundedBox(detail ? 12 : 8, 6)),
    rod: kit.cylinder(detail ? 10 : 8),
    node: kit.sphere(0.5),
    bead: kit.sphere(0.75),
  };
}

/** The opaque, lightly glossy material of the helix parts (owned by the kit). */
export function helixSolid(
  kit: SceneKit,
  color: string,
  tier: QualityTier,
  extra: Parameters<typeof solid>[2] = {},
): THREE.MeshStandardMaterial {
  return kit.own(solid(color, tier, { roughness: 0.42, clearcoat: 0.45, ...extra }));
}

/** One strand's backbone: segments between neighbouring nucleotides and a node at each. */
export interface Strand {
  seg: THREE.InstancedMesh;
  node: THREE.InstancedMesh;
  mat: THREE.MeshStandardMaterial;
}

/** A backbone of up to `count` nucleotides in one colour. */
export function makeStrand(
  kit: SceneKit,
  shapes: HelixShapes,
  color: string,
  tier: QualityTier,
  count: number,
): Strand {
  const mat = helixSolid(kit, color, tier, { roughness: 0.5, sheen: 0.3 });
  return {
    mat,
    seg: kit.instanced(shapes.rod, mat, Math.max(1, count - 1)),
    node: kit.instanced(shapes.node, mat, Math.max(1, count)),
  };
}
