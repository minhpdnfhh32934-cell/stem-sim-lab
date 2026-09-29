import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { BalanceStage } from './BalanceStage';
import { ReactionBottom } from './ReactionBottom';
import { ReactionPanel } from './ReactionPanel';
import { ReactionStage } from './ReactionStage';
import { selectReaction, useReactionStore } from './store';

export const reactionLibrary: ModuleView = {
  title: L('Thư viện phản ứng', 'Reaction library'),
  Stage: ReactionStage,
  Panel: ReactionPanel,
  Bottom: ReactionBottom,
  bottomTitle: L('Các bước và liên kết thay đổi', 'Steps and bond changes'),
  state: bindStore(useReactionStore, ['id', 'arrows', 'labels', 'stepPause'], (p) => {
    const { id, ...rest } = p;
    useReactionStore.setState(rest);
    if (id !== undefined) selectReaction(id);
  }),
};

export const equationBalancing: ModuleView = {
  title: L('Cân bằng phương trình', 'Equation balancing'),
  Stage: BalanceStage,
  state: bindStore(useReactionStore, ['equation']),
};
