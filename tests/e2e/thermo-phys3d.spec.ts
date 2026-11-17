declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6d of #302: the ideal gas (two states in cylinders) and heat (a sample's particles in
 * three states) in 3D. Both modules open in 2D; the switch over the picture offers 3D. WebGL runs
 * in software (SwiftShader).
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  state(): Record<string, unknown> | null;
}
const state = <T>(page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d?.[
      l
    ];
    return h?.state() ?? null;
  }, lesson) as Promise<T | null>;

async function open(page: Page, errors: string[], topic: string) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Vật lý', topic);
  await expect(page.locator('.stage__hud-title').first()).toHaveText(topic, { timeout: 20_000 });
}

test('Khí lí tưởng in 3D: two states, columns ∝ V, the same gas', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Các định luật của khí lí tưởng');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="idealGas"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  // The worked example of Bài 11: 100 cm³ = 0,1 L at 10⁵ Pa, 300 K → 0,02 L at 5,2·10⁵ Pa.
  await expect(view.locator('.three-label', { hasText: 'p₂ = 5,2·10⁵ Pa' })).toBeVisible();
  await expect(view.locator('.three-label', { hasText: 'V₁ = 0,1 L' })).toBeVisible();
  type S = { heights: number[]; speeds: number[] };
  const s = await state<S>(page, 'idealGas');
  expect((s?.heights[1] ?? 0) / (s?.heights[0] ?? 1)).toBeCloseTo(0.2, 12);
  await page.screenshot({ path: testInfo.outputPath('gas-3d.png') });
  // The data tables stay 2D.
  await page.getByRole('radio', { name: 'Thí nghiệm SGK' }).click();
  await expect(view).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Nhiệt lượng in 3D: the share melted follows the cursor on the curve', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Nội năng, nhiệt độ và nhiệt lượng');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="heatAndPhase"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = { solid: number; liquid: number; gas: number; kind: string };
  await expect.poll(async () => (await state<S>(page, 'heatAndPhase'))?.kind).toBe('heatSolid');
  // Move the cursor to the end: 2 kg of copper all molten (p. 24).
  const slider = page.getByRole('slider', { name: 'Thời điểm τ' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await state<S>(page, 'heatAndPhase'))?.liquid).toBe(216);
  await expect(view.locator('.three-label', { hasText: /đang nóng chảy/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('heat-3d.png') });
  expect(errors).toEqual([]);
});
