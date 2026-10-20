/**
 * Words of the 3D view of "Đột biến điểm" that carry the model's values (pure): the change chip,
 * the picture's description and the picked part's card. Every base, position, codon and amino
 * acid comes from the lesson's model (`binding.ts`); `fmt` writes whole numbers for the learner's
 * locale (positions are 1-based, as in the panel).
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import type { Codon } from '../dogma';
import { BASE_NAME } from '../dogma3d/components';
import { EFFECT } from '../state';
import {
  beadNames,
  codonAt,
  inBulge,
  strandOf,
  type HelixId,
  type MutationModel3D,
} from './binding';
import { HELIX_NAME, type MutationSelection } from './components';

type Fmt = (n: number) => string;

const both = (vi: string, en: string) => L(vi, en);
const baseName = (b: string) => BASE_NAME[b] ?? L(b, b);

/** The change in words: "Thay A bằng T ở vị trí 13", "Thêm GC trước vị trí 13", "Mất 2 …". */
export function changeChip(model: MutationModel3D, fmt: Fmt): LocalizedText {
  const m = model.m;
  const p = fmt(m.pos + 1);
  if (m.kind === 'substitution') {
    const was = model.normal.coding[m.pos] ?? '';
    return both(`Thay ${was} bằng ${m.base} ở vị trí ${p}`, `${was} → ${m.base} at position ${p}`);
  }
  if (m.kind === 'insertion')
    return both(`Thêm ${m.bases} trước vị trí ${p}`, `${m.bases} inserted before position ${p}`);
  const lost = model.normal.coding.slice(m.pos, m.pos + m.count);
  return both(
    `Mất ${fmt(m.count)} nuclêôtit (${lost}) từ vị trí ${p}`,
    `${fmt(m.count)} base(s) (${lost}) deleted from position ${p}`,
  );
}

/** The picture's description for screen readers. */
export function pictureLabel(model: MutationModel3D, fmt: Fmt): LocalizedText {
  const c = changeChip(model, fmt);
  const a = fmt(beadNames(model.normal.t).length);
  const b = fmt(beadNames(model.mutated.t).length);
  return both(
    `ADN bình thường (${fmt(model.normal.coding.length)} cặp nuclêôtit) và ADN đột biến (${fmt(model.mutated.coding.length)} cặp): ${c.vi}. Protein bình thường ${a} axit amin, protein đột biến ${b} axit amin.`,
    `Normal DNA (${fmt(model.normal.coding.length)} base pairs) and mutated DNA (${fmt(model.mutated.coding.length)}): ${c.en}. Normal protein ${a} amino acids, mutated protein ${b}.`,
  );
}

export interface PartCard {
  title: LocalizedText;
  lines: LocalizedText[];
}

/** "AUG → Met (Methionine)" or "UAA → bộ ba kết thúc". */
function codonReading(c: Codon): LocalizedText {
  const e = c.entry;
  if (!e) return both(`${c.codon} → ?`, `${c.codon} → ?`);
  if (e.stop) return both(`${c.codon} → bộ ba kết thúc`, `${c.codon} → stop codon`);
  return both(`${c.codon} → ${e.three} (${e.name})`, `${c.codon} → ${e.three} (${e.name})`);
}

function codonLine(model: MutationModel3D, helix: HelixId, i: number, fmt: Fmt): LocalizedText {
  const c = codonAt(model, helix, i);
  const h = HELIX_NAME[helix];
  if (c) {
    const r = codonReading(c);
    return both(
      `Thuộc bộ ba thứ ${fmt(c.index + 1)} của mARN ${h.vi}: ${r.vi}.`,
      `In codon ${fmt(c.index + 1)} of the ${h.en} mRNA: ${r.en}.`,
    );
  }
  return strandOf(model, helix).t.start < 0
    ? both('mARN này không có bộ ba mở đầu AUG.', 'This mRNA has no AUG start codon.')
    : both(
        'Nằm ngoài khung đọc: không được dịch mã.',
        'Outside the reading frame: not translated.',
      );
}

/** An amino acid of a chain, or why there is none. */
function residueLine(model: MutationModel3D, helix: HelixId, k: number, fmt: Fmt): LocalizedText {
  const t = strandOf(model, helix).t;
  const list = t.codons.filter((c) => !c.entry?.stop);
  const c = list[k];
  const h = HELIX_NAME[helix];
  const head = both(
    helix === 'normal' ? 'Bình thường' : 'Đột biến',
    helix === 'normal' ? 'Normal' : 'Mutated',
  );
  if (c?.entry) {
    const e = c.entry;
    return both(
      `${head.vi}: ${e.three} (${e.name}), từ bộ ba ${c.codon}.`,
      `${head.en}: ${e.three} (${e.name}), from codon ${c.codon}.`,
    );
  }
  return t.start < 0
    ? both(
        `${head.vi}: không có — mARN ${h.vi} không có bộ ba mở đầu AUG.`,
        `${head.en}: none — the ${h.en} mRNA has no AUG start codon.`,
      )
    : both(
        `${head.vi}: không có — chuỗi chỉ có ${fmt(list.length)} axit amin.`,
        `${head.en}: none — the chain has only ${fmt(list.length)} amino acids.`,
      );
}

/** Title and lines of the picked part's card. */
export function selectionCard(
  model: MutationModel3D,
  sel: MutationSelection,
  fmt: Fmt,
): PartCard | null {
  switch (sel.kind) {
    case 'pair': {
      const s = strandOf(model, sel.helix);
      const b = s.coding[sel.index];
      const p = s.template[sel.index];
      if (!b || !p) return null;
      const n = fmt(sel.index + 1);
      const lines: LocalizedText[] = [
        both(
          `${baseName(b).vi} (${b}) trên mạch bổ sung, ${baseName(p).vi} (${p}) trên mạch khuôn.`,
          `${baseName(b).en} (${b}) on the coding strand, ${baseName(p).en} (${p}) on the template strand.`,
        ),
      ];
      if (sel.helix === 'normal') {
        lines.unshift(
          both(
            `ADN bình thường · cặp nuclêôtit thứ ${n}. Đã đặt vị trí đột biến ở đây (vị trí ${n}).`,
            `Normal DNA · base pair ${n}. The mutation site is now here (position ${n}).`,
          ),
        );
        const m = model.m;
        if (m.kind === 'deletion' && sel.index >= m.pos && sel.index < m.pos + m.count)
          lines.push(
            both('Cặp này bị mất ở ADN đột biến.', 'This pair is lost in the mutated DNA.'),
          );
      } else {
        lines.unshift(
          both(
            `ADN đột biến · cặp nuclêôtit thứ ${n} (đếm trên ADN đột biến).`,
            `Mutated DNA · base pair ${n} (counted on the mutated DNA).`,
          ),
        );
        const m = model.m;
        if (m.kind === 'substitution' && sel.index === m.pos) {
          const was = model.normal.coding[m.pos] ?? '';
          lines.push(
            both(
              `Cặp bị thay: ADN bình thường có ${was} ở vị trí này.`,
              `The substituted pair: the normal DNA has ${was} here.`,
            ),
          );
        } else if (inBulge(model, sel.index))
          lines.push(
            both(
              'Cặp được thêm vào: ADN bình thường không có cặp này.',
              'An inserted pair: the normal DNA does not have it.',
            ),
          );
      }
      lines.push(codonLine(model, sel.helix, sel.index, fmt));
      return {
        title: both(`Cặp ${b}–${p}`, `Pair ${b}–${p}`),
        lines,
      };
    }
    case 'codon': {
      const s = strandOf(model, sel.helix);
      const c = s.t.codons[sel.codon];
      if (!c) return null;
      const h = HELIX_NAME[sel.helix];
      const lines: LocalizedText[] = [
        both(
          `Bộ ba thứ ${fmt(c.index + 1)} của mARN ${h.vi}, vị trí ${fmt(c.pos + 1)}–${fmt(c.pos + 3)}.`,
          `Codon ${fmt(c.index + 1)} of the ${h.en} mRNA, positions ${fmt(c.pos + 1)}–${fmt(c.pos + 3)}.`,
        ),
        codonReading(c),
      ];
      const other = strandOf(model, sel.helix === 'normal' ? 'mutated' : 'normal').t.codons[
        sel.codon
      ];
      const oh = HELIX_NAME[sel.helix === 'normal' ? 'mutated' : 'normal'];
      if (other) {
        const r = codonReading(other);
        lines.push(
          both(
            `Bộ ba cùng thứ tự trên mARN ${oh.vi}: ${r.vi}.`,
            `The codon with the same number on the ${oh.en} mRNA: ${r.en}.`,
          ),
        );
      } else
        lines.push(
          both(
            `mARN ${oh.vi} không có bộ ba thứ ${fmt(c.index + 1)} trong khung đọc.`,
            `The ${oh.en} mRNA has no codon ${fmt(c.index + 1)} in its reading frame.`,
          ),
        );
      return { title: both(`Bộ ba ${c.codon}`, `Codon ${c.codon}`), lines };
    }
    case 'bead': {
      const k = sel.index;
      const a = beadNames(model.normal.t)[k];
      const b = beadNames(model.mutated.t)[k];
      if (a === undefined && b === undefined) return null;
      const same = a !== undefined && a === b;
      return {
        title: both(`Axit amin thứ ${fmt(k + 1)}`, `Amino acid ${fmt(k + 1)}`),
        lines: [
          residueLine(model, 'normal', k, fmt),
          residueLine(model, 'mutated', k, fmt),
          same
            ? both('Hai chuỗi giống nhau ở vị trí này.', 'Both chains are the same here.')
            : both('Hai chuỗi khác nhau ở vị trí này.', 'The chains differ here.'),
        ],
      };
    }
  }
}

/** The effect's name and description (`EFFECT`, shared with the 2D page). */
export const effectOf = (model: MutationModel3D) => EFFECT[model.effect];
