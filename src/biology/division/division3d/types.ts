/**
 * Shapes of one moment of a 3D cell-division timeline, shared by mitosis and meiosis (pure
 * data, no three.js). Positions are illustrative cell units; what each object stands for (a
 * chromatid, a nucleus, a spindle fibre) comes from the division's bookkeeping model.
 */
import type { Origin } from '../division';
import type { Vec3 } from './math';

export interface ChromatidPose {
  /** Index into the timeline's chromatid list. */
  id: number;
  chromosome: number;
  sister: 0 | 1;
  origin: Origin;
  /** Sister 1 does not exist before replication (G1). */
  present: boolean;
  /** Sisters still joined at the centromere (double chromosome). */
  joined: boolean;
  /** Centromere / kinetochore point of this chromatid. */
  centromere: Vec3;
  /** Unit directions of the two arms from the centromere. */
  dirA: Vec3;
  dirB: Vec3;
  /** −1 / +1 = goes to the −x / +x pole of its spindle (fixed by the model). */
  side: -1 | 1;
}

export interface CentromereState {
  chromosome: number;
  /** Sister indices sharing this centromere (2 = double chromosome, 1 = single). */
  sisters: (0 | 1)[];
  position: Vec3;
}

export interface NucleusState {
  center: Vec3;
  radius: number;
  /** Nuclear envelope opacity 0…1 (breaks down in prophase, re-forms in telophase). */
  envelope: number;
  /**
   * Nucleolus 0…1 (illustrative, no effect on any count): fades early in prophase and
   * re-forms in late telophase.
   */
  nucleolus: number;
  /** Geometric cell the nucleus belongs to. */
  cell: number;
}

export type FibreKind = 'polar' | 'kinetochore' | 'astral';
export interface Fibre {
  kind: FibreKind;
  from: Vec3;
  to: Vec3;
  /** Kinetochore fibres: the chromatid they pull. */
  chromatid?: number;
  /** 0 = the spindle's first pole, 1 = its second pole. */
  pole: 0 | 1;
}

export interface GeometricCell {
  center: Vec3;
  /** Indices (into the timeline's chromatid list) of the present chromatids inside this cell. */
  chromatids: number[];
}

export interface Counts3D {
  cells: number;
  /** Nuclei per cell at the start and at the end of the stage (they change in some stages). */
  nuclei: { from: number; to: number };
  /** Per cell (cytokinesis: per daughter cell after division). */
  chromosomes: number;
  state: 'single' | 'double';
  chromatids: number;
  centromeres: number;
  dnaMolecules: number;
  /** Telophase only: chromosomes in each of the two nuclei of one cell. */
  perNucleus?: number;
}
