declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D view of "Đột biến điểm". WebGL runs in software (SwiftShader) for every test of this
 * file, never on the GPU (see mitosis3d.spec.ts); the renderer is checked before the 3D view
 * starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Sel = { kind: 'bead'; helix: 'normal' | 'mutated'; index: number };
interface Debug {
  effect(): string;
  pairPoint(helix: string, i: number): { x: number; y: number } | null;
  focus(sel: Sel): { x: number; y: number } | null;
  moving(): boolean;
}
/** Calls one read-only debug hook of the view (`window.__simlab3d.mutation`). */
const hook = (page: Page, fn: 'effect' | 'pair' | 'focus' | 'moving', arg?: number | Sel) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.mutation;
      if (!d) return null;
      if (f === 'effect') return d.effect();
      if (f === 'moving') return d.moving();
      if (f === 'pair') return d.pairPoint('normal', a as number);
      return d.focus(a as Sel);
    },
    [fn, arg] as const,
  );

async function openMutation(page: Page) {
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
  await page.getByRole('button', { name: 'Đột biến điểm', exact: true }).click();
  await expect(page.locator('.mut3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('point mutation 3D: the effect from the model, a picked bead, a picked pair moves the site', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openMutation(page);
  await expect(page.locator('.science-card')).toContainText('Đột biến điểm 3D');
  // The lesson's default (AAA → TAA at position 13): EFFECT.nonsense, the mutated protein.
  await expect(page.getByText('Đột biến vô nghĩa')).toBeVisible();
  await expect(page.getByText('Met–Ala–Phe', { exact: true })).toBeVisible();
  await expect(page.getByText('Thay A bằng T ở vị trí 13')).toBeVisible();
  expect(await hook(page, 'effect')).toBe('nonsense');

  // Pick the third amino acid of the mutated chain: the card compares both chains.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const bead = (await hook(page, 'focus', { kind: 'bead', helix: 'mutated', index: 2 })) as {
    x: number;
    y: number;
  } | null;
  expect(bead, 'the third amino acid is in view').not.toBeNull();
  await page.mouse.click(bead!.x, bead!.y);
  const card = page.locator('.m3d__info');
  await expect(card).toContainText('Axit amin thứ 3');
  await expect(card).toContainText('Bình thường: Phe (Phenylalanine), từ bộ ba UUC.');
  await expect(card).toContainText('Đột biến: Phe (Phenylalanine), từ bộ ba UUC.');
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/mutation3d-bead.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.mut3d button, .mut3d [role="radio"]')]
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

  // Pick base pair 16 of the normal DNA (G of GGC): the mutation moves there — the panel's
  // position input follows — and GGC → TGC is a missense mutation (Gly → Cys).
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const pair = (await hook(page, 'pair', 15)) as { x: number; y: number } | null;
  expect(pair, 'base pair 16 is in view').not.toBeNull();
  await page.mouse.click(pair!.x, pair!.y);
  await expect(page.getByRole('spinbutton', { name: /Vị trí/ })).toHaveValue('16');
  await expect(card).toContainText('Đã đặt vị trí đột biến ở đây (vị trí 16).');
  await expect(page.getByText('Đột biến sai nghĩa')).toBeVisible();
  await expect.poll(() => hook(page, 'effect')).toBe('missense');
  await expect(page.getByText('Met–Ala–Phe–Lys–Cys–Trp', { exact: true })).toBeVisible();
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/mutation3d-site.png` });

  // The 2D page shows the same effect; 3D comes back.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.mut3d')).toHaveCount(0);
  await expect(page.getByText('Đột biến sai nghĩa:')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.mut3d canvas')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
