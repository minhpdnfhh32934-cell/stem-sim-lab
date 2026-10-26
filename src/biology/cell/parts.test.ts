import { describe, expect, it } from 'vitest';
import { checkInput, outputIsSafe } from '@/safety/moderation';
import { CELL_ILLUSTRATION, cellCard } from './card';
import { CELL_KINDS, CELL_KIND_NAME, PARTS, partsFor, type CellKind, type PartId } from './parts';

const texts = (id: PartId) => {
  const p = PARTS[id];
  return [p.name.vi, p.name.en, p.role.vi, p.role.en];
};
/** Digits, including super- and subscript ones. */
const DIGIT = /[\d¹²³⁰-⁹₀-₉]/u;
const names = (kind: CellKind) => partsFor(kind).map((id) => PARTS[id].name.vi);

describe('cell parts table (SGK Sinh học 10 KNTT, Bài 7–8)', () => {
  it('every part has vi/en name and function, a source with pages, and is pending', () => {
    for (const p of Object.values(PARTS)) {
      for (const t of [p.name.vi, p.name.en, p.role.vi, p.role.en]) expect(t.trim()).not.toBe('');
      expect(p.source.citation).toMatch(/Sinh học 10.*Kết nối tri thức/);
      // Printed pages of Bài 7 (44–47) and Bài 8 (48–57).
      expect(p.pages.length).toBeGreaterThan(0);
      for (const page of p.pages) {
        expect(page).toBeGreaterThanOrEqual(44);
        expect(page).toBeLessThanOrEqual(57);
      }
      expect(p.review_status).toBe('pending');
      expect(p.cells.length).toBeGreaterThan(0);
    }
  });

  it('holds no numbers (no sizes or counts)', () => {
    for (const id of Object.keys(PARTS) as PartId[])
      for (const t of texts(id)) expect(t, `${id}: ${t}`).not.toMatch(DIGIT);
  });

  it('the prokaryote has no nucleus and no membrane-bound organelle', () => {
    const parts = partsFor('bacterium');
    expect(parts).not.toContain('nucleus');
    expect(parts.filter((id) => PARTS[id].membraneBound)).toEqual([]);
    // Its DNA lies in the nucleoid; its only organelle is the ribosome.
    expect(parts).toEqual(expect.arrayContaining(['nucleoid', 'ribosome', 'bacterialWall']));
  });

  it('the animal cell has no cell wall and no chloroplast', () => {
    const parts = partsFor('animal');
    for (const id of ['bacterialWall', 'plantWall', 'chloroplast', 'vacuole'] as const)
      expect(parts).not.toContain(id);
    expect(names('animal')).not.toContain('Thành tế bào');
    expect(parts).toEqual(expect.arrayContaining(['nucleus', 'mitochondrion', 'centrosome']));
  });

  it('the plant cell has a cell wall, chloroplasts and a large central vacuole', () => {
    const parts = partsFor('plant');
    expect(parts).toEqual(expect.arrayContaining(['plantWall', 'chloroplast', 'vacuole']));
    expect(PARTS.vacuole.name.vi).toBe('Không bào trung tâm');
    // SGK: the centrosome is absent from plant cells; lysosomes are drawn in the animal cell only.
    expect(parts).not.toContain('centrosome');
    expect(parts).not.toContain('lysosome');
  });

  it('every part belongs to a cell list; the lists match the textbook pictures (DATA_REVIEW CELL3D-1)', () => {
    expect(new Set(CELL_KINDS.flatMap(partsFor))).toEqual(new Set(Object.keys(PARTS)));
    // H 7.2: nine parts of the bacterium; H 8.1: eleven of the animal cell, twelve of the plant cell.
    expect(CELL_KINDS.map((k) => partsFor(k).length)).toEqual([9, 11, 12]);
  });

  it('membraneBound marks exactly the organelles with their own membrane', () => {
    const own = [
      'nucleus',
      'er',
      'golgi',
      'lysosome',
      'peroxysome',
      'vacuole',
      'mitochondrion',
      'chloroplast',
    ];
    const flagged = (Object.keys(PARTS) as PartId[]).filter((id) => PARTS[id].membraneBound);
    expect(new Set(flagged)).toEqual(new Set(own));
  });

  it('eukaryotes have a nucleus and membrane-bound organelles; parts are named once per cell', () => {
    for (const kind of ['animal', 'plant'] as const) {
      expect(partsFor(kind)).toContain('nucleus');
      expect(partsFor(kind).some((id) => PARTS[id].membraneBound)).toBe(true);
    }
    for (const kind of CELL_KINDS) expect(new Set(names(kind)).size).toBe(names(kind).length);
  });

  it('no name or function trips the moderation (no false crisis alert)', () => {
    for (const id of Object.keys(PARTS) as PartId[])
      for (const t of texts(id)) {
        expect(checkInput(t), `${id}: ${t}`).toEqual({ ok: true });
        expect(outputIsSafe(t), `${id}: ${t}`).toBe(true);
      }
  });
});

describe('cell Science Card', () => {
  it('is qualitative, has no equation and the lesson’s own illustration note', () => {
    for (const kind of CELL_KINDS) {
      const card = cellCard(kind);
      expect(card.confidence).toBe('qualitative');
      expect(card.equations).toEqual([]);
      expect(card.reviewStatus).toBe('pending');
      expect(card.assumptions.map((a) => a.vi)).toContain(
        'Minh hoạ — không theo tỉ lệ; số lượng bào quan chỉ để minh hoạ.',
      );
      // Texts only: the source names the curriculum year ("GDPT 2018").
      expect(JSON.stringify({ ...card, sources: [] })).not.toMatch(DIGIT);
    }
  });

  it('no card text, cell name or caption trips the moderation', () => {
    const all = CELL_KINDS.flatMap((kind) => {
      const c = cellCard(kind);
      return [
        c.title,
        c.model,
        c.validity,
        c.confidenceNote,
        ...c.assumptions,
        CELL_KIND_NAME[kind],
      ];
    });
    for (const t of [...all, CELL_ILLUSTRATION])
      for (const s of t ? [t.vi, t.en] : []) {
        expect(checkInput(s), s).toEqual({ ok: true });
        expect(outputIsSafe(s), s).toBe(true);
      }
  });
});
