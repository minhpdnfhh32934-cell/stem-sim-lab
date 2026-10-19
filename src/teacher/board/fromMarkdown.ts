/**
 * Any answer → a board lesson. When the AI did not write TeachScript (Gemma, or a cloud answer
 * without tags), the markdown answer is laid out the way a teacher uses a board: the heading on
 * top, the given data and notes on the side, numbered steps down the middle, formulas written
 * (not just said), keywords underlined, the final result boxed, tables as tables. Long
 * explanations are spoken, and only their equations written (boards hold key points only).
 *
 * Each line is classified first (lessonCheck.ts): hidden reasoning, prompt echoes, links and bare
 * markup ("---") are neither said nor written; greetings and remarks about the answer ("Chào
 * bạn!", "Dưới đây là…") are said, never written. A label alone ("**Kết luận:**", "Cho:", from a
 * closed list) is not written: it is said with the line it names, and its meaning goes to that
 * line (a conclusion is boxed once, never as an empty box; given data and notes go to the side).
 * Every sentence records where its line stands in the answer, so "Viết tiếp" can skip what was
 * already taught by position.
 */
import en from '@/app/i18n/locales/en';
import vi from '@/app/i18n/locales/vi';
import type { Locale } from '@/app/i18n/types';
import { parseMessage } from '@/teacher/chat/messageParse';
import {
  asksLearner,
  extractEquations,
  holdsMaterial,
  keyPoint,
  labelOf,
  learningPart,
  opensContentList,
  questionOf,
  sanitizeBoardText,
  type LabelMeaning,
} from './lessonCheck';
import {
  markupToText,
  mathScripts,
  spokenSentence,
  type BoardAction,
  type ParsedScript,
  type Sentence,
  type TimedAction,
} from './teachscript';

export { keyPoint } from './lessonCheck';

/** Longest line written as it is; longer paragraphs are spoken and only their equations written. */
const MAX_WRITE_CHARS = 150;

/** What the board says in place of a code block (the code stays in the chat message). */
const CODE_NOTE: Record<Locale, string> = {
  vi: vi.board.codeInMessage,
  en: en.board.codeInMessage,
};

// `\b` does not work after Vietnamese letters: a lookahead ends the word instead.
const RESULT = /^(đáp số|đáp án|kết quả|kết luận|vậy|=>|⇒|suy ra|answer|result)(?![\p{L}\d])/iu;
const NOTE = /^(lưu ý|chú ý|ghi nhớ|mẹo|nhớ|note|tip)\s*[:：]/i;
const GIVEN = /^(cho|tóm tắt|dữ kiện|biết|given)\s*[:：]/i;
const FIND = /^(tìm|tính|hỏi|find)\s*[:：]/i;
/**
 * A check question with its label on the same line ("Câu hỏi kiểm tra: …?"). "Kiểm tra (lại):"
 * alone is not one: in a solution it verifies the answer.
 */
const CHECK =
  /^(câu hỏi (tự )?(kiểm tra|củng cố|ôn tập)|tự kiểm tra|kiểm tra nhanh|thử sức|check yourself|quiz)\s*[:：]/iu;
const STEP = /^(bước\s*\d+|step\s*\d+|\d+[.)])\s*/i;
/** Only markup: "---", "***", "___" (a table's separator row is read before this). */
const RULE = /^[\s\-–—*_=~#>|`.·•:]*$/u;
/** A list item ("- ", "* ", "1. "). */
const LIST_ITEM = /^\s*(?:[-*+•]\s+|\d{1,2}[.)]\s)/u;

/**
 * A line without markdown emphasis, code marks and links. A "*" with a space after it is a
 * multiplication ("6,47 * 10 / 65 * 66"), never emphasis: no operator is ever removed.
 */
function stripMd(s: string): string {
  return s
    .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '$1')
    .replace(/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

function boldWords(s: string): string[] {
  return [...s.matchAll(/\*\*([^*]{2,40})\*\*/g)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
}

/** `\(…\)` written as `$…$` (the board and the voice read formulas between `$`). */
function inlineDelimiters(s: string): string {
  return s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => `$${tex}$`);
}

/**
 * `\[…\]` written as `$$…$$` outside code fences: the same length, so offsets in the answer stay
 * where they were.
 */
function displayDelimiters(md: string): string {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => `$$${tex}$$`),
    )
    .join('');
}

interface Range {
  start: number;
  end: number;
}

/**
 * Labels whose meaning holds for a whole list after them ("Cho:" + "- m = 2 kg" + "- F = 10 N";
 * "Tài liệu tham khảo:" + its list of sources).
 */
const LIST_MEANINGS: ReadonlySet<LabelMeaning> = new Set(['given', 'find', 'note', 'sources']);

class Builder {
  sentences: Sentence[] = [];
  /** Where the line being laid out stands in the answer (set before each line). */
  range: Range | null = null;
  /** The answer after that line (a tag closed on a later line is markup, not text). */
  after = '';
  private counters = new Map<string, number>();
  private written = 0;
  private titled = false;
  /** A label alone, said with the next spoken line. */
  private label: { text: string; range: Range | null } | null = null;
  /** What that label means for the line(s) after it. */
  private context: { meaning: LabelMeaning; lines: number; list: boolean } | null = null;
  /**
   * The line before the list being read opened a list of content ("Các giai đoạn của nguyên
   * phân:", "Cho:"): its items are content, also an item that only names the page it links to.
   */
  private listIntro = false;

  constructor(private readonly codeNote: string) {}

  id(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}${String(n)}`;
  }

  say(speech: string, actions: BoardAction[] = [], pauseMs = 0) {
    const timed: TimedAction[] = actions.map((action) => ({ at: 0, action }));
    if (actions.some((a) => a.kind === 'write')) this.written++;
    const label = this.label;
    this.label = null;
    const said = [label?.text, speech.trim()].filter(Boolean).join(' ');
    const start = Math.min(label?.range?.start ?? Infinity, this.range?.start ?? Infinity);
    const end = this.range?.end;
    this.sentences.push({
      speech: said,
      spoken: spokenSentence(said, timed),
      actions: timed,
      pauseMs,
      ...(Number.isFinite(start) && end !== undefined ? { start, end } : {}),
    });
  }

  /** A pending label with nothing after it to name: said on its own. */
  flushLabel() {
    const label = this.label;
    if (!label) return;
    const range = this.range;
    this.label = null;
    this.range = label.range;
    this.say(label.text);
    this.range = range;
  }

  /** A label alone on its line: not written; said with the next line, its meaning goes there. */
  setLabel(meaning: LabelMeaning, text: string) {
    this.flushLabel();
    // The name of a list of sources is not said (the sources are links, never board content).
    if (meaning !== 'sources') this.label = { text: stripMd(text), range: this.range };
    this.context = meaning === 'neutral' ? null : { meaning, lines: 0, list: false };
  }

  /** A blank line ends a label's list once it had items. */
  blank() {
    if (this.context && this.context.lines > 0) this.context = null;
  }

  /** The meaning of the label that names this line (a list label also names the next items). */
  private meaningFor(item: boolean): LabelMeaning | null {
    const c = this.context;
    if (!c) return null;
    if (c.lines > 0 && !(c.list && item)) {
      this.context = null;
      return null;
    }
    if (c.lines === 0) c.list = item && LIST_MEANINGS.has(c.meaning);
    c.lines += 1;
    if (!c.list) this.context = null;
    return c.meaning;
  }

  /** A new face when the current one is already full of content (teachers wipe or move on). */
  maybeNewBoard(title: string): BoardAction[] {
    if (this.written >= 10) {
      this.written = 0;
      return [{ kind: 'newboard', title }];
    }
    return [];
  }

  heading(text: string) {
    this.flushLabel();
    this.context = null;
    this.listIntro = false;
    const clean = stripMd(markupToText(text, this.after)).replace(/[.:!?]+$/, '');
    const part = learningPart(clean, { structural: true });
    if (part.cls === 'internal') return;
    if (part.cls !== 'learning') {
      this.say(clean);
      return;
    }
    if (!this.titled) {
      this.titled = true;
      this.say(clean, [
        {
          kind: 'write',
          id: this.id('h'),
          zone: 'title',
          role: 'heading',
          math: false,
          text: clean,
          speed: 'normal',
        },
      ]);
    } else {
      const id = this.id('h');
      this.say(clean, [
        ...this.maybeNewBoard(clean),
        {
          kind: 'write',
          id,
          zone: 'steps',
          role: 'heading',
          math: false,
          text: clean,
          speed: 'normal',
        },
        { kind: 'mark', mark: 'underline', target: id },
      ]);
    }
    // "## Kết luận": the heading stays, and the line under it is the boxed result.
    if (labelOf(`${clean}:`) === 'result')
      this.context = { meaning: 'result', lines: 0, list: false };
  }

  line(raw: string, item: boolean) {
    // Said and written alike: "10<sup>23</sup>" is "$10^{23}$" for the voice too, and markup
    // such as "<note>…</note>" is neither read out nor written.
    const text = markupToText(inlineDelimiters(raw.trim()), this.after).trim();
    if (!text) {
      this.blank();
      return;
    }
    // A rule ("---", "***"): layout only.
    if (RULE.test(text)) return;
    const label = labelOf(text);
    if (label) {
      this.setLabel(label, text);
      this.listIntro = label !== 'sources';
      return;
    }
    // The sources a "Tài liệu tham khảo:" label lists: neither said nor written (whatever is
    // left of a source once its link goes is not lesson content).
    if (this.context?.meaning === 'sources' && this.meaningFor(item) === 'sources') return;
    const part = learningPart(text, { listed: item && this.listIntro });
    if (!item) this.listIntro = part.cls !== 'internal' && opensContentList(text);
    // Hidden reasoning, a prompt echo, a link: neither said nor written.
    if (part.cls === 'internal') return;
    // A greeting or a remark about the answer: said, never written (a label waits for content).
    if (!part.board) {
      const label = this.label;
      this.label = null;
      this.say(text);
      this.label = label;
      return;
    }
    const board = part.board;
    // Without markdown or HTML ("<b>Lưu ý:</b> …" is a note), formulas and numbers untouched.
    const plain = sanitizeBoardText(board);
    const meaning = this.meaningFor(item);
    // "Vậy, đúng hay sai?", "=> Nếu F tăng gấp đôi thì a bằng bao nhiêu?": a question is never
    // boxed as the result, whatever word opens it.
    const result = meaning === 'result' || (RESULT.test(plain) && !/\?\s*$/u.test(plain));
    const check = meaning === 'check' || CHECK.test(plain);
    const note = meaning === 'note' || NOTE.test(plain);
    const given =
      meaning === 'given' || meaning === 'find' || GIVEN.test(plain) || FIND.test(plain);
    const step = STEP.test(plain);
    if (plain.length > MAX_WRITE_CHARS && !step && !result && !check) {
      // A long explanation: said aloud; only its equations go on the board (written as they
      // stand: a plain-text equation stays text, never KaTeX).
      this.say(
        text,
        extractEquations(plain).map((eq) => ({
          kind: 'write',
          id: this.id('m'),
          zone: 'main',
          role: 'body',
          math: eq.math,
          text: eq.text,
          speed: 'normal',
        })),
      );
      return;
    }
    const id = this.id(result ? 'r' : note || check ? 'n' : given ? 'g' : 's');
    // Results and given data are written whole, a check only as its question; a long
    // explanation step of words only as its key point (the whole line is said). A step with a
    // number or a formula is left whole here: the lesson check splits it at clause boundaries.
    const written =
      result || given
        ? plain
        : check
          ? questionOf(plain)
          : holdsMaterial(plain)
            ? plain
            : keyPoint(plain);
    const zone =
      note || given || check ? 'side_notes' : meaning === 'example' ? 'example' : 'steps';
    const role = result ? 'result' : note || check ? 'note' : 'body';
    const actions: BoardAction[] = [
      {
        kind: 'write',
        id,
        zone,
        role,
        math: false,
        text: written,
        speed: result ? 'slow' : 'normal',
      },
    ];
    for (const word of boldWords(board).slice(0, 2)) {
      if (written.includes(word))
        actions.push({ kind: 'mark', mark: 'underline', target: id, span: word });
    }
    if (result) actions.push({ kind: 'mark', mark: 'box', target: id });
    this.say(text, actions);
  }

  displayMath(display: string) {
    // "$$m = 9,1 \cdot 10<sup>-31</sup>$$": TeX's own superscript in the formula.
    const tex = mathScripts(display);
    const result = this.meaningFor(false) === 'result';
    const id = this.id(result ? 'r' : 'm');
    this.say(`$$${tex}$$`, [
      {
        kind: 'write',
        id,
        zone: 'main',
        role: result ? 'result' : 'body',
        math: true,
        text: tex,
        speed: 'slow',
      },
      ...(result ? [{ kind: 'mark', mark: 'box', target: id } as const] : []),
    ]);
  }

  code() {
    this.context = null;
    this.say(this.codeNote);
  }

  table(rows: string[][]) {
    const [header, ...body] = rows;
    if (!header) return;
    this.context = null;
    this.say(rows.map((r) => r.join(', ')).join('. '), [
      {
        kind: 'draw',
        id: this.id('t'),
        zone: 'diagram',
        type: 'table',
        spec: { header, rows: body },
      },
    ]);
  }

  /**
   * The check question at the very end of a lesson ("Em thử tính … nhé?") is a short side note
   * for the learner, not one more step.
   */
  finish() {
    this.flushLabel();
    for (let i = this.sentences.length - 1; i >= 0; i--) {
      const s = this.sentences[i];
      const w = s?.actions.find((a) => a.action.kind === 'write');
      if (!s || !w) continue;
      const a = w.action;
      // "Nếu … thì sao? Thử với m = 2 kg." is a check too; "Vì sao …? Vì …" is a question the
      // teacher answers, a step.
      if (
        a.kind === 'write' &&
        a.zone === 'steps' &&
        a.role === 'body' &&
        asksLearner(a.text) &&
        asksLearner(s.speech)
      ) {
        this.sentences[i] = {
          ...s,
          actions: s.actions.map((t) =>
            t === w ? { ...t, action: { ...a, zone: 'side_notes', role: 'note' } } : t,
          ),
        };
      }
      return;
    }
  }
}

function tableRows(lines: string[]): string[][] {
  return lines
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => stripMd(markupToText(c.trim()))),
    );
}

/**
 * Lays out a markdown answer as a board lesson (always succeeds). `locale` is the language of
 * what the board says in place of a code block.
 */
export function markdownToScript(markdown: string, locale: Locale = 'vi'): ParsedScript {
  const source = displayDelimiters(markdown);
  const b = new Builder(CODE_NOTE[locale]);
  let cursor = 0;
  /**
   * Where `needle` stands in the answer from the cursor on (the cursor moves past it). Not found:
   * up to the end, so it is never taken for something already taught.
   */
  const locate = (needle: string): Range => {
    const at = needle ? source.indexOf(needle, cursor) : -1;
    if (at < 0) return { start: cursor, end: source.length };
    cursor = at + needle.length;
    return { start: at, end: cursor };
  };
  const locateBetween = (open: string, close: string, skipLine: boolean): Range => {
    const at = source.indexOf(open, cursor);
    if (at < 0) return { start: cursor, end: source.length };
    const from = skipLine ? source.indexOf('\n', at) + 1 : at + open.length;
    const end = from > 0 ? source.indexOf(close, from) : -1;
    if (end < 0) return { start: at, end: source.length };
    cursor = end + close.length;
    return { start: at, end: cursor };
  };
  for (const block of parseMessage(source)) {
    if (block.kind === 'math') {
      b.range = locateBetween('$$', '$$', false);
      b.displayMath(block.tex);
      continue;
    }
    if (block.kind === 'code') {
      b.range = locateBetween('```', '```', true);
      b.code();
      continue;
    }
    let table: { line: string; range: Range }[] = [];
    const flushTable = () => {
      const first = table[0];
      const last = table[table.length - 1];
      if (first && last) {
        b.range = { start: first.range.start, end: last.range.end };
        b.table(tableRows(table.map((t) => t.line)));
      }
      table = [];
    };
    for (const line of block.lines) {
      const range = locate(line);
      if (/^\s*\|.*\|\s*$/.test(line)) {
        table.push({ line, range });
        continue;
      }
      flushTable();
      b.range = range;
      b.after = source.slice(range.end);
      const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        b.heading(heading[1] ?? '');
        continue;
      }
      // Bullets are written without their marker.
      b.line(line.replace(/^\s*[-*+•]\s+/u, ''), LIST_ITEM.test(line));
    }
    flushTable();
  }
  b.finish();
  return {
    sentences: b.sentences,
    diagnostics: [],
    hasBoard: b.sentences.some((s) => s.actions.length > 0),
  };
}
