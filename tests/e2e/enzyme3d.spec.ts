declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D view of "Động học enzyme". WebGL runs in software (SwiftShader) for every test of this
 * file, never on the GPU (see mitosis3d.spec.ts); the renderer is checked before the 3D view
 * starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Sel = { kind: 'enzyme'; index: number };
type Form = 'E' | 'ES' | 'EI' | 'ESI';
interface Debug {
  counts(): Record<Form, number>;
  forms(): Form[];
  particles(): { S: number; P: number; I: number };
  pool0(): number;
  focus(sel: Sel): { x: number; y: number } | null;
  moving(): boolean;
}
type HookName = 'counts' | 'forms' | 'particles' | 'pool0' | 'focus' | 'moving';
/** Calls one read-only debug hook of the view (`window.__simlab3d.enzyme`). */
const hook = <T>(page: Page, fn: HookName, arg?: Sel) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.enzyme;
      if (!d) return null;
      if (f === 'focus') return d.focus(a as Sel);
      return d[f]();
    },
    [fn, arg] as const,
  ) as unknown as Promise<T | null>;

async function openEnzyme(page: Page) {
  // A slow test machine may measure as "low" quality, where the lesson uses the 2D plots.
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
  await page
    .getByRole('button', { name: 'Động học enzyme (Michaelis–Menten)', exact: true })
    .click();
  await expect(page.locator('.enz3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('enzyme 3D: forms from the model, a picked enzyme’s card, the time course, the 2D plots', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openEnzyme(page);
  await expect(page.locator('.science-card')).toContainText('Động học enzyme 3D');
  // The lesson's default (competitive, Km = 2, [I] = 2, Kᵢ = 1): the cursor opens at the
  // apparent Km = 6 mM, where v = Vmax/2 — 12 of the 24 enzymes hold substrate.
  await expect(page.locator('.enz3d__counts')).toHaveText('ES 12 · EI 8 · tự do 4');
  expect(await hook(page, 'counts')).toEqual({ E: 4, ES: 12, EI: 8, ESI: 0 });
  await expect(page.getByText('1 hạt = 0,2 mM')).toBeVisible();
  expect(await hook(page, 'particles')).toEqual({ S: 30, P: 0, I: 10 });
  await expect(page.locator('.m3d__caption')).toContainText(
    'Hình dạng enzyme, vị trí và chuyển động của hạt là minh họa; số enzyme là mẫu đại diện.',
  );

  // Pick an ES enzyme (one not hidden behind a particle): its form and the model's share.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const forms = (await hook<Form[]>(page, 'forms')) ?? [];
  const card = page.locator('.m3d__info');
  let picked = false;
  for (const [index, form] of forms.entries()) {
    if (form !== 'ES') continue;
    const at = await hook<{ x: number; y: number }>(page, 'focus', { kind: 'enzyme', index });
    if (!at) continue;
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(200);
    if ((await card.count()) === 0) continue;
    const title = (await card.locator('strong').first().textContent()) ?? '';
    if (title.startsWith(`Enzyme số ${String(index + 1)}:`)) {
      picked = true;
      break;
    }
    await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  }
  expect(picked, 'an ES enzyme can be picked').toBe(true);
  await expect(card).toContainText('Phức hợp enzyme – cơ chất (ES)');
  await expect(card).toContainText(
    'Theo mô hình, ở [S] = 6 mM: 50 % số enzyme ở dạng ES; trên hình 12/24 enzyme.',
  );
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/enzyme3d-card.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.enz3d button, .enz3d [role="radio"]')]
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

  // The [S] cursor at the top of the plot (20 mM): ES = round(24 · 10/13) = 18.
  await page.getByRole('slider', { name: 'Nồng độ cơ chất [S]' }).fill('20');
  await expect(page.locator('.enz3d__counts')).toHaveText('ES 18 · EI 4 · tự do 2');

  // The time course: S + P particles always add up to [S]₀'s (10 mM = 100 particles of 0,1 mM).
  await page.getByRole('radio', { name: '[S] theo thời gian' }).click();
  await expect(page.getByText('1 hạt = 0,1 mM')).toBeVisible();
  expect(await hook(page, 'pool0')).toBe(100);
  const time = page.getByRole('slider', { name: 'Thời gian' });
  for (const t of ['0.5', '1.5', '3']) {
    await time.fill(t);
    await expect(page.locator('.bio3d__player output')).toContainText(
      `t = ${t.replace('.', ',')} phút`,
    );
    const p = await hook<{ S: number; P: number }>(page, 'particles');
    expect((p?.S ?? 0) + (p?.P ?? 0)).toBe(100);
    expect(p?.P ?? 0).toBeGreaterThan(0);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/enzyme3d-time.png` });

  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.enz3d')).toHaveCount(0);
  await expect(page.locator('.bio-stage-chart')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.enz3d canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
