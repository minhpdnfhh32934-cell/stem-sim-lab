import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { draw, fmtRatio, verticalScale } from './draw';
import {
  MODE,
  SW,
  latticeFrequency,
  standingInput,
  stepOf,
  waveOf,
  type StandingInput,
} from './engine';
import { nearestResonances, ratioDigits } from './model';

/** Amplitude at the probe, |2A·sin(k·x_P)| (0 at a node: sin(jπ) is only round-off there). */
export function probeAmplitude(q: StandingInput): number {
  const w = waveOf(q);
  if (!w) return 0;
  const s = Math.sin(w.k * q.xP);
  return Math.abs(s) < 1e-12 ? 0 : 2 * q.A * Math.abs(s);
}

/** Largest string slope 2A·k; above 0.1 the small-amplitude (linear) model is only approximate. */
const steep = (q: StandingInput) => {
  const w = waveOf(q);
  return w !== null && 2 * w.A * w.k > 0.1;
};

/** Learner-facing text when 2Lf/v is not whole (trap 5): never rounded, nearest resonances. */
function noResonance(q: StandingInput, locale: Locale): string {
  const r = nearestResonances(q.L, q.f, q.v);
  const m = fmtRatio(locale, r.m);
  const fa = fmtQty(locale, r.above.f, 'Hz');
  if (locale === 'vi') {
    const near = r.below
      ? `Tần số cộng hưởng gần nhất: f${sub(r.below.n)} = ${fmtQty(locale, r.below.f, 'Hz')} (phía dưới) và f${sub(r.above.n)} = ${fa} (phía trên).`
      : `Tần số này thấp hơn tần số cơ bản f₁ = ${fa}.`;
    return `Không có sóng dừng: 2Lf/v = ${m} không phải số nguyên, nên chiều dài dây không bằng một số nguyên lần nửa bước sóng. ${near} SimLab không tự đổi f — hãy chọn một tần số cộng hưởng, hoặc đổi chiều dài dây hay tốc độ truyền sóng.`;
  }
  const near = r.below
    ? `Nearest resonances: f${sub(r.below.n)} = ${fmtQty(locale, r.below.f, 'Hz')} (below) and f${sub(r.above.n)} = ${fa} (above).`
    : `This is below the fundamental f₁ = ${fa}.`;
  return `No standing wave: 2Lf/v = ${m} is not a whole number, so the string is not a whole number of half wavelengths long. ${near} SimLab does not change f for you — pick a resonance, or change the string length or the wave speed.`;
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).replace(/\d/g, (d) => SUBS.charAt(Number(d)));

function validate(p: Params): LocalizedText[] {
  const q = standingInput(p);
  const out: LocalizedText[] = [];
  const pos = (ok: boolean, vi: string, en: string) => {
    if (!ok) out.push(L(vi, en));
  };
  pos(q.L > 0, 'Chiều dài dây L phải lớn hơn 0.', 'The string length L must be positive.');
  pos(q.A > 0, 'Biên độ A phải lớn hơn 0.', 'The amplitude A must be positive.');
  if (q.mode !== MODE.frequency)
    pos(q.f > 0, 'Tần số f phải lớn hơn 0.', 'The frequency f must be positive.');
  if (q.mode !== MODE.speed) {
    if (q.fromTension)
      pos(
        q.tension > 0 && q.muL > 0,
        'Lực căng F và mật độ dài μ phải lớn hơn 0.',
        'The tension F and the linear density μ must be positive.',
      );
    else pos(q.v > 0, 'Tốc độ truyền sóng v phải lớn hơn 0.', 'The wave speed v must be positive.');
  }
  if (q.mode !== MODE.harmonic)
    pos(
      q.n !== null,
      'Số bó sóng n phải là số nguyên dương (1, 2, 3…): SimLab không tự làm tròn.',
      'The number of loops n must be a positive whole number (1, 2, 3…): SimLab does not round it.',
    );
  if (out.length > 0) return out;
  if (q.mode === MODE.harmonic && q.n === null)
    out.push(L(noResonance(q, 'vi'), noResonance(q, 'en')));
  pos(
    q.xP >= 0 && q.xP <= q.L,
    'Điểm dò x_P phải nằm trên dây (0 ≤ x_P ≤ L).',
    'The probe x_P must lie on the string (0 ≤ x_P ≤ L).',
  );
  return out;
}

function solve(p: Params, locale: Locale): Solution {
  const q = standingInput(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const steps: SolutionStep[] = [];
  const answers: Answer[] = [];
  const notes: LocalizedText[] = [];
  if (q.fromTension) {
    steps.push({
      text: L(
        'Tốc độ truyền sóng trên dây từ lực căng F và mật độ dài μ:',
        'Wave speed on the string from the tension F and the linear density μ:',
      ),
      tex: `v = \\sqrt{\\frac{F}{\\mu}} = \\sqrt{\\frac{${Q(q.tension, 'N')}}{${Q(q.muL, 'kg/m')}}} = ${Q(q.v, 'm/s')}`,
    });
    answers.push({
      id: 'speed',
      label: L('Tốc độ truyền sóng', 'Wave speed'),
      value: q.v,
      unit: 'm/s',
    });
  }
  if (q.mode === MODE.harmonic) {
    const lambda = q.v / q.f;
    steps.push({
      text: L('Bước sóng:', 'Wavelength:'),
      tex: `\\lambda = \\frac{v}{f} = \\frac{${Q(q.v, 'm/s')}}{${Q(q.f, 'Hz')}} = ${Q(lambda, 'm')}`,
    });
    steps.push({
      text: L(
        'Hai đầu cố định chỉ có sóng dừng khi chiều dài dây bằng một số nguyên lần nửa bước sóng:',
        'With both ends fixed, a standing wave needs a whole number of half wavelengths:',
      ),
      tex: `m = \\frac{L}{\\lambda/2} = \\frac{2Lf}{v} = \\frac{2\\cdot ${Q(q.L, 'm')}\\cdot ${Q(q.f, 'Hz')}}{${Q(q.v, 'm/s')}} = ${texNum(locale, q.m, ratioDigits(q.m))}`,
    });
    if (q.n === null) {
      const r = nearestResonances(q.L, q.f, q.v);
      steps.push({ text: L(noResonance(q, 'vi'), noResonance(q, 'en')) });
      if (r.below)
        answers.push({
          id: 'f_below',
          label: L('Tần số cộng hưởng ngay dưới', 'Resonance just below'),
          value: r.below.f,
          unit: 'Hz',
        });
      answers.push({
        id: 'f_above',
        label: L('Tần số cộng hưởng ngay trên', 'Resonance just above'),
        value: r.above.f,
        unit: 'Hz',
      });
      return { answers, steps };
    }
  }
  const nn = q.n ?? 0;
  const lambda = (2 * q.L) / nn;
  const fNum = latticeFrequency(q.L, q.v, nn);
  const check = Number.isFinite(fNum) ? q.f / fNum : null;
  if (q.mode === MODE.harmonic) {
    answers.push({
      id: 'harmonic',
      label: L('Số bó sóng n', 'Number of loops n'),
      value: nn,
      unit: '1',
      ...(check ? { check: nn * check } : {}),
    });
  } else {
    steps.push({
      text: L(
        'Hai đầu cố định: chiều dài dây bằng n lần nửa bước sóng, nên',
        'Both ends fixed: the length is n half wavelengths, so',
      ),
      tex: `L = n\\frac{\\lambda}{2} \\;\\Rightarrow\\; \\lambda = \\frac{2L}{n} = \\frac{2\\cdot ${Q(q.L, 'm')}}{${nn}} = ${Q(lambda, 'm')}`,
    });
    if (q.mode === MODE.frequency) {
      steps.push({
        text: L('Tần số sóng:', 'Frequency:'),
        tex: `f = \\frac{v}{\\lambda} = \\frac{nv}{2L} = \\frac{${nn}\\cdot ${Q(q.v, 'm/s')}}{2\\cdot ${Q(q.L, 'm')}} = ${Q(q.f, 'Hz')}`,
      });
      answers.unshift({
        id: 'frequency',
        label: L('Tần số', 'Frequency'),
        value: q.f,
        unit: 'Hz',
        ...(Number.isFinite(fNum) ? { check: fNum } : {}),
      });
    } else {
      steps.push({
        text: L('Tốc độ truyền sóng:', 'Wave speed:'),
        tex: `v = \\lambda f = ${Q(lambda, 'm')}\\cdot ${Q(q.f, 'Hz')} = ${Q(q.v, 'm/s')}`,
      });
      answers.unshift({
        id: 'speed',
        label: L('Tốc độ truyền sóng', 'Wave speed'),
        value: q.v,
        unit: 'm/s',
        ...(check ? { check: q.v * check } : {}),
      });
    }
  }
  const pa = probeAmplitude(q);
  steps.push({
    text: L(
      `Nút cách nhau λ/2, bụng nằm giữa hai nút. Có ${nn + 1} nút (kể cả hai đầu dây) và ${nn} bụng.`,
      `Nodes are λ/2 apart with an antinode halfway. There are ${nn + 1} nodes (both ends included) and ${nn} antinodes.`,
    ),
    tex: `x_{N} = j\\frac{\\lambda}{2},\\quad x_{B} = (2j+1)\\frac{\\lambda}{4},\\qquad \\frac{\\lambda}{2} = ${Q(lambda / 2, 'm')}`,
  });
  steps.push({
    text: L(
      'Biên độ tại bụng gấp đôi biên độ A của mỗi sóng thành phần; tại điểm dò:',
      'An antinode swings with twice the amplitude A of each component wave; at the probe:',
    ),
    tex: `A_{B} = 2A = ${Q(2 * q.A, 'cm')},\\qquad A_{P} = \\left|2A\\sin\\frac{2\\pi x_P}{\\lambda}\\right| = ${Q(pa, 'cm')}`,
  });
  answers.push(
    { id: 'wavelength', label: L('Bước sóng', 'Wavelength'), value: lambda, unit: 'm' },
    { id: 'period', label: L('Chu kì', 'Period'), value: 1 / q.f, unit: 's' },
    {
      id: 'nodes',
      label: L('Số nút (kể cả hai đầu)', 'Nodes (ends included)'),
      value: nn + 1,
      unit: '1',
    },
    { id: 'antinodes', label: L('Số bụng', 'Antinodes'), value: nn, unit: '1' },
    {
      id: 'node_spacing',
      label: L('Khoảng cách hai nút liên tiếp', 'Node spacing'),
      value: lambda / 2,
      unit: 'm',
    },
    {
      id: 'antinode_amplitude',
      label: L('Biên độ tại bụng', 'Antinode amplitude'),
      value: 2 * q.A,
      unit: 'cm',
    },
    {
      id: 'probe_amplitude',
      label: L('Biên độ tại điểm dò', 'Amplitude at the probe'),
      value: pa,
      unit: 'cm',
    },
  );
  if (steep(q))
    notes.push(
      L(
        'Biên độ không còn nhỏ so với bước sóng (độ dốc của dây lớn hơn 0,1): mô hình tuyến tính chỉ còn gần đúng.',
        'The amplitude is no longer small compared with the wavelength (string slope above 0.1): the linear model is only approximate.',
      ),
    );
  // The slowest playback is ×0.1 (PLAYBACK_SPEEDS): f·0.1 ≥ 30 Hz aliases even there.
  if (q.f >= 300)
    notes.push(
      L(
        'Tần số từ 300 Hz trở lên: kể cả ở tốc độ phát chậm nhất (×0,1), hình và đồ thị chỉ lấy một điểm mỗi khung hình nên chuyển động trên màn hình có thể trông chậm lại hoặc đứng yên (hiệu ứng hoạt nghiệm). Các kết quả tính ở trên không bị ảnh hưởng.',
        'At 300 Hz or more, even at the slowest playback (×0.1) the picture and graphs take one sample per frame, so the motion on screen may look slowed down or frozen (stroboscopic effect). The results above are not affected.',
      ),
    );
  return { answers, steps, ...(notes.length > 0 ? { notes } : {}) };
}

function card(p: Params): ScienceCardData {
  const q = standingInput(p);
  return {
    title: L('Sóng dừng trên dây', 'Standing waves on a string'),
    model: L(
      'Hai sóng ngang cùng biên độ A, cùng tần số, truyền ngược chiều nhau trên một sợi dây có hai đầu cố định; sóng phản xạ ngược pha ở đầu cố định. Li độ của dây là tổng hai sóng.',
      'Two transverse waves of equal amplitude A and frequency travel in opposite directions on a string with both ends fixed; the wave reflected at a fixed end is inverted. The string displacement is their sum.',
    ),
    equations: [
      {
        tex: 'y_1 = A\\cos(\\omega t - kx),\\quad y_2 = -A\\cos(\\omega t + kx)',
        label: L(
          'Sóng tới và sóng phản xạ; A là biên độ của mỗi sóng thành phần',
          'Incident and reflected waves; A is the amplitude of each component wave',
        ),
      },
      {
        tex: 'y = y_1 + y_2 = 2A\\sin(kx)\\sin(\\omega t),\\quad k = \\frac{2\\pi}{\\lambda},\\ \\omega = 2\\pi f',
        label: L('Bụng dao động với biên độ 2A', 'Antinodes swing with amplitude 2A'),
      },
      {
        tex: 'L = n\\frac{\\lambda}{2},\\quad f_n = \\frac{nv}{2L},\\quad \\lambda = \\frac{v}{f}',
        label: L(
          'Điều kiện sóng dừng khi hai đầu cố định (n = 1, 2, 3…)',
          'Standing-wave condition with both ends fixed (n = 1, 2, 3…)',
        ),
      },
      {
        tex: 'x_{N} = j\\frac{\\lambda}{2},\\quad x_{B} = (2j+1)\\frac{\\lambda}{4}',
        label: L('Vị trí nút (N) và bụng (B)', 'Positions of nodes (N) and antinodes (B)'),
      },
      {
        tex: 'v = \\sqrt{\\frac{F}{\\mu}}',
        label: L(
          'Tốc độ sóng trên dây theo lực căng F và mật độ dài μ',
          'Wave speed from the tension F and the linear density μ',
        ),
      },
    ],
    assumptions: [
      L(
        'Dây lí tưởng: đồng chất, mảnh, lực căng và mật độ dài không đổi dọc dây.',
        'Ideal string: uniform and thin, with constant tension and linear density.',
      ),
      L(
        'Biên độ nhỏ so với bước sóng, nên phương trình sóng là tuyến tính.',
        'Small amplitude compared with the wavelength, so the wave equation is linear.',
      ),
      L(
        'Không tắt dần: hai sóng thành phần giữ nguyên biên độ A.',
        'No damping: both component waves keep the amplitude A.',
      ),
      L(
        'Chỉ xét dây có hai đầu cố định (hai đầu là nút); dây có một đầu tự do chưa được hỗ trợ.',
        'Only strings with both ends fixed (both ends are nodes); a free end is not supported.',
      ),
      L(
        'A là biên độ của mỗi sóng thành phần; bụng dao động với biên độ 2A.',
        'A is the amplitude of each component wave; an antinode swings with 2A.',
      ),
      L(
        'Tỉ số m = 2Lf/v được coi là nguyên khi |m − round(m)| ≤ 10⁻⁹·max(1, m), chỉ để bỏ qua sai số làm tròn của máy tính; SimLab không làm tròn thêm.',
        'The ratio m = 2Lf/v counts as whole when |m − round(m)| ≤ 10⁻⁹·max(1, m), only to ignore computer round-off; SimLab never rounds further.',
      ),
      L(
        'Hình vẽ có thể phóng to trục dọc để nhìn rõ (ghi trên hình). Hình và đồ thị lấy một điểm mỗi khung hình (khoảng 60 lần mỗi giây), nên chỉ thấy đúng chuyển động khi f × tốc độ phát nhỏ hơn khoảng 30 Hz; nhanh hơn có thể thấy hiệu ứng hoạt nghiệm.',
        'The picture may stretch the vertical axis for visibility (shown on the picture). Picture and graphs take one sample per frame (about 60 per second), so the motion looks right only while f × playback speed stays below about 30 Hz; faster, a stroboscopic effect may appear.',
      ),
    ],
    validity: L(
      'Dao động nhỏ (2A·k ≪ 1), không ma sát, không tắt dần; tần số đúng bằng một tần số cộng hưởng f_n.',
      'Small oscillations (2A·k ≪ 1), no friction or damping; the frequency equals a resonance f_n.',
    ),
    // Outside the small-amplitude range the linear model itself is only approximate.
    confidence: steep(q) ? 'approx' : 'exact',
    confidenceNote: steep(q)
      ? L(
          'Độ dốc lớn nhất của dây 2A·k lớn hơn 0,1: biên độ không còn nhỏ so với bước sóng, mô hình tuyến tính chỉ còn gần đúng. Hãy giảm biên độ A.',
          'The largest string slope 2A·k is above 0.1: the amplitude is no longer small compared with the wavelength, so the linear model is only approximate. Reduce the amplitude A.',
        )
      : L(
          'Li độ tính bằng công thức chính xác ở từng thời điểm (không cộng dồn sai số). Tần số được kiểm chứng độc lập: giải phương trình sóng trên dây chia 200 đoạn bằng Dormand–Prince.',
          'The displacement is the exact formula at each instant (no accumulated error). The frequency is checked independently by solving the wave equation on a 200-cell string with Dormand–Prince.',
        ),
    method: L(
      `Công thức giải tích tại t = i·Δt, Δt = ${fmtQty('vi', stepOf(q), 's', 3)} (≤ T/200).`,
      `Closed form at t = i·Δt, Δt = ${fmtQty('en', stepOf(q), 's', 3)} (≤ T/200).`,
    ),
    userIntervened: false,
    sources: [SRC.sgk11knttWaves, SRC.hallidayWaves, SRC.hairer],
  };
}

function graphs(): GraphDef[] {
  return [
    {
      id: 'probe',
      title: L('Li độ tại điểm dò P', 'Displacement at the probe P'),
      yLabel: L('Li độ (m)', 'Displacement (m)'),
      series: [
        { id: 'y1', label: L('y₁ (sóng tới)', 'y₁ (incident)'), value: (s) => s[SW.y1] ?? 0 },
        { id: 'y2', label: L('y₂ (sóng phản xạ)', 'y₂ (reflected)'), value: (s) => s[SW.y2] ?? 0 },
        { id: 'y', label: L('y = y₁ + y₂', 'y = y₁ + y₂'), value: (s) => s[SW.y] ?? 0 },
      ],
    },
  ];
}

const probe: BodyDef = {
  id: 'probe',
  label: L('Điểm dò P', 'Probe P'),
  position: (s, p) => {
    const q = standingInput(p);
    return { x: q.xP, y: (s[SW.y] ?? 0) * verticalScale(q) };
  },
  radius: (p) => standingInput(p).L / 40,
  draggable: false,
  properties: (s, p) => [
    {
      label: L('Li độ sóng tới', 'Incident wave'),
      symbol: 'y_1',
      value: s[SW.y1] ?? 0,
      unit: 'cm',
    },
    {
      label: L('Li độ sóng phản xạ', 'Reflected wave'),
      symbol: 'y_2',
      value: s[SW.y2] ?? 0,
      unit: 'cm',
    },
    {
      label: L('Li độ của dây', 'String displacement'),
      symbol: 'y',
      value: s[SW.y] ?? 0,
      unit: 'cm',
    },
    {
      label: L('Biên độ tại P', 'Amplitude at P'),
      symbol: 'A_P',
      value: probeAmplitude(standingInput(p)),
      unit: 'cm',
    },
  ],
};

function view(p: Params): WorldBounds {
  const q = standingInput(p);
  const len = q.L > 0 ? q.L : 1;
  return { xMin: -0.1 * len, xMax: 1.1 * len, yMin: -0.28 * len, yMax: 0.3 * len };
}

const lengthParam = (
  key: string,
  label: LocalizedText,
  symbol: string,
  unit: string,
): ParamDef => ({
  key,
  label,
  symbol,
  kind: 'number',
  dim: DIM.length,
  unit,
});
const notMode = (m: number) => (p: Params) => Math.round(p.mode ?? 0) !== m;
const vGiven = (p: Params) => notMode(MODE.speed)(p) && (p.vFrom ?? 0) <= 0.5;
const vTension = (p: Params) => notMode(MODE.speed)(p) && (p.vFrom ?? 0) > 0.5;

export const standingWave: PhysicsScene = {
  id: 'standingWave',
  engineId: 'phys.standingWave',
  title: L('Sóng dừng trên dây', 'Standing waves on a string'),
  required: ['L'],
  params: [
    {
      key: 'mode',
      label: L('Bài toán', 'Problem'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: MODE.frequency, label: L('Tìm f (biết L, v, n)', 'Find f (given L, v, n)') },
        { value: MODE.speed, label: L('Tìm v (biết L, f, n)', 'Find v (given L, f, n)') },
        { value: MODE.harmonic, label: L('Tìm n (biết L, f, v)', 'Find n (given L, f, v)') },
      ],
    },
    {
      ...lengthParam('L', L('Chiều dài dây', 'String length'), 'L', 'm'),
      min: 0.1,
      max: 5,
      step: 0.01,
    },
    {
      key: 'n',
      label: L('Số bó sóng', 'Number of loops'),
      symbol: 'n',
      kind: 'number',
      min: 1,
      max: 20,
      step: 1,
      when: notMode(MODE.harmonic),
    },
    {
      key: 'f',
      label: L('Tần số', 'Frequency'),
      symbol: 'f',
      kind: 'number',
      dim: DIM.frequency,
      unit: 'Hz',
      min: 1,
      max: 200,
      step: 0.1,
      when: notMode(MODE.frequency),
    },
    {
      key: 'v',
      label: L('Tốc độ truyền sóng', 'Wave speed'),
      symbol: 'v',
      kind: 'number',
      dim: DIM.velocity,
      unit: 'm/s',
      min: 1,
      max: 500,
      step: 0.1,
      when: vGiven,
    },
    {
      key: 'tension',
      label: L('Lực căng dây', 'String tension'),
      symbol: 'F',
      kind: 'number',
      dim: DIM.force,
      unit: 'N',
      min: 0.1,
      max: 500,
      step: 0.1,
      when: vTension,
    },
    {
      key: 'muL',
      label: L('Mật độ dài của dây', 'Linear density'),
      symbol: '\\mu',
      kind: 'number',
      dim: DIM.linearDensity,
      unit: 'g/m',
      min: 0.1,
      max: 50,
      step: 0.1,
      when: vTension,
    },
    {
      ...lengthParam('A', L('Biên độ mỗi sóng thành phần', 'Amplitude of each wave'), 'A', 'cm'),
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    {
      key: 'vFrom',
      label: L('Lấy tốc độ sóng từ', 'Wave speed from'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Nhập v', 'Type v') },
        { value: 1, label: L('Từ lực căng và mật độ dài', 'Tension and linear density') },
      ],
      when: notMode(MODE.speed),
    },
    {
      ...lengthParam('xP', L('Vị trí điểm dò', 'Probe position'), 'x_P', 'm'),
      min: 0,
      max: 5,
      step: 0.01,
    },
    {
      key: 'showParts',
      label: L('Hiện hai sóng thành phần', 'Show the two component waves'),
      symbol: '',
      kind: 'toggle',
    },
  ],
  // 1.2 m string, 3 loops at v = 20 m/s (F = 2 N, μ = 5 g/m) → f = 25 Hz, λ = 0.8 m;
  // the probe sits on the first antinode.
  defaults: {
    mode: MODE.frequency,
    L: 1.2,
    n: 3,
    f: 25,
    v: 20,
    tension: 2,
    muL: 0.005,
    A: 0.005,
    vFrom: 0,
    xP: 0.2,
    showParts: 1,
  },
  usesGravity: false,
  // About 10 s of screen time for the 20 periods of a run (closest offered speed).
  suggestedSpeed: (p) => {
    const f = standingInput(p).f;
    return f > 0 ? 2 / f : 1;
  },
  validate,
  scienceCard: card,
  solve,
  graphs: graphs(),
  bodies: [probe],
  view,
  draw,
};
