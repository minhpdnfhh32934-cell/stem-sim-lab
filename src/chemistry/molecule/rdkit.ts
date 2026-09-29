import type { MainModule } from '@rdkit/rdkit';
import wasmUrl from '@rdkit/rdkit/RDKit_minimal.wasm?url';
import { ELEMENTS } from '../data/elements';

let rdkitPromise: Promise<MainModule> | undefined;

/** Loads RDKit.js (WebAssembly, ~7 MB) on first use only. */
export function loadRDKit(): Promise<MainModule> {
  rdkitPromise ??= import('@rdkit/rdkit').then((m) => {
    const init = m.default as unknown as (opts: {
      locateFile: () => string;
    }) => Promise<MainModule>;
    return init({ locateFile: () => wasmUrl });
  });
  return rdkitPromise;
}

export interface SmilesInfo {
  canonical: string;
  formula: string;
  molarMass: number | null;
  svg: string;
}

interface CommonChem {
  molecules?: {
    atoms?: { z?: number; impHs?: number; chg?: number }[];
  }[];
  defaults?: { atom?: { z?: number; impHs?: number; chg?: number } };
}

/** Hill-order formula from RDKit's CommonChem JSON (implicit hydrogens included). */
function formulaFrom(json: string): string {
  const data = JSON.parse(json) as CommonChem;
  const def = data.defaults?.atom ?? {};
  const counts = new Map<string, number>();
  let charge = 0;
  for (const a of data.molecules?.[0]?.atoms ?? []) {
    const z = a.z ?? def.z ?? 6;
    const sym = ELEMENTS[z - 1]?.symbol ?? '?';
    counts.set(sym, (counts.get(sym) ?? 0) + 1);
    const h = a.impHs ?? def.impHs ?? 0;
    if (h) counts.set('H', (counts.get('H') ?? 0) + h);
    charge += a.chg ?? def.chg ?? 0;
  }
  const order = [...counts.keys()].sort((x, y) => {
    const rank = (s: string) => (s === 'C' ? 0 : s === 'H' && counts.has('C') ? 1 : 2);
    return rank(x) - rank(y) || x.localeCompare(y);
  });
  const body = order
    .map((s) => `${s}${(counts.get(s) ?? 0) > 1 ? String(counts.get(s)) : ''}`)
    .join('');
  return charge
    ? `${body}${charge > 0 ? '+' : '-'}${Math.abs(charge) > 1 ? String(Math.abs(charge)) : ''}`
    : body;
}

/**
 * Parses a SMILES string with RDKit (valence checks included). Returns null when RDKit
 * rejects it. The result is 2D only — no verified 3D structure exists for it.
 */
export async function inspectSmiles(smiles: string): Promise<SmilesInfo | null> {
  const rd = await loadRDKit();
  const mol = rd.get_mol(smiles);
  if (!mol) return null;
  try {
    if (!mol.is_valid()) return null;
    const desc = JSON.parse(mol.get_descriptors()) as { amw?: number };
    return {
      canonical: mol.get_smiles(),
      formula: formulaFrom(mol.get_json()),
      molarMass: desc.amw ?? null,
      svg: mol.get_svg(360, 260),
    };
  } finally {
    mol.delete();
  }
}
