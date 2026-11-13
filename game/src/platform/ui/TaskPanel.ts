import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { listen } from '../BrowserInput';
import { el, keyLabel } from './dom';

/**
 * The guided tasks on the right of the screen in a lab that offers them (Phase A contract A6):
 * collapsed to one line ("T Tasks (3)") with no task followed; the task's step and instruction
 * while one is; the list on its key (T), the mouse free to choose — a task to follow, or to stop
 * following the current one — Esc, T or a click on the scene to close it. It only asks the
 * TaskSystem to start or cancel; what is done is the world's. Drawn on events, never per frame.
 */
export class TaskPanel implements GameSystem {
  readonly id = 'task-panel';
  private readonly root = el('aside', 'task-panel hidden');
  private readonly line = el('div', 'task-line');
  private readonly current = el('div', 'task-current');
  private readonly list = el('div', 'task-list hidden');
  private readonly subscriptions = new Disposables();
  private open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly surface: HTMLElement,
    private readonly capture: () => Promise<void>,
  ) {}

  /** The list is open and has the mouse (the pause menu does not pause for it). */
  get shown(): boolean {
    return this.open;
  }

  init(): void {
    this.root.setAttribute('aria-live', 'polite');
    this.list.setAttribute('role', 'dialog');
    this.root.append(this.line, this.current, this.list);
    this.parent.append(this.root);
    const { events } = this.game;
    const s = this.subscriptions;
    const render = () => this.render();
    for (const type of [
      'SceneLoaded',
      'SceneEntered',
      'PlayerEnteredRoom',
      'TaskStarted',
      'TaskStepCompleted',
      'TaskCompleted',
      'TaskCancelled',
      'LanguageChanged',
      'GameLoaded',
    ] as const) {
      s.add(events.subscribe(type, render));
    }
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
    listen(s, this.surface, 'mousedown', () => this.hide(false));
    render();
  }

  /** Opens the list on its key while playing in a lab with tasks. */
  update(): void {
    const { input, state } = this.game;
    if (
      input.wasPressed('tasks') &&
      !this.open &&
      state.session.phase === 'playing' &&
      !state.session.paused &&
      this.offered().length > 0
    ) {
      this.show();
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  private offered() {
    const room = this.game.state.player.roomId;
    return room === null ? [] : this.game.tasks.offered(room);
  }

  private render(): void {
    const { tasks, texts: t, config } = this.game;
    const offered = this.offered();
    const inWorld = this.game.state.session.phase === 'playing';
    this.root.classList.toggle('hidden', !inWorld || offered.length === 0);
    const key = keyLabel(config.input.bindings.tasks[0] ?? 'KeyT', t);
    const active = tasks.active;
    const here = active && offered.some((task) => task.id === active.task.id) ? active : null;
    this.line.replaceChildren(
      el('kbd', undefined, key),
      el('span', undefined, ` ${t.ui('tasks.line', 'Tasks ({count})', { count: offered.length })}`),
    );
    this.current.classList.toggle('hidden', !here);
    if (here) {
      this.current.replaceChildren(
        el('strong', 'task-title', t.of(here.task, 'title')),
        el(
          'span',
          'task-count',
          t.ui('hud.step', 'Step {n} of {total}', {
            n: here.index + 1,
            total: here.task.steps.length,
          }),
        ),
        el('p', 'task-instruction', t.of(here.step, 'instruction')),
      );
    }
    this.list.replaceChildren(
      el('h2', 'task-list-title', t.ui('tasks.title', 'Tasks')),
      ...offered.map((task) => {
        const button = el('button', 'menu-button task-choice');
        const done = tasks.isDone(task.id);
        const following = active?.task.id === task.id;
        button.append(
          el('strong', undefined, t.of(task, 'title')),
          el('span', 'task-choice-note', t.of(task, 'description')),
          ...(following
            ? [el('span', 'task-badge', t.ui('tasks.following', 'Following'))]
            : done
              ? [el('span', 'task-badge', t.ui('tasks.done', 'Done'))]
              : []),
        );
        button.addEventListener('click', () => {
          tasks.start(task.id);
          this.hide(true);
        });
        return button;
      }),
      ...(active
        ? [
            ((): HTMLElement => {
              const cancel = el(
                'button',
                'menu-button task-cancel',
                t.ui('tasks.cancel', 'Stop following this task'),
              );
              cancel.addEventListener('click', () => {
                tasks.cancel();
                this.hide(true);
              });
              return cancel;
            })(),
          ]
        : []),
      el('p', 'task-help', t.ui('tasks.help', 'Esc or {key}: close', { key })),
    );
  }

  private show(): void {
    this.open = true; // first: the pause menu then lets the mouse go without pausing
    this.game.input.reset();
    if (document.pointerLockElement) document.exitPointerLock();
    this.render();
    this.list.classList.remove('hidden');
    this.list.querySelector('button')?.focus();
  }

  private hide(capture: boolean): void {
    if (!this.open) return;
    this.open = false;
    this.list.classList.add('hidden');
    if (this.list.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.render();
    if (capture) this.capture().catch(() => undefined);
  }

  /** While open, the list has the keyboard, but for the developer panel's key. */
  private key(event: KeyboardEvent): void {
    if (!this.open) return;
    const keys = this.game.config.input.bindings;
    if (keys.toggleDebug.includes(event.code)) return;
    event.stopPropagation();
    if (event.key === 'Escape' || keys.tasks.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.hide(true);
    }
  }
}
