import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { PaperRecord } from '../../game/GameState';
import type { PaperItemTexts } from '../../gameplay/papers/PaperSystem';
import { listen } from '../BrowserInput';
import { el, keyLabel, svg } from './dom';
import { formulaNodes } from './formulaHtml';

/** A circle drawn by hand round a letter (the ink's path, in a 32 × 26 box). */
const CIRCLE = 'M 5 14 C 3 5, 27 2, 29 11 C 31 21, 9 25, 4 15 C 3 12, 6 7, 11 6';
/** A cross drawn over a choice taken back. */
const CROSS = ['M 6 5 L 26 21', 'M 26 5 L 6 21'];
const LETTERS = ['A', 'B', 'C', 'D'];
const STATEMENTS = ['a', 'b', 'c', 'd'];

/**
 * A test paper held up in front of the eyes (Phase Y-5, Phú 2026-11-09): the teacher's handwritten
 * test — part I, multiple choice; part II, true/false statements — for the player to do with no
 * time limit. A click on an answer circles it in ink (the pen going round it), a different one
 * crosses the old circle out and circles the new; a true/false statement's Đ or S likewise. Once
 * marked: his red marks, the mark circled at the top, the right answers where they were missed,
 * and his sheet — the mark by experiment, what went well, what to work on with how to study it,
 * and why each missed answer is what it is. Esc or E puts it down. It only asks the PaperSystem.
 */
export class PaperView implements GameSystem {
  readonly id = 'paper-view';
  private readonly root = el('div', 'paper-overlay hidden');
  private readonly sheet = el('article', 'paper-sheet');
  private readonly closeButton = el('button', 'paper-close');
  private readonly subscriptions = new Disposables();
  private open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly host: HTMLElement,
    private readonly capture: () => Promise<void>,
  ) {}

  /** The paper is up and has the mouse (the pause menu does not pause for it). */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.root.setAttribute('role', 'dialog');
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.game.papers.closePaper());
    this.root.append(this.sheet, this.closeButton);
    this.parent.append(this.root);
    const s = this.subscriptions;
    s.add(events.subscribe('PaperOpened', () => this.opened()));
    s.add(events.subscribe('PaperClosed', () => this.closed()));
    s.add(events.subscribe('PaperMarked', () => this.open && this.render()));
    s.add(events.subscribe('LanguageChanged', () => this.open && this.render()));
    listen(s, document, 'keydown', (event) => this.key(event));
    listen(s, document, 'pointerlockchange', () => {
      if (this.open && document.pointerLockElement === this.host) document.exitPointerLock();
    });
  }

  update(): void {
    // Drawn on events; nothing per frame.
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    const bindings = this.game.config.input.bindings;
    if (bindings.toggleDebug.includes(event.code)) return;
    // The game's keys wait while the paper is up (no hotbar slot, no walking).
    event.stopPropagation();
    if (event.repeat) return;
    if (event.key === 'Escape' || bindings.interact.includes(event.code)) {
      event.preventDefault();
      this.game.papers.closePaper();
    }
  }

  private opened(): void {
    this.open = true;
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock(); // the answers need the mouse
    this.render();
    this.sheet.scrollTop = 0;
  }

  private closed(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.add('hidden');
    this.sheet.replaceChildren();
    this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** The whole paper as it stands (opening, a mark, a language change). */
  private render(): void {
    const paper = this.game.papers.reading;
    const t = this.game.texts;
    if (!paper) return;
    this.closeButton.textContent = `${t.ui('paper.close', 'Put it down')} (${keyLabel(
      this.game.config.input.bindings.interact[0],
      t,
    )})`;
    const blocks: HTMLElement[] = [this.header(paper)];
    const choice = paper.items.flatMap((item, i) => (item.order.length > 0 ? [i] : []));
    const truth = paper.items.flatMap((item, i) => (item.order.length > 0 ? [] : [i]));
    let number = 0;
    if (choice.length > 0) {
      blocks.push(
        el('h3', 'paper-part', t.ui('paper.partOne', 'PART I. Multiple choice.')),
        el(
          'p',
          'paper-instruction',
          t.ui('paper.partOneHint', 'Choose one answer for each question.'),
        ),
      );
      for (const i of choice) blocks.push(this.question(paper, i, ++number, null));
    }
    if (truth.length > 0) {
      blocks.push(
        el('h3', 'paper-part', t.ui('paper.partTwo', 'PART II. True or false.')),
        el(
          'p',
          'paper-instruction',
          t.ui('paper.partTwoHint', 'For each statement a), b), c), d), choose true or false.'),
        ),
      );
      for (const i of truth) blocks.push(this.question(paper, i, ++number, null));
    }
    if (paper.marked) blocks.push(this.feedback(paper));
    this.sheet.replaceChildren(...blocks);
  }

  /** The heading: the test's number, what it covers, its length; the mark once marked. */
  private header(paper: PaperRecord): HTMLElement {
    const t = this.game.texts;
    const head = el('header', 'paper-header');
    const names = paper.request.experiments
      .map((id) => {
        const definition = this.game.content.experiments.tryGet(id);
        return definition ? t.of(definition, 'name') : id;
      })
      .join(' · ');
    head.append(
      el('div', 'paper-school', 'SIMLAB'),
      el('h2', 'paper-title', t.ui('paper.title', 'TEST No. {n}', { n: paper.number })),
      el('p', 'paper-covers', names),
      el(
        'p',
        'paper-meta',
        t.ui('paper.meta', '{count} questions · No time limit', { count: paper.items.length }),
      ),
    );
    if (paper.marked) {
      const mark = el('div', 'paper-mark');
      mark.append(
        el('span', 'paper-mark-score', this.game.papers.score(paper.marked.score)),
        el('span', 'paper-mark-of', '/10'),
      );
      head.append(mark);
    }
    return head;
  }

  /** One question: its stem, and its options or statements with what is circled and crossed. */
  private question(
    paper: PaperRecord,
    index: number,
    number: number,
    fresh: { readonly value: number; readonly statement: number } | null,
  ): HTMLElement {
    const t = this.game.texts;
    const item = paper.items[index];
    const texts = item ? this.game.papers.textsOf(item) : null;
    const block = el('section', 'paper-question');
    block.dataset.index = String(index);
    if (!item || !texts) {
      block.append(el('p', 'paper-stem', t.ui('paper.gone', 'This question is no longer asked.')));
      return block;
    }
    const stem = el('p', 'paper-stem');
    stem.append(
      el('strong', undefined, t.ui('paper.number', 'Question {n}.', { n: number })),
      ' ',
      ...this.formula(texts.stem),
    );
    block.append(stem);
    const marked = paper.marked !== null;
    const answer = paper.answers[index];
    const crossed = paper.crossed[index] ?? [];
    if (item.order.length > 0) {
      const options = el('ol', 'paper-options');
      texts.options.forEach((text, printed) => {
        const li = el('li', 'paper-option');
        const button = el('button', 'paper-option-button');
        button.type = 'button';
        button.disabled = marked;
        const letter = el('span', 'paper-letter', `${LETTERS[printed] ?? '?'}.`);
        const chosen = answer === printed;
        if (crossed.includes(printed)) letter.append(this.cross());
        if (chosen) letter.append(this.circle(fresh?.value === printed));
        // Marked: the right option, if it was missed, circled in red.
        const right =
          texts.question.type === 'choice' &&
          texts.question.options[item.order[printed] ?? -1]?.correct;
        if (marked && right && !chosen) letter.append(this.circle(false, 'paper-ink-red'));
        const words = el('span', 'paper-option-text');
        words.append(...this.formula(text));
        button.append(letter, words);
        button.addEventListener('click', () => this.choose(paper, index, number, printed, 0));
        li.append(button);
        options.append(li);
      });
      block.append(options);
    } else {
      const rows = el('ol', 'paper-statements');
      const marks = Array.isArray(answer) ? answer : [];
      texts.statements.forEach((text, k) => {
        const li = el('li', 'paper-statement');
        const words = el('span', 'paper-statement-text', `${STATEMENTS[k] ?? '?'}) `);
        words.append(...this.formula(text));
        li.append(words);
        const cells = el('span', 'paper-cells');
        for (const value of [true, false]) {
          const cell = el('button', 'paper-cell');
          cell.type = 'button';
          cell.disabled = marked;
          const label = el(
            'span',
            'paper-letter',
            value ? t.ui('paper.trueShort', 'T') : t.ui('paper.falseShort', 'F'),
          );
          cell.setAttribute(
            'aria-label',
            value ? t.ui('paper.true', 'True') : t.ui('paper.false', 'False'),
          );
          if (crossed.includes(2 * k + (value ? 1 : 0))) label.append(this.cross());
          if (marks[k] === value) {
            label.append(this.circle(fresh?.statement === k && fresh.value === (value ? 1 : 0)));
          }
          const truth =
            texts.question.type === 'true-false' && texts.question.statements[k]?.true === value;
          if (marked && truth && marks[k] !== value)
            label.append(this.circle(false, 'paper-ink-red'));
          cell.append(label);
          cell.addEventListener('click', () =>
            this.choose(paper, index, number, value ? 1 : 0, k, value),
          );
          cells.append(cell);
        }
        if (marked) {
          const statement =
            texts.question.type === 'true-false' ? texts.question.statements[k] : undefined;
          li.append(el('span', 'paper-tick', statement && marks[k] === statement.true ? '✓' : '✗'));
        }
        li.append(cells);
        rows.append(li);
      });
      block.append(rows);
    }
    if (marked) {
      const right = this.game.papers.grade(paper.id)?.items[index];
      block.classList.toggle('paper-right', right !== undefined && right.points === right.max);
      block.prepend(el('span', 'paper-verdict', right && right.points === right.max ? '✓' : '✗'));
    }
    return block;
  }

  /** An answer clicked: it is circled (the pen going round it), the question drawn again. */
  private choose(
    paper: PaperRecord,
    index: number,
    number: number,
    value: number,
    statement: number,
    truth?: boolean,
  ): void {
    const ok =
      truth === undefined
        ? this.game.papers.answer(paper.id, index, value)
        : this.game.papers.answer(paper.id, index, truth, statement);
    if (!ok) return;
    const old = this.sheet.querySelector(`section.paper-question[data-index="${index}"]`);
    old?.replaceWith(this.question(paper, index, number, { value, statement }));
  }

  /** The teacher's sheet: the mark by experiment, what went well, what to work on, and why. */
  private feedback(paper: PaperRecord): HTMLElement {
    const t = this.game.texts;
    const papers = this.game.papers;
    const grade = papers.grade(paper.id);
    const sheet = el('section', 'paper-feedback');
    sheet.append(el('h3', 'paper-part', t.ui('paper.feedback', "THE TEACHER'S NOTES")));
    if (!grade) return sheet;
    const whole = grade.items.filter((i) => i.max > 0 && i.points === i.max).length;
    sheet.append(
      el(
        'p',
        'paper-note',
        t.ui('paper.summary', 'Mark: {score}/10 — {right} of {count} questions fully right.', {
          score: papers.score(grade.score),
          right: whole,
          count: paper.items.length,
        }),
      ),
    );
    // By experiment: its points of the most.
    const by = new Map<string, { points: number; max: number }>();
    paper.items.forEach((item, i) => {
      const got = grade.items[i];
      const sum = by.get(item.experiment) ?? { points: 0, max: 0 };
      sum.points += got?.points ?? 0;
      sum.max += got?.max ?? 0;
      by.set(item.experiment, sum);
    });
    const list = el('ul', 'paper-list');
    for (const [id, sum] of by) {
      const definition = this.game.content.experiments.tryGet(id);
      list.append(
        el(
          'li',
          undefined,
          `${definition ? t.of(definition, 'name') : id}: ${papers.score(Math.round(sum.points * 100) / 100)} / ${papers.score(sum.max)}`,
        ),
      );
    }
    sheet.append(list);
    // Skills: well done, and the gaps with how to study them.
    const good: string[] = [];
    const gaps = el('ul', 'paper-list');
    for (const tally of grade.skills) {
      const skill = papers.bank(tally.experiment)?.skills.find((s) => s.id === tally.skill);
      if (!skill) continue;
      if (tally.right === tally.total) {
        good.push(t.of(skill, 'name'));
        continue;
      }
      const li = el('li');
      li.append(
        el('strong', undefined, `${t.of(skill, 'name')} (${tally.right}/${tally.total})`),
        el('p', 'paper-advice', t.of(skill, 'advice')),
      );
      gaps.append(li);
    }
    if (good.length > 0) {
      sheet.append(
        el('h4', undefined, t.ui('paper.good', 'Well done')),
        el('p', 'paper-note', good.join(' · ')),
      );
    }
    if (gaps.childElementCount > 0) {
      sheet.append(el('h4', undefined, t.ui('paper.gaps', 'To work on — and how')), gaps);
    }
    // Why each missed answer is what it is.
    const missed = el('ol', 'paper-list');
    let number = 0;
    const order = [
      ...paper.items.flatMap((item, i) => (item.order.length > 0 ? [i] : [])),
      ...paper.items.flatMap((item, i) => (item.order.length > 0 ? [] : [i])),
    ];
    for (const i of order) {
      number++;
      const got = grade.items[i];
      const item = paper.items[i];
      const texts: PaperItemTexts | null = item ? papers.textsOf(item) : null;
      if (!got || got.points === got.max || !texts) continue;
      const li = el('li');
      li.append(
        el('strong', undefined, t.ui('paper.number', 'Question {n}.', { n: number })),
        ' ',
        ...this.formula(texts.explain),
      );
      missed.append(li);
    }
    if (missed.childElementCount > 0) {
      sheet.append(el('h4', undefined, t.ui('paper.why', 'The questions missed')), missed);
    }
    return sheet;
  }

  /** A circle of ink round a letter: drawn by the pen now (`fresh`), or there already. */
  private circle(fresh: boolean, extra = ''): SVGSVGElement {
    const ink = svg('svg', {
      class: `paper-ink ${extra}${fresh ? ' paper-ink-fresh' : ''}`,
      viewBox: '0 0 32 26',
      'aria-hidden': 'true',
    });
    ink.append(svg('path', { d: CIRCLE, pathLength: 100 }));
    if (fresh) {
      // The pen going round the circle as it draws it.
      const pen = svg('g', { class: 'paper-pen' });
      pen.append(
        svg('path', { d: 'M 0 0 L 3 -11 L 7 -10 Z' }),
        svg('path', { d: 'M 3 -11 L 9 -21 L 13 -20 L 7 -10 Z', class: 'paper-pen-body' }),
      );
      (pen as unknown as HTMLElement).style.offsetPath = `path('${CIRCLE}')`;
      ink.append(pen);
    }
    return ink;
  }

  /** A choice taken back: crossed out. */
  /** A question's text as the teacher wrote it: subscripts, exponents, fractions, 0,5. */
  private formula(text: string): Node[] {
    return formulaNodes(text, this.game.language);
  }

  private cross(): SVGSVGElement {
    const ink = svg('svg', {
      class: 'paper-ink paper-ink-cross',
      viewBox: '0 0 32 26',
      'aria-hidden': 'true',
    });
    for (const d of CROSS) ink.append(svg('path', { d }));
    return ink;
  }
}
