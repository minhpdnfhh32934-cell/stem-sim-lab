import { Disposables } from '../../../core/EventBus';
import type { Game } from '../../../game/Game';
import type { ResultsPanel } from '../ResultsPanel';
import type { StationView } from '../../../gameplay/experiment/StationSystem';
import type { ExperimentWorkspace, WorkspacePiece } from '../../../simulation/experiment';
import { runLabels } from '../results';
import { listen } from '../../BrowserInput';
import { el } from '../dom';
import { type ScreenPoint, projectToScreen } from './anchor';
import { Callout } from './Callout';
import { WorkspaceController } from './controller';
import { type WorkspaceLabels, workspaceLabels } from './labels';
import { LiveGraph } from './LiveGraph';
import { WORKSPACE_LAYOUTS, readableInk, regionOf } from './layouts';
import { PieceResolver, WORKSPACE_PIECES } from './registry';
import './workspace.css';
import { acceptingPieces, currentStage, libraryItems, stageChips, type LibraryItem } from './state';
import type { PieceView } from './types';

/** How often live text (time, readouts, results) is rewritten while a run goes, in seconds. */
const TEXT_S = 0.1;

interface Mounted {
  readonly piece: WorkspacePiece;
  readonly wrapper: HTMLElement;
  readonly select: HTMLButtonElement;
  readonly view: PieceView;
  /** False once its view threw: it is left as it was, the workspace goes on. */
  ok: boolean;
}

/** Stands in for a kind with no registered view: the piece's name, said to be drawn later. */
const placeholder = (label: string): PieceView => ({
  mount(root) {
    root.append(el('p', 'ws-placeholder', label));
  },
  update() {},
  dispose() {},
});

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text;
};

const setAttr = (node: Element, name: string, value: string): void => {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};

/**
 * The experiment workspace: opened from an apparatus (`WorkspaceOpened`), it covers the 3D lab
 * (or, for `bench-embedded`, stands beside the apparatus) with the layout of the definition's
 * `presentation` — library, stage with the pieces, notebook, lifecycle bar. Presentation only:
 * every control sends a station command and shows the station's refusal; nothing here decides a
 * rule, reads a subject or an experiment id, or invents a value. A lazy chunk (the menu never
 * downloads it), created and driven by `WorkspaceLoader`.
 */
export class WorkspaceHost {
  readonly root = el('div', 'workspace hidden');
  private readonly parts = new Disposables();
  private readonly resolver: PieceResolver;
  private controller: WorkspaceController | null = null;
  private view: StationView | null = null;
  private workspace: ExperimentWorkspace | null = null;
  private labels: WorkspaceLabels;
  private pieces: Mounted[] = [];
  private regions = new Map<string, HTMLElement>();
  private callout: Callout | null = null;
  private graph: LiveGraph | null = null;
  private results: ResultsPanel | null = null;
  private resultsLoad: Promise<void> | null = null;
  private clock = 0;
  private lastText = -Infinity;
  private shownKey = '';
  private heroChoice: 0 | 1 | null = null;
  private previousSelected: string | null = null;
  private previousHeld: string | null = null;
  private anchorPoint: ScreenPoint = { x: 0, y: 0, visible: false };
  // Nodes the host rewrites (built in `build`, kept for `sync`).
  private ui = this.emptyUi();

  constructor(
    private readonly game: Game,
    private readonly parent: HTMLElement,
  ) {
    this.labels = workspaceLabels(game.texts);
    this.resolver = new PieceResolver(WORKSPACE_PIECES, (kind) =>
      game.log.warn(`No workspace view is registered for the piece kind "${kind}"`),
    );
    this.parent.append(this.root);
  }

  get stationId(): string | null {
    return this.controller?.stationId ?? null;
  }

  /** Builds and shows the workspace of `stationId`; false when that apparatus has none. */
  open(stationId: string): boolean {
    this.close();
    const { game } = this;
    const view = game.stations.view(stationId);
    const workspace = view?.definition.workspace;
    if (!view || !workspace || view.definition.presentation === 'physical-3d') return false;
    this.view = view;
    this.workspace = workspace;
    this.labels = workspaceLabels(game.texts);
    this.controller = new WorkspaceController(
      {
        events: game.events,
        texts: game.texts,
        stations: game.stations,
        closeWorkspace: () => game.workspace.close(),
      },
      stationId,
      workspace,
    );
    this.build(view, workspace, this.controller);
    this.root.classList.remove('hidden');
    this.relayout();
    listen(this.parts, window, 'resize', () => this.relayout());
    this.parts.add(game.events.subscribe('LanguageChanged', () => this.reopen()));
    this.parts.add(
      game.events.subscribe('ExperimentStateChanged', ({ sessionId, state }) => {
        if (sessionId !== stationId) return;
        const l = this.labels;
        this.say(
          state === 'running'
            ? l.started
            : state === 'completed'
              ? l.finished
              : state === 'stopped'
                ? l.halted
                : '',
        );
      }),
    );
    this.root.focus();
    return true;
  }

  /** Puts the workspace away: pieces disposed, listeners released, the DOM emptied. */
  close(): void {
    if (this.controller === null) return;
    for (const m of this.pieces) m.view.dispose();
    this.pieces = [];
    this.parts.dispose();
    this.controller.dispose();
    this.controller = null;
    this.view = null;
    this.workspace = null;
    this.callout = null;
    this.graph = null;
    this.results?.hide();
    this.regions.clear();
    this.root.replaceChildren();
    this.root.classList.add('hidden');
    this.shownKey = '';
    this.heroChoice = null;
    this.previousSelected = null;
    this.previousHeld = null;
    this.ui = this.emptyUi();
  }

  /** Esc: closes the innermost layer, else the workspace. Returns whether a layer closed. */
  escape(): boolean {
    const controller = this.controller;
    if (!controller) return false;
    const closed = controller.escape();
    if (closed) this.sync();
    return closed;
  }

  /** Per frame: nothing is rebuilt or allocated unless something changed or a run goes. */
  update(dt: number): void {
    const controller = this.controller;
    if (!controller) return;
    this.clock += dt;
    if (controller.take()) this.sync();
    const view = this.view;
    if (!view || view.session.state !== 'running') return;
    for (const m of this.pieces) this.updatePiece(m, view);
    this.graph?.tick(this.clock);
    if (this.clock - this.lastText < TEXT_S) return;
    this.lastText = this.clock;
    setText(this.ui.time, this.time(view));
    this.callout?.refresh(view);
    if (this.results?.visible && this.results.followsCurrentRun) this.results.show(view);
  }

  // ---- building -------------------------------------------------------------------------------

  private emptyUi() {
    return {
      crumbs: el('ol', 'ws-crumbs'),
      stages: el('ol', 'ws-stages'),
      briefButton: el('button', 'ws-brief-button'),
      library: el('aside', 'ws-library'),
      stage: el('main', 'ws-stage'),
      hero: el('div', 'ws-hero-toggle'),
      notebook: el('aside', 'ws-notebook'),
      runs: el('ol', 'ws-runs'),
      resultsButton: el('button', 'ws-results-button'),
      state: el('span', 'ws-state'),
      time: el('span', 'ws-time'),
      line: el('p', 'ws-line'),
      live: el('div', 'ws-live'),
      buttons: new Map<string, HTMLButtonElement>(),
      brief: el('section', 'ws-sheet ws-brief hidden'),
      briefBody: el('div', 'ws-sheet-body'),
      resultsSheet: el('section', 'ws-sheet ws-results hidden'),
      items: new Map<string, HTMLButtonElement>(),
      card: el('div', 'ws-card'),
    };
  }

  private build(
    view: StationView,
    workspace: ExperimentWorkspace,
    controller: WorkspaceController,
  ): void {
    const { game } = this;
    const t = game.texts;
    const l = this.labels;
    const definition = view.definition;
    const layout = WORKSPACE_LAYOUTS[definition.presentation];
    const ui = this.ui;
    const act = (fn: () => void) => () => {
      fn();
      this.sync();
    };
    const button = (cls: string, text: string, onClick: () => void) => {
      const b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', act(onClick));
      return b;
    };

    // The lab's look comes from its data: accent and stage surface, the ink that reads on it.
    const lab = game.content.laboratories.all().find((x) => x.experiments.includes(definition.id));
    const style = this.root.style;
    style.removeProperty('--lab-accent');
    style.removeProperty('--lab-stage');
    style.removeProperty('--lab-stage-ink');
    if (lab?.accent) style.setProperty('--lab-accent', lab.accent);
    if (lab?.stage) {
      style.setProperty('--lab-stage', lab.stage);
      style.setProperty('--lab-stage-ink', readableInk(lab.stage));
    }
    this.root.dataset.presentation = definition.presentation;
    this.root.dataset.overlay = layout.overlay;
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', layout.overlay === 'full' ? 'true' : 'false');
    this.root.setAttribute('aria-label', l.dialog(t.of(definition, 'name')));

    // Top bar: Exit, where you are, the lifecycle chips, the Brief.
    const exit = button('ws-exit', `◂ ${l.exit}`, () => game.workspace.close());
    exit.append(el('kbd', undefined, l.exitHint));
    const bench = game.world.entity(controller.stationId)?.item;
    // lab › bench › experiment: the parts the data gives, in order.
    for (const part of [
      lab && t.of(lab, 'displayName'),
      bench && t.of(bench, 'displayName'),
      t.of(definition, 'name'),
    ]) {
      if (part) ui.crumbs.append(el('li', undefined, part));
    }
    const crumbs = el('nav', 'ws-here');
    crumbs.setAttribute('aria-label', l.here);
    crumbs.append(ui.crumbs);
    ui.stages.setAttribute('aria-label', l.progress);
    ui.briefButton.type = 'button';
    ui.briefButton.textContent = l.brief;
    ui.briefButton.setAttribute('aria-haspopup', 'dialog');
    ui.briefButton.addEventListener(
      'click',
      act(() => controller.open('brief')),
    );
    const top = el('header', 'ws-top');
    top.append(exit, crumbs, ui.stages, ui.briefButton);

    // Library: what the definition lets the player use; choosing then placing (click or Enter).
    const items = libraryItems(workspace);
    ui.library.setAttribute('aria-label', l.library);
    if (items.length === 0) ui.library.classList.add('hidden');
    else {
      const groups: [string, LibraryItem[]][] = [
        [l.materials, items.filter((i) => i.kind === 'material')],
        [l.equipment, items.filter((i) => i.kind === 'equipment')],
      ];
      ui.library.append(el('p', 'ws-hint', l.libraryHint));
      for (const [title, group] of groups) {
        if (group.length === 0) continue;
        const list = el('div', 'ws-items');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', title);
        for (const item of group) {
          const label =
            item.kind === 'material' ? t.of(item.material, 'label') : t.of(item.piece, 'label');
          const formula = item.kind === 'material' ? item.material.formula : undefined;
          const b = button('ws-item', label, () => controller.hold(item));
          b.setAttribute('aria-pressed', 'false');
          if (formula) b.append(el('span', 'ws-formula', formula));
          ui.items.set(item.id, b);
          list.append(b);
        }
        ui.library.append(el('h2', 'ws-heading', title), list);
      }
    }

    // Stage: the regions of the layout, each holding the pieces whose slot names it.
    ui.stage.setAttribute('aria-label', l.stage);
    for (const name of layout.regions) {
      const region = el('div', 'ws-region');
      region.dataset.region = name;
      this.regions.set(name, region);
    }
    const heroBar = this.buildHero(layout.hero);
    ui.stage.append(...(heroBar ? [heroBar] : []), ...this.regions.values());
    this.pieces = workspace.pieces.map((piece) => this.mountPiece(piece, layout, controller));
    ui.stage.addEventListener('keydown', (event) => this.stageKey(event));

    // Callout of the selected piece, and the live monitor graph.
    const callout = new Callout(t, controller, () => {
      controller.closeLayer('callout');
      this.sync();
    });
    this.callout = callout;
    ui.stage.append(callout.root);
    this.graph = new LiveGraph(t);
    this.graph.show(view);

    // Notebook: the graph (unless docked), the runs and the way to the results.
    ui.notebook.setAttribute('aria-label', l.notebook);
    ui.resultsButton.type = 'button';
    ui.resultsButton.addEventListener('click', () => {
      controller.send({ command: 'view' });
      this.sync();
    });
    const runsHeading = el('h2', 'ws-heading', l.runs);
    ui.notebook.append(
      ...(layout.monitor === 'notebook' ? [this.graph.root] : []),
      runsHeading,
      ui.runs,
      ui.resultsButton,
    );
    if (layout.monitor !== 'notebook') {
      ui.stage.append(this.graph.root);
      this.graph.root.classList.add(layout.monitor === 'card' ? 'ws-curve-card' : 'ws-graph-dock');
      if (layout.monitor === 'card') this.graph.root.prepend(this.collapseButton(this.graph.root));
    }
    if (layout.overlay === 'anchored') {
      // The apparatus stays the hero: its pieces stand in a card at its projected position.
      // The library, when the definition has one, stands in the card: a setup step must stay doable.
      ui.card.append(
        ...(items.length > 0 ? [ui.library] : []),
        el('h2', 'ws-heading', l.pieces),
        ...this.pieces.map((m) => m.wrapper),
      );
      ui.stage.replaceChildren(ui.card, callout.root, this.graph.root);
      ui.stage.classList.add('ws-anchored');
    }

    // Lifecycle bar: state, RUN / STOP / RESET (and Clear), and the refusal line.
    const verb = t.of(workspace, 'runLabel') || l.run;
    const bar = el('footer', 'ws-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', l.bar);
    const command = (id: 'run' | 'stop' | 'reset' | 'clear', text: string) => {
      const b = button(`ws-command ws-${id}`, text, () => controller.send({ command: id }));
      ui.buttons.set(id, b);
      return b;
    };
    ui.line.setAttribute('aria-live', 'polite');
    ui.live.setAttribute('aria-live', 'polite');
    ui.live.classList.add('sr-only');
    bar.append(
      ui.state,
      ui.time,
      command('run', verb),
      command('stop', l.stop),
      command('reset', l.reset),
      ...(workspace.setup.length > 0 ? [command('clear', l.clear)] : []),
      ui.line,
    );

    // Brief and results sheets.
    const briefClose = button('ws-close', l.close, () => controller.closeLayer('brief'));
    ui.brief.setAttribute('role', 'dialog');
    ui.brief.setAttribute('aria-label', l.briefTitle);
    ui.brief.append(briefClose, ui.briefBody);
    const resultsClose = button('ws-close', l.close, () => controller.closeLayer('results'));
    ui.resultsSheet.setAttribute('role', 'dialog');
    ui.resultsSheet.setAttribute('aria-label', l.resultsTitle);
    ui.resultsSheet.append(resultsClose);
    if (this.results) ui.resultsSheet.append(this.results.root); // loaded by an earlier opening

    this.root.append(
      top,
      ...(layout.overlay === 'anchored' ? [] : [ui.library]),
      ui.stage,
      bar,
      ui.notebook,
      ui.brief,
      ui.resultsSheet,
      ui.live,
    );
    this.sync(true);
  }

  /** The curve card can be folded away, leaving its title: the apparatus stays in view. */
  private collapseButton(card: HTMLElement): HTMLButtonElement {
    const l = this.labels;
    const b = el('button', 'ws-fold', l.hideCard);
    b.type = 'button';
    b.setAttribute('aria-expanded', 'true');
    b.addEventListener('click', () => {
      const folded = card.classList.toggle('folded');
      b.textContent = folded ? l.showCard : l.hideCard;
      b.setAttribute('aria-expanded', String(!folded));
    });
    return b;
  }

  private buildHero(hero: readonly [string, string] | undefined): HTMLElement | null {
    if (!hero) return null;
    const l = this.labels;
    const bar = this.ui.hero;
    bar.setAttribute('role', 'radiogroup');
    bar.setAttribute('aria-label', l.view);
    [l.heroFirst, l.heroSecond].forEach((text, i) => {
      const label = el('label', 'ws-chip');
      const input = el('input');
      input.type = 'radio';
      input.name = 'ws-hero';
      input.dataset.hero = String(i);
      input.addEventListener('change', () => {
        this.heroChoice = i as 0 | 1;
        this.sync();
      });
      label.append(input, el('span', undefined, text));
      bar.append(label);
    });
    return bar;
  }

  private mountPiece(
    piece: WorkspacePiece,
    layout: (typeof WORKSPACE_LAYOUTS)[keyof typeof WORKSPACE_LAYOUTS],
    controller: WorkspaceController,
  ): Mounted {
    const { game } = this;
    const name = game.texts.of(piece, 'label');
    const wrapper = el('figure', 'ws-piece');
    wrapper.dataset.piece = piece.id;
    wrapper.dataset.kind = piece.kind;
    wrapper.dataset.slot = piece.slot;
    const body = el('div', 'ws-piece-body');
    const select = el('button', 'ws-piece-select', name);
    select.type = 'button';
    select.setAttribute('aria-pressed', 'false');
    select.dataset.piece = piece.id;
    wrapper.append(body, select);
    const factory = this.resolver.resolve(piece.kind);
    let view = factory ? factory() : placeholder(this.labels.placeholder(name));
    let ok = true;
    const context = {
      texts: game.texts,
      stationId: controller.stationId,
      piece,
      send: (command: Parameters<WorkspaceController['send']>[0]) => controller.send(command),
      refusal: (...asked: Parameters<WorkspaceController['refusal']>) =>
        controller.refusal(...asked),
    };
    try {
      view.mount(body, context);
    } catch (error) {
      game.log.warn(`The workspace view of piece "${piece.id}" could not be mounted`, error);
      body.replaceChildren();
      view = placeholder(this.labels.placeholder(name));
      view.mount(body, context);
      ok = false;
    }
    // A click anywhere on the piece (not on a control of its own) chooses it.
    wrapper.addEventListener('click', (event) => {
      const inner = (event.target as Element).closest(
        'button, input, select, textarea, a, [role="button"]',
      );
      if (inner && inner !== select && body.contains(inner)) return;
      controller.choose(piece);
      this.sync();
    });
    const region =
      this.regions.get(regionOf(layout, piece.slot)) ?? this.regions.get(layout.fallback);
    region?.append(wrapper);
    return { piece, wrapper, select, view, ok };
  }

  // ---- drawing --------------------------------------------------------------------------------

  /** Brings every drawn thing in line with the station and the controller; writes only changes. */
  private sync(first = false): void {
    const controller = this.controller;
    const workspace = this.workspace;
    if (!controller || !workspace) return;
    const { game } = this;
    const view = game.stations.view(controller.stationId);
    if (!view) {
      game.workspace.close();
      return;
    }
    this.view = view;
    const l = this.labels;
    const ui = this.ui;
    const { session } = view;

    // Lifecycle chips, derived from the session and the setup.
    const analysing = controller.layers.has('results');
    const stage = currentStage(session.state, view.setup, analysing);
    const done = view.setup.filter((s) => s.done).length;
    const key = `${stage}|${done}|${view.setup.length}`;
    if (key !== this.shownKey || first) {
      this.shownKey = key;
      ui.stages.replaceChildren(
        ...stageChips(stage, workspace.setup.length > 0).map(({ stage: id, status }) => {
          const li = el('li', 'ws-stage-chip');
          li.dataset.status = status;
          li.textContent =
            id === 'setup' && workspace.setup.length > 0
              ? `${l.stages[id]} · ${l.setupCount(done, view.setup.length)}`
              : l.stages[id];
          if (status === 'current') li.setAttribute('aria-current', 'step');
          return li;
        }),
      );
    }

    // Lifecycle bar: state, and each command marked unavailable with its reason (still pressable:
    // the station refuses it and says why).
    setText(ui.state, l.state[session.state]);
    setText(ui.time, this.time(view));
    for (const [id, b] of ui.buttons) {
      const why = controller.refusal(id as 'run' | 'stop' | 'reset' | 'clear');
      const unavailable = why !== null;
      if (b.getAttribute('aria-disabled') !== String(unavailable))
        b.setAttribute('aria-disabled', String(unavailable));
      if (b.title !== (why ?? '')) b.title = why ?? '';
    }
    const idle = session.state === 'idle' || session.state === 'configured';
    setText(ui.line, controller.blocked ?? (idle ? (controller.refusal('run') ?? '') : ''));

    // Library and pieces: what is held glows where it goes; the selected piece is pressed.
    const held = controller.held;
    const accepting = held
      ? acceptingPieces(
          workspace,
          held,
          (id) => view.setup.find((s) => s.step.id === id)?.done === true,
        )
      : null;
    for (const [id, b] of ui.items) setAttr(b, 'aria-pressed', String(held?.id === id));
    for (const m of this.pieces) {
      const state = accepting === null ? '' : accepting.has(m.piece.id) ? 'yes' : 'no';
      if (m.wrapper.dataset.accepts !== state) m.wrapper.dataset.accepts = state;
      setAttr(m.select, 'aria-pressed', String(controller.selected === m.piece.id));
      this.updatePiece(m, view);
    }
    if (held) {
      setText(
        ui.live,
        l.holding(game.texts.of(held.kind === 'material' ? held.material : held.piece, 'label')),
      );
      // Placing by keyboard: focus goes to the first piece that takes the item, ← → move on.
      if (held.id !== this.previousHeld)
        this.pieces.find((m) => m.wrapper.dataset.accepts === 'yes')?.select.focus();
    }
    this.previousHeld = held?.id ?? null;

    // The hero of microscopy: the prep tile until the setup is done, then the eyepiece.
    const layout = WORKSPACE_LAYOUTS[view.definition.presentation];
    if (layout.hero) {
      const ready = !view.setup.some((s) => s.step.phase === 'before-run' && !s.done);
      const hero = this.heroChoice ?? (ready ? 1 : 0);
      this.root.dataset.hero = layout.hero[hero];
      ui.hero.querySelectorAll('input').forEach((input) => {
        input.checked = input.dataset.hero === String(hero);
      });
    }

    // Callout of the selected piece.
    const selected = workspace.pieces.find((p) => p.id === controller.selected) ?? null;
    if ((selected?.id ?? null) !== this.previousSelected) {
      const opened = this.previousSelected;
      this.previousSelected = selected?.id ?? null;
      this.callout?.show(selected, view);
      if (selected) {
        this.placeCallout(selected.id);
        this.callout?.focusFirst();
      } else if (opened) {
        this.pieces.find((m) => m.piece.id === opened)?.select.focus();
      }
    } else {
      this.callout?.refresh(view);
    }

    // Notebook: live graph, runs, results.
    this.graph?.show(view);
    const names = runLabels(session.history, game.texts);
    const runKey = names.join('|');
    if (ui.runs.dataset.key !== runKey) {
      ui.runs.dataset.key = runKey;
      ui.runs.replaceChildren(
        ...(names.length > 0
          ? names.map((n) => el('li', undefined, n))
          : [el('li', 'ws-none', l.noRuns)]),
      );
    }
    setText(ui.resultsButton, l.results);

    // Sheets: Brief and Results (the existing panel, loaded on first use).
    this.toggleSheet(ui.brief, controller.layers.has('brief'), ui.briefButton);
    if (controller.layers.has('brief')) this.drawBrief(view);
    const showResults = controller.layers.has('results');
    this.toggleSheet(ui.resultsSheet, showResults, ui.resultsButton);
    if (showResults) this.showResults(view);
    else this.results?.hide();

    if (controller.announcement) {
      this.say(controller.announcement);
      controller.announcement = null;
    }
  }

  private updatePiece(m: Mounted, view: StationView): void {
    if (!m.ok) return;
    try {
      m.view.update(view);
    } catch (error) {
      m.ok = false;
      this.game.log.warn(
        `The workspace view of piece "${m.piece.id}" failed and is left as it was`,
        error,
      );
    }
  }

  private time(view: StationView): string {
    return this.labels.time((view.session.run?.time ?? 0).toFixed(1));
  }

  private say(text: string): void {
    this.ui.live.textContent = '';
    if (text) setText(this.ui.live, text);
  }

  private toggleSheet(sheet: HTMLElement, open: boolean, opener: HTMLElement): void {
    const was = !sheet.classList.contains('hidden');
    if (was === open) return;
    sheet.classList.toggle('hidden', !open);
    opener.setAttribute('aria-expanded', String(open));
    if (open) sheet.querySelector<HTMLElement>('button')?.focus();
    else opener.focus();
  }

  private drawBrief(view: StationView): void {
    const t = this.game.texts;
    const l = this.labels;
    const { definition } = view;
    const section = (title: string, rows: { text: string; done: boolean }[]): HTMLElement[] => {
      if (rows.length === 0) return [];
      const ul = el('ul', 'ws-steps');
      for (const r of rows)
        ul.append(el('li', r.done ? 'done' : '', `${r.done ? '✓' : '○'} ${r.text}`));
      return [el('h3', undefined, title), ul];
    };
    this.ui.briefBody.replaceChildren(
      el('h2', undefined, t.of(definition, 'name')),
      el('p', undefined, t.of(definition, 'description')),
      ...section(
        l.briefSetup,
        view.setup.map((s) => ({ text: t.of(s.step, 'instruction'), done: s.done })),
      ),
      ...section(
        l.briefSteps,
        view.checklist.map((c) => ({ text: c.instruction, done: c.done })),
      ),
    );
  }

  private showResults(view: StationView): void {
    if (this.results) {
      this.results.show(view);
      return;
    }
    this.resultsLoad ??= import('../ResultsPanel').then(
      ({ ResultsPanel }) => {
        this.results = new ResultsPanel(this.game.texts);
        this.ui.resultsSheet.append(this.results.root);
        if (this.controller?.layers.has('results')) this.controller.invalidate();
      },
      (error: unknown) => {
        this.resultsLoad = null;
        this.game.log.warn('The results panel could not be loaded', error);
      },
    );
  }

  // ---- placement on the screen -----------------------------------------------------------------

  /** Positions what stands beside something: the callout at its piece, the anchored card. */
  private relayout(): void {
    const view = this.view;
    if (!view || !this.controller) return;
    const layout = WORKSPACE_LAYOUTS[view.definition.presentation];
    if (layout.overlay === 'anchored') {
      const { state, config } = this.game;
      const entity = this.game.world.entity(this.controller.stationId);
      const rect = this.root.getBoundingClientRect();
      if (entity) {
        const [x, y, z] = entity.pose.position;
        const eye: [number, number, number] = [
          state.player.position[0],
          state.player.position[1] + state.player.eyeHeight,
          state.player.position[2],
        ];
        projectToScreen(
          eye,
          state.player.yaw,
          state.player.pitch,
          config.graphics.fov,
          rect.width,
          rect.height,
          [x, y + 1, z],
          this.anchorPoint,
          24,
        );
      }
      // Off screen or behind the eye: the card sits at the right edge instead of vanishing.
      const p = this.anchorPoint;
      const ax = p.visible ? Math.min(p.x + 40, rect.width * 0.62) : rect.width * 0.62;
      const ay = p.visible ? Math.max(24, p.y - 80) : rect.height * 0.2;
      this.root.style.setProperty('--ax', `${Math.round(ax)}px`);
      this.root.style.setProperty('--ay', `${Math.round(ay)}px`);
    }
    if (this.controller.selected) this.placeCallout(this.controller.selected);
  }

  /** Beside the piece, on the side with room (docked at the right by CSS below 1280 px). */
  private placeCallout(pieceId: string): void {
    const callout = this.callout;
    const m = this.pieces.find((x) => x.piece.id === pieceId);
    if (!callout || !m) return;
    const stage = this.ui.stage.getBoundingClientRect();
    const piece = m.wrapper.getBoundingClientRect();
    const box = callout.root.getBoundingClientRect();
    let x = piece.right - stage.left + this.ui.stage.scrollLeft + 8;
    if (x + box.width > stage.width)
      x = piece.left - stage.left + this.ui.stage.scrollLeft - box.width - 8;
    const y = Math.min(
      Math.max(piece.top - stage.top + this.ui.stage.scrollTop, 0),
      Math.max(0, stage.height - box.height),
    );
    callout.root.style.setProperty('--cx', `${Math.max(0, Math.round(x))}px`);
    callout.root.style.setProperty('--cy', `${Math.round(y)}px`);
  }

  /** While placing: ← → move between the pieces that take the held item, Enter places. */
  private stageKey(event: KeyboardEvent): void {
    const controller = this.controller;
    if (!controller?.held || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    // Only from a piece: the callout's and the hero's radios keep their own arrow keys.
    if (!(event.target as Element).classList.contains('ws-piece-select')) return;
    const targets = this.pieces
      .filter((m) => m.wrapper.dataset.accepts === 'yes')
      .map((m) => m.select);
    if (targets.length === 0) return;
    event.preventDefault();
    const at = targets.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    targets[(at + step + targets.length) % targets.length]?.focus();
  }

  private reopen(): void {
    const id = this.stationId;
    if (id !== null) this.open(id);
  }
}
