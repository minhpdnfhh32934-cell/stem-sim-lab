import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 C1: a periodic lesson runs until the learner pauses it. Two-source interference used to
 * stop at 20 periods (2 s with the defaults) and show "Kết thúc"; the standing wave at 0.8 s.
 */
async function openPhysics(page: Page, topic: string) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
  await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
}

/** The time the engine reached, from the app's own store (the edge shows it rounded). */
const simTime = (page: Page) =>
  page.evaluate(async () => {
    const mod = '/src/app/workspaceStore.ts';
    const { useWorkspaceStore } = (await import(/* @vite-ignore */ mod)) as {
      useWorkspaceStore: { getState(): { simTime: number } };
    };
    return useWorkspaceStore.getState().simTime;
  });

for (const [topic, oldEnd] of [
  ['Giao thoa sóng hai nguồn', 2],
  ['Sóng dừng trên dây', 0.8],
] as const) {
  test(`${topic} runs past its former end (${String(oldEnd)} s) until paused`, async ({ page }) => {
    await openPhysics(page, topic);
    await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
    const pause = page.getByRole('button', { name: 'Tạm dừng (Space)' }).first();
    await expect(pause).toBeVisible();
    await expect.poll(() => simTime(page), { timeout: 30_000 }).toBeGreaterThan(oldEnd + 1);
    // Still running: no "Kết thúc", the main action still pauses.
    await expect(pause).toBeVisible();
    await expect(page.getByText('Kết thúc', { exact: true })).toHaveCount(0);
    await pause.click();
    await expect(page.getByRole('button', { name: 'Chạy (Space)' }).first()).toBeVisible();
    const stopped = await simTime(page);
    await page.waitForTimeout(500);
    expect(await simTime(page)).toBe(stopped);
  });
}
