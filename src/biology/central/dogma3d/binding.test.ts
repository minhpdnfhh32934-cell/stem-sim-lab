import { describe, expect, it } from 'vitest';
import { GENETIC_CODE, anticodon, codingToMrna, complement, translate } from '../dogma';
import { parseInput } from '../state';
import {
  STEP,
  chainAfterStep,
  chainAt,
  chainNewest,
  codonAt,
  dogmaClock,
  dogmaModel3d,
  keyTime,
  momentAt,
  mrnaAt,
  rungAt,
  stepAt,
  stepMoments,
  syncedTime,
  windowFor,
} from './binding';

/** The lesson's default input (coding strand typed 5′→3′ with a leading TAC). */
const INPUT = 'TAC ATGGCTTTCAAAGGCTGGTAA GC';
const parsed = parseInput(INPUT, 'coding');
const CODING = parsed.ok ? parsed.coding : '';

describe('3D dogma binding: every base, codon and amino acid from the lesson’s model', () => {
  const m = dogmaModel3d(CODING);

  it('one rung per base pair of the coding strand; rung i pairs coding[i] with its complement', () => {
    expect(CODING).toBe('TACATGGCTTTCAAAGGCTGGTAAGC');
    expect(m.coding.length).toBe(CODING.length);
    const tpl = complement(CODING);
    for (let i = 0; i < CODING.length; i++) {
      expect(rungAt(m, i)).toEqual({ base: CODING[i], pair: tpl[i] });
      const pair = `${CODING[i] ?? ''}${tpl[i] ?? ''}`;
      expect(['AT', 'TA', 'GC', 'CG']).toContain(pair);
    }
  });

  it('the template strand typed instead gives the same coding strand and rungs', () => {
    const t = parseInput(`3'-${complement(CODING)}-5'`, 'template');
    expect(t.ok && t.coding).toBe(CODING);
  });

  it('the mRNA at transcription position k is the first k bases of codingToMrna (U for T)', () => {
    const full = codingToMrna(CODING);
    for (let k = 0; k <= full.length; k++) expect(mrnaAt(m, k)).toBe(full.slice(0, k));
    expect(mrnaAt(m, full.length)).not.toContain('T');
    // The clock reaches every position in order.
    const c = dogmaClock(m);
    let last = -1;
    for (let t = 0; t < c.txEnd; t += c.perBase / 3) {
      const mo = momentAt(c, t);
      expect(mo.phase).toBe('transcription');
      expect(mo.made).toBeGreaterThanOrEqual(last);
      last = mo.made;
    }
    expect(momentAt(c, c.txEnd).made).toBe(full.length);
  });

  it('translation starts at the first AUG; codons and amino acids are the standard code’s', () => {
    const t = translate(codingToMrna(CODING));
    expect(m.t.start).toBe(codingToMrna(CODING).indexOf('AUG'));
    expect(m.t.start).toBe(3);
    expect(m.t.codons.map((c) => c.codon)).toEqual(t.codons.map((c) => c.codon));
    for (const c of m.t.codons) {
      const entry = GENETIC_CODE.find((e) => e.codon === c.codon);
      expect(c.entry).toEqual(entry);
      for (let k = 0; k < 3; k++) expect(codonAt(m, c.pos + k)?.index).toBe(c.index);
    }
    // Bases before the AUG and after the stop codon belong to no codon.
    expect(codonAt(m, 0)).toBeNull();
    expect(codonAt(m, CODING.length - 1)).toBeNull();
  });

  it('anticodons pair base by base with their codons (A–U, G–C)', () => {
    const pair: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };
    for (const e of GENETIC_CODE) {
      const a = anticodon(e.codon);
      expect(a).toHaveLength(3);
      for (let k = 0; k < 3; k++) expect(pair[e.codon[k] ?? '']).toBe(a[k]);
      expect(anticodon(a)).toBe(e.codon);
    }
    expect(anticodon('AUG')).toBe('UAC');
  });

  it('the chain after step s holds the amino acids of codons 0 … s, never a bead for the stop codon', () => {
    const c = dogmaClock(m);
    expect(c.steps).toBe(m.t.codons.length);
    for (let s = 0; s < c.steps; s++) {
      const mo = momentAt(c, keyTime(c, s));
      expect(mo.phase).toBe('translation');
      expect(mo.step).toBe(s);
      const expected = m.t.codons.slice(0, s + 1).filter((x) => !x.entry?.stop);
      expect(chainAt(m, mo)).toEqual(expected.map((x) => x.index));
      expect(chainAfterStep(m, s)).toEqual(expected);
      expect(chainNewest(m, mo) + 1).toBe(expected.length);
    }
    // Met–Ala–Phe–Lys–Gly–Trp, then the stop codon adds nothing.
    const end = momentAt(c, c.total);
    expect(chainAt(m, end).map((i) => m.t.codons[i]?.entry?.three)).toEqual([
      'Met',
      'Ala',
      'Phe',
      'Lys',
      'Gly',
      'Trp',
    ]);
    // Before its tRNA has arrived, a codon's amino acid is not in the chain yet.
    const early = momentAt(c, c.tlStart + (2 + STEP.MOVE) * c.perCodon);
    expect(chainAt(m, early)).toEqual([0, 1]);
  });

  it('3D ↔ 2D keep the step: key times map back to their step; a matching 3D time is kept', () => {
    const c = dogmaClock(m);
    for (let s = 0; s < c.steps; s++) {
      expect(stepAt(c, keyTime(c, s))).toBe(s);
      expect(syncedTime(c, 0, s)).toBe(s === 0 ? 0 : keyTime(c, s));
      expect(syncedTime(c, keyTime(c, s), s)).toBe(keyTime(c, s));
    }
    // During transcription the 2D page stays on the first codon.
    expect(stepAt(c, c.txEnd / 2)).toBe(0);
    expect(syncedTime(c, c.txEnd / 2, 0)).toBe(c.txEnd / 2);
    expect(syncedTime(c, c.txEnd / 2, 3)).toBe(keyTime(c, 3));
    // Step buttons: start, finished mRNA, then each codon.
    expect(stepMoments(c)).toEqual([0, c.tlStart, ...m.t.codons.map((_, s) => keyTime(c, s))]);
  });

  it('without an AUG there is no translation and the clock ends after transcription', () => {
    const none = dogmaModel3d('TTTCCCGGG');
    const c = dogmaClock(none);
    expect(c.steps).toBe(0);
    expect(c.total).toBe(c.tlStart);
    expect(momentAt(c, c.total).phase).toBe('release');
    expect(chainAt(none, momentAt(c, c.total))).toEqual([]);
    expect(syncedTime(c, 1, 0)).toBe(1);
  });
});

describe('window of base pairs drawn for long sequences', () => {
  it('keeps the active index visible, with absolute indices, at most `max` wide', () => {
    for (const [n, max] of [
      [300, 600],
      [1000, 600],
      [5000, 1500],
      [1000, 37],
    ] as const) {
      for (let a = 0; a < n; a += 7) {
        const w = windowFor(n, a, max);
        expect(w.from).toBeGreaterThanOrEqual(0);
        expect(w.to).toBeLessThanOrEqual(n);
        expect(w.to - w.from).toBe(Math.min(n, max));
        expect(a).toBeGreaterThanOrEqual(w.from);
        expect(a).toBeLessThan(w.to);
      }
    }
    expect(windowFor(300, 150, 600)).toEqual({ from: 0, to: 300 });
    // Indices stay the model's own: position 801 is index 800 wherever the window is.
    const w = windowFor(1000, 800, 600);
    expect(w.from).toBeGreaterThan(0);
    expect(w.to).toBe(1000);
  });

  it('moves in jumps, not every base (the scene re-lays it rarely)', () => {
    let moves = 0;
    let last = windowFor(5000, 0, 600).from;
    for (let a = 0; a < 5000; a++) {
      const f = windowFor(5000, a, 600).from;
      if (f !== last) moves++;
      last = f;
    }
    expect(moves).toBeLessThan(5000 / 100);
  });
});
