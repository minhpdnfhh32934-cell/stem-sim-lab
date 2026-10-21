/**
 * Texts of the genetic drift 3D view (pure, tested): the chips, the picked island's or figure's
 * card, the callouts' names and the honest notes. Every number is the model's (`binding.ts`),
 * formatted by the caller's `fmt` (the learner's locale). New wording: DATA_REVIEW DRF3D-*.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import type { Fmt } from '../hw3d/facts';
import {
  figureAlleles,
  islandAt,
  islandOf,
  summaryAt,
  type DriftModel3D,
  type DriftSelection,
  type IslandAt,
} from './binding';

export type { Fmt };

export interface Card {
  title: LocalizedText;
  lines: LocalizedText[];
}

/** Glyphs of the beads' shapes (A a cube, a a sphere), as on the chips and the island tags. */
export const GLYPH = { A: '■', a: '●' } as const;

/** What the picture's name callouts point at (`scene.ts` places them). */
export type DriftCallout = 'island' | 'band' | 'genes' | 'figure' | 'fixed' | 'lost';

export const CALLOUTS: Record<DriftCallout, LocalizedText> = {
  island: L('Đảo = 1 quần thể (1 lần chạy)', 'Island = 1 population (1 run)'),
  band: L('Dải p : q', 'p : q band'),
  genes: L('Hai hạt = hai bản sao gen', 'Two beads = two gene copies'),
  figure: L('Cá thể', 'Individual'),
  fixed: L(`A cố định ${GLYPH.A}`, `A fixed ${GLYPH.A}`),
  lost: L(`A mất ${GLYPH.a}`, `A lost ${GLYPH.a}`),
};

/** Short honest caption (the Science Card has the full note). */
export const CAPTION = L(
  'Minh họa: đảo, con vật, chỗ đứng, cây cỏ, cử động và cách ghép hai bản sao gen vào một con vật; số bản sao A, a, p và số đảo cố định hay mất A theo mô hình.',
  'Illustration: islands, animals, places, plants, motion and which two gene copies an animal carries; copies of A and a, p and how many islands fixed or lost A follow the model.',
);

export const SOURCES = L(
  'Nguồn: SGK Sinh học 12; Hartl & Clark, Principles of Population Genetics · nội dung đang chờ giáo viên duyệt.',
  'Sources: Vietnamese Biology 12 textbook; Hartl & Clark, Principles of Population Genetics · awaiting teacher review.',
);

/** The drawing scale: figures per individual and beads per gene copy (one chip). */
export function scaleText(model: DriftModel3D, fmt: Fmt): LocalizedText {
  if (model.per <= 1)
    return L(
      '1 hình = 1 cá thể · 1 hạt = 1 bản sao gen',
      '1 figure = 1 individual · 1 bead = 1 gene copy',
    );
  const k = fmt(model.per, 6);
  return L(
    `1 hình = ${k} cá thể · 1 hạt = ${k} bản sao gen (làm tròn)`,
    `1 figure = ${k} individuals · 1 bead = ${k} gene copies (rounded)`,
  );
}

/** How many islands have fixed or lost A by generation g, and how many still have both. */
export function summaryText(
  model: DriftModel3D,
  g: number,
): { fixed: LocalizedText; lost: LocalizedText; both: LocalizedText } {
  const s = summaryAt(model, g);
  return {
    fixed: L(`A cố định: ${String(s.fixed)}`, `A fixed: ${String(s.fixed)}`),
    lost: L(`A mất: ${String(s.lost)}`, `A lost: ${String(s.lost)}`),
    both: L(`còn cả hai: ${String(s.polymorphic)}`, `both left: ${String(s.polymorphic)}`),
  };
}

/** Copies of A at generation g: generation 0 is the frequency chosen, 2N·p₀ may be a half. */
function copiesLine(model: DriftModel3D, x: IslandAt, fmt: Fmt): LocalizedText {
  const twoN = fmt(2 * model.N, 6);
  if (x.g === 0)
    return L(
      `Thế hệ 0: tần số ban đầu p₀ = ${fmt(x.p, 4)} (2N·p₀ = ${fmt(x.copies.A, 6)} trong ${twoN} bản sao).`,
      `Generation 0: initial frequency p₀ = ${fmt(x.p, 4)} (2N·p₀ = ${fmt(x.copies.A, 6)} of ${twoN} copies).`,
    );
  return L(
    `Thế hệ ${String(x.g)}: A có ${fmt(x.copies.A, 6)}, a có ${fmt(x.copies.a, 6)} trong ${twoN} bản sao → p = ${fmt(x.p, 4)}, q = ${fmt(1 - x.p, 4)}.`,
    `Generation ${String(x.g)}: ${fmt(x.copies.A, 6)} copies of A and ${fmt(x.copies.a, 6)} of a out of ${twoN} → p = ${fmt(x.p, 4)}, q = ${fmt(1 - x.p, 4)}.`,
  );
}

/** The island's fate as the model's run tells it, seen from generation g. */
function fateLine(model: DriftModel3D, island: number, g: number, fmt: Fmt): LocalizedText {
  const end = model.absorbed[island] ?? null;
  if (!end) {
    const last = model.runs[island]?.at(-1) ?? 0;
    return L(
      `Đến thế hệ cuối (${String(model.generations)}) đảo vẫn còn cả A và a (p = ${fmt(last, 4)}).`,
      `By the last generation (${String(model.generations)}) the island still has both A and a (p = ${fmt(last, 4)}).`,
    );
  }
  const at = String(end.generation);
  if (end.fate === 'fixed')
    return g >= end.generation
      ? L(
          `A cố định từ thế hệ ${at}: cả đảo chỉ còn A (cỏ đổi sang màu của A để đánh dấu).`,
          `A fixed from generation ${at}: only A is left on the island (its grass takes A's colour as a marker).`,
        )
      : L(
          `Ở thế hệ này còn cả A và a; về sau A cố định ở thế hệ ${at}.`,
          `Both A and a are still here; later A is fixed at generation ${at}.`,
        );
  return g >= end.generation
    ? L(
        `A mất từ thế hệ ${at}: cả đảo chỉ còn a (cỏ đổi sang màu của a để đánh dấu).`,
        `A lost from generation ${at}: only a is left on the island (its grass takes a's colour as a marker).`,
      )
    : L(
        `Ở thế hệ này còn cả A và a; về sau A mất ở thế hệ ${at}.`,
        `Both A and a are still here; later A is lost at generation ${at}.`,
      );
}

/** Shapes of the two beads a figure carries (0 = A A, 1 = A a, 2 = a a). */
const BEADS: readonly LocalizedText[] = [
  L('hai khối vuông (A, A)', 'two cubes (A, A)'),
  L('một khối vuông (A) và một hình cầu (a)', 'a cube (A) and a sphere (a)'),
  L('hai hình cầu (a, a)', 'two spheres (a, a)'),
];

/** The picked island's or figure's card at generation g, or null when the pick does not exist. */
export function selectionCard(
  model: DriftModel3D,
  g: number,
  sel: DriftSelection,
  fmt: Fmt,
): Card | null {
  const island = islandOf(model, sel);
  const x = islandAt(model, island, g);
  if (!x) return null;
  const n = String(island + 1);
  const twoN = fmt(2 * model.N, 6);
  if (sel.kind === 'island') {
    const s = summaryAt(model, x.g);
    return {
      title: L(`Đảo ${n} — thế hệ ${String(x.g)}`, `Island ${n} — generation ${String(x.g)}`),
      lines: [
        L(
          `Một lần chạy Wright–Fisher của bài: N = ${fmt(model.N, 6)} cá thể, 2N = ${twoN} bản sao gen.`,
          `One Wright–Fisher run of the lesson: N = ${fmt(model.N, 6)} individuals, 2N = ${twoN} gene copies.`,
        ),
        L(
          'Các đảo độc lập: không có di nhập gen giữa chúng, mỗi đảo phiêu bạt theo đường riêng.',
          'The islands are independent: no migration between them, each drifts its own way.',
        ),
        copiesLine(model, x, fmt),
        fateLine(model, island, x.g, fmt),
        L(
          `Dị hợp của đảo này H = 2pq = ${fmt(x.H, 3)}; trung bình mọi đảo ${fmt(s.meanH, 3)}, lí thuyết H₀(1 − 1/2N)ᵗ = ${fmt(s.theoryH, 3)}.`,
          `This island's heterozygosity H = 2pq = ${fmt(x.H, 3)}; mean of all islands ${fmt(s.meanH, 3)}, theory H₀(1 − 1/2N)ᵗ = ${fmt(s.theoryH, 3)}.`,
        ),
        L(
          `Lí thuyết: xác suất để A cuối cùng cố định = p₀ = ${fmt(model.p0, 4)}.`,
          `Theory: the chance that A is eventually fixed = p₀ = ${fmt(model.p0, 4)}.`,
        ),
        L(
          `Dải quanh bờ chia đúng p : q (phần màu A bắt đầu ở phía trước). Trên đảo: ${fmt(model.figures, 6)} hình, ${fmt(x.beads.A, 6)} hạt A ${GLYPH.A} và ${fmt(x.beads.a, 6)} hạt a ${GLYPH.a}.`,
          `The band round the coast is split exactly p : q (A's part starts at the front). On the island: ${fmt(model.figures, 6)} figures, ${fmt(x.beads.A, 6)} A beads ${GLYPH.A} and ${fmt(x.beads.a, 6)} a beads ${GLYPH.a}.`,
        ),
      ],
    };
  }
  const pair = figureAlleles(model, sel.slot, x.g);
  if (pair === null) return null;
  const beads = BEADS[pair] ?? BEADS[0];
  return {
    title: L(`Cá thể trên đảo ${n}`, `An individual on island ${n}`),
    lines: [
      L(
        `Hai hạt trên râu là hai bản sao gen: ${beads?.vi ?? ''}.`,
        `The two beads on its antennae are two gene copies: ${beads?.en ?? ''}.`,
      ),
      copiesLine(model, x, fmt),
      L(
        'Mô hình Wright–Fisher chỉ đếm bản sao gen của cả quần thể; con vật nào mang hai bản sao nào là minh họa.',
        'The Wright–Fisher model only counts the gene copies of the whole population; which animal carries which two copies is illustration.',
      ),
      model.per <= 1
        ? L(
            'Hình này là 1 cá thể; mỗi hạt là 1 bản sao gen.',
            'This figure is 1 individual; each bead is 1 gene copy.',
          )
        : L(
            `Hình này đại diện cho ${fmt(model.per, 6)} cá thể; mỗi hạt = ${fmt(model.per, 6)} bản sao gen (làm tròn).`,
            `This figure stands for ${fmt(model.per, 6)} individuals; each bead = ${fmt(model.per, 6)} gene copies (rounded).`,
          ),
      L(
        'Mỗi thế hệ là một lứa cá thể mới, lấy ngẫu nhiên 2N bản sao từ thế hệ trước; chỗ đứng giữ nguyên chỉ để dễ so sánh.',
        'Each generation is a new set of individuals drawing 2N copies at random from the one before; places stay the same only to compare.',
      ),
    ],
  };
}
