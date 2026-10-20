/**
 * Words of the 3D view of "Di truyền Mendel" that carry the model's values (pure): the picture's
 * description and the picked part's card. Every genotype, gamete, probability and count comes
 * from the lesson's model (`binding.ts`); `Fmt` writes numbers for the learner's locale.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import type { Locus } from '../mendel';
import {
  fractionText,
  genotypeP,
  type Field3D,
  type MendelModel3D,
  type ParentId,
} from './binding';
import { PARENT_NAME, type MendelSelection } from './components';

export interface Fmt {
  /** Whole numbers. */
  int: (n: number) => string;
  /** A value with at most `digits` significant digits (the 2D page's rounding). */
  sig: (v: number, digits: number) => string;
}

export interface PartCard {
  title: LocalizedText;
  lines: LocalizedText[];
}

const both = (vi: string, en: string) => L(vi, en);
const gene = (l: Locus) => `${l.letter.toUpperCase()}/${l.letter.toLowerCase()}`;

/** What one locus's part of a phenotype key means, from the locus's dominance. */
function locusWords(part: string, l: Locus): LocalizedText {
  const up = l.letter.toUpperCase();
  const low = l.letter.toLowerCase();
  if (l.dominance === 'complete') {
    return part.endsWith('_')
      ? both(`trội về gen ${gene(l)}`, `dominant for gene ${gene(l)}`)
      : both(`lặn về gen ${gene(l)}`, `recessive for gene ${gene(l)}`);
  }
  if (part === up + up)
    return both(
      `giống thể đồng hợp trội ${up}${up} về gen ${gene(l)}`,
      `like the homozygous dominant ${up}${up} for gene ${gene(l)}`,
    );
  if (part === low + low)
    return both(
      `giống thể đồng hợp lặn ${low}${low} về gen ${gene(l)}`,
      `like the homozygous recessive ${low}${low} for gene ${gene(l)}`,
    );
  return both(
    `trung gian về gen ${gene(l)} (trội không hoàn toàn)`,
    `intermediate for gene ${gene(l)} (incomplete dominance)`,
  );
}

/** "trội về gen A/a, lặn về gen B/b" for a phenotype key such as "A_ bb". */
export function phenotypeWords(key: string, loci: Locus[]): LocalizedText {
  const parts = key.split(' ');
  const words = loci.map((l, i) => locusWords(parts[i] ?? '', l));
  return both(words.map((w) => w.vi).join(', '), words.map((w) => w.en).join(', '));
}

/** "P: ♀ AaBb × ♂ AaBb". */
export function crossText(model: MendelModel3D): string {
  return `P: ♀ ${model.parents[0].typed} × ♂ ${model.parents[1].typed}`;
}

/** The picture's description for screen readers. */
export function pictureLabel(model: MendelModel3D, field: Field3D | null, fmt: Fmt): LocalizedText {
  const r = fmt.int(model.punnett.rows.length);
  const c = fmt.int(model.punnett.cols.length);
  const drawn = field
    ? both(
        ` ${fmt.int(field.n)} con lai ngẫu nhiên: ${field.counts.map(fmt.int).join(' : ')}.`,
        ` ${fmt.int(field.n)} random offspring: ${field.counts.map(fmt.int).join(' : ')}.`,
      )
    : both('', '');
  return both(
    `Phép lai ${crossText(model)}. Bảng Punnett ${r} × ${c} ô; tỉ lệ kiểu hình ${model.ratioText}.${drawn.vi}`,
    `Cross ${crossText(model)}. Punnett square of ${r} × ${c} cells; phenotype ratio ${model.ratioText}.${drawn.en}`,
  );
}

/** "AB 1/4 · Ab 1/4 · aB 1/4 · ab 1/4". */
function gameteList(model: MendelModel3D, parent: ParentId, fmt: Fmt): string {
  return model.parents[parent].gametes
    .map((g) => `${g.gamete} ${fractionText(g.p, fmt.int)}`)
    .join(' · ');
}

function parentCard(model: MendelModel3D, parent: ParentId, fmt: Fmt): PartCard {
  const p = model.parents[parent];
  const name = PARENT_NAME[parent];
  const lines: LocalizedText[] = model.loci.map((l, i) => {
    const [a, b] = p.pairs[i] ?? ['', ''];
    const n = fmt.int(i + 1);
    return a === b
      ? both(
          `Gen ${gene(l)}: cặp NST thứ ${n} trên hình mang ${a} và ${b} (đồng hợp).`,
          `Gene ${gene(l)}: chromosome pair ${n} in the picture carries ${a} and ${b} (homozygous).`,
        )
      : both(
          `Gen ${gene(l)}: cặp NST thứ ${n} trên hình mang ${a} và ${b} (dị hợp).`,
          `Gene ${gene(l)}: chromosome pair ${n} in the picture carries ${a} and ${b} (heterozygous).`,
        );
  });
  const words = phenotypeWords(p.phenotype, model.loci);
  lines.push(
    both(`Kiểu hình: ${p.phenotype} — ${words.vi}.`, `Phenotype: ${p.phenotype} — ${words.en}.`),
  );
  const kinds = fmt.int(p.gametes.length);
  const list = gameteList(model, parent, fmt);
  lines.push(both(`Cho ${kinds} loại giao tử: ${list}.`, `${kinds} kind(s) of gamete: ${list}.`));
  return { title: both(`${name.vi}: ${p.genotype}`, `${name.en}: ${p.genotype}`), lines };
}

function gameteCard(
  model: MendelModel3D,
  parent: ParentId,
  index: number,
  fmt: Fmt,
): PartCard | null {
  const p = model.parents[parent];
  const g = p.gametes[index];
  if (!g) return null;
  const alleles = model.loci.map((l, i) => `${g.gamete[i] ?? ''} (${gene(l)})`).join(', ');
  const where = fmt.int(index + 1);
  const from = parent === 0 ? both('mẹ', 'the mother') : both('bố', 'the father');
  return {
    title: both(
      `Giao tử ${parent === 0 ? '♀' : '♂'} ${g.gamete}`,
      `Gamete ${parent === 0 ? '♀' : '♂'} ${g.gamete}`,
    ),
    lines: [
      both(
        `Xác suất: ${fractionText(g.p, fmt.int)} (từ ${from.vi} ${p.genotype}).`,
        `Probability: ${fractionText(g.p, fmt.int)} (from ${from.en} ${p.genotype}).`,
      ),
      both(
        `Mang một alen của mỗi gen: ${alleles}.`,
        `Carries one allele of each gene: ${alleles}.`,
      ),
      both(
        'Hai NST của mỗi cặp tương đồng phân li về hai giao tử khác nhau; các cặp phân li độc lập với nhau.',
        'The two chromosomes of each homologous pair go to different gametes; the pairs assort independently of each other.',
      ),
      parent === 0
        ? both(`Trên bảng Punnett: hàng ${where}.`, `On the Punnett square: row ${where}.`)
        : both(`Trên bảng Punnett: cột ${where}.`, `On the Punnett square: column ${where}.`),
    ],
  };
}

function cellCard(model: MendelModel3D, row: number, col: number, fmt: Fmt): PartCard | null {
  const child = model.punnett.cells[row]?.[col];
  const f = model.parents[0].gametes[row];
  const m = model.parents[1].gametes[col];
  const cls = model.classes[model.cellClass[row]?.[col] ?? -1];
  if (child === undefined || !f || !m || !cls) return null;
  const pCell = model.cellP[row]?.[col] ?? 0;
  const same = model.punnett.cells.flat().filter((c) => c === child).length;
  const words = phenotypeWords(cls.key, model.loci);
  const r = fmt.int(row + 1);
  const c = fmt.int(col + 1);
  const ft = (p: number) => fractionText(p, fmt.int);
  return {
    title: both(`Ô hàng ${r} · cột ${c}: ${child}`, `Row ${r} · column ${c}: ${child}`),
    lines: [
      both(
        `Giao tử ♀ ${f.gamete} × giao tử ♂ ${m.gamete}.`,
        `Gamete ♀ ${f.gamete} × gamete ♂ ${m.gamete}.`,
      ),
      both(
        `Xác suất ô này: ${ft(f.p)} × ${ft(m.p)} = ${ft(pCell)}.`,
        `Probability of this cell: ${ft(f.p)} × ${ft(m.p)} = ${ft(pCell)}.`,
      ),
      both(
        `Kiểu gen ${child}: ${ft(genotypeP(model, child))} số con lai (${fmt.int(same)} ô trên bảng).`,
        `Genotype ${child}: ${ft(genotypeP(model, child))} of the offspring (${fmt.int(same)} cell(s) on the square).`,
      ),
      both(
        `Kiểu hình ${cls.key} — ${words.vi}: ${ft(cls.p)}.`,
        `Phenotype ${cls.key} — ${words.en}: ${ft(cls.p)}.`,
      ),
    ],
  };
}

function classCard(
  model: MendelModel3D,
  index: number,
  field: Field3D | null,
  fmt: Fmt,
): PartCard | null {
  const cls = model.classes[index];
  if (!cls) return null;
  const words = phenotypeWords(cls.key, model.loci);
  const ft = (p: number) => fractionText(p, fmt.int);
  const pct = fmt.sig(cls.p * 100, 4);
  const genotypes = cls.genotypes.map((g) => `${g.genotype} ${ft(g.p)}`).join(' · ');
  const lines: LocalizedText[] = [
    both(
      `${words.vi.charAt(0).toUpperCase()}${words.vi.slice(1)}.`,
      `${words.en.charAt(0).toUpperCase()}${words.en.slice(1)}.`,
    ),
    both(`Xác suất: ${ft(cls.p)} (${pct} %).`, `Probability: ${ft(cls.p)} (${pct} %).`),
    both(
      `Tỉ lệ: ${fmt.int(cls.ratio)} trong ${model.ratioText}.`,
      `Ratio: ${fmt.int(cls.ratio)} of ${model.ratioText}.`,
    ),
    both(`Kiểu gen: ${genotypes}.`, `Genotypes: ${genotypes}.`),
  ];
  const count = field?.counts[index];
  if (field && count !== undefined) {
    const expected = fmt.sig(cls.p * field.n, 5);
    lines.push(
      both(
        `Lần tạo ngẫu nhiên: ${fmt.int(count)} / ${fmt.int(field.n)} con lai (kì vọng ${expected}).`,
        `Random draw: ${fmt.int(count)} / ${fmt.int(field.n)} offspring (expected ${expected}).`,
      ),
    );
  }
  return { title: both(`Kiểu hình ${cls.key}`, `Phenotype ${cls.key}`), lines };
}

/** The picked part's card, or null when the selection is not part of this model. */
export function selectionCard(
  model: MendelModel3D,
  sel: MendelSelection,
  field: Field3D | null,
  fmt: Fmt,
): PartCard | null {
  switch (sel.kind) {
    case 'parent':
      return parentCard(model, sel.parent, fmt);
    case 'gamete':
      return gameteCard(model, sel.parent, sel.index, fmt);
    case 'cell':
      return cellCard(model, sel.row, sel.col, fmt);
    case 'class':
      return classCard(model, sel.index, field, fmt);
  }
}

/** Whether a selection names a part of this model (inputs changed: an old pick may not). */
export function selectionValid(model: MendelModel3D, sel: MendelSelection): boolean {
  switch (sel.kind) {
    case 'parent':
      return true;
    case 'gamete':
      return sel.index >= 0 && sel.index < model.parents[sel.parent].gametes.length;
    case 'cell':
      return model.punnett.cells[sel.row]?.[sel.col] !== undefined;
    case 'class':
      return sel.index >= 0 && sel.index < model.classes.length;
  }
}
