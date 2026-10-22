/**
 * Texts of the predator–prey 3D view (pure, tested): the readout, the columns' and the board's
 * labels, the picked part's card, the callouts' names and the honest notes. Every number is the
 * model's (`binding.ts`), formatted by the caller's `fmt` (the learner's locale). New wording:
 * DATA_REVIEW LV3D-*.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../../common';
import { signed, type Card, type Fmt } from '../logistic3d/facts';
import { ARROW_MIN, type LvModel3D, type LvMoment, type LvSelection } from './binding';
import type { BoardTexts } from './board';
import type { ColumnsTexts } from './columns';

export { scaleText, signed, type Card, type Fmt } from '../logistic3d/facts';

/** Short honest caption (the Science Card has the full note). */
export const CAPTION = L(
  'Minh họa: con vật, chỗ đứng, cử động (mô hình không có săn mồi từng con), đồng cỏ, cây cối và bảng; số con mồi, số vật ăn thịt, cột và đường pha theo mô hình.',
  'Illustration: animals, places, motion (the model has no individual hunting), clover, plants and the board; the prey and predator counts, the columns and the phase path follow the model.',
);

export const SOURCES = L(
  'Nguồn: J. D. Murray, Mathematical Biology I; SGK Sinh học 12 (quan hệ giữa các loài) · hình 3D đang chờ giáo viên duyệt.',
  'Sources: J. D. Murray, Mathematical Biology I; Vietnamese Biology 12 textbook (species interactions) · 3D picture awaiting teacher review.',
);

/** The player's readout: the sample's time, x and y (the same text as before, and as the 2D). */
export function readout(m: LvMoment, fmt: Fmt): string {
  return `t = ${fmt(m.t, 3)} · x = ${fmt(m.x, 4)} · y = ${fmt(m.y, 4)}`;
}

/** The plaque under a column at moment m: its value and its rate (two lines, the model's). */
export function columnValue(s: 'prey' | 'predators', m: LvMoment, fmt: Fmt): string {
  return s === 'prey'
    ? `x = ${fmt(m.x, 4)}\ndx/dt = ${signed(m.dxdt, fmt)}`
    : `y = ${fmt(m.y, 4)}\ndy/dt = ${signed(m.dydt, fmt)}`;
}

/** Names on the picture (`scene.ts` places them). */
export type LvCallout = 'prey' | 'predator' | 'clover';

export const CALLOUTS: Record<LvCallout, LocalizedText> = {
  prey: L('Con mồi', 'Prey'),
  predator: L('Vật ăn thịt', 'Predator'),
  clover: L('Cỏ: thức ăn không giới hạn', 'Clover: unlimited food'),
};

/** The columns' and the board's labels in the learner's language (`Lz`). */
export function sceneTexts(
  model: LvModel3D,
  fmt: Fmt,
  Lz: (t: LocalizedText) => string,
): { columns: ColumnsTexts; board: BoardTexts } {
  const xStar = `x* = ${fmt(model.eq.x, 4)}`;
  const yStar = `y* = ${fmt(model.eq.y, 4)}`;
  return {
    columns: {
      prey: Lz(L('Con mồi x', 'Prey x')),
      predators: Lz(L('Vật ăn thịt y', 'Predators y')),
      xStar,
      yStar,
      value: (s, m) => columnValue(s, m, fmt),
    },
    board: {
      title: Lz(L('Mặt phẳng pha (x, y)', 'Phase plane (x, y)')),
      x: 'x',
      y: 'y',
      xStar: 'x*',
      yStar: 'y*',
    },
  };
}

const scaleLine = (model: LvModel3D, m: LvMoment, fmt: Fmt): LocalizedText =>
  model.per <= 1
    ? L('Hình này là 1 cá thể.', 'This figure is 1 individual.')
    : L(
        `Hình này đại diện cho ${fmt(model.per, 6)} cá thể (thang vẽ chung cho hai loài, làm tròn): ${fmt(m.shown.prey, 6)} hình con mồi, ${fmt(m.shown.predators, 6)} hình vật ăn thịt.`,
        `This figure stands for ${fmt(model.per, 6)} individuals (one drawing scale for both species, rounded): ${fmt(m.shown.prey, 6)} prey figures, ${fmt(m.shown.predators, 6)} predator figures.`,
      );

const where = (m: LvMoment, fmt: Fmt): LocalizedText =>
  L(
    `Lúc t = ${fmt(m.t, 3)}: x = ${fmt(m.x, 4)} con mồi, y = ${fmt(m.y, 4)} vật ăn thịt.`,
    `At t = ${fmt(m.t, 3)}: x = ${fmt(m.x, 4)} prey, y = ${fmt(m.y, 4)} predators.`,
  );

/** Whether a rate is zero to the model's precision (at the equilibrium). */
const still = (rate: number, value: number) => Math.abs(rate) < 1e-9 * Math.max(1, value);

/** Why the prey grow or shrink now: the sign of α − βy, i.e. y below or above y* = α/β. */
function preyTrend(model: LvModel3D, m: LvMoment, fmt: Fmt): LocalizedText {
  const yStar = fmt(model.eq.y, 4);
  if (still(m.dxdt, m.x))
    return L(
      `y = y* = α/β = ${yStar}: lúc này số con mồi không đổi.`,
      `y = y* = α/β = ${yStar}: the prey count is not changing at this moment.`,
    );
  return m.dxdt > 0
    ? L(
        `Vật ăn thịt còn ít (y < y* = α/β = ${yStar}) nên con mồi đang tăng: dx/dt = αx − βxy = ${fmt(m.dxdt, 3)} cá thể/đơn vị t.`,
        `Few predators (y < y* = α/β = ${yStar}), so the prey are increasing: dx/dt = αx − βxy = ${fmt(m.dxdt, 3)} individuals per time unit.`,
      )
    : L(
        `Vật ăn thịt đông (y > y* = α/β = ${yStar}) nên con mồi đang giảm: dx/dt = αx − βxy = ${signed(m.dxdt, fmt)} cá thể/đơn vị t.`,
        `Many predators (y > y* = α/β = ${yStar}), so the prey are decreasing: dx/dt = αx − βxy = ${signed(m.dxdt, fmt)} individuals per time unit.`,
      );
}

/** Why the predators grow or shrink now: the sign of δx − γ, i.e. x above or below x* = γ/δ. */
function predatorTrend(model: LvModel3D, m: LvMoment, fmt: Fmt): LocalizedText {
  const xStar = fmt(model.eq.x, 4);
  if (still(m.dydt, m.y))
    return L(
      `x = x* = γ/δ = ${xStar}: lúc này số vật ăn thịt không đổi.`,
      `x = x* = γ/δ = ${xStar}: the predator count is not changing at this moment.`,
    );
  return m.dydt > 0
    ? L(
        `Con mồi nhiều (x > x* = γ/δ = ${xStar}) nên vật ăn thịt đang tăng: dy/dt = δxy − γy = ${fmt(m.dydt, 3)} cá thể/đơn vị t.`,
        `Plenty of prey (x > x* = γ/δ = ${xStar}), so the predators are increasing: dy/dt = δxy − γy = ${fmt(m.dydt, 3)} individuals per time unit.`,
      )
    : L(
        `Con mồi ít (x < x* = γ/δ = ${xStar}) nên vật ăn thịt đang giảm: dy/dt = δxy − γy = ${signed(m.dydt, fmt)} cá thể/đơn vị t.`,
        `Few prey (x < x* = γ/δ = ${xStar}), so the predators are decreasing: dy/dt = δxy − γy = ${signed(m.dydt, fmt)} individuals per time unit.`,
      );
}

/** What an arrow's full length stands for. */
export function arrowScale(model: LvModel3D, fmt: Fmt): LocalizedText {
  return L(
    `Mũi tên dài theo dx/dt, dy/dt so với tốc độ lớn nhất (giá trị tuyệt đối) trên các điểm đã tính của lần chạy = ${fmt(model.rateRef, 3)} cá thể/đơn vị t; ngắn hơn ${fmt(ARROW_MIN * 100, 2)} % độ dài đầy đủ thì không vẽ (nhãn dưới cột vẫn ghi giá trị).`,
    `Arrow lengths follow dx/dt, dy/dt relative to the largest rate (in absolute value) among the run's computed points = ${fmt(model.rateRef, 3)} individuals per time unit; below ${fmt(ARROW_MIN * 100, 2)} % of the full length no arrow is drawn (the plaque under the column still gives the value).`,
  );
}

/** The picked part's card at moment m, or null when the pick no longer exists. */
export function selectionCard(
  model: LvModel3D,
  m: LvMoment,
  sel: LvSelection,
  fmt: Fmt,
): Card | null {
  const { p } = model;
  if (sel.kind === 'prey') {
    if (sel.slot < 0 || sel.slot >= m.shown.prey) return null;
    return {
      title: L('Một con mồi', 'One prey animal'),
      lines: [
        scaleLine(model, m, fmt),
        where(m, fmt),
        L(
          `Tốc độ tăng mỗi con mồi: α − βy = ${signed(m.preyRate, fmt)} /đơn vị t.`,
          `Growth rate per prey: α − βy = ${signed(m.preyRate, fmt)} per time unit.`,
        ),
        preyTrend(model, m, fmt),
        L(
          `Vai trò: con mồi — sinh sản với tốc độ α = ${fmt(p.alpha, 3)} khi không có vật ăn thịt và bị ăn tỉ lệ với số lần gặp xy (β = ${fmt(p.beta, 3)}). Mô hình giả sử con mồi có thức ăn không giới hạn.`,
          `Role: prey — breeds at rate α = ${fmt(p.alpha, 3)} without predators and is eaten in proportion to encounters xy (β = ${fmt(p.beta, 3)}). The model assumes the prey have unlimited food.`,
        ),
      ],
    };
  }
  if (sel.kind === 'predator') {
    if (sel.slot < 0 || sel.slot >= m.shown.predators) return null;
    return {
      title: L('Một vật ăn thịt', 'One predator'),
      lines: [
        scaleLine(model, m, fmt),
        where(m, fmt),
        L(
          `Tốc độ tăng mỗi vật ăn thịt: δx − γ = ${signed(m.predatorRate, fmt)} /đơn vị t.`,
          `Growth rate per predator: δx − γ = ${signed(m.predatorRate, fmt)} per time unit.`,
        ),
        predatorTrend(model, m, fmt),
        L(
          `Vai trò: vật ăn thịt — tăng nhờ ăn mồi (δ = ${fmt(p.delta, 3)}) và chết với tốc độ γ = ${fmt(p.gamma, 3)} khi không có mồi; chỉ ăn loài mồi này.`,
          `Role: predator — grows by eating prey (δ = ${fmt(p.delta, 3)}) and dies at rate γ = ${fmt(p.gamma, 3)} without prey; eats only this prey.`,
        ),
      ],
    };
  }
  if (sel.kind === 'columns')
    return {
      title: L(
        `Hai cột x(t), y(t) — lúc t = ${fmt(m.t, 3)}`,
        `Columns x(t), y(t) — at t = ${fmt(m.t, 3)}`,
      ),
      lines: [
        L(
          `Cột trái: con mồi x = ${fmt(m.x, 4)}; cột phải: vật ăn thịt y = ${fmt(m.y, 4)} — cùng một thang (lớn nhất trong lần chạy: x = ${fmt(model.peak.prey, 4)}, y = ${fmt(model.peak.predators, 4)}).`,
          `Left: prey x = ${fmt(m.x, 4)}; right: predators y = ${fmt(m.y, 4)} — one scale for both (largest in the run: x = ${fmt(model.peak.prey, 4)}, y = ${fmt(model.peak.predators, 4)}).`,
        ),
        L(
          `Vòng trên cột con mồi: x* = γ/δ = ${fmt(model.eq.x, 4)}; trên cột vật ăn thịt: y* = α/β = ${fmt(model.eq.y, 4)} (điểm cân bằng).`,
          `Ring on the prey column: x* = γ/δ = ${fmt(model.eq.x, 4)}; on the predator column: y* = α/β = ${fmt(model.eq.y, 4)} (the equilibrium).`,
        ),
        L(
          'Con mồi tăng khi y < y*, vật ăn thịt tăng khi x > x*: hai cột lên xuống lệch nhau, đỉnh của vật ăn thịt đến sau đỉnh của con mồi.',
          'The prey grow while y < y*, the predators while x > x*: the columns rise and fall out of step, the predators peaking after the prey.',
        ),
        preyTrend(model, m, fmt),
        predatorTrend(model, m, fmt),
        arrowScale(model, fmt),
      ],
    };
  return {
    title: L(`Mặt phẳng pha — lúc t = ${fmt(m.t, 3)}`, `Phase plane — at t = ${fmt(m.t, 3)}`),
    lines: [
      L(
        `Hạt sáng: (x, y) = (${fmt(m.x, 4)}; ${fmt(m.y, 4)}). Đường cong đi qua các điểm (x, y) mô hình đã tính từ t = 0 tới t = ${fmt(model.tEnd, 3)}.`,
        `Bead: (x, y) = (${fmt(m.x, 4)}; ${fmt(m.y, 4)}). The curve goes through the points (x, y) the model computed from t = 0 to t = ${fmt(model.tEnd, 3)}.`,
      ),
      L(
        `Điểm cân bằng (x*, y*) = (γ/δ; α/β) = (${fmt(model.eq.x, 4)}; ${fmt(model.eq.y, 4)}). Nét đứt dọc x = x*: số vật ăn thịt tạm không đổi; nét đứt ngang y = y*: số con mồi tạm không đổi.`,
        `Equilibrium (x*, y*) = (γ/δ; α/β) = (${fmt(model.eq.x, 4)}; ${fmt(model.eq.y, 4)}). Dashed vertical x = x*: the predator count momentarily stops changing; dashed horizontal y = y*: the prey count does.`,
      ),
      L(
        'Điểm đi vòng ngược chiều kim đồng hồ quanh điểm cân bằng: con mồi tăng trước, vật ăn thịt tăng theo sau.',
        'The point circles the equilibrium anticlockwise: the prey increase first, the predators follow.',
      ),
      L(
        `V = δx − γ ln x + βy − α ln y = ${signed(m.V, fmt, 6)} (bảo toàn; sai lệch tương đối lớn nhất trong lần chạy: ${fmt(model.drift, 2)}).`,
        `V = δx − γ ln x + βy − α ln y = ${signed(m.V, fmt, 6)} (conserved; largest relative drift in the run: ${fmt(model.drift, 2)}).`,
      ),
      L(
        `Chu kì dao động nhỏ quanh điểm cân bằng ≈ 2π/√(αγ) = ${fmt(model.eq.period, 3)} (chỉ đúng gần điểm cân bằng).`,
        `Small-oscillation period around the equilibrium ≈ 2π/√(αγ) = ${fmt(model.eq.period, 3)} (valid only near the equilibrium).`,
      ),
    ],
  };
}
