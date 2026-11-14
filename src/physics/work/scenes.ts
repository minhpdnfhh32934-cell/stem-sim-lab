import type { Locale } from '@/app/i18n/types';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { IS } from '../incline/engine';
import { forces } from '../incline/model';
import { draw as inclineDraw, numericEnd, view as inclineView } from '../incline/scenes';
import { text } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
} from '../types';
import { climb, climbs, efficiency, pullInput, works } from './model';

const deg = (rad: number) => (rad * 180) / Math.PI;

const crate: BodyDef = {
  id: 'block',
  label: L('Thùng hàng', 'Crate'),
  position: (s, p) => {
    const q = pullInput(p);
    const along = s[IS.s] ?? 0;
    return { x: along * Math.cos(q.theta), y: along * Math.sin(q.theta) + 0.03 * q.length };
  },
  radius: (p) => 0.04 * pullInput(p).length,
  draggable: false,
  properties: (s, p) => {
    const q = pullInput(p);
    const w = works(q, s[IS.s] ?? 0);
    return [
      {
        label: L('Quãng đường đã đi', 'Distance moved'),
        symbol: 's',
        value: s[IS.s] ?? 0,
        unit: 'm',
      },
      { label: L('Công của lực kéo', 'Work of the pull'), symbol: 'A_F', value: w.WF, unit: 'J' },
      {
        label: L('Công suất của lực kéo', 'Power of the pull'),
        symbol: '\\mathscr{P}',
        value: q.F * Math.cos(q.beta) * (s[IS.v] ?? 0),
        unit: 'W',
      },
    ];
  },
};

function draw(dc: DrawContext): void {
  inclineDraw(dc);
  const { ctx, cam, state, p, opts } = dc;
  const q = pullInput(p);
  const w = works(q, state[IS.s] ?? 0);
  const vis = cam.visible();
  const f = (v: number) => fmtQty(opts.locale, v, 'J', 4);
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `A_F = ${f(w.WF)}   A_P = ${f(w.WP)}   A_ms = ${f(w.Wms)}   ΣA = ${f(w.total)}`,
    opts.colors.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'work',
    title: L('Công của các lực theo thời gian', 'Work of each force over time'),
    yLabel: L('A (J)', 'W (J)'),
    series: [
      {
        id: 'WF',
        label: L('Lực kéo', 'Pull'),
        value: (s, p) => works(pullInput(p), s[IS.s] ?? 0).WF,
      },
      {
        id: 'WP',
        label: L('Trọng lực', 'Weight'),
        value: (s, p) => works(pullInput(p), s[IS.s] ?? 0).WP,
      },
      {
        id: 'Wms',
        label: L('Lực ma sát', 'Friction'),
        value: (s, p) => works(pullInput(p), s[IS.s] ?? 0).Wms,
      },
      {
        id: 'sum',
        label: L('Tổng công', 'Total work'),
        value: (s, p) => works(pullInput(p), s[IS.s] ?? 0).total,
      },
      {
        id: 'K',
        label: L('Động năng', 'Kinetic energy'),
        value: (s, p) => 0.5 * pullInput(p).m * (s[IS.v] ?? 0) ** 2,
        dash: [6, 4],
      },
    ],
  },
  {
    id: 'power',
    title: L('Công suất theo thời gian', 'Power over time'),
    yLabel: L('P (W)', 'P (W)'),
    series: [
      {
        id: 'PF',
        label: L('Lực kéo', 'Pull'),
        value: (s, p) => {
          const q = pullInput(p);
          return q.F * Math.cos(q.beta) * (s[IS.v] ?? 0);
        },
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = pullInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  if (!climbs(q))
    return {
      answers: [],
      steps: [
        {
          text: L(
            'Lực kéo chưa thắng được thành phần trọng lực dọc mặt phẳng và lực ma sát: thùng không đi lên.',
            'The pull does not beat the weight’s component along the slope plus friction: the crate does not move up.',
          ),
        },
      ],
    };
  const { t, v } = climb(q);
  const s = q.length;
  const w = works(q, s);
  const N = forces(q).N;
  const H = efficiency(q, s, v);
  const chk = numericEnd(q);
  const steps: SolutionStep[] = [
    {
      text: L(
        'Công của mỗi lực khi thùng đi hết quãng đường s (α là góc giữa lực và hướng chuyển động):',
        'Work of each force over the distance s (α is the angle between the force and the motion):',
      ),
      tex: `A = F\\,s\\cos\\alpha:\\quad A_F = ${n(q.F)}\\cdot ${n(s)}\\cos ${n(deg(q.beta))}^\\circ = ${Q(w.WF, 'J')},\\quad A_P = -mg\\,s\\sin\\theta = ${Q(w.WP, 'J')}`,
    },
    {
      text: L(
        'Lực ma sát ngược chiều chuyển động (α = 180°); phản lực vuông góc với chuyển động nên không sinh công:',
        'Friction opposes the motion (α = 180°); the normal force is perpendicular to it, so it does no work:',
      ),
      tex: `A_{ms} = -\\mu N s = -${n(q.muK)}\\cdot ${n(N)}\\cdot ${n(s)} = ${Q(w.Wms, 'J')},\\qquad A_N = 0`,
    },
    {
      text: L(
        'Tổng công bằng độ tăng động năng (thùng bắt đầu đứng yên):',
        'The total work equals the gain in kinetic energy (the crate starts at rest):',
      ),
      tex: `\\sum A = ${Q(w.total, 'J')} = \\tfrac{1}{2} m v^2 \\Rightarrow v = ${Q(v, 'm/s')},\\quad t = ${Q(t, 's')}`,
    },
    {
      text: L('Công suất của lực kéo:', 'Power of the pull:'),
      tex: `\\bar{\\mathscr{P}} = \\frac{A_F}{t} =${Q(w.WF / t, 'W')},\\qquad \\mathscr{P} = F v \\cos\\beta = ${Q(q.F * Math.cos(q.beta) * v, 'W')}`,
    },
    {
      text: L(
        'Hiệu suất: phần công của lực kéo làm tăng cơ năng của thùng; phần còn lại thành nhiệt do ma sát.',
        'Efficiency: the share of the pull’s work that raises the crate’s mechanical energy; the rest becomes heat through friction.',
      ),
      tex: `H = \\frac{\\tfrac{1}{2} m v^2 + m g h}{A_F} = 1 - \\frac{|A_{ms}|}{A_F} = ${n(H * 100)}\\,\\%`,
    },
  ];
  const answers: Answer[] = [
    { id: 'WF', label: L('Công của lực kéo', 'Work of the pull'), value: w.WF, unit: 'J' },
    { id: 'WP', label: L('Công của trọng lực', 'Work of the weight'), value: w.WP, unit: 'J' },
    { id: 'Wms', label: L('Công của lực ma sát', 'Work of friction'), value: w.Wms, unit: 'J' },
    {
      id: 'v',
      label: L('Tốc độ cuối quãng đường', 'Speed at the end'),
      value: v,
      unit: 'm/s',
      check: Math.sqrt((2 * w.total) / q.m),
    },
    {
      id: 't',
      label: L('Thời gian kéo', 'Time of the pull'),
      value: t,
      unit: 's',
      ...(chk ? { check: chk.t } : {}),
    },
    {
      id: 'Pavg',
      label: L('Công suất trung bình của lực kéo', 'Average power of the pull'),
      value: w.WF / t,
      unit: 'W',
    },
    {
      id: 'H',
      label: L('Hiệu suất', 'Efficiency'),
      value: H,
      unit: '%',
      check: 1 - Math.abs(w.Wms) / w.WF,
    },
  ];
  return { answers, steps };
}

function card(): ScienceCardData {
  return {
    title: L('Công, công suất và hiệu suất', 'Work, power and efficiency'),
    model: L(
      'Thùng hàng được kéo từ trạng thái đứng yên lên mặt phẳng nghiêng (góc 0 là sàn ngang) bằng một lực không đổi hợp với mặt phẳng góc β; có ma sát trượt.',
      'A crate is pulled from rest up a slope (angle 0 is a level floor) by a constant force at β to the surface, against sliding friction.',
    ),
    equations: [
      {
        tex: 'A = F\\,s\\cos\\alpha',
        label: L('Công của một lực không đổi', 'Work of a constant force'),
      },
      {
        tex: '\\sum A = \\tfrac{1}{2} m v^2 - \\tfrac{1}{2} m v_0^2',
        label: L('Định lí động năng', 'Work–energy theorem'),
      },
      { tex: '\\mathscr{P} = \\dfrac{A}{t} = F v\\cos\\alpha', label: L('Công suất', 'Power') },
      {
        tex: 'H = \\dfrac{\\tfrac{1}{2} m v^2 + m g h}{A_F} = 1 - \\dfrac{|A_{ms}|}{A_F}',
        label: L(
          'Hiệu suất: công có ích chia công toàn phần',
          'Efficiency: useful work over total work',
        ),
      },
    ],
    assumptions: [
      L(
        'Lực kéo và hệ số ma sát không đổi; thùng coi như chất điểm.',
        'Constant pull and friction coefficient; the crate is a point.',
      ),
      L(
        'Công có ích là phần làm tăng cơ năng của thùng (động năng và thế năng); phần mất mát là nhiệt do ma sát.',
        'Useful work is what raises the crate’s mechanical energy (kinetic and potential); the loss is heat from friction.',
      ),
    ],
    validity: L(
      'Lực kéo đủ lớn để kéo thùng đi lên và không nhấc thùng khỏi mặt phẳng.',
      'The pull is large enough to move the crate up and does not lift it off the surface.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Chuyển động nhanh dần đều tính chính xác; tốc độ cuối kiểm lại bằng định lí động năng, thời gian bằng DOPRI5, hiệu suất bằng 1 − |A_ms|/A_F.',
      'Exact uniformly accelerated motion; the final speed is re-checked by the work–energy theorem, the time by DOPRI5, the efficiency by 1 − |A_ms|/A_F.',
    ),
    method: L(
      'Cùng động cơ chính xác với bài Mặt phẳng nghiêng (Δt = 1/240 s).',
      'The same exact engine as the inclined-plane lesson (Δt = 1/240 s).',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.halliday],
  };
}

export const workPower: PhysicsScene = {
  id: 'workPower',
  required: ['m', 'F', 'length'],
  engineId: 'phys.incline',
  title: L('Công, công suất và hiệu suất', 'Work, power and efficiency'),
  usesGravity: true,
  params: [
    {
      key: 'theta',
      label: L('Góc nghiêng của mặt phẳng', 'Slope angle'),
      symbol: '\\theta',
      kind: 'number',
      unit: 'deg',
      min: 0,
      max: 60,
      step: 1,
    },
    {
      key: 'm',
      label: L('Khối lượng thùng', 'Mass of the crate'),
      symbol: 'm',
      kind: 'number',
      dim: DIM.mass,
      unit: 'kg',
      min: 0.5,
      max: 50,
      step: 0.5,
    },
    {
      key: 'F',
      label: L('Lực kéo', 'Pulling force'),
      symbol: 'F',
      kind: 'number',
      dim: DIM.force,
      unit: 'N',
      min: 0,
      max: 500,
      step: 1,
    },
    {
      key: 'beta',
      label: L('Góc của lực kéo so với mặt phẳng', 'Angle of the pull to the surface'),
      symbol: '\\beta',
      kind: 'number',
      unit: 'deg',
      min: 0,
      max: 80,
      step: 1,
    },
    {
      key: 'mu',
      label: L('Hệ số ma sát trượt', 'Coefficient of sliding friction'),
      symbol: '\\mu',
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'length',
      label: L('Quãng đường kéo', 'Distance pulled'),
      symbol: 's',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 1,
      max: 50,
      step: 0.5,
    },
    gravityParam,
  ],
  defaults: { theta: Math.PI / 6, m: 10, F: 80, beta: 0, mu: 0.2, length: 5 },
  engineParams: (p) => {
    const q = pullInput(p);
    return { ...p, muS: q.muS, muK: q.muK, s0: 0, v0: 0, tEnd: climbs(q) ? climb(q).t : 2 };
  },
  validate: (p) => {
    const q = pullInput(p);
    if (forces(q).N <= 0)
      return [
        L(
          'Lực kéo nhấc thùng khỏi mặt phẳng: mô hình này không áp dụng.',
          'The pull lifts the crate off the surface: this model does not apply.',
        ),
      ];
    if (!climbs(q))
      return [
        L(
          'Lực kéo chưa đủ để kéo thùng đi lên: tăng lực kéo hoặc giảm ma sát, góc nghiêng.',
          'The pull is too small to move the crate up: increase it, or lower the friction or the slope.',
        ),
      ];
    return [];
  },
  scienceCard: card,
  solve,
  graphs,
  bodies: [crate],
  view: inclineView,
  draw,
};
