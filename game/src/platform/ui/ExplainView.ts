import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { ExplainAnchor } from '../render/explainFraming';
import { listen } from '../BrowserInput';
import { el, keyLabel } from './dom';
import { showFormula } from './formulaHtml';

/** How often (s) the "H Explain" hint looks for a station in reach. */
const HINT_S = 0.25;
/** A label's box beside its point (CSS px). */
const LABEL = { dx: 22, dy: -14, gap: 6, height: 26 };

/**
 * The Explain view on screen (Phase X): a panel on the right — the experiment in one sentence, the
 * principle step by step (Prev / Next, ← →), RUN and RESET to watch a run up close, Close (H, Esc)
 * — and a label on each part of the apparatus, a leader line to it, the parts of the shown step
 * lit with their role. The camera is the renderer's (ExplainFraming); the labels' points come
 * from it every frame. Out of the view, a hint names the key while a station is in reach. While the
 * hub's teacher lectures at it (Phase Y-2) the panel steps aside for his words and the parts he
 * speaks of are lit. It only asks the ExplainSystem, the stations and the people; it changes
 * nothing itself.
 */
export class ExplainView implements GameSystem {
  readonly id = 'explain-view';
  private readonly root = el('div', 'explain hidden');
  private readonly labels = el('div', 'explain-labels');
  private readonly lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly panel = el('aside', 'explain-panel');
  private readonly title = el('h2', 'explain-title');
  private readonly summary = el('p', 'explain-summary');
  private readonly count = el('div', 'explain-count');
  private readonly text = el('p', 'explain-step');
  private readonly prev = el('button', 'explain-button');
  private readonly next = el('button', 'explain-button primary');
  private readonly run = el('button', 'explain-button');
  private readonly reset = el('button', 'explain-button');
  private readonly close = el('button', 'explain-button');
  private readonly hint = el('div', 'explain-hint hidden');
  private readonly subscriptions = new Disposables();
  private tags: { root: HTMLElement; role: HTMLElement; line: SVGLineElement; id: string }[] = [];
  private readonly order: number[] = [];
  private since = Infinity;
  private open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly host: HTMLElement,
    private readonly anchors: (width: number, height: number) => readonly ExplainAnchor[],
    private readonly capture: () => Promise<void>,
  ) {}

  /** The view is open and has the mouse (the pause menu does not pause for it). */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.lines.setAttribute('class', 'explain-lines');
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-live', 'polite');
    for (const b of [this.prev, this.next, this.run, this.reset, this.close]) b.type = 'button';
    const nav = el('div', 'explain-nav');
    nav.append(this.prev, this.count, this.next);
    const controls = el('div', 'explain-controls');
    controls.append(this.run, this.reset, this.close);
    this.panel.append(this.title, this.summary, nav, this.text, controls);
    this.labels.append(this.lines);
    this.root.append(this.labels, this.panel);
    this.parent.append(this.root, this.hint);
    const step = (by: number) => {
      const open = this.game.explain.current;
      if (open) this.game.explain.show(open.step + by);
    };
    this.prev.addEventListener('click', () => step(-1));
    this.next.addEventListener('click', () => step(1));
    this.run.addEventListener('click', () => this.command('run'));
    this.reset.addEventListener('click', () => this.command('reset'));
    this.close.addEventListener('click', () => this.game.explain.close());
    const s = this.subscriptions;
    s.add(events.subscribe('ExplainOpened', () => this.opened()));
    s.add(events.subscribe('ExplainClosed', () => this.closed()));
    s.add(events.subscribe('ExplainStepChanged', () => this.render()));
    // A lecture's line names the parts it is about.
    for (const name of [
      'ConversationOpened',
      'ConversationChanged',
      'ConversationClosed',
    ] as const) {
      s.add(events.subscribe(name, () => this.open && this.render()));
    }
    s.add(
      events.subscribe('LanguageChanged', () => {
        this.renderHint();
        this.rebuild();
      }),
    );
    this.renderHint();
    // While open the view has the keyboard: ← → steps, H or Esc closes (no pause), F3 passes.
    listen(s, document, 'keydown', (event) => this.key(event));
    listen(s, document, 'pointerlockchange', () => {
      if (this.open && document.pointerLockElement === this.host) document.exitPointerLock();
    });
  }

  update(dt: number): void {
    if (this.open) {
      this.place();
      return;
    }
    this.since += dt;
    if (this.since < HINT_S) return;
    this.since = 0;
    const { state } = this.game;
    const near =
      state.session.phase === 'playing' &&
      !state.session.paused &&
      (state.session.workspace ?? null) === null &&
      (state.session.conversation ?? null) === null &&
      this.game.explain.aimed() !== null;
    this.hint.classList.toggle('hidden', !near);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
    this.hint.remove();
  }

  private command(command: 'run' | 'reset'): void {
    const open = this.game.explain.current;
    if (open) this.game.events.publish('ExperimentCommand', { stationId: open.stationId, command });
  }

  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    if (this.game.config.input.bindings.toggleDebug.includes(event.code)) return;
    const closes =
      event.key === 'Escape' || this.game.config.input.bindings.explain.includes(event.code);
    const open = this.game.explain.current;
    if (closes) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) this.game.explain.close();
    } else if (
      open &&
      !this.lecturing &&
      (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.game.explain.show(open.step + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  private opened(): void {
    this.open = true;
    this.hint.classList.add('hidden');
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock(); // the panel needs the mouse
    this.rebuild();
  }

  private closed(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.add('hidden');
    this.capture().catch(() => undefined); // refused: the HUD says to click the scene
  }

  /** The labels, made again for the open view's parts (opening, a language change). */
  private rebuild(): void {
    const { texts: t } = this.game;
    const explain = this.game.explain.explain;
    for (const tag of this.tags) {
      tag.root.remove();
      tag.line.remove();
    }
    this.tags = (explain?.parts ?? []).map((part) => {
      const root = el('div', 'explain-tag');
      const role = el('span', 'explain-role');
      showFormula(role, t.of(part, 'role'), this.game.language);
      root.append(el('strong', undefined, t.of(part, 'name')), role);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.lines.append(line);
      this.labels.append(root);
      return { root, role, line, id: part.id };
    });
    this.render();
  }

  /** The panel and which tags are lit (on events, not per frame). */
  private render(): void {
    const { texts: t, config } = this.game;
    const open = this.game.explain.current;
    const explain = this.game.explain.explain;
    const view = open ? this.game.stations.view(open.stationId) : null;
    if (!open || !explain || !view) return;
    const step = explain.steps[open.step];
    const lecturing = this.lecturing;
    this.root.classList.toggle('lecturing', lecturing);
    const lit = new Set(lecturing ? (this.game.npcs.say?.parts ?? []) : (step?.parts ?? []));
    const key = keyLabel(config.input.bindings.explain[0] ?? 'KeyH', t);
    this.panel.setAttribute('aria-label', t.of(view.definition, 'name'));
    this.title.textContent = t.of(view.definition, 'name');
    showFormula(this.summary, t.of(explain, 'summary'), this.game.language);
    this.count.textContent = t.ui('explain.step', 'Step {n} of {total}', {
      n: open.step + 1,
      total: explain.steps.length,
    });
    showFormula(this.text, step ? t.of(step, 'text') : '', this.game.language);
    this.prev.textContent = t.ui('explain.prev', '← Back');
    this.next.textContent = t.ui('explain.next', 'Next →');
    this.prev.disabled = open.step === 0;
    this.next.disabled = open.step >= explain.steps.length - 1;
    this.run.textContent = t.ui('explain.run', 'Run');
    this.reset.textContent = t.ui('explain.reset', 'Reset');
    this.close.textContent = t.ui('explain.close', 'Close ({key})', { key });
    for (const tag of this.tags) tag.root.classList.toggle('lit', lit.has(tag.id));
  }

  /** The teacher lectures at the open view's station (his conversation is about it). */
  private get lecturing(): boolean {
    const open = this.game.explain.current;
    return open !== null && this.game.state.session.conversation?.stationId === open.stationId;
  }

  /** The hint's key and words (at start and on a language change). */
  private renderHint(): void {
    const { texts: t, config } = this.game;
    const key = keyLabel(config.input.bindings.explain[0] ?? 'KeyH', t);
    this.hint.replaceChildren(
      el('kbd', undefined, key),
      el('span', undefined, ` ${t.ui('explain.hint', 'Explain this experiment')}`),
    );
  }

  /** The tags at their parts' points this frame, pushed apart where they would overlap. */
  private place(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const points = this.anchors(width, height);
    // Top to bottom by their points (an insertion sort: nothing allocated a frame), each tag
    // below the one before it when they would overlap.
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < this.tags.length; i++) {
      const y = points[i]?.y;
      if (y === undefined) continue;
      let j = order.length;
      while (j > 0 && (points[order[j - 1] ?? 0]?.y ?? 0) > y) {
        order[j] = order[j - 1] ?? 0;
        j--;
      }
      order[j] = i;
    }
    let lastBottom = -Infinity;
    for (const i of order) {
      const tag = this.tags[i];
      const point = points[i];
      if (!tag || !point) continue;
      tag.root.classList.toggle('hidden', !point.shown);
      tag.line.setAttribute('visibility', point.shown ? 'visible' : 'hidden');
      if (!point.shown) continue;
      const top = Math.max(point.y + LABEL.dy - LABEL.height / 2, lastBottom + LABEL.gap);
      const left = point.x + LABEL.dx;
      lastBottom = top + tag.root.offsetHeight;
      tag.root.style.transform = `translate(${left.toFixed(0)}px, ${top.toFixed(0)}px)`;
      tag.line.setAttribute('x1', point.x.toFixed(1));
      tag.line.setAttribute('y1', point.y.toFixed(1));
      tag.line.setAttribute('x2', left.toFixed(1));
      tag.line.setAttribute('y2', (top + LABEL.height / 2).toFixed(1));
    }
  }
}
