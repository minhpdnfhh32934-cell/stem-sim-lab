/**
 * What the 3D view of "Điều hòa biểu hiện gene: operon lac" draws (pure, no three.js; tested
 * against the model): the DNA along x with its regions in the book's order (lacI, then the
 * operon P, O, lacZ, lacY, lacA — Hình 3.1), and where the repressor, allolactose, RNA
 * polymerase and the mRNA are for the model's `operon()` result. Lengths are illustrations (not
 * to scale): only what is bound, free or transcribed comes from the model.
 */
import type { OperonInput, OperonResult } from '../model';

export type Vec3 = [number, number, number];
export type RegionId = 'lacI' | 'gap' | 'P' | 'O' | 'lacZ' | 'lacY' | 'lacA';

export const REGIONS: readonly { id: RegionId; from: number; to: number }[] = [
  { id: 'lacI', from: 0, to: 4 },
  { id: 'gap', from: 4, to: 6 },
  { id: 'P', from: 6, to: 8.5 },
  { id: 'O', from: 8.5, to: 10.5 },
  { id: 'lacZ', from: 10.5, to: 15.5 },
  { id: 'lacY', from: 15.5, to: 19.5 },
  { id: 'lacA', from: 19.5, to: 23 },
];
export const DNA_END = 23;
/** Backbone radius and rise per turn of the drawn helix (illustrative, B-DNA-like). */
export const DNA_R = 1;
export const PITCH = 3.4;

export function region(id: RegionId): { from: number; to: number } {
  return REGIONS.find((r) => r.id === id) ?? { from: 0, to: 0 };
}
export const middle = (id: RegionId) => (region(id).from + region(id).to) / 2;

/** One backbone of the drawn double helix, 8 points per turn. */
export function helixPoints(strand: 0 | 1): Vec3[] {
  const n = Math.round((DNA_END / PITCH) * 8);
  return Array.from({ length: n + 1 }, (_, i): Vec3 => {
    const x = (i * DNA_END) / n;
    const phi = (2 * Math.PI * x) / PITCH + strand * Math.PI;
    return [x, DNA_R * Math.cos(phi), DNA_R * Math.sin(phi)];
  });
}

export interface OperonPlacement {
  /** The repressor (none when lacI is damaged: no working repressor is made). */
  repressor: { at: Vec3; onOperator: boolean } | null;
  /** Allolactose drawn bound to the repressor (one molecule shown). */
  allolactoseBound: boolean;
  /** Lactose molecules drawn free in the medium (an illustrative handful) when there is lactose. */
  lactoseFree: number;
  /** RNA polymerase: on the promoter, or moving along the structural genes. */
  polymerase: { at: Vec3; onGenes: boolean };
  /** The mRNA drawn along the structural genes while they are transcribed. */
  mrna: boolean;
  broken: RegionId[];
}

export const LACTOSE_SHOWN = 6;

export function placement(input: OperonInput, r: OperonResult): OperonPlacement {
  const o = middle('O');
  const repressor =
    input.lacI === 'broken'
      ? null
      : r.repressorOnOperator
        ? { at: [o, 1.9, 0] as Vec3, onOperator: true }
        : { at: [o, 5.2, 0] as Vec3, onOperator: false };
  return {
    repressor,
    allolactoseBound: r.allolactoseOnRepressor && repressor !== null,
    lactoseFree: input.lactose ? LACTOSE_SHOWN - (r.allolactoseOnRepressor ? 1 : 0) : 0,
    polymerase: r.transcribed
      ? { at: [region('lacZ').from + 1.6, 0, 0], onGenes: true }
      : { at: [middle('P'), 0, 0], onGenes: false },
    mrna: r.transcribed,
    broken: [
      ...(input.lacI === 'broken' ? (['lacI'] as const) : []),
      ...(input.operator === 'broken' ? (['O'] as const) : []),
    ],
  };
}
