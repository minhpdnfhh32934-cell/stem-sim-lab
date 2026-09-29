import type { LocalizedText, Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useEffect } from 'react';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/**
 * Chemistry bibliography. Editions/pages are confirmed by the reviewing teacher
 * (docs/DATA_REVIEW.md); nothing here is used as a number source except where stated.
 */
export const CSRC = {
  sgk10: {
    id: 'sgk-hh10',
    citation:
      'Sách giáo khoa Hóa học 10 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — cấu tạo nguyên tử, bảng tuần hoàn, liên kết hóa học',
  },
  sgk11: {
    id: 'sgk-hh11',
    citation:
      'Sách giáo khoa Hóa học 11 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — cân bằng hóa học, hydrocarbon, dẫn xuất halogen, alcohol, carboxylic acid',
  },
  sgk12: {
    id: 'sgk-hh12',
    citation:
      'Sách giáo khoa Hóa học 12 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — ester, pin điện hóa, kim loại',
  },
  iupacTable: {
    id: 'iupac-pt',
    citation: 'IUPAC Periodic Table of the Elements',
    url: 'https://iupac.org/what-we-do/periodic-table-of-elements/',
  },
  nistAsd: {
    id: 'nist-asd',
    citation: 'NIST Atomic Spectra Database — ground-state configurations and ionization energies',
    url: 'https://physics.nist.gov/asd',
  },
  atkins: {
    id: 'atkins',
    citation:
      "P. Atkins, J. de Paula, J. Keeler — Atkins' Physical Chemistry, Oxford University Press",
  },
  griffiths: {
    id: 'griffiths-qm',
    citation: 'D. J. Griffiths — Introduction to Quantum Mechanics, §4.2 The hydrogen atom',
  },
  clayden: {
    id: 'clayden',
    citation:
      'J. Clayden, N. Greeves, S. Warren — Organic Chemistry, 2nd ed., Oxford University Press',
  },
  gillespie: {
    id: 'gillespie-vsepr',
    citation:
      'R. J. Gillespie, I. Hargittai — The VSEPR Model of Molecular Geometry, Allyn & Bacon 1991',
  },
  rdkit: {
    id: 'rdkit',
    citation: 'RDKit: Open-source cheminformatics (ETKDG conformer + MMFF94 optimisation)',
    url: 'https://www.rdkit.org',
  },
  codata: { id: 'codata', citation: 'CODATA 2022 (NIST) — hằng số vật lý' },
} satisfies Record<string, Source>;

/** Publishes a module's Science Card to the Inspector while the module is open. */
export function usePublishCard(card: ScienceCardData | null): void {
  useEffect(() => {
    useWorkspaceStore.setState({ scienceCard: card });
  }, [card]);
}
