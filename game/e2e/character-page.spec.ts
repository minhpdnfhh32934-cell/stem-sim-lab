import { expect, test } from '@playwright/test';
import { expectDebug, menuNewGame } from './support';

// The character page (Phase C; C-9 the group in one room), in the real app: the menu's row opens
// it over the menu with its own 3D stage; the arrows and ← → go through everyone left to right as
// they sit, wrapping, the last place the player's own character (a silhouette until made); Esc
// goes back without changing the choice. The silhouette's Create opens the customiser; Save puts
// the made character in that place, chosen; Choose and New game use it. SwiftShader: nothing here
// is timed.

test('character page: everyone left to right, Esc keeps the choice, Choose and New game use it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  const row = page.getByRole('button', { name: /Choose your character/ });
  await expect(row).toBeVisible();
  await expect(page.locator('.menu-character-name')).toHaveText('Khoa');
  // The menu loads without three.js: a flat picture first (SVG); the 3D one once the page ran.
  await expect(page.locator('.menu-character-portrait')).toHaveAttribute('src', /^data:image\/svg/);

  await row.click();
  const pageRoot = page.locator('.char-page[data-ready="true"]');
  await expect(pageRoot).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Choose your character' })).toBeVisible();
  await expect(page.locator('.char-page canvas')).toHaveCount(1);
  // Khoa stands seventh from the left.
  await expect(page.locator('.char-name')).toHaveText('Khoa');
  await expect(page.locator('.char-role')).toHaveText('Physicist');
  await expect(page.locator('.char-count')).toHaveText('7 of 9');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.char-name')).toHaveText('Linh');
  await expect(page.locator('.char-count')).toHaveText('6 of 9');
  // → to the right end: Tuấn, then the player's own place, not made yet.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.char-name')).toHaveText('Tuấn');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.char-name')).toHaveText('Your own character');
  await expect(page.locator('.char-role')).toHaveText('Not made yet');
  await expect(page.locator('.char-count')).toHaveText('9 of 9');
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  // → wraps to the left end.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.char-name')).toHaveText('Huy');
  await expect(page.locator('.char-count')).toHaveText('1 of 9');
  // Esc: back to the menu, the choice unchanged, the page's canvas freed.
  await page.keyboard.press('Escape');
  await expect(page.locator('.char-page')).toBeHidden();
  await expect(page.locator('.menu-character-name')).toHaveText('Khoa');
  await expect(page.locator('.char-page canvas')).toHaveCount(0);

  // Again: the arrows to the silhouette, Create: the customiser with its own picture.
  await row.click();
  await expect(pageRoot).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next character' }).click();
  await expect(page.locator('.char-page')).toHaveAttribute('data-chosen', 'custom');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const customiser = page.getByRole('dialog', { name: 'Your own character' });
  await expect(customiser).toBeVisible();
  await expect(page.locator('.custom-page[data-ready="true"] canvas')).toHaveCount(1);
  await customiser.locator('.custom-name').fill('Phú');
  await customiser.getByRole('button', { name: 'Hair', exact: true }).click();
  await customiser.getByRole('button', { name: 'Ponytail' }).click();
  await expect(customiser.getByRole('button', { name: 'Ponytail' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await customiser.getByRole('button', { name: 'Body', exact: true }).click();
  await customiser.getByRole('slider', { name: 'Height' }).fill('1.9');
  await customiser.getByRole('button', { name: 'Save' }).click();
  await expect(customiser).toBeHidden();
  // Back in the room, the one made in the player's place, chosen.
  await expect(pageRoot).toBeVisible();
  await expect(page.locator('.char-name')).toHaveText('Phú');
  await expect(page.locator('.char-role')).toHaveText('Your own character');
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  const kept = await page.evaluate(() => localStorage.getItem('simlab.character.custom'));
  expect(JSON.parse(kept ?? '{}')).toMatchObject({
    displayName: 'Phú',
    appearance: { heightM: 1.9, hair: 'ponytail' },
  });
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
  await expect(page.locator('.menu-character-name')).toHaveText('Phú');

  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  await expectDebug(page, 'Character', 'custom');
  expect(errors).toEqual([]);
});
