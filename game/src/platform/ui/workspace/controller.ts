import { Disposables, type EventBus } from '../../../core/EventBus';
import type { Texts } from '../../../core/i18n';
import type { GameEvents } from '../../../game/GameEvents';
import type { StationCommand, StationView } from '../../../gameplay/experiment/StationSystem';
import type {
  ExperimentWorkspace,
  SetupStep,
  WorkspacePiece,
} from '../../../simulation/experiment';
import { workspaceLabels } from './labels';
import { type Layer, LayerStack, type LibraryItem, misplacedStep, placement } from './state';

export interface ControllerDeps {
  readonly events: EventBus<GameEvents>;
  readonly texts: Texts;
  readonly stations: {
    view(stationId: string): StationView | null;
    refusal(
      stationId: string,
      command: StationCommand,
      parameter?: string,
      value?: number,
    ): string | null;
  };
  /** Closes the workspace itself (`WorkspaceSystem.close`). */
  readonly closeWorkspace: () => boolean;
}

/**
 * What the open workspace is doing, with no DOM: the layers Esc closes, the selected piece, the
 * library item being placed, the last refusal, whether the results are open. It sends station
 * commands and subscribes to what changes a station; the host draws it. `dirty` says something the
 * host draws may have changed (it clears it with `take`), so nothing is redrawn without a reason.
 */
export class WorkspaceController {
  readonly layers = new LayerStack();
  /** The piece whose callout is open. */
  selected: string | null = null;
  /** The library item waiting to be placed on a piece. */
  held: LibraryItem | null = null;
  /** Why the last command or placement was refused, until something changes. */
  blocked: string | null = null;
  /** What a screen reader is told next (a placement); the host clears it once spoken. */
  announcement: string | null = null;
  private changed = true;
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly deps: ControllerDeps,
    readonly stationId: string,
    private readonly workspace: ExperimentWorkspace,
  ) {
    const { events } = deps;
    const s = this.subscriptions;
    s.add(
      events.subscribe('ActionBlocked', ({ entityId, reason }) => {
        if (entityId !== stationId) return;
        this.blocked = reason;
        this.changed = true;
      }),
    );
    s.add(
      events.subscribe('ExperimentStationChanged', ({ stationId: id }) => {
        if (id !== stationId) return;
        this.blocked = null;
        this.changed = true;
      }),
    );
    s.add(
      events.subscribe('ExperimentResultsViewed', ({ stationId: id }) => {
        if (id !== stationId) return;
        this.layers.push('results');
        this.changed = true;
      }),
    );
    s.add(events.subscribe('LanguageChanged', () => (this.changed = true)));
  }

  /** True once after anything changed that the host draws. */
  take(): boolean {
    const was = this.changed;
    this.changed = false;
    return was;
  }

  invalidate(): void {
    this.changed = true;
  }

  get view(): StationView | null {
    return this.deps.stations.view(this.stationId);
  }

  send(command: Omit<GameEvents['ExperimentCommand'], 'stationId'>): void {
    this.deps.events.publish('ExperimentCommand', { ...command, stationId: this.stationId });
  }

  refusal(command: StationCommand, parameter?: string, value?: number): string | null {
    return this.deps.stations.refusal(this.stationId, command, parameter, value);
  }

  // ---- selection and placement -------------------------------------------------------------

  /** Opens (or, if open, closes) the callout of a piece. */
  select(pieceId: string | null): void {
    this.selected = pieceId === this.selected ? null : pieceId;
    if (this.selected === null) this.layers.remove('callout');
    else this.layers.push('callout');
    this.changed = true;
  }

  /** Picks up a library item (the same item again puts it back). */
  hold(item: LibraryItem | null): void {
    this.held = item === null || this.held?.id === item.id ? null : item;
    if (this.held === null) this.layers.remove('placing');
    else this.layers.push('placing');
    this.blocked = null;
    this.changed = true;
  }

  /**
   * A piece was chosen: with an item in hand that means placing it there — `set` the parameter it
   * sets and mark the setup step it completes, unless the station would refuse either (the reason
   * is shown and nothing is sent); without one it selects the piece.
   */
  choose(piece: WorkspacePiece): void {
    const item = this.held;
    if (item === null) {
      this.select(piece.id);
      return;
    }
    const { texts } = this.deps;
    const labels = workspaceLabels(texts);
    const view = this.view;
    const done = (id: string) => view?.setup.find((s) => s.step.id === id)?.done === true;
    const put = placement(this.workspace, item, piece, done);
    const name =
      item.kind === 'material' ? texts.of(item.material, 'label') : texts.of(item.piece, 'label');
    const where = texts.of(piece, 'label');
    this.changed = true;
    if (!put.accepted) {
      const step = misplacedStep(this.workspace, item.id);
      this.fail(step ? texts.of(step, 'refusal') : labels.notThere(name, where));
      return;
    }
    const reason =
      (put.sets ? this.refusal('set', put.sets.parameter, put.sets.value) : null) ??
      (put.step ? this.stepRefusal(put.step, put.sets, done) : null);
    if (reason !== null) {
      this.fail(reason);
      return;
    }
    if (put.sets)
      this.send({ command: 'set', parameter: put.sets.parameter, value: put.sets.value });
    if (put.step) this.send({ command: 'setup', step: put.step.id });
    this.held = null;
    this.layers.remove('placing');
    this.blocked = null;
    this.announcement = labels.placed(name, where);
  }

  /**
   * Why `step` cannot be done now, or null. A step that applies only to the material being placed
   * (`when`) is not at the station until that `set` is done, so the station would call it unknown:
   * it is then asked what it waits for among the steps that apply once `sets` is made.
   */
  private stepRefusal(
    step: SetupStep,
    sets: { readonly parameter: string; readonly value: number } | null,
    done: (id: string) => boolean,
  ): string | null {
    const view = this.view;
    const at = (id: string) => view?.setup.some((s) => s.step.id === id) === true;
    if (!sets || at(step.id)) return this.refusal('setup', step.id);
    const applies = (s: SetupStep) =>
      s.when?.parameter === sets.parameter ? s.when.values.includes(sets.value) : at(s.id);
    const waiting = this.workspace.setup.find(
      (s) => step.after.includes(s.id) && applies(s) && !done(s.id),
    );
    return waiting ? this.deps.texts.of(waiting, 'refusal') : null;
  }

  private fail(reason: string): void {
    this.blocked = reason;
  }

  // ---- layers ------------------------------------------------------------------------------

  open(layer: Extract<Layer, 'brief' | 'drawer' | 'results'>): void {
    this.layers.push(layer);
    this.changed = true;
  }

  /** Closes one layer and what it held. */
  closeLayer(layer: Layer): void {
    this.layers.remove(layer);
    if (layer === 'placing') this.held = null;
    if (layer === 'callout') this.selected = null;
    this.changed = true;
  }

  /** Esc: closes the innermost layer; with none open, the workspace. Returns whether a layer closed. */
  escape(): boolean {
    const layer = this.layers.top;
    if (layer === null) {
      this.deps.closeWorkspace();
      return false;
    }
    this.closeLayer(layer);
    return true;
  }

  dispose(): void {
    this.subscriptions.dispose();
  }
}
