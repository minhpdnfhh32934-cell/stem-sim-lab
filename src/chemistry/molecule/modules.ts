import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { BondTable } from './BondTable';
import {
  Molecule3dPanel,
  Molecule3dStage,
  PolarityPanel,
  PolarityStage,
  VseprPanel,
  VseprStage,
} from './views';

const bottomTitle = L('Bảng liên kết', 'Bonds');

export const molecule3d: ModuleView = {
  title: L('Phân tử 3D', '3D molecules'),
  Stage: Molecule3dStage,
  Panel: Molecule3dPanel,
  Bottom: BondTable,
  bottomTitle,
};
export const vsepr: ModuleView = {
  title: L('Hình học phân tử (VSEPR)', 'Molecular geometry (VSEPR)'),
  Stage: VseprStage,
  Panel: VseprPanel,
  Bottom: BondTable,
  bottomTitle,
};
export const bondPolarity: ModuleView = {
  title: L('Độ phân cực liên kết', 'Bond polarity'),
  Stage: PolarityStage,
  Panel: PolarityPanel,
  Bottom: BondTable,
  bottomTitle,
};
