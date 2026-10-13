import { describe, expect, it } from 'vitest';
import type { LocalizedText } from '@/core/data/dataset';
import {
  CELL_TYPE_NAME,
  COMPONENTS,
  STAGE3D_NAME,
  card3d,
  componentVisible,
  componentsFor,
  stageNote,
  type ComponentId,
} from './components';
import { STAGES_3D, buildTimeline, type CellType, type Stage3D } from './timeline';

const CELL_TYPES: CellType[] = ['animal', 'plant'];
const ALL = Object.keys(COMPONENTS) as ComponentId[];

/**
 * What can be seen at each step's key moment (where the stage strip and the step buttons jump
 * to), written from the biology. Parts of both cell types:
 */
const SEEN: Record<Stage3D, ComponentId[]> = {
  // G1: a nucleus with decondensed single chromosomes (chromatin); no spindle yet.
  g1: ['membrane', 'nucleus', 'nuclearEnvelope', 'nucleolus', 'chromatin', 'singleChromosome'],
  // G2: already double, but still decondensed — chromatin, not yet visible double chromosomes.
  g2: ['membrane', 'nucleus', 'nuclearEnvelope', 'nucleolus', 'chromatin'],
  // End of prophase: the nucleolus and the envelope are gone; condensed double chromosomes; the
  // spindle has formed.
  prophase: ['membrane', 'doubleChromosome', 'sisterChromatid', 'centromere', 'spindle'],
  metaphase: ['membrane', 'doubleChromosome', 'sisterChromatid', 'centromere', 'spindle'],
  // Anaphase: the sisters are single chromosomes now, still condensed, pulled by the spindle.
  anaphase: ['membrane', 'singleChromosome', 'centromere', 'spindle'],
  // End of telophase: two nuclei (each with its nucleolus again) around decondensed single
  // chromosomes; the spindle is gone.
  telophase: [
    'membrane',
    'nucleus',
    'nuclearEnvelope',
    'nucleolus',
    'chromatin',
    'singleChromosome',
  ],
  // End of cytokinesis: two daughter cells with interphase nuclei.
  cytokinesis: [
    'membrane',
    'nucleus',
    'nuclearEnvelope',
    'nucleolus',
    'chromatin',
    'singleChromosome',
  ],
};
/**
 * Parts of one cell type: animal centrosomes at every step (one in G1, two from G2); the plant
 * wall at every step and the finished cell plate at the end of cytokinesis. The animal furrow
 * has closed at that moment (two separate cells): it shows during the step (tested below).
 */
const SEEN_ONLY: Record<CellType, (stage: Stage3D) => ComponentId[]> = {
  animal: () => ['centrosome'],
  plant: (stage) => (stage === 'cytokinesis' ? ['cellWall', 'cellPlate'] : ['cellWall']),
};

const ANIMAL_ONLY_PARTS: ComponentId[] = ['centrosome', 'cleavageFurrow'];
const PLANT_ONLY_PARTS: ComponentId[] = ['cellWall', 'cellPlate'];

describe('3D mitosis cell parts', () => {
  it('each cell type lists its own parts only', () => {
    const animal = componentsFor('animal');
    const plant = componentsFor('plant');
    for (const id of ANIMAL_ONLY_PARTS) {
      expect(animal).toContain(id);
      expect(plant).not.toContain(id);
      expect(COMPONENTS[id].cells).toEqual(['animal']);
    }
    for (const id of PLANT_ONLY_PARTS) {
      expect(plant).toContain(id);
      expect(animal).not.toContain(id);
      expect(COMPONENTS[id].cells).toEqual(['plant']);
    }
    const shared = ALL.filter(
      (id) => !ANIMAL_ONLY_PARTS.includes(id) && !PLANT_ONLY_PARTS.includes(id),
    );
    for (const id of shared) {
      expect(animal).toContain(id);
      expect(plant).toContain(id);
    }
    expect(new Set([...animal, ...plant])).toEqual(new Set(ALL));
  });

  it('stage × part: what can be seen at every step, animal and plant', () => {
    for (const type of CELL_TYPES) {
      for (const n of [1, 2, 4, 23]) {
        const tl = buildTimeline(n, type);
        for (const stage of STAGES_3D) {
          const s = tl.stateAt(tl.keyTime(stage));
          expect(s.stage).toBe(stage);
          const seen = ALL.filter((id) => componentVisible(id, s));
          const expected = [...SEEN[stage], ...SEEN_ONLY[type](stage)];
          expect(new Set(seen), `${type} 2n=${String(2 * n)} ${stage}`).toEqual(new Set(expected));
        }
      }
    }
  });

  it('the furrow and the cell plate show while the cytoplasm divides, never before', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(2, type);
      const own: ComponentId = type === 'animal' ? 'cleavageFurrow' : 'cellPlate';
      const w = tl.stages.find((x) => x.id === 'cytokinesis')!;
      expect(componentVisible(own, tl.stateAt(w.start + 0.5 * (w.end - w.start)))).toBe(true);
      for (let t = 0; t < w.start; t += 0.1)
        expect(componentVisible(own, tl.stateAt(t))).toBe(false);
    }
  });

  it('a part one cell type lacks is never shown as visible in that cell', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(2, type);
      const lacks = type === 'animal' ? PLANT_ONLY_PARTS : ANIMAL_ONLY_PARTS;
      for (let t = 0; t <= tl.total; t += 0.05) {
        const s = tl.stateAt(t);
        for (const id of lacks)
          expect(componentVisible(id, s), `${type} t=${String(t)}`).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------- texts

/** Phrases saying a part is ABSENT are removed before looking for the part's name. */
const NEGATIONS: Record<CellType, RegExp> = {
  plant:
    /không có trung thể|không thắt eo|no centrosomes?|no cleavage furrow|plant cells have no centrosomes/gi,
  animal: /không có thành tế bào|no cell wall/gi,
};
/** Names of parts the other cell type does not have. */
const FOREIGN: Record<CellType, RegExp> = {
  plant:
    /trung thể|trung tử|rãnh phân cắt|vòng co|eo thắt|thắt eo|centrosome|centriole|furrow|contractile ring|\basters?\b/i,
  animal: /thành tế bào|tấm tế bào|vách ngăn|cell wall|cell plate/i,
};

function cellTexts(type: CellType): { where: string; text: LocalizedText }[] {
  const card = card3d(type);
  return [
    ...STAGES_3D.map((stage) => ({ where: `note ${stage}`, text: stageNote(stage, type) })),
    { where: 'card title', text: card.title },
    { where: 'card model', text: card.model },
    ...card.equations.flatMap((e) =>
      e.label ? [{ where: `equation ${e.tex}`, text: e.label }] : [],
    ),
    ...card.assumptions.map((text, i) => ({ where: `assumption ${String(i)}`, text })),
    ...(card.confidenceNote ? [{ where: 'confidence note', text: card.confidenceNote }] : []),
    { where: 'cell name', text: CELL_TYPE_NAME[type] },
  ];
}

describe('3D mitosis texts for animal and plant cells', () => {
  it('every text has Vietnamese and English', () => {
    const all: LocalizedText[] = [
      ...Object.values(COMPONENTS).flatMap((c) => [c.name, c.role]),
      ...Object.values(STAGE3D_NAME),
      ...CELL_TYPES.flatMap((type) => cellTexts(type).map((x) => x.text)),
    ];
    for (const text of all) {
      expect(text.vi.trim()).not.toBe('');
      expect(text.en.trim()).not.toBe('');
    }
  });

  for (const type of CELL_TYPES) {
    it(`${type}: notes and Science Card never name a part only the other cell type has`, () => {
      for (const { where, text } of cellTexts(type)) {
        for (const lang of ['vi', 'en'] as const) {
          const stripped = text[lang].replace(NEGATIONS[type], '');
          expect(stripped, `${type} ${where} (${lang})`).not.toMatch(FOREIGN[type]);
        }
      }
    });
  }

  it('parts of both cell types never name a part only one of them has', () => {
    for (const id of ALL.filter((x) => COMPONENTS[x].cells.length === 2)) {
      for (const lang of ['vi', 'en'] as const) {
        const text = `${COMPONENTS[id].name[lang]} ${COMPONENTS[id].role[lang]}`;
        expect(text, `${id} (${lang})`).not.toMatch(FOREIGN.plant);
        expect(text, `${id} (${lang})`).not.toMatch(FOREIGN.animal);
      }
    }
  });

  it('each cell type names its own parts where they matter', () => {
    const note = (stage: Stage3D, type: CellType) => stageNote(stage, type);
    // Plant: the wall from G1, no centrosome, the cell plate in cytokinesis.
    expect(note('g1', 'plant').vi).toMatch(/thành tế bào cứng và không có trung thể/);
    expect(note('g1', 'plant').en).toMatch(/cell wall and no centrosome/);
    expect(note('prophase', 'plant').vi).toMatch(/không có trung thể/);
    expect(note('cytokinesis', 'plant').vi).toMatch(/^Tấm tế bào/);
    expect(note('cytokinesis', 'plant').en).toMatch(/cell plate/);
    // Animal: centrosomes in interphase and prophase, the furrow in cytokinesis.
    for (const stage of ['g1', 'g2', 'prophase'] as const) {
      expect(note(stage, 'animal').vi).toMatch(/trung thể/i);
      expect(note(stage, 'animal').en).toMatch(/centrosome/i);
    }
    expect(note('cytokinesis', 'animal').vi).toMatch(/rãnh phân cắt/);
    expect(note('cytokinesis', 'animal').en).toMatch(/cleavage furrow/);
    // Names and card titles.
    expect(CELL_TYPE_NAME.plant).toEqual({ vi: 'Tế bào thực vật', en: 'Plant cell' });
    expect(CELL_TYPE_NAME.animal).toEqual({ vi: 'Tế bào động vật', en: 'Animal cell' });
    expect(card3d('plant').title).toEqual({
      vi: 'Nguyên phân 3D — tế bào thực vật',
      en: 'Mitosis in 3D — plant cell',
    });
    expect(card3d('animal').title).toEqual({
      vi: 'Nguyên phân 3D — tế bào động vật',
      en: 'Mitosis in 3D — animal cell',
    });
    // Every 3D text is pending teacher review.
    for (const type of CELL_TYPES) expect(card3d(type).reviewStatus).toBe('pending');
  });
});
