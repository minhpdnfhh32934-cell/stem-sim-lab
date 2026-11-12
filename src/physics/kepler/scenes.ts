import type { Locale } from '@/app/i18n/types';
import type { Source } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum } from '../common/tex';
import { circle, line, polygon, polyline, text } from '../render/draw';
import type {
  Answer,
  DrawContext,
  GraphDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { numericSpeedRatio } from './check';
import { KE } from './engine';
import { A, aphelion, arc, orbit, perihelion, sectorArea, semiMinor, speedRatio } from './model';

/** Orbital mechanics reference (DATA_REVIEW KEP-1). */
export const MURRAY: Source = {
  id: 'murray-dermott',
  citation:
    'C. D. Murray, S. F. Dermott — Solar System Dynamics, Cambridge University Press 1999, chương 2 (bài toán hai vật, phương trình Kepler)',
};

const EXTENSION = L(
  'Mở rộng — ngoài 9 cuốn SGK Kết nối tri thức (có thể thuộc chuyên đề “Trường hấp dẫn”, giáo viên kiểm).',
  'Extension — outside the nine KNTT textbooks (possibly the “Gravitational field” topic; the teacher checks).',
);

function view(p: Params): WorldBounds {
  const o = orbit(p);
  const b = semiMinor(o);
  return {
    xMin: -aphelion(o) - 0.25,
    xMax: perihelion(o) + 0.25,
    yMin: -b - 0.25,
    yMax: b + 0.35,
  };
}

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const col = opts.colors;
  const o = orbit(p);
  // Equal-time slices: every one sweeps the same area (Kepler II); the one being swept is filled.
  const slice = o.T / o.N;
  const t = opts.time;
  const now = Math.floor((((t % o.T) + o.T) % o.T) / slice);
  for (let k = 0; k < o.N; k++) {
    const pts = [{ x: 0, y: 0 }, ...arc(o, k * slice, (k + 1) * slice, 48)];
    ctx.save();
    ctx.globalAlpha = k === now ? 0.35 : k % 2 === 0 ? 0.12 : 0.06;
    polygon(ctx, cam, pts, k === now ? col.accent : col.velocity);
    ctx.restore();
    const end = pts[pts.length - 1] ?? { x: 0, y: 0 };
    line(ctx, cam, 0, 0, end.x, end.y, col.faint, 1);
  }
  polyline(ctx, cam, arc(o, 0, o.T, 240), col.muted, 1.5);
  const x = state[KE.x] ?? perihelion(o);
  const y = state[KE.y] ?? 0;
  line(ctx, cam, 0, 0, x, y, col.text, 1.2);
  circle(ctx, cam, 0, 0, 0.06, col.force, col.text, 10);
  circle(ctx, cam, x, y, 0.035, col.body, col.text, 6);
  const v = view(p);
  const dA = sectorArea(o, 0, slice, 400);
  text(
    ctx,
    cam,
    v.xMin,
    v.yMax,
    `e = ${fmtQty(opts.locale, o.e, '1')}, T = ${fmtQty(opts.locale, o.T, 's')}, ${opts.locale === 'vi' ? 'mỗi phần quét' : 'each slice sweeps'} ${fmtQty(opts.locale, dA, '1')} a²`,
    col.muted,
    'left',
    { x: 60, y: 18 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'distance',
    title: L('Khoảng cách tới Mặt Trời theo thời gian', 'Distance to the Sun vs time'),
    yLabel: L('r (đơn vị a)', 'r (units of a)'),
    series: [{ id: 'r', label: L('r', 'r'), value: (s) => s[KE.r] ?? 0 }],
  },
  {
    id: 'speed',
    title: L('Tốc độ theo thời gian', 'Speed vs time'),
    yLabel: L('v (a/s)', 'v (a/s)'),
    series: [{ id: 'v', label: L('v', 'v'), value: (s) => s[KE.v] ?? 0 }],
  },
  {
    id: 'areal',
    title: L('Tốc độ quét diện tích', 'Areal velocity'),
    yLabel: L('dA/dt (a²/s)', 'dA/dt (a²/s)'),
    series: [{ id: 'areal', label: L('dA/dt', 'dA/dt'), value: (s) => s[KE.areal] ?? 0 }],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const o = orbit(p);
  const n = (v: number) => texNum(locale, v);
  const b = semiMinor(o);
  const ratio = speedRatio(o);
  const slice = (Math.PI * A * b) / o.N;
  const steps: SolutionStep[] = [
    {
      text: L(
        'Khoảng cách gần nhất (cận nhật) và xa nhất (viễn nhật), theo đơn vị a:',
        'Closest (perihelion) and farthest (aphelion) distances, in units of a:',
      ),
      tex: `r_{\\min} = a(1 - e) = ${n(perihelion(o))},\\quad r_{\\max} = a(1 + e) = ${n(aphelion(o))}`,
    },
    {
      text: L(
        'Định luật II Kepler: bán kính nối Mặt Trời với hành tinh quét những diện tích bằng nhau trong những khoảng thời gian bằng nhau, nên ở hai đầu trục lớn r·v như nhau:',
        'Kepler’s second law: the Sun–planet line sweeps equal areas in equal times, so r·v is the same at both ends of the major axis:',
      ),
      tex: `\\frac{v_{\\max}}{v_{\\min}} = \\frac{r_{\\max}}{r_{\\min}} = \\frac{1 + e}{1 - e} = ${n(ratio)}`,
    },
    {
      text: L(
        `Mỗi phần trong ${String(o.N)} phần bằng nhau của chu kì quét diện tích (đơn vị a²):`,
        `Each of the ${String(o.N)} equal slices of the period sweeps (units of a²):`,
      ),
      tex: `\\Delta A = \\frac{\\pi a b}{N} = ${n(slice)},\\quad b = a\\sqrt{1 - e^2} = ${n(b)}`,
    },
  ];
  const answers: Answer[] = [
    {
      id: 'rMin',
      label: L('Khoảng cách cận nhật (lần a)', 'Perihelion distance (× a)'),
      value: perihelion(o),
      unit: '1',
    },
    {
      id: 'rMax',
      label: L('Khoảng cách viễn nhật (lần a)', 'Aphelion distance (× a)'),
      value: aphelion(o),
      unit: '1',
    },
    {
      id: 'speedRatio',
      label: L('Tỉ số tốc độ cận nhật / viễn nhật', 'Perihelion / aphelion speed ratio'),
      value: ratio,
      unit: '1',
      check: numericSpeedRatio(o),
    },
    {
      id: 'sliceArea',
      label: L('Diện tích quét mỗi phần (lần a²)', 'Area swept per slice (× a²)'),
      value: slice,
      unit: '1',
      check: sectorArea(o, 0, o.T / o.N),
    },
  ];
  return { answers, steps, notes: [EXTENSION] };
}

function card(): ScienceCardData {
  return {
    title: L('Định luật II Kepler', 'Kepler’s second law'),
    model: L(
      'Hành tinh chuyển động trên quỹ đạo elip, Mặt Trời đứng yên ở một tiêu điểm (bài toán hai vật, khối lượng hành tinh bỏ qua). Vị trí theo thời gian lấy từ phương trình Kepler.',
      'A planet moves on an ellipse with the Sun fixed at one focus (two-body problem, planet mass neglected). Its position over time comes from Kepler’s equation.',
    ),
    equations: [
      {
        tex: 'M = \\frac{2\\pi t}{T} = E - e\\sin E',
        label: L(
          'Phương trình Kepler (giải bằng phương pháp Newton)',
          'Kepler’s equation (solved by Newton’s method)',
        ),
      },
      {
        tex: 'x = a(\\cos E - e),\\quad y = b\\sin E,\\quad b = a\\sqrt{1 - e^2}',
        label: L('Vị trí (Mặt Trời ở gốc toạ độ)', 'Position (Sun at the origin)'),
      },
      {
        tex: '\\frac{dA}{dt} = \\frac{\\pi a b}{T} = \\text{const}',
        label: L('Định luật II Kepler', 'Kepler’s second law'),
      },
    ],
    assumptions: [
      L(
        'Đơn vị tương đối: bán trục lớn a = 1; chu kì T chỉ quyết định hình chạy nhanh hay chậm. Không dùng số liệu hành tinh thật (chưa có bảng có nguồn).',
        'Relative units: semi-major axis a = 1; the period T only sets how fast the picture runs. No real planet data (no sourced table yet).',
      ),
      L(
        'Chỉ có lực hấp dẫn của Mặt Trời; bỏ qua các hành tinh khác và hiệu ứng tương đối tính.',
        'Only the Sun’s gravity; other planets and relativistic effects are ignored.',
      ),
      EXTENSION,
    ],
    validity: L(
      'Quỹ đạo elip với 0 ≤ e < 1 (không gồm parabol, hyperbol).',
      'Elliptical orbits with 0 ≤ e < 1 (not parabolas or hyperbolas).',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Vị trí từ phương trình Kepler (Newton tới sai số làm tròn). Kiểm chéo: tích phân Dormand–Prince định luật hấp dẫn cho cùng tỉ số tốc độ; diện tích từng phần đo bằng đa giác bằng πab/N.',
      'Positions from Kepler’s equation (Newton to rounding). Cross-checks: Dormand–Prince integration of the law of gravitation gives the same speed ratio; each slice’s polygon area equals πab/N.',
    ),
    method: L(
      'Nghiệm giải tích theo t (không cộng dồn); bước Δt = 1/240 s chỉ để vẽ.',
      'Closed form in t (nothing accumulates); the step Δt = 1/240 s is only for drawing.',
    ),
    userIntervened: false,
    sources: [SRC.halliday, MURRAY, SRC.hairer],
  };
}

export const keplerOrbit: PhysicsScene = {
  id: 'keplerOrbit',
  engineId: 'phys.kepler',
  endless: true,
  title: L('Định luật II Kepler', 'Kepler’s second law'),
  required: ['e'],
  usesGravity: false,
  params: [
    {
      key: 'e',
      label: L('Tâm sai (độ dẹt) của quỹ đạo', 'Orbital eccentricity'),
      symbol: 'e',
      kind: 'number',
      min: 0,
      max: 0.9,
      step: 0.01,
    },
    {
      key: 'N',
      label: L('Số phần chia đều chu kì', 'Equal slices of the period'),
      symbol: 'N',
      kind: 'number',
      min: 2,
      max: 12,
      step: 1,
    },
    {
      key: 'T',
      label: L('Chu kì (tốc độ chạy hình)', 'Period (animation speed)'),
      symbol: 'T',
      kind: 'number',
      dim: DIM.time,
      unit: 's',
      min: 4,
      max: 60,
      step: 1,
    },
  ],
  defaults: { e: 0.5, N: 6, T: 12 },
  scienceCard: card,
  solve,
  graphs,
  bodies: [],
  view,
  draw,
  trail: (s) => [{ x: s[KE.x] ?? 0, y: s[KE.y] ?? 0 }],
};
