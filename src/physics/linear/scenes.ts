import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, block, ground, line, text, vectorScale } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { distance, meetingTime, stateAt, stopTime, type Motion1D } from './analytic';

const motions = (p: Params, accel: boolean): Motion1D[] => {
  const stop = accel && (p.stopAtRest ?? 1) > 0.5;
  const list: Motion1D[] = [
    { x0: p.xA ?? 0, v0: p.vA ?? 0, a: accel ? (p.aA ?? 0) : 0, stopAtRest: stop },
  ];
  if ((p.twoBodies ?? 0) > 0.5) {
    list.push({ x0: p.xB ?? 0, v0: p.vB ?? 0, a: accel ? (p.aB ?? 0) : 0, stopAtRest: stop });
  }
  return list;
};

function extent(p: Params, accel: boolean) {
  const tEnd = p.tEnd ?? 10;
  let min = Infinity;
  let max = -Infinity;
  for (const m of motions(p, accel)) {
    for (let i = 0; i <= 60; i++) {
      const x = stateAt(m, (tEnd * i) / 60).x;
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  const w = Math.max(max - min, 10);
  return { min, max, w };
}

const laneY = (k: number, w: number) => 0.012 * w + k * 0.045 * w;

function view(accel: boolean) {
  return (p: Params): WorldBounds => {
    const { min, max, w } = extent(p, accel);
    return { xMin: min - 0.08 * w, xMax: max + 0.08 * w, yMin: -0.12 * w, yMax: 0.2 * w };
  };
}

function bodies(accel: boolean): BodyDef[] {
  return (['A', 'B'] as const).map((name, k) => ({
    id: `car${name}`,
    label: L(`Vật ${name}`, `Body ${name}`),
    position: (s, p) => ({ x: s[3 * k] ?? 0, y: laneY(k, extent(p, accel).w) }),
    radius: (p) => 0.02 * extent(p, accel).w,
    draggable: true,
    properties: (s) => [
      { label: L('Tọa độ', 'Position'), symbol: 'x', value: s[3 * k] ?? 0, unit: 'm' },
      { label: L('Vận tốc', 'Velocity'), symbol: 'v', value: s[3 * k + 1] ?? 0, unit: 'm/s' },
      { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: s[3 * k + 2] ?? 0, unit: 'm/s^2' },
    ],
  }));
}

function draw(accel: boolean) {
  return ({ ctx, cam, state, p, opts }: DrawContext) => {
    const c = opts.colors;
    const { w } = extent(p, accel);
    const ms = motions(p, accel);
    ground(ctx, cam, 0, c);
    const vis = cam.visible();
    if (ms.length > 1)
      line(
        ctx,
        cam,
        vis.xMin,
        laneY(1, w) - 0.022 * w,
        vis.xMax,
        laneY(1, w) - 0.022 * w,
        c.faint,
        1,
        [8, 6],
      );
    // Meeting point predicted by the closed form (only before any intervention).
    const [a, b] = ms;
    if (a && b && !opts.intervened) {
      const tm = meetingTime(a, b, p.tEnd ?? 10);
      if (tm !== null) {
        const xm = stateAt(a, tm).x;
        line(ctx, cam, xm, -0.02 * w, xm, laneY(1, w) + 0.04 * w, c.accent, 1.2, [3, 4]);
        text(
          ctx,
          cam,
          xm,
          laneY(1, w) + 0.04 * w,
          `${opts.locale === 'vi' ? 'Gặp nhau' : 'Meet'}: x = ${fmtQty(opts.locale, xm, 'm')}`,
          c.accent,
          'center',
          { x: 0, y: -4 },
        );
      }
    }
    const vmax = Math.max(1, ...ms.map((m) => Math.abs(m.v0) + Math.abs(m.a) * (p.tEnd ?? 10)));
    ms.forEach((m, k) => {
      const x = state[3 * k] ?? 0;
      const v = state[3 * k + 1] ?? 0;
      const acc = state[3 * k + 2] ?? 0;
      const y = laneY(k, w);
      line(ctx, cam, m.x0, -0.01 * w, m.x0, 0.01 * w, c.muted, 1.5);
      text(ctx, cam, m.x0, -0.01 * w, `x₀${k ? 'B' : 'A'}`, c.muted, 'center', { x: 0, y: 16 });
      const name = k ? 'B' : 'A';
      block(
        ctx,
        cam,
        x,
        y,
        0.04 * w,
        0.02 * w,
        0,
        opts.selected === `car${name}` ? c.accent : k ? c.bodyAlt : c.body,
        c.text,
        name,
      );
      if (opts.vectors) {
        const kv = vectorScale(vmax, w, 0.15);
        arrow(ctx, cam, x, y + 0.016 * w, v * kv, 0, c.velocity, 'v');
        if (accel && acc !== 0) {
          const ka = vectorScale(Math.max(...ms.map((mm) => Math.abs(mm.a)), 0.1), w, 0.08);
          arrow(ctx, cam, x, y - 0.016 * w, acc * ka, 0, c.acceleration, 'a');
        }
      }
    });
  };
}

function graphs(): GraphDef[] {
  const series = (idx: 0 | 1 | 2, sym: string) =>
    (['A', 'B'] as const).map((n, k) => ({
      id: `${sym}${n}`,
      label: L(`${sym} (${n})`, `${sym} (${n})`),
      value: (s: Float64Array) => s[3 * k + idx] ?? 0,
    }));
  return [
    {
      id: 'position',
      title: L('Đồ thị tọa độ – thời gian', 'Position – time'),
      yLabel: L('x (m)', 'x (m)'),
      series: series(0, 'x'),
    },
    {
      id: 'velocity',
      title: L('Đồ thị vận tốc – thời gian', 'Velocity – time'),
      yLabel: L('v (m/s)', 'v (m/s)'),
      series: series(1, 'v'),
    },
    {
      id: 'acceleration',
      title: L('Đồ thị gia tốc – thời gian', 'Acceleration – time'),
      yLabel: L('a (m/s²)', 'a (m/s²)'),
      series: series(2, 'a'),
    },
  ];
}

/** Independent check of x(t_end) by integrating x″ = a with Dormand–Prince. */
export function numericPosition(m: Motion1D, tEnd: number): number {
  const ts = stopTime(m);
  const t1 = Math.min(tEnd, ts);
  if (t1 <= 0) return m.x0;
  const r = dopri5(
    (_t, s, d) => {
      d[0] = s[1] ?? 0;
      d[1] = m.a;
    },
    [m.x0, m.v0],
    0,
    t1,
    { rtol: 1e-12, atol: 1e-12 },
  );
  return r.y[0] ?? 0;
}

function solve(accel: boolean) {
  return (p: Params, locale: Locale): Solution => {
    const n = (v: number) => texNum(locale, v);
    const q = (v: number, u: string) => texQty(locale, v, u);
    const tEnd = p.tEnd ?? 10;
    const ms = motions(p, accel);
    const steps: SolutionStep[] = [
      {
        text: L(
          'Chọn trục Ox trùng với đường thẳng chuyển động, chiều dương theo chiều trục, gốc thời gian lúc bắt đầu xét.',
          'Take the x axis along the line of motion, positive to the right, t = 0 at the start.',
        ),
      },
    ];
    const answers: Answer[] = [];
    ms.forEach((m, k) => {
      const name = k ? 'B' : 'A';
      steps.push({
        text: L(`Phương trình chuyển động của vật ${name}:`, `Equation of motion of body ${name}:`),
        tex: accel
          ? `x_${name} = ${n(m.x0)} + ${n(m.v0)}\\,t + \\tfrac{1}{2}\\cdot(${n(m.a)})\\,t^2,\\quad v_${name} = ${n(m.v0)} + (${n(m.a)})\\,t`
          : `x_${name} = x_{0${name}} + v_${name}\\, t = ${n(m.x0)} + (${n(m.v0)})\\,t`,
      });
      const ts = stopTime(m);
      if (Number.isFinite(ts)) {
        steps.push({
          text: L(
            `Vật ${name} chuyển động chậm dần và dừng lại khi v = 0:`,
            `Body ${name} decelerates and stops when v = 0:`,
          ),
          tex: `t_{d} = -\\frac{v_0}{a} = -\\frac{${n(m.v0)}}{${n(m.a)}} = ${q(ts, 's')},\\qquad s_{d} = \\frac{v_0^2}{2|a|} = ${q((m.v0 * m.v0) / (2 * Math.abs(m.a)), 'm')}`,
        });
        answers.push({
          id: `stop_time_${name}`,
          label: L(`Thời gian đến khi ${name} dừng`, `Time until ${name} stops`),
          value: ts,
          unit: 's',
        });
        answers.push({
          id: `stop_distance_${name}`,
          label: L(`Quãng đường đến khi ${name} dừng`, `Stopping distance of ${name}`),
          value: (m.v0 * m.v0) / (2 * Math.abs(m.a)),
          unit: 'm',
        });
      }
      const st = stateAt(m, tEnd);
      answers.push({
        id: `x_end_${name}`,
        label: L(`Tọa độ của ${name} tại t = ${tEnd} s`, `Position of ${name} at t = ${tEnd} s`),
        value: st.x,
        unit: 'm',
        check: numericPosition(m, tEnd),
      });
      if (accel) {
        answers.push({
          id: `v_end_${name}`,
          label: L(`Vận tốc của ${name} tại t = ${tEnd} s`, `Velocity of ${name} at t = ${tEnd} s`),
          value: st.v,
          unit: 'm/s',
        });
      }
      answers.push({
        id: `distance_${name}`,
        label: L(
          `Quãng đường ${name} đi được sau ${tEnd} s`,
          `Distance travelled by ${name} in ${tEnd} s`,
        ),
        value: distance(m, tEnd),
        unit: 'm',
      });
    });
    const [a, b] = ms;
    if (a && b) {
      const tm = meetingTime(a, b, tEnd);
      if (tm !== null) {
        const xm = stateAt(a, tm).x;
        const simple = !Number.isFinite(stopTime(a)) && !Number.isFinite(stopTime(b));
        steps.push({
          text: L('Hai vật gặp nhau khi x_A = x_B:', 'The bodies meet when x_A = x_B:'),
          tex:
            !accel && simple
              ? `t = \\frac{x_{0B} - x_{0A}}{v_A - v_B} = \\frac{${n(b.x0)} - (${n(a.x0)})}{${n(a.v0)} - (${n(b.v0)})} = ${q(tm, 's')},\\quad x = ${q(xm, 'm')}`
              : `t = ${q(tm, 's')},\\quad x = ${q(xm, 'm')}`,
        });
        answers.unshift(
          { id: 'meet_time', label: L('Thời điểm gặp nhau', 'Meeting time'), value: tm, unit: 's' },
          {
            id: 'meet_position',
            label: L('Vị trí gặp nhau', 'Meeting position'),
            value: xm,
            unit: 'm',
          },
        );
      } else {
        steps.push({
          text: L(
            `Hai vật không gặp nhau trong ${tEnd} s đầu.`,
            `The bodies do not meet within the first ${tEnd} s.`,
          ),
        });
      }
    }
    return { answers, steps };
  };
}

function card(accel: boolean) {
  return (p: Params): ScienceCardData => ({
    title: accel
      ? L('Chuyển động thẳng biến đổi đều', 'Uniformly accelerated motion')
      : L('Chuyển động thẳng đều', 'Uniform linear motion'),
    model: L(
      'Chất điểm chuyển động trên đường thẳng với gia tốc không đổi.',
      'Point mass on a straight line with constant acceleration.',
    ),
    equations: accel
      ? [
          { tex: 'x = x_0 + v_0 t + \\tfrac{1}{2} a t^2' },
          { tex: 'v = v_0 + a t' },
          { tex: 'v^2 - v_0^2 = 2 a (x - x_0)' },
        ]
      : [{ tex: 'x = x_0 + v t' }, { tex: 's = |v|\\, t' }],
    assumptions: [
      L('Vật được coi là chất điểm.', 'Bodies are point masses.'),
      accel
        ? L('Gia tốc không đổi trong suốt quá trình.', 'Acceleration is constant throughout.')
        : L('Vận tốc không đổi.', 'Velocity is constant.'),
      ...(accel && (p.stopAtRest ?? 1) > 0.5
        ? [
            L(
              'Khi hãm phanh, vật dừng hẳn lúc v = 0 (không chạy lùi).',
              'When braking, a body stops at v = 0 (it does not reverse).',
            ),
          ]
        : []),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Engine cập nhật chính xác cho gia tốc không đổi; tọa độ cuối được kiểm chứng bằng tích phân Dormand–Prince.',
      'Exact constant-acceleration update; final positions cross-checked with Dormand–Prince integration.',
    ),
    method: L(
      'Cập nhật chính xác, Δt = 1/240 s; thời điểm dừng được xác định đúng trong bước.',
      'Exact update, Δt = 1/240 s; stop instant located exactly within the step.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10, SRC.halliday],
  });
}

const pos = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Tọa độ ban đầu của ${name}`, `Initial position of ${name}`),
  symbol: sym,
  kind: 'number',
  dim: DIM.length,
  unit: 'm',
  min: -500,
  max: 500,
  step: 1,
});
const vel = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Vận tốc ban đầu của ${name}`, `Initial velocity of ${name}`),
  symbol: sym,
  kind: 'number',
  dim: DIM.velocity,
  unit: 'm/s',
  min: -40,
  max: 40,
  step: 0.1,
});
const acc = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Gia tốc của ${name}`, `Acceleration of ${name}`),
  symbol: sym,
  kind: 'number',
  dim: DIM.acceleration,
  unit: 'm/s^2',
  min: -10,
  max: 10,
  step: 0.1,
});
const two = (p: Params) => (p.twoBodies ?? 0) > 0.5;
const twoBodies: ParamDef = {
  key: 'twoBodies',
  label: L('Số vật', 'Number of bodies'),
  symbol: 'N',
  kind: 'choice',
  choices: [
    { value: 0, label: L('1 vật', '1 body') },
    { value: 1, label: L('2 vật', '2 bodies') },
  ],
};
/**
 * Time span long enough to show the key event (meeting, stopping) with some margin,
 * rounded to a friendly number.
 */
export function autoTimeSpan(p: Params, accel: boolean): number {
  const ms = motions(p, accel);
  const events: number[] = ms.map((m) => stopTime(m)).filter((t) => Number.isFinite(t));
  const [a, b] = ms;
  if (a && b) {
    const tm = meetingTime(a, b, 1e6);
    if (tm !== null) events.push(tm);
  }
  const t = events.length ? Math.max(...events) * 1.25 : 10;
  const nice = [
    10, 12, 15, 20, 30, 40, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600, 5400, 7200, 10800,
    14400, 21600, 36000,
  ];
  return nice.find((n) => n >= t) ?? 36000;
}

/** Playback speed so that the run lasts roughly 5–15 s of real time. */
export function autoSpeed(tEnd: number): number {
  const options = [1, 2, 4, 10, 100, 1000];
  return options.find((s) => tEnd / s <= 15) ?? 1000;
}

const tEnd: ParamDef = {
  key: 'tEnd',
  label: L('Thời gian xét', 'Time span'),
  symbol: 't_{\\max}',
  kind: 'number',
  dim: DIM.time,
  unit: 's',
  min: 1,
  max: 36000,
  step: 1,
};

const common = (accel: boolean) => ({
  engineId: 'phys.linear',
  usesGravity: false,
  graphs: graphs(),
  bodies: bodies(accel),
  view: view(accel),
  draw: draw(accel),
  scienceCard: card(accel),
  solve: solve(accel),
  engineParams: (p: Params): Params => (accel ? p : { ...p, aA: 0, aB: 0, stopAtRest: 0 }),
  autoDefaults: (p: Params, src: Record<string, 'problem' | 'default' | 'user'>): Params =>
    src.tEnd === 'default' ? { ...p, tEnd: autoTimeSpan(p, accel) } : p,
  suggestedSpeed: (p: Params) => autoSpeed(p.tEnd ?? 10),
});

export const uniformMotion: PhysicsScene = {
  ...common(false),
  id: 'uniformMotion',
  required: ['vA', 'xB', 'vB'],
  title: L('Chuyển động thẳng đều', 'Uniform linear motion'),
  params: [
    twoBodies,
    pos('xA', 'x_{0A}', 'A'),
    vel('vA', 'v_A', 'A'),
    { ...pos('xB', 'x_{0B}', 'B'), when: two },
    { ...vel('vB', 'v_B', 'B'), when: two },
    tEnd,
  ],
  // Classic textbook set-up: two cars 100 m apart driving toward each other.
  defaults: { twoBodies: 1, xA: 0, vA: 10, xB: 100, vB: -15, tEnd: 8 },
};

export const uniformAcceleration: PhysicsScene = {
  ...common(true),
  id: 'uniformAcceleration',
  required: ['vA', 'aA'],
  title: L('Chuyển động thẳng biến đổi đều', 'Uniformly accelerated motion'),
  params: [
    twoBodies,
    pos('xA', 'x_{0A}', 'A'),
    vel('vA', 'v_{0A}', 'A'),
    acc('aA', 'a_A', 'A'),
    { ...pos('xB', 'x_{0B}', 'B'), when: two },
    { ...vel('vB', 'v_{0B}', 'B'), when: two },
    { ...acc('aB', 'a_B', 'B'), when: two },
    {
      key: 'stopAtRest',
      label: L('Hãm phanh: dừng hẳn khi v = 0', 'Braking: stop for good at v = 0'),
      symbol: '',
      kind: 'toggle',
    },
    tEnd,
  ],
  // A car braking from 20 m/s at −2 m/s² stops after 10 s and 100 m.
  defaults: { twoBodies: 0, xA: 0, vA: 20, aA: -2, xB: 50, vB: 5, aB: 0, stopAtRest: 1, tEnd: 12 },
};
