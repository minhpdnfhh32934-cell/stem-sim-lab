import { Disposables } from '../../core/EventBus';
import { describeError, type GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import type { WorldEntity } from '../../world/World';
import { tiltOf } from '../../gameplay/interaction/hold';
import { totalUl } from '../../simulation/liquid';
import { listen } from '../BrowserInput';
import { el, keyLabel } from './dom';
import { type Notice, type NoticeKind, NoticeQueue, noticeMarker } from './NoticeQueue';
import { fireNotice, incidentNotice } from './fireNotices';
import { protocolItem, protocolRows } from './protocolView';
import type { ResultsPanel } from './ResultsPanel';
import { resultSummary } from './results';

/** Live refresh of an open results panel while its run is in progress, per second. */
const RESULTS_LIVE_HZ = 4;

/**
 * In-game overlay: crosshair, interaction prompt (with why an action is held back), controls
 * hint, short messages, the current procedure objective and what worn eye/face protection looks
 * like. Everything is derived from game state and events; the HUD decides nothing.
 */
export class Hud implements GameSystem {
  readonly id = 'hud';
  private readonly root = el('div', 'hud hidden');
  private readonly visor = el('div', 'hud-visor');
  private readonly prompt = el('div', 'hud-prompt');
  /** A red flash over the view when something thrown hits the player (Phase F-1). */
  private readonly hurt = el('div', 'hud-hurt');
  /** Asleep (Phase F-1): the view dimmed, z's rising. */
  private readonly sleep = el('div', 'hud-sleep hidden');
  private readonly hint = el('div', 'hud-hint');
  private readonly toasts = el('div', 'hud-toasts');
  private readonly objective = el('section', 'hud-objective hidden');
  private readonly timerBar = el('div', 'hud-timer-fill');
  /**
   * A timed step (rubbing the hands, the sanitizer) in the middle above the hotbar too, large:
   * what is being done and how far along it is, where the eyes are while doing it.
   */
  private readonly progress = el('div', 'hud-progress hidden');
  private readonly progressLabel = el('span', 'hud-progress-label');
  private readonly progressFill = el('div', 'hud-progress-fill');
  private progressShown = false;
  /** Rows done at the last render, per procedure: the ones done since settle in, once. */
  private readonly rowsDone = new Map<string, number>();
  private readonly notices = new NoticeQueue();
  /** The strip's line of each notice on screen. */
  private readonly lines = new Map<Notice, HTMLElement>();
  /**
   * The results panel (with its plots and CSV), a chunk of its own loaded with the first world
   * scene; null until then, or while its load has failed (`resultsProblem` says why).
   */
  private results: ResultsPanel | null = null;
  private resultsLoad: Promise<void> | null = null;
  private resultsProblem = '';
  /** The station whose results are open, and the monitor they were opened at. */
  private resultsOpen: { stationId: string; monitorId: string | null } | null = null;

  /** Whether the results panel is open (freeing the mouse then is for its run list, not a pause). */
  get resultsShown(): boolean {
    return this.resultsOpen !== null;
  }
  private nextResultsRefresh = 0;
  /** The prompt says to hold the vessel over another one (pour held and nothing flows). */
  private pourHinted = false;
  /** Seconds of play, the notices' clock. */
  private clock = 0;
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
    private readonly surface: HTMLElement,
  ) {}

  init(): void {
    const { events, content, texts: t } = this.game;
    this.root.setAttribute('aria-live', 'polite');
    this.renderLabels();
    for (const letter of ['z', 'z', 'Z']) this.sleep.append(el('span', undefined, letter));
    this.root.append(
      this.sleep,
      this.hurt,
      this.visor,
      el('div', 'hud-crosshair'),
      this.prompt,
      this.hint,
      this.toasts,
      this.objective,
      this.progress,
    );
    this.parent.append(this.root);
    const track = el('div', 'hud-progress-track');
    track.append(this.progressFill);
    this.progress.setAttribute('role', 'progressbar');
    this.progress.append(this.progressLabel, track);

    const s = this.subscriptions;
    s.add(this.game.addWorldPreparation(() => this.loadResults()));
    const refresh = () => this.refreshPrompt();
    // Talking, "Talk" is no longer on offer (Phase Y): the prompt goes, and comes back after.
    s.add(events.subscribe('ConversationOpened', refresh));
    s.add(events.subscribe('ConversationClosed', refresh));
    // A test paper chosen (Phase Y-5): E holds it up; the prompt says so.
    for (const type of [
      'InventoryChanged',
      'PaperGiven',
      'PaperOpened',
      'PaperClosed',
      'PaperMarked',
      'PaperDiscarded',
    ] as const) {
      s.add(events.subscribe(type, refresh));
    }
    // What the teacher says as a test is ready, or as he takes one handed in.
    for (const type of ['PaperReady', 'PaperHandedIn'] as const) {
      s.add(
        events.subscribe(type, ({ npcId, text }) => {
          const npc = content.npcs.tryGet(npcId);
          this.notify(npc ? `${t.of(npc, 'title')}: ${text}` : text, 'info', 'paper');
        }),
      );
    }
    s.add(
      events.subscribe('InteractionFocusChanged', ({ entityId }) => {
        // Results are read at the monitor: looking away puts them away.
        if (this.resultsOpen && entityId !== this.resultsOpen.monitorId) this.closeResults();
        refresh();
      }),
    );
    s.add(
      events.subscribe('ExperimentResultsViewed', ({ stationId }) => {
        if (this.game.state.session.workspace === stationId) return; // the workspace shows its own
        if (!this.results) {
          const reason = this.resultsProblem;
          this.notify(
            t.ui('hud.resultsFailed', 'The results could not be shown: {reason}', { reason }),
            'error',
            'results',
          );
          void this.loadResults(); // for the next time
          return;
        }
        this.resultsOpen = { stationId, monitorId: this.game.interaction.focused?.id ?? null };
        this.showResults();
      }),
    );
    // A task followed or stopped: the objective gives way or comes back (experimentObjective).
    for (const type of ['TaskStarted', 'TaskCompleted', 'TaskCancelled'] as const) {
      s.add(events.subscribe(type, () => this.refreshObjective()));
    }
    s.add(
      events.subscribe('ExperimentStationChanged', ({ stationId }) => {
        this.refreshObjective();
        refresh();
        if (this.resultsOpen?.stationId === stationId) this.showResults();
      }),
    );
    s.add(
      events.subscribe('ExperimentStateChanged', ({ state, sessionId }) => {
        if (state !== 'stopped') return;
        const time = this.game.experiments.find(sessionId)?.run?.time ?? 0;
        this.notify(
          t.ui(
            'hud.stopped',
            'Stopped at t = {t} s: the data so far is kept. RESET to start again.',
            { t: time.toFixed(2) },
          ),
          'info',
          'experiment',
        );
      }),
    );
    s.add(events.subscribe('EntityStateChanged', refresh));
    // A door that starts opening offers to close it (and back): the prompt follows.
    s.add(events.subscribe('DoorChanged', refresh));
    s.add(events.subscribe('ObjectGrabbed', refresh));
    s.add(events.subscribe('ObjectReleased', refresh));
    // Hit by something thrown (Phase F-1): the screen flashes red, like a hurt in a game.
    s.add(
      events.subscribe('PlayerHit', () => {
        this.hurt.classList.remove('flash');
        // The next frame, so the animation starts again from its first key.
        requestAnimationFrame(() => this.hurt.classList.add('flash'));
      }),
    );
    // Asleep: the view dims and "z z z" rises; awake again, gone.
    s.add(
      events.subscribe('RestChanged', ({ asleep }) => {
        this.sleep.classList.toggle('hidden', !asleep);
        refresh();
      }),
    );
    // The phone out or away, its call moving on: what the keys do changes (Phase E-2b).
    s.add(events.subscribe('PhoneChanged', refresh));
    // On the circuit bench, what E does follows the socket or part aimed at (Phase E-1).
    s.add(events.subscribe('CircuitAimChanged', refresh));
    s.add(events.subscribe('CircuitChanged', refresh));
    // Procedure and equipment changes alter both what an action is called and whether it waits.
    const refreshAll = () => {
      this.refreshPrompt();
      this.refreshObjective();
      this.refreshVisor();
    };
    for (const type of [
      'EquipmentChanged',
      'ProcedureStepStarted',
      'ProcedureStepCompleted',
      'ProcedureStepCancelled',
      'ProcedureReady',
      'ProcedureEntered',
      'ProcedureReset',
      'GameLoaded',
    ] as const) {
      s.add(events.subscribe(type, refreshAll));
    }
    s.add(
      events.subscribe('SceneLoaded', ({ kind }) => {
        this.root.classList.toggle('hidden', kind !== 'world');
        this.withdraw('blocked'); // refusals were about the scene just left
        refreshAll();
      }),
    );
    // Walking into a neighbour scene leaves the last one as a load would.
    s.add(
      events.subscribe('SceneEntered', () => {
        this.withdraw('blocked');
        refreshAll();
      }),
    );
    // Everything shown again in the new language; notices already up keep theirs and expire.
    s.add(
      events.subscribe('LanguageChanged', () => {
        this.renderLabels();
        refreshAll();
        this.results?.relabel();
        if (this.resultsOpen) this.showResults();
      }),
    );
    // Notices, one topic (key) each: see NoticeQueue for the policy.
    s.add(
      events.subscribe('ActionBlocked', ({ reason }) => this.notify(reason, 'warn', 'blocked')),
    );
    // The circuit bench: what heat did, and why (Phase E-2); fire and the phone's calls.
    s.add(
      events.subscribe('CircuitIncident', (e) => {
        const item = e.itemId === null ? undefined : content.items.tryGet(e.itemId);
        const { text, kind } = incidentNotice(e, item, t, this.game.language);
        this.notify(text, kind, `circuit-${e.what}`);
      }),
    );
    s.add(
      events.subscribe('FireNotice', ({ what }) => {
        const { text, kind } = fireNotice(what, t);
        this.notify(text, kind, `fire-${what}`);
      }),
    );
    // The game took a lower graphics preset by itself, its frames too slow here.
    s.add(
      events.subscribe('GraphicsQualityChanged', ({ quality, lowered }) => {
        if (!lowered) return;
        const name =
          quality === 'low'
            ? t.ui('menu.graphicsLow', 'Low')
            : quality === 'medium'
              ? t.ui('menu.graphicsMedium', 'Medium')
              : t.ui('menu.graphicsHigh', 'High');
        this.notify(
          t.ui(
            'settings.qualityLowered',
            'Graphics set to {quality} so the game runs smoothly on this computer (Settings to change it).',
            { quality: name },
          ),
          'info',
          'quality',
        );
      }),
    );
    // Another player came into or left the LAN room (Phase M).
    s.add(
      events.subscribe('PeerJoined', ({ name }) =>
        this.notify(t.ui('room.came', '{name} joined the room.', { name }), 'info', 'peer'),
      ),
    );
    s.add(
      events.subscribe('PeerLeft', ({ name }) =>
        this.notify(t.ui('room.went', '{name} left the room.', { name }), 'info', 'peer'),
      ),
    );
    s.add(
      events.subscribe('SaveFailed', ({ reason }) =>
        this.notify(
          t.ui(
            'hud.saveFailed',
            'Progress could not be saved ({reason}). It is kept for now and saved again at the next door, on Back to the main menu, or when you leave.',
            { reason },
          ),
          'error',
          'save',
        ),
      ),
    );
    s.add(
      events.subscribe('RunHistoryFailed', ({ reason }) =>
        this.notify(
          t.ui(
            'hud.historyFailed',
            'The run history could not be kept ({reason}). Your runs stay listed until you close the page; your progress is saved as usual.',
            { reason },
          ),
          'error',
          'history',
        ),
      ),
    );
    s.add(
      events.subscribe('EquipmentChanged', ({ itemId, worn, discarded }) => {
        const item = { item: t.of(content.items.get(itemId), 'displayName') };
        this.notify(
          worn
            ? t.ui('hud.wearing', 'Wearing: {item}', item)
            : discarded
              ? t.ui('hud.discarded', 'Discarded: {item}, used', item)
              : t.ui('hud.tookOff', 'Took off: {item}', item),
          'info',
          'equipment',
        );
      }),
    );
    s.add(
      events.subscribe('ProcedureStepCompleted', ({ procedureId, stepId }) => {
        const step = content.procedures.get(procedureId).steps.find((st) => st.id === stepId);
        this.withdraw('blocked'); // the procedure moved on: an earlier refusal no longer applies
        if (step) {
          const done = t.ui('hud.stepDone', 'Done: {step}', { step: t.of(step, 'instruction') });
          this.notify(done, 'success', 'procedure');
        }
      }),
    );
    s.add(
      events.subscribe('ProcedureStepCancelled', ({ reason }) => {
        this.notify(
          t.ui('hud.stepInterrupted', 'Interrupted: {reason} Start the step again.', { reason }),
          'warn',
          'procedure',
        );
      }),
    );
    s.add(
      events.subscribe('ProcedureReady', ({ procedureId }) => {
        const procedure = t.of(content.procedures.get(procedureId), 'name');
        this.withdraw('blocked');
        this.notify(
          t.ui('hud.procedureReady', '{procedure}: every step done, the door is open.', {
            procedure,
          }),
          'success',
          'procedure-ready',
        );
      }),
    );
    s.add(
      events.subscribe('ProcedureReset', ({ procedureId, reason }) => {
        const procedure = t.of(content.procedures.get(procedureId), 'name');
        this.notify(
          t.ui('hud.procedureReset', '{procedure} reset. {reason}', { procedure, reason }),
          'warn',
          'procedure',
        );
      }),
    );
    s.add(
      events.subscribe('PlayerEnteredRoom', ({ roomId }) => {
        const room = content.rooms.tryGet(roomId);
        this.notify(room ? t.of(room, 'displayName') : roomId, 'info', 'room');
        this.refreshObjective(); // each room's station has its own checklist
      }),
    );
    s.add(
      events.subscribe('ItemInspected', ({ itemId }) => {
        const item = content.items.get(itemId);
        const description =
          t.of(item, 'description') || t.ui('hud.nothingUnusual', 'Nothing unusual.');
        this.notify(
          t.ui('hud.inspected', '{item}: {description}', {
            item: t.of(item, 'displayName'),
            description,
          }),
          'info',
          'inspect',
        );
      }),
    );
    s.add(
      events.subscribe('ExperimentStarted', ({ experimentId }) => {
        const experiment = t.of(content.experiments.get(experimentId), 'name');
        this.notify(
          t.ui('hud.running', 'Running “{experiment}”…', { experiment }),
          'info',
          'experiment',
        );
      }),
    );
    s.add(
      events.subscribe('ExperimentCompleted', ({ experimentId, results, endReason }) => {
        const experiment = content.experiments.get(experimentId);
        const values = resultSummary(experiment, results, t)
          .map(([name, value]) => `${name}: ${value}`)
          .join(' · ');
        const note =
          endReason === 'time-limit'
            ? t.ui('hud.timeLimit', ' (time limit reached before it finished)')
            : endReason === 'player'
              ? t.ui('hud.endedByPlayer', ' (ended by you)')
              : '';
        this.notify(
          t.ui('hud.completed', '{experiment} — {values}{note}', {
            experiment: t.of(experiment, 'name'),
            values,
            note,
          }),
          'info',
          'experiment',
        );
      }),
    );
    s.add(
      events.subscribe('ExperimentFailed', ({ error }) => {
        this.notify(
          t.ui('hud.failed', 'Experiment failed: {error}', { error }),
          'error',
          'experiment',
        );
      }),
    );
    // The walking hint, while the mouse is free in the world (not while the Explain view has it).
    // Framed (the Explain view, a conversation, a board) the crosshair goes too: nothing is aimed.
    const hint = () => {
      const framed =
        (this.game.state.session.explain ?? null) !== null ||
        (this.game.state.session.conversation ?? null) !== null;
      this.root.classList.toggle('framed', framed);
      this.hint.classList.toggle('hidden', document.pointerLockElement === this.surface || framed);
    };
    listen(s, document, 'pointerlockchange', hint);
    s.add(events.subscribe('ExplainOpened', hint));
    s.add(events.subscribe('ExplainClosed', hint));
    s.add(events.subscribe('ConversationOpened', hint));
    s.add(events.subscribe('ConversationClosed', hint));
    // Only the results' own controls take the mouse; elsewhere (and with the pointer captured)
    // the wheel reaches the view, so it is passed on to the results. Without them, the wheel
    // steps the hotbar while the mouse is captured.
    listen(s, document, 'wheel', (event) => {
      const results = this.results;
      if (results?.visible && !results.root.contains(event.target as Node | null)) {
        results.scroll(event.deltaY);
      } else if (
        !results?.visible &&
        document.pointerLockElement === this.surface &&
        event.deltaY !== 0
      ) {
        // shortcut: one slot per wheel event (a trackpad sends many); add up deltaY if it matters.
        this.game.inventory.step(event.deltaY > 0 ? 1 : -1);
      }
    });
  }

  /** The middle progress bar shown (with the running step's instruction) or hidden. */
  private showProgress(shown: boolean): void {
    this.progressShown = shown;
    this.progress.classList.toggle('hidden', !shown);
    if (!shown) return;
    const { procedures, texts } = this.game;
    const procedure = procedures.activeProcedure();
    const step = procedure ? procedures.view(procedure.id).step : null;
    const text = step ? texts.of(step, 'instruction') : '';
    this.progressLabel.textContent = text;
    this.progress.setAttribute('aria-label', text);
    this.progressFill.style.width = '0%';
  }

  /** Per frame: a running step's progress bar, and notices whose time is up. */
  update(dt: number): void {
    const fraction = this.game.procedures.timerFraction();
    if (fraction !== null) {
      const width = `${100 * fraction}%`;
      this.timerBar.style.width = width;
      this.progressFill.style.width = width;
    }
    if ((fraction !== null) !== this.progressShown) this.showProgress(fraction !== null);
    this.clock += dt;
    if (this.notices.expire(this.clock)) this.renderNotices();
    const over = this.needsVessel();
    if (over !== this.pourHinted) {
      this.pourHinted = over;
      this.refreshPrompt();
    }
    // An open results panel follows a run in progress, a few times a second — unless it shows
    // recorded runs, which do not change.
    if (this.resultsOpen && this.clock >= this.nextResultsRefresh) {
      this.nextResultsRefresh = this.clock + 1 / RESULTS_LIVE_HZ;
      const running = this.game.experiments.find(this.resultsOpen.stationId)?.state === 'running';
      if (running && this.results?.followsCurrentRun) this.showResults();
    }
  }

  /**
   * Downloads the results panel (once; a world preparation, alongside physics). A failure is not
   * the world's: it is logged, kept to say why when results are asked for, and tried again then
   * and at the next world entry.
   */
  private loadResults(): Promise<void> {
    this.resultsLoad ??= import('./ResultsPanel').then(
      ({ ResultsPanel }) => {
        this.results = new ResultsPanel(this.game.texts);
        this.root.append(this.results.root);
      },
      (error: unknown) => {
        this.resultsLoad = null;
        this.resultsProblem = describeError(error);
        this.game.log.warn('The results panel could not be loaded', error);
      },
    );
    return this.resultsLoad;
  }

  private showResults(): void {
    const view = this.resultsOpen ? this.game.stations.view(this.resultsOpen.stationId) : null;
    if (view) this.results?.show(view);
    else this.closeResults();
  }

  private closeResults(): void {
    this.resultsOpen = null;
    this.results?.hide();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  /** The controls hint and the objective's name for screen readers, in the current language. */
  private renderLabels(): void {
    const { config, texts: t } = this.game;
    const { interact, secondary } = config.input.bindings;
    this.hint.textContent = t.ui(
      'hud.hint',
      'Click to look around · WASD move · Shift run · {interact} interact · {secondary} other action · Esc pause',
      { interact: keyLabel(interact[0], t), secondary: keyLabel(secondary[0], t) },
    );
    this.objective.setAttribute('aria-label', t.ui('hud.objective', 'Objective'));
  }

  /**
   * The active procedure as a protocol: its stages in order, each done, current or not started,
   * then the entrance, locked until it opens; what to do next under the current row (or why the
   * door waits under the entrance), and a running step's timer there.
   */
  private refreshObjective(): void {
    const { procedures, interaction, texts: t } = this.game;
    const active = procedures.activeProcedure();
    if (!active) {
      this.experimentObjective();
      return;
    }
    this.objective.classList.remove('hidden');
    const view = procedures.view(active.id);
    // "The door is open" stops being true when required equipment comes off or after a reset.
    if (view.status !== 'ready' && view.status !== 'entered') this.withdraw('procedure-ready');
    const door =
      interaction.primaryAction(active.entrance)?.label ?? t.ui('hud.theEntrance', 'the entrance');
    const text =
      view.status === 'entered'
        ? t.ui('hud.entered', 'Completed. You have entered the clean area.')
        : view.step
          ? t.of(view.step, 'instruction')
          : view.status === 'ready'
            ? t.ui('hud.ready', 'Ready: {door}.', { door })
            : (procedures.entryBlock(active) ?? '');
    const position = t.ui('hud.step', 'Step {n} of {total}', {
      n: Math.min(view.completed + 1, view.total),
      total: view.total,
    });

    const rows = protocolRows(view, door, t);
    const done = rows.filter((r) => r.state === 'done').length;
    const before = this.rowsDone.get(active.id) ?? done;
    this.rowsDone.set(active.id, done);
    const list = el('ol', 'protocol');
    rows.forEach((row, i) => {
      const item = protocolItem(row, i, t);
      if (row.state === 'done' && i >= before) item.classList.add('settled');
      list.append(item);
    });
    // What to do now goes under the row it belongs to: the current stage, else the entrance.
    const holder =
      [...list.children].find((li) => (li as HTMLElement).dataset.state === 'current') ??
      list.lastElementChild;
    const detail = el('div', 'protocol-detail');
    const blocked = view.step === null && view.status === 'in-progress';
    detail.append(el('p', `hud-objective-text${blocked ? ' caution' : ''}`, text));
    if (view.timer) {
      this.timerBar.style.width = '0%';
      const timer = el('div', 'hud-timer');
      timer.append(this.timerBar);
      detail.append(timer);
    }
    holder?.append(detail);

    const head = el('header', 'protocol-head');
    head.append(
      el('strong', 'protocol-name', t.of(active, 'name')),
      el('span', 'protocol-count', `${Math.min(view.completed, view.total)}/${view.total}`),
    );
    this.objective.dataset.status = view.status;
    this.objective.replaceChildren(
      head,
      // The whole position in one sentence for screen readers; the list shows it on screen.
      el('p', 'sr-only', `${position}${view.stageLabel ? ` · ${view.stageLabel}` : ''}`),
      list,
    );
  }

  /**
   * Without a procedure: the guided steps of the scene's experiment station, if it has one — the
   * same plate, its steps as a segmented rail, the current one's instruction below.
   */
  private experimentObjective(): void {
    const { texts: t, tasks, state } = this.game;
    const station = this.game.stations.activeStation();
    // In a lab with guided tasks the objective docks under the task panel, and gives way to the
    // followed task's step (one guide at a time: contract A6).
    const room = state.player.roomId;
    const guided = room !== null && tasks.offered(room).length > 0;
    this.objective.classList.toggle('docked', guided);
    this.objective.classList.toggle(
      'hidden',
      station === null || (guided && tasks.active !== null),
    );
    if (!station) return;
    const { checklist, next, definition } = station;
    const done = next >= checklist.length;
    this.objective.dataset.status = done ? 'ready' : 'in-progress';
    const head = el('header', 'protocol-head');
    head.append(
      el('strong', 'protocol-name', t.of(definition, 'name')),
      el('span', 'protocol-count', `${Math.min(next, checklist.length)}/${checklist.length}`),
    );
    const rail = el('div', 'protocol-rail');
    rail.setAttribute('aria-hidden', 'true');
    checklist.forEach((_, i) => {
      const segment = el('span');
      segment.dataset.state = i < next ? 'done' : i === next ? 'current' : 'pending';
      rail.append(segment);
    });
    this.objective.replaceChildren(
      head,
      rail,
      el(
        'small',
        'protocol-meta',
        done
          ? t.ui('hud.allStepsDone', 'All steps done')
          : t.ui('hud.step', 'Step {n} of {total}', { n: next + 1, total: checklist.length }),
      ),
      el(
        'p',
        'hud-objective-text',
        done
          ? definition.presentation === 'physical-lab'
            ? t.ui('hud.tryOtherPhysical', 'Clear the bench to try other values.')
            : t.ui('hud.tryOther', 'Try other values: change a dial, press RESET, then RUN.')
          : (checklist[next]?.instruction ?? ''),
      ),
    );
  }

  /** Worn eye and face protection framing the view. */
  private refreshVisor(): void {
    const { equipment, content } = this.game;
    const slots = new Set(equipment.worn.map((id) => content.items.tryGet(id)?.wornOn));
    this.visor.classList.toggle('goggles', slots.has('eyes'));
    this.visor.classList.toggle('face-shield', slots.has('face'));
  }

  private refreshPrompt(): void {
    const { interaction, config, texts: t } = this.game;
    const { bindings } = config.input;
    const held = interaction.heldEntity;
    if (held) {
      const setsDown = held.item.physical.handling !== 'free';
      // A target that takes the held object (e.g. a launcher) turns E from Drop into its action.
      const target = interaction.focused;
      const use = target ? interaction.primaryAction(target.id) : null;
      const blocked = target && use ? interaction.blockedReason(target.id, use) : null;
      this.prompt.classList.toggle('blocked', blocked !== null);
      this.prompt.replaceChildren(
        el('kbd', undefined, keyLabel(bindings.interact[0], t)),
        el(
          'span',
          undefined,
          ` ${use?.label ?? (setsDown ? t.ui('hud.setDown', 'Set down') : t.ui('hud.drop', 'Drop'))}`,
        ),
        ...(held.item.physical.throwable
          ? [
              el('kbd', 'hud-second-key', keyLabel(bindings.throw[0], t)),
              el('span', undefined, ` ${t.ui('hud.throw', 'Throw')}`),
            ]
          : []),
        ...(held.item.inventory
          ? [
              el('kbd', 'hud-second-key', keyLabel(bindings.stow[0], t)),
              el('span', undefined, ` ${t.ui('hud.putAway', 'Put away')}`),
            ]
          : []),
        ...this.glasswareKeys(held),
        el(
          'small',
          undefined,
          t.ui('hud.holding', 'Holding: {item}', { item: t.of(held.item, 'displayName') }),
        ),
        ...(this.pourHinted
          ? [el('small', undefined, t.ui('hud.pourOver', 'Hold it over a vessel to pour.'))]
          : []),
        ...(target && use ? [el('small', undefined, target.displayName)] : []),
        ...(blocked ? [el('small', 'hud-blocked', blocked)] : []),
      );
      return;
    }
    const target = interaction.focused;
    const action = target ? interaction.primaryAction(target.id) : null;
    this.prompt.replaceChildren();
    // The phone in the hand has the keys (its screen shows what is dialled).
    const phone = this.game.phone;
    if (phone.out) {
      this.prompt.classList.remove('blocked');
      const ringing = phone.call.state !== 'idle';
      this.prompt.append(
        ...(ringing
          ? []
          : [el('kbd', undefined, '0–9'), el('span', undefined, ` ${t.ui('phone.dial', 'Dial')}`)]),
        el('kbd', ringing ? undefined : 'hud-second-key', keyLabel(bindings.interact[0], t)),
        el(
          'span',
          undefined,
          ` ${ringing ? t.ui('phone.hangUp', 'Hang up') : t.ui('phone.call', 'Call')}`,
        ),
        ...(ringing
          ? []
          : [
              el('kbd', 'hud-second-key', keyLabel(bindings.secondary[0], t)),
              el('span', undefined, ` ${t.ui('phone.delete', 'Delete')}`),
            ]),
        el('kbd', 'hud-second-key', keyLabel(bindings.stow[0], t)),
        el('span', undefined, ` ${t.ui('phone.putAway', 'Put the phone away')}`),
      );
      return;
    }
    if (!target && phone.selected) {
      this.prompt.classList.remove('blocked');
      this.prompt.append(
        el('kbd', undefined, keyLabel(bindings.stow[0], t)),
        el('span', undefined, ` ${t.ui('phone.takeOut', 'Take out the phone')}`),
      );
      return;
    }
    // Talking (a lecture too), E goes on with the conversation: nothing else is on offer.
    if ((this.game.state.session.conversation ?? null) !== null) return;
    const paper = this.game.papers.chosen;
    if (!target && paper && (this.game.state.session.paper ?? null) === null) {
      this.prompt.classList.remove('blocked');
      this.prompt.append(
        el('kbd', undefined, keyLabel(bindings.interact[0], t)),
        el(
          'span',
          undefined,
          ` ${paper.marked ? t.ui('hud.readTest', 'Read the marked test') : t.ui('hud.doTest', 'Do the test')}`,
        ),
        el('small', undefined, t.ui('paper.title', 'TEST No. {n}', { n: paper.number })),
      );
      return;
    }
    if (!target || !action) return;
    const secondary = interaction.secondaryAction(target.id);
    const blocked = interaction.blockedReason(target.id, action);
    this.prompt.classList.toggle('blocked', blocked !== null);
    this.prompt.append(
      el('kbd', undefined, keyLabel(bindings.interact[0], t)),
      // A click does it too (a paper taken or handed over).
      ...(action.click
        ? [el('span', undefined, ' / '), el('kbd', undefined, keyLabel(bindings.throw[0], t))]
        : []),
      el('span', undefined, ` ${action.label}`),
      ...(secondary
        ? [
            el('kbd', 'hud-second-key', keyLabel(bindings.secondary[0], t)),
            el('span', undefined, ` ${secondary.label}`),
          ]
        : []),
      el('small', undefined, target.displayName),
      ...(blocked ? [el('small', 'hud-blocked', blocked)] : []),
    );
  }

  /**
   * What the held glassware can be told to do beside setting it down: pour (tip it), squeeze (a
   * wash bottle), turn a stoppered vessel over to mix — each while its key is held — and look at it
   * closely.
   */
  private glasswareKeys(held: WorldEntity): HTMLElement[] {
    const container = held.item.container;
    if (!container) return [];
    const { game } = this;
    const { bindings } = game.config.input;
    const t = game.texts;
    const closed = game.stations.container(held.id)?.closed === true;
    const verb = !container.pour
      ? null
      : closed
        ? t.ui('hud.turnOver', 'Turn over to mix (hold)')
        : container.pour.trigger === 'squeeze'
          ? t.ui('hud.squeeze', 'Squeeze (hold)')
          : t.ui('hud.pour', 'Pour (hold)');
    return [
      ...(verb
        ? [
            el('kbd', 'hud-second-key', keyLabel(bindings.pour[0], t)),
            el('span', undefined, ` ${verb}`),
          ]
        : []),
      el('kbd', 'hud-second-key', keyLabel(bindings.inspect[0], t)),
      el('span', undefined, ` ${t.ui('hud.inspect', 'Look closely (hold)')}`),
    ];
  }

  /** Pour held over nothing: a squeezed bottle, or one tipped past its pour angle, and no pour. */
  private needsVessel(): boolean {
    const { interaction, input, liquids, stations } = this.game;
    const held = interaction.heldEntity;
    const pour = held?.item.container?.pour;
    if (!held || !pour || !input.isHeld('pour') || liquids.pouringOver !== null) return false;
    const state = stations.container(held.id);
    if (!state || state.closed || totalUl(state.contents) === 0) return false;
    return (
      pour.trigger === 'squeeze' || tiltOf(held.pose.rotation) >= (pour.minTiltDeg * Math.PI) / 180
    );
  }

  private notify(text: string, kind: NoticeKind, key: string | null): void {
    this.notices.push(text, kind, key, this.clock);
    this.renderNotices();
  }

  private withdraw(key: string): void {
    if (this.notices.remove(key)) this.renderNotices();
  }

  /**
   * The status strip follows the queue line by line, so only a new notice enters (the DOM keeps
   * them oldest first, the newest last; the strip shows the newest on top). A line that goes stops
   * being a `.hud-toast` at once and fades out, or is removed at once without motion.
   */
  private renderNotices(): void {
    const visible = this.notices.visible;
    for (const [notice, line] of this.lines) {
      if (visible.includes(notice)) continue;
      this.lines.delete(notice);
      line.className = 'hud-toast-leaving';
      line.addEventListener('animationend', () => line.remove());
      // No fade running (reduced motion, or the HUD hidden): it would never end, so go now.
      if (line.getAnimations().length === 0) line.remove();
    }
    for (const notice of visible) {
      if (this.lines.has(notice)) continue;
      const line = el('div', `hud-toast ${notice.kind}`, notice.text);
      line.dataset.marker = noticeMarker(notice);
      this.lines.set(notice, line);
      this.toasts.append(line); // the queue only ever adds at its end
    }
  }
}
