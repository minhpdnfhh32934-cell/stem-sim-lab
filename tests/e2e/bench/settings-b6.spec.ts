import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B6, part A in Settings: on every page, at 1366 × 768, 100 % and 140 % (Advanced, so every
 * page shows), each field, button and disclosure line is at least a 40 px target, nothing spills
 * sideways, and text is at least 12 px × Cỡ chữ.
 */
for (const fontScale of [1, 1.4] as const) {
  test(`every Settings page at ${String(fontScale * 100)} %: 40 px targets, no sideways spill, text ≥ 12 px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({
          state: { locale: 'vi', fontScale: scale, uiMode: 'advanced' },
          version: 2,
        }),
      );
    }, fontScale);
    await openLab(page);
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
    const sheet = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(sheet).toBeVisible();
    const tabs = await sheet.getByRole('tab').all();
    expect(tabs.length).toBeGreaterThan(8);
    for (const tab of tabs) {
      const name = ((await tab.textContent()) ?? '').trim();
      await tab.click();
      const panel = sheet.locator('.settings-panel:not([hidden])');
      await expect(panel).toBeVisible();
      const found = await panel.evaluate((el, scale) => {
        const small: string[] = [];
        const spill: string[] = [];
        const tiny: string[] = [];
        for (const e of el.querySelectorAll<HTMLElement>(
          'button, select, input, textarea, summary, a.btn',
        )) {
          if (e.getClientRects().length === 0) continue;
          const type = (e as HTMLInputElement).type;
          if (['checkbox', 'radio', 'range', 'file', 'hidden'].includes(type)) continue;
          const b = e.getBoundingClientRect();
          if (Math.min(b.width, b.height) < 39.5)
            small.push(`${e.tagName} ${Math.round(b.width)}×${Math.round(b.height)}`);
        }
        const edge = el.getBoundingClientRect().right;
        for (const e of el.querySelectorAll<HTMLElement>('*')) {
          if (e.getClientRects().length === 0) continue;
          const b = e.getBoundingClientRect();
          if (b.width > 0 && b.right > edge + 1) spill.push(e.className.slice(0, 30));
          const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
          // Drawings (GuideArt) size their text in SVG units: svg-text.spec.ts checks them on screen.
          if (e.closest('svg')) continue;
          if (own && parseFloat(getComputedStyle(e).fontSize) < 12 * scale - 0.05)
            tiny.push(e.textContent.trim().slice(0, 20));
        }
        return { small, spill: [...new Set(spill)].slice(0, 5), tiny: tiny.slice(0, 5) };
      }, fontScale);
      expect(found.small, name).toEqual([]);
      expect(found.spill, name).toEqual([]);
      expect(found.tiny, name).toEqual([]);
    }
  });
}
