import { expect, test, type Page } from '@playwright/test';
import { sh11b01Metabolism } from '../../src/studio/guided/lessons/sh11b01Metabolism';
import { sh11b02WaterMinerals } from '../../src/studio/guided/lessons/sh11b02WaterMinerals';
import { sh11b04Photosynthesis } from '../../src/studio/guided/lessons/sh11b04Photosynthesis';
import { sh11b06Respiration } from '../../src/studio/guided/lessons/sh11b06Respiration';
import { sh11b08Digestion } from '../../src/studio/guided/lessons/sh11b08Digestion';
import { sh11b09AnimalRespiration } from '../../src/studio/guided/lessons/sh11b09AnimalRespiration';
import { sh11b10Circulation } from '../../src/studio/guided/lessons/sh11b10Circulation';
import { sh11b12Immunity } from '../../src/studio/guided/lessons/sh11b12Immunity';
import { sh11b13Excretion } from '../../src/studio/guided/lessons/sh11b13Excretion';
import { sh11b14Response } from '../../src/studio/guided/lessons/sh11b14Response';
import { sh11b15PlantResponse } from '../../src/studio/guided/lessons/sh11b15PlantResponse';
import { sh11b17AnimalResponse } from '../../src/studio/guided/lessons/sh11b17AnimalResponse';
import { sh11b18Behaviour } from '../../src/studio/guided/lessons/sh11b18Behaviour';
import { sh11b19Growth } from '../../src/studio/guided/lessons/sh11b19Growth';
import { sh11b20PlantGrowth } from '../../src/studio/guided/lessons/sh11b20PlantGrowth';
import { sh11b22AnimalGrowth } from '../../src/studio/guided/lessons/sh11b22AnimalGrowth';
import { openTopic } from './nav';

/** SH11 as guided lessons (#255 rounds 2h–2j). */
test.use({ viewport: { width: 1366, height: 768 } });

const next = (page: Page) => page.getByRole('button', { name: /^Tiếp:/ });

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() =>
    Object.fromEntries(
      ['html', '.guided-stage', '.studio-pane'].map((sel) => {
        const el = document.querySelector(sel);
        return [sel, el ? el.scrollWidth - el.clientWidth : null];
      }),
    ),
  );
  expect(overflow).toEqual({ html: 0, '.guided-stage': 0, '.studio-pane': 0 });
}

test('Bài 4: every sort and match answered from the lesson file scores full marks', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const b = sh11b04Photosynthesis.binding;
  if (b.kind !== 'guided') throw new Error('guided');
  await openTopic(page, 'Sinh học', 'Quang hợp ở thực vật');
  await expect(
    page.getByRole('heading', { level: 2, name: sh11b04Photosynthesis.title.vi }),
  ).toBeVisible({ timeout: 20_000 });
  const answer = b.choices.find((c) => c.id === b.answer);
  await page.getByRole('radio', { name: answer?.text.vi ?? '' }).click();
  await next(page).click();

  let rows = 0;
  for (const a of b.activities) {
    const box = page.locator(`[data-activity="${a.id}"]`);
    if (a.kind === 'sort') {
      for (const item of a.items) {
        const group = a.groups.find((g) => g.id === item.group);
        await box
          .getByRole('radiogroup', { name: item.text.vi, exact: true })
          .getByRole('radio', { name: group?.label.vi ?? '', exact: true })
          .click();
        rows += 1;
      }
    } else if (a.kind === 'match') {
      for (const p of a.pairs) {
        await box.getByLabel(p.left.vi, { exact: true }).selectOption({ label: p.right.vi });
        rows += 1;
      }
    }
  }
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(
    page.getByText(`Em đúng ${String(rows)}/${String(rows)} ý.`, { exact: false }),
  ).toBeVisible();
  await next(page).click();
  await expect(page.getByText(`Đáp án: ${answer?.text.vi ?? ''}`, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [topic, lesson] of [
  ['Trao đổi chất ở sinh vật', sh11b01Metabolism],
  ['Trao đổi nước và khoáng ở thực vật', sh11b02WaterMinerals],
  ['Hô hấp ở thực vật', sh11b06Respiration],
  ['Dinh dưỡng và tiêu hóa ở động vật', sh11b08Digestion],
  ['Hô hấp ở động vật', sh11b09AnimalRespiration],
  ['Tuần hoàn ở động vật', sh11b10Circulation],
  ['Miễn dịch ở người và động vật', sh11b12Immunity],
  ['Bài tiết và cân bằng nội môi', sh11b13Excretion],
  ['Khái quát về cảm ứng', sh11b14Response],
  ['Cảm ứng ở thực vật', sh11b15PlantResponse],
  ['Cảm ứng ở động vật', sh11b17AnimalResponse],
  ['Tập tính ở động vật', sh11b18Behaviour],
  ['Khái quát về sinh trưởng và phát triển', sh11b19Growth],
  ['Sinh trưởng và phát triển ở thực vật', sh11b20PlantGrowth],
  ['Sinh trưởng và phát triển ở động vật', sh11b22AnimalGrowth],
] as const) {
  test(`${topic}: opens on the prediction and its activities fit 1366×768`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const b = lesson.binding;
    if (b.kind !== 'guided') throw new Error('guided');
    await openTopic(page, 'Sinh học', topic);
    await expect(page.getByRole('heading', { level: 2, name: lesson.title.vi })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('radio', { name: b.choices[0]?.text.vi ?? '' }).click();
    await next(page).click();
    for (const a of b.activities)
      await expect(page.locator(`[data-activity="${a.id}"]`)).toBeVisible();
    await noSideScroll(page);
    expect(errors).toEqual([]);
  });
}
