import { expect, test, type Page } from '@playwright/test';
import { openLab, openTopic } from './nav';

/**
 * #205 C3, carried over from the bench spec written after PR #198: with "reduce motion" on in the
 * system, a lesson opens paused and moves only after the learner presses "Chạy" (the timeline's
 * button in physics, the stage's own button in the particle lessons). Without it, the particle
 * lessons run on open as before. Biology 3D views (autoplay) are covered by `usePlayback` unit
 * tests.
 */

/** The time a lesson reached, read from the app's own store. */
const lessonTime = (page: Page, which: 'physics' | 'gas' | 'equilibrium') =>
  page.evaluate(async (w) => {
    const load = (m: string) => import(/* @vite-ignore */ m) as Promise<Record<string, unknown>>;
    if (w === 'physics') {
      const { useWorkspaceStore } = (await load('/src/app/workspaceStore.ts')) as {
        useWorkspaceStore: { getState(): { simTime: number } };
      };
      return useWorkspaceStore.getState().simTime;
    }
    if (w === 'gas') {
      const { gasRuntime } = (await load('/src/chemistry/particles/gasStore.ts')) as {
        gasRuntime: { gas: { time: number } | null };
      };
      return gasRuntime.gas?.time ?? -1;
    }
    const { useEqStore } = (await load('/src/chemistry/particles/eqStore.ts')) as {
      useEqStore: { getState(): { t: number } };
    };
    return useEqStore.getState().t;
  }, which);

const LESSONS = [
  ['Vật lý', 'Sóng dừng trên dây', 'physics', 'Chạy (Space)', 'Tạm dừng (Space)'],
  ['Hóa học', 'Phân bố Maxwell–Boltzmann', 'gas', 'Chạy', 'Tạm dừng'],
  ['Hóa học', 'Cân bằng hóa học & Le Chatelier', 'equilibrium', 'Chạy', 'Tạm dừng'],
] as const;

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const [subject, topic, which, run, pause] of LESSONS) {
    test(`${topic} opens paused and runs only on "Chạy"`, async ({ page }) => {
      await openTopic(page, subject, topic);
      // The lesson's own run button: under the stage (physics) or on it (particle lessons).
      const main = page.getByRole('main');
      const play = main.getByRole('button', { name: run, exact: true });
      await expect(play).toBeVisible({ timeout: 20_000 });
      const t0 = await lessonTime(page, which);
      await page.waitForTimeout(1000);
      expect(await lessonTime(page, which)).toBe(t0);
      await play.click();
      await expect(main.getByRole('button', { name: pause, exact: true })).toBeVisible();
      await expect.poll(() => lessonTime(page, which), { timeout: 10_000 }).toBeGreaterThan(t0);
    });
  }

  test('the gas picture follows the model once "Chạy" is pressed', async ({ page }) => {
    await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
    const main = page.getByRole('main');
    const canvas = main.locator('canvas.chem-canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const picture = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const before = await picture();
    await main.getByRole('button', { name: 'Chạy', exact: true }).click();
    await expect.poll(picture, { timeout: 10_000 }).not.toBe(before);
  });
});

test('without reduced motion the particle lessons still run on open', async ({ page }) => {
  await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  const t0 = await lessonTime(page, 'gas');
  await expect.poll(() => lessonTime(page, 'gas'), { timeout: 10_000 }).toBeGreaterThan(t0);
});

/** Settings → Giao diện → Chuyển động (#195 step 2): the app's own choice, kept across a reload. */
async function chooseMotion(page: Page, label: 'Giảm' | 'Đầy đủ') {
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });
  await settings.getByRole('tab', { name: /Giao diện/ }).click();
  await settings
    .getByRole('radiogroup', { name: 'Chuyển động trong app' })
    .getByRole('radio', { name: label })
    .click();
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
}

const durFast = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--dur-fast').trim(),
  );

test('"Giảm" in the app stops motion although the system asks for none (#195)', async ({
  page,
}) => {
  await chooseMotion(page, 'Giảm');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  expect(await durFast(page)).toBe('0ms');
  // A fresh start (openTopic reloads): theme-boot and the saved setting keep it.
  await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Chạy', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  const t0 = await lessonTime(page, 'gas');
  await page.waitForTimeout(1000);
  expect(await lessonTime(page, 'gas')).toBe(t0);
});

test.describe('the system asks for reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('"Đầy đủ" in the app keeps full motion (#195)', async ({ page }) => {
    await chooseMotion(page, 'Đầy đủ');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    expect(await durFast(page)).not.toBe('0ms');
    await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const t0 = await lessonTime(page, 'gas');
    await expect.poll(() => lessonTime(page, 'gas'), { timeout: 10_000 }).toBeGreaterThan(t0);
  });
});
