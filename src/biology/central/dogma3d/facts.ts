/**
 * Words of the 3D view of "ADN → mARN → Protein" that carry the model's values (pure): the
 * caption of a moment, the chips, the picture's description and the picked part's card. Every
 * base, position, codon, anticodon and amino acid comes from the lesson's model; `fmt` writes
 * whole numbers for the learner's locale (positions are 1-based, as on the 2D page).
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import type { Codon } from '../dogma';
import {
  anticodonOf,
  aminoAcidOf,
  chainAt,
  codonAt,
  releasing,
  type DogmaModel3D,
  type DogmaMoment,
} from './binding';
import { BASE_NAME, DOGMA_PARTS, type DogmaSelection } from './components';

type Fmt = (n: number) => string;

const both = (vi: string, en: string) => L(vi, en);
const baseName = (b: string) => BASE_NAME[b] ?? L(b, b);

/** "AUG → Met (Methionine)" or "UAA → bộ ba kết thúc". */
function codonReading(c: Codon): LocalizedText {
  const aa = aminoAcidOf(c);
  if (!aa) return both(`${c.codon} → bộ ba kết thúc`, `${c.codon} → stop codon`);
  return both(`${c.codon} → ${aa.three} (${aa.name})`, `${c.codon} → ${aa.three} (${aa.name})`);
}

/** The phase chip / strip: which of the two steps is shown. */
export function phaseOf(mo: DogmaMoment): 'transcription' | 'translation' {
  return mo.phase === 'translation' ? 'translation' : 'transcription';
}

/** What is happening now (caption under the picture). */
export function momentCaption(m: DogmaModel3D, mo: DogmaMoment, fmt: Fmt): LocalizedText {
  const n = m.mrna.length;
  if (mo.phase === 'transcription') {
    const k = mo.made;
    if (k === 0)
      return both(
        'ARN pôlimeraza tháo xoắn đoạn ADN đầu tiên và bắt đầu đọc mạch khuôn theo chiều 3′→5′.',
        'RNA polymerase unwinds the first stretch of DNA and starts reading the template strand 3′→5′.',
      );
    const j = k - 1;
    const rna = m.mrna[j] ?? '';
    const tpl = m.template[j] ?? '';
    return both(
      `mARN dài ${fmt(k)}/${fmt(n)} nuclêôtit (5′→3′). Nuclêôtit vừa lắp: ${rna}, bắt cặp với ${tpl} của mạch khuôn.`,
      `mRNA ${fmt(k)}/${fmt(n)} nucleotides long (5′→3′). Last nucleotide added: ${rna}, paired with ${tpl} on the template strand.`,
    );
  }
  if (mo.phase === 'release') {
    return m.t.codons.length
      ? both(
          `Phiên mã xong: mARN ${fmt(n)} nuclêôtit rời mạch khuôn, ADN xoắn lại.`,
          `Transcription done: the ${fmt(n)}-nucleotide mRNA leaves the template, the DNA winds up again.`,
        )
      : both(
          `Phiên mã xong: mARN ${fmt(n)} nuclêôtit. mARN không có bộ ba mở đầu AUG nên không dịch mã.`,
          `Transcription done: ${fmt(n)}-nucleotide mRNA. It has no AUG start codon, so there is no translation.`,
        );
  }
  const c = m.t.codons[mo.step];
  if (!c) return L('', '');
  const steps = m.t.codons.length;
  const at = both(
    `Ribosome ở bộ ba thứ ${fmt(mo.step + 1)}/${fmt(steps)}: `,
    `Ribosome at codon ${fmt(mo.step + 1)}/${fmt(steps)}: `,
  );
  if (releasing(m, mo))
    return both(
      `${at.vi}${c.codon} là bộ ba kết thúc — không có tARN nào đến, chuỗi pôlipeptit được giải phóng.`,
      `${at.en}${c.codon} is a stop codon — no tRNA comes, the polypeptide is released.`,
    );
  const r = codonReading(c);
  const anti = anticodonOf(c) ?? '';
  const tail =
    mo.step === steps - 1 && m.t.stopIndex < 0
      ? both(' Hết mARN mà chưa gặp bộ ba kết thúc.', ' The mRNA ends before any stop codon.')
      : L('', '');
  return both(
    `${at.vi}${r.vi}, tARN mang bộ ba đối mã ${anti}.${tail.vi}`,
    `${at.en}${r.en}, tRNA with anticodon ${anti}.${tail.en}`,
  );
}

/** The counts chip: mRNA made, or amino acids in the chain. */
export function countsChip(m: DogmaModel3D, mo: DogmaMoment, fmt: Fmt): LocalizedText {
  if (mo.phase !== 'translation')
    return both(
      `mARN: ${fmt(mo.made)}/${fmt(m.mrna.length)} nuclêôtit`,
      `mRNA: ${fmt(mo.made)}/${fmt(m.mrna.length)} nucleotides`,
    );
  const k = chainAt(m, mo).length;
  return both(`Chuỗi pôlipeptit: ${fmt(k)} axit amin`, `Polypeptide: ${fmt(k)} amino acids`);
}

/** The picture's description for screen readers. */
export function pictureLabel(m: DogmaModel3D, mo: DogmaMoment, fmt: Fmt): LocalizedText {
  const c = momentCaption(m, mo, fmt);
  return both(
    `Chuỗi xoắn kép ADN ${fmt(m.coding.length)} cặp nuclêôtit. ${c.vi}`,
    `DNA double helix of ${fmt(m.coding.length)} base pairs. ${c.en}`,
  );
}

export interface PartCard {
  title: LocalizedText;
  lines: LocalizedText[];
}

/** "Bộ ba thứ 1 trên mARN: AUG → Met (Methionine) · bộ ba đối mã của tARN: UAC." */
function codonLine(c: Codon, fmt: Fmt): LocalizedText {
  const r = codonReading(c);
  const anti = anticodonOf(c);
  const n = fmt(c.index + 1);
  return anti
    ? both(
        `Bộ ba thứ ${n} trên mARN: ${r.vi} · bộ ba đối mã của tARN: ${anti}.`,
        `Codon ${n} on the mRNA: ${r.en} · tRNA anticodon: ${anti}.`,
      )
    : both(
        `Bộ ba thứ ${n} trên mARN: ${r.vi} · không có tARN nào mang bộ ba đối mã cho bộ ba này.`,
        `Codon ${n} on the mRNA: ${r.en} · no tRNA has an anticodon for it.`,
      );
}

const outsideFrame = (m: DogmaModel3D, i: number): LocalizedText => {
  if (m.t.start < 0)
    return both(
      'mARN không có bộ ba mở đầu AUG: không có khung đọc.',
      'The mRNA has no AUG start codon: no reading frame.',
    );
  return i < m.t.start
    ? both(
        'Nằm trước bộ ba mở đầu AUG: không được dịch mã.',
        'Before the AUG start codon: not translated.',
      )
    : both(
        'Nằm sau khung đọc (sau bộ ba kết thúc hoặc phần lẻ cuối): không được dịch mã.',
        'After the reading frame (past the stop codon or the last incomplete codon): not translated.',
      );
};

/** Title and lines of the picked part's card. */
export function selectionCard(m: DogmaModel3D, sel: DogmaSelection, fmt: Fmt): PartCard | null {
  switch (sel.kind) {
    case 'part':
      return { title: DOGMA_PARTS[sel.part].name, lines: [DOGMA_PARTS[sel.part].role] };
    case 'base': {
      const i = sel.index;
      const coding = sel.strand === 'coding';
      const base = (coding ? m.coding : m.template)[i];
      const partner = (coding ? m.template : m.coding)[i];
      if (!base || !partner) return null;
      const name = baseName(base);
      const pname = baseName(partner);
      const strand = DOGMA_PARTS[coding ? 'coding' : 'template'].name;
      const other = DOGMA_PARTS[coding ? 'template' : 'coding'].name;
      const c = codonAt(m, i);
      return {
        title: both(`${name.vi} (${base})`, `${name.en} (${base})`),
        lines: [
          both(
            `${strand.vi} · cặp nuclêôtit thứ ${fmt(i + 1)} (đếm từ đầu 5′ của mạch bổ sung).`,
            `${strand.en} · base pair ${fmt(i + 1)} (counted from the 5′ end of the coding strand).`,
          ),
          both(
            `Bắt cặp với ${partner} (${pname.vi}) trên ${other.vi.toLowerCase()}.`,
            `Pairs with ${partner} (${pname.en}) on the ${other.en.toLowerCase()}.`,
          ),
          both(
            `Nuclêôtit tương ứng trên mARN: ${m.mrna[i] ?? ''}.`,
            `Matching mRNA nucleotide: ${m.mrna[i] ?? ''}.`,
          ),
          c ? codonLine(c, fmt) : outsideFrame(m, i),
        ],
      };
    }
    case 'mrnaBase': {
      const i = sel.index;
      const b = m.mrna[i];
      if (!b) return null;
      const name = baseName(b);
      const c = codonAt(m, i);
      return {
        title: both(`${name.vi} (${b}) trên mARN`, `${name.en} (${b}) on the mRNA`),
        lines: [
          both(
            `Vị trí ${fmt(i + 1)} trên mARN (5′→3′); bắt cặp với ${m.template[i] ?? ''} của mạch khuôn khi phiên mã.`,
            `Position ${fmt(i + 1)} on the mRNA (5′→3′); paired with ${m.template[i] ?? ''} on the template strand during transcription.`,
          ),
          c ? codonLine(c, fmt) : outsideFrame(m, i),
        ],
      };
    }
    case 'codon': {
      const c = m.t.codons[sel.codon];
      if (!c) return null;
      const aa = aminoAcidOf(c);
      const anti = anticodonOf(c);
      return {
        title: both(`Bộ ba ${c.codon}`, `Codon ${c.codon}`),
        lines: [
          both(
            `Bộ ba thứ ${fmt(c.index + 1)} của khung đọc, vị trí ${fmt(c.pos + 1)}–${fmt(c.pos + 3)} trên mARN.`,
            `Codon ${fmt(c.index + 1)} of the reading frame, positions ${fmt(c.pos + 1)}–${fmt(c.pos + 3)} on the mRNA.`,
          ),
          anti
            ? both(`Bộ ba đối mã trên tARN: ${anti}.`, `tRNA anticodon: ${anti}.`)
            : both(
                'Bộ ba kết thúc: không có tARN nào mang bộ ba đối mã tương ứng; chuỗi pôlipeptit được giải phóng.',
                'Stop codon: no tRNA has a matching anticodon; the polypeptide is released.',
              ),
          aa
            ? both(`Axit amin: ${aa.three} (${aa.name}).`, `Amino acid: ${aa.three} (${aa.name}).`)
            : both('Không mã hóa axit amin.', 'Codes for no amino acid.'),
        ],
      };
    }
    case 'residue': {
      const c = m.t.codons[sel.codon];
      const aa = c ? aminoAcidOf(c) : null;
      if (!c || !aa) return null;
      const k = m.t.codons.slice(0, c.index + 1).filter((x) => !x.entry?.stop).length;
      return {
        title: both(`${aa.three} (${aa.name})`, `${aa.three} (${aa.name})`),
        lines: [
          both(
            `Axit amin thứ ${fmt(k)} của chuỗi pôlipeptit.`,
            `Amino acid ${fmt(k)} of the polypeptide.`,
          ),
          codonLine(c, fmt),
        ],
      };
    }
  }
}
