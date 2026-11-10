declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * "Tế bào nhân sơ và nhân thực" in 3D (#37 §15): the three cells, a tap on a part opens its name
 * and function, "Hiện tên", the 3D / 2D switch, and the 2D picture on a weak device. WebGL runs
 * in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface CellState {
  kind: string;
  parts: string[];
  named: string[];
  selected: string | null;
}
interface Hook {
  frames(): number;
  state(): CellState | null;
}
const hook = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d;
    return h ? { frames: h.frames(), state: h.state() } : null;
  });

async function openCell(page: Page, errors: string[], tier = 'medium'): Promise<void> {
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
  await page.getByRole('button', { name: 'Tế bào nhân sơ và nhân thực', exact: true }).click();
}

test('cell 3D: three cells, a tap opens the part card, names, 3D ↔ 2D', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await openCell(page, errors);
  const view = page.locator('.bio3d[data-lesson="cellStructure"]');
  const canvas = view.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await hook(page))?.frames ?? 0).toBeGreaterThan(0);

  // Each cell draws exactly its own parts.
  const panel = page.locator('.cell-parts');
  for (const [label, kind] of [
    ['Vi khuẩn', 'bacterium'],
    ['Thực vật', 'plant'],
    ['Động vật', 'animal'],
  ] as const) {
    await panel.getByRole('radio', { name: label }).click();
    await expect.poll(async () => (await hook(page))?.state?.kind).toBe(kind);
  }
  const parts = (await hook(page))?.state?.parts ?? [];
  expect(parts).toContain('nucleus');
  expect(parts).not.toContain('chloroplast');

  // A tap in the middle of the animal cell picks an organelle (never the membrane around it);
  // the Inspector shows that part's name and function.
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await hook(page))?.state?.selected ?? null).not.toBeNull();
  const picked = (await hook(page))?.state?.selected ?? '';
  expect(['membrane', 'cytoplasm']).not.toContain(picked);
  const pressed = panel.locator('.m3d-parts__item[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  const name = (await pressed.textContent()) ?? '';
  await expect(panel.locator('.cell-part-card strong')).toHaveText(name);

  // "Hiện tên": every part of the cell gets its label.
  const names = view.getByRole('button', { name: 'Hiện tên các bộ phận' });
  if ((await names.getAttribute('aria-pressed')) !== 'true') await names.click();
  await expect.poll(async () => (await hook(page))?.state?.named.length ?? 0).toBe(parts.length);

  // The learner's 2D choice, then back to 3D (remembered per device).
  await view.getByRole('radio', { name: '2D' }).click();
  const flat = page.locator('.cell2d');
  await expect(flat.locator('canvas')).toBeVisible();
  await flat.getByRole('radio', { name: '3D' }).click();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  expect(errors).toEqual([]);
});

test('cell: a weak device (Low tier) shows the 2D picture and says why', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  await openCell(page, errors, 'low');
  const flat = page.locator('.cell2d');
  await expect(flat.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.bio3d[data-lesson="cellStructure"]')).toHaveCount(0);
  await expect(flat.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/)).toBeVisible();
  expect(errors).toEqual([]);
});
