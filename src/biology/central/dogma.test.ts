import { describe, expect, it } from 'vitest';
import {
  GENETIC_CODE,
  analyzeMutation,
  cleanDna,
  codingToMrna,
  codonEntry,
  complement,
  transcribeTemplate,
  translate,
} from './dogma';

const CODING = 'ATGTTTGGCAAATGA'; // Met-Phe-Gly-Lys-Stop

describe('genetic code (NCBI table 1)', () => {
  it('has 64 codons: 61 sense, 3 stops, AUG = Met', () => {
    expect(GENETIC_CODE).toHaveLength(64);
    expect(
      GENETIC_CODE.filter((c) => c.stop)
        .map((c) => c.codon)
        .sort(),
    ).toEqual(['UAA', 'UAG', 'UGA']);
    expect(codonEntry('AUG')).toMatchObject({ aa: 'M', three: 'Met', start: true });
    expect(codonEntry('UGG')?.aa).toBe('W');
    // 20 amino acids, Leu/Ser/Arg have 6 codons each.
    const counts = new Map<string, number>();
    for (const c of GENETIC_CODE) counts.set(c.aa, (counts.get(c.aa) ?? 0) + 1);
    expect(counts.size).toBe(21);
    expect([counts.get('L'), counts.get('S'), counts.get('R')]).toEqual([6, 6, 6]);
    expect([counts.get('M'), counts.get('W')]).toEqual([1, 1]);
  });
});

describe('transcription and translation', () => {
  it('complementary strand, template → mRNA equals coding strand with U', () => {
    expect(complement('ATGC')).toBe('TACG');
    const template = complement(CODING);
    expect(transcribeTemplate(template)).toBe(codingToMrna(CODING));
    expect(codingToMrna(CODING)).toBe('AUGUUUGGCAAAUGA');
  });

  it('translates from the first AUG to the stop codon', () => {
    const t = translate(codingToMrna('CC' + CODING + 'GG'));
    expect(t.start).toBe(2);
    expect(t.protein).toBe('MFGK');
    expect(t.stopIndex).toBe(4);
  });

  it('cleans user input and rejects invalid bases', () => {
    expect(cleanDna("5'-atg ttt-3'")).toBe('ATGTTT');
    expect(() => cleanDna('ATGB')).toThrow();
    expect(cleanDna('ATGX')).toBe('ATGC'); // Vietnamese X = cytosine
  });
});

describe('point mutations', () => {
  it('silent: GGC → GGA (Gly → Gly)', () => {
    expect(analyzeMutation(CODING, { kind: 'substitution', pos: 8, base: 'A' }).effect).toBe(
      'silent',
    );
  });
  it('missense: TTT → TCT (Phe → Ser)', () => {
    const a = analyzeMutation(CODING, { kind: 'substitution', pos: 4, base: 'C' });
    expect(a.effect).toBe('missense');
    expect(a.after.protein).toBe('MSGK');
    expect(a.firstChange).toBe(1);
  });
  it('nonsense: AAA → TAA (Lys → Stop)', () => {
    const a = analyzeMutation(CODING, { kind: 'substitution', pos: 9, base: 'T' });
    expect(a.effect).toBe('nonsense');
    expect(a.after.protein).toBe('MFG');
  });
  it('frameshift after an insertion or deletion of one base', () => {
    expect(analyzeMutation(CODING, { kind: 'insertion', pos: 4, bases: 'A' }).effect).toBe(
      'frameshift',
    );
    expect(analyzeMutation(CODING, { kind: 'deletion', pos: 4, count: 1 }).effect).toBe(
      'frameshift',
    );
  });
  it('in-frame deletion of a whole codon', () => {
    const a = analyzeMutation(CODING, { kind: 'deletion', pos: 3, count: 3 });
    expect(a.effect).toBe('inFrameIndel');
    expect(a.after.protein).toBe('MGK');
  });
  it('start codon destroyed', () => {
    expect(analyzeMutation(CODING, { kind: 'substitution', pos: 1, base: 'C' }).effect).toBe(
      'startLoss',
    );
  });
});
