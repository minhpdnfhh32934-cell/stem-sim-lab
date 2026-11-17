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

test('Di truyền giới tính in 3D: Morgan’s cross, four cells, sons get the mother’s X', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Di truyền giới tính và liên kết với giới tính');
  await page.getByRole('radio', { name: '3D' }).first().click();
  const view = page.locator('.bio3d[data-lesson="sexLinkage"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = { cells: { alleles: string; sex: string; dominant: boolean }[] };
  // Opens on Morgan's forward cross XᴬXᴬ × XᵃY: daughters XᴬXᵃ, sons XᴬY, all red-eyed.
  await expect.poll(async () => (await state<S>(page, 'sexLinkage'))?.cells.length).toBe(4);
  const s = await state<S>(page, 'sexLinkage');
  expect(s?.cells.every((c) => c.dominant)).toBe(true);
  expect(s?.cells.filter((c) => c.sex === 'male').map((c) => c.alleles)).toEqual(['A', 'A']);
  await expect(view.getByText('XᴬXᵃ · mắt đỏ · 1/4').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('sexlinked-3d.png') });
  expect(errors).toEqual([]);
});

test('Liên kết gene in 3D: the bivalent crosses over; the columns are 41,5 : 41,5 : 8,5 : 8,5 %', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Liên kết gene và hoán vị gene');
  await page.getByRole('radio', { name: '3D' }).first().click();
  const view = page.locator('.bio3d[data-lesson="geneLinkage"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = { crossover: boolean; heights: number[] };
  await expect.poll(async () => (await state<S>(page, 'geneLinkage'))?.crossover).toBe(true);
  // Opens on the F1 female, 34 % of cells crossing over (Hình 11.2–11.3).
  const h = (await state<S>(page, 'geneLinkage'))?.heights ?? [];
  expect(h.map((x) => Math.round(x * 100) / 1000)).toEqual([0.415, 0.415, 0.085, 0.085]);
  await expect(view.getByText('41,5 %').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('linkage-3d.png') });
  expect(errors).toEqual([]);
});

test('Đột biến NST in 3D: the gene orders of Hình 12.1 with their links', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Đột biến nhiễm sắc thể');
  await page.getByRole('radio', { name: '3D' }).first().click();
  const view = page.locator('.bio3d[data-lesson="chromosomeMutation"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = { before: string[]; after: string[]; links: number };
  // Opens on a deletion: abcdefg → abcg, four genes keep a link.
  await expect
    .poll(async () => (await state<S>(page, 'chromosomeMutation'))?.after)
    .toEqual(['abcg']);
  expect((await state<S>(page, 'chromosomeMutation'))?.links).toBe(4);
  await page.screenshot({ path: testInfo.outputPath('chromosome-3d.png') });
  expect(errors).toEqual([]);
});
