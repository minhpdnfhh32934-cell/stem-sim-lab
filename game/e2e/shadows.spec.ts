import { expect, type Page, test } from '@playwright/test';
import { continueFrom, labSave, walkUntil } from './support';

// Cached shadow maps (render/shadowCache.ts, Phú 2026-11-08: "less load, the same quality"): the
// room lights' maps are drawn again only when something they show moves, not every frame.

const STAND: [number, number, number] = [-3, 0, 0];
const LOOK: [number, number, number] = [-3, 1.6, -7.625];

const drawn = async (page: Page) =>
  Number(/Shadow maps:\s+(\d+)/.exec(await page.locator('.debug-text').innerText())?.[1] ?? NaN);

test('standing still the lab draws no shadow map; walking draws them again', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('simlab.settings.graphicsQuality', 'medium'));
  const errors = await continueFrom(page, labSave(STAND, LOOK));
  // Settled: the warm-up over (it draws the maps again after each batch) and the rooms asleep.
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await drawn(page);
        const settled = now === last;
        last = now;
        return settled;
      },
      { timeout: 60_000, intervals: [1500] },
    )
    .toBe(true);
  const still = await drawn(page);
  await page.waitForTimeout(3000);
  const after = await drawn(page);
  test.info().annotations.push({ type: 'shadows', description: `still: ${still} → ${after}` });
  expect(after).toBe(still);

  await walkUntil(page, 's', ([, , z]) => z >= 1.5);
  const walked = await drawn(page);
  test.info().annotations.push({ type: 'shadows', description: `walked: ${after} → ${walked}` });
  expect(walked).toBeGreaterThan(after);
  expect(errors).toEqual([]);
});
