import { create } from 'zustand';
import { KW, hOf, phOf, strongSolutionH, type Solute } from './model';

/** What the learner gives: pH, [H⁺], [OH⁻], or a strong acid / base and its concentration. */
export type Given = 'pH' | 'H' | 'OH' | 'solution';

export interface AqueousState {
  given: Given;
  /** The solution's pH (the one value everything else follows from), 0 to 14. */
  pH: number;
  solute: Solute;
  /** Concentration of the strong acid or base (mol/L). */
  c: number;
}

export const C_RANGE = { min: 1e-6, max: 1 } as const;

/** Opens on pure water at 25 °C, pH 7. */
export const useAqueousStore = create<AqueousState>()(() => ({
  given: 'pH',
  pH: 7,
  solute: 'HCl',
  c: 0.1,
}));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Applies saved or typed values within range; anything else is ignored. */
export function setAqueous(patch: Partial<Record<keyof AqueousState, unknown>>): void {
  const s = useAqueousStore.getState();
  const given: Given = ['pH', 'H', 'OH', 'solution'].includes(patch.given as string)
    ? (patch.given as Given)
    : s.given;
  const solute: Solute =
    patch.solute === 'HCl' || patch.solute === 'NaOH' ? patch.solute : s.solute;
  const c =
    typeof patch.c === 'number' && Number.isFinite(patch.c) && patch.c > 0
      ? clamp(patch.c, C_RANGE.min, C_RANGE.max)
      : s.c;
  let pH =
    typeof patch.pH === 'number' && Number.isFinite(patch.pH) ? clamp(patch.pH, 0, 14) : s.pH;
  // A strong solution sets the pH from its concentration.
  if (given === 'solution' && (patch.solute !== undefined || patch.c !== undefined || patch.given))
    pH = phOf(strongSolutionH(solute, c));
  useAqueousStore.setState({ given, solute, c, pH });
}

/** [H⁺] and [OH⁻] typed in mol/L become a pH (kept on the 0–14 scale). */
export const setFromH = (h: number) => {
  if (h > 0) setAqueous({ pH: phOf(h) });
};
export const setFromOH = (oh: number) => {
  if (oh > 0) setAqueous({ pH: phOf(KW / oh) });
};
export const hOfState = (s: AqueousState) => hOf(s.pH);
