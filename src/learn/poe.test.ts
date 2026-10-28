import { describe, expect, it } from 'vitest';
import { tFor } from '@/app/i18n';
import { fromSI } from '@/core/units';
import { loadScene, sceneIds } from '@/physics/registry';
import type { Params } from '@/physics/types';
import { observe, POES, poeFor } from './poe';

describe('predict – observe – explain', () => {
  it('every physics topic has a prediction question', () => {
    for (const id of sceneIds()) expect(poeFor(id), id).toBeDefined();
  });

  for (const g of [9.81, 9.8, 10]) {
    it(`the right choice is computed by the engine and exists (g = ${g})`, async () => {
      for (const poe of POES) {
        const s = await loadScene(poe.topic);
        const params: Params = s.usesGravity
          ? { ...s.defaults, ...poe.start, g }
          : { ...s.defaults, ...poe.start };
        const out = observe(s, poe, params);
        expect(out, poe.id).not.toBeNull();
        expect(out?.correct ?? -1, poe.id).toBeGreaterThanOrEqual(0);
        // The changed value stays inside the slider range.
        const def = s.params.find((d) => d.key === poe.param);
        const shown = fromSI((params[poe.param] ?? 0) * poe.factor, def?.unit ?? '1');
        expect(shown, poe.id).toBeGreaterThanOrEqual(def?.min ?? -Infinity);
        expect(shown, poe.id).toBeLessThanOrEqual(def?.max ?? Infinity);
      }
    });
  }

  it('the question asks what the buttons answer (UI-11)', () => {
    for (const poe of POES) {
      // "sớm hơn, muộn hơn hay…" / "lâu hơn, ngắn hơn hay…": words no button uses.
      expect(poe.question.vi, poe.id).not.toMatch(/hơn, .* hơn hay/);
      if (poe.choices.some((c) => c.kind === 'direction')) {
        expect(poe.question.vi, poe.id).toContain('tăng, giảm hay không đổi');
        expect(poe.question.en, poe.id).toMatch(/go up, (go )?down or stay/);
      }
    }
  });

  it('a question that switches the stage mode names that mode (UI-52)', async () => {
    for (const poe of POES) {
      const s = await loadScene(poe.topic);
      const mode = poe.start?.mode;
      if (mode === undefined || mode === s.defaults.mode) continue;
      const label = s.params.find((d) => d.key === 'mode')?.choices?.find((c) => c.value === mode);
      expect(label, poe.id).toBeDefined();
      expect(poe.question.vi, poe.id).toContain(label?.label.vi ?? '?');
      expect(poe.question.en.toLowerCase(), poe.id).toContain(label?.label.en.toLowerCase() ?? '?');
      // The stage switches only when the learner presses this button.
      expect(poe.question.vi, poe.id).toContain(`“${tFor('vi')('learn.observe')}”`);
      expect(poe.question.en, poe.id).toContain(`“${tFor('en')('learn.observe')}”`);
    }
  });

  it('known closed forms: free fall √2, stopping distance ×4, period ×2', async () => {
    const pick = async (id: string) => {
      const poe = POES.find((p) => p.id === id);
      if (!poe) throw new Error(id);
      const s = await loadScene(poe.topic);
      const out = observe(s, poe, { ...s.defaults });
      if (!out) throw new Error(id);
      return { out, poe };
    };
    const ff = await pick('freeFall.h0');
    expect(ff.out.after / ff.out.before).toBeCloseTo(Math.SQRT2, 6);
    expect(ff.poe.choices[ff.out.correct]).toEqual({ kind: 'ratio', ratio: Math.SQRT2 });
    const ua = await pick('uniformAcceleration.vA');
    expect(ua.out.after / ua.out.before).toBeCloseTo(4, 6);
    const hk = await pick('hookeSpring.m');
    // The Hooke default is lightly damped (b > 0), so the period is the damped one, 2π/ω_d:
    // the ratio is ω_d(m)/ω_d(4m), within 0.003 % of the undamped ×2.
    const d = (await loadScene('hookeSpring')).defaults;
    const [m, k, b] = [d.m ?? 0, d.k ?? 0, d.b ?? 0];
    expect(b).toBeGreaterThan(0);
    const wd = (mm: number) => Math.sqrt(k / mm - (b / (2 * mm)) ** 2);
    expect(hk.out.after / hk.out.before).toBeCloseTo(wd(m) / wd(4 * m), 9);
    expect(hk.out.after / hk.out.before).toBeCloseTo(2, 4);
    // Standing wave, v from F and μ (the POE's start): F × 4 → v × 2 → f × 2.
    const sw = POES.find((x) => x.id === 'standingWave.tension');
    if (!sw) throw new Error('standingWave.tension');
    const sws = await loadScene(sw.topic);
    const swo = observe(sws, sw, { ...sws.defaults, ...sw.start });
    expect(swo && swo.after / swo.before).toBeCloseTo(2, 9);
    expect(swo && sw.choices[swo.correct]).toEqual({ kind: 'ratio', ratio: 2 });
    expect(hk.poe.choices[hk.out.correct]).toEqual({ kind: 'ratio', ratio: 2 });
    const ob = await pick('obliqueProjectile.m');
    expect(ob.poe.choices[ob.out.correct]).toEqual({ kind: 'ratio', ratio: 1 });
  });
});
