import type { SetupProgress } from '../../../gameplay/experiment/StationSystem';
import type {
  ExperimentWorkspace,
  SetupStep,
  WorkspacePiece,
} from '../../../simulation/experiment';
import type { SessionState } from '../../../simulation/ExperimentSession';

/*
 * The workspace's logic with no DOM: which lifecycle stage the chips show, which layer Esc closes,
 * what a library item does when it is placed on a piece. The host only draws what these say; the
 * station (`StationSystem`) stays the rule authority — nothing here decides whether a command is
 * allowed, only which commands a click means.
 */

export const STAGES = ['setup', 'run', 'observe', 'measure', 'analyse'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * The stage a workspace is at, derived from the session (no second state machine): setup while a
 * before-run step is open, ready to RUN, observing while a run goes (or is stopped, its data
 * kept), measuring once it completed; analysing while the results are open.
 */
export function currentStage(
  state: SessionState,
  setup: readonly SetupProgress[],
  analysing: boolean,
): Stage {
  if (analysing) return 'analyse';
  if (state === 'running' || state === 'stopped') return 'observe';
  if (state === 'completed') return 'measure';
  return setup.some((s) => s.step.phase === 'before-run' && !s.done) ? 'setup' : 'run';
}

export interface StageChip {
  readonly stage: Stage;
  readonly status: 'done' | 'current' | 'todo';
}

/** The chips, in order; Setup only when the experiment has setup steps. */
export function stageChips(current: Stage, hasSetup: boolean): StageChip[] {
  const stages: readonly Stage[] = hasSetup ? STAGES : STAGES.filter((s) => s !== 'setup');
  const at = stages.indexOf(current);
  return stages.map((stage, i) => ({
    stage,
    status: i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
}

// ---- layers (Esc) -------------------------------------------------------------------------------

/** What can be open over the workspace; Esc closes the last opened first. */
export type Layer = 'placing' | 'callout' | 'brief' | 'results' | 'drawer';

/** The open layers, innermost last. Esc pops one; with none open Esc leaves the workspace. */
export class LayerStack {
  private readonly layers: Layer[] = [];

  get top(): Layer | null {
    return this.layers[this.layers.length - 1] ?? null;
  }

  has(layer: Layer): boolean {
    return this.layers.includes(layer);
  }

  /** Opens `layer` as the innermost (an open one moves to the top). */
  push(layer: Layer): void {
    this.remove(layer);
    this.layers.push(layer);
  }

  remove(layer: Layer): void {
    const at = this.layers.indexOf(layer);
    if (at >= 0) this.layers.splice(at, 1);
  }

  /** Closes the innermost layer; null when none was open. */
  pop(): Layer | null {
    return this.layers.pop() ?? null;
  }

  clear(): void {
    this.layers.length = 0;
  }
}

// ---- library and placement ----------------------------------------------------------------------

export type Material = ExperimentWorkspace['materials'][number];

/** A library entry: a material, or a piece a setup step puts somewhere (equipment). */
export type LibraryItem =
  | { readonly kind: 'material'; readonly id: string; readonly material: Material }
  | { readonly kind: 'equipment'; readonly id: string; readonly piece: WorkspacePiece };

/** Materials as listed, then the pieces that some setup step places onto another piece. */
export function libraryItems(workspace: ExperimentWorkspace): LibraryItem[] {
  const placed = new Set(workspace.setup.map((s) => s.place));
  return [
    ...workspace.materials.map((material): LibraryItem => ({
      kind: 'material',
      id: material.id,
      material,
    })),
    ...workspace.pieces
      .filter((piece) => placed.has(piece.id))
      .map((piece): LibraryItem => ({ kind: 'equipment', id: piece.id, piece })),
  ];
}

/** What putting a library item on a piece means: a setting, a setup step, both or neither. */
export interface Placement {
  readonly accepted: boolean;
  /** A material that sets a parameter the piece owns: `set` it. */
  readonly sets: { readonly parameter: string; readonly value: number } | null;
  /** The first step (not yet done) that puts the item onto the piece: `setup` it. */
  readonly step: SetupStep | null;
}

const NOT_ACCEPTED: Placement = { accepted: false, sets: null, step: null };

export function placement(
  workspace: ExperimentWorkspace,
  item: LibraryItem,
  target: WorkspacePiece,
  isDone: (stepId: string) => boolean,
): Placement {
  const steps = workspace.setup.filter((s) => s.place === item.id && s.onto === target.id);
  const material = item.kind === 'material' ? item.material : null;
  const sets =
    material?.sets && target.owns.includes(material.sets.parameter) ? material.sets : null;
  if (!sets && steps.length === 0) return NOT_ACCEPTED;
  return { accepted: true, sets, step: steps.find((s) => !isDone(s.id)) ?? null };
}

/** The step to quote when an item is put where it does not go: the first that places it. */
export function misplacedStep(workspace: ExperimentWorkspace, itemId: string): SetupStep | null {
  return workspace.setup.find((s) => s.place === itemId) ?? null;
}

/** Ids of the pieces that take the item (they glow while it is held). */
export function acceptingPieces(
  workspace: ExperimentWorkspace,
  item: LibraryItem,
  isDone: (stepId: string) => boolean,
): Set<string> {
  const out = new Set<string>();
  for (const piece of workspace.pieces) {
    if (placement(workspace, item, piece, isDone).accepted) out.add(piece.id);
  }
  return out;
}
