import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function noScrollNoErrors(page: Page, errors: string[]) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
}

/** VL12 Bài 15 (#255 round 3c): the questions of tr. 63 and the measurement of Bảng 15.1. */
test('magnetic force: question 1 and 2 of tr. 63, the left-hand rule, Bảng 15.1', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Lực từ và cảm ứng từ');
  await expect(page.locator('.stage__hud-title')).toHaveText('Lực từ và cảm ứng từ', {
    timeout: 20_000,
  });
  // F = 5·10⁻² · 3 · 1 · sin 60° ≈ 0,13 N, into the page for B⃗ to the right.
  await expect(page.locator('.magnetic-panel__force')).toHaveText('0,13 N');
  await expect(page.getByRole('img', { name: /F = 0,13 N, .*hướng vào trong/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('force.png') });
  await page.getByRole('radio', { name: 'Đảo chiều' }).click();
  await expect(page.getByRole('img', { name: /hướng ra ngoài/ })).toBeVisible();
  // 10¹⁸ electrons each second = 0,16 A; 0,5 m across 5 mT → 4·10⁻⁴ N.
  await page.getByRole('button', { name: 'Câu 2 tr. 63' }).click();
  await expect(page.locator('.magnetic-panel__force')).toHaveText('4·10⁻⁴ N');

  await page.getByRole('radio', { name: 'Đo cảm ứng từ' }).click();
  await expect(page.locator('.magnetic-panel__mean')).toHaveText('0,0114 T');
  await expect(page.getByRole('img', { name: /Bảng 15.1: B trung bình 0,0114 T/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('measure.png') });
  await noScrollNoErrors(page, errors);
});

/** VL12 Bài 16–17: flux and the mean e.m.f., the generator's E₀ = NBSω, three phases. */
test('induction: −N ΔΦ/Δt, the generator at 50 Hz, three phases', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Cảm ứng điện từ và máy phát điện xoay chiều');
  await expect(page.locator('.stage__hud-title')).toHaveText(
    'Cảm ứng điện từ và máy phát điện xoay chiều',
    { timeout: 20_000 },
  );
  // 200 turns, 100 cm², 0,1 T turned from 0° to 90° in 0,1 s: e = −200 · (0 − 10⁻³) / 0,1 = 2 V.
  await expect(page.locator('.induction-panel__emf')).toHaveText('2 V');
  await page.screenshot({ path: testInfo.outputPath('flux.png') });
  await page.getByRole('radio', { name: 'Máy phát điện xoay chiều' }).click();
  // E₀ = 200 · 0,1 · 0,01 · 100π ≈ 62,83 V.
  await expect(page.locator('.induction-panel__peak')).toHaveText('62,83 V');
  await expect(page.getByRole('img', { name: /E₀ = 62,83 V, T = 20 ms/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Ba pha' }).click();
  await expect(page.getByRole('radio', { name: 'Ba pha' })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('generator.png') });
  await noScrollNoErrors(page, errors);
});
