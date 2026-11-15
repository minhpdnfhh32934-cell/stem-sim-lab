import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { CovalentBottom, CovalentPanel, CovalentStage } from './CovalentViews';
import { ForcesBottom, ForcesPanel, ForcesStage } from './ForcesViews';
import { IonicPanel, IonicStage } from './IonicViews';
import { OctetPanel, OctetStage } from './OctetViews';
import { applyBonding, useBondingStore } from './store';

/** Hoá học 10 KNTT, chương 3 "Liên kết hoá học": Bài 10–13 (#255). */
export const octetRule: ModuleView = {
  title: L('Quy tắc octet', 'The octet rule'),
  Stage: OctetStage,
  Panel: OctetPanel,
  state: bindStore(useBondingStore, ['octet'], applyBonding),
};

export const ionicBond: ModuleView = {
  title: L('Liên kết ion', 'Ionic bond'),
  Stage: IonicStage,
  Panel: IonicPanel,
  state: bindStore(useBondingStore, ['metal', 'nonmetal'], applyBonding),
};

export const covalentBond: ModuleView = {
  title: L('Liên kết cộng hoá trị', 'Covalent bond'),
  Stage: CovalentStage,
  Panel: CovalentPanel,
  Bottom: CovalentBottom,
  bottomTitle: L('Bảng liên kết', 'Bonds'),
  state: bindStore(useBondingStore, ['covalent'], applyBonding),
};

export const intermolecularForces: ModuleView = {
  title: L(
    'Liên kết hydrogen và tương tác van der Waals',
    'Hydrogen bonds and van der Waals forces',
  ),
  Stage: ForcesStage,
  Panel: ForcesPanel,
  Bottom: ForcesBottom,
  bottomTitle: L('Số liệu và nguồn', 'Data and sources'),
  state: bindStore(useBondingStore, ['unit'], applyBonding),
};
