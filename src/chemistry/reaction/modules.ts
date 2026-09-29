import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { BalanceStage } from './BalanceStage';
import { ReactionBottom } from './ReactionBottom';
import { ReactionPanel } from './ReactionPanel';
import { ReactionStage } from './ReactionStage';

export const reactionLibrary: ModuleView = {
  title: L('Thư viện phản ứng', 'Reaction library'),
  Stage: ReactionStage,
  Panel: ReactionPanel,
  Bottom: ReactionBottom,
  bottomTitle: L('Các bước và liên kết thay đổi', 'Steps and bond changes'),
};

export const equationBalancing: ModuleView = {
  title: L('Cân bằng phương trình', 'Equation balancing'),
  Stage: BalanceStage,
};
