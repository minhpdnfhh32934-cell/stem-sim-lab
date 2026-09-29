import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';
import type { Molecule } from '../data/molecules';

export const METHOD_LABEL: Record<Molecule['geometry_method'], LocalizedText> = {
  mmff94: L(
    'Cấu trúc tối ưu bằng trường lực MMFF94 (RDKit)',
    'Structure optimised with the MMFF94 force field (RDKit)',
  ),
  uff: L(
    'Cấu trúc tối ưu bằng trường lực UFF (RDKit)',
    'Structure optimised with the UFF force field (RDKit)',
  ),
  experimental: L('Hình học thực nghiệm (NIST CCCBDB)', 'Experimental geometry (NIST CCCBDB)'),
  'vsepr-ideal': L(
    'Hình học VSEPR lý tưởng (độ dài = tổng bán kính cộng hóa trị)',
    'Ideal VSEPR geometry (lengths = sum of covalent radii)',
  ),
};

export const BOND_TYPE = {
  nonpolar: L('cộng hóa trị không phân cực', 'non-polar covalent'),
  polar: L('cộng hóa trị phân cực', 'polar covalent'),
  ionic: L('ion', 'ionic'),
};
const ORDER_NAMES: Record<number, LocalizedText> = {
  1: L('đơn', 'single'),
  2: L('đôi', 'double'),
  3: L('ba', 'triple'),
};
export const orderName = (order: number): LocalizedText =>
  ORDER_NAMES[order] ?? L(String(order), String(order));
export const POLARITY = {
  nonpolar: L('Không phân cực', 'Non-polar'),
  weak: L('Phân cực yếu', 'Weakly polar'),
  polar: L('Phân cực', 'Polar'),
  ion: L('Ion — không xét độ phân cực phân tử', 'Ion — molecular polarity not defined'),
  unknown: L('Không xác định (thiếu độ âm điện)', 'Unknown (missing electronegativity)'),
};
