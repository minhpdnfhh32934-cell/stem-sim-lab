import { describe, expect, it } from 'vitest';
import { registeredEngines } from '@/core/sim/engine';
import '@/workers/engines';
import { loadScene, sceneIds } from './registry';

describe('physics registry', () => {
  it('every scene has its engine registered in src/workers/engines.ts', async () => {
    const engines = registeredEngines();
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      expect(scene.id, id).toBe(id);
      expect(engines, `${id} → ${scene.engineId}`).toContain(scene.engineId);
    }
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
        const texts = [
          ...s.params.map((d) => [`symbol ${d.key}`, d.symbol] as const),
          ...s.scienceCard(p).equations.map((e, i) => [`card ${i}`, e.tex] as const),
          ...(['vi', 'en'] as const).flatMap((loc) =>
            s.solve(p, loc).steps.map((st, i) => [`${loc} step ${i}`, st.tex ?? ''] as const),
          ),
          ...s.bodies.flatMap((b) =>
            (b.properties?.(new Float64Array(64), p) ?? []).map(
              (pr) => ['prop', pr.symbol] as const,
            ),
          ),
        ];
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
        const m = /^([a-zA-Z])_\{?(\d)\}?$/.exec(d.symbol);
        if (!m) continue;
        const plain = `${m[1]}${SUBS.charAt(Number(m[2]))}`;
        expect(d.label.vi, `${id}/${d.key}`).not.toContain(plain);
        expect(d.label.en, `${id}/${d.key}`).not.toContain(plain);
      }
    }
  });
});
