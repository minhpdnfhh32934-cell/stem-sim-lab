import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The decorative effects (src/app/fx, docs/EFFECTS.md). An automated browser does not get them
 * unless asked (`?fx=1`), so every other spec runs without them.
 */
test.use({ viewport: { width: 1366, height: 768 } });

const intro = (page: Page) => page.locator('.fx-intro');

/**
 * Counts the view transitions the page starts: none since the screen-change circle was removed
 * (user request 19/11/2026).
 */
async function countTransitions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __fxTransitions: number };
    w.__fxTransitions = 0;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update?: ViewTransitionUpdateCallback) => {
      w.__fxTransitions += 1;
      return start(update);
    };
  });
}
const transitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fxTransitions: number }).__fxTransitions);

/**
 * Records, the moment the opening appears, its text and which of its parts move: no wait on its
 * timing (a slow start-up delays its timers).
 */
async function watchIntro(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __fxIntro?: { word: string; moving: string[] } };
    new MutationObserver((_, observer) => {
      const el = document.querySelector('.fx-intro');
      if (!el) return;
      observer.disconnect();
      w.__fxIntro = {
        word: el.querySelector('.fx-intro__word')?.textContent ?? '',
        moving: [...el.querySelectorAll('*')]
          .map((n) => getComputedStyle(n).animationName)
          .filter((name) => name !== 'none'),
      };
    }).observe(document, { childList: true, subtree: true });
  });
}
const introSeen = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __fxIntro?: { word: string; moving: string[] } }).__fxIntro,
  );

test('without ?fx=1 an automated browser gets none of them', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chào mừng đến với SimLab' })).toBeVisible();
  await expect(intro(page)).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  await expect(page.locator('.launch__drift')).toBeHidden();
});

test('the opening plays, then the launch page; the lab opens at once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await watchIntro(page);
  await page.goto('/?fx=1');
  await expect(intro(page)).toHaveCount(0, { timeout: 10_000 });
  const seen = await introSeen(page);
  expect(seen?.word).toBe('SimLab');
  expect(seen?.moving).toEqual(expect.arrayContaining(['fx-pop', 'fx-orbit-in', 'fx-rise']));
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'on');
  await expect(page.locator('.launch__drift')).toBeVisible();

  await countTransitions(page);
  await page.getByRole('button', { name: /Virtual Lab/ }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  // No circle, no orbit ring: the screen simply changes.
  expect(await transitions(page)).toBe(0);
  await expect(page.locator('.fx-portal')).toHaveCount(0);

  // Once everything has settled, the page passes axe as without the effects.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => v.id)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a key skips the opening', async ({ page }) => {
  await page.goto('/?fx=1');
  await expect(intro(page)).toBeVisible();
  await page.keyboard.press('Space');
  // Leaving at once (a state change on the key, not the opening's own timer), then gone.
  await expect(intro(page)).toHaveClass(/is-leaving/, { timeout: 500 });
  await expect(intro(page)).toHaveCount(0, { timeout: 5_000 });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a short still opening, no drift, the lab opens at once', async ({ page }) => {
    await watchIntro(page);
    await page.goto('/?fx=1');
    await expect(intro(page)).toHaveCount(0, { timeout: 10_000 });
    // A still: nothing in it moves (only the overlay fades when it leaves).
    expect((await introSeen(page))?.moving).toEqual([]);
    const drift = await page
      .locator('.launch__float')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(drift).toBe('none');
    await countTransitions(page);
    await page.getByRole('button', { name: /Virtual Lab/ }).click();
    await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
    expect(await transitions(page)).toBe(0);
  });
});
