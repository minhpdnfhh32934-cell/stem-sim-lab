import type { Texts } from '../../../core/i18n';
import type { GameEvents } from '../../../game/GameEvents';
import type { StationCommand, StationView } from '../../../gameplay/experiment/StationSystem';
import type { WorkspacePiece } from '../../../simulation/experiment';

/**
 * Workspace piece views (types only). A definition's `workspace.pieces` name a `kind` (burette,
 * conical-flask, ph-meter…); the host keeps one registry, `WORKSPACE_PIECES`, from kind to a
 * `PieceViewFactory` (like `BENCH_MODELS`), and content may only name registered kinds.
 *
 * Life of a piece view: `mount(root, ctx)` once, when the workspace opens, drawing into `root`
 * (DOM / SVG / Canvas2D, never a second WebGL context); `update(view)` on every station change
 * and each frame while a run goes, reading only `view` (its `pose`, setup progress, run buffers)
 * — no allocation per frame, values assigned as given, never smoothed or invented; `dispose()`
 * when it closes, releasing every listener. A control never edits a session: it sends a command
 * through `ctx.send` and shows `ctx.refusal(…)` beside itself while that is not null.
 */
export interface PieceContext {
  readonly texts: Texts;
  readonly stationId: string;
  /** The definition's piece this view draws (its label, owned parameters, bindings). */
  readonly piece: WorkspacePiece;
  /** Asks the StationSystem (`ExperimentCommand`); a refused command changes nothing. */
  send(command: Omit<GameEvents['ExperimentCommand'], 'stationId'>): void;
  /**
   * Why a command would be refused now, or null (`StationSystem.refusal`): `parameter` names the
   * parameter for adjust / set and the step for setup; `value` the set value or adjust direction.
   */
  refusal(command: StationCommand, parameter?: string, value?: number): string | null;
}

export interface PieceView {
  mount(root: HTMLElement, ctx: PieceContext): void;
  update(view: StationView): void;
  dispose(): void;
}

/** Makes one view for one piece of an open workspace. */
export type PieceViewFactory = () => PieceView;
