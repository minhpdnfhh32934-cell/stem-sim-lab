import { normalizeForSearch } from '@/app/catalog';
import type { LocalizedText } from '@/core/data/dataset';
import type { Category, ElementData } from '../data/elements';
import type { ColorBy } from './store';
import { L } from '../common';

export const CATEGORY_LABEL: Record<Category, LocalizedText> = {
  alkaliMetal: L('Kim loại kiềm', 'Alkali metal'),
  alkalineEarthMetal: L('Kim loại kiềm thổ', 'Alkaline earth metal'),
  transitionMetal: L('Kim loại chuyển tiếp', 'Transition metal'),
  postTransitionMetal: L('Kim loại yếu', 'Post-transition metal'),
  metalloid: L('Á kim', 'Metalloid'),
  nonmetal: L('Phi kim', 'Nonmetal'),
  halogen: L('Halogen', 'Halogen'),
  nobleGas: L('Khí hiếm', 'Noble gas'),
  lanthanide: L('Họ lanthanide', 'Lanthanide'),
  actinide: L('Họ actinide', 'Actinide'),
};

export const COLOR_BY: { id: ColorBy; label: LocalizedText }[] = [
  { id: 'category', label: L('Nhóm chất', 'Category') },
  { id: 'block', label: L('Khối s/p/d/f', 's/p/d/f block') },
  { id: 'en', label: L('Độ âm điện', 'Electronegativity') },
  { id: 'radius', label: L('Bán kính', 'Radius') },
  { id: 'ie', label: L('Năng lượng ion hóa', 'Ionization energy') },
  { id: 'mass', label: L('Nguyên tử khối', 'Atomic weight') },
];

/** Grid position: main table rows 1–7, lanthanides/actinides in rows 9–10 (Ce–Lu, Th–Lr). */
export function gridPosition(e: ElementData): { row: number; col: number } {
  if (e.group !== null) return { row: e.period, col: e.group };
  const first = e.period === 6 ? 58 : 90;
  return { row: e.period + 3, col: 4 + (e.z - first) };
}

export function matchesQuery(e: ElementData, q: string): boolean {
  const n = normalizeForSearch(q);
  if (!n) return false;
  if (String(e.z) === n) return true;
  if (e.symbol.toLowerCase() === n) return true;
  return (
    normalizeForSearch(e.name).startsWith(n) ||
    e.aliases_vi.some((a) => normalizeForSearch(a).startsWith(n))
  );
}
