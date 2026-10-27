declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D view of "ADN → mARN → Protein". WebGL runs in software (SwiftShader) for every test of
 * this file, never on the GPU (see mitosis3d.spec.ts); the renderer is checked before the 3D
 * view starts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Sel =
  | { kind: 'base'; strand: 'coding' | 'template'; index: number }
  | { kind: 'residue'; codon: number };
interface Debug {
  phase(): string;
  step(): number;
  basePoint(strand: string, i: number): { x: number; y: number } | null;
  focus(sel: Sel): { x: number; y: number } | null;
  moving(): boolean;
}
/** Calls one read-only debug hook of the view (`window.__simlab3d.dogma`). */
const hook = (page: Page, fn: 'phase' | 'step' | 'base' | 'focus' | 'moving', arg?: number | Sel) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { __simlab3d?: Record<string, Debug | undefined> }).__simlab3d
        ?.dogma;
      if (!d) return null;
      if (f === 'phase') return d.phase();
      if (f === 'step') return d.step();
      if (f === 'moving') return d.moving();
      if (f === 'base') return d.basePoint('coding', a as number);
      return d.focus(a as Sel);
    },
    [fn, arg] as const,
  );

async function openDogma(page: Page) {
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
  await page.getByRole('button', { name: 'ADN → mARN → Protein', exact: true }).click();
  await expect(page.locator('.dogma3d canvas')).toBeVisible({ timeout: 30_000 });
}

test('DNA → mRNA → protein 3D: a picked base shows the model’s pair and codon; 2D keeps the codon', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openDogma(page);
  await expect(page.locator('.science-card')).toContainText('ADN → mARN → Protein 3D');
  const caption = page.locator('.m3d__caption');
  await expect(caption).toContainText('ARN pôlimeraza tháo xoắn đoạn ADN đầu tiên');

  // Step to the finished mRNA, then to the first codon read (the default gene's AUG).
  const next = page.getByRole('button', { name: 'Bước tiếp theo' });
  await next.click();
  await next.click();
  await expect.poll(() => hook(page, 'phase')).toBe('translation');
  await expect(caption).toContainText(
    'Ribosome ở bộ ba thứ 1/7: AUG → Met (Methionine), tARN mang bộ ba đối mã UAC.',
  );
  await expect(page.getByText('Chuỗi pôlipeptit: 1 axit amin')).toBeVisible();

  // Pick base pair 4 of the coding strand (index 3): A, paired with T, first base of AUG — once
  // the camera has finished gliding to the ribosome.
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const at = (await hook(page, 'base', 3)) as { x: number; y: number } | null;
  expect(at, 'base 4 is in view').not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
  const card = page.locator('.m3d__info');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Ađênin (A)');
  await expect(card).toContainText('cặp nuclêôtit thứ 4');
  await expect(card).toContainText('Bắt cặp với T (Timin)');
  await expect(card).toContainText('AUG → Met (Methionine)');
  await expect(card).toContainText('bộ ba đối mã của tARN: UAC');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dogma3d-base.png` });

  // With the card open at 1366 × 768: no two boxes over the picture overlap; targets ≥ 40 px.
  const boxes = await page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const small = [...document.querySelectorAll('.dogma3d button, .dogma3d [role="radio"]')]
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

  // Three codons on: the chain is Met–Ala–Phe–Lys (the model's translation).
  await page.locator('.m3d__info').getByRole('button', { name: 'Bỏ chọn' }).click();
  for (let k = 0; k < 3; k++) await next.click();
  await expect(caption).toContainText('Ribosome ở bộ ba thứ 4/7: AAA → Lys (Lysine)');
  await expect.poll(() => hook(page, 'step')).toBe(3);
  await expect.poll(() => hook(page, 'moving')).toBe(false);
  const bead = (await hook(page, 'focus', { kind: 'residue', codon: 2 })) as {
    x: number;
    y: number;
  } | null;
  expect(bead, 'the third amino acid is in view').not.toBeNull();
  await page.mouse.click(bead!.x, bead!.y);
  await expect(card).toContainText('Phe (Phenylalanine)');
  await expect(card).toContainText('Axit amin thứ 3 của chuỗi pôlipeptit.');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dogma3d-chain.png` });

  // 2D keeps the codon, and 3D comes back to it.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.dogma3d')).toHaveCount(0);
  await expect(page.getByText('Ribosome ở bộ ba thứ 4/7')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.dogma3d canvas')).toBeVisible({ timeout: 15_000 });
  await expect(caption).toContainText('Ribosome ở bộ ba thứ 4/7');
  expect(errors).toEqual([]);
});
