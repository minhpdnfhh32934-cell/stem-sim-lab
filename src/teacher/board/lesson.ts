/**
 * Plays an AI Teacher answer on the whiteboard (PROMPT_PHAN_2 B8): sentence by sentence, the
 * teacher speaks while the pen writes; the voice never races the pen (the next sentence waits
 * for both). Marks (underline, circle, box, highlight, arrows) are drawn when their tag comes.
 * Every number written is checked for provenance (provenance.ts).
 */
import { speak, stopSpeaking, toSpokenText } from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
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
import { useBoardStore, type BoardMark } from './boardStore';
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
}

/** TeachScript when the answer has board tags, else the markdown layout. */
export function scriptFor(content: string): ParsedScript {
  const parsed = parseTeachScript(content);
  return parsed.hasBoard ? parsed : markdownToScript(content);
}

/** Plain text of an answer for the chat history (tags removed, board writing kept). */
export function boardAnswerText(content: string): string {
  const parsed = parseTeachScript(content);
  if (!parsed.hasBoard) return content;
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
        .replace(/_\{?(\d+)\}?/g, (_s, d: string) =>
          Array.from(d, (c) => SUBSCRIPT[Number(c)] ?? c).join(''),
        )
        .replace(/\^\{?([0-9+\-−]+)\}?/g, (_s, d: string) =>
          Array.from(d, (c) => SUPERSCRIPT[c] ?? c).join(''),
        )
        .replace(/\\([a-zA-Z]+)/g, '$1')
        .replace(/[{}]/g, ''),
    )
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT_MS = { slow: 82, normal: 52, fast: 34 } as const;

let controller: AbortController | null = null;
let gate: { promise: Promise<void>; open: () => void } | null = null;
let instant = false;
let lastInput: LessonInput | null = null;
let lastMeasure: Measure | null = null;

class Stopped extends Error {}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (instant || ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(t);
      reject(new Stopped());
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Read through a function: the signal can change while we wait. */
const isAborted = (signal: AbortSignal) => signal.aborted;

async function waitIfPaused(signal: AbortSignal): Promise<void> {
  if (isAborted(signal)) throw new Stopped();
  if (gate) await gate.promise;
  if (isAborted(signal)) throw new Stopped();
}

/** Where the pen is after `units` of an element (board units, approximate). */
function penAt(e: TextElement, units: number): { x: number; y: number } {
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
async function writeElement(e: TextElement, signal: AbortSignal): Promise<void> {
  const store = useBoardStore.getState();
  store.set({ focus: e.id, face: e.face });
  if (instant) {
    store.setProgress(e.id, e.length);
    return;
  }
  const unit = UNIT_MS[e.speed];
  let done = 0;
  for (const line of e.lines) {
    for (const t of line.tokens) {
      if (t.kind === 'math') {
        // A formula is revealed left to right in small steps.
        const steps = 10;
        const total = 380 + t.w * 1.6;
        for (let k = 1; k <= steps; k++) {
          await waitIfPaused(signal);
          const value = done + k / steps;
          useBoardStore.getState().setProgress(e.id, value);
          useBoardStore.getState().set({ pen: penAt(e, value) });
          await sleep(total / steps / useBoardStore.getState().speed, signal);
        }
        done += 1;
        continue;
      }
      for (let c = 0; c <= t.value.length; c++) {
        await waitIfPaused(signal);
        done += 1;
        useBoardStore.getState().setProgress(e.id, done);
        useBoardStore.getState().set({ pen: penAt(e, done) });
        // Irregular rhythm: a short stop between words, quicker in the middle of a word.
        const ms = c === t.value.length ? unit * 2.4 : unit * (0.75 + ((c * 37) % 10) / 20);
        await sleep(ms / useBoardStore.getState().speed, signal);
      }
    }
  }
  useBoardStore.getState().setProgress(e.id, e.length);
}

function addMark(mark: Omit<BoardMark, 'shown' | 'key'>): string {
  const key = `${mark.kind}-${String(useBoardStore.getState().marks.length)}`;
  const store = useBoardStore.getState();
  store.set({ marks: [...store.marks, { ...mark, key, shown: instant }] });
  return key;
}

async function runAction(
  action: BoardAction,
  ctx: { measure: Measure; sources: number[]; known: number[]; signal: AbortSignal },
): Promise<void> {
  const { measure, signal } = ctx;
  const store = useBoardStore.getState();
  const layout = store.layout;
  const target = (id: string): BoardElement | undefined => findElement(layout, id);
  switch (action.kind) {
    case 'write':
    case 'correct': {
      const old = action.kind === 'correct' ? target(action.target) : undefined;
      if (action.kind === 'correct' && !old) return;
      if (old) {
        const key = addMark({ kind: 'strike', face: old.face, box: old, seed: seedOf(old.id) });
        await sleep(80, signal);
        useBoardStore.getState().showMark(key);
        await sleep(450, signal);
      }
      const { element } = place(layout, action, measure);
      if (!element || element.kind !== 'text') return;
      const prov = checkNumbers(element.source, ctx.sources, ctx.known);
      ctx.known.push(...prov.results);
      useBoardStore.getState().set({
        layout: { ...layout },
        provenance: { ...useBoardStore.getState().provenance, [element.id]: prov },
        progress: { ...useBoardStore.getState().progress, [element.id]: 0 },
      });
      if (instant) useBoardStore.getState().setProgress(element.id, element.length);
      else await writeElement(element, signal);
      return;
    }
    case 'mark': {
      const e = target(action.target);
      if (!e) return;
      const box = spanBox(e, action.span, measure);
      useBoardStore.getState().set({ focus: e.id, pen: { x: box.x + box.w, y: box.y + box.h } });
      const key = addMark({
        kind: action.mark,
        face: e.face,
        box,
        seed: seedOf(`${e.id}${action.mark}`),
      });
      await sleep(60, signal);
      useBoardStore.getState().showMark(key);
      await sleep(650, signal);
      return;
    }
    case 'arrow': {
      const a = target(action.from);
      const b = target(action.to);
      if (!a || !b || a.face !== b.face) return;
      const key = addMark({
        kind: 'arrow',
        face: a.face,
        box: a,
        to: b,
        ...(action.label ? { label: action.label } : {}),
        seed: seedOf(`${a.id}>${b.id}`),
      });
      await sleep(60, signal);
      useBoardStore.getState().showMark(key);
      await sleep(750, signal);
      return;
    }
    case 'point': {
      const e = target(action.target);
      if (!e) return;
      useBoardStore
        .getState()
        .set({ focus: e.id, face: e.face, pen: { x: e.x + e.w + 12, y: e.y + e.h / 2 } });
      await sleep(600, signal);
      return;
    }
    case 'erase': {
      const e = target(action.target);
      if (!e) return;
      useBoardStore
        .getState()
        .set({ erased: { ...useBoardStore.getState().erased, [e.id]: true } });
      await sleep(450, signal);
      return;
    }
    case 'newboard': {
      const { element } = place(layout, action, measure);
      useBoardStore
        .getState()
        .set({ layout: { ...layout }, face: layout.faces.length - 1, pen: null });
      await sleep(350, signal);
      if (element?.kind === 'text') {
        useBoardStore.getState().setProgress(element.id, 0);
        if (instant) useBoardStore.getState().setProgress(element.id, element.length);
        else await writeElement(element, signal);
      }
      return;
    }
    case 'draw':
    case 'plot': {
      const { element } = place(layout, action, measure);
      if (!element) return;
      useBoardStore.getState().set({
        layout: { ...layout },
        focus: element.id,
        face: element.face,
        pen: { x: element.x + element.w / 2, y: element.y + element.h / 2 },
        progress: { ...useBoardStore.getState().progress, [element.id]: 1 },
      });
      await sleep(1400, signal);
      return;
    }
  }
}

function readingTime(text: string): number {
  return Math.min(4200, Math.max(700, text.length * 42));
}

/** Set when a pause cut the sentence being spoken: it is read again after "Tiếp tục". */
let speechCut = false;
/** Read through functions: a pause or "Viết nhanh" changes these while a sentence is spoken. */
const wasCut = () => speechCut;
const isInstant = () => instant;

/**
 * Speaks a sentence, again from its start when a pause cut it (audit BRD-02): the learner never
 * loses the end of a sentence. The board's speed (0,75–2×) also sets the voice's pace (BRD-03).
 */
async function speakSentence(
  text: string,
  signal: AbortSignal,
  entry: SentenceTiming,
): Promise<void> {
  for (;;) {
    speechCut = false;
    const begin = performance.now();
    if (metrics) metrics.firstSpeechMs ??= Math.round(begin - metrics.startedAt);
    await speak(text, { rate: useBoardStore.getState().speed });
    entry.speechMs = (entry.speechMs ?? 0) + Math.round(performance.now() - begin);
    if (!wasCut() || isAborted(signal) || isInstant()) return;
    await waitIfPaused(signal);
    if (isInstant()) return;
  }
}

async function playSentence(
  sentence: Sentence,
  ctx: { measure: Measure; sources: number[]; known: number[]; signal: AbortSignal },
): Promise<void> {
  const { signal } = ctx;
  await waitIfPaused(signal);
  // What is said and shown includes what is being written (audit BRD-01).
  const said = sentence.spoken || sentence.speech;
  useBoardStore.getState().set({ subtitle: subtitleText(said) });
  const voice = !instant && useVoiceStore.getState().enabled && said.trim() !== '';
  const entry: SentenceTiming = { speechMs: null, writingMs: 0 };
  metrics?.sentences.push(entry);
  const speech = voice ? speakSentence(said, signal, entry) : Promise.resolve();
  const started = performance.now();
  for (const { action } of sentence.actions) {
    await waitIfPaused(signal);
    await runAction(action, ctx);
  }
  entry.writingMs = Math.round(performance.now() - started);
  await speech;
  if (isAborted(signal)) throw new Stopped();
  if (!voice && !instant) {
    // Without a voice the learner reads the subtitle: give them the time to.
    const left = readingTime(toSpokenText(said)) - (performance.now() - started);
    await sleep(left / useBoardStore.getState().speed, signal);
  }
  await sleep(sentence.pauseMs + 220, signal);
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

async function run(script: ParsedScript, input: LessonInput, measure: Measure): Promise<void> {
  const ctrl = new AbortController();
  controller = ctrl;
  instant = false;
  lastInput = input;
  lastMeasure = measure;
  useBoardStore.getState().set({ lessonId: input.id, status: 'playing' });
  const ctx = {
    measure,
    sources: sourceNumbers(input.question),
    known: lessonKnown,
    signal: ctrl.signal,
  };
  try {
    for (const sentence of script.sentences) await playSentence(sentence, ctx);
    if (controller === ctrl)
      useBoardStore.getState().set({ status: 'done', pen: null, subtitle: '' });
  } catch (e) {
    if (!(e instanceof Stopped)) throw e;
  } finally {
    if (controller === ctrl) controller = null;
    instant = false;
  }
}

/** Starts (or restarts) a lesson on a clean board. */
export async function playLesson(input: LessonInput, measure: Measure): Promise<void> {
  stopLesson();
  lessonKnown = [];
  metrics = { startedAt: performance.now(), firstSpeechMs: null, sentences: [] };
  useBoardStore.getState().set({
    layout: emptyLayout(),
    progress: {},
    erased: {},
    provenance: {},
    marks: [],
    face: 0,
    focus: null,
    pen: null,
    subtitle: '',
    strokes: [],
  });
  await run(scriptFor(input.content), input, measure);
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
  // Whatever was still being written is finished at once before the new part starts.
  controller?.abort();
  controller = null;
  stopSpeaking();
  const store = useBoardStore.getState();
  const progress = { ...store.progress };
  for (const e of store.layout.elements) progress[e.id] = e.kind === 'text' ? e.length : 1;
  store.set({ progress, marks: store.marks.map((m) => ({ ...m, shown: true })) });
  await run(scriptFor(input.content.slice(previous.content.length)), input, measure);
}

export function pauseLesson(): void {
  if (!controller || gate) return;
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  gate = { promise, open };
  // The sentence being spoken is cut here and read again on "Tiếp tục" (audit BRD-02).
  if (useVoiceStore.getState().speaking) speechCut = true;
  stopSpeaking();
  useBoardStore.getState().set({ status: 'paused' });
}

export function resumeLesson(): void {
  const g = gate;
  gate = null;
  if (g) {
    useBoardStore.getState().set({ status: 'playing' });
    g.open();
  }
}

/** Writes everything that is left at once (no animation, no voice). */
export function finishNow(): void {
  if (!controller) return;
  instant = true;
  speechCut = false;
  stopSpeaking();
  resumeLesson();
}

export function stopLesson(): void {
  controller?.abort();
  controller = null;
  const g = gate;
  gate = null;
  g?.open();
  stopSpeaking();
  if (
    useBoardStore.getState().status === 'playing' ||
    useBoardStore.getState().status === 'paused'
  ) {
    useBoardStore.getState().set({ status: 'done', pen: null });
  }
}

export function replayLesson(): void {
  if (lastInput && lastMeasure) void playLesson(lastInput, lastMeasure);
}
