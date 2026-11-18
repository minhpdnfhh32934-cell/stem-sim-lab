declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6a of #302: the 3D views of "Lực từ và cảm ứng từ", "Cảm ứng điện từ và máy phát điện
 * xoay chiều" and "Sóng điện từ". They open in 2D (the picture with the chart) and offer 3D;
 * what the 3D scene draws is read back from its debug hook and must be the lesson's numbers.
 * WebGL runs in software (SwiftShader), never on the GPU.
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  frames(): number;
  state(): Record<string, unknown> | null;
}
const hook = (page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d?.[
      l
    ];
    return h ? { frames: h.frames(), state: h.state() } : null;
  }, lesson);

async function open(page: Page, errors: string[], topic: string) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Vật lý', topic);
  await expect(page.locator('.stage__hud-title').first()).toHaveText(topic, { timeout: 20_000 });
}

async function noScrollNoErrors(page: Page, errors: string[]) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
}

test('Lực từ in 3D: F⃗ ⊥ the wire and B⃗, the model’s value, 2D for the measurement', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Lực từ và cảm ứng từ');
  // Opens in 2D; the switch offers 3D.
  await expect(page.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="magneticForce"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await hook(page, 'magneticForce'))?.frames ?? 0)
    .toBeGreaterThan(0);
  // Question 1 p. 63: 0,13 N into the page (−z).
  const s = (await hook(page, 'magneticForce'))?.state as {
    F: number;
    dir: string;
    force: number[];
  };
  expect(s.F).toBeCloseTo(0.075 * Math.sqrt(3), 12);
  expect(s.dir).toBe('into');
  expect(s.force[2]).toBeLessThan(0);
  await expect(view.getByRole('img', { name: /F = 0,13 N, .*hướng vào trong/ })).toBeVisible();
  await expect(view.getByText('F = 0,13 N')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('magnetic-3d.png') });
  await page.getByRole('radio', { name: 'Đảo chiều' }).click();
  await expect.poll(async () => (await hook(page, 'magneticForce'))?.state?.dir).toBe('outOf');
  // The measurement is a chart: always 2D; the force comes back in 3D.
  await page.getByRole('radio', { name: 'Đo cảm ứng từ' }).click();
  await expect(view).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Bảng 15.1: B trung bình 0,0114 T/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Lực từ', exact: true }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.getByRole('img', { name: /hướng ra ngoài/ })).toBeVisible();
  await expect(view).toHaveCount(0);
  await noScrollNoErrors(page, errors);
});

test('Cảm ứng điện từ in 3D: the coil’s normal gives the model’s flux', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Cảm ứng điện từ và máy phát điện xoay chiều');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="induction"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  type S = {
    now: { phi: number };
    before: { phi: number } | null;
    coilNormal: number[];
    emf: number;
  };
  const state = async () => (await hook(page, 'induction'))?.state as S | undefined;
  // 0° → 90° in 0,1 s: Φ₁ = 10⁻³ Wb, Φ₂ = 0, e = 2 V; the drawn coil faces B⃗ edge-on.
  await expect.poll(async () => (await state())?.before?.phi).toBeCloseTo(1e-3, 12);
  const flux = await state();
  expect(flux?.emf).toBeCloseTo(2, 12);
  expect(Math.abs(flux?.coilNormal[0] ?? 1)).toBeLessThan(1e-6);
  await expect(view.getByText(/^Φ₁ = .+ Wb$/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('induction-flux-3d.png') });

  await page.getByRole('radio', { name: 'Máy phát điện xoay chiều' }).click();
  await expect.poll(async () => (await state())?.before).toBeNull();
  // A quarter period (5 ms at 50 Hz): n⃗ ⊥ B⃗, the flux 0 and e = E₀.
  const slider = page.getByRole('slider', { name: 'Thời điểm t' });
  await slider.focus();
  for (let k = 0; k < 25; k++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state())?.emf ?? 0).toBeCloseTo(20 * Math.PI, 9);
  const g = await state();
  expect(Math.abs(g?.coilNormal[0] ?? 1)).toBeLessThan(1e-6);
  await page.screenshot({ path: testInfo.outputPath('induction-generator-3d.png') });
  await noScrollNoErrors(page, errors);
});

test('Sóng điện từ in 3D: E ⊥ B ⊥ c, the lesson’s λ, moving', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Sóng điện từ');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="emWave"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(view.locator('.three-label', { hasText: 'λ = 500 nm' })).toBeVisible();
  await expect(view.getByRole('img', { name: /λ = 500 nm: Ánh sáng nhìn thấy/ })).toBeVisible();
  // The wave moves (illustration): the phase grows between two reads.
  const phase = async () =>
    ((await hook(page, 'emWave'))?.state as { phase: number } | undefined)?.phase ?? 0;
  const p0 = await phase();
  await expect.poll(phase).toBeGreaterThan(p0);
  await page.getByRole('combobox', { name: 'Đơn vị' }).selectOption('cm');
  await page.getByRole('textbox', { name: 'Bước sóng' }).fill('3');
  await expect(view.locator('.three-label', { hasText: 'λ = 3 cm' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('emwave-3d.png') });
  await noScrollNoErrors(page, errors);
});
