declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6h of #302: the Sinh học 12 lessons in 3D. What is bound, free or transcribed comes from
 * the lesson's model. WebGL runs in software (SwiftShader).
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

const state = <T>(page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (
      window as unknown as { __simlab3d?: Record<string, { state(): unknown } | undefined> }
    ).__simlab3d?.[l];
    return (h?.state() ?? null) as T | null;
  }, lesson);

test('Operon lac in 3D: repressed without lactose, transcribed with it', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Điều hòa biểu hiện gene: operon lac');
  await page.getByRole('radio', { name: '3D' }).first().click();
  const view = page.locator('.bio3d[data-lesson="lacOperon"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = { repressorOnOperator: boolean | null; polymeraseOnGenes: boolean; mrna: boolean };
  await expect
    .poll(async () => (await state<S>(page, 'lacOperon'))?.repressorOnOperator)
    .toBe(true);
  expect((await state<S>(page, 'lacOperon'))?.polymeraseOnGenes).toBe(false);
  await page.getByRole('radio', { name: 'Có', exact: true }).first().click();
  await expect.poll(async () => (await state<S>(page, 'lacOperon'))?.polymeraseOnGenes).toBe(true);
  const s = await state<S>(page, 'lacOperon');
  expect(s?.repressorOnOperator).toBe(false);
  expect(s?.mrna).toBe(true);
  await expect(view.getByText('Các gene cấu trúc được phiên mã')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('operon-3d.png') });
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.operon__dna')).toBeVisible();
  expect(errors).toEqual([]);
});
