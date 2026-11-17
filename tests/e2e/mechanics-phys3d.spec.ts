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

test('Chuyển động tròn đều in 3D: the body stays on the circle, v ⊥ r, a towards the centre', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Chuyển động tròn đều');
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="uniformCircularMotion"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const read = () =>
    page.evaluate(() => {
      const h = (
        window as unknown as {
          __simlab3d?: Record<
            string,
            { state(): { at: number[]; v: number[]; a: number[] } | null } | undefined
          >;
        }
      ).__simlab3d?.uniformCircularMotion;
      return h?.state() ?? null;
    });
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  await page.waitForTimeout(1500);
  const s = await read();
  const [x = 0, , z = 0] = s?.at ?? [];
  const [vx = 0, , vz = 0] = s?.v ?? [];
  const [ax = 0, , az = 0] = s?.a ?? [];
  // r = 1 m by default: the body is on the circle, v is tangent, a points to the centre (the
  // engine's state reaches the page in single precision: 5 digits).
  expect(Math.hypot(x, z)).toBeCloseTo(1, 5);
  expect(vx * x + vz * z).toBeCloseTo(0, 5);
  expect((ax * x + az * z) / (Math.hypot(ax, az) * Math.hypot(x, z))).toBeCloseTo(-1, 5);
  await page.screenshot({ path: testInfo.outputPath('circular-3d.png') });
  expect(errors).toEqual([]);
});

test('Định luật II Kepler in 3D: the orbit, equal slices, the swept one follows the planet', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Định luật II Kepler');
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="keplerOrbit"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const slice = () =>
    page.evaluate(() => {
      const h = (
        window as unknown as {
          __simlab3d?: Record<string, { state(): { slice: number } | null } | undefined>;
        }
      ).__simlab3d?.keplerOrbit;
      return h?.state()?.slice ?? -1;
    });
  expect(await slice()).toBe(0);
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  // T = 12 s, N = 6 by default: a new slice every 2 s.
  await expect.poll(slice, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(view.getByText('Mặt Trời', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('kepler-3d.png') });
  expect(errors).toEqual([]);
});

test('Con lắc đơn in 3D: the bob swings on its string, ℓ from the pivot, within ±α₀', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Con lắc đơn');
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="simplePendulum"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => {
    const h = (
      window as unknown as {
        __simlab3d?: Record<string, { state(): { th: number; bob: number[] } | null } | undefined>;
      }
    ).__simlab3d?.simplePendulum;
    return h?.state() ?? null;
  });
  // ℓ = 1 m and α₀ = 60° by default.
  expect(Math.hypot(...(s?.bob ?? []))).toBeCloseTo(1, 5);
  expect(Math.abs(s?.th ?? 9)).toBeLessThanOrEqual(Math.PI / 3 + 1e-5);
  await page.screenshot({ path: testInfo.outputPath('pendulum-3d.png') });
  expect(errors).toEqual([]);
});

test('Con lắc lò xo in 3D: the block oscillates within ±A, horizontal then vertical', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Con lắc lò xo');
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="springPendulum"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const read = () =>
    page.evaluate(() => {
      const h = (
        window as unknown as {
          __simlab3d?: Record<
            string,
            { state(): { x: number; block: number[] } | null } | undefined
          >;
        }
      ).__simlab3d?.springPendulum;
      return h?.state() ?? null;
    });
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  await page.waitForTimeout(800);
  // x₀ = 5 cm, v₀ = 0, no damping: the block stays within ±5 cm, on the ground line.
  const h = await read();
  expect(Math.abs(h?.x ?? 9)).toBeLessThanOrEqual(0.05 + 1e-6);
  expect(h?.block[0]).toBeCloseTo(h?.x ?? NaN, 6);
  await page.screenshot({ path: testInfo.outputPath('spring-h-3d.png') });
  await page.getByRole('radio', { name: 'Thẳng đứng' }).click();
  await expect(view.getByText('VTCB', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Chạy/ }).first().click();
  await page.waitForTimeout(800);
  const v = await read();
  expect(v?.block[0]).toBe(0);
  expect(v?.block[1]).toBeCloseTo(v?.x ?? NaN, 6);
  await page.screenshot({ path: testInfo.outputPath('spring-v-3d.png') });
  expect(errors).toEqual([]);
});
