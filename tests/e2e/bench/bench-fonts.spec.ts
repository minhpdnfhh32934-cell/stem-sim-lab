import { expect, test } from '@playwright/test';

// Bench twin of tests/e2e/bench-fonts.spec.ts (0.8.1 B8: same titles, the same checks on the bench
// shell; scripts/e2e/title-parity.mjs).

/**
 * The bench fonts (#113) really draw every Vietnamese letter (and the in-range signs µ·°×−¹²³),
 * in every bundled weight. A glyph comes from the bench font when its width is the same with a
 * serif and a monospace fallback behind it; '→' (in no bundled subset) proves the method sees a
 * fallback. Which symbols fall back by design: src/app/theme/benchFonts.test.ts.
 */
const TEXT =
  'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư' +
  String.fromCodePoint(...Array.from({ length: 0x1ef9 - 0x1ea0 + 1 }, (_, i) => 0x1ea0 + i)) +
  'µ·°×−¹²³';
const FALLBACK = '→';

test('bench fonts draw every Vietnamese letter in every weight', async ({ page }) => {
  await page.goto('/');
  // The bench shell loads them too; importing the font module again (as the classic copy
  // must) changes nothing and keeps the two tests the same.
  await page.addScriptTag({ type: 'module', url: '/src/app/theme/benchFonts.ts' });
  const result = await page.evaluate(
    async ({ text, fallback }) => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) throw new Error('no 2D canvas');
      const width = (font: string, ch: string) => {
        ctx.font = font;
        return ctx.measureText(ch).width;
      };
      const out: { face: string; loaded: number; missing: string; fallbackSeen: boolean }[] = [];
      for (const [family, weights] of [
        ['Be Vietnam Pro', [400, 500, 600]],
        ['JetBrains Mono', [400, 500]],
      ] as const) {
        for (const w of weights) {
          const font = `${w} 40px "${family}"`;
          const loaded = await document.fonts.load(font, text + fallback);
          const own = (ch: string) =>
            width(`${font}, serif`, ch) === width(`${font}, monospace`, ch);
          out.push({
            face: `${family} ${w}`,
            loaded: loaded.length,
            missing: Array.from(text)
              .filter((ch) => !own(ch))
              .join(''),
            fallbackSeen: !own(fallback),
          });
        }
      }
      return out;
    },
    { text: TEXT, fallback: FALLBACK },
  );
  for (const r of result) {
    expect(r.loaded, r.face).toBeGreaterThan(0);
    expect(r.fallbackSeen, `${r.face}: '${FALLBACK}' should come from the fallback font`).toBe(
      true,
    );
    expect(r.missing, r.face).toBe('');
  }
});
