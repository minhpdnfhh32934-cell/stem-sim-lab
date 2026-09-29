import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { ElementDetails } from '../periodic/ElementDetails';
import { BohrPanel } from './BohrPanel';
import { BohrStage } from './BohrStage';
import { ConfigStage } from './ConfigStage';
import { OrbitalPanel } from './OrbitalPanel';
import { OrbitalStage } from './OrbitalStage';
import { RadialBottom } from './RadialBottom';
import { SpectrumBottom } from './SpectrumBottom';

export const electronConfiguration: ModuleView = {
  title: L('Cấu hình electron', 'Electron configuration'),
  Stage: ConfigStage,
  Panel: ElementDetails,
};

export const bohrModel: ModuleView = {
  title: L('Mô hình Bohr', 'Bohr model'),
  Stage: BohrStage,
  Panel: BohrPanel,
  Bottom: SpectrumBottom,
  bottomTitle: L('Phổ vạch của hydro', 'Hydrogen line spectrum'),
};

export const orbitals: ModuleView = {
  title: L('Orbital nguyên tử hydro', 'Hydrogen orbitals'),
  Stage: OrbitalStage,
  Panel: OrbitalPanel,
  Bottom: RadialBottom,
  bottomTitle: L('Mật độ xác suất theo bán kính P(r)', 'Radial probability density P(r)'),
};
