import { expect, test, type Page } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * #205 C3: with "reduce motion" on in the system, a lesson opens paused and moves only after the
 * learner presses "Chạy" (D0, in its usual place). Without it, the particle lessons run on open as
 * before. Biology 3D views (autoplay) are covered by `usePlayback` unit tests.
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
      const main = page.locator('.bench-edge__main');
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
});

test('without reduced motion the particle lessons still run on open', async ({ page }) => {
  await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
  const main = page.locator('.bench-edge__main');
  await expect(main.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  const t0 = await lessonTime(page, 'gas');
  await expect.poll(() => lessonTime(page, 'gas'), { timeout: 10_000 }).toBeGreaterThan(t0);
});
