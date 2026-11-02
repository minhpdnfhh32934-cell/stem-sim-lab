/**
 * "Từ tế bào đến DNA": one zoom through six levels, from a eukaryotic cell down to the DNA
 * double helix. Pure numbers only (no three.js, no canvas): the sizes the textbooks print
 * (`data/cell_dna_zoom.json`, `scripts/data/gen_cell_dna_zoom.py`, DATA_REVIEW DNAZ-*), the B-DNA
 * constant shared with the DNA lessons (`bdna.ts`), the few drawing choices every picture of a
 * level shares (`DRAWN`, all illustration), and each level's field of view and scale bar. The 3D
 * scenes and the 2D pictures both lay out from here, so their scale bars agree.
 */
import { z } from 'zod';
import raw from '@data/cell_dna_zoom.json';
import { ReviewStatusSchema, SourceSchema } from '@/core/data/dataset';
import type { LocalizedText, Source } from '@/core/data/dataset';
import { B_DNA, RISE } from '../../central/dogma3d/bdna';
import { L } from '../../common';

const SizeSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['nm', 'µm', 'count']),
  source: z.string().min(1),
  pages: z.array(z.number().int().positive()),
  where: z.string().min(1),
  review_status: ReviewStatusSchema,
});
export type SizeItem = z.infer<typeof SizeSchema>;

const SIZE_KEYS = [
  'eukCellMinUm',
  'eukCellMaxUm',
  'nucleusUm',
  'chromatidNm',
  'fibreNm',
  'histones',
  'histoneKinds',
  'nucleosomeBp',
  'dnaWidthNm',
  'nucleosomeBpOu',
  'coreParticleNmOu',
] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

const DataSchema = z.object({
  dataset: z.literal('cell_dna_zoom'),
  version: z.number().int().positive(),
  sources: z.record(z.string(), SourceSchema),
  sizes: z.object(
    Object.fromEntries(SIZE_KEYS.map((k) => [k, SizeSchema])) as Record<SizeKey, typeof SizeSchema>,
  ),
});

// An invalid generated file is a bug: it throws when the lesson loads.
const DATA = DataSchema.parse(raw);

export const SIZES: Readonly<Record<SizeKey, SizeItem>> = DATA.sizes;
export const ZOOM_SOURCES: Readonly<Record<string, Source>> = DATA.sources;

/** The source of a size (the generator checks every id exists). */
export function sourceOf(key: SizeKey): Source {
  const s = ZOOM_SOURCES[SIZES[key].source];
  if (!s) throw new Error(`cell_dna_zoom: unknown source of ${key}`);
  return s;
}

const NM_PER_UM = 1000;

/** The printed sizes the pictures use, in nm (counts as printed). */
export const SIZE = {
  cellMinNm: SIZES.eukCellMinUm.value * NM_PER_UM,
  cellMaxNm: SIZES.eukCellMaxUm.value * NM_PER_UM,
  nucleusNm: SIZES.nucleusUm.value * NM_PER_UM,
  chromatidNm: SIZES.chromatidNm.value,
  fibreNm: SIZES.fibreNm.value,
  histones: SIZES.histones.value,
  histoneKinds: SIZES.histoneKinds.value,
  nucleosomeBp: SIZES.nucleosomeBp.value,
  /** B-DNA, from the constant the DNA lessons use (SGK Sinh học 12 H 7.1 prints the same 2 nm). */
  dnaNm: B_DNA.diameterNm,
  pitchNm: B_DNA.pitchNm,
  bpPerTurn: B_DNA.bpPerTurn,
} as const;

/**
 * Drawing choices shared by the 3D and 2D pictures. Illustration, not data: the captions say so
 * and none of these is shown as a number, except the drawn cell's diameter, which the caption
 * gives as a value chosen inside the textbook's 10–100 µm.
 */
export const DRAWN = {
  /** Diameter of the drawn cell (a value inside SIZE.cellMinNm … cellMaxNm). */
  cellNm: 20_000,
  /** Arm lengths of the drawn metaphase chromatid (real chromosomes differ in length). */
  armNm: [1200, 1800] as const,
  /** Sister chromatids part by this share of the distance from the centromere (the X shape). */
  splay: 0.16,
  /** Loops of the 10 nm fibre around the scaffold, per ring and rings drawn. */
  loopsPerRing: 10,
  loopRings: 3,
  /** Nucleosomes in the "beads on a string" picture and the linker DNA between two of them. */
  nucleosomes: 3,
  linkerNm: 8,
  /**
   * Turns of DNA around the histone octamer. TODO(DATA_REVIEW DNAZ-6): no verified source yet,
   * so the number is drawn but never written; the caption says the wrapping is illustration.
   */
  wrapTurns: 1.65,
  /** Gap between two turns of the wrapped DNA, as a share of the DNA's width (illustration). */
  wrapGap: 0.25,
  /** Base pairs drawn at the double-helix level (two turns; the sequence is illustration). */
  helixBp: 20,
} as const;

/** The drawn double helix's sequence (illustration); the other strand pairs A–T, G–C. */
export const HELIX_SEQUENCE = 'ATGCGTACCTAGGCATTCGA';
export type Base = 'A' | 'T' | 'G' | 'C';
export const COMPLEMENT: Readonly<Record<Base, Base>> = { A: 'T', T: 'A', G: 'C', C: 'G' };
export const baseAt = (i: number): Base => {
  const b = HELIX_SEQUENCE[i % HELIX_SEQUENCE.length];
  return b === 'T' || b === 'G' || b === 'C' ? b : 'A';
};

/** Radius of the wrapped DNA's axis around the octamer: the 10 nm bead minus the 2 nm DNA. */
export const WRAP_RADIUS_NM = (SIZE.fibreNm - SIZE.dnaNm) / 2;
/** Radius of the drawn histone core: inside the wrapped DNA. */
export const CORE_RADIUS_NM = WRAP_RADIUS_NM - SIZE.dnaNm / 2;
/** Rise of the wrapped DNA per turn (one DNA width plus the drawn gap). */
export const WRAP_PITCH_NM = SIZE.dnaNm * (1 + DRAWN.wrapGap);
/** Length of the drawn double helix (nm). */
export const HELIX_LENGTH_NM = (DRAWN.helixBp - 1) * RISE;

export type ZoomLevel = 'cell' | 'nucleus' | 'chromosome' | 'fibre' | 'nucleosome' | 'dna';

export const LEVELS: readonly ZoomLevel[] = [
  'cell',
  'nucleus',
  'chromosome',
  'fibre',
  'nucleosome',
  'dna',
];

export const LEVEL_NAME: Record<ZoomLevel, LocalizedText> = {
  cell: L('Tế bào nhân thực', 'Eukaryotic cell'),
  nucleus: L('Nhân tế bào', 'Nucleus'),
  chromosome: L('NST kép ở kì giữa', 'Metaphase chromosome'),
  fibre: L('Sợi nhiễm sắc 10 nm và khung NST', '10 nm fibre and chromosome scaffold'),
  nucleosome: L('Nucleosome', 'Nucleosomes'),
  dna: L('Chuỗi xoắn kép B-DNA', 'B-DNA double helix'),
};

/** Width of a level's picture (nm): the subject the camera frames. */
function fieldOf(level: ZoomLevel): number {
  switch (level) {
    case 'cell':
      return DRAWN.cellNm;
    case 'nucleus':
      return SIZE.nucleusNm;
    case 'chromosome':
      return DRAWN.armNm[0] + DRAWN.armNm[1];
    case 'fibre':
      return SIZE.chromatidNm;
    case 'nucleosome':
      return DRAWN.nucleosomes * SIZE.fibreNm + (DRAWN.nucleosomes - 1) * DRAWN.linkerNm;
    case 'dna':
      return HELIX_LENGTH_NM;
  }
}

/** Longest scale bar as a share of the picture's width. */
export const BAR_SHARE = 0.25;

/** The scale bar of a picture `field` nm wide: the longest 1, 2 or 5 × 10ᵏ nm within BAR_SHARE. */
export function scaleBarNm(field: number): number {
  const max = field * BAR_SHARE;
  const p = 10 ** Math.floor(Math.log10(max));
  const f = max / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

export interface LevelInfo {
  id: ZoomLevel;
  index: number;
  /** Width of the picture (nm). */
  fieldNm: number;
  /** Scale bar length (nm). */
  barNm: number;
  /** Scene units of the 3D picture: the field is 10 units wide whatever the level. */
  unitNm: number;
}

export function levelInfo(index: number): LevelInfo {
  const i = Math.min(LEVELS.length - 1, Math.max(0, Math.round(index)));
  const id = LEVELS[i] ?? 'cell';
  const fieldNm = fieldOf(id);
  return { id, index: i, fieldNm, barNm: scaleBarNm(fieldNm), unitNm: fieldNm / 10 };
}

/** A length for people: "5 µm", "200 nm" (number formatting is the caller's). */
export function lengthParts(nm: number): { value: number; unit: 'nm' | 'µm' } {
  return nm >= NM_PER_UM ? { value: nm / NM_PER_UM, unit: 'µm' } : { value: nm, unit: 'nm' };
}

/** A printed size shown on a level, with where it comes from. */
export interface LevelFact {
  label: LocalizedText;
  key: SizeKey;
}

/** The sizes each level shows (the inspector); the first is drawn to scale (the stage's chip). */
export const LEVEL_FACTS: Record<ZoomLevel, readonly LevelFact[]> = {
  cell: [
    { label: L('Đường kính nhân', 'Nucleus diameter'), key: 'nucleusUm' },
    { label: L('Tế bào nhân thực, nhỏ nhất', 'Eukaryotic cell, smallest'), key: 'eukCellMinUm' },
    { label: L('Tế bào nhân thực, lớn nhất', 'Eukaryotic cell, largest'), key: 'eukCellMaxUm' },
  ],
  nucleus: [{ label: L('Đường kính nhân', 'Nucleus diameter'), key: 'nucleusUm' }],
  chromosome: [
    { label: L('Đường kính một chromatid', 'Width of one chromatid'), key: 'chromatidNm' },
  ],
  fibre: [
    { label: L('Sợi nhiễm sắc', 'Chromatin fibre'), key: 'fibreNm' },
    { label: L('Đường kính một chromatid', 'Width of one chromatid'), key: 'chromatidNm' },
  ],
  nucleosome: [
    { label: L('Chuỗi nucleosome', 'Nucleosome chain'), key: 'fibreNm' },
    { label: L('Phân tử histone', 'Histone molecules'), key: 'histones' },
    { label: L('Loại histone', 'Kinds of histone'), key: 'histoneKinds' },
    { label: L('Cặp nucleotide quấn quanh', 'Base pairs wrapped'), key: 'nucleosomeBp' },
  ],
  dna: [{ label: L('Đường kính DNA', 'DNA width'), key: 'dnaWidthNm' }],
};

/** Where in a level the next level is: a sphere in the level's own nm coordinates. */
export interface ZoomSpot {
  center: readonly [number, number, number];
  radiusNm: number;
}

/**
 * The spot each level zooms into (none for the double helix). The nucleus keeps its real size
 * in the cell; the other spots are where the drawn next level would sit (illustration).
 */
export function zoomSpot(level: ZoomLevel): ZoomSpot | null {
  switch (level) {
    case 'cell':
      return { center: [0, 0, 0], radiusNm: SIZE.nucleusNm / 2 };
    case 'nucleus':
      return { center: [SIZE.nucleusNm * 0.12, -SIZE.nucleusNm * 0.08, 0], radiusNm: 600 };
    case 'chromosome':
      // On the right sister's long arm (its centre line parts by `splay`).
      return {
        center: [
          SIZE.chromatidNm * 0.5 + DRAWN.armNm[1] * 0.55 * DRAWN.splay,
          DRAWN.armNm[1] * 0.55,
          0,
        ],
        radiusNm: 350,
      };
    case 'fibre':
      return { center: [SIZE.chromatidNm * 0.3, 0, 0], radiusNm: 40 };
    case 'nucleosome':
      return { center: [SIZE.fibreNm / 2 + DRAWN.linkerNm / 2, 0, 0], radiusNm: 4 };
    case 'dna':
      return null;
  }
}

/** Named parts of the pictures ("Hiện tên"). */
export type ZoomPart =
  | 'membrane'
  | 'nucleus'
  | 'mitochondrion'
  | 'envelope'
  | 'pore'
  | 'nucleolus'
  | 'chromatin'
  | 'chromatid'
  | 'centromere'
  | 'fibre'
  | 'scaffold'
  | 'histones'
  | 'wrappedDna'
  | 'linker'
  | 'backbone'
  | 'basePair';

/** The parts each level names, in label order. */
export const LEVEL_PARTS: Record<ZoomLevel, readonly ZoomPart[]> = {
  cell: ['membrane', 'nucleus', 'mitochondrion'],
  nucleus: ['envelope', 'pore', 'nucleolus', 'chromatin'],
  chromosome: ['chromatid', 'centromere'],
  fibre: ['fibre', 'scaffold'],
  nucleosome: ['histones', 'wrappedDna', 'linker'],
  dna: ['backbone', 'basePair'],
};
