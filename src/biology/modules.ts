import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { useDogmaStore } from './central/state';
import { STAGES, type Division } from './division/division';
import { PAIR_CHOICES, SPEEDS, useDivisionStore, type DivisionState } from './division/state';
import { setDivisionState } from './division/stageIndex';
import { useLogistic, useLv } from './ecology/store';
import { useEnzyme } from './enzyme/store';
import { useDrift, useHw, useMendel } from './genetics/store';
import { useTransport } from './transport/store';
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

const intIn = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * Files (and history entries) are untrusted input: drop values the views cannot show — 2n
 * outside the selector, a stage index outside this division's stages, unknown cell types and
 * speeds — and record which division the restored stage index belongs to.
 */
function restoreDivision(kind: Division, patch: Partial<DivisionState>): void {
  const clean = { ...patch };
  if (clean.pairs !== undefined && !(PAIR_CHOICES as readonly number[]).includes(clean.pairs))
    delete clean.pairs;
  if (clean.index !== undefined && !intIn(clean.index, 0, STAGES[kind].length - 1))
    delete clean.index;
  const cellType: unknown = clean.cellType;
  if (cellType !== undefined && cellType !== 'animal' && cellType !== 'plant')
    delete clean.cellType;
  if (clean.speed !== undefined && !(SPEEDS as readonly number[]).includes(clean.speed))
    delete clean.speed;
  const notBoolean = (v: unknown) => v !== undefined && typeof v !== 'boolean';
  if (notBoolean(clean.view3d)) delete clean.view3d;
  if (notBoolean(clean.meiosisView3d)) delete clean.meiosisView3d;
  if (notBoolean(clean.crossover)) delete clean.crossover;
  setDivisionState(kind, clean);
}

const division = bindStore(
  useDivisionStore,
  ['pairs', 'crossover', 'seed', 'index', 'meiosisView3d', 'speed'],
  (patch) => {
    restoreDivision('meiosis', patch);
  },
);
const mitosisState = bindStore(
  useDivisionStore,
  ['pairs', 'crossover', 'seed', 'index', 'cellType', 'view3d', 'speed'],
  (patch) => {
    restoreDivision('mitosis', patch);
  },
);
const dogma = bindStore(useDogmaStore, [
  'input',
  'strand',
  'kind',
  'pos',
  'bases',
  'count',
  'view3d',
]);

export const mitosis: ModuleView = {
  title: L('Nguyên phân', 'Mitosis'),
  Stage: MitosisStage,
  Panel: MitosisPanel,
  Bottom: MitosisBottom,
  bottomTitle: L('Số lượng NST, crômatit, tâm động, ADN', 'Chromosome, chromatid, DNA counts'),
  state: mitosisState,
};
export const meiosis: ModuleView = {
  title: L('Giảm phân', 'Meiosis'),
  Stage: MeiosisStage,
  Panel: MeiosisPanel,
  Bottom: MeiosisBottom,
  bottomTitle: L('Số lượng NST, crômatit, tâm động, ADN', 'Chromosome, chromatid, DNA counts'),
  state: division,
};
export const centralDogma: ModuleView = {
  title: L('ADN → mARN → Protein', 'DNA → mRNA → protein'),
  Stage: CentralDogmaStage,
  Panel: CentralDogmaPanel,
  Bottom: CodeTableBottom,
  bottomTitle: L('Bảng mã di truyền', 'Genetic code'),
  state: dogma,
};
export const pointMutation: ModuleView = {
  title: L('Đột biến điểm', 'Point mutations'),
  Stage: MutationStage,
  Panel: MutationPanel,
  Bottom: CodeTableBottom,
  bottomTitle: L('Bảng mã di truyền', 'Genetic code'),
  state: dogma,
};
export const mendel: ModuleView = {
  title: L('Di truyền Mendel', 'Mendelian genetics'),
  Stage: MendelStage,
  Panel: MendelPanel,
  state: bindStore(useMendel, ['loci', 'dominance', 'p1', 'p2', 'n', 'view3d']),
};
export const hardyWeinberg: ModuleView = {
  title: L('Định luật Hardy–Weinberg', 'Hardy–Weinberg principle'),
  Stage: HardyWeinbergStage,
  Panel: HardyWeinbergPanel,
  state: bindStore(useHw, ['AA', 'Aa', 'aa', 'N']),
};
export const geneticDrift: ModuleView = {
  title: L('Phiêu bạt di truyền', 'Genetic drift'),
  Stage: DriftStage,
  Panel: DriftPanel,
  Bottom: DriftBottom,
  bottomTitle: L('Tỉ lệ dị hợp trung bình', 'Mean heterozygosity'),
  state: bindStore(useDrift, ['N', 'p0', 'generations', 'runs', 'seed']),
};
export const logisticGrowth: ModuleView = {
  title: L('Tăng trưởng logistic', 'Logistic growth'),
  Stage: LogisticStage,
  Panel: LogisticPanel,
  Bottom: LogisticBottom,
  bottomTitle: L('Tốc độ tăng theo số cá thể', 'Growth rate vs population size'),
  state: bindStore(useLogistic, ['N0', 'r', 'K', 'tEnd']),
};
export const lotkaVolterra: ModuleView = {
  title: L('Con mồi – vật ăn thịt (Lotka–Volterra)', 'Predator–prey (Lotka–Volterra)'),
  Stage: LotkaVolterraStage,
  Panel: LotkaVolterraPanel,
  Bottom: LotkaVolterraBottom,
  bottomTitle: L('Số cá thể theo thời gian', 'Populations over time'),
  state: bindStore(useLv, ['alpha', 'beta', 'delta', 'gamma', 'x0', 'y0', 'tEnd']),
};
export const michaelisMenten: ModuleView = {
  title: L('Động học enzyme (Michaelis–Menten)', 'Enzyme kinetics (Michaelis–Menten)'),
  Stage: MichaelisMentenStage,
  Panel: MichaelisMentenPanel,
  Bottom: MichaelisMentenBottom,
  bottomTitle: L('Đồ thị Lineweaver–Burk', 'Lineweaver–Burk plot'),
  state: bindStore(useEnzyme, ['vmax', 'km', 'kind', 'inhibitor', 'ki', 's0', 'view', 'view3d']),
};
export const diffusionOsmosis: ModuleView = {
  title: L('Khuếch tán & thẩm thấu', 'Diffusion & osmosis'),
  Stage: DiffusionOsmosisStage,
  Panel: DiffusionOsmosisPanel,
  Bottom: DiffusionOsmosisBottom,
  bottomTitle: L('Diễn biến theo thời gian', 'Time course'),
  state: bindStore(useTransport, [
    'mode',
    'pores',
    'particles',
    'c1',
    'c2',
    'v1',
    'v2',
    'pa',
    'c0',
    'i',
    'tC',
    'h0',
  ]),
};
