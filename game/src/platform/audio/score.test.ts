import { describe, expect, it } from 'vitest';
import {
  bar,
  barSeconds,
  hz,
  LAB_PIECES,
  MENU_PIECE,
  type Note,
  type Piece,
  pieceBars,
  pieceFor,
  SECTION_BARS,
  silenceAfter,
} from './score';

const ALL: readonly Piece[] = [MENU_PIECE, ...LAB_PIECES];
/** Every note of a whole playing of `piece`, with the bar it is in. */
const notesOf = (piece: Piece, play = 1) =>
  Array.from({ length: pieceBars(piece) }, (_, i) =>
    bar(piece, i, play, []).map((n) => ({ ...n, bar: i })),
  ).flat();

describe('the music, written as it plays (score.ts)', () => {
  it('a different piece as play goes on: 0, 10, 20, 35 and 55 minutes in', () => {
    expect(LAB_PIECES.map((p) => p.from)).toEqual([0, 10, 20, 35, 55]);
    expect(pieceFor(0).id).toBe('first-light');
    expect(pieceFor(9.9 * 60).id).toBe('first-light');
    expect(pieceFor(10 * 60).id).toBe('notebook');
    expect(pieceFor(25 * 60).id).toBe('afternoon-bench');
    expect(pieceFor(40 * 60).id).toBe('equilibrium');
    expect(pieceFor(3 * 3600).id).toBe('night-shift');
    // Each its own: no two share a key and a tempo; quieter and slower as the session goes on.
    const signatures = new Set(ALL.map((p) => `${p.scale.join()}@${p.bpm}`));
    expect(signatures.size).toBe(ALL.length);
    const late = LAB_PIECES.slice(2).map((p) => p.bpm);
    expect(late).toEqual([...late].sort((a, b) => b - a));
  });

  it('each piece lasts about three minutes; the labs’ are followed by half a minute to a minute of silence', () => {
    for (const piece of ALL) {
      const seconds = pieceBars(piece) * barSeconds(piece);
      expect(seconds, piece.id).toBeGreaterThan(150);
      expect(seconds, piece.id).toBeLessThan(240);
      expect(notesOf(piece).every((n) => n.at < barSeconds(piece))).toBe(true);
      expect(bar(piece, pieceBars(piece), 1, [])).toEqual([]); // nothing past its end
    }
    for (let play = 0; play < 50; play++) {
      expect(silenceAfter('lab', play)).toBeGreaterThanOrEqual(35);
      expect(silenceAfter('lab', play)).toBeLessThan(65);
    }
    expect(silenceAfter('menu', 3)).toBe(12);
  });

  it('plays its theme in its theme sections, in its key, an octave up in `high`', () => {
    for (const piece of ALL) {
      for (const [, midi] of piece.theme) expect(piece.scale, piece.id).toContain(midi % 12);
      const keys = notesOf(piece).filter((n) => n.voice === 'keys');
      const themed = piece.form.filter((s) => s === 'theme' || s === 'high').length;
      expect(keys).toHaveLength(themed * piece.theme.length);
      piece.form.forEach((section, s) => {
        const here = keys.filter((n) => Math.floor(n.bar / SECTION_BARS) === s);
        if (section === 'high')
          expect(here.map((n) => n.midi)).toEqual(piece.theme.map(([, m]) => m + 12));
        else if (section === 'theme')
          expect(here.map((n) => n.midi)).toEqual(piece.theme.map(([, m]) => m));
        else expect(here).toEqual([]);
      });
    }
  });

  it('holds each chord on the pad and the bass for two bars, softer coming in and dying away', () => {
    for (const piece of ALL) {
      const notes: Note[] = [];
      piece.chords.forEach((chord, c) => {
        bar(piece, SECTION_BARS + c * 2, 1, notes); // a theme section
        const held = notes.filter((n) => n.voice === 'pad' || n.voice === 'bass');
        expect(held.map((n) => n.midi)).toEqual([...chord]);
        expect(held.every((n) => n.seconds === 2 * barSeconds(piece))).toBe(true);
        bar(piece, SECTION_BARS + c * 2 + 1, 1, notes);
        expect(notes.some((n) => n.voice === 'pad' || n.voice === 'bass')).toBe(false);
      });
      const bassAt = (i: number) => bar(piece, i, 1, []).find((n) => n.voice === 'bass')!.velocity;
      const last = pieceBars(piece) - 2;
      expect(bassAt(0)).toBeLessThan(bassAt(SECTION_BARS));
      expect(bassAt(last)).toBeLessThan(bassAt(SECTION_BARS));
    }
  });

  it('keeps the bells to the chord, in their range, few; none in the outro', () => {
    for (const piece of ALL) {
      const notes = notesOf(piece, 3);
      const bells = notes.filter((n) => n.voice === 'bell');
      for (const b of bells) {
        const chord = piece.chords[Math.floor((b.bar % SECTION_BARS) / 2)]!;
        expect(chord.slice(1).some((m) => (b.midi - m) % 12 === 0)).toBe(true);
        expect(b.midi).toBeGreaterThanOrEqual(69);
        expect(b.midi).toBeLessThanOrEqual(88);
        expect(piece.form[Math.floor(b.bar / SECTION_BARS)]).not.toBe('outro');
      }
      expect(bells.length / pieceBars(piece)).toBeLessThan(1.5);
    }
  });

  it('plays a bar the same every time; the next playing’s bells differ', () => {
    const piece = LAB_PIECES[0]!;
    expect(bar(piece, 9, 1, [])).toEqual(bar(piece, 9, 1, []));
    const bells = (play: number) =>
      JSON.stringify(notesOf(piece, play).filter((n) => n.voice === 'bell'));
    expect(bells(1)).not.toBe(bells(2));
  });

  it('tunes A4 to 440 Hz', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880, 9);
  });
});
