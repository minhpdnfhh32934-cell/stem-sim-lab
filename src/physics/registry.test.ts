import { describe, expect, it } from 'vitest';
import { pickTex } from '@/core/data/dataset';
import { registeredEngines } from '@/core/sim/engine';
import '@/workers/engines';
import { loadScene, sceneIds } from './registry';
import { Camera } from './render/camera';
import type { DrawOptions, ThemeColors } from './types';

describe('physics registry', () => {
  it('every scene has its engine registered in src/workers/engines.ts', async () => {
    const engines = registeredEngines();
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      expect(scene.id, id).toBe(id);
      expect(engines, `${id} → ${scene.engineId}`).toContain(scene.engineId);
    }
  });

  it('a scene marked endless runs on: no end without a caller tEnd (#205 C1)', async () => {
    const { createEngine } = await import('@/core/sim/engine');
    const endless: string[] = [];
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      if (!scene.endless) continue;
      endless.push(id);
      const e = await createEngine(scene.engineId);
      e.reset(scene.engineParams?.(scene.defaults) ?? scene.defaults);
      // Past every former end (the longest was 600 s), at the engine's own step.
      const n = Math.ceil(700 / e.dt);
      for (let i = 0; i < n; i++) e.step();
      if (id === 'energyConservation' && e.finished?.()) {
        // Its one natural end: the bead ran off an end of the track (state `off`), never a time.
        const out = new Float64Array(e.stateSize);
        e.readState(out);
        expect(out[4], id).toBe(1);
        continue;
      }
      expect(e.finished?.() ?? false, id).toBe(false);
    }
    expect(endless.length).toBeGreaterThanOrEqual(9);
  });

  it('time graphs share one naming ("Vận tốc theo thời gian", UI-14)', async () => {
    for (const id of sceneIds()) {
      for (const g of (await loadScene(id)).graphs) {
        expect(g.title.vi, `${id}/${g.id}`).not.toMatch(/– thời gian|^Đồ thị /);
        expect(g.title.en, `${id}/${g.id}`).not.toMatch(/– time/);
      }
    }
  });

  it('KaTeX renders every formula without a warning (symbols, card, steps, every choice)', async () => {
    // "α_{bđ}", "W_đ": "Unicode text character in math mode"; "ỏ", "ỉ" even in \text{}:
    // "symbolNotInFont" (UI-54). Equation.tsx ignores only "unknownSymbol".
    const katex = (await import('katex')).default;
    for (const id of sceneIds()) {
      const s = await loadScene(id);
      const base = s.usesGravity ? { ...s.defaults, g: 9.81 } : s.defaults;
      const choices = s.params.filter((d) => d.kind === 'choice');
      const variants = [
        base,
        ...choices.flatMap((d) => (d.choices ?? []).map((c) => ({ ...base, [d.key]: c.value }))),
      ];
      for (const p of variants) {
        const texts = (['vi', 'en'] as const).flatMap((loc) => [
          ...s.params.map((d) => [`${loc} symbol ${d.key}`, pickTex(d.symbol, loc)] as const),
          ...s
            .scienceCard(p)
            .equations.map((e, i) => [`${loc} card ${i}`, pickTex(e.tex, loc)] as const),
          ...s.solve(p, loc).steps.map((st, i) => [`${loc} step ${i}`, st.tex ?? ''] as const),
          ...s.bodies.flatMap((b) =>
            (b.properties?.(new Float64Array(64), p) ?? []).map(
              (pr) => [`${loc} prop`, pickTex(pr.symbol, loc)] as const,
            ),
          ),
        ]);
        for (const [where, tex] of texts) {
          const warned: string[] = [];
          katex.renderToString(tex, {
            throwOnError: true,
            strict: (code: string) => {
              if (code !== 'unknownSymbol') warned.push(code);
              return 'ignore';
            },
          });
          expect.soft(warned, `${id} ${where}: ${tex}`).toEqual([]);
        }
      }
    }
  });

  it('a parameter label does not repeat the symbol shown after it (UI-16)', async () => {
    const SUBS = '₀₁₂₃₄₅₆₇₈₉';
    for (const id of sceneIds()) {
      for (const d of (await loadScene(id)).params) {
        // Simple symbols only: "m_1" / "q_{2}" → "m₁" / "q₂".
        const m = /^([a-zA-Z])_\{?(\d)\}?$/.exec(pickTex(d.symbol, 'vi'));
        if (!m) continue;
        const plain = `${m[1]}${SUBS.charAt(Number(m[2]))}`;
        expect(d.label.vi, `${id}/${d.key}`).not.toContain(plain);
        expect(d.label.en, `${id}/${d.key}`).not.toContain(plain);
      }
    }
  });

  it('English pages use English textbook symbols; Vietnamese pages keep the SGK ones (#258)', async () => {
    // Vietnamese abbreviations: W_đ, F_đh, α_bđ, α_gđ, F_ms, a_ht, v_gh, F_hl, R_nt, R_ss, P_ng,
    // F_kéo, W_t, 𝒫. Canvas labels come as runs: "F_ms" is drawn as "F" then "ms".
    // Also the SGK forms of #268: F_mst, F_msn, W_ci, W_tp, W_c.
    const VI =
      /đ|_\{?(ms|mst|msn|ht|gh|hl|nt|ss|ng|ci|tp)(?![a-z])|kéo|W_[tc](?![a-z])|\\mathscr\{P\}/;
    const VI_RUN = /^(ms|mst|msn|ht|gh|hl|nt|ss|ng|ci|tp|t|c)$|đ/;
    let viSide = 0;
    for (const id of sceneIds()) {
      const s = await loadScene(id);
      const base = s.usesGravity ? { ...s.defaults, g: 9.81 } : s.defaults;
      const choices = s.params.filter((d) => d.kind === 'choice');
      const variants = [
        base,
        ...choices.flatMap((d) => (d.choices ?? []).map((c) => ({ ...base, [d.key]: c.value }))),
      ];
      for (const p of variants) {
        const texts = (loc: 'vi' | 'en') => [
          ...s.params.map((d) => pickTex(d.symbol, loc)),
          ...s.scienceCard(p).equations.map((e) => pickTex(e.tex, loc)),
          ...s.solve(p, loc).steps.map((st) => st.tex ?? ''),
          ...s.bodies.flatMap((b) =>
            (b.properties?.(new Float64Array(64), p) ?? []).map((pr) => pickTex(pr.symbol, loc)),
          ),
          // Graph legends are also the data table's and the CSV's column headers.
          ...s.graphs.flatMap((g) => [g.yLabel[loc], ...g.series.map((x) => x.label[loc])]),
        ];
        for (const t of texts('en')) expect.soft(t, id).not.toMatch(VI);
        viSide += texts('vi').filter((t) => VI.test(t)).length;
        const runs: string[] = [];
        const ctx = new Proxy(
          {},
          {
            get: (_t, k) =>
              k === 'fillText'
                ? (t: string) => runs.push(t)
                : k === 'font'
                  ? '12px sans-serif'
                  : k === 'measureText'
                    ? (t: string) => ({ width: 7 * t.length })
                    : k === 'createLinearGradient' || k === 'createRadialGradient'
                      ? () => ({ addColorStop: () => undefined })
                      : k === 'getImageData' || k === 'createImageData'
                        ? (w = 1, h = 1) => ({
                            data: new Uint8ClampedArray(4 * w * h),
                            width: w,
                            height: h,
                          })
                        : () => undefined,
            set: () => true,
          },
        ) as CanvasRenderingContext2D;
        const cam = new Camera();
        cam.fit(s.view(p));
        const opts: DrawOptions = {
          vectors: true,
          intervened: false,
          trail: false,
          selected: null,
          locale: 'en',
          colors: new Proxy({}, { get: () => '#000' }) as ThemeColors,
          time: 0,
        };
        s.draw({ ctx, cam, state: new Float64Array(64).fill(0.5), p, opts });
        // "v_t" (terminal speed) and "a_c, F_c" (centripetal) are English: a "t" run is Vietnamese
        // only when it does not follow "v", a "c" run only after "W" (W_c).
        const bad = runs.filter((t, i) => {
          const before = runs[i - 1] ?? '';
          if (t === 't') return !before.endsWith('v');
          if (t === 'c') return before.endsWith('W');
          return VI_RUN.test(t);
        });
        expect.soft(bad, `${id} canvas`).toEqual([]);
      }
    }
    expect(viSide).toBeGreaterThan(20);
  });
});
