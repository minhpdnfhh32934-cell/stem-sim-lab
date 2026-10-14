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
import type { Locale } from '@/app/i18n/types';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cleanAnswer, type CleanOptions } from '@/teacher/chat/answerClean';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { markdownToScript } from './fromMarkdown';
import { validateLesson, type ValidatedLesson } from './lessonCheck';
import {
  emptyLayout,
  findElement,
  place,
  spanBox,
  type BoardElement,
  type Layout,
  type Measure,
  type TextElement,
} from './layout';
import { useBoardStore, type BoardMark, type BoardPatch } from './boardStore';
import { checkNumbers, sourceNumbers } from './provenance';
import { seedOf } from './rough';
import {
  parseTeachScript,
  teachScriptSource,
  type BoardAction,
  type ParsedScript,
  type Sentence,
  type TimedAction,
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

export interface ScriptOptions extends CleanOptions {
  /** The language of what the board says in place of a code block (default Vietnamese). */
  locale?: Locale;
}

/** An answer as the board teaches it: the text the reader read, and the checked lesson. */
export interface BoardLesson extends ValidatedLesson {
  /** The cleaned answer the sentences' `start`/`end` offsets refer to. */
  source: string;
}

/**
 * The answer cleaned (answerClean.ts: new answers already are, answers saved by an older version
 * may still hold hidden reasoning or echoed prompt labels), read as TeachScript when it has board
 * tags, else laid out from its markdown, then checked (lessonCheck.ts): the board shows learning
 * content only.
 */
export function lessonFor(content: string, options: ScriptOptions = {}): BoardLesson {
  const { locale = 'vi', ...clean } = options;
  const source = teachScriptSource(cleanAnswer(content, clean).text);
  const parsed = parseTeachScript(source);
  const script = parsed.hasBoard ? parsed : markdownToScript(source, locale);
  return { source, ...validateLesson(script) };
}

/** The checked lesson of an answer (`lessonFor`). */
export function scriptFor(content: string, options: ScriptOptions = {}): ParsedScript {
  return lessonFor(content, options).script;
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
  /** The record of the action being run: what it puts on the board goes there. */
  placed: Placed | null;
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
      // A long write split into pieces: each piece is struck out, the correction goes after the
      // last one.
      const wrong =
        action.kind === 'correct'
          ? [
              ...(action.strike ?? []).flatMap((id) => {
                const e = target(id);
                return e ? [e] : [];
              }),
              ...(old ? [old] : []),
            ]
          : [];
      for (const e of wrong) {
        // The teacher walks to the wrong line and strikes it out first.
        moveTo(r, e, { x: e.x + e.w, y: e.y + e.h / 2 });
        const key = addMark(r, { kind: 'strike', face: e.face, box: e, seed: seedOf(e.id) });
        ctx.placed?.marks.push(key);
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
      ctx.placed?.elements.push(element.id);
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
      ctx.placed?.marks.push(key);
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
      ctx.placed?.marks.push(key);
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
      if (ctx.placed) {
        ctx.placed.face = n;
        if (element) ctx.placed.elements.push(element.id);
      }
      await sleep(350, r);
      if (element?.kind === 'text') await writeElement(element, r);
      return;
    }
    case 'draw':
    case 'plot': {
      const { layout, element } = placeNow(action);
      if (!element) return;
      r.ids.set(action.id, element.id);
      ctx.placed?.elements.push(element.id);
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
  if (sentence.start !== undefined) lessonLastStart = sentence.start;
  const voice = !r.instant && useVoiceStore.getState().enabled && said.trim() !== '';
  const entry: SentenceTiming = { speechMs: null, writingMs: 0 };
  metrics?.sentences.push(entry);
  const speech = voice ? speakSentence(said, voiceCue(sentence), r, entry) : Promise.resolve();
  const started = performance.now();
  for (const { action } of sentence.actions) {
    await waitIfPaused(r);
    const placed: Placed = {
      kind: action.kind,
      key: actionKey(action),
      id:
        action.kind === 'write' || action.kind === 'draw' || action.kind === 'plot'
          ? action.id
          : null,
      start: sentence.start ?? null,
      end: sentence.end ?? null,
      elements: [],
      marks: [],
      face: null,
    };
    lessonTrail.push(placed);
    ctx.placed = placed;
    try {
      await runAction(action, ctx);
    } finally {
      ctx.placed = null;
    }
  }
  entry.writingMs = Math.round(performance.now() - started);
  await speech;
  ensure(r);
  // Said and written whole: "Viết tiếp" never teaches it again.
  if (sentence.end !== undefined) lessonTaughtTo = Math.max(lessonTaughtTo, sentence.end);
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

/** One action a run of the lesson started, and what it put on the board. */
interface Placed {
  kind: BoardAction['kind'];
  /** The action as the answer wrote it (after the lesson check). */
  key: string;
  /** The AI's id of a write, drawing or plot. */
  id: string | null;
  /** Where its sentence stands in the answer. */
  start: number | null;
  end: number | null;
  /** Board elements it placed (a text, a drawing, a correction). */
  elements: string[];
  /** Marks it drew (an underline, an arrow, the strike of a correction). */
  marks: string[];
  /** The face a `<newboard>` opened (null until it is open). */
  face: number | null;
}

/**
 * Everything the lesson's runs started on the board, in order (`untaught` reads it for "Viết
 * tiếp"); where the runs got to: the end of the last sentence said and written whole, and the
 * start of the last sentence begun.
 */
let lessonTrail: Placed[] = [];
let lessonTaughtTo = 0;
let lessonLastStart = Infinity;

const actionKey = (a: BoardAction): string => JSON.stringify(a);

function forgetPlaced(): void {
  lessonKnown = [];
  lessonTrail = [];
  lessonTaughtTo = 0;
  lessonLastStart = Infinity;
}

/** How an answer of this lesson is cleaned (the same for the lesson and its "Viết tiếp"). */
function cleanOptions(input: LessonInput): CleanOptions {
  return { reviewed: input.reviewed === true, question: input.question };
}

/** How the board reads an answer of this lesson. */
function scriptOptions(input: LessonInput): ScriptOptions {
  return { ...cleanOptions(input), locale: useSettingsStore.getState().locale };
}

/** Length of the common start of two texts. */
function sharedLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/** What "Viết tiếp" still teaches, what it wipes first, and the ids of what stays. */
interface Continuation {
  sentences: Sentence[];
  /** What the taught part placed that the whole answer does not have again (stumps). */
  wiped: Placed[];
  /** The AI's ids → the board ids of what stays (marks of the new part land on them). */
  ids: Map<string, string>;
}

/** The AI ids an action needs on the board (its target, its arrow's ends, its note's anchor). */
function needs(a: BoardAction): string[] {
  switch (a.kind) {
    case 'mark':
    case 'point':
    case 'erase':
      return [a.target];
    case 'correct':
      return [a.target, ...(a.strike ?? [])];
    case 'arrow':
      return [a.from, a.to];
    case 'write':
      return a.noteFor ? [a.noteFor] : [];
    default:
      return [];
  }
}

/**
 * "Viết tiếp" (item 1): the sentences of the whole answer still to teach. `boundary` is where
 * the part already taught stopped in the answer; the lesson's runs may have stopped earlier (a
 * stop, a new part while the old one was still being taught): teaching goes on from where they
 * got to. The sentence cut there is said again whole.
 *
 * What the runs placed from the last sentence they began on is checked against the whole answer:
 * an action that comes again, exactly, on elements that stay, is not placed twice; anything else
 * they placed (a stump of a line cut mid-word, a line that became a label, a check that is now a
 * step…) is wiped, and the whole answer's version is placed. So the board ends as if the whole
 * answer had been taught at once. Taught sentences before that are skipped by position.
 */
function untaught(sentences: readonly Sentence[], boundary: number, layout: Layout): Continuation {
  const upTo = Math.min(boundary, lessonTaughtTo);
  const firstTodo = sentences.find((s) => (s.end ?? Infinity) > upTo);
  // Checked again from the last sentence begun, and from the last one that wrote: the last
  // write of a lesson may be its final check, which is a step once the answer goes on.
  const lastWrote = lessonTrail[lessonTrail.length - 1]?.start ?? Infinity;
  const from = Math.min(upTo, lessonLastStart, lastWrote, firstTodo?.start ?? upTo);
  const tail = lessonTrail.filter((p) => p.end !== null && p.end > from);
  const reused = new Set<Placed>();
  /** AI ids placed anew: an old mark on them does not stand on the new element. */
  const fresh = new Set<string>();
  const stays = (p: Placed, a: BoardAction): boolean => {
    if (needs(a).some((id) => fresh.has(id))) return false;
    if (a.kind === 'newboard') return p.face !== null;
    if (a.kind === 'mark' || a.kind === 'arrow') return p.marks.length > 0;
    // The teacher already pointed there or erased it.
    if (a.kind === 'point' || a.kind === 'erase') return true;
    return p.elements.length > 0;
  };
  /** A face the taught part opened under another title (a heading cut mid-word). */
  const faces: { p: Placed; action: TimedAction }[] = [];
  const out: Sentence[] = [];
  for (const s of sentences) {
    const end = s.end ?? Infinity;
    if (end <= from) continue;
    const actions: TimedAction[] = [];
    for (const t of s.actions) {
      const a = t.action;
      const key = actionKey(a);
      const same = tail.find((p) => !reused.has(p) && p.key === key && stays(p, a));
      if (same) {
        reused.add(same);
        continue;
      }
      if (a.kind === 'newboard') {
        const face = tail.find((p) => !reused.has(p) && p.kind === 'newboard' && p.face !== null);
        if (face) {
          reused.add(face);
          faces.push({ p: face, action: t });
        }
      }
      if (a.kind === 'write' || a.kind === 'draw' || a.kind === 'plot') fresh.add(a.id);
      actions.push(t);
    }
    if (end > upTo) out.push({ ...s, actions });
    // Already said: only what the whole answer places differently, without words.
    else if (actions.length > 0) out.push({ ...s, speech: '', spoken: '', actions, pauseMs: 0 });
  }
  const wiped = tail.filter(
    (p) => !reused.has(p) && (p.elements.length > 0 || p.marks.length > 0 || p.face !== null),
  );
  // A face opened by the taught part goes when nothing on it stays (it is the last face, and
  // all it holds is wiped): the whole answer opens it again. Otherwise it stays, and is not
  // opened twice.
  const gone = new Set(wiped.flatMap((p) => p.elements));
  const unopened = new Set<TimedAction>();
  for (const p of [...wiped.filter((x) => x.face !== null && !faces.some((f) => f.p === x))]) {
    if (!droppable(p, layout, gone)) wiped.splice(wiped.indexOf(p), 1);
  }
  for (const { p, action } of faces) {
    if (droppable(p, layout, new Set([...gone, ...p.elements]))) wiped.push(p);
    else unopened.add(action);
  }
  const sentencesLeft =
    unopened.size === 0
      ? out
      : out
          .map((s) => ({ ...s, actions: s.actions.filter((t) => !unopened.has(t)) }))
          .filter((s) => s.speech !== '' || s.actions.length > 0);
  const ids = new Map<string, string>();
  for (const p of lessonTrail) {
    const element = p.elements[0];
    if (p.id && element && !wiped.includes(p)) ids.set(p.id, element);
  }
  return { sentences: sentencesLeft, wiped, ids };
}

/** The face `p` opened is the last one and holds only elements in `gone`. */
function droppable(p: Placed, layout: Layout, gone: ReadonlySet<string>): boolean {
  return (
    p.face !== null &&
    p.face === layout.faces.length - 1 &&
    p.face > 0 &&
    layout.elements.every((e) => e.face !== p.face || gone.has(e.id))
  );
}

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

async function run(
  script: ParsedScript,
  input: LessonInput,
  measure: Measure,
  ids: ReadonlyMap<string, string> = new Map(),
): Promise<void> {
  endRun();
  runs += 1;
  const r: Run = {
    id: runs,
    ctrl: new AbortController(),
    gate: null,
    instant: false,
    speechCut: false,
    ids: new Map(ids),
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
    placed: null,
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
  forgetPlaced();
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
  await run(lessonFor(input.content, scriptOptions(input)).script, input, measure);
}

/**
 * "Viết tiếp": the same answer grew (the AI was asked for the rest). Only the new part is
 * taught, on the same board, after what is already written; anything else starts over. The
 * whole answer is read again (a tag or a sentence cut where the first part stopped is read whole)
 * and what was already taught is skipped by its place in the answer, not by counting sentences.
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
  const full = lessonFor(input.content, scriptOptions(input));
  const before = teachScriptSource(cleanAnswer(previous.content, cleanOptions(input)).text);
  const rest = untaught(full.script.sentences, sharedLength(before, full.source), store.layout);
  const progress = { ...store.progress };
  for (const e of store.layout.elements) progress[e.id] = e.kind === 'text' ? e.length : 1;
  // Stumps of the part taught (and their marks) are wiped before the rest is taught; a face
  // that held only stumps goes (the rest opens it again).
  const erased = { ...store.erased };
  for (const p of rest.wiped) for (const id of p.elements) erased[id] = true;
  const unmarked = new Set(rest.wiped.flatMap((p) => p.marks));
  const dropped = new Set(rest.wiped.flatMap((p) => (p.face === null ? [] : [p.face])));
  const faces = store.layout.faces.filter((_, i) => !dropped.has(i));
  const layout =
    dropped.size === 0
      ? store.layout
      : { faces, elements: store.layout.elements.filter((e) => !dropped.has(e.face)) };
  lessonTrail = lessonTrail.filter((p) => !rest.wiped.includes(p));
  const teacherFace = Math.min(store.teacherFace, faces.length - 1);
  // The new part is written where the teacher is, in view.
  store.set({
    layout,
    progress,
    erased,
    marks: store.marks
      .filter((m) => !unmarked.has(m.key) && !dropped.has(m.face))
      .map((m) => ({ ...m, shown: true })),
    follow: true,
    teacherFace,
    face: teacherFace,
    pen: null,
  });
  await run({ ...full.script, sentences: rest.sentences }, input, measure, rest.ids);
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
  forgetPlaced();
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
