declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D view of "Di truyền Mendel". WebGL runs in software (SwiftShader) for every test of this
 * file, never on the GPU (see mitosis3d.spec.ts); the renderer is checked before the 3D view
 * starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Sel =
  { kind: 'cell'; row: number; col: number } | { kind: 'gamete'; parent: 0 | 1; index: number };
interface Debug {
  ratio(): string;
  step(): number;
  field(): number;
  focus(sel: Sel): { x: number; y: number } | null;
  moving(): boolean;
}
/** Calls one read-only debug hook of the view (`window.__simlab3d.mendel`). */
const hook = (page: Page, fn: 'ratio' | 'step' | 'field' | 'focus' | 'moving', arg?: Sel) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.mendel;
      if (!d) return null;
      if (f === 'ratio') return d.ratio();
      if (f === 'step') return d.step();
      if (f === 'field') return d.field();
      if (f === 'moving') return d.moving();
      return d.focus(a as Sel);
    },
    [fn, arg] as const,
  );

async function openMendel(page: Page) {
  // A slow test machine may measure as "low" quality, where the lesson uses the 2D page.
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
  await page.getByRole('button', { name: 'Di truyền Mendel', exact: true }).click();
  await expect(page.locator('.men3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('Mendel 3D: the ratio from the model, a picked cell’s card, a draw, the 2D page', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openMendel(page);
  await expect(page.locator('.science-card')).toContainText('Di truyền Mendel 3D');
  // The lesson's default AaBb × AaBb: the model's reduced ratio, shown once.
  await expect(page.getByText('9 : 3 : 3 : 1', { exact: true })).toBeVisible();
  expect(await hook(page, 'ratio')).toBe('9 : 3 : 3 : 1');
  expect(await hook(page, 'step')).toBe(3);
  await expect(page.locator('.m3d__caption')).toContainText(
    'Màu chỉ phân biệt nhóm kiểu hình, không phải màu thật của tính trạng.',
  );

  // Pick the board cell of row 1, column 2 (AB × Ab = AABb): genotype, fraction, phenotype.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const cell = (await hook(page, 'focus', { kind: 'cell', row: 0, col: 1 })) as {
    x: number;
    y: number;
  } | null;
  expect(cell, 'the cell is in view').not.toBeNull();
  await page.mouse.click(cell!.x, cell!.y);
  const card = page.locator('.m3d__info');
  await expect(card).toContainText('Ô hàng 1 · cột 2: AABb');
  await expect(card).toContainText('Xác suất ô này: 1/4 × 1/4 = 1/16.');
  await expect(card).toContainText('Kiểu hình A_ B_ — trội về gen A/a, trội về gen B/b: 9/16.');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mendel3d-cell.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.men3d button, .men3d [role="radio"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 39.5 || r.height < 39.5))
      .map(({ el }) => el.getAttribute('aria-label') ?? el.textContent.trim());
    return {
      parts: ['.m3d__top', '.m3d__side', '.m3d__info', '.m3d__bottom'].map(box),
      small,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(boxes.small).toEqual([]);
  expect(boxes.scroll).toBeLessThanOrEqual(0);
  const parts = boxes.parts.filter((x) => x !== null);
  expect(parts).toHaveLength(4);
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!;
      const b = parts[j]!;
      const overlap = a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      expect(overlap, `boxes ${i} and ${j} overlap`).toBe(false);
    }

  // A gamete of the father: its exact probability.
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const gamete = (await hook(page, 'focus', { kind: 'gamete', parent: 1, index: 3 })) as {
    x: number;
    y: number;
  } | null;
  expect(gamete, 'the gamete is in view').not.toBeNull();
  await page.mouse.click(gamete!.x, gamete!.y);
  await expect(card).toContainText('Giao tử ♂ ab');
  await expect(card).toContainText('Xác suất: 1/4 (từ bố AaBb).');
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();

  // A random draw: 1000 offspring, one figure per 5; the 2D table shows the same counts.
  await page.getByRole('button', { name: 'Tạo ngẫu nhiên 1.000 con lai' }).click();
  await expect(page.getByText('Mỗi hình ≈ 5 cá thể (làm tròn).')).toBeVisible();
  await expect.poll(() => hook(page, 'field')).toBe(200);
  const observed = (await page.locator('.men3d__row .chem-chip strong.mono').first().textContent())
    ?.split(' : ')
    .map((s) => s.trim());
  expect(observed).toHaveLength(4);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mendel3d-draw.png` });

  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.men3d')).toHaveCount(0);
  await expect(page.getByText('9 : 3 : 3 : 1', { exact: true })).toBeVisible();
  const table = await page.locator('.mendel-mc tbody tr td.num:first-of-type').allTextContents();
  expect(table.slice(0, 4).map((s) => s.trim())).toEqual(observed);
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.men3d canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
