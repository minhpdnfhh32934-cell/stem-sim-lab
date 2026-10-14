/**
 * Plays an AI Teacher answer on the whiteboard (PROMPT_PHAN_2 B8): sentence by sentence, the
 * teacher speaks while the pen writes; the voice never races the pen (the next sentence waits
 * for both). Marks (underline, circle, box, highlight, arrows) are drawn when their tag comes.
 * Every number written is checked for provenance (provenance.ts).
 *
 * Each lesson run (a lesson, "Giảng lại", the new part of "Viết tiếp") owns the board while it is
 * the current run: its pen carries its face and run id, and a run that was stopped or replaced
 * can no longer write anything (`patch`). The learner may look at another face than the one the
 * teacher writes on (`showFace`, which pauses); the view follows the teacher only while `follow`.
 */
import {
  newVoiceSession,
  speak,
  stopSpeaking,
  toSpokenText,
  type SpeakOptions,
  type VoiceSession,
} from '@/teacher/voice/speak';
import type { SpeechRole } from '@/teacher/voice/speechPlan';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { cleanAnswer, type CleanOptions } from '@/teacher/chat/answerClean';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { markdownToScript } from './fromMarkdown';
import {
  emptyLayout,
  findElement,
  place,
  spanBox,
  type BoardElement,
  type Measure,
  type TextElement,
} from './layout';
import { useBoardStore, type BoardMark, type BoardPatch } from './boardStore';
import { checkNumbers, sourceNumbers } from './provenance';
import { seedOf } from './rough';
import {
  parseTeachScript,
  type BoardAction,
  type ParsedScript,
  type Sentence,
} from './teachscript';

export interface LessonInput {
  id: string;
  /** The AI's answer: TeachScript, or plain markdown (laid out automatically). */
  content: string;
  /** The learner's question (numbers in it count as given). */
  question: string;
  /** The model that answered (shown in the AI label). */
  model?: string;
  /**
   * Written by the Think reviewer (the record has `checkedBy`): its notes about the draft go,
   * unless the question was about the learner's own draft (answerClean.ts).
   */
  reviewed?: boolean;
}

/**
 * TeachScript when the answer has board tags, else the markdown layout. The answer is cleaned
 * first (answerClean.ts): new answers already are, answers saved by an older version may still
 * hold hidden reasoning or echoed prompt labels.
 */
export function scriptFor(content: string, options: CleanOptions = {}): ParsedScript {
  const clean = cleanAnswer(content, options).text;
  const parsed = parseTeachScript(clean);
  return parsed.hasBoard ? parsed : markdownToScript(clean);
}

/** Plain text of an answer for the chat history (cleaned, tags removed, board writing kept). */
export function boardAnswerText(content: string, options: CleanOptions = {}): string {
  const clean = cleanAnswer(content, options).text;
  const parsed = parseTeachScript(clean);
  if (!parsed.hasBoard) return clean;
  return parsed.sentences
    .map((s) => {
      const written = s.actions
        .map((a) => a.action)
        .filter((a): a is Extract<BoardAction, { kind: 'write' }> => a.kind === 'write')
        .map((a) => (a.math ? `$$${a.text}$$` : a.role === 'heading' ? `**${a.text}**` : a.text));
      return [s.speech, ...written].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
};

/** Subtitle: the spoken sentence with markdown and LaTeX turned into readable text. */
export function subtitleText(speech: string): string {
  return speech
    .replace(/\$\$?([^$]+)\$\$?/g, (_m, tex: string) =>
      tex
        .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
        .replace(/\\(cdot|times)/g, '·')
        .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
        .replace(/\\text\{([^{}]*)\}/g, '$1')
        // "2H_2 + O_2 \\rightarrow 2H_2O" → "2H₂ + O₂ → 2H₂O"; "m/s^2" → "m/s²"; "\\ " → space.
        .replace(/\\(?:long)?rightarrow\b|\\to\b/g, '→')
        .replace(/\\(?:rightleftharpoons|leftrightarrow)\b/g, '⇌')
        .replace(/\\[ ,;:!]/g, ' ')
        // As LaTeX reads them: without braces one character ("a^2+b^2" → "a²+b²"); a braced
        // group only when it is all digits/signs ("10^{-3}" → "10⁻³"), else kept readable
        // ("e^{-kt}" → "e^(-kt)", "x_{2n}" → "x_(2n)", "V_{max}" → "V_max").
        .replace(/\^\{?\\circ\}?/g, '°')
        .replace(/_(?:\{(\d+)\}|(\d))/g, (_s, a?: string, b?: string) =>
          Array.from(a ?? b ?? '', (c) => SUBSCRIPT[Number(c)] ?? c).join(''),
        )
        .replace(/_\{([^{}]*)\}/g, (_s, g: string) => (/^[A-Za-z]+$/.test(g) ? `_${g}` : `_(${g})`))
        .replace(/\^(?:\{([0-9+\-−]+)\}|([0-9+\-−]))/g, (_s, a?: string, b?: string) =>
          Array.from(a ?? b ?? '', (c) => SUPERSCRIPT[c] ?? c).join(''),
        )
        .replace(/\^\{([^{}]*)\}/g, (_s, g: string) => (g.length === 1 ? `^${g}` : `^(${g})`))
        .replace(/\\([a-zA-Z]+)/g, '$1')
        .replace(/[{}]/g, ''),
    )
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT_MS = { slow: 82, normal: 52, fast: 34 } as const;

interface Gate {
  promise: Promise<void>;
  open: () => void;
}

/**
 * One lesson run: a lesson, a "Giảng lại", or the new part of a "Viết tiếp". Everything a run
 * writes on the board goes through `patch`, which refuses once the run is no longer the current
 * one, so a late step of an old run can never write on a newer lesson or move its pen or view.
 */
interface Run {
  id: number;
  ctrl: AbortController;
  /** Set while paused; "Tiếp tục" opens it. */
  gate: Gate | null;
  /** "Viết nhanh": everything left is written at once, without the voice. */
  instant: boolean;
  /** A pause cut the sentence being spoken: it is read again after "Tiếp tục" (BRD-02). */
  speechCut: boolean;
  /**
   * The AI's element ids → the ids this run placed. A continuation's "s1" is placed as "s1_2"
   * (layout.freeId): its marks must land on it, never on the older "s1" of the first part.
   */
  ids: Map<string, string>;
}

let current: Run | null = null;
let runs = 0;
let lastInput: LessonInput | null = null;
let lastMeasure: Measure | null = null;
/** The lesson's voice: once the chosen voice failed for good, its later sentences do not wait. */
let voiceSession: VoiceSession = newVoiceSession();

class Stopped extends Error {}

const board = () => useBoardStore.getState();

/** The run still owns the board: not stopped, not replaced by a newer run. */
const alive = (r: Run): boolean => current === r && !r.ctrl.signal.aborted;
/** Read through functions: a pause or "Viết nhanh" changes these while the run awaits. */
const isInstant = (r: Run): boolean => r.instant;
const wasCut = (r: Run): boolean => r.speechCut;

function ensure(r: Run): void {
  if (!alive(r)) throw new Stopped();
}

/** Every write of a run to the board goes through here. */
function patch(r: Run, p: BoardPatch): void {
  ensure(r);
  board().set(p);
}

function progressTo(r: Run, id: string, value: number): void {
  patch(r, { progress: { ...board().progress, [id]: value } });
}

function showMark(r: Run, key: string): void {
  patch(r, { marks: board().marks.map((m) => (m.key === key ? { ...m, shown: true } : m)) });
}

/** Waits `ms`; rejects at once when the run is over (and when it ends while waiting). */
function sleep(ms: number, r: Run): Promise<void> {
  if (!alive(r)) return Promise.reject(new Stopped());
  if (r.instant || ms <= 0) return Promise.resolve();
  const signal = r.ctrl.signal;
  return new Promise((resolve, reject) => {
    const t = setTimeout(done, ms);
    function done() {
      signal.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
      reject(new Stopped());
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Holds the run while the lesson is paused, again if a new pause starts meanwhile. */
async function waitIfPaused(r: Run): Promise<void> {
  ensure(r);
  while (r.gate) {
    await r.gate.promise;
    ensure(r);
  }
}

interface Point {
  x: number;
  y: number;
}

/**
 * The teacher goes to an element (to write, mark, point at or erase it). The pen goes with the
 * teacher; the view follows only while the learner follows the teacher.
 */
function moveTo(r: Run, e: BoardElement, at: Point): void {
  patch(r, {
    focus: e.id,
    teacherFace: e.face,
    pen: { run: r.id, face: e.face, x: at.x, y: at.y },
    ...(board().follow ? { face: e.face } : {}),
  });
}

/** Where the pen is after `units` of an element (board units, approximate). */
function penAt(e: TextElement, units: number): Point {
  let left = units;
  for (const line of e.lines) {
    let x = 0;
    for (const t of line.tokens) {
      x += t.space;
      const size = t.kind === 'math' ? 1 : t.value.length + 1;
      if (left <= size) {
        const frac = Math.max(0, Math.min(1, left / size));
        return { x: e.x + x + t.w * frac, y: e.y + line.y + line.h * 0.8 };
      }
      left -= size;
      x += t.w;
    }
  }
  const last = e.lines[e.lines.length - 1];
  return { x: e.x + (last?.w ?? e.w), y: e.y + (last ? last.y + last.h * 0.8 : e.h) };
}

/** Writes one text element, letter by letter, with the pen tip following. */
async function writeElement(e: TextElement, r: Run): Promise<void> {
  // A pause that came while the step before was finishing keeps the teacher where they are.
  await waitIfPaused(r);
  moveTo(r, e, penAt(e, 0));
  if (r.instant) {
    progressTo(r, e.id, e.length);
    return;
  }
  const unit = UNIT_MS[e.speed];
  const penTo = (value: number) => {
    const at = penAt(e, value);
    patch(r, {
      progress: { ...board().progress, [e.id]: value },
      pen: { run: r.id, face: e.face, x: at.x, y: at.y },
    });
  };
  let done = 0;
  for (const line of e.lines) {
    for (const t of line.tokens) {
      if (t.kind === 'math') {
        // A formula is revealed left to right in small steps.
        const steps = 10;
        const total = 380 + t.w * 1.6;
        for (let k = 1; k <= steps; k++) {
          await waitIfPaused(r);
          penTo(done + k / steps);
          await sleep(total / steps / board().speed, r);
        }
        done += 1;
        continue;
      }
      for (let c = 0; c <= t.value.length; c++) {
        await waitIfPaused(r);
        done += 1;
        penTo(done);
        // Irregular rhythm: a short stop between words, quicker in the middle of a word.
        const ms = c === t.value.length ? unit * 2.4 : unit * (0.75 + ((c * 37) % 10) / 20);
        await sleep(ms / board().speed, r);
      }
    }
  }
  progressTo(r, e.id, e.length);
}

function addMark(r: Run, mark: Omit<BoardMark, 'shown' | 'key'>): string {
  const marks = board().marks;
  const key = `${mark.kind}-${String(marks.length)}`;
  patch(r, { marks: [...marks, { ...mark, key, shown: r.instant }] });
  return key;
}

interface LessonCtx {
  r: Run;
  measure: Measure;
  sources: number[];
  known: number[];
}

async function runAction(action: BoardAction, ctx: LessonCtx): Promise<void> {
  const { measure, r } = ctx;
  /** The element the AI names: the one this run placed under that id, else the newest with it. */
  const target = (id: string): BoardElement | undefined =>
    findElement(board().layout, r.ids.get(id) ?? id);
  /** Places an action on the board's current layout at once (nothing awaited in between). */
  const placeNow = (a: BoardAction) => {
    ensure(r);
    const layout = board().layout;
    return { layout, element: place(layout, a, measure).element };
  };
  switch (action.kind) {
    case 'write':
    case 'correct': {
      const old = action.kind === 'correct' ? target(action.target) : undefined;
      if (action.kind === 'correct' && !old) return;
      if (old) {
        // The teacher walks to the wrong line and strikes it out first.
        moveTo(r, old, { x: old.x + old.w, y: old.y + old.h / 2 });
        const key = addMark(r, { kind: 'strike', face: old.face, box: old, seed: seedOf(old.id) });
        await sleep(80, r);
        await waitIfPaused(r);
        showMark(r, key);
        await sleep(450, r);
        await waitIfPaused(r);
      }
      const resolved: BoardAction =
        action.kind === 'correct'
          ? { ...action, target: old?.id ?? action.target }
          : action.noteFor
            ? { ...action, noteFor: r.ids.get(action.noteFor) ?? action.noteFor }
            : action;
      const { layout, element } = placeNow(resolved);
      if (!element || element.kind !== 'text') return;
      if (action.kind === 'write') r.ids.set(action.id, element.id);
      const prov = checkNumbers(element.source, ctx.sources, ctx.known);
      ctx.known.push(...prov.results);
      patch(r, {
        layout: { ...layout },
        provenance: { ...board().provenance, [element.id]: prov },
        progress: { ...board().progress, [element.id]: 0 },
      });
      await writeElement(element, r);
      return;
    }
    case 'mark': {
      const e = target(action.target);
      if (!e) return;
      const box = spanBox(e, action.span, measure);
      moveTo(r, e, { x: box.x + box.w, y: box.y + box.h });
      const key = addMark(r, {
        kind: action.mark,
        face: e.face,
        box,
        seed: seedOf(`${e.id}${action.mark}`),
      });
      await sleep(60, r);
      await waitIfPaused(r);
      showMark(r, key);
      await sleep(650, r);
      return;
    }
    case 'arrow': {
      const a = target(action.from);
      const b = target(action.to);
      if (!a || !b || a.face !== b.face) return;
      moveTo(r, b, { x: b.x, y: b.y + b.h / 2 });
      const key = addMark(r, {
        kind: 'arrow',
        face: a.face,
        box: a,
        to: b,
        ...(action.label ? { label: action.label } : {}),
        seed: seedOf(`${a.id}>${b.id}`),
      });
      await sleep(60, r);
      await waitIfPaused(r);
      showMark(r, key);
      await sleep(750, r);
      return;
    }
    case 'point': {
      const e = target(action.target);
      if (!e) return;
      moveTo(r, e, { x: e.x + e.w + 12, y: e.y + e.h / 2 });
      await sleep(600, r);
      return;
    }
    case 'erase': {
      const e = target(action.target);
      if (!e) return;
      moveTo(r, e, { x: e.x + e.w / 2, y: e.y + e.h / 2 });
      patch(r, { erased: { ...board().erased, [e.id]: true } });
      await sleep(450, r);
      return;
    }
    case 'newboard': {
      const { layout, element } = placeNow(action);
      const n = layout.faces.length - 1;
      patch(r, {
        layout: { ...layout },
        teacherFace: n,
        pen: null,
        ...(board().follow ? { face: n } : {}),
        ...(element ? { progress: { ...board().progress, [element.id]: 0 } } : {}),
      });
      await sleep(350, r);
      if (element?.kind === 'text') await writeElement(element, r);
      return;
    }
    case 'draw':
    case 'plot': {
      const { layout, element } = placeNow(action);
      if (!element) return;
      r.ids.set(action.id, element.id);
      patch(r, { layout: { ...layout }, progress: { ...board().progress, [element.id]: 1 } });
      moveTo(r, element, { x: element.x + element.w / 2, y: element.y + element.h / 2 });
      await sleep(1400, r);
      return;
    }
  }
}

/** What the voice needs to know about a sentence: its role on the board and its key terms. */
export interface VoiceCue {
  role?: SpeechRole;
  emphasis: string[];
}

/**
 * The sentence's role from what it writes (a heading, a result, a side note, a step) and its key
 * terms (keywords written, words underlined, circled, boxed or highlighted). Without a board role
 * the voice guesses from the words (a question, feedback…).
 */
export function voiceCue(sentence: Sentence): VoiceCue {
  const writes = sentence.actions
    .map((a) => a.action)
    .filter((a): a is Extract<BoardAction, { kind: 'write' }> => a.kind === 'write');
  const has = (role: string) => writes.some((w) => w.role === role);
  const role: SpeechRole | undefined = has('heading')
    ? 'heading'
    : has('result')
      ? 'result'
      : writes.length > 0 && writes.every((w) => w.role === 'note')
        ? 'note'
        : writes.some((w) => w.zone === 'steps')
          ? 'step'
          : undefined;
  const marked = sentence.actions
    .map((a) => a.action)
    .flatMap((a) => (a.kind === 'mark' && a.span ? [a.span] : []));
  const keywords = writes.filter((w) => w.role === 'keyword' && !w.math).map((w) => w.text);
  const emphasis = [...new Set([...keywords, ...marked])]
    .map((t) => t.trim())
    .filter((t) => t && !t.includes('$'))
    .slice(0, 4);
  return { ...(role ? { role } : {}), emphasis };
}

function readingTime(text: string): number {
  return Math.min(4200, Math.max(700, text.length * 42));
}

/**
 * Speaks a sentence, again from its start when a pause cut it (audit BRD-02): the learner never
 * loses the end of a sentence. The board's speed (0,75–2×) also sets the voice's pace (BRD-03).
 */
async function speakSentence(
  text: string,
  cue: VoiceCue,
  r: Run,
  entry: SentenceTiming,
): Promise<void> {
  for (;;) {
    r.speechCut = false;
    const begin = performance.now();
    if (metrics) metrics.firstSpeechMs ??= Math.round(begin - metrics.startedAt);
    const opts: SpeakOptions = {
      rate: board().speed,
      session: voiceSession,
      emphasis: cue.emphasis,
      ...(cue.role ? { role: cue.role } : {}),
    };
    await speak(text, opts);
    entry.speechMs = (entry.speechMs ?? 0) + Math.round(performance.now() - begin);
    // Never throws: when the pen stops first (a stop during the pause), nobody awaits this
    // promise any more, and a rejection here would be unhandled.
    if (!wasCut(r) || !alive(r) || isInstant(r)) return;
    while (r.gate) await r.gate.promise;
    if (!alive(r) || isInstant(r)) return;
  }
}

async function playSentence(sentence: Sentence, ctx: LessonCtx): Promise<void> {
  const { r } = ctx;
  await waitIfPaused(r);
  // What is said and shown includes what is being written (audit BRD-01).
  const said = sentence.spoken || sentence.speech;
  patch(r, { subtitle: subtitleText(said) });
  const voice = !r.instant && useVoiceStore.getState().enabled && said.trim() !== '';
  const entry: SentenceTiming = { speechMs: null, writingMs: 0 };
  metrics?.sentences.push(entry);
  const speech = voice ? speakSentence(said, voiceCue(sentence), r, entry) : Promise.resolve();
  const started = performance.now();
  for (const { action } of sentence.actions) {
    await waitIfPaused(r);
    await runAction(action, ctx);
  }
  entry.writingMs = Math.round(performance.now() - started);
  await speech;
  ensure(r);
  if (!voice && !isInstant(r)) {
    // Without a voice the learner reads the subtitle: give them the time to.
    const left = readingTime(toSpokenText(said)) - (performance.now() - started);
    await sleep(left / board().speed, r);
  }
  await sleep(sentence.pauseMs + 220, r);
}

/**
 * Timing of the current lesson, kept on this computer only (audit G3 measurement): when the first
 * word was heard, and for each sentence how long the voice and the pen took.
 */
export interface SentenceTiming {
  /** Time the voice spoke (null without voice); a sentence read again after a pause adds up. */
  speechMs: number | null;
  writingMs: number;
}

export interface LessonMetrics {
  startedAt: number;
  firstSpeechMs: number | null;
  sentences: SentenceTiming[];
}

let metrics: LessonMetrics | null = null;

/** The timing of the lesson being taught (or the last one), for tests and diagnostics. */
export function lessonMetrics(): LessonMetrics | null {
  return metrics;
}

/** Results proved so far in the current lesson (a continuation may use them). */
let lessonKnown: number[] = [];

/** Ends the current run: its waiting steps stop, and a pause it waits on opens (to stop it). */
function endRun(): void {
  const r = current;
  current = null;
  if (!r) return;
  r.ctrl.abort();
  const g = r.gate;
  r.gate = null;
  g?.open();
}

async function run(script: ParsedScript, input: LessonInput, measure: Measure): Promise<void> {
  endRun();
  runs += 1;
  const r: Run = {
    id: runs,
    ctrl: new AbortController(),
    gate: null,
    instant: false,
    speechCut: false,
    ids: new Map(),
  };
  current = r;
  lastInput = input;
  lastMeasure = measure;
  board().set({ lessonId: input.id, status: 'playing', run: r.id });
  const ctx: LessonCtx = {
    r,
    measure,
    sources: sourceNumbers(input.question),
    known: lessonKnown,
  };
  try {
    for (const sentence of script.sentences) await playSentence(sentence, ctx);
    patch(r, { status: 'done', pen: null, subtitle: '' });
  } catch (e) {
    if (!(e instanceof Stopped)) throw e;
  } finally {
    if (current === r) current = null;
  }
}

/** Starts (or restarts) a lesson on a clean board. */
export async function playLesson(input: LessonInput, measure: Measure): Promise<void> {
  stopLesson();
  lessonKnown = [];
  // A new lesson (or "Giảng lại") tries the chosen voice again; "Viết tiếp" keeps the session.
  voiceSession = newVoiceSession();
  metrics = { startedAt: performance.now(), firstSpeechMs: null, sentences: [] };
  board().set({
    layout: emptyLayout(),
    progress: {},
    erased: {},
    provenance: {},
    marks: [],
    face: 0,
    teacherFace: 0,
    follow: true,
    focus: null,
    pen: null,
    subtitle: '',
    strokes: [],
  });
  await run(
    scriptFor(input.content, { reviewed: input.reviewed === true, question: input.question }),
    input,
    measure,
  );
}

/**
 * "Viết tiếp": the same answer grew (the AI was asked for the rest). Only the new part is
 * taught, on the same board, after what is already written; anything else starts over.
 */
export async function continueLesson(input: LessonInput, measure: Measure): Promise<void> {
  const previous = lastInput;
  if (!previous || previous.id !== input.id || !input.content.startsWith(previous.content)) {
    await playLesson(input, measure);
    return;
  }
  // Whatever was still being written is finished at once before the new part starts. A pause
  // ends too: the new part must not wait on the old run's gate (the board would freeze).
  endRun();
  stopSpeaking();
  const store = board();
  const progress = { ...store.progress };
  for (const e of store.layout.elements) progress[e.id] = e.kind === 'text' ? e.length : 1;
  // The new part is written where the teacher is, in view.
  store.set({
    progress,
    marks: store.marks.map((m) => ({ ...m, shown: true })),
    follow: true,
    face: store.teacherFace,
    pen: null,
  });
  // The rest comes from "Viết tiếp", which is never reviewed: a reviewer's notes could only
  // stand at the start of the whole answer.
  await run(scriptFor(input.content.slice(previous.content.length)), input, measure);
}

export function pauseLesson(): void {
  const r = current;
  if (!r || r.gate || !alive(r)) return;
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  r.gate = { promise, open };
  // The sentence being spoken is cut here and read again on "Tiếp tục" (audit BRD-02).
  if (useVoiceStore.getState().speaking) r.speechCut = true;
  stopSpeaking();
  board().set({ status: 'paused' });
}

/** "Tiếp tục": the view goes back to the face the teacher writes on, and the lesson goes on. */
export function resumeLesson(): void {
  const r = current;
  const g = r?.gate;
  if (!r || !g) return;
  r.gate = null;
  const store = board();
  store.set({ status: 'playing', follow: true, face: store.teacherFace });
  g.open();
}

/** Writes everything that is left at once (no animation, no voice), in view. */
export function finishNow(): void {
  const r = current;
  if (!r) return;
  r.instant = true;
  r.speechCut = false;
  stopSpeaking();
  if (r.gate) {
    resumeLesson();
    return;
  }
  const store = board();
  store.set({ follow: true, face: store.teacherFace });
}

/**
 * The learner opens a face ("Bảng 1, Bảng 2…"). Looking at another face than the one the teacher
 * writes on pauses the lesson: the voice never talks about writing the learner cannot see, and
 * the teacher's pen is not drawn there. Coming back does not resume by itself (no surprise
 * voice, no new voice request per click); "Tiếp tục" does, and brings the view back.
 */
export function showFace(i: number): void {
  const store = board();
  store.set({ face: i, follow: i === store.teacherFace });
  if (store.status === 'playing' && i !== store.teacherFace) pauseLesson();
}

/**
 * Stops the lesson being taught. It never touches a start that is still waiting for the board's
 * fonts (`cancelPendingStart` does, when the page closes): `playLesson` calls this first, and the
 * board must not forget which answer it is about to teach (it would then take a re-render for
 * "Viết tiếp" and cut the new lesson after its first sentence). The pen always goes, also when
 * no lesson was playing (a start cancelled while preparing must not leave a frozen pen).
 */
export function stopLesson(): void {
  endRun();
  stopSpeaking();
  const status = board().status;
  board().set({
    pen: null,
    run: 0,
    ...(status === 'playing' || status === 'paused' ? { status: 'done' as const } : {}),
  });
}

/** Numbers the starts the board schedules; `pendingStart` is the one still allowed to begin. */
let startTicket = 0;
let pendingStart: number | null = null;

/**
 * The board schedules a start (it first waits for its fonts, Whiteboard.tsx): only the latest
 * scheduled start may begin, see `claimStart`.
 */
export function reserveStart(): number {
  startTicket += 1;
  pendingStart = startTicket;
  return startTicket;
}

/** True, once, when this start is still the latest and the page was not closed meanwhile. */
export function claimStart(ticket: number): boolean {
  if (pendingStart !== ticket) return false;
  pendingStart = null;
  return true;
}

/**
 * The page closes while a start waits for the fonts: it never begins, so a voice never starts on
 * a page that is gone. The answer was not taught, so showing it again starts it afresh (also
 * after React's StrictMode remount in development).
 */
export function cancelPendingStart(): void {
  if (pendingStart === null) return;
  pendingStart = null;
  const store = board();
  store.set({ lessonContent: '', ...(store.status === 'preparing' ? { status: 'idle' } : {}) });
}

/** The chat was cleared: the lesson ends at once and the board is empty again. */
export function clearBoard(): void {
  stopLesson();
  pendingStart = null;
  lastInput = null;
  lessonKnown = [];
  board().set({
    lessonId: null,
    lessonContent: '',
    layout: emptyLayout(),
    progress: {},
    erased: {},
    provenance: {},
    marks: [],
    strokes: [],
    subtitle: '',
    status: 'idle',
    face: 0,
    teacherFace: 0,
    follow: true,
    focus: null,
    pen: null,
    run: 0,
  });
}

export function replayLesson(): void {
  if (lastInput && lastMeasure) void playLesson(lastInput, lastMeasure);
}

// A lesson never outlives the teacher screen: closing it (Back, Esc, a topic, home) stops the
// lesson, also one left paused in the talk layout while the board was hidden.
useTeacherStore.subscribe((s, p) => {
  if (p.open && !s.open) stopLesson();
});
// Clearing the chat ends the lesson and empties the board, also while the board is hidden.
useChatStore.subscribe((s, p) => {
  if (p.messages.length > 0 && s.messages.length === 0) clearBoard();
});
