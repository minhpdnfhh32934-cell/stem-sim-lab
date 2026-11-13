import { expect, test } from '@playwright/test';
import { expectDebug, menuNewGame } from './support';

// The main menu's controls reference and the preparation protocol, in the real app: the dialog
// lists the game's own bindings, closes with Esc (focus back on its button) without leaving the
// menu, follows the language; a new game shows the cleanroom entry as a protocol whose rows say
// their state in text, not only in colour.

test('controls dialog: the real bindings, Esc closes it, the menu stays; the protocol plate', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Controls' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Controls' });
  await expect(dialog).toBeVisible();
  const keys = await dialog.locator('kbd').allInnerTexts();
  expect(keys).toEqual(
    expect.arrayContaining(['W', 'A', 'S', 'D', 'Shift', 'E', 'F', 'LMB', 'Q', '1–9', 'I', 'Esc']),
  );
  expect(keys).not.toContain('Space'); // there is no jump
  await expect(dialog).toContainText('Put away what you hold');
  // Inside the window, no page scroll.
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
  await expectDebug(page, 'Scene', 'main-menu');

  // The close button too.
  await button.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // A new game: the cleanroom entry as a protocol, its first stage current, the entrance locked.
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  const objective = page.locator('.hud-objective');
  await expect(objective.locator('.protocol-step')).toHaveCount(6);
  const current = objective.locator('.protocol-step[data-state="current"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText('Briefing');
  await expect(current).toContainText('— current');
  await expect(current).toContainText('Read the cleanroom entry rules on the notice board.');
  await expect(objective.locator('.protocol-step').last()).toHaveAttribute('data-state', 'locked');
  await expect(objective.locator('.protocol-step').last()).toContainText('— locked');
  expect(errors).toEqual([]);
});
