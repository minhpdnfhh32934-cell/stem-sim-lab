/**
 * Proportions of the B-DNA double helix (Watson–Crick model) as Vietnamese textbooks and
 * Campbell give them: 10 base pairs per turn, 3,4 nm per turn, 2 nm across. The 3D views of
 * "ADN → mARN → Protein" and "Đột biến điểm" draw their helices from this one constant
 * (DATA_REVIEW DOG3D-1); the scene unit is 1 nm along and across the helix. Everything else in the picture (polymerase, ribosome,
 * tRNA, bubble, spacing of the machinery) is illustration.
 */
import type { Source } from '@/core/data/dataset';
import { BSRC } from '../../common';

export interface HelixProportions {
  /** Base pairs per full turn. */
  bpPerTurn: number;
  /** Length of one turn along the axis (nm). */
  pitchNm: number;
  /** Diameter of the helix (nm). */
  diameterNm: number;
  sources: readonly Source[];
  review_status: 'pending' | 'verified';
}

export const B_DNA: HelixProportions = {
  bpPerTurn: 10,
  pitchNm: 3.4,
  diameterNm: 2,
  sources: [BSRC.sgk10, BSRC.campbell],
  review_status: 'pending',
};

/** Rise per base pair along the axis (nm = scene units): 3,4 nm / 10 = 0,34 nm. */
export const RISE = B_DNA.pitchNm / B_DNA.bpPerTurn;
/** Radius of the helix (scene units). */
export const RADIUS = B_DNA.diameterNm / 2;
/** Turn per base pair (radians). */
export const TWIST = (2 * Math.PI) / B_DNA.bpPerTurn;
