/**
 * The SH12 KNTT lessons of #255 round 5 that have a module of their own (the descriptive ones are
 * guided lessons). Kept out of `modules.ts` so opening one does not load the other biology lessons.
 */
import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { OPERON_TITLE } from './operon/card';
import { OperonPanel, OperonStage } from './operon/OperonViews';
import { restoreOperon, useOperon } from './operon/store';

/** Bài 3: the lac operon, switched by lactose, a damaged lacI or a damaged operator. */
export const lacOperon: ModuleView = {
  title: OPERON_TITLE,
  Stage: OperonStage,
  Panel: OperonPanel,
  state: bindStore(useOperon, ['lactose', 'lacI', 'operator'], restoreOperon),
};
