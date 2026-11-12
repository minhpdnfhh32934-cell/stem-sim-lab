import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterStudio, openLab } from '../nav';

/**
 * Text drawn inside SVG pictures is sized in the picture's own units, so its size on screen is
 * font-size × the picture's scale (getScreenCTM). #205 A1: none of it below the 12px floor at
 * 1366×768, with Cỡ chữ at 100 % and 140 % (the larger text narrows some containers).
 */
async function smallestTextPx(svg: Locator): Promise<number> {
  await expect(svg.locator('text').first()).toBeVisible({ timeout: 20_000 });
  return svg.evaluate((el) => {
    const sizes = [...el.querySelectorAll('text')].map((t) => {
      const m = (t as SVGGraphicsElement).getScreenCTM();
      const scale = m ? Math.hypot(m.a, m.b) : 1;
      return parseFloat(getComputedStyle(t).fontSize) * scale;
    });
    return Math.min(...sizes);
  });
}

async function check(svg: Locator, what: string) {
  const px = await smallestTextPx(svg);
  test.info().annotations.push({ type: what, description: `${px.toFixed(2)} px` });
  expect(px, what).toBeGreaterThanOrEqual(12 - 0.01);
}

async function openChemistryTopic(page: Page, topic: string) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
}

for (const fontScale of [1, 1.4] as const) {
  const at = `${String(fontScale * 100)} %`;

  test.describe(`SVG text at ${at}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.addInitScript((scale) => {
        localStorage.setItem(
          'stemsim.settings',
          JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
        );
      }, fontScale);
    });

    test(`titration picture: NaOH and HCl at least 12px (${at})`, async ({ page }) => {
      await openChemistryTopic(page, 'Chuẩn độ acid – base');
      await check(page.getByRole('img', { name: /Buret và cốc dung dịch/ }), 'titration');
    });

    test(`energy diagram labels at least 12px (${at})`, async ({ page }) => {
      await openChemistryTopic(page, 'Cân bằng hóa học & Le Chatelier');
      await check(page.getByRole('img', { name: /Giản đồ năng lượng/ }), 'energy diagram');
    });

    test(`Gemini key guide drawings at least 12px (${at})`, async ({ page }) => {
      await openLab(page);
      // The AI status chip also says 'Cài đặt' without a key; the gear is the last one.
      await page.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
      const settings = page.getByRole('dialog', { name: 'Cài đặt' });
      await settings.getByRole('tab', { name: 'Kết nối AI' }).click();
      const guide = settings.locator('details.ai-guide', {
        hasText: 'Hướng dẫn lấy khóa API Gemini',
      });
      if (!(await guide.evaluate((d) => (d as HTMLDetailsElement).open))) {
        await guide.locator('summary').click();
      }
      const arts = guide.locator('svg.guide-art');
      await expect(arts).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) await check(arts.nth(i), `guide drawing ${String(i + 1)}`);
    });

    test(`Science Studio test tube labels at least 12px (${at})`, async ({ page }) => {
      await page.goto('/');
      await enterStudio(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('tab', { name: 'Hóa học' }).click();
      await page.getByRole('radio', { name: 'Xuất hiện kết tủa' }).click();
      await page.getByRole('button', { name: /^Tiếp:/ }).click();
      await page.getByRole('button', { name: 'Thêm dung dịch NaCl' }).click();
      await check(page.getByRole('img', { name: /^Ống nghiệm/ }), 'test tube');
    });
  });
}
