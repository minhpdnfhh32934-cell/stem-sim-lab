declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * SH10 KNTT Bài 5 and Bài 24 in 3D (#255 round 1g): the biomolecule ball-and-stick and the
 * illustrative virus, a part picked from the Inspector, "Hiện tên", the 3D / 2D switch, and the 2D
 * picture on a weak device. WebGL runs in software (SwiftShader), never on the GPU.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  frames(): number;
  state(): Record<string, unknown> | null;
}
const hook = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d;
    return h ? { frames: h.frames(), state: h.state() } : null;
  });

async function open(page: Page, errors: string[], topic: string, tier = 'medium') {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript((t) => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: t, benchmark: null }, version: 1 }),
    );
  }, tier);
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: topic, exact: true }).click();
}

test('Các phân tử sinh học: four groups in 3D, a monomer part, names, 3D ↔ 2D', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await open(page, errors, 'Các phân tử sinh học');
  const view = page.locator('.bio3d[data-lesson="biomolecules"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await hook(page))?.frames ?? 0).toBeGreaterThan(0);
  await expect.poll(async () => (await hook(page))?.state?.molecule).toBe('alanine');

  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await expect(panel.getByTestId('biomol-formula')).toContainText('PubChem CID 5950');
  await panel.getByRole('button', { name: 'Nhóm amino (–NH₂)' }).click();
  await expect.poll(async () => (await hook(page))?.state?.selected).toBe('amino');

  // "Hiện tên": every part of the monomer gets its label (on in Basic mode).
  await expect
    .poll(async () => ((await hook(page))?.state?.named as string[] | undefined)?.length)
    .toBe(4);

  for (const [group, id, cid] of [
    ['Nucleic acid', 'damp', '12599'],
    ['Carbohydrate', 'glucose', '64689'],
    ['Lipid', 'palmitic', '985'],
  ] as const) {
    await panel.getByRole('radio', { name: group }).click();
    await expect.poll(async () => (await hook(page))?.state?.molecule).toBe(id);
    await expect(panel.getByTestId('biomol-formula')).toContainText(`PubChem CID ${cid}`);
  }
  await panel.getByRole('radio', { name: 'Glycerol' }).click();
  await expect.poll(async () => (await hook(page))?.state?.molecule).toBe('glycerol');

  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.getByRole('img', { name: 'Glycerol' })).toBeVisible();
  await expect(view).toHaveCount(0);
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  expect(errors).toEqual([]);
});

test('Khái quát về virus: capsid, envelope switch, a part card, five stages', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await open(page, errors, 'Khái quát về virus');
  const view = page.locator('.bio3d[data-lesson="virusStructure"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await hook(page))?.frames ?? 0).toBeGreaterThan(0);
  await expect
    .poll(async () => (await hook(page))?.state)
    .toMatchObject({
      enveloped: true,
      capsomeres: 92,
      spikes: 48,
    });

  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await panel.getByRole('button', { name: 'Gai glycoprotein' }).click();
  await expect.poll(async () => (await hook(page))?.state?.selected).toBe('spikes');
  await expect(panel.locator('.cell-part-card')).toContainText('bám vào tế bào chủ');

  await panel.getByRole('radio', { name: 'Không có vỏ ngoài' }).click();
  await expect
    .poll(async () => (await hook(page))?.state)
    .toMatchObject({
      enveloped: false,
      spikes: 0,
      selected: null,
    });
  await expect(panel.getByRole('button', { name: 'Gai glycoprotein' })).toHaveCount(0);

  // A tap in the middle picks something inside (core or capsid), never empty space.
  const box = await view.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await hook(page))?.state?.selected ?? null).not.toBeNull();

  const steps = page.locator('.virus-steps');
  await expect(steps.getByText(/Giai đoạn 1: Hấp phụ\./)).toBeVisible();
  await steps.getByRole('button', { name: 'Giai đoạn sau' }).click();
  await expect(steps.getByText(/Giai đoạn 2: Xâm nhập\./)).toBeVisible();
  await steps.getByRole('radio', { name: '4. Lắp ráp' }).click();
  await expect(steps.getByText(/Lõi nucleic acid được lắp vào vỏ protein/)).toBeVisible();

  await expect(page.locator('.science-card')).toContainText('Định tính');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  expect(errors).toEqual([]);
});

test('a weak device (Low tier) shows both lessons in 2D and says why', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  await open(page, errors, 'Khái quát về virus', 'low');
  await expect(page.getByRole('img', { name: 'Hình minh họa virus có vỏ ngoài' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.bio3d')).toHaveCount(0);
  await expect(page.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/)).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('button', { name: 'Các phân tử sinh học', exact: true })
    .click();
  await expect(page.getByRole('img', { name: 'Alanine (L-alanine)' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.bio3d')).toHaveCount(0);
  expect(errors).toEqual([]);
});
