/**
 * The game's music (Phú, 2026-11-05: music on the main menu and in the game, fitting its theme,
 * chill and subtle; then: louder, and a different piece as play goes on — ten minutes of one, then
 * another — memorable, the way a game's music comes to stand for the hours spent in it). Pieces,
 * each its own key, tempo and theme: slow chords on a soft pad, a low bass, a melody on soft keys,
 * a few bell notes drawn from the chord, never the same twice. The menu has its own; the labs'
 * follow the time played, with silence between them. Written here, played by `music.ts`; pure and
 * deterministic (a bar's notes come from the piece, the bar and the play's number). Original
 * melodies, written for SimLab.
 */

export type Mood = 'menu' | 'lab';
export type Voice = 'pad' | 'bell' | 'bass' | 'keys';

/** A note of a bar: when (s from the bar's start), which (MIDI), how long (s), how loud (0–1). */
export interface Note {
  at: number;
  midi: number;
  seconds: number;
  voice: Voice;
  velocity: number;
}

/**
 * A section of 8 bars (one turn of the chords): the chords alone, coming in (`intro`); the theme
 * on the keys (`theme`), once more an octave up (`high`); bells instead of the theme (`bells`);
 * the chords alone, dying away (`outro`).
 */
export type Section = 'intro' | 'theme' | 'high' | 'bells' | 'outro';

export interface Piece {
  readonly id: string;
  /** Its name, for the debug panel (a title, not shown to the player). */
  readonly title: string;
  /** Beats a minute; four beats a bar. */
  readonly bpm: number;
  /** Its key's pitch classes (0 = C): every note of its theme is in it. */
  readonly scale: readonly number[];
  /** Four chords of two bars each, low to high: the first note is the bass, the rest the pad. */
  readonly chords: readonly (readonly number[])[];
  /** Its theme over the 8 bars: [beat from the section's start, MIDI, beats]. */
  readonly theme: readonly (readonly [number, number, number])[];
  readonly form: readonly Section[];
  /** The chance a bell sounds on an eighth note (in a `bells` section twice it), and the most in a bar. */
  readonly bells: number;
  readonly bellsPerBar: number;
  /** The pad's tone (Hz), darker for the quieter pieces. */
  readonly cutoff: number;
}

const BARS_PER_CHORD = 2;
export const SECTION_BARS = 8;

const MAJOR = (root: number) => [0, 2, 4, 5, 7, 9, 11].map((i) => (root + i) % 12);
const MINOR = (root: number) => [0, 2, 3, 5, 7, 8, 10].map((i) => (root + i) % 12);

/** The main menu's: D major, warm and open — the game's own theme. */
export const MENU_PIECE: Piece = {
  id: 'simlab',
  title: 'SIMLAB',
  bpm: 70,
  scale: MAJOR(2),
  // Dmaj9 – Bm11 – Gmaj9 – A6/9
  chords: [
    [38, 50, 57, 61, 64, 66],
    [47, 54, 57, 62, 64],
    [43, 50, 54, 57, 59],
    [45, 52, 54, 59, 61],
  ],
  theme: [
    [0, 69, 1],
    [1, 74, 1],
    [2, 78, 2],
    [4, 76, 2],
    [6, 74, 1],
    [7, 73, 1],
    [8, 71, 1],
    [9, 74, 1],
    [10, 79, 2],
    [12, 78, 4],
    [16, 81, 2],
    [18, 79, 1],
    [19, 78, 1],
    [20, 76, 2],
    [22, 71, 2],
    [24, 73, 1],
    [25, 76, 1],
    [26, 81, 2],
    [28, 78, 2],
    [30, 76, 2],
  ],
  form: ['intro', 'theme', 'bells', 'theme', 'high', 'outro'],
  bells: 0.2,
  bellsPerBar: 3,
  cutoff: 1400,
};

/**
 * The labs', in the order play reaches them (`from`: minutes played). Each quieter and slower than
 * the one before, as a long session settles: curious at first, then flowing, then warm and a
 * little wistful, calm, and at last the quiet of a late shift.
 */
export const LAB_PIECES: readonly (Piece & { readonly from: number })[] = [
  {
    id: 'first-light',
    title: 'First Light',
    from: 0,
    bpm: 66,
    scale: MAJOR(2),
    // Dmaj7 – Gmaj9 – Bm7 – A6/9
    chords: [
      [38, 54, 57, 61, 64],
      [43, 54, 57, 59, 62],
      [47, 54, 57, 62, 66],
      [45, 52, 54, 59, 61],
    ],
    theme: [
      [0, 78, 2],
      [2, 81, 1],
      [3, 76, 1],
      [4, 74, 3],
      [8, 71, 1],
      [9, 74, 1],
      [10, 79, 2],
      [12, 78, 3],
      [16, 78, 1],
      [17, 76, 1],
      [18, 74, 1],
      [19, 71, 1],
      [20, 74, 2],
      [22, 69, 2],
      [24, 73, 1],
      [25, 76, 1],
      [26, 81, 2],
      [28, 76, 4],
    ],
    form: ['intro', 'theme', 'theme', 'bells', 'high', 'outro'],
    bells: 0.12,
    bellsPerBar: 2,
    cutoff: 1100,
  },
  {
    id: 'notebook',
    title: 'Notebook',
    from: 10,
    bpm: 72,
    scale: MAJOR(7),
    // Gmaj7 – Em9 – Cmaj7#11 – D6
    chords: [
      [43, 55, 59, 62, 66],
      [40, 55, 59, 62, 66],
      [36, 55, 59, 64, 66],
      [38, 54, 57, 59, 62],
    ],
    theme: [
      [0, 71, 0.5],
      [0.5, 74, 0.5],
      [1, 79, 1],
      [2, 78, 2],
      [4, 76, 1],
      [5, 74, 1],
      [6, 71, 2],
      [8, 71, 0.5],
      [8.5, 76, 0.5],
      [9, 79, 1],
      [10, 83, 2],
      [12, 78, 4],
      [16, 71, 0.5],
      [16.5, 74, 0.5],
      [17, 79, 1],
      [18, 78, 2],
      [20, 76, 1],
      [21, 79, 1],
      [22, 74, 2],
      [24, 71, 1],
      [25, 69, 1],
      [26, 66, 2],
      [28, 74, 4],
    ],
    form: ['intro', 'theme', 'bells', 'theme', 'high', 'outro'],
    bells: 0.12,
    bellsPerBar: 2,
    cutoff: 1100,
  },
  {
    id: 'afternoon-bench',
    title: 'Afternoon Bench',
    from: 20,
    bpm: 60,
    scale: MINOR(9),
    // Am9 – Fmaj7 – C/G – Em7
    chords: [
      [45, 55, 60, 64, 71],
      [41, 53, 57, 60, 64],
      [43, 52, 55, 60, 62],
      [40, 55, 59, 62, 64],
    ],
    theme: [
      [0, 76, 3],
      [3, 74, 1],
      [4, 72, 2],
      [6, 69, 2],
      [8, 77, 2],
      [10, 76, 1],
      [11, 72, 1],
      [12, 76, 4],
      [16, 79, 2],
      [18, 76, 2],
      [20, 74, 2],
      [22, 72, 1],
      [23, 74, 1],
      [24, 71, 2],
      [26, 67, 2],
      [28, 69, 4],
    ],
    form: ['intro', 'theme', 'theme', 'bells', 'theme', 'outro'],
    bells: 0.1,
    bellsPerBar: 2,
    cutoff: 950,
  },
  {
    id: 'equilibrium',
    title: 'Equilibrium',
    from: 35,
    bpm: 56,
    scale: MAJOR(5),
    // Fmaj9 – Dm9 – Bbmaj7 – C6sus
    chords: [
      [41, 57, 60, 64, 67],
      [38, 53, 57, 60, 64],
      [46, 53, 57, 62, 65],
      [36, 53, 55, 57, 62],
    ],
    theme: [
      [0, 81, 2],
      [2, 79, 2],
      [4, 72, 4],
      [8, 77, 1],
      [9, 79, 1],
      [10, 81, 2],
      [12, 76, 4],
      [16, 74, 2],
      [18, 77, 2],
      [20, 69, 4],
      [24, 70, 2],
      [26, 72, 1],
      [27, 74, 1],
      [28, 72, 4],
    ],
    form: ['intro', 'theme', 'bells', 'theme', 'outro'],
    bells: 0.09,
    bellsPerBar: 2,
    cutoff: 900,
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    from: 55,
    bpm: 50,
    scale: MAJOR(1),
    // Dbmaj9 – Bbm11 – Gbmaj7 – Ab6
    chords: [
      [37, 53, 56, 60, 63],
      [46, 53, 56, 61, 63],
      [42, 53, 58, 61, 65],
      [44, 53, 56, 60, 63],
    ],
    theme: [
      [0, 77, 2],
      [2, 75, 1],
      [3, 73, 1],
      [4, 68, 4],
      [8, 70, 1],
      [9, 73, 1],
      [10, 77, 2],
      [12, 75, 4],
      [16, 77, 1],
      [17, 80, 1],
      [18, 78, 2],
      [20, 77, 2],
      [22, 73, 2],
      [24, 75, 2],
      [26, 72, 2],
      [28, 73, 4],
    ],
    form: ['intro', 'theme', 'bells', 'theme', 'outro'],
    bells: 0.08,
    bellsPerBar: 1,
    cutoff: 800,
  },
];

/** The lab piece for `seconds` of play: the last one whose time has come. */
export function pieceFor(seconds: number): Piece {
  let pick: Piece = MENU_PIECE; // never: the first lab piece is from 0
  for (const piece of LAB_PIECES) if (seconds >= piece.from * 60) pick = piece;
  return pick;
}

/** Silence after a piece (s): the menu's short, the labs' longer, a little different each time. */
export function silenceAfter(mood: Mood, play: number): number {
  return mood === 'menu' ? 12 : 35 + 30 * hash(play, 7);
}

/** The bells' range (MIDI): above the pad, below piercing. */
const BELL_LOW = 69;
const BELL_HIGH = 88;

/** Seconds a bar of `piece` lasts. */
export const barSeconds = (piece: Piece): number => (4 * 60) / piece.bpm;

/** Bars in `piece`. */
export const pieceBars = (piece: Piece): number => piece.form.length * SECTION_BARS;

/** Hz of a MIDI note (A4 = 69 = 440 Hz). */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** A number in [0, 1) from integers: the same bar always plays the same notes. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * The notes of bar `index` of `piece`, in its `play`-th playing, into `out` (cleared first; none
 * past the piece's end). A chord's first bar holds its pad and bass for the chord's length; a
 * theme section's bars play their part of the theme; bells, chord tones lifted into their range,
 * fall on eighth notes, fewer under the theme and none in the intro's first bars or the outro.
 */
export function bar(piece: Piece, index: number, play: number, out: Note[]): Note[] {
  out.length = 0;
  const section = piece.form[Math.floor(index / SECTION_BARS)];
  if (section === undefined) return out;
  const length = barSeconds(piece);
  const beat = length / 4;
  const inSection = index % SECTION_BARS;
  const chord = piece.chords[Math.floor(inSection / BARS_PER_CHORD)] ?? [];
  const bass = chord[0];
  const pad = chord.slice(1);
  // The intro comes in and the outro dies away: softer at the ends.
  const swell =
    section === 'intro'
      ? 0.55 + (0.45 * inSection) / 7
      : section === 'outro'
        ? 1 - inSection / 9
        : 1;
  if (inSection % BARS_PER_CHORD === 0 && bass !== undefined) {
    const seconds = length * BARS_PER_CHORD;
    out.push({ at: 0, midi: bass, seconds, voice: 'bass', velocity: 0.8 * swell });
    pad.forEach((midi, i) =>
      out.push({ at: i * 0.06, midi, seconds, voice: 'pad', velocity: (0.7 - i * 0.05) * swell }),
    );
  }
  if (section === 'theme' || section === 'high') {
    const lift = section === 'high' ? 12 : 0;
    const from = inSection * 4;
    for (const [at, midi, beats] of piece.theme) {
      if (at < from || at >= from + 4) continue;
      // A little life: each note's touch a shade different, the bar's first a little firmer.
      const touch =
        0.62 + 0.18 * hash(index * 31 + play, Math.round(at * 2)) + (at === from ? 0.08 : 0);
      out.push({
        at: (at - from) * beat,
        midi: midi + lift,
        seconds: Math.max(beats * beat, 0.6),
        voice: 'keys',
        velocity: Math.min(touch, 0.9),
      });
    }
  }
  if (section === 'outro' || (section === 'intro' && inSection < 2)) return out;
  const chance =
    section === 'bells' ? piece.bells * 2 : section === 'intro' ? piece.bells : piece.bells / 2;
  const most = section === 'bells' ? piece.bellsPerBar + 1 : piece.bellsPerBar;
  const tones = bellTones(pad);
  const eighth = length / 8;
  let bells = 0;
  for (let slot = 0; slot < 7 && bells < most; slot++) {
    if (hash(index + play * 977, slot) >= chance) continue;
    const pick = tones[Math.floor(hash(index + play * 977, slot + 100) * tones.length)];
    if (pick === undefined) continue;
    const velocity = 0.35 + 0.45 * hash(index + play * 977, slot + 200);
    out.push({
      at: slot * eighth,
      midi: pick,
      seconds: 2.4,
      voice: 'bell',
      velocity: velocity * swell,
    });
    bells++;
  }
  return out;
}

/** The chord's tones lifted by octaves into the bells' range. */
function bellTones(pad: readonly number[]): number[] {
  const tones: number[] = [];
  for (const midi of pad) {
    for (let m = midi; m <= BELL_HIGH; m += 12) if (m >= BELL_LOW) tones.push(m);
  }
  return tones;
}
