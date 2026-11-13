import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type * as BooksModule from '../../content/books';
import type { Book, BookSubject, Lesson } from '../../content/books';
import type { Game } from '../../game/Game';
import { clockText } from '../../world/clock';
import { listen } from '../BrowserInput';
import { el, svg } from './dom';
import { formulaNodes } from './formulaHtml';

type Books = typeof BooksModule;

const SUBJECTS: readonly BookSubject[] = ['physics', 'chemistry', 'biology'];
const GRADES = [10, 11, 12] as const;
/** The start-up's length (ms), and how long the last screen fades (ms). */
const BOOT_MS = 5600;
const FADE_MS = 500;

/**
 * The hub's laptop (Phú, Phase F-2): E on it opens this view over the game. It starts up (the
 * SimLab emblem drawn in light, its orbits and electrons, the wordmark, over a grid running into
 * the distance; a click or Space skips it), then shows its desktop: nine files, the knowledge
 * books of Physics, Chemistry and Biology for grades 10, 11 and 12 (`content/books`, fetched when
 * opened). A book opens in its reader: its contents on the left, a lesson on the right laid out
 * as a textbook page — its opening question, sections with their formulas drawn as a teacher
 * writes them, a worked example, a tip, what to remember, a question to check oneself with its
 * answer hidden, and the SimLab experiment that goes with it. Esc goes back (book → desktop →
 * the game). While open it has the mouse and the keyboard; the game goes on behind it.
 */
export class LaptopView implements GameSystem {
  readonly id = 'laptop-view';
  private readonly root = el('div', 'laptop hidden');
  private readonly screen = el('div', 'laptop-screen');
  private open = false;
  private state: 'boot' | 'desktop' | 'book' = 'boot';
  private bootTimer: number | null = null;
  private books: Books | null = null;
  private book: Book | null = null;
  private lesson = 0;
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly surface: HTMLElement,
    private readonly capture: () => Promise<void>,
  ) {}

  /** Whether it is open: it has the mouse then, so freeing it is not a pause. */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.root.setAttribute('role', 'dialog');
    this.root.append(this.screen);
    this.parent.append(this.root);
    const s = this.subscriptions;
    s.add(events.subscribe('LaptopOpened', () => this.show()));
    s.add(events.subscribe('SceneLoading', () => this.hide(false)));
    s.add(
      events.subscribe('PauseChanged', ({ paused }) => {
        if (paused) this.hide(false);
      }),
    );
    listen(s, document, 'keydown', (event) => this.key(event));
    listen(s, document, 'pointerlockchange', () => {
      if (this.open && document.pointerLockElement === this.surface) document.exitPointerLock();
    });
  }

  update(): void {
    // Its clock follows the game's (a game minute is 0.625 s).
    const clock = this.screen.querySelector('.laptop-clock');
    if (this.open && clock) {
      const text = clockText(this.game.state.world.clockS);
      if (clock.textContent !== text) clock.textContent = text;
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    if (this.bootTimer !== null) clearTimeout(this.bootTimer);
    this.root.remove();
  }

  private show(): void {
    if (this.open) return;
    this.open = true;
    this.game.input.reset();
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.classList.remove('hidden');
    this.root.setAttribute('aria-label', this.game.texts.ui('laptop.title', 'Laptop'));
    // The books' code and index start loading now: the start-up hides the wait.
    void import('../../content/books').then((module) => (this.books = module));
    this.boot();
  }

  private hide(capture: boolean): void {
    if (!this.open) return;
    this.open = false;
    if (this.bootTimer !== null) clearTimeout(this.bootTimer);
    this.bootTimer = null;
    this.root.classList.add('hidden');
    this.screen.replaceChildren();
    if (capture) this.capture().catch(() => undefined);
  }

  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    if (this.game.config.input.bindings.toggleDebug.includes(event.code)) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (event.repeat) return;
      if (this.state === 'book') this.desktop();
      else this.hide(true);
    } else if (this.state === 'boot' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      this.desktop();
    } else if (this.state === 'book' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      this.go(this.lesson + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  // ---- the start-up --------------------------------------------------------------------------

  private boot(): void {
    const t = this.game.texts;
    this.state = 'boot';
    const scene = el('div', 'laptop-boot');
    const grid = el('div', 'laptop-boot-grid');
    const glow = el('div', 'laptop-boot-glow');
    const emblem = atomEmblem('laptop-boot-emblem', true);
    const word = el('div', 'laptop-boot-word');
    for (const [i, letter] of ['S', 'I', 'M', 'L', 'A', 'B'].entries()) {
      const span = el('span', undefined, letter);
      span.style.animationDelay = `${1.9 + i * 0.09}s`;
      word.append(span);
    }
    const sweep = el('div', 'laptop-boot-sweep');
    const tagline = el(
      'div',
      'laptop-boot-tagline',
      t.ui('laptop.tagline', 'Science you can touch: Physics · Chemistry · Biology'),
    );
    const bar = el('div', 'laptop-boot-bar');
    bar.append(el('div', 'laptop-boot-bar-fill'));
    const skip = el('div', 'laptop-boot-skip', t.ui('laptop.skip', 'Click or press Space to skip'));
    scene.append(grid, glow, emblem, word, sweep, tagline, bar, skip);
    scene.addEventListener('click', () => this.desktop());
    this.screen.replaceChildren(scene);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bootTimer = window.setTimeout(() => this.desktop(), reduced ? 1200 : BOOT_MS);
  }

  // ---- the desktop ---------------------------------------------------------------------------

  private desktop(): void {
    if (this.bootTimer !== null) clearTimeout(this.bootTimer);
    this.bootTimer = null;
    const t = this.game.texts;
    const was = this.state;
    this.state = 'desktop';
    const desk = el('div', 'laptop-desktop');
    if (was === 'boot') desk.classList.add('laptop-fade-in');
    desk.append(atomEmblem('laptop-wallpaper-emblem', false));
    const head = el('header', 'laptop-desktop-head');
    head.append(
      el('h1', undefined, t.ui('laptop.library', 'SimLab knowledge library')),
      el(
        'p',
        undefined,
        t.ui('laptop.libraryLead', 'Choose a book: every lesson of the year, explained simply.'),
      ),
    );
    const columns = el('div', 'laptop-columns');
    for (const subject of SUBJECTS) {
      const column = el('section', `laptop-column subject-${subject}`);
      column.append(el('h2', undefined, subjectName(t, subject)));
      for (const grade of GRADES) {
        const file = el('button', `laptop-file subject-${subject}`);
        file.type = 'button';
        const icon = el('div', 'laptop-file-icon');
        icon.append(subjectGlyph(subject), el('span', 'laptop-file-grade', String(grade)));
        file.append(
          icon,
          el('span', 'laptop-file-name', `${subjectName(t, subject)} ${grade}`),
          el('span', 'laptop-file-kind', t.ui('laptop.fileKind', 'Book · SimLab')),
        );
        file.addEventListener('click', () => void this.openBook(`${subject}-${grade}`));
        column.append(file);
      }
      columns.append(column);
    }
    const taskbar = el('footer', 'laptop-taskbar');
    const start = el('div', 'laptop-taskbar-start');
    start.append(atomEmblem('laptop-taskbar-emblem', false), el('span', undefined, 'SimLab'));
    const off = el('button', 'laptop-off', t.ui('laptop.close', 'Close the laptop'));
    off.type = 'button';
    off.addEventListener('click', () => this.hide(true));
    taskbar.append(start, el('span', 'laptop-clock'), off);
    desk.append(head, columns, taskbar);
    this.screen.replaceChildren(desk);
    this.update();
  }

  // ---- a book ---------------------------------------------------------------------------------

  private async openBook(id: string): Promise<void> {
    const t = this.game.texts;
    const books = this.books ?? (this.books = await import('../../content/books'));
    // The labs' experiments (names for a lesson's "try it in SimLab") come with the lab pack.
    const [loaded] = await Promise.all([
      books.loadBook(id),
      this.game.loadLab().catch(() => undefined),
    ]);
    if (!this.open) return;
    if ('problem' in loaded) {
      this.game.log.warn(`Book ${id} could not be opened: ${loaded.problem}`);
      const note = el('div', 'laptop-note', t.ui('laptop.missing', 'This book is not ready yet.'));
      this.screen.querySelector('.laptop-desktop')?.append(note);
      return;
    }
    this.book = loaded;
    this.lesson = 0;
    this.state = 'book';
    this.renderBook();
  }

  private lessons(): Lesson[] {
    return this.book?.chapters.flatMap((c) => c.lessons) ?? [];
  }

  private go(index: number): void {
    const count = this.lessons().length;
    if (index < 0 || index >= count || index === this.lesson) return;
    this.lesson = index;
    this.renderBook();
  }

  private renderBook(): void {
    const book = this.book;
    if (!book) return;
    const t = this.game.texts;
    const lessons = this.lessons();
    const lesson = lessons[this.lesson];
    const reader = el('div', `laptop-reader subject-${book.subject}`);
    // The bar: back to the desktop, the book's title.
    const bar = el('header', 'laptop-reader-bar');
    const back = el(
      'button',
      'laptop-back',
      `← ${t.ui('laptop.library', 'SimLab knowledge library')}`,
    );
    back.type = 'button';
    back.addEventListener('click', () => this.desktop());
    bar.append(back, el('span', 'laptop-reader-title', book.title), el('span', 'laptop-clock'));
    // The contents.
    const toc = el('nav', 'laptop-toc');
    toc.append(el('p', 'laptop-toc-tagline', book.tagline));
    let index = 0;
    for (const chapter of book.chapters) {
      const group = el('div', 'laptop-toc-chapter');
      group.append(el('h3', undefined, chapter.title));
      for (const item of chapter.lessons) {
        const i = index++;
        const link = el(
          'button',
          i === this.lesson ? 'laptop-toc-lesson current' : 'laptop-toc-lesson',
          item.title,
        );
        link.type = 'button';
        link.addEventListener('click', () => this.go(i));
        group.append(link);
      }
      toc.append(group);
    }
    const page = el('article', 'laptop-page');
    if (lesson) this.renderLesson(page, lesson, lessons.length);
    const body = el('div', 'laptop-reader-body');
    body.append(toc, page);
    reader.append(bar, body);
    this.screen.replaceChildren(reader);
    toc.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
    this.update();
  }

  private renderLesson(page: HTMLElement, lesson: Lesson, count: number): void {
    const t = this.game.texts;
    const lang = this.game.language;
    const text = (tag: keyof HTMLElementTagNameMap, cls: string | undefined, s: string) => {
      const node = el(tag, cls);
      node.append(...formulaNodes(s, lang));
      return node;
    };
    page.append(
      el('div', 'laptop-page-kicker', `${this.lesson + 1} / ${count}`),
      text('h1', undefined, lesson.title),
    );
    const hook = el('aside', 'laptop-hook');
    hook.append(
      el('strong', undefined, t.ui('laptop.hook', 'Did you know?')),
      text('p', undefined, lesson.hook),
    );
    page.append(hook);
    for (const section of lesson.sections) {
      const block = el('section', 'laptop-section');
      block.append(text('h2', undefined, section.heading));
      for (const paragraph of section.paragraphs) block.append(text('p', undefined, paragraph));
      if (section.formulas) {
        const box = el('div', 'laptop-formulas');
        for (const formula of section.formulas) box.append(text('div', 'laptop-formula', formula));
        block.append(box);
      }
      if (section.example) {
        const example = el('div', 'laptop-example');
        example.append(
          el('strong', undefined, t.ui('laptop.example', 'Worked example')),
          text('p', 'laptop-example-question', section.example.question),
        );
        const steps = el('ol');
        for (const step of section.example.steps) steps.append(text('li', undefined, step));
        example.append(steps);
        block.append(example);
      }
      if (section.tip) {
        const tip = el('div', 'laptop-tip');
        tip.append(
          el('strong', undefined, t.ui('laptop.tip', 'Tip')),
          text('p', undefined, section.tip),
        );
        block.append(tip);
      }
      page.append(block);
    }
    const remember = el('div', 'laptop-remember');
    remember.append(el('strong', undefined, t.ui('laptop.remember', 'Remember')));
    const list = el('ul');
    for (const point of lesson.remember) list.append(text('li', undefined, point));
    remember.append(list);
    page.append(remember);
    const check = el('div', 'laptop-check');
    const answer = text('p', 'laptop-answer hidden', lesson.check.answer);
    const reveal = el('button', 'laptop-reveal', t.ui('laptop.reveal', 'Show the answer'));
    reveal.type = 'button';
    reveal.addEventListener('click', () => {
      answer.classList.remove('hidden');
      reveal.remove();
    });
    check.append(
      el('strong', undefined, t.ui('laptop.check', 'Check yourself')),
      text('p', undefined, lesson.check.question),
      reveal,
      answer,
    );
    page.append(check);
    if (lesson.lab) {
      const experiment = this.game.content.experiments.tryGet(lesson.lab);
      const name = experiment ? this.game.texts.of(experiment, 'name') : lesson.lab;
      page.append(
        el('div', 'laptop-lab', t.ui('laptop.lab', 'Try it in SimLab: {name}', { name })),
      );
    }
    const nav = el('div', 'laptop-page-nav');
    const previous = el('button', undefined, `← ${t.ui('laptop.previous', 'Previous lesson')}`);
    const next = el('button', undefined, `${t.ui('laptop.next', 'Next lesson')} →`);
    for (const b of [previous, next]) b.type = 'button';
    previous.disabled = this.lesson === 0;
    next.disabled = this.lesson >= count - 1;
    previous.addEventListener('click', () => this.go(this.lesson - 1));
    next.addEventListener('click', () => this.go(this.lesson + 1));
    nav.append(previous, next);
    page.append(nav);
    page.scrollTop = 0;
  }
}

function subjectName(t: Game['texts'], subject: BookSubject): string {
  return subject === 'physics'
    ? t.ui('laptop.physics', 'Physics')
    : subject === 'chemistry'
      ? t.ui('laptop.chemistry', 'Chemistry')
      : t.ui('laptop.biology', 'Biology');
}

/** The SimLab emblem: a nucleus and three orbits, electrons running round them when `alive`. */
function atomEmblem(cls: string, alive: boolean): SVGSVGElement {
  const image = svg('svg', { class: cls, viewBox: '-60 -60 120 120', 'aria-hidden': 'true' });
  [0, 60, 120].forEach((turn, i) => {
    const orbit = svg('ellipse', {
      cx: 0,
      cy: 0,
      rx: 52,
      ry: 19,
      transform: `rotate(${turn})`,
      class: 'laptop-orbit',
      style: `animation-delay:${0.4 + i * 0.25}s`,
    });
    // Starting up, each orbit comes spinning in round the nucleus and settles into its place;
    // its electron sets off once it has (Phú, 2026-11-12).
    const spin = svg('g', {
      class: alive ? 'laptop-orbit-spin' : '',
      style: `--from:${[-540, 420, -300][i] ?? 0}deg; animation-delay:${0.3 + i * 0.22}s`,
    });
    spin.append(orbit);
    image.append(spin);
    if (alive) {
      const electron = svg('circle', { r: 3.4, class: 'laptop-electron' });
      const motion = svg('animateMotion', {
        dur: `${2.4 + i * 0.5}s`,
        repeatCount: 'indefinite',
        begin: `${2.5 + i * 0.2}s`,
        path: 'M 52 0 A 52 19 0 1 1 -52 0 A 52 19 0 1 1 52 0',
      });
      const turned = svg('g', { transform: `rotate(${turn})` });
      electron.append(motion);
      turned.append(electron);
      spin.append(turned);
    }
  });
  image.append(svg('circle', { r: 8, class: 'laptop-nucleus' }));
  return image;
}

/** A file's picture: an atom (Physics), a flask (Chemistry), a leaf (Biology). */
function subjectGlyph(subject: BookSubject): SVGSVGElement {
  const image = svg('svg', {
    class: 'laptop-file-glyph',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  });
  const path =
    subject === 'physics'
      ? 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M2 12c0-2.8 4.5-5 10-5s10 2.2 10 5-4.5 5-10 5S2 14.8 2 12z M7 3.3c2.4-1.4 6.6 1.4 9.4 6.2s3 9.9.6 11.3-6.6-1.4-9.4-6.2S4.6 4.7 7 3.3z'
      : subject === 'chemistry'
        ? 'M9 2h6M10 2v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 8V2M7 15h10'
        : 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l8-8';
  image.append(
    svg('path', {
      d: path,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return image;
}

export { FADE_MS };
