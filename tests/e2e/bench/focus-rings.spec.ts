import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 A4: the places that removed their own outline show focus somewhere else, reached with the
 * keyboard (Tab), at 1366×768. The rule list is in src/app/theme/focusRing.test.ts.
 */
async function tabTo(page: Page, selector: string, max = 120): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
  }
  throw new Error(`Tab never reached ${selector}`);
}

async function ring(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const st = getComputedStyle(el);
      return `${st.outlineStyle} ${st.outlineWidth}`;
    });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
});

test('the stage canvas shows a ring when the keyboard reaches it', async ({ page }) => {
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Ném xiên', exact: true }).click();
  await expect(page.locator('.stage__canvas')).toBeVisible({ timeout: 20_000 });
  await tabTo(page, '.stage__canvas');
  expect(await ring(page, '.stage__canvas')).toBe('solid 2px');
});

test('the periodic table search box shows its ring', async ({ page }) => {
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Bảng tuần hoàn', exact: true }).click();
  await expect(page.locator('.pt__search input')).toBeVisible({ timeout: 20_000 });
  await tabTo(page, '.pt__search input');
  expect(await ring(page, '.pt__search')).toBe('solid 2px');
});

test("AI Teacher's message box shows its ring", async ({ page }) => {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible();
  await tabTo(page, '.chat-panel__composer textarea');
  expect(await ring(page, '.chat-panel__composer')).toBe('solid 2px');
});

test('the Ctrl+K search row shows its ring', async ({ page }) => {
  await openLab(page);
  await page.keyboard.press('Control+k');
  const input = page.locator('.command-palette__search input');
  await expect(input).toBeFocused({ timeout: 10_000 });
  expect(await ring(page, '.command-palette__search')).toBe('solid 2px');
});
