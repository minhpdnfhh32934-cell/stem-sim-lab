declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { meiosisOptions } from '../../src/biology/division/meiosisOptions';
import { openLab } from './nav';

/**
 * The meiosis 3D view. WebGL runs in software (SwiftShader) for every test of this file, never on
 * the GPU (see mitosis3d.spec.ts); each test checks the renderer before the 3D view starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Debug {
  stage(): string;
  settled(): boolean;
  anchor(id: string): { x: number; y: number } | null;
  info(): { geometries: number; programs: number };
}
const hook = (page: Page, fn: string, arg?: string) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.meiosis;
      if (!d) return null;
      if (f === 'anchor') return d.anchor(a ?? '');
      if (f === 'stage') return d.stage();
      if (f === 'settled') return d.settled();
      return d.info();
    },
    [fn, arg] as const,
  );

async function openMeiosis(page: Page) {
  // A slow test machine may measure as "low" quality, where the lesson uses the 2D picture.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no WebGL 2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  });
  expect(renderer, 'WebGL must run in software (SwiftShader), never on the GPU').toContain(
    'SwiftShader',
  );
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Giảm phân', exact: true }).click();
  await expect(page.locator('.mei3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('meiosis 3D: twelve stages, a picked part shows the model’s crossover point, 2D keeps the stage', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openMeiosis(page);
  await expect(page.locator('.science-card')).toContainText('Giảm phân 3D');
  const strip = page.getByRole('group', { name: 'Các kì' });
  await expect(strip.getByRole('button')).toHaveCount(12);

  // Metaphase I: pick the chiasma (or the bivalent in front of it) on the picture.
  await strip.getByRole('button', { name: 'Kì giữa I', exact: true }).click();
  await expect.poll(() => hook(page, 'stage')).toBe('metaphase1');
  // Basic mode glides (700 ms) to the chromosomes of metaphase I: pick once the camera is still.
  await expect.poll(() => hook(page, 'settled')).toBe(true);
  await expect(page.getByText('1 tế bào · 4 NST kép')).toBeVisible();
  const at = (await hook(page, 'anchor', 'chiasma')) as { x: number; y: number } | null;
  expect(at, 'the chiasma can be seen in metaphase I').not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
  const card = page.locator('.m3d__info');
  await expect(card).toBeVisible();
  // The lesson's own run (2n = 4, crossing over on, seed 1): its crossover point, as shown.
  const point = meiosisOptions(2, true, 1).crossovers[0]!.point;
  const shown = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(point);
  await expect(card).toContainText(`tại vị trí ${shown}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mei3d-meta1.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.mei3d button, .mei3d [role="radio"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 39.5 || r.height < 39.5))
      .map(({ el }) => el.getAttribute('aria-label') ?? el.textContent.trim());
    return {
      parts: ['.m3d__top', '.m3d__side', '.m3d__info', '.m3d__bottom'].map(box),
      small,
    };
  });
  expect(boxes.small).toEqual([]);
  const parts = boxes.parts.filter((x) => x !== null);
  expect(parts).toHaveLength(4);
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!;
      const b = parts[j]!;
      const overlap = a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      expect(overlap, `boxes ${i} and ${j} overlap`).toBe(false);
    }

  // Metaphase II: two cells, n double chromosomes each (counted from the model).
  await strip.getByRole('button', { name: 'Kì giữa II', exact: true }).click();
  await expect(page.getByText('2 tế bào · mỗi tế bào 2 NST kép')).toBeVisible();
  // Each cell has one chromosome of each pair: a "NST kép" label, never "NST tương đồng".
  await expect.poll(() => hook(page, 'anchor', 'doubleChromosome')).not.toBeNull();
  expect(await hook(page, 'anchor', 'homologousChromosome')).toBeNull();
  // 2D keeps the stage (meiosis has its own index map), and 3D comes back to it.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.mei3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  await expect(page.getByText('Kì giữa II', { exact: true }).first()).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.mei3d canvas')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => hook(page, 'stage')).toBe('metaphase2');

  // The end: four cells, n single chromosomes each.
  await strip.getByRole('button', { name: 'Chia tế bào chất II', exact: true }).click();
  await expect(
    page.getByText('Sau khi chia: 4 tế bào con · mỗi tế bào 2 NST đơn · 4 loại giao tử'),
  ).toBeVisible();
  const scroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(scroll, 'horizontal scroll at 1366 × 768').toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
