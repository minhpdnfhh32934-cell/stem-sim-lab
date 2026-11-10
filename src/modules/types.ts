import type { ComponentType } from 'react';
import type { LocalizedText } from '@/core/data/dataset';

/**
 * The user-editable state of a module (inputs, not live simulation data): saved in
 * `.stemsim` files and history, and tracked by undo/redo.
 */
export interface ModuleStateBinding {
  /** JSON-safe copy of the inputs. */
  get(): Record<string, unknown>;
  /** Restores inputs (unknown keys and wrong types are ignored). */
  set(state: Record<string, unknown>): void;
  /** Called when the inputs change (not on every animation frame). */
  subscribe(listener: () => void): () => void;
}

/**
 * A non-physics topic (chemistry, biology): a self-contained view that owns the stage,
 * and optionally the Inspector's parameter section and the bottom panel. Views of one
 * module share state through the module's own store.
 */
export interface ModuleView {
  title: LocalizedText;
  Stage: ComponentType;
  Panel?: ComponentType;
  Bottom?: ComponentType;
  bottomTitle?: LocalizedText;
  /**
   * The bench edge's controls for this view (bench shell only, docs/BENCH_DESIGN.md §8): the
   * view then leaves them off its stage there. The classic shell never shows it.
   */
  Driver?: ComponentType;
  state?: ModuleStateBinding;
}
