import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B2b, 1366 × 768: short of room (Cỡ chữ ≥ 110 %) undo / redo move into Tệp (Ctrl+Z / Ctrl+Y
 * still work) and the middle crumbs "Virtual Lab › Vật lý" fold into "…", whole in its name and
 * tooltip. At 100 % nothing changes.
 */
async function openProjectile(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale, theme: 'light' }, version: 2 }),
    );
  }, fontScale);
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Ném xiên', exact: true }).click();
  const field = page.locator('.param__number').first();
  await expect(field).toHaveValue('15', { timeout: 20_000 });
  return field;
}

const header = (page: Page) => page.locator('.bench-header');
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Vị trí' });

test('100 %: undo / redo and the whole path stay in the header; Tệp has neither', async ({
  page,
}) => {
  await openProjectile(page, 1);
  await expect(header(page).getByRole('button', { name: 'Hoàn tác (Ctrl+Z)' })).toBeVisible();
  await expect(header(page).getByRole('button', { name: 'Làm lại (Ctrl+Y)' })).toBeVisible();
  await expect(crumbs(page).getByRole('button', { name: 'Virtual Lab' })).toBeVisible();
  await expect(crumbs(page).getByRole('button', { name: 'Vật lý' })).toBeVisible();
  await expect(crumbs(page).getByRole('button', { name: 'Virtual Lab › Vật lý' })).toBeHidden();
  await header(page).getByRole('button', { name: 'Tệp' }).click();
  await expect(page.getByRole('menuitem', { name: /Hoàn tác|Làm lại/ })).toHaveCount(0);
  // The menu opens on its first item on screen.
  await expect(page.getByRole('menuitem').first()).toBeFocused();
});

test('140 %: undo / redo in Tệp, Ctrl+Z still works; "…" holds the path and leads to the shelf', async ({
  page,
}) => {
  const field = await openProjectile(page, 1.4);
  await expect(header(page).getByRole('button', { name: 'Hoàn tác (Ctrl+Z)' })).toBeHidden();
  await expect(header(page).getByRole('button', { name: 'Làm lại (Ctrl+Y)' })).toBeHidden();

  // Nothing to undo yet: the items are there, marked unavailable.
  const file = header(page).getByRole('button', { name: 'Tệp' });
  await file.click();
  const undo = page.getByRole('menuitem', { name: 'Hoàn tác (Ctrl+Z)' });
  const redo = page.getByRole('menuitem', { name: 'Làm lại (Ctrl+Y)' });
  await expect(undo).toBeFocused();
  await expect(undo).toHaveAttribute('aria-disabled', 'true');
  await expect(redo).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  await field.fill('20');
  await field.press('Enter');
  await expect(field).toHaveValue('20');
  await page.waitForTimeout(600);
  await file.click();
  await expect(undo).not.toHaveAttribute('aria-disabled');
  await undo.click();
  await expect(field).toHaveValue('15');
  await file.click();
  await redo.click();
  await expect(field).toHaveValue('20');
  // The shortcut does not need the button.
  await page.locator('.bench-header__mark').focus();
  await page.keyboard.press('Control+z');
  await expect(field).toHaveValue('15');

  // "Virtual Lab › Vật lý" folds into "…": a 40 px target, the whole path in its name and tooltip.
  await expect(crumbs(page).getByRole('button', { name: 'Virtual Lab', exact: true })).toBeHidden();
  await expect(crumbs(page).getByRole('button', { name: 'Vật lý', exact: true })).toBeHidden();
  const fold = crumbs(page).getByRole('button', { name: 'Virtual Lab › Vật lý' });
  await expect(fold).toHaveText('…');
  const box = await fold.boundingBox();
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(40);
  await fold.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Virtual Lab › Vật lý');
  // The lesson name has the room the crumbs and buttons gave up.
  const name = await page
    .getByRole('heading', { level: 1 })
    .evaluate((el) => ({ shown: el.clientWidth, whole: el.scrollWidth }));
  expect(name.whole).toBeLessThanOrEqual(name.shown);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await fold.click();
  await expect(page.getByRole('radio', { name: 'Vật lý' })).toBeChecked();
});
