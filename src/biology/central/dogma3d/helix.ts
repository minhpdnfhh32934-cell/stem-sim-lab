/**
 * The DNA helix recipe shared by the 3D views of "ADN → mARN → Protein" and "Đột biến điểm", so
 * both lessons look the same: the theme palette; base pairs as two rounded half slabs split at
 * the pair's midline, each in its own base token (purines wide slabs, pyrimidines narrow bars —
 * the shape cue of `palette.ts`); backbones as continuous Catmull–Rom tubes through the
 * nucleotides' positions (`strandTube.ts`, clear coat on High); rungs that fade when they get
 * thinner than a few pixels (no shimmer at overview distance); and a writer of instance matrices
 * from end points (scratch objects only: nothing is allocated per call). Positions come from each
 * view's own layout; the helix proportions are the one B-DNA constant of `bdna.ts`.
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { LAYER } from '@/ui/three/layers';
import { NEUTRAL, type SceneKit } from '../../view3d/kit';
import { roundedBox, solid } from '../../view3d/materials';
import { ROLES } from '../../view3d/palette';
import {
  backboneMaterial,
  basePairMaterial,
  type Strand as StrandRole,
} from '../../view3d/recipes';
import { RISE } from './bdna';
import type { Vec3 } from './layout';
import { StrandTube, tubeDetail } from './strandTube';

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
/** Radius of a DNA backbone tube; the mRNA's is three quarters of it (recipe rule). */
export const BACKBONE_R = 0.12;
export const MRNA_R = BACKBONE_R * 0.75;
export const BEAD_R = 0.3;
/** Each half of a pair stops this short of the pair's midline: the seam where the bases meet. */
export const MIDLINE_GAP = 0.035;

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
  private readonly tip: Vec3 = [0, 0, 0];

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

  /**
   * A base's half of a pair: `slab` from the backbone `p` towards the pair's midline `q`, stopping
   * MIDLINE_GAP short of it (the two halves of a pair meet at a visible seam).
   */
  half(mesh: THREE.InstancedMesh, id: number, p: Vec3, q: Vec3, width: number, pad = 0): void {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const dz = q[2] - p[2];
    const len = Math.hypot(dx, dy, dz);
    const k = len > MIDLINE_GAP * 2 ? (len - MIDLINE_GAP) / len : 1;
    const t = this.tip;
    t[0] = p[0] + dx * k;
    t[1] = p[1] + dy * k;
    t[2] = p[2] + dz * k;
    this.slab(mesh, id, p, t, width, THICK, pad);
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
  /** Soft rounded box spanning [−1, 1]³: a half rung. */
  half: THREE.BufferGeometry;
  /** Unit cylinder: bonds and brackets. */
  rod: THREE.BufferGeometry;
  /** Unit sphere: amino acid beads. */
  bead: THREE.BufferGeometry;
}

export function helixShapes(kit: SceneKit, tier: QualityTier): HelixShapes {
  const detail = tier === 'high';
  return {
    half: kit.geometry(roundedBox(detail ? 12 : 8, 4)),
    rod: kit.cylinder(detail ? 10 : 8),
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

/** Which bases a set of rung halves draws (each set has its own material). */
export type RungSet = 'dna' | 'mrna';

/**
 * The rung halves of a picture: one instanced set (instance colour = the base's token on a white
 * material), the base-pair recipe (clear coat on High).
 * - `dna`: the DNA's pairs, on the opaque layer (ambient occlusion) even while they fade with
 *   distance (`rungMaterial(kit, 'dna')` + `setFade`).
 * - `mrna`: the mRNA's bases, the colour code the lesson reads — their own material, never
 *   faded, and drawn after the post-processing's occlusion and bloom (LAYER.FX), so a glowing
 *   codon frame next to them never washes their colours out (they look as in the legend).
 */
export function rungs(
  kit: SceneKit,
  shapes: HelixShapes,
  count: number,
  parent: THREE.Object3D = kit.scene,
  set: RungSet = 'dna',
): THREE.InstancedMesh {
  const mesh = kit.instanced(shapes.half, rungMaterial(kit, set), count, parent);
  mesh.userData.layer = set === 'mrna' ? LAYER.FX : LAYER.OPAQUE;
  return mesh;
}

/** The shared material of a set of rung halves (`rungs`). */
export function rungMaterial(kit: SceneKit, set: RungSet): THREE.MeshStandardMaterial {
  return basePairMaterial(kit, NEUTRAL, set === 'mrna' ? 'mrna' : '');
}

/** A strand's backbone tube, its mesh and material (the backbone recipe of that strand). */
export interface StrandMesh {
  tube: StrandTube;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
}

/**
 * A backbone tube for up to `capacity` nucleotides of a strand; ring normals point away from
 * `axis` (a helix) or up (a strand along a line).
 */
export function strandMesh(
  kit: SceneKit,
  strand: StrandRole,
  capacity: number,
  axis: { y: number; z: number } | null,
  parent: THREE.Object3D = kit.scene,
): StrandMesh {
  const tube = new StrandTube({
    capacity,
    radius: strand === 'mrna' ? MRNA_R : BACKBONE_R,
    axis,
    ...tubeDetail(kit.tier, capacity),
  });
  kit.geometry(tube.geometry);
  const mat = backboneMaterial(kit, strand);
  const mesh = kit.mesh(tube.geometry, mat, parent);
  mesh.frustumCulled = false;
  return { tube, mesh, mat };
}

/** A second mesh drawing another range of the same tube (with its own rotation). */
export function strandTwin(kit: SceneKit, s: StrandMesh, parent: THREE.Object3D): THREE.Mesh {
  const mesh = kit.mesh(kit.geometry(s.tube.twin()), s.mat, parent);
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Opacity of the rungs when neighbouring pairs are `px` pixels apart on screen: full from 7 px,
 * down to 0,35 at 2,5 px (thin rungs shimmer as the camera backs away; the backbones stay).
 */
export function rungOpacity(px: number): number {
  const t = Math.min(1, Math.max(0, (px - 2.5) / 4.5));
  return 0.35 + 0.65 * t;
}

/** Sets a fading material's opacity (blended only while it is below 1). */
export function setFade(mat: THREE.Material, opacity: number): void {
  const fade = opacity < 0.999;
  if (mat.transparent !== fade) {
    mat.transparent = fade;
    mat.needsUpdate = true;
  }
  mat.opacity = fade ? opacity : 1;
}

const _size = new THREE.Vector2();

/**
 * Screen pixels between two neighbouring base pairs (RISE apart, times `scale`) at `distance`
 * from the camera, on the canvas the renderer draws.
 */
export function pairPixels(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  distance: number,
  scale = 1,
): number {
  if (!(camera instanceof THREE.PerspectiveCamera) || distance <= 0) return Infinity;
  renderer.getSize(_size);
  const h = camera.view?.enabled ? camera.view.fullHeight : _size.y;
  const perUnit = h / 2 / (distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  return RISE * scale * perUnit;
}
