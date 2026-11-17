declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6g of #302: the throw lessons in 3D. The ball is where the engine puts it; it lands at
 * the range of the closed form. WebGL runs in software (SwiftShader).
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

// Every test starts at Medium quality (on a slow runner the start-up benchmark picks Low: 2D).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
});

interface ThrowState {
  x: number;
  y: number;
  landed: boolean;
  path: number;
}
const throwState = (page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (
      window as unknown as {
        __simlab3d?: Record<string, { state(): ThrowState | null } | undefined>;
      }
    ).__simlab3d?.[l];
    return h?.state() ?? null;
  }, lesson);

async function throwIn3d(page: Page, topic: string, lesson: string, range: number) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', topic);
  // The HUD shows the scene's title, which may say more ("Rơi tự do và ném thẳng đứng").
  await expect(page.locator('.stage__hud-title')).toHaveText(new RegExp(`^${topic}`), {
    timeout: 20_000,
  });
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator(`.bio3d[data-lesson="${lesson}"]`);
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await throwState(page, lesson))?.path).toBe(81);
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  await expect
    .poll(async () => (await throwState(page, lesson))?.landed, { timeout: 30_000 })
    .toBe(true);
  const s = await throwState(page, lesson);
  // The engine lands the ball exactly at y = 0, at the closed form's range (g = 9,8 m/s²).
  expect(s?.y).toBeCloseTo(0, 6);
  expect(s?.x ?? NaN).toBeCloseTo(range, 2);
  return { view, errors };
}

test('Ném xiên in 3D: the ball lands at L = v₀²/g', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { view, errors } = await throwIn3d(page, 'Ném xiên', 'obliqueProjectile', 225 / 9.8);
  await expect(view.getByText('quỹ đạo tính trước bằng công thức', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('oblique-3d.png') });
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.stage__view-switch')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Ném ngang in 3D: from h₀ = 45 m the ball lands at v₀·√(2h₀/g)', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const { errors } = await throwIn3d(
    page,
    'Ném ngang',
    'horizontalProjectile',
    10 * Math.sqrt((2 * 45) / 9.8),
  );
  await page.screenshot({ path: testInfo.outputPath('horizontal-3d.png') });
  expect(errors).toEqual([]);
});

test('Rơi tự do in 3D: dropped from h₀ = 45 m it lands right below, with no range', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { view, errors } = await throwIn3d(page, 'Rơi tự do', 'freeFall', 0);
  await expect(view.locator('.three-label', { hasText: 'L =' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
