declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6b of #302: "Điện trường của điện tích điểm" in 3D. The scene opens in 2D (its canvas);
 * the switch under the HUD offers 3D, which draws the model's own field lines (turned about the
 * charges' line), the charges and E at M; the capacitor shows its uniform field. WebGL runs in
 * software (SwiftShader), never on the GPU.
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  frames(): number;
  state(): Record<string, unknown> | null;
}
const state = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d
      ?.electricField;
    return h ? { frames: h.frames(), state: h.state() } : null;
  });

test('Điện trường in 3D: field lines in space, E at M, the capacitor, back to 2D', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Vật lý', 'Điện trường của điện tích điểm');
  await expect(page.locator('.stage__hud-title')).toHaveText('Điện trường của điện tích điểm', {
    timeout: 20_000,
  });
  const sw = page.locator('.stage__view-switch');
  await expect(sw.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.stage__canvas')).toBeVisible();
  await sw.getByRole('radio', { name: '3D' }).click();

  const view = page.locator('.bio3d[data-lesson="electricField"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.stage__canvas')).toHaveCount(0);
  // The canvas tools (ruler, protractor…) do nothing in 3D: hidden there.
  await expect(page.locator('.stage__toolbar')).toHaveCount(0);
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(0);
  const s = (await state(page))?.state as { lines: number; arrowheads: number; charges: number };
  // Two charges on one line: the plane's lines drawn three times (0°, 60°, 120°).
  expect(s.charges).toBe(2);
  expect(s.lines % 3).toBe(0);
  expect(s.lines).toBeGreaterThan(0);
  expect(s.arrowheads).toBe(s.lines);
  await expect(view.locator('.chem-chip', { hasText: /^E\(M\) = .+ V\/m$/ })).toBeVisible();
  await expect(
    view.getByRole('img', { name: /Đường sức điện trong không gian; tại M: E = / }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('field-3d.png') });

  // The capacitor: a uniform field between the plates, E = U/d.
  await page.getByRole('radio', { name: 'Tụ điện phẳng' }).click();
  await expect(view.locator('.chem-chip', { hasText: /^U = .+, d = .+, E = .+$/ })).toBeVisible();
  await expect
    .poll(async () => ((await state(page))?.state as { charges: number }).charges)
    .toBe(0);
  await page.screenshot({ path: testInfo.outputPath('plates-3d.png') });

  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.stage__canvas')).toBeVisible();
  await expect(page.locator('.stage__toolbar')).toBeVisible();
  await expect(view).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

const potentialState = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d
      ?.electricPotential;
    return h ? (h.state() as { charge: number[]; planes: number } | null) : null;
  });

test('Điện thế in 3D: equipotential planes through M and N, the charge moved by the engine', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Thế năng điện. Điện thế');
  await expect(page.locator('.stage__hud-title')).toHaveText('Thế năng điện. Điện thế', {
    timeout: 20_000,
  });
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="electricPotential"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  // The example of p. 81: U = 36 V, M in the middle (18 V), N on the − plate (0 V).
  await expect(view.locator('.three-label', { hasText: 'Vₘ = 18 V' })).toBeVisible();
  await expect.poll(async () => (await potentialState(page))?.planes).toBe(2);
  const before = (await potentialState(page))?.charge ?? [];
  expect(before[1]).toBeCloseTo(0.02, 12);
  // Run: the engine carries the charge from M down to N in 4 s; the 3D picture follows it.
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await expect
    .poll(async () => (await potentialState(page))?.charge[1] ?? 1, { timeout: 20_000 })
    .toBeLessThan(0.019);
  await page.screenshot({ path: testInfo.outputPath('potential-3d.png') });
  await expect
    .poll(async () => (await potentialState(page))?.charge[1] ?? 1, { timeout: 20_000 })
    .toBeCloseTo(0, 9);
  expect(errors).toEqual([]);
});
