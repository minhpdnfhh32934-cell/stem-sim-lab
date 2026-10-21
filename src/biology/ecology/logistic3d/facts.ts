/**
 * Texts of the logistic-growth 3D view (pure, tested): the scale chip, the gauge's labels, the
 * picked part's card, the callouts' names and the honest notes. Every number is the model's
 * (`binding.ts`), formatted by the caller's `fmt` (the learner's locale). New wording:
 * DATA_REVIEW LOG3D-*.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import {
  tStarInRun,
  type LogiSelection,
  type LogisticModel3D,
  type LogisticMoment,
} from './binding';

export type Fmt = (v: number, digits?: number) => string;

export interface Card {
  title: LocalizedText;
  lines: LocalizedText[];
}

/** Short honest caption (the Science Card has the full note). */
export const CAPTION = L(
  'Minh họa: con vật, chỗ đứng, hàng rào, bãi cỏ, cây cối và cử động; số cá thể, N/K và dN/dt theo mô hình.',
  'Illustration: animals, places, fence, clover, plants and motion; the count, N/K and dN/dt follow the model.',
);

export const SOURCES = L(
  'Nguồn: SGK Sinh học 12 (sinh thái học quần thể); J. D. Murray, Mathematical Biology I · hình 3D đang chờ giáo viên duyệt.',
  'Sources: Vietnamese Biology 12 textbook (population ecology); J. D. Murray, Mathematical Biology I · 3D picture awaiting teacher review.',
);

/** "1 hình = 1 cá thể" or the rounded scale of one figure. */
export function scaleText(per: number, fmt: Fmt): LocalizedText {
  return per <= 1
    ? L('1 hình = 1 cá thể', '1 figure = 1 individual')
    : L(
        `1 hình = ${fmt(per, 6)} cá thể (làm tròn)`,
        `1 figure = ${fmt(per, 6)} individuals (rounded)`,
      );
}

/** The player's readout: the time and N(t) (the same text as the 2D lesson's numbers). */
export function readout(m: LogisticMoment, fmt: Fmt): string {
  return `t = ${fmt(m.t, 3)} · N = ${fmt(m.N, 4)}`;
}

/** A signed value with a true minus sign (−12, not -12). */
export const signed = (v: number, fmt: Fmt, digits = 3): string =>
  v < 0 ? `−${fmt(-v, digits)}` : fmt(v, digits);

/** The label beside the column: N and dN/dt now (two lines). */
export function momentLabel(m: LogisticMoment, fmt: Fmt): string {
  return `N = ${fmt(m.N, 4)}\ndN/dt = ${signed(m.dNdt, fmt)}`;
}

/** The column's marks: K with its value, K/2 with its value. */
export function gaugeMarks(model: LogisticModel3D, fmt: Fmt): { k: string; half: string } {
  return { k: `K = ${fmt(model.K, 4)}`, half: `K/2 = ${fmt(model.K / 2, 4)}` };
}

/** What the picture's name callouts point at (`scene.ts` places them). */
export type LogiCallout = 'figure' | 'fence' | 'food';

export const CALLOUTS: Record<LogiCallout, LocalizedText> = {
  figure: L('Cá thể', 'Individual'),
  fence: L('Rào: chỗ cho K cá thể', 'Fence: room for K individuals'),
  food: L('Bãi cỏ: nguồn sống', 'Clover: resources'),
};

/** "Đang tăng", "Đang giảm" or "Đứng yên ở K" from the sign of dN/dt. */
function trend(m: LogisticMoment, fmt: Fmt): LocalizedText {
  if (Math.abs(m.dNdt) < 1e-9 * Math.max(1, m.N))
    return L('Quần thể đứng yên: dN/dt = 0.', 'The population stands still: dN/dt = 0.');
  return m.dNdt > 0
    ? L(
        `Quần thể đang tăng: dN/dt = rN(1 − N/K) = ${fmt(m.dNdt, 3)} cá thể/đơn vị t.`,
        `The population is growing: dN/dt = rN(1 − N/K) = ${fmt(m.dNdt, 3)} individuals per time unit.`,
      )
    : L(
        `Quần thể đang giảm (N > K): dN/dt = rN(1 − N/K) = ${signed(m.dNdt, fmt)} cá thể/đơn vị t.`,
        `The population is shrinking (N > K): dN/dt = rN(1 − N/K) = ${signed(m.dNdt, fmt)} individuals per time unit.`,
      );
}

const pct = (v: number, fmt: Fmt) => `${fmt(100 * v, 3)} %`;

/** The moment's place on the curve: N, N/K. */
function where(model: LogisticModel3D, m: LogisticMoment, fmt: Fmt): LocalizedText {
  return L(
    `Lúc t = ${fmt(m.t, 3)}: N = ${fmt(m.N, 4)} cá thể = ${pct(m.ratio, fmt)} sức chứa K = ${fmt(model.K, 4)}.`,
    `At t = ${fmt(m.t, 3)}: N = ${fmt(m.N, 4)} individuals = ${pct(m.ratio, fmt)} of the carrying capacity K = ${fmt(model.K, 4)}.`,
  );
}

/** The inflection t* (N = K/2, fastest growth rK/4), or why there is none on this run. */
function inflection(model: LogisticModel3D, fmt: Fmt): LocalizedText {
  if (tStarInRun(model))
    return L(
      `Nhanh nhất khi N = K/2, lúc t* = ${fmt(model.tStar, 3)}: dN/dt = rK/4 = ${fmt(model.maxRate, 3)}.`,
      `Fastest at N = K/2, at t* = ${fmt(model.tStar, 3)}: dN/dt = rK/4 = ${fmt(model.maxRate, 3)}.`,
    );
  return Number.isFinite(model.tStar)
    ? L(
        `Nhanh nhất khi N = K/2 (dN/dt = rK/4 = ${fmt(model.maxRate, 3)}), lúc t* = ${fmt(model.tStar, 3)} — sau khoảng thời gian đang xem.`,
        `Fastest at N = K/2 (dN/dt = rK/4 = ${fmt(model.maxRate, 3)}), at t* = ${fmt(model.tStar, 3)} — after the time span shown.`,
      )
    : L(
        `N₀ ≥ K/2 nên đường cong không có điểm uốn khi t ≥ 0; tốc độ lớn nhất có thể là rK/4 = ${fmt(model.maxRate, 3)}.`,
        `N₀ ≥ K/2, so the curve has no inflection for t ≥ 0; the largest possible rate is rK/4 = ${fmt(model.maxRate, 3)}.`,
      );
}

/** The picked part's card at moment m, or null when the pick no longer exists. */
export function selectionCard(
  model: LogisticModel3D,
  m: LogisticMoment,
  sel: LogiSelection,
  fmt: Fmt,
): Card | null {
  if (sel.kind === 'figure') {
    if (sel.slot < 0 || sel.slot >= m.shown) return null;
    return {
      title: L('Một cá thể của quần thể', 'One individual of the population'),
      lines: [
        model.per <= 1
          ? L('Hình này là 1 cá thể.', 'This figure is 1 individual.')
          : L(
              `Hình này đại diện cho ${fmt(model.per, 6)} cá thể (thang vẽ, làm tròn): ${fmt(m.shown, 6)} hình cho N = ${fmt(m.N, 4)}.`,
              `This figure stands for ${fmt(model.per, 6)} individuals (drawing scale, rounded): ${fmt(m.shown, 6)} figures for N = ${fmt(m.N, 4)}.`,
            ),
        where(model, m, fmt),
        L(
          `Tốc độ tăng bình quân mỗi cá thể: r(1 − N/K) = ${signed(m.perCapita, fmt)} /đơn vị t (r = ${fmt(model.r, 3)} khi quần thể còn rất nhỏ).`,
          `Growth rate per individual: r(1 − N/K) = ${signed(m.perCapita, fmt)} per time unit (r = ${fmt(model.r, 3)} while the population is very small).`,
        ),
        trend(m, fmt),
        L(
          'Vai trò: một thành viên của quần thể. Càng đông, mỗi cá thể càng góp ít vào tốc độ tăng — đó là hệ số (1 − N/K).',
          'Role: one member of the population. The more crowded, the less each individual adds to growth — that is the factor (1 − N/K).',
        ),
      ],
    };
  }
  if (sel.kind === 'gauge')
    return {
      title: L(`Cột N(t) — lúc t = ${fmt(m.t, 3)}`, `N(t) column — at t = ${fmt(m.t, 3)}`),
      lines: [
        L(
          `Mực chất lỏng = N(t) = K / (1 + (K/N₀ − 1)e^(−rt)) = ${fmt(m.N, 4)} (N₀ = ${fmt(model.N0, 4)}, r = ${fmt(model.r, 3)}).`,
          `Liquid level = N(t) = K / (1 + (K/N₀ − 1)e^(−rt)) = ${fmt(m.N, 4)} (N₀ = ${fmt(model.N0, 4)}, r = ${fmt(model.r, 3)}).`,
        ),
        L(
          `Vòng trên: sức chứa K = ${fmt(model.K, 4)}; vòng dưới: K/2 = ${fmt(model.K / 2, 4)}.`,
          `Upper ring: carrying capacity K = ${fmt(model.K, 4)}; lower ring: K/2 = ${fmt(model.K / 2, 4)}.`,
        ),
        trend(m, fmt),
        L(
          `Mũi tên dài theo |dN/dt| so với giá trị lớn nhất của lần chạy (${fmt(model.arrowRef, 3)}).`,
          `The arrow's length is |dN/dt| relative to the run's largest value (${fmt(model.arrowRef, 3)}).`,
        ),
        inflection(model, fmt),
      ],
    };
  return {
    title: L('Bãi cỏ (minh họa nguồn sống)', 'Clover (illustrating resources)'),
    lines: [
      L(
        `Phần bãi cỏ bị gặm vẽ theo N/K = ${pct(Math.min(1, m.ratio), fmt)}: phần sức chứa của môi trường đã được dùng.`,
        `The grazed share of the clover follows N/K = ${pct(Math.min(1, m.ratio), fmt)}: the share of the carrying capacity already used.`,
      ),
      L(
        `Phần còn lại 1 − N/K = ${signed(1 - m.ratio, fmt)} là “chỗ trống” làm tốc độ tăng chậm dần khi N tiến tới K.`,
        `What is left, 1 − N/K = ${signed(1 - m.ratio, fmt)}, is the room that slows growth as N approaches K.`,
      ),
      L(
        'Mô hình logistic không mô tả thức ăn cụ thể: bãi cỏ chỉ minh họa hệ số (1 − N/K).',
        'The logistic model does not describe any actual food: the clover only illustrates the factor (1 − N/K).',
      ),
    ],
  };
}
