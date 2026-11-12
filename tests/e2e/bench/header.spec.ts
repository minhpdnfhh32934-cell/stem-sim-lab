import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B2: the header's search is an icon (its name "Tìm kiếm", Ctrl+K in the tooltip; "Tìm…" read
 * as cut text); short of room (140 %) the light / dark switch moves into Tệp; the lesson name has
 * the room: whole at 100 %, its first words at 140 % (A5: whole in the tooltip). 1366 × 768, the
 * longest lesson name.
 */
const LESSON = 'Con mồi – vật ăn thịt (Lotka–Volterra)';

async function openLesson(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale, theme: 'light' }, version: 2 }),
    );
  }, fontScale);
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('main').getByRole('button', { name: LESSON, exact: true }).click();
  await expect(page.locator('.science-card__summary-title')).toBeVisible({ timeout: 20_000 });
}

const header = (page: Page) => page.locator('.bench-header');
const nameRoom = (page: Page) =>
  page.getByRole('heading', { level: 1 }).evaluate((el) => ({
    shown: el.clientWidth,
    whole: el.scrollWidth,
  }));

test('100 %: the search is an icon named "Tìm kiếm"; the lesson name is whole; light / dark stays out', async ({
  page,
}) => {
  await openLesson(page, 1);
  const search = header(page).getByRole('button', { name: 'Tìm kiếm' });
  await expect(search).toHaveAttribute('aria-keyshortcuts', 'Control+K');
  await expect(search).toHaveAttribute('data-tip', 'Tìm kiếm (Ctrl+K)');
  const box = await search.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(40);
  const room = await nameRoom(page);
  expect(room.whole).toBeLessThanOrEqual(room.shown);
  await expect(header(page).getByRole('button', { name: 'Giao diện tối' })).toBeVisible();
  await header(page).getByRole('button', { name: 'Tệp' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Giao diện tối' })).toBeHidden();
  await page.keyboard.press('Escape');
  // Ctrl+K still opens the search.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeVisible();
});

test('140 %: light / dark is in Tệp; the lesson name keeps its first words', async ({ page }) => {
  await openLesson(page, 1.4);
  await expect(header(page).getByRole('button', { name: 'Giao diện tối' })).toBeHidden();
  await header(page).getByRole('button', { name: 'Tệp' }).click();
  const item = page.getByRole('menuitemcheckbox', { name: 'Giao diện tối' });
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('aria-checked', 'false');
  // The arrows reach it: up from the first item wraps to the last one.
  await page.keyboard.press('ArrowUp');
  await expect(item).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The name: 204 px of 452 before #205 B2.
  const room = await nameRoom(page);
  expect(room.shown).toBeGreaterThanOrEqual(260);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});
