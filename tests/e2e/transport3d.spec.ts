declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D view of "Khuếch tán & thẩm thấu". WebGL runs in software (SwiftShader) for every test of
 * this file, never on the GPU (see mitosis3d.spec.ts); the renderer is checked before the 3D view
 * starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Vec3 = [number, number, number];
type Sel = { kind: 'particle'; index: number } | { kind: 'membrane' };
type Pt = { x: number; y: number };
interface Debug {
  mode(): string;
  counts(): { n1: number; n2: number; left: number; right: number } | null;
  heights(): { hL: number; hR: number; drawnL: number; drawnR: number; sceneL: number } | null;
  focus(sel: Sel): Pt | null;
  point(p: Vec3): Pt | null;
  moving(): boolean;
}
/** Calls one read-only debug hook of the view (`window.__simlab3d.transport`). */
const hook = <T>(page: Page, fn: keyof Debug, arg?: Sel | Vec3) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.transport;
      if (!d) return null;
      if (f === 'focus') return d.focus(a as Sel);
      if (f === 'point') return d.point(a as Vec3);
      return d[f]();
    },
    [fn, arg] as const,
  ) as unknown as Promise<T | null>;

const vi = (v: number, d = 3) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

/**
 * The lesson's defaults (C₁ = 10 mM, C₂ = 0, V₁ = V₂ = 1 mL, PA = 0,2 mL/phút, 160 particles):
 * N₁(t) = round(160 · C₁(t)V₁ / (C₁⁰V₁ + C₂⁰V₂)), C₁(t) = 5 + 5·e^(−0,4t) (exact Fick).
 */
const n1At = (t: number) => {
  const c1 = 5 + 5 * Math.exp(-0.4 * t);
  const q = (160 * c1) / 10;
  // Two classes by largest remainders: half rounds to side 1.
  return q - Math.floor(q) >= 0.5 ? Math.ceil(q) : Math.floor(q);
};

async function openTransport(page: Page) {
  // A slow test machine may measure as "low" quality, where the lesson uses the 2D pictures.
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
  await page.getByRole('button', { name: 'Khuếch tán & thẩm thấu', exact: true }).click();
  await expect(page.locator('.tr3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('diffusion & osmosis 3D: Fick counts, a picked particle, the U-tube’s heights, the 2D pictures', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openTransport(page);
  await expect(page.locator('.science-card')).toContainText('Khuếch tán qua màng 3D');
  await expect(page.locator('.tr3d__counts')).toHaveText('Ngăn 1: 160 hạt · Ngăn 2: 0 hạt');
  expect(await hook(page, 'counts')).toEqual({ n1: 160, n2: 0, left: 160, right: 0 });
  await expect(page.locator('.m3d__caption')).toContainText(
    'Đường đi của từng hạt là minh họa; số hạt mỗi ngăn theo định luật Fick.',
  );

  // Scrub: each side holds Fick's count, and the particles drawn agree.
  const time = page.getByRole('slider', { name: 'Thời gian' });
  for (const t of ['1', '2.5', '6']) {
    await time.fill(t);
    const n1 = n1At(Number(t));
    await expect(page.locator('.tr3d__counts')).toHaveText(
      `Ngăn 1: ${String(n1)} hạt · Ngăn 2: ${String(160 - n1)} hạt`,
    );
    expect(await hook(page, 'counts')).toEqual({ n1, n2: 160 - n1, left: n1, right: 160 - n1 });
  }

  // Pick a particle (one not hidden behind another): its card carries the model's amount.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const card = page.locator('.m3d__info');
  let picked = false;
  for (let index = 159; index >= 100 && !picked; index -= 3) {
    const at = await hook<Pt>(page, 'focus', { kind: 'particle', index });
    if (!at) continue;
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(150);
    if ((await card.count()) === 0) continue;
    const title = (await card.locator('strong').first().textContent()) ?? '';
    if (title.startsWith('Hạt chất tan số')) picked = true;
    else await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  }
  expect(picked, 'a particle can be picked').toBe(true);
  // 10 mM × 1 mL = 10 µmol over 160 particles.
  await expect(card).toContainText('Mỗi hạt ứng với ≈ 0,0625 µmol chất tan');
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/transport3d-diffusion.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.tr3d button, .tr3d [role="radio"]')]
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
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();

  // Osmosis: the chips of the 2D picture, the columns at the model's heights.
  await page.getByRole('radio', { name: 'Thẩm thấu' }).click();
  await expect(page.getByText(/Π₀ = iC₀RT/)).toBeVisible();
  await expect(page.locator('.science-card')).toContainText('Thẩm thấu 3D');
  await expect(page.locator('.tr3d[data-mode="osmosis"] canvas')).toBeVisible();
  // To the end of the range (the last sample of the trajectory).
  await time.focus();
  await page.keyboard.press('End');
  await expect
    .poll(async () => (await hook<{ hL: number }>(page, 'heights'))?.hL ?? 0)
    .toBeGreaterThan(0.2);
  const h = (await hook<{ hL: number; hR: number; drawnL: number; drawnR: number; sceneL: number }>(
    page,
    'heights',
  ))!;
  expect(h.drawnL).toBeCloseTo(h.hL, 6);
  expect(h.drawnR).toBeCloseTo(h.hR, 6);
  // The equilibrium of the defaults (C₀ = 1 mM, i = 1, 25 °C, h₀ = 20 cm): ρgΔh = Π.
  const RT = 8.314462618 * 298.15;
  const rg = 1000 * 9.80665;
  const hEq = (2 * rg * 0.2 + Math.sqrt((2 * rg * 0.2) ** 2 + 8 * rg * 0.2 * RT)) / (4 * rg);
  const dhEq = 2 * hEq - 0.4;

  // Pick the solution column at its outer edge, clear of the solute (arm at x = −2,5, bore
  // 0,62): h_L, Δh and the model's equilibrium.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const at = await hook<Pt>(page, 'point', [-2.5 - 0.92 * 0.62, h.sceneL * 0.4, 0]);
  expect(at).not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
  await expect(card).toContainText('Cột dung dịch (nhánh trái)');
  await expect(card).toContainText(`h_L = ${vi(h.hL * 100)} cm`);
  await expect(card).toContainText(`Cân bằng (mô hình): Δh = ${vi(dhEq * 100)} cm`);
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/transport3d-osmosis.png` });
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();

  // The 2D pictures and back.
  await page.getByRole('radio', { name: '2D', exact: true }).click();
  await expect(page.locator('.tr3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  await page.getByRole('radio', { name: '3D', exact: true }).click();
  await expect(page.locator('.tr3d canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
