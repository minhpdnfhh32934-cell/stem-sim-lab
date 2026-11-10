import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';

/** Functional groups the data script finds (scripts/data/gen_molecules.py GROUP_SMARTS order). */
export const GROUPS = [
  'alkane',
  'alkene',
  'alkyne',
  'arene',
  'halide',
  'alcohol',
  'phenol',
  'ether',
  'aldehyde',
  'ketone',
  'acid',
  'ester',
  'amine',
  'amide',
] as const;
export type FunctionalGroup = (typeof GROUPS)[number];

/** Names as in SGK Hoá học 11–12 (2018); DATA_REVIEW ORG-2. */
export const GROUP_NAME: Record<FunctionalGroup, LocalizedText> = {
  alkane: L('Alkane', 'Alkanes'),
  alkene: L('Alkene (có liên kết đôi C=C)', 'Alkenes (C=C)'),
  alkyne: L('Alkyne (có liên kết ba C≡C)', 'Alkynes (C≡C)'),
  arene: L('Arene (hydrocarbon thơm, vòng benzene)', 'Arenes (benzene ring)'),
  halide: L('Dẫn xuất halogen', 'Organic halides'),
  alcohol: L('Alcohol (–OH)', 'Alcohols (–OH)'),
  phenol: L('Phenol (–OH gắn vòng benzene)', 'Phenols (–OH on a benzene ring)'),
  ether: L('Ether (C–O–C)', 'Ethers (C–O–C)'),
  aldehyde: L('Aldehyde (–CHO)', 'Aldehydes (–CHO)'),
  ketone: L('Ketone (C–CO–C)', 'Ketones (C–CO–C)'),
  acid: L('Carboxylic acid (–COOH)', 'Carboxylic acids (–COOH)'),
  ester: L('Ester (–COO–)', 'Esters (–COO–)'),
  amine: L('Amine (–NH₂, –NH–, –N<)', 'Amines'),
  amide: L('Amide (–CO–N<)', 'Amides'),
};
