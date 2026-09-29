import type { ComponentType } from 'react';
import type { LocalizedText } from '@/core/data/dataset';

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
}
