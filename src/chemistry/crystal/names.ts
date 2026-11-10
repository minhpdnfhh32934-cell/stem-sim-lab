import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';
import type { CrystalId, SiteKind } from './lattice';

/** Structure names (DATA_REVIEW CRY-2: wording to be confirmed by the teacher). */
export const CRYSTAL_NAME: Record<CrystalId, LocalizedText> = {
  bcc: L('Lập phương tâm khối', 'Body-centred cubic'),
  fcc: L('Lập phương tâm mặt', 'Face-centred cubic'),
  hcp: L('Lục phương đặc khít', 'Hexagonal close-packed'),
  nacl: L('Tinh thể NaCl', 'NaCl crystal'),
};

export const SHORT_NAME: Record<CrystalId, LocalizedText> = {
  bcc: L('Tâm khối', 'BCC'),
  fcc: L('Tâm mặt', 'FCC'),
  hcp: L('Lục phương', 'HCP'),
  nacl: L('NaCl', 'NaCl'),
};

export const KIND_NAME: Record<SiteKind, LocalizedText> = {
  M: L('nguyên tử kim loại', 'metal atoms'),
  Na: L('ion Na⁺', 'Na⁺ ions'),
  Cl: L('ion Cl⁻', 'Cl⁻ ions'),
};
