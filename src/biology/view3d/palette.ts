/**
 * One palette for every biology 3D view: each role (a base, an allele, prey, an enzyme…) maps to
 * one theme token (Okabe–Ito chart colours, validated for colour vision deficiency) and one shape
 * cue, so colour is never the only way to tell two things apart, and the same thing looks the
 * same in every lesson — and in the lesson's 2D charts. Theme tokens only — the values change
 * with the theme.
 *
 * Rule 0 of the 0.7.1 style guide: saturation = data. Roles whose colour carries model data use
 * the full chart tokens; structures (membranes, nucleus, proteins, glass, spindle) are muted
 * (`muted`, `STRUCTURES`) so the data pops.
 */
import { muted as mutedColor } from '@/ui/three/color';

export type Shape =
  'sphere' | 'cube' | 'cone' | 'ring' | 'diamond' | 'capsule' | 'bar' | 'slab' | 'star';

export type BioRole =
  | 'maternal'
  | 'paternal'
  | 'baseA'
  | 'baseT'
  | 'baseU'
  | 'baseG'
  | 'baseC'
  | 'alleleA'
  | 'allelea'
  | 'genotypeAA'
  | 'genotypeAa'
  | 'genotypeaa'
  | 'prey'
  | 'predator'
  | 'enzyme'
  | 'substrate'
  | 'product'
  | 'inhibitor'
  | 'water'
  | 'solute'
  | 'membrane'
  | 'highlight';

/**
 * Token and shape cue of each role. Bases follow the colours the DNA → mRNA → protein lesson
 * already uses (DATA_REVIEW #26). Alleles and genotypes follow the Hardy–Weinberg chart (AA, Aa,
 * aa = series 1, 2, 3; allele A as AA, a as aa); prey and predators follow the Lotka–Volterra
 * chart (series 1 and the predator series, --chart-4).
 */
export const ROLES: Record<BioRole, { token: string; shape: Shape }> = {
  maternal: { token: '--chart-4', shape: 'capsule' },
  paternal: { token: '--chart-1', shape: 'capsule' },
  baseA: { token: '--chart-3', shape: 'slab' },
  baseT: { token: '--chart-4', shape: 'bar' },
  // U keeps the colour the DNA → mRNA lesson already uses (T and U can show side by side).
  baseU: { token: '--chart-5', shape: 'bar' },
  baseG: { token: '--chart-2', shape: 'slab' },
  baseC: { token: '--chart-1', shape: 'bar' },
  alleleA: { token: '--chart-1', shape: 'cube' },
  allelea: { token: '--chart-3', shape: 'sphere' },
  genotypeAA: { token: '--chart-1', shape: 'capsule' },
  genotypeAa: { token: '--chart-2', shape: 'capsule' },
  genotypeaa: { token: '--chart-3', shape: 'capsule' },
  prey: { token: '--chart-1', shape: 'sphere' },
  predator: { token: '--chart-4', shape: 'cone' },
  enzyme: { token: '--chart-6', shape: 'ring' },
  substrate: { token: '--chart-2', shape: 'sphere' },
  product: { token: '--chart-5', shape: 'diamond' },
  inhibitor: { token: '--chart-4', shape: 'cube' },
  water: { token: '--chart-6', shape: 'sphere' },
  solute: { token: '--chart-2', shape: 'cube' },
  membrane: { token: '--subject-biology', shape: 'slab' },
  highlight: { token: '--accent', shape: 'star' },
};

/** Phenotype classes in Okabe–Ito order (shape cues follow the same order). */
export const CLASS_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-7',
] as const;
export const CLASS_SHAPES: readonly Shape[] = [
  'sphere',
  'cube',
  'cone',
  'diamond',
  'ring',
  'capsule',
  'star',
];

export interface BioPalette {
  role(r: BioRole): { color: string; shape: Shape };
  /** Colour and shape of the i-th class (phenotypes, genotypes…), cycling past seven. */
  cls(i: number): { color: string; shape: Shape };
  text: string;
  muted: string;
  stage: string;
}

/** Reads the palette from the theme (`token` returns a CSS custom property's value). */
export function readBioPalette(token: (name: string) => string): BioPalette {
  return {
    role: (r) => ({ color: token(ROLES[r].token), shape: ROLES[r].shape }),
    cls: (i) => {
      const k = ((i % CLASS_TOKENS.length) + CLASS_TOKENS.length) % CLASS_TOKENS.length;
      return { color: token(CLASS_TOKENS[k] ?? '--chart-1'), shape: CLASS_SHAPES[k] ?? 'sphere' };
    },
    text: token('--text'),
    muted: token('--text-muted'),
    stage: token('--bg-stage'),
  };
}

/** Roles that appear together in one lesson: none of them may look alike. */
export const LESSON_ROLES: Record<string, readonly BioRole[]> = {
  division: ['maternal', 'paternal', 'highlight'],
  dna: ['baseA', 'baseT', 'baseU', 'baseG', 'baseC', 'highlight'],
  genetics: ['alleleA', 'allelea', 'genotypeAA', 'genotypeAa', 'genotypeaa', 'highlight'],
  ecology: ['prey', 'predator', 'highlight'],
  enzyme: ['enzyme', 'substrate', 'product', 'inhibitor', 'highlight'],
  transport: ['water', 'solute', 'membrane', 'highlight'],
};

/**
 * Structures (no data in their colour): the token each is muted from, or a token that is already
 * muted. Membrane = muted(--subject-biology), nucleus = muted(--chart-6); spindle, proteins, glass
 * and liquids have their own low-chroma tokens.
 */
export const STRUCTURES = {
  membrane: { token: '--subject-biology', mute: true },
  nucleus: { token: '--chart-6', mute: true },
  spindle: { token: '--m3d-spindle', mute: false },
  protein: { token: '--bio3d-protein', mute: false },
  glass: { token: '--bio3d-glass', mute: false },
  liquid: { token: '--bio3d-liquid', mute: false },
  annotation: { token: '--text-muted', mute: false },
} as const;

export type Structure = keyof typeof STRUCTURES;

/**
 * A structure colour: mixed 35 % towards the stage colour in linear light, then OKLCH chroma ×
 * 0.6 (style guide). `token` reads a CSS custom property.
 */
export function muted(token: (name: string) => string, name: string): string {
  return mutedColor(token(name), token('--bg-stage'));
}

/** The colour of a structure in the current theme. */
export function structureColor(token: (name: string) => string, s: Structure): string {
  const def = STRUCTURES[s];
  return def.mute ? muted(token, def.token) : token(def.token);
}
