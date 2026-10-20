/**
 * Illustrative shapes of the machinery in the 3D view of "ADN → mARN → Protein" (DATA_REVIEW
 * DOG3D-8, DOG3D-11): the tRNA's L-shaped body, and where the RNA polymerase and the two ribosome
 * subunits sit and how they are cut open towards the viewer. Not real structures or sizes; the
 * lesson's caption and Science Card say so. No count, base or value comes from here.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneKit } from '../../view3d/kit';
import { BEAD_R } from './helix';
import { LAYOUT, type Vec3 } from './layout';

/** Seeds of the protein blobs (the same seed always gives the same lumpy shape). */
export const BLOB_SEED = { polymerase: 11, small: 29, large: 37 } as const;

/**
 * Cut planes (world z): the front of the RNA polymerase and of the large subunit is not drawn,
 * so the bubble and the tRNAs inside face the camera.
 */
export const CUT_Z = { polymerase: 0.5, large: 0.32 } as const;

/** A plane keeping z ≤ zMax (three.js clips the negative side). */
export const cutPlane = (zMax: number): THREE.Plane =>
  new THREE.Plane(new THREE.Vector3(0, 0, -1), zMax);

/** Small subunit above the mRNA, large below: the mRNA runs through the cleft between them. */
export const RIBOSOME = {
  small: { y: 1.08, scale: [1.95, 0.72, 1.4] as Vec3 },
  large: { y: -2.38, scale: [2.3, 1.72, 1.6] as Vec3 },
} as const;

/**
 * A thin rounded frame around a codon (three bases on the mRNA, bases down): the codon being read
 * glows in it. In the xy plane, centred on the codon's middle base; made once per scene.
 */
export function codonFrameGeometry(kit: SceneKit, rise: number): THREE.BufferGeometry {
  return kit.shared('codon-frame', () => {
    const hx = 1.5 * rise - 0.02;
    const hy = LAYOUT.stick / 2 + 0.16;
    const r = 0.16;
    const pts: THREE.Vector3[] = [];
    const corner = (cx: number, cy: number, a0: number) => {
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (k / 4) * (Math.PI / 2);
        pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), 0));
      }
    };
    corner(hx - r, hy - r, 0);
    corner(-hx + r, hy - r, Math.PI / 2);
    corner(-hx + r, -hy + r, Math.PI);
    corner(hx - r, -hy + r, (3 * Math.PI) / 2);
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    return new THREE.TubeGeometry(curve, 64, 0.035, 6, true);
  });
}

/** tRNA body radius (its double-stranded arms). */
const ARM_R = 0.19;

/**
 * The tRNA body in its group's frame (origin: the codon's middle base on the mRNA line): an L in
 * space (its tertiary shape). The anticodon arm comes down from the anticodon loop (the bar that
 * holds the three anticodon bases, touching the codon), bends at the elbow (behind and to the
 * left) and the acceptor arm ends just above the amino acid (the bead at `trnaAcceptorY`). One
 * merged geometry, made once per scene.
 */
export function trnaBodyGeometry(kit: SceneKit): THREE.BufferGeometry {
  return kit.shared('trna-body', () => {
    const high = kit.tier === 'high';
    const radial = high ? 14 : 10;
    const top: Vec3 = [0, LAYOUT.trnaArmY - 0.16, 0];
    const elbow: Vec3 = [-0.48, -2.72, -0.62];
    const end: Vec3 = [0, LAYOUT.trnaAcceptorY + BEAD_R + 0.2, 0.04];
    const v = (p: Vec3) => new THREE.Vector3(...p);
    const along = (a: Vec3, b: Vec3, t: number) => v(a).lerp(v(b), t);
    const curve = new THREE.CatmullRomCurve3(
      [
        v(top),
        along(top, elbow, 0.62),
        along(top, elbow, 0.9),
        along(elbow, end, 0.12),
        along(elbow, end, 0.45),
        v(end),
      ],
      false,
      'centripetal',
    );
    const parts: THREE.BufferGeometry[] = [];
    parts.push(new THREE.TubeGeometry(curve, high ? 40 : 24, ARM_R, radial, false));
    const ball = (at: Vec3, r: number) => {
      const g = new THREE.SphereGeometry(r, radial, Math.round(radial * 0.75));
      g.translate(...at);
      parts.push(g);
    };
    // Rounded arm ends and the bulky elbow (where the two loops meet in the L).
    ball(top, ARM_R);
    ball(end, ARM_R);
    ball(elbow, ARM_R * 1.45);
    // The anticodon loop: a short bar under the codon, holding the three anticodon bases.
    const loop = new THREE.CapsuleGeometry(0.12, 0.84, 3, radial);
    loop.rotateZ(Math.PI / 2);
    loop.translate(0, LAYOUT.trnaArmY, 0);
    parts.push(loop);
    // Its neck down to the arm.
    const neck = new THREE.CylinderGeometry(0.1, 0.13, 0.22, radial);
    neck.translate(0, LAYOUT.trnaArmY - 0.1, 0);
    parts.push(neck);
    // The acceptor stem's single-stranded end, down to the amino acid.
    const stub = new THREE.CylinderGeometry(0.06, 0.06, end[1] - LAYOUT.trnaAcceptorY, radial);
    stub.translate(0, (end[1] + LAYOUT.trnaAcceptorY) / 2, end[2] / 2);
    parts.push(stub);
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    merged.computeBoundingSphere();
    return merged;
  });
}
