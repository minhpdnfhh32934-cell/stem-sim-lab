import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  GraphDef,
  ParamDef,
  ParamSource,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
} from '../types';
import { isWhole, ratioDigits } from '../wave/model';
import { draw, interferenceView, pickRadius } from './draw';
import {
  IF,
  MAX_RATIO,
  MODE,
  BEAT_CHECK_TOL,
  interferenceInput,
  beatsMeasurable,
  measuredBeatPeriod,
  modeOf,
  phasorAmplitude,
  pointM,
  scanSegment,
  stepOf,
  type InterferenceInput,
} from './engine';
import { amplitudeAt, beatFrequency, maximaBetween, minimaBetween, orderAt } from './model';

/** Largest surface slope 2a·k = 4πa/λ; above 0.1 the small-amplitude (linear) model is only approximate. */
const steep = (q: InterferenceInput) => (4 * Math.PI * q.a) / Math.min(q.lambda1, q.lambda2) > 0.1;

/** Slider ranges (SI) a drag stays within. */
const D_MIN = 0.01;
const D_MAX = 0.5;
const R_MIN = 0.001;
const R_MAX = 1;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Dragged lengths are kept to 0,1 mm, so the Inspector shows short numbers. */
const tidy = (x: number) => Math.round(x * 1e4) / 1e4;

/**
 * Distances from (x, y) to S₁ = (−d/2, 0) and S₂ = (d/2, 0). `place` (M put under the pointer):
 * kept on the slider and tidied unless M would leave the triangle. Otherwise (M keeping its place
 * while a source moves) exact, only never 0, so M rebuilt from them stays where it was.
 */
function distances(x: number, y: number, d: number, place: boolean): Params {
  const r1 = Math.hypot(x + d / 2, y);
  const r2 = Math.hypot(x - d / 2, y);
  if (!place) return { d1: Math.max(r1, 1e-9), d2: Math.max(r2, 1e-9) };
  const d1 = clamp(r1, R_MIN, R_MAX);
  const d2 = clamp(r2, R_MIN, R_MAX);
  return pointM(d, tidy(d1), tidy(d2)) ? { d1: tidy(d1), d2: tidy(d2) } : { d1, d2 };
}

/**
 * A dragged source sets S₁S₂ = 2|x| (both sources move symmetrically about the midpoint), kept
 * on the slider. M given by the problem keeps its distances, so S₁S₂ stays within
 * |d₁ − d₂| ≤ S₁S₂ ≤ d₁ + d₂; M placed by the learner keeps its place on the water (d₁, d₂
 * follow); M not given follows S₁S₂ (`autoDefaults`).
 */
export function dragSource(x: number, p: Params, sources: Record<string, ParamSource>): Params {
  const q = interferenceInput(p);
  const from = (k: string) => sources[k] ?? 'default';
  const problemM = from('d1') === 'problem' || from('d2') === 'problem';
  const lo = problemM ? Math.max(D_MIN, Math.abs(q.d1 - q.d2)) : D_MIN;
  const hi = problemM ? Math.min(D_MAX, q.d1 + q.d2) : D_MAX;
  if (!(lo <= hi)) return {};
  const d = clamp(tidy(clamp(2 * Math.abs(x), lo, hi)), lo, hi);
  const learnerM = !problemM && (from('d1') === 'user' || from('d2') === 'user');
  // Exact: M is rebuilt from d₁, d₂ at every move; rounding or clamping would let it drift.
  return learnerM && q.m ? { d, ...distances(q.m.x, q.m.y, d, false) } : { d };
}

/**
 * Dragged M sets its distances to the sources. M is drawn on the side y ≥ 0, so a pointer below
 * S₁S₂ keeps M on the line instead of flipping it to the mirror point.
 */
export function dragProbe(x: number, y: number, p: Params): Params {
  return distances(x, Math.max(0, y), interferenceInput(p).d, true);
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).replace(/\d/g, (c) => SUBS.charAt(Number(c)));

/** Where M lies in the pattern (equal frequencies). */
function whereM(order: number): LocalizedText {
  const k = Math.round(order);
  if (isWhole(Math.abs(order)))
    return k === 0
      ? L(
          'M nằm trên vân cực đại trung tâm (k = 0): M dao động với biên độ lớn nhất 2a.',
          'M lies on the central maximum (k = 0): it oscillates with the largest amplitude 2a.',
        )
      : L(
          `M nằm trên vân cực đại bậc ${String(Math.abs(k))} (k = ${String(k)}): M dao động với biên độ lớn nhất 2a.`,
          `M lies on the order-${String(Math.abs(k))} maximum (k = ${String(k)}): it oscillates with the largest amplitude 2a.`,
        );
  if (isWhole(Math.abs(order) - 0.5)) {
    const j = String(Math.floor(order));
    return L(
      `M nằm trên một vân cực tiểu (d₂ − d₁ = (k + ½)λ với k = ${j}): phần tử nước tại M không dao động.`,
      `M lies on a minimum (d₂ − d₁ = (k + ½)λ with k = ${j}): the water at M does not oscillate.`,
    );
  }
  return L(
    'M không nằm trên vân cực đại hay cực tiểu: biên độ ở giữa 0 và 2a.',
    'M lies on neither a maximum nor a minimum: its amplitude is between 0 and 2a.',
  );
}

function validate(p: Params): LocalizedText[] {
  const q = interferenceInput(p);
  const out: LocalizedText[] = [];
  const pos = (ok: boolean, vi: string, en: string) => {
    if (!ok) out.push(L(vi, en));
  };
  pos(
    q.d > 0,
    'Khoảng cách hai nguồn S₁S₂ phải lớn hơn 0.',
    'The source separation S₁S₂ must be positive.',
  );
  pos(q.f1 > 0, 'Tần số f₁ phải lớn hơn 0.', 'The frequency f₁ must be positive.');
  if (q.mode === MODE.beats)
    pos(q.f2 > 0, 'Tần số f₂ phải lớn hơn 0.', 'The frequency f₂ must be positive.');
  if (q.fromLambda)
    pos((p.lambda ?? 0) > 0, 'Bước sóng λ phải lớn hơn 0.', 'The wavelength λ must be positive.');
  else pos(q.v > 0, 'Tốc độ truyền sóng v phải lớn hơn 0.', 'The wave speed v must be positive.');
  pos(q.a > 0, 'Biên độ a phải lớn hơn 0.', 'The amplitude a must be positive.');
  pos(
    q.d1 > 0 && q.d2 > 0,
    'Khoảng cách từ M tới hai nguồn d₁, d₂ phải lớn hơn 0.',
    'The distances d₁, d₂ from M to the sources must be positive.',
  );
  if (out.length > 0) return out;
  if (q.mode === MODE.beats)
    pos(
      q.f2 !== q.f1,
      'f₂ = f₁: hai nguồn cùng tần số nên không có phách — hãy chọn “Cùng tần số” để xem giao thoa, hoặc đổi f₂.',
      'f₂ = f₁: equal frequencies give no beats — choose “Same frequency” to see interference, or change f₂.',
    );
  pos(
    q.m !== null,
    'Không có điểm M nào cách S₁ một khoảng d₁ và cách S₂ một khoảng d₂: cần |d₁ − d₂| ≤ S₁S₂ ≤ d₁ + d₂.',
    'No point M is d₁ from S₁ and d₂ from S₂: it needs |d₁ − d₂| ≤ S₁S₂ ≤ d₁ + d₂.',
  );
  pos(
    q.d / Math.min(q.lambda1, q.lambda2) <= MAX_RATIO,
    `S₁S₂ dài hơn ${String(MAX_RATIO)} bước sóng: SimLab vẽ và kiểm tối đa ${String(MAX_RATIO)} bước sóng giữa hai nguồn — hãy chọn bước sóng dài hơn hoặc hai nguồn gần nhau hơn.`,
    `S₁S₂ is longer than ${String(MAX_RATIO)} wavelengths: SimLab draws and checks at most ${String(MAX_RATIO)} wavelengths between the sources — choose a longer wavelength or closer sources.`,
  );
  return out;
}

function solve(p: Params, locale: Locale): Solution {
  const q = interferenceInput(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  // Ratios with enough digits that a non-whole value never looks whole.
  const R = (v: number) => texNum(locale, v, ratioDigits(Math.abs(v)));
  const steps: SolutionStep[] = [];
  const notes: LocalizedText[] = [];
  const speed: Answer = {
    id: 'speed',
    label: L('Tốc độ truyền sóng', 'Wave speed'),
    value: q.v,
    unit: 'cm/s',
  };
  const maxAmp: Answer = {
    id: 'max_amplitude',
    label: L('Biên độ lớn nhất (2a)', 'Largest amplitude (2a)'),
    value: 2 * q.a,
    unit: 'mm',
  };
  if (q.fromLambda)
    steps.push({
      text: L(
        'Tốc độ truyền sóng từ bước sóng và tần số:',
        'Wave speed from the wavelength and the frequency:',
      ),
      tex: `v = \\lambda f = ${Q(q.lambda1, 'cm')}\\cdot ${Q(q.f1, 'Hz')} = ${Q(q.v, 'cm/s')}`,
    });
  if (steep(q))
    notes.push(
      L(
        'Biên độ không còn nhỏ so với bước sóng (độ dốc 4πa/λ lớn hơn 0,1): mô hình cộng sóng tuyến tính chỉ còn gần đúng.',
        'The amplitude is no longer small compared with the wavelength (slope 4πa/λ above 0.1): the linear superposition model is only approximate.',
      ),
    );
  const done = (answers: Answer[]): Solution => ({
    answers,
    steps,
    ...(notes.length > 0 ? { notes } : {}),
  });

  if (q.mode === MODE.beats) {
    if (!q.fromLambda)
      steps.push({
        text: L('Bước sóng của mỗi nguồn:', 'Wavelength of each source:'),
        tex: `\\lambda_1 = \\frac{v}{f_1} = ${Q(q.lambda1, 'cm')},\\qquad \\lambda_2 = \\frac{v}{f_2} = ${Q(q.lambda2, 'cm')}`,
      });
    else
      steps.push({
        text: L('Bước sóng của nguồn S₂:', 'Wavelength of source S₂:'),
        tex: `\\lambda_2 = \\frac{v}{f_2} = ${Q(q.lambda2, 'cm')}`,
      });
    steps.push({
      text: L(
        'Tại M, cộng hai dao động khác tần số rồi biến đổi tổng thành tích: dao động nhanh (tần số trung bình) có biên độ thay đổi chậm theo thời gian.',
        'At M, add the two oscillations of different frequencies and turn the sum into a product: a fast oscillation (average frequency) whose amplitude changes slowly in time.',
      ),
      tex: 'u = 2a\\cos\\left[\\pi(f_1 - f_2)t - \\pi\\left(\\tfrac{d_1}{\\lambda_1} - \\tfrac{d_2}{\\lambda_2}\\right)\\right]\\cos\\left[\\pi(f_1 + f_2)t - \\pi\\left(\\tfrac{d_1}{\\lambda_1} + \\tfrac{d_2}{\\lambda_2}\\right)\\right]',
    });
    const fb = beatFrequency(q.f1, q.f2);
    steps.push({
      text: L(
        'Biên độ (đường bao trên đồ thị) lặp lại sau mỗi chu kì phách; f_b là tần số phách:',
        'The amplitude (the envelope on the graph) repeats every beat period; f_b is the beat frequency:',
      ),
      tex: `f_b = |f_1 - f_2| = |${Q(q.f1, 'Hz')} - ${Q(q.f2, 'Hz')}| = ${Q(fb, 'Hz')},\\qquad T_b = \\frac{1}{f_b} = ${Q(1 / fb, 's')}`,
    });
    steps.push({
      text: L(
        'Hai nguồn khác tần số không phải hai nguồn kết hợp: trên mặt nước không có hệ vân ổn định (vị trí vân cực đại, cực tiểu không cố định) — các vân trôi dần.',
        'Sources of different frequencies are not coherent: the water shows no steady fringe pattern (maxima and minima do not keep their places) — the fringes drift.',
      ),
    });
    // Measured on the engine's displacement at M (the graph), not taken from the formula.
    const Tm = measuredBeatPeriod(p);
    const ok = Number.isFinite(Tm) && Tm > 0;
    if (!beatsMeasurable(q.f1, q.f2))
      notes.push(
        L(
          'Hai tần số khác nhau nhiều (|f₁ − f₂| lớn hơn một nửa tần số trung bình): đường bao vẫn lặp lại sau 1/|f₁ − f₂| theo công thức, nhưng khó nhận ra phách trên đồ thị, nên SimLab không đo lại chu kì phách. Phách rõ khi hai tần số gần nhau.',
          'The frequencies are far apart (|f₁ − f₂| above half the average frequency): the envelope still repeats every 1/|f₁ − f₂| by the formula, but the beats are hard to see on the graph, so SimLab does not measure the beat period again. Beats are clear when the frequencies are close.',
        ),
      );
    else if (!ok)
      notes.push(
        L(
          'Chu kì phách rất dài so với chu kì dao động (cần quá nhiều điểm để đo lại trên đồ thị), nên SimLab không đo lại chu kì phách. Các số ở trên vẫn tính theo công thức.',
          'The beat period is very long next to the oscillation period (measuring it again on the graph would take too many points), so SimLab does not measure it again. The numbers above still come from the formula.',
        ),
      );
    return done([
      {
        id: 'beat_frequency',
        label: L('Tần số phách', 'Beat frequency'),
        value: fb,
        unit: 'Hz',
        ...(ok ? { check: 1 / Tm, checkTol: BEAT_CHECK_TOL } : {}),
      },
      {
        id: 'beat_period',
        label: L('Chu kì phách', 'Beat period'),
        value: 1 / fb,
        unit: 's',
        ...(ok ? { check: Tm, checkTol: BEAT_CHECK_TOL } : {}),
      },
      { id: 'wavelength', label: L('Bước sóng λ₁', 'Wavelength λ₁'), value: q.lambda1, unit: 'cm' },
      {
        id: 'wavelength2',
        label: L('Bước sóng λ₂', 'Wavelength λ₂'),
        value: q.lambda2,
        unit: 'cm',
      },
      maxAmp,
      speed,
    ]);
  }

  const lam = q.lambda1;
  if (!q.fromLambda)
    steps.push({
      text: L('Bước sóng:', 'Wavelength:'),
      tex: `\\lambda = \\frac{v}{f} = \\frac{${Q(q.v, 'cm/s')}}{${Q(q.f1, 'Hz')}} = ${Q(lam, 'cm')}`,
    });
  steps.push({
    text: L(
      'Hai nguồn cùng pha: điểm có hiệu đường đi bằng một số nguyên lần bước sóng dao động với biên độ cực đại; bằng một số nguyên lần bước sóng, cộng thêm nửa bước sóng, thì không dao động (cực tiểu).',
      'In-phase sources: points whose path difference is a whole number of wavelengths oscillate with the largest amplitude (maxima); a whole number of wavelengths, plus half a wavelength, do not oscillate (minima).',
    ),
    tex: 'd_2 - d_1 = k\\lambda\\ (\\max),\\qquad d_2 - d_1 = \\left(k+\\tfrac{1}{2}\\right)\\lambda\\ (\\min),\\qquad k = 0, \\pm 1, \\pm 2, \\ldots',
  });
  const ratio = q.d / lam;
  const nMax = maximaBetween(q.d, lam);
  const nMin = minimaBetween(q.d, lam);
  steps.push({
    text: L(
      'Trên đoạn S₁S₂ (không kể hai nguồn) thì −S₁S₂ < d₂ − d₁ < S₁S₂, nên số cực đại là số giá trị nguyên của k thoả:',
      'On S₁S₂ (sources excluded) −S₁S₂ < d₂ − d₁ < S₁S₂, so the number of maxima is the number of whole k with:',
    ),
    tex: `-\\frac{S_1S_2}{\\lambda} < k < \\frac{S_1S_2}{\\lambda},\\quad \\frac{S_1S_2}{\\lambda} = \\frac{${Q(q.d, 'cm')}}{${Q(lam, 'cm')}} = ${R(ratio)} \\;\\Rightarrow\\; N_{\\max} = ${String(nMax)}`,
  });
  steps.push({
    text: L(
      'Số cực tiểu là số giá trị nguyên của k thoả:',
      'The number of minima is the number of whole k with:',
    ),
    tex: `-\\frac{S_1S_2}{\\lambda} - \\frac{1}{2} < k < \\frac{S_1S_2}{\\lambda} - \\frac{1}{2} \\;\\Rightarrow\\; N_{\\min} = ${String(nMin)}`,
  });
  if (nMax >= 2)
    steps.push({
      text: L(
        'Hai cực đại (hoặc hai cực tiểu) liên tiếp trên S₁S₂ cách nhau nửa bước sóng:',
        'Two neighbouring maxima (or minima) on S₁S₂ are half a wavelength apart:',
      ),
      tex: `\\frac{\\lambda}{2} = ${Q(lam / 2, 'cm')}`,
    });
  else
    steps.push({
      text: L(
        'Trên S₁S₂ chỉ có cực đại trung tâm (k = 0), nên không có hai cực đại liên tiếp để đo khoảng cách.',
        'S₁S₂ holds only the central maximum (k = 0), so there are no two neighbouring maxima to measure.',
      ),
    });
  const dr = q.d2 - q.d1;
  const order = orderAt(dr, lam);
  const AM = amplitudeAt(q.a, dr, lam);
  steps.push({
    text: L(
      `${whereM(order).vi} (M lấy theo d₁, d₂ trong ô thông số; đề không cho M thì SimLab tự đặt M để minh hoạ.)`,
      `${whereM(order).en} (M is taken from d₁, d₂ in the parameters; when the problem gives no M, SimLab places one for illustration.)`,
    ),
    tex: `d_2 - d_1 = ${Q(q.d2, 'cm')} - ${Q(q.d1, 'cm')} = ${Q(dr, 'cm')},\\quad \\frac{d_2 - d_1}{\\lambda} = ${R(order)},\\quad A_M = 2a\\left|\\cos\\frac{\\pi(d_2-d_1)}{\\lambda}\\right| = ${Q(AM, 'mm')}`,
  });
  const scan = scanSegment(q.d, lam);
  return done([
    {
      id: 'maxima',
      label: L('Số cực đại trên S₁S₂ (không kể hai nguồn)', 'Maxima on S₁S₂ (sources excluded)'),
      value: nMax,
      unit: '1',
      check: scan.maxima,
    },
    {
      id: 'minima',
      label: L('Số cực tiểu trên S₁S₂ (không kể hai nguồn)', 'Minima on S₁S₂ (sources excluded)'),
      value: nMin,
      unit: '1',
      check: scan.minima,
    },
    { id: 'wavelength', label: L('Bước sóng', 'Wavelength'), value: lam, unit: 'cm' },
    ...(nMax >= 2
      ? [
          {
            id: 'fringe_spacing',
            label: L(
              'Khoảng cách hai cực đại liên tiếp trên S₁S₂',
              'Spacing of neighbouring maxima on S₁S₂',
            ),
            value: lam / 2,
            unit: 'cm',
          },
        ]
      : []),
    {
      id: 'path_difference',
      label: L('Hiệu đường đi d₂ − d₁ tại M', 'Path difference d₂ − d₁ at M'),
      value: dr,
      unit: 'cm',
    },
    {
      id: 'order',
      label: L('Tỉ số (d₂ − d₁)/λ tại M', 'Ratio (d₂ − d₁)/λ at M'),
      value: order,
      unit: '1',
    },
    {
      id: 'amplitude_M',
      label: L('Biên độ tại M', 'Amplitude at M'),
      value: AM,
      unit: 'mm',
      check: phasorAmplitude(q.a, (2 * Math.PI) / lam, q.d1, q.d2),
    },
    maxAmp,
    speed,
    { id: 'period', label: L('Chu kì', 'Period'), value: 1 / q.f1, unit: 's' },
  ]);
}

function card(p: Params): ScienceCardData {
  const q = interferenceInput(p);
  return {
    title: L('Giao thoa sóng hai nguồn', 'Two-source interference'),
    model: L(
      'Hai nguồn điểm S₁, S₂ trên mặt nước dao động điều hoà cùng biên độ a và cùng pha lúc t = 0. Sóng từ mỗi nguồn lan ra mọi phía với tốc độ v; li độ tại mỗi điểm là tổng li độ của hai sóng (nguyên lí chồng chất). Cùng tần số (hai nguồn kết hợp, luôn cùng pha): hệ vân ổn định, vị trí các vân cực đại, cực tiểu không đổi. Khác tần số: biên độ tại mỗi điểm lên xuống theo thời gian (phách — phần mở rộng, ngoài SGK).',
      'Two point sources S₁, S₂ on water oscillate with the same amplitude a, in phase at t = 0. Each wave spreads in every direction at speed v; the displacement at each point is the sum of the two waves (superposition). Same frequency (coherent sources, always in phase): a steady pattern, the maxima and minima keep their places. Different frequencies: the amplitude at each point rises and falls in time (beats — an extension beyond the textbook).',
    ),
    equations: [
      {
        tex: 'u_1 = a\\cos\\left(\\omega_1 t - \\frac{2\\pi d_1}{\\lambda_1}\\right),\\quad u_2 = a\\cos\\left(\\omega_2 t - \\frac{2\\pi d_2}{\\lambda_2}\\right),\\quad u = u_1 + u_2',
        label: L(
          'Sóng từ mỗi nguồn tới M (d₁, d₂: khoảng cách từ M tới S₁, S₂); ω = 2πf, λ = v/f',
          'The wave from each source at M (d₁, d₂: distances from M to S₁, S₂); ω = 2πf, λ = v/f',
        ),
      },
      {
        tex: 'A_M = 2a\\left|\\cos\\frac{\\pi(d_2 - d_1)}{\\lambda}\\right|',
        label: L('Biên độ tại M khi hai nguồn cùng tần số', 'Amplitude at M for equal frequencies'),
      },
      {
        tex: 'd_2 - d_1 = k\\lambda\\ (\\max),\\qquad d_2 - d_1 = \\left(k+\\tfrac{1}{2}\\right)\\lambda\\ (\\min)',
        label: L(
          'Vân cực đại và vân cực tiểu (k = 0, ±1, ±2…)',
          'Maxima and minima (k = 0, ±1, ±2…)',
        ),
      },
      {
        tex: '-\\frac{S_1S_2}{\\lambda} < k < \\frac{S_1S_2}{\\lambda}',
        label: L(
          'Số cực đại giữa hai nguồn (không kể hai nguồn)',
          'Number of maxima between the sources (sources excluded)',
        ),
      },
      {
        tex: 'f_b = |f_1 - f_2|,\\qquad T_b = \\frac{1}{|f_1 - f_2|}',
        label: L(
          'Phách khi f₁ ≠ f₂ (f_b: tần số phách; mở rộng, ngoài SGK — Halliday ch. 17)',
          'Beats when f₁ ≠ f₂ (f_b: beat frequency; an extension beyond the textbook — Halliday ch. 17)',
        ),
      },
    ],
    assumptions: [
      L(
        'Mặt nước lí tưởng: sóng không tắt dần, và biên độ không giảm theo khoảng cách tới nguồn (mỗi sóng tới mọi điểm với cùng biên độ a).',
        'Ideal water surface: no damping, and the amplitude does not decrease with the distance from the source (each wave reaches every point with the same amplitude a).',
      ),
      L(
        'Hai nguồn điểm cùng biên độ a, cùng pha lúc t = 0 (cùng tần số thì luôn cùng pha); hai nguồn lệch pha chưa được hỗ trợ. Tần số phách không phụ thuộc pha ban đầu.',
        'Two point sources with the same amplitude a, in phase at t = 0 (always in phase at equal frequencies); sources with a phase difference are not supported. The beat frequency does not depend on the starting phase.',
      ),
      L(
        'Tốc độ truyền sóng v như nhau với mọi tần số (bỏ qua tán sắc của sóng mặt nước).',
        'The wave speed v is the same at every frequency (the dispersion of water waves is ignored).',
      ),
      L(
        'Biên độ nhỏ so với bước sóng nên hai sóng cộng tuyến tính (nguyên lí chồng chất).',
        'Small amplitude compared with the wavelength, so the two waves add linearly (superposition).',
      ),
      L(
        'Sóng đã lan khắp mặt nước (hai nguồn dao động từ lâu): không vẽ lúc sóng mới bắt đầu lan ra, không có sóng phản xạ ở thành bể.',
        'The waves already cover the surface (the sources have oscillated for a long time): the start of the spreading is not drawn, and no wave reflects off the tank walls.',
      ),
      L(
        'Đếm cực đại, cực tiểu trên đoạn S₁S₂ không kể hai nguồn. Tỉ số S₁S₂/λ được coi là nguyên (hoặc nguyên cộng ½) khi chỉ lệch do sai số làm tròn của máy tính (≤ 10⁻⁹); SimLab không làm tròn thêm.',
        'Maxima and minima are counted on S₁S₂ without the sources. The ratio S₁S₂/λ counts as whole (or whole plus ½) only within computer round-off (≤ 10⁻⁹); SimLab never rounds further.',
      ),
      L(
        'Phách: biên độ tại mỗi điểm lên xuống với tần số |f₁ − f₂|, dễ thấy khi |f₁ − f₂| nhỏ hơn nhiều so với f₁, f₂. Hai nguồn khác tần số không phải nguồn kết hợp nên không có hệ vân ổn định.',
        'Beats: the amplitude at each point rises and falls at |f₁ − f₂|, easy to see when |f₁ − f₂| is much smaller than f₁, f₂. Sources of different frequencies are not coherent, so there is no steady fringe pattern.',
      ),
      L(
        'Hình mặt nước: màu theo li độ tại tâm mỗi ô ảnh; khoảng cách trên hình theo tỉ lệ thật, độ cao của sóng chỉ thể hiện bằng màu. Máy chậm thì ô ảnh to hơn (hình thô hơn), các số không đổi.',
        'Water picture: colour from the displacement at the centre of each picture cell; distances are to scale, the wave height is shown by colour only. On a slow computer the cells get larger (a coarser picture); the numbers do not change.',
      ),
      L(
        'Kéo một nguồn thì hai nguồn dời đối xứng quanh trung điểm (đổi S₁S₂); kéo M thì đổi d₁, d₂. Mỗi lần kéo là một lần chạy mới từ t = 0, không phải can thiệp giữa chừng.',
        'Dragging a source moves both symmetrically about the midpoint (changes S₁S₂); dragging M changes d₁, d₂. Each drag starts a new run from t = 0, not a mid-run intervention.',
      ),
    ],
    validity: L(
      'Sóng nhỏ (độ dốc 4πa/λ ≪ 1), không tắt dần, không tán sắc; hai nguồn điểm cùng pha lúc t = 0.',
      'Small waves (slope 4πa/λ ≪ 1), no damping, no dispersion; two point sources in phase at t = 0.',
    ),
    // Outside the small-amplitude range the linear model itself is only approximate.
    confidence: steep(q) ? 'approx' : 'exact',
    confidenceNote: steep(q)
      ? L(
          'Độ dốc lớn nhất của mặt nước 4πa/λ lớn hơn 0,1: biên độ không còn nhỏ so với bước sóng, mô hình cộng tuyến tính chỉ còn gần đúng. Mô hình chỉ chính xác khi biên độ a nhỏ hơn nhiều so với bước sóng.',
          'The largest surface slope 4πa/λ is above 0.1: the amplitude is no longer small compared with the wavelength, so the linear model is only approximate. The model is exact only for an amplitude a much smaller than the wavelength.',
        )
      : L(
          'Li độ tính bằng công thức chính xác ở từng thời điểm (không cộng dồn sai số). Đối chiếu: số cực đại, cực tiểu đếm lại bằng cách quét biên độ dọc S₁S₂; chu kì phách đo lại trên li độ tại M (khi hai tần số đủ gần nhau và chu kì phách không quá dài; nếu không, Lời giải ghi chú vì sao; phép đo đọc trên các điểm lấy mẫu nên Lời giải ghi “khớp” khi lệch không quá 0,3 %, thay cho 10⁻⁸ của các phép kiểm khác); thời gian truyền của mỗi sóng được kiểm lại bằng phương trình sóng một chiều dọc một tia, giải bằng phương pháp Dormand–Prince (test; phép này không kiểm giả thiết biên độ không giảm theo khoảng cách).',
          'The displacement is the exact formula at each instant (no accumulated error). Cross-checks: maxima and minima counted again by scanning the amplitude along S₁S₂; the beat period measured again on the displacement at M (when the frequencies are close enough and the beat period is not too long; otherwise the solution says why; it is read off sampled points, so the solution marks it “agrees” within 0.3 %, instead of the 10⁻⁸ of the other checks); each wave’s travel time checked again with the one-dimensional wave equation along a ray, solved with Dormand–Prince (tested; this does not check the assumption that the amplitude does not decrease with distance).',
        ),
    method: L(
      `Công thức giải tích tại t = i·Δt, Δt = ${fmtQty('vi', stepOf(q), 's', 3)} (≤ T/200).`,
      `Closed form at t = i·Δt, Δt = ${fmtQty('en', stepOf(q), 's', 3)} (≤ T/200).`,
    ),
    userIntervened: false,
    sources: [SRC.sgk11knttWaves, SRC.hallidayInterference, SRC.hairer],
  };
}

function graphs(): GraphDef[] {
  return [
    {
      id: 'probe',
      title: L('Li độ tại M', 'Displacement at M'),
      yLabel: L('Li độ (m)', 'Displacement (m)'),
      series: [
        { id: 'u', label: L('u = u₁ + u₂', 'u = u₁ + u₂'), value: (s) => s[IF.u] ?? 0 },
        {
          id: 'env',
          label: L('Đường bao (biên độ)', 'Envelope (amplitude)'),
          value: (s) => s[IF.env] ?? 0,
          dash: DASH,
        },
        {
          id: 'envNeg',
          label: L('Đường bao (−)', 'Envelope (−)'),
          value: (s) => -(s[IF.env] ?? 0),
          dash: DASH,
        },
      ],
    },
  ];
}

const sourceBody = (i: 1 | 2): BodyDef => ({
  id: `S${String(i)}`,
  label: L(`Nguồn S${sub(i)}`, `Source S${sub(i)}`),
  position: (_s, p) => ({ x: ((i === 1 ? -1 : 1) * interferenceInput(p).d) / 2, y: 0 }),
  radius: pickRadius,
  draggable: true,
  dragTo: (x, _y, p, sources) => dragSource(x, p, sources),
  properties: (_s, p) => {
    const q = interferenceInput(p);
    return [
      {
        label: L('Tần số', 'Frequency'),
        symbol: `f_${String(i)}`,
        value: i === 1 ? q.f1 : q.f2,
        unit: 'Hz',
      },
      {
        label: L('Khoảng cách hai nguồn', 'Source separation'),
        symbol: 'S_1S_2',
        value: q.d,
        unit: 'cm',
      },
    ];
  },
});

const probe: BodyDef = {
  id: 'M',
  label: L('Điểm M', 'Point M'),
  position: (_s, p) => interferenceInput(p).m ?? { x: 0, y: 0 },
  radius: pickRadius,
  draggable: true,
  dragTo: dragProbe,
  active: (p) => interferenceInput(p).m !== null,
  properties: (s, p) => {
    const q = interferenceInput(p);
    return [
      { label: L('Khoảng cách MS₁', 'Distance MS₁'), symbol: 'd_1', value: q.d1, unit: 'cm' },
      { label: L('Khoảng cách MS₂', 'Distance MS₂'), symbol: 'd_2', value: q.d2, unit: 'cm' },
      { label: L('Sóng từ S₁', 'Wave from S₁'), symbol: 'u_1', value: s[IF.u1] ?? 0, unit: 'mm' },
      { label: L('Sóng từ S₂', 'Wave from S₂'), symbol: 'u_2', value: s[IF.u2] ?? 0, unit: 'mm' },
      {
        label: L('Li độ tại M', 'Displacement at M'),
        symbol: 'u',
        value: s[IF.u] ?? 0,
        unit: 'mm',
      },
      {
        label: L('Biên độ tại M', 'Amplitude at M'),
        symbol: 'A_M',
        value: s[IF.env] ?? 0,
        unit: 'mm',
      },
    ];
  },
};

const lengthParam = (
  key: string,
  label: LocalizedText,
  symbol: string,
  unit: string,
  min: number,
  max: number,
  step: number,
): ParamDef => ({ key, label, symbol, kind: 'number', dim: DIM.length, unit, min, max, step });
const beats = (p: Params) => modeOf(p) === MODE.beats;
const vTyped = (p: Params) => (p.waveFrom ?? 0) <= 0.5;
const lambdaTyped = (p: Params) => (p.waveFrom ?? 0) > 0.5;

export const interference: PhysicsScene = {
  id: 'interference',
  engineId: 'phys.interference',
  endless: true,
  title: L('Giao thoa sóng hai nguồn', 'Two-source interference'),
  // Filtered by `when`: f₂ only for beats, v or λ as chosen.
  required: ['d', 'f', 'f2', 'v', 'lambda'],
  params: [
    {
      key: 'mode',
      label: L('Hai nguồn', 'Two sources'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: MODE.same, label: L('Cùng tần số (giao thoa)', 'Same frequency (interference)') },
        { value: MODE.beats, label: L('Khác tần số (phách)', 'Different frequencies (beats)') },
      ],
    },
    lengthParam('d', L('Khoảng cách hai nguồn', 'Source separation'), 'S_1S_2', 'cm', 1, 50, 0.1),
    {
      key: 'f',
      label: L('Tần số nguồn S₁', 'Source S₁ frequency'),
      symbol: 'f_1',
      kind: 'number',
      dim: DIM.frequency,
      unit: 'Hz',
      min: 1,
      max: 100,
      step: 0.1,
    },
    {
      key: 'f2',
      label: L('Tần số nguồn S₂', 'Source S₂ frequency'),
      symbol: 'f_2',
      kind: 'number',
      dim: DIM.frequency,
      unit: 'Hz',
      min: 1,
      max: 100,
      step: 0.1,
      when: beats,
    },
    {
      key: 'v',
      label: L('Tốc độ truyền sóng', 'Wave speed'),
      symbol: 'v',
      kind: 'number',
      dim: DIM.velocity,
      unit: 'cm/s',
      min: 1,
      max: 500,
      step: 0.1,
      when: vTyped,
    },
    {
      ...lengthParam(
        'lambda',
        L('Bước sóng (nguồn S₁)', 'Wavelength (source S₁)'),
        '\\lambda',
        'cm',
        0.1,
        20,
        0.01,
      ),
      when: lambdaTyped,
    },
    lengthParam('a', L('Biên độ mỗi nguồn', 'Amplitude of each source'), 'a', 'mm', 0.01, 20, 0.01),
    {
      key: 'waveFrom',
      label: L('Đề cho', 'The problem gives'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Tốc độ truyền sóng v', 'The wave speed v') },
        { value: 1, label: L('Bước sóng λ', 'The wavelength λ') },
      ],
    },
    lengthParam(
      'd1',
      L('Khoảng cách từ M tới S₁', 'Distance from M to S₁'),
      'd_1',
      'cm',
      0.1,
      100,
      0.1,
    ),
    lengthParam(
      'd2',
      L('Khoảng cách từ M tới S₂', 'Distance from M to S₂'),
      'd_2',
      'cm',
      0.1,
      100,
      0.1,
    ),
  ],
  // S₁S₂ = 10 cm, f = 10 Hz, v = 30 cm/s → λ = 3 cm: 7 maxima, 6 minima between the sources;
  // M (9 cm, 12 cm) on the first-order maximum. a = 0,2 mm keeps 4πa/λ ≈ 0,08 (small waves).
  defaults: {
    mode: MODE.same,
    d: 0.1,
    f: 10,
    f2: 11,
    v: 0.3,
    lambda: 0.03,
    a: 2e-4,
    waveFrom: 0,
    d1: 0.09,
    d2: 0.12,
  },
  usesGravity: false,
  // Mode from what the problem states (the AI may leave it out): f₂ → beats, λ without v → λ.
  // M not stated: d₁ = 0,9·S₁S₂, d₂ = 1,2·S₁S₂, a point that exists for every S₁S₂.
  autoDefaults: (p, sources) => {
    const stated = (k: string) => sources[k] === 'problem' || sources[k] === 'user';
    const out: Params = {};
    if (!stated('mode') && stated('f2')) out.mode = MODE.beats;
    if (!stated('waveFrom') && stated('lambda') && !stated('v')) out.waveFrom = 1;
    const d = p.d ?? 0.1;
    if (!stated('d1') && !stated('d2') && d > 0) {
      out.d1 = 0.9 * d;
      out.d2 = 1.2 * d;
    }
    return out;
  },
  // About 10 s of screen time for 20 periods (closest offered speed).
  suggestedSpeed: (p) => {
    const f = interferenceInput(p).f1;
    return Number.isFinite(f) && f > 0 ? 2 / f : 1;
  },
  validate,
  scienceCard: card,
  solve,
  graphs: graphs(),
  bodies: [sourceBody(1), sourceBody(2), probe],
  view: interferenceView,
  draw,
};
