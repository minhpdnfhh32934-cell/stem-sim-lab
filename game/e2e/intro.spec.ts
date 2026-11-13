import { expect, test } from '@playwright/test';

// The app's opening (2026-11-12): over the page while the game loads, then into the menu; a key
// skips it once the game is ready. Automated browsers skip it unless the address asks (`?intro=1`).

test('the opening: shown, then the menu; a key skips it; off for tests by default', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/?intro=1');
  const intro = page.locator('.app-intro');
  await expect(intro).toBeVisible();
  await expect(intro.locator('.app-intro-word span')).toHaveCount(6); // S I M L A B
  // It runs its course (3.6 s at least), then fades into the menu, and is gone.
  await expect(intro).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  // Skipped: a key, once the game is ready, ends it at once.
  await page.goto('/?intro=1');
  await expect(page.locator('.app-intro.ready')).toHaveCount(1, { timeout: 15_000 });
  await page.keyboard.press('Space');
  await expect(intro).toHaveCount(0, { timeout: 2000 });

  // Without the address asking, an automated browser does not get it.
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(intro).toHaveCount(0);
});
