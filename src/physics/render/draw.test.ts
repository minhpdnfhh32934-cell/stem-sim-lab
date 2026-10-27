import { describe, expect, it } from 'vitest';
import { electricField } from '../field/scenes';
import { standingWave } from '../wave/scenes';
import { freeFall, horizontalProjectile } from '../projectile/scenes';
import { uniformMotion } from '../linear/scenes';
import { energyConservation } from '../track/scenes';
import type { DrawOptions, PhysicsScene, ThemeColors } from '../types';
import { Camera } from './camera';
import { arrow, drawGrid, labelRuns, text } from './draw';

interface Call {
  op: 'fillText' | 'strokeText' | 'fill';
  text: string;
  x: number;
  y: number;
  font: string;
  stroke: string;
}

/** A canvas context that records text and fills (font, alignment and colours as set). */
function recorder() {
  const calls: Call[] = [];
  const dashes: { stroke: string; dash: number[] }[] = [];
  const state: Record<string, string> = {
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    strokeStyle: '',
  };
  const saved: Record<string, string>[] = [];
  const at = (op: Call['op']) => (s: string, x: number, y: number) =>
    calls.push({ op, text: s, x, y, font: state.font ?? '', stroke: state.strokeStyle ?? '' });
  const ctx = new Proxy(
    {},
    {
      get: (_t, k: string) => {
        if (k === 'fillText') return at('fillText');
        if (k === 'strokeText') return at('strokeText');
        if (k === 'fill') return () => calls.push({ ...calls.at(-1), op: 'fill' } as Call);
        if (k === 'setLineDash')
          return (d: number[]) => dashes.push({ stroke: state.strokeStyle ?? '', dash: [...d] });
        if (k === 'measureText') return (s: string) => ({ width: 7 * s.length });
        if (k === 'save') return () => saved.push({ ...state });
        if (k === 'restore') return () => Object.assign(state, saved.pop());
        if (k in state) return state[k];
        return () => undefined;
      },
      set: (_t, k: string, v) => {
        state[k] = String(v);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  return { ctx, calls, dashes, fills: () => calls.filter((c) => c.op === 'fillText') };
}

const colors = new Proxy({}, { get: (_t, k) => `#${String(k)}` }) as ThemeColors;
const opts = (vectors = true): DrawOptions => ({
  vectors,
  intervened: false,
  trail: false,
  selected: null,
  locale: 'vi',
  colors,
  time: 0,
});

/** Draws a scene's first frame (grid first, as StageCanvas does) and returns the recording. */
function frame(scene: PhysicsScene, state = new Float64Array(16)) {
  const r = recorder();
  const cam = new Camera();
  const p = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
  cam.fit(scene.view(p));
  drawGrid(r.ctx, cam, colors, 'vi');
  scene.draw({ ctx: r.ctx, cam, state, p, opts: opts() });
  return { ...r, cam, p };
}

describe('stage labels (UI-03)', () => {
  it('"a_ht, F_ht" is drawn with smaller, lowered subscripts', () => {
    expect(labelRuns('a_ht, F_ht')).toEqual([
      { text: 'a', sub: false },
      { text: 'ht', sub: true },
      { text: ', F', sub: false },
      { text: 'ht', sub: true },
    ]);
    expect(labelRuns('W_đ = 9,5 J')).toEqual([
      { text: 'W', sub: false },
      { text: 'đ', sub: true },
      { text: ' = 9,5 J', sub: false },
    ]);
    const r = recorder();
    const cam = new Camera();
    drawGrid(r.ctx, cam, colors, 'vi');
    r.calls.length = 0;
    text(r.ctx, cam, 0, 0, 'F_ms', '#f00');
    const [F, ms] = r.fills();
    expect(F?.text).toBe('F');
    expect(ms?.text).toBe('ms');
    expect(ms?.font).toBe('9px system-ui, "Segoe UI", sans-serif');
    expect(ms?.y ?? 0).toBeGreaterThan(F?.y ?? 0);
    expect(ms?.x).toBe((F?.x ?? 0) + 7);
  });

  it('every label gets a halo of the stage colour drawn under it', () => {
    const r = recorder();
    const cam = new Camera();
    drawGrid(r.ctx, cam, colors, 'vi');
    r.calls.length = 0;
    text(r.ctx, cam, 0, 0, 'Fms', '#f00');
    expect(r.calls.map((c) => c.op)).toEqual(['strokeText', 'fillText']);
    // The stage background (--bg-stage), not the panel colour: no lighter rim in dark mode.
    expect(r.calls[0]?.stroke).toBe('#stage');
  });

  it('an arrow writes its name past the tip, on the side it points to', () => {
    const cam = new Camera();
    cam.fit({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
    for (const [dx, dy] of [
      [5, 0],
      [-5, 0],
      [0, 5],
      [0, -5],
      [-4, -4],
    ] as const) {
      const r = recorder();
      arrow(r.ctx, cam, 0, 0, dx, dy, '#000', 'v');
      const tip = cam.toScreen(dx, dy);
      const v = r.fills().find((c) => c.text === 'v');
      if (!v) throw new Error('no label');
      // The label's box (7 px wide, 13 px tall around its anchor) lies beyond the tip.
      const cx = v.x + 3.5;
      const away = (cx - tip.sx) * Math.sign(dx) + (tip.sy - v.y) * Math.sign(dy);
      expect(away, `${dx}, ${dy}`).toBeGreaterThan(0);
    }
  });
});

describe('stage pictures (UI-03, UI-04, UI-05, UI-15)', () => {
  it("a charge's sign inside its disc has no halo to thicken it", () => {
    const f = frame(electricField);
    const signs = f.calls.filter((c) => c.text === '+' || c.text === '−');
    expect(signs.length).toBeGreaterThan(0);
    expect(signs.every((c) => c.op === 'fillText')).toBe(true);
  });

  it('y₂ is dotted on the graph exactly as on the stage (y₁ dashed there)', () => {
    const f = frame(standingWave);
    const stageDash = (stroke: string) => f.dashes.find((d) => d.stroke === stroke)?.dash;
    const series = standingWave.graphs.flatMap((g) => g.series);
    const y2 = series.find((x) => x.id === 'y2');
    expect(stageDash('#force')).toEqual(y2?.dash);
    expect(stageDash('#velocity')).not.toEqual(y2?.dash);
  });

  it('two cars: the arrows are v_A and v_B, one car: just v', () => {
    const state = new Float64Array(16);
    state[1] = 10;
    state[4] = -15;
    const seq = (twoBodies: number) => {
      const s = { ...uniformMotion, defaults: { ...uniformMotion.defaults, twoBodies } };
      return frame(s, state)
        .fills()
        .map((c) => c.text)
        .join(' ');
    };
    expect(seq(1)).toContain('v A');
    expect(seq(1)).toContain('v B');
    expect(seq(0)).not.toContain('v A');
  });

  it('in free fall the acceleration arrow stands beside the velocity, not on it', () => {
    const r = recorder();
    const cam = new Camera();
    const p = { ...freeFall.defaults, g: 9.81 };
    cam.fit(freeFall.view(p));
    const state = new Float64Array(16);
    state.fill(0);
    state[3] = -10; // vy
    state[5] = -9.81; // ay
    freeFall.draw({ ctx: r.ctx, cam, state, p, opts: opts() });
    const v = r.fills().find((c) => c.text === 'v');
    const a = r.fills().find((c) => c.text === 'a');
    expect(Math.abs((v?.x ?? 0) - (a?.x ?? 0))).toBeGreaterThan(10);
  });

  it('free fall shows no "L = 0 m"; a horizontal throw shows its range', () => {
    const texts = (s: PhysicsScene) =>
      frame(s)
        .fills()
        .map((c) => c.text)
        .join('|');
    expect(texts(freeFall)).not.toContain('L = ');
    expect(texts(horizontalProjectile)).toContain('L = ');
  });

  it('"mức cơ năng" ends left of the energy bars', () => {
    const f = frame(energyConservation);
    const label = f.fills().find((c) => c.text === 'mức cơ năng');
    if (!label) throw new Error('no label');
    const vis = f.cam.visible();
    const bars = f.cam.toScreen(vis.xMax - 0.16 * (vis.xMax - vis.xMin), 0).sx;
    expect(label.x + 7 * label.text.length).toBeLessThan(bars);
  });

  it('the point name M is written after (over) the field arrow', () => {
    const state = new Float64Array(16);
    state.fill(1000);
    const names = frame(electricField, state)
      .fills()
      .map((c) => c.text);
    expect(names.lastIndexOf('M')).toBeGreaterThan(names.lastIndexOf('E'));
  });
});
