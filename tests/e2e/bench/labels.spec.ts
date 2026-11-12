import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 A5: short labels stay on one line; a label cut to "…" (the lesson name in the header, the
 * Science Card title in the tray) is whole in the tooltip, reached with the keyboard too.
 * 1366×768, Cỡ chữ 100 % and 140 %, two lessons with long names.
 */
const lines = (loc: Locator) =>
  loc.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  });

async function wholeByKeyboard(page: Page, label: Locator, name: string) {
  const cut = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
  if (!cut) {
    await expect(label).not.toHaveAttribute('tabindex');
    return;
  }
  await expect(label).toHaveAttribute('data-tip', name);
  await expect(label).toHaveAttribute('tabindex', '0');
  // Reached with Tab, it shows the whole name.
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press('Tab');
    if (await label.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(label).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText(name);
}

for (const fontScale of [1, 1.4] as const) {
  for (const [subject, lesson] of [
    ['Sinh học', 'Con mồi – vật ăn thịt (Lotka–Volterra)'],
    ['Hóa học', 'Cân bằng hóa học & Le Chatelier'],
  ] as const) {
    test(`${lesson}: labels whole or reachable, font ${String(fontScale * 100)} %`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.addInitScript((scale) => {
        localStorage.setItem(
          'stemsim.settings',
          JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
        );
      }, fontScale);
      await openLab(page);
      await page.getByRole('radio', { name: subject }).click();
      await page.getByRole('main').getByRole('button', { name: lesson, exact: true }).click();
      const title = page.locator('.science-card__summary-title');
      await expect(title).toBeVisible({ timeout: 20_000 });

      for (const mode of ['Cơ bản', 'Nâng cao']) {
        expect(await lines(page.getByRole('radio', { name: mode, exact: true })), mode).toBe(1);
      }
      const h1 = page.getByRole('heading', { level: 1 });
      await wholeByKeyboard(page, h1, (await h1.textContent()) ?? '');
      await wholeByKeyboard(page, title, (await title.textContent()) ?? '');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });
  }
}
