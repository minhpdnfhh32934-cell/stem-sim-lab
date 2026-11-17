import { lazy } from 'react';
import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import { DIM, type Dimension } from '@/core/units';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC, sgkVl11 } from '../common/sources';
import { texNum, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  WorldBounds,
} from '../types';
import { LATTICE_CELLS, LATTICE_CHECK_TOL, latticeWavelength, particlePeriod } from './check';
import { draw, drawnAt, verticalScale, viewLength } from './draw';
import { TW } from './engine';
import {
  KIND,
  TRAVEL_DEFAULTS,
  arrival,
  isValid,
  period,
  phaseLag,
  travelInput,
  wavelength,
} from './model';

/** Most M can be from the source on the slider (m). */
export const XM_MAX = 20;

function view(p: Params): WorldBounds {
  const Lv = viewLength(travelInput(p));
  return { xMin: -0.08 * Lv, xMax: 1.04 * Lv, yMin: -0.3 * Lv, yMax: 0.3 * Lv };
}

const pick = (p: Params) => viewLength(travelInput(p)) / 30;

const source: BodyDef = {
  id: 'source',
  label: L('Nguồn sóng O', 'Wave source O'),
  position: (s, p) => drawnAt(travelInput(p), 0, s[TW.uO] ?? 0),
  radius: pick,
  draggable: false,
  properties: (s, p) => {
    const q = travelInput(p);
    return [
      {
        label: L('Li độ của nguồn', 'Displacement of the source'),
        symbol: 'u_O',
        value: s[TW.uO] ?? 0,
        unit: 'cm',
      },
      { label: L('Biên độ', 'Amplitude'), symbol: 'A', value: q.A, unit: 'cm' },
      { label: L('Chu kì', 'Period'), symbol: 'T', value: period(q), unit: 's' },
    ];
  },
};

const pointM: BodyDef = {
  id: 'pointM',
  label: L('Phần tử M của môi trường', 'Part M of the medium'),
  position: (s, p) => {
    const q = travelInput(p);
    return drawnAt(q, q.xM, s[TW.uM] ?? 0);
  },
  radius: pick,
  draggable: true,
  // Dragging M along Ox picks another part of the medium to watch (restarts the run).
  dragTo: (x) => ({ xM: Math.min(XM_MAX, Math.max(0, Math.round(x * 100) / 100)) }),
  properties: (s, p) => {
    const q = travelInput(p);
    return [
      { label: L('Khoảng cách OM', 'Distance OM'), symbol: 'OM', value: q.xM, unit: 'm' },
      {
        label: L('Li độ của M', 'Displacement of M'),
        symbol: 'u_M',
        value: s[TW.uM] ?? 0,
        unit: 'cm',
      },
      {
        label: L('Vận tốc của M', 'Velocity of M'),
        symbol: 'v_M',
        value: s[TW.vM] ?? 0,
        unit: 'm/s',
      },
      {
        label: L('Thời điểm sóng tới M', 'When the wave reaches M'),
        symbol: 't_M',
        value: arrival(q, q.xM),
        unit: 's',
      },
    ];
  },
};

const graphs: GraphDef[] = [
  {
    id: 'displacement',
    title: L('Li độ theo thời gian', 'Displacement vs time'),
    yLabel: L('u (m)', 'u (m)'),
    series: [
      { id: 'uO', label: L('Nguồn O', 'Source O'), value: (s) => s[TW.uO] ?? 0, dash: [7, 5] },
      { id: 'uM', label: L('Phần tử M', 'Part M'), value: (s) => s[TW.uM] ?? 0 },
    ],
  },
];

const kindText = (kind: number): LocalizedText =>
  kind === KIND.transverse
    ? L(
        'Sóng ngang: các phần tử dao động theo phương vuông góc với phương truyền sóng.',
        'Transverse wave: the parts oscillate at right angles to the direction the wave travels.',
      )
    : L(
        'Sóng dọc: các phần tử dao động theo phương trùng với phương truyền sóng, tạo thành các lớp nén, dãn.',
        'Longitudinal wave: the parts oscillate along the direction the wave travels, making compressions and rarefactions.',
      );

function solve(p: Params, locale: Locale): Solution {
  const q = travelInput(p);
  if (!isValid(q)) return { answers: [], steps: [] };
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const T = period(q);
  const lam = wavelength(q);
  const tM = arrival(q, q.xM);
  const lag = phaseLag(q, q.xM);
  const answers: Answer[] = [
    {
      id: 'T',
      label: L('Chu kì sóng', 'Period of the wave'),
      value: T,
      unit: 's',
      check: particlePeriod(q),
    },
    {
      id: 'lambda',
      label: L('Bước sóng', 'Wavelength'),
      value: lam,
      unit: 'm',
      check: latticeWavelength(q),
      checkTol: LATTICE_CHECK_TOL,
    },
    {
      id: 'tM',
      label: L('Thời gian sóng truyền từ O đến M', 'Time for the wave to go from O to M'),
      value: tM,
      unit: 's',
    },
    {
      id: 'lag',
      label: L('Độ lệch pha của M so với O', 'Phase lag of M behind O'),
      value: lag,
      unit: 'rad',
    },
  ];
  const steps = [
    {
      text: L(
        'Chu kì sóng bằng chu kì dao động của nguồn:',
        'The period of the wave is the period of the source:',
      ),
      tex: `T = \\frac{1}{f} = \\frac{1}{${n(q.f)}} = ${Q(T, 's')}`,
    },
    {
      text: L(
        'Bước sóng là quãng đường sóng truyền được trong một chu kì:',
        'The wavelength is how far the wave travels in one period:',
      ),
      tex: `\\lambda = vT = \\frac{v}{f} = \\frac{${n(q.v)}}{${n(q.f)}} = ${Q(lam, 'm')}`,
    },
    {
      text: L(
        'Sóng truyền với tốc độ v, nên tới M sau:',
        'The wave travels at speed v, so it reaches M after:',
      ),
      tex: `t_M = \\frac{OM}{v} = \\frac{${n(q.xM)}}{${n(q.v)}} = ${Q(tM, 's')}`,
    },
    {
      text: L(
        'M lặp lại dao động của O nhưng chậm hơn một khoảng t_M, nên trễ pha so với O:',
        'M repeats the motion of O a time t_M later, so it lags behind O in phase by:',
      ),
      tex: `\\Delta\\varphi = \\frac{2\\pi \\cdot OM}{\\lambda} = \\frac{2\\pi \\cdot ${n(q.xM)}}{${n(lam)}} = ${Q(lag, 'rad')}`,
    },
  ];
  const fmt = (v: number) => formatNumber(locale, Number(v.toPrecision(4)));
  const ratio = fmt(q.xM / lam);
  const notes = [
    kindText(q.kind),
    L(
      `OM bằng ${ratio} bước sóng. Sau khi sóng tới, M chỉ dao động quanh vị trí cân bằng của nó với biên độ A: sóng truyền năng lượng đi xa nhưng không mang các phần tử môi trường theo.`,
      `OM is ${ratio} wavelengths. Once the wave arrives, M only oscillates about its own place with amplitude A: the wave carries energy away but not the parts of the medium.`,
    ),
  ];
  return { answers, steps, notes };
}

function validate(p: Params): LocalizedText[] {
  const q = travelInput(p);
  if (!isValid(q))
    return [
      L(
        'Biên độ, tần số và tốc độ truyền sóng phải lớn hơn 0.',
        'Amplitude, frequency and wave speed must be greater than 0.',
      ),
    ];
  if (q.kind === KIND.longitudinal && (2 * Math.PI * q.A) / wavelength(q) >= 1)
    return [
      L(
        'Biên độ quá lớn so với bước sóng: các lớp liền nhau của môi trường sẽ chồng lên nhau, mô hình sóng dọc hình sin không còn đúng. Hãy giảm biên độ hoặc tăng bước sóng.',
        'The amplitude is too large for the wavelength: neighbouring layers of the medium would pass each other, so the sinusoidal longitudinal wave no longer holds. Lower the amplitude or lengthen the wave.',
      ),
    ];
  return [];
}

function card(p: Params): ScienceCardData {
  const longi = travelInput(p).kind === KIND.longitudinal;
  return {
    title: L('Sóng cơ: sóng ngang và sóng dọc', 'Mechanical waves: transverse and longitudinal'),
    model: L(
      'Nguồn O bắt đầu dao động điều hòa lúc t = 0 (đi lên) và truyền dao động cho các phần tử môi trường dọc theo Ox với tốc độ v. Phần tử ở khoảng cách x lặp lại dao động của O sau thời gian x/v. Sóng ngang: phần tử dao động vuông góc với Ox; sóng dọc: dao động dọc theo Ox.',
      'The source O starts simple harmonic motion at t = 0 (moving up) and passes it on to the parts of the medium along Ox at speed v. The part at distance x repeats the motion of O a time x/v later. Transverse wave: the parts move across Ox; longitudinal wave: along Ox.',
    ),
    equations: [
      { tex: 'f = \\frac{1}{T}', label: L('Tần số sóng', 'Frequency of the wave') },
      { tex: '\\lambda = vT = \\frac{v}{f}', label: L('Bước sóng', 'Wavelength') },
      {
        tex: 'u = A\\sin 2\\pi f\\left(t - \\frac{x}{v}\\right),\\ t \\ge \\frac{x}{v}',
        label: L('Li độ của phần tử ở x', 'Displacement of the part at x'),
      },
      {
        tex: '\\Delta\\varphi = \\frac{2\\pi x}{\\lambda}',
        label: L('Độ trễ pha so với nguồn', 'Phase lag behind the source'),
      },
      { tex: 'I = \\frac{E}{S\\,\\Delta t}', label: L('Cường độ sóng', 'Wave intensity') },
    ],
    assumptions: [
      L(
        'Sóng hình sin truyền theo một phương trong môi trường đồng tính: tốc độ v như nhau ở mọi nơi và không phụ thuộc tần số của nguồn (SGK Bài 8, mục "Em có biết", tr. 35).',
        'A sinusoidal wave along one direction in a uniform medium: the same speed v everywhere, independent of the frequency of the source (textbook lesson 8, p. 35).',
      ),
      L(
        'Không mất năng lượng: mọi phần tử có cùng biên độ A; không có sóng phản xạ.',
        'No energy is lost: every part has the same amplitude A; there is no reflected wave.',
      ),
      L(
        'Mặc định theo câu hỏi 1, tr. 35: thuyền dao động 24 lần trong 40 s (f = 0,6 Hz), sóng cao 12 cm, ngọn sóng tới bờ cách 10 m sau 5 s (v = 2 m/s); M là bờ.',
        'Defaults from question 1, p. 35: a boat oscillates 24 times in 40 s (f = 0.6 Hz), the wave is 12 cm high, and a crest reaches the bank 10 m away after 5 s (v = 2 m/s); M is the bank.',
      ),
      longi
        ? L(
            'Độ dời dọc Ox của các lớp được vẽ phóng to (ghi trên hình) để thấy rõ chỗ nén, chỗ dãn.',
            'The layers’ shifts along Ox are drawn enlarged (stated on the picture) to show the compressions and rarefactions.',
          )
        : L(
            'Li độ được vẽ phóng to khi quá nhỏ so với bước sóng (ghi trên hình); lưới vẫn ghi mét thật.',
            'The displacement is drawn enlarged when it is small next to the wavelength (stated on the picture); the grid keeps true metres.',
          ),
    ],
    validity: L(
      'Sóng biên độ nhỏ trong môi trường đàn hồi đồng tính; với sóng dọc cần 2πA/λ < 1 để các lớp không chồng lên nhau.',
      'Small-amplitude waves in a uniform elastic medium; a longitudinal wave needs 2πA/λ < 1 so that the layers never pass each other.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      `Công thức đúng của sóng hình sin. Kiểm chứng độc lập bằng DOPRI5: chu kì đo trên dao động của phần tử M; bước sóng đo trên một dây ${String(LATTICE_CELLS)} ô mỗi bước sóng giải phương trình sóng, khớp trong 0,2 % (sai khác do lưới rời rạc).`,
      `Exact for a sinusoidal wave. Independent DOPRI5 checks: the period measured on the motion of part M; the wavelength measured on a string of ${String(LATTICE_CELLS)} cells per wavelength solving the wave equation, agreeing within 0.2 % (the lattice is discrete).`,
    ),
    method: L(
      'Li độ tính đúng theo công thức tại t = n·Δt, Δt ≤ T/200; không tích phân, không tích lũy sai số.',
      'The displacement is evaluated exactly at t = n·Δt, Δt ≤ T/200; nothing is integrated, so no error builds up.',
    ),
    userIntervened: false,
    sources: [sgkVl11(8), sgkVl11(9), SRC.hallidayWaves, SRC.hairer],
  };
}

const numberParam = (
  key: string,
  label: LocalizedText,
  symbol: string,
  dim: Dimension,
  unit: string,
  range: readonly [number, number, number],
): ParamDef => ({
  key,
  label,
  symbol,
  kind: 'number',
  dim,
  unit,
  min: range[0],
  max: range[1],
  step: range[2],
});

export const travellingWave: PhysicsScene = {
  id: 'travellingWave',
  engineId: 'phys.travellingWave',
  view3d: lazy(() => import('./Travel3DView')),
  endless: true,
  title: L('Sóng cơ: sóng ngang, sóng dọc', 'Mechanical waves: transverse, longitudinal'),
  required: ['f', 'v'],
  params: [
    {
      key: 'kind',
      label: L('Loại sóng', 'Kind of wave'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: KIND.transverse, label: L('Sóng ngang', 'Transverse') },
        { value: KIND.longitudinal, label: L('Sóng dọc', 'Longitudinal') },
      ],
    },
    numberParam('A', L('Biên độ sóng', 'Amplitude'), 'A', DIM.length, 'cm', [0.1, 50, 0.1]),
    numberParam(
      'f',
      L('Tần số của nguồn', 'Frequency of the source'),
      'f',
      DIM.frequency,
      'Hz',
      [0.1, 20, 0.1],
    ),
    numberParam(
      'v',
      L('Tốc độ truyền sóng', 'Wave speed'),
      'v',
      DIM.velocity,
      'm/s',
      [0.1, 20, 0.1],
    ),
    numberParam(
      'xM',
      L('Khoảng cách từ nguồn đến M', 'Distance from the source to M'),
      'OM',
      DIM.length,
      'm',
      [0, XM_MAX, 0.1],
    ),
  ],
  defaults: { ...TRAVEL_DEFAULTS },
  usesGravity: false,
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [source, pointM],
  view,
  draw,
  yStretch: (p) => verticalScale(travelInput(p)),
};
