/**
 * Any answer → a board lesson. When the AI did not write TeachScript (Gemma, or a cloud answer
 * without tags), the markdown answer is laid out the way a teacher uses a board: the heading on
 * top, the given data and notes on the side, numbered steps down the middle, formulas written
 * (not just said), keywords underlined, the final result boxed, tables as tables. Long
 * explanations are spoken, not copied onto the board (boards hold key points only).
 */
import { parseMessage } from '@/teacher/chat/messageParse';
import {
  spokenSentence,
  type BoardAction,
  type ParsedScript,
  type Sentence,
  type TimedAction,
} from './teachscript';

/** Longest line written as it is; longer paragraphs are spoken and only their formulas written. */
const MAX_WRITE_CHARS = 150;
/** A board line is a key point (audit BRD-04): longer words-only lines are cut at a clause. */
const KEY_POINT_CHARS = 80;

/**
 * The key point of a step for the board; the whole step is still read aloud. Lines with numbers
 * are kept whole (every number on the board is checked and must not be cut).
 */
export function keyPoint(text: string): string {
  // The step's own numbering ("2.", "Bước 2:", or both) is not data.
  let body = text;
  for (let i = 0; i < 2; i++)
    body = body.replace(/^(?:(?:bước|step)\s*\d+|\d+[.)])\s*[:.]?\s*/i, '');
  if (text.length <= KEY_POINT_CHARS || /\d/.test(body)) return text;
  const head = text.slice(0, KEY_POINT_CHARS - 10);
  const clause = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'));
  const cut = clause >= 30 ? clause : head.lastIndexOf(' ');
  return `${text.slice(0, cut > 0 ? cut : head.length).trimEnd()}…`;
}

// `\b` does not work after Vietnamese letters: a lookahead ends the word instead.
const RESULT = /^(đáp số|đáp án|kết quả|kết luận|vậy|=>|⇒|suy ra|answer|result)(?![\p{L}\d])/iu;
const NOTE = /^(lưu ý|chú ý|ghi nhớ|mẹo|nhớ|note|tip)\s*[:：]/i;
const GIVEN = /^(cho|tóm tắt|dữ kiện|biết|given)\s*[:：]/i;
const FIND = /^(tìm|tính|hỏi|find)\s*[:：]/i;
const STEP = /^(bước\s*\d+|step\s*\d+|\d+[.)])\s*/i;

function stripMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<![\w*])\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

function boldWords(s: string): string[] {
  return [...s.matchAll(/\*\*([^*]{2,40})\*\*/g)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
}

function inlineMath(s: string): string[] {
  return [...s.matchAll(/\$([^$\n]{2,})\$/g)].map((m) => (m[1] ?? '').trim());
}

class Builder {
  sentences: Sentence[] = [];
  private counters = new Map<string, number>();
  private written = 0;
  private titled = false;

  id(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}${String(n)}`;
  }

  say(speech: string, actions: BoardAction[] = [], pauseMs = 0) {
    const timed: TimedAction[] = actions.map((action) => ({ at: 0, action }));
    if (actions.some((a) => a.kind === 'write')) this.written++;
    const said = speech.trim();
    this.sentences.push({
      speech: said,
      spoken: spokenSentence(said, timed),
      actions: timed,
      pauseMs,
    });
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
    const clean = stripMd(text).replace(/[.:!?]+$/, '');
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
      return;
    }
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

  line(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const plain = stripMd(text);
    const bold = boldWords(text);
    const result = RESULT.test(plain);
    const note = NOTE.test(plain);
    const given = GIVEN.test(plain) || FIND.test(plain);
    const step = STEP.test(plain);
    const math = inlineMath(text);
    if (plain.length > MAX_WRITE_CHARS && !step && !result) {
      // A long explanation: said aloud; only its formulas go on the board.
      this.say(
        text,
        math.slice(0, 2).map((tex) => ({
          kind: 'write',
          id: this.id('m'),
          zone: 'main',
          role: 'body',
          math: true,
          text: tex,
          speed: 'normal',
        })),
      );
      return;
    }
    const id = this.id(result ? 'r' : note ? 'n' : given ? 'g' : 's');
    // Results and given data are written whole; a long explanation step only as its key point.
    const written = result || given ? plain : keyPoint(plain);
    const zone = note || given ? 'side_notes' : 'steps';
    const role = result ? 'result' : note ? 'note' : 'body';
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
    for (const word of bold.slice(0, 2)) {
      if (written.includes(word))
        actions.push({ kind: 'mark', mark: 'underline', target: id, span: word });
    }
    if (result) actions.push({ kind: 'mark', mark: 'box', target: id });
    this.say(text, actions);
  }

  displayMath(tex: string) {
    const id = this.id('m');
    this.say(`$$${tex}$$`, [
      { kind: 'write', id, zone: 'main', role: 'body', math: true, text: tex, speed: 'slow' },
    ]);
  }

  table(rows: string[][]) {
    const [header, ...body] = rows;
    if (!header) return;
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
}

function tableRows(lines: string[]): string[][] {
  return lines
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => stripMd(c.trim())),
    );
}

/** Lays out a markdown answer as a board lesson (always succeeds). */
export function markdownToScript(markdown: string): ParsedScript {
  const b = new Builder();
  for (const block of parseMessage(markdown)) {
    if (block.kind === 'math') {
      b.displayMath(block.tex);
      continue;
    }
    if (block.kind === 'code') {
      b.say('(đoạn mã trong tin nhắn)');
      continue;
    }
    let table: string[] = [];
    const flushTable = () => {
      if (table.length) b.table(tableRows(table));
      table = [];
    };
    for (const line of block.lines) {
      if (/^\s*\|.*\|\s*$/.test(line)) {
        table.push(line);
        continue;
      }
      flushTable();
      const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        b.heading(heading[1] ?? '');
        continue;
      }
      // Bullets are written without their marker.
      b.line(line.replace(/^\s*[-*+]\s+/, ''));
    }
    flushTable();
  }
  return {
    sentences: b.sentences,
    diagnostics: [],
    hasBoard: b.sentences.some((s) => s.actions.length > 0),
  };
}
