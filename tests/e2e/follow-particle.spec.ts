import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** The followed particle's path, read from the app's own gas runtime. */
const trail = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const m = (await (async (p: string) =>
      import(/* @vite-ignore */ p) as Promise<Record<string, unknown>>)(
      '/src/chemistry/particles/gasStore.ts',
    )) as { gasRuntime: { trail: { x: number; y: number; t: number }[] } };
    return m.gasRuntime.trail.length;
  });

/** #195 step 6: "Theo dõi một hạt" in the gas box draws one particle of the model and its path. */
test('Theo dõi một hạt: one particle and its recent path, labelled as an illustration', async ({
  page,
}) => {
  await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
  const main = page.getByRole('main');
  const follow = main.getByRole('button', { name: 'Theo dõi một hạt' });
  await expect(follow).toBeVisible({ timeout: 20_000 });
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByText(/Một hạt của mô hình và đường nó vừa đi/)).toBeVisible();
  await expect.poll(() => trail(page), { timeout: 10_000 }).toBeGreaterThan(10);
  // The same size as the stage's other icon buttons (they grow to 40 px on touch screens).
  const box = await follow.boundingBox();
  const restart = await main.getByRole('button', { name: 'Làm lại từ đầu' }).boundingBox();
  expect(box?.height).toBe(restart?.height);
  await page.screenshot({ path: 'test-results/follow-particle.png' });
  await follow.click();
  await expect(main.getByText(/Một hạt của mô hình/)).toHaveCount(0);
});
