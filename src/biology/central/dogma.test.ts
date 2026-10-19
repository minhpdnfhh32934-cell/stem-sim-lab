import { describe, expect, it } from 'vitest';
import {
  GENETIC_CODE,
  analyzeMutation,
  cleanDna,
  codingToMrna,
  codonEntry,
  complement,
  mutatedTranslation,
  strandDirection,
  transcribeTemplate,
  translate,
} from './dogma';
import { parseInput } from './state';

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

describe('mutations around the start codon (default lesson sequence)', () => {
  // AUG at index 3, protein MAFKGW.
  const SEQ = 'TACATGGCTTTCAAAGGCTGGTAAGC';

  it.each([0, 1, 2])('a 1-base deletion in the 5′ UTR (pos %i) is outside the CDS', (pos) => {
    const a = analyzeMutation(SEQ, { kind: 'deletion', pos, count: 1 });
    expect(a.effect).toBe('outsideCds');
    expect(a.after.protein).toBe('MAFKGW');
  });

  it.each([0, 1, 3])('a G inserted upstream (pos %i, incl. right before the A of ATG)', (pos) => {
    const a = analyzeMutation(SEQ, { kind: 'insertion', pos, bases: 'G' });
    expect(a.effect).toBe('outsideCds');
    expect(a.after.protein).toBe('MAFKGW');
  });

  it('a substitution or deletion that hits the ATG is a start loss', () => {
    expect(analyzeMutation(SEQ, { kind: 'substitution', pos: 4, base: 'C' }).effect).toBe(
      'startLoss',
    );
    expect(analyzeMutation(SEQ, { kind: 'deletion', pos: 2, count: 2 }).effect).toBe('startLoss');
    expect(analyzeMutation(SEQ, { kind: 'insertion', pos: 4, bases: 'C' }).effect).toBe(
      'startLoss',
    );
  });

  it('an upstream change that creates a new AUG in front is not called a start loss', () => {
    // Insert "ATG" right before the old start: the first AUG is now the inserted one.
    const a = analyzeMutation(SEQ, { kind: 'insertion', pos: 3, bases: 'ATG' });
    expect(a.effect).toBe('startGain');
    expect(a.after.start).toBe(3);
  });
});

describe('mutatedTranslation agrees with analyzeMutation', () => {
  const SEQ = 'TACATGGCTTTCAAAGGCTGGTAAGC';

  it.each([0, 1, 3])('a start gain (insert ATG at %i) is read from the new first AUG', (pos) => {
    const m = { kind: 'insertion', pos, bases: 'ATG' } as const;
    const a = analyzeMutation(SEQ, m);
    const mt = mutatedTranslation(SEQ, m);
    expect(a.effect).toBe('startGain');
    expect(mt.t.protein).toBe(a.after.protein);
    expect(mt.t.start).toBe(a.after.start);
    expect(mt.mrna.slice(mt.t.start, mt.t.start + 3)).toBe('AUG');
  });

  it('insert ATG at 0 gives MYMAFKGW, at 1 gives MTWLSKAGK', () => {
    expect(mutatedTranslation(SEQ, { kind: 'insertion', pos: 0, bases: 'ATG' }).t.protein).toBe(
      'MYMAFKGW',
    );
    expect(mutatedTranslation(SEQ, { kind: 'insertion', pos: 1, bases: 'ATG' }).t.protein).toBe(
      'MTWLSKAGK',
    );
  });
});

describe('nonsense when the original frame has no stop codon', () => {
  it('AAA → TAA (Lys → Stop) in a frame that runs off the end', () => {
    const a = analyzeMutation('ATGAAACCC', { kind: 'substitution', pos: 3, base: 'T' });
    expect(a.before.stopIndex).toBe(-1);
    expect(a.effect).toBe('nonsense');
    expect(a.after.protein).toBe('M');
  });
});

describe('typed 5′/3′ orientation', () => {
  it('reads marks written with ASCII, prime and typographic apostrophes', () => {
    expect(strandDirection("5'-ATG-3'")).toBe('5to3');
    expect(strandDirection('5’-ATG-3’')).toBe('5to3');
    expect(strandDirection('3′-TAC-5′')).toBe('3to5');
    expect(strandDirection('ATG-3’')).toBe('5to3');
    expect(strandDirection('ATG')).toBeNull();
    expect(() => strandDirection("5'-ATG-5'")).toThrow();
    expect(() => strandDirection("ATG 3' TTT")).toThrow();
    expect(cleanDna('5’-ATG-3’')).toBe('ATG');
    expect(cleanDna('5‘-atg-3`')).toBe('ATG');
  });

  it('a template typed 5′→3′ is reversed before transcription', () => {
    const r = parseInput("5'-TACGGGATT-3'", 'template');
    expect(r).toEqual({ ok: true, coding: 'AATCCCGTA', reversed: true });
    if (r.ok) expect(codingToMrna(r.coding)).toBe('AAUCCCGUA');
    expect(parseInput("3'-TACGGGATT-5'", 'template')).toEqual({
      ok: true,
      coding: 'ATGCCCTAA',
      reversed: false,
    });
    expect(parseInput('TACGGGATT', 'template')).toEqual({
      ok: true,
      coding: 'ATGCCCTAA',
      reversed: false,
    });
  });

  it('a coding strand typed 3′→5′ is reversed, 5′→3′ is kept', () => {
    expect(parseInput("3'-AATCCCGTA-5'", 'coding')).toEqual({
      ok: true,
      coding: 'ATGCCCTAA',
      reversed: true,
    });
    expect(parseInput('5’-ATGCCCTAA-3’', 'coding')).toEqual({
      ok: true,
      coding: 'ATGCCCTAA',
      reversed: false,
    });
  });
});
