import { expect, test } from '@playwright/test';
import { expectDebug, openSolo } from './support';

// The menu's Play (Phú 2026-11-12): one Play button; Single player keeps each game in this
// browser (New game makes another, Continue plays the last, each listed with Play and Delete,
// a Delete asked twice); going in plays the entering transition. And the opening ends by sliding
// its logo onto the menu's. SwiftShader: nothing here is timed.

test('single player: games kept, the last continued, one deleted after asking', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await openSolo(page);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await expect(page.locator('.play-empty')).toHaveText('No saved game yet.');

  // Two new games, each saved on going in (the autosave of the first room).
  for (let i = 0; i < 2; i++) {
    if (i > 0) {
      await page.reload();
      await openSolo(page);
    }
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await expect(page.locator('.enter-transition')).toBeVisible();
    if (i === 0) {
      await page.waitForTimeout(700); // covered: the portal, the streaks, the words
      await page.screenshot({ path: 'test-results/play-menu-1-entering.png' });
    }
    await expectDebug(page, 'Phase', 'playing');
    await expect(page.locator('.enter-transition')).toHaveCount(0);
  }
  await page.reload();
  await openSolo(page);
  const rows = page.locator('.play-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Game 2'); // the last played first
  await expect(rows.nth(1)).toContainText('Game 1');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/play-menu-2-solo.png' });

  // Delete Game 1: asked first; Cancel keeps it, Delete removes it (and its save) for good.
  await page.getByRole('button', { name: 'Delete Game 1' }).click();
  await expect(rows.nth(1)).toContainText('Delete “Game 1”? This cannot be undone.');
  await rows.nth(1).getByRole('button', { name: 'Cancel' }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Game 1' }).click();
  await rows.nth(1).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.reload();
  await openSolo(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText('Game 2');
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('simlab.save.')),
  );
  expect(keys.some((k) => k.startsWith('simlab.save.solo-1'))).toBe(false);

  // Play on Game 2 from its row.
  await page.getByRole('button', { name: 'Play Game 2' }).click();
  await expectDebug(page, 'Phase', 'playing');
  expect(errors).toEqual([]);
});

test('the opening slides its logo onto the menu’s, then the menu’s own is shown', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/?intro=1');
  await expect(page.locator('.app-intro.ready')).toHaveCount(1, { timeout: 15_000 });
  const target = page.locator('.menu-brand .menu-emblem');
  const end = await target.boundingBox();
  await page.keyboard.press('Space');
  // Mid-flight: the menu's own logo hidden (one logo), the intro's on its way.
  await expect(target).toHaveCSS('visibility', 'hidden');
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'test-results/play-menu-3-slide.png' });
  await expect(page.locator('.app-intro')).toHaveCount(0, { timeout: 5000 });
  await expect(target).toHaveCSS('visibility', 'visible');
  expect(await target.boundingBox()).toEqual(end);
  await page.screenshot({ path: 'test-results/play-menu-4-landed.png' });
});
