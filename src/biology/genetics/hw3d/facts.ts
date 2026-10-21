/**
 * Texts of the Hardy–Weinberg 3D view (pure, tested): the picked part's card, the labels of the
 * gene pool and the honest notes. Every number is the model's (`binding.ts`), formatted by the
 * caller's `fmt` (the learner's locale). New wording: DATA_REVIEW HW3D-*.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import {
  ALLELES_OF,
  slotGenotype,
  type Genotype,
  type HwGeneration,
  type HwModel3D,
  type HwSelection,
} from './binding';

export type Fmt = (v: number, digits?: number) => string;

export interface Card {
  title: LocalizedText;
  lines: LocalizedText[];
}

/** The expected frequency of each genotype under Hardy–Weinberg. */
const LAW: Record<Genotype, string> = { AA: 'p²', Aa: '2pq', aa: 'q²' };

/** Shapes of the two beads on a figure's antennae. */
const BEADS: Record<Genotype, LocalizedText> = {
  AA: L('hai khối vuông (A, A)', 'two cubes (A, A)'),
  Aa: L('một khối vuông (A) và một hình cầu (a)', 'a cube (A) and a sphere (a)'),
  aa: L('hai hình cầu (a, a)', 'two spheres (a, a)'),
};

/** An empty population (no individuals): no gene pool, so p and q are not defined. */
export const NO_INDIVIDUALS = L('Chưa có cá thể nào', 'No individuals yet');

/**
 * p and q of a generation as shown: "—" when it has no individuals (the model's p = 0 there is
 * only a guard against 0 / 0, not an allele frequency).
 */
export function pqText(gen: HwGeneration, fmt: Fmt): { p: string; q: string } {
  return gen.n > 0 ? { p: fmt(gen.p, 4), q: fmt(gen.q, 4) } : { p: '—', q: '—' };
}

/** Glyphs of the allele beads' shapes (A a cube, a a sphere), as on the chips. */
export const ALLELE_GLYPH = { A: '■', a: '●' } as const;

/** Where a generation's numbers come from. */
export function generationOrigin(model: HwModel3D, g: number, fmt: Fmt): LocalizedText {
  if (g > 0 && (model.generations[g]?.n ?? 0) === 0)
    return L(
      `Thế hệ ${String(g)}: không có cá thể nào để ngẫu phối, nên quần thể vẫn trống.`,
      `Generation ${String(g)}: there is no individual to mate, so the population stays empty.`,
    );
  return g === 0
    ? L('Thế hệ 0: số liệu bạn nhập.', 'Generation 0: the numbers you entered.')
    : L(
        `Thế hệ ${String(g)}: mô phỏng ${String(g)} lần ngẫu phối liên tiếp, N = ${fmt(model.N, 6)} (hạt giống ${String(model.seed)}).`,
        `Generation ${String(g)}: ${String(g)} rounds of random mating simulated, N = ${fmt(model.N, 6)} (seed ${String(model.seed)}).`,
      );
}

/** "Mỗi hình là 1 cá thể" or the rounded scale of one figure. */
export function figureScale(per: number, fmt: Fmt): LocalizedText {
  return per <= 1
    ? L('1 hình = 1 cá thể', '1 figure = 1 individual')
    : L(`1 hình = ${fmt(per, 6)} cá thể`, `1 figure = ${fmt(per, 6)} individuals`);
}

/** The scale of one bead in the gene pool. */
export function beadScale(perBead: number, fmt: Fmt): LocalizedText {
  return perBead <= 1
    ? L('1 hạt = 1 bản sao gen', '1 bead = 1 gene copy')
    : L(`1 hạt = ${fmt(perBead, 6)} bản sao gen`, `1 bead = ${fmt(perBead, 6)} gene copies`);
}

/**
 * The dial's label per generation: copies of A (■) and p over copies of a (●) and q; an empty
 * generation has no gene pool to split ("Chưa có cá thể nào", no p or q).
 */
export function dialLabels(model: HwModel3D, fmt: Fmt): LocalizedText[] {
  return model.generations.map((g) => {
    if (g.n === 0) return NO_INDIVIDUALS;
    const text = `A ${ALLELE_GLYPH.A}: ${fmt(g.copies.A, 6)} · p = ${fmt(g.p, 4)}
a ${ALLELE_GLYPH.a}: ${fmt(g.copies.a, 6)} · q = ${fmt(g.q, 4)}`;
    return L(text, text);
  });
}

/** What the picture's name callouts point at (`scene.ts` places them). */
export type HwCallout = 'AA' | 'Aa' | 'aa' | 'antennae' | 'beads' | 'dial';

/** The callouts' names: every part of the habitat that stands for something in the model. */
export const CALLOUTS: Record<HwCallout, LocalizedText> = {
  AA: L('Cá thể AA', 'Individual AA'),
  Aa: L('Cá thể Aa', 'Individual Aa'),
  aa: L('Cá thể aa', 'Individual aa'),
  antennae: L('Hai râu = hai alen', 'Two antennae = two alleles'),
  beads: L('Hạt = bản sao gen', 'Bead = gene copy'),
  dial: L('Vòng p : q', 'p : q ring'),
};

const SOURCES = L(
  'Nguồn: SGK Sinh học 12; Hartl & Clark, Principles of Population Genetics · nội dung đang chờ giáo viên duyệt.',
  'Sources: Vietnamese Biology 12 textbook; Hartl & Clark, Principles of Population Genetics · awaiting teacher review.',
);
export { SOURCES as HW3D_SOURCES };

/** The picked part's card at generation g, or null when the pick no longer exists. */
export function selectionCard(
  model: HwModel3D,
  g: number,
  sel: HwSelection,
  fmt: Fmt,
): Card | null {
  const gen = model.generations[g];
  if (!gen) return null;
  const pct = (v: number) => (gen.n > 0 ? fmt((100 * v) / gen.n, 3) : '—');
  if (sel.kind === 'pool') {
    if (gen.n === 0)
      return {
        title: L(`Vốn gen — thế hệ ${String(g)}`, `Gene pool — generation ${String(g)}`),
        lines: [
          L(
            'Chưa có cá thể nào nên chưa có bản sao gen nào: p và q chưa xác định, lọ trống.',
            'No individuals yet, so no gene copies: p and q are not defined and the jar is empty.',
          ),
          generationOrigin(model, g, fmt),
        ],
      };
    const c = gen.counts;
    const verdict =
      gen.n === 0
        ? L('chưa có cá thể nào.', 'no individuals yet.')
        : gen.pValue >= 0.05
          ? L(
              'phù hợp cân bằng Hardy–Weinberg (α = 0,05).',
              'consistent with Hardy–Weinberg (α = 0.05).',
            )
          : L(
              'KHÔNG ở cân bằng Hardy–Weinberg (α = 0,05).',
              'NOT in Hardy–Weinberg equilibrium (α = 0.05).',
            );
    return {
      title: L(`Vốn gen — thế hệ ${String(g)}`, `Gene pool — generation ${String(g)}`),
      lines: [
        L(
          `A = 2·AA + Aa = 2·${fmt(c.AA, 6)} + ${fmt(c.Aa, 6)} = ${fmt(gen.copies.A, 6)} bản sao → p = ${fmt(gen.p, 4)}.`,
          `A = 2·AA + Aa = 2·${fmt(c.AA, 6)} + ${fmt(c.Aa, 6)} = ${fmt(gen.copies.A, 6)} copies → p = ${fmt(gen.p, 4)}.`,
        ),
        L(
          `a = Aa + 2·aa = ${fmt(c.Aa, 6)} + 2·${fmt(c.aa, 6)} = ${fmt(gen.copies.a, 6)} bản sao → q = ${fmt(gen.q, 4)}.`,
          `a = Aa + 2·aa = ${fmt(c.Aa, 6)} + 2·${fmt(c.aa, 6)} = ${fmt(gen.copies.a, 6)} copies → q = ${fmt(gen.q, 4)}.`,
        ),
        L(
          `Tổng 2N = ${fmt(2 * gen.n, 6)} bản sao gen. Vòng trên bệ chia đúng theo p : q.`,
          `In all 2N = ${fmt(2 * gen.n, 6)} gene copies. The ring on the plinth is split exactly p : q.`,
        ),
        L(
          `So với p², 2pq, q²: χ² = ${fmt(gen.chi2, 3)} (df = 1), p-value = ${fmt(gen.pValue, 3)} → ${verdict.vi}`,
          `Against p², 2pq, q²: χ² = ${fmt(gen.chi2, 3)} (df = 1), p-value = ${fmt(gen.pValue, 3)} → ${verdict.en}`,
        ),
        L(
          `${beadScale(model.perBead, fmt).vi} (làm tròn); vị trí hạt trong lọ là minh họa.`,
          `${beadScale(model.perBead, fmt).en} (rounded); where the beads lie is illustration.`,
        ),
        generationOrigin(model, g, fmt),
      ],
    };
  }
  const gt = slotGenotype(model, g, sel.slot);
  if (!gt) return null;
  const [x, y] = ALLELES_OF[gt];
  const count = gen.counts[gt];
  return {
    title: L(`Cá thể kiểu gen ${gt}`, `An individual of genotype ${gt}`),
    lines: [
      L(
        `Mang hai bản sao gen ${x} và ${y}: trên hai râu là ${BEADS[gt].vi}.`,
        `Carries two gene copies, ${x} and ${y}: on its antennae, ${BEADS[gt].en}.`,
      ),
      L(
        `Thế hệ ${String(g)}: ${fmt(count, 6)} cá thể ${gt} trong N = ${fmt(gen.n, 6)} (${pct(count)} %).`,
        `Generation ${String(g)}: ${fmt(count, 6)} individuals ${gt} out of N = ${fmt(gen.n, 6)} (${pct(count)} %).`,
      ),
      L(
        `Kì vọng Hardy–Weinberg ${LAW[gt]}·N = ${fmt(gen.expected[gt], 4)} (p = ${fmt(gen.p, 4)}, q = ${fmt(gen.q, 4)}).`,
        `Hardy–Weinberg expects ${LAW[gt]}·N = ${fmt(gen.expected[gt], 4)} (p = ${fmt(gen.p, 4)}, q = ${fmt(gen.q, 4)}).`,
      ),
      model.per <= 1
        ? L('Hình này là 1 cá thể.', 'This figure is 1 individual.')
        : L(
            `Hình này đại diện cho ${fmt(model.per, 6)} cá thể (thang vẽ, làm tròn).`,
            `This figure stands for ${fmt(model.per, 6)} individuals (drawing scale, rounded).`,
          ),
      generationOrigin(model, g, fmt),
      L(
        'Con vật, chỗ đứng và cách nó nhảy là minh họa; kiểu gen và số lượng theo mô hình.',
        'The animal, where it stands and how it hops are illustration; genotype and counts follow the model.',
      ),
    ],
  };
}
