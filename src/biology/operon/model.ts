/**
 * Sinh học 12 KNTT Bài 3 "Điều hoà biểu hiện gene": the lac operon of E. coli (tr. 18–21). The
 * operon has a regulatory region (promoter P, operator O) and three structural genes lacZ, lacY,
 * lacA; the regulator gene lacI, outside the operon, codes for the repressor. Without lactose the
 * repressor binds O and stops RNA polymerase; with lactose, allolactose binds the repressor, which
 * can no longer bind O, and the structural genes are transcribed (Hình 3.1, 3.2). Question 2 of
 * "Luyện tập" (tr. 21): an operon working without lactose points to a damaged lacI or O.
 */

export type PartState = 'normal' | 'broken';

export interface OperonInput {
  lactose: boolean;
  lacI: PartState;
  operator: PartState;
}

export type OperonReason = 'repressed' | 'lactose' | 'lacIBroken' | 'operatorBroken';

export interface OperonResult {
  /** The repressor is bound to the operator. */
  repressorOnOperator: boolean;
  /** Allolactose is bound to the repressor. */
  allolactoseOnRepressor: boolean;
  /** lacZ, lacY, lacA are transcribed (and their enzymes made). */
  transcribed: boolean;
  reason: OperonReason;
}

/** The three structural genes and the enzymes they code for (tr. 19). */
export const STRUCTURAL_GENES = [
  { gene: 'lacZ', enzyme: 'β-galactosidase' },
  { gene: 'lacY', enzyme: 'permease' },
  { gene: 'lacA', enzyme: 'transacetylase' },
] as const;

export function operon(input: OperonInput): OperonResult {
  const allolactose = input.lactose && input.lacI === 'normal';
  if (input.lacI === 'broken') {
    // No working repressor: nothing blocks the operator.
    return {
      repressorOnOperator: false,
      allolactoseOnRepressor: false,
      transcribed: true,
      reason: 'lacIBroken',
    };
  }
  if (input.operator === 'broken') {
    // The repressor cannot hold on to a damaged operator.
    return {
      repressorOnOperator: false,
      allolactoseOnRepressor: allolactose,
      transcribed: true,
      reason: 'operatorBroken',
    };
  }
  if (input.lactose) {
    return {
      repressorOnOperator: false,
      allolactoseOnRepressor: true,
      transcribed: true,
      reason: 'lactose',
    };
  }
  return {
    repressorOnOperator: true,
    allolactoseOnRepressor: false,
    transcribed: false,
    reason: 'repressed',
  };
}
