import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/**
 * The bench's other rooms (0.8.1 B7; docs/BENCH_DESIGN.md §9.8–§9.10): the AI Teacher room says it
 * is an AI, the Settings sheet and the palette take their bench sizes.
 */

test('B7: the AI Teacher room names itself an AI beside its title', async ({ page }) => {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  const title = page.locator('#teacher-title');
  await expect(title).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.teacher__header')).toContainText('Là một AI');
});

test('B7: Settings is a 1200 px sheet with a grouped 256 px navigation', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Cài đặt' });
  await expect(sheet).toBeVisible();
  // Polled: the sheet grows in from 98 % when it opens.
  const width = async (l: typeof sheet) => Math.round((await l.boundingBox())?.width ?? 0);
  await expect.poll(() => width(sheet)).toBe(1200);
  const nav = sheet.getByRole('navigation');
  await expect.poll(() => width(nav)).toBe(256);
  await expect(nav.locator('.settings-nav__group-title')).toHaveText([
    'Chung',
    'AI',
    'Quyền riêng tư',
  ]);
  // Arrow keys move along the pages (one tablist for the three groups).
  const tabs = nav.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(tabs.nth(1)).toBeFocused();
});

test('B7: the palette rows are 44 px', async ({ page }) => {
  await openLab(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('.command-palette');
  await expect(palette).toBeVisible({ timeout: 20_000 });
  const rows = palette.locator('.command-palette__item');
  await expect(rows.first()).toBeVisible();
  // Polled: the palette grows in from 98 % when it opens.
  await expect
    .poll(() =>
      rows.evaluateAll((els) =>
        els.slice(0, 5).every((e) => Math.round(e.getBoundingClientRect().height) >= 44),
      ),
    )
    .toBe(true);
});
