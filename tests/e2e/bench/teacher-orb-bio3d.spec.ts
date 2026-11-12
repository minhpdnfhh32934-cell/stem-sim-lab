declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';

/**
 * #234 step 2, AI Teacher's orb at 1366 × 768. WebGL runs in software (SwiftShader) at medium
 * quality; "bio3d" in the file name puts it in the chromium-3d project (HEAVY_3D, no config
 * change). The orb draws and keeps drawing; the board opens while it runs (loaded by hand, not
 * lazy()); Ctrl+K still opens; reduced motion draws it once; Low quality shows the rings; leaving
 * the page frees it.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface OrbDebug {
  picture: string;
  points: number;
  pairs: number;
  frames: number;
}
const orb = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __simlabOrb?: () => OrbDebug }).__simlabOrb?.() ?? null,
  );

async function openTeacher(page: Page, opts: { fontScale?: number; tier?: string } = {}) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(
    ([scale, tier]) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
      localStorage.setItem(
        'stemsim.perf',
        JSON.stringify({ state: { preference: tier, benchmark: null }, version: 1 }),
      );
    },
    [opts.fontScale ?? 1, opts.tier ?? 'medium'] as const,
  );
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await expect(page.getByRole('heading', { level: 1, name: 'AI Teacher' })).toBeVisible({
    timeout: 20_000,
  });
}

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const fontScale of [1, 1.4] as const) {
  test(`the orb draws and keeps drawing at ${String(fontScale * 100)} %; the board and Ctrl+K open while it runs`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openTeacher(page, { fontScale });
    const box = page.locator('.teacher-orb[data-picture="orb"]');
    await expect(box.locator('canvas')).toBeVisible({ timeout: 20_000 });
    await expect(box).toHaveAttribute('aria-hidden', 'true');
    const first = await orb(page);
    expect(first).toMatchObject({ picture: 'orb', points: 300 });
    expect(first?.pairs ?? 0).toBeGreaterThan(300);
    await expect
      .poll(async () => (await orb(page))?.frames ?? 0)
      .toBeGreaterThan((first?.frames ?? 0) + 5);
    expect(await sideScroll(page)).toBe(0);

    // The board loads while the orb draws every frame (by hand, not lazy(): #228).
    await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
    await expect(page.getByRole('region', { name: 'Bảng trắng của AI Teacher' })).toBeVisible({
      timeout: 20_000,
    });
    const small = await box.boundingBox();
    expect(small?.width ?? 0).toBeGreaterThan(40);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Escape');
    expect(await sideScroll(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('reduced motion: the orb is drawn once and stays still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTeacher(page);
  const box = page.locator('.teacher-orb[data-picture="still"]');
  await expect(box.locator('canvas')).toBeVisible({ timeout: 20_000 });
  const a = (await orb(page))?.frames ?? -1;
  expect(a).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(1500);
  // Only a resize or a new state draws it again; nothing runs per frame.
  expect((await orb(page))?.frames ?? -1).toBeLessThanOrEqual(a + 2);
});

test('Low quality: the light SVG rings, no orb; leaving the page frees the orb', async ({
  page,
}) => {
  await openTeacher(page, { tier: 'low' });
  await expect(page.locator('.teacher-ring')).toBeVisible();
  await expect(page.locator('.teacher-orb')).toHaveCount(0);
  expect(await orb(page)).toBeNull();
});

test('leaving AI Teacher frees the orb (its canvas and hooks go)', async ({ page }) => {
  await openTeacher(page);
  await expect(page.locator('.teacher-orb canvas')).toBeVisible({ timeout: 20_000 });
  await page.locator('.teacher__back').click();
  await expect(page.locator('.teacher-orb canvas')).toHaveCount(0);
  expect(await orb(page)).toBeNull();
});
