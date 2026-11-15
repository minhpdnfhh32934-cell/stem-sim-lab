import { expect, test, type Page } from '@playwright/test';
import { sh10b20MicrobeDiversity } from '../../src/studio/guided/lessons/sh10b20MicrobeDiversity';
import { openTopic } from './nav';

/**
 * SH10 descriptive lessons as guided lessons in the classic library (#255 round 1h): no
 * simulation, a prediction and checked activities whose key is the lesson data itself.
 */
const next = (page: Page) => page.getByRole('button', { name: /^Tiếp:/ });

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Bài 3: predict, move one level, check, read the reasons; card in the Inspector', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Các cấp độ tổ chức của thế giới sống');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Cấp độ tổ chức sống: từ tế bào đến hệ sinh thái',
    }),
  ).toBeVisible({ timeout: 20_000 });
  // The lab's frame names a lesson, not a simulation.
  await expect(page.getByRole('region', { name: 'Khung bài học' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Khung mô phỏng' })).toHaveCount(0);
  await expect(page.getByText('Bài học mô tả: không có thí nghiệm hay số đo.')).toBeVisible();
  await expect(page.locator('.science-card')).toBeVisible();
  await expect(page.locator('.science-card')).toContainText('Định tính');

  await page.getByRole('radio', { name: 'Tế bào' }).click();
  await next(page).click();
  await noSideScroll(page);

  const order = page.getByRole('region', { name: /Xếp các cấp tổ chức của thế giới sống/ });
  const rows = order.locator('li[data-row]');
  await expect(rows).toHaveCount(8);
  const before = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-row')));
  // With the keyboard: the focus follows the moved item, and the move is announced.
  const first = (await rows.first().locator('.guided-row__text').textContent()) ?? '';
  await order.getByRole('button', { name: `Đưa xuống: ${first}` }).focus();
  await page.keyboard.press('Enter');
  const after = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-row')));
  expect(after).toEqual([before[1], before[0], ...before.slice(2)]);
  await expect(order.getByRole('button', { name: `Đưa xuống: ${first}` })).toBeFocused();
  await expect(order.getByText(`${first}: vị trí 2/8`)).toBeAttached();
  // Back to the top: "Đưa lên" is then disabled, so the focus goes to the item's other arrow.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  await expect(order.getByRole('button', { name: `Đưa xuống: ${first}` })).toBeFocused();
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-row')))).toEqual(
    before,
  );

  // The match and sort activities must be answered before "Kiểm tra" works.
  const check = page.getByRole('button', { name: 'Kiểm tra' });
  await expect(check).toBeDisabled();
  const match = page.getByRole('region', { name: /Ghép mỗi đặc điểm chung/ });
  for (const select of await match.getByRole('combobox').all()) {
    await select.selectOption({ index: 1 });
  }
  const sort = page.getByRole('region', { name: /cấp tổ chức cơ bản hay/ });
  for (const group of await sort.getByRole('radiogroup').all()) {
    await group.getByRole('radio').first().click();
  }
  // By keyboard: "Kiểm tra" disables itself, and its focus moves to the result (not to <body>).
  await check.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Em đúng \d+\/20 ý\./)).toBeVisible();
  await expect(page.getByText(/^Em đúng \d+\/20 ý\./)).toBeFocused();
  await expect(order.getByText(/^Đúng \d\/8$/)).toBeVisible();
  // Each row says right or wrong in words, with the lesson's reason.
  await expect(
    order.getByText('Nhiều tế bào hợp lại, cùng làm một việc.', { exact: true }),
  ).toBeVisible();
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('Bài 20: sort and match from the lesson file, then every step to a report', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const b = sh10b20MicrobeDiversity.binding;
  if (b.kind !== 'guided') throw new Error('guided');
  await openTopic(page, 'Sinh học', 'Đa dạng và phương pháp nghiên cứu vi sinh vật');
  await expect(
    page.getByRole('heading', { level: 2, name: sh10b20MicrobeDiversity.title.vi }),
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
  await next(page).click();
  await page
    .getByLabel('Giải thích của em')
    .fill('Nấm men lấy năng lượng và carbon từ chất hữu cơ.');
  await next(page).click();
  await expect(page.getByText('Dự đoán của em khớp với đáp án của bài học.')).toBeVisible();
  await page.getByLabel('Kết luận của em').fill('Vi sinh vật có bốn kiểu dinh dưỡng.');
  await expect(page.locator('.studio-flow__body')).not.toContainText(/mô phỏng/i);
  await next(page).click();

  const report = page.getByLabel('Bản xem trước báo cáo');
  await expect(report).toContainText('Kết quả từ thư viện dữ liệu của ứng dụng');
  await expect(report).toContainText('Bài 20. Sự đa dạng và phương pháp nghiên cứu vi sinh vật');
  await expect(report).not.toContainText(/mô phỏng/i);
  await noSideScroll(page);
  expect(errors).toEqual([]);
});
