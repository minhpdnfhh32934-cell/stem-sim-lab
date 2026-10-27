import { describe, expect, it } from 'vitest';
import { buildDraft } from '@/ai/draft';
import { basicSplit } from '@/app/sim/basicParams';
import { measureSegment } from '@/app/sim/measure';
import { applyAutoDefaults } from '../autoDefaults';
import { Camera } from '../render/camera';
import { drawGrid } from '../render/draw';
import type { DrawOptions, ThemeColors } from '../types';
import { STRING_POINTS, fmtRatio, verticalScale } from './draw';
import { MAX_LOOPS, MODE, SW, StandingWaveEngine, standingInput } from './engine';
import { harmonicFrequency } from './model';
import { probeAmplitude, standingWave as sc } from './scenes';

const answers = (p: Record<string, number>) =>
  Object.fromEntries(sc.solve({ ...sc.defaults, ...p }, 'vi').answers.map((a) => [a.id, a]));
const messages = (p: Record<string, number>) =>
  (sc.validate?.({ ...sc.defaults, ...p }) ?? []).map((m) => m.vi);

describe('standing wave scene: solution', () => {
  it('defaults: f = 25 Hz, λ = 0,8 m, 4 nodes, 3 antinodes, 2A at the antinode probe', () => {
    const a = answers({});
    expect(a.frequency?.value).toBeCloseTo(25, 12);
    expect(a.wavelength?.value).toBeCloseTo(0.8, 12);
    expect(a.nodes?.value).toBe(4);
    expect(a.antinodes?.value).toBe(3);
    expect(a.node_spacing?.value).toBeCloseTo(0.4, 12);
    expect(a.antinode_amplitude?.value).toBeCloseTo(0.01, 12);
    expect(a.probe_amplitude?.value).toBeCloseTo(0.01, 12);
    expect(a.period?.value).toBeCloseTo(0.04, 12);
  });

  it('every mode agrees with its DOPRI5 lattice check', () => {
    for (const p of [
      {},
      { mode: MODE.speed, f: 50, n: 4 },
      { mode: MODE.harmonic, f: 25 },
      { vFrom: 1, tension: 8 },
      { mode: MODE.harmonic, vFrom: 1, tension: 2, muL: 0.005, f: 125 / 3 },
    ]) {
      for (const a of sc.solve({ ...sc.defaults, ...p }, 'en').answers)
        if (a.check !== undefined) expect(Math.abs(a.check / a.value - 1)).toBeLessThan(1e-8);
    }
    expect(answers({}).frequency?.check).toBeDefined();
    expect(answers({ mode: MODE.speed, f: 50, n: 4 }).speed?.check).toBeDefined();
    expect(answers({ mode: MODE.harmonic, f: 25 }).harmonic?.check).toBeDefined();
  });

  it('three modes describe the same string: L, v, n → f; L, f, n → v; L, f, v → n', () => {
    expect(answers({ mode: MODE.speed, f: 25, n: 3 }).speed?.value).toBeCloseTo(20, 12);
    expect(answers({ mode: MODE.harmonic, f: 25 }).harmonic?.value).toBe(3);
    // v = √(F/μ): F × 4 doubles v, hence f.
    expect(answers({ vFrom: 1, tension: 8 }).frequency?.value).toBeCloseTo(50, 12);
    expect(answers({ vFrom: 1, tension: 8 }).speed?.value).toBeCloseTo(40, 12);
  });

  it('a probe on a node has amplitude exactly 0', () => {
    expect(probeAmplitude(standingInput({ ...sc.defaults, xP: 0.4 }))).toBe(0);
    expect(answers({ xP: 1.2 }).probe_amplitude?.value).toBe(0);
  });
});

describe('standing wave scene: problems read by the AI', () => {
  const draft = (
    quantities: { key: string; value: number; unit: string; quote: string }[],
    text: string,
  ) =>
    buildDraft(
      sc,
      { quantities, questions: [], assumptions: [], unsupported_parts: [], clarifications: [] },
      text,
      9.81,
    );

  it('asks for what the chosen mode needs instead of using a default', () => {
    const L = { key: 'L', value: 60, unit: 'cm', quote: 'dài 60 cm' };
    expect(draft([L], 'Một dây đàn dài 60 cm.').missing.sort()).toEqual(['n', 'v']);
    const findN = { key: 'mode', value: MODE.harmonic, unit: '1', quote: 'bao nhiêu bó' };
    const fromF = { key: 'vFrom', value: 1, unit: '1', quote: 'lực căng' };
    expect(
      draft([findN, fromF, L], 'Dây dài 60 cm chịu lực căng. Có bao nhiêu bó?').missing.sort(),
    ).toEqual(['f', 'muL', 'tension']);
  });

  it('f, v and n are answers in every mode, so each can be marked as asked', () => {
    for (const mode of [MODE.frequency, MODE.speed, MODE.harmonic]) {
      const ids = sc.solve({ ...sc.defaults, mode }, 'vi').answers.map((a) => a.id);
      expect(ids.slice(0, 1)).toEqual([['frequency', 'speed', 'harmonic'][mode]]);
      expect(ids).toEqual(expect.arrayContaining(['frequency', 'speed', 'harmonic']));
    }
  });

  it('the mode follows what the problem states when the AI leaves it out', () => {
    const L = { key: 'L', value: 80, unit: 'cm', quote: 'dài 80 cm' };
    const f = { key: 'f', value: 100, unit: 'Hz', quote: 'tần số 100 Hz' };
    const n = { key: 'n', value: 4, unit: '1', quote: '4 bó sóng' };
    const text =
      'Dây dài 80 cm, tần số 100 Hz, có 4 bó sóng, căng bởi lực 3,2 N, mật độ dài 2 g/m.';
    const findV = draft([L, f, n], text);
    expect(findV.params.mode).toBe(MODE.speed);
    expect(findV.missing).toEqual([]);
    const F = { key: 'tension', value: 3.2, unit: 'N', quote: 'lực 3,2 N' };
    const mu = { key: 'muL', value: 2, unit: 'g/m', quote: 'mật độ dài 2 g/m' };
    const findN = draft([L, f, F, mu], text);
    expect(findN.params.mode).toBe(MODE.harmonic);
    expect(findN.params.vFrom).toBe(1);
    expect(findN.missing).toEqual([]);
    // A mode the AI stated is kept, and the probe follows that mode (n = 4: x_P = L/8).
    const ask = { key: 'mode', value: MODE.frequency, unit: '1', quote: 'Tính tần số' };
    const kept = draft([ask, L, f, n], `${text} Tính tần số.`);
    expect(kept.params.mode).toBe(MODE.frequency);
    expect(kept.params.xP).toBeCloseTo(0.1, 12);
    expect(kept.missing).toEqual(['v']);
  });

  it('a default probe moves to the first antinode, so a short string still runs', () => {
    const sources = Object.fromEntries(
      Object.keys(sc.defaults).map((k) => [k, 'default' as const]),
    );
    const p = applyAutoDefaults(sc, { ...sc.defaults, L: 0.18 }, { ...sources, L: 'problem' });
    expect(p.xP).toBeCloseTo(0.03, 12);
    expect(sc.validate?.(p)).toEqual([]);
    expect(
      applyAutoDefaults(sc, { ...sc.defaults, xP: 0.5 }, { ...sources, xP: 'problem' }).xP,
    ).toBe(0.5);
  });
});

describe('standing wave scene: trap 5 (2Lf/v is never rounded)', () => {
  it('a non-whole ratio is reported with the resonances below and above, f unchanged', () => {
    const p = { mode: MODE.harmonic, f: 30 };
    const msg = messages(p);
    expect(msg).toHaveLength(1);
    expect(msg[0]).toContain('3,6');
    expect(msg[0]).toContain('f₃ = 25 Hz');
    expect(msg[0]).toContain('f₄ = 33,33 Hz');
    const a = answers(p);
    expect(a.harmonic).toBeUndefined();
    expect(a.f_below?.value).toBeCloseTo(harmonicFrequency(3, 20, 1.2), 12);
    expect(a.f_above?.value).toBeCloseTo(harmonicFrequency(4, 20, 1.2), 12);
    expect(standingInput({ ...sc.defaults, ...p }).f).toBe(30);
  });

  it('below the fundamental only f₁ is suggested', () => {
    const msg = messages({ mode: MODE.harmonic, f: 5 });
    expect(msg[0]).toContain('f₁ = 8,333 Hz');
    expect(answers({ mode: MODE.harmonic, f: 5 }).f_below).toBeUndefined();
  });

  it('a ratio off by round-off only is accepted (L = 1,1 m, f = 50 Hz, v = 11 m/s → n = 10)', () => {
    const p = { mode: MODE.harmonic, L: 1.1, f: 50, v: 11, xP: 0.055 };
    const m = standingInput({ ...sc.defaults, ...p }).m;
    expect(m).not.toBe(10); // 10.000000000000002 in floating point
    expect(messages(p)).toEqual([]);
    expect(answers(p).harmonic?.value).toBe(10);
  });

  it('a non-whole ratio is never shown as a whole number', () => {
    // L = 5 m, v = 1,1 m/s, f = 200 Hz: m = 1818,18…; f = 25,000001 Hz: m = 3,00000012.
    const big = { mode: MODE.harmonic, L: 5, v: 1.1, f: 200, xP: 0.1 };
    expect(messages(big)[0]).toContain('2Lf/v = 1.818,2 ');
    const near = { mode: MODE.harmonic, f: 25.000001 };
    expect(messages(near)[0]).toContain('2Lf/v = 3,0000001 ');
    expect(
      sc
        .solve({ ...sc.defaults, ...near }, 'vi')
        .steps.some((s) => s.tex?.endsWith('= 3{,}0000001')),
    ).toBe(true);
    expect(fmtRatio('en', 3)).toBe('3');
  });

  it(`at most ${MAX_LOOPS} loops, given or computed; each one has its DOPRI5 check`, () => {
    expect(messages({ n: MAX_LOOPS + 1 })[0]).toContain(`tối đa ${MAX_LOOPS} bó`);
    // L = 1,2 m, v = 20 m/s, f = 200 Hz: m = 24 (whole).
    expect(messages({ mode: MODE.harmonic, f: 200 })[0]).toContain('n = 24 bó');
    for (let n = 1; n <= MAX_LOOPS; n++) {
      const f = answers({ n }).frequency;
      expect(f?.check, `n = ${n}`).toBeDefined();
      expect(Math.abs((f?.check ?? 0) / (f?.value ?? 1) - 1), `n = ${n}`).toBeLessThan(1e-8);
    }
  });

  it('an infinite frequency (L = 0) is reported without breaking the engine', () => {
    expect(messages({ L: 0 }).length).toBeGreaterThan(0);
    const e = new StandingWaveEngine();
    e.reset({ ...sc.defaults, L: 0 });
    expect(e.dt).toBeGreaterThan(0);
  });

  it('an unknown mode (old file) reads as "find f" everywhere', () => {
    expect(standingInput({ ...sc.defaults, mode: 7 }).mode).toBe(MODE.frequency);
    expect(sc.params.find((d) => d.key === 'f')?.when?.({ ...sc.defaults, mode: 7 })).toBe(false);
  });

  it('"Dùng fₙ" buttons set a suggested resonance exactly (L = 1,2 m, v = 20 m/s)', () => {
    // f = 26 Hz: 2Lf/v = 3,12 → f₃, f₄; 190 Hz: 22,8 > 20 loops → f₂₀; 5 Hz: below f₁.
    for (const [f, names, ns] of [
      [26, ['Dùng f₃', 'Dùng f₄'], [3, 4]],
      [190, ['Dùng f₂₀'], [20]],
      [5, ['Dùng f₁'], [1]],
    ] as const) {
      const p = { ...sc.defaults, mode: MODE.harmonic, f };
      const fixes = sc.fixes?.(p) ?? [];
      expect(fixes.map((x) => x.label.vi.split(' =')[0])).toEqual(names);
      ns.forEach((n, i) => {
        const applied = { ...p, ...fixes[i]?.params };
        expect(standingInput(applied).n, `${f} Hz → n = ${n}`).toBe(n);
        expect(sc.validate?.(applied), `${f} Hz → n = ${n}`).toEqual([]);
      });
    }
    expect(sc.fixes?.(sc.defaults)).toEqual([]);
    expect(sc.fixes?.({ ...sc.defaults, mode: MODE.harmonic, f: 26, L: 0 })).toEqual([]);
    expect(messages({ mode: MODE.harmonic, f: 190 })[0]).not.toContain('f₂₂');
    expect(messages({ mode: MODE.harmonic, f: 26 })[0]).toContain('Dùng fₙ');
  });

  it('"Dùng fₙ" never sets f outside its slider (1–200 Hz); the text says why', () => {
    const range = sc.params.find((d) => d.key === 'f');
    // L = 0,4 m, v = 100 m/s: fₙ = 125n Hz, so f = 150 Hz sits between f₁ = 125 and f₂ = 250.
    const both = { ...sc.defaults, mode: MODE.harmonic, L: 0.4, v: 100, f: 150 };
    const fixes = sc.fixes?.(both) ?? [];
    expect(fixes.map((x) => x.params.f)).toEqual([125]);
    for (const x of fixes) {
      expect(x.params.f).toBeGreaterThanOrEqual(range?.min ?? NaN);
      expect(x.params.f).toBeLessThanOrEqual(range?.max ?? NaN);
    }
    const text = (sc.validate?.(both) ?? [])[0];
    expect(text?.vi).toContain('f₂ = 250 Hz nằm ngoài thanh trượt f (1–200 Hz)');
    expect(text?.en).toContain('f₂ = 250 Hz is outside the f slider (1–200 Hz)');
    expect(text?.vi).toContain('Dùng fₙ');
    // L = 0,1 m, v = 100 m/s: f₁ = 500 Hz, no button at all, so the text does not offer one.
    const none = { ...sc.defaults, mode: MODE.harmonic, L: 0.1, v: 100, f: 150 };
    expect(sc.fixes?.(none)).toEqual([]);
    const only = (sc.validate?.(none) ?? [])[0];
    expect(only?.vi).toContain('f₁ = 500 Hz nằm ngoài thanh trượt');
    expect(only?.vi).not.toContain('Dùng fₙ');
    expect(only?.en).not.toContain('Use fₙ');
  });

  it('a resonance at exactly 200 Hz (with round-off) keeps its button and is set on the slider', () => {
    // f₁₀ = 10·22,8/(2·0,57) = 200.00000000000003 Hz in floating point.
    const p = { ...sc.defaults, mode: MODE.harmonic, L: 0.57, v: 22.8, f: 190 };
    expect(harmonicFrequency(10, 22.8, 0.57)).toBeGreaterThan(200);
    const fixes = sc.fixes?.(p) ?? [];
    expect(fixes.map((x) => x.label.vi.split(' =')[0])).toEqual(['Dùng f₉', 'Dùng f₁₀']);
    expect(fixes[1]?.params.f).toBe(200);
    const applied = { ...p, ...fixes[1]?.params };
    expect(standingInput(applied).n).toBe(10);
    expect(sc.validate?.(applied)).toEqual([]);
    expect((sc.validate?.(p) ?? [])[0]?.vi).not.toContain('nằm ngoài thanh trượt');
  });

  it('two resonances outside the slider are named together ("for them")', () => {
    // f = 300 Hz (a problem may give it): L = 0,1 m, v = 25 m/s → f₂ = 250 Hz, f₃ = 375 Hz.
    const p = { ...sc.defaults, mode: MODE.harmonic, L: 0.1, v: 25, f: 300 };
    expect(sc.fixes?.(p)).toEqual([]);
    const en = (sc.validate?.(p) ?? [])[0]?.en;
    expect(en).toContain('f₂ = 250 Hz and f₃ = 375 Hz are outside the f slider');
    expect(en).toContain('no button for them');
  });

  it('other invalid inputs are reported', () => {
    expect(messages({})).toEqual([]);
    expect(messages({ n: 2.5 })[0]).toContain('số nguyên dương');
    expect(messages({ xP: 1.5 })[0]).toContain('x_P');
    expect(messages({ L: 0 }).length).toBeGreaterThan(0);
    expect(messages({ vFrom: 1, muL: 0 }).length).toBeGreaterThan(0);
  });
});

describe('standing wave scene: card, picture', () => {
  it('Science Card: exact, all parts present, sources, no Vietnamese inside \\text{}', () => {
    const card = sc.scienceCard(sc.defaults);
    expect(card.confidence).toBe('exact');
    expect(card.equations.length).toBeGreaterThanOrEqual(4);
    expect(card.assumptions.length).toBeGreaterThanOrEqual(5);
    expect(card.sources.length).toBeGreaterThanOrEqual(2);
    expect(card.validity?.vi.length).toBeGreaterThan(0);
    const noVi = /\\text\{[^}]*[^\x20-\x7e}]/;
    for (const e of card.equations) expect(e.tex).not.toMatch(noVi);
    for (const p of [{}, { vFrom: 1 }, { mode: MODE.speed }, { mode: MODE.harmonic, f: 30 }])
      for (const s of sc.solve({ ...sc.defaults, ...p }, 'vi').steps)
        expect(s.tex ?? '').not.toMatch(noVi);
    expect(card.assumptions.some((a) => a.vi.includes('2A'))).toBe(true);
  });

  it('a large amplitude (slope 2A·k > 0,1) leaves the exact range: card approx, solution note', () => {
    // A = 1 cm, k = 3π/1,2 m⁻¹: 2A·k ≈ 0,157.
    expect(sc.scienceCard({ ...sc.defaults, A: 0.01 }).confidence).toBe('approx');
    expect(sc.solve({ ...sc.defaults, A: 0.01 }, 'vi').notes?.length).toBe(1);
    expect(sc.solve(sc.defaults, 'vi').notes).toBeUndefined();
  });

  it('the view leaves room for a large amplitude', () => {
    const b = sc.view({ ...sc.defaults, L: 0.5, A: 0.1 });
    expect(b.yMax).toBeGreaterThanOrEqual(1.3 * 2 * 0.1);
    expect(b.yMin).toBeLessThanOrEqual(-1.3 * 2 * 0.1);
  });

  it('grid, ruler and protractor read real metres on the stretched picture', () => {
    const S = sc.yStretch?.(sc.defaults) ?? 1;
    expect(S).toBe(verticalScale(standingInput(sc.defaults)));
    expect(S).toBe(10);
    // From the string's rest line up to the drawn top of the first antinode: 2A = 1 cm.
    const top = { x: 0.2, y: 2 * (sc.defaults.A ?? 0) * S };
    expect(measureSegment({ x: 0.2, y: 0 }, top, S).length).toBeCloseTo(0.01, 12);
    // The drawn string at the first node (x = λ/2 = 0,4 m) from the antinode top: real slope.
    expect(measureSegment(top, { x: 0.4, y: 0 }, S).angle).toBeCloseTo(-Math.atan(0.01 / 0.2), 12);
  });

  it('grid y labels show unstretched metres for every stretch and zoom (x labels unchanged)', () => {
    const labels = (stretch: number, zoom: number) => {
      const out: { align: string; text: string }[] = [];
      let align = '';
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) =>
            k === 'fillText' ? (s: string) => out.push({ align, text: s }) : () => undefined,
          set: (_t, k, v) => {
            if (k === 'textAlign') align = String(v);
            return true;
          },
        },
      ) as CanvasRenderingContext2D;
      const cam = new Camera();
      cam.fit(sc.view({ ...sc.defaults, L: 0.3 }));
      cam.zoomAt(cam.width / 2, cam.height / 2, zoom);
      const colors = new Proxy({}, { get: () => '#000' }) as ThemeColors;
      drawGrid(ctx, cam, colors, 'en', stretch);
      const num = (s: string) => Number(s.replace(/,/g, ''));
      return {
        x: out.filter((l) => l.align === 'center').map((l) => num(l.text)),
        y: out.filter((l) => l.align === 'left').map((l) => num(l.text)),
      };
    };
    // S = 2·10ᵏ makes a 2,5·10ⁿ step (L = 0,3 m, A = 5 mm gives S = 2: −0,025, not −0,03).
    for (const S of [2, 5, 10, 20, 50, 200])
      for (const zoom of [0.4, 1, 2.5, 7]) {
        const plain = labels(1, zoom);
        const real = labels(S, zoom);
        expect(real.x).toEqual(plain.x);
        expect(real.y.length).toBeGreaterThan(1);
        real.y.forEach((v, i) => {
          expect(v, `S = ${S}, zoom ${zoom}`).toBeCloseTo((plain.y[i] ?? NaN) / S, 12);
        });
      }
    expect(verticalScale(standingInput({ ...sc.defaults, L: 0.3, A: 0.005 }))).toBe(2);
  });

  it('Basic mode shows the choice first, then the main quantities of each mode', () => {
    const keys = (p: Record<string, number>) =>
      basicSplit(
        sc.params.filter((d) => !d.when || d.when({ ...sc.defaults, ...p })),
        {},
      ).main.map((d) => d.key);
    expect(keys({})).toEqual(['mode', 'L', 'n', 'v', 'A']);
    expect(keys({ mode: MODE.speed })).toEqual(['mode', 'L', 'n', 'f', 'A']);
    expect(keys({ mode: MODE.harmonic })).toEqual(['mode', 'L', 'f', 'v', 'A']);
    expect(keys({ vFrom: 1 })).toEqual(['mode', 'L', 'n', 'tension', 'muL']);
  });

  it('nothing is draggable', () => {
    for (const b of sc.bodies) expect(b.draggable).toBe(false);
  });

  it('draws the string with ≥ 200 points, stretched vertically by a nice factor', () => {
    expect(STRING_POINTS).toBeGreaterThanOrEqual(200);
    expect(verticalScale(standingInput(sc.defaults))).toBe(10);
    expect(verticalScale(standingInput({ ...sc.defaults, A: 0.1 }))).toBe(1);
    let lineTo = 0;
    const texts: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, k) =>
          k === 'lineTo'
            ? () => lineTo++
            : k === 'fillText'
              ? (s: string) => texts.push(s)
              : () => undefined,
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    const cam = new Camera();
    cam.fit(sc.view(sc.defaults));
    const state = new Float64Array(4);
    state[SW.phi] = Math.PI / 2;
    const colors = new Proxy({}, { get: () => '#000' }) as ThemeColors;
    const opts: DrawOptions = {
      vectors: false,
      intervened: false,
      trail: false,
      selected: null,
      locale: 'vi',
      colors,
      time: 0,
    };
    sc.draw({ ctx, cam, state, p: sc.defaults, opts });
    expect(lineTo).toBeGreaterThanOrEqual(4 * (STRING_POINTS - 1));
    expect(texts.filter((s) => s === 'N')).toHaveLength(4);
    expect(texts.filter((s) => s === 'B')).toHaveLength(3);
    expect(texts.some((s) => s.includes('×10'))).toBe(true);
  });
});
