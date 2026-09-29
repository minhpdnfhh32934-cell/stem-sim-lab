import type { ModuleView } from '@/modules/types';
import {
  CentralDogmaPanel,
  CentralDogmaStage,
  MutationPanel,
  MutationStage,
} from './central/views';
import { CodeTableBottom } from './central/DogmaViews';
import { L } from './common';
import {
  MeiosisBottom,
  MeiosisPanel,
  MeiosisStage,
  MitosisBottom,
  MitosisPanel,
  MitosisStage,
} from './division/views';
import {
  LogisticBottom,
  LogisticPanel,
  LogisticStage,
  LotkaVolterraBottom,
  LotkaVolterraPanel,
  LotkaVolterraStage,
} from './ecology/EcologyViews';
import {
  MichaelisMentenBottom,
  MichaelisMentenPanel,
  MichaelisMentenStage,
} from './enzyme/EnzymeViews';
import {
  DriftBottom,
  DriftPanel,
  DriftStage,
  HardyWeinbergPanel,
  HardyWeinbergStage,
  MendelPanel,
  MendelStage,
} from './genetics/GeneticsViews';
import {
  DiffusionOsmosisBottom,
  DiffusionOsmosisPanel,
  DiffusionOsmosisStage,
} from './transport/TransportViews';

export const mitosis: ModuleView = {
  title: L('Nguyên phân', 'Mitosis'),
  Stage: MitosisStage,
  Panel: MitosisPanel,
  Bottom: MitosisBottom,
  bottomTitle: L('Số lượng NST, crômatit, tâm động, ADN', 'Chromosome, chromatid, DNA counts'),
};
export const meiosis: ModuleView = {
  title: L('Giảm phân', 'Meiosis'),
  Stage: MeiosisStage,
  Panel: MeiosisPanel,
  Bottom: MeiosisBottom,
  bottomTitle: L('Số lượng NST, crômatit, tâm động, ADN', 'Chromosome, chromatid, DNA counts'),
};
export const centralDogma: ModuleView = {
  title: L('ADN → mARN → Protein', 'DNA → mRNA → protein'),
  Stage: CentralDogmaStage,
  Panel: CentralDogmaPanel,
  Bottom: CodeTableBottom,
  bottomTitle: L('Bảng mã di truyền', 'Genetic code'),
};
export const pointMutation: ModuleView = {
  title: L('Đột biến điểm', 'Point mutations'),
  Stage: MutationStage,
  Panel: MutationPanel,
  Bottom: CodeTableBottom,
  bottomTitle: L('Bảng mã di truyền', 'Genetic code'),
};
export const mendel: ModuleView = {
  title: L('Di truyền Mendel', 'Mendelian genetics'),
  Stage: MendelStage,
  Panel: MendelPanel,
};
export const hardyWeinberg: ModuleView = {
  title: L('Định luật Hardy–Weinberg', 'Hardy–Weinberg principle'),
  Stage: HardyWeinbergStage,
  Panel: HardyWeinbergPanel,
};
export const geneticDrift: ModuleView = {
  title: L('Phiêu bạt di truyền', 'Genetic drift'),
  Stage: DriftStage,
  Panel: DriftPanel,
  Bottom: DriftBottom,
  bottomTitle: L('Tỉ lệ dị hợp trung bình', 'Mean heterozygosity'),
};
export const logisticGrowth: ModuleView = {
  title: L('Tăng trưởng logistic', 'Logistic growth'),
  Stage: LogisticStage,
  Panel: LogisticPanel,
  Bottom: LogisticBottom,
  bottomTitle: L('Tốc độ tăng theo số cá thể', 'Growth rate vs population size'),
};
export const lotkaVolterra: ModuleView = {
  title: L('Con mồi – vật ăn thịt (Lotka–Volterra)', 'Predator–prey (Lotka–Volterra)'),
  Stage: LotkaVolterraStage,
  Panel: LotkaVolterraPanel,
  Bottom: LotkaVolterraBottom,
  bottomTitle: L('Số cá thể theo thời gian', 'Populations over time'),
};
export const michaelisMenten: ModuleView = {
  title: L('Động học enzyme (Michaelis–Menten)', 'Enzyme kinetics (Michaelis–Menten)'),
  Stage: MichaelisMentenStage,
  Panel: MichaelisMentenPanel,
  Bottom: MichaelisMentenBottom,
  bottomTitle: L('Đồ thị Lineweaver–Burk', 'Lineweaver–Burk plot'),
};
export const diffusionOsmosis: ModuleView = {
  title: L('Khuếch tán & thẩm thấu', 'Diffusion & osmosis'),
  Stage: DiffusionOsmosisStage,
  Panel: DiffusionOsmosisPanel,
  Bottom: DiffusionOsmosisBottom,
  bottomTitle: L('Diễn biến theo thời gian', 'Time course'),
};
